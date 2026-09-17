-- ImbaLink Phase 4: centralized server-side authorization contract
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role text NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission),
  CHECK (role IN ('admin','super_admin'))
);

INSERT INTO public.admin_role_permissions(role, permission) VALUES
  ('admin','admin.access'),
  ('admin','users.read'),('admin','users.update'),('admin','users.lifecycle'),
  ('admin','users.password.reset'),('admin','users.impersonate'),
  ('admin','properties.read'),('admin','properties.update'),('admin','properties.moderate'),
  ('admin','reports.read'),('admin','reports.moderate'),
  ('admin','settings.read'),('admin','settings.update'),
  ('admin','broadcasts.read'),('admin','broadcasts.update'),
  ('admin','audit.read'),
  ('super_admin','admin.access'),('super_admin','users.read'),('super_admin','users.update'),
  ('super_admin','users.lifecycle'),('super_admin','users.password.reset'),('super_admin','users.impersonate'),
  ('super_admin','users.role.assign'),('super_admin','users.delete.hard'),
  ('super_admin','properties.read'),('super_admin','properties.update'),('super_admin','properties.moderate'),
  ('super_admin','reports.read'),('super_admin','reports.moderate'),
  ('super_admin','settings.read'),('super_admin','settings.update'),
  ('super_admin','broadcasts.read'),('super_admin','broadcasts.update'),
  ('super_admin','audit.read')
ON CONFLICT DO NOTHING;

ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_role_permissions_no_direct_access ON public.admin_role_permissions;
CREATE POLICY admin_role_permissions_no_direct_access ON public.admin_role_permissions
  FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.admin_authorization()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_role text := coalesce(auth.jwt()->'app_metadata'->>'role','');
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'status','unauthenticated','role',v_role,'user_id',NULL);
  END IF;
  SELECT admin_status INTO v_status FROM public.users WHERE id=v_uid AND soft_deleted_at IS NULL;
  RETURN jsonb_build_object(
    'allowed', v_role IN ('admin','super_admin') AND v_status='approved',
    'status', coalesce(v_status,'pending'), 'role', v_role, 'user_id', v_uid
  );
END; $$;
REVOKE ALL ON FUNCTION public.admin_authorization() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_authorization() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_require_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  v := public.admin_authorization();
  IF coalesce((v->>'allowed')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_DENIED';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_require_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_require_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_require_super_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  v := public.admin_authorization();
  IF coalesce((v->>'allowed')::boolean,false) IS NOT TRUE OR v->>'role' <> 'super_admin' THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_require_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_require_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_require_permission(p_permission text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb;
  v_role text;
BEGIN
  IF p_permission IS NULL OR length(trim(p_permission))=0 THEN RAISE EXCEPTION 'PERMISSION_REQUIRED'; END IF;
  v := public.admin_authorization();
  IF coalesce((v->>'allowed')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'ADMIN_ACCESS_DENIED'; END IF;
  v_role := v->>'role';
  IF NOT EXISTS (SELECT 1 FROM public.admin_role_permissions rp WHERE rp.role=v_role AND rp.permission=p_permission) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED:%',p_permission;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_require_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_require_permission(text) TO authenticated;

-- One stable RPC for Edge Functions and other server boundaries.
CREATE OR REPLACE FUNCTION public.admin_authorize_action(p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_role text;
  v_permission text;
  v jsonb;
BEGIN
  v := public.admin_authorization();
  IF coalesce((v->>'allowed')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'ADMIN_ACCESS_DENIED'; END IF;
  v_role := v->>'role';
  v_permission := CASE p_action
    WHEN 'users.delete_hard' THEN 'users.delete.hard'
    WHEN 'users.role.assign' THEN 'users.role.assign'
    WHEN 'users.password.reset' THEN 'users.password.reset'
    WHEN 'users.impersonate' THEN 'users.impersonate'
    WHEN 'users.lifecycle' THEN 'users.lifecycle'
    WHEN 'users.update' THEN 'users.update'
    WHEN 'properties.moderate' THEN 'properties.moderate'
    ELSE p_action
  END;
  IF NOT EXISTS (SELECT 1 FROM public.admin_role_permissions rp WHERE rp.role=v_role AND rp.permission=v_permission) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED:%',v_permission;
  END IF;
  RETURN jsonb_build_object('allowed',true,'action',p_action,'permission',v_permission,'role',v_role,'user_id',auth.uid());
END; $$;
REVOKE ALL ON FUNCTION public.admin_authorize_action(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_authorize_action(text) TO authenticated;

-- Sensitive role changes are now super-admin only.
CREATE OR REPLACE FUNCTION public.admin_update_user(p_id text,p_changes jsonb,p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before jsonb; v_after jsonb; v_actor text:=auth.uid()::text; k text; v jsonb; v_role text;
BEGIN
 PERFORM public.admin_require_permission('users.update');
 SELECT to_jsonb(u) INTO v_before FROM users u WHERE u.id=p_id FOR UPDATE;
 IF v_before IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
 IF p_changes ? 'admin_role' THEN
   v_role := p_changes->>'admin_role';
   IF v_role IN ('admin','super_admin') THEN PERFORM public.admin_require_super_admin(); END IF;
 END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each(p_changes) LOOP
   IF k NOT IN ('first_name','surname','display_name','email','phone','account_type','admin_status','admin_role','email_verified','phone_verified','id_verified') THEN RAISE EXCEPTION 'FIELD_NOT_ALLOWED:%',k; END IF;
   EXECUTE format('UPDATE users SET %I=$1, updated_at=now() WHERE id=$2',k) USING CASE WHEN jsonb_typeof(v)='null' THEN NULL ELSE v#>>'{}' END,p_id;
 END LOOP;
 SELECT to_jsonb(u) INTO v_after FROM users u WHERE u.id=p_id;
 INSERT INTO admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) VALUES(v_actor,'user.updated','user',p_id,jsonb_build_object('old',v_before,'new',v_after,'reason',left(coalesce(p_reason,''),500)));
 RETURN v_after;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_user(text,jsonb,text) TO authenticated;

-- Route gate uses the same canonical authorization implementation.
CREATE OR REPLACE FUNCTION public.admin_access_check()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN public.admin_authorization(); END; $$;
GRANT EXECUTE ON FUNCTION public.admin_access_check() TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
