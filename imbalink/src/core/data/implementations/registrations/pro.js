import { supabase } from '../../../../services/supabase';
import { isObject } from '../shared/helpers';
import { activeUserKey, requireCurrentUserId } from '../shared/identity';

export async function registerPro(input) {
  const userId = requireCurrentUserId(input?.userId);
  const existing = await getProRegistration(userId);
  const payload = { ...(existing?.details || {}), ...(input || {}) };
  delete payload.userId;

  const row = {
    user_id: userId,
    plan_id: String(input?.planId || input?.plan || existing?.planId || 'monthly'),
    details: payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('pro_registrations')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;

  return {
    ...data.details,
    userId: data.user_id,
    planId: data.plan_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getProRegistration(userId = activeUserKey()) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('pro_registrations')
    .select('*')
    .eq('user_id', String(userId))
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...(isObject(data.details) ? data.details : {}),
    userId: data.user_id,
    planId: data.plan_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
