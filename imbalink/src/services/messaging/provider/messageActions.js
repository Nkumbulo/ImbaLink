import { createMessage, MESSAGE_STATUS } from "../messageModel";
import { supabase } from "../../supabase";
import { isOnline } from "./shared";
import { idbPut } from "../../../core/infrastructure/indexeddb";
import { enqueue } from "../../../core/sync/outbox";

// Mixed into SupabaseMessagingProvider.prototype — see connectionState.js for
// why cross-file `this.method()` calls are safe (this file calls
// this._resolveConversationMeta/this._emitMessageEvent/this.getConversation,
// defined in the other mixins).
export const messageActionMethods = {
  // NOTE: there used to be an `_ensureForSend()` method here that was never
  // actually called — sendMessage() below always went straight to the
  // send_message_atomic RPC, which does its own conversation/participant
  // setup server-side. That dead method has been removed so there is
  // exactly one code path for sending a message, not two.

  async sendMessage(conversationId, message) {
    const text = String(message?.text || '').trim().slice(0, 2000);
    if (!text) throw new Error('Cannot send an empty message.');
    const offline = !isOnline();

    // IMPORTANT for iOS/WKWebView: the send path must not wait on a fresh
    // auth.getUser() network/bridge call or re-resolve the entire conversation
    // (property -> participants -> profile) when the open thread already has
    // the authoritative recipient and real conversation id. The previous
    // chain is exactly the kind of request burst that made iPhone appear
    // frozen until the network eventually settled.
    let userId = this._currentUserId ? String(this._currentUserId) : null;
    if (!userId) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) throw new Error('NOT_SIGNED_IN');
      userId = String(authData.user.id);
      this._currentUserId = userId;
    }
    const key = String(conversationId);
    const suppliedRealId = message?.realConversationId ? String(message.realConversationId) : null;

    // FAST PATH: once the thread has a real conversation id, do not perform
    // another metadata/profile/property lookup on every keystroke/send.
    // send_message_atomic() is authoritative and derives the recipient from
    // the existing participant rows, so a stale client recipient is harmless.
    // Routing-key opens (property_<id>, contractor_<id>, etc.) still use the
    // resolver once because they may not yet have a real conversation id.
    let meta;
    if (suppliedRealId) {
      meta = {
        id: suppliedRealId,
        exists: true,
        otherParticipantId: message?.recipientId ? String(message.recipientId) : null,
        propertyId: message?.propertyId ? String(message.propertyId) : null,
        type: message?.propertyId ? 'property' : 'direct',
      };
    } else {
      meta = await this._resolveConversationMeta(key, userId);
      if (!meta.exists) throw new Error('Conversation target was not found.');
      if (!meta.otherParticipantId) throw new Error('Message recipient not found.');
      if (String(meta.otherParticipantId) === userId) throw new Error('Cannot message yourself.');
    }

    const clientKey = message?.clientKey ? String(message.clientKey) : this.generateClientKey?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const localMessage = createMessage({
      id: `local_${clientKey}`,
      conversationId: String(meta.id || key),
      senderId: userId,
      receiverId: String(meta.otherParticipantId),
      text,
      createdAt: Date.now(),
      status: offline ? MESSAGE_STATUS.SENDING : MESSAGE_STATUS.SENDING,
      clientKey,
    });
    // Never block the visible send bubble on IndexedDB. The optimistic
    // message is emitted immediately; persistence is write-through but
    // deliberately off the critical path.
    void idbPut('messages', {
      id: localMessage.id,
      userId,
      conversationId: localMessage.conversationId,
      senderId: userId,
      receiverId: meta.otherParticipantId ? String(meta.otherParticipantId) : null,
      text,
      createdAt: localMessage.createdAt,
      status: localMessage.status,
      clientKey,
      pendingSync: true,
    }).catch(() => {});

    this._emitMessageEvent(key, { type: 'message', message: localMessage });
    if (offline) {
      await enqueue('message.send', {
        entityId: String(meta.id || key),
        payload: {
          conversationId: String(meta.id || key),
          recipientId: meta.otherParticipantId ? String(meta.otherParticipantId) : null,
          propertyId: meta.type === 'property' ? String(meta.propertyId || key) : null,
          text,
          clientKey,
          localMessageId: localMessage.id,
        },
      });
      return localMessage;
    }

    const { data, error } = await supabase.rpc('send_message_atomic', {
      // meta.id is the REAL conversation id — may differ from `key` for a
      // property thread reused from a different listing with the same
      // landlord (see _resolveConversationMetaBase). Writing to `key`
      // directly here would fork a second, disconnected conversation.
      p_conversation_id: meta.id,
      // For an existing conversation the database derives the recipient from
      // its participant rows. This remains safe even when the UI metadata is
      // stale or unavailable.
      p_recipient_user_id: meta.otherParticipantId ? String(meta.otherParticipantId) : null,
      p_property_id: meta.type === 'property' ? String(meta.propertyId || key) : null,
      p_body: text,
      p_client_key: clientKey,
    });
    if (error) {
      console.error('Send message failed:', {
        conversationId: key,
        userId,
        recipientId: meta.otherParticipantId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if (error.code !== 'PGRST202' && !/schema cache|find the function/i.test(error.message || '')) {
        // Supabase was unreachable/transiently failed after the optimistic
        // bubble was shown. Queue exactly this clientKey for automatic retry.
        // The server RPC is idempotent on message id/clientKey, so a race
        // between this queue and a late realtime/RPC response cannot duplicate
        // the message.
        void enqueue('message.send', {
          entityId: String(meta.id || key),
          payload: {
            conversationId: String(meta.id || key),
            recipientId: meta.otherParticipantId ? String(meta.otherParticipantId) : null,
            propertyId: meta.type === 'property' ? String(meta.propertyId || key) : null,
            text,
            clientKey,
            localMessageId: localMessage.id,
          },
        });
      }
      if (error.code === 'PGRST202' || /schema cache|find the function/i.test(error.message || '')) {
        throw new Error(
          'The messaging database function is not installed on this Supabase project yet. ' +
          'Run backend/1000-phase6-messaging-reply-fix.sql in the Supabase SQL Editor, then try again.'
        );
      }
      throw new Error(error.message || 'Message could not be sent.');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error('Message was not confirmed by the server.');

    const confirmed = createMessage({
      id: String(row.id),
      conversationId: String(row.conversation_id || key),
      senderId: String(row.sender_user_id || userId),
      receiverId: String(row.receiver_user_id || meta.otherParticipantId),
      text: row.body || text,
      createdAt: new Date(row.sent_at).getTime(),
      status: MESSAGE_STATUS.SENT,
      clientKey: clientKey,
    });

    this._emitMessageEvent(key, { type: 'message', message: confirmed });
    // The INSERT realtime subscription owns inbox refreshes. Do not issue a
    // second full getConversation() here; it is unnecessary work and can
    // contend with the optimistic send on slower iOS/Capacitor devices.
    return confirmed;
  },

  async _notifyConversationUpdated(conversationId, userId) {
    const conversation = await this.getConversation(conversationId, userId).catch(() => null);
    if (conversation) this._emitConversationEvent(conversation);
  },

  async markMessageAsRead(_messageId) {
    // Read state is tracked per-CONVERSATION, not per-message — see
    // markConversationAsRead() above, which is what the app actually
    // calls. There's no per-message read flag in this schema.
    return true;
  },

  // Marks a conversation read up through `readThrough` (defaults to now)
  // by calling mark_conversation_read() — see the note by
  // get_conversation_previews() in the SQL migration for why this
  // replaced the old local "total minus a locally-tracked seen counter"
  // mechanism entirely: it compared a total that excluded the user's own
  // messages against a snapshot that included them, which could never be
  // reliably correct, and — since it lived only in browser state/a
  // separate local table — reset on every fresh app load regardless.
  // last_read_at in the database is now the only source of truth, so
  // "read" state is identical whether it's read a second later or after
  // fully closing and reopening the app.
  // Marking a conversation read updates the database correctly, but that
  // alone doesn't tell anything ELSE that's currently subscribed (the
  // inbox list, and — separately — App.jsx's own nav-bar badge count,
  // which keeps its own independent copy) that anything changed: the
  // realtime subscription those rely on only fires on a NEW MESSAGE
  // insert, and reading a conversation doesn't insert one. Without this,
  // every subscriber's local unread count only ever updates when a new
  // message arrives — never when the user actually reads what's already
  // there — so a badge could stay stuck at whatever it showed on load
  // even though the database is completely correct. Explicitly emitting
  // the same conversation-updated event the message-insert handler
  // already emits (see subscribeToMessages above) means every current
  // subscriber, no matter how many separate places in the app are
  // listening, gets the corrected (now 0) unread count the same way.
  async markConversationAsDelivered(conversationId) {
    const key = String(conversationId || '');
    if (!key) return false;
    const { error } = await supabase.rpc('mark_conversation_delivered', {
      p_conversation_id: key,
    });
    if (error) {
      console.error('Mark conversation delivered failed:', {
        conversationId: key,
        code: error.code,
        message: error.message,
      });
      return false;
    }
    return true;
  },

  async markConversationAsRead(conversationId, userId, readThrough) {
    const key = String(conversationId || '');
    if (!key) return false;
    const { error } = await supabase.rpc('mark_conversation_read', {
      p_conversation_id: key,
      p_read_through: readThrough ? new Date(readThrough).toISOString() : null,
    });
    if (error) {
      console.error('Mark conversation read failed:', { conversationId: key, code: error.code, message: error.message });
      return false;
    }
    // Immediately synchronize every local inbox/navbar subscriber. Reading a
    // conversation does not create a Postgres message event, so without this
    // explicit event the navbar badge could remain stale until another message
    // arrived. This is intentionally a tiny local event — no history refetch.
    this._emitConversationEvent({
      id: key,
      unreadCount: 0,
      unreadCountDelta: 0,
      messages: [],
    });

    // IMPORTANT for Capacitor/iOS: do not follow a read RPC with a full
    // conversation/history fetch. MessagesPage calls this whenever the open
    // thread changes, so the old implementation could create a chain of
    // network + native-bridge + SQLite work on every new message. The RPC is
    // authoritative; the explicit local event above keeps the inbox and
    // navbar immediately correct.
    return true;
  },

  async createConversation({ participants = [], propertyId = null } = {}) {
    const conversationId = propertyId != null ? String(propertyId) : `conversation-${Date.now()}`;
    const [userId] = participants;
    return this._buildConversation(conversationId, userId, []);
  },

  async deleteMessage(_messageId) {
    throw new Error("deleteMessage() is not supported by the mock provider yet.");
  },

  // Issue: don't let a temporary browser object URL be mistaken for real
  // file storage. This is NOT persisted anywhere — `URL.createObjectURL`
  // only lives for this page session and is gone on refresh/another
  // device. `isMock: true` flags that explicitly so a caller could warn
  // the user, and so this is a one-line swap (implement the same method
  // against Supabase Storage, drop `isMock`) rather than a Messages
  // redesign when real attachment storage is added.
  async uploadAttachment(file) {
    if (!isOnline()) throw new Error("You're offline — try again once you're reconnected.");
    const url = typeof URL !== "undefined" && file ? URL.createObjectURL(file) : null;
    return {
      url,
      name: file?.name || "attachment",
      size: file?.size || 0,
      type: file?.type || "application/octet-stream",
      isMock: true,
    };
  },
};
