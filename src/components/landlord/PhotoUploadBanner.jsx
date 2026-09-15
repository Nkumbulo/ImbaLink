import { useEffect } from "react";
import { Loader2, ImageOff, RotateCcw, X } from "lucide-react";
import { T } from "../../styles/tokens";
import { useAllListingUploadStatuses } from "../../hooks/useListingUploadStatus";
import { retryListingPhotoUpload, clearUploadStatus } from "../../services/media/listingPhotoUpload";

/**
 * Shows one row per listing currently uploading photos in the background,
 * or whose photo upload failed and is waiting on a retry. Lives at the
 * dashboard level (not inside ListingForm) because the upload keeps
 * running after the form/modal has already closed.
 */
export default function PhotoUploadBanner({ listings, ownerId }) {
  const statuses = useAllListingUploadStatuses();
  const rows = (listings || [])
    .map((listing) => {
      const status = statuses.get(String(listing.id));
      return status ? { listing, status } : null;
    })
    .filter(Boolean);

  // Auto-dismiss a completed row a couple seconds after it finishes,
  // rather than leaving a stale "Photos uploaded" row sitting around.
  useEffect(() => {
    const doneIds = rows.filter((r) => r.status.status === "done").map((r) => r.listing.id);
    if (!doneIds.length) return;
    const timer = window.setTimeout(() => {
      doneIds.forEach((id) => clearUploadStatus(id));
    }, 2500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => `${r.listing.id}:${r.status.status}`).join(",")]);

  if (!rows.length) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {rows.map(({ listing, status }) => (
        <div
          key={listing.id}
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ background: T.paperDim, border: `1px solid ${T.line}` }}
        >
          {status.status === "failed" ? (
            <ImageOff size={18} style={{ color: T.brick, flexShrink: 0 }} />
          ) : status.status === "done" ? (
            <div style={{ width: 18, height: 18, flexShrink: 0 }} />
          ) : (
            <Loader2 size={18} className="spin" style={{ color: T.jacaranda, flexShrink: 0 }} />
          )}

          <div className="flex-1 min-w-0">
            <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 11.5 }}>
              {listing.title || "Your listing"}
            </div>
            <div className="f-body" style={{ color: T.ink60, fontSize: 10 }}>
              {status.status === "uploading" && (
                status.total > 0
                  ? `Uploading photos ${status.done}/${status.total}…`
                  : "Uploading photos…"
              )}
              {status.status === "failed" && (status.error || "Photo upload failed.")}
              {status.status === "done" && "Photos uploaded."}
            </div>
            {status.status === "uploading" && status.total > 0 && (
              <div
                className="mt-1.5 rounded-full overflow-hidden"
                style={{ height: 4, background: T.line }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round((status.done / status.total) * 100)}%`,
                    background: T.jacaranda,
                    transition: "width .2s ease",
                  }}
                />
              </div>
            )}
          </div>

          {status.status === "failed" && (
            <button
              type="button"
              onClick={() => retryListingPhotoUpload(listing.id, ownerId)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 f-body font-semibold shrink-0"
              style={{ background: T.brick, color: T.paper, fontSize: 10 }}
            >
              <RotateCcw size={12} /> Retry
            </button>
          )}
          {status.status !== "uploading" && (
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => clearUploadStatus(listing.id)}
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: T.paper }}
            >
              <X size={12} style={{ color: T.ink60 }} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
