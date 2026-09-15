-- ImbaLink registration persistence alignment
-- Run this after the base schema migrations.
--
-- The main registrations table stores account/hub registrations whose kind is
-- one of the account_type enum values. Pro membership is not an account type,
-- so it gets its own table instead of overloading account_type.

CREATE TABLE IF NOT EXISTS pro_registrations (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_id     TEXT NOT NULL DEFAULT 'monthly',
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_registrations_plan
  ON pro_registrations (plan_id);
