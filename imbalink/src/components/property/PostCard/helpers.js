// Helper: find all scrollable ancestors of an element
export function getScrollableAncestors(element) {
  const ancestors = [];
  let current = element?.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      ancestors.push(current);
    }
    current = current.parentElement;
  }
  const docEl = document.documentElement;
  const body = document.body;
  if (docEl.scrollHeight > window.innerHeight) {
    ancestors.push(docEl);
  }
  if (body.scrollHeight > window.innerHeight) {
    ancestors.push(body);
  }
  return ancestors;
}

// Same robust listing verification check used in ListerProfile (and, as
// its own separate local copy, in PropertyDetail.jsx — a real, pre-existing
// small duplication across the codebase, not introduced by this split;
// left as-is here since unifying it is a different, broader task than
// splitting this one file).
export const isListingVerified = (p) =>
  p?.verification === "verified" || p?.verified === true || p?.verificationStatus === "verified";

// Fires a short, light haptic buzz the instant the button is tapped.
export const triggerHaptic = () => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(15);
  }
};
