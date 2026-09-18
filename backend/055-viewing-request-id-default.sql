-- ImbaLink: viewing request id safety.
-- The viewing_requests table uses TEXT ids and historically had no DEFAULT.
-- Any client upsert that omitted id therefore failed with 23502.
-- Keep existing ids untouched and generate the same readable id format for new rows.

ALTER TABLE public.viewing_requests
  ALTER COLUMN id SET DEFAULT ('viewing_' || gen_random_uuid()::text);
