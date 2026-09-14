import React from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { MIN_ZOOM, MAX_ZOOM } from "./zoomConstants";

export default function PropertyPhotoViewer({
  viewerIndex,
  photos,
  loadedMap,
  markLoaded,
  viewer,
}) {
  if (viewerIndex === null) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      onClick={(e) => {
        if (e.target === e.currentTarget) viewer.closeViewer();
      }}
      onWheel={viewer.handleWheel}
    >
      <button
        onClick={viewer.closeViewer}
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur"
      >
        <X size={24} color="white" />
      </button>

      <div className="absolute bottom-5 right-5 flex gap-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); viewer.zoomOut(); }}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur"
          disabled={viewer.zoom <= MIN_ZOOM}
          style={{ opacity: viewer.zoom <= MIN_ZOOM ? 0.4 : 1 }}
        >
          <ZoomOut size={20} color="white" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); viewer.zoomIn(); }}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur"
          disabled={viewer.zoom >= MAX_ZOOM}
          style={{ opacity: viewer.zoom >= MAX_ZOOM ? 0.4 : 1 }}
        >
          <ZoomIn size={20} color="white" />
        </button>
      </div>

      <div
        ref={viewer.imgWrapRef}
        className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ touchAction: "none" }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={viewer.onImgPointerDown}
        onPointerMove={viewer.onImgPointerMove}
        onPointerUp={viewer.endPointer}
        onPointerCancel={viewer.endPointer}
        onPointerLeave={viewer.endPointer}
      >
        {!loadedMap[viewerIndex] && (
          <div
            className="img-skeleton absolute"
            style={{ width: "70%", height: "55%", borderRadius: 16, background: "rgba(255,255,255,0.08)" }}
          />
        )}
        <img
          key={viewerIndex}
          src={photos[viewerIndex]}
          alt={`Property photo ${viewerIndex + 1}`}
          className="max-w-full max-h-full object-contain viewer-img-enter"
          draggable={false}
          decoding="async"
          onLoad={() => markLoaded(viewerIndex)}
          style={{
            transform: `translate3d(${viewer.pan.x}px, ${viewer.pan.y}px, 0) scale(${viewer.zoom})`,
            transition: viewer.isInteracting ? "none" : "transform .25s cubic-bezier(0.2,0.8,0.2,1)",
            cursor: viewer.zoom > MIN_ZOOM ? (viewer.isInteracting ? "grabbing" : "grab") : "zoom-in",
            touchAction: "none",
            opacity: loadedMap[viewerIndex] ? 1 : 0,
            willChange: "transform",
          }}
        />
      </div>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); viewer.prevPhoto(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur"
          >
            <ChevronLeft size={24} color="white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); viewer.nextPhoto(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur"
          >
            <ChevronRight size={24} color="white" />
          </button>
        </>
      )}

      <div className="absolute bottom-5 left-5 text-white text-sm font-medium">
        {viewerIndex + 1} / {photos.length}
      </div>
    </div>
  );
}
