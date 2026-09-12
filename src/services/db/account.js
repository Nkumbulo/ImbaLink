import { Preferences } from '@capacitor/preferences';
import { supabase } from '../supabase';
import { setActiveUser as setIdentityUser, activeUserKey } from './shared/identity';
import { invalidatePropertyCache } from './properties/queries';
import { resetContractorCache } from './contractors';

// These three operations deliberately live outside any single domain module:
// each one legitimately spans two or more of them (auth identity + property
// cache, or property cache + contractor cache), and forcing them into one
// domain's file would mean that domain reaching into another's private
// state. This is the one place in db/ where that cross-cutting is allowed,
// specifically because there's no way to draw a single-domain boundary
// around "a different account is now signed in" or "throw away every
// cache we have."

export function setActiveUser(userId) {
  setIdentityUser(userId);
  // A different account means a different set of likes, saves and listings.
  invalidatePropertyCache();
}

export function clearCache() {
  invalidatePropertyCache();
  resetContractorCache();
}

// Deletes only the signed-in account's rows. The old version issued
// `.delete().neq('id', '')` against every table, which under a service-role
// key would have emptied the catalog for everyone.
export async function clearUserData() {
  const userId = activeUserKey();
  if (!userId) return;
  const tables = [
    'property_likes', 'property_saves', 'contractor_likes', 'viewing_requests',
    'student_interests', 'quote_requests', 'student_share_requests', 'registrations',
  ];
  for (const table of tables) {
    await supabase.from(table).delete().eq('user_id', userId);
  }
  await supabase.from('conversation_participants').delete().eq('user_id', userId);
  await Preferences.remove({ key: 'imbalink_session' });
  clearCache();
}
