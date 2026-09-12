import { useEffect, useState, useCallback } from "react";
import { T } from "../../styles/tokens";
import { getAdminReports, setAdminReportStatus } from "../../services/admin/adminAnalytics";
import { StatusPill, EmptyState, LoadingState, SectionHeader } from "./shared";

const STATUS_FILTERS = ["open", "reviewing", "resolved", "dismissed"];

export default function ReportsSection() {
  const [status, setStatus] = useState("open");
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getAdminReports({ status })
      .then((res) => setData(res || { rows: [], total: 0 }))
      .catch((err) => setError(err?.message || "Could not load reports."))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (report, nextStatus) => {
    setBusyId(report.id);
    try {
      await setAdminReportStatus(report.id, nextStatus);
      setData((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== report.id) }));
    } catch (err) {
      alert(err?.message || "Could not update this report.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className="f-body font-medium px-3 py-1.5 rounded-full capitalize shrink-0"
            style={{
              background: status === s ? T.ink : T.paperDim,
              color: status === s ? T.paper : T.ink,
              fontSize: 11,
              border: "none",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <SectionHeader title={`${data.total || 0} report${data.total === 1 ? "" : "s"}`} />

      {loading && <LoadingState />}
      {!loading && error && <div className="f-body" style={{ color: T.brick, fontSize: 12.5 }}>{error}</div>}
      {!loading && !error && data.rows.length === 0 && <EmptyState label="No reports here." />}

      {!loading && !error && data.rows.length > 0 && (
        <div className="space-y-2">
          {data.rows.map((report) => {
            const busy = busyId === report.id;
            return (
              <div key={report.id} className="rounded-2xl p-3.5" style={{ background: T.paperDim }}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 13 }}>
                      {report.subject_title || report.subject_id}
                    </div>
                    <div className="f-body" style={{ color: T.ink60, fontSize: 11 }}>
                      Reported by {report.reporter_name} — {report.reason}
                    </div>
                  </div>
                  <StatusPill status={report.status} />
                </div>
                {report.note && (
                  <div className="f-body mb-2" style={{ color: T.ink, fontSize: 11.5, opacity: 0.85 }}>
                    "{report.note}"
                  </div>
                )}
                {status !== "resolved" && status !== "dismissed" && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolve(report, "reviewing")}
                      className="f-body font-medium px-3 py-1.5 rounded-full"
                      style={{ background: "transparent", color: T.jacaranda, fontSize: 11, border: `1px solid ${T.line}`, opacity: busy ? 0.6 : 1 }}
                    >
                      Mark reviewing
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolve(report, "resolved")}
                      className="f-body font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: T.msasa, color: T.white, fontSize: 11, border: "none", opacity: busy ? 0.6 : 1 }}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolve(report, "dismissed")}
                      className="f-body font-medium px-3 py-1.5 rounded-full"
                      style={{ background: "transparent", color: T.ink60, fontSize: 11, border: `1px solid ${T.line}`, opacity: busy ? 0.6 : 1 }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
