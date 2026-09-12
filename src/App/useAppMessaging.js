import { useEffect, useRef, useState } from "react";
import { messagingService } from "../services/messaging/messagingService";
import { toLegacyThreadMessages } from "./messageNavigation";
import { notifyUser } from "../services/notifications/notificationEngine";

/** Owns the legacy message mirror, realtime reconciliation and message send path. */
export default function useAppMessaging({ hydrated, currentUserId, setThreads }) {
  const [messagesState, setMessagesState] = useState({});
  const [conversationUnreadCounts, setConversationUnreadCounts] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const activeConversationIdRef = useRef(null);
  const notifiedMessageIdsRef = useRef(new Set());

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!hydrated || !currentUserId) return;
    let active = true;

    const applyConversation = (conversation) => {
      if (!conversation?.id) return;
      const messages = toLegacyThreadMessages(conversation.messages, currentUserId);
      if (messages.length) {
        setThreads((current) => ({ ...current, [conversation.id]: messages }));
      } else {
        setThreads((current) => (Object.prototype.hasOwnProperty.call(current, conversation.id)
          ? current
          : { ...current, [conversation.id]: [] }));
      }

      const latestMessage = conversation.lastMessage;
      const latestMessageId = latestMessage?.id ? String(latestMessage.id) : null;
      const latestSenderId = latestMessage?.senderId ? String(latestMessage.senderId) : null;
      const isIncoming = Boolean(latestSenderId && latestSenderId !== String(currentUserId));

      // Conversation realtime is intentionally the global message notification
      // path. It stays mounted outside MessagesPage, so a message received
      // while the user is on Home/Profile/Explore can still produce the same
      // sender-name + message-body notification and custom sound. Deduplicate
      // by the real message id because Supabase reconnects can replay an
      // INSERT/preview event.
      if (isIncoming && latestMessageId && !notifiedMessageIdsRef.current.has(latestMessageId)) {
        notifiedMessageIdsRef.current.add(latestMessageId);
        if (notifiedMessageIdsRef.current.size > 500) {
          const oldest = notifiedMessageIdsRef.current.values().next().value;
          if (oldest) notifiedMessageIdsRef.current.delete(oldest);
        }
        void notifyUser({
          id: `message-${latestMessageId}`,
          type: "message",
          title: conversation.displayName || "New message",
          body: latestMessage?.text || "You have a new message.",
          subjectType: "conversation",
          subjectId: conversation.id,
          createdAt: latestMessage.createdAt || new Date().toISOString(),
        }).catch(() => {});
      }

      setConversationUnreadCounts((current) => {
        const id = String(conversation.id);
        const delta = Number(conversation.unreadCountDelta || 0);
        if (delta > 0) {
          if (String(activeConversationIdRef.current || "") === id) return { ...current, [id]: 0 };
          return { ...current, [id]: Math.max(0, Number(current[id] || 0) + delta) };
        }
        if (conversation.unreadCount != null) {
          return { ...current, [id]: Math.max(0, Number(conversation.unreadCount) || 0) };
        }
        return current;
      });
    };

    messagingService.getConversations(currentUserId).then((conversationList) => {
      if (!active) return;
      (Array.isArray(conversationList) ? conversationList : []).forEach(applyConversation);
    }).catch(() => {});

    const unsubscribe = messagingService.subscribeToConversations(currentUserId, (conversation) => {
      if (conversation?.id) applyConversation(conversation);
    });

    const reconcile = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      messagingService.getConversations(currentUserId).then((conversationList) => {
        if (!active) return;
        (Array.isArray(conversationList) ? conversationList : []).forEach(applyConversation);
      }).catch(() => {});
    };

    if (typeof document !== "undefined") document.addEventListener("visibilitychange", reconcile);
    if (typeof window !== "undefined") window.addEventListener("online", reconcile);

    return () => {
      active = false;
      unsubscribe();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", reconcile);
      if (typeof window !== "undefined") window.removeEventListener("online", reconcile);
    };
  }, [hydrated, currentUserId, setThreads]);

  const sendMessage = async ({ recipientId, recipientType, text } = {}) => {
    const trimmed = String(text || "").trim();
    if (!trimmed || !currentUserId || recipientId === undefined || recipientId === null || recipientId === "") return false;
    const type = String(recipientType || "property").toLowerCase();
    const threadKey = type === "contractor"
      ? `contractor_${String(recipientId)}`
      : type === "roommate"
        ? `roommate_${String(recipientId)}`
        : String(recipientId);
    try {
      await messagingService.sendMessage(threadKey, { text: trimmed, senderId: currentUserId });
      return true;
    } catch (err) {
      console.warn("Failed to send message:", err);
      return false;
    }
  };

  const clearMessagesState = () => setMessagesState({});

  return {
    messagesState, setMessagesState, clearMessagesState,
    conversationUnreadCounts, setConversationUnreadCounts,
    activeConversationId, setActiveConversationId, sendMessage,
  };
}
