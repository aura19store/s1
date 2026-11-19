-- Existing orders are retained unchanged. Only new orders receive tracking credentials.
BEGIN;
CREATE TABLE IF NOT EXISTS public.guest_order_credentials (
  order_id INTEGER PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  secret_hash TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS public.guest_order_access (
  order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  browser_hash TEXT NOT NULL,
  PRIMARY KEY (order_id, browser_hash)
);
CREATE INDEX IF NOT EXISTS guest_order_access_browser_idx ON public.guest_order_access(browser_hash);
ALTER TABLE public.guest_order_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_order_access ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'guest_order_credentials' AND policyname = 'aura_deny_browser_roles') THEN
    CREATE POLICY aura_deny_browser_roles ON public.guest_order_credentials AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'guest_order_access' AND policyname = 'aura_deny_browser_roles') THEN
    CREATE POLICY aura_deny_browser_roles ON public.guest_order_access AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
  IF (SELECT COUNT(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public'
      AND tablename IN ('guest_order_credentials', 'guest_order_access')
      AND policyname = 'aura_deny_browser_roles' AND permissive = 'RESTRICTIVE' AND cmd = 'ALL'
      AND qual = 'false' AND with_check = 'false' AND roles @> ARRAY['anon', 'authenticated']::name[]) <> 2 THEN
    RAISE EXCEPTION 'Unsafe existing guest order browser-deny policy';
  END IF;
END $$;
REVOKE ALL ON public.guest_order_credentials, public.guest_order_access FROM PUBLIC, anon, authenticated;
-- TRUNCATE bypasses RLS. Fail if any effective privilege remains after REVOKE,
-- including privileges inherited from other roles.
DO $$
DECLARE table_name TEXT; browser_role TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['guest_order_credentials', 'guest_order_access'] LOOP
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(browser_role, format('public.%I', table_name), 'TRUNCATE') THEN
        RAISE EXCEPTION 'Browser role retains TRUNCATE privilege on %', table_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;
DO $$
DECLARE table_name TEXT; browser_role TEXT; privilege_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['guest_order_credentials', 'guest_order_access'] LOOP
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
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
    END LOOP;
  END LOOP;
END $$;
COMMIT;
