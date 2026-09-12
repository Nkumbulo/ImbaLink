BEGIN;
DROP POLICY IF EXISTS properties_read ON public.properties;
CREATE POLICY properties_read ON public.properties
  FOR SELECT TO anon, authenticated
  USING (
    public.is_staff_caller()
    OR owner_user_id = auth.uid()::text
    OR verification IS NULL
    OR verification NOT IN ('flagged', 'rejected')
  );
ALTER VIEW IF EXISTS public.properties_feed SET (security_invoker = true);
ALTER VIEW IF EXISTS public.properties_with_meta SET (security_invoker = true);
NOTIFY pgrst, 'reload schema';
COMMIT;
