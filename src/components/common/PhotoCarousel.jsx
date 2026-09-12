import { memo, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bookmark, ImageOff, Loader2 } from "lucide-react";
import { T } from "../../styles/tokens";
import { PHOTO_PENDING } from "../../utils/propertyHelpers";
import { useListingUploadStatus } from "../../hooks/useListingUploadStatus";

const INTEREST_ANIM_STYLES = `
@keyframes carouselRingPulse {
  0% { transform: scale(0.5); opacity: 0.5; }
  100% { transform: scale(2.1); opacity: 0; }
}
.carousel-interest-ring {
  position: absolute;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  border: 2px solid ${T.white};
  animation: carouselRingPulse 0.8s ease-out forwards;
  pointer-events: none;
}
@keyframes carouselMarkFadeOut {
  0% { opacity: 0; transform: scale(0.6); }
  25% { opacity: 1; transform: scale(1.08); }
  40% { opacity: 1; transform: scale(1); }
  80% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1); }
}
.carousel-interest-mark {
  animation: carouselMarkFadeOut 1.6s ease forwards;
}
@keyframes carouselLabelFloat {
  0% { opacity: 0; transform: translateY(4px); }
  18% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-4px); }
}
.carousel-interest-label {
  animation: carouselLabelFloat 1.6s ease forwards;
}
@keyframes carouselBlurFade {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
.carousel-blur-overlay {
  animation: carouselBlurFade 1.6s ease forwards;
}
`;

const PhotoCarousel = memo(function PhotoCarousel({
  photos = [],
  height = 380,
  priceTag,
  badge,
  onDoubleTap,
  burstKey,
  burstLabel,
  burstAction = "added", // "added" or "removed"
  showDots = true,
  // Desktop cards are small and are not intended to preload adjacent slides.
  // Keeping this opt-in preserves the existing mobile swipe behavior while
  // avoiding a burst of image decodes when a desktop grid scrolls into view.
  preloadAdjacent = true,
  propertyId = null,
}) {
  const [idx, setIdx] = useState(0);
  const uploadStatus = useListingUploadStatus(propertyId);
  const scRef = useRef(null);
  const rafRef = useRef(null);
  const lastIndexRef = useRef(0);
  const [showBurst, setShowBurst] = useState(false);
  const burstTimerRef = useRef(null);

  const safePhotos = useMemo(
    () => (Array.isArray(photos) ? photos : []),
    [photos]
  );

  // Show burst overlay when burstKey changes, then hide after 1.6s
  useEffect(() => {
    if (burstKey > 0) {
      setShowBurst(true);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => {
        setShowBurst(false);
      }, 1600);
    }
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, [burstKey]);

  // Recompute the current index from the DOM directly (no rAF wait).
  // Used both by the scroll handler's rAF callback and by the
  // focus/visibility resync below.
  const syncIndexFromScroll = useCallback(() => {
    const el = scRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (!w) return;
    const nextIndex = Math.round(el.scrollLeft / w);
    if (nextIndex !== lastIndexRef.current) {
      lastIndexRef.current = nextIndex;
      setIdx(nextIndex);
    }
  }, []);

  const onScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      syncIndexFromScroll();
    });
  }, [syncIndexFromScroll]);

  // rAF is throttled/paused while the window/tab is unfocused (e.g. the
  // instant the mouse moves over another window on focus-follows-mouse
  // setups). A scroll that happened right before losing focus can leave
  // a stale rAF queued, which then fires all at once on refocus and
  // snaps `idx` — causing the img/placeholder swap below to pop
  // visibly. Cancel any pending rAF and resync immediately on
  // visibility/focus changes instead of waiting for it.
  useEffect(() => {
    const resync = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      syncIndexFromScroll();
    };
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [syncIndexFromScroll]);

  // Cancel any in-flight rAF on unmount so it can't call setState after
  // the component is gone.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Render a slide window one wider than before, and keep slides mounted
  // once rendered instead of swapping <img> <-> <div> at the same key.
  // Swapping element types forces React to unmount/remount the node
  // (a hard DOM replace), which is what reads as a "flicker" whenever
  // idx jumps by more than one step at once (e.g. after the focus-resync
  // above). Hiding with CSS keeps the swap purely visual and cheap.
  const renderedRef = useRef(new Set());
  renderedRef.current.forEach((i) => {
    const distance = Math.abs(i - idx);
    const keepDistance = preloadAdjacent ? 1 : 0;
    if (distance > keepDistance) renderedRef.current.delete(i);
  });
  const shouldRender = useCallback(
    (i) => {
      const inWindow = Math.abs(i - idx) <= (preloadAdjacent ? 1 : 0);
      if (inWindow) renderedRef.current.add(i);
      return inWindow || renderedRef.current.has(i);
    },
    [idx, preloadAdjacent]
  );

  // Determine icon color based on action
  const burstFillColor = burstAction === "removed" ? T.brick : T.msasa;

  return (
    <div
      className="relative"
      style={{ height }}
      onDoubleClick={onDoubleTap}
    >
      <style>{INTEREST_ANIM_STYLES}</style>

      <div
        ref={scRef}
        onScroll={onScroll}
        className="snapx noscroll flex overflow-x-auto h-full w-full"
        style={{
          contain: "layout paint",
          overscrollBehaviorX: "contain",
        }}
      >
        {safePhotos.map((src, i) =>
          src === PHOTO_PENDING ? (
            <div
              key={i}
              className="snap-item w-full h-full shrink-0 flex flex-col items-center justify-center gap-1.5"
              style={{ background: T.paperDim, color: T.ink60 }}
            >
              {uploadStatus?.status === "uploading" ? (
                <>
                  <Loader2 size={22} className="spin" />
                  <span className="f-body" style={{ fontSize: 10.5 }}>
                    Uploading photo{uploadStatus.total > 1 ? `s (${uploadStatus.done}/${uploadStatus.total})` : ""}…
                  </span>
                </>
              ) : (
                <>
                  <ImageOff size={22} />
                  <span className="f-body" style={{ fontSize: 10.5 }}>
                    {uploadStatus?.status === "failed" ? "Photo upload failed" : "No photo yet"}
                  </span>
                </>
              )}
            </div>
          ) : shouldRender(i) ? (
            <img
              key={i}
              src={src}
              alt=""
              className="snap-item w-full h-full object-cover shrink-0"
              draggable={false}
              loading="lazy"
              decoding="async"
              style={{
                visibility: Math.abs(i - idx) <= 1 ? "visible" : "hidden",
              }}
            />
          ) : (
            <div
              key={i}
              className="snap-item w-full h-full shrink-0"
              aria-hidden="true"
            />
          )
        )}
      </div>

      {badge && (
        <div className="absolute top-3 right-3">
          {badge}
        </div>
      )}

      {priceTag && (
        <div className="absolute bottom-3 left-3">
          {priceTag}
        </div>
      )}

      {showDots && safePhotos.length > 1 && (
        <div
          className="absolute bottom-3 flex gap-1"
          style={{
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {safePhotos.map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === idx ? 12 : 5,
                height: 5,
                transition: "width .2s ease",
                background:
                  i === idx
                    ? T.white
                    : "rgba(255,255,255,0.55)",
              }}
            />
          ))}
        </div>
      )}

      {/* Interest burst overlay – only mounted while showBurst is true */}
      {showBurst && burstKey > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {/* Blurred dark backdrop that fades in/out */}
          <div
            className="carousel-blur-overlay absolute inset-0"
            style={{
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              background: "rgba(20,32,26,0.35)",
            }}
          />
          <div className="relative flex items-center justify-center" style={{ width: 92, height: 92 }}>
            <span key={`${burstKey}-ring`} className="carousel-interest-ring" />
            <Bookmark
              key={burstKey}
              size={40}
              className="carousel-interest-mark"
              fill={burstFillColor}
              color={burstFillColor}
              strokeWidth={1.5}
              style={{
                filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.35))",
              }}
            />
          </div>
          {burstLabel && (
            <span
              key={`${burstKey}-label`}
              className="f-body font-semibold carousel-interest-label px-3 py-1 rounded-full mt-1.5"
              style={{
                background: "rgba(20,32,26,0.65)",
                color: T.white,
                fontSize: 11.5,
                backdropFilter: "blur(6px)",
              }}
            >
              {burstLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default PhotoCarousel;