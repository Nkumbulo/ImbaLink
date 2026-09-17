-- ImbaLink Phase 5: immutable audit log + transactional privileged mutations
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Audit log is append-only. Existing SECURITY DEFINER mutation RPCs may
--    insert rows, but authenticated clients can never UPDATE/DELETE history.
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_staff_read ON public.admin_audit_log;
CREATE POLICY admin_audit_staff_read ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.admin_authorization()->>'allowed' = 'true');

DROP POLICY IF EXISTS admin_audit_no_insert ON public.admin_audit_log;
CREATE POLICY admin_audit_no_insert ON public.admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS admin_audit_no_update ON public.admin_audit_log;
CREATE POLICY admin_audit_no_update ON public.admin_audit_log
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS admin_audit_no_delete ON public.admin_audit_log;
CREATE POLICY admin_audit_no_delete ON public.admin_audit_log
  FOR DELETE TO authenticated USING (false);

REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_event(
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id text DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_id bigint;
  v_actor text := coalesce(p_actor_user_id, auth.uid()::text);
BEGIN
  IF nullif(trim(p_action),'') IS NULL THEN RAISE EXCEPTION 'AUDIT_ACTION_REQUIRED'; END IF;
  INSERT INTO public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor,left(p_action,200),left(p_resource_type,100),left(p_resource_id,200),coalesce(p_metadata,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.audit_event(text,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_event(text,text,text,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_admin_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE';
END; $$;
DROP TRIGGER IF EXISTS trg_admin_audit_immutable_update ON public.admin_audit_log;
DROP TRIGGER IF EXISTS trg_admin_audit_immutable_delete ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_immutable_update
  BEFORE UPDATE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_audit_mutation();
CREATE TRIGGER trg_admin_audit_immutable_delete
  BEFORE DELETE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_audit_mutation();

-- ---------------------------------------------------------------------------
-- 2. Append-only operational records. Notes, warnings and broadcasts are
--    never directly mutable by authenticated users; their RPCs remain the
--    controlled write boundary.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_notes_staff ON public.admin_user_notes;
CREATE POLICY admin_notes_staff_read ON public.admin_user_notes
  FOR SELECT TO authenticated
  USING (public.admin_authorization()->>'allowed' = 'true');
DROP POLICY IF EXISTS admin_warnings_staff ON public.admin_warnings;
CREATE POLICY admin_warnings_staff_read ON public.admin_warnings
  FOR SELECT TO authenticated
  USING (public.admin_authorization()->>'allowed' = 'true');
DROP POLICY IF EXISTS admin_settings_staff ON public.admin_settings;
CREATE POLICY admin_settings_staff_read ON public.admin_settings
  FOR SELECT TO authenticated
  USING (public.admin_authorization()->>'allowed' = 'true');
DROP POLICY IF EXISTS admin_broadcasts_staff ON public.admin_broadcasts;
CREATE POLICY admin_broadcasts_staff_read ON public.admin_broadcasts
  FOR SELECT TO authenticated
  USING (public.admin_authorization()->>'allowed' = 'true');

REVOKE INSERT, UPDATE, DELETE ON public.admin_user_notes, public.admin_warnings, public.admin_settings, public.admin_broadcasts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Two-phase hard deletion. Supabase Auth is an external system, so it
--    cannot share a SQL transaction with public.users. We therefore create a
--    durable pending deletion, soft-hide the user, delete Auth, then finalize
--    the public transaction. Failed Auth deletion is safely cancelled; failed
--    finalization remains retryable instead of silently losing the operation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_pending_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  actor_user_id text REFERENCES public.users(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','auth_deleted','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_pending_delete_active
  ON public.admin_pending_deletions(user_id) WHERE status IN ('pending','auth_deleted');
CREATE INDEX IF NOT EXISTS idx_admin_pending_delete_status
  ON public.admin_pending_deletions(status, created_at DESC);
ALTER TABLE public.admin_pending_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_pending_delete_none ON public.admin_pending_deletions;
CREATE POLICY admin_pending_delete_none ON public.admin_pending_deletions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.admin_pending_deletions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_begin_hard_delete(p_id text,p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor text := auth.uid()::text;
  v_user jsonb;
  v_pending uuid;
BEGIN
  PERFORM public.admin_require_permission('users.delete.hard');
  SELECT to_jsonb(u) INTO v_user FROM public.users u WHERE u.id=p_id FOR UPDATE;
  IF v_user IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM public.admin_pending_deletions d WHERE d.user_id=p_id AND d.status IN ('pending','auth_deleted')) THEN
    RAISE EXCEPTION 'HARD_DELETE_ALREADY_PENDING';
  END IF;
  INSERT INTO public.admin_pending_deletions(user_id,actor_user_id,reason)
    VALUES(p_id,v_actor,left(coalesce(p_reason,'Permanent deletion'),500)) RETURNING id INTO v_pending;
  UPDATE public.users SET soft_deleted_at=coalesce(soft_deleted_at,now()),soft_deleted_by=v_actor,updated_at=now() WHERE id=p_id;
  PERFORM public.audit_event('user.hard_delete_started','user',p_id,jsonb_build_object('reason',left(coalesce(p_reason,''),500),'pending_id',v_pending::text,'old',v_user));
  RETURN jsonb_build_object('pending_id',v_pending,'user_id',p_id,'status','pending');
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_begin_hard_delete(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_mark_hard_delete_auth_complete(p_pending uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.admin_require_permission('users.delete.hard');
  UPDATE public.admin_pending_deletions SET status='auth_deleted',updated_at=now() WHERE id=p_pending AND status='pending' RETURNING jsonb_build_object('pending_id',id,'user_id',user_id,'status',status) INTO v;
  IF v IS NULL THEN RAISE EXCEPTION 'HARD_DELETE_PENDING_NOT_FOUND'; END IF;
  PERFORM public.audit_event('user.hard_delete_auth_completed','user',v->>'user_id',jsonb_build_object('pending_id',p_pending::text));
  RETURN v;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_mark_hard_delete_auth_complete(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cancel_hard_delete(p_pending uuid,p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; v_user text;
BEGIN
  PERFORM public.admin_require_permission('users.delete.hard');
  SELECT user_id INTO v_user FROM public.admin_pending_deletions WHERE id=p_pending AND status='pending' FOR UPDATE;
  IF v_user IS NULL THEN RAISE EXCEPTION 'HARD_DELETE_PENDING_NOT_FOUND'; END IF;
  UPDATE public.users SET soft_deleted_at=NULL,soft_deleted_by=NULL,updated_at=now() WHERE id=v_user;
  UPDATE public.admin_pending_deletions SET status='cancelled',reason=left(coalesce(reason,'')||' | '||coalesce(p_reason,''),1000),updated_at=now() WHERE id=p_pending;
  PERFORM public.audit_event('user.hard_delete_cancelled','user',v_user,jsonb_build_object('pending_id',p_pending::text,'reason',left(coalesce(p_reason,''),500)));
  RETURN jsonb_build_object('pending_id',p_pending,'user_id',v_user,'status','cancelled');
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_cancel_hard_delete(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_finalize_hard_delete(p_pending uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user text; v_actor text; v_reason text; v_before jsonb;
BEGIN
  PERFORM public.admin_require_permission('users.delete.hard');
  SELECT user_id,actor_user_id,reason INTO v_user,v_actor,v_reason
    FROM public.admin_pending_deletions WHERE id=p_pending AND status='auth_deleted' FOR UPDATE;
  IF v_user IS NULL THEN RAISE EXCEPTION 'HARD_DELETE_AUTH_COMPLETION_REQUIRED'; END IF;
  SELECT to_jsonb(u) INTO v_before FROM public.users u WHERE u.id=v_user FOR UPDATE;
  IF v_before IS NULL THEN
    UPDATE public.admin_pending_deletions SET status='completed',completed_at=now(),updated_at=now() WHERE id=p_pending;
    RETURN jsonb_build_object('pending_id',p_pending,'user_id',v_user,'status','completed');
  END IF;
  PERFORM public.audit_event('user.hard_delete_completed','user',v_user,jsonb_build_object('pending_id',p_pending::text,'reason',v_reason,'old',v_before),v_actor);
  DELETE FROM public.users WHERE id=v_user;
  UPDATE public.admin_pending_deletions SET status='completed',completed_at=now(),updated_at=now() WHERE id=p_pending;
  RETURN jsonb_build_object('pending_id',p_pending,'user_id',v_user,'status','completed');
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_finalize_hard_delete(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Canonical audited setting mutation. It remains one DB transaction: the
--    setting write and audit event either both commit or both roll back.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_save_setting(p_key text,p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor text:=auth.uid()::text; v jsonb; v_old jsonb;
BEGIN
  PERFORM public.admin_require_permission('settings.update');
  IF nullif(trim(p_key),'') IS NULL THEN RAISE EXCEPTION 'SETTING_KEY_REQUIRED'; END IF;
  SELECT value INTO v_old FROM public.admin_settings WHERE key=p_key FOR UPDATE;
  INSERT INTO public.admin_settings(key,value,updated_by,updated_at)
  VALUES(left(p_key,200),coalesce(p_value,'{}'::jsonb),v_actor,now())
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=now()
  RETURNING to_jsonb(admin_settings) INTO v;
  PERFORM public.audit_event('setting.updated','setting',p_key,jsonb_build_object('old',v_old,'new',v));
  RETURN v;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_save_setting(text,jsonb) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
