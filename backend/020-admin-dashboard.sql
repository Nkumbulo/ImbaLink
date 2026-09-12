-- ImbaLink admin dashboard / staff reporting layer.
-- Run after 017-listing-reports.sql and 018-listing-view-counts.sql.
-- All functions are SECURITY DEFINER and gate access with is_staff_caller().
BEGIN;

CREATE TABLE IF NOT EXISTS public.property_view_events (
  id bigserial PRIMARY KEY,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  viewer_user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_property_view_events_created ON public.property_view_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_view_events_property_created ON public.property_view_events(property_id, created_at DESC);
ALTER TABLE public.property_view_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_view_events_staff_read ON public.property_view_events;
CREATE POLICY property_view_events_staff_read ON public.property_view_events FOR SELECT TO authenticated USING (public.is_staff_caller());
GRANT SELECT ON public.property_view_events TO authenticated;

CREATE OR REPLACE FUNCTION public.record_property_view(p_property_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller text := auth.uid()::text;
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_owner_id text;
  v_new_count integer;
BEGIN
  IF v_property_id IS NULL THEN RETURN NULL; END IF;
  SELECT owner_user_id::text, view_count INTO v_owner_id, v_new_count FROM public.properties WHERE id::text = v_property_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_caller IS NOT NULL AND v_caller = v_owner_id THEN RETURN v_new_count; END IF;
  UPDATE public.properties SET view_count = view_count + 1 WHERE id::text = v_property_id RETURNING view_count INTO v_new_count;
  IF v_new_count IS NOT NULL THEN
    INSERT INTO public.property_view_events(property_id, viewer_user_id) VALUES (v_property_id, NULLIF(v_caller,''));
  END IF;
  RETURN v_new_count;
END;
$$;
REVOKE ALL ON FUNCTION public.record_property_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_property_view(text) TO authenticated, anon;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_log(actor_user_id, created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_audit_staff_read ON public.admin_audit_log;
CREATE POLICY admin_audit_staff_read ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_staff_caller());
GRANT SELECT ON public.admin_audit_log TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_verification_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.admin_audit_log(actor_user_id, action, resource_type, resource_id, metadata)
  VALUES (NEW.reviewed_by, 'verification.status_changed', NEW.subject_type, NEW.subject_id, jsonb_build_object('from',NEW.from_status,'to',NEW.to_status,'note',NEW.note));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_verification_event ON public.verification_events;
CREATE TRIGGER trg_audit_verification_event AFTER INSERT ON public.verification_events FOR EACH ROW EXECUTE FUNCTION public.audit_verification_event();

CREATE OR REPLACE FUNCTION public.audit_report_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_audit_log(actor_user_id, action, resource_type, resource_id, metadata)
    VALUES (NEW.reviewed_by, 'report.status_changed', 'report', NEW.id, jsonb_build_object('from',OLD.status,'to',NEW.status));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_report_change ON public.reports;
CREATE TRIGGER trg_audit_report_change AFTER UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.audit_report_change();

CREATE OR REPLACE FUNCTION public.get_admin_dashboard(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_account_type text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := coalesce(p_from, current_date - 29);
  v_to date := coalesce(p_to, current_date);
  v_days int := greatest(1, v_to - v_from + 1);
  v_prev_from date := v_from - v_days;
  v_prev_to date := v_from - 1;
  v jsonb;
BEGIN
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;

  WITH days AS (
    SELECT generate_series(v_from::timestamp, v_to::timestamp, interval '1 day')::date d
  ),
  activity AS (
    SELECT d,
      (SELECT count(*) FROM users u WHERE u.created_at::date=d AND (p_account_type IS NULL OR u.account_type::text=p_account_type)) users,
      (SELECT count(*) FROM properties p WHERE p.created_at::date=d AND (p_city IS NULL OR p.city=p_city)) properties,
      (SELECT count(*) FROM property_view_events e JOIN properties p ON p.id=e.property_id WHERE e.created_at::date=d AND (p_city IS NULL OR p.city=p_city)) views,
      (SELECT count(*) FROM viewing_requests r WHERE r.created_at::date=d) requests
    FROM days
  ),
  cur AS (
    SELECT
      (SELECT count(*) FROM users u WHERE p_account_type IS NULL OR u.account_type::text=p_account_type) total_users,
      (SELECT count(*) FROM properties p WHERE p_city IS NULL OR p.city=p_city) total_properties,
      (SELECT coalesce(sum(p.view_count),0) FROM properties p WHERE p_city IS NULL OR p.city=p_city) total_views,
      (SELECT count(*) FROM viewing_requests r WHERE r.created_at::date BETWEEN v_from AND v_to) period_requests,
      (SELECT count(*) FROM viewing_requests r WHERE r.created_at::date BETWEEN v_from AND v_to) total_viewing_requests,
      (SELECT count(*) FROM property_likes l WHERE l.created_at::date BETWEEN v_from AND v_to) total_likes,
      (SELECT count(*) FROM messages m WHERE m.sent_at::date BETWEEN v_from AND v_to) total_messages,
      (SELECT count(*) FROM properties p WHERE p.verification='pending') pending_reviews,
      (SELECT count(*) FROM properties p WHERE p.verification='verified' AND (p_city IS NULL OR p.city=p_city)) verified_properties,
      (SELECT count(*) FROM users u WHERE u.created_at::date BETWEEN v_from AND v_to AND (p_account_type IS NULL OR u.account_type::text=p_account_type)) new_users,
      (SELECT count(*) FROM properties p WHERE p.created_at::date BETWEEN v_from AND v_to AND (p_city IS NULL OR p.city=p_city)) new_properties,
      (SELECT coalesce(sum(a.views),0) FROM activity a) period_views
  ), prev AS (
    SELECT
      (SELECT count(*) FROM users u WHERE u.created_at::date BETWEEN v_prev_from AND v_prev_to AND (p_account_type IS NULL OR u.account_type::text=p_account_type)) users,
      (SELECT count(*) FROM properties p WHERE p.created_at::date BETWEEN v_prev_from AND v_prev_to AND (p_city IS NULL OR p.city=p_city)) properties,
      (SELECT count(*) FROM viewing_requests r WHERE r.created_at::date BETWEEN v_prev_from AND v_prev_to) requests,
      (SELECT count(*) FROM property_likes l WHERE l.created_at::date BETWEEN v_prev_from AND v_prev_to) likes,
      (SELECT count(*) FROM messages m WHERE m.sent_at::date BETWEEN v_prev_from AND v_prev_to) messages
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_users', c.total_users, 'total_properties', c.total_properties, 'total_views', c.total_views,
      'period_requests', c.period_requests, 'total_viewing_requests', c.total_viewing_requests,
      'total_likes', c.total_likes, 'total_messages', c.total_messages, 'pending_reviews', c.pending_reviews,
      'verified_properties', c.verified_properties, 'new_users', c.new_users, 'new_properties', c.new_properties,
      'period_views', c.period_views,
      'user_growth', CASE WHEN pr.users=0 THEN 0 ELSE round(((c.new_users-pr.users)::numeric/pr.users)*100,1) END,
      'property_growth', CASE WHEN pr.properties=0 THEN 0 ELSE round(((c.new_properties-pr.properties)::numeric/pr.properties)*100,1) END,
      'request_growth', CASE WHEN pr.requests=0 THEN 0 ELSE round(((c.period_requests-pr.requests)::numeric/pr.requests)*100,1) END,
      'like_growth', CASE WHEN pr.likes=0 THEN 0 ELSE round(((c.total_likes-pr.likes)::numeric/pr.likes)*100,1) END,
      'message_growth', CASE WHEN pr.messages=0 THEN 0 ELSE round(((c.total_messages-pr.messages)::numeric/pr.messages)*100,1) END,
      'view_growth', 0, 'pending_growth', 0, 'verified_growth', 0,
      'user_series', (SELECT coalesce(jsonb_agg(users ORDER BY d),'[]'::jsonb) FROM activity),
      'property_series', (SELECT coalesce(jsonb_agg(properties ORDER BY d),'[]'::jsonb) FROM activity),
      'view_series', (SELECT coalesce(jsonb_agg(views ORDER BY d),'[]'::jsonb) FROM activity),
      'request_series', (SELECT coalesce(jsonb_agg(requests ORDER BY d),'[]'::jsonb) FROM activity)
    ),
    'activity', jsonb_build_object(
      'labels',(SELECT coalesce(jsonb_agg(to_char(d,'Mon DD') ORDER BY d),'[]'::jsonb) FROM activity),
      'views',(SELECT coalesce(jsonb_agg(views ORDER BY d),'[]'::jsonb) FROM activity),
      'users',(SELECT coalesce(jsonb_agg(users ORDER BY d),'[]'::jsonb) FROM activity),
      'properties',(SELECT coalesce(jsonb_agg(properties ORDER BY d),'[]'::jsonb) FROM activity),
      'requests',(SELECT coalesce(jsonb_agg(requests ORDER BY d),'[]'::jsonb) FROM activity)
    ),
    'breakdowns', jsonb_build_object(
      'account_types',(SELECT coalesce(jsonb_agg(jsonb_build_object('label',account_type,'value',n) ORDER BY n DESC),'[]'::jsonb) FROM (SELECT account_type::text account_type,count(*) n FROM users GROUP BY account_type) x),
      'cities',(SELECT coalesce(jsonb_agg(jsonb_build_object('label',city,'value',n) ORDER BY n DESC),'[]'::jsonb) FROM (SELECT city,count(*) n FROM properties WHERE city IS NOT NULL AND (p_city IS NULL OR city=p_city) GROUP BY city ORDER BY n DESC LIMIT 8) x),
      'property_types',(SELECT coalesce(jsonb_agg(jsonb_build_object('label',property_type,'value',n) ORDER BY n DESC),'[]'::jsonb) FROM (SELECT property_type,count(*) n FROM properties WHERE p_city IS NULL OR city=p_city GROUP BY property_type ORDER BY n DESC LIMIT 8) x),
      'student_demand',(SELECT coalesce(jsonb_agg(jsonb_build_object('label',coalesce(u.name,'Unassigned'),'value',n) ORDER BY n DESC),'[]'::jsonb) FROM (SELECT university_id,count(*) n FROM student_profiles WHERE university_id IS NOT NULL GROUP BY university_id ORDER BY n DESC LIMIT 8) x LEFT JOIN universities u ON u.id=x.university_id)
    ),
    'recent_activity',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY created_at DESC),'[]'::jsonb) FROM (SELECT id,'user' kind,'New user joined' title,coalesce(display_name,email,'New account') description,created_at FROM users WHERE created_at >= now()-interval '48 hours' ORDER BY created_at DESC LIMIT 8) a)
  ) INTO v FROM cur c CROSS JOIN prev pr;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_dashboard(date,date,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard(date,date,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_users(p_search text DEFAULT NULL,p_account_type text DEFAULT NULL,p_limit int DEFAULT 50,p_offset int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb; v_total int;
BEGIN
 IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
 SELECT count(*) INTO v_total FROM users u WHERE (p_account_type IS NULL OR u.account_type::text=p_account_type) AND (p_search IS NULL OR u.display_name ILIKE '%'||p_search||'%' OR u.email ILIKE '%'||p_search||'%');
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT u.id,u.display_name,u.email,u.account_type,u.created_at,(SELECT count(*) FROM properties p WHERE p.owner_user_id=u.id) listing_count,(SELECT count(*) FROM viewing_requests r WHERE r.user_id=u.id) request_count,(SELECT max(up.last_seen_at) FROM user_presence up WHERE up.user_id=u.id) last_active_at,(CASE WHEN u.account_type='student' THEN (SELECT sp.verification_status::text FROM student_profiles sp WHERE sp.user_id=u.id) ELSE NULL END) verification_status FROM users u WHERE (p_account_type IS NULL OR u.account_type::text=p_account_type) AND (p_search IS NULL OR u.display_name ILIKE '%'||p_search||'%' OR u.email ILIKE '%'||p_search||'%') ORDER BY u.created_at DESC LIMIT greatest(1,least(p_limit,100)) OFFSET greatest(p_offset,0)) x;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;$$;
REVOKE ALL ON FUNCTION public.get_admin_users(text,text,int,int) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.get_admin_users(text,text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_properties(p_search text DEFAULT NULL,p_status text DEFAULT NULL,p_limit int DEFAULT 50,p_offset int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb; v_total int;
BEGIN
 IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
 SELECT count(*) INTO v_total FROM properties p WHERE (p_status IS NULL OR p.verification::text=p_status) AND (p_search IS NULL OR p.title ILIKE '%'||p_search||'%' OR p.city ILIKE '%'||p_search||'%' OR p.suburb ILIKE '%'||p_search||'%');
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT p.id,p.title,p.property_type,p.suburb,p.city,p.rent_usd,p.verification,p.created_at,coalesce(u.display_name,p.landlord_name,'Unknown') owner_name,coalesce(p.view_count,0) view_count,(SELECT count(*) FROM property_saves s WHERE s.property_id=p.id) save_count,(SELECT count(*) FROM viewing_requests r WHERE r.property_id=p.id) request_count FROM properties p LEFT JOIN users u ON u.id=p.owner_user_id WHERE (p_status IS NULL OR p.verification::text=p_status) AND (p_search IS NULL OR p.title ILIKE '%'||p_search||'%' OR p.city ILIKE '%'||p_search||'%' OR p.suburb ILIKE '%'||p_search||'%') ORDER BY p.created_at DESC LIMIT greatest(1,least(p_limit,100)) OFFSET greatest(p_offset,0)) x;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;$$;
REVOKE ALL ON FUNCTION public.get_admin_properties(text,text,int,int) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.get_admin_properties(text,text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_reports(p_status text DEFAULT NULL,p_limit int DEFAULT 50,p_offset int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb; v_total int;
BEGIN
 IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
 SELECT count(*) INTO v_total FROM reports r WHERE (p_status IS NULL OR r.status::text=p_status);
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT r.id,r.subject_type,r.subject_id,r.reason,r.note,r.status,r.created_at,coalesce(u.display_name,u.email,'Unknown') reporter_name,coalesce(p.title,r.subject_id) subject_title FROM reports r LEFT JOIN users u ON u.id=r.reporter_user_id LEFT JOIN properties p ON r.subject_type='property' AND p.id=r.subject_id WHERE (p_status IS NULL OR r.status::text=p_status) ORDER BY r.created_at DESC LIMIT greatest(1,least(p_limit,100)) OFFSET greatest(p_offset,0)) x;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;$$;
REVOKE ALL ON FUNCTION public.get_admin_reports(text,int,int) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.get_admin_reports(text,int,int) TO authenticated;

COMMIT;
