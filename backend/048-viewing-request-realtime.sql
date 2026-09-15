-- ImbaLink: guarantee viewing request status changes are delivered through
-- Supabase Realtime so an open tenant chat reflects landlord decisions quickly.
BEGIN;

ALTER TABLE IF EXISTS public.viewing_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF to_regclass('public.viewing_requests') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'viewing_requests'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.viewing_requests;
  END IF;
END $$;

GRANT SELECT ON public.viewing_requests TO authenticated;

COMMIT;
