-- ImbaLink: only users with app_metadata.role=admin may change verification decisions.
-- Run after 013-security-hardening.sql and 021-admin-operations.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.require_admin_for_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME IN ('properties','contractors') THEN
    IF NEW.verification IS DISTINCT FROM OLD.verification
       AND COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN
      RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED';
    END IF;
  ELSE
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       AND COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN
      RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_only_property_verification ON public.properties;
CREATE TRIGGER trg_admin_only_property_verification
BEFORE UPDATE OF verification ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.require_admin_for_verification_change();

DROP TRIGGER IF EXISTS trg_admin_only_contractor_verification ON public.contractors;
CREATE TRIGGER trg_admin_only_contractor_verification
BEFORE UPDATE OF verification ON public.contractors
FOR EACH ROW EXECUTE FUNCTION public.require_admin_for_verification_change();

DROP TRIGGER IF EXISTS trg_admin_only_registration_verification ON public.registrations;
CREATE TRIGGER trg_admin_only_registration_verification
BEFORE UPDATE OF verification_status ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.require_admin_for_verification_change();

DROP TRIGGER IF EXISTS trg_admin_only_student_verification ON public.student_profiles;
CREATE TRIGGER trg_admin_only_student_verification
BEFORE UPDATE OF verification_status ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION public.require_admin_for_verification_change();

DROP TRIGGER IF EXISTS trg_admin_only_landlord_verification ON public.landlord_verifications;
CREATE TRIGGER trg_admin_only_landlord_verification
BEFORE UPDATE OF verification_status ON public.landlord_verifications
FOR EACH ROW EXECUTE FUNCTION public.require_admin_for_verification_change();

-- Re-define the privileged RPC so that its authorization is explicit and admin-only.
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
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;

  CASE p_store_name
    WHEN 'properties' THEN v_column := 'verification'; v_key := 'id'; v_subject_type := 'property';
    WHEN 'contractors' THEN v_column := 'verification'; v_key := 'id'; v_subject_type := 'contractor';
    WHEN 'registrations' THEN v_column := 'verification_status'; v_key := 'id'; v_subject_type := 'registration';
    WHEN 'student_profiles' THEN v_column := 'verification_status'; v_key := 'user_id'; v_subject_type := 'student';
    WHEN 'landlord_verifications' THEN v_column := 'verification_status'; v_key := 'user_id'; v_subject_type := 'landlord';
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
REVOKE ALL ON FUNCTION public.set_verification_status(text,text,verification_status,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_verification_status(text,text,verification_status,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
