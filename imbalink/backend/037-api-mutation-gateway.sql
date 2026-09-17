BEGIN;

-- Phase 11: transactional mutation gateway.
-- The Edge Function calls this single SECURITY DEFINER RPC.  The mutation,
-- authorization and idempotency record therefore share one PostgreSQL
-- transaction.  A transaction-scoped advisory lock closes the concurrent
-- duplicate-request race around the idempotency ledger.

CREATE OR REPLACE FUNCTION public.api_mutation(
  p_operation text,
  p_mutation_id text,
  p_entity_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid text := auth.uid()::text;
  existing jsonb;
  result jsonb := '{}'::jsonb;
  row_json jsonb;
  v_id text;
  v_property_id text;
  v_conversation_id text;
  v_status text;
  v_kind text;
  v_contractor_id text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF nullif(trim(p_mutation_id),'') IS NULL THEN RAISE EXCEPTION 'SYNC_MUTATION_ID_REQUIRED'; END IF;
  IF length(p_mutation_id) > 255 THEN RAISE EXCEPTION 'SYNC_MUTATION_ID_TOO_LONG'; END IF;
  IF nullif(trim(p_operation),'') IS NULL THEN RAISE EXCEPTION 'MUTATION_OPERATION_REQUIRED'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(uid || ':' || left(p_mutation_id,255), 0));
  existing := public.sync_get_idempotent_response(p_mutation_id);
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'statusCode', (existing->>'status_code')::int, 'data', existing->'response');
  END IF;

  CASE p_operation
    WHEN 'listing.create' THEN
      INSERT INTO public.properties (
        id, owner_user_id, title, description, property_type, suburb, city,
        street_address, rent_usd, deposit_usd, rooms, bathrooms, bathroom_type,
        furnished, availability, lease_term, electricity, water, security,
        parking, amenities, rules, gradient, landlord_name, ownership_type,
        ownership_ref, verification, published_at, fee_percent, distance_km,
        landlord_verified
      )
      SELECT
        coalesce(nullif(p_payload->>'id',''), p_entity_id), uid,
        coalesce(p_payload->>'title',''), coalesce(p_payload->>'description',''),
        coalesce(p_payload->>'property_type','Property'), coalesce(p_payload->>'suburb',''),
        coalesce(p_payload->>'city','Harare'), p_payload->>'street_address',
        coalesce((p_payload->>'rent_usd')::numeric,0), coalesce((p_payload->>'deposit_usd')::numeric,0),
        coalesce((p_payload->>'rooms')::smallint,0), coalesce((p_payload->>'bathrooms')::smallint,0),
        p_payload->>'bathroom_type', coalesce((p_payload->>'furnished')::boolean,false),
        p_payload->>'availability', p_payload->>'lease_term', p_payload->>'electricity',
        p_payload->>'water', p_payload->>'security', coalesce((p_payload->>'parking')::boolean,false),
        coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'amenities','[]'::jsonb))), '{}'),
        coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'rules','[]'::jsonb))), '{}'),
        coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'gradient','[]'::jsonb))), '{}'),
        p_payload->>'landlord_name', p_payload->>'ownership_type', p_payload->>'ownership_ref',
        coalesce(p_payload->>'verification','pending')::verification_status,
        CASE WHEN p_payload->>'published_at' IS NULL THEN NULL ELSE (p_payload->>'published_at')::timestamptz END,
        CASE WHEN p_payload->>'fee_percent' IS NULL THEN NULL ELSE (p_payload->>'fee_percent')::numeric END,
        CASE WHEN p_payload->>'distance_km' IS NULL THEN NULL ELSE (p_payload->>'distance_km')::numeric END,
        coalesce((p_payload->>'landlord_verified')::boolean,false)
      ON CONFLICT (id) DO UPDATE SET updated_at=now()
      WHERE properties.owner_user_id=uid;
      SELECT to_jsonb(p) INTO row_json FROM public.properties p WHERE p.id=coalesce(nullif(p_payload->>'id',''),p_entity_id) AND p.owner_user_id=uid;
      IF row_json IS NULL THEN RAISE EXCEPTION 'LISTING_CREATE_NOT_AUTHORIZED'; END IF;
      result := row_json;

    WHEN 'listing.update' THEN
      UPDATE public.properties SET
        title=coalesce(p_payload->>'title',title), description=coalesce(p_payload->>'description',description),
        property_type=coalesce(p_payload->>'property_type',property_type), suburb=coalesce(p_payload->>'suburb',suburb),
        city=coalesce(p_payload->>'city',city), street_address=coalesce(p_payload->>'street_address',street_address),
        rent_usd=coalesce((p_payload->>'rent_usd')::numeric,rent_usd), deposit_usd=coalesce((p_payload->>'deposit_usd')::numeric,deposit_usd),
        rooms=coalesce((p_payload->>'rooms')::smallint,rooms), bathrooms=coalesce((p_payload->>'bathrooms')::smallint,bathrooms),
        bathroom_type=coalesce(p_payload->>'bathroom_type',bathroom_type), furnished=coalesce((p_payload->>'furnished')::boolean,furnished),
        availability=coalesce(p_payload->>'availability',availability), lease_term=coalesce(p_payload->>'lease_term',lease_term),
        electricity=coalesce(p_payload->>'electricity',electricity), water=coalesce(p_payload->>'water',water),
        security=coalesce(p_payload->>'security',security), parking=coalesce((p_payload->>'parking')::boolean,parking),
        amenities=CASE WHEN p_payload ? 'amenities' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'amenities')) ELSE amenities END,
        rules=CASE WHEN p_payload ? 'rules' THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'rules')) ELSE rules END,
        updated_at=now()
      WHERE id=p_entity_id AND owner_user_id=uid;
      IF NOT FOUND THEN RAISE EXCEPTION 'LISTING_UPDATE_NOT_AUTHORIZED'; END IF;
      SELECT to_jsonb(p) INTO result FROM public.properties p WHERE p.id=p_entity_id;

    WHEN 'listing.delete' THEN
      DELETE FROM public.properties WHERE id=p_entity_id AND owner_user_id=uid;
      IF NOT FOUND THEN RAISE EXCEPTION 'LISTING_DELETE_NOT_AUTHORIZED'; END IF;
      result := jsonb_build_object('id',p_entity_id,'deleted',true);

    WHEN 'registration.upsert' THEN
      v_kind := lower(trim(coalesce(p_payload->>'kind','')));
      IF v_kind NOT IN ('landlord','agent','company','contractor') THEN RAISE EXCEPTION 'REGISTRATION_KIND_INVALID'; END IF;
      IF coalesce(p_payload->>'user_id',uid) <> uid THEN RAISE EXCEPTION 'REGISTRATION_NOT_AUTHORIZED'; END IF;
      INSERT INTO public.registrations(id,user_id,kind,legal_name,business_name,phone,email,submitted,verification_status)
      VALUES(
        coalesce(nullif(p_payload->>'id',''),p_entity_id), uid, v_kind::account_type,
        nullif(p_payload->>'legal_name',''), nullif(p_payload->>'business_name',''),
        nullif(p_payload->>'phone',''), nullif(p_payload->>'email',''),
        coalesce(p_payload->'submitted','{}'::jsonb), coalesce(p_payload->>'verification_status','pending')::verification_status
      )
      ON CONFLICT(user_id,kind) DO UPDATE SET
        legal_name=excluded.legal_name, business_name=excluded.business_name, phone=excluded.phone, email=excluded.email,
        submitted=excluded.submitted, updated_at=now()
      RETURNING to_jsonb(registrations.*) INTO result;
      UPDATE public.users SET account_type = CASE v_kind WHEN 'landlord' THEN 'landlord'::account_type WHEN 'agent' THEN 'agent'::account_type WHEN 'company' THEN 'company'::account_type WHEN 'contractor' THEN 'contractor'::account_type ELSE account_type END, onboarded_at=coalesce(onboarded_at,now()), updated_at=now() WHERE id=uid;
      IF v_kind='contractor' THEN
        v_contractor_id := coalesce(result->'submitted'->>'contractorId', p_payload->'submitted'->>'contractorId', 'contractor_' || replace(uid,'-',''));
        INSERT INTO public.contractors(id,user_id,business_name,primary_trade,services,service_areas,phone,email,description,emergency,free_quotes,verification,contact_name,city,area)
        VALUES(v_contractor_id,uid,coalesce(p_payload->'submitted'->>'businessName',p_payload->>'business_name',p_payload->'legal_name','Contractor'),p_payload->'submitted'->>'primaryTrade',
          coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'submitted'->'services','[]'::jsonb))),'{}'),
          coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'submitted'->'areas','[]'::jsonb))),'{}'),
          p_payload->>'phone',p_payload->>'email',p_payload->'submitted'->>'description',coalesce((p_payload->'submitted'->>'emergencyService')::boolean,false),coalesce((p_payload->'submitted'->>'acceptsQuotes')::boolean,false),coalesce(p_payload->>'verification_status','pending'),p_payload->'submitted'->>'fullName',p_payload->'submitted'->>'city',p_payload->'submitted'->>'area')
        ON CONFLICT(id) DO UPDATE SET business_name=excluded.business_name,primary_trade=excluded.primary_trade,services=excluded.services,service_areas=excluded.service_areas,phone=excluded.phone,email=excluded.email,description=excluded.description,emergency=excluded.emergency,free_quotes=excluded.free_quotes,contact_name=excluded.contact_name,city=excluded.city,area=excluded.area,updated_at=now();
        UPDATE public.registrations SET submitted = jsonb_set(coalesce(submitted,'{}'::jsonb),'{contractorId}',to_jsonb(v_contractor_id),true), updated_at=now() WHERE user_id=uid AND kind=v_kind::account_type RETURNING to_jsonb(registrations.*) INTO result;
      END IF;

    WHEN 'profile.upsert' THEN
      UPDATE public.users SET
        first_name=coalesce(p_payload->>'first_name',first_name), surname=coalesce(p_payload->>'surname',surname),
        display_name=coalesce(p_payload->>'display_name',display_name), phone=coalesce(p_payload->>'phone',phone),
        phone_normalized=coalesce(p_payload->>'phone_normalized',phone_normalized),
        account_type=CASE WHEN p_payload->>'account_type'='student' THEN 'student'::account_type ELSE account_type END,
        updated_at=now()
      WHERE id=uid;
      IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
      SELECT to_jsonb(u) - 'email' - 'phone_normalized' INTO result FROM public.users u WHERE u.id=uid;

    WHEN 'like.set' THEN
      IF coalesce((p_payload->>'liked')::boolean,false) THEN
        INSERT INTO public.property_likes(user_id,property_id) VALUES(uid,p_entity_id) ON CONFLICT DO NOTHING;
      ELSE DELETE FROM public.property_likes WHERE user_id=uid AND property_id=p_entity_id; END IF;
      result := jsonb_build_object('propertyId',p_entity_id,'liked',coalesce((p_payload->>'liked')::boolean,false));

    WHEN 'save.set' THEN
      IF coalesce((p_payload->>'saved')::boolean,(p_payload->>'liked')::boolean,false) THEN
        INSERT INTO public.property_saves(user_id,property_id) VALUES(uid,p_entity_id) ON CONFLICT DO NOTHING;
      ELSE DELETE FROM public.property_saves WHERE user_id=uid AND property_id=p_entity_id; END IF;
      result := jsonb_build_object('propertyId',p_entity_id,'saved',coalesce((p_payload->>'saved')::boolean,(p_payload->>'liked')::boolean,false));

    WHEN 'contractorLike.set' THEN
      IF coalesce((p_payload->>'liked')::boolean,false) THEN
        INSERT INTO public.contractor_likes(user_id,contractor_id) VALUES(uid,p_entity_id) ON CONFLICT DO NOTHING;
      ELSE DELETE FROM public.contractor_likes WHERE user_id=uid AND contractor_id=p_entity_id; END IF;
      result := jsonb_build_object('contractorId',p_entity_id,'liked',coalesce((p_payload->>'liked')::boolean,false));

    WHEN 'viewingRequest.create' THEN
      v_id := coalesce(nullif(p_payload->>'id',''),p_entity_id);
      v_property_id := p_payload->>'propertyId';
      -- Reuse the canonical server authorization/RPC rather than duplicating
      -- landlord/requester rules here.
      PERFORM public.request_property_viewing(v_property_id);
      SELECT to_jsonb(v) INTO result FROM public.viewing_requests v WHERE v.user_id=uid AND v.property_id=v_property_id;

    WHEN 'message.send' THEN
      IF nullif(trim(p_payload->>'text'),'') IS NULL THEN RAISE EXCEPTION 'MESSAGE_TEXT_REQUIRED'; END IF;
      SELECT to_jsonb(x) INTO result FROM public.send_message_atomic(
        nullif(p_payload->>'conversationId',''),
        nullif(p_payload->>'recipientId',''),
        nullif(p_payload->>'propertyId',''),
        left(p_payload->>'text',2000),
        nullif(p_payload->>'clientKey','')
      ) x LIMIT 1;
      IF result IS NULL THEN RAISE EXCEPTION 'MESSAGE_NOT_CONFIRMED'; END IF;

    WHEN 'quoteRequest.create' THEN
      v_id := coalesce(nullif(p_payload->>'id',''),p_entity_id);
      INSERT INTO public.quote_requests(id,user_id,contractor_id,details,status)
      VALUES(v_id,uid,p_payload->>'contractorId',coalesce(p_payload->'details','{}'::jsonb),'requested'::request_status)
      RETURNING to_jsonb(quote_requests.*) INTO result;

    WHEN 'shareRequest.create' THEN
      v_id := coalesce(nullif(p_payload->>'id',''),p_entity_id);
      INSERT INTO public.student_share_requests(id,user_id,property_id,university_name,roommates_needed,budget,move_in_date,preferences,preference_tags,about_me,deposit,utilities_included,important_notes,status)
      VALUES(v_id,uid,p_payload->>'propertyId',p_payload->>'university',(p_payload->>'roommatesNeeded')::smallint,p_payload->>'budget',NULLIF(p_payload->>'moveInDate','')::date,p_payload->>'preferences',coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'preferenceTags','[]'::jsonb))), '{}'),p_payload->>'aboutMe',p_payload->>'deposit',p_payload->>'utilitiesIncluded',p_payload->>'importantNotes','active'::share_status)
      ON CONFLICT(id) DO UPDATE SET updated_at=now()
      RETURNING to_jsonb(student_share_requests.*) INTO result;
      IF (SELECT user_id FROM public.student_share_requests WHERE id=v_id)<>uid THEN RAISE EXCEPTION 'SHARE_NOT_AUTHORIZED'; END IF;

    WHEN 'shareRequest.update' THEN
      UPDATE public.student_share_requests SET status=(p_payload->>'status')::share_status, updated_at=now()
      WHERE id=p_entity_id AND user_id=uid RETURNING to_jsonb(student_share_requests.*) INTO result;
      IF result IS NULL THEN RAISE EXCEPTION 'SHARE_UPDATE_NOT_AUTHORIZED'; END IF;

    WHEN 'shareRequest.delete' THEN
      DELETE FROM public.student_share_requests WHERE id=p_entity_id AND user_id=uid;
      IF NOT FOUND THEN RAISE EXCEPTION 'SHARE_DELETE_NOT_AUTHORIZED'; END IF;
      result := jsonb_build_object('id',p_entity_id,'deleted',true);

    WHEN 'studentInterest.set' THEN
      IF coalesce((p_payload->>'interested')::boolean,false) THEN
        INSERT INTO public.student_interests(user_id,target_id) VALUES(uid,p_entity_id) ON CONFLICT DO NOTHING;
      ELSE DELETE FROM public.student_interests WHERE user_id=uid AND target_id=p_entity_id; END IF;
      result := jsonb_build_object('targetId',p_entity_id,'interested',coalesce((p_payload->>'interested')::boolean,false));

    ELSE
      RAISE EXCEPTION 'MUTATION_OPERATION_UNSUPPORTED:%', p_operation;
  END CASE;

  PERFORM public.sync_store_idempotent_response(p_mutation_id,p_operation,result,200);
  RETURN jsonb_build_object('idempotent',false,'statusCode',200,'data',result);
END; $$;

REVOKE ALL ON FUNCTION public.api_mutation(text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_mutation(text,text,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
