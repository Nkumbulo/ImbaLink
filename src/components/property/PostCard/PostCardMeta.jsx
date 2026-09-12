import { Bookmark, Link2 as LinkIcon, Share2, Users } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function PostCardMeta({
  p,
  compactDesktop,
  saved,
  saveAnim,
  triggerSave,
  linkButtonScale,
  linkPressHandlers,
  handleRecommendationTap,
  handleShareProperty,
  showRoommateAction,
  roommateCount,
  onFindRoommate,
}) {
  return (
    <>
      {p.title && (
        <div className={`f-body font-semibold ${compactDesktop ? "mb-1" : "mb-2"}`} style={{ color: T.ink, fontSize: 13 }}>
          {p.title}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="relative flex items-center gap-2">
          <button
            onClick={triggerSave}
            className="relative active:scale-90 transition-transform"
            style={{ overflow: "visible" }}
            aria-label={saved ? "Remove from saved" : "Save property"}
          >
            <Bookmark
              size={compactDesktop ? 20 : 23}
              color={saved ? T.jacaranda : T.ink}
              fill={saved ? T.jacaranda : "none"}
              strokeWidth={1.8}
              className={saveAnim ? "interest-pulse" : ""}
            />
          </button>
          <span className="f-body font-semibold" style={{ color: T.ink, fontSize: compactDesktop ? 11 : 12 }}>
            {saved ? "Saved" : "Save"}
          </span>
        </div>

        {/* Desktop actions: keep Link and Share together as a clean button group */}
        <div className="flex items-center gap-2" style={{ marginLeft: "auto" }}>
          {/* Link icon (save link) */}
          <button
            onClick={handleRecommendationTap}
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
              <LinkIcon size={compactDesktop ? 19 : 21} color={T.ink} strokeWidth={1.8} />
            </span>
          </button>

          {compactDesktop && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleShareProperty(); }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 30,
                height: 30,
                flex: "0 0 auto",
                background: T.paperDim,
                color: T.ink,
                border: `1px solid ${T.line}`,
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
              aria-label="Share property"
              title="Share property"
            >
              <Share2 size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Tags / amenities. On compact desktop cards these stay on one fixed row
          so variable amenity counts can never change the card height. */}
      <div
        className={`flex items-center ${compactDesktop ? "gap-1 mt-1.5" : "flex-wrap gap-1.5 mt-2"}`}
        style={compactDesktop ? { minWidth: 0, maxWidth: "100%", overflow: "hidden", height: 22 } : undefined}
      >
        <span className="f-body font-medium px-2.5 py-1 rounded-full" style={{ background: T.paperDim, color: T.ink60, fontSize: compactDesktop ? 9.5 : 10.5, flex: compactDesktop ? "0 0 auto" : undefined, whiteSpace: "nowrap" }}>
          {p.type}
        </span>
        {!compactDesktop && (
          <span className="f-body font-medium px-2.5 py-1 rounded-full" style={{ background: T.paperDim, color: T.ink60, fontSize: 10.5 }}>
            {p.bathroom} bathroom
          </span>
        )}
        {!compactDesktop && p.furnished && (
          <span className="f-body font-medium px-2.5 py-1 rounded-full" style={{ background: "color-mix(in srgb, var(--theme-green) 12%, transparent)", color: T.msasa, fontSize: 10.5 }}>
            Furnished
          </span>
        )}
        {!compactDesktop && p.parking && (
          <span className="f-body font-medium px-2.5 py-1 rounded-full" style={{ background: T.paperDim, color: T.ink60, fontSize: 10.5 }}>
            Parking
          </span>
        )}
      </div>

      {showRoommateAction && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFindRoommate?.(p); }}
          className={`w-full flex items-center justify-center gap-1.5 rounded-full f-body font-semibold active:scale-95 transition-transform ${compactDesktop ? "mt-1.5" : "mt-2"}`}
          style={{
            background: "rgba(110,99,184,.1)",
            color: T.jacarandaDeep,
            fontSize: compactDesktop ? 10.5 : 11.5,
            padding: compactDesktop ? "7px 10px" : "8px 10px",
            border: "1px solid rgba(110,99,184,.25)",
          }}
        >
          <Users size={13} /> {roommateCount > 0 ? `${roommateCount} student${roommateCount === 1 ? "" : "s"} sharing — Find a Roommate` : "Find a Roommate"}
        </button>
      )}
    </>
  );
}
