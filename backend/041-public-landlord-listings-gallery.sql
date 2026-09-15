-- ImbaLink: public listing + complete gallery contract
--
-- A landlord-created listing is public platform content unless it has been
-- explicitly flagged/rejected. Its gallery metadata and Storage objects are
-- also public-readable so every visitor can see the same photos.

BEGIN;

DROP POLICY IF EXISTS properties_read ON public.properties;
CREATE POLICY properties_read ON public.properties
  FOR SELECT TO anon, authenticated
  USING (
    public.is_staff_caller()
    OR owner_user_id = auth.uid()::text
    OR verification IS NULL
    OR verification NOT IN ('flagged', 'rejected')
  );

ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_images_read ON public.property_images;
CREATE POLICY property_images_read ON public.property_images
  FOR SELECT TO anon, authenticated
  USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[];

DROP POLICY IF EXISTS "property images public read" ON storage.objects;
CREATE POLICY "property images public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'property-images');

ALTER VIEW IF EXISTS public.properties_feed SET (security_invoker = true);
ALTER VIEW IF EXISTS public.properties_with_meta SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';
COMMIT;
