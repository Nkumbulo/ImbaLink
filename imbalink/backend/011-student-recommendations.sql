-- ImbaLink — student recommendation engine
--
-- A recommendation is eligible only when the candidate shares at least TWO
-- explicit preference tags with the signed-in student. Other compatible signals
-- (university, area, city, accommodation type and budget) improve ranking but
-- cannot bypass the two-preference minimum.
--
-- Run after schema.sql / 002-app-alignment.sql.

DROP FUNCTION IF EXISTS public.get_student_recommendations(integer, text[]);

CREATE OR REPLACE FUNCTION public.get_student_recommendations(
  p_limit integer DEFAULT 12,
  p_exclude_ids text[] DEFAULT '{}'::text[]
)
RETURNS TABLE (
  user_id text,
  name text,
  avatar_url text,
  verification_status text,
  university text,
  study_year text,
  preferred_area text,
  preferred_city text,
  budget text,
  accommodation_preference text,
  roommates_needed text,
  move_in_date text,
  property_id text,
  preferences text,
  preference_tags text[],
  about_me text,
  deposit text,
  utilities_included text,
  important_notes text,
  shared_preference_count integer,
  matched_preferences text[],
  compatibility_score integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH me AS (
  SELECT
    u.id,
    COALESCE(sp.details->>'university', un.name, '') AS university,
    COALESCE(sp.details->>'preferredArea', '') AS preferred_area,
    COALESCE(sp.details->>'preferredCity', '') AS preferred_city,
    COALESCE(sp.details->>'budget', '') AS budget,
    COALESCE(sp.details->>'accommodationPreference', 'Any') AS accommodation_preference,
    COALESCE(sr.preference_tags, ARRAY[]::text[]) AS preference_tags
  FROM users u
  LEFT JOIN student_profiles sp ON sp.user_id = u.id
  LEFT JOIN universities un ON un.id = sp.university_id
  LEFT JOIN LATERAL (
    SELECT s.preference_tags
    FROM student_share_requests s
    WHERE s.user_id = u.id AND s.status = 'active'
    ORDER BY s.updated_at DESC
    LIMIT 1
  ) sr ON true
  WHERE u.id = auth.uid()::text
    AND u.account_type = 'student'
),
candidates AS (
  SELECT
    u.id AS candidate_id,
    COALESCE(NULLIF(u.display_name, ''), NULLIF(trim(u.first_name || ' ' || u.surname), ''), 'Student') AS candidate_name,
    u.avatar_url,
    sp.verification_status::text AS candidate_verification_status,
    COALESCE(NULLIF(sr.university_name, ''), NULLIF(sp.details->>'university', ''), un.name, '') AS candidate_university,
    COALESCE(sp.details->>'studyYear', '') AS candidate_study_year,
    COALESCE(sp.details->>'preferredArea', p.suburb, '') AS candidate_area,
    COALESCE(sp.details->>'preferredCity', p.city, '') AS candidate_city,
    COALESCE(NULLIF(sr.budget, ''), NULLIF(sp.details->>'budget', ''), '') AS candidate_budget,
    COALESCE(sp.details->>'accommodationPreference', 'Any') AS candidate_accommodation,
    COALESCE(sr.roommates_needed::text, sp.details->>'roommatesNeeded', '1') AS candidate_roommates_needed,
    COALESCE(sr.move_in_date::text, '') AS candidate_move_in_date,
    sr.property_id::text AS candidate_property_id,
    COALESCE(sr.preferences, sp.details->>'lifestyleNotes', '') AS candidate_preferences,
    COALESCE(sr.preference_tags, ARRAY[]::text[]) AS candidate_preference_tags,
    COALESCE(sr.about_me, '') AS candidate_about_me,
    COALESCE(sr.deposit, '') AS candidate_deposit,
    COALESCE(sr.utilities_included, '') AS candidate_utilities,
    COALESCE(sr.important_notes, '') AS candidate_notes,
    me.*
  FROM me
  JOIN users u ON u.account_type = 'student' AND u.id <> me.id
  JOIN student_profiles sp ON sp.user_id = u.id
  LEFT JOIN universities un ON un.id = sp.university_id
  JOIN LATERAL (
    SELECT s.*
    FROM student_share_requests s
    WHERE s.user_id = u.id AND s.status = 'active'
    ORDER BY s.updated_at DESC
    LIMIT 1
  ) sr ON true
  LEFT JOIN properties p ON p.id = sr.property_id
  WHERE u.id <> ALL(COALESCE(p_exclude_ids, '{}'::text[]))
),
scored AS (
  SELECT
    c.*,
    ARRAY(
      SELECT tag
      FROM unnest(c.preference_tags) AS tag
      WHERE lower(tag) = ANY(ARRAY(SELECT lower(x) FROM unnest(c.candidate_preference_tags) AS x))
      ORDER BY lower(tag)
    ) AS matched_tags,
    (
      SELECT count(*)::integer
      FROM unnest(c.preference_tags) AS tag
      WHERE lower(tag) = ANY(ARRAY(SELECT lower(x) FROM unnest(c.candidate_preference_tags) AS x))
    ) AS tag_matches,
    (
      CASE WHEN c.university <> '' AND lower(c.university) = lower(c.candidate_university) THEN 1 ELSE 0 END +
      CASE WHEN c.preferred_area <> '' AND lower(c.preferred_area) = lower(c.candidate_area) THEN 1 ELSE 0 END +
      CASE WHEN c.preferred_city <> '' AND lower(c.preferred_city) = lower(c.candidate_city) THEN 1 ELSE 0 END +
      CASE WHEN c.accommodation_preference <> 'Any'
             AND c.candidate_accommodation <> 'Any'
             AND c.accommodation_preference = c.candidate_accommodation THEN 1 ELSE 0 END +
      CASE
        WHEN regexp_replace(c.budget, '[^0-9.]', '', 'g') <> ''
         AND regexp_replace(c.candidate_budget, '[^0-9.]', '', 'g') <> ''
         AND abs(
           regexp_replace(c.budget, '[^0-9.]', '', 'g')::numeric -
           regexp_replace(c.candidate_budget, '[^0-9.]', '', 'g')::numeric
         ) <= 40
        THEN 1 ELSE 0
      END
    ) AS other_matches
  FROM candidates c
),
eligible AS (
  SELECT *
  FROM scored
  WHERE tag_matches >= 2
)
SELECT
  candidate_id,
  candidate_name,
  avatar_url,
  candidate_verification_status,
  candidate_university,
  candidate_study_year,
  candidate_area,
  candidate_city,
  candidate_budget,
  candidate_accommodation,
  candidate_roommates_needed,
  candidate_move_in_date,
  candidate_property_id,
  candidate_preferences,
  candidate_preference_tags,
  candidate_about_me,
  candidate_deposit,
  candidate_utilities,
  candidate_notes,
  tag_matches,
  matched_tags,
  LEAST(100, (tag_matches * 20) + (other_matches * 10))::integer
FROM eligible
ORDER BY tag_matches DESC, other_matches DESC, random()
LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 12));
$$;

REVOKE ALL ON FUNCTION public.get_student_recommendations(integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_recommendations(integer, text[]) TO authenticated;

COMMENT ON FUNCTION public.get_student_recommendations(integer, text[]) IS
'Returns at most 12 active student roommate recommendations for auth.uid(). Candidates must share at least two explicit preference tags. p_exclude_ids is used by the client to rotate only a few cards without replacing the whole recommendation list.';
