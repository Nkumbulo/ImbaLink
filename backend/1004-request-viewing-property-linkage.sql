-- ImbaLink Phase 6.4 — exact property linkage for viewing-request messages.
-- Run after 1002-cursor-message-sync.sql.
--
-- BUG THIS FIXES: the client currently has no reliable way to know which
-- property a "I would like to request a viewing of X." message is about.
-- It falls back to parsing the property NAME out of the message text
-- (messageViewModel.js's parseViewingRequest/resolveProperty) and matching
-- that name against the ENTIRE properties catalog — not scoped to this
-- conversation's landlord at all. Two properties (from the same landlord
-- or two different ones) sharing an identical title — confirmed to happen
-- for real in this app's own catalog, e.g. two separate "Back room, Unit L"
-- listings from different owners — means `.find()` can silently resolve to
-- the WRONG property. Because a conversation now spans every property a
-- tenant has ever asked this landlord about (see request_property_viewing
-- below), a title collision doesn't just mislabel one message — it can
-- make an unrelated property's card appear in the thread for a request
-- that was never actually about it.
--
-- FIX: request_property_viewing() already knows the exact property id at
-- the moment it sends the message — 050-viewing-request-workflow.sql
-- already added the columns to carry it (messages.related_property_id /
-- viewing_request_id / message_kind) and used them, but 999/1000/1001
-- (all numbered later, all touching the same two functions) silently
-- dropped that usage when they redefined request_property_viewing() and
-- get_conversation_messages() without it. This migration is the union:
-- 999's current tenant-scoped-conversation-id / per-property-idempotency
-- behavior, PLUS 050's exact property linkage, PLUS 1002's cursor-sync
-- mode. Nothing regresses; the two prior fixes just stop fighting.
--
-- The client (messageViewModel.js) should now prefer this exact id over
-- the text-parsed title whenever it's present, and only fall back to the
-- old regex/title match for messages sent before this migration existed.

BEGIN;

-- Self-sufficient regardless of whether 049/050 were ever actually run on
-- this project: those two are the migrations that originally added these
-- columns, but this project's migration history has already shown (see
-- the get_conversation_messages saga above) that later files redefining
-- the same functions can ship without everyone having run every
-- intermediate file first. If these columns are missing, every call to
-- request_property_viewing()/get_conversation_messages() below fails at
-- RUNTIME (not at CREATE FUNCTION time — plpgsql doesn't validate embedded
-- SQL until a function actually executes), which the client's error
-- handling can mistake for an offline/retry condition — the message
-- silently never gets sent, and the thread just opens empty. Making the
-- columns' existence a guarantee of THIS migration, not an assumption
-- about migration history, removes that failure mode entirely.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_assistant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewing_request_id text,
  ADD COLUMN IF NOT EXISTS related_property_id text,
  ADD COLUMN IF NOT EXISTS message_kind text;

CREATE OR REPLACE FUNCTION public.request_property_viewing(
  p_property_id text,
  p_message text DEFAULT NULL
)
RETURNS TABLE (conversation_id text, message_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_user_id text := auth.uid()::text;
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_owner_id text;
  v_property_title text;
  v_conversation_id text;
  v_message_id text;
  v_request_id text;
  v_message text;
  v_already_requested boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_property_id IS NULL THEN RAISE EXCEPTION 'Property not found.'; END IF;

  SELECT owner_user_id::text, title INTO v_owner_id, v_property_title
  FROM public.properties WHERE id::text = v_property_id LIMIT 1;

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'This listing has no registered landlord account.'; END IF;
  IF v_owner_id = v_user_id THEN RAISE EXCEPTION 'You cannot request a viewing from your own listing.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id::text = v_owner_id) THEN
    RAISE EXCEPTION 'The listing owner account no longer exists.';
  END IF;

  v_conversation_id := public.find_conversation_with(v_owner_id);
  IF v_conversation_id IS NULL THEN
    v_conversation_id := v_property_id || '::' || v_user_id;
  END IF;

  v_already_requested := EXISTS (
    SELECT 1 FROM public.viewing_requests vr
    WHERE vr.user_id = v_user_id AND vr.property_id::text = v_property_id
  );

  v_message := left(btrim(COALESCE(
    NULLIF(p_message, ''),
    'I would like to request a viewing' || COALESCE(' of ' || v_property_title, '') || '.'
  )), 2000);

  IF v_already_requested THEN
    SELECT m.id INTO v_message_id
    FROM public.messages m
    WHERE m.conversation_id = v_conversation_id
      AND m.sender_user_id = v_user_id
      AND m.body = v_message
    ORDER BY m.sent_at DESC LIMIT 1;
    IF v_message_id IS NOT NULL THEN
      RETURN QUERY SELECT v_conversation_id, v_message_id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.viewing_requests (id, user_id, property_id, status)
  VALUES ('viewing_' || gen_random_uuid()::text, v_user_id, v_property_id, 'requested')
  ON CONFLICT (user_id, property_id) DO NOTHING
  RETURNING id INTO v_request_id;

  -- ON CONFLICT DO NOTHING means v_request_id stays NULL on a repeat
  -- request for the same property (row already existed) — look it up
  -- directly rather than leaving the message untagged.
  IF v_request_id IS NULL THEN
    SELECT id INTO v_request_id FROM public.viewing_requests
    WHERE user_id = v_user_id AND property_id::text = v_property_id;
  END IF;

  INSERT INTO public.conversations (id, property_id)
  VALUES (v_conversation_id, v_property_id)
  ON CONFLICT (id) DO UPDATE
    SET property_id = COALESCE(public.conversations.property_id, EXCLUDED.property_id),
        updated_at = now();

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id), (v_conversation_id, v_owner_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  v_message_id := 'msg_' || gen_random_uuid()::text;
  -- The exact-id linkage this whole migration is for: related_property_id
  -- is a real foreign key, not text the client has to parse and guess
  -- against. viewing_request_id ties it to the specific request row too,
  -- for the same reason.
  INSERT INTO public.messages (
    id, conversation_id, sender_user_id, body, sent_at,
    viewing_request_id, related_property_id, message_kind
  ) VALUES (
    v_message_id, v_conversation_id, v_user_id, v_message, now(),
    v_request_id, v_property_id, 'viewing_request'
  );

  UPDATE public.conversations SET updated_at = now() WHERE id = v_conversation_id;
  RETURN QUERY SELECT v_conversation_id, v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_property_viewing(text, text) TO authenticated;

-- get_conversation_messages must also return the new columns so the
-- client can read them. Same defensive drop-first pattern as every prior
-- redefinition of this function (Postgres won't let CREATE OR REPLACE
-- change RETURNS TABLE shape).
DROP FUNCTION IF EXISTS public.get_conversation_messages(text, integer, timestamptz, text);

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
  sent_at timestamptz,
  is_assistant boolean,
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
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
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
    RETURN QUERY
    SELECT m.id, m.conversation_id, m.sender_user_id, m.body, m.sent_at,
           m.is_assistant, m.related_property_id, m.message_kind
    FROM public.messages m
    WHERE m.conversation_id = v_conversation_id
      AND m.deleted_at IS NULL
      AND (m.sent_at, m.id) > (p_after_sent_at, p_after_id)
    ORDER BY m.sent_at ASC, m.id ASC
    LIMIT v_limit;
  ELSE
    RETURN QUERY
    SELECT m.id, m.conversation_id, m.sender_user_id, m.body, m.sent_at,
           m.is_assistant, m.related_property_id, m.message_kind
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
