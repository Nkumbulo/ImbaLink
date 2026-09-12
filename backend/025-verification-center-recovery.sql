-- ImbaLink Verification Center: keep neglected records out of active queues and enrich recovery view.
-- Run after 024-verification-center-command-center.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_verification_queue(p_store_name text DEFAULT 'properties', p_status verification_status DEFAULT 'pending', p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  IF p_store_name NOT IN ('properties','registrations','contractors','student_profiles','landlord_verifications') THEN RAISE EXCEPTION 'INVALID_VERIFICATION_STORE'; END IF;
  IF p_store_name = 'properties' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT p.id,p.title,p.property_type,p.city,p.suburb,p.rent_usd,p.verification status,p.owner_user_id,coalesce(u.display_name,p.landlord_name,'Unknown') owner_name,u.email,p.created_at,p.updated_at
      FROM properties p LEFT JOIN users u ON u.id=p.owner_user_id
      WHERE (p_status IS NULL OR p.verification=p_status) AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='properties' AND n.record_id=p.id::text AND n.restored_at IS NULL)
      ORDER BY p.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)) x;
  ELSIF p_store_name='landlord_verifications' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT lv.id,lv.user_id,lv.phone,lv.id_image_path,lv.verification_status status,lv.submitted_at,lv.reviewed_by,lv.reviewed_at,lv.review_note,coalesce(u.display_name,u.email,'Unknown') landlord_name,u.email
      FROM landlord_verifications lv LEFT JOIN users u ON u.id=lv.user_id
      WHERE (p_status IS NULL OR lv.verification_status=p_status) AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='landlord_verifications' AND n.record_id=lv.user_id::text AND n.restored_at IS NULL)
      ORDER BY lv.submitted_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)) x;
  ELSIF p_store_name='student_profiles' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT sp.user_id,coalesce(u.display_name,u.email,'Unknown') student_name,u.email,sp.university_id,coalesce(un.name,'Unassigned') university_name,sp.verification_status status,sp.details,sp.updated_at
      FROM student_profiles sp LEFT JOIN users u ON u.id=sp.user_id LEFT JOIN universities un ON un.id=sp.university_id
      WHERE (p_status IS NULL OR sp.verification_status=p_status) AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='student_profiles' AND n.record_id=sp.user_id::text AND n.restored_at IS NULL)
      ORDER BY sp.updated_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)) x;
  ELSIF p_store_name='contractors' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT c.id,c.user_id,c.business_name,c.primary_trade,c.city,c.verification status,c.rating,c.jobs,c.created_at
      FROM contractors c
      WHERE (p_status IS NULL OR c.verification=p_status) AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='contractors' AND n.record_id=c.id::text AND n.restored_at IS NULL)
      ORDER BY c.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)) x;
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT r.id,r.user_id,r.kind,r.legal_name,r.business_name,r.phone,r.email,r.verification_status status,r.reviewed_by,r.reviewed_at,r.review_note,r.created_at
      FROM registrations r
      WHERE (p_status IS NULL OR r.verification_status=p_status) AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='registrations' AND n.record_id=r.id::text AND n.restored_at IS NULL)
      ORDER BY r.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)) x;
  END IF;
  RETURN v_rows;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_admin_verification_queue(text,verification_status,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_neglected_verifications(p_store_name text DEFAULT NULL, p_limit int DEFAULT 200, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM (
    SELECT n.*,coalesce(au.display_name,au.email,'Administrator') neglected_by_name,
      CASE n.store_name WHEN 'properties' THEN coalesce(p.title,'Property') WHEN 'landlord_verifications' THEN coalesce(lu.display_name,lu.email,'Landlord') WHEN 'student_profiles' THEN coalesce(su.display_name,su.email,'Student') WHEN 'contractors' THEN coalesce(c.business_name,'Contractor') WHEN 'registrations' THEN coalesce(r.business_name,r.legal_name,r.email,'Registration') END subject_name,
      CASE n.store_name WHEN 'properties' THEN coalesce(p.city,p.suburb) WHEN 'landlord_verifications' THEN lu.email WHEN 'student_profiles' THEN coalesce(un.name,su.email) WHEN 'contractors' THEN coalesce(c.city,c.primary_trade) WHEN 'registrations' THEN coalesce(r.email,r.kind) END subject_detail
    FROM admin_neglected_verifications n
    LEFT JOIN users au ON au.id=n.neglected_by::text
    LEFT JOIN properties p ON n.store_name='properties' AND p.id::text=n.record_id
    LEFT JOIN landlord_verifications lv ON n.store_name='landlord_verifications' AND lv.user_id::text=n.record_id
    LEFT JOIN users lu ON n.store_name='landlord_verifications' AND lu.id=lv.user_id
    LEFT JOIN student_profiles sp ON n.store_name='student_profiles' AND sp.user_id::text=n.record_id
    LEFT JOIN users su ON n.store_name='student_profiles' AND su.id=sp.user_id
    LEFT JOIN universities un ON n.store_name='student_profiles' AND un.id=sp.university_id
    LEFT JOIN contractors c ON n.store_name='contractors' AND c.id::text=n.record_id
    LEFT JOIN registrations r ON n.store_name='registrations' AND r.id::text=n.record_id
    WHERE n.restored_at IS NULL AND (p_store_name IS NULL OR n.store_name=p_store_name)
    ORDER BY n.neglected_at DESC LIMIT greatest(1,least(p_limit,500)) OFFSET greatest(p_offset,0)) x;
  RETURN v;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_neglected_verifications(text,int,int) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
