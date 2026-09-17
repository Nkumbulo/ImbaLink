import { useCallback, useEffect, useRef, useState } from "react";

// A small, generic "show this text for N seconds" mechanism shared by
// several of PostCard's handlers (save, share, request-viewing failure) —
// genuinely independent of each of their own specific logic, unlike the
// rest of PostCard's animation/gesture state (burst, likeAnim, linkMorphed,
// etc.), which stays interdependent enough in the main component that
// pulling it out separately isn't a safe win the way this is.
export function useTimedToast() {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState("");
  const toastTimerRef = useRef(null);

  const showToast = useCallback((text, duration = 3000) => {
    setToastText(text);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), duration);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return { toastVisible, toastText, showToast };
}
