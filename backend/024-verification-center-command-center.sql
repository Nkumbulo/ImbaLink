-- ImbaLink Verification Center: full command-center history, metrics and clean queues.
-- Run after 023-verification-center-operations.sql.
BEGIN;

-- Exclude actively neglected records from every active verification queue.
CREATE OR REPLACE FUNCTION public.get_admin_verification_queue(
  p_store_name text DEFAULT 'properties',
  p_status verification_status DEFAULT 'pending',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  IF p_store_name NOT IN ('properties','registrations','contractors','student_profiles','landlord_verifications') THEN RAISE EXCEPTION 'INVALID_VERIFICATION_STORE'; END IF;

  IF p_store_name = 'properties' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT p.id,p.title,p.property_type,p.city,p.suburb,p.rent_usd,p.verification AS status,p.owner_user_id,
             coalesce(u.display_name,p.landlord_name,'Unknown') AS owner_name,u.email,p.created_at,p.updated_at
      FROM properties p LEFT JOIN users u ON u.id=p.owner_user_id
      WHERE (p_status IS NULL OR p.verification=p_status)
        AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='properties' AND n.record_id=p.id::text AND n.restored_at IS NULL)
      ORDER BY p.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  ELSIF p_store_name = 'landlord_verifications' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT lv.id,lv.user_id,lv.phone,lv.id_image_path,lv.verification_status AS status,lv.submitted_at,lv.reviewed_by,lv.reviewed_at,lv.review_note,
             coalesce(u.display_name,u.email,'Unknown') AS landlord_name,u.email
      FROM landlord_verifications lv LEFT JOIN users u ON u.id=lv.user_id
      WHERE (p_status IS NULL OR lv.verification_status=p_status)
        AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='landlord_verifications' AND n.record_id=lv.user_id::text AND n.restored_at IS NULL)
      ORDER BY lv.submitted_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  ELSIF p_store_name = 'student_profiles' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT sp.user_id,coalesce(u.display_name,u.email,'Unknown') student_name,u.email,sp.university_id,
             coalesce(un.name,'Unassigned') university_name,sp.verification_status AS status,sp.details,sp.updated_at
      FROM student_profiles sp LEFT JOIN users u ON u.id=sp.user_id LEFT JOIN universities un ON un.id=sp.university_id
      WHERE (p_status IS NULL OR sp.verification_status=p_status)
        AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='student_profiles' AND n.record_id=sp.user_id::text AND n.restored_at IS NULL)
      ORDER BY sp.updated_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  ELSIF p_store_name = 'contractors' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT c.id,c.user_id,c.business_name,c.primary_trade,c.city,c.verification AS status,c.rating,c.jobs,c.created_at
      FROM contractors c
      WHERE (p_status IS NULL OR c.verification=p_status)
        AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='contractors' AND n.record_id=c.id::text AND n.restored_at IS NULL)
      ORDER BY c.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT r.id,r.user_id,r.kind,r.legal_name,r.business_name,r.phone,r.email,r.verification_status AS status,r.reviewed_by,r.reviewed_at,r.review_note,r.created_at
      FROM registrations r
      WHERE (p_status IS NULL OR r.verification_status=p_status)
        AND NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name='registrations' AND n.record_id=r.id::text AND n.restored_at IS NULL)
      ORDER BY r.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  END IF;
  RETURN v_rows;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_admin_verification_queue(text,verification_status,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_verification_center_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  WITH current_counts AS (
    SELECT 'properties' store, verification status FROM properties
    UNION ALL SELECT 'contractors', verification FROM contractors
    UNION ALL SELECT 'registrations', verification_status FROM registrations
    UNION ALL SELECT 'student_profiles', verification_status FROM student_profiles
    UNION ALL SELECT 'landlord_verifications', verification_status FROM landlord_verifications
  ), active AS (
    SELECT store,status,count(*)::int count
    FROM current_counts c
    WHERE NOT EXISTS (SELECT 1 FROM admin_neglected_verifications n WHERE n.store_name=c.store AND n.restored_at IS NULL)
    GROUP BY store,status
  ), history AS (
    SELECT count(*) FILTER (WHERE to_status='verified')::int verified_decisions,
           count(*) FILTER (WHERE to_status='rejected')::int declined_decisions,
           count(*) FILTER (WHERE to_status='flagged')::int flagged_decisions,
           count(*) FILTER (WHERE from_status='verified' AND to_status='pending')::int unverify_decisions,
           count(*)::int total_decisions,
           count(*) FILTER (WHERE created_at >= now()-interval '24 hours')::int decisions_24h
    FROM verification_events ve
    WHERE ve.reviewed_by::text = auth.uid()::text
  ), neglected AS (
    SELECT count(*)::int count FROM admin_neglected_verifications WHERE restored_at IS NULL
  )
  SELECT jsonb_build_object(
    'active', coalesce((SELECT jsonb_object_agg(store||':'||status,count) FROM active),'{}'::jsonb),
    'pending', coalesce((SELECT sum(count)::int FROM active WHERE status='pending'),0),
    'verified', coalesce((SELECT sum(count)::int FROM active WHERE status='verified'),0),
    'rejected', coalesce((SELECT sum(count)::int FROM active WHERE status='rejected'),0),
    'flagged', coalesce((SELECT sum(count)::int FROM active WHERE status='flagged'),0),
    'neglected', (SELECT count FROM neglected),
    'my_decisions', coalesce((SELECT row_to_json(history)::jsonb FROM history),'{}'::jsonb),
    'total_entities', (SELECT count(*)::int FROM current_counts)
  ) INTO v;
  RETURN v;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_verification_center_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_verification_decision_history(
  p_scope text DEFAULT 'mine',
  p_status verification_status DEFAULT NULL,
  p_store_name text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
  IF p_store_name IS NOT NULL AND p_store_name NOT IN ('properties','registrations','contractors','student_profiles','landlord_verifications') THEN RAISE EXCEPTION 'INVALID_VERIFICATION_STORE'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM (
    SELECT ve.id,ve.subject_type,ve.subject_id,ve.from_status,ve.to_status,ve.note,ve.reviewed_by,ve.created_at,
      CASE ve.subject_type
        WHEN 'property' THEN 'properties'
        WHEN 'landlord' THEN 'landlord_verifications'
        WHEN 'student' THEN 'student_profiles'
        WHEN 'contractor' THEN 'contractors'
        WHEN 'registration' THEN 'registrations'
        ELSE ve.subject_type
      END AS store_name,
      coalesce(au.display_name,au.email,'Administrator') AS admin_name,
      CASE ve.subject_type
        WHEN 'property' THEN coalesce(p.title,'Property')
        WHEN 'landlord' THEN coalesce(lu.display_name,lu.email,'Landlord')
        WHEN 'student' THEN coalesce(su.display_name,su.email,'Student')
        WHEN 'contractor' THEN coalesce(c.business_name,'Contractor')
        WHEN 'registration' THEN coalesce(r.business_name,r.legal_name,r.email,'Registration')
        ELSE 'Verification record'
      END AS subject_name
    FROM verification_events ve
    LEFT JOIN users au ON au.id::text=ve.reviewed_by::text
    LEFT JOIN properties p ON ve.subject_type='property' AND p.id::text=ve.subject_id
    LEFT JOIN landlord_verifications lv ON ve.subject_type='landlord' AND lv.user_id::text=ve.subject_id
    LEFT JOIN users lu ON ve.subject_type='landlord' AND lu.id=lv.user_id
    LEFT JOIN student_profiles sp ON ve.subject_type='student' AND sp.user_id::text=ve.subject_id
    LEFT JOIN users su ON ve.subject_type='student' AND su.id=sp.user_id
    LEFT JOIN contractors c ON ve.subject_type='contractor' AND c.id::text=ve.subject_id
    LEFT JOIN registrations r ON ve.subject_type='registration' AND r.id::text=ve.subject_id
    WHERE (p_scope='all' OR ve.reviewed_by::text=auth.uid()::text)
      AND (p_status IS NULL OR ve.to_status=p_status)
      AND (p_store_name IS NULL OR (CASE ve.subject_type WHEN 'property' THEN 'properties' WHEN 'landlord' THEN 'landlord_verifications' WHEN 'student' THEN 'student_profiles' WHEN 'contractor' THEN 'contractors' WHEN 'registration' THEN 'registrations' ELSE ve.subject_type END)=p_store_name)
    ORDER BY ve.created_at DESC
    LIMIT greatest(1,least(p_limit,500)) OFFSET greatest(p_offset,0)
  ) x;
  RETURN v;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_verification_decision_history(text,verification_status,text,int,int) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
