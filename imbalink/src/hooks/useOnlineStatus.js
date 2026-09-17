import { useEffect, useState } from "react";

// Real connectivity status via the standard browser online/offline events
// — not a guess, not polling. `navigator.onLine` can occasionally be a
// false positive (reports "online" on a network with no real internet
// access), but it's never a false negative: if the browser fires
// `offline`, the device has genuinely lost its network connection, which
// is exactly the case worth telling the person about.
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine !== false
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
