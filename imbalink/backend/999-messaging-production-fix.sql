-- ImbaLink — messaging / viewing-request production fix.
--
-- Run this file on its own, in the Supabase SQL Editor. It does NOT depend
-- on 007-real-save-count-and-owner-messaging.sql having been run first —
-- every function it needs is (re)created here too — so it is safe whether
-- this is the first messaging migration you run on this project or the
-- fifth. Safe to run more than once (CREATE OR REPLACE / DROP POLICY IF
-- EXISTS throughout). Does not touch existing conversations/messages data,
-- and does not touch the get_property_save_count(s) functions from 007.
--
-- Root cause this fixes, if you're re-running after an earlier attempt:
-- the RLS policies on `messages` compared `cp.conversation_id` against a
-- bare `conversation_id` inside a correlated EXISTS subquery. Postgres
-- resolves an unqualified column to the innermost matching table first, and
-- `conversation_participants` also has a column called `conversation_id` —
-- so that comparison silently became `cp.conversation_id = cp.conversation_id`
-- (always true) instead of comparing against the outer `messages.conversation_id`.
-- That didn't block sends (an over-permissive policy never blocks a write),
-- but it meant the policy wasn't actually scoping messages to the right
-- conversation. Every USING/WITH CHECK below qualifies both sides
-- explicitly to avoid this class of bug.

BEGIN;

-- --------------------------------------------------------------------------
-- 0. Helper: is this user a participant in this conversation? Used by the
--    conversation_participants SELECT policy below. It has to be a
--    SECURITY DEFINER function rather than an inline EXISTS subquery on
--    conversation_participants itself — a policy on a table cannot query
--    that same table directly inside its own USING clause without Postgres
--    raising "infinite recursion detected in policy". Wrapping the lookup
--    in a SECURITY DEFINER function sidesteps that: the function runs as
--    its owner, which bypasses RLS for its own internal query, so there's
--    no self-reference for Postgres to recurse on. (Verified locally: the
--    inline-subquery version throws the recursion error on every SELECT;
--    this version returns the expected rows for both participants and
--    nothing for a non-participant.)
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id text, p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id AND cp.user_id = p_user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(text, text) TO authenticated;

-- Finds a conversation the CALLER already shares with p_other_user_id, if
-- any — regardless of which property/contractor/roommate it was originally
-- about. Used so that, e.g., a tenant messaging a second listing from a
-- landlord they already have an open conversation with continues that same
-- thread instead of starting a new, empty one. Deliberately scoped to "a
-- conversation I (auth.uid()) am in" rather than accepting both user ids as
-- parameters — that keeps it safe to expose to any authenticated caller,
-- since it can only ever reveal whether the caller themselves has an
-- existing conversation with someone, never whether two OTHER people do.
CREATE OR REPLACE FUNCTION public.find_conversation_with(p_other_user_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp1.conversation_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = cp1.conversation_id AND cp2.user_id = p_other_user_id
  WHERE cp1.user_id = auth.uid()::text
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_conversation_with(text) TO authenticated;

-- Canonical, order-independent conversation id for a direct (contractor or
-- roommate) 1:1 thread — a pure function of the two participant ids, so it
-- never needs a lookup to "find" the existing conversation: computing it
-- from the same two ids always produces the same result. Used as the
-- storage key instead of a routing key like "contractor_<id>", which is
-- tied only to the OTHER party and not to who's asking — reused as-is by
-- every different customer who messages that same contractor, merging
-- unrelated people into one shared thread (reproduced locally: two
-- different customers messaging the same contractor ended up as
-- {customer1, contractor, customer2} in a single conversation).
CREATE OR REPLACE FUNCTION public.dm_pair_id(a text, b text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'dm_' || LEAST(a, b) || '_' || GREATEST(a, b);
$$;

-- --------------------------------------------------------------------------
-- 1. RPCs. All SECURITY DEFINER so the multi-table conversation setup
--    (conversation + both participants + message) happens atomically and
--    isn't interrupted partway through by RLS on any one of those tables.
--    The requester's identity always comes from auth.uid() — never from a
--    frontend-supplied user id.
-- --------------------------------------------------------------------------

-- Property conversation containing the requester + the actual listing
-- owner. The browser cannot insert another user's participant row under
-- RLS, so this function does it.
CREATE OR REPLACE FUNCTION public.ensure_property_conversation(p_property_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_owner_id text;
  v_conversation_id text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;

  SELECT owner_user_id::text INTO v_owner_id
  FROM public.properties WHERE id::text = p_property_id LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'This listing has no registered landlord account.';
  END IF;
  IF v_owner_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot request a viewing from your own listing.';
  END IF;

  -- Reuse an existing conversation with this landlord, same as
  -- request_property_viewing() above.
  v_conversation_id := public.find_conversation_with(v_owner_id);
  IF v_conversation_id IS NULL THEN
    -- Tenant-scoped, not just the property's own id: v_owner_id has no
    -- existing conversation with THIS caller yet, but the property's bare
    -- id is global — a completely different tenant's first-ever contact
    -- with the same landlord via the same listing would otherwise collide
    -- into this exact same conversation id and end up sharing one
    -- 3-participant thread instead of two separate 2-person ones. See the
    -- matching note in request_property_viewing() below, where this was
    -- actually found (reproduced locally: two different tenants requesting
    -- the same listing landed in one conversation together).
    v_conversation_id := p_property_id || '::' || v_user_id;
  END IF;

  INSERT INTO public.conversations (id, property_id)
  VALUES (v_conversation_id, p_property_id)
  ON CONFLICT (id) DO UPDATE
    SET property_id = COALESCE(public.conversations.property_id, EXCLUDED.property_id),
        updated_at = now();

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id), (v_conversation_id, v_owner_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_property_conversation(text) TO authenticated;

-- Direct conversation (contractor / roommate threads) containing the
-- requester + the named other user.
-- Direct conversation (contractor / roommate threads) between the caller
-- and p_other_user_id. Takes only the OTHER user's id — never a client-
-- supplied conversation id — and computes the canonical dm_pair_id() for
-- that pair itself. A client-chosen id here would reopen the exact
-- collision this migration fixes in send_message_atomic(): a routing key
-- like "contractor_123" is tied only to the contractor, not to who's
-- asking, so every different customer's first-ever contact would land in
-- the same shared conversation.
DROP FUNCTION IF EXISTS public.ensure_direct_conversation(text, text);
CREATE OR REPLACE FUNCTION public.ensure_direct_conversation(p_other_user_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_conversation_id text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF p_other_user_id IS NULL OR btrim(p_other_user_id) = '' THEN
    RAISE EXCEPTION 'Message recipient not found.';
  END IF;
  IF p_other_user_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot create a conversation with yourself.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id::text = p_other_user_id) THEN
    RAISE EXCEPTION 'Message recipient does not exist.';
  END IF;

  v_conversation_id := public.dm_pair_id(v_user_id, p_other_user_id);

  INSERT INTO public.conversations (id, property_id)
  VALUES (v_conversation_id, NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id), (v_conversation_id, p_other_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  UPDATE public.conversations SET updated_at = now() WHERE id = v_conversation_id;

  RETURN v_conversation_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_direct_conversation(text) TO authenticated;

-- Atomic viewing request + first message. Idempotent: a repeated click
-- neither duplicates the viewing_requests row nor sends a second copy of
-- the template message.
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
-- Without this pragma, PL/pgSQL treats a bare "conversation_id" anywhere in
-- this function's embedded SQL as ambiguous between the RETURNS TABLE OUT
-- parameter of that name and any table column of that name (e.g. the
-- ON CONFLICT (conversation_id, user_id) target list below) and throws
-- "column reference is ambiguous" (SQLSTATE 42702) at call time rather than
-- at CREATE FUNCTION time — this is the exact failure this app kept
-- hitting. `use_column` tells it to prefer the table column, which is
-- correct here since every actual reference to this function's own local
-- values already goes through the v_-prefixed variables below, never the
-- bare OUT parameter names.
DECLARE
  v_user_id text := auth.uid()::text;
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_owner_id text;
  v_property_title text;
  v_conversation_id text;
  v_message_id text;
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

  -- Reuse an existing conversation with THIS landlord (from any other
  -- listing of theirs) rather than always starting a new one keyed by this
  -- property. Without this, requesting a viewing on a second property from
  -- a landlord you already have an open thread with opened a brand-new,
  -- disconnected chat instead of continuing the existing one.
  v_conversation_id := public.find_conversation_with(v_owner_id);
  IF v_conversation_id IS NULL THEN
    -- CONFIRMED BUG (reproduced locally): using the bare property id here
    -- is GLOBAL, not scoped to which tenant is asking. find_conversation_with()
    -- returning NULL only means *this* caller has no existing conversation
    -- with this landlord yet — it says nothing about whether some OTHER,
    -- unrelated tenant already does. Two different tenants each contacting
    -- this landlord for the first time via the SAME listing would both
    -- fall into this branch and both get v_conversation_id = v_property_id
    -- — the exact same id — merging two strangers' conversations into one
    -- shared 3-participant thread. Suffixing with the requester's own id
    -- makes the fallback unique per (tenant, property) and therefore per
    -- (tenant, landlord), so this can never happen again.
    v_conversation_id := v_property_id || '::' || v_user_id;
  END IF;

  -- Idempotency is tracked per PROPERTY (not per conversation, since one
  -- conversation can now span several properties from the same landlord) —
  -- a repeat click on the same listing is a no-op; a first click on a
  -- DIFFERENT listing from a landlord you've already messaged still adds a
  -- new viewing_requests row and a new message into the existing thread.
  v_already_requested := EXISTS (
    SELECT 1 FROM public.viewing_requests vr
    WHERE vr.user_id = v_user_id AND vr.property_id::text = v_property_id
  );

  -- Naming the property in the message matters once a single thread can
  -- cover several listings — a bare "I would like to request a viewing."
  -- repeated for a second property would be indistinguishable from the
  -- first in a merged thread, and (via the idempotency lookup below) could
  -- even be silently swallowed as if it were a duplicate of it.
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
    -- Fall through: a viewing_requests row exists but no matching message
    -- was found (unexpected, but don't leave the request silently mute).
  END IF;

  INSERT INTO public.viewing_requests (id, user_id, property_id, status)
  VALUES ('viewing_' || gen_random_uuid()::text, v_user_id, v_property_id, 'requested')
  ON CONFLICT (user_id, property_id) DO NOTHING;

  INSERT INTO public.conversations (id, property_id)
  VALUES (v_conversation_id, v_property_id)
  ON CONFLICT (id) DO UPDATE
    SET property_id = COALESCE(public.conversations.property_id, EXCLUDED.property_id),
        updated_at = now();

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
GRANT EXECUTE ON FUNCTION public.request_property_viewing(text, text) TO authenticated;

-- Atomic send: resolve recipient (from the property, for property threads)
-- -> ensure conversation -> ensure both participants -> insert message, all
-- in one round trip. p_client_key lets the caller pass its own optimistic
-- message id so a Realtime echo of the same insert reconciles instead of
-- duplicating.
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
-- See the matching note in request_property_viewing() above — the same
-- OUT-parameter-vs-column collision hits `id` here (RETURNS TABLE has an
-- `id` column and so does `messages`, which this function's own
-- `ON CONFLICT (id)` target list references).
DECLARE
  v_user_id text := auth.uid()::text;
  v_recipient text := NULLIF(btrim(p_recipient_user_id), '');
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_conversation_id text := NULLIF(btrim(p_conversation_id), '');
  v_body text := left(btrim(p_body), 2000);
  v_client_key text := NULLIF(btrim(p_client_key), '');
  v_existing_recipient text;
  v_row public.messages%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_body IS NULL OR v_body = '' THEN RAISE EXCEPTION 'Cannot send an empty message.'; END IF;
  IF v_conversation_id IS NULL THEN RAISE EXCEPTION 'Conversation not found.'; END IF;

  -- If this conversation already has a participant other than the sender,
  -- THAT is the real recipient — full stop. This is what makes a reply
  -- work from either side of an existing conversation. Without it, a
  -- property thread's recipient is always re-derived as "the listing
  -- owner" below, which is correct for the tenant's messages but breaks
  -- the moment the owner is the one replying (the owner would be told
  -- they're trying to message themselves).
  SELECT cp.user_id INTO v_existing_recipient
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = v_conversation_id AND cp.user_id <> v_user_id
  LIMIT 1;

  IF v_existing_recipient IS NOT NULL THEN
    v_recipient := v_existing_recipient;
  ELSIF v_property_id IS NOT NULL THEN
    -- No participants yet: this is the first message in the conversation,
    -- so fall back to the listing owner — the only case where that guess
    -- is actually correct (a tenant starting a new property conversation).
    SELECT p.owner_user_id::text INTO v_recipient
    FROM public.properties p WHERE p.id::text = v_property_id LIMIT 1;
    IF v_recipient IS NULL THEN RAISE EXCEPTION 'Listing owner not found.'; END IF;
  END IF;

  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Message recipient not found.'; END IF;
  IF v_recipient = v_user_id THEN RAISE EXCEPTION 'Cannot message yourself.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text = v_recipient) THEN
    RAISE EXCEPTION 'Message recipient does not exist.';
  END IF;

  -- Brand-new conversation (no existing participant found above): never
  -- trust the client-supplied conversation id as the storage key here —
  -- same bug class as v_property_id || '::' || v_user_id in
  -- request_property_viewing()/ensure_property_conversation() above, just
  -- for direct (contractor/roommate) threads instead of property ones. A
  -- fixed key tied only to the OTHER party (e.g. "contractor_123") would
  -- get reused by every different customer who messages that contractor
  -- for the first time, merging unrelated people into one shared thread —
  -- reproduced locally. Recompute the real key from the actual pair.
  IF v_existing_recipient IS NULL THEN
    IF v_property_id IS NOT NULL THEN
      v_conversation_id := v_property_id || '::' || v_user_id;
    ELSE
      v_conversation_id := public.dm_pair_id(v_user_id, v_recipient);
    END IF;
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

  UPDATE public.conversations SET updated_at = v_row.sent_at WHERE id = v_conversation_id;

  RETURN QUERY SELECT v_row.id, v_row.conversation_id, v_row.sender_user_id,
    v_recipient, v_row.body, v_row.sent_at, v_client_key;
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_message_atomic(text, text, text, text, text) TO authenticated;

-- --------------------------------------------------------------------------
-- 2. RLS. Rewritten to depend only on auth.uid() (never the older,
--    possibly-undeployed current_user_id() helper), and with every column
--    in a correlated subquery qualified so nothing can silently shadow the
--    outer table's column (see the note at the top of this file).
-- --------------------------------------------------------------------------

ALTER TABLE public.conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_requests          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_read_participant       ON public.conversations;
DROP POLICY IF EXISTS conversations_insert                 ON public.conversations;
DROP POLICY IF EXISTS participants_read_own                ON public.conversation_participants;
DROP POLICY IF EXISTS participants_write_own                ON public.conversation_participants;
DROP POLICY IF EXISTS participants_insert_conversation_party ON public.conversation_participants;
DROP POLICY IF EXISTS participants_update_own               ON public.conversation_participants;
DROP POLICY IF EXISTS participants_delete_own               ON public.conversation_participants;
DROP POLICY IF EXISTS messages_read_participant             ON public.messages;
DROP POLICY IF EXISTS messages_insert_participant           ON public.messages;
DROP POLICY IF EXISTS viewing_requests_read_party           ON public.viewing_requests;
DROP POLICY IF EXISTS viewing_requests_write_self           ON public.viewing_requests;

CREATE POLICY conversations_read_participant
ON public.conversations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()::text
  )
);

-- No direct INSERT policy. Conversation creation is exclusively routed through
-- ensure_property_conversation(), ensure_direct_conversation(), and the
-- request_property_viewing()/send_message_atomic() SECURITY DEFINER RPCs.
-- This prevents clients from manufacturing unscoped conversation rows.
-- A participant can see every participant row for a conversation they're
-- part of — not just their own row. This is what lets the app work out
-- "who's the other person in this thread" from either side; the earlier
-- version (`USING (user_id = auth.uid()::text)`) only let you see your own
-- row, which meant the app could never discover the other participant and
-- silently fell back to a wrong guess — on a property thread specifically,
-- that guess is always the listing owner, so the owner ended up seeing
-- their own id as "the other participant" and every incoming message from
-- the actual tenant got attributed to themselves (rendered as sent by
-- "me", right-aligned, instead of received, left-aligned).
CREATE POLICY participants_read_own
ON public.conversation_participants
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()::text
  OR public.is_conversation_participant(conversation_id, auth.uid()::text)
);

-- A signed-in user may always add themselves. They may add the OTHER party
-- to a property conversation only when that party is the property's actual
-- registered owner — this is the fallback path's equivalent of what the
-- ensure_property_conversation() RPC already enforces server-side.
CREATE POLICY participants_insert_conversation_party
ON public.conversation_participants
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.properties p ON p.id::text = c.property_id::text
    WHERE c.id = conversation_participants.conversation_id
      AND p.owner_user_id = conversation_participants.user_id
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

-- Both column references are explicitly qualified here: without the
-- `messages.` prefix, `conversation_id` inside the EXISTS resolves to
-- `cp.conversation_id` (the innermost matching table) and the policy
-- silently stops scoping by conversation at all. See the file header.
CREATE POLICY messages_read_participant
ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
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
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()::text
  )
);

CREATE POLICY viewing_requests_read_party
ON public.viewing_requests
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id::text = viewing_requests.property_id::text
      AND p.owner_user_id = auth.uid()::text
  )
);

CREATE POLICY viewing_requests_write_self
ON public.viewing_requests
FOR ALL TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT ON public.conversations, public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.viewing_requests TO authenticated;

-- --------------------------------------------------------------------------
-- 3. Realtime. INSERT on `messages` and `conversation_participants` must be
--    in the publication or the other party never gets a live update.
-- --------------------------------------------------------------------------

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------------
-- 3b. public_user_profiles: the one cross-account-readable view of a user's
--     display name/avatar (no phone/email). The Messages UI depends on this
--     to show the REAL other participant's name — e.g. the tenant's name on
--     the landlord's side of a viewing-request conversation — instead of
--     falling back to the listing's own landlord-name field, which is only
--     correct for the tenant's side. Also defined in 002-app-alignment.sql;
--     repeated here (CREATE OR REPLACE, so harmless either order) so this
--     file has everything it needs standalone.
-- --------------------------------------------------------------------------

CREATE OR REPLACE VIEW public_user_profiles AS
  SELECT id, first_name, surname, display_name, avatar_url, account_type, created_at
  FROM users;

GRANT SELECT ON public_user_profiles TO authenticated;

-- --------------------------------------------------------------------------
-- 3c. get_conversation_previews: the actual fix for a slow/expensive
--     Messages inbox — same "query only what's needed" principle as the
--     properties feed fix (backend/010-properties-with-meta-view.sql).
--
--     Before this, opening the Messages tab fetched EVERY conversation the
--     user is in, then EVERY message ever sent in ALL of them (slicing to
--     the last 100 only after downloading everything), then ran several
--     more queries PER conversation just to figure out who's on the other
--     end. For someone with 50 conversations that's 150+ queries and an
--     unbounded amount of message history just to render a one-line
--     preview per row.
--
--     This returns exactly what an inbox row needs — the other
--     participant's id, the single most recent message, and a TRUE unread
--     count — for a whole PAGE of conversations in one query, via LATERAL
--     joins that only ever look at the single most recent row per
--     conversation instead of the whole history. Paginated with keyset
--     pagination on `conversations.updated_at` (p_before), the same
--     pattern the frontend already scrolls by.
--
--     `unread_count` = messages from the OTHER participant sent AFTER
--     this user's own `conversation_participants.last_read_at` — the
--     actual, correct definition of "unread". An earlier version of this
--     function returned "total messages ever sent by the other
--     participant" instead, to match a frontend that separately
--     subtracted its own locally-tracked "how many I'd already seen"
--     counter — that whole mechanism was the root cause of read messages
--     reappearing as unread after restarting the app (it compared a
--     total that excluded the user's own messages against a snapshot
--     count that included them — never reliably comparable) and has been
--     removed from the frontend entirely in favor of this single,
--     database-backed source of truth. See mark_conversation_read() below
--     for how last_read_at gets updated.
-- --------------------------------------------------------------------------

-- CREATE OR REPLACE can't change a function's RETURN TABLE column names —
-- an earlier version of this migration returned `other_message_count`;
-- this one returns `unread_count` instead. Postgres rejects that in place
-- ("cannot change return type of existing function") unless the old
-- signature is dropped first — which, left unhandled, aborted this whole
-- script's transaction partway through and silently rolled back
-- everything in it, not just this one function.
DROP FUNCTION IF EXISTS public.get_conversation_previews(int, timestamptz);
CREATE OR REPLACE FUNCTION public.get_conversation_previews(
  p_limit int DEFAULT 20,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  conversation_id text,
  property_id text,
  updated_at timestamptz,
  last_message_body text,
  last_message_sender_id text,
  last_message_sent_at timestamptz,
  other_user_id text,
  unread_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cp.conversation_id,
    c.property_id::text,
    c.updated_at,
    lm.body,
    lm.sender_user_id,
    lm.sent_at,
    other.user_id,
    COALESCE(uc.unread_count, 0)
  FROM public.conversation_participants cp
  JOIN public.conversations c ON c.id = cp.conversation_id
  LEFT JOIN LATERAL (
    SELECT body, sender_user_id, sent_at FROM public.messages m
    WHERE m.conversation_id = cp.conversation_id AND m.deleted_at IS NULL
    ORDER BY m.sent_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT user_id FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = cp.conversation_id AND cp2.user_id <> auth.uid()::text
    LIMIT 1
  ) other ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS unread_count FROM public.messages m2
    WHERE m2.conversation_id = cp.conversation_id
      AND m2.sender_user_id <> auth.uid()::text
      AND m2.sent_at > COALESCE(cp.last_read_at, '-infinity'::timestamptz)
      AND m2.deleted_at IS NULL
  ) uc ON true
  WHERE cp.user_id = auth.uid()::text
    AND (p_before IS NULL OR c.updated_at < p_before)
  ORDER BY c.updated_at DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_conversation_previews(int, timestamptz) TO authenticated;

-- Marks a conversation read for the CALLER only (the WHERE clause scopes
-- the update to their own participant row — another user's row is
-- structurally unreachable here, not just discouraged: verified locally
-- that a different user's call updates zero rows, never someone else's).
-- Idempotent and monotonic: GREATEST() means calling this with an older
-- timestamp than what's already recorded is a safe no-op rather than
-- ever moving last_read_at backward — protects against a stale/delayed
-- realtime event or a duplicate call rewinding read state after a newer
-- one already landed. p_read_through defaults to now() so a plain
-- "mark this conversation read" call needs no argument.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id text,
  p_read_through timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_read_through timestamptz := COALESCE(p_read_through, now());
  v_new_value timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;

  UPDATE public.conversation_participants
  SET last_read_at = GREATEST(COALESCE(last_read_at, '-infinity'::timestamptz), v_read_through)
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id
  RETURNING last_read_at INTO v_new_value;

  RETURN v_new_value;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(text, timestamptz) TO authenticated;

-- --------------------------------------------------------------------------
-- 4. Indexes for the query patterns above and for inbox/history loading.
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent_id
  ON public.messages (conversation_id, sent_at, id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_conversation
  ON public.conversation_participants (user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_property
  ON public.viewing_requests (property_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_user
  ON public.viewing_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner_user_id
  ON public.properties (owner_user_id);
-- Supports get_conversation_previews()'s keyset pagination
-- (ORDER BY updated_at DESC / WHERE updated_at < p_before).
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON public.conversations (updated_at DESC);
-- Supports messages.sender_user_id <> auth.uid() lookups (both the LATERAL
-- "other participant's message count" above and the messages RLS policy).
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON public.messages (conversation_id, sender_user_id);

COMMIT;

-- PostgREST caches the schema. After running this, either wait a few
-- seconds or force it:
--   NOTIFY pgrst, 'reload schema';
