-- ImbaLink — RLS communication repair for authenticated self-owned data.
-- Run after schema.sql / 002-app-alignment.sql / google-auth.sql.
-- This does NOT disable RLS or grant public write access.
BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid()::text
$$;

-- Ensure the authenticated account can read/create/update its own app profile.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select_self ON public.users;
DROP POLICY IF EXISTS users_insert_self ON public.users;
DROP POLICY IF EXISTS users_update_self ON public.users;
DROP POLICY IF EXISTS users_delete_self ON public.users;
CREATE POLICY users_select_self ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid()::text);
CREATE POLICY users_insert_self ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid()::text);
CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Registration writes are scoped to the real Supabase Auth identity.
-- This is intentionally explicit rather than depending on frontend userId
-- state. It supports SELECT + INSERT + UPDATE required by an upsert.
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registrations_rw_self ON public.registrations;
DROP POLICY IF EXISTS registrations_select_self ON public.registrations;
DROP POLICY IF EXISTS registrations_insert_self ON public.registrations;
DROP POLICY IF EXISTS registrations_update_self ON public.registrations;
DROP POLICY IF EXISTS registrations_delete_self ON public.registrations;
CREATE POLICY registrations_select_self ON public.registrations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);
CREATE POLICY registrations_insert_self ON public.registrations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY registrations_update_self ON public.registrations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY registrations_delete_self ON public.registrations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

-- These are the exact checks used by the client for the other self-owned
-- write surfaces. Recreate only if an earlier migration replaced them.
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_profiles_rw_self ON public.student_profiles;
CREATE POLICY student_profiles_rw_self ON public.student_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE public.property_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_likes_rw_self ON public.property_likes;
CREATE POLICY property_likes_rw_self ON public.property_likes
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE public.property_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_saves_rw_self ON public.property_saves;
CREATE POLICY property_saves_rw_self ON public.property_saves
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE public.contractor_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contractor_likes_rw_self ON public.contractor_likes;
CREATE POLICY contractor_likes_rw_self ON public.contractor_likes
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE public.student_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_interests_rw_self ON public.student_interests;
CREATE POLICY student_interests_rw_self ON public.student_interests
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE public.student_share_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS share_requests_read_active ON public.student_share_requests;
DROP POLICY IF EXISTS share_requests_write_self ON public.student_share_requests;
CREATE POLICY share_requests_read_active ON public.student_share_requests
  FOR SELECT TO authenticated
  USING (status = 'active' OR user_id = auth.uid()::text);
CREATE POLICY share_requests_write_self ON public.student_share_requests
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
COMMIT;
