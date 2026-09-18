import { createMessage, createConversation, MESSAGE_STATUS } from "../messageModel";
import { supabase } from "../../supabase";
import { MESSAGE_DISPLAY_LIMIT, isOnline } from "./shared";

// Mixed into SupabaseMessagingProvider.prototype — see connectionState.js for
// why cross-file `this.method()` calls are safe (this file calls
// this._resolveConversationMeta from conversationResolution.js).
export const conversationLoadingMethods = {
  _toCanonical(legacyMessage, conversationId, userId, otherParticipantId) {
    if (!legacyMessage || typeof legacyMessage !== "object") return null;
    const text = typeof legacyMessage.text === "string" ? legacyMessage.text.trim() : "";
    if (!text) return null;
    const isMine = legacyMessage.from !== "them";
    return createMessage({
      id: legacyMessage.id,
      conversationId,
      senderId: isMine ? userId : otherParticipantId,
      receiverId: isMine ? otherParticipantId : userId,
      text,
      createdAt: legacyMessage.ts,
      status: legacyMessage.status || MESSAGE_STATUS.SENT,
      clientKey: legacyMessage.clientKey || null,
      relatedPropertyId: legacyMessage.relatedPropertyId || null,
    });
  },

  async _buildConversation(conversationId, userId, rawMessages) {
    const meta = await this._resolveConversationMeta(conversationId, userId);
    const messages = (Array.isArray(rawMessages) ? rawMessages : [])
      .map((m) => this._toCanonical(m, conversationId, userId, meta.otherParticipantId))
      .filter(Boolean);
    const lastMessage = messages[messages.length - 1] || null;

    // The full-conversation object is also emitted after a message is sent,
    // received, or marked read. Its unread count MUST use the same persisted
    // read cursor as get_conversation_previews(), otherwise opening a chat
    // can correctly update last_read_at in Postgres while the emitted
    // conversation still reports every incoming message in the history as
    // unread. That was the reason the WhatsApp-style badge could remain at
    // e.g. "7" after the user had opened and read all seven messages.
    //
    // Read state is per-user, so only this user's participant row is relevant.
    // If the row is unavailable (for a not-yet-created routing target), the
    // count safely falls back to zero rather than inventing unread state.
    let lastReadAt = null;
    let otherLastDeliveredAt = null;
    let otherLastReadAt = null;
    if (conversationId && userId) {
      const { data: participantRows, error: participantError } = await supabase
        .from('conversation_participants')
        .select('user_id, last_delivered_at, last_read_at')
        .eq('conversation_id', String(conversationId));
      if (!participantError) {
        const own = (participantRows || []).find((row) => String(row.user_id) === String(userId));
        const other = (participantRows || []).find((row) => String(row.user_id) !== String(userId));
        lastReadAt = own?.last_read_at ? new Date(own.last_read_at).getTime() : null;
        otherLastDeliveredAt = other?.last_delivered_at || null;
        otherLastReadAt = other?.last_read_at || null;
      }
    }

    const unreadCount = messages.reduce((count, message) => {
      if (message.senderId === String(userId)) return count;
      if (lastReadAt === null) return count + 1;
      return message.createdAt > lastReadAt ? count + 1 : count;
    }, 0);

    const conversation = createConversation({
      id: conversationId,
      type: meta.type,
      participants: [userId, meta.otherParticipantId],
      propertyId: meta.propertyId,
      contractorId: meta.contractorId,
      roommateId: meta.roommateId,
      lastMessage,
      lastMessageAt: lastMessage?.createdAt ?? null,
      unreadCount,
      displayName: meta.displayName,
      displayAvatar: meta.displayAvatar,
      lastDeliveredAt: otherLastDeliveredAt,
      lastReadAt: otherLastReadAt,
      messages,
    });
    // Internal-only flag so getConversations() can drop orphaned threads
    // (e.g. a contractor/property that no longer exists) exactly like the
    // previous UI silently did.
    conversation._exists = meta.exists;
    return conversation;
  },

  // Only ever called with a single conversation id now (from
  // getConversation() below) — fetches just the most recent
  // MESSAGE_DISPLAY_LIMIT messages server-side (ORDER BY ... DESC LIMIT N,
  // then reversed for display) instead of the previous "fetch every
  // message ever sent in this conversation, then slice to the last N
  // after it's already been downloaded." For a long-running conversation
  // with hundreds of messages, that's the difference between transferring
  // the whole history and transferring only what's actually shown.
  //
  // `cursor`, when given as { sentAt, id }, switches this into
  // cursor-based forward-sync mode: "everything strictly after this
  // point, oldest-first" (see 1002-cursor-message-sync.sql), instead of
  // "the most recent N regardless of what the caller already has". Used
  // by getMessagesSince() below for the reconnect/visibility-regain path,
  // where re-downloading the same most-recent-N window on every
  // reconcile is both wasteful and, for a conversation that received more
  // than MESSAGE_DISPLAY_LIMIT messages while backgrounded, was silently
  // dropping the older half of what was missed.
  async _loadMessages(conversationIds, userId, cursor = null) {
    const ids = [...new Set((conversationIds || []).filter(Boolean).map(String))];
    if (!ids.length) return new Map();
    const id = ids[0];
    const hasCursor = Boolean(cursor?.sentAt && cursor?.id);

    let data;
    let error;

    // The RPC is the preferred path because it performs the participant
    // check inside a SECURITY DEFINER function and avoids client-side RLS
    // policy recursion affecting a valid recipient. Keep the direct query
    // as a compatibility fallback until every deployment has run the new
    // migration.
    const rpcParams = { p_conversation_id: id, p_limit: MESSAGE_DISPLAY_LIMIT };
    if (hasCursor) {
      rpcParams.p_after_sent_at = new Date(cursor.sentAt).toISOString();
      rpcParams.p_after_id = String(cursor.id);
    }
    const rpcResult = await supabase.rpc('get_conversation_messages', rpcParams);
    data = rpcResult.data;
    error = rpcResult.error;

    if (error && /function .*get_conversation_messages|does not exist/i.test(String(error.message || ''))) {
      // Covers both "the RPC doesn't exist at all yet" (pre-1001) and
      // "the 4-arg cursor overload doesn't exist yet" (pre-1002) —
      // Postgres reports a failed overload match the same way as a
      // missing function. In cursor mode there's no sensible direct-query
      // fallback: a full most-recent-N re-fetch here would defeat the
      // entire point of a delta sync (and risk the caller treating a
      // "most recent N" result as if it were "everything since the
      // cursor", re-showing already-seen messages as new). Degrade to
      // "nothing new" instead — the next full getConversation() call
      // (initial load, or this same reconcile path before a cursor
      // exists) still gets the complete picture.
      if (hasCursor) return new Map([[id, []]]);
      const direct = await supabase
        .from('messages')
        .select('id, conversation_id, sender_user_id, body, sent_at')
        .eq('conversation_id', id)
        .is('deleted_at', null)
        .order('sent_at', { ascending: false })
        .limit(MESSAGE_DISPLAY_LIMIT);
      data = direct.data;
      error = direct.error;
    }
    if (error) throw error;

    // Cursor mode already returns oldest-first from the RPC (see the SQL
    // migration) — that's the natural order to append to an existing
    // list, so no reverse. Non-cursor mode returns newest-first and gets
    // reversed, unchanged from before.
    const ordered = hasCursor ? (data || []).slice() : (data || []).slice().reverse();
    const rows = ordered.map((row) => ({
      id: row.id,
      from: String(row.sender_user_id) === String(userId) ? 'me' : 'them',
      text: row.body,
      ts: new Date(row.sent_at).getTime(),
      // Present once the deployment has run 1004-request-viewing-property-
      // linkage.sql; undefined/null on an older deployment or an older
      // message — _toCanonical below just passes through whatever's here,
      // and messageViewModel.js's resolveProperty falls back to its
      // text-parsing heuristic when it's absent.
      relatedPropertyId: row.related_property_id || null,
    }));

    return new Map([[id, rows]]);
  },

  // Fetches one PAGE of conversation previews — not every conversation
  // the user has, and not every message ever sent in them. `before`
  // (a conversations.updated_at value) continues from where a previous
  // page left off, matching how the inbox actually scrolls: the caller
  // asks for the next page only when the user scrolls to the bottom of
  // what's already loaded, instead of everything being fetched upfront.
  //
  // The previous implementation fetched every conversation_participants
  // row for the user, then every message ever sent across ALL of those
  // conversations (slicing to the last 100 only after downloading
  // everything), then ran _buildConversation() — itself several more
  // queries — separately for EACH conversation. For someone with 50
  // conversations that's 150+ queries and unbounded message history just
  // to render one-line previews. This is 4 queries total regardless of
  // how many conversations are in the page: the previews RPC (which
  // itself only ever looks at the single most recent message per
  // conversation, not the history), then three BATCHED lookups — all
  // properties involved, all contractors involved, all user profiles
  // involved — instead of resolving each conversation's display info one
  // at a time.
  async getConversations(userId, { limit = 20, before = null } = {}) {
    if (!userId) return [];
    if (!isOnline()) throw new Error("You're offline — check your connection and try again.");

    const { data: rows, error } = await supabase.rpc('get_conversation_previews', {
      p_limit: limit,
      p_before: before,
    });
    if (error) throw error;
    if (!rows || !rows.length) return [];

    const propertyIds = [...new Set(rows.filter((r) => r.property_id).map((r) => String(r.property_id)))];
    const otherUserIds = [...new Set(rows.filter((r) => r.other_user_id).map((r) => String(r.other_user_id)))];

    const [propertiesRes, contractorsRes, profilesRes] = await Promise.all([
      propertyIds.length
        ? supabase.from('properties').select('id, owner_user_id, landlord_name, gradient').in('id', propertyIds)
        : Promise.resolve({ data: [] }),
      otherUserIds.length
        ? supabase.from('contractors').select('id, user_id, business_name').in('user_id', otherUserIds)
        : Promise.resolve({ data: [] }),
      otherUserIds.length
        ? supabase.from('public_user_profiles').select('id, first_name, surname, display_name, avatar_url').in('id', otherUserIds)
        : Promise.resolve({ data: [] }),
    ]);

    const propertiesById = new Map((propertiesRes.data || []).map((p) => [String(p.id), p]));
    const contractorsByUserId = new Map((contractorsRes.data || []).map((c) => [String(c.user_id), c]));
    const profilesById = new Map((profilesRes.data || []).map((p) => [String(p.id), p]));

    const conversations = rows.map((row) => {
      const otherId = row.other_user_id ? String(row.other_user_id) : null;
      const propertyId = row.property_id ? String(row.property_id) : null;
      const profile = otherId ? profilesById.get(otherId) : null;
      const profileName = profile
        ? profile.display_name || [profile.first_name, profile.surname].filter(Boolean).join(' ').trim()
        : null;

      let type = 'property';
      let contractorId = null;
      let roommateId = null;
      let displayName;
      let displayAvatar;

      if (propertyId) {
        const property = propertiesById.get(propertyId);
        const landlordName = property?.landlord_name || 'Landlord';
        // Same reasoning as _resolveConversationMeta: a real account's own
        // profile (name + photo) takes priority over the listing's static
        // landlord_name/gradient, which is only guaranteed correct on the
        // tenant's own side and has no photo to offer either way.
        displayName = profileName || landlordName;
        displayAvatar = {
          kind: 'avatar',
          grad: profile?.avatar_url ? null : (Array.isArray(property?.gradient) ? property.gradient : null),
          letter: displayName.charAt(0).toUpperCase(),
          url: profile?.avatar_url || null,
        };
      } else {
        const contractor = otherId ? contractorsByUserId.get(otherId) : null;
        if (contractor) {
          type = 'contractor';
          contractorId = contractor.id;
          displayName = contractor.business_name || 'Contractor';
          displayAvatar = { kind: 'wrench' };
        } else {
          type = 'roommate';
          roommateId = otherId;
          displayName = profileName || 'User';
          displayAvatar = {
            kind: 'avatar',
            grad: null,
            letter: displayName.charAt(0).toUpperCase(),
            url: profile?.avatar_url || null,
          };
        }
      }

      const lastMessage = row.last_message_body
        ? createMessage({
            id: `${row.conversation_id}-preview`,
            conversationId: String(row.conversation_id),
            senderId: row.last_message_sender_id ? String(row.last_message_sender_id) : null,
            receiverId: String(userId),
            text: row.last_message_body,
            createdAt: row.last_message_sent_at ? new Date(row.last_message_sent_at).getTime() : Date.now(),
            status: MESSAGE_STATUS.SENT,
          })
        : null;

      return createConversation({
        id: String(row.conversation_id),
        type,
        participants: [String(userId), otherId].filter(Boolean),
        propertyId,
        contractorId,
        roommateId,
        lastMessage,
        lastMessageAt: row.last_message_sent_at
          ? new Date(row.last_message_sent_at).getTime()
          : (row.updated_at ? new Date(row.updated_at).getTime() : null),
        unreadCount: Number(row.unread_count) || 0,
        displayName,
        displayAvatar,
        // Deliberately empty — the inbox only ever needs the preview.
        // Full history loads separately, on demand, when a specific
        // thread is opened (see getConversation()).
        messages: [],
      });
    });

    return conversations;
  },

  // Lightweight cursor-based delta sync, for reconciling an already-open
  // thread after a reconnect/visibility-regain instead of re-fetching the
  // whole most-recent-N window (see getConversation() below, which is
  // what this used to reuse wholesale). `cursor` is { sentAt, id } — the
  // (sent_at, id) of the last message the caller already has; only
  // messages strictly after it come back, oldest-first, ready to append.
  //
  // Deliberately skips _buildConversation() entirely: no participant/
  // unread-count/lastMessage rebuild, no metadata resolution — just the
  // new rows, canonicalized. The caller already has correct metadata from
  // its last full getConversation() call; recomputing it here on every
  // reconcile would be the same wasted work this method exists to avoid.
  // `otherParticipantId` is passed in by the caller (already resolved)
  // rather than re-resolved here, for the same reason.
  async getMessagesSince(conversationId, userId, cursor, otherParticipantId = null) {
    const key = String(conversationId || '');
    if (!key || !userId || !cursor?.sentAt || !cursor?.id) return [];
    if (!isOnline()) throw new Error("You're offline — check your connection and try again.");

    const uid = String(userId);
    const grouped = await this._loadMessages([key], uid, cursor);
    const rows = grouped.get(key) || [];
    return rows.map((m) => this._toCanonical(m, key, uid, otherParticipantId)).filter(Boolean);
  },

  async getConversation(conversationId, userId) {
    const key = String(conversationId || '');
    if (!key || !userId) return this._buildConversation(key, userId, []);
    if (!isOnline()) throw new Error("You're offline — check your connection and try again.");

    const uid = String(userId);

    // IMPORTANT: when the inbox gives us a REAL conversation id, load its
    // messages FIRST. The old flow resolved property/profile/participant
    // metadata before touching the messages table. For the recipient's
    // account that could get caught behind an RLS/profile query and leave
    // the entire composer saying "Syncing messages" even though the thread
    // itself was perfectly valid. A real conversation id is already the
    // authoritative storage key, so message history should be the first
    // operation. Metadata is best-effort enrichment after that.
    let realId = key;
    let grouped = await this._loadMessages([realId], uid);
    let rows = grouped.get(realId) || [];

    // Routing keys (bare property ids / contractor_x / roommate_x) may not
    // be the actual conversation id. Only if the direct lookup returned no
    // history do we resolve the routing key and try the resolved id. This
    // keeps first-open inbox reads fast and, more importantly, makes the
    // recipient's existing thread load independently of display metadata.
    if (!rows.length) {
      const meta = await this._resolveConversationMeta(key, uid);
      realId = String(meta.id || key);
      if (realId !== key) {
        grouped = await this._loadMessages([realId], uid);
        rows = grouped.get(realId) || [];
      }
    }

    // Build the response from the already-fetched history. _buildConversation
    // still resolves metadata for the header, but a metadata failure must not
    // prevent the message history from being returned to the UI.
    try {
      return await this._buildConversation(realId, uid, rows);
    } catch {
      const fallbackMeta = {
        id: realId, type: 'property', propertyId: null, contractorId: null,
        roommateId: null, otherParticipantId: null, displayName: 'Conversation',
        displayAvatar: { kind: 'avatar', letter: '?' }, exists: true,
      };
      const messages = rows.map((m) => this._toCanonical(m, realId, uid, null)).filter(Boolean);
      return createConversation({
        id: realId, type: fallbackMeta.type, participants: [uid],
        propertyId: null, contractorId: null, roommateId: null,
        lastMessage: messages[messages.length - 1] || null,
        lastMessageAt: messages[messages.length - 1]?.createdAt || null,
        unreadCount: 0, displayName: fallbackMeta.displayName,
        displayAvatar: fallbackMeta.displayAvatar, messages,
      });
    }
  },
};
