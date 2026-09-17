import { Users, ImageOff, Loader2 } from "lucide-react";
import { T } from "../../styles/tokens";
import VerifiedBadge from "../common/VerifiedBadge";
import { getDisplayPhotos, PHOTO_PENDING } from "../../utils/propertyHelpers";
import { useListingUploadStatus } from "../../hooks/useListingUploadStatus";

export default function GridTile({
  p,
  onOpen,
  onSuburbClick,
  activeSuburb,
  compactDesktop = false,
  showRoommateAction = false,
  roommateCount,
  onFindRoommate,
}) {
  const photos = getDisplayPhotos(p);
  const uploadStatus = useListingUploadStatus(p.id);

  const isSuburbActive = activeSuburb && activeSuburb === p.suburb;

  return (
    <button
      onClick={() => onOpen(p)}
      className="rise text-left rounded-2xl overflow-hidden active:scale-95 transition-transform"
      style={{
        background: T.paper,
        border: `1px solid ${T.line}`,
        width: "100%",      // fill the grid cell
        minWidth: 0,        // allow shrinking inside flexible layouts
        display: "block",   // block-level for consistent layout
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{ background: T.paperDim, aspectRatio: compactDesktop ? "4 / 3" : "4 / 5" }}
      >
        {photos[0] === PHOTO_PENDING ? (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1"
            style={{ color: T.ink60 }}
          >
            {uploadStatus?.status === "uploading" ? (
              <>
                <Loader2 size={18} className="spin" />
                <span className="f-body" style={{ fontSize: 9 }}>Uploading photo…</span>
              </>
            ) : (
              <>
                <ImageOff size={18} />
                <span className="f-body" style={{ fontSize: 9 }}>
                  {uploadStatus?.status === "failed" ? "Photo upload failed" : "No photo yet"}
                </span>
              </>
            )}
          </div>
        ) : (
          <img
            src={photos[0]}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="absolute top-2 right-2">
          <VerifiedBadge status={p.verification} />
        </div>
        {showRoommateAction && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onFindRoommate?.(p);
            }}
            className="f-body font-semibold truncate cursor-pointer"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: T.jacaranda,
              color: T.paper,
              fontSize: 9.5,
              padding: "4px 8px",
              borderRadius: 999,
            }}
          >
            <Users size={11} /> {roommateCount > 0 ? `${roommateCount} sharing` : "Find a Roommate"}
          </span>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-1">
          <span
            className="f-mono font-semibold px-2 py-1 rounded-full shrink-0"
            style={{
              background: "rgba(20,32,26,0.82)",
              color: T.white,
              fontSize: 11,
            }}
          >
            ${p.rent}
            <span className="opacity-70">/mo</span>
          </span>

          <span
            onClick={(e) => {
              e.stopPropagation();
              if (onSuburbClick) {
                onSuburbClick(p.suburb);
              } else {
                onOpen(p);
              }
            }}
            className="f-body truncate px-2 py-1 rounded-full cursor-pointer"
            style={{
              background: isSuburbActive
                ? T.jacaranda
                : "rgba(251,248,240,0.92)",
              color: isSuburbActive ? T.paper : T.ink,
              fontSize: 9.5,
              transition: "background 0.2s ease",
            }}
          >
            {p.suburb}
          </span>
        </div>
      </div>
      <div className="px-2.5 pt-2 pb-2.5">
        <div
          className="f-body font-semibold truncate"
          style={{ color: T.ink, fontSize: 12 }}
          title={p.title}   // show full title on hover
        >
          {p.title}
        </div>
        <div
          className="f-body mt-0.5 truncate"
          style={{ color: T.ink60, fontSize: 10.5 }}
        >
          {p.type} · {p.rooms}rm · {p.bathroom}
        </div>
      </div>
    </button>
  );
}