-- ImbaLink: allow an authenticated user to permanently clear their own
-- notification history from the in-app Notifications panel.
BEGIN;

CREATE OR REPLACE FUNCTION public.reset_all_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.notifications
  WHERE user_id = auth.uid()::text;
$$;

REVOKE ALL ON FUNCTION public.reset_all_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_all_notifications() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
