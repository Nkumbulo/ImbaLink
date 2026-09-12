-- ImbaLink Verification Center: admin-controlled neglect/archive + restore.
-- Run after 022-admin-only-verification.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_neglected_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL CHECK (store_name IN ('properties','registrations','contractors','student_profiles','landlord_verifications')),
  record_id text NOT NULL,
  previous_status verification_status NOT NULL,
  note text NOT NULL DEFAULT '',
  neglected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  neglected_at timestamptz NOT NULL DEFAULT now(),
  restored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_at timestamptz,
  UNIQUE(store_name, record_id)
);

ALTER TABLE public.admin_neglected_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_neglected_verifications_admin_only" ON public.admin_neglected_verifications;
CREATE POLICY "admin_neglected_verifications_admin_only" ON public.admin_neglected_verifications
FOR ALL TO authenticated USING (COALESCE(auth.jwt()->'app_metadata'->>'role','') = 'admin')
WITH CHECK (COALESCE(auth.jwt()->'app_metadata'->>'role','') = 'admin');

CREATE OR REPLACE FUNCTION public.neglect_verification_record(p_store_name text, p_id text, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status verification_status; v_subject text; v_row jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  IF p_store_name NOT IN ('properties','registrations','contractors','student_profiles','landlord_verifications') THEN RAISE EXCEPTION 'INVALID_VERIFICATION_STORE'; END IF;
  CASE p_store_name
    WHEN 'properties' THEN v_subject := 'property';
    WHEN 'registrations' THEN v_subject := 'registration';
    WHEN 'contractors' THEN v_subject := 'contractor';
    WHEN 'student_profiles' THEN v_subject := 'student';
    WHEN 'landlord_verifications' THEN v_subject := 'landlord';
  END CASE;
  EXECUTE CASE WHEN p_store_name IN ('properties','contractors') THEN
    'SELECT verification FROM public.'||quote_ident(p_store_name)||' WHERE id::text=$1 FOR UPDATE'
  ELSE 'SELECT verification_status FROM public.'||quote_ident(p_store_name)||' WHERE '||CASE WHEN p_store_name IN ('student_profiles','landlord_verifications') THEN 'user_id' ELSE 'id' END||'::text=$1 FOR UPDATE' END INTO v_status USING p_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;
  INSERT INTO public.admin_neglected_verifications(store_name,record_id,previous_status,note,neglected_by,restored_by,restored_at)
  VALUES(p_store_name,p_id,v_status,left(coalesce(p_note,''),500),auth.uid(),NULL,NULL)
  ON CONFLICT(store_name,record_id) DO UPDATE SET previous_status=EXCLUDED.previous_status,note=EXCLUDED.note,neglected_by=auth.uid(),neglected_at=now(),restored_by=NULL,restored_at=NULL;
  INSERT INTO public.verification_events(subject_type,subject_id,from_status,to_status,reviewed_by,note)
  VALUES(v_subject,p_id,v_status,v_status,auth.uid(),left('Neglected: '||coalesce(p_note,''),500));
  RETURN jsonb_build_object('store_name',p_store_name,'record_id',p_id,'previous_status',v_status,'neglected',true);
END; $$;
GRANT EXECUTE ON FUNCTION public.neglect_verification_record(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_neglected_verification(p_store_name text, p_id text, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_prev verification_status; v_subject text; v_result jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  SELECT previous_status INTO v_prev FROM admin_neglected_verifications WHERE store_name=p_store_name AND record_id=p_id AND restored_at IS NULL FOR UPDATE;
  IF v_prev IS NULL THEN RAISE EXCEPTION 'NEGLECTED_RECORD_NOT_FOUND'; END IF;
  CASE p_store_name WHEN 'properties' THEN v_subject:='property'; WHEN 'registrations' THEN v_subject:='registration'; WHEN 'contractors' THEN v_subject:='contractor'; WHEN 'student_profiles' THEN v_subject:='student'; WHEN 'landlord_verifications' THEN v_subject:='landlord'; ELSE RAISE EXCEPTION 'INVALID_VERIFICATION_STORE'; END CASE;
  IF p_store_name IN ('properties','contractors') THEN
    EXECUTE format('UPDATE public.%I AS t SET verification=$1, updated_at=now() WHERE t.id::text=$2 RETURNING to_jsonb(t)',p_store_name) INTO v_result USING v_prev,p_id;
  ELSE
    EXECUTE format('UPDATE public.%I AS t SET verification_status=$1, updated_at=now() WHERE t.%I::text=$2 RETURNING to_jsonb(t)',p_store_name,CASE WHEN p_store_name IN ('student_profiles','landlord_verifications') THEN 'user_id' ELSE 'id' END) INTO v_result USING v_prev,p_id;
  END IF;
  IF v_result IS NULL THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;
  UPDATE admin_neglected_verifications SET restored_by=auth.uid(),restored_at=now() WHERE store_name=p_store_name AND record_id=p_id AND restored_at IS NULL;
  INSERT INTO verification_events(subject_type,subject_id,from_status,to_status,reviewed_by,note) VALUES(v_subject,p_id,v_prev,v_prev,auth.uid(),left('Restored from neglected: '||coalesce(p_note,''),500));
  RETURN v_result;
END; $$;
GRANT EXECUTE ON FUNCTION public.restore_neglected_verification(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_neglected_verifications(p_store_name text DEFAULT NULL, p_limit int DEFAULT 200, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM (
    SELECT n.*, coalesce(u.display_name,u.email,'Unknown admin') neglected_by_name
    FROM admin_neglected_verifications n LEFT JOIN users u ON u.id=n.neglected_by::text
    WHERE n.restored_at IS NULL AND (p_store_name IS NULL OR n.store_name=p_store_name)
    ORDER BY n.neglected_at DESC LIMIT greatest(1,least(p_limit,500)) OFFSET greatest(p_offset,0)
  ) x;
  RETURN v;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_neglected_verifications(text,int,int) TO authenticated;

COMMIT;
