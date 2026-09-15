// Centralized message reconciliation. Both realtime events and send responses
// use this function so optimistic messages cannot be duplicated.
export function applyMessageEvent(prev, event) {
  if (!event || !event.message) return prev;
  const incoming = event.message;

  if (event.type === 'message-deleted') {
    return prev.filter((message) => message.id !== incoming.id);
  }

  const byClientKey = incoming.clientKey
    ? prev.findIndex((message) => message.clientKey && message.clientKey === incoming.clientKey)
    : -1;
  if (byClientKey !== -1) {
    return prev.map((message, index) => (index === byClientKey ? incoming : message));
  }

  const byId = prev.findIndex((message) => message.id === incoming.id);
  if (byId !== -1) {
    return prev.map((message, index) => (index === byId ? incoming : message));
  }

  if (event.type === 'message-updated') return prev;
  return [...prev, incoming];
}
