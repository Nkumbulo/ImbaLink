-- Allow a signed-in landlord to delete only their own property listings.
-- Run this after 002-app-alignment.sql.

DROP POLICY IF EXISTS properties_delete_own ON public.properties;
CREATE POLICY properties_delete_own ON public.properties
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid()::text);

-- Return aggregate save/interest counts without exposing individual users' save rows.
CREATE OR REPLACE FUNCTION public.get_property_save_counts(property_ids text[])
RETURNS TABLE(property_id text, save_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.property_id::text, COUNT(*)::bigint
  FROM public.property_saves ps
  WHERE ps.property_id::text = ANY(property_ids)
  GROUP BY ps.property_id
$$;

GRANT EXECUTE ON FUNCTION public.get_property_save_counts(text[]) TO authenticated;

-- Make save/unsave events available to the app's realtime feed.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.property_saves;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
