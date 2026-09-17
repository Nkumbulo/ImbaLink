import { Preferences } from '@capacitor/preferences';
import { supabase } from '../../../../services/supabase';
import { isObject } from '../shared/helpers';
import { activeUserKey } from '../shared/identity';
import { hashPassword, isHashedCredential } from '../../../../services/auth/credentials';
import { rowToLegacyMessage, MESSAGE_DISPLAY_LIMIT } from '../../adapters/debug';
import { getUserProfile } from '../profile/profile';
import { requestViewing } from '../../adapters/viewingRequests';

// --- Credential handling ---------------------------------------------------
export async function withHashedCredentials(record, existing) {
  const next = { ...record };
  const plaintext = typeof next.password === 'string' ? next.password : '';
  if (plaintext) {
    const hashed = await hashPassword(plaintext).catch(() => null);
    if (hashed) {
      next.passwordHash = hashed;
    } else if (isHashedCredential(existing?.passwordHash)) {
      next.passwordHash = existing.passwordHash;
    }
  } else if (!isHashedCredential(next.passwordHash) && isHashedCredential(existing?.passwordHash)) {
    next.passwordHash = existing.passwordHash;
  }
  delete next.password;
  delete next.confirmPassword;
  return next;
}

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
  const userId = activeUserKey();
  const empty = {
    profile: { id: userId, firstName: '', surname: '', phone: '', name: '' },
    savedIds: [], likedIds: [], contractorLikedIds: [], threads: {}, viewingRequested: {},
  };
  if (!userId) return empty;

  const [profile, likes, saves, contractorLikes, viewings, participantRows] = await Promise.all([
    getUserProfile(),
    supabase.from('property_likes').select('property_id').eq('user_id', userId),
    supabase.from('property_saves').select('property_id').eq('user_id', userId),
    supabase.from('contractor_likes').select('contractor_id').eq('user_id', userId),
    supabase.from('viewing_requests').select('property_id').eq('user_id', userId),
    supabase.from('conversation_participants').select('conversation_id').eq('user_id', userId),
  ]);

  const conversationIds = (participantRows.data || []).map((r) => r.conversation_id);
  const threads = {};
  if (conversationIds.length) {
    const { data: messageRows } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_user_id, body, sent_at')
      .in('conversation_id', conversationIds)
      .is('deleted_at', null)
      .order('sent_at');
    for (const row of messageRows || []) {
      const key = String(row.conversation_id);
      if (!threads[key]) threads[key] = [];
      threads[key].push(rowToLegacyMessage(row, userId));
    }
    for (const key of Object.keys(threads)) {
      threads[key] = threads[key].slice(-MESSAGE_DISPLAY_LIMIT);
    }
  }

  return {
    profile: profile || empty.profile,
    likedIds: (likes.data || []).map((r) => String(r.property_id)),
    savedIds: (saves.data || []).map((r) => String(r.property_id)),
    contractorLikedIds: (contractorLikes.data || []).map((r) => String(r.contractor_id)),
    viewingRequested: Object.fromEntries((viewings.data || []).map((r) => [String(r.property_id), true])),
    threads,
  };
}

// Reconciles the whole set rather than diffing: work out what changed and
// touch only that, so a sync never deletes rows it is about to rewrite.
export async function saveUserState(input) {
  const userId = activeUserKey();
  if (!userId) return;

  const syncSet = async (table, column, nextIds) => {
    const wanted = new Set((nextIds || []).map(String));
    const { data } = await supabase.from(table).select(column).eq('user_id', userId);
    const have = new Set((data || []).map((r) => String(r[column])));

    const toAdd = [...wanted].filter((id) => !have.has(id));
    const toRemove = [...have].filter((id) => !wanted.has(id));

    if (toAdd.length) {
      await supabase.from(table).upsert(
        toAdd.map((id) => ({ user_id: userId, [column]: id })),
        { onConflict: `user_id,${column}`, ignoreDuplicates: true }
      );
    }
    if (toRemove.length) {
      await supabase.from(table).delete().eq('user_id', userId).in(column, toRemove);
    }
  };

  if (input?.likedIds !== undefined) await syncSet('property_likes', 'property_id', input.likedIds);
  if (input?.savedIds !== undefined) await syncSet('property_saves', 'property_id', input.savedIds);
  if (input?.contractorLikedIds !== undefined) await syncSet('contractor_likes', 'contractor_id', input.contractorLikedIds);

  if (input?.viewingRequested !== undefined && isObject(input.viewingRequested)) {
    const wanted = Object.entries(input.viewingRequested).filter(([, v]) => v).map(([id]) => String(id));
    for (const propertyId of wanted) await requestViewing(propertyId);
  }

  // `input.threads` used to be synced back through the old, now-removed
  // db.addMessage() — messages are written directly to Supabase the
  // moment they're sent (via services/messaging/), so there is nothing
  // left to sync here. `threads` local state is fully repopulated live
  // from messagingService on every load (see App.jsx) independent of
  // whatever was last saved here, so simply not persisting it changes
  // nothing observable — it was already redundant, and calling the
  // removed addMessage() on every save was throwing on every single
  // state change that touched threads (which is most of them, since
  // this effect re-runs whenever `threads` itself updates).
}
