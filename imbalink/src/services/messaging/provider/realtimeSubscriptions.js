import { createMessage, MESSAGE_STATUS } from "../messageModel";
import { supabase } from "../../supabase";
import { localCache } from "../../../core/cache/localCache";

// Mixed into SupabaseMessagingProvider.prototype — see connectionState.js for
// why cross-file `this.method()` calls (e.g. this.markConversationAsDelivered,
// defined in messageActions.js) are safe here.
export const realtimeSubscriptionMethods = {
  subscribeToMessages(conversationId, callback) {
    if (!conversationId || typeof callback !== "function") return () => {};
    const key = String(conversationId);
    if (!this._messageListeners.has(key)) this._messageListeners.set(key, new Set());
    this._messageListeners.get(key).add(callback);

    // Reuse one Supabase channel per conversation. React can briefly create
    // overlapping subscriptions while switching from a routing key to the
    // resolved real conversation id; creating duplicate channels for the
    // same key wastes sockets and can deliver the same INSERT twice.
    if (this._messageChannels.has(key)) {
      return () => {
        const listeners = this._messageListeners.get(key);
        if (listeners) {
          listeners.delete(callback);
          if (!listeners.size) {
            this._messageListeners.delete(key);
            const existing = this._messageChannels.get(key);
            this._messageChannels.delete(key);
            if (existing) void supabase.removeChannel(existing);
          }
        }
      };
    }

    // Keep the sender's local UI and the recipient's browser synchronized from
    // the real Supabase messages table. The previous implementation only had
    // an in-memory listener, so another user could not see a newly sent
    // message until a full reload.
    const channel = supabase
      .channel(`imbalink-message-${key}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${key}` },
        async (payload) => {
          const row = payload?.new;
          if (!row?.id) return;
          const currentUserId = this._currentUserId;
          if (!currentUserId) return;
          const message = createMessage({
            id: row.id,
            conversationId: key,
            senderId: String(row.sender_user_id),
            receiverId: String(row.sender_user_id) === currentUserId ? null : currentUserId,
            text: row.body,
            createdAt: new Date(row.sent_at).getTime(),
            status: MESSAGE_STATUS.SENT,
            // send_message_atomic stores the sender's client-generated key AS
            // the row's own id (COALESCE(v_client_key, gen_random_uuid())),
            // so row.id IS that clientKey whenever the sender supplied one.
            // Without this, a Realtime echo of your own just-sent message
            // that arrives before the RPC call's own response resolves can't
            // be matched against the optimistic bubble by clientKey (only
            // the direct RPC response set it), so the dedup in
            // useMessaging.js falls through to appending it as a second,
            // duplicate message instead of reconciling with the first.
            clientKey: row.id,
          });
          this._emitMessageEvent(key, { type: 'message', message });

          // Receiving a message while this conversation is subscribed means
          // this client has received/synced it. Advance only THIS user's
          // conversation-level delivery cursor; the RPC derives identity
          // from auth.uid() and never trusts a client-supplied user id.
          if (String(row.sender_user_id) !== currentUserId) {
            void this.markConversationAsDelivered(key).catch((error) => {
              console.warn('Unable to mark conversation delivered:', error);
            });
          }

          // Do not synchronously rebuild the entire conversation here. On
          // iOS/Capacitor this callback can race the send RPC and trigger
          // several nested Supabase reads/state updates, making the UI feel
          // frozen after sending. The message event is already enough for the
          // open thread; the inbox subscription handles its own preview.
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${key}` },
        async (payload) => {
          const row = payload?.new;
          if (!row?.conversation_id) return;
          const currentUserId = this._currentUserId;
          if (!currentUserId || String(row.user_id) === currentUserId) return;

          this._emitMessageEvent(key, {
            type: 'conversation-status',
            lastDeliveredAt: row.last_delivered_at || null,
            lastReadAt: row.last_read_at || null,
          });
          // The open-thread listener already received the exact status cursor.
          // Avoid an extra full history/meta query on every tick/read update.
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Ephemeral, not persisted — typing state has no meaning after a
        // refresh, unlike messages/unread/presence, so Broadcast (not a
        // database write) is the right tool here: zero extra DB load per
        // keystroke and nothing to reconcile on reconnect.
        const data = payload?.payload || {};
        const currentUserId = this._currentUserId;
        const fromUserId = data.userId ? String(data.userId) : null;
        if (!fromUserId || !currentUserId || fromUserId === currentUserId) return;
        this._emitMessageEvent(key, {
          type: 'typing',
          userId: fromUserId,
          isTyping: Boolean(data.isTyping),
        });
      })
      .subscribe();

    this._messageChannels.set(key, channel);

    return () => {
      const set = this._messageListeners.get(key);
      if (set) {
        set.delete(callback);
        if (!set.size) this._messageListeners.delete(key);
      }
      if (!set?.size && this._messageChannels.get(key) === channel) {
        this._messageChannels.delete(key);
        void supabase.removeChannel(channel);
      }
    };
  },

  // Broadcasts this user's typing state to whoever else is currently
  // subscribed to this conversation. Reuses the channel already opened by
  // subscribeToMessages for the same conversation id when one is open
  // (the normal case — the composer is only visible while that
  // subscription exists); if it isn't found for some reason, this is a
  // no-op rather than standing up a whole extra channel just to send one
  // ephemeral signal. Never persisted to the database — see the receiving
  // handler's comment above for why.
  sendTypingSignal(conversationId, isTyping) {
    const key = String(conversationId || '');
    const currentUserId = this._currentUserId;
    if (!key || !currentUserId) return;
    const channel = this._messageChannels.get(key);
    if (!channel) return;
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: Boolean(isTyping) },
    }).catch(() => {});
  },

  _syncMessageToLocalCache(userId, conversationId, message) {
    const key = `${String(userId)}:${String(conversationId)}`;
    const previous = this._messageCacheQueues.get(key) || Promise.resolve();
    const task = previous
      .catch(() => {})
      .then(async () => {
        const cached = await localCache.getMessages(userId, conversationId);
        const existing = Array.isArray(cached?.value) ? cached.value : [];
        if (existing.some((item) => String(item?.id) === String(message?.id))) return;
        const next = [...existing, message].sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));
        await localCache.setMessages(userId, conversationId, next);
      })
      .catch(() => {});
    this._messageCacheQueues.set(key, task);
    task.finally(() => {
      if (this._messageCacheQueues.get(key) === task) this._messageCacheQueues.delete(key);
    });
  },

  subscribeToConversations(userId, callback) {
    if (!userId || typeof callback !== "function") return () => {};
    this._conversationListeners.add(callback);
    const seenMessageIds = new Set();

    // Conversation membership is persisted in Supabase. IMPORTANT for
    // Capacitor/iOS: never call getConversation() from this INSERT handler.
    // That loads message history + participant/profile metadata while the
    // same INSERT is also being processed by the open-thread subscription.
    // On mobile this can create competing native/network work and make the
    // whole WebView appear unresponsive. Emit a tiny preview event instead;
    // the existing conversation entry is updated locally by the hooks.
    const channel = supabase
      .channel(`imbalink-inbox-${String(userId)}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload?.new;
        const conversationId = row?.conversation_id;
        if (!conversationId || !row?.id) return;

        // Deduplicate per subscription. Multiple independent consumers are
        // allowed to process the same database event, but one consumer must
        // never count the same message twice after a realtime redelivery.
        const messageId = String(row.id);
        if (seenMessageIds.has(messageId)) return;
        seenMessageIds.add(messageId);
        if (seenMessageIds.size > 500) {
          const oldest = seenMessageIds.values().next().value;
          if (oldest) seenMessageIds.delete(oldest);
        }

        const senderId = row.sender_user_id ? String(row.sender_user_id) : null;
        const isIncoming = senderId && senderId !== String(userId);
        this._emitConversationEvent({
          id: String(conversationId),
          lastMessage: createMessage({
            id: `${conversationId}-preview-${row.id}`,
            conversationId: String(conversationId),
            senderId,
            receiverId: String(userId),
            text: row.body || '',
            createdAt: row.sent_at ? new Date(row.sent_at).getTime() : Date.now(),
            status: MESSAGE_STATUS.SENT,
          }),
          lastMessageAt: row.sent_at ? new Date(row.sent_at).getTime() : Date.now(),
          unreadCountDelta: isIncoming ? 1 : 0,
          messages: [],
        });

        // Persist the realtime message into the local thread cache as well.
        // Supabase remains authoritative, but this makes the next chat open
        // paint the newly received message immediately instead of showing an
        // empty/stale cached thread while the database fetch is in flight.
        const syncedMessage = createMessage({
          id: messageId,
          conversationId: String(conversationId),
          senderId,
          receiverId: isIncoming ? String(userId) : null,
          text: row.body || '',
          createdAt: row.sent_at ? new Date(row.sent_at).getTime() : Date.now(),
          status: MESSAGE_STATUS.SENT,
          clientKey: messageId,
        });
        void this._syncMessageToLocalCache(userId, String(conversationId), syncedMessage);
      })
      .subscribe();

    return () => {
      this._conversationListeners.delete(callback);
      seenMessageIds.clear();
      supabase.removeChannel(channel);
    };
  },

  _emitMessageEvent(conversationId, event) {
    const set = this._messageListeners.get(String(conversationId));
    if (!set) return;
    set.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.warn("messaging listener error:", err);
      }
    });
  },

  _emitConversationEvent(conversation) {
    this._conversationListeners.forEach((cb) => {
      try {
        cb(conversation);
      } catch (err) {
        console.warn("messaging listener error:", err);
      }
    });
  },
};
