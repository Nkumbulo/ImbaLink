// Derives a sync cursor — { sentAt, id } — from the last message in a
// message list that's actually confirmed by the server. Optimistic
// "temp-<clientKey>" entries (see useConversationMessages.js's sendMessage)
// don't have a real sent_at yet and can't anchor a cursor; messages render
// in ascending createdAt order, so scanning from the end for the first
// non-temp entry finds the latest valid cursor. Returns null when there's
// nothing to anchor to yet (brand-new thread, or every message so far is
// still pending).
//
// Kept in its own module (rather than inline in the hook) specifically so
// it can be unit-tested without importing useConversationMessages.js,
// which transitively instantiates the live SupabaseMessagingProvider.
export function getLatestServerCursor(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m.id !== 'string' || m.id.startsWith('temp-')) continue;
    if (!m.createdAt) continue;
    return { sentAt: m.createdAt, id: m.id };
  }
  return null;
}
