-- ImbaLink Supabase Auth policies
-- Run this AFTER schema.sql in the Supabase SQL Editor.
-- These policies let an authenticated user manage only their own app profile.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "student_profiles_select_own" ON public.student_profiles;
CREATE POLICY "student_profiles_select_own"
  ON public.student_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "student_profiles_insert_own" ON public.student_profiles;
CREATE POLICY "student_profiles_insert_own"
  ON public.student_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "student_profiles_update_own" ON public.student_profiles;
CREATE POLICY "student_profiles_update_own"
  ON public.student_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
