-- ImbaLink: viewing-request response (accept / decline / cancel).
-- Run after backend/999-messaging-production-fix.sql.
--
-- GAP THIS FIXES (found during a production-readiness audit, not previously
-- flagged anywhere in this repo): request_property_viewing() lets a tenant
-- CREATE a viewing_requests row (status='requested'), but nothing anywhere —
-- no RPC, no RLS policy, no frontend code — ever let the LANDLORD move that
-- row to 'accepted'/'declined', or let the TENANT cancel it. Confirmed by
-- reading viewing_requests_write_self, which is USING/WITH CHECK
-- (user_id = auth.uid()), i.e. only the requester can write their own row at
-- all — the property owner has SELECT only. So "ACCEPT / DECLINE / CONFIRMED
-- VIEWING" (called out as a core ImbaLink feature) had no working path in
-- either direction. This migration adds exactly that, as a SECURITY DEFINER
-- RPC rather than a broader RLS UPDATE grant, so the allowed status
-- transitions stay enforced server-side instead of trusting the client to
-- only ever send legal ones.

BEGIN;

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
  -- state. This prevents a later call (including a manual API/database call)
  -- from silently changing an already accepted request to declined or vice
  -- versa. Tenant cancellation remains governed by the separate branch above.
  IF p_status IN ('accepted', 'declined') THEN
    UPDATE public.viewing_requests
    SET status = p_status, updated_at = now()
    WHERE property_id::text = v_property_id
      AND user_id = v_requester
      AND status = 'requested'
    RETURNING to_jsonb(viewing_requests) INTO v_result;
  ELSE
    UPDATE public.viewing_requests
    SET status = p_status, updated_at = now()
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
    -- Declines and tenant cancellations are intentionally NOT written as
    -- ordinary participant messages. MessagesPage presents these two state
    -- changes as an ImbaLink assistant message instead, so the conversation
    -- does not contain awkward system-like text such as "Viewing request
    -- declined [property]". Accepted/completed responses remain normal
    -- participant messages for compatibility with the existing flow.
    IF p_status NOT IN ('declined', 'cancelled') THEN
      v_message := CASE p_status
        WHEN 'accepted'  THEN 'Viewing request accepted' || COALESCE(' for ' || v_property_title, '') || '.'
        WHEN 'completed' THEN 'Viewing marked as completed' || COALESCE(' for ' || v_property_title, '') || '.'
        ELSE 'Viewing request updated.'
      END;
      IF p_note IS NOT NULL AND btrim(p_note) <> '' THEN
        v_message := v_message || ' ' || left(btrim(p_note), 500);
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

COMMIT;
