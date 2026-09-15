BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('property-images', 'property-images', true, 10485760,
        ARRAY['image/jpeg','image/png','image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[];

DROP POLICY IF EXISTS "property images public read" ON storage.objects;
CREATE POLICY "property images public read" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "property images owner upload" ON storage.objects;
CREATE POLICY "property images owner upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'property-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "property images owner update" ON storage.objects;
CREATE POLICY "property images owner update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'property-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'property-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "property images owner delete" ON storage.objects;
CREATE POLICY "property images owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'property-images' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_images_read ON public.property_images;
CREATE POLICY property_images_read ON public.property_images FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS property_images_write_own ON public.property_images;
CREATE POLICY property_images_write_own ON public.property_images FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_user_id = auth.uid()::text))
WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_user_id = auth.uid()::text));

NOTIFY pgrst, 'reload schema';
COMMIT;
