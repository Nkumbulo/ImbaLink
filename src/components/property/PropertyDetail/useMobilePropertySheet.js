import { useEffect, useRef } from "react";

/**
 * Owns mobile-only property-sheet gesture behavior.
 * Desktop/tablet intentionally never installs these handlers.
 */
export function useMobilePropertySheet({
  overlayRef,
  scrollableRef,
  panelRef,
  photoExpanded,
  setPhotoExpanded,
  onClose,
}) {
  const gestureRef = useRef({
    startY: 0,
    startX: 0,
    startScrollTop: 0,
    startedInScrollable: false,
    canControlSheet: false,
    didControlSheet: false,
  });

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;

    const gesture = gestureRef.current;
    const getScrollable = () => scrollableRef.current;
    const getPanel = () => panelRef.current;

    const handleWheel = (event) => {
      const scrollable = getScrollable();
      const panel = getPanel();
      if (!panel || !panel.contains(event.target)) return;

      const insideScrollable = !!(scrollable && scrollable.contains(event.target));
      const atTop = !scrollable || scrollable.scrollTop <= 0;

      if (insideScrollable && !atTop) return;

      if (event.deltaY < 0 && !photoExpanded) {
        event.preventDefault();
        setPhotoExpanded(true);
      } else if (event.deltaY > 0 && atTop) {
        event.preventDefault();
        if (photoExpanded) setPhotoExpanded(false);
        else onClose();
      }
    };

    const handleTouchStart = (event) => {
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const scrollable = getScrollable();
      const startedInScrollable = !!(scrollable && scrollable.contains(event.target));
      const atTop = !scrollable || scrollable.scrollTop <= 0;

      gesture.startY = touch.clientY;
      gesture.startX = touch.clientX;
      gesture.startScrollTop = scrollable?.scrollTop || 0;
      gesture.startedInScrollable = startedInScrollable;
      gesture.didControlSheet = false;
      gesture.canControlSheet =
        (!photoExpanded && !startedInScrollable) ||
        (atTop && (photoExpanded || !startedInScrollable));
    };

    const handleTouchMove = (event) => {
      if (
        event.touches.length !== 1 ||
        !gesture.canControlSheet ||
        gesture.didControlSheet
      ) return;

      const touch = event.touches[0];
      const deltaY = touch.clientY - gesture.startY;
      const deltaX = touch.clientX - gesture.startX;

      if (Math.abs(deltaY) < 14 || Math.abs(deltaX) > Math.abs(deltaY)) return;

      const scrollable = getScrollable();
      const atTop = !scrollable || scrollable.scrollTop <= 0;

      if (deltaY < 0 && !photoExpanded) {
        event.preventDefault();
        setPhotoExpanded(true);
        gesture.didControlSheet = true;
      } else if (deltaY > 0 && photoExpanded && atTop) {
        event.preventDefault();
        setPhotoExpanded(false);
        gesture.didControlSheet = true;
      } else if (deltaY > 0 && !photoExpanded) {
        event.preventDefault();
        onClose();
        gesture.didControlSheet = true;
      }
    };

    const resetGesture = () => {
      gesture.startY = 0;
      gesture.startX = 0;
      gesture.startScrollTop = 0;
      gesture.startedInScrollable = false;
      gesture.canControlSheet = false;
      gesture.didControlSheet = false;
    };

    overlay.addEventListener("wheel", handleWheel, { passive: false });
    overlay.addEventListener("touchstart", handleTouchStart, { passive: true });
    overlay.addEventListener("touchmove", handleTouchMove, { passive: false });
    overlay.addEventListener("touchend", resetGesture, { passive: true });
    overlay.addEventListener("touchcancel", resetGesture, { passive: true });

    return () => {
      overlay.removeEventListener("wheel", handleWheel);
      overlay.removeEventListener("touchstart", handleTouchStart);
      overlay.removeEventListener("touchmove", handleTouchMove);
      overlay.removeEventListener("touchend", resetGesture);
      overlay.removeEventListener("touchcancel", resetGesture);
    };
  }, [overlayRef, scrollableRef, panelRef, photoExpanded, setPhotoExpanded, onClose]);
}
