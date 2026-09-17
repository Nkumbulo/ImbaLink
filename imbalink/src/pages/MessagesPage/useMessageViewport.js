import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { scrollToRealBottom } from "../../features/messaging/utils/scrollToBottom";

export { scrollToRealBottom };

export function useMessageViewport({
  isInputFocused,
  scrollContainerRef,
  currentMessagesLength,
  otherIsTyping,
}) {
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Two independent keyboard-height sources, used depending on platform —
  // this is the actual fix for the header drifting upward with the
  // keyboard, not just a tweak to the existing visualViewport logic.
  //
  // On a bare web page, visualViewport is the only signal available, and
  // it's fine there. But in the native Capacitor shell, without this
  // plugin the WebView's own OS-level resize-on-keyboard behavior was
  // ALSO happening — independently of, and not synchronized with, this
  // component's own visualViewport-driven `bottom` calc on the page shell
  // (see MessagesPage.jsx). Two uncoordinated layout systems both
  // reacting to the same keyboard event is exactly what produced the
  // header appearing to "move" — not because the header's own CSS was
  // wrong (it's position:fixed; top:0 the whole time), but because the
  // ground underneath it was shifting from a second, native-side resize
  // this code had no way to see or control.
  //
  // capacitor.config.json now sets Keyboard.resize to "none", which turns
  // that native-side resize off entirely — the WebView's own size stops
  // changing when the keyboard opens, so position:fixed/top:0 behaves
  // exactly like the CSS says. This hook's job becomes purely "how tall
  // is the keyboard, so the page shell can carve out that much space at
  // the bottom" — and the plugin's keyboardWillShow/keyboardDidShow
  // events report that height directly and immediately, rather than
  // waiting on a visualViewport resize event whose timing versus the
  // native keyboard animation is not guaranteed.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    // keyboardWillShow/Hide fire before the animation on iOS but are not
    // guaranteed on Android (Capacitor's own documented platform
    // difference) — keyboardDidShow/Hide are the reliable pair on both,
    // so both are listened for and whichever fires first for a given
    // open/close wins; the numbers converge to the same final value
    // either way.
    const showListeners = [
      Keyboard.addListener("keyboardWillShow", (info) => setKeyboardInset(info.keyboardHeight || 0)),
      Keyboard.addListener("keyboardDidShow", (info) => setKeyboardInset(info.keyboardHeight || 0)),
    ];
    const hideListeners = [
      Keyboard.addListener("keyboardWillHide", () => setKeyboardInset(0)),
      Keyboard.addListener("keyboardDidHide", () => setKeyboardInset(0)),
    ];

    return () => {
      [...showListeners, ...hideListeners].forEach((p) => p.then((l) => l.remove()));
    };
  }, []);

  useEffect(() => {
    // Web/PWA path only — native platforms are fully covered by the
    // Keyboard plugin listeners above, which report the real keyboard
    // height directly instead of inferring it from a viewport resize.
    if (Capacitor.isNativePlatform()) return undefined;
    if (typeof window === "undefined" || !window.visualViewport || !isInputFocused) {
      setKeyboardInset(0);
      return undefined;
    }

    const viewport = window.visualViewport;
    // offsetTop accounts for the visual viewport having scrolled down
    // within the layout viewport (iOS does this to bring a focused input
    // into view) — without it, the gap this hook carves out at the
    // bottom can be measured against the wrong reference point.
    const measure = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset);
    };

    // Mobile Safari's address bar collapses/expands on its own timeline,
    // independently of (and often overlapping) the keyboard opening —
    // that's the actual cause of the composer sometimes settling too far
    // above the keyboard with Safari's URL bar visible in the gap. A
    // single resize event can fire mid-transition, and this hook would
    // otherwise lock in that in-between measurement as the final one,
    // since nothing told it to check again once Safari's chrome actually
    // finished moving.
    //
    // Fix: keep re-measuring — on every resize/scroll event the visual
    // viewport fires, AND via a short rAF polling window after each one —
    // until two consecutive frames report the same height (i.e. it's
    // actually settled), instead of trusting the first sample. This is a
    // timing fix, not a formula fix: the math above was already correct,
    // it just wasn't being re-run late enough to catch browser chrome
    // that hadn't finished animating yet.
    let settleFrame = null;
    let settleTimeout = null;
    const stopSettling = () => {
      if (settleFrame) cancelAnimationFrame(settleFrame);
      if (settleTimeout) clearTimeout(settleTimeout);
      settleFrame = null;
      settleTimeout = null;
    };
    const scheduleSettleCheck = () => {
      stopSettling();
      let lastHeight = viewport.height;
      let stableFrames = 0;
      const tick = () => {
        measure();
        if (viewport.height === lastHeight) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
          lastHeight = viewport.height;
        }
        if (stableFrames < 2) {
          settleFrame = requestAnimationFrame(tick);
        } else {
          // Once the viewport itself has settled, the message list's
          // scroll position still needs one more nudge — the shell
          // resized underneath it while this was polling, and the last
          // message can end up sitting just above the fold rather than
          // flush with the (now final) bottom edge.
          scrollToRealBottom(scrollContainerRef?.current);
          settleFrame = null;
        }
      };
      settleFrame = requestAnimationFrame(tick);
      // Hard stop at ~800ms regardless — Safari's chrome transitions are
      // well under that in practice; this just guarantees the polling
      // loop can never run indefinitely if something keeps nudging the
      // viewport (e.g. the user actively scrolling).
      settleTimeout = setTimeout(stopSettling, 800);
    };

    const handleViewportChange = () => {
      measure();
      scheduleSettleCheck();
    };

    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);
    handleViewportChange();

    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
      stopSettling();
    };
  }, [isInputFocused, scrollContainerRef]);

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
