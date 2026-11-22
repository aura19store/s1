BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_order_tracking_sessions (
  order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  browser_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (order_id, browser_hash)
);

CREATE INDEX IF NOT EXISTS guest_order_tracking_sessions_browser_idx ON public.guest_order_tracking_sessions(browser_hash);
CREATE INDEX IF NOT EXISTS guest_order_tracking_sessions_expires_idx ON public.guest_order_tracking_sessions(expires_at);

ALTER TABLE public.guest_order_tracking_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_order_tracking_sessions'
      AND policyname = 'aura_deny_browser_roles'
  ) THEN
    CREATE POLICY aura_deny_browser_roles
      ON public.guest_order_tracking_sessions
      AS RESTRICTIVE FOR ALL TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $$;

REVOKE ALL ON public.guest_order_tracking_sessions FROM PUBLIC, anon, authenticated;

COMMIT;
