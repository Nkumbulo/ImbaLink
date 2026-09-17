/** Canonical viewing-request workflow. */
export function createViewingRequestService({
  supabase,
  requireUser,
  readPublicUserProfiles,
  idbPut,
  enqueue,
  newId,
}) {
  async function requestViewing(propertyId) {
    const userId = requireUser();
    const key = String(propertyId || '').trim();
    if (!key) throw new Error('Property not found.');

    const localId = newId('viewing');
    await idbPut('viewingRequests', {
      id: localId, userId, propertyId: key, status: 'requested',
      createdAt: new Date().toISOString(), pendingSync: true,
    }).catch(() => {});
    await enqueue('viewingRequest.create', {
      entityId: localId,
      payload: { id: localId, userId, propertyId: key, status: 'requested' },
    });

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { ok: true, queued: true, conversationId: null, messageId: null };
    }

    const { data, error } = await supabase.rpc('request_property_viewing', { p_property_id: key });
    if (error) {
      console.error('Request viewing failed:', { propertyId: key, userId, code: error.code, message: error.message, details: error.details, hint: error.hint });
      if (error.code === 'PGRST202' || /schema cache|find the function/i.test(error.message || '')) {
        throw new Error('The messaging database function is not installed on this Supabase project yet. Run backend/999-messaging-production-fix.sql in the Supabase SQL Editor, then try again.');
      }
      if (error.code === '42703' || /column .* does not exist/i.test(error.message || '')) {
        throw new Error('The messaging database schema is out of date on this Supabase project (missing a column a recent migration expects). Run the latest backend/*.sql migrations in the Supabase SQL Editor, then try again.');
      }
      const looksOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const looksLikeNetworkFailure = /network|fetch failed|failed to fetch/i.test(error.message || '');
      if (!looksOffline && !looksLikeNetworkFailure) {
        throw new Error(error.message || "Couldn't send your viewing request. Please try again.");
      }
      console.warn('Viewing request sync failed; queued for retry:', error.message);
      return { ok: true, queued: true, conversationId: null, messageId: null };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      conversationId: result?.conversation_id ? String(result.conversation_id) : null,
      messageId: result?.message_id ? String(result.message_id) : null,
    };
  }

  async function respondToViewingRequest(propertyId, requesterUserId, status, note) {
    requireUser();
    const { data, error } = await supabase.rpc('respond_to_viewing_request', {
      p_property_id: String(propertyId || '').trim(),
      p_requester_user_id: String(requesterUserId || '').trim(),
      p_status: status,
      p_note: note || null,
    });
    if (error) {
      console.error('Respond to viewing request failed:', { propertyId, requesterUserId, status, code: error.code, message: error.message, details: error.details, hint: error.hint });
      if (error.code === 'PGRST202' || /schema cache|find the function/i.test(error.message || '')) {
        throw new Error('The viewing-response database function is not installed on this Supabase project yet. Run backend/016-viewing-request-response.sql in the Supabase SQL Editor, then try again.');
      }
      throw new Error(error.message || 'Could not update the viewing request.');
    }
    return data;
  }

  async function findConversationWith(otherUserId) {
    const other = String(otherUserId || '').trim();
    if (!other) return null;
    const { data, error } = await supabase.rpc('find_conversation_with', { p_other_user_id: other });
    if (error) { console.warn('findConversationWith failed:', error.message); return null; }
    return data || null;
  }

  async function getViewingRequestStatus(propertyId, requesterUserId) {
    const key = String(propertyId || '').trim();
    const requester = String(requesterUserId || '').trim();
    if (!key || !requester) return null;
    const { data, error } = await supabase.from('viewing_requests').select('status, updated_at').eq('property_id', key).eq('user_id', requester).maybeSingle();
    if (error || !data) return null;
    return { status: data.status, updatedAt: data.updated_at || null };
  }

  async function getLandlordViewingRequests(ownerId = null) {
    const owner = String(ownerId || requireUser());
    const { data: propertyRows } = await supabase.from('properties').select('id, title').eq('owner_user_id', owner);
    const propertyIds = (propertyRows || []).map((p) => String(p.id));
    if (!propertyIds.length) return [];
    const titleById = new Map((propertyRows || []).map((p) => [String(p.id), p.title]));
    const { data, error } = await supabase.from('viewing_requests').select('id, property_id, user_id, status, created_at').in('property_id', propertyIds).order('created_at', { ascending: false }).limit(50);
    if (error || !data) return [];
    const tenantIds = [...new Set(data.map((r) => String(r.user_id)))];
    const tenantProfiles = await readPublicUserProfiles(tenantIds);
    return data.map((row) => {
      const tenant = tenantProfiles.get(String(row.user_id));
      const tenantName = tenant ? [tenant.first_name, tenant.surname].filter(Boolean).join(' ').trim() || tenant.display_name : null;
      return { id: row.id, propertyId: String(row.property_id), propertyTitle: titleById.get(String(row.property_id)) || 'Listing', tenantUserId: String(row.user_id), tenantName: tenantName || 'A tenant', status: row.status, createdAt: row.created_at };
    });
  }

  function subscribeViewingRequestStatuses({ propertyIds = [], requesterIds = [], onChange }) {
    const properties = new Set(propertyIds.map((id) => String(id)).filter(Boolean));
    const requesters = new Set(requesterIds.map((id) => String(id)).filter(Boolean));
    if (!properties.size || !requesters.size || typeof onChange !== 'function') return () => {};
    const channel = supabase.channel(`imbalink-viewing-status-${Math.random().toString(36).slice(2, 9)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viewing_requests' }, (payload) => {
        const row = payload?.new || payload?.old;
        if (!row?.property_id || !row?.user_id) return;
        if (!properties.has(String(row.property_id)) || !requesters.has(String(row.user_id))) return;
        onChange({ propertyId: String(row.property_id), requesterId: String(row.user_id), status: payload.eventType === 'DELETE' ? null : row.status, updatedAt: payload.eventType === 'DELETE' ? null : (row.updated_at || null) });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }

  return { requestViewing, respondToViewingRequest, findConversationWith, getViewingRequestStatus, getLandlordViewingRequests, subscribeViewingRequestStatuses };
}
//: viewing request workflow moved behind the Core data boundary.
