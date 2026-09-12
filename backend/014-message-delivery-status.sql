-- ImbaLink messaging: WhatsApp-style conversation delivery/read cursors.
-- Additive migration: no per-message status column and no per-message writes.
-- Run after 999-messaging-production-fix.sql.

ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS last_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- The existing 999 migration already enables realtime for this table, but keep
-- this migration independently safe when applied to a project in which the
-- publication was not yet updated.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Defensive PL/pgSQL setting used by the messaging RPCs. These functions do
-- not RETURN TABLE, but keeping the guard consistent prevents a future edit
-- from reintroducing the identifier-ambiguity class fixed elsewhere.
CREATE OR REPLACE FUNCTION public.mark_conversation_delivered(
  p_conversation_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  -- Keep this function deliberately scoped to auth.uid(). A client can only
  -- advance its own participant cursor, never the other participant's.
  UPDATE public.conversation_participants
  SET last_delivered_at = GREATEST(
    COALESCE(last_delivered_at, '-infinity'::timestamptz),
    now()
  )
  WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid()::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_delivered(text) TO authenticated;

-- Preserve the existing mark_conversation_read(text, timestamptz) contract so
-- the current frontend and older clients remain compatible. Reading a thread
-- also implies delivery, so both cursors advance monotonically together.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id text,
  p_read_through timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_user_id text := auth.uid()::text;
  v_read_through timestamptz := COALESCE(p_read_through, now());
  v_new_value timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_SIGNED_IN';
  END IF;

  UPDATE public.conversation_participants
  SET last_read_at = GREATEST(
        COALESCE(last_read_at, '-infinity'::timestamptz),
        v_read_through
      ),
      last_delivered_at = GREATEST(
        COALESCE(last_delivered_at, '-infinity'::timestamptz),
        v_read_through
      )
  WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  RETURNING last_read_at INTO v_new_value;

  RETURN v_new_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(text, timestamptz) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_user
  ON public.conversation_participants (conversation_id, user_id);
