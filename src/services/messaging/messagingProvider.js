/**
 * Provider-agnostic messaging contract.
 *
 * The Messages UI never imports a provider directly and never contains
 * provider-specific code (no `supabase.from(...)`, `firebase.firestore()`,
 * `twilio.messages.create()`, etc.) — it only ever talks to
 * `messagingService` (see messagingService.js), which forwards calls to
 * whichever provider is currently active.
 *
 * To connect a real backend later, implement this class and call
 * `setMessagingProvider(new YourProvider(...))` once, e.g. in App.jsx:
 *
 *   import { setMessagingProvider } from "./messagingService";
 *   import { SupabaseMessagingProvider } from "./supabaseMessagingProvider";
 *   setMessagingProvider(new SupabaseMessagingProvider(supabaseClient));
 *
 * Nothing in MessagesPage.jsx or the useMessaging hooks needs to change.
 */
export class MessagingProvider {
  /** Return Conversation[] for the given user. */
  async getConversations(_userId) {
    throw new Error("MessagingProvider.getConversations() is not implemented");
  }

  /** Return a single Conversation (including its full message history). */
  async getConversation(_conversationId, _userId) {
    throw new Error("MessagingProvider.getConversation() is not implemented");
  }

  /** Send a message; resolves with the confirmed Message. */
  async sendMessage(_conversationId, _message) {
    throw new Error("MessagingProvider.sendMessage() is not implemented");
  }

  /**
   * Subscribe to realtime events for one conversation. `callback` receives
   * { type: "message" | "message-updated" | "message-deleted", message }.
   * Returns an unsubscribe function — callers MUST call it on cleanup.
   */
  subscribeToMessages(_conversationId, _callback) {
    throw new Error("MessagingProvider.subscribeToMessages() is not implemented");
  }

  /**
   * Best-effort, ephemeral typing signal for the given conversation — never
   * persisted, so a provider that doesn't implement it should just no-op
   * rather than break the composer. Received by other subscribers of the
   * same conversation as a `{ type: "typing", userId, isTyping }` event via
   * subscribeToMessages.
   */
  sendTypingSignal(_conversationId, _isTyping) {}

  /**
   * Subscribe to conversation-level updates (new/changed conversations for
   * this user, regardless of which one is currently open) so an inbox list
   * can update previews/unread counts live. Returns an unsubscribe function.
   */
  subscribeToConversations(_userId, _callback) {
    throw new Error("MessagingProvider.subscribeToConversations() is not implemented");
  }

  /** Subscribe to connection-state changes: "online" | "offline" | "reconnecting". */
  subscribeToConnectionState(_callback) {
    throw new Error("MessagingProvider.subscribeToConnectionState() is not implemented");
  }

  async markMessageAsRead(_messageId) {
    throw new Error("MessagingProvider.markMessageAsRead() is not implemented");
  }

  async markConversationAsRead(_conversationId, _userId, _readThrough) {
    throw new Error("MessagingProvider.markConversationAsRead() is not implemented");
  }

  async createConversation(_input /* { participants, propertyId } */) {
    throw new Error("MessagingProvider.createConversation() is not implemented");
  }

  async deleteMessage(_messageId) {
    throw new Error("MessagingProvider.deleteMessage() is not implemented");
  }

  /**
   * Upload a file; resolves with an attachment descriptor
   * { url, name, size, type, isMock }. `isMock: true` means `url` is a
   * temporary, session-only reference (e.g. an object URL) rather than
   * something actually stored anywhere durable — real providers should
   * omit `isMock` (or set it false) once they persist to real storage.
   */
  async uploadAttachment(_file) {
    throw new Error("MessagingProvider.uploadAttachment() is not implemented");
  }
}
