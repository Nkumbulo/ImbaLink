import { backend } from "../../../application/backend/index.js";
import { useEffect, useState } from "react";
// Report listing — backend/017-listing-reports.sql. `reportStatus` null
// means "not yet reported (or unknown)"; a string means an open/reviewing
// report already exists, so the trigger button switches to "Reported"
// instead of opening the form again.
export function usePropertyReport(propertyId) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!propertyId) return undefined;
    backend.reportRepository.getMyReportForListing(propertyId).then((existing) => {
      if (!cancelled) setReportStatus(existing ? existing.status : null);
    });
    return () => { cancelled = true; };
  }, [propertyId]);

  const submitReport = async () => {
    if (!reportReason || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await backend.reportRepository.reportListing(propertyId, reportReason, reportNote);
      setReportStatus("open");
      setShowReportModal(false);
      setReportReason("");
      setReportNote("");
    } catch (error) {
      alert(error?.message || "Could not submit the report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  return {
    showReportModal,
    setShowReportModal,
    reportReason,
    setReportReason,
    reportNote,
    setReportNote,
    reportSubmitting,
    reportStatus,
    submitReport,
  };
}
