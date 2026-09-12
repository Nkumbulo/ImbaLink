import { useState, useMemo, useRef, useCallback } from "react";
import { T } from "../../styles/tokens";
import useMediaQuery from "../../hooks/useMediaQuery";
import { useConversations, useConversationMessages } from "../../features/messaging/hooks";
import { useMessageThreadState } from "./useMessageThreadState";
import { useMessageTyping } from "./useMessageTyping";
import { useMessageReadState } from "./useMessageReadState";
import { useMessageViewport } from "./useMessageViewport";
import { useMessageTimeTicker } from "./useMessageTimeTicker";
import { formatLastActive } from "../../utils/formatters";
import useChatPresence from "../../hooks/useChatPresence";
import { getFirstName } from "./textHelpers";
import { useViewingRequestBanner } from "./useViewingRequestBanner";
import {
  buildViewingRequestContexts,
  buildCurrentMessages,
  buildConversationRows,
  formatConversationTime,
  formatMessageTime,
} from "../../features/messaging/utils/messageViewModel";

export function useMessagesPageController({
  properties = [],
  contractors = [],
  currentUserId,
  contractorId,
  contractorName,
  roommateId,
  roommateName,
  templateMessage,
  propertyId,
  otherUserId,
  clearMessagesState,
  unreadCounts = {},
  onActiveConversationChange,
  openProperty,
}) {
  const {
    currentThreadId,
    currentThreadName,
    currentThreadType,
    currentThreadRealId,
    inputValue,
    setInputValue,
    isInputFocused,
    setIsInputFocused,
    handleBack,
    openThread,
  } = useMessageThreadState({
    properties,
    contractorId,
    contractorName,
    roommateId,
    roommateName,
    templateMessage,
    propertyId,
    otherUserId,
    clearMessagesState,
    onActiveConversationChange,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [inboxFilter, setInboxFilter] = useState("all");
  // Viewing-request accept/decline/cancel — see backend/016-viewing-request-response.sql.
  // Kept local to this component (not global app state) since it only ever
  // matters while a property-thread conversation is actually open — see
  // MessagesPage/useViewingRequestBanner.js for the actual state/fetch/handler.

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingIndicatorRef = useRef(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  useMessageTimeTicker();
  // The header's background flips light-on-desktop / dark-on-mobile (see
  // .messages-desktop-shell > .messages-header in GlobalStyles.jsx) to
  // match the rest of the app's desktop styling. That CSS override only
  // ever changed the background, not any of the text/icon colors below,
  // which were all hardcoded to T.paper (near-white) — invisible against
  // the light desktop background it was being forced onto, even though
  // everything was technically still present in the DOM. Computed here
  // instead of split between inline styles and an external !important
  // rule, so foreground and background can never mismatch like that again.
  const headerBg = isDesktop ? T.paper : T.ink + "F2";
  const headerFg = isDesktop ? T.ink : T.paper;
  const headerInputBg = isDesktop ? T.paperDim : "rgba(255,255,255,0.08)";

  /*
   * ------------------------------------------------------------
   * Thread helpers
   * ------------------------------------------------------------
   */

  const getThreadKey = useCallback(() => {
    if (
      currentThreadId === null ||
      currentThreadId === undefined ||
      currentThreadId === ""
    ) {
      return null;
    }

    if (currentThreadRealId) return currentThreadRealId;

    return currentThreadType === "contractor"
      ? `contractor_${currentThreadId}`
      : currentThreadType === "roommate"
      ? `roommate_${currentThreadId}`
      : String(currentThreadId);
  }, [currentThreadId, currentThreadType, currentThreadRealId]);

  const currentThreadKey = getThreadKey();

  /*
   * ------------------------------------------------------------
   * Messaging data layer (see src/hooks/useMessaging.js)
   * ------------------------------------------------------------
   */

  // IMPORTANT: load the conversations hook before any derived values use
  // `conversations`. The previous v5 ordering referenced the const before it
  // was initialized, causing MessagesPage to throw during render and making
  // the Messages tab appear not to open at all.
  const {
    conversations,
    loading: conversationsLoading,
    loadingMore: conversationsLoadingMore,
    hasMore: conversationsHasMore,
    loadMore: loadMoreConversations,
    error: conversationsError,
    connectionState,
    refresh: refreshConversations,
  } = useConversations(currentUserId);

  const currentConversation = useMemo(
    () => conversations.find((c) => String(c?.id) === String(currentThreadKey)) || null,
    [conversations, currentThreadKey]
  );

  // The inbox preview already contains the other person's display name.
  // Use that value as the authoritative header fallback so the name never
  // disappears while conversation metadata is resolving.
  const visibleThreadName = useMemo(
    () => getFirstName(currentThreadName || currentConversation?.displayName),
    [currentThreadName, currentConversation?.displayName]
  );

  const currentProperty = useMemo(
    () => properties.find((p) => String(p?.id) === String(currentThreadId)) || null,
    [properties, currentThreadId]
  );

  const currentContractor = useMemo(
    () => contractors.find((c) => String(c?.id) === String(currentThreadId)) || null,
    [contractors, currentThreadId]
  );

  const otherParticipantId = useMemo(() => {
    const participant = currentConversation?.participants?.find(
      (id) => String(id) !== String(currentUserId)
    );
    if (participant) return String(participant);
    if (currentThreadType === "property") {
      const ownerId = currentProperty?.ownerUserId || null;
      // This fallback only makes sense from the tenant's side (property's
      // owner IS "the other participant" when I'm not them). If the
      // current viewer IS that owner, returning it here would silently
      // resolve "the other participant" to themselves — wrong by
      // definition, and previously the actual cause of a landlord never
      // seeing viewing-request accept/decline actions for their own
      // properties opened this way. Prefer no id (and no incorrect
      // downstream banner) over a wrong one; the (propertyId, otherUserId)
      // navigation path above resolves this properly via
      // find_conversation_with instead of reaching this fallback at all.
      if (ownerId && String(ownerId) === String(currentUserId)) return null;
      return ownerId;
    }
    if (currentThreadType === "contractor") return currentContractor?.userId || null;
    if (currentThreadType === "roommate") return currentThreadId || null;
    return null;
  }, [currentConversation, currentUserId, currentProperty, currentContractor, currentThreadType, currentThreadId]);

  const otherPresence = useChatPresence(
    currentThreadKey,
    currentUserId,
    otherParticipantId
  );
  const otherUserOnline = otherPresence.online;

  const {
    messages: rawMessages,
    loading: messagesLoading,
    error: messagesError,
    sendMessage: sendThreadMessage,
    retryMessage,
    conversationMeta,
    resolvedConversationId,
    otherIsTyping,
  } = useConversationMessages(currentThreadKey, currentUserId);

  const viewingRequestContexts = useMemo(
    () => buildViewingRequestContexts({
      currentThreadType,
      rawMessages,
      properties,
      currentProperty,
    }),
    [currentThreadType, rawMessages, properties, currentProperty]
  );

  const viewingRequestContext = viewingRequestContexts[viewingRequestContexts.length - 1] || null;
  const viewingRequestProperty = viewingRequestContext?.property || currentProperty;
  const viewingRequestOtherParticipantId = viewingRequestContext?.requesterId || otherParticipantId;

  const {
    viewingRequestStatus,
    viewingRequestStatuses,
    getViewingRequestStatus,
    viewingRequestBusy,
    viewingRequestBusyKey,
    isPropertyOwner,
    viewingRequesterId,
    handleViewingResponse,
  } = useViewingRequestBanner({
    currentThreadType,
    currentProperty: viewingRequestProperty,
    currentUserId,
    otherParticipantId: viewingRequestOtherParticipantId,
    requestContexts: viewingRequestContexts,
  });

  const typingChannelKey = resolvedConversationId || currentThreadKey;
  const { notifyTyping, notifyTypingStopped } = useMessageTyping(typingChannelKey);

  const currentMessages = useMemo(
    () => buildCurrentMessages({
      rawMessages,
      currentUserId,
      properties,
      currentProperty,
      getViewingRequestStatus,
      viewingRequestBusyKey,
    }),
    [rawMessages, currentUserId, properties, currentProperty, getViewingRequestStatus, viewingRequestBusyKey]
  );

  // "Online" / "Online N hours ago" shown under the contact's name — the
  // real app-wide presence signal plus the persisted last heartbeat. The
  // presence hook is mounted at the app shell, so this status updates even
  // while the other person is browsing another page.
  const lastActiveLabel = otherUserOnline
    ? "Online"
    : formatLastActive(otherPresence.lastSeenAt);

  // Unread counts now come directly from the database (see
  // get_conversation_previews' unread_count in the SQL migration —
  // messages from the other participant sent after this user's own
  // conversation_participants.last_read_at). There is no local
  // subtraction/tracking layer any more: the OLD mechanism compared a
  // running total that excluded the user's own messages against a
  // separately-tracked "how many I'd already seen" snapshot that
  // included them — never reliably comparable — and lived only in
  // browser/local-table state, so it reset to the pre-read total on
  // every fresh app load regardless of what had actually been read.
  // `conversation.unreadCount` is now simply correct as-is; no wrapper
  // function needed to look it up.

  const { markAllAsRead } = useMessageReadState({
    conversations,
    currentThreadId,
    resolvedConversationId,
    getThreadKey,
    currentUserId,
    rawMessages,
    refreshConversations,
  });

  const { keyboardInset } = useMessageViewport({
    isInputFocused,
    scrollContainerRef,
    currentMessagesLength: currentMessages.length,
    otherIsTyping,
  });

  const convos = useMemo(
    () => buildConversationRows({
      conversations,
      currentUserId,
      searchQuery,
      inboxFilter,
    }),
    [conversations, currentUserId, searchQuery, inboxFilter]
  );

  /*
   * ------------------------------------------------------------
   * Send message
   * ------------------------------------------------------------
   */

  const handleSendMessage = () => {
    const text = inputValue.trim();

    if (!text) return;

    if (
      currentThreadId === null ||
      currentThreadId === undefined ||
      currentThreadId === ""
    ) {
      return;
    }

    // Optimistic update + retry-on-failure both happen inside the hook —
    // the input clears immediately, exactly like the previous behaviour.
    sendThreadMessage(text);
    setInputValue("");
    notifyTypingStopped();

  };

  /*
   * ------------------------------------------------------------
   * Navigation
   * ------------------------------------------------------------
   */



  const handleOpenMessageProperty = useCallback((attachment) => {
    if (!attachment?.id || typeof openProperty !== "function") return;
    const property = properties.find((p) => String(p?.id) === String(attachment.id));
    if (property) openProperty(property);
  }, [openProperty, properties]);

  return {
    currentThreadId, currentThreadName, currentThreadType, currentConversation,
    currentThreadKey, visibleThreadName, currentProperty, currentContractor,
    otherUserOnline, lastActiveLabel, viewingRequestStatus, viewingRequestBusy,
    isPropertyOwner, viewingRequesterId, handleViewingResponse, currentMessages, viewingRequestStatuses, viewingRequestBusyKey,
    conversations, conversationsLoading, conversationsLoadingMore, conversationsHasMore,
    loadMoreConversations, conversationsError, connectionState, refreshConversations,
    messagesLoading, messagesError, retryMessage, conversationMeta, otherIsTyping,
    messagesEndRef, scrollContainerRef, typingIndicatorRef, inputValue, setInputValue,
    notifyTyping, notifyTypingStopped, isInputFocused, setIsInputFocused,
    searchQuery, setSearchQuery, inboxFilter, setInboxFilter, convos,
    markAllAsRead, handleSendMessage, handleBack, openThread, keyboardInset,
    isDesktop, headerBg, headerFg, headerInputBg, unreadCounts, formatConversationTime, formatMessageTime,
    handleOpenMessageProperty,
  };
}
