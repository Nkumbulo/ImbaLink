import { backend } from '../../../../application/backend/index.js';
import { isObject, now, phoneKeyOrNull, normalizeStudentProfile } from '../shared/helpers';
import { activeUserKey, requireUser, requireCurrentUserId } from '../shared/identity';
import { getLandlordListings } from '../../adapters/properties';
import { idbPut } from '../../../infrastructure/indexeddb';
import { enqueue } from '../../../sync/outbox';

async function readStudentRow(userId) {
  const result = await backend.profileRepository.getProfile(userId).catch(() => null);
  return result?.student || null;
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
  const result = await backend.profileRepository.getProfile(userId).catch(() => null);
  if (!result?.user) return null;
  return rowToProfile(result.user, result.student);
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

  const studentPayload = isStudent
    ? {
        user_id: userId,
        verification_status: input?.studentVerificationStatus ?? current?.studentVerificationStatus ?? 'unverified',
        details: normalizeStudentProfile({ ...(current?.studentProfile || {}), ...(input?.studentProfile || {}) }) || {},
        updated_at: new Date().toISOString(),
      }
    : null;

  try {
    await backend.profileRepository.updateProfile(userId, patch, studentPayload);
  } catch (error) {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) console.warn('Profile sync failed; queued for retry:', error.message);
    return localProfile;
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
  const result = await backend.profileRepository.getPublicProfile(id).catch(() => null);
  if (!result?.user) return null;
  return rowToProfile(result.user, result.student);
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

  const studentPayload = isStudent
    ? {
        user_id: userId,
        verification_status: profile?.studentVerificationStatus || 'unverified',
        details: normalizeStudentProfile(profile?.studentProfile) || {},
        updated_at: new Date().toISOString(),
      }
    : null;

  await backend.profileRepository.upsertProfile(userId, row, studentPayload);
  return getUserProfile();
}
