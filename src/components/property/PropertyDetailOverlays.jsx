import { ChevronLeft, Heart, Bookmark, Maximize2, Minimize2, X, Share2, Flag, ZoomIn, ImageOff, Loader2 } from "lucide-react";
import { T } from "../../styles/tokens";
import VerifiedBadge from "../common/VerifiedBadge";
import PhotoCarousel from "../common/PhotoCarousel";
import { PHOTO_PENDING } from "../../utils/propertyHelpers";
import { shareProperty, isListingVerified } from "./PropertyDetail/contactHelpers";
import PropertyDetailPanel, { DETAIL_BG, DETAIL_BORDER } from "./PropertyDetailPanel";
import { TAP_HINT_STYLES } from "./PropertyDetail/animationStyles";

function FloatBtn({ onClick, children, ...props }) {
  return <button onClick={onClick} className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: "rgba(20,32,26,0.55)", backdropFilter: "blur(8px)" }} {...props}>{children}</button>;
}

function PanelBtn({ onClick, children, ...props }) {
  return <button onClick={onClick} className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: T.paperDim }} {...props}>{children}</button>;
}

export function PropertyDetailMobile({
  overlayRef, overlayStyle, photos, p, viewer, photoViewer, doubleTap, burst,
  hintVisible, photoExpanded, viewerIndex, hintLeaving, onClose, liked, saved,
  onToggleLike, onToggleSave, panelRef, handlePanelClick, togglePhotoExpand,
  reportStatus, setShowReportModal, panelProps,
}) {
  const COLLAPSED_PANEL_TOP = 294;
  return (
    <div ref={overlayRef} className="fixed inset-0 z-[1000] overlay-fade-in" style={overlayStyle}>
      {TAP_HINT_STYLES}
      <div className="absolute inset-0 detail-photo-layer" style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden", zIndex: 0, height: COLLAPSED_PANEL_TOP }} onClick={viewer.openViewer}>
        <PhotoCarousel photos={photos} height={COLLAPSED_PANEL_TOP} propertyId={p?.id} onDoubleTap={doubleTap} burstKey={burst} badge={<VerifiedBadge status={isListingVerified(p) ? "verified" : "pending"} />} showDots={false} preloadAdjacent={false} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 24, background: `linear-gradient(to bottom, transparent, ${T.paper})`, zIndex: 5, pointerEvents: "none" }} />
        {hintVisible && !photoExpanded && viewerIndex === null && <div className={`absolute tap-hint-wrap${hintLeaving ? " leaving" : ""}`} style={{ top: 96, left: "50%", zIndex: 15, pointerEvents: "none" }}><div className="flex items-center gap-2" style={{ padding: "6px 14px 6px 6px", borderRadius: 999, background: "rgba(20,32,26,0.55)", backdropFilter: "blur(8px)" }}><span className="tap-hint-ring"><ZoomIn size={13} color={T.white} /></span><span className="f-body" style={{ color: T.white, fontSize: 11.5, fontWeight: 500 }}>Tap photo to view</span></div></div>}
      </div>
      <div className="absolute top-3 left-3 flex items-center gap-2" style={{ zIndex: 20 }}><FloatBtn onClick={onClose}><ChevronLeft size={18} color={T.white} /></FloatBtn></div>
      {!photoExpanded && <div className="absolute flex flex-col gap-2.5" style={{ top: 155, right: 12, transform: "translateY(-50%)", zIndex: 20 }}><FloatBtn onClick={() => onToggleLike(p.id)}><Heart size={16} color={liked ? T.brick : T.white} fill={liked ? T.brick : "none"} strokeWidth={2} /></FloatBtn><FloatBtn onClick={() => onToggleSave(p.id)}><Bookmark size={15} color={T.white} fill={saved ? T.white : "none"} strokeWidth={2} /></FloatBtn></div>}
      <div ref={panelRef} className="absolute left-0 right-0 bottom-0 flex flex-col min-h-0 panel-slide-up" style={{ top: photoExpanded ? 0 : COLLAPSED_PANEL_TOP, background: DETAIL_BG, borderTopLeftRadius: 0, borderTopRightRadius: 0, boxShadow: "0 -8px 24px rgba(0,0,0,0.18)", zIndex: 10, transition: "top 420ms cubic-bezier(0.22, 1, 0.36, 1)", animation: "panelSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)", willChange: "top" }} onClick={handlePanelClick}>
        <div className="w-9 h-1 rounded-full mx-auto mt-2.5" style={{ background: DETAIL_BORDER }} />
        <div className="flex items-center justify-end gap-2 px-4 pt-2 pb-1" data-no-toggle>
          <div style={{ opacity: photoExpanded ? 1 : 0, pointerEvents: photoExpanded ? "auto" : "none", transition: "opacity 0.2s ease", display: "flex", gap: 8 }}>
            <PanelBtn onClick={() => onToggleLike(p.id)}><Heart size={16} color={liked ? T.brick : T.ink} fill={liked ? T.brick : "none"} strokeWidth={2} /></PanelBtn>
            <PanelBtn onClick={() => onToggleSave(p.id)}><Bookmark size={15} color={saved ? T.jacaranda : T.ink} fill={saved ? T.jacaranda : "none"} strokeWidth={2} /></PanelBtn>
          </div>
          <PanelBtn onClick={togglePhotoExpand}>{photoExpanded ? <Minimize2 size={16} color={T.ink} /> : <Maximize2 size={16} color={T.ink} />}</PanelBtn>
          <PanelBtn onClick={() => shareProperty(p)} aria-label="Share property"><Share2 size={17} color={T.ink} /></PanelBtn>
          <PanelBtn onClick={() => (reportStatus ? null : setShowReportModal(true))} aria-label={reportStatus ? "Already reported" : "Report listing"}><Flag size={16} color={reportStatus ? T.brick : T.ink} fill={reportStatus ? T.brick : "none"} /></PanelBtn>
          <PanelBtn onClick={onClose}><X size={18} color={T.ink} /></PanelBtn>
        </div>
        <PropertyDetailPanel {...panelProps} />
      </div>
      {photoViewer}
    </div>
  );
}

export function PropertyDetailDesktop({
  overlayRef, photos, p, viewer, photoViewer, onClose, liked, saved, onToggleLike,
  onToggleSave, uploadStatus, reportStatus, setShowReportModal, panelProps,
}) {
  return (
    <div ref={overlayRef} className="fixed inset-0 z-[1000] flex items-center justify-center desktop-overlay-fade" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ background: "rgba(20,32,26,0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", padding: 24, boxSizing: "border-box" }}>
      {TAP_HINT_STYLES}
      <div className="desktop-card-in" style={{ width: "min(900px, calc(100vw - 48px))", height: "min(520px, calc(100vh - 48px))", borderRadius: 32, overflow: "hidden", background: DETAIL_BG, boxShadow: "0 28px 80px rgba(20,32,26,0.30)", display: "flex", position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <div className="desktop-photo-fade-in" style={{ position: "relative", width: "58%", height: "100%", flexShrink: 0, background: "#111" }}>
          <img src={photos[0]} alt={p.title || "Property"} draggable={false} onClick={viewer.openViewer} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: photos[0] === PHOTO_PENDING ? "none" : "block", cursor: "pointer" }} />
          {photos[0] === PHOTO_PENDING && <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "rgba(255,255,255,0.7)" }}>{uploadStatus?.status === "uploading" ? <><Loader2 size={28} className="spin" /><span className="f-body" style={{ fontSize: 12 }}>Uploading photo…</span></> : <><ImageOff size={28} /><span className="f-body" style={{ fontSize: 12 }}>{uploadStatus?.status === "failed" ? "Photo upload failed" : "No photo yet"}</span></>}</div>}
          <div style={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}><VerifiedBadge status={isListingVerified(p) ? "verified" : "pending"} /></div>
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 2, display: "flex", gap: 8 }}><FloatBtn onClick={onClose}><ChevronLeft size={18} color={T.white} /></FloatBtn><FloatBtn onClick={() => shareProperty(p)} aria-label="Share property"><Share2 size={17} color={T.white} /></FloatBtn><FloatBtn onClick={() => (reportStatus ? null : setShowReportModal(true))} aria-label={reportStatus ? "Already reported" : "Report listing"}><Flag size={16} color={reportStatus ? T.brick : T.white} fill={reportStatus ? T.brick : "none"} /></FloatBtn></div>
          <div style={{ position: "absolute", top: "42%", right: 16, transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 10, zIndex: 2 }}><FloatBtn onClick={() => onToggleLike(p.id)}><Heart size={16} color={liked ? T.brick : T.white} fill={liked ? T.brick : "none"} strokeWidth={2} /></FloatBtn><FloatBtn onClick={() => onToggleSave(p.id)}><Bookmark size={15} color={T.white} fill={saved ? T.white : "none"} strokeWidth={2} /></FloatBtn></div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}><PropertyDetailPanel {...panelProps} /></div>
      </div>
      {photoViewer}
    </div>
  );
}
