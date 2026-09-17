-- ImbaLink — migration 002: align schema v1 with the client, and turn on RLS
--
-- Run this after schema.sql and google-auth.sql, in the Supabase SQL editor.
--
-- Two jobs:
--   1. Add the handful of columns the UI reads that schema v1 never defined.
--      Everything else in the client has been rewritten to match v1 instead;
--      this file only covers cases where the data genuinely has nowhere to go.
--   2. Enable row-level security on every table. The 403 on /rest/v1/profiles
--      was RLS refusing a write, which is RLS doing its job — the tables that
--      answer 200 today are the worrying ones, because they have no policies
--      and are only safe while the anon key stays private, which it isn't:
--      it ships in the browser bundle.

-- --------------------------------------------------------------------------
-- 1. Enum values
-- --------------------------------------------------------------------------
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that uses
-- the new value, so these run first and on their own.

ALTER TYPE account_type        ADD VALUE IF NOT EXISTS 'pro';
-- The client distinguishes "never asked to be verified" from "asked, waiting".
-- v1 collapsed both into 'pending', which loses the difference the Student
-- page renders.
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'unverified' BEFORE 'pending';

BEGIN;

-- --------------------------------------------------------------------------
-- 2. Columns the client reads that v1 has no home for
-- --------------------------------------------------------------------------

-- Written by the Google sign-in path (supabaseAuthProvider). Harmless if
-- google-auth.sql already added them.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email        CITEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- phone_normalized is UNIQUE, so every account without a phone number must
-- store NULL rather than ''. One '' would block the next. The client now
-- writes NULL; this clears any rows that already got the empty string.
UPDATE users SET phone_normalized = NULL WHERE phone_normalized = '';

-- Feed cosmetics with no other source: the agent fee badge, the distance
-- chip, and the ring PostCard draws around a verified landlord's avatar.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS fee_percent       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS distance_km       NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS landlord_verified BOOLEAN NOT NULL DEFAULT false;

-- The Roommate Finder captures the university as free text from the student's
-- own profile, not as a pick from the universities table, so it has no id to
-- put in university_id. Keep both: the name for what students actually typed,
-- the id for when the flow moves to a picker.
ALTER TABLE student_share_requests
  ADD COLUMN IF NOT EXISTS university_name TEXT;

-- The contractor directory shows a contact person, a city/suburb, and the
-- rating and completed-job count. v1 modelled contractors as businesses only.
ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS area         TEXT,
  ADD COLUMN IF NOT EXISTS rating       NUMERIC(2,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jobs         INTEGER NOT NULL DEFAULT 0;

-- --------------------------------------------------------------------------
-- 3. Ownership helper
-- --------------------------------------------------------------------------
-- users.id is TEXT (the client mints ids offline) while auth.uid() is a uuid,
-- so every policy needs the cast. One function keeps that in one place.

CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT auth.uid()::text
$$;

-- --------------------------------------------------------------------------
-- 4. Public read views
-- --------------------------------------------------------------------------
-- The Roommate Finder shows other students. That needs cross-account reads,
-- but not of everything: users holds phone numbers and email addresses. These
-- views are the only cross-account read path, and they expose neither.

CREATE OR REPLACE VIEW public_user_profiles AS
  SELECT id, first_name, surname, display_name, avatar_url, account_type, created_at
  FROM users;

CREATE OR REPLACE VIEW public_student_profiles AS
  SELECT sp.user_id, sp.university_id, sp.verification_status, sp.details,
         u.first_name, u.surname, u.display_name, u.avatar_url
  FROM student_profiles sp
  JOIN users u ON u.id = sp.user_id;

GRANT SELECT ON public_user_profiles, public_student_profiles TO authenticated;

-- --------------------------------------------------------------------------
-- 5. Row-level security
-- --------------------------------------------------------------------------

ALTER TABLE users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_verifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities              ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties                ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_likes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_saves            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_likes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_share_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_interests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;

-- No policies on these three, deliberately. RLS with no policy denies every
-- row to every client, which is exactly right: password hashes, OTP codes and
-- session tokens are server-side concerns. Reach them with the service role
-- from an Edge Function, never from the browser.
--   user_credentials, phone_verifications, sessions

-- Identity ------------------------------------------------------------------

CREATE POLICY users_select_self ON users
  FOR SELECT TO authenticated USING (id = current_user_id());
CREATE POLICY users_insert_self ON users
  FOR INSERT TO authenticated WITH CHECK (id = current_user_id());
CREATE POLICY users_update_self ON users
  FOR UPDATE TO authenticated USING (id = current_user_id()) WITH CHECK (id = current_user_id());

CREATE POLICY student_profiles_rw_self ON student_profiles
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- Catalog: readable by anyone, writable by nobody from the browser. Seeding
-- and moderation run with the service role.

CREATE POLICY universities_read ON universities
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY properties_read ON properties
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY properties_insert_own ON properties
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = current_user_id());
CREATE POLICY properties_update_own ON properties
  FOR UPDATE TO authenticated
  USING (owner_user_id = current_user_id()) WITH CHECK (owner_user_id = current_user_id());

CREATE POLICY property_images_read ON property_images
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY property_images_write_own ON property_images
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_user_id = current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_user_id = current_user_id()));

CREATE POLICY contractors_read ON contractors
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY contractors_write_own ON contractors
  FOR ALL TO authenticated
  USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- Registrations -------------------------------------------------------------
-- Own rows only. This is what breaks localAuthProvider.signInWithCredentials,
-- which scans every registration in the database and compares password hashes
-- in the browser. Making that work again would mean letting any visitor read
-- every business's credentials, so it stays broken on purpose until business
-- sign-in moves server-side. See the note in services/database.js.

CREATE POLICY registrations_rw_self ON registrations
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

CREATE POLICY verification_events_read_own ON verification_events
  FOR SELECT TO authenticated USING (
    subject_type = 'registration'
    AND EXISTS (SELECT 1 FROM registrations r WHERE r.id = subject_id AND r.user_id = current_user_id())
  );

-- Engagement: private to the account that created it -------------------------

CREATE POLICY property_likes_rw_self ON property_likes
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
CREATE POLICY property_saves_rw_self ON property_saves
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
CREATE POLICY contractor_likes_rw_self ON contractor_likes
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
CREATE POLICY student_interests_rw_self ON student_interests
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- A viewing request is between a tenant and a landlord, so both sides read it.
CREATE POLICY viewing_requests_read_party ON viewing_requests
  FOR SELECT TO authenticated USING (
    user_id = current_user_id()
    OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_user_id = current_user_id())
  );
CREATE POLICY viewing_requests_write_self ON viewing_requests
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

CREATE POLICY quote_requests_read_party ON quote_requests
  FOR SELECT TO authenticated USING (
    user_id = current_user_id()
    OR EXISTS (SELECT 1 FROM contractors c WHERE c.id = contractor_id AND c.user_id = current_user_id())
  );
CREATE POLICY quote_requests_write_self ON quote_requests
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- Share requests are the one thing meant to be seen by strangers: the whole
-- point of the Roommate Finder is that other students find yours.
CREATE POLICY share_requests_read_active ON student_share_requests
  FOR SELECT TO authenticated USING (status = 'active' OR user_id = current_user_id());
CREATE POLICY share_requests_write_self ON student_share_requests
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- Messaging: participants only ----------------------------------------------

CREATE POLICY conversations_read_participant ON conversations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = id AND cp.user_id = current_user_id())
  );
CREATE POLICY participants_read_own ON conversation_participants
  FOR SELECT TO authenticated USING (user_id = current_user_id());
CREATE POLICY participants_write_own ON conversation_participants
  FOR ALL TO authenticated USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- conversation_id is qualified as messages.conversation_id: left bare it
-- resolves to cp.conversation_id (the innermost matching table), which
-- silently turns this into an always-true check. Superseded regardless by
-- backend/999-messaging-production-fix.sql, which re-applies these policies
-- against auth.uid() with this same fix.
CREATE POLICY messages_read_participant ON messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = current_user_id())
  );
CREATE POLICY messages_insert_participant ON messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_user_id = current_user_id()
    AND EXISTS (SELECT 1 FROM conversation_participants cp
                WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = current_user_id())
  );

COMMIT;

-- PostgREST caches the schema. After running this, either wait a few seconds
-- or force it:
--   NOTIFY pgrst, 'reload schema';
