import { supabase } from '../supabase';
import { isObject, now, phoneKeyOrNull } from './shared/helpers';
import { activeUserKey, requireUser, requireCurrentUserId } from './shared/identity';
import { getLandlordListings } from './properties/mutations';
import { idbGet, idbPut } from '../../core/infrastructure/indexeddb';
import { enqueue } from '../../core/sync/outbox';

const USER_COLUMNS = 'id, email, phone, first_name, surname, display_name, avatar_url, account_type, created_at, updated_at';

async function readStudentRow(userId) {
  const { data } = await supabase
    .from('student_profiles')
    .select('user_id, verification_status, details')
    .eq('user_id', String(userId))
    .maybeSingle();
  return data || null;
}

export function normalizeStudentProfile(record) {
  if (!isObject(record)) return null;
  return {
    university: String(record.university || '').trim().slice(0, 120),
    studyYear: String(record.studyYear || '').trim().slice(0, 30),
    preferredCity: String(record.preferredCity || '').trim().slice(0, 60),
    preferredArea: String(record.preferredArea || '').trim().slice(0, 60),
    budget: String(record.budget || '').trim().slice(0, 30),
    accommodationPreference: String(record.accommodationPreference || 'Any').trim().slice(0, 40),
    wantsRoommate: Boolean(record.wantsRoommate),
    roommatesNeeded: String(record.roommatesNeeded || '').trim().slice(0, 20),
    lifestyleNotes: String(record.lifestyleNotes || '').trim().slice(0, 240),
    roommatePropertyId: record.roommatePropertyId != null ? String(record.roommatePropertyId) : '',
  };
}

// The app models "general" as accountType null and only ever sets 'student'
// itself; the other enum values arrive from a registration wizard.
function rowToProfile(row, studentRow = null) {
  if (!isObject(row)) return null;
  const isStudent = row.account_type === 'student';
  return {
    id: String(row.id),
    firstName: String(row.first_name || '').trim(),
    surname: String(row.surname || '').trim(),
    phone: String(row.phone || '').trim(),
    name: String(row.display_name || `${row.first_name || ''} ${row.surname || ''}`).trim(),
    email: row.email || '',
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at || now(),
    updatedAt: row.updated_at || now(),
    // Preserve every account type from the real users.account_type enum.
    // The previous mapper only returned "student", which made landlord
    // accounts look like general accounts after a refresh.
    accountType: ['general', 'student', 'landlord', 'agent', 'company', 'contractor'].includes(row.account_type)
      ? row.account_type
      : null,
    studentProfile: isStudent
      ? (normalizeStudentProfile(studentRow?.details) || normalizeStudentProfile({}))
      : null,
    studentVerificationStatus: isStudent
      ? (['unverified', 'pending', 'verified', 'rejected'].includes(studentRow?.verification_status)
        ? studentRow.verification_status
        : 'unverified')
      : null,
  };
}

export async function getUserProfile() {
  const userId = activeUserKey();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('users').select(USER_COLUMNS).eq('id', userId).maybeSingle();
  if (error || !data) return null;
  const studentRow = data.account_type === 'student' ? await readStudentRow(userId) : null;
  return rowToProfile(data, studentRow);
}

export async function saveUserProfile(input) {
  const userId = requireUser();
  const current = await getUserProfile();
  const firstName = String(input?.firstName ?? current?.firstName ?? '').trim().slice(0, 80);
  const surname = String(input?.surname ?? current?.surname ?? '').trim().slice(0, 80);
  const phone = String(input?.phone ?? current?.phone ?? '').trim().slice(0, 40);
  const isStudent = (input?.accountType ?? current?.accountType) === 'student';

  const patch = {
    first_name: firstName,
    surname,
    display_name: `${firstName} ${surname}`.trim(),
    phone: phone || null,
    phone_normalized: phoneKeyOrNull(phone),
    updated_at: new Date().toISOString(),
  };
  // Only ever promote to 'student'. Overwriting with 'general' would
  // downgrade a landlord or agent account on an unrelated profile save.
  if (isStudent) patch.account_type = 'student';

  const localProfile = {
    userId,
    ...current,
    id: userId,
    firstName,
    surname,
    name: `${firstName} ${surname}`.trim(),
    phone,
    accountType: isStudent ? 'student' : (current?.accountType || null),
    updatedAt: patch.updated_at,
  };
  await idbPut('profiles', localProfile).catch(() => {});
  await enqueue('profile.upsert', { entityId: userId, payload: patch, dedupeKey: `profile:${userId}` });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return localProfile;

  const { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (error) {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) console.warn('Profile sync failed; queued for retry:', error.message);
    return localProfile;
  }

  if (isStudent) {
    const details = { ...(current?.studentProfile || {}), ...(input?.studentProfile || {}) };
    const status = input?.studentVerificationStatus ?? current?.studentVerificationStatus ?? 'unverified';
    const { error: studentError } = await supabase.from('student_profiles').upsert({
      user_id: userId,
      verification_status: status,
      details: normalizeStudentProfile(details) || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (studentError) throw studentError;
  }

  return getUserProfile();
}

export async function requestStudentVerification() {
  const current = await getUserProfile();
  if (!current || current.accountType !== 'student') return current;
  if (current.studentVerificationStatus !== 'unverified') return current;
  return saveUserProfile({ accountType: 'student', studentVerificationStatus: 'pending' });
}

// Cross-account lookups read the public views, which carry no phone number
// and no email. See backend/002-app-alignment.sql.
export async function findProfileByPhone(phone) {
  const normalized = phoneKeyOrNull(phone);
  if (!normalized) return null;

  // `users` is intentionally self-readable only under RLS. A phone-based
  // lookup is a cross-account discovery operation, so it must not query the
  // protected users table. Use the public profile view and only return the
  // fields that view exposes. The database view intentionally omits phone
  // numbers, so phone lookup cannot be implemented safely from the current
  // RLS model without a dedicated server-side RPC.
  //
  // Keep this function fail-closed rather than weakening users SELECT RLS.
  // Callers that need phone discovery should use a server-authorized lookup
  // RPC in a future migration.
  return null;
}

export async function findProfileById(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('public_user_profiles').select('*').eq('id', String(id)).maybeSingle();
  if (error || !data) return null;
  const studentRow = data.account_type === 'student'
    ? (await supabase.from('public_student_profiles').select('*').eq('user_id', String(id)).maybeSingle()).data
    : null;
  return rowToProfile(data, studentRow);
}

// Public profile lookup used when a visitor taps a landlord's username/avatar.
// Only the public profile view and that user's published listings are exposed.
export async function getPublicProfile(id) {
  if (!id) return null;
  const [profile, listings] = await Promise.all([
    findProfileById(id),
    getLandlordListings(id),
  ]);
  if (!profile && (!listings || listings.length === 0)) return null;
  return { profile, listings: Array.isArray(listings) ? listings : [] };
}

export async function upsertProfile(profile) {
  const userId = requireCurrentUserId(profile?.id || profile?.userId);
  const phone = String(profile?.phone || '').trim();
  const isStudent = profile?.accountType === 'student';

  const row = {
    id: userId,
    first_name: profile?.firstName || '',
    surname: profile?.surname || '',
    display_name: profile?.name || `${profile?.firstName || ''} ${profile?.surname || ''}`.trim(),
    phone: phone || null,
    phone_normalized: phoneKeyOrNull(phone),
    updated_at: new Date().toISOString(),
  };
  if (isStudent) row.account_type = 'student';

  const { error } = await supabase.from('users').upsert(row, { onConflict: 'id' });
  if (error) throw error;

  if (isStudent) {
    await supabase.from('student_profiles').upsert({
      user_id: userId,
      verification_status: profile?.studentVerificationStatus || 'unverified',
      details: normalizeStudentProfile(profile?.studentProfile) || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }
  return getUserProfile();
}
