import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Building2, CheckCircle2, Download, FileJson, FileSpreadsheet, History, MailPlus, RefreshCw, ShieldCheck, Users, X } from "lucide-react";
import { adminFormat } from "../../services/admin/adminAnalytics";
import { createLandlordInvite, downloadCSV, downloadJSON, exportAdminData, getAdminAuditLog, getAdminInsights } from "../../services/admin/adminTools";
import { StatusBadge } from "../../components/admin/AdminDataTable";
import useAdminRealtime from "../../hooks/useAdminRealtime";

const exportOptions = [
  ["users", "Users", "Names, account types, dates and activity metadata"],
  ["properties", "Properties", "Inventory, ownership, rent, status and engagement"],
  ["viewing_requests", "Viewing requests", "Demand, request status and timestamps"],
  ["registrations", "Registrations", "Business/landlord/student registration workflow"],
  ["contractors", "Contractors", "Trade, location, verification and performance"],
  ["reports", "Reports", "Moderation and marketplace reports"],
  ["students", "Student demand", "University and roommate demand signals"],
  ["audit_log", "Admin audit log", "Staff actions and exports"],
];

function Stat({ label, value, icon: Icon, tone = "green" }) {
  return <div className={`admin-tool-stat tone-${tone}`}><div><small>{label}</small><strong>{adminFormat.number(value)}</strong></div><span><Icon size={16}/></span></div>;
}

function LandlordModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ firstName: "", surname: "", email: "", phone: "", city: "Harare" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const update = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const result = await createLandlordInvite(form);
      setSuccess(result?.message || "Landlord created and invitation sent.");
      onCreated?.();
    } catch (err) { setError(err?.message || "Unable to create landlord."); }
    finally { setBusy(false); }
  };
  return <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="admin-modal" role="dialog" aria-modal="true" aria-label="Add landlord"><div className="admin-modal-head"><div><span className="admin-kicker"><Users size={13}/> Manual account creation</span><h2>Add landlord</h2><p>Creates the Supabase account, ImbaLink profile and landlord registration, then sends an invitation.</p></div><button className="admin-icon-button" onClick={onClose} aria-label="Close"><X size={17}/></button></div><form onSubmit={submit}><div className="admin-form-grid"><label>First name<input required value={form.firstName} onChange={update("firstName")} placeholder="First name"/></label><label>Surname<input required value={form.surname} onChange={update("surname")} placeholder="Surname"/></label><label>Email<input required type="email" value={form.email} onChange={update("email")} placeholder="landlord@example.com"/></label><label>Phone<input value={form.phone} onChange={update("phone")} placeholder="+263..."/></label><label>City<select value={form.city} onChange={update("city")}><option>Harare</option><option>Bulawayo</option><option>Mutare</option><option>Gweru</option><option>Other</option></select></label><label>Verification<div className="admin-readonly-field">Pending — identity verification remains separate</div></label></div>{error&&<div className="admin-form-error">{error}</div>}{success&&<div className="admin-form-success"><CheckCircle2 size={15}/>{success}</div>}<div className="admin-modal-foot"><button type="button" className="admin-button secondary" onClick={onClose}>Cancel</button><button className="admin-button" disabled={busy}>{busy?<><RefreshCw size={14} className="admin-spin"/> Creating…</>:<><MailPlus size={14}/> Create & send invite</>}</button></div></form></div></div>;
}

export default function AdminOperationsPage() {
  const [insights, setInsights] = useState(null); const [audit, setAudit] = useState({ rows: [], total: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [modal, setModal] = useState(false); const [exporting, setExporting] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const [i, a] = await Promise.all([getAdminInsights(), getAdminAuditLog({ limit: 12 })]); setInsights(i); setAudit(a); } catch (e) { setError(e?.message || "Unable to load admin operations."); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  useAdminRealtime(() => load());
  const exportData = async (resource, format = "json") => { setExporting(`${resource}:${format}`); try { const rows = await exportAdminData(resource); const stamp = new Date().toISOString().slice(0,10); const ext = format === "csv" ? "csv" : "json"; (format === "csv" ? downloadCSV : downloadJSON)(rows, `imbalink-${resource}-${stamp}.${ext}`); } catch (e) { setError(e?.message || "Export failed."); } finally { setExporting(""); } };
  const i = insights || {};
  const health = useMemo(() => [
    ["Pending property reviews", i.pending_properties, "Review the property queue", "amber"],
    ["Open reports", i.open_reports, "Moderate reported content", "red"],
    ["Listings missing images", i.listings_missing_images, "Improve listing quality", "amber"],
    ["Listings missing owner", i.listings_missing_owner, "Repair ownership data", "red"],
    ["Stale listings", i.stale_listings, "Listings not updated recently", "blue"],
    ["Unverified landlords", i.unverified_landlords, "Follow up with verification", "amber"],
  ], [i]);
  return <div className="admin-page"><div className="admin-page-title"><div><div className="admin-breadcrumb">Administration <span>/</span> Operations</div><h1>Operations</h1><p>The control room for growth, data quality, exports and manual platform operations.</p></div><div className="admin-page-actions"><button className="admin-button secondary" onClick={load}><RefreshCw size={14}/> Refresh</button><button className="admin-button" onClick={() => setModal(true)}><MailPlus size={14}/> Add landlord</button></div></div>
    {error&&<div className="admin-alert"><span>{error}</span><button onClick={load}>Retry</button></div>}
    <div className="admin-tool-stats"><Stat label="Active users (30d)" value={i.active_users_30d} icon={Activity}/><Stat label="New users (30d)" value={i.new_users_30d} icon={Users}/><Stat label="Published listings" value={i.published_listings} icon={Building2}/><Stat label="Conversion: view → request" value={`${Number(i.view_to_request_rate||0).toFixed(1)}%`} icon={CheckCircle2} tone="teal"/><Stat label="Active share requests" value={i.active_share_requests} icon={Users} tone="purple"/><Stat label="Pending registrations" value={i.pending_registrations} icon={ShieldCheck} tone="amber"/></div>
    <div className="admin-grid admin-grid-main"><section className="admin-panel"><div className="admin-panel-head"><div><h2>Marketplace health</h2><p>Issues that can directly affect trust, conversion or operations.</p></div><AlertTriangle size={17} className="admin-panel-icon"/></div><div className="admin-health-grid">{health.map(([label,value,desc,tone])=><div className={`admin-health-card health-${tone}`} key={label}><div><small>{label}</small><strong>{adminFormat.number(value)}</strong><p>{desc}</p></div><span>{Number(value||0)>0?<AlertTriangle size={15}/>:<CheckCircle2 size={15}/>}</span></div>)}</div></section><section className="admin-panel"><div className="admin-panel-head"><div><h2>Marketplace funnel</h2><p>Where users are moving from discovery to action.</p></div></div><div className="admin-funnel"><div><b>{adminFormat.number(i.funnel_views)}</b><span>Views</span></div><i></i><div><b>{adminFormat.number(i.funnel_saves)}</b><span>Saves</span></div><i></i><div><b>{adminFormat.number(i.funnel_requests)}</b><span>Requests</span></div><i></i><div><b>{adminFormat.number(i.funnel_accepted)}</b><span>Accepted</span></div></div><div className="admin-funnel-note">Request rate <b>{Number(i.view_to_request_rate||0).toFixed(1)}%</b> · acceptance rate <b>{Number(i.request_acceptance_rate||0).toFixed(1)}%</b></div></section></div>
    <section className="admin-panel admin-table-panel"><div className="admin-panel-head"><div><h2>Data exports</h2><p>Download staff-authorized operational data directly from the admin panel. Exports are audited.</p></div><FileJson size={17} className="admin-panel-icon"/></div><div className="admin-export-grid">{exportOptions.map(([resource,label,desc])=><div className="admin-export-card" key={resource}><div><b>{label}</b><p>{desc}</p></div><div><button disabled={!!exporting} onClick={()=>exportData(resource,"json")} title="Export JSON"><FileJson size={14}/>{exporting===`${resource}:json`?"…":"JSON"}</button><button disabled={!!exporting} onClick={()=>exportData(resource,"csv")} title="Export CSV"><FileSpreadsheet size={14}/>{exporting===`${resource}:csv`?"…":"CSV"}</button></div></div>)}</div></section>
    <section className="admin-panel admin-table-panel"><div className="admin-panel-head"><div><h2>Recent admin activity</h2><p>Auditable staff actions, including data exports and manual account creation.</p></div><History size={17} className="admin-panel-icon"/></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Action</th><th>Resource</th><th>Staff user</th><th>Details</th><th>Time</th></tr></thead><tbody>{audit.rows?.length?audit.rows.map(r=><tr key={r.id}><td><b>{r.action}</b></td><td>{r.resource_type||"—"}{r.resource_id?<small>{r.resource_id}</small>:null}</td><td>{r.actor_name||r.actor_user_id||"—"}</td><td>{r.metadata&&typeof r.metadata==="object"?JSON.stringify(r.metadata):"—"}</td><td>{r.created_at?new Date(r.created_at).toLocaleString([], {dateStyle:"medium",timeStyle:"short"}):"—"}</td></tr>):<tr><td colSpan="5"><div className="admin-table-state">No audit activity yet.</div></td></tr>}</tbody></table></div></section>
    {modal&&<LandlordModal onClose={()=>setModal(false)} onCreated={load}/>}</div>;
}
