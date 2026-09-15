import { useEffect, useState, useCallback } from "react";
import { T } from "../../styles/tokens";
import { setAdminVerification, checkStaffRole } from "../../services/admin/adminAnalytics";
import {
  getAdminVerificationQueue,
  getNeglectedVerifications,
  neglectVerification,
  restoreNeglectedVerification,
} from "../../services/admin/adminModeration";
import { StatusPill, EmptyState, LoadingState, SectionHeader } from "./shared";

const STORES = [
  { id: "properties", label: "Properties" },
  { id: "landlord_verifications", label: "Landlords" },
  { id: "registrations", label: "Agents/Companies" },
  { id: "contractors", label: "Contractors" },
  { id: "student_profiles", label: "Students" },
];

// Verification decisions (accept/reject/flag/neglect) require the stricter
// 'admin' role specifically (see backend/022-admin-only-verification.sql) —
// a real, deliberate tightening from the general is_staff_caller() check
// everywhere else in the admin system. Any staff role can still VIEW this
// queue; only an admin can act on it, so the write controls below check
// this separately from the page-level staff gate in AdminPage.jsx.
export default function VerificationSection() {
  const [store, setStore] = useState("properties");
  const [showNeglected, setShowNeglected] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkStaffRole().then(({ role }) => setIsAdmin(role === "admin")).catch(() => setIsAdmin(false));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const fetcher = showNeglected
      ? getNeglectedVerifications(store)
      : getAdminVerificationQueue(store, "pending");
    fetcher
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((err) => setError(err?.message || "Could not load the queue."))
      .finally(() => setLoading(false));
  }, [store, showNeglected]);

  useEffect(() => { load(); }, [load]);

  const decide = async (row, status) => {
    const id = row.id ?? row.user_id;
    setBusyId(id);
    try {
      await setAdminVerification(store, id, status);
      setRows((prev) => prev.filter((r) => (r.id ?? r.user_id) !== id));
    } catch (err) {
      alert(err?.message || "Could not update this record.");
    } finally {
      setBusyId(null);
    }
  };

  const neglect = async (row) => {
    const id = row.id ?? row.user_id;
    setBusyId(id);
    try {
      await neglectVerification(store, id, "Set aside from Verification Center");
      setRows((prev) => prev.filter((r) => (r.id ?? r.user_id) !== id));
    } catch (err) {
      alert(err?.message || "Could not set this record aside.");
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (row) => {
    const id = row.id ?? row.user_id ?? row.record_id;
    setBusyId(id);
    try {
      await restoreNeglectedVerification(store, id);
      setRows((prev) => prev.filter((r) => (r.id ?? r.user_id ?? r.record_id) !== id));
    } catch (err) {
      alert(err?.message || "Could not restore this record.");
    } finally {
      setBusyId(null);
    }
  };

  const nameFor = (row) =>
    row.title || row.business_name || row.landlord_name || row.student_name || row.legal_name || row.subject_name || "Untitled";

  return (
    <div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {STORES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStore(s.id)}
            className="f-body font-medium px-3 py-1.5 rounded-full shrink-0"
            style={{
              background: store === s.id ? T.ink : T.paperDim,
              color: store === s.id ? T.paper : T.ink,
              fontSize: 11,
              border: "none",
              whiteSpace: "nowrap",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <SectionHeader
        title={showNeglected ? "Set aside" : "Pending review"}
        action={
          <button
            type="button"
            onClick={() => setShowNeglected((v) => !v)}
            className="f-body font-medium"
            style={{ color: T.jacaranda, fontSize: 11.5, background: "transparent", border: "none" }}
          >
            {showNeglected ? "Back to queue" : "View set-aside"}
          </button>
        }
      />

      {loading && <LoadingState />}
      {!loading && error && <div className="f-body" style={{ color: T.brick, fontSize: 12.5 }}>{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <EmptyState label={showNeglected ? "Nothing set aside right now." : "Nothing pending review."} />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => {
            const id = row.id ?? row.user_id ?? row.record_id;
            const busy = busyId === id;
            return (
              <div key={id} className="rounded-2xl p-3.5" style={{ background: T.paperDim }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="f-body font-semibold truncate" style={{ color: T.ink, fontSize: 13 }}>
                      {nameFor(row)}
                    </div>
                    <div className="f-body truncate" style={{ color: T.ink60, fontSize: 11 }}>
                      {row.email || row.city || row.university_name || ""}
                    </div>
                  </div>
                  <StatusPill status={row.status || row.previous_status || "pending"} />
                </div>
                {!isAdmin && (
                  <div className="f-body" style={{ color: T.ink60, fontSize: 10.5, marginBottom: 6 }}>
                    Viewing only — decisions require the admin role.
                  </div>
                )}
                {isAdmin && (
                  <div className="flex gap-1.5">
                    {showNeglected ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => restore(row)}
                        className="f-body font-semibold px-3 py-1.5 rounded-full"
                        style={{ background: T.ink, color: T.paper, fontSize: 11, border: "none", opacity: busy ? 0.6 : 1 }}
                      >
                        Restore to queue
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide(row, "verified")}
                          className="f-body font-semibold px-3 py-1.5 rounded-full"
                          style={{ background: T.msasa, color: T.white, fontSize: 11, border: "none", opacity: busy ? 0.6 : 1 }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide(row, "rejected")}
                          className="f-body font-semibold px-3 py-1.5 rounded-full"
                          style={{ background: T.brick, color: T.white, fontSize: 11, border: "none", opacity: busy ? 0.6 : 1 }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => neglect(row)}
                          className="f-body font-medium px-3 py-1.5 rounded-full"
                          style={{ background: "transparent", color: T.ink60, fontSize: 11, border: `1px solid ${T.line}`, opacity: busy ? 0.6 : 1 }}
                        >
                          Set aside
                        </button>
                      </>
                    )}
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
