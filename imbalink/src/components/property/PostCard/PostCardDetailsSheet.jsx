import { Bookmark, Check, Clock3, Link2 as LinkIcon, MapPin, MessageCircle, Share2, X } from "lucide-react";
import { T } from "../../../styles/tokens";
import Avatar from "../../common/Avatar";
import VerifiedBadge from "../../common/VerifiedBadge";
import { formatDaysAgo } from "../../../utils/formatters";

export default function PostCardDetailsSheet({
  isSheetOpen,
  closeSheet,
  handleShareProperty,
  p,
  showDistance,
  listingVerified,
  handleOpenLister,
  saved,
  saveAnim,
  triggerSave,
  linkButtonScale,
  linkPressHandlers,
  handleRecommendationTap,
  viewingRequested,
  onOpenMessage,
  sentFlash,
  requestingViewing,
  handleRequestViewing,
  onOpen,
}) {
  if (!isSheetOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end md:items-center md:justify-center fade"
      onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}
      style={{ background: "rgba(20,32,26,0.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
    >
      <div
        className="w-full md:max-w-lg rise noscroll"
        style={{
          background: T.paper,
          maxHeight: "88vh",
          overflowY: "auto",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: "0 -10px 40px rgba(0,0,0,0.18)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleShareProperty(); }}
          aria-label="Share property"
          title="Share property"
          className="absolute top-3 right-14 flex items-center justify-center rounded-full z-10"
          style={{ width: 36, height: 36, border: `1px solid ${T.line}`, background: T.paperDim, color: T.ink, cursor: "pointer" }}
        >
          <Share2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => closeSheet()}
          aria-label="Close details"
          className="absolute top-3 right-3 flex items-center justify-center rounded-full z-10"
          style={{ width: 36, height: 36, border: `1px solid ${T.line}`, background: T.paperDim, color: T.ink, cursor: "pointer" }}
        >
          <X size={19} />
        </button>

        <div className="p-5 space-y-4">
          {/* Title & location */}
          <div className="flex items-start justify-between pr-12">
            <div>
              <h3 className="text-lg font-bold" style={{ color: T.ink }}>{p.title || ''}</h3>
              <div className="flex items-center gap-1 text-sm" style={{ color: T.ink60 }}>
                <MapPin size={14} />
                {p.suburb || ''}
                {showDistance && <span> · {p.distanceKm} km</span>}
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: T.brick }}>${p.rent || ''}</span>
            <span className="text-sm" style={{ color: T.ink60 }}>/ month</span>
          </div>

          {/* Lister info */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleOpenLister}>
            <Avatar src={p.landlordAvatarUrl} grad={p.grad || ''} letter={(p.landlord?.[0] || '?')} ring={p.postedDaysAgo <= 1} alt={p.landlord ? `${p.landlord} profile picture` : ''} />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold truncate" style={{ color: T.ink }}>{p.landlord || ''}</span>
                <VerifiedBadge status={listingVerified ? "verified" : "pending"} />
              </div>
              <span className="text-xs" style={{ color: T.ink60 }}>Posted {formatDaysAgo(p.postedDaysAgo || 0)}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full text-xs" style={{ background: T.paperDim, color: T.ink60 }}>{p.type}</span>
            <span className="px-3 py-1 rounded-full text-xs" style={{ background: T.paperDim, color: T.ink60 }}>{p.bathroom} bathroom</span>
            {p.furnished && (
              <span className="px-3 py-1 rounded-full text-xs" style={{ background: "color-mix(in srgb, var(--theme-green) 12%, transparent)", color: T.msasa }}>Furnished</span>
            )}
            {p.parking && (
              <span className="px-3 py-1 rounded-full text-xs" style={{ background: T.paperDim, color: T.ink60 }}>Parking</span>
            )}
          </div>

          {/* Description */}
          {(p.desc || p.title) && (
            <div className="rounded-xl px-3 py-2.5" style={{ background: T.paperDim }}>
              {p.title && (
                <div className="f-body font-semibold mb-0.5" style={{ color: T.ink, fontSize: 13 }}>{p.title}</div>
              )}
              <p className="f-body leading-relaxed" style={{ color: T.ink60, fontSize: 12.5 }}>{p.desc || ''}</p>
            </div>
          )}

          {/* Bookmark + link actions */}
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: T.line }}>
            <div className="relative flex items-center gap-2">
              <span className="relative inline-flex" style={{ overflow: "visible" }}>
                <Bookmark
                  size={24}
                  color={saved ? T.jacaranda : T.ink60}
                  fill={saved ? T.jacaranda : "none"}
                  strokeWidth={1.8}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSave();
                  }}
                  className={`cursor-pointer active:scale-90 ${saveAnim ? "interest-pulse" : ""}`}
                />
              </span>
              <span className="text-sm font-semibold" style={{ color: saved ? T.jacaranda : T.ink60 }}>
                {saved ? "Saved" : "Save"}
              </span>
              {saveAnim && (
                <div
                  className="interest-toast-text absolute left-0"
                  style={{
                    top: "100%",
                    marginTop: 3,
                    color: saved ? T.jacaranda : T.ink60,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {saved ? "Saved to collection" : "Removed from collection"}
                </div>
              )}
            </div>

            {/* Link button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleRecommendationTap(); }}
              {...linkPressHandlers}
              className="relative flex items-center justify-center"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              aria-label="Use this property to improve recommendations"
            >
              <span
                style={{
                  display: "inline-flex",
                  transform: `scale(${linkButtonScale})`,
                  transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <LinkIcon size={22} color={T.ink} strokeWidth={1.8} />
              </span>
            </button>
          </div>

          {/* Bottom buttons */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (viewingRequested) {
                  if (typeof onOpenMessage === "function") onOpenMessage(p.id);
                } else {
                  handleRequestViewing();
                }
              }}
              disabled={p?.isPaused || sentFlash || requestingViewing}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-semibold active:scale-95 transition"
              style={{
                background: p?.isPaused ? T.ink60 : (viewingRequested || sentFlash ? T.msasa : T.brick),
                color: T.paper,
                fontSize: 14,
                opacity: p?.isPaused ? 0.75 : (sentFlash || requestingViewing ? 0.9 : 1),
                boxShadow: p?.isPaused || viewingRequested || sentFlash ? "none" : `0 6px 16px -4px ${T.brick}66`,
              }}
            >
              {p?.isPaused ? (
                <>Viewing paused by owner</>
              ) : sentFlash ? (
                <><Check size={16} /> Message sent</>
              ) : requestingViewing ? (
                "Sending…"
              ) : viewingRequested ? (
                <><MessageCircle size={16} /> Open message</>
              ) : (
                <><Clock3 size={16} strokeWidth={2} /> Request a viewing</>
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); closeSheet(() => onOpen(p)); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-semibold active:scale-95 transition"
              style={{ background: T.paperDim, color: T.ink, fontSize: 14, border: `1px solid ${T.line}` }}
            >
              View full details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
