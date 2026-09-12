import { useEffect, useState } from "react";

// Scrolls the actual message-list container to its true bottom
// (scrollTop = scrollHeight) instead of asking scrollIntoView to guess how
// much space to leave clear via scroll-margin. The composer already lives
// OUTSIDE this scrollable element (a flex sibling below it, not inside it,
// see MessageThreadView.jsx), so the container's own scrollHeight never
// includes the composer in the first place — there's nothing to
// compensate for. The previous scroll-margin approach could still leave a
// message's tail tucked out of view: it ran before a message's own
// attachment image had finished loading and changed the container's real
// height, so the "bottom" it scrolled to was already stale by the time
// the image settled. Re-checking on the next two animation frames (after
// layout/paint, and again one frame later) catches that late resize
// without needing to know in advance how tall any given message is.
function scrollToRealBottom(el) {
  if (!el) return;
  const jump = () => { el.scrollTop = el.scrollHeight; };
  jump();
  requestAnimationFrame(() => {
    jump();
    requestAnimationFrame(jump);
  });
}

export function useMessageViewport({
  isInputFocused,
  scrollContainerRef,
  currentMessagesLength,
  otherIsTyping,
}) {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport || !isInputFocused) {
      setKeyboardInset(0);
      return undefined;
    }

    const viewport = window.visualViewport;
    const handleResize = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height);
      setKeyboardInset(inset);
    };

    viewport.addEventListener("resize", handleResize);
    handleResize();
    return () => viewport.removeEventListener("resize", handleResize);
  }, [isInputFocused]);

  // Runs whenever the message count changes — a message was sent OR
  // received, both go through the same currentMessagesLength bump.
  useEffect(() => {
    scrollToRealBottom(scrollContainerRef?.current);
  }, [scrollContainerRef, currentMessagesLength]);

  // The typing indicator floats above the composer without changing the
  // message count, so it needs its own trigger to keep the view pinned to
  // the bottom while it appears/disappears.
  useEffect(() => {
    if (!otherIsTyping) return undefined;
    const frame = requestAnimationFrame(() => scrollToRealBottom(scrollContainerRef?.current));
    return () => cancelAnimationFrame(frame);
  }, [otherIsTyping, scrollContainerRef]);

  return { keyboardInset };
}
