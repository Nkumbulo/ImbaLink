import { X } from "lucide-react";
import { T } from "../../../styles/tokens";

const REPORT_REASONS = [
  "Scam / fake listing",
  "Already rented or sold",
  "Misleading photos or details",
  "Inappropriate content",
  "Other",
];

export default function ReportModal({
  showReportModal,
  setShowReportModal,
  reportReason,
  setReportReason,
  reportNote,
  setReportNote,
  reportSubmitting,
  submitReport,
}) {
  if (!showReportModal) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(20,32,26,.55)" }}
      onClick={() => !reportSubmitting && setShowReportModal(false)}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5"
        style={{ background: T.paper }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="f-display font-bold" style={{ color: T.ink, fontSize: 16 }}>
            Report this listing
          </div>
          <button
            type="button"
            onClick={() => !reportSubmitting && setShowReportModal(false)}
            style={{ color: T.ink60 }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="f-body mb-3" style={{ color: T.ink60, fontSize: 12 }}>
          Tell us what's wrong. Our team reviews every report.
        </div>
        <div className="space-y-1.5 mb-3">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setReportReason(reason)}
              className="w-full text-left f-body px-3.5 py-2.5 rounded-xl"
              style={{
                background: reportReason === reason ? T.paperDim : "transparent",
                border: `1px solid ${reportReason === reason ? T.jacaranda : T.line}`,
                color: T.ink,
                fontSize: 12.5,
              }}
            >
              {reason}
            </button>
          ))}
        </div>
        <textarea
          value={reportNote}
          onChange={(e) => setReportNote(e.target.value)}
          placeholder="Add details (optional)"
          rows={3}
          className="w-full f-body px-3.5 py-3 rounded-xl outline-none mb-3"
          style={{ background: T.paperDim, color: T.ink, fontSize: 12.5, border: `1px solid ${T.line}`, resize: "none" }}
        />
        <button
          type="button"
          disabled={!reportReason || reportSubmitting}
          onClick={submitReport}
          className="w-full py-3 rounded-full f-display font-semibold"
          style={{
            background: T.brick,
            color: T.paper,
            fontSize: 13,
            border: "none",
            opacity: !reportReason || reportSubmitting ? 0.5 : 1,
          }}
        >
          {reportSubmitting ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </div>
  );
}
