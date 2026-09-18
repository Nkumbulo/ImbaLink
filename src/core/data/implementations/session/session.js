import { Preferences } from '@capacitor/preferences';
import { backend } from '../../../../application/backend/index.js';
import { activeUserKey } from '../shared/identity';
import { hashPassword, isHashedCredential } from '../../../../services/auth/credentials';

// Credential handling is kept as a leaf helper so registration persistence
// can be composed into the backend without creating a session/backend cycle.
export { withHashedCredentials } from '../shared/credentials';

// --- Session ---
// Supabase Auth owns the real session; this is the local mirror the business
// credential path still reads.
export async function getSession() {
  try {
    const { value } = await Preferences.get({ key: 'imbalink_session' });
    if (!value) return null;
    const session = JSON.parse(value);
    return session && session.user ? session : null;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  try {
    if (!session) {
      await Preferences.remove({ key: 'imbalink_session' });
      return null;
    }
    await Preferences.set({ key: 'imbalink_session', value: JSON.stringify(session) });
    return session;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await Preferences.remove({ key: 'imbalink_session' });
}

// --- User state ---
export async function getUserState() {
  return backend.accountStateRepository.getUserState();
}

// Reconciles the whole set rather than diffing: work out what changed and
// touch only that, so a sync never deletes rows it is about to rewrite.
export async function saveUserState(input) {
  return backend.accountStateRepository.saveUserState(input);
}
