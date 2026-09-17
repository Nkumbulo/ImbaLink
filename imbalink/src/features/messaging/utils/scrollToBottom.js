// Scrolls the actual message-list container to its true bottom
// (scrollTop = scrollHeight) instead of asking scrollIntoView to guess how
// much space to leave clear via scroll-margin. Re-checking on the next two
// animation frames (after layout/paint, and again one frame later) catches
// a late resize — an attachment image finishing its load, or the composer
// itself growing taller — that would otherwise leave the "bottom" this
// scrolled to already stale by the time the real layout settles.
export function scrollToRealBottom(el) {
  if (!el) return;
  const jump = () => { el.scrollTop = el.scrollHeight; };
  jump();
  requestAnimationFrame(() => {
    jump();
    requestAnimationFrame(jump);
  });
}
