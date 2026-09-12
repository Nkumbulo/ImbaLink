-- ImbaLink Phase 3: canonical lifecycle/state-machine contracts.
-- Run after backend/031-admin-command-center.sql.
--
-- The client state-machine module mirrors these contracts for UX. These
-- database functions/triggers are authoritative and protect direct API/RPC
-- writes from illegal lifecycle jumps.

BEGIN;

-- --------------------------------------------------------------------------
-- Canonical state values
-- --------------------------------------------------------------------------
ALTER TABLE public.users
  ADD CONSTRAINT users_admin_status_state_check
  CHECK (admin_status IN ('pending','approved','rejected','suspended','banned'));

ALTER TABLE public.properties
  ADD CONSTRAINT properties_admin_status_state_check
  CHECK (admin_status IN ('pending_review','approved','rejected','flagged','sold','rented','expired'));

ALTER TABLE public.pro_registrations
  ADD CONSTRAINT pro_registrations_status_state_check
  CHECK (status IN ('pending','active','past_due','cancelled','expired','suspended'));

-- Existing deployments may have an old NULL status on a pre-029 table.
UPDATE public.pro_registrations SET status = 'active' WHERE status IS NULL;

-- --------------------------------------------------------------------------
-- Shared transition predicates
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_transition_state(
  p_machine text,
  p_from text,
  p_to text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_machine
    WHEN 'user' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending','approved'),('pending','rejected'),
        ('approved','suspended'),('approved','banned'),
        ('rejected','pending'),
        ('suspended','approved'),('suspended','banned')
      )
    WHEN 'property' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending_review','approved'),('pending_review','rejected'),('pending_review','flagged'),
        ('approved','flagged'),('approved','sold'),('approved','rented'),('approved','expired'),
        ('rejected','pending_review'),
        ('flagged','pending_review'),('flagged','approved'),('flagged','rejected'),
        ('sold','approved'),('rented','approved'),
        ('expired','pending_review'),('expired','approved')
      )
    WHEN 'verification' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending','verified'),('pending','rejected'),('pending','flagged'),
        ('verified','flagged'),
        ('rejected','pending'),
        ('flagged','pending'),('flagged','verified'),('flagged','rejected')
      )
    WHEN 'viewing' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('requested','accepted'),('requested','declined'),('requested','cancelled'),
        ('accepted','completed'),('accepted','cancelled')
      )
    WHEN 'report' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('open','reviewing'),('open','resolved'),('open','dismissed'),
        ('reviewing','resolved'),('reviewing','dismissed'),
        ('dismissed','open')
      )
    WHEN 'pro_membership' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending','active'),('pending','cancelled'),
        ('active','past_due'),('active','cancelled'),('active','expired'),('active','suspended'),
        ('past_due','active'),('past_due','cancelled'),('past_due','suspended'),('past_due','expired'),
        ('cancelled','pending'),('expired','pending'),
        ('suspended','active'),('suspended','cancelled')
      )
    WHEN 'payment' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending','processing'),('pending','cancelled'),('pending','expired'),
        ('processing','paid'),('processing','failed'),('processing','cancelled'),
        ('paid','refunded'),('failed','pending'),('cancelled','pending'),('expired','pending')
      )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.can_transition_state(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_transition_state(text,text,text) TO authenticated;

-- --------------------------------------------------------------------------
-- User lifecycle enforcement
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_admin_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.can_transition_state('user', OLD.admin_status, NEW.admin_status) THEN
    RAISE EXCEPTION 'INVALID_USER_STATE_TRANSITION:%->%', OLD.admin_status, NEW.admin_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_admin_status_transition ON public.users;
CREATE TRIGGER trg_user_admin_status_transition
BEFORE UPDATE OF admin_status ON public.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_admin_status_transition();

-- --------------------------------------------------------------------------
-- Property lifecycle enforcement
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_property_admin_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.can_transition_state('property', OLD.admin_status, NEW.admin_status) THEN
    RAISE EXCEPTION 'INVALID_PROPERTY_STATE_TRANSITION:%->%', OLD.admin_status, NEW.admin_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_admin_status_transition ON public.properties;
CREATE TRIGGER trg_property_admin_status_transition
BEFORE UPDATE OF admin_status ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.enforce_property_admin_status_transition();

-- --------------------------------------------------------------------------
-- Viewing lifecycle enforcement
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_viewing_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.can_transition_state('viewing', OLD.status::text, NEW.status::text) THEN
    RAISE EXCEPTION 'INVALID_VIEWING_STATE_TRANSITION:%->%', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_viewing_status_transition ON public.viewing_requests;
CREATE TRIGGER trg_viewing_status_transition
BEFORE UPDATE OF status ON public.viewing_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_viewing_status_transition();

-- --------------------------------------------------------------------------
-- Report lifecycle enforcement
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_report_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.can_transition_state('report', OLD.status::text, NEW.status::text) THEN
    RAISE EXCEPTION 'INVALID_REPORT_STATE_TRANSITION:%->%', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_status_transition ON public.reports;
CREATE TRIGGER trg_report_status_transition
BEFORE UPDATE OF status ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_report_status_transition();

-- --------------------------------------------------------------------------
-- Pro membership lifecycle enforcement
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pro_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.can_transition_state('pro_membership', OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'INVALID_PRO_STATE_TRANSITION:%->%', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pro_status_transition ON public.pro_registrations;
CREATE TRIGGER trg_pro_status_transition
BEFORE UPDATE OF status ON public.pro_registrations
FOR EACH ROW EXECUTE FUNCTION public.enforce_pro_status_transition();

-- --------------------------------------------------------------------------
-- Generic privileged transition helpers
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_user_admin_status(
  p_user_id text,
  p_to text,
  p_reason text DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.users;
BEGIN
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
  IF p_to NOT IN ('pending','approved','rejected','suspended','banned') THEN RAISE EXCEPTION 'INVALID_USER_STATUS'; END IF;
  UPDATE public.users SET admin_status=p_to WHERE id=p_user_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  INSERT INTO public.admin_warnings(user_id,admin_user_id,action,reason)
  VALUES(p_user_id,auth.uid()::text,'status_transition',left(coalesce(p_reason,''),500));
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_user_admin_status(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_user_admin_status(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.transition_property_admin_status(
  p_property_id text,
  p_to text,
  p_reason text DEFAULT NULL
)
RETURNS public.properties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.properties;
BEGIN
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;
  IF p_to NOT IN ('pending_review','approved','rejected','flagged','sold','rented','expired') THEN RAISE EXCEPTION 'INVALID_PROPERTY_STATUS'; END IF;
  UPDATE public.properties SET admin_status=p_to WHERE id=p_property_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_property_admin_status(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_property_admin_status(text,text,text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
