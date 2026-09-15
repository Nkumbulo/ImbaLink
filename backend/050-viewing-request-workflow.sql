-- ImbaLink: viewing-request workflow — database as source of truth.
-- Run after backend/049-viewing-request-notification-sync.sql.
--
-- Fixes:
--   * dedicated viewing_request fields (conversation, landlord, response audit)
--   * atomic, authorized status transitions including landlord cancellation
--   * one assistant message per (request, status) — no duplicate notices
--   * message metadata so the chat UI does not guess from body text
--   * re-request after declined/cancelled/completed
--   * property validation (exists, not paused, owner present)

-- New enum values must be added outside the main transaction on older
-- Postgres versions; IF NOT EXISTS is safe to re-run.
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'cancelled_by_tenant';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'cancelled_by_landlord';

BEGIN;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;

ALTER TABLE public.viewing_requests
  ADD COLUMN IF NOT EXISTS landlord_id text,
  ADD COLUMN IF NOT EXISTS conversation_id text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by text,
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_assistant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewing_request_id text,
  ADD COLUMN IF NOT EXISTS related_property_id text,
  ADD COLUMN IF NOT EXISTS message_kind text;

UPDATE public.viewing_requests vr
SET landlord_id = p.owner_user_id::text
FROM public.properties p
WHERE vr.landlord_id IS NULL
  AND p.id::text = vr.property_id::text;

UPDATE public.viewing_requests
SET status = 'cancelled_by_tenant'
WHERE status = 'cancelled';

-- One active request per tenant + property. Completed/declined/cancelled
-- rows no longer block a later legitimate request.
ALTER TABLE public.viewing_requests
  DROP CONSTRAINT IF EXISTS viewing_requests_user_id_property_id_key;

DROP INDEX IF EXISTS viewing_requests_user_id_property_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS viewing_requests_one_active
  ON public.viewing_requests (user_id, property_id)
  WHERE status IN ('requested', 'accepted');

CREATE INDEX IF NOT EXISTS idx_viewing_requests_conversation
  ON public.viewing_requests (conversation_id);

CREATE INDEX IF NOT EXISTS idx_viewing_requests_landlord_status
  ON public.viewing_requests (landlord_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS messages_viewing_status_once
  ON public.messages (viewing_request_id, message_kind)
  WHERE viewing_request_id IS NOT NULL
    AND message_kind LIKE 'viewing_status:%';

CREATE OR REPLACE FUNCTION public.can_transition_state(
  p_machine text,
  p_from text,
  p_to text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_machine
    WHEN 'user' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending','approved'),('pending','rejected'),
        ('approved','suspended'),('approved','banned'),
        ('rejected','pending'),
        ('suspended','approved'),('suspended','banned')
      )
    WHEN 'property' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending_review','approved'),('pending_review','rejected'),('pending_review','flagged'),
        ('approved','flagged'),('approved','sold'),('approved','rented'),('approved','expired'),
        ('rejected','pending_review'),
        ('flagged','pending_review'),('flagged','approved'),('flagged','rejected'),
        ('sold','approved'),('rented','approved'),
        ('expired','pending_review'),('expired','approved')
      )
    WHEN 'verification' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending','verified'),('pending','rejected'),('pending','flagged'),
        ('verified','flagged'),
        ('rejected','pending'),
        ('flagged','pending'),('flagged','verified'),('flagged','rejected')
      )
    WHEN 'viewing' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('requested','accepted'),('requested','declined'),
        ('requested','cancelled'),('requested','cancelled_by_tenant'),
        ('accepted','completed'),
        ('accepted','cancelled'),('accepted','cancelled_by_tenant'),
        ('accepted','cancelled_by_landlord')
      )
    WHEN 'report' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('open','reviewing'),('open','resolved'),('open','dismissed'),
        ('reviewing','resolved'),('reviewing','dismissed'),
        ('dismissed','open')
      )
    WHEN 'pro_membership' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending','active'),('pending','cancelled'),
        ('active','past_due'),('active','cancelled'),('active','expired'),('active','suspended'),
        ('past_due','active'),('past_due','cancelled'),('past_due','suspended'),('past_due','expired'),
        ('cancelled','pending'),('expired','pending'),
        ('suspended','active'),('suspended','cancelled')
      )
    WHEN 'payment' THEN
      p_from = p_to OR (p_from,p_to) IN (
        ('pending','processing'),('pending','cancelled'),('pending','expired'),
        ('processing','paid'),('processing','failed'),('processing','cancelled'),
        ('paid','refunded'),('failed','pending'),('cancelled','pending'),('expired','pending')
      )
    ELSE false
  END;
$$;

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
  v_paused boolean := false;
  v_conversation_id text;
  v_message_id text;
  v_message text;
  v_request_id text;
  v_active boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_property_id IS NULL THEN RAISE EXCEPTION 'Property not found.'; END IF;

  SELECT p.owner_user_id::text, p.title, COALESCE(p.is_paused, false)
    INTO v_owner_id, v_property_title, v_paused
  FROM public.properties p
  WHERE p.id::text = v_property_id
  LIMIT 1;

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'This listing no longer exists.'; END IF;
  IF v_owner_id = v_user_id THEN RAISE EXCEPTION 'You cannot request a viewing from your own listing.'; END IF;
  IF v_paused THEN
    RAISE EXCEPTION 'This listing is temporarily paused by the owner. Viewing requests are currently unavailable.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id::text = v_owner_id) THEN
    RAISE EXCEPTION 'The listing owner account no longer exists.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id::text = v_user_id) THEN
    RAISE EXCEPTION 'Your account could not be verified.';
  END IF;

  v_conversation_id := public.find_conversation_with(v_owner_id);
  IF v_conversation_id IS NULL THEN
    v_conversation_id := v_property_id || '::' || v_user_id;
  END IF;

  SELECT vr.id, true INTO v_request_id, v_active
  FROM public.viewing_requests vr
  WHERE vr.user_id = v_user_id
    AND vr.property_id::text = v_property_id
    AND vr.status IN ('requested', 'accepted')
  LIMIT 1;

  v_message := left(btrim(COALESCE(
    NULLIF(p_message, ''),
    'I would like to request a viewing' || COALESCE(' of ' || v_property_title, '') || '.'
  )), 2000);

  INSERT INTO public.conversations (id, property_id)
  VALUES (v_conversation_id, v_property_id)
  ON CONFLICT (id) DO UPDATE
    SET property_id = COALESCE(public.conversations.property_id, EXCLUDED.property_id),
        updated_at = now();

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id), (v_conversation_id, v_owner_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  IF v_active THEN
    SELECT m.id INTO v_message_id
    FROM public.messages m
    WHERE m.conversation_id = v_conversation_id
      AND (
        m.viewing_request_id = v_request_id
        OR (m.sender_user_id = v_user_id AND m.body = v_message)
      )
    ORDER BY m.sent_at DESC
    LIMIT 1;
    UPDATE public.viewing_requests
      SET conversation_id = v_conversation_id,
          landlord_id = COALESCE(landlord_id, v_owner_id),
          updated_at = now()
      WHERE id = v_request_id;
    IF v_message_id IS NOT NULL THEN
      RETURN QUERY SELECT v_conversation_id, v_message_id;
      RETURN;
    END IF;
  ELSE
    v_request_id := 'viewing_' || gen_random_uuid()::text;
    INSERT INTO public.viewing_requests (
      id, user_id, property_id, landlord_id, conversation_id, status
    ) VALUES (
      v_request_id, v_user_id, v_property_id, v_owner_id, v_conversation_id, 'requested'
    );
  END IF;

  v_message_id := 'msg_' || gen_random_uuid()::text;
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
  v_message_kind text;
  v_result jsonb;
  v_target request_status;
  v_from_statuses request_status[];
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_property_id IS NULL OR v_requester IS NULL THEN
    RAISE EXCEPTION 'Viewing request not found.';
  END IF;

  SELECT owner_user_id::text, title INTO v_owner_id, v_property_title
  FROM public.properties WHERE id::text = v_property_id LIMIT 1;
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'This listing no longer exists.'; END IF;

  v_target := p_status;
  IF v_target = 'cancelled' THEN
    v_target := 'cancelled_by_tenant';
  END IF;

  IF v_caller = v_owner_id THEN
    IF v_target NOT IN ('accepted', 'declined', 'completed', 'cancelled_by_landlord') THEN
      RAISE EXCEPTION 'Landlords can only accept, decline, complete, or cancel an accepted viewing.';
    END IF;
  ELSIF v_caller = v_requester THEN
    IF v_target <> 'cancelled_by_tenant' THEN
      RAISE EXCEPTION 'You can only cancel your own viewing request.';
    END IF;
  ELSE
    RAISE EXCEPTION 'STAFF_ROLE_REQUIRED';
  END IF;

  IF v_target IN ('accepted', 'declined') THEN
    v_from_statuses := ARRAY['requested']::request_status[];
  ELSIF v_target = 'cancelled_by_tenant' THEN
    v_from_statuses := ARRAY['requested', 'accepted']::request_status[];
  ELSIF v_target = 'cancelled_by_landlord' THEN
    v_from_statuses := ARRAY['accepted']::request_status[];
  ELSIF v_target = 'completed' THEN
    v_from_statuses := ARRAY['accepted']::request_status[];
  ELSE
    RAISE EXCEPTION 'Viewing request not found.';
  END IF;

  UPDATE public.viewing_requests
  SET status = v_target,
      note = COALESCE(v_note, note),
      updated_at = now(),
      responded_at = now(),
      responded_by = v_caller,
      landlord_id = COALESCE(landlord_id, v_owner_id)
  WHERE property_id::text = v_property_id
    AND user_id = v_requester
    AND status = ANY (v_from_statuses)
  RETURNING to_jsonb(viewing_requests) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Viewing request not found.';
  END IF;

  v_conversation_id := COALESCE(
    v_result->>'conversation_id',
    public.find_conversation_with(CASE WHEN v_caller = v_owner_id THEN v_requester ELSE v_owner_id END)
  );

  IF v_conversation_id IS NOT NULL THEN
    UPDATE public.viewing_requests
      SET conversation_id = COALESCE(conversation_id, v_conversation_id)
      WHERE id = v_result->>'id';

    v_message_kind := 'viewing_status:' || v_target::text;

    IF NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.viewing_request_id = v_result->>'id'
        AND m.message_kind = v_message_kind
        AND m.deleted_at IS NULL
    ) THEN
      v_message := CASE v_target
        WHEN 'accepted' THEN
          'The landlord has accepted your viewing request' ||
          COALESCE(' for ' || v_property_title, '') || '.'
        WHEN 'declined' THEN
          CASE WHEN v_note IS NOT NULL THEN
            'Unfortunately, the landlord has declined your viewing request' ||
            COALESCE(' for ' || v_property_title, '') || '. Reason: ' || left(v_note, 500)
          ELSE
            'Unfortunately, the landlord has declined your viewing request. You may continue browsing other available properties.'
          END
        WHEN 'cancelled_by_tenant' THEN
          'The tenant has cancelled their viewing request' ||
          COALESCE(' for ' || v_property_title, '') || '.'
        WHEN 'cancelled_by_landlord' THEN
          'Unfortunately, the landlord has cancelled the scheduled viewing. You may contact the landlord for more information or continue browsing other properties.'
        WHEN 'completed' THEN
          'This viewing' || COALESCE(' for ' || v_property_title, '') || ' has been marked as completed.'
        ELSE 'Viewing request updated.'
      END;

      v_message_id := 'msg_' || gen_random_uuid()::text;
      INSERT INTO public.messages (
        id, conversation_id, sender_user_id, body, sent_at, is_assistant,
        viewing_request_id, related_property_id, message_kind
      ) VALUES (
        v_message_id, v_conversation_id, v_caller, v_message, now(), true,
        v_result->>'id', v_property_id, v_message_kind
      );
    END IF;

    UPDATE public.conversations SET updated_at = now() WHERE id = v_conversation_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_viewing_request(text, text, request_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_viewing_request(text, text, request_status, text) TO authenticated;

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
  SELECT m.id, m.conversation_id, m.sender_user_id, m.body, m.sent_at,
         m.is_assistant, m.viewing_request_id, m.related_property_id, m.message_kind
  FROM public.messages m
  WHERE m.conversation_id = v_conversation_id
    AND m.deleted_at IS NULL
  ORDER BY m.sent_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_messages(text, integer) TO authenticated;

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

  IF NEW.status IN ('cancelled', 'cancelled_by_tenant') THEN
    IF v_owner_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_owner_id, 'viewing_status', 'Viewing request cancelled',
        COALESCE(v_title, 'A listing') || ' — the tenant cancelled their viewing request.',
        'property', NEW.property_id::text
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled_by_landlord' THEN
    PERFORM public.create_notification(
      NEW.user_id, 'viewing_status', 'Viewing cancelled',
      COALESCE(v_title, 'A listing') || ' — the landlord cancelled the scheduled viewing.',
      'property', NEW.property_id::text
    );
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

-- Backfill request-message metadata for existing template messages.
UPDATE public.messages m
SET
  viewing_request_id = vr.id,
  related_property_id = vr.property_id::text,
  message_kind = COALESCE(m.message_kind, 'viewing_request')
FROM public.viewing_requests vr
WHERE m.viewing_request_id IS NULL
  AND m.sender_user_id = vr.user_id
  AND m.body ILIKE 'I would like to request a viewing%'
  AND (
    vr.conversation_id = m.conversation_id
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = m.conversation_id
        AND c.property_id::text = vr.property_id::text
    )
  );

UPDATE public.viewing_requests vr
SET conversation_id = m.conversation_id
FROM public.messages m
WHERE vr.conversation_id IS NULL
  AND m.viewing_request_id = vr.id;

ALTER TABLE public.viewing_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF to_regclass('public.viewing_requests') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'viewing_requests'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.viewing_requests;
  END IF;
END $$;

COMMIT;
