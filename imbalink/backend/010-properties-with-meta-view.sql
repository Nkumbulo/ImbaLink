-- ImbaLink — performance fixes for the initial "Connecting spaces" load and
-- the property feed generally. Two views:
--   1. properties_with_meta — used by getPropertyById() and the legacy
--      full-dataset fallback path; every property column plus owner
--      avatar and save count in one query.
--   2. properties_feed — used by getProperties() (the actual scrollable
--      listing feed); same as above but with only ONE cover photo per
--      listing instead of the whole gallery, built for real server-side
--      pagination/filtering rather than "fetch everything, slice in JS".
--      See its own comment below for why this one matters most.
--
-- Root cause of the ORIGINAL slowness: loading properties required TWO
-- SEQUENTIAL round trips — first `properties`, then (only once that came
-- back, since it needs each row's owner_user_id and id) a second trip for
-- owner profiles and save counts. Both views below collapse that into one
-- query. Safe to run more than once (CREATE OR REPLACE VIEW).
--
-- Depends on: properties, users, property_images, property_saves, and the
-- public_user_profiles view (already created by
-- 999-messaging-production-fix.sql or 002-app-alignment.sql — either is
-- fine, this doesn't care which one created it, only that it exists).

CREATE OR REPLACE VIEW public.properties_with_meta AS
SELECT
  p.*,
  -- Aliased plainly as `avatar_url` — properties has no column of that
  -- name itself, and rowToProperty() on the frontend already reads
  -- `row.avatar_url` as its fallback for the owner's photo, so no
  -- frontend field-name changes are needed beyond querying this view.
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

-- --------------------------------------------------------------------------
-- properties_feed: the actual fix for "still slow", per how large listing
-- apps (Facebook Marketplace, Airbnb, etc.) load a feed — two things this
-- app wasn't doing:
--
-- 1. FILTER AND PAGINATE IN THE DATABASE, not in the browser. The previous
--    approach fetched the ENTIRE properties table (every listing that has
--    ever existed) into memory on first load, then filtered/sliced it down
--    to one page in JavaScript. That doesn't scale — it means the initial
--    load time grows with the total number of listings ever created, not
--    with the 24 the user is actually about to see, and it never gets
--    faster no matter how targeted the fast-loading view above is,
--    because the one query it made was still "give me everything."
--
-- 2. ONE THUMBNAIL PER CARD, not the whole gallery. A feed card only ever
--    shows a single cover photo — the full gallery only matters once
--    someone opens a specific listing (getPropertyById already handles
--    that separately, correctly). The previous query fetched every photo
--    of every listing just to render a grid of single-photo cards.
--
-- properties_feed exposes exactly the columns the feed needs, with a
-- LATERAL join picking only the lowest-position image per listing instead
-- of the whole gallery. getProperties() below then does real server-side
-- .eq()/.gte()/.lte()/.range() filtering and pagination against this view,
-- instead of pulling everything and filtering client-side.
-- --------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.properties_feed AS
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
