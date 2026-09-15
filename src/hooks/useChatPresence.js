import { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";
import { isPresenceOnline, useGlobalPresence } from "./useGlobalPresence";

export default function useChatPresence(_conversationId, userId, otherUserId) {
  useGlobalPresence(userId); // keeps *my own* heartbeat running while this is mounted
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const id = otherUserId ? String(otherUserId) : "";

  // Load the persisted last heartbeat, then keep it synchronized through a
  // Realtime subscription filtered to this one user's row. Supabase only
  // delivers this to clients that filtered for user_id=eq.<id>, so it's
  // cheap no matter how many people are online overall — unlike the old
  // shared global presence channel, this never fans a heartbeat out to
  // everyone (see useGlobalPresence.js).
  useEffect(() => {
    let active = true;
    if (!id) { setLastSeenAt(null); return undefined; }

    const load = async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("user_id, last_seen_at")
        .eq("user_id", id)
        .maybeSingle();
      if (active && data?.last_seen_at) setLastSeenAt(data.last_seen_at);
    };
    void load();

    const channel = supabase
      .channel(`imbalink-last-seen-${id}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence", filter: `user_id=eq.${id}` },
        (payload) => {
          const next = payload?.new?.last_seen_at;
          if (active && next) setLastSeenAt(next);
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [id]);

  const online = isPresenceOnline(lastSeenAt);

  return { online, lastSeenAt };
}
