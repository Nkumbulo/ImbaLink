import { useCallback, useEffect, useRef } from "react";
import { messagingService } from "../../services/messaging/messagingService";

export function useMessageReadState({
  conversations,
  currentThreadId,
  resolvedConversationId,
  getThreadKey,
  currentUserId,
  rawMessages,
  refreshConversations,
}) {
  const lastReadEffectKeyRef = useRef("");
  const readMarkTimerRef = useRef(null);

  const markAllAsRead = useCallback(async () => {
    const unread = conversations.filter((conversation) => conversation.unreadCount > 0);
    if (!unread.length) return;

    await Promise.all(
      unread.map((conversation) =>
        messagingService.markConversationAsRead(conversation.id, currentUserId).catch((error) => {
          console.warn("Unable to mark conversation as read:", error);
        })
      )
    );
    refreshConversations();
  }, [conversations, currentUserId, refreshConversations]);

  useEffect(() => {
    if (currentThreadId === null || currentThreadId === undefined || !currentUserId) return undefined;

    const key = resolvedConversationId || getThreadKey();
    if (!key) return undefined;

    const incomingMessages = rawMessages.filter(
      (message) => String(message?.senderId) !== String(currentUserId)
    );
    const latestIncoming = incomingMessages[incomingMessages.length - 1];
    const effectKey = `${key}:${latestIncoming?.id || latestIncoming?.createdAt || "opened"}`;
    if (lastReadEffectKeyRef.current === effectKey) return undefined;
    lastReadEffectKeyRef.current = effectKey;

    if (readMarkTimerRef.current) clearTimeout(readMarkTimerRef.current);
    readMarkTimerRef.current = setTimeout(() => {
      readMarkTimerRef.current = null;
      void messagingService.markConversationAsRead(key, currentUserId).catch((error) => {
        console.warn("Unable to mark conversation as read:", error);
      });
    }, 250);

    return () => {
      if (readMarkTimerRef.current) {
        clearTimeout(readMarkTimerRef.current);
        readMarkTimerRef.current = null;
      }
    };
  }, [currentThreadId, resolvedConversationId, getThreadKey, currentUserId, rawMessages]);

  return { markAllAsRead };
}
