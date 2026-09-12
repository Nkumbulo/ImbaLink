import React from "react";
import { Send } from "lucide-react";
import { T } from "../../../../styles/tokens";

export function MessageComposer({
  otherIsTyping,
  typingIndicatorRef,
  inputValue,
  handleSendMessage,
  notifyTyping,
  notifyTypingStopped,
  setInputValue,
  setIsInputFocused,
}) {
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
        alignItems:
          "center",
      }}
    >
      <input
        value={
          inputValue
        }
        onKeyDown={(event) => {
          // Keyboard input is the primary typing signal. Broadcast
          // immediately through the shared Supabase Realtime
          // conversation channel; onChange below also covers paste,
          // autofill and other non-keyboard input.
          if (event.key === "Enter" && !event.shiftKey) return;
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
          borderRadius:
            24,
          padding:
            "12px 16px",
          fontSize: 16,
          color: T.ink,
          outline: "none",
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
