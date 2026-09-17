-- ImbaLink: authoritative save counts + production Supabase messaging
-- Run AFTER 002-app-alignment.sql and 006-landlord-listing-management.sql.
-- This file also hardens messaging RLS/publication for deployments where the
-- older current_user_id() helper is missing.

-- 1) Authoritative save count for one listing. This counts ALL users' saves
-- without exposing the individual property_saves rows through RLS.
CREATE OR REPLACE FUNCTION public.get_property_save_count(p_property_id text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.property_saves
  WHERE property_id::text = p_property_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_property_save_count(text) TO authenticated;

-- Keep the batch version too for feeds/search pages.
CREATE OR REPLACE FUNCTION public.get_property_save_counts(property_ids text[])
RETURNS TABLE(property_id text, save_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.property_id::text, COUNT(*)::bigint
  FROM public.property_saves ps
  WHERE ps.property_id::text = ANY(property_ids)
  GROUP BY ps.property_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_property_save_counts(text[]) TO authenticated;

-- 2) Create a property conversation containing BOTH the requester and the
-- actual listing owner. The browser cannot insert another user's participant
-- row because of RLS, so this narrowly-scoped SECURITY DEFINER function does it.
CREATE OR REPLACE FUNCTION public.ensure_property_conversation(p_property_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_owner_id text;
  v_conversation_id text := p_property_id;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT owner_user_id::text
    INTO v_owner_id
  FROM public.properties
  WHERE id::text = p_property_id
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Listing owner not found for property %', p_property_id;
  END IF;

  IF v_owner_id = v_user_id THEN
    RAISE EXCEPTION 'A listing owner cannot request a viewing from their own listing';
  END IF;

  INSERT INTO public.conversations (id, property_id)
  VALUES (v_conversation_id, p_property_id)
  ON CONFLICT (id) DO UPDATE
    SET property_id = EXCLUDED.property_id,
        updated_at = now();

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_owner_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_property_conversation(text) TO authenticated;

-- 3) Make sure message/conversation changes can be delivered in realtime.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 4) Direct conversations (contractors / roommates). The client cannot add
-- another user's participant row under RLS, so use the same narrowly scoped
-- SECURITY DEFINER approach as property conversations.
CREATE OR REPLACE FUNCTION public.ensure_direct_conversation(
  p_conversation_id text,
  p_other_user_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_other_user_id IS NULL OR btrim(p_other_user_id) = '' THEN
    RAISE EXCEPTION 'Message recipient not found';
  END IF;

  IF p_other_user_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot create a conversation with yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id::text = p_other_user_id) THEN
    RAISE EXCEPTION 'Message recipient does not exist';
  END IF;

  INSERT INTO public.conversations (id, property_id)
  VALUES (p_conversation_id, NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (p_conversation_id, v_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (p_conversation_id, p_other_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = p_conversation_id;

  RETURN p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_direct_conversation(text, text) TO authenticated;

-- Keep Realtime publication idempotent.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ImbaLink messaging production hardening.
-- Run AFTER 002-app-alignment.sql and 007-real-save-count-and-owner-messaging.sql.
-- This migration deliberately uses auth.uid() directly so messaging does not
-- depend on a helper function that may be missing from an older deployment.

-- Participants: users can see only their own membership rows. The SECURITY
-- DEFINER conversation functions in 007 create the second participant.
DROP POLICY IF EXISTS conversations_read_participant ON public.conversations;
DROP POLICY IF EXISTS participants_read_own ON public.conversation_participants;
DROP POLICY IF EXISTS participants_write_own ON public.conversation_participants;
DROP POLICY IF EXISTS participants_insert_conversation_party ON public.conversation_participants;
DROP POLICY IF EXISTS participants_update_own ON public.conversation_participants;
DROP POLICY IF EXISTS participants_delete_own ON public.conversation_participants;
DROP POLICY IF EXISTS messages_read_participant ON public.messages;
DROP POLICY IF EXISTS messages_insert_participant ON public.messages;

CREATE POLICY conversations_read_participant
ON public.conversations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = id
      AND cp.user_id = auth.uid()::text
  )
);

CREATE POLICY participants_read_own
ON public.conversation_participants
FOR SELECT TO authenticated
USING (user_id = auth.uid()::text);

-- A requester may add the actual owner of a property to that property's
-- conversation. The target participant must be the owner recorded on the
-- property. A signed-in user may always add themselves.
CREATE POLICY participants_insert_conversation_party
ON public.conversation_participants
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.properties p ON p.id::text = c.property_id::text
    WHERE c.id = conversation_id
      AND p.owner_user_id = user_id
  )
);

CREATE POLICY participants_update_own
ON public.conversation_participants
FOR UPDATE TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY participants_delete_own
ON public.conversation_participants
FOR DELETE TO authenticated
USING (user_id = auth.uid()::text);

-- NOTE: conversation_id is qualified as messages.conversation_id below.
-- Left bare, it resolves to cp.conversation_id (the innermost matching
-- table) instead of the outer messages row, turning this into an
-- always-true tautology. See backend/999-messaging-production-fix.sql,
-- which is the authoritative version of this policy and re-applies it
-- with this fix regardless of whether this file has already run.
CREATE POLICY messages_read_participant
ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()::text
  )
);

CREATE POLICY messages_insert_participant
ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()::text
  )
);

-- The UI reads these columns through PostgREST as the authenticated user.
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT ON public.conversations, public.conversation_participants TO authenticated;


-- Viewing requests are part of the same tenant/landlord flow. Older
-- deployments used current_user_id() in these policies; if that helper was
-- not deployed, the Request Viewing button fails even though messaging itself
-- is correctly configured. Use auth.uid() directly so the request can be
-- persisted reliably on every deployment.
DROP POLICY IF EXISTS viewing_requests_read_party ON public.viewing_requests;
DROP POLICY IF EXISTS viewing_requests_write_self ON public.viewing_requests;

CREATE POLICY viewing_requests_read_party
ON public.viewing_requests
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id::text = property_id::text
      AND p.owner_user_id = auth.uid()::text
  )
);

CREATE POLICY viewing_requests_write_self
ON public.viewing_requests
FOR ALL TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

GRANT SELECT, INSERT, UPDATE ON public.viewing_requests TO authenticated;

-- Realtime delivery for both sender and recipient browsers.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Useful indexes for fast inbox/history queries.
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_conversation
  ON public.conversation_participants (user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent_id
  ON public.messages (conversation_id, sent_at, id);

-- 5) Atomic production send path.
-- The browser should not have to perform: resolve recipient -> create
-- conversation -> add participant -> insert message as four separate calls.
-- Doing that client-side creates race/RLS failures. This function performs the
-- whole operation in one transaction under SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.send_message_atomic(
  p_conversation_id text,
  p_recipient_user_id text,
  p_property_id text,
  p_body text,
  p_client_key text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  conversation_id text,
  sender_user_id text,
  receiver_user_id text,
  body text,
  sent_at timestamptz,
  client_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_recipient text := NULLIF(btrim(p_recipient_user_id), '');
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_conversation_id text := NULLIF(btrim(p_conversation_id), '');
  v_body text := left(btrim(p_body), 2000);
  v_client_key text := NULLIF(btrim(p_client_key), '');
  v_row public.messages%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_body IS NULL OR v_body = '' THEN RAISE EXCEPTION 'Cannot send an empty message.'; END IF;
  IF v_conversation_id IS NULL THEN RAISE EXCEPTION 'Conversation not found.'; END IF;

  IF v_property_id IS NOT NULL THEN
    SELECT p.owner_user_id::text INTO v_recipient
    FROM public.properties p
    WHERE p.id::text = v_property_id
    LIMIT 1;
    IF v_recipient IS NULL THEN RAISE EXCEPTION 'Listing owner not found.'; END IF;
  END IF;

  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Message recipient not found.'; END IF;
  IF v_recipient = v_user_id THEN RAISE EXCEPTION 'Cannot message yourself.'; END IF;
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
    COALESCE(NULLIF(v_client_key, ''), 'msg_' || gen_random_uuid()::text),
    v_conversation_id,
    v_user_id,
    v_body,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body
  RETURNING * INTO v_row;

  UPDATE public.conversations SET updated_at = v_row.sent_at
  WHERE id = v_conversation_id;

  RETURN QUERY SELECT v_row.id, v_row.conversation_id, v_row.sender_user_id,
    v_recipient, v_row.body, v_row.sent_at, v_client_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message_atomic(text,text,text,text,text) TO authenticated;

-- 6) Atomic viewing request + first message.
-- This is deliberately one transaction: if either the viewing request or the
-- conversation/message cannot be created, neither is reported as successful.
CREATE OR REPLACE FUNCTION public.request_property_viewing(
  p_property_id text,
  p_message text DEFAULT 'I would like to request a viewing.'
)
RETURNS TABLE (conversation_id text, message_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_owner_id text;
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_conversation_id text;
  v_message_id text;
  v_message text := left(btrim(COALESCE(p_message, 'I would like to request a viewing.')), 2000);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_property_id IS NULL THEN RAISE EXCEPTION 'Property not found.'; END IF;

  SELECT p.owner_user_id::text INTO v_owner_id
  FROM public.properties p
  WHERE p.id::text = v_property_id
  LIMIT 1;

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'This listing has no registered landlord account.'; END IF;
  IF v_owner_id = v_user_id THEN RAISE EXCEPTION 'You cannot request a viewing from your own listing.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text = v_owner_id) THEN
    RAISE EXCEPTION 'The listing owner account no longer exists.';
  END IF;

  -- Idempotent request: a repeated click does not create another request or
  -- another first message.
  IF EXISTS (
    SELECT 1 FROM public.viewing_requests vr
    WHERE vr.user_id = v_user_id AND vr.property_id::text = v_property_id
  ) THEN
    v_conversation_id := v_property_id;
    SELECT m.id INTO v_message_id
    FROM public.messages m
    WHERE m.conversation_id = v_conversation_id
      AND m.sender_user_id = v_user_id
      AND m.body = v_message
    ORDER BY m.sent_at ASC LIMIT 1;
    RETURN QUERY SELECT v_conversation_id, v_message_id;
    RETURN;
  END IF;

  INSERT INTO public.viewing_requests (id, user_id, property_id, status)
  VALUES ('viewing_' || gen_random_uuid()::text, v_user_id, v_property_id, 'requested');

  v_conversation_id := v_property_id;
  INSERT INTO public.conversations (id, property_id)
  VALUES (v_conversation_id, v_property_id)
  ON CONFLICT (id) DO UPDATE SET updated_at = now();

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id), (v_conversation_id, v_owner_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  v_message_id := 'msg_' || gen_random_uuid()::text;
  INSERT INTO public.messages (id, conversation_id, sender_user_id, body, sent_at)
  VALUES (v_message_id, v_conversation_id, v_user_id, v_message, now());

  UPDATE public.conversations SET updated_at = now() WHERE id = v_conversation_id;
  RETURN QUERY SELECT v_conversation_id, v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_property_viewing(text,text) TO authenticated;

