-- ImbaLink: real, persisted ImbaLink Assistant messages for viewing-request
-- decline/cancellation, synced live to BOTH tenant and landlord.
-- Run after backend/999-messaging-production-fix.sql (find_conversation_with,
-- get_conversation_messages) and backend/047-viewing-request-assistant-messages.sql.
--
-- GAP THIS FIXES: respond_to_viewing_request() (016/047) deliberately never
-- inserted a message row for 'declined'/'cancelled' — the green "ImbaLink"
-- explanation the tenant saw was reconstructed purely client-side from
-- viewing_requests.status (MessageThreadView.jsx), gated to only render
-- when `!isPropertyOwner`. That meant:
--   1. The LANDLORD was never shown anything at all when a tenant
--      cancelled — no chat notice, and (separately, see the trigger fix
--      below) no bell notification either.
--   2. The notice wasn't a real, persisted, conversation-linked message —
--      just a reconstruction from live status — so it didn't behave like
--      an ordinary message for history/refresh/re-login purposes.
--   3. Any decline/cancellation reason (p_note) was silently discarded for
--      these two statuses specifically (accepted/completed already stored
--      theirs in the message body).
--
-- FIX: make the notice a REAL message row in the SAME existing
-- conversation (never a new chat — reuses find_conversation_with exactly
-- like accepted/completed already do), flagged `is_assistant` so every
-- client renders it identically as an ImbaLink system bubble regardless of
-- which side is viewing or who technically triggered it. The reason, when
-- given, is appended to that same message body.

BEGIN;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_assistant boolean NOT NULL DEFAULT false;

-- Durable record of the reason independent of the message thread (e.g. for
-- a future landlord-dashboard "declined: <reason>" display) — cheap to add,
-- not required by the chat UI itself, which reads the reason out of the
-- message body below.
ALTER TABLE public.viewing_requests
  ADD COLUMN IF NOT EXISTS note text;

CREATE OR REPLACE FUNCTION public.respond_to_viewing_request(
  p_property_id text,
  p_requester_user_id text,
  p_status request_status,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_caller text := auth.uid()::text;
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_requester text := NULLIF(btrim(p_requester_user_id), '');
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_owner_id text;
  v_property_title text;
  v_conversation_id text;
  v_message text;
  v_message_id text;
  v_result jsonb;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_property_id IS NULL OR v_requester IS NULL THEN
    RAISE EXCEPTION 'Viewing request not found.';
  END IF;

  SELECT owner_user_id::text, title INTO v_owner_id, v_property_title
  FROM public.properties WHERE id::text = v_property_id LIMIT 1;
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'This listing no longer exists.'; END IF;

  -- Two distinct, narrow permissions, not one broad "any party can set any
  -- status" grant: the landlord decides accepted/declined/completed, the
  -- tenant can only withdraw their own request.
  IF v_caller = v_owner_id THEN
    IF p_status NOT IN ('accepted', 'declined', 'completed') THEN
      RAISE EXCEPTION 'Landlords can only accept, decline, or complete a viewing request.';
    END IF;
  ELSIF v_caller = v_requester THEN
    IF p_status <> 'cancelled' THEN
      RAISE EXCEPTION 'You can only cancel your own viewing request.';
    END IF;
  ELSE
    RAISE EXCEPTION 'STAFF_ROLE_REQUIRED';
  END IF;

  -- A landlord decision is a one-way transition from the pending/requested
  -- state. Tenant cancellation remains governed by the separate branch
  -- above (can fire from 'requested' or 'accepted' — matches the
  -- 'viewing' state machine in 032-state-machine-contracts.sql).
  IF p_status IN ('accepted', 'declined') THEN
    UPDATE public.viewing_requests
    SET status = p_status, note = v_note, updated_at = now()
    WHERE property_id::text = v_property_id
      AND user_id = v_requester
      AND status = 'requested'
    RETURNING to_jsonb(viewing_requests) INTO v_result;
  ELSE
    UPDATE public.viewing_requests
    SET status = p_status, note = v_note, updated_at = now()
    WHERE property_id::text = v_property_id
      AND user_id = v_requester
    RETURNING to_jsonb(viewing_requests) INTO v_result;
  END IF;

  IF v_result IS NULL THEN RAISE EXCEPTION 'Viewing request not found.'; END IF;

  -- Reuse whatever conversation this pair already has (created by
  -- request_property_viewing / ensure_property_conversation) so the
  -- decision shows up in the existing thread instead of opening a new one.
  v_conversation_id := public.find_conversation_with(CASE WHEN v_caller = v_owner_id THEN v_requester ELSE v_owner_id END);
  IF v_conversation_id IS NOT NULL THEN
    IF p_status IN ('declined', 'cancelled') THEN
      -- Persisted ImbaLink Assistant message — inserted once, read by
      -- BOTH participants via the ordinary messages_read_participant
      -- policy, so it's identical and synced for both sides (including
      -- after a refresh/re-login) instead of being reconstructed
      -- differently per viewer. sender_user_id stays the acting user (for
      -- unread-count/audit purposes — it naturally counts as "read" for
      -- whoever just acted and "unread/incoming" for the other party) but
      -- `is_assistant = true` tells every client to render it as a system
      -- notice rather than an ordinary bubble attributed to that person.
      v_message := CASE p_status
        WHEN 'declined' THEN
          'The landlord wasn''t able to accommodate this viewing request' ||
          COALESCE(' for ' || v_property_title, '') ||
          ' at this time. No worries — you can continue exploring other available properties on ImbaLink.'
        WHEN 'cancelled' THEN
          'This viewing request' || COALESCE(' for ' || v_property_title, '') ||
          ' has been cancelled by the tenant. No further action is needed, and you can continue using ImbaLink to find or arrange another viewing.'
      END;
      IF v_note IS NOT NULL THEN
        v_message := v_message || ' Reason: ' || left(v_note, 500);
      END IF;

      v_message_id := 'msg_' || gen_random_uuid()::text;
      INSERT INTO public.messages (id, conversation_id, sender_user_id, body, sent_at, is_assistant)
      VALUES (v_message_id, v_conversation_id, v_caller, v_message, now(), true);
    ELSE
      -- Accepted/completed remain normal participant messages, unchanged.
      v_message := CASE p_status
        WHEN 'accepted'  THEN 'Viewing request accepted' || COALESCE(' for ' || v_property_title, '') || '.'
        WHEN 'completed' THEN 'Viewing marked as completed' || COALESCE(' for ' || v_property_title, '') || '.'
        ELSE 'Viewing request updated.'
      END;
      IF v_note IS NOT NULL THEN
        v_message := v_message || ' ' || left(v_note, 500);
      END IF;

      v_message_id := 'msg_' || gen_random_uuid()::text;
      INSERT INTO public.messages (id, conversation_id, sender_user_id, body, sent_at)
      VALUES (v_message_id, v_conversation_id, v_caller, v_message, now());
    END IF;
    UPDATE public.conversations SET updated_at = now() WHERE id = v_conversation_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_viewing_request(text, text, request_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_viewing_request(text, text, request_status, text) TO authenticated;

-- get_conversation_messages() must also return is_assistant so the client
-- can distinguish it from an ordinary participant message. CREATE OR
-- REPLACE cannot change an existing function's RETURNS TABLE shape
-- (42P13), so drop first — same defensive pattern already used in
-- 1001-phase6-message-read-rpc.sql.
DROP FUNCTION IF EXISTS public.get_conversation_messages(text, integer);

CREATE OR REPLACE FUNCTION public.get_conversation_messages(
  p_conversation_id text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id text,
  conversation_id text,
  sender_user_id text,
  body text,
  sent_at timestamptz,
  is_assistant boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_user_id text := auth.uid()::text;
  v_conversation_id text := NULLIF(btrim(p_conversation_id), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_conversation_id IS NULL THEN RAISE EXCEPTION 'Conversation not found.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = v_conversation_id
      AND cp.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation.';
  END IF;

  RETURN QUERY
  SELECT m.id, m.conversation_id, m.sender_user_id, m.body, m.sent_at, m.is_assistant
  FROM public.messages m
  WHERE m.conversation_id = v_conversation_id
    AND m.deleted_at IS NULL
  ORDER BY m.sent_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_messages(text, integer) TO authenticated;

-- The in-app notifications bell (019-notifications.sql) had the identical
-- gap: notify_viewing_request_status_change()'s CASE only matched
-- accepted/declined/completed, so a 'cancelled' transition fell through to
-- "ELSE RETURN NEW" and nobody — landlord included — ever got a
-- notification row for it. Add the missing branch: notify the property
-- owner (never the requester, who caused their own cancellation).
CREATE OR REPLACE FUNCTION public.notify_viewing_request_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_owner_id text;
  v_notif_title text;
  v_notif_body text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT title, owner_user_id::text INTO v_title, v_owner_id
  FROM public.properties WHERE id::text = NEW.property_id::text;

  IF NEW.status = 'cancelled' THEN
    IF v_owner_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_owner_id, 'viewing_status', 'Viewing request cancelled',
        COALESCE(v_title, 'A listing') || ' — the tenant cancelled their viewing request.',
        'property', NEW.property_id::text
      );
    END IF;
    RETURN NEW;
  END IF;

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

COMMIT;
