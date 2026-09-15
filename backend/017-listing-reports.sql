-- ImbaLink: listing reports.
-- Run after backend/013-security-hardening.sql (needs is_staff_caller()).
--
-- GAP THIS FIXES: "Report listing" (P8 of the production-readiness audit)
-- had no button, no table, no RLS, no RPC — nothing. It also happens to be
-- exactly the "Reports" line item the P4 moderation checklist called for
-- and which nothing else in this codebase provided either. One feature
-- closes both gaps.

BEGIN;

CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- subject_type/subject_id is deliberately polymorphic, same pattern as
-- verification_events — only 'property' is used today, but a report on a
-- user or a message is the same shape of problem if this ever needs to
-- extend. No FK on subject_id for the same reason a polymorphic FK can't
-- exist in Postgres; report_listing() below validates the property itself
-- exists before inserting, which is the enforcement that matters.
CREATE TABLE IF NOT EXISTS public.reports (
  id                text PRIMARY KEY,
  reporter_user_id  text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_type      text NOT NULL,
  subject_id        text NOT NULL,
  reason            text NOT NULL,
  note              text,
  status            report_status NOT NULL DEFAULT 'open',
  reviewed_by       text,
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_subject ON public.reports (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON public.reports (status, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- A reporter can see their own reports (so the UI can show "already
-- reported"); staff/admin can see every report for moderation.
DROP POLICY IF EXISTS reports_read ON public.reports;
CREATE POLICY reports_read ON public.reports
FOR SELECT TO authenticated
USING (reporter_user_id = auth.uid()::text OR public.is_staff_caller());

-- No INSERT policy at all — same reasoning as conversations_insert being
-- routed exclusively through a SECURITY DEFINER RPC rather than a broad
-- WITH CHECK(true): report_listing() below is the only creation path, so
-- reason/subject validation and the anti-spam check happen every time,
-- not just when the client happens to send well-formed data.
DROP POLICY IF EXISTS reports_update_staff ON public.reports;
CREATE POLICY reports_update_staff ON public.reports
FOR UPDATE TO authenticated
USING (public.is_staff_caller())
WITH CHECK (public.is_staff_caller());

CREATE OR REPLACE FUNCTION public.report_listing(
  p_property_id text,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller text := auth.uid()::text;
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_reason text := NULLIF(btrim(p_reason), '');
  v_report_id text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF v_property_id IS NULL THEN RAISE EXCEPTION 'Property not found.'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Please choose a reason for reporting this listing.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id::text = v_property_id) THEN
    RAISE EXCEPTION 'This listing no longer exists.';
  END IF;

  -- If this reporter already has an open/reviewing report on this exact
  -- listing, return that report instead of creating a duplicate — lets
  -- the UI safely call this again (e.g. re-opening the report sheet)
  -- without spamming the moderation queue.
  SELECT id INTO v_report_id FROM public.reports
  WHERE reporter_user_id = v_caller AND subject_type = 'property' AND subject_id = v_property_id
    AND status IN ('open', 'reviewing')
  LIMIT 1;
  IF v_report_id IS NOT NULL THEN
    RETURN v_report_id;
  END IF;

  v_report_id := 'report_' || gen_random_uuid()::text;
  INSERT INTO public.reports (id, reporter_user_id, subject_type, subject_id, reason, note)
  VALUES (v_report_id, v_caller, 'property', v_property_id, v_reason, NULLIF(btrim(p_note), ''));

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_listing(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_listing(text, text, text) TO authenticated;

-- Staff-only status transition (resolve/dismiss/etc), mirroring
-- respond_to_viewing_request's shape: validated server-side rather than
-- trusting a bare UPDATE through the RLS policy above to only ever send
-- legal status values.
CREATE OR REPLACE FUNCTION public.set_report_status(
  p_report_id text,
  p_status report_status
)
RETURNS public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller text := auth.uid()::text;
  v_row public.reports;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF NOT public.is_staff_caller() THEN RAISE EXCEPTION 'STAFF_ROLE_REQUIRED'; END IF;

  UPDATE public.reports
  SET status = p_status, reviewed_by = v_caller, reviewed_at = now()
  WHERE id = p_report_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Report not found.'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_report_status(text, report_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_report_status(text, report_status) TO authenticated;

-- Table grants for a brand-new table aren't implied by role membership —
-- matches the explicit GRANT on viewing_requests in
-- backend/007-real-save-count-and-owner-messaging.sql. RLS above still
-- governs which rows are visible/writable; this only grants the ability
-- to attempt the operation at all.
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;

COMMIT;
