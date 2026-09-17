BEGIN;

-- Phase 10: privacy-scoped sync projections.
-- The Phase 9 sequence remains global so cursors stay monotonic, but the
-- reader now exposes only records the authenticated user is allowed to know
-- about. Sensitive columns are projected out before leaving the database.

CREATE OR REPLACE FUNCTION public.sync_safe_record(p_collection text, p_action text, p_record jsonb, p_record_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE r jsonb := coalesce(p_record, '{}'::jsonb);
BEGIN
  IF p_collection = 'profiles' THEN
    RETURN jsonb_build_object(
      'id', coalesce(r->>'id', p_record_id),
      'userId', coalesce(r->>'id', p_record_id),
      'phone', r->>'phone',
      'firstName', coalesce(r->>'first_name',''),
      'surname', coalesce(r->>'surname',''),
      'displayName', coalesce(r->>'display_name',''),
      'email', r->>'email',
      'avatarUrl', r->>'avatar_url',
      'accountType', r->>'account_type',
      'onboardedAt', r->>'onboarded_at',
      'createdAt', r->>'created_at',
      'updatedAt', r->>'updated_at'
    );
  ELSIF p_collection = 'properties' THEN
    RETURN jsonb_build_object(
      'id', coalesce(r->>'id', p_record_id), 'title', r->>'title',
      'description', r->>'description', 'propertyType', r->>'property_type',
      'suburb', r->>'suburb', 'city', r->>'city', 'streetAddress', r->>'street_address',
      'rentUsd', r->>'rent_usd', 'depositUsd', r->>'deposit_usd', 'rooms', r->>'rooms',
      'bathrooms', r->>'bathrooms', 'bathroomType', r->>'bathroom_type',
      'furnished', r->>'furnished', 'availability', r->>'availability',
      'leaseTerm', r->>'lease_term', 'electricity', r->>'electricity', 'water', r->>'water',
      'security', r->>'security', 'parking', r->>'parking', 'amenities', r->'amenities',
      'rules', r->'rules', 'gradient', r->'gradient', 'landlordName', r->>'landlord_name',
      'ownershipType', r->>'ownership_type', 'verification', r->>'verification',
      'publishedAt', r->>'published_at', 'createdAt', r->>'created_at',
      'updatedAt', r->>'updated_at', 'landlordVerified', r->>'landlord_verified'
    );
  ELSIF p_collection = 'contractors' THEN
    RETURN jsonb_build_object(
      'id', coalesce(r->>'id', p_record_id), 'businessName', r->>'business_name',
      'primaryTrade', r->>'primary_trade', 'services', r->'services',
      'serviceAreas', r->'service_areas', 'phone', r->>'phone', 'email', r->>'email',
      'description', r->>'description', 'emergency', r->>'emergency',
      'freeQuotes', r->>'free_quotes', 'verification', r->>'verification',
      'createdAt', r->>'created_at', 'updatedAt', r->>'updated_at',
      'contactName', r->>'contact_name', 'city', r->>'city', 'area', r->>'area',
      'rating', r->>'rating', 'jobs', r->>'jobs'
    );
  ELSIF p_collection = 'propertyLikes' THEN
    RETURN jsonb_build_object('id', p_record_id, 'userId', r->>'user_id', 'itemId', r->>'property_id', 'liked', true, 'createdAt', r->>'created_at', 'updatedAt', r->>'created_at');
  ELSIF p_collection = 'propertySaves' THEN
    RETURN jsonb_build_object('id', p_record_id, 'userId', r->>'user_id', 'itemId', r->>'property_id', 'liked', true, 'createdAt', r->>'created_at', 'updatedAt', r->>'created_at');
  ELSIF p_collection = 'contractorLikes' THEN
    RETURN jsonb_build_object('id', p_record_id, 'userId', r->>'user_id', 'itemId', r->>'contractor_id', 'liked', true, 'createdAt', r->>'created_at', 'updatedAt', r->>'created_at');
  ELSIF p_collection = 'viewingRequests' THEN
    RETURN jsonb_build_object('id', coalesce(r->>'id', p_record_id), 'userId', r->>'user_id', 'propertyId', r->>'property_id', 'status', r->>'status', 'createdAt', r->>'created_at', 'updatedAt', r->>'updated_at');
  ELSIF p_collection = 'quoteRequests' THEN
    RETURN jsonb_build_object('id', coalesce(r->>'id', p_record_id), 'userId', r->>'user_id', 'contractorId', r->>'contractor_id', 'details', r->'details', 'status', r->>'status', 'createdAt', r->>'created_at', 'updatedAt', r->>'updated_at');
  ELSIF p_collection = 'shareRequests' THEN
    RETURN jsonb_build_object('id', coalesce(r->>'id', p_record_id), 'userId', r->>'user_id', 'propertyId', r->>'property_id', 'universityId', r->>'university_id', 'universityName', r->>'university_name', 'roommatesNeeded', r->>'roommates_needed', 'budget', r->>'budget', 'moveInDate', r->>'move_in_date', 'preferences', r->>'preferences', 'preferenceTags', r->'preference_tags', 'aboutMe', r->>'about_me', 'deposit', r->>'deposit', 'utilitiesIncluded', r->>'utilities_included', 'importantNotes', r->>'important_notes', 'status', r->>'status', 'createdAt', r->>'created_at', 'updatedAt', r->>'updated_at');
  ELSIF p_collection = 'studentInterests' THEN
    RETURN jsonb_build_object('id', p_record_id, 'userId', r->>'user_id', 'targetId', r->>'target_id', 'createdAt', r->>'created_at');
  ELSIF p_collection = 'messages' THEN
    RETURN jsonb_build_object('id', coalesce(r->>'id', p_record_id), 'conversationId', r->>'conversation_id', 'senderUserId', r->>'sender_user_id', 'body', r->>'body', 'sentAt', r->>'sent_at', 'editedAt', r->>'edited_at', 'deletedAt', r->>'deleted_at', 'updatedAt', coalesce(r->>'edited_at',r->>'sent_at'));
  ELSIF p_collection = 'registrations' THEN
    RETURN jsonb_build_object('id', coalesce(r->>'id', p_record_id), 'userId', r->>'user_id', 'kind', r->>'kind', 'legalName', r->>'legal_name', 'businessName', r->>'business_name', 'phone', r->>'phone', 'email', r->>'email', 'submitted', r->'submitted', 'verificationStatus', r->>'verification_status', 'createdAt', r->>'created_at', 'updatedAt', r->>'updated_at');
  END IF;
  RETURN jsonb_build_object('id', p_record_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_record_visible(p_collection text, p_record jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE uid text := auth.uid()::text; rid text;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF p_collection IN ('properties','contractors') THEN
    RETURN true;
  ELSIF p_collection = 'profiles' OR p_collection = 'registrations' THEN
    RETURN p_record->>'id' = uid OR p_record->>'user_id' = uid;
  ELSIF p_collection IN ('propertyLikes','propertySaves','contractorLikes','studentInterests') THEN
    RETURN p_record->>'user_id' = uid;
  ELSIF p_collection = 'viewingRequests' OR p_collection = 'quoteRequests' OR p_collection = 'shareRequests' THEN
    IF p_record->>'user_id' = uid THEN RETURN true; END IF;
    IF p_collection = 'viewingRequests' THEN
      RETURN EXISTS (SELECT 1 FROM public.properties p WHERE p.id = p_record->>'property_id' AND p.owner_user_id = uid);
    ELSIF p_collection = 'quoteRequests' THEN
      RETURN EXISTS (SELECT 1 FROM public.contractors c WHERE c.id = p_record->>'contractor_id' AND c.user_id = uid);
    END IF;
    RETURN false;
  ELSIF p_collection = 'messages' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = p_record->>'conversation_id' AND cp.user_id = uid
    );
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_changes_after(p_cursor bigint DEFAULT 0, p_limit integer DEFAULT 200)
RETURNS TABLE(sequence_id bigint, collection text, action text, record_id text, record jsonb, occurred_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT s.sequence_id, s.collection, s.action,
    CASE
      WHEN s.collection = 'propertyLikes' THEN coalesce(s.record->>'user_id','') || ':' || coalesce(s.record->>'property_id','')
      WHEN s.collection = 'propertySaves' THEN coalesce(s.record->>'user_id','') || ':' || coalesce(s.record->>'property_id','')
      WHEN s.collection = 'contractorLikes' THEN coalesce(s.record->>'user_id','') || ':' || coalesce(s.record->>'contractor_id','')
      WHEN s.collection = 'studentInterests' THEN coalesce(s.record->>'user_id','') || ':' || coalesce(s.record->>'target_id','')
      ELSE s.record_id
    END AS record_id,
    public.sync_safe_record(s.collection,s.action,s.record,s.record_id) AS record,
    s.occurred_at
  FROM public.sync_changes s
  WHERE auth.uid() IS NOT NULL
    AND s.sequence_id > greatest(coalesce(p_cursor,0),0)
    AND public.sync_record_visible(s.collection,s.record)
  ORDER BY s.sequence_id
  LIMIT least(greatest(coalesce(p_limit,200),1),500);
$$;

GRANT EXECUTE ON FUNCTION public.sync_safe_record(text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_record_visible(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_changes_after(bigint,integer) TO authenticated;

COMMIT;
