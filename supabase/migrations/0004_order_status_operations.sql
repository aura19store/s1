-- Additive: apply before deploying clients that send idempotency keys.
BEGIN;
CREATE TABLE IF NOT EXISTS public.order_status_operations (
  id TEXT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  expected_status TEXT NOT NULL,
  requested_status TEXT NOT NULL,
  result_status TEXT NOT NULL DEFAULT '',
  result_code INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.order_status_operations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'order_status_operations' AND policyname = 'aura_deny_browser_roles') THEN
    CREATE POLICY aura_deny_browser_roles ON public.order_status_operations AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
REVOKE ALL ON public.order_status_operations FROM PUBLIC, anon, authenticated;
COMMIT;
