import { supabase } from '../../../../services/supabase';
import { isObject, toId, numOr, intOr } from '../shared/helpers';
import { activeUserKey } from '../shared/identity';
import { readPublicUserProfiles } from '../shared/publicProfiles';
import { readRegistrations, writeRegistration } from '../registrations/shared';
import { setLocalRelation } from '../../../sync/localFirst';

let CONTRACTORS = null;

export function resetContractorCache() { CONTRACTORS = null; }

function rowToContractor(row, userProfile = null) {
  if (!isObject(row)) return null;
  const areas = Array.isArray(row.service_areas) ? row.service_areas : [];
  return {
    id: toId(row.id), userId: row.user_id || null,
    avatarUrl: userProfile?.avatar_url || userProfile?.avatarUrl || row.avatar_url || '',
    name: String(row.contact_name || row.business_name || 'Unknown'),
    business: String(row.business_name || 'Contractor'), category: String(row.primary_trade || 'General'),
    city: String(row.city || 'Harare'), area: String(row.area || areas[0] || 'Unknown'),
    rating: numOr(row.rating, 0), jobs: intOr(row.jobs, 0), verified: row.verification === 'verified',
    verificationStatus: row.verification || 'pending', phone: String(row.phone || ''), email: String(row.email || ''),
    description: String(row.description || ''), services: Array.isArray(row.services) ? row.services : [], areas,
    emergency: Boolean(row.emergency), freeQuotes: Boolean(row.free_quotes),
  };
}

export async function getContractors() {
  if (CONTRACTORS) return CONTRACTORS;
  const { data, error } = await supabase.from('contractors').select('*');
  if (error) { CONTRACTORS = []; return CONTRACTORS; }
  const profiles = await readPublicUserProfiles((data || []).map((row) => row.user_id));
  CONTRACTORS = (data || []).map((row) => rowToContractor(row, profiles.get(String(row.user_id)))).filter(Boolean);
  return CONTRACTORS;
}

export async function setContractorLike(contractorId, liked) {
  const userId = activeUserKey();
  if (!userId) return;
  await setLocalRelation('contractorLikes', {
    userId, itemId: String(contractorId), liked: Boolean(liked),
    operation: 'contractorLike.set', routeEntityId: String(contractorId),
  });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (import.meta.env?.VITE_API_BASE_URL) return;
  const query = liked
    ? supabase.from('contractor_likes').upsert({ user_id: userId, contractor_id: String(contractorId) }, { onConflict: 'user_id,contractor_id', ignoreDuplicates: true })
    : supabase.from('contractor_likes').delete().eq('user_id', userId).eq('contractor_id', String(contractorId));
  const { error } = await query;
  if (error) console.warn('Contractor like sync failed:', error.message);
}

export async function registerContractor(input) {
  const result = await writeRegistration('contractor', input, 'contractorreg');
  resetContractorCache();
  return result;
}

export async function getContractorRegistrations(userId = null) { return readRegistrations('contractor', userId); }
// debug.noveatech: migrated contractor interaction/catalog boundary to core.
