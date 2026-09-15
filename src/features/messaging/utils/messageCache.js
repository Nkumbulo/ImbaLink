import { localCache } from '../../../core/cache';

// Persistent native cache + tiny same-session mirror. Keeping cache concerns
// outside React hooks makes messaging state easier to reason about and test.
const conversationMessageCache = new Map();
const messageCacheTimers = new Map();

export function getCachedMessages(conversationId) {
  if (!conversationId) return [];
  const cached = conversationMessageCache.get(String(conversationId));
  return Array.isArray(cached) ? cached : [];
}

export function cacheMessages(conversationId, messages) {
  if (!conversationId || !Array.isArray(messages)) return;
  conversationMessageCache.set(String(conversationId), messages);
}

export function scheduleMessageCacheWrite(userId, conversationId, messages) {
  if (!userId || !conversationId) return;
  const key = `${userId}:${conversationId}`;
  const existing = messageCacheTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    messageCacheTimers.delete(key);
    void localCache.setMessages(userId, conversationId, messages).catch(() => {});
  }, 350);
  messageCacheTimers.set(key, timer);
}
