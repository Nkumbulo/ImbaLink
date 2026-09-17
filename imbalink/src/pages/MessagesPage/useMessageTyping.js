import { useCallback, useEffect, useRef } from "react";
import { messagingService } from "../../services/messaging/messagingService";

export function useMessageTyping(typingChannelKey) {
  const typingActiveRef = useRef(false);
  const typingIdleTimerRef = useRef(null);

  const notifyTypingStopped = useCallback(() => {
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    if (typingActiveRef.current && typingChannelKey) {
      messagingService.sendTypingSignal(typingChannelKey, false);
    }
    typingActiveRef.current = false;
  }, [typingChannelKey]);

  const notifyTyping = useCallback(() => {
    if (!typingChannelKey) return;
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      messagingService.sendTypingSignal(typingChannelKey, true);
    }
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(notifyTypingStopped, 2000);
  }, [typingChannelKey, notifyTypingStopped]);

  useEffect(() => () => notifyTypingStopped(), [typingChannelKey, notifyTypingStopped]);

  return { notifyTyping, notifyTypingStopped };
}
