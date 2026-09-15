-- Admin photo review/deletion for landlord listings.
-- Image reads remain public for the marketplace; destructive image deletion is admin-only.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_delete_property_image(p_image_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_actor text := auth.uid()::text;
  v_image public.property_images%ROWTYPE;
BEGIN
  PERFORM public.admin_require_admin();
  SELECT * INTO v_image FROM public.property_images WHERE id=p_image_id FOR UPDATE;
  IF v_image.id IS NULL THEN RAISE EXCEPTION 'PROPERTY_IMAGE_NOT_FOUND'; END IF;

  DELETE FROM public.property_images WHERE id=p_image_id;

  INSERT INTO public.admin_audit_log(actor_user_id, action, resource_type, resource_id, metadata)
  VALUES(v_actor, 'property.image_deleted', 'property_image', p_image_id,
    jsonb_build_object('property_id', v_image.property_id, 'url', v_image.url, 'position', v_image.position));

  RETURN jsonb_build_object('id', v_image.id, 'property_id', v_image.property_id, 'url', v_image.url, 'position', v_image.position);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_property_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_property_image(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
