-- Allow landlords to temporarily pause a listing without deleting it.
-- Paused listings remain visible so tenants can understand that the owner
-- has temporarily stopped accepting viewing requests.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_owner_paused
  ON public.properties (owner_user_id, is_paused);

NOTIFY pgrst, 'reload schema';
