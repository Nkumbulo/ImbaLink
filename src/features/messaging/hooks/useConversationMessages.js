import { useCallback, useEffect, useRef, useState } from 'react';
import { messagingService } from '../../../services/messaging/messagingService';
import { MESSAGE_STATUS, createMessage } from '../../../services/messaging/messageModel';
import { localCache } from '../../../core/cache';
import { applyMessageEvent } from '../utils/messageEvents';
import {
  cacheMessages,
  getCachedMessages,
  scheduleMessageCacheWrite,
} from '../utils/messageCache';
import { MESSAGE_LOAD_TIMEOUT_MS, withMessageLoadTimeout } from '../utils/messageTimeout';
import { getLatestServerCursor } from '../utils/messageCursor';

export function useConversationMessages(conversationId, userId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pendingTextRef = useRef(new Map());
  // Mirrors `messages` synchronously so the reconcile effect can read the
  // latest list (to derive a sync cursor from it) without depending on
  // React's setState batching timing or needing the effect to re-run on
  // every message change — same pattern as pendingTextRef below.
  const messagesRef = useRef([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  // The resolved conversation's own displayName/displayAvatar/otherParticipantId
  // — the SAME resolution getConversation() already does correctly (looking
  // up the real other participant's actual name, not a static guess tied to
  // whichever property/contractor/roommate page the thread was opened
  // from). Exposed here so the UI can show the right name from a single
  // source of truth regardless of entry point, instead of each entry point
  // (direct property nav, contractor, roommate, inbox click) keeping its
  // own separate, sometimes-stale copy.
  const [conversationMeta, setConversationMeta] = useState(null);
  // Mirrors `conversationMeta` for the same reason as messagesRef — read
  // inside the reconcile effect below without pulling conversationMeta
  // into that effect's own dependency array (which would tear down and
  // re-add the visibilitychange/online listeners every time metadata
  // changes, not just when the thread itself changes).
  const conversationMetaRef = useRef(null);
  useEffect(() => {
    conversationMetaRef.current = conversationMeta;
  }, [conversationMeta]);
  // The REAL conversation id, as resolved by getConversation() — may
  // differ from the `conversationId` prop, which is just the routing key
  // whatever entry point was used (a bare property id, "contractor_x",
  // etc.). They happen to be equal for the common case (first-ever
  // contact with someone), but not always — e.g. messaging a landlord
  // about a second listing when you already have an open thread with
  // them reuses the FIRST listing's conversation id. The realtime
  // subscription below has to filter on the real id, not the routing key
  // — otherwise live updates silently stop working the moment those two
  // diverge, which is exactly the "messages don't update in realtime
  // while I'm in the chat" bug this fixes. Falls back to the routing key
  // until the real id resolves, so the subscription is never left with
  // nothing to filter on.
  const [resolvedConversationId, setResolvedConversationId] = useState(null);
  // The other participant's live typing state, driven by the 'typing'
  // broadcast event (see subscribeToMessages in supabaseMessagingProvider.js).
  // Ephemeral by design — not persisted, not restored from cache/DB — so it
  // always starts false on mount/thread-switch. typingTimeoutRef auto-clears
  // it if a "stopped typing" broadcast is ever missed (tab closed mid-type,
  // dropped connection), so the indicator can never get stuck on.
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!conversationId || !userId) {
      setMessages([]);
      setConversationMeta(null);
      setResolvedConversationId(null);
      setOtherIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return undefined;
    }
    let active = true;
    let cacheReady = false;
    setConversationMeta(null);
    setResolvedConversationId(null);
    setLoading(true);
    // A new thread was opened (or switched to) — any typing indicator on
    // screen belonged to whatever conversation was open before.
    setOtherIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Seed synchronously, in the SAME tick as the conversationId change —
    // before any awaited work below. `useConversationMessages` is a single
    // long-lived hook instance inside MessagesPage (switching threads sets
    // state, it does not remount the component), so without this the
    // `messages` array kept showing the PREVIOUS conversation's messages
    // until the first `await` below resolved (at least one microtask/IO
    // tick later), i.e. switching straight from conversation A to B briefly
    // rendered A's messages under B's header. The in-memory
    // conversationMessageCache lookup is synchronous (a plain Map), so
    // reading it here — before the async IIFE's first await — either shows
    // B's already-known messages immediately or an empty list; it never
    // shows A's.
    setMessages(getCachedMessages(conversationId));

    // Loading must never depend on a cache adapter, profile lookup, RLS
    // metadata query, or a stalled native bridge. This watchdog is separate
    // from the network request timeout below because those cache/metadata
    // operations happen before the request timeout starts.
    const loadingWatchdog = setTimeout(() => {
      if (!active) return;
      setLoading(false);
      setError((prev) => prev || "Message sync is taking too long. You can still try the chat again.");
    }, MESSAGE_LOAD_TIMEOUT_MS + 1500);

    (async () => {
      let cachedRecord = null;
      try {
        // Persisted monotonic delivery/read cursors are painted immediately.
        // Supabase remains authoritative and refreshes below, but a cached
        // blue double-tick should never flash back to an un-ticked message
        // just because the app was reopened.
        const cachedStatus = await localCache.getConversationStatus(userId, conversationId);
        if (active && cachedStatus?.value) {
          setConversationMeta((prev) => ({
            ...(prev || {}),
            lastDeliveredAt: cachedStatus.value.lastDeliveredAt || null,
            lastReadAt: cachedStatus.value.lastReadAt || null,
          }));
        }

        const memory = getCachedMessages(conversationId);
        if (memory.length) {
          cacheReady = true;
          setMessages(memory);
          setLoading(false);
        } else {
          cachedRecord = await localCache.getMessages(userId, conversationId);
          if (Array.isArray(cachedRecord?.value)) {
            cacheReady = true;
            cacheMessages(conversationId, cachedRecord.value);
            setMessages(cachedRecord.value);
            setLoading(false);
          }
        }
      } catch { /* best-effort cache/metadata warm-up; live fetch below is authoritative */ }

      // Even with a fresh message cache, resolve the conversation metadata in
      // the background. The cached thread paints first; this request only
      // corrects the real conversation id/contact metadata and does not
      // control the loading state.
      try {
        const conversation = await withMessageLoadTimeout(
          messagingService.getConversation(conversationId, userId)
        );
        if (!active) return;
        const fetchedMessages = Array.isArray(conversation?.messages) ? conversation.messages : [];
        setMessages(fetchedMessages);
        cacheMessages(conversationId, fetchedMessages);
        await localCache.setMessages(userId, conversationId, fetchedMessages);
        if (conversation?.id) {
          cacheMessages(conversation.id, fetchedMessages);
          await localCache.setMessages(userId, conversation.id, fetchedMessages);
        }
        const nextConversationMeta = conversation
          ? {
              displayName: conversation.displayName,
              displayAvatar: conversation.displayAvatar,
              otherParticipantId:
                conversation.participants?.find((id) => String(id) !== String(userId)) || null,
              propertyId: conversation.propertyId || null,
              lastDeliveredAt: conversation.lastDeliveredAt || null,
              lastReadAt: conversation.lastReadAt || null,
              exists: conversation._exists !== false,
            }
          : null;
        setConversationMeta(nextConversationMeta);
        if (nextConversationMeta) {
          const status = {
            lastDeliveredAt: nextConversationMeta.lastDeliveredAt,
            lastReadAt: nextConversationMeta.lastReadAt,
          };
          await localCache.setConversationStatus(userId, conversation?.id || conversationId, status);
          if (String(conversation?.id || conversationId) !== String(conversationId)) {
            await localCache.setConversationStatus(userId, conversationId, status);
          }
        }
        setResolvedConversationId(conversation?.id ? String(conversation.id) : String(conversationId));
        setError(null);
      } catch (err) {
        if (active && !cacheReady) setError(err instanceof Error ? err.message : "Couldn't load messages.");
      } finally {
        clearTimeout(loadingWatchdog);
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      clearTimeout(loadingWatchdog);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    // Subscribe using the REAL id once it's resolved — falling back to the
    // routing key only for the brief window before getConversation()
    // above returns. Re-subscribing once the real id arrives is cheap and
    // correct; staying subscribed to a routing key that turns out not to
    // be the real storage id is what silently broke live updates.
    const key = resolvedConversationId || conversationId;
    if (!key) return undefined;
    const unsubscribe = messagingService.subscribeToMessages(key, (event) => {
      if (event?.type === 'conversation-status') {
        setConversationMeta((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            lastDeliveredAt: event.lastDeliveredAt ?? prev.lastDeliveredAt ?? null,
            lastReadAt: event.lastReadAt ?? prev.lastReadAt ?? null,
          };
          void localCache.setConversationStatus(userId, key, {
            lastDeliveredAt: next.lastDeliveredAt,
            lastReadAt: next.lastReadAt,
          });
          return next;
        });
        return;
      }

      if (event?.type === 'typing') {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (event.isTyping) {
          setOtherIsTyping(true);
          // Auto-clear if the matching "stopped typing" broadcast never
          // arrives (their tab closed, connection dropped mid-keystroke) —
          // without this a missed stop event would leave "typing…" showing
          // forever. Comfortably longer than the composer's own idle-stop
          // delay so a normal pause between keystrokes never flickers it.
          typingTimeoutRef.current = setTimeout(() => setOtherIsTyping(false), 4000);
        } else {
          setOtherIsTyping(false);
        }
        return;
      }

      setMessages((prev) => {
        const next = applyMessageEvent(prev, event);
        cacheMessages(key, next);
        if (conversationId) cacheMessages(conversationId, next);
        scheduleMessageCacheWrite(userId, key, next);
        if (conversationId) scheduleMessageCacheWrite(userId, conversationId, next);
        return next;
      });
    });
    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, resolvedConversationId]);

  // Reconcile the OPEN thread against the database when the tab regains
  // visibility or the network returns. The realtime subscription above
  // gives live updates only while the socket is actually connected — a
  // Safari tab suspension, a dropped mobile connection, or a laptop sleep
  // can silently drop that socket without replaying whatever was sent
  // during the gap (Supabase Realtime does not queue missed events per
  // client). Without this, a message sent to an open-but-backgrounded
  // conversation could stay invisible until some unrelated action
  // triggered a refetch. Applies each fetched message through the same
  // applyMessageEvent dedup the live subscription uses, one at a time, so
  // an in-flight optimistic/pending send (a "temp-" id not yet confirmed
  // by the server) is reconciled by clientKey instead of being wiped out
  // by a wholesale replace.
  //
  // Cursor-based sync (see getMessagesSince / 1002-cursor-message-sync.sql):
  // once there's at least one confirmed message to anchor to, this asks
  // for "everything after the last message I already have" instead of
  // re-fetching the whole most-recent-100 window on every single
  // reconcile. Two real problems that fixed, not just wasted bandwidth:
  // (1) a conversation that received MORE than 100 messages while
  // backgrounded used to silently lose the older half of what was
  // missed, since "most recent 100" has no memory of where the client
  // left off; a cursor has no such ceiling. (2) every tab-focus and every
  // network reconnect — which can happen many times in one session on a
  // spotty mobile connection — no longer re-downloads up to 100 messages
  // just to find zero or one new ones.
  useEffect(() => {
    const key = resolvedConversationId || conversationId;
    if (!key || !userId) return undefined;

    const applyFetched = (fetched) => {
      if (!fetched.length) return;
      setMessages((prev) => {
        const next = fetched.reduce(
          (acc, message) => applyMessageEvent(acc, { type: "message", message }),
          prev
        );
        cacheMessages(key, next);
        if (conversationId) cacheMessages(conversationId, next);
        scheduleMessageCacheWrite(userId, key, next);
        if (conversationId) scheduleMessageCacheWrite(userId, conversationId, next);
        return next;
      });
    };

    const reconcile = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const cursor = getLatestServerCursor(messagesRef.current);
      if (!cursor) {
        // Nothing confirmed yet to sync forward from (brand-new thread,
        // or still waiting on the very first send) — fall back to the
        // full-conversation fetch, exactly as before.
        withMessageLoadTimeout(messagingService.getConversation(key, userId))
          .then((conversation) => applyFetched(Array.isArray(conversation?.messages) ? conversation.messages : []))
          .catch(() => {});
        return;
      }

      withMessageLoadTimeout(
        messagingService.getMessagesSince(key, userId, cursor, conversationMetaRef.current?.otherParticipantId || null)
      )
        .then((fetched) => applyFetched(Array.isArray(fetched) ? fetched : []))
        .catch(() => {});
    };

    if (typeof document !== "undefined") document.addEventListener("visibilitychange", reconcile);
    if (typeof window !== "undefined") window.addEventListener("online", reconcile);
    return () => {
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", reconcile);
      if (typeof window !== "undefined") window.removeEventListener("online", reconcile);
    };
  }, [conversationId, resolvedConversationId, userId]);

  const sendMessage = useCallback(
    (text) => {
      const trimmed = String(text || "").trim();
      if (!trimmed || !conversationId || !userId) return;

      const clientKey = messagingService.generateClientKey();
      const tempId = `temp-${clientKey}`;
      pendingTextRef.current.set(tempId, trimmed);

      const optimistic = createMessage({
        id: tempId,
        conversationId,
        senderId: userId,
        text: trimmed,
        createdAt: Date.now(),
        status: MESSAGE_STATUS.SENDING,
        clientKey,
      });
      setMessages((prev) => {
        const next = [...prev, optimistic];
        cacheMessages(conversationId, next);
        scheduleMessageCacheWrite(userId, conversationId, next);
        return next;
      });

      messagingService
        .sendMessage(conversationId, {
          text: trimmed,
          senderId: userId,
          clientKey,
          recipientId: conversationMeta?.otherParticipantId || null,
          realConversationId: resolvedConversationId || null,
          propertyId: conversationMeta?.propertyId || null,
        })
        .then((confirmed) => {
          pendingTextRef.current.delete(tempId);
          setMessages((prev) => {
            const next = applyMessageEvent(prev, { type: "message", message: confirmed });
            cacheMessages(conversationId, next);
            scheduleMessageCacheWrite(userId, conversationId, next);
            if (confirmed?.conversationId) {
              cacheMessages(confirmed.conversationId, next);
              scheduleMessageCacheWrite(userId, confirmed.conversationId, next);
            }
            return next;
          });
        })
        .catch(() => {
          setMessages((prev) => {
            const next = prev.map((m) => (m.id === tempId ? { ...m, status: MESSAGE_STATUS.FAILED } : m));
            scheduleMessageCacheWrite(userId, conversationId, next);
            return next;
          });
        });
    },
    [conversationId, userId, conversationMeta, resolvedConversationId]
  );

  const retryMessage = useCallback(
    (messageId) => {
      const text = pendingTextRef.current.get(messageId);
      if (!text || !conversationId || !userId) return;

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: MESSAGE_STATUS.SENDING } : m)));
      const clientKey = messageId.replace(/^temp-/, "");

      messagingService
        .sendMessage(conversationId, {
          text,
          senderId: userId,
          clientKey,
          recipientId: conversationMeta?.otherParticipantId || null,
          realConversationId: resolvedConversationId || null,
          propertyId: conversationMeta?.propertyId || null,
        })
        .then((confirmed) => {
          pendingTextRef.current.delete(messageId);
          setMessages((prev) => {
            const next = applyMessageEvent(prev, { type: "message", message: confirmed });
            cacheMessages(conversationId, next);
            scheduleMessageCacheWrite(userId, conversationId, next);
            if (confirmed?.conversationId) {
              cacheMessages(confirmed.conversationId, next);
              scheduleMessageCacheWrite(userId, confirmed.conversationId, next);
            }
            return next;
          });
        })
        .catch(() => {
          setMessages((prev) => {
            const next = prev.map((m) => (m.id === messageId ? { ...m, status: MESSAGE_STATUS.FAILED } : m));
            scheduleMessageCacheWrite(userId, conversationId, next);
            return next;
          });
        });
    },
    [conversationId, userId, conversationMeta, resolvedConversationId]
  );

  return { messages, loading, error, sendMessage, retryMessage, conversationMeta, resolvedConversationId, otherIsTyping };
}
