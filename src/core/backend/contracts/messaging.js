import { defineBackendContract } from "../contract";

export const MESSAGE_REPOSITORY_METHODS = [
  "getConversations",
  "getMessages",
  "sendMessage",
  "markConversationRead",
];

export const CONVERSATION_REPOSITORY_METHODS = [
  "getConversation",
  "createConversation",
];

export const messageRepositoryContract = defineBackendContract(
  "MessageRepository",
  MESSAGE_REPOSITORY_METHODS
);

export const conversationRepositoryContract = defineBackendContract(
  "ConversationRepository",
  CONVERSATION_REPOSITORY_METHODS
);
