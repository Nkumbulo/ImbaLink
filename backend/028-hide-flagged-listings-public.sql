-- ImbaLink — Hide flagged/rejected listings from regular users
--
-- Public browsing must never expose a listing that an administrator has
-- flagged or declined. Owners may still read their own listing so they can
-- see the review state and fix it; staff retain full visibility for operations.
-- This is enforced at the database/RLS layer, not just in React, so direct
-- PostgREST queries and deep links cannot bypass the rule.

BEGIN;

DROP POLICY IF EXISTS properties_read ON public.properties;

CREATE POLICY properties_read ON public.properties
  FOR SELECT TO anon, authenticated
  USING (
    public.is_staff_caller()
    OR owner_user_id = auth.uid()::text
    OR verification NOT IN ('flagged', 'rejected')
  );

-- These are public-facing views used by the listing feed and property pages.
-- security_invoker makes the views respect the caller's RLS policy above
-- instead of exposing rows through the view owner's privileges.
ALTER VIEW IF EXISTS public.properties_feed SET (security_invoker = true);
ALTER VIEW IF EXISTS public.properties_with_meta SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';

COMMIT;
