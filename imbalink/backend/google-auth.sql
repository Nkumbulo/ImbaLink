-- ImbaLink — Google sign-in migration
-- Run this in the Supabase SQL Editor AFTER schema.sql and
-- supabase-auth-policies.sql. Safe to run more than once.

-- --------------------------------------------------------------------------
-- 1. Columns Google can fill that the phone-first schema didn't have
-- --------------------------------------------------------------------------

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email        CITEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url   TEXT;

-- onboarded_at is the onboarding gate. It stays NULL for a brand-new Google
-- account until the user picks an account type, which is what tells the app to
-- keep showing the profile step. account_type alone can't do this job: it has
-- a NOT NULL DEFAULT 'general', so a fresh row is indistinguishable from a
-- user who deliberately chose 'general'.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON public.users (email);

-- Phone is no longer collected at sign-up, so it must be allowed to be absent.
-- Postgres treats NULLs as distinct in a UNIQUE index, so any number of rows
-- can have a NULL phone_normalized without colliding.
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN phone_normalized DROP NOT NULL;

-- --------------------------------------------------------------------------
-- 2. Auto-create the profile row on signup
-- --------------------------------------------------------------------------
-- This is the "links with Supabase automatically" part: the moment Google
-- hands Supabase a verified account, auth.users gets a row, this trigger
-- fires, and public.users gets the matching profile. No client round-trip, so
-- it can't be skipped by a user who closes the tab mid-redirect.
--
-- SECURITY DEFINER because the trigger runs before the new user has a session,
-- so it must not be subject to the RLS policies that check auth.uid().

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta        JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  given_name  TEXT;
  family_name TEXT;
  full_name   TEXT;
BEGIN
  given_name  := COALESCE(meta->>'given_name', '');
  family_name := COALESCE(meta->>'family_name', '');
  full_name   := COALESCE(meta->>'full_name', meta->>'name', '');

  -- Some Google accounts only expose full_name; split it as a fallback.
  IF given_name = '' AND family_name = '' AND full_name <> '' THEN
    given_name  := split_part(full_name, ' ', 1);
    family_name := NULLIF(TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name))), '');
  END IF;

  INSERT INTO public.users (id, email, first_name, surname, display_name, avatar_url)
  VALUES (
    NEW.id::text,
    NEW.email,
    given_name,
    COALESCE(family_name, ''),
    NULLIF(TRIM(CONCAT_WS(' ', given_name, family_name)), ''),
    COALESCE(meta->>'avatar_url', meta->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------------
-- 3. Backfill anyone who signed in before this migration ran
-- --------------------------------------------------------------------------

INSERT INTO public.users (id, email, first_name, surname, display_name, avatar_url)
SELECT
  au.id::text,
  au.email,
  COALESCE(au.raw_user_meta_data->>'given_name', ''),
  COALESCE(au.raw_user_meta_data->>'family_name', ''),
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture')
FROM auth.users au
ON CONFLICT (id) DO NOTHING;
