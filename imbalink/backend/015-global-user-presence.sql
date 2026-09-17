-- ImbaLink global presence / last-seen state.
-- Presence is app-wide, not MessagesPage-scoped. The realtime channel gives
-- instant Online transitions; this table persists the last heartbeat so an
-- offline user can be shown as "Online N hours ago" after a fresh app load.

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_presence_select_authenticated ON public.user_presence;
CREATE POLICY user_presence_select_authenticated
  ON public.user_presence FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen
  ON public.user_presence (last_seen_at DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.heartbeat_presence()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_user_id text := auth.uid()::text;
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_SIGNED_IN';
  END IF;

  INSERT INTO public.user_presence(user_id, last_seen_at)
  VALUES (v_user_id, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at;

  RETURN v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.heartbeat_presence() TO authenticated;
