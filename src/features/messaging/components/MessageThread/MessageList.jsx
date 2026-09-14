import React from "react";
import { Link2 } from "lucide-react";
import { T } from "../../../../styles/tokens";
import Avatar from "../../../../components/common/Avatar";
import MessageTicks, { getTickStatus } from "./MessageTicks";
import { VIEWING_TERMINAL_STATUSES } from "../../utils/messageViewModel";

const RESOLVED_LABEL = { declined: "declined", cancelled: "cancelled", completed: "completed" };

function formatResolvedDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function MessageList({
  currentThreadName,
  conversationMeta,
  currentMessages,
  retryMessage,
  formatMessageTime,
  messagesEndRef,
  isPropertyOwner,
  handleViewingResponse,
  onOpenProperty,
}) {
  return (
    <div className="space-y-2">
        {currentMessages.map(
          (msg, idx) => {
            if (!msg) {
              return null;
            }

            const isMe =
              msg.from ===
              "me";

            const messageKey =
              msg.id ??
              `${msg.ts ?? "message"}-${idx}`;
            const messageText = String(msg.text || "");
            const isViewingRequestMessage = /^I would like to request a viewing(?: of .+)?\.$/i.test(messageText);
            const requestedPropertyTitle = messageText.match(/^I would like to request a viewing(?: of (.+))?\.$/i)?.[1]?.trim() || "";
            const isResolvedViewingRequest = isViewingRequestMessage
              && msg.attachment?.type === "property"
              && VIEWING_TERMINAL_STATUSES.includes(msg.viewingRequestStatus);

            return (
              <React.Fragment key={messageKey}>
              <div
                className={`flex ${
                  isMe
                    ? "justify-end"
                    : "justify-start"
                } animate-fadeIn`}
                style={{
                  animationDuration:
                    "0.2s",
                  animationFillMode:
                    "both",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "flex-end",
                    gap: 10,
                    maxWidth:
                      "85%",
                  }}
                >
                  {!isMe && (
                    <Avatar
                      src={conversationMeta?.displayAvatar?.url}
                      grad={conversationMeta?.displayAvatar?.grad}
                      letter={currentThreadName?.[0] || "?"}
                      size={36}
                      alt={currentThreadName ? `${currentThreadName}'s profile picture` : ""}
                    />
                  )}


                  <div
                    style={{
                      background:
                        isMe
                          ? "color-mix(in srgb, var(--theme-green) 84%, white)"
                          : T.paper,
                      color:
                        isMe
                          ? T.paper
                          : T.ink,
                      padding:
                        "12px 16px",
                      borderRadius:
                        isMe
                          ? "20px 20px 4px 20px"
                          : "20px 20px 20px 4px",
                      boxShadow:
                        isMe
                          ? "0 4px 14px color-mix(in srgb, var(--theme-green) 30%, transparent)"
                          : "0 2px 10px rgba(0,0,0,0.08)",
                      fontSize: 16,
                      lineHeight:
                        1.55,
                      wordBreak:
                        "break-word",
                      maxWidth:
                        "100%",
                    }}
                  >
                    {msg.text && !isResolvedViewingRequest && (
                      <div style={{ marginBottom: msg.attachment?.type === "property" ? 10 : 0 }}>
                        {isViewingRequestMessage ? "I would like to request a viewing." : msg.text}
                      </div>
                    )}

                    {/* Once a viewing request is declined, cancelled, or completed,
                       the rich property card (image + Accept/Decline/Cancel
                       controls) no longer serves any purpose — there's nothing
                       left to act on, and the card was staying in the thread
                       forever as dead weight (an image that never changes, a
                       re-render every reconcile tick). Collapse it to a single
                       plain-text line instead: the chat should read as text,
                       not keep carrying a stale listing card past the point
                       it's actionable. */}
                    {isResolvedViewingRequest ? (
                      <div
                        style={{
                          fontSize: 13.5,
                          lineHeight: 1.5,
                          color: isMe ? T.paper : T.ink,
                          opacity: 0.85,
                        }}
                      >
                        <span style={{ fontWeight: 800 }}>{msg.attachment?.title || "Property"}</span>
                        {" — viewing "}
                        {RESOLVED_LABEL[msg.viewingRequestStatus] || msg.viewingRequestStatus}
                        {msg.viewingRequestResolvedAt ? ` on ${formatResolvedDate(msg.viewingRequestResolvedAt)}` : ""}
                      </div>
                    ) : msg.attachment?.type === "property" && (
                      <div
                        style={{
                          width: "100%",
                          padding: 7,
                          borderRadius: 14,
                          background: isMe ? "rgba(255,255,255,.12)" : T.paperDim,
                          border: `1px solid ${isMe ? "rgba(255,255,255,.18)" : T.line}`,
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenProperty?.(msg.attachment)}
                          aria-label={`Open ${msg.attachment.title || "property"}`}
                          style={{
                            display: "flex",
                            width: "100%",
                            alignItems: "stretch",
                            gap: 10,
                            padding: 0,
                            background: "transparent",
                            border: "none",
                            textAlign: "left",
                            cursor: "pointer",
                            color: "inherit",
                          }}
                        >
                          {msg.attachment.image ? (
                            <img
                              src={msg.attachment.image}
                              alt=""
                              style={{
                                width: 62,
                                height: 62,
                                objectFit: "cover",
                                borderRadius: 10,
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 62,
                                height: 62,
                                borderRadius: 10,
                                flexShrink: 0,
                                background: T.paperDim,
                              }}
                            />
                          )}
                          <div
                            style={{
                              minWidth: 0,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              gap: 3,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12.5,
                                lineHeight: 1.25,
                                fontWeight: 800,
                                color: isMe ? T.paper : T.ink,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {msg.attachment.title}
                            </div>
                            {msg.attachment.suburb && (
                              <div
                                style={{
                                  fontSize: 10.5,
                                  opacity: .72,
                                  color: isMe ? T.paper : T.ink,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {msg.attachment.suburb}
                              </div>
                            )}
                            {msg.attachment.rent != null && (
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: isMe ? T.paper : T.jacaranda,
                                }}
                              >
                                ${msg.attachment.rent}
                              </div>
                            )}
                          </div>
                        </button>

                        {isViewingRequestMessage && isPropertyOwner && msg.viewingRequestStatus === "requested" && (
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button
                              type="button"
                              disabled={msg.viewingRequestBusy}
                              onClick={() => handleViewingResponse?.("accepted", msg.attachment?.id, msg.attachment?.requesterId)}
                              style={{
                                flex: 1,
                                border: "none",
                                borderRadius: 12,
                                padding: "9px 10px",
                                background: "var(--theme-green)",
                                color: T.paper,
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: msg.viewingRequestBusy ? "wait" : "pointer",
                                opacity: msg.viewingRequestBusy ? 0.65 : 1,
                              }}
                            >
                              {msg.viewingRequestBusy ? "Updating…" : "Accept"}
                            </button>
                            <button
                              type="button"
                              disabled={msg.viewingRequestBusy}
                              onClick={() => handleViewingResponse?.("declined", msg.attachment?.id, msg.attachment?.requesterId)}
                              style={{
                                flex: 1,
                                border: `1px solid ${T.line}`,
                                borderRadius: 12,
                                padding: "9px 10px",
                                background: "transparent",
                                color: isMe ? T.paper : T.ink,
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: msg.viewingRequestBusy ? "wait" : "pointer",
                                opacity: msg.viewingRequestBusy ? 0.65 : 1,
                              }}
                            >
                              Decline
                            </button>
                          </div>
                        )}

                        {isViewingRequestMessage && msg.viewingRequestStatus === "accepted" && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--theme-green)" }}>
                              Accepted
                            </div>
                            {isPropertyOwner && (
                              <button
                                type="button"
                                disabled={msg.viewingRequestBusy}
                                onClick={() => handleViewingResponse?.("completed", msg.attachment?.id, msg.attachment?.requesterId)}
                                style={{
                                  width: "100%",
                                  marginTop: 8,
                                  border: `1px solid ${T.line}`,
                                  borderRadius: 12,
                                  padding: "8px 10px",
                                  background: "transparent",
                                  color: isMe ? T.paper : T.ink,
                                  fontWeight: 800,
                                  fontSize: 12,
                                  cursor: msg.viewingRequestBusy ? "wait" : "pointer",
                                  opacity: msg.viewingRequestBusy ? 0.65 : 1,
                                }}
                              >
                                {msg.viewingRequestBusy ? "Updating…" : "Mark completed"}
                              </button>
                            )}
                            {!isPropertyOwner && (
                              <button
                                type="button"
                                disabled={msg.viewingRequestBusy}
                                onClick={() => handleViewingResponse?.("cancelled", msg.attachment?.id, msg.attachment?.requesterId)}
                                style={{
                                  width: "100%",
                                  marginTop: 8,
                                  border: `1px solid ${T.line}`,
                                  borderRadius: 12,
                                  padding: "8px 10px",
                                  background: "transparent",
                                  color: isMe ? T.paper : T.ink,
                                  fontWeight: 800,
                                  fontSize: 12,
                                  cursor: msg.viewingRequestBusy ? "wait" : "pointer",
                                  opacity: msg.viewingRequestBusy ? 0.65 : 1,
                                }}
                              >
                                {msg.viewingRequestBusy ? "Updating…" : "Cancel request"}
                              </button>
                            )}
                          </div>
                        )}
                        {/* declined/cancelled/completed no longer render here at all —
                           see isResolvedViewingRequest above, which collapses the
                           entire card (this whole block) to a plain-text summary
                           once the request reaches any of those three states. */}
                      </div>
                    )}


                    {msg.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => retryMessage(msg.id)}
                        style={{
                          display: "block",
                          width: "100%",
                          fontSize: 10.5,
                          marginTop: 5,
                          textAlign: isMe ? "right" : "left",
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          color: isMe ? "#FFD9CC" : T.brick,
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Failed to send · Tap to retry
                      </button>
                    ) : (
                      <div
                        className="msg-meta"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: isMe ? "flex-end" : "flex-start",
                          gap: 4,
                          width: "100%",
                          fontSize: 10.5,
                          opacity: isMe ? 0.8 : 0.55,
                          marginTop: 5,
                          color: isMe ? T.paper : T.ink60,
                          textAlign: isMe ? "right" : "left",
                        }}
                      >
                        <span>{formatMessageTime(msg.ts)}</span>
                        {isMe && getTickStatus(msg, conversationMeta) && (
                          <MessageTicks status={getTickStatus(msg, conversationMeta)} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isViewingRequestMessage && (msg.viewingRequestStatus === "declined" || msg.viewingRequestStatus === "cancelled") && (
                <div className="flex justify-start animate-fadeIn" style={{ animationDuration: "0.2s", animationFillMode: "both", marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10, maxWidth: "85%" }}>
                    <div aria-label="ImbaLink assistant" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--theme-green)", color: T.paper, boxShadow: "0 4px 12px color-mix(in srgb, var(--theme-green) 24%, transparent)" }}>
                      <Link2 size={18} strokeWidth={2.4} />
                    </div>
                    <div style={{ background: "color-mix(in srgb, var(--theme-green) 11%, white)", color: T.ink, padding: "12px 16px", borderRadius: "20px 20px 20px 4px", border: "1px solid color-mix(in srgb, var(--theme-green) 18%, transparent)", boxShadow: "0 2px 10px color-mix(in srgb, var(--theme-green) 10%, transparent)", fontSize: 15, lineHeight: 1.55, wordBreak: "break-word", maxWidth: "100%" }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--theme-green)", marginBottom: 4 }}>ImbaLink</div>
                      {/* Only the owner can decline and only the requester can cancel
                         (enforced server-side in respond_to_viewing_request), so the
                         status alone tells us who acted — no extra data needed to
                         write copy from each side's own perspective. */}
                      {msg.viewingRequestStatus === "declined"
                        ? (isPropertyOwner
                            ? "You declined this viewing request. The tenant has been notified and can continue exploring other available properties on ImbaLink."
                            : "The landlord wasn’t able to accommodate this viewing request at this time. No worries — you can continue exploring other available properties on ImbaLink.")
                        : (isPropertyOwner
                            ? "The tenant cancelled this viewing request. No action is needed on your end."
                            : "This viewing request has been cancelled by the tenant. No further action is needed, and you can continue using ImbaLink to find or arrange another viewing.")}
                    </div>
                  </div>
                </div>
              )}
              </React.Fragment>
            );
          }
        )}


      <div ref={messagesEndRef} style={{ height: 1 }} />
    </div>
  );
}
