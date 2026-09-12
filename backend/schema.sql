-- ImbaLink – Full schema (with onboarded_at added)
BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

-- --------------------------------------------------------------------------
-- Enumerations
-- --------------------------------------------------------------------------
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'flagged');
CREATE TYPE account_type        AS ENUM ('general', 'student', 'landlord', 'agent', 'company', 'contractor');
CREATE TYPE share_status        AS ENUM ('active', 'withdrawn');
CREATE TYPE request_status      AS ENUM ('requested', 'accepted', 'declined', 'cancelled', 'completed');

-- --------------------------------------------------------------------------
-- Identity
-- --------------------------------------------------------------------------
CREATE TABLE users (
  id                TEXT PRIMARY KEY,
  phone             TEXT,
  phone_normalized  TEXT UNIQUE,
  first_name        TEXT NOT NULL DEFAULT '',
  surname           TEXT NOT NULL DEFAULT '',
  display_name      TEXT NOT NULL DEFAULT '',
  email             TEXT,
  avatar_url        TEXT,
  account_type      account_type NOT NULL DEFAULT 'general',
  onboarded_at      TIMESTAMPTZ,               -- added
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_credentials (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username      CITEXT UNIQUE NOT NULL,
  password_hash JSONB NOT NULL,
  algorithm     TEXT GENERATED ALWAYS AS (password_hash->>'algorithm') STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE phone_verifications (
  id               TEXT PRIMARY KEY,
  phone_normalized TEXT NOT NULL,
  code_hash        TEXT NOT NULL,
  attempts         SMALLINT NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ NOT NULL,
  consumed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_phone_verifications_phone_created ON phone_verifications (phone_normalized, created_at DESC);

CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_id_revoked_null ON sessions (user_id) WHERE revoked_at IS NULL;

-- --------------------------------------------------------------------------
-- Catalog
-- --------------------------------------------------------------------------
-- Moved ahead of student_profiles: student_profiles.university_id references
-- this table, and a forward reference to a not-yet-created table fails
-- `psql -f schema.sql` on a genuinely fresh database (confirmed by actually
-- running this file against a clean Postgres 16 instance during a
-- production-readiness audit — this is likely why the live Supabase
-- project's schema.sql reportedly never applied cleanly there either).
-- Nothing about the tables themselves changed, only their order.
CREATE TABLE universities (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  city       TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  university_id       TEXT REFERENCES universities(id) ON DELETE SET NULL,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  details             JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE properties (
  id                TEXT PRIMARY KEY,
  owner_user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  property_type     TEXT NOT NULL DEFAULT 'Property',
  suburb            TEXT NOT NULL DEFAULT '',
  city              TEXT NOT NULL DEFAULT 'Harare',
  street_address    TEXT,
  rent_usd          NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_usd       NUMERIC(10,2) NOT NULL DEFAULT 0,
  rooms             SMALLINT NOT NULL DEFAULT 0,
  bathrooms         SMALLINT NOT NULL DEFAULT 0,
  bathroom_type     TEXT,
  furnished         BOOLEAN NOT NULL DEFAULT false,
  availability      TEXT,
  lease_term        TEXT,
  electricity       TEXT,
  water             TEXT,
  security          TEXT,
  parking           BOOLEAN NOT NULL DEFAULT false,
  amenities         TEXT[] NOT NULL DEFAULT '{}',
  rules             TEXT[] NOT NULL DEFAULT '{}',
  gradient          TEXT[] NOT NULL DEFAULT '{}',
  landlord_name     TEXT,
  ownership_type    TEXT,
  ownership_ref     TEXT,
  verification      verification_status NOT NULL DEFAULT 'pending',
  is_seed           BOOLEAN NOT NULL DEFAULT false,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fee_percent       NUMERIC(5,2),
  distance_km       NUMERIC(8,2),
  landlord_verified BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_properties_feed ON properties (city, suburb, property_type, rent_usd);
CREATE INDEX idx_properties_verification_created ON properties (verification, created_at DESC);
CREATE INDEX idx_properties_owner_user_id ON properties (owner_user_id);

CREATE TABLE property_images (
  id          TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  width       INT,
  height      INT,
  bytes       INT,
  position    SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_images_property_id_position ON property_images (property_id, position);

CREATE TABLE contractors (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  business_name  TEXT NOT NULL,
  primary_trade  TEXT,
  services       TEXT[] NOT NULL DEFAULT '{}',
  service_areas  TEXT[] NOT NULL DEFAULT '{}',
  phone          TEXT,
  email          TEXT,
  description    TEXT,
  emergency      BOOLEAN NOT NULL DEFAULT false,
  free_quotes    BOOLEAN NOT NULL DEFAULT false,
  verification   verification_status NOT NULL DEFAULT 'pending',
  is_seed        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  contact_name   TEXT,
  city           TEXT,
  area           TEXT,
  rating         NUMERIC(3,2) DEFAULT 0,
  jobs           INTEGER DEFAULT 0
);
CREATE INDEX idx_contractors_primary_trade ON contractors (primary_trade);

-- --------------------------------------------------------------------------
-- Registrations
-- --------------------------------------------------------------------------
CREATE TABLE registrations (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                account_type NOT NULL,
  legal_name          TEXT,
  business_name       TEXT,
  phone               TEXT,
  email               TEXT,
  submitted           JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  reviewed_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_note         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);
CREATE INDEX idx_registrations_verification_created ON registrations (verification_status, created_at DESC);

CREATE TABLE verification_events (
  id            BIGSERIAL PRIMARY KEY,
  subject_type  TEXT NOT NULL,
  subject_id    TEXT NOT NULL,
  from_status   verification_status,
  to_status     verification_status NOT NULL,
  reviewed_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verification_events_subject ON verification_events (subject_type, subject_id, created_at DESC);

-- --------------------------------------------------------------------------
-- Engagement
-- --------------------------------------------------------------------------
CREATE TABLE property_likes (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE property_saves (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE contractor_likes (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contractor_id TEXT NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contractor_id)
);

CREATE TABLE viewing_requests (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  status      request_status NOT NULL DEFAULT 'requested',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

CREATE TABLE quote_requests (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contractor_id TEXT NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        request_status NOT NULL DEFAULT 'requested',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_requests_contractor_created ON quote_requests (contractor_id, created_at DESC);

CREATE TABLE student_share_requests (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id        TEXT REFERENCES properties(id) ON DELETE CASCADE,
  university_id      TEXT REFERENCES universities(id) ON DELETE SET NULL,
  university_name    TEXT,
  roommates_needed   SMALLINT NOT NULL DEFAULT 1,
  budget             TEXT,
  move_in_date       DATE,
  preferences        TEXT,
  preference_tags    TEXT[] NOT NULL DEFAULT '{}',
  about_me           TEXT,
  deposit            TEXT,
  utilities_included TEXT,
  important_notes    TEXT,
  status             share_status NOT NULL DEFAULT 'active',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_share_requests_property_active ON student_share_requests (property_id) WHERE status = 'active';
CREATE UNIQUE INDEX idx_student_share_requests_user_property_active ON student_share_requests (user_id, property_id) WHERE status = 'active';

CREATE TABLE student_interests (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id)
);

-- --------------------------------------------------------------------------
-- Messaging
-- --------------------------------------------------------------------------
CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  subject     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at       TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_messages_conversation_sent ON messages (conversation_id, sent_at);

-- --------------------------------------------------------------------------
-- updated_at maintenance
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','user_credentials','properties','contractors','registrations',
    'viewing_requests','quote_requests','student_share_requests','conversations'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = t || '_touch' AND tgrelid = t::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END $$;

COMMIT;