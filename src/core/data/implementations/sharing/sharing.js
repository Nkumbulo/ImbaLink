/** Canonical student/property sharing-request operations. */
import { isObject, intOr, dateOrNull } from '../shared/helpers';

export function createSharingService({ supabase, requireCurrentUserId, newId, normalizeStudentProfile }) {
  function rowToShareRequest(row) {
    if (!isObject(row)) return null;
    return {
      id: row.id, userId: row.user_id, propertyId: row.property_id != null ? String(row.property_id) : null,
      university: row.university_name || '', universityId: row.university_id || null,
      roommatesNeeded: String(row.roommates_needed ?? 1), budget: row.budget || '', moveInDate: row.move_in_date || '',
      preferences: row.preferences || '', preferenceTags: Array.isArray(row.preference_tags) ? row.preference_tags : [],
      aboutMe: row.about_me || '', deposit: row.deposit || '', utilitiesIncluded: row.utilities_included || '',
      importantNotes: row.important_notes || '', status: row.status || 'active', createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  async function createShareRequest(input) {
    const userId = requireCurrentUserId(input?.userId);
    const propertyId = input?.propertyId != null ? String(input.propertyId) : null;
    const existing = propertyId ? await getMyShareRequestForProperty(userId, propertyId) : null;
    const id = existing?.id || newId('share');
    const record = {
      id, user_id: userId, property_id: propertyId,
      university_name: String(input?.university ?? existing?.university ?? ''),
      roommates_needed: intOr(input?.roommatesNeeded ?? existing?.roommatesNeeded, 1),
      budget: String(input?.budget ?? existing?.budget ?? ''),
      move_in_date: dateOrNull(input?.moveInDate ?? existing?.moveInDate),
      preferences: String(input?.preferences ?? existing?.preferences ?? '').slice(0, 500),
      about_me: String(input?.aboutMe ?? existing?.aboutMe ?? '').slice(0, 400),
      preference_tags: Array.isArray(input?.preferenceTags) ? input.preferenceTags.filter((t) => typeof t === 'string').slice(0, 12) : (Array.isArray(existing?.preferenceTags) ? existing.preferenceTags : []),
      deposit: String(input?.deposit ?? existing?.deposit ?? ''),
      utilities_included: String(input?.utilitiesIncluded ?? existing?.utilitiesIncluded ?? ''),
      important_notes: String(input?.importantNotes ?? existing?.importantNotes ?? '').slice(0, 400),
      status: 'active',
    };
    const { data, error } = await supabase.from('student_share_requests').upsert(record, { onConflict: 'id' }).select();
    if (error) throw error;
    return rowToShareRequest(data?.[0]);
  }

  async function getShareRequests(userId = null) {
    let query = supabase.from('student_share_requests').select('*');
    if (userId) query = query.eq('user_id', String(userId));
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(rowToShareRequest).filter(Boolean);
  }

  async function getUniversityGeneralShareRequestStudents(universityName, excludeUserId = null) {
    const university = String(universityName || '').trim();
    if (!university) return [];
    const { data: requests, error: requestError } = await supabase.from('student_share_requests').select('*').eq('university_name', university).is('property_id', null).eq('status', 'active');
    if (requestError || !Array.isArray(requests) || requests.length === 0) return [];
    const userIds = [...new Set(requests.map((r) => String(r.user_id || '')).filter(Boolean))].filter((id) => !excludeUserId || id !== String(excludeUserId));
    if (!userIds.length) return [];
    const [{ data: profiles }, { data: studentProfiles }] = await Promise.all([
      supabase.from('public_user_profiles').select('*').in('id', userIds),
      supabase.from('public_student_profiles').select('*').in('user_id', userIds),
    ]);
    const profileMap = new Map((profiles || []).map((row) => [String(row.id), row]));
    const studentMap = new Map((studentProfiles || []).map((row) => [String(row.user_id), row]));
    return requests.map((request) => {
      const id = String(request.user_id || '');
      const profile = profileMap.get(id);
      const studentProfile = studentMap.get(id);
      if (!id || !profile || profile.account_type !== 'student') return null;
      const details = normalizeStudentProfile(studentProfile?.details) || {};
      return {
        id, requestId: request.id,
        name: String(profile.display_name || `${profile.first_name || ''} ${profile.surname || ''}`).trim() || 'Student',
        avatarUrl: profile.avatar_url || '', university,
        studyYear: details.studyYear || '', area: details.preferredArea || '', city: details.preferredCity || '',
        budget: request.budget || details.budget || '', roommatesNeeded: String(request.roommates_needed ?? details.roommatesNeeded ?? 1),
        preferences: request.preferences || '', aboutMe: request.about_me || '',
        preferenceTags: Array.isArray(request.preference_tags) ? request.preference_tags : [],
        lifestyle: Array.isArray(request.preference_tags) ? request.preference_tags : [],
        deposit: request.deposit || '', utilitiesIncluded: request.utilities_included || '', importantNotes: request.important_notes || '',
        verificationStatus: ['unverified', 'pending', 'verified', 'rejected'].includes(studentProfile?.verification_status) ? studentProfile.verification_status : 'unverified',
        propertyId: null, createdAt: request.created_at || null, serverCompatibilityScore: 0, sharedPreferenceCount: 0, matchedPreferences: [],
      };
    }).filter(Boolean);
  }

  async function getActiveShareRequestsForProperty(propertyId) {
    if (propertyId == null) return [];
    const { data, error } = await supabase.from('student_share_requests').select('*').eq('property_id', String(propertyId)).eq('status', 'active');
    if (error) return [];
    return (data || []).map(rowToShareRequest).filter(Boolean);
  }

  async function getMyShareRequestForProperty(userId, propertyId) {
    if (propertyId == null) return null;
    const mine = await getShareRequests(userId);
    return mine.find((r) => String(r.propertyId) === String(propertyId) && r.status !== 'withdrawn') || null;
  }

  async function setShareRequestStatus(id, status) {
    const { data, error } = await supabase.from('student_share_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', String(id)).select();
    if (error) throw error;
    return rowToShareRequest(data?.[0]);
  }

  async function withdrawShareRequest(id) { return setShareRequestStatus(id, 'withdrawn'); }

  async function deleteShareRequest(id) {
    const { error } = await supabase.from('student_share_requests').delete().eq('id', String(id));
    if (error) throw error;
    return true;
  }

  async function getShareRequestCountsByProperty() {
    const { data, error } = await supabase.from('student_share_requests').select('property_id').eq('status', 'active');
    if (error) return {};
    const counts = {};
    for (const r of data || []) {
      if (!r.property_id) continue;
      const key = String(r.property_id);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  return { createShareRequest, getShareRequests, getUniversityGeneralShareRequestStudents, getActiveShareRequestsForProperty, getMyShareRequestForProperty, setShareRequestStatus, withdrawShareRequest, deleteShareRequest, getShareRequestCountsByProperty };
}
//: sharing workflow moved behind the Core data boundary.
