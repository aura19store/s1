-- Additive: apply separately before deploying the media deletion endpoint.
-- Durable intent is retained even after the media record is removed.
BEGIN;
CREATE TABLE IF NOT EXISTS public.media_deletion_jobs (
  id BIGINT PRIMARY KEY,
  url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.media_deletion_jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'media_deletion_jobs' AND policyname = 'aura_deny_browser_roles') THEN
    CREATE POLICY aura_deny_browser_roles ON public.media_deletion_jobs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
REVOKE ALL ON public.media_deletion_jobs FROM PUBLIC, anon, authenticated;
COMMIT;
