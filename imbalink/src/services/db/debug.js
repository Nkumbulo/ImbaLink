import { supabase } from '../supabase';

// --- Messaging -------------------------------------------------------------
//
// The client's legacy shape is one array of messages per (user, conversation).
// Server-side a conversation is a row with participants and the messages hang
// off it, so both sides of a thread read the same history instead of each
// keeping a private copy. This helper translates between the two — still
// used by session.js's getUserState() legacy shape.
export function rowToLegacyMessage(row, currentUserId) {
  return {
    id: row.id,
    from: row.sender_user_id === currentUserId ? 'me' : 'them',
    text: row.body,
    ts: new Date(row.sent_at).getTime(),
  };
}

export const MESSAGE_DISPLAY_LIMIT = 100;

// --- Seeding ---------------------------------------------------------------
//
// Seeding used to run from the browser on first load. It cannot any more, and
// should not have then: with RLS on, `authenticated` has no insert rights on
// properties or contractors, and handing the browser those rights would let
// any visitor write the catalog. Seed with backend/import-seed.mjs, which runs
// under the service role.
//
// `ready()` itself is not called from anywhere any more (kept, not deleted,
// as part of a pure structural split — removing genuinely dead code is a
// separate decision from reorganizing files).
let readyPromise = null;
export function ready() {
  if (!readyPromise) readyPromise = Promise.resolve();
  return readyPromise;
}

// --- Dev-only ---
export async function __debugListStoreNames() {
  return [
    'users', 'student_profiles', 'universities', 'properties', 'property_images',
    'contractors', 'registrations', 'property_likes', 'property_saves',
    'contractor_likes', 'viewing_requests', 'quote_requests',
    'student_share_requests', 'student_interests',
    'conversations', 'conversation_participants', 'messages',
  ];
}

export async function __debugGetAllRecords(storeName) {
  const allowed = new Set(['properties', 'registrations', 'contractors', 'student_profiles']);
  if (!allowed.has(storeName)) return [];
  const { data, error } = await supabase.rpc('get_moderation_records', { p_store_name: storeName });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}
