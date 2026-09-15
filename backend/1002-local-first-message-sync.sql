-- ImbaLink local-first messaging sync cursor.
-- Adds a participant-safe incremental history RPC without changing the
-- existing messages/conversations schema or replacing get_conversation_messages().
BEGIN;

DROP FUNCTION IF EXISTS public.get_conversation_messages_since(text, timestamptz, text, integer);

CREATE OR REPLACE FUNCTION public.get_conversation_messages_since(
  p_conversation_id text,
  p_since_at timestamptz DEFAULT NULL,
  p_since_message_id text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  id text,
  conversation_id text,
  sender_user_id text,
  body text,
  sent_at timestamptz,
  is_assistant boolean,
  viewing_request_id text,
  related_property_id text,
  message_kind text
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
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 500);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_conversation_id IS NULL THEN RAISE EXCEPTION 'Conversation not found.'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = v_conversation_id
      AND cp.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation.';
  END IF;

  RETURN QUERY
  SELECT
    m.id, m.conversation_id, m.sender_user_id, m.body, m.sent_at,
    m.is_assistant, m.viewing_request_id, m.related_property_id, m.message_kind
  FROM public.messages m
  WHERE m.conversation_id = v_conversation_id
    AND m.deleted_at IS NULL
    AND (
      p_since_at IS NULL
      OR m.sent_at > p_since_at
      OR (
        m.sent_at = p_since_at
        AND p_since_message_id IS NOT NULL
        AND m.id > p_since_message_id
      )
    )
  ORDER BY m.sent_at ASC, m.id ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_conversation_messages_since(text, timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages_since(text, timestamptz, text, integer) TO authenticated;

COMMIT;
