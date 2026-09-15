-- ImbaLink admin operations: insights, exports and audit visibility.
-- Run after backend/020-admin-dashboard.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_insights()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
  SELECT jsonb_build_object(
    'active_users_30d', (SELECT count(*) FROM users WHERE updated_at >= now() - interval '30 days' OR onboarded_at >= now() - interval '30 days'),
    'new_users_30d', (SELECT count(*) FROM users WHERE created_at >= now() - interval '30 days'),
    'published_listings', (SELECT count(*) FROM properties WHERE published_at IS NOT NULL),
    'pending_properties', (SELECT count(*) FROM properties WHERE verification='pending'),
    'open_reports', (SELECT count(*) FROM reports WHERE status IN ('open','reviewing')),
    'listings_missing_images', (SELECT count(*) FROM properties p WHERE NOT EXISTS (SELECT 1 FROM property_images i WHERE i.property_id=p.id)),
    'listings_missing_owner', (SELECT count(*) FROM properties WHERE owner_user_id IS NULL),
    'stale_listings', (SELECT count(*) FROM properties WHERE published_at IS NOT NULL AND updated_at < now() - interval '60 days'),
    'unverified_landlords', (SELECT count(*) FROM users u WHERE u.account_type='landlord' AND NOT EXISTS (SELECT 1 FROM landlord_verifications lv WHERE lv.user_id=u.id AND lv.verification_status='verified')),
    'pending_registrations', (SELECT count(*) FROM registrations WHERE verification_status='pending'),
    'active_share_requests', (SELECT count(*) FROM student_share_requests WHERE status='active'),
    'funnel_views', (SELECT count(*) FROM property_view_events WHERE created_at >= now() - interval '30 days'),
    'funnel_saves', (SELECT count(*) FROM property_saves WHERE created_at >= now() - interval '30 days'),
    'funnel_requests', (SELECT count(*) FROM viewing_requests WHERE created_at >= now() - interval '30 days'),
    'funnel_accepted', (SELECT count(*) FROM viewing_requests WHERE created_at >= now() - interval '30 days' AND status IN ('accepted','completed')),
    'view_to_request_rate', CASE WHEN (SELECT count(*) FROM property_view_events WHERE created_at >= now() - interval '30 days')=0 THEN 0 ELSE round(((SELECT count(*) FROM viewing_requests WHERE created_at >= now() - interval '30 days')::numeric / (SELECT count(*) FROM property_view_events WHERE created_at >= now() - interval '30 days'))*100,1) END,
    'request_acceptance_rate', CASE WHEN (SELECT count(*) FROM viewing_requests WHERE created_at >= now() - interval '30 days')=0 THEN 0 ELSE round(((SELECT count(*) FROM viewing_requests WHERE created_at >= now() - interval '30 days' AND status IN ('accepted','completed'))::numeric / (SELECT count(*) FROM viewing_requests WHERE created_at >= now() - interval '30 days'))*100,1) END
  ) INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_insights() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_insights() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_audit_log(p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb; v_total int;
BEGIN
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
  SELECT count(*) INTO v_total FROM admin_audit_log;
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows
  FROM (
    SELECT a.id,a.action,a.resource_type,a.resource_id,a.metadata,a.created_at,a.actor_user_id,
           coalesce(u.display_name,u.email,'Unknown staff') actor_name
    FROM admin_audit_log a
    LEFT JOIN users u ON u.id=a.actor_user_id
    ORDER BY a.created_at DESC
    LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
  ) x;
  RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_audit_log(int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.export_admin_data(p_resource text, p_limit int DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
  IF p_resource NOT IN ('users','properties','viewing_requests','registrations','contractors','reports','students','audit_log') THEN
    RAISE EXCEPTION 'INVALID_EXPORT_RESOURCE';
  END IF;
  CASE p_resource
    WHEN 'users' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT id,first_name,surname,display_name,email,phone,account_type,onboarded_at,created_at,updated_at FROM users ORDER BY created_at DESC LIMIT greatest(1,least(p_limit,5000))) x;
    WHEN 'properties' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT p.id,p.title,p.property_type,p.suburb,p.city,p.street_address,p.rent_usd,p.deposit_usd,p.rooms,p.bathrooms,p.furnished,p.availability,p.lease_term,p.verification,p.published_at,p.created_at,p.updated_at,p.owner_user_id,coalesce(u.display_name,p.landlord_name,'Unknown') owner_name,coalesce(p.view_count,0) view_count,(SELECT count(*) FROM property_saves s WHERE s.property_id=p.id) save_count,(SELECT count(*) FROM viewing_requests r WHERE r.property_id=p.id) request_count FROM properties p LEFT JOIN users u ON u.id=p.owner_user_id ORDER BY p.created_at DESC LIMIT greatest(1,least(p_limit,5000))) x;
    WHEN 'viewing_requests' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT r.id,r.user_id,r.property_id,r.status,r.created_at,r.updated_at,u.display_name requester_name,u.email requester_email,p.title property_title,p.city FROM viewing_requests r LEFT JOIN users u ON u.id=r.user_id LEFT JOIN properties p ON p.id=r.property_id ORDER BY r.created_at DESC LIMIT greatest(1,least(p_limit,5000))) x;
    WHEN 'registrations' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT id,user_id,kind,legal_name,business_name,phone,email,verification_status,reviewed_by,reviewed_at,review_note,created_at,updated_at FROM registrations ORDER BY created_at DESC LIMIT greatest(1,least(p_limit,5000))) x;
    WHEN 'contractors' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT id,user_id,business_name,primary_trade,services,service_areas,phone,email,city,area,verification,rating,jobs,created_at,updated_at FROM contractors ORDER BY created_at DESC LIMIT greatest(1,least(p_limit,5000))) x;
    WHEN 'reports' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT r.id,r.subject_type,r.subject_id,r.reason,r.note,r.status,r.reporter_user_id,coalesce(u.display_name,u.email,'Unknown') reporter_name,r.reviewed_by,r.reviewed_at,r.created_at FROM reports r LEFT JOIN users u ON u.id=r.reporter_user_id ORDER BY r.created_at DESC LIMIT greatest(1,least(p_limit,5000))) x;
    WHEN 'students' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT sp.user_id,coalesce(u.display_name,u.email,'Unknown') student_name,u.email,sp.university_id,coalesce(un.name,'Unassigned') university_name,sp.verification_status,sp.details,sp.updated_at FROM student_profiles sp LEFT JOIN users u ON u.id=sp.user_id LEFT JOIN universities un ON un.id=sp.university_id ORDER BY sp.updated_at DESC LIMIT greatest(1,least(p_limit,5000))) x;
    WHEN 'audit_log' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT a.id,a.action,a.resource_type,a.resource_id,a.metadata,a.actor_user_id,coalesce(u.display_name,u.email,'Unknown staff') actor_name,a.created_at FROM admin_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT greatest(1,least(p_limit,5000))) x;
  END CASE;
  INSERT INTO admin_audit_log(actor_user_id,action,resource_type,metadata)
  VALUES (auth.uid()::text,'data.exported',p_resource,jsonb_build_object('rows',jsonb_array_length(v_rows),'limit',p_limit));
  RETURN v_rows;
END;
$$;
REVOKE ALL ON FUNCTION public.export_admin_data(text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_admin_data(text,int) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_admin_verification_queue(p_store_name text DEFAULT 'properties', p_status verification_status DEFAULT 'pending', p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') <> 'admin' THEN
    RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED';
  END IF;
  IF p_store_name NOT IN ('properties','registrations','contractors','student_profiles','landlord_verifications') THEN
    RAISE EXCEPTION 'INVALID_VERIFICATION_STORE';
  END IF;
  IF p_store_name = 'properties' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT p.id,p.title,p.property_type,p.city,p.suburb,p.rent_usd,p.verification AS status,p.owner_user_id,
             coalesce(u.display_name,p.landlord_name,'Unknown') AS owner_name,p.created_at,p.updated_at
      FROM properties p LEFT JOIN users u ON u.id=p.owner_user_id
      WHERE (p_status IS NULL OR p.verification=p_status)
      ORDER BY p.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  ELSIF p_store_name = 'landlord_verifications' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT lv.id,lv.user_id,lv.phone,lv.id_image_path,lv.verification_status AS status,lv.submitted_at,lv.reviewed_by,lv.reviewed_at,lv.review_note,
             coalesce(u.display_name,u.email,'Unknown') AS landlord_name,u.email
      FROM landlord_verifications lv LEFT JOIN users u ON u.id=lv.user_id
      WHERE (p_status IS NULL OR lv.verification_status=p_status)
      ORDER BY lv.submitted_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  ELSIF p_store_name = 'student_profiles' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT sp.user_id,coalesce(u.display_name,u.email,'Unknown') student_name,u.email,sp.university_id,
             coalesce(un.name,'Unassigned') university_name,sp.verification_status AS status,sp.details,sp.updated_at
      FROM student_profiles sp LEFT JOIN users u ON u.id=sp.user_id LEFT JOIN universities un ON un.id=sp.university_id
      WHERE (p_status IS NULL OR sp.verification_status=p_status)
      ORDER BY sp.updated_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  ELSIF p_store_name = 'contractors' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT c.id,c.user_id,c.business_name,c.primary_trade,c.city,c.verification AS status,c.rating,c.jobs,c.created_at
      FROM contractors c
      WHERE (p_status IS NULL OR c.verification=p_status)
      ORDER BY c.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
      SELECT r.id,r.user_id,r.kind,r.legal_name,r.business_name,r.phone,r.email,r.verification_status AS status,r.reviewed_by,r.reviewed_at,r.review_note,r.created_at
      FROM registrations r
      WHERE (p_status IS NULL OR r.verification_status=p_status)
      ORDER BY r.created_at ASC LIMIT greatest(1,least(p_limit,200)) OFFSET greatest(p_offset,0)
    ) x;
  END IF;
  RETURN v_rows;
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_verification_queue(text,verification_status,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_verification_queue(text,verification_status,int,int) TO authenticated;

COMMIT;
