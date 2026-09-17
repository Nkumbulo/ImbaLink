-- ImbaLink: listing view counts.
-- Run after backend/002-app-alignment.sql.
--
-- GAP THIS FIXES: "Listing views" (P12 landlord/agent dashboard checklist)
-- had zero supporting infrastructure anywhere — no column, no table, no
-- increment path. A landlord had no way to know whether anyone was
-- actually looking at their listing.

BEGIN;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Counts are informational, not access-controlled, so anyone who can
-- already read the row (properties_read: USING(true)) can read the count
-- too — no separate policy needed.

-- Increments a property's view count. Deliberately does NOT count the
-- owner viewing their own listing (a landlord checking their own page
-- shouldn't be able to inflate their own view count), and is a no-op for
-- a signed-out visitor (auth.uid() IS NULL) rather than raising — viewing
-- a public listing while signed out is normal, expected behavior, not an
-- error condition worth surfacing to the caller.
CREATE OR REPLACE FUNCTION public.record_property_view(p_property_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller text := auth.uid()::text;
  v_property_id text := NULLIF(btrim(p_property_id), '');
  v_owner_id text;
  v_new_count integer;
BEGIN
  IF v_property_id IS NULL THEN RETURN NULL; END IF;

  SELECT owner_user_id::text, view_count INTO v_owner_id, v_new_count
  FROM public.properties WHERE id::text = v_property_id;
  IF v_owner_id IS NULL AND NOT FOUND THEN RETURN NULL; END IF;

  IF v_caller IS NOT NULL AND v_caller = v_owner_id THEN
    RETURN v_new_count; -- owner viewing their own listing: don't count it
  END IF;

  UPDATE public.properties
  SET view_count = view_count + 1
  WHERE id::text = v_property_id
  RETURNING view_count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_property_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_property_view(text) TO authenticated, anon;

-- A Postgres view's column list is fixed at CREATE/REPLACE time — `p.*`
-- does NOT automatically pick up a column added to the base table
-- afterward (confirmed: view_count was invisible through
-- properties_with_meta/properties_feed until these were re-run, even
-- though both select p.* from properties). Both views need to be
-- recreated so the new column actually reaches the client — same
-- definitions as backend/010-properties-with-meta-view.sql, copied here
-- rather than only there so this migration is self-sufficient if run on
-- its own against a project where 010 already ran once.
--
-- CREATE OR REPLACE VIEW isn't enough here and was confirmed to fail
-- (42P16 "cannot change name of view column"): Postgres only allows
-- REPLACE to append new columns at the end of a view's column list, not
-- insert one wherever it falls in p.*'s expansion — which is exactly
-- what happens here, since view_count isn't the last column on
-- properties. DROP + CREATE is required instead.
DROP VIEW IF EXISTS public.properties_with_meta;
CREATE VIEW public.properties_with_meta AS
SELECT
  p.*,
  up.avatar_url AS avatar_url,
  COALESCE(sc.save_count, 0)::bigint AS save_count
FROM public.properties p
LEFT JOIN public.public_user_profiles up ON up.id = p.owner_user_id
LEFT JOIN (
  SELECT property_id, COUNT(*) AS save_count
  FROM public.property_saves
  GROUP BY property_id
) sc ON sc.property_id::text = p.id::text;

GRANT SELECT ON public.properties_with_meta TO authenticated, anon;

DROP VIEW IF EXISTS public.properties_feed;
CREATE VIEW public.properties_feed AS
SELECT
  p.*,
  up.avatar_url AS avatar_url,
  COALESCE(sc.save_count, 0)::bigint AS save_count,
  cover.url AS cover_image_url
FROM public.properties p
LEFT JOIN public.public_user_profiles up ON up.id = p.owner_user_id
LEFT JOIN (
  SELECT property_id, COUNT(*) AS save_count
  FROM public.property_saves
  GROUP BY property_id
) sc ON sc.property_id::text = p.id::text
LEFT JOIN LATERAL (
  SELECT url FROM public.property_images pi
  WHERE pi.property_id = p.id
  ORDER BY pi.position ASC
  LIMIT 1
) cover ON true;

GRANT SELECT ON public.properties_feed TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
