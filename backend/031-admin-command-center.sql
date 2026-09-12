-- ImbaLink Admin Command Center
-- Run after the existing admin/verification migrations.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS admin_role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS soft_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS soft_deleted_by text;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS flagged_reason text,
  ADD COLUMN IF NOT EXISTS soft_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS soft_deleted_by text;

CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_warnings (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('announcement','popup','notification')),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  image_url text,
  link_url text,
  background_color text,
  target_roles text[] NOT NULL DEFAULT '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  created_by text REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_active ON public.admin_broadcasts(active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_admin_user_notes_user ON public.admin_user_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_warnings_user ON public.admin_warnings(user_id, created_at DESC);

ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_notes_staff ON public.admin_user_notes;
CREATE POLICY admin_notes_staff ON public.admin_user_notes FOR ALL TO authenticated USING (public.is_staff_caller()) WITH CHECK (public.is_staff_caller());
DROP POLICY IF EXISTS admin_warnings_staff ON public.admin_warnings;
CREATE POLICY admin_warnings_staff ON public.admin_warnings FOR ALL TO authenticated USING (public.is_staff_caller()) WITH CHECK (public.is_staff_caller());
DROP POLICY IF EXISTS admin_settings_staff ON public.admin_settings;
CREATE POLICY admin_settings_staff ON public.admin_settings FOR ALL TO authenticated USING (public.is_staff_caller()) WITH CHECK (public.is_staff_caller());
DROP POLICY IF EXISTS admin_broadcasts_staff ON public.admin_broadcasts;
CREATE POLICY admin_broadcasts_staff ON public.admin_broadcasts FOR ALL TO authenticated USING (public.is_staff_caller()) WITH CHECK (public.is_staff_caller());

CREATE OR REPLACE FUNCTION public.admin_require_admin() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF COALESCE(auth.jwt()->'app_metadata'->>'role','') NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'ADMIN_ROLE_REQUIRED'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_require_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_require_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_users(p_search text DEFAULT NULL,p_status text DEFAULT NULL,p_role text DEFAULT NULL,p_limit int DEFAULT 50,p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb; v_total int;
BEGIN
 PERFORM public.admin_require_admin();
 SELECT count(*) INTO v_total FROM users u WHERE u.soft_deleted_at IS NULL AND (p_status IS NULL OR u.admin_status=p_status) AND (p_role IS NULL OR u.admin_role=p_role) AND (p_search IS NULL OR concat_ws(' ',u.first_name,u.surname,u.display_name,u.email,u.phone) ILIKE '%'||p_search||'%');
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (
   SELECT u.*, (SELECT count(*) FROM properties p WHERE p.owner_user_id=u.id AND p.soft_deleted_at IS NULL) listing_count,
          (SELECT count(*) FROM viewing_requests r WHERE r.user_id=u.id) request_count
   FROM users u WHERE u.soft_deleted_at IS NULL AND (p_status IS NULL OR u.admin_status=p_status) AND (p_role IS NULL OR u.admin_role=p_role) AND (p_search IS NULL OR concat_ws(' ',u.first_name,u.surname,u.display_name,u.email,u.phone) ILIKE '%'||p_search||'%')
   ORDER BY u.created_at DESC LIMIT greatest(1,least(p_limit,100)) OFFSET greatest(p_offset,0)
 ) x;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_users(text,text,text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user(p_id text,p_changes jsonb,p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before jsonb; v_after jsonb; v_actor text:=auth.uid()::text; k text; v jsonb;
BEGIN
 PERFORM public.admin_require_admin();
 SELECT to_jsonb(u) INTO v_before FROM users u WHERE u.id=p_id FOR UPDATE;
 IF v_before IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each(p_changes) LOOP
   IF k NOT IN ('first_name','surname','display_name','email','phone','account_type','admin_status','admin_role','email_verified','phone_verified','id_verified') THEN RAISE EXCEPTION 'FIELD_NOT_ALLOWED:%',k; END IF;
   EXECUTE format('UPDATE users SET %I=$1, updated_at=now() WHERE id=$2',k) USING CASE WHEN jsonb_typeof(v)='null' THEN NULL ELSE v#>>'{}' END,p_id;
 END LOOP;
 SELECT to_jsonb(u) INTO v_after FROM users u WHERE u.id=p_id;
 INSERT INTO admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) VALUES(v_actor,'user.updated','user',p_id,jsonb_build_object('old',v_before,'new',v_after,'reason',left(coalesce(p_reason,''),500)));
 RETURN v_after;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_user(text,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_lifecycle(p_id text,p_action text,p_reason text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor text:=auth.uid()::text; v_before jsonb; v_after jsonb;
BEGIN
 PERFORM public.admin_require_admin();
 SELECT to_jsonb(u) INTO v_before FROM users u WHERE u.id=p_id FOR UPDATE;
 IF v_before IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
 IF p_action='soft_delete' THEN UPDATE users SET soft_deleted_at=now(),soft_deleted_by=v_actor,admin_status='rejected',updated_at=now() WHERE id=p_id;
 ELSIF p_action='restore' THEN UPDATE users SET soft_deleted_at=NULL,soft_deleted_by=NULL,admin_status='approved',updated_at=now() WHERE id=p_id;
 ELSIF p_action IN ('approve','reject','suspend','ban','pending') THEN UPDATE users SET admin_status=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'suspend' THEN 'suspended' WHEN 'ban' THEN 'banned' ELSE 'pending' END,updated_at=now() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'INVALID_USER_ACTION'; END IF;
 SELECT to_jsonb(u) INTO v_after FROM users u WHERE u.id=p_id;
 INSERT INTO admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) VALUES(v_actor,'user.'||p_action,'user',p_id,jsonb_build_object('old',v_before,'new',v_after,'reason',left(coalesce(p_reason,''),500)));
 INSERT INTO admin_warnings(user_id,admin_user_id,action,reason) VALUES(p_id,v_actor,p_action,left(coalesce(p_reason,''),500));
 RETURN v_after;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_user_lifecycle(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_user_note(p_user_id text,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; v_actor text:=auth.uid()::text;
BEGIN PERFORM public.admin_require_admin(); INSERT INTO admin_user_notes(user_id,admin_user_id,note) VALUES(p_user_id,v_actor,left(p_note,2000)) RETURNING to_jsonb(admin_user_notes) INTO v; RETURN v; END; $$;
GRANT EXECUTE ON FUNCTION public.admin_add_user_note(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_user_detail(p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN PERFORM public.admin_require_admin();
 SELECT jsonb_build_object('user',to_jsonb(u),'listings',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC),'[]'::jsonb) FROM properties p WHERE p.owner_user_id=u.id),'notes',(SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC),'[]'::jsonb) FROM admin_user_notes n WHERE n.user_id=u.id),'warnings',(SELECT coalesce(jsonb_agg(to_jsonb(w) ORDER BY w.created_at DESC),'[]'::jsonb) FROM admin_warnings w WHERE w.user_id=u.id),'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC),'[]'::jsonb) FROM admin_audit_log a WHERE a.resource_type='user' AND a.resource_id=u.id)) INTO v FROM users u WHERE u.id=p_id;
 IF v IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF; RETURN v;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_user_detail(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_property(p_id text,p_changes jsonb,p_reason text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before jsonb; v_after jsonb; v_actor text:=auth.uid()::text; k text; v jsonb;
BEGIN PERFORM public.admin_require_admin(); SELECT to_jsonb(p) INTO v_before FROM properties p WHERE p.id=p_id FOR UPDATE; IF v_before IS NULL THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND'; END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each(p_changes) LOOP
  IF k NOT IN ('title','description','property_type','suburb','city','street_address','rent_usd','deposit_usd','rooms','bathrooms','bathroom_type','furnished','availability','lease_term','electricity','water','security','parking','verification','admin_status','featured','featured_until','flagged_reason','landlord_name') THEN RAISE EXCEPTION 'FIELD_NOT_ALLOWED:%',k; END IF;
  EXECUTE format('UPDATE properties SET %I=$1,updated_at=now() WHERE id=$2',k) USING CASE WHEN jsonb_typeof(v)='null' THEN NULL ELSE v#>>'{}' END,p_id;
 END LOOP;
 SELECT to_jsonb(p) INTO v_after FROM properties p WHERE p.id=p_id;
 INSERT INTO admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) VALUES(v_actor,'property.updated','property',p_id,jsonb_build_object('old',v_before,'new',v_after,'reason',left(coalesce(p_reason,''),500)));
 RETURN v_after; END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_property(text,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_properties(p_search text DEFAULT NULL,p_status text DEFAULT NULL,p_limit int DEFAULT 50,p_offset int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb; v_total int;
BEGIN PERFORM public.admin_require_admin(); SELECT count(*) INTO v_total FROM properties p WHERE p.soft_deleted_at IS NULL AND (p_status IS NULL OR coalesce(p.admin_status,p.verification::text)=p_status) AND (p_search IS NULL OR concat_ws(' ',p.title,p.city,p.suburb,p.property_type,p.landlord_name) ILIKE '%'||p_search||'%');
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_rows FROM (SELECT p.*,coalesce(u.display_name,p.landlord_name,'Unknown') owner_name FROM properties p LEFT JOIN users u ON u.id=p.owner_user_id WHERE p.soft_deleted_at IS NULL AND (p_status IS NULL OR coalesce(p.admin_status,p.verification::text)=p_status) AND (p_search IS NULL OR concat_ws(' ',p.title,p.city,p.suburb,p.property_type,p.landlord_name) ILIKE '%'||p_search||'%') ORDER BY p.created_at DESC LIMIT greatest(1,least(p_limit,100)) OFFSET greatest(p_offset,0)) x;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total); END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_properties(text,text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_property_action(p_id text,p_action text,p_reason text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor text:=auth.uid()::text; v_before jsonb; v_after jsonb;
BEGIN PERFORM public.admin_require_admin(); SELECT to_jsonb(p) INTO v_before FROM properties p WHERE p.id=p_id FOR UPDATE; IF v_before IS NULL THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND'; END IF;
 IF p_action='approve' THEN UPDATE properties SET admin_status='approved',verification='verified',published_at=coalesce(published_at,now()),updated_at=now() WHERE id=p_id;
 ELSIF p_action='reject' THEN UPDATE properties SET admin_status='rejected',verification='rejected',published_at=NULL,updated_at=now() WHERE id=p_id;
 ELSIF p_action='flag' THEN UPDATE properties SET admin_status='flagged',verification='flagged',flagged_reason=left(p_reason,500),updated_at=now() WHERE id=p_id;
 ELSIF p_action='sold' OR p_action='rented' OR p_action='expired' THEN UPDATE properties SET admin_status=p_action,updated_at=now() WHERE id=p_id;
 ELSIF p_action='feature' THEN UPDATE properties SET featured=true,featured_until=now()+interval '30 days',updated_at=now() WHERE id=p_id;
 ELSIF p_action='unfeature' THEN UPDATE properties SET featured=false,featured_until=NULL,updated_at=now() WHERE id=p_id;
 ELSIF p_action='soft_delete' THEN UPDATE properties SET soft_deleted_at=now(),soft_deleted_by=v_actor,updated_at=now() WHERE id=p_id;
 ELSIF p_action='restore' THEN UPDATE properties SET soft_deleted_at=NULL,soft_deleted_by=NULL,updated_at=now() WHERE id=p_id;
 ELSE RAISE EXCEPTION 'INVALID_PROPERTY_ACTION'; END IF;
 SELECT to_jsonb(p) INTO v_after FROM properties p WHERE p.id=p_id; INSERT INTO admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) VALUES(v_actor,'property.'||p_action,'property',p_id,jsonb_build_object('old',v_before,'new',v_after,'reason',left(coalesce(p_reason,''),500))); RETURN v_after; END; $$;
GRANT EXECUTE ON FUNCTION public.admin_property_action(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_settings() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; BEGIN PERFORM public.admin_require_admin(); SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO v FROM admin_settings; RETURN v; END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_setting(p_key text,p_value jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor text:=auth.uid()::text; v jsonb; BEGIN PERFORM public.admin_require_admin(); INSERT INTO admin_settings(key,value,updated_by,updated_at) VALUES(p_key,p_value,v_actor,now()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=now() RETURNING to_jsonb(admin_settings) INTO v; INSERT INTO admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) VALUES(v_actor,'setting.updated','setting',p_key,jsonb_build_object('value',p_value)); RETURN v; END; $$;
GRANT EXECUTE ON FUNCTION public.admin_save_setting(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_broadcasts() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; BEGIN PERFORM public.admin_require_admin(); SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.updated_at DESC),'[]'::jsonb) INTO v FROM admin_broadcasts b; RETURN v; END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_broadcasts() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_broadcast(p_id bigint,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; v_actor text:=auth.uid()::text; BEGIN PERFORM public.admin_require_admin(); IF p_id IS NULL THEN INSERT INTO admin_broadcasts(kind,title,body,image_url,link_url,background_color,target_roles,starts_at,ends_at,active,created_by) VALUES(coalesce(p_payload->>'kind','announcement'),coalesce(p_payload->>'title',''),coalesce(p_payload->>'body',''),p_payload->>'image_url',p_payload->>'link_url',p_payload->>'background_color',coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'target_roles','[]'::jsonb))),ARRAY[]::text[]),NULLIF(p_payload->>'starts_at','')::timestamptz,NULLIF(p_payload->>'ends_at','')::timestamptz,coalesce((p_payload->>'active')::boolean,false),v_actor) RETURNING to_jsonb(admin_broadcasts) INTO v; ELSE UPDATE admin_broadcasts SET kind=coalesce(p_payload->>'kind',kind),title=coalesce(p_payload->>'title',title),body=coalesce(p_payload->>'body',body),image_url=p_payload->>'image_url',link_url=p_payload->>'link_url',background_color=p_payload->>'background_color',target_roles=coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'target_roles','[]'::jsonb))),ARRAY[]::text[]),starts_at=NULLIF(p_payload->>'starts_at','')::timestamptz,ends_at=NULLIF(p_payload->>'ends_at','')::timestamptz,active=coalesce((p_payload->>'active')::boolean,active),updated_at=now() WHERE id=p_id RETURNING to_jsonb(admin_broadcasts) INTO v; END IF; INSERT INTO admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) VALUES(v_actor,'broadcast.saved','broadcast',coalesce(p_id::text,v->>'id'),p_payload); RETURN v; END; $$;
GRANT EXECUTE ON FUNCTION public.admin_save_broadcast(bigint,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_audit(p_limit int DEFAULT 100,p_offset int DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; t int; BEGIN PERFORM public.admin_require_admin(); SELECT count(*) INTO t FROM admin_audit_log; SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v FROM (SELECT a.*,coalesce(u.display_name,u.email,'Unknown') actor_name FROM admin_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT least(greatest(p_limit,1),200) OFFSET greatest(p_offset,0)) x; RETURN jsonb_build_object('rows',v,'total',t); END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_audit(int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_dashboard() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; BEGIN PERFORM public.admin_require_admin(); SELECT jsonb_build_object('total_users',(SELECT count(*) FROM users WHERE soft_deleted_at IS NULL),'pending_users',(SELECT count(*) FROM users WHERE admin_status='pending' AND soft_deleted_at IS NULL),'active_agents',(SELECT count(*) FROM users WHERE admin_role='agent' AND admin_status='approved' AND soft_deleted_at IS NULL),'total_properties',(SELECT count(*) FROM properties WHERE soft_deleted_at IS NULL),'pending_properties',(SELECT count(*) FROM properties WHERE coalesce(admin_status,verification::text)='pending_review' OR verification='pending'),'featured_properties',(SELECT count(*) FROM properties WHERE featured=true AND soft_deleted_at IS NULL),'open_reports',(SELECT count(*) FROM reports WHERE status IN ('open','reviewing')),'revenue_month',0) INTO v; RETURN v; END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard() TO authenticated;

-- Admin route gate: role comes from Auth app_metadata, approval comes from the database.
CREATE OR REPLACE FUNCTION public.admin_access_check()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_role text:=coalesce(auth.jwt()->'app_metadata'->>'role',''); v_status text;
BEGIN
 IF v_role NOT IN ('admin','super_admin') THEN RETURN jsonb_build_object('allowed',false,'role',v_role,'status','unauthorized'); END IF;
 SELECT admin_status INTO v_status FROM users WHERE id=auth.uid()::text;
 RETURN jsonb_build_object('allowed',v_status='approved','role',v_role,'status',coalesce(v_status,'pending'));
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_access_check() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
