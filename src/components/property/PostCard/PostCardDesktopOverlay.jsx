import { Bookmark, ChevronRight, Link2 as LinkIcon, MapPin, Share2, X, ImageOff, Loader2 } from "lucide-react";
import { T } from "../../../styles/tokens";
import { PHOTO_PENDING } from "../../../utils/propertyHelpers";

export default function PostCardDesktopOverlay({
  p,
  desktopSelected,
  photos,
  desktopPhotoIndex,
  uploadStatus,
  saved,
  onToggleSave,
  handleRecommendationTap,
  handleShareProperty,
  onSelectCard,
  nextDesktopPhoto,
  onOpen,
}) {
  return (
    <div
      className={`desktop-detail-overlay ${desktopSelected ? "is-open" : ""}`}
      aria-hidden={!desktopSelected}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="h-full flex flex-col p-2.5" style={{ minHeight: 0 }}>
        <div
          className="relative shrink-0 overflow-hidden rounded-xl"
          style={{ height: "42%", minHeight: 108, maxHeight: 170, background: T.paperDim }}
        >
          {(() => {
            const overlaySrc = photos[desktopPhotoIndex] || photos[0] || "";
            if (overlaySrc === PHOTO_PENDING) {
              return (
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-1"
                  style={{ color: T.ink60 }}
                >
                  {uploadStatus?.status === "uploading" ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      <span className="f-body" style={{ fontSize: 9.5 }}>Uploading photo…</span>
                    </>
                  ) : (
                    <>
                      <ImageOff size={18} />
                      <span className="f-body" style={{ fontSize: 9.5 }}>
                        {uploadStatus?.status === "failed" ? "Upload failed" : "No photo yet"}
                      </span>
                    </>
                  )}
                </div>
              );
            }
            return (
              <img
                src={overlaySrc}
                alt={p.title || "Property"}
                loading="lazy"
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            );
          })()}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(20,32,26,0.48), transparent 55%)" }}
          />
          <div className="absolute left-2 bottom-2 rounded-full px-2 py-1" style={{ background: T.paperDim, color: T.ink60, fontSize: 10, fontWeight: 700 }}>
            {p.rent != null ? `$${p.rent}` : "Price on request"}
          </div>
          <div className="absolute right-2 top-2 flex items-center gap-1.5" style={{ zIndex: 4 }}>
            <button
              type="button"
              aria-label={saved ? "Remove from saved" : "Save property"}
              onClick={(e) => { e.stopPropagation(); onToggleSave?.(p.id); }}
              className="flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: "rgba(251,248,240,0.94)", color: saved ? T.jacaranda : T.ink, border: `1px solid ${T.line}` }}
            >
              <Bookmark size={14} fill={saved ? T.jacaranda : "none"} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              aria-label="Use this property to improve recommendations"
              onClick={(e) => { e.stopPropagation(); handleRecommendationTap(); }}
              className="flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: "rgba(251,248,240,0.94)", color: T.ink, border: `1px solid ${T.line}` }}
            >
              <LinkIcon size={14} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              aria-label="Share property"
              title="Share property"
              onClick={(e) => { e.stopPropagation(); handleShareProperty(); }}
              className="flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: "rgba(251,248,240,0.94)", color: T.ink, border: `1px solid ${T.line}` }}
            >
              <Share2 size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Close property details"
              onClick={(e) => { e.stopPropagation(); onSelectCard?.(p); }}
              className="flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: "rgba(251,248,240,0.94)", color: T.ink, border: `1px solid ${T.line}` }}
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              aria-label="Next property photo"
              onClick={nextDesktopPhoto}
              className="absolute right-2 bottom-2 flex items-center justify-center rounded-full"
              style={{ width: 30, height: 30, background: "rgba(251,248,240,0.94)", color: T.ink, border: `1px solid ${T.line}`, zIndex: 4 }}
            >
              <ChevronRight size={17} strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 flex flex-col pt-2">
          <div className="flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 13 }}>
                {p.title || p.type || "Property details"}
              </div>
              <div className="flex items-center gap-1 mt-0.5" style={{ color: T.ink60, fontSize: 10.5 }}>
                <MapPin size={10} />
                <span className="truncate">{p.suburb || p.city || "Location unavailable"}</span>
              </div>
            </div>
          </div>

          <div className="mt-1.5 rounded-xl px-2.5 py-2 shrink-0" style={{ background: T.paperDim, border: `1px solid ${T.line}` }}>
            <p
              className="f-body"
              style={{
                color: T.ink60, fontSize: 10.5, lineHeight: 1.4, margin: 0,
                display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden"
              }}
            >
              {p.desc || "No description provided."}
            </p>
          </div>

          {/* Keep the compact overlay amenity row fixed-height and single-line.
              Overflow is clipped instead of expanding the overlay frame. */}
          <div
            className="flex items-center gap-1 mt-1.5 shrink-0"
            style={{ minWidth: 0, maxWidth: "100%", height: 21, overflow: "hidden" }}
          >
            {p.rooms != null && <span className="f-body px-2 py-0.5 rounded-full" style={{ background: T.paperDim, color: T.ink60, fontSize: 9.5, flex: "0 0 auto", whiteSpace: "nowrap" }}>{p.rooms} room{Number(p.rooms) === 1 ? "" : "s"}</span>}
            {p.bathroom && <span className="f-body px-2 py-0.5 rounded-full" style={{ background: T.paperDim, color: T.ink60, fontSize: 9.5, flex: "0 0 auto", whiteSpace: "nowrap" }}>{p.bathroom} bath</span>}
            {p.furnished && <span className="f-body px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--theme-green) 12%, transparent)", color: T.msasa, fontSize: 9.5, flex: "0 0 auto", whiteSpace: "nowrap" }}>Furnished</span>}
            {p.parking && <span className="f-body px-2 py-0.5 rounded-full" style={{ background: T.paperDim, color: T.ink60, fontSize: 9.5, flex: "0 0 auto", whiteSpace: "nowrap" }}>Parking</span>}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onOpen === "function") onOpen(p);
            }}
            className="mt-auto w-full flex items-center justify-center rounded-full f-body font-semibold"
            style={{
              background: T.ink,
              color: T.paper,
              fontSize: 10.5,
              padding: "7px 10px",
              border: "none",
              cursor: "pointer",
            }}
          >
            View more details
          </button>
        </div>
      </div>
    </div>
  );
}
