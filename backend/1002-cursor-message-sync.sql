-- ImbaLink Phase 6.2 — cursor-based message sync.
-- Run after 1001-phase6-message-read-rpc.sql. Safe to run repeatedly.
--
-- Problem this fixes: useConversationMessages' reconnect/visibility-regain
-- path (and, before it, the initial thread load) both call
-- get_conversation_messages() with no way to say "only what's new" — every
-- reconcile re-downloads the most recent MESSAGE_DISPLAY_LIMIT (100)
-- messages and re-merges them client-side via applyMessageEvent's dedup.
-- That's wasteful on every reconnect, and it's a real correctness gap for
-- a long-backgrounded session: if MORE than 100 messages arrived while the
-- app was closed/offline, only the newest 100 come back — anything older
-- than that (but still newer than what the client already had) is
-- silently never fetched, because "most recent N" has no memory of where
-- the client actually left off.
--
-- Fix: an optional cursor — (p_after_sent_at, p_after_id), the
-- (sent_at, id) of the last message the client already has — switches the
-- function into forward-sync mode: "everything strictly after this point,
-- oldest-first, up to p_limit". idx_messages_conversation_sent_id
-- (conversation_id, sent_at, id), already created in
-- 007-real-save-count-and-owner-messaging.sql, is exactly the composite
-- index this seek needs — no new index required.
--
-- The two-part (sent_at, id) cursor (not sent_at alone) matters: sent_at
-- has millisecond precision, so two messages sent in the same millisecond
-- are a real possibility, not an edge case to hand-wave — an id-less
-- cursor could skip or re-deliver one of them. Row comparison
-- `(sent_at, id) > (p_after_sent_at, p_after_id)` handles the tie
-- correctly in one index-only comparison.
--
-- Backward compatible: p_after_sent_at/p_after_id default to NULL, which
-- preserves the exact existing "most recent N, caller reverses" behavior
-- every current call site relies on. No existing call site needs to
-- change until it's ready to opt into cursor mode.

BEGIN;

DROP FUNCTION IF EXISTS public.get_conversation_messages(text, integer);

CREATE OR REPLACE FUNCTION public.get_conversation_messages(
  p_conversation_id text,
  p_limit integer DEFAULT 100,
  p_after_sent_at timestamptz DEFAULT NULL,
  p_after_id text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  conversation_id text,
  sender_user_id text,
  body text,
  sent_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
-- Same RETURNS TABLE(id text, conversation_id text, ...) shape as
-- send_message_atomic() — see the identical note in
-- 1001-phase6-message-read-rpc.sql. Every reference below stays
-- table-qualified (m.id, m.conversation_id, ...) for the same reason.
DECLARE
  v_user_id text := auth.uid()::text;
  v_conversation_id text := NULLIF(btrim(p_conversation_id), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
  -- A cursor is only "present" once BOTH halves are given. A sent_at with
  -- no id (or vice versa) is a caller bug, not a valid cursor — treat it
  -- as absent (full most-recent-N mode) rather than guessing a tiebreaker.
  v_has_cursor boolean := p_after_sent_at IS NOT NULL AND p_after_id IS NOT NULL;
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

  IF v_has_cursor THEN
    -- Forward sync: everything the client hasn't seen yet, oldest-first
    -- so the caller can append directly without re-sorting.
    RETURN QUERY
    SELECT m.id, m.conversation_id, m.sender_user_id, m.body, m.sent_at
    FROM public.messages m
    WHERE m.conversation_id = v_conversation_id
      AND m.deleted_at IS NULL
      AND (m.sent_at, m.id) > (p_after_sent_at, p_after_id)
    ORDER BY m.sent_at ASC, m.id ASC
    LIMIT v_limit;
  ELSE
    -- Unchanged existing behavior: most recent N, newest-first (the JS
    -- caller reverses this for display).
    RETURN QUERY
    SELECT m.id, m.conversation_id, m.sender_user_id, m.body, m.sent_at
    FROM public.messages m
    WHERE m.conversation_id = v_conversation_id
      AND m.deleted_at IS NULL
    ORDER BY m.sent_at DESC, m.id DESC
    LIMIT v_limit;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_messages(text, integer, timestamptz, text) TO authenticated;

COMMIT;
