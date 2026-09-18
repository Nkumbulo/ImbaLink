import { SupabaseMessagingProvider } from "./supabaseMessagingProvider";
import { backend } from "../../application/backend/index.js";

/**
 * The single door the rest of the app knocks on for messaging. UI code
 * (MessagesPage, the useMessaging hooks, App.jsx's sendMessage) calls
 * only these functions — never a provider directly for CRUD operations.
 * CRUD now goes through the application backend contract; the legacy provider
 * remains only for realtime/typing/delivery/attachment capabilities that are
 * not yet part of the Phase 1 messaging repository contract.
 */
let activeProvider = new SupabaseMessagingProvider();

export function setMessagingProvider(provider) {
  if (!provider) return;
  activeProvider = provider;
}

export function getMessagingProvider() {
  return activeProvider;
}

// Idempotency key for optimistic sends — lets the UI (and, later, a real
// backend) reconcile "temp-<key>" with the confirmed message instead of
// showing the same message twice. See useMessaging.js.
function generateClientKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const messagingService = {
  getConversations: (userId, options) => backend.messageRepository.getConversations(userId, options),
  getConversation: (conversationId, userId) => backend.conversationRepository.getConversation(conversationId, userId),
  getMessagesSince: (conversationId, userId, cursor) =>
    backend.messageRepository.getMessages(conversationId, userId, { cursor }),
  sendMessage: (conversationId, message) => backend.messageRepository.sendMessage(conversationId, message),
  subscribeToMessages: (conversationId, callback) => activeProvider.subscribeToMessages(conversationId, callback),
  sendTypingSignal: (conversationId, isTyping) => activeProvider.sendTypingSignal(conversationId, isTyping),
  subscribeToConversations: (userId, callback) => activeProvider.subscribeToConversations(userId, callback),
  subscribeToConnectionState: (callback) => activeProvider.subscribeToConnectionState(callback),
  markMessageAsRead: (messageId) => activeProvider.markMessageAsRead(messageId),
  markConversationAsRead: (conversationId, userId, readThrough) =>
    backend.messageRepository.markConversationRead(conversationId, userId, readThrough),
  markConversationAsDelivered: (conversationId) => activeProvider.markConversationAsDelivered(conversationId),
  createConversation: (input) => backend.conversationRepository.createConversation(input),
  deleteMessage: (messageId) => activeProvider.deleteMessage(messageId),
  uploadAttachment: (file) => activeProvider.uploadAttachment(file),
  generateClientKey,
};
