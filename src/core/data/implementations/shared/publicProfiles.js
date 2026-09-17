import { supabase } from '../../../../services/supabase';
import { activeUserKey } from './identity';

// Public profile photos are intentionally read from the safe public view.
// Never expose phone/email just to render an avatar. Used by properties,
// contractors, and anywhere else that needs to show "posted by" info without
// a second, domain-specific query.
export async function readPublicUserProfiles(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!ids.length) return new Map();

  const result = new Map();
  const { data, error } = await supabase
    .from('public_user_profiles')
    .select('id, avatar_url, first_name, surname, display_name, account_type')
    .in('id', ids);

  if (!error) {
    for (const row of data || []) result.set(String(row.id), row);
  }

  // Always make the currently signed-in user's Google photo available even
  // when the public view has not been refreshed yet. This is especially
  // important immediately after creating a listing.
  const activeId = activeUserKey();
  if (activeId && ids.includes(String(activeId))) {
    const { data: authData } = await supabase.auth.getUser();
    const metadata = authData?.user?.user_metadata || {};
    const googleAvatar = metadata.avatar_url || metadata.picture || '';
    if (googleAvatar) {
      const existing = result.get(String(activeId)) || { id: String(activeId) };
      result.set(String(activeId), { ...existing, avatar_url: googleAvatar });
    }
  }

  return result;
}
