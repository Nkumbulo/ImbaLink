-- ImbaLink recommendation signals.
-- The Link button is an explicit "show me more like this" signal, not a save
-- and not a share. We retain the property attributes that mattered at click
-- time so recommendations remain useful even after a listing changes.
CREATE TABLE IF NOT EXISTS public.property_recommendation_signals (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_property_recommendation_signals_user_created
  ON public.property_recommendation_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_recommendation_signals_property
  ON public.property_recommendation_signals(property_id);
ALTER TABLE public.property_recommendation_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_recommendation_signals_rw_self ON public.property_recommendation_signals;
CREATE POLICY property_recommendation_signals_rw_self ON public.property_recommendation_signals
  FOR ALL TO authenticated
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

CREATE OR REPLACE FUNCTION public.record_property_recommendation(
  p_property_id TEXT,
  p_snapshot JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid TEXT := public.current_user_id();
DECLARE owner_id TEXT;
BEGIN
  IF uid IS NULL OR p_property_id IS NULL OR btrim(p_property_id) = '' THEN RETURN; END IF;
  SELECT owner_user_id INTO owner_id FROM public.properties WHERE id = p_property_id;
  -- Owners clicking their own listing should not distort their renter profile.
  IF owner_id IS NOT NULL AND owner_id = uid THEN RETURN; END IF;
  -- Do not create a database row every time someone taps the same Link icon.
  -- A fresh signal for the same property after 24h is enough to reinforce the
  -- preference while keeping the table small and meaningful.
  IF EXISTS (
    SELECT 1 FROM public.property_recommendation_signals
    WHERE user_id = uid AND property_id = p_property_id
      AND created_at > now() - interval '24 hours'
  ) THEN RETURN; END IF;
  INSERT INTO public.property_recommendation_signals(user_id, property_id, snapshot)
  VALUES(uid, p_property_id, COALESCE(p_snapshot, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.record_property_recommendation(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_property_recommendation(TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_property_recommendation_profile()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
WITH s AS (
  SELECT snapshot, created_at,
    EXP(-EXTRACT(EPOCH FROM (now() - created_at)) / 2592000.0) AS weight
  FROM public.property_recommendation_signals
  WHERE user_id = public.current_user_id()
  ORDER BY created_at DESC
  LIMIT 100
),
city_scores AS (
  SELECT snapshot->>'city' key, SUM(weight) score FROM s WHERE COALESCE(snapshot->>'city','') <> '' GROUP BY 1
),
suburb_scores AS (
  SELECT snapshot->>'suburb' key, SUM(weight) score FROM s WHERE COALESCE(snapshot->>'suburb','') <> '' GROUP BY 1
),
type_scores AS (
  SELECT snapshot->>'type' key, SUM(weight) score FROM s WHERE COALESCE(snapshot->>'type','') <> '' GROUP BY 1
),
stats AS (
  SELECT
    AVG(NULLIF((snapshot->>'rent')::numeric, 0)) avg_rent,
    MIN(NULLIF((snapshot->>'rent')::numeric, 0)) min_rent,
    MAX(NULLIF((snapshot->>'rent')::numeric, 0)) max_rent,
    AVG(NULLIF((snapshot->>'rooms')::numeric, 0)) avg_rooms,
    AVG(CASE WHEN COALESCE((snapshot->>'furnished')::boolean, false) THEN 1.0 ELSE 0.0 END) furnished_score,
    AVG(CASE WHEN COALESCE((snapshot->>'parking')::boolean, false) THEN 1.0 ELSE 0.0 END) parking_score
  FROM s
)
SELECT jsonb_build_object(
  'signals', (SELECT count(*) FROM s),
  'cities', COALESCE((SELECT jsonb_object_agg(key, score) FROM city_scores), '{}'::jsonb),
  'suburbs', COALESCE((SELECT jsonb_object_agg(key, score) FROM suburb_scores), '{}'::jsonb),
  'types', COALESCE((SELECT jsonb_object_agg(key, score) FROM type_scores), '{}'::jsonb),
  'avgRent', COALESCE((SELECT avg_rent FROM stats), 0),
  'minRent', COALESCE((SELECT min_rent FROM stats), 0),
  'maxRent', COALESCE((SELECT max_rent FROM stats), 0),
  'avgRooms', COALESCE((SELECT avg_rooms FROM stats), 0),
  'furnishedScore', COALESCE((SELECT furnished_score FROM stats), 0),
  'parkingScore', COALESCE((SELECT parking_score FROM stats), 0)
);
$$;
REVOKE ALL ON FUNCTION public.get_property_recommendation_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_property_recommendation_profile() TO authenticated;
