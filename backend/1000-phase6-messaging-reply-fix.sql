-- ImbaLink Phase 6 — bidirectional messaging fix.
-- Run this AFTER the existing messaging migrations. Safe to run repeatedly.
--
-- Root cause: some deployments had a send_message_atomic() implementation
-- that always derived the recipient from p_property_id. That works when a
-- tenant sends the first message, but on the landlord's reply the listing
-- owner is the authenticated sender, so the RPC resolved the recipient to
-- the sender and rejected the reply as "Cannot message yourself."
--
-- This version treats an existing conversation as authoritative: once a
-- conversation has participants, the only valid recipient is the participant
-- who is not auth.uid(). The client cannot override that recipient.

BEGIN;

-- Defensive: see the matching note in 1001-phase6-message-read-rpc.sql —
-- CREATE OR REPLACE FUNCTION cannot change an existing function's OUT
-- parameter (RETURNS TABLE) shape and raises 42P13 instead of running if it
-- differs, so drop first rather than assume this file's shape already
-- matches whatever is currently live.
DROP FUNCTION IF EXISTS public.send_message_atomic(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.send_message_atomic(
  p_conversation_id text,
  p_recipient_user_id text,
  p_property_id text,
  p_body text,
  p_client_key text DEFAULT NULL
)
RETURNS TABLE (
  id text, conversation_id text, sender_user_id text,
  receiver_user_id text, body text, sent_at timestamptz, client_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
-- This function's RETURNS TABLE(id text, conversation_id text, ...) implicitly
-- declares PL/pgSQL variables of those same names, visible throughout the
-- function body — colliding with the real `id`/`conversation_id` columns on
-- `conversations`/`messages`. This pragma is the same fix already applied for
-- the identical collision elsewhere in the messaging RPCs (see
-- 999-messaging-production-fix.sql) — it was
-- dropped when this function was rewritten for the bidirectional-reply fix,
-- which is what let `UPDATE public.conversations ... WHERE id = ...` below
-- start raising "column reference "id" is ambiguous" (42702) again. The
-- table-qualified `c.id` below is kept too, but this pragma is what protects
-- every OTHER bare reference against the same class of bug being
-- reintroduced by a future edit.
DECLARE
  v_user_id text := auth.uid()::text;
  v_requested_recipient text := NULLIF(btrim(p_recipient_user_id), '');
  v_recipient text;
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_conversation_id text := NULLIF(btrim(p_conversation_id), '');
  v_body text := left(btrim(COALESCE(p_body, '')), 2000);
  v_client_key text := NULLIF(btrim(p_client_key), '');
  v_has_conversation boolean := false;
  v_is_participant boolean := false;
  v_row public.messages%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_conversation_id IS NULL THEN RAISE EXCEPTION 'Conversation not found.'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION 'Cannot send an empty message.'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = v_conversation_id
  ) INTO v_has_conversation;

  IF v_has_conversation THEN
    -- An existing thread is authoritative. The sender must already belong
    -- to it, and the other participant is the only legal recipient. This is
    -- what makes replies symmetric for tenant <-> landlord, contractor,
    -- and roommate conversations.
    SELECT EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = v_conversation_id
        AND cp.user_id = v_user_id
    ) INTO v_is_participant;

    IF NOT v_is_participant THEN
      RAISE EXCEPTION 'You are not a participant in this conversation.';
    END IF;

    SELECT cp.user_id INTO v_recipient
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = v_conversation_id
      AND cp.user_id <> v_user_id
    ORDER BY cp.user_id
    LIMIT 1;

    IF v_recipient IS NULL THEN
      RAISE EXCEPTION 'Conversation recipient not found.';
    END IF;
  ELSE
    -- Brand-new conversation. A property target may derive its recipient
    -- from the registered listing owner. Direct messages may use the
    -- requested recipient supplied by the caller.
    v_recipient := v_requested_recipient;
    IF v_property_id IS NOT NULL THEN
      SELECT p.owner_user_id::text INTO v_recipient
      FROM public.properties p
      WHERE p.id::text = v_property_id
      LIMIT 1;
      IF v_recipient IS NULL THEN RAISE EXCEPTION 'Listing owner not found.'; END IF;
    END IF;

    IF v_recipient IS NULL THEN RAISE EXCEPTION 'Message recipient not found.'; END IF;

    -- Recompute the canonical storage id for a new conversation instead of
    -- trusting a caller-supplied id that could merge unrelated users.
    IF v_property_id IS NOT NULL THEN
      v_conversation_id := v_property_id || '::' || v_user_id;
    ELSE
      v_conversation_id := public.dm_pair_id(v_user_id, v_recipient);
    END IF;
  END IF;

  IF v_recipient = v_user_id THEN
    RAISE EXCEPTION 'Cannot message yourself.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text = v_recipient) THEN
    RAISE EXCEPTION 'Message recipient does not exist.';
  END IF;

  INSERT INTO public.conversations (id, property_id)
  VALUES (v_conversation_id, v_property_id)
  ON CONFLICT (id) DO UPDATE
    SET property_id = COALESCE(EXCLUDED.property_id, public.conversations.property_id),
        updated_at = now();

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id), (v_conversation_id, v_recipient)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.messages (id, conversation_id, sender_user_id, body, sent_at)
  VALUES (
    COALESCE(v_client_key, 'msg_' || gen_random_uuid()::text),
    v_conversation_id, v_user_id, v_body, now()
  )
  ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body
  RETURNING * INTO v_row;

  -- Table-qualified against the implicit OUT parameter `id` this function's
  -- own RETURNS TABLE(id text, ...) declares — that OUT parameter is a
  -- PL/pgSQL variable visible throughout this function body, so a bare
  -- `id` here is genuinely ambiguous between it and conversations.id (SQLSTATE
  -- 42702 "column reference is ambiguous"). That exception, raised after the
  -- conversations/conversation_participants/messages inserts above already
  -- ran in this same function call, rolled back the entire transaction —
  -- which is also why a subsequent get_conversation_messages() call for a
  -- brand-new conversation failed too: the participant row it checks for
  -- had never actually been committed.
  UPDATE public.conversations c SET updated_at = v_row.sent_at WHERE c.id = v_conversation_id;

  RETURN QUERY SELECT
    v_row.id, v_row.conversation_id, v_row.sender_user_id,
    v_recipient, v_row.body, v_row.sent_at, v_client_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message_atomic(text, text, text, text, text) TO authenticated;

COMMIT;
