// Superseded: the messaging system now has exactly one implementation.
// Use messagingService.sendMessage() (services/messaging/messagingService.js),
// which the Messages UI and the "Request Viewing" flow both already go
// through. This stub exists only so an old call site fails loudly
// instead of silently writing through a second, divergent code path.
export async function addMessage(_conversationId, _message) {
  throw new Error(
    'db.addMessage() has been removed. Use messagingService.sendMessage() instead.'
  );
}
