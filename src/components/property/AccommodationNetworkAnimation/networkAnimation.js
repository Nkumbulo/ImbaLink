// Animation-facing concerns (responsive tier detection, reduced-motion
// support, shared styling constants) kept apart from the pure layout
// math in networkGenerator.js.
import { useEffect, useState } from "react";

const TIER_QUERIES = {
  mobile: "(max-width: 640px)",
  tablet: "(max-width: 1024px)",
};

function resolveTier() {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  if (window.matchMedia(TIER_QUERIES.mobile).matches) return "mobile";
  if (window.matchMedia(TIER_QUERIES.tablet).matches) return "tablet";
  return "desktop";
}

// Only re-renders when a breakpoint is actually crossed (matchMedia
// "change" events), never on every pixel of a window resize.
export function useNetworkTier() {
  const [tier, setTier] = useState(resolveTier);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mqMobile = window.matchMedia(TIER_QUERIES.mobile);
    const mqTablet = window.matchMedia(TIER_QUERIES.tablet);
    const update = () => setTier(resolveTier());
    mqMobile.addEventListener("change", update);
    mqTablet.addEventListener("change", update);
    return () => {
      mqMobile.removeEventListener("change", update);
      mqTablet.removeEventListener("change", update);
    };
  }, []);

  return tier;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

// Monochrome-on-paper palette — deliberately restrained variations of
// the existing ink/paper tones rather than a new accent colour.
export const NETWORK_STYLE = {
  lineColor: "rgba(20,32,26,0.2)",
  houseColor: "rgba(20,32,26,0.48)",
  dotColor: "rgba(20,32,26,0.6)",
  dotRadius: 3,
};
