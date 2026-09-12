-- ImbaLink: notifications.
-- Run after backend/016-viewing-request-response.sql and
-- backend/013-security-hardening.sql (needs verification_status enum,
-- is_staff_caller not required here).
--
-- GAP THIS FIXES: P11 "Notification preferences" was a dead settings row —
-- no table, no RPC, no UI anywhere. Covers: viewing request received
-- (landlord), viewing accepted/declined/completed (tenant), verification
-- update / listing approved-rejected (whoever owns the verified subject).
--
-- Deliberately NOT covered here: "new message" — the existing
-- conversation_participants.last_read_at unread-count system already
-- correctly serves that need (see get_conversation_previews in
-- 999-messaging-production-fix.sql); adding a second, redundant
-- notification row per message would double-track the same signal for no
-- benefit. Also not covered: "new relevant property" (a saved-search
-- alert feature) — that needs search-criteria persistence and matching
-- logic that doesn't exist anywhere yet, a separate, larger feature.
--
-- IMPLEMENTATION CHOICE: triggers on the tables that already change
-- (viewing_requests, properties), not edits to the existing RPCs
-- (request_property_viewing, respond_to_viewing_request,
-- set_verification_status). Those RPCs are already built, tested, and
-- shipped — the smallest-blast-radius way to add notifications is to
-- react to the data changes they make, not to re-open and risk
-- regressing functions that already work.

BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  subject_type text,
  subject_id  text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_read_own ON public.notifications;
CREATE POLICY notifications_read_own ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid()::text);

-- Only read_at is ever meant to change from the client (marking read) —
-- WITH CHECK repeats the same ownership condition so a row can't be
-- reassigned to someone else's user_id in the same UPDATE.
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- No INSERT policy: notifications are only ever created by the trigger
-- functions below (SECURITY DEFINER, owned by the migration role), never
-- directly by a client — same reasoning as conversations_insert being
-- RPC/trigger-only rather than a broad client-writable policy.

GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- Internal helper, not exposed to PostgREST/clients directly (no GRANT to
-- authenticated) — only called from the trigger functions below, which
-- run as their table owner regardless of who fired the triggering
-- statement.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id text,
  p_type text,
  p_title text,
  p_body text,
  p_subject_type text,
  p_subject_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (id, user_id, type, title, body, subject_type, subject_id)
  VALUES ('notif_' || gen_random_uuid()::text, p_user_id, p_type, p_title, p_body, p_subject_type, p_subject_id);
END;
$$;

-- Notify the landlord when a viewing request comes in.
CREATE OR REPLACE FUNCTION public.notify_new_viewing_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id text;
  v_title text;
BEGIN
  SELECT owner_user_id::text, title INTO v_owner_id, v_title
  FROM public.properties WHERE id::text = NEW.property_id::text;
  IF v_owner_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_owner_id, 'viewing_request',
      'New viewing request',
      COALESCE(v_title, 'A listing') || ' has a new viewing request.',
      'property', NEW.property_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_viewing_request ON public.viewing_requests;
CREATE TRIGGER trg_notify_new_viewing_request
AFTER INSERT ON public.viewing_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_new_viewing_request();

-- Notify the tenant when their viewing request's status actually changes
-- (guards on status changing, not every UPDATE, so an unrelated column
-- touch never fires a spurious notification).
CREATE OR REPLACE FUNCTION public.notify_viewing_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_notif_title text;
  v_notif_body text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  -- The requester caused their own 'cancelled' transition — no need to
  -- notify them of their own action.
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;

  SELECT title INTO v_title FROM public.properties WHERE id::text = NEW.property_id::text;

  CASE NEW.status
    WHEN 'accepted'  THEN v_notif_title := 'Viewing request accepted';
    WHEN 'declined'  THEN v_notif_title := 'Viewing request declined';
    WHEN 'completed' THEN v_notif_title := 'Viewing marked completed';
    ELSE RETURN NEW;
  END CASE;
  v_notif_body := COALESCE(v_title, 'A listing') || '.';

  PERFORM public.create_notification(
    NEW.user_id, 'viewing_status', v_notif_title, v_notif_body,
    'property', NEW.property_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_viewing_status_change ON public.viewing_requests;
CREATE TRIGGER trg_notify_viewing_status_change
AFTER UPDATE ON public.viewing_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_viewing_request_status_change();

-- Notify a listing's owner when its verification status changes (covers
-- both "Listing approved/rejected" and the general "Verification update").
CREATE OR REPLACE FUNCTION public.notify_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_title text;
BEGIN
  IF NEW.verification IS NOT DISTINCT FROM OLD.verification THEN RETURN NEW; END IF;
  IF NEW.owner_user_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.verification
    WHEN 'verified' THEN v_notif_title := 'Listing approved';
    WHEN 'rejected' THEN v_notif_title := 'Listing needs attention';
    WHEN 'flagged'  THEN v_notif_title := 'Listing flagged for review';
    ELSE RETURN NEW;
  END CASE;

  PERFORM public.create_notification(
    NEW.owner_user_id::text, 'verification_update', v_notif_title,
    COALESCE(NEW.title, 'Your listing') || '.',
    'property', NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_verification_change ON public.properties;
CREATE TRIGGER trg_notify_verification_change
AFTER UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.notify_verification_change();

-- Read-side RPCs.

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.notifications
  WHERE user_id = auth.uid()::text AND read_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

-- Marks one notification read for the CALLER only (mirrors
-- mark_conversation_read's own-row-only scoping). Idempotent: marking an
-- already-read notification read again is a safe no-op.
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id AND user_id = auth.uid()::text;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid()::text AND read_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
