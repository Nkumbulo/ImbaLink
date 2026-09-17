import { useEffect, useState } from "react";
import { T } from "../../styles/tokens";
import { getAdminAuditLog, exportAdminData, downloadCSV } from "../../services/admin/adminTools";
import { EmptyState, LoadingState, SectionHeader } from "./shared";

const EXPORT_RESOURCES = ["users", "properties", "viewing_requests", "registrations", "contractors", "reports", "students", "audit_log"];

function describeAction(entry) {
  const actor = entry.actor_name || "Someone";
  switch (entry.action) {
    case "verification.status_changed":
      return `${actor} changed ${entry.resource_type} verification (${entry.metadata?.from} → ${entry.metadata?.to})`;
    case "report.status_changed":
      return `${actor} changed a report's status (${entry.metadata?.from} → ${entry.metadata?.to})`;
    case "data.exported":
      return `${actor} exported ${entry.metadata?.rows ?? "some"} rows of ${entry.resource_type}`;
    default:
      return `${actor} — ${entry.action}`;
  }
}

export default function AuditLogSection() {
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAdminAuditLog({ limit: 100 })
      .then((res) => { if (!cancelled) setData(res || { rows: [], total: 0 }); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Could not load the audit log."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleExport = async (resource) => {
    setExporting(resource);
    try {
      const rows = await exportAdminData(resource, 5000);
      downloadCSV(rows, `imbalink-${resource}-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      alert(err?.message || "Export failed.");
    } finally {
      setExporting("");
    }
  };

  return (
    <div>
      <SectionHeader title="Export data" />
      <div className="flex flex-wrap gap-1.5 mb-6">
        {EXPORT_RESOURCES.map((resource) => (
          <button
            key={resource}
            type="button"
            disabled={exporting === resource}
            onClick={() => handleExport(resource)}
            className="f-body font-medium px-3 py-1.5 rounded-full capitalize"
            style={{ background: T.paperDim, color: T.ink, fontSize: 10.5, border: "none", opacity: exporting === resource ? 0.6 : 1 }}
          >
            {exporting === resource ? "Exporting…" : resource.replace("_", " ")}
          </button>
        ))}
      </div>

      <SectionHeader title="Recent activity" />
      {loading && <LoadingState />}
      {!loading && error && <div className="f-body" style={{ color: T.brick, fontSize: 12.5 }}>{error}</div>}
      {!loading && !error && data.rows.length === 0 && <EmptyState label="No admin activity yet." />}
      {!loading && !error && data.rows.length > 0 && (
        <div className="space-y-1.5">
          {data.rows.map((entry) => (
            <div key={entry.id} className="rounded-xl p-3" style={{ background: T.paperDim }}>
              <div className="f-body" style={{ color: T.ink, fontSize: 12 }}>{describeAction(entry)}</div>
              <div className="f-body" style={{ color: T.ink60, fontSize: 10 }}>
                {new Date(entry.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
