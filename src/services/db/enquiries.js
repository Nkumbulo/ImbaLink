import { supabase } from '../supabase';
import { requireUser } from './shared/identity';

// Enquiry counts per listing — how many distinct conversations exist
// about each of the landlord's properties. Needed no new schema at all:
// conversations.property_id already exists (backend/schema.sql), and
// conversations_read_participant already scopes reads to conversations
// the caller is actually part of — a landlord is always a participant
// in any conversation about their own property (added by
// ensure_property_conversation/request_property_viewing), so a plain
// SELECT here already returns exactly the right rows without a new RPC.
export async function getLandlordEnquiryCounts(ownerId = null) {
  const owner = String(ownerId || requireUser());
  const { data: propertyRows } = await supabase
    .from('properties').select('id').eq('owner_user_id', owner);
  const propertyIds = (propertyRows || []).map((p) => String(p.id));
  if (!propertyIds.length) return new Map();

  const { data, error } = await supabase
    .from('conversations')
    .select('id, property_id')
    .in('property_id', propertyIds);
  if (error || !data) return new Map();

  const counts = new Map();
  for (const row of data) {
    const key = String(row.property_id);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}
