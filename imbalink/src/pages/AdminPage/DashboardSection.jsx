import { useEffect, useState } from "react";
import { T } from "../../styles/tokens";
import { getAdminDashboard, adminFormat } from "../../services/admin/adminAnalytics";
import { getAdminInsights } from "../../services/admin/adminTools";
import { StatCard, LoadingState, SectionHeader } from "./shared";

export default function DashboardSection() {
  const [dashboard, setDashboard] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getAdminDashboard(), getAdminInsights()])
      .then(([d, i]) => {
        if (cancelled) return;
        setDashboard(d);
        setInsights(i);
        setError("");
      })
      .catch((err) => { if (!cancelled) setError(err?.message || "Could not load the dashboard."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <div className="f-body" style={{ color: T.brick, fontSize: 12.5 }}>{error}</div>;

  const kpis = dashboard?.kpis || {};

  return (
    <div>
      <SectionHeader title="Last 30 days" />
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total users" value={kpis.total_users} growth={kpis.user_growth} format={adminFormat.number} />
        <StatCard label="Total properties" value={kpis.total_properties} growth={kpis.property_growth} format={adminFormat.number} />
        <StatCard label="Viewing requests" value={kpis.period_requests} growth={kpis.request_growth} format={adminFormat.number} />
        <StatCard label="Messages" value={kpis.total_messages} growth={kpis.message_growth} format={adminFormat.number} />
        <StatCard label="Pending reviews" value={kpis.pending_reviews} format={adminFormat.number} />
        <StatCard label="Verified properties" value={kpis.verified_properties} format={adminFormat.number} />
      </div>

      {insights && (
        <>
          <SectionHeader title="Operational health" />
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Open reports" value={insights.open_reports} format={adminFormat.number} />
            <StatCard label="Unverified landlords" value={insights.unverified_landlords} format={adminFormat.number} />
            <StatCard label="Listings missing photos" value={insights.listings_missing_images} format={adminFormat.number} />
            <StatCard label="Stale listings (60d+)" value={insights.stale_listings} format={adminFormat.number} />
            <StatCard label="View → request rate" value={insights.view_to_request_rate} format={adminFormat.percent} />
            <StatCard label="Request acceptance rate" value={insights.request_acceptance_rate} format={adminFormat.percent} />
          </div>
        </>
      )}

      {Array.isArray(dashboard?.breakdowns?.cities) && dashboard.breakdowns.cities.length > 0 && (
        <>
          <SectionHeader title="Top cities" />
          <div className="space-y-1.5 mb-6">
            {dashboard.breakdowns.cities.map((row) => (
              <div key={row.label} className="flex items-center justify-between f-body" style={{ fontSize: 12, color: T.ink }}>
                <span>{row.label}</span>
                <span style={{ color: T.ink60 }}>{adminFormat.number(row.value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
