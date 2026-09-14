import React, { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { T } from "../../../../styles/tokens";
import { scrollToRealBottom } from "../../utils/scrollToBottom";

// Matches WhatsApp/Instagram-style composer growth: starts at one line,
// grows upward as text wraps, caps out and scrolls internally past a
// point rather than eating the whole screen.
const LINE_HEIGHT = 20;
const MAX_LINES = 6;
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES + 24; // + the textarea's own vertical padding

export function MessageComposer({
  otherIsTyping,
  typingIndicatorRef,
  inputValue,
  handleSendMessage,
  notifyTyping,
  notifyTypingStopped,
  setInputValue,
  setIsInputFocused,
  scrollContainerRef,
}) {
  const textareaRef = useRef(null);

  // Re-measures on every value change (typing, paste, and — importantly —
  // the synchronous setInputValue("") right after a send in
  // useMessagesPageController.js, which is what shrinks this back down to
  // one line automatically once a multi-line message goes out). Resetting
  // to "auto" first is necessary before reading scrollHeight — otherwise
  // a shrinking textarea would keep reporting its old, taller scrollHeight
  // since the previous inline height is still constraining it.
  //
  // Growing the composer shrinks the message list's visible area (it's a
  // flex sibling above this one) — without re-pinning scroll, the latest
  // message can end up hidden behind the now-taller composer as you type
  // a multi-line message. WhatsApp/Instagram keep the tail of the
  // conversation visible while composing; re-running the same
  // scroll-to-bottom the message list itself uses on a new message
  // matches that.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    scrollToRealBottom(scrollContainerRef?.current);
  }, [inputValue, scrollContainerRef]);

  return (
  <div
    style={{
      position: "relative",
      borderTop:
        `1px solid ${T.line}`,
      background:
        T.paper,
      padding:
        "12px 16px",
      paddingBottom:
        "max(12px, env(safe-area-inset-bottom, 0px))",
      flexShrink: 0,
    }}
  >
    {otherIsTyping && (
      <div
        ref={typingIndicatorRef}
        className="animate-fadeIn"
        aria-live="polite"
        aria-label="User is typing"
        style={{
          position: "absolute",
          left: 62,
          bottom: "calc(100% + 14px)",
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "9px 14px",
            minHeight: 36,
            borderRadius: "18px 18px 18px 5px",
            background: "rgba(255,255,255,0.97)",
            color: T.ink,
            border: `1px solid ${T.line}`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 3px 12px rgba(0,0,0,0.10)",
            position: "relative",
            transformOrigin: "left bottom",
          }}
        >
          <i className="typing-dot" style={{ width: 6, height: 6 }} />
          <i className="typing-dot" style={{ width: 6, height: 6 }} />
          <i className="typing-dot" style={{ width: 6, height: 6 }} />
        </div>
      </div>
    )}

<form
      onSubmit={(event) => {
        event.preventDefault();
        handleSendMessage();
      }}
      style={{
        display:
          "flex",
        gap: 10,
        // Bottom-aligned, not centered — once the textarea grows past one
        // line the send button should stay anchored to the bottom of the
        // row (where the thumb naturally is), not drift to the vertical
        // center of a now-taller box. Same as WhatsApp/Instagram.
        alignItems:
          "flex-end",
      }}
    >
      <textarea
        ref={textareaRef}
        value={
          inputValue
        }
        rows={1}
        onKeyDown={(event) => {
          // Enter sends (matches the previous <input> — a plain <input>
          // submits its form on Enter natively; a <textarea> does not, so
          // this now has to be done explicitly). Shift+Enter inserts a
          // real newline instead, same as WhatsApp/Instagram — left
          // un-prevented so the browser's default newline insertion runs.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
            return;
          }
          // Keyboard input is the primary typing signal. Broadcast
          // immediately through the shared Supabase Realtime
          // conversation channel; onChange below also covers paste,
          // autofill and other non-keyboard input.
          if (event.key === "Backspace" || event.key === "Delete" || event.key.length === 1) {
            const nextValue = event.key.length === 1
              ? `${inputValue}${event.key}`
              : inputValue;
            if (nextValue.trim()) notifyTyping();
            else notifyTypingStopped();
          }
        }}
        onChange={(event) => {
          const value = event.target.value;
          setInputValue(value);
          if (value.trim()) notifyTyping();
          else notifyTypingStopped();
        }}
        placeholder="Type a message…"
        onFocus={() =>
          setIsInputFocused(
            true
          )
        }
        onBlur={() => {
          setIsInputFocused(
            false
          );
          notifyTypingStopped();
        }}
        aria-label="Message"
        style={{
          flex: 1,
          background:
            T.paperDim,
          border:
            `1px solid ${T.line}`,
          // A fixed pill radius (24px, half of the 48px single-line
          // height) looks right at one line but wrong once the box grows
          // taller — WhatsApp/Instagram settle on a more modest rounded-
          // rect once multi-line rather than staying a true pill.
          borderRadius:
            20,
          padding:
            "12px 16px",
          fontSize: 16,
          lineHeight: `${LINE_HEIGHT}px`,
          color: T.ink,
          outline: "none",
          resize: "none",
          maxHeight: MAX_HEIGHT,
          // Hidden until the cap is hit, then a normal internal scroll —
          // matches the same "grows, then scrolls" behavior as
          // WhatsApp/Instagram's composer past their own line cap.
          overflowY: "hidden",
          fontFamily: "inherit",
          transition:
            "box-shadow 0.2s, border-color 0.2s",
          boxShadow:
            "inset 0 1px 3px rgba(0,0,0,0.04)",
        }}
        onFocusCapture={(
          event
        ) => {
          event.target.style.boxShadow =
            `0 0 0 2px ${T.jacaranda}40`;

          event.target.style.borderColor =
            T.jacaranda;
        }}
        onBlurCapture={(
          event
        ) => {
          event.target.style.boxShadow =
            "inset 0 1px 3px rgba(0,0,0,0.04)";

          event.target.style.borderColor =
            T.line;
        }}
      />

      <button
        type="submit"
        disabled={
          !inputValue.trim()
        }
        aria-label="Send message"
        style={{
          width: 48,
          height: 48,
          borderRadius:
            "50%",
          background:
            T.jacaranda,
          border: "none",
          display:
            "flex",
          alignItems:
            "center",
          justifyContent:
            "center",
          cursor:
            inputValue.trim()
              ? "pointer"
              : "default",
          transition:
            "transform 0.15s, opacity 0.15s",
          boxShadow:
            "0 4px 12px rgba(108,56,255,0.35)",
          flexShrink: 0,
          opacity:
            inputValue.trim()
              ? 1
              : 0.5,
        }}
        className="active:scale-90"
      >
        <Send
          size={22}
          color={T.paper}
        />
      </button>
    </form>
  </div>
  );
}
