import { useEffect, useState } from "react";

export function useToast() {
  const [text, setText] = useState(null);
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), 3200);
    return () => clearTimeout(timer);
  }, [text]);
  return [text, setText];
}
