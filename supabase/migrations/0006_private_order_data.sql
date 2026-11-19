-- Customer order data must not be readable or writable through browser roles.
-- Before applying in production, verify that the actual server/Hyperdrive role
-- remains able to access these tables under RLS, and check existing policies
-- and grants. This change does not delete or alter order/customer rows.
BEGIN;
DO $$
DECLARE table_name TEXT; sequence_name TEXT; browser_role TEXT; privilege_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['orders', 'order_items', 'customers'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = 'aura_deny_browser_roles') THEN
      EXECUTE format('CREATE POLICY aura_deny_browser_roles ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', table_name);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = table_name
        AND policyname = 'aura_deny_browser_roles' AND permissive = 'RESTRICTIVE' AND cmd = 'ALL'
        AND qual = 'false' AND with_check = 'false' AND roles @> ARRAY['anon', 'authenticated']::name[]
    ) THEN
      RAISE EXCEPTION 'Unsafe existing browser-deny policy on %', table_name;
    END IF;
    -- TRUNCATE bypasses RLS; revoke it explicitly from direct and PUBLIC grants.
    -- A grant inherited through another role is checked below and fails closed.
    EXECUTE format('REVOKE TRUNCATE ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id');
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', sequence_name);
    END IF;
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(browser_role, format('public.%I', table_name), 'TRUNCATE') THEN
        RAISE EXCEPTION 'Browser role retains TRUNCATE privilege on %', table_name;
      END IF;
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(browser_role, format('public.%I', table_name), privilege_name)
          OR (privilege_name IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES') AND has_any_column_privilege(browser_role, format('public.%I', table_name), privilege_name)) THEN
          RAISE EXCEPTION 'Browser role retains % privilege on %', privilege_name, table_name;
        END IF;
      END LOOP;
      -- MAINTAIN is a table privilege starting in PostgreSQL 17.
      IF current_setting('server_version_num')::integer >= 170000 THEN
        IF has_table_privilege(browser_role, format('public.%I', table_name), 'MAINTAIN') THEN
          RAISE EXCEPTION 'Browser role retains MAINTAIN privilege on %', table_name;
        END IF;
      END IF;
      IF sequence_name IS NOT NULL AND (has_sequence_privilege(browser_role, sequence_name, 'USAGE') OR has_sequence_privilege(browser_role, sequence_name, 'UPDATE') OR has_sequence_privilege(browser_role, sequence_name, 'SELECT')) THEN
        RAISE EXCEPTION 'Browser role retains privilege on sequence for %', table_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
