
import { T } from "../../styles/tokens";
import { MessageAreaStatus } from "./StatusPlaceholders";
import { MessageCircle } from "lucide-react";
import { MessageList, MessageComposer } from "../../features/messaging/components/MessageThread";

export default function MessageThreadView({
  currentThreadName,
  conversationMeta,
  currentProperty,
  currentMessages,
  messagesError,
  messagesLoading,
  retryMessage,
  formatMessageTime,
  messagesEndRef,
  scrollContainerRef,
  otherIsTyping,
  typingIndicatorRef,
  inputValue,
  handleSendMessage,
  notifyTyping,
  notifyTypingStopped,
  setInputValue,
  setIsInputFocused,
  isInputFocused,
  isPropertyOwner,
  viewingRequestStatus,
  viewingRequestBusy,
  viewingRequestBusyKey,
  handleViewingResponse,
  onOpenProperty,
}) {
  return (
<div
  className="flex-1 flex flex-col"
  style={{
    minHeight: 0,
    position: "relative",
  }}
>
  {/* Messages */}
  <div
    ref={scrollContainerRef}
    className="flex-1 px-4 py-4 overflow-y-auto"
    style={{
      flex: 1,
      overflowY: "auto",
      background:
        T.paperDim,
      WebkitOverflowScrolling:
        "touch",
    }}
  >
    {messagesError && currentMessages.length === 0 ? (
      <MessageAreaStatus
        icon={MessageCircle}
        label="Couldn't load messages."
        sublabel={messagesError}
      />
    ) : currentMessages.length ===
    0 ? (
      messagesLoading ? null : (
        <MessageAreaStatus
          icon={MessageCircle}
          label="No messages yet"
          sublabel="Send a message to start the conversation."
        />
      )
    ) : (
      <div className="space-y-2">
        <MessageList
          currentThreadName={currentThreadName}
          conversationMeta={conversationMeta}
          currentMessages={currentMessages}
          retryMessage={retryMessage}
          formatMessageTime={formatMessageTime}
          messagesEndRef={messagesEndRef}
          isPropertyOwner={isPropertyOwner}
          handleViewingResponse={handleViewingResponse}
          onOpenProperty={onOpenProperty}
        />

      </div>
    )}
  </div>

  <MessageComposer
    otherIsTyping={otherIsTyping}
    typingIndicatorRef={typingIndicatorRef}
    inputValue={inputValue}
    handleSendMessage={handleSendMessage}
    notifyTyping={notifyTyping}
    notifyTypingStopped={notifyTypingStopped}
    setInputValue={setInputValue}
    setIsInputFocused={setIsInputFocused}
    scrollContainerRef={scrollContainerRef}
  />

</div>
  );
}
