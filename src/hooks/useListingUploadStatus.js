import { useEffect, useState } from "react";
import { subscribeUploadStatus, getUploadStatus } from "../services/media/listingPhotoUpload";

// Live status for one listing's background photo upload:
// { status: 'uploading'|'done'|'failed', total, done, error } or null when
// there's nothing in progress/failed for this property (e.g. it never had
// pending photos, or upload already finished and was cleared).
export function useListingUploadStatus(propertyId) {
  const [status, setStatus] = useState(() => getUploadStatus(propertyId));

  useEffect(() => {
    setStatus(getUploadStatus(propertyId));
    return subscribeUploadStatus((all) => {
      setStatus(all.get(String(propertyId)) || null);
    });
  }, [propertyId]);

  return status;
}

// All in-progress/failed uploads at once, for a dashboard-level banner.
export function useAllListingUploadStatuses() {
  const [all, setAll] = useState(() => new Map());
  useEffect(() => subscribeUploadStatus(setAll), []);
  return all;
}
