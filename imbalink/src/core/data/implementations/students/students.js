import { supabase } from '../../../../services/supabase';
import { activeUserKey } from '../shared/identity';
import { setLocalRelation } from '../../../sync/localFirst';

export async function getUniversities() {
  const { data, error } = await supabase.from('universities').select('*').eq('active', true).order('name');
  if (error) return [];
  return data || [];
}

export async function getUniversityById(id) {
  if (!id) return null;
  const { data, error } = await supabase.from('universities').select('*').eq('id', String(id)).maybeSingle();
  if (error) return null;
  return data || null;
}

export async function setStudentInterest(targetId, interested) {
  const userId = activeUserKey();
  if (!userId) return;
  await setLocalRelation('studentInterests', {
    userId, itemId: String(targetId), liked: Boolean(interested),
    operation: 'studentInterest.set', routeEntityId: String(targetId),
  });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (import.meta.env?.VITE_API_BASE_URL) return;
  if (interested) {
    await supabase.from('student_interests').upsert(
      { user_id: userId, target_id: String(targetId) },
      { onConflict: 'user_id,target_id', ignoreDuplicates: true }
    );
  } else {
    await supabase.from('student_interests').delete().eq('user_id', userId).eq('target_id', String(targetId));
  }
}

export async function getStudentInterests(userId = activeUserKey()) {
  if (!userId) return [];
  const { data, error } = await supabase.from('student_interests').select('target_id').eq('user_id', String(userId));
  if (error) return [];
  return (data || []).map((row) => String(row.target_id));
}

export async function getStudentRecommendations({ limit = 12, excludeIds = [] } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 12));
  const ids = Array.isArray(excludeIds)
    ? excludeIds.map((id) => String(id)).filter(Boolean).slice(0, 100)
    : [];
  const { data, error } = await supabase.rpc('get_student_recommendations', {
    p_limit: safeLimit,
    p_exclude_ids: ids,
  });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.user_id), requestId: null, name: row.name || 'Student',
    avatarUrl: row.avatar_url || '', university: row.university || '', studyYear: row.study_year || '',
    area: row.preferred_area || '', city: row.preferred_city || '', budget: row.budget || '',
    accommodationPreference: row.accommodation_preference || 'Any', roommatesNeeded: row.roommates_needed || '1',
    moveInDate: row.move_in_date || '', preferences: row.preferences || '', aboutMe: row.about_me || '',
    deposit: row.deposit || '', utilitiesIncluded: row.utilities_included || '', importantNotes: row.important_notes || '',
    verificationStatus: row.verification_status || 'unverified', propertyId: row.property_id != null ? String(row.property_id) : null,
    createdAt: null, grad: ['#6E63B8', '#3E3670'], lifestyle: Array.isArray(row.preference_tags) ? row.preference_tags : [],
    sharedPreferenceCount: Number(row.shared_preference_count || 0), matchedPreferences: Array.isArray(row.matched_preferences) ? row.matched_preferences : [],
    serverCompatibilityScore: Number(row.compatibility_score || 0),
  }));
}
// debug.noveatech: migrated student data boundary to core.
