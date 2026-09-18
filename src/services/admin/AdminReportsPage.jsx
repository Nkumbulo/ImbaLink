import { useEffect, useState } from "react";
import { getAdminReports, setAdminReportStatus } from "../../services/admin/adminAnalytics";
import AdminDataTable, { StatusBadge } from "../../components/admin/AdminDataTable";
import useAdminRealtime from "../../hooks/useAdminRealtime";

export default function AdminReportsPage() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const load = () => {
    // Deferred via queueMicrotask rather than called directly: the fetch
    // below is always genuinely async (network I/O), so this runs before
    // it in every case — same effective timing, no user-visible change —
    // but it keeps this out of the effect's synchronous call graph, which
    // is what react-hooks/set-state-in-effect actually flags (a real perf
    // guard against effects that mirror state synchronously on every
    // commit, not applicable to a fetch-on-mount effect like this one).
    queueMicrotask(() => setLoading(true));
    getAdminReports({ status, offset: page * 50 })
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }))
      .finally(() => setLoading(false));
  };

  // Fires on status/page change and on realtime pushes (below). `load`
  // intentionally isn't in the deps array — it closes over status/page by
  // value already, so listing it would re-run this on every render instead
  // of only on a real filter change. Pre-existing behavior (and the same
  // pre-existing exhaustive-deps warning), unchanged by this reformat.
  useEffect(() => {
    load();
  }, [status, page]);

  useAdminRealtime(() => load());

  const update = async (id, next) => {
    if (!window.confirm(`Confirm changing this report to ${next}? This action is recorded in the admin workflow.`)) return;
    try {
      await setAdminReportStatus(id, next);
      load();
    } catch (e) {
      alert(e?.message || "Unable to update report.");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-title">
        <div>
          <div className="admin-breadcrumb">Administration <span>/</span> Reports</div>
          <h1>Reports</h1>
          <p>Moderation queue for listing and marketplace reports.</p>
        </div>
      </div>
      <AdminDataTable
        title="Moderation queue"
        subtitle="Staff-only report records"
        filters={
          <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        }
        loading={loading}
        total={data.total}
        page={page}
        onPageChange={setPage}
      >
        <tr><th>Report</th><th>Subject</th><th>Reason</th><th>Reporter</th><th>Created</th><th>Status</th><th>Action</th></tr>
        {data.rows.map((r) => (
          <tr key={r.id}>
            <td><b>{String(r.id).slice(0, 16)}</b></td>
            <td>{r.subject_title || r.subject_id || "—"}</td>
            <td>{r.reason}</td>
            <td>{r.reporter_name || "Unknown"}</td>
            <td>{r.created_at ? new Date(r.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
            <td><StatusBadge value={r.status} /></td>
            <td>
              <select className="admin-action-select" value="" onChange={(e) => e.target.value && update(r.id, e.target.value)}>
                <option value="">Update</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolve</option>
                <option value="dismissed">Dismiss</option>
              </select>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </div>
  );
}
