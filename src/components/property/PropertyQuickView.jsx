import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Bookmark, Link as LinkIcon, Check, X, Clock3, MessageCircle } from "lucide-react";
import { T } from "../../styles/tokens";
import Avatar from "../common/Avatar";
import VerifiedBadge from "../common/VerifiedBadge";
import { formatDaysAgo } from "../../utils/formatters";
import { recordPropertyRecommendation } from "../../core/data/domains/properties.js";

const isListingVerified = (p) =>
  p?.verification === "verified" || p?.verified === true || p?.verificationStatus === "verified";

// Desktop/tablet equivalent of the quick-details sheet PostCard opens on
// mobile when you tap a card: a compact summary over a dimmed, blurred
// backdrop, with a "View full details" button that hands off to the full
// PropertyDetail view.
export default function PropertyQuickView({
  p,
  liked,
  saved,
  onToggleLike,
  onToggleSave,
  onOpenLister,
  viewingRequested,
  onRequestViewing,
  onSend,
  onOpenMessage,
  onClose,
  onViewFullDetails,
  showDistance = true,
}) {
  const [likeAnim, setLikeAnim] = useState(false);
  const likeAnimTimerRef = useRef(null);
  const [linkPressed, setLinkPressed] = useState(false);
  const [linkMorphed, setLinkMorphed] = useState(false);
  const morphTimerRef = useRef(null);
  const [sentFlash, setSentFlash] = useState(false);
  const [requestingViewing, setRequestingViewing] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const sentTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (likeAnimTimerRef.current) clearTimeout(likeAnimTimerRef.current);
      if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    };
  }, []);

  const triggerLike = useCallback(() => {
    onToggleLike(p?.id);
    setLikeAnim(true);
    if (likeAnimTimerRef.current) clearTimeout(likeAnimTimerRef.current);
    likeAnimTimerRef.current = setTimeout(() => setLikeAnim(false), 1600);
  }, [onToggleLike, p?.id]);

  const handleLinkTap = useCallback(() => {
    recordPropertyRecommendation(p).catch(() => {});
    if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    setLinkMorphed(true);
    morphTimerRef.current = setTimeout(() => setLinkMorphed(false), 1800);
  }, [p]);

  const handleRequestViewing = useCallback(async () => {
    if (viewingRequested || sentFlash || requestingViewing) return;
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
      setSendFailed(true);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      sentTimerRef.current = setTimeout(() => setSendFailed(false), 2500);
    } finally {
      setRequestingViewing(false);
    }
  }, [onRequestViewing, sentFlash, viewingRequested, requestingViewing]);

  const handleOpenLister = useCallback(() => {
    if (typeof onOpenLister !== "function") return;
    onOpenLister({
      id: p.ownerUserId ?? p.landlordRegistrationId ?? p.id,
      name: p.landlord,
      grad: p.grad,
      verified: p.landlordVerified,
    });
  }, [onOpenLister, p]);

  if (!p) return null;

  const listingVerified = isListingVerified(p);
  const linkButtonScale = linkPressed ? 0.9 : 1.1;
  const linkIconColor = saved ? T.jacaranda : T.ink;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center fade"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ background: "rgba(20,32,26,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    >
      <style>{`
        @keyframes interestPulse {
          0% { transform: scale(1); }
          30% { transform: scale(1.35); }
          60% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .interest-pulse { animation: interestPulse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
      <div
        className="w-full max-w-lg rise noscroll"
        style={{
          background: T.paper,
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 28,
          boxShadow: "0 24px 64px rgba(20,32,26,0.35)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close details"
          className="absolute top-3 right-3 flex items-center justify-center rounded-full z-10"
          style={{ width: 36, height: 36, border: `1px solid ${T.line}`, background: T.paperDim, color: T.ink, cursor: "pointer" }}
        >
          <X size={19} />
        </button>

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between pr-12">
            <div>
              <h3 className="text-lg font-bold" style={{ color: T.ink }}>{p.title || ""}</h3>
              <div className="flex items-center gap-1 text-sm" style={{ color: T.ink60 }}>
                <MapPin size={14} />
                {p.suburb || ""}
                {showDistance && <span> · {p.distanceKm} km</span>}
              </div>
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: T.brick }}>${p.rent || ""}</span>
            <span className="text-sm" style={{ color: T.ink60 }}>/ month</span>
          </div>

          <div className="flex items-center gap-2 cursor-pointer" onClick={handleOpenLister}>
            <Avatar src={p.landlordAvatarUrl} grad={p.grad || ""} letter={(p.landlord?.[0] || "?")} ring={p.postedDaysAgo <= 1} alt={p.landlord ? `${p.landlord} profile picture` : ""} />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold truncate" style={{ color: T.ink }}>{p.landlord || ""}</span>
                <VerifiedBadge status={listingVerified ? "verified" : "pending"} />
              </div>
              <span className="text-xs" style={{ color: T.ink60 }}>Posted {formatDaysAgo(p.postedDaysAgo || 0)}</span>
            </div>
          </div>

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

          {(p.desc || p.title) && (
            <div className="rounded-xl px-3 py-2.5" style={{ background: T.paperDim }}>
              {p.title && (
                <div className="f-body font-semibold mb-0.5" style={{ color: T.ink, fontSize: 13 }}>{p.title}</div>
              )}
              <p className="f-body leading-relaxed" style={{ color: T.ink60, fontSize: 12.5 }}>{p.desc || ""}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: T.line }}>
            <div className="relative flex items-center gap-2">
              <span className="relative inline-flex" style={{ overflow: "visible" }}>
                <Bookmark
                  size={24}
                  color={liked ? T.msasa : T.ink60}
                  fill={liked ? T.msasa : "none"}
                  strokeWidth={1.8}
                  onClick={(e) => { e.stopPropagation(); triggerLike(); }}
                  className={`cursor-pointer active:scale-90 ${likeAnim ? "interest-pulse" : ""}`}
                />
              </span>
              <span className="text-sm" style={{ color: T.ink60 }}>
                {(Number(p?.saveCount) || 0)} interested
              </span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); handleLinkTap(); }}
              onPointerDown={() => setLinkPressed(true)}
              onPointerUp={() => setLinkPressed(false)}
              onPointerLeave={() => setLinkPressed(false)}
              onPointerCancel={() => setLinkPressed(false)}
              className="relative flex items-center justify-center"
              style={{ WebkitTapHighlightColor: "transparent" }}
              aria-label="Use this property to improve recommendations"
            >
              <span
                style={{
                  display: "inline-flex",
                  transform: `scale(${linkButtonScale})`,
                  transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                {linkMorphed ? (
                  <Check key="check" size={22} color={T.msasa} strokeWidth={2.4} className="pop" />
                ) : (
                  <LinkIcon key="link" size={22} color={linkIconColor} strokeWidth={1.8} />
                )}
              </span>
            </button>
          </div>

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
              disabled={sentFlash || requestingViewing}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-semibold active:scale-95 transition"
              style={{
                background: viewingRequested || sentFlash ? T.msasa : T.brick,
                color: T.paper,
                fontSize: 14,
                opacity: sentFlash || requestingViewing ? 0.9 : 1,
                boxShadow: viewingRequested || sentFlash ? "none" : `0 6px 16px -4px ${T.brick}66`,
              }}
            >
              {sentFlash ? (
                <><Check size={16} /> Message sent</>
              ) : requestingViewing ? (
                "Sending…"
              ) : sendFailed ? (
                "Couldn't send — retry"
              ) : viewingRequested ? (
                <><MessageCircle size={16} /> Open message</>
              ) : (
                <><Clock3 size={16} strokeWidth={2} /> Request a viewing</>
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onViewFullDetails?.(p); }}
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
