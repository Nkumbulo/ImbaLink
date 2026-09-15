import { useCallback, useEffect, useState } from 'react';
import { messagingService } from '../../../services/messaging/messagingService';
import { localCache } from '../../../core/cache';

const CONVERSATIONS_PAGE_SIZE = 20;


export function useConversations(userId) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState("online");

  const refresh = useCallback(async ({ force = true } = {}) => {
    if (!userId) {
      setConversations([]);
      setHasMore(true);
      setLoading(false);
      return;
    }

    let cached = null;
    try {
      cached = await localCache.getConversations(userId);
      if (Array.isArray(cached?.value)) {
        setConversations(cached.value);
        setHasMore(cached.value.length >= CONVERSATIONS_PAGE_SIZE);
        // Cache exists, so the inbox is usable immediately. A stale cache
        // refreshes in the background; a fresh cache avoids an unnecessary
        // round-trip on every tab switch/open.
        setLoading(false);
      }
    } catch {}

    if (!force && cached?.hasCache && !cached.stale) return;

    try {
      const list = await messagingService.getConversations(userId, { limit: CONVERSATIONS_PAGE_SIZE });
      const page = Array.isArray(list) ? list : [];
      setConversations(page);
      setHasMore(page.length >= CONVERSATIONS_PAGE_SIZE);
      await localCache.setConversations(userId, page);
      setError(null);
    } catch (err) {
      if (!cached?.hasCache) setError(err instanceof Error ? err.message : "Couldn't load conversations.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // The inbox must reconcile with Supabase every time MessagesPage opens.
    // A fresh local cache can legitimately predate a viewing request that
    // arrived while this page was closed, so `force: false` could return the
    // cached conversation list and hide the new request until the user opened
    // it through Landlord Hub -> Review. Keep the cache for instant first
    // paint, but always perform the server refresh in the background.
    refresh({ force: true });
  }, [refresh]);

  // Fetches the NEXT page, continuing from the oldest conversation
  // currently loaded -- called when the user scrolls near the bottom of
  // the inbox, not upfront. `lastMessageAt` is the same value the server
  // orders by (see get_conversation_previews' updated_at), so paging off
  // of it continues from exactly where the last page left off.
  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore || !conversations.length) return;
    setLoadingMore(true);
    try {
      const oldest = conversations[conversations.length - 1];
      const before = oldest?.lastMessageAt ? new Date(oldest.lastMessageAt).toISOString() : null;
      const nextPage = await messagingService.getConversations(userId, {
        limit: CONVERSATIONS_PAGE_SIZE,
        before,
      });
      const page = Array.isArray(nextPage) ? nextPage : [];
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.filter((c) => !seen.has(c.id))];
      });
      setHasMore(page.length >= CONVERSATIONS_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load more conversations.");
    } finally {
      setLoadingMore(false);
    }
  }, [userId, loadingMore, hasMore, conversations]);

  // Every realtime subscription is cleaned up on unmount / when the user
  // changes, so switching accounts never leaves a stale listener behind.
  useEffect(() => {
    if (!userId) return undefined;
    const unsubscribe = messagingService.subscribeToConversations(userId, (updated) => {
      if (!updated || !updated.id) return;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c.id) === String(updated.id));
        if (idx === -1) {
          // A brand-new conversation needs its display metadata. Refresh the
          // lightweight inbox once, rather than doing a full getConversation
          // for every INSERT. Existing conversations never take this path.
          void refresh({ force: true });
          return prev;
        }
        const current = prev[idx];
        const merged = {
          ...current,
          lastMessage: updated.lastMessage || current.lastMessage,
          lastMessageAt: updated.lastMessageAt || current.lastMessageAt,
          unreadCount: updated.unreadCount != null
            ? Math.max(0, Number(updated.unreadCount) || 0)
            : Math.max(0, Number(current.unreadCount || 0) + Number(updated.unreadCountDelta || 0)),
        };
        const next = prev.map((c, i) => (i === idx ? merged : c));
        const sorted = [...next].sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        void localCache.setConversations(userId, sorted);
        return sorted;
      });
    });
    return unsubscribe;
  }, [userId]);

  useEffect(() => {
    const unsubscribe = messagingService.subscribeToConnectionState(setConnectionState);
    return unsubscribe;
  }, []);

  // Reconcile the inbox list against the database on resume — the same
  // reasoning as the badge mirror in App.jsx: a realtime socket that was
  // dropped while the tab was hidden/offline does not replay what it
  // missed, so a stale preview/unread count would otherwise persist until
  // the next live message. `refresh` already fetches the current absolute
  // state from Supabase and is safe to call repeatedly.
  useEffect(() => {
    if (!userId) return undefined;
    const reconcile = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refresh({ force: true });
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", reconcile);
    if (typeof window !== "undefined") window.addEventListener("online", reconcile);
    return () => {
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", reconcile);
      if (typeof window !== "undefined") window.removeEventListener("online", reconcile);
    };
  }, [userId, refresh]);

  return { conversations, loading, loadingMore, hasMore, loadMore, error, connectionState, refresh };
}

// Reconciles an incoming/confirmed message against what's already shown,
// using clientKey first (covers optimistic-temp -> confirmed) and id
// second (covers a duplicate realtime echo of a message already applied).
// This is the single place dedup happens, per the "no duplicate messages"
