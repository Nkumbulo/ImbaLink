/**
 * Canonical messaging data model.
 *
 * Every part of the app that reads or writes a message/conversation must
 * go through these shapes so the UI, the messaging service, and whatever
 * provider is plugged in underneath all agree on one structure. Nothing
 * here is provider-specific — it stays the same whether the data came
 * from the mock provider or a real backend later.
 */

export const MESSAGE_STATUS = Object.freeze({
  SENDING: "sending",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
});

export const MESSAGE_TYPE = Object.freeze({
  TEXT: "text",
});

function safeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeTimestamp(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : Date.now();
}

function safeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * {
 *   id, conversationId, senderId, receiverId, text, createdAt (epoch ms),
 *   status: "sending" | "sent" | "delivered" | "read" | "failed",
 *   type: "text", attachment, clientKey (idempotency key for dedup)
 * }
 */
export function createMessage({
  id,
  conversationId = null,
  senderId,
  receiverId = null,
  text = "",
  createdAt,
  status = MESSAGE_STATUS.SENT,
  type = MESSAGE_TYPE.TEXT,
  attachment = null,
  clientKey = null,
  relatedPropertyId = null,
} = {}) {
  return {
    id: id || safeId("msg"),
    conversationId: conversationId != null ? String(conversationId) : null,
    senderId: senderId != null ? String(senderId) : "unknown",
    receiverId: receiverId != null ? String(receiverId) : null,
    text: safeString(text).trim().slice(0, 4000),
    createdAt: safeTimestamp(createdAt),
    status: Object.values(MESSAGE_STATUS).includes(status) ? status : MESSAGE_STATUS.SENT,
    type,
    attachment: attachment || null,
    clientKey: clientKey || null,
    // The exact property this message is about, when the server knows it
    // (messages.related_property_id — set by request_property_viewing()
    // as of 1004-request-viewing-property-linkage.sql). Null for older
    // messages sent before that column was populated, or messages
    // unrelated to a viewing request; messageViewModel.js falls back to
    // its text/title-parsing heuristic only when this is null.
    relatedPropertyId: relatedPropertyId != null ? String(relatedPropertyId) : null,
  };
}

// Tolerant of partial/corrupt input (missing fields, wrong types) — never
// throws, and returns null instead of a render-unsafe object so callers
// can filter it out.
export function normalizeMessage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = safeString(raw.text).trim();
  if (!text) return null;
  return createMessage({ ...raw, text });
}

/**
 * {
 *   id, type ("property" | "contractor" | "roommate"), participants:
 *   [userId, otherId], propertyId, contractorId, roommateId, lastMessage,
 *   lastMessageAt, unreadCount, displayName, displayAvatar, messages
 * }
 *
 * `displayName` / `displayAvatar` are denormalized convenience fields the
 * provider resolves (from the property/contractor/roommate record) so the
 * UI never has to know how to look those up itself.
 */
export function createConversation({
  id,
  type = "property",
  participants = [],
  propertyId = null,
  contractorId = null,
  roommateId = null,
  lastMessage = null,
  lastMessageAt = null,
  unreadCount = 0,
  displayName = "Conversation",
  displayAvatar = null,
  lastDeliveredAt = null,
  lastReadAt = null,
  messages = [],
} = {}) {
  return {
    id: id != null ? String(id) : safeId("conversation"),
    type,
    participants: Array.isArray(participants) ? participants.filter((x) => x != null).map(String) : [],
    propertyId: propertyId != null ? String(propertyId) : null,
    contractorId: contractorId != null ? String(contractorId) : null,
    roommateId: roommateId != null ? String(roommateId) : null,
    lastMessage: lastMessage || null,
    lastMessageAt: Number.isFinite(Number(lastMessageAt)) ? Number(lastMessageAt) : null,
    unreadCount: Number.isFinite(Number(unreadCount)) ? Number(unreadCount) : 0,
    displayName: safeString(displayName, "Conversation"),
    displayAvatar: displayAvatar || null,
    lastDeliveredAt: lastDeliveredAt != null ? String(lastDeliveredAt) : null,
    lastReadAt: lastReadAt != null ? String(lastReadAt) : null,
    messages: Array.isArray(messages) ? messages : [],
  };
}
