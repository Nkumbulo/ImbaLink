import { recordPropertyView } from '../../core/data/domains/properties.js';
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

import { T } from "../../styles/tokens";
import { getDisplayPhotos } from "../../utils/propertyHelpers";
import { buildContactMethods } from "./PropertyDetail/contactHelpers";
import { useListingUploadStatus } from "../../hooks/useListingUploadStatus";
import { usePropertyReport } from "./PropertyDetail/usePropertyReport";
import { useSimilarProperties } from "./PropertyDetail/useSimilarProperties";
import ReportModal from "./PropertyDetail/ReportModal";
import { useMobilePropertySheet } from "./PropertyDetail/useMobilePropertySheet";
import { usePropertyPhotoViewer } from "./PropertyDetail/usePropertyPhotoViewer";
import PropertyPhotoViewer from "./PropertyDetail/PropertyPhotoViewer";
import { PropertyDetailMobile, PropertyDetailDesktop } from "./PropertyDetailOverlays";


export default function PropertyDetail({
  p,
  initialTab,
  onClose,
  liked,
  saved,
  onToggleLike,
  onToggleSave,
  viewingRequested,
  onRequestViewing,
  onOpenLister,
  onOpenMessage,
  studentMode = false,
  roommateCount = 0,
  onFindRoommate,
  onOpenProperty,
  appMode = "property",
}) {
  // Desktop/tablet gets its own simple centered-card layout (built below)
  // instead of trying to reshape the mobile full-bleed sheet with CSS
  // overrides, which kept leaving mismatched/misplaced pieces behind.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const [tab, setTab] = useState(initialTab === "message" ? "contact" : initialTab || "overview");
  const [burst, setBurst] = useState(0);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [sentFlash, setSentFlash] = useState(false);
  const sentTimerRef = useRef(null);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef(null);

  const [hintVisible, setHintVisible] = useState(true);
  // Report listing — backend/017-listing-reports.sql. State/fetch/submit
  // logic lives in usePropertyReport (PropertyDetail/usePropertyReport.js);
  // destructured with the same variable names the JSX below already uses
  // so nothing else in this component needs to change.
  const {
    showReportModal, setShowReportModal,
    reportReason, setReportReason,
    reportNote, setReportNote,
    reportSubmitting, reportStatus, submitReport,
  } = usePropertyReport(p?.id);

  // Count the view once per open, not once per re-render — recordPropertyView
  // already skips the owner viewing their own listing server-side, so this
  // doesn't need to duplicate that check here.
  useEffect(() => {
    if (!p?.id) return;
    recordPropertyView(p.id);
  }, [p?.id]);

  // Similar properties — see PropertyDetail/useSimilarProperties.js.
  const similarProperties = useSimilarProperties(p);

  const [hintLeaving, setHintLeaving] = useState(false);
  const hintTimers = useRef([]);

  const overlayRef = useRef(null);
  const scrollableRef = useRef(null);
  const panelRef = useRef(null);

  const COLLAPSED_PANEL_TOP = 294;

  useEffect(() => {
    const hideTimer = setTimeout(() => setHintLeaving(true), 4000);
    const removeTimer = setTimeout(() => setHintVisible(false), 4350);
    hintTimers.current.push(hideTimer, removeTimer);
    return () => hintTimers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    return () => {
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const dismissHint = useCallback(() => {
    hintTimers.current.forEach(clearTimeout);
    setHintLeaving(true);
    setTimeout(() => setHintVisible(false), 350);
  }, []);


  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const preventBackgroundScroll = (e) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });

    return () => {
      document.removeEventListener('wheel', preventBackgroundScroll);
      document.removeEventListener('touchmove', preventBackgroundScroll);
    };
  }, []);

  useMobilePropertySheet({
    overlayRef,
    scrollableRef,
    panelRef,
    photoExpanded,
    setPhotoExpanded,
    onClose,
  });


  const [loadedMap, setLoadedMap] = useState({});
  const markLoaded = useCallback((i) => {
    setLoadedMap((m) => (m[i] ? m : { ...m, [i]: true }));
  }, []);

  const photos = getDisplayPhotos(p);
  const uploadStatus = useListingUploadStatus(p?.id);
  const contactMethods = buildContactMethods(p);

  const doubleTap = (e) => {
    e.stopPropagation();
    if (!liked) onToggleLike(p.id);
    setBurst(Date.now());
  };

  const togglePhotoExpand = (e) => {
    e.stopPropagation();
    setPhotoExpanded((v) => !v);
  };

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setPhotoExpanded(true);
  };

  const handlePanelClick = (e) => {
    if (e.target.closest("button, a, input, textarea, [data-no-toggle], .noscroll")) return;
    togglePhotoExpand(e);
  };

  const viewer = usePropertyPhotoViewer({
    photos,
    viewerIndex,
    setViewerIndex,
    onDismissHint: dismissHint,
  });

  const [requestingViewing, setRequestingViewing] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  const handleBottomAction = async () => {
    if (sentFlash || requestingViewing) return;

    if (p?.isPaused) {
      setSendFailed(false);
      setSentFlash(false);
      return;
    }

    if (viewingRequested) {
      onOpenMessage?.(p.id);
      setIsClosing(true);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = setTimeout(() => onClose(), 350);
      return;
    }

    setRequestingViewing(true);
    setSendFailed(false);
    try {
      await onRequestViewing?.();
      setSentFlash(true);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      sentTimerRef.current = setTimeout(() => setSentFlash(false), 1800);
    } catch (error) {
      console.warn("Failed to request viewing:", error);
      setSendFailed(true);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      sentTimerRef.current = setTimeout(() => setSendFailed(false), 2500);
    } finally {
      setRequestingViewing(false);
    }
  };

  const panelProps = {
    p,
    tab,
    setShowMap,
    showMap,
    scrollableRef,
    handleTabChange,
    similarProperties,
    contactMethods,
    studentMode,
    roommateCount,
    onFindRoommate,
    onOpenLister,
    onOpenMessage,
    onOpenProperty,
    viewingRequested,
    handleBottomAction,
    requestingViewing,
    sentFlash,
    sendFailed,
  };

  const overlayStyle = {
    background: T.ink,
    animation: "overlayFadeIn 0.3s ease",
    transition: "transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.35s ease",
    transform: isClosing ? "translateY(100%)" : "translateY(0)",
    opacity: isClosing ? 0 : 1,
  };

  const photoViewer = (
    <PropertyPhotoViewer
      viewerIndex={viewerIndex}
      photos={photos}
      loadedMap={loadedMap}
      markLoaded={markLoaded}
      viewer={viewer}
    />
  );

  const overlayProps = {
    overlayRef,
    photos,
    p,
    viewer,
    photoViewer,
    onClose,
    liked,
    saved,
    onToggleLike,
    onToggleSave,
    reportStatus,
    setShowReportModal,
    panelProps,
  };

  const mobileOverlay = (
    <PropertyDetailMobile
      {...overlayProps}
      overlayStyle={overlayStyle}
      doubleTap={doubleTap}
      burst={burst}
      hintVisible={hintVisible}
      photoExpanded={photoExpanded}
      viewerIndex={viewerIndex}
      hintLeaving={hintLeaving}
      panelRef={panelRef}
      handlePanelClick={handlePanelClick}
      togglePhotoExpand={togglePhotoExpand}
    />
  );

  const desktopOverlay = (
    <PropertyDetailDesktop
      {...overlayProps}
      uploadStatus={uploadStatus}
    />
  );
  return createPortal(
    <>
      {isDesktop ? desktopOverlay : mobileOverlay}
      <ReportModal
        showReportModal={showReportModal}
        setShowReportModal={setShowReportModal}
        reportReason={reportReason}
        setReportReason={setReportReason}
        reportNote={reportNote}
        setReportNote={setReportNote}
        reportSubmitting={reportSubmitting}
        submitReport={submitReport}
      />
    </>,
    document.body
  );
}
