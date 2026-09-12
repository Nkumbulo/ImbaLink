-- ImbaLink security hardening.
-- Run after schema.sql, 002-app-alignment.sql and google-auth.sql.
--
-- 1. Store business credential hashes in user_credentials, which has RLS
--    enabled and intentionally has no browser policies.
-- 2. Move moderation decisions behind a SECURITY DEFINER staff-role check.
-- 3. Expose moderation records only through the same server-side role check.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_business_credential(
  p_username text,
  p_password_hash jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_username text := lower(btrim(p_username));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_username IS NULL OR v_username = '' OR length(v_username) > 80 THEN
    RAISE EXCEPTION 'INVALID_USERNAME';
  END IF;
  IF jsonb_typeof(p_password_hash) <> 'object'
     OR p_password_hash->>'algorithm' <> 'pbkdf2-sha256'
     OR coalesce((p_password_hash->>'iterations')::int, 0) <= 0
     OR length(coalesce(p_password_hash->>'salt','')) <> 32
     OR length(coalesce(p_password_hash->>'hash','')) <> 64 THEN
    RAISE EXCEPTION 'INVALID_PASSWORD_HASH';
  END IF;

  INSERT INTO public.user_credentials(user_id, username, password_hash)
  VALUES (v_user_id, v_username, p_password_hash)
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_business_credential(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_business_credential(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_staff_caller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    auth.jwt()->'app_metadata'->>'role' IN ('admin', 'moderator', 'staff'),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.is_staff_caller() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_caller() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_moderation_records(p_store_name text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
  IF p_store_name NOT IN ('properties','registrations','contractors','student_profiles') THEN
    RAISE EXCEPTION 'INVALID_MODERATION_STORE';
  END IF;
  RETURN QUERY EXECUTE format('SELECT to_jsonb(t) FROM public.%I t', p_store_name);
END;
$$;
REVOKE ALL ON FUNCTION public.get_moderation_records(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_moderation_records(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_verification_status(
  p_store_name text,
  p_id text,
  p_status verification_status,
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text := auth.uid()::text;
  v_column text;
  v_key text;
  v_subject_type text;
  v_before verification_status;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;

  CASE p_store_name
    WHEN 'properties' THEN v_column := 'verification'; v_key := 'id'; v_subject_type := 'property';
    WHEN 'contractors' THEN v_column := 'verification'; v_key := 'id'; v_subject_type := 'registration';
    WHEN 'registrations' THEN v_column := 'verification_status'; v_key := 'id'; v_subject_type := 'registration';
    WHEN 'student_profiles' THEN v_column := 'verification_status'; v_key := 'user_id'; v_subject_type := 'student';
    ELSE RAISE EXCEPTION 'INVALID_MODERATION_STORE';
  END CASE;

  EXECUTE format('SELECT %I FROM public.%I WHERE %I::text = $1 FOR UPDATE', v_column, p_store_name, v_key)
    INTO v_before USING p_id;

  EXECUTE format(
    'UPDATE public.%I AS t SET %I = $1, updated_at = now() WHERE t.%I::text = $2 RETURNING to_jsonb(t)',
    p_store_name, v_column, v_key
  ) INTO v_result USING p_status, p_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;

  INSERT INTO public.verification_events(subject_type, subject_id, from_status, to_status, reviewed_by, note)
  VALUES (v_subject_type, p_id, v_before, p_status, v_actor, left(coalesce(p_note,''), 500));

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.set_verification_status(text, text, verification_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_verification_status(text, text, verification_status, text) TO authenticated;

COMMIT;
