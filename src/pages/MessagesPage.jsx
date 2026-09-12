import { T } from "../styles/tokens";
import Avatar from "../components/common/Avatar";
import { UnreadBadge, InboxStatus } from "./MessagesPage/StatusPlaceholders";
import ConversationInbox from "./MessagesPage/ConversationInbox";
import MessageThreadView from "./MessagesPage/MessageThreadView";
import { useMessagesPageController } from "./MessagesPage/useMessagesPageController";
import {
  ArrowLeft,
  Wrench,
  Search,
  CheckCheck,
  MessageCircle,
  Loader2,
} from "lucide-react";

// This page talks only to the useMessaging hooks (which talk only to
// messagingService, which talks only to whatever provider is active — see
// src/services/messaging/). It never imports a provider directly and never
// contains provider-specific code, so swapping the mock provider for a
// real backend later means changing one line in messagingService.js, not
// this component.
export default function MessagesPage(props) {
  const { unreadCounts = {} } = props;

  const {
    currentThreadId, currentThreadName, currentThreadType, currentConversation,
    visibleThreadName, currentProperty, otherUserOnline, lastActiveLabel,
    viewingRequestStatus, viewingRequestBusy, viewingRequestBusyKey, isPropertyOwner, handleViewingResponse,
    currentMessages, conversations, conversationsLoading, conversationsLoadingMore,
    conversationsHasMore, loadMoreConversations, conversationsError, connectionState,
    refreshConversations, messagesLoading, messagesError, retryMessage, conversationMeta,
    otherIsTyping, messagesEndRef, scrollContainerRef, typingIndicatorRef, inputValue, setInputValue,
    notifyTyping, notifyTypingStopped, isInputFocused, setIsInputFocused, searchQuery,
    setSearchQuery, inboxFilter, setInboxFilter, convos, markAllAsRead, handleSendMessage,
    handleBack, openThread, keyboardInset, isDesktop, headerBg, headerFg, headerInputBg,
    formatConversationTime, formatMessageTime, handleOpenMessageProperty,
  } = useMessagesPageController(props);
  /*
   * ------------------------------------------------------------
   * Render
   * ------------------------------------------------------------
   */

  return (
    <div
      className={isDesktop ? "messages-desktop-shell" : undefined}
      style={
        isDesktop
          ? {
              position: "relative",
              width: "100%",
              background: T.ink,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }
          : {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: `calc(79px + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
              background: T.ink,
              display: "flex",
              flexDirection: "column",
              zIndex: 1,
              overflow: "hidden",
            }
      }
    >
      {/* Header */}
      <div
        className="messages-header"
        style={{
          minHeight:
            "calc(64px + env(safe-area-inset-top, 0px))",
          paddingTop:
            "env(safe-area-inset-top, 0px)",
          paddingBottom: 2,
          background:
            headerBg,
          backdropFilter:
            "blur(20px)",
          WebkitBackdropFilter:
            "blur(20px)",
          borderBottom:
            `1px solid ${T.line}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 16,
          paddingRight: 16,
          gap: 12,
          boxShadow:
            "0 2px 12px rgba(0,0,0,0.25)",
          flexShrink: 0,
        }}
      >
        {currentThreadId !== null &&
        currentThreadId !== undefined ? (
          <>
            <button
              onClick={handleBack}
              className="p-1.5 rounded-full hover:bg-white/10 transition-all active:scale-90"
              style={{
                border: "none",
                background:
                  "transparent",
                cursor: "pointer",
              }}
              aria-label="Back to messages"
            >
              <ArrowLeft
                size={22}
                color={headerFg}
              />
            </button>

            {visibleThreadName && (
              <Avatar
                src={conversationMeta?.displayAvatar?.url || currentConversation?.displayAvatar?.url}
                grad={conversationMeta?.displayAvatar?.grad || currentConversation?.displayAvatar?.grad}
                letter={visibleThreadName[0]}
                size={38}
                alt={`${visibleThreadName}'s profile picture`}
              />
            )}

            <div
              className="flex-1"
              style={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 1,
                alignItems: "flex-end",
                textAlign: "right",
              }}
            >
              <div
                className="font-semibold"
                style={{
                  color: headerFg,
                  fontSize: 18,
                  letterSpacing:
                    "-0.3px",
                  whiteSpace:
                    "nowrap",
                  overflow: "hidden",
                  textOverflow:
                    "ellipsis",
                }}
              >
                {visibleThreadName || (
                  <span style={{ opacity: 0.5 }}>Conversation</span>
                )}
              </div>
              {currentThreadType === "property" && currentProperty && (
                // This conversation can span more than one of the same
                // landlord's listings (messaging them about a second
                // property reuses the existing thread rather than forking
                // a new one) — this line shows which listing you actually
                // navigated in from, since each viewing-request message in
                // the history already names its own property in the body.
                <div
                  style={{
                    color: headerFg,
                    opacity: 0.72,
                    fontSize: 11.5,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {currentProperty.title}
                  {currentProperty.suburb ? ` — ${currentProperty.suburb}` : ""}
                </div>
              )}
              {messagesLoading ? (
                <div
                  aria-live="polite"
                  style={{
                    color: headerFg,
                    opacity: 0.72,
                    fontSize: 11.5,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
                  >
                    <i className="typing-dot" />
                    <i className="typing-dot" />
                    <i className="typing-dot" />
                  </span>
                  <span>Syncing messages…</span>
                </div>
              ) : (
                !messagesLoading && lastActiveLabel && (
                  <div
                    style={{
                      color: headerFg,
                      opacity: 0.72,
                      fontSize: 11.5,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {otherUserOnline && (
                      <span
                        aria-label="Online"
                        title="Online now"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#22c55e",
                          flex: "0 0 auto",
                          boxShadow: "0 0 0 2px rgba(34,197,94,0.16)",
                        }}
                      />
                    )}
                    <span>{lastActiveLabel}</span>
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <>
            <div
              className="font-bold"
              style={{
                color: headerFg,
                fontSize: 20,
                letterSpacing:
                  "-0.5px",
              }}
            >
              Messages
            </div>

            <div className="flex-1" />

            <button
              onClick={
                markAllAsRead
              }
              className="p-1.5 rounded-full hover:bg-white/10 transition-all active:scale-90"
              title="Mark all as read"
              aria-label="Mark all as read"
              style={{
                border: "none",
                background:
                  "transparent",
                cursor: "pointer",
              }}
            >
              <CheckCheck
                size={20}
                color={T.ink60}
              />
            </button>

            <div
              className="relative flex items-center"
              style={{
                width: 140,
              }}
            >
              <Search
                size={16}
                color={T.ink60}
                style={{
                  position:
                    "absolute",
                  left: 10,
                  pointerEvents:
                    "none",
                }}
              />

              <input
                type="text"
                placeholder="Search"
                value={
                  searchQuery
                }
                onChange={(event) =>
                  setSearchQuery(
                    event.target
                      .value
                  )
                }
                aria-label="Search conversations"
                style={{
                  width: "100%",
                  background:
                    headerInputBg,
                  border:
                    `1px solid ${T.line}`,
                  borderRadius: 20,
                  padding:
                    "6px 12px 6px 34px",
                  color: headerFg,
                  fontSize: 16,
                  outline: "none",
                  transition:
                    "border-color 0.2s",
                }}
                onFocus={(event) => {
                  event.target.style.borderColor =
                    T.jacaranda;
                }}
                onBlur={(event) => {
                  event.target.style.borderColor =
                    T.line;
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Connection banner — hidden entirely while online, so there is no
          visual change from before in the normal case. */}
      {connectionState !== "online" && (
        <div
          style={{
            flexShrink: 0,
            padding: "6px 16px",
            textAlign: "center",
            fontSize: 11,
            fontWeight: 600,
            color: T.paper,
            background: connectionState === "offline" ? T.brick : T.jacaranda,
          }}
        >
          {connectionState === "offline"
            ? "You're offline — messages will send once you're back online."
            : "Reconnecting…"}
        </div>
      )}

      {/* Viewing-request actions live on the request message itself. Keeping a
          single action surface prevents duplicate Accept/Decline controls and
          keeps the property, request text, status, and actions together. */}
      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background:
            T.paperDim,
          boxShadow: "none",
          borderTop: "none",
          overflow: "hidden",
        }}
      >
        {currentThreadId !== null &&
        currentThreadId !== undefined ? (
          <MessageThreadView
            currentThreadName={currentThreadName}
            conversationMeta={conversationMeta}
            currentProperty={currentProperty}
            currentMessages={currentMessages}
            messagesError={messagesError}
            messagesLoading={messagesLoading}
            retryMessage={retryMessage}
            formatMessageTime={formatMessageTime}
            messagesEndRef={messagesEndRef}
            scrollContainerRef={scrollContainerRef}
            otherIsTyping={otherIsTyping}
            typingIndicatorRef={typingIndicatorRef}
            inputValue={inputValue}
            handleSendMessage={handleSendMessage}
            notifyTyping={notifyTyping}
            notifyTypingStopped={notifyTypingStopped}
            setInputValue={setInputValue}
            setIsInputFocused={setIsInputFocused}
            isInputFocused={isInputFocused}
            isPropertyOwner={isPropertyOwner}
            viewingRequestStatus={viewingRequestStatus}
            viewingRequestBusy={viewingRequestBusy}
            viewingRequestBusyKey={viewingRequestBusyKey}
            handleViewingResponse={handleViewingResponse}
            onOpenProperty={handleOpenMessageProperty}
          />
        ) : (
          <ConversationInbox
            inboxFilter={inboxFilter}
            setInboxFilter={setInboxFilter}
            conversations={conversations}
            conversationsLoading={conversationsLoading}
            conversationsError={conversationsError}
            convos={convos}
            searchQuery={searchQuery}
            conversationsHasMore={conversationsHasMore}
            conversationsLoadingMore={conversationsLoadingMore}
            loadMoreConversations={loadMoreConversations}
            unreadCounts={unreadCounts}
            openThread={openThread}
            formatConversationTime={formatConversationTime}
            refreshConversations={refreshConversations}
          />
        )}
      </div>
    </div>
  );
}
