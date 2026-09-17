import { RotateCcw } from "lucide-react";
import { T } from "../../styles/tokens";
import { useListingUploadStatus } from "../../hooks/useListingUploadStatus";
import { retryListingPhotoUpload } from "../../services/media/listingPhotoUpload";

const PULSE_STYLE = `
@keyframes uploadStripPulse {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}
.upload-strip-indeterminate {
  animation: uploadStripPulse 1.1s ease-in-out infinite;
}
`;

/**
 * Thin progress bar pinned to the top edge of a feed card while its photos
 * are still uploading in the background — same idea as Instagram showing a
 * post immediately with an upload bar over it. Absolutely positioned by the
 * caller (a `position: relative` wrapper around the card); renders nothing
 * once there's nothing to show (no pending upload, or already finished).
 */
export default function UploadProgressStrip({ propertyId, ownerId }) {
  const status = useListingUploadStatus(propertyId);
  if (!status || status.status === "done") return null;

  const pct = status.total > 0 ? Math.round((status.done / status.total) * 100) : null;

  return (
    <div
      className="absolute top-0 left-0 right-0"
      style={{ zIndex: 5, borderTopLeftRadius: "inherit", borderTopRightRadius: "inherit", overflow: "hidden" }}
    >
      <style>{PULSE_STYLE}</style>
      {status.status === "uploading" ? (
        <div style={{ height: 3, background: "rgba(0,0,0,0.18)" }}>
          {pct != null ? (
            <div style={{ height: "100%", width: `${pct}%`, background: T.jacaranda, transition: "width .2s ease" }} />
          ) : (
            <div style={{ height: "100%", width: "35%", background: T.jacaranda }} className="upload-strip-indeterminate" />
          )}
        </div>
      ) : (
        <div
          className="flex items-center justify-between gap-2 px-2.5 py-1.5"
          style={{ background: "rgba(184,61,49,.92)" }}
        >
          <span className="f-body font-semibold" style={{ color: T.paper, fontSize: 10 }}>
            Photo upload failed
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); retryListingPhotoUpload(propertyId, ownerId); }}
            className="flex items-center gap-1 rounded-full px-2 py-1 f-body font-semibold shrink-0"
            style={{ background: T.paper, color: T.brick, fontSize: 9.5 }}
          >
            <RotateCcw size={10} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}
