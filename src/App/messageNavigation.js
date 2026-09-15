// `threads` (below) exists only so ProfilePage / LandlordDashboardPage /
// the topbar unread badge — none of which were part of the messaging
// architecture refactor — keep working unchanged. It's a legacy-shaped
// mirror of whatever the messaging service already persists, rebuilt from
// canonical messages on every conversation update rather than an
// independent store, so it can never drift out of sync with the Messages
// page itself.
export function toLegacyThreadMessages(messages, currentUserId) {
  return (Array.isArray(messages) ? messages : []).map((m) => ({
    id: m.id,
    from: m.senderId === currentUserId ? "me" : "them",
    text: m.text,
    ts: m.createdAt,
  }));
}

// App-level navigation is intentionally kept separate from the canonical
// conversation id. Pages may open messaging with a property/contractor/
// roommate target, while MessagesPage resolves that target to the real
// conversation id. App.jsx must therefore pass a stable routing target and
// never invent or persist a second conversation id.
export function createMessageNavigation({ propertyId, otherUserId, contractorId, contractorName, roommateId, roommateName, templateMessage } = {}) {
  const next = {};
  if (propertyId !== undefined && propertyId !== null && propertyId !== "") next.propertyId = String(propertyId);
  // Only meaningful alongside propertyId: tells MessagesPage exactly who
  // the other side of the conversation is instead of guessing from the
  // property's owner field, which is wrong whenever the CALLER is that
  // owner (see openMessageThread's second argument for why this exists).
  if (otherUserId !== undefined && otherUserId !== null && otherUserId !== "") next.otherUserId = String(otherUserId);
  if (contractorId !== undefined && contractorId !== null && contractorId !== "") {
    next.contractorId = String(contractorId);
    if (contractorName) next.contractorName = contractorName;
  }
  if (roommateId !== undefined && roommateId !== null && roommateId !== "") {
    next.roommateId = String(roommateId);
    if (roommateName) next.roommateName = roommateName;
  }
  if (templateMessage) next.templateMessage = String(templateMessage);
  return next;
}

