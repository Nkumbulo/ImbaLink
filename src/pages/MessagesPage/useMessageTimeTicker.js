import { useEffect, useState } from "react";

// Forces a lightweight re-render so relative timestamps such as "2m" and
// "Online 3 minutes ago" remain accurate while a thread stays open.
export function useMessageTimeTicker(intervalMs = 30000) {
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => tick((value) => value + 1), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
}
