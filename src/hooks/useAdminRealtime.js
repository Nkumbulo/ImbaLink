import { useEffect, useRef } from "react";
import { supabase } from "../core/supabase/client";

// Keep one stable subscription per mounted admin page. AdminApp keeps page
// views mounted so switching sections preserves their data; each hook therefore
// needs its own channel and must not resubscribe on every render.
export default function useAdminRealtime(onChange, { enabled = true } = {}) {
  const callbackRef = useRef(onChange);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return undefined;

    let timer;
    const channelName = `imbalink-admin-realtime-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => callbackRef.current?.(), 250);
        }
      );

    // Register all callbacks before subscribing. Supabase Realtime does not
    // allow postgres_changes handlers to be added after subscribe().
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
}
