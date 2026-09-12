import React, { useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  Share2,
  Link2,
} from "lucide-react";
import { MIN_ZOOM, MAX_ZOOM } from "./zoomConstants";

const glass = {
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  backdropFilter: "blur(18px) saturate(130%)",
  WebkitBackdropFilter: "blur(18px) saturate(130%)",
};

export default function PropertyPhotoViewer({
  viewerIndex,
  photos,
  loadedMap,
  markLoaded,
  viewer,
  onShare,
  onCopyLink,
}) {
  useEffect(() => {
    if (viewerIndex === null || !photos.length) return;
    const indexes = [
      (viewerIndex + 1) % photos.length,
      (viewerIndex - 1 + photos.length) % photos.length,
    ];
    indexes.forEach((index) => {
      if (photos[index]) {
        const img = new Image();
        img.decoding = "async";
        img.src = photos[index];
      }
    });
  }, [photos, viewerIndex]);

  if (viewerIndex === null) return null;

  const photo = photos[viewerIndex];
  const isZoomed = viewer.zoom > MIN_ZOOM;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Property photo viewer"
      onWheel={viewer.handleWheel}
      onClick={(e) => {
        if (e.target === e.currentTarget) viewer.closeViewer();
      }}
      style={{
        background:
          "radial-gradient(circle at 50% 42%, rgba(38,50,44,0.25), rgba(4,7,6,0.88) 68%)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
      }}
    >
      {/* Dark overlay – hidden on mobile, reduced opacity for premium blur */}
      <div
        className="absolute inset-0 pointer-events-none max-sm:hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.35), transparent 24%, transparent 72%, rgba(0,0,0,0.5))",
        }}
      />

      {/* Top chrome */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] pb-4 sm:px-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            viewer.closeViewer();
          }}
          aria-label="Close photo viewer"
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          style={glass}
        >
          <X size={21} />
        </button>

        <div className="flex items-center gap-2">
          <div
            className="px-3.5 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold tracking-wide"
            style={glass}
          >
            {viewerIndex + 1} <span className="mx-1 opacity-40">/</span>{" "}
            {photos.length}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare?.();
            }}
            aria-label="Share property"
            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={glass}
          >
            <Share2 size={19} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopyLink?.();
            }}
            aria-label="Copy property link"
            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={glass}
          >
            <Link2 size={19} />
          </button>
        </div>
      </div>

      {/* Image stage – padding removed on mobile */}
      <div
        ref={viewer.imgWrapRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden select-none img-stage"
        style={{
          touchAction: "none",
          padding: "72px 58px 118px",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={viewer.onImgPointerDown}
        onPointerMove={viewer.onImgPointerMove}
        onPointerUp={viewer.endPointer}
        onPointerCancel={viewer.endPointer}
      >
        {!loadedMap[viewerIndex] && (
          <div
            className="absolute rounded-2xl animate-pulse img-skeleton"
            style={{
              inset: "16% 9%",
              background:
                "linear-gradient(110deg, rgba(255,255,255,0.05), rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
            }}
          />
        )}

        <img
          key={`${viewerIndex}-${photo}`}
          src={photo}
          alt={`Property photo ${viewerIndex + 1} of ${photos.length}`}
          className="max-w-full max-h-full object-contain viewer-img"
          draggable={false}
          decoding="async"
          fetchPriority="high"
          onLoad={() => markLoaded(viewerIndex)}
          style={{
            transform: `translate3d(${viewer.pan.x}px, ${viewer.pan.y}px, 0) scale(${viewer.zoom})`,
            transition: viewer.isInteracting
              ? "none"
              : "transform 280ms cubic-bezier(.22,1,.36,1), opacity 180ms ease",
            animation:
              viewer.direction === 0
                ? "photoViewerIn 220ms cubic-bezier(.22,1,.36,1)"
                : `${viewer.direction > 0 ? "photoViewerNext" : "photoViewerPrev"} 300ms cubic-bezier(.22,1,.36,1)`,
            cursor: isZoomed
              ? viewer.isInteracting
                ? "grabbing"
                : "grab"
              : "zoom-in",
            touchAction: "none",
            opacity: loadedMap[viewerIndex] ? 1 : 0,
            willChange: "transform, opacity",
            userSelect: "none",
          }}
        />
      </div>

      {/* Desktop navigation */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              viewer.prevPhoto();
            }}
            aria-label="Previous photo"
            className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full items-center justify-center active:scale-90 transition-transform"
            style={glass}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              viewer.nextPhoto();
            }}
            aria-label="Next photo"
            className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full items-center justify-center active:scale-90 transition-transform"
            style={glass}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-4 sm:px-6">
        <div className="mx-auto max-w-md flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              viewer.zoomOut();
            }}
            aria-label="Zoom out"
            disabled={viewer.zoom <= MIN_ZOOM}
            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all disabled:opacity-35"
            style={glass}
          >
            <ZoomOut size={19} />
          </button>

          <div
            className="h-11 px-4 rounded-full flex items-center justify-center text-[11px] font-medium opacity-80"
            style={glass}
          >
            {isZoomed
              ? `${Math.round(viewer.zoom * 100)}%`
              : "Pinch or double-tap to zoom"}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              viewer.zoomIn();
            }}
            aria-label="Zoom in"
            disabled={viewer.zoom >= MAX_ZOOM}
            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all disabled:opacity-35"
            style={glass}
          >
            <ZoomIn size={19} />
          </button>
        </div>

        {photos.length > 1 && (
          <div className="mt-3 mx-auto max-w-xl flex items-center justify-center gap-1.5 overflow-hidden px-4">
            {photos.slice(0, 9).map((src, index) => (
              <button
                type="button"
                key={`${src}-${index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (index === viewerIndex) return;
                  if (index > viewerIndex) {
                    for (let i = viewerIndex; i < index; i += 1)
                      viewer.nextPhoto();
                  } else {
                    for (let i = viewerIndex; i > index; i -= 1)
                      viewer.prevPhoto();
                  }
                }}
                aria-label={`View photo ${index + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: index === viewerIndex ? 24 : 7,
                  background:
                    index === viewerIndex ? "white" : "rgba(255,255,255,0.32)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes photoViewerIn {
          from { opacity: 0; transform: translate3d(0, 8px, 0) scale(.985); }
          to { opacity: 1; }
        }
        @keyframes photoViewerNext {
          from { opacity: 0; transform: translate3d(28px, 0, 0) scale(.985); }
          to { opacity: 1; }
        }
        @keyframes photoViewerPrev {
          from { opacity: 0; transform: translate3d(-28px, 0, 0) scale(.985); }
          to { opacity: 1; }
        }

        /* Mobile adjustments */
        @media (max-width: 639px) {
          .img-stage {
            padding: 0 !important;
          }
          .viewer-img {
            border-radius: 0 !important;
          }
          .img-skeleton {
            inset: 0 !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}