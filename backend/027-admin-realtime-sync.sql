-- ImbaLink Admin: realtime synchronization for the admin control plane.
-- Run after the admin/verification migrations.
--
-- This does NOT grant write access. All privileged edits remain behind the
-- existing SECURITY DEFINER RPCs and admin-only triggers. This migration only
-- makes committed changes visible to authenticated admin clients immediately.

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users','properties','registrations','student_profiles','contractors',
    'landlord_verifications','verification_events','admin_audit_log',
    'admin_neglected_verifications','reports','viewing_requests','messages',
    'property_likes','property_saves'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = t
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Updates/deletes should carry enough information for clients to reconcile
-- derived admin views after another admin changes a record.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','properties','registrations','student_profiles','contractors',
    'landlord_verifications','verification_events','admin_audit_log',
    'admin_neglected_verifications','reports','viewing_requests','messages',
    'property_likes','property_saves'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;

-- Verification events and recovery records are admin-only data. Their SELECT
-- policies also allow Postgres Changes to deliver events to authorized staff.
ALTER TABLE IF EXISTS public.verification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verification_events_admin_realtime_read ON public.verification_events;
CREATE POLICY verification_events_admin_realtime_read
  ON public.verification_events FOR SELECT TO authenticated
  USING (public.is_staff_caller());
GRANT SELECT ON public.verification_events TO authenticated;

ALTER TABLE IF EXISTS public.admin_neglected_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_neglected_realtime_read ON public.admin_neglected_verifications;
CREATE POLICY admin_neglected_realtime_read
  ON public.admin_neglected_verifications FOR SELECT TO authenticated
  USING (public.is_staff_caller());
GRANT SELECT ON public.admin_neglected_verifications TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
