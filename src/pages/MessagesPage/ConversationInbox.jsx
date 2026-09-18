import { T } from "../../styles/tokens";
import Avatar from "../../components/common/Avatar";
import { Wrench, MessageCircle, Loader2 } from "lucide-react";
import { UnreadBadge, InboxStatus } from "./StatusPlaceholders";

export default function ConversationInbox({inboxFilter,setInboxFilter,conversations,conversationsLoading,conversationsError,convos,searchQuery,conversationsHasMore,conversationsLoadingMore,loadMoreConversations,unreadCounts,openThread,formatConversationTime,refreshConversations}) {
  return (
<>
  <div
    style={{
      display:
        "flex",
      gap: 8,
      padding:
        "12px 16px",
      borderBottom:
        `1px solid ${T.line}`,
      flexShrink: 0,
    }}
  >
    {[
      "all",
      "unread",
    ].map(
      (filter) => (
        <button
          key={filter}
          onClick={() =>
            setInboxFilter(
              filter
            )
          }
          style={{
            padding:
              "6px 16px",
            borderRadius:
              20,
            fontSize: 12,
            fontWeight: 600,
            border:
              `1px solid ${
                inboxFilter ===
                filter
                  ? T.jacaranda
                  : T.line
              }`,
            background:
              inboxFilter ===
              filter
                ? T.jacaranda
                : "transparent",
            color:
              inboxFilter ===
              filter
                ? T.paper
                : T.ink60,
            cursor:
              "pointer",
            transition:
              "all 0.15s",
          }}
          className="hover:opacity-80 active:scale-95"
        >
          {filter ===
          "all"
            ? "All"
            : "Unread"}

          {filter ===
            "unread" && (
            <span
              style={{
                marginLeft: 4,
                fontSize: 10,
                opacity: 0.8,
              }}
            >
              (
              {convos.reduce(
                (
                  sum,
                  conversation
                ) =>
                  sum + (conversation.unreadCount || 0),
                0
              )}
              )
            </span>
          )}
        </button>
      )
    )}
  </div>

  {conversationsLoading && conversations.length === 0 ? (
    <InboxStatus
      icon={Loader2}
      spin
      label="Loading conversations…"
    />
  ) : conversationsError && conversations.length === 0 ? (
    <InboxStatus
      icon={MessageCircle}
      label="Couldn't load conversations."
      sublabel={conversationsError}
      actionLabel="Try again"
      onAction={refreshConversations}
    />
  ) : convos.length ===
  0 ? (
    <InboxStatus
      icon={MessageCircle}
      label={
        searchQuery
          ? "No conversations match your search."
          : inboxFilter ===
            "unread"
          ? "No unread messages."
          : "No conversations yet."
      }
      sublabel="Tap the message icon on a listing to start one."
    />
  ) : (
    <div
      onScroll={(e) => {
        // Requests the next page from the server only once the
        // user has actually scrolled near the bottom of what's
        // loaded so far — not upfront, and not the user's whole
        // conversation history at once. 200px threshold so the
        // next page is already arriving before they hit the
        // literal bottom.
        const el = e.currentTarget;
        if (
          conversationsHasMore &&
          !conversationsLoadingMore &&
          el.scrollHeight - el.scrollTop - el.clientHeight < 200
        ) {
          loadMoreConversations();
        }
      }}
      style={{
        flex: 1,
        overflowY:
          "auto",
        padding:
          "4px 0",
        WebkitOverflowScrolling:
          "touch",
      }}
    >
      {convos.map(
        (
          conversation
        ) => {
          const {
            p,
            last,
          } =
            conversation;

          const unread = Math.max(0, Number(unreadCounts[String(conversation.id)] ?? 0) || 0);

          return (
            <div
              key={
                conversation.id
              }
              onClick={() =>
                openThread(
                  conversation
                )
              }
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: 14,
                padding:
                  "12px 16px",
                cursor:
                  "pointer",
                transition:
                  "background 0.15s",
                borderBottom:
                  `1px solid ${T.line}`,
                position:
                  "relative",
              }}
              className="hover:bg-black/5 active:bg-black/10"
              role="button"
              tabIndex={0}
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                    "Enter" ||
                  event.key ===
                    " "
                ) {
                  event.preventDefault();

                  openThread(
                    conversation
                  );
                }
              }}
            >
              {conversation.type ===
              "contractor" ? (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius:
                      "50%",
                    background:
                      T.jacaranda +
                      "20",
                    border:
                      `2px solid ${T.jacaranda}40`,
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    flexShrink: 0,
                  }}
                >
                  <Wrench
                    size={24}
                    color={
                      T.jacaranda
                    }
                  />
                </div>
              ) : (
                <Avatar
                  src={
                    p.url
                  }
                  grad={
                    p.grad
                  }
                  letter={
                    p.landlord?.[0] ||
                    "?"
                  }
                  size={52}
                />
              )}

              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontWeight:
                        unread >
                        0
                          ? 700
                          : 600,
                      color:
                        T.ink,
                      fontSize: 15,
                      whiteSpace:
                        "nowrap",
                      overflow:
                        "hidden",
                      textOverflow:
                        "ellipsis",
                      minWidth:
                        0,
                    }}
                  >
                    {
                      p.landlord
                    }
                  </div>

                  {/* Timestamp */}
                  <div
                    style={{
                      color:
                        unread >
                        0
                          ? T.jacaranda
                          : T.ink60,
                      fontSize: 11,
                      fontWeight:
                        unread >
                        0
                          ? 700
                          : 500,
                      flexShrink:
                        0,
                      whiteSpace:
                        "nowrap",
                      letterSpacing:
                        unread >
                        0
                          ? "0.1px"
                          : "0",
                    }}
                  >
                    {formatConversationTime(
                      last?.ts
                    )}
                  </div>
                </div>

                <div
                  style={{
                    color:
                      unread >
                      0
                        ? T.ink
                        : T.ink60,
                    fontSize: 13,
                    fontWeight:
                      unread >
                      0
                        ? 500
                        : 400,
                    whiteSpace:
                      "nowrap",
                    overflow:
                      "hidden",
                    textOverflow:
                      "ellipsis",
                    marginTop: 2,
                  }}
                >
                  {last?.from ===
                    "me" &&
                    "You: "}

                  {last?.text ||
                    ""}
                </div>
              </div>

              {unread >
                0 && (
                <UnreadBadge
                  count={
                    unread
                  }
                />
              )}
            </div>
          );
        }
      )}
      {conversationsLoadingMore && (
        <InboxStatus icon={Loader2} spin label="Loading more…" />
      )}
    </div>
  )}
</>

  );
}
