import { supabase } from '../supabase';
import { requireUser } from './shared/identity';
import { readPublicUserProfiles } from './shared/publicProfiles';
import { idbPut } from '../../core/infrastructure/indexeddb';
import { enqueue } from '../../core/sync/outbox';
import { newId } from '../ids';

export async function requestViewing(propertyId) {
  const userId = requireUser();
  const key = String(propertyId || '').trim();
  if (!key) throw new Error('Property not found.');

  const localId = newId('viewing');
  await idbPut('viewingRequests', { id: localId, userId, propertyId: key, status: 'requested', createdAt: new Date().toISOString(), pendingSync: true }).catch(() => {});
  await enqueue('viewingRequest.create', { entityId: localId, payload: { id: localId, userId, propertyId: key, status: 'requested' } });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: true, queued: true, conversationId: null, messageId: null };

  const { data, error } = await supabase.rpc('request_property_viewing', {
    p_property_id: key,
    // No p_message here on purpose: the RPC's own default now names the
    // specific property ("I would like to request a viewing of <title>.")
    // so that a conversation reused across several listings from the
    // same landlord stays distinguishable per-listing. Passing a fixed
    // generic string here would override that and make every request
    // look identical regardless of which property it's for.
  });

  if (error) {
    console.error('Request viewing failed:', {
      propertyId: key,
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    // PGRST202 / "Could not find the function" means the migration in
    // backend/999-messaging-production-fix.sql has not been run against
    // this Supabase project yet — that is by far the most common cause
    // of this call failing, so say so plainly instead of a generic error.
    if (error.code === 'PGRST202' || /schema cache|find the function/i.test(error.message || '')) {
      throw new Error(
        'The messaging database function is not installed on this Supabase project yet. ' +
        'Run backend/999-messaging-production-fix.sql in the Supabase SQL Editor, then try again.'
      );
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

// Landlord accept/decline/complete, or the tenant cancelling their own
// request — backend/016-viewing-request-response.sql. Previously there was
// no write path for this at all: viewing_requests_write_self only lets the
// requester touch their own row, so a landlord had SELECT-only access and
// could never move a request past 'requested'. This calls the new
// SECURITY DEFINER RPC, which enforces who may set which status
// server-side rather than trusting the caller.
export async function respondToViewingRequest(propertyId, requesterUserId, status, note) {
  requireUser();
  const { data, error } = await supabase.rpc('respond_to_viewing_request', {
    p_property_id: String(propertyId || '').trim(),
    p_requester_user_id: String(requesterUserId || '').trim(),
    p_status: status,
    p_note: note || null,
  });

  if (error) {
    console.error('Respond to viewing request failed:', {
      propertyId, requesterUserId, status,
      code: error.code, message: error.message, details: error.details, hint: error.hint,
    });
    if (error.code === 'PGRST202' || /schema cache|find the function/i.test(error.message || '')) {
      throw new Error(
        'The viewing-response database function is not installed on this Supabase project yet. ' +
        'Run backend/016-viewing-request-response.sql in the Supabase SQL Editor, then try again.'
      );
    }
    throw new Error(error.message || 'Could not update the viewing request.');
  }
  return data;
}

// Resolves the real conversation id with a specific other user, via the
// same find_conversation_with RPC backend/999-messaging-production-fix.sql
// already defines and grants to authenticated. Needed specifically for
// opening a thread by (propertyId, otherUserId) when the caller can't
// just derive "the other participant" from the property's own owner
// field — i.e. whenever the caller themselves is that owner.
export async function findConversationWith(otherUserId) {
  const other = String(otherUserId || '').trim();
  if (!other) return null;
  const { data, error } = await supabase.rpc('find_conversation_with', { p_other_user_id: other });
  if (error) { console.warn('findConversationWith failed:', error.message); return null; }
  return data || null;
}

export async function getViewingRequestStatus(propertyId, requesterUserId) {
  const key = String(propertyId || '').trim();
  const requester = String(requesterUserId || '').trim();
  if (!key || !requester) return null;
  const { data, error } = await supabase
    .from('viewing_requests')
    .select('status')
    .eq('property_id', key)
    .eq('user_id', requester)
    .maybeSingle();
  if (error || !data) return null;
  return data.status;
}

// Incoming viewing requests on the CALLER's own listings. Previously,
// nothing queried this direction at all: LandlordDashboardPage's "Viewing
// Requests" panel was reading `viewingRequested`, which only ever tracks
// properties the current account has itself requested a viewing on *as a
// tenant* (set in App.jsx's requestViewing()) — unrelated to requests
// received on properties this account owns. That's why a landlord who had
// received a real request still saw "No new viewing requests yet.": the
// panel was reading the wrong side of the relationship. viewing_requests
// is readable here under viewing_requests_read_party (either party may
// read), so this is a plain SELECT, not a new RPC.
export async function getLandlordViewingRequests(ownerId = null) {
  const owner = String(ownerId || requireUser());
  const { data: propertyRows } = await supabase
    .from('properties').select('id, title').eq('owner_user_id', owner);
  const propertyIds = (propertyRows || []).map((p) => String(p.id));
  if (!propertyIds.length) return [];
  const titleById = new Map((propertyRows || []).map((p) => [String(p.id), p.title]));

  const { data, error } = await supabase
    .from('viewing_requests')
    .select('id, property_id, user_id, status, created_at')
    .in('property_id', propertyIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];

  const tenantIds = [...new Set(data.map((r) => String(r.user_id)))];
  const tenantProfiles = await readPublicUserProfiles(tenantIds);

  return data.map((row) => {
    const tenant = tenantProfiles.get(String(row.user_id));
    const tenantName = tenant
      ? [tenant.first_name, tenant.surname].filter(Boolean).join(' ').trim() || tenant.display_name
      : null;
    return {
      id: row.id,
      propertyId: String(row.property_id),
      propertyTitle: titleById.get(String(row.property_id)) || 'Listing',
      tenantUserId: String(row.user_id),
      tenantName: tenantName || 'A tenant',
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

// Realtime status feed for an open MessagesPage thread. The UI subscribes
// through this service rather than reaching into Supabase directly, keeping
// the page layer independent of the transport and making status changes
// arrive with the same low-latency path as ordinary messages.
export function subscribeViewingRequestStatuses({ propertyIds = [], requesterIds = [], onChange }) {
  const properties = new Set(propertyIds.map((id) => String(id)).filter(Boolean));
  const requesters = new Set(requesterIds.map((id) => String(id)).filter(Boolean));
  if (!properties.size || !requesters.size || typeof onChange !== 'function') return () => {};

  const channel = supabase
    .channel(`imbalink-viewing-status-${Math.random().toString(36).slice(2, 9)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'viewing_requests' }, (payload) => {
      const row = payload?.new || payload?.old;
      if (!row?.property_id || !row?.user_id) return;
      if (!properties.has(String(row.property_id)) || !requesters.has(String(row.user_id))) return;
      onChange({
        propertyId: String(row.property_id),
        requesterId: String(row.user_id),
        status: payload.eventType === 'DELETE' ? null : row.status,
      });
    })
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
