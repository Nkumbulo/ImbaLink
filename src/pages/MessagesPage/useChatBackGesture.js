import { useEffect, useRef } from "react";

/**
 * Native-feeling left-edge back gesture for an active mobile conversation.
 * debug.noveatech: added without touching the messaging/realtime layer.
 */
export default function useChatBackGesture({ enabled, onBack }) {
  const gestureRef = useRef(null);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") return undefined;

    const EDGE = 24;
    const THRESHOLD = 88;
    const MAX_VERTICAL_DRIFT = 70;

    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > EDGE) return;

      gestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        active: true,
        cancelled: false,
      };
    };

    const onTouchMove = (event) => {
      const gesture = gestureRef.current;
      if (!gesture?.active || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      gesture.lastX = touch.clientX;
      gesture.lastY = touch.clientY;

      if (Math.abs(dy) > MAX_VERTICAL_DRIFT || dx < -8) {
        gesture.cancelled = true;
        gesture.active = false;
        return;
      }

      // Only prevent the browser's horizontal navigation once the gesture is
      // clearly intentional. Normal vertical message scrolling is untouched.
      if (dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture?.active || gesture.cancelled) return;

      const dx = gesture.lastX - gesture.startX;
      const dy = Math.abs((gesture.lastY ?? gesture.startY) - gesture.startY);
      if (dx >= THRESHOLD && dy < MAX_VERTICAL_DRIFT) {
        onBackRef.current?.();
      }
    };

    // Capture lets the gesture start over the chat without changing any
    // child component or horizontal interaction semantics.
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", onTouchEnd, true);
    };
  }, [enabled]);
}
