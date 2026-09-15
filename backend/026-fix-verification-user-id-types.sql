-- ImbaLink Verification Center: fix users.id TEXT vs auth UUID joins.
-- Safe to run after 025-verification-center-recovery.sql.
BEGIN;

-- public.users.id is TEXT while admin_neglected_verifications.neglected_by/restored_by
-- are UUIDs referencing auth.users. Cast UUIDs to text at the join boundary.
CREATE OR REPLACE FUNCTION public.get_neglected_verifications(
  p_store_name text DEFAULT NULL,
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN
    RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v
  FROM (
    SELECT n.*,
      coalesce(au.display_name,au.email,'Administrator') AS neglected_by_name,
      CASE n.store_name
        WHEN 'properties' THEN coalesce(p.title,'Property')
        WHEN 'landlord_verifications' THEN coalesce(lu.display_name,lu.email,'Landlord')
        WHEN 'student_profiles' THEN coalesce(su.display_name,su.email,'Student')
        WHEN 'contractors' THEN coalesce(c.business_name,'Contractor')
        WHEN 'registrations' THEN coalesce(r.business_name,r.legal_name,r.email,'Registration')
      END AS subject_name,
      CASE n.store_name
        WHEN 'properties' THEN coalesce(p.city,p.suburb)
        WHEN 'landlord_verifications' THEN lu.email
        WHEN 'student_profiles' THEN coalesce(un.name,su.email)
        WHEN 'contractors' THEN coalesce(c.city,c.primary_trade)
        WHEN 'registrations' THEN coalesce(r.email,r.kind::text)
      END AS subject_detail
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
    WHERE n.restored_at IS NULL
      AND (p_store_name IS NULL OR n.store_name=p_store_name)
    ORDER BY n.neglected_at DESC
    LIMIT greatest(1,least(p_limit,500)) OFFSET greatest(p_offset,0)
  ) x;
  RETURN v;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_neglected_verifications(text,int,int) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
