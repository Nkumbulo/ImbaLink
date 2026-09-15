import { supabase } from './supabase';

export async function getMonetizationConfig() {
  const { data, error } = await supabase.rpc('get_monetization_config');
  if (error) throw error;
  return data || { enabled: false };
}

export async function getMyProAccess() {
  const { data, error } = await supabase.rpc('get_my_pro_access');
  if (error) throw error;
  return data || { enabled: false, is_pro: false, is_verified: false, can_access: true };
}

export async function setMonetizationEnabled(enabled) {
  const { data, error } = await supabase.rpc('set_monetization_enabled', { p_enabled: Boolean(enabled) });
  if (error) throw error;
  return data;
}

export async function getMonetizationAnalytics(days = 30) {
  const { data, error } = await supabase.rpc('get_monetization_analytics', { p_days: Number(days) || 30 });
  if (error) throw error;
  return data || null;
}
