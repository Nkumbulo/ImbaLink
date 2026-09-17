import { useCallback, useRef, useState } from "react";
import { DOUBLE_TAP_ZOOM, MAX_ZOOM, MIN_ZOOM } from "./zoomConstants";
import { PHOTO_PENDING } from "../../../utils/propertyHelpers";

export function usePropertyPhotoViewer({ photos, viewerIndex, setViewerIndex, onDismissHint }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const imgWrapRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef({ mode: null, startX: 0, startY: 0, originX: 0, originY: 0, startDist: 0, startZoom: 1 });
  const lastTapRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });

  const clampPan = useCallback((next, z) => {
    const el = imgWrapRef.current;
    if (!el) return next;
    const rect = el.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width * (z - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (z - 1)) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  const applyZoom = useCallback((nextZoom, anchorPan) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setZoom(clamped);
    setPan((prev) => {
      const base = anchorPan || prev;
      return clamped <= MIN_ZOOM ? { x: 0, y: 0 } : clampPan(base, clamped);
    });
  }, [clampPan]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => applyZoom(zoom + 0.5), [applyZoom, zoom]);
  const zoomOut = useCallback(() => applyZoom(zoom - 0.5), [applyZoom, zoom]);

  const nextPhoto = useCallback(() => {
    setViewerIndex((i) => (i + 1) % photos.length);
    resetZoom();
  }, [photos.length, resetZoom, setViewerIndex]);

  const prevPhoto = useCallback(() => {
    setViewerIndex((i) => (i - 1 + photos.length) % photos.length);
    resetZoom();
  }, [photos.length, resetZoom, setViewerIndex]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    if (zoom > MIN_ZOOM) resetZoom();
    else applyZoom(DOUBLE_TAP_ZOOM, { x: 0, y: 0 });
  }, [applyZoom, resetZoom, zoom]);

  const handleWheel = useCallback((e) => {
    if (viewerIndex === null) return;
    e.preventDefault();
    applyZoom(zoom + (e.deltaY > 0 ? -0.25 : 0.25));
  }, [applyZoom, viewerIndex, zoom]);

  const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const onImgPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      gesture.current = {
        mode: "pinch",
        startDist: distanceBetween(pts[0], pts[1]),
        startZoom: zoom,
        originX: pan.x,
        originY: pan.y,
      };
      setIsInteracting(true);
    } else if (pointers.current.size === 1) {
      gesture.current = zoom > MIN_ZOOM
        ? { mode: "drag", startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y }
        : { mode: "swipe", startX: e.clientX, startY: e.clientY };
      if (zoom > MIN_ZOOM) setIsInteracting(true);
    }
  }, [pan.x, pan.y, zoom]);

  const onImgPointerMove = useCallback((e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesture.current.mode === "pinch" && pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = distanceBetween(pts[0], pts[1]);
      const ratio = dist / (gesture.current.startDist || dist);
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, gesture.current.startZoom * ratio));
      setZoom(nextZoom);
      setPan(clampPan({ x: gesture.current.originX, y: gesture.current.originY }, nextZoom));
    } else if (gesture.current.mode === "drag" && pointers.current.size === 1) {
      const dx = e.clientX - gesture.current.startX;
      const dy = e.clientY - gesture.current.startY;
      setPan(clampPan({ x: gesture.current.originX + dx, y: gesture.current.originY + dy }, zoom));
    }
  }, [clampPan, zoom]);

  const endPointer = useCallback((e) => {
    pointers.current.delete(e.pointerId);

    if (pointers.current.size === 0) {
      let movementDistance = 0;
      if (gesture.current.startX !== undefined && gesture.current.startY !== undefined) {
        movementDistance = Math.hypot(e.clientX - gesture.current.startX, e.clientY - gesture.current.startY);
      }
      const isTap = movementDistance < 10;

      if (isTap) {
        const now = Date.now();
        const lastPos = lastTapPosRef.current;
        const distanceFromLastTap = Math.hypot(e.clientX - lastPos.x, e.clientY - lastPos.y);
        if (now - lastTapRef.current < 300 && distanceFromLastTap < 30) {
          handleDoubleClick(e);
          lastTapRef.current = 0;
          lastTapPosRef.current = { x: 0, y: 0 };
        } else {
          lastTapRef.current = now;
          lastTapPosRef.current = { x: e.clientX, y: e.clientY };
        }
      }

      if (!isTap && gesture.current.mode === "swipe") {
        const dx = e.clientX - gesture.current.startX;
        const dy = e.clientY - gesture.current.startY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx > 0) prevPhoto();
          else nextPhoto();
        }
      }

      gesture.current = { mode: null };
      setIsInteracting(false);
      setPan((prev) => clampPan(prev, zoom));
    } else if (pointers.current.size === 1) {
      const [, point] = [...pointers.current.entries()][0];
      gesture.current = {
        mode: zoom > MIN_ZOOM ? "drag" : "swipe",
        startX: point.x,
        startY: point.y,
        originX: pan.x,
        originY: pan.y,
      };
    }
  }, [clampPan, handleDoubleClick, nextPhoto, pan.x, pan.y, prevPhoto, zoom]);

  const openViewer = useCallback((e) => {
    e.stopPropagation();
    if (!photos.length || photos[0] === PHOTO_PENDING) return;
    onDismissHint?.();
    setViewerIndex(0);
    resetZoom();
  }, [onDismissHint, photos.length, resetZoom, setViewerIndex]);

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
    resetZoom();
  }, [resetZoom, setViewerIndex]);

  return {
    zoom,
    pan,
    isInteracting,
    imgWrapRef,
    zoomIn,
    zoomOut,
    handleWheel,
    onImgPointerDown,
    onImgPointerMove,
    endPointer,
    nextPhoto,
    prevPhoto,
    openViewer,
    closeViewer,
  };
}
