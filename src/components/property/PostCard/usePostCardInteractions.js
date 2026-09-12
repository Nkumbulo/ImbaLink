import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { getDisplayPhotos } from "../../../utils/propertyHelpers";
import { useListingUploadStatus } from "../../../hooks/useListingUploadStatus";
import { recordPropertyRecommendation } from "../../../core/data/domains/properties.js";
import { getScrollableAncestors, isListingVerified, triggerHaptic } from "./helpers";
import { useTimedToast } from "./useTimedToast";

// All of PostCard's interactive state and handlers, moved here verbatim
// from the original monolithic component. This state is genuinely
// interdependent (save animation feeds the burst overlay, share/link/
// request-viewing all funnel through the same toast, etc.) so it's one
// hook rather than several smaller ones — same reasoning documented in
// useTimedToast.js for why *that* piece alone was safe to split out
// separately.
export function usePostCardInteractions({
  p,
  compactDesktop,
  saved,
  onToggleSave,
  onSelectCard,
  autoOpen,
  onSheetClose,
  scrollLockElement,
  viewingRequested,
  onRequestViewing,
  onOpenLister,
  onOpen,
}) {
  const [burst, setBurst] = useState(0);
  const [desktopPhotoIndex, setDesktopPhotoIndex] = useState(0);
  const [burstAction, setBurstAction] = useState("added"); // "added" or "removed"
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const sentTimerRef = useRef(null);

  const [saveAnim, setSaveAnim] = useState(false);
  const saveAnimTimerRef = useRef(null);

  const [linkPressed, setLinkPressed] = useState(false);
  const { toastVisible, toastText, showToast } = useTimedToast();

  const photos = useMemo(() => {
    // Desktop Search cards are only ~220px tall; downloading 900x1125
    // originals for every card creates a large decode/fetch burst while
    // scrolling. Keep mobile at the existing resolution. (Only affects the
    // seeded-catalog fallback; real listings never hit that branch.)
    return getDisplayPhotos(p, compactDesktop ? 480 : 900, compactDesktop ? 600 : 1125);
  }, [p, compactDesktop]);
  const uploadStatus = useListingUploadStatus(p?.id);
  const lastTapRef = useRef(0);
  const cardRef = useRef(null);

  useEffect(() => {
    setDesktopPhotoIndex(0);
  }, [p?.id]);

  const nextDesktopPhoto = useCallback((e) => {
    e?.stopPropagation?.();
    if (!photos.length) return;
    setDesktopPhotoIndex((current) => (current + 1) % photos.length);
  }, [photos.length]);

  const onSheetCloseRef = useRef(onSheetClose);
  useEffect(() => {
    onSheetCloseRef.current = onSheetClose;
  }, [onSheetClose]);

  // Lock scroll when popup open
  useEffect(() => {
    if (!isSheetOpen) return;
    const baseEl = scrollLockElement || cardRef.current;
    const scrollableAncestors = getScrollableAncestors(baseEl);
    const originalOverflows = scrollableAncestors.map((el) => ({
      el,
      overflow: el.style.overflow,
      overflowY: el.style.overflowY,
    }));
    scrollableAncestors.forEach((el) => {
      el.style.overflow = 'hidden';
      el.style.overflowY = 'hidden';
    });
    return () => {
      originalOverflows.forEach(({ el, overflow, overflowY }) => {
        el.style.overflow = overflow;
        el.style.overflowY = overflowY;
      });
    };
  }, [isSheetOpen, scrollLockElement]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      if (saveAnimTimerRef.current) clearTimeout(saveAnimTimerRef.current);
    };
  }, []);

  const openSheet = useCallback(() => setIsSheetOpen(true), []);

  const handleDesktopSelect = useCallback((e) => {
    if (!compactDesktop || typeof onSelectCard !== "function") return;
    // Let interactive controls keep their own behavior.
    if (e?.target?.closest?.("button, a, input, textarea, select")) return;
    onSelectCard(p);
  }, [compactDesktop, onSelectCard, p]);

  useEffect(() => {
    if (autoOpen) openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeSheet = useCallback((afterClose) => {
    setIsSheetOpen(false);
    afterClose?.();
    onSheetCloseRef.current?.();
  }, []);

  const triggerSave = useCallback(() => {
    const wasSaved = !!saved;
    triggerHaptic();
    onToggleSave?.(p?.id);
    setSaveAnim(true);
    if (saveAnimTimerRef.current) clearTimeout(saveAnimTimerRef.current);
    saveAnimTimerRef.current = setTimeout(() => setSaveAnim(false), 900);
    setBurstAction(wasSaved ? "removed" : "added");
    setBurst(Date.now());
  }, [onToggleSave, p?.id, saved]);

  const handleRecommendationTap = useCallback(() => {
    triggerHaptic();
    recordPropertyRecommendation(p).catch(() => {});
    setLinkPressed(true);
    window.setTimeout(() => setLinkPressed(false), 140);
    showToast("We’ll use this to improve your recommendations");
  }, [p, showToast]);

  const handleShareProperty = useCallback(async () => {
    const propertyId = p?.id;
    if (!propertyId) return;
    triggerHaptic();
    const url = `${window.location.origin}/?property=${encodeURIComponent(String(propertyId))}`;
    const title = p?.title || p?.type || "Property on ImbaLink";
    const text = `${title}\nView on ImbaLink`;
    try {
      if (navigator.share) await navigator.share({ title, text, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast("Property link copied — View on ImbaLink");
      }
    } catch (error) {
      if (error?.name !== "AbortError") console.warn("Property share failed:", error);
    }
  }, [p?.id, p?.title, p?.type, showToast]);

  const handlePhotoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      triggerSave();
    } else {
      lastTapRef.current = now;
    }
  }, [triggerSave]);

  // Only shows "Message sent" once the underlying request is actually
  // persisted and the message actually sent (see App.jsx's requestViewing,
  // which now awaits both and throws if either fails) — previously this
  // set sentFlash immediately on click regardless of outcome.
  const [requestingViewing, setRequestingViewing] = useState(false);
  const handleRequestViewing = useCallback(async () => {
    if (p?.isPaused || viewingRequested || sentFlash || requestingViewing) return;
    setRequestingViewing(true);
    try {
      if (typeof onRequestViewing === "function") {
        await onRequestViewing();
      }
      setSentFlash(true);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      sentTimerRef.current = setTimeout(() => setSentFlash(false), 1800);
    } catch (error) {
      console.warn("Failed to request viewing:", error);
      showToast("Couldn't send your request — please try again.");
    } finally {
      setRequestingViewing(false);
    }
  }, [onRequestViewing, p?.isPaused, sentFlash, viewingRequested, requestingViewing, showToast]);

  const handleOpenLister = useCallback((e) => {
    e.stopPropagation();
    if (typeof onOpenLister === "function") {
      onOpenLister({
        id: p.ownerUserId ?? p.landlordRegistrationId ?? p.id,
        name: p.landlord,
        grad: p.grad,
        verified: p.landlordVerified,
        verificationStatus:
          p.landlordVerificationStatus ||
          (p.landlordVerified === true ? "verified" :
           p.landlordVerified === false ? "pending" : undefined),
        verification:
          p.landlordVerification ||
          (p.landlordVerified === true ? "verified" :
           p.landlordVerified === false ? "pending" : undefined),
      });
    } else {
      onOpen(p);
    }
  }, [onOpen, onOpenLister, p]);

  const listingVerified = p ? isListingVerified(p) : false;
  const linkButtonScale = linkPressed ? 0.9 : 1.1;

  // Shared pointer-press handlers for the "link" (recommendation) button —
  // used identically by both the inline card and the details sheet.
  const linkPressHandlers = {
    onPointerDown: () => setLinkPressed(true),
    onPointerUp: () => setLinkPressed(false),
    onPointerLeave: () => setLinkPressed(false),
    onPointerCancel: () => setLinkPressed(false),
  };

  return {
    burst, burstAction,
    desktopPhotoIndex, nextDesktopPhoto,
    isSheetOpen, openSheet, closeSheet,
    sentFlash, requestingViewing, handleRequestViewing,
    saveAnim, triggerSave,
    linkButtonScale, linkPressHandlers,
    toastVisible, toastText, showToast,
    photos, uploadStatus,
    cardRef,
    handleDesktopSelect,
    handleRecommendationTap,
    handleShareProperty,
    handlePhotoTap,
    handleOpenLister,
    listingVerified,
  };
}
