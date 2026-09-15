import { supabase } from '../../../services/supabase';
import { activeUserKey } from '../../../services/db/shared/identity';
import { readSinglePropertySaveCount } from './queries';
import { setLocalRelation, localRelationCount } from '../../../core/sync/localFirst';

export async function setPropertyLike(propertyId, liked) {
  const userId = activeUserKey();
  if (!userId) return;
  await setLocalRelation('propertyLikes', {
    userId, itemId: String(propertyId), liked,
    operation: 'like.set', routeEntityId: String(propertyId),
  });
  // Keep the existing online path as a best-effort compatibility path when
  // the dedicated sync backend is not configured.
  if (!import.meta.env?.VITE_API_BASE_URL && typeof navigator !== 'undefined' && navigator.onLine !== false) {
    const query = liked
      ? supabase.from('property_likes').upsert({ user_id: userId, property_id: String(propertyId) }, { onConflict: 'user_id,property_id', ignoreDuplicates: true })
      : supabase.from('property_likes').delete().eq('user_id', userId).eq('property_id', String(propertyId));
    const { error } = await query;
    if (error) console.warn('Property like sync failed:', error.message);
  }
}

export async function setPropertySave(propertyId, saved) {
  const userId = activeUserKey();
  if (!userId) return 0;
  const id = String(propertyId);
  await setLocalRelation('propertySaves', {
    userId, itemId: id, liked: saved,
    operation: 'save.set', routeEntityId: id,
  });
  const localCount = await localRelationCount('propertySaves', id);
  if (!import.meta.env?.VITE_API_BASE_URL && typeof navigator !== 'undefined' && navigator.onLine !== false) {
    const query = saved
      ? supabase.from('property_saves').upsert({ user_id: userId, property_id: id }, { onConflict: 'user_id,property_id', ignoreDuplicates: true })
      : supabase.from('property_saves').delete().eq('user_id', userId).eq('property_id', id);
    const { error } = await query;
    if (!error) return await readSinglePropertySaveCount(id);
    console.warn('Property save sync failed:', error.message);
  }
  return localCount;
}

export async function recordPropertyView(propertyId) {
  const key = String(propertyId || '').trim();
  if (!key) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const { error } = await supabase.rpc('record_property_view', { p_property_id: key });
  if (error) console.warn('record_property_view failed:', error.message);
}
