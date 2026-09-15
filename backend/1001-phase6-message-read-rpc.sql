-- ImbaLink Phase 6.1 — recipient-safe message history read.
-- Run after the messaging migrations. Safe to run repeatedly.
--
-- This deliberately moves the critical message-history read behind a
-- SECURITY DEFINER function. The function performs its own participant
-- check without depending on client-side RLS policy recursion/profile
-- lookups. This prevents a valid recipient from being trapped forever in
-- the Messages UI at "Syncing messages" because a direct PostgREST/RLS
-- query is blocked or stalls.

BEGIN;

-- Defensive: CREATE OR REPLACE FUNCTION cannot change a function's OUT
-- parameter (RETURNS TABLE) shape — Postgres requires an exact match or it
-- raises 42P13 "cannot change return type of existing function" and refuses
-- to run at all. Whatever get_conversation_messages(text, integer) currently
-- exists on this project (from an earlier manual version, a different
-- session, etc.) may not match this file's column list byte-for-byte, so
-- drop it first rather than assume CREATE OR REPLACE can just overwrite it.
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
  sent_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
-- Same RETURNS TABLE(id text, conversation_id text, ...) shape as
-- send_message_atomic() in 1000-phase6-messaging-reply-fix.sql, which
-- implicitly declares PL/pgSQL variables of those names that collide with
-- messages.id/conversation_id. Every reference below is already
-- table-qualified (m.id, m.conversation_id, ...) so this isn't fixing a
-- live bug here — it's the same defensive pragma used everywhere else this
-- collision shape occurs in the messaging RPCs, so a future edit that adds
-- one bare `id`/`conversation_id`/`body`/`sent_at` reference can't
-- silently reintroduce SQLSTATE 42702 the way it did in send_message_atomic.
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
  SELECT m.id, m.conversation_id, m.sender_user_id, m.body, m.sent_at
  FROM public.messages m
  WHERE m.conversation_id = v_conversation_id
    AND m.deleted_at IS NULL
  ORDER BY m.sent_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_messages(text, integer) TO authenticated;

COMMIT;
