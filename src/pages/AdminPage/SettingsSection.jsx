import { useEffect, useState } from "react";
import { T } from "../../styles/tokens";
import { getMonetizationConfig, setMonetizationEnabled, getMonetizationAnalytics } from "../../services/admin/adminMonetization";
import { StatCard, LoadingState, SectionHeader } from "./shared";
import { adminFormat } from "../../services/admin/adminAnalytics";

// Only rendered for admins (see AdminPage.jsx) — set_monetization_enabled
// itself also enforces this server-side regardless.
export default function SettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMonetizationConfig(), getMonetizationAnalytics(30)])
      .then(([config, a]) => {
        if (cancelled) return;
        setEnabled(Boolean(config?.enabled));
        setAnalytics(a);
      })
      .catch((err) => { if (!cancelled) setError(err?.message || "Could not load settings."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setSaving(true);
    try {
      await setMonetizationEnabled(next);
      setEnabled(next);
    } catch (err) {
      alert(err?.message || "Could not update this setting.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading settings…" />;
  if (error) return <div className="f-body" style={{ color: T.brick, fontSize: 12.5 }}>{error}</div>;

  const kpis = analytics?.kpis || {};

  return (
    <div>
      <SectionHeader title="Monetization" />
      <div className="rounded-2xl p-4 mb-4" style={{ background: T.paperDim }}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 13 }}>
              Require Pro membership for new listings
            </div>
            <div className="f-body" style={{ color: T.ink60, fontSize: 11, marginTop: 2 }}>
              When on, new listings and viewing requests require an active Pro
              membership and a verified account. Existing listings are unaffected.
              Admins always bypass this.
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={saving}
            className="shrink-0 rounded-full"
            style={{
              width: 44, height: 26, padding: 3,
              background: enabled ? T.msasa : T.line,
              border: "none",
              opacity: saving ? 0.6 : 1,
              transition: "background 0.15s ease",
            }}
            aria-label={enabled ? "Disable monetization" : "Enable monetization"}
          >
            <span
              className="block rounded-full"
              style={{
                width: 20, height: 20, background: T.white,
                transform: enabled ? "translateX(18px)" : "translateX(0)",
                transition: "transform 0.15s ease",
              }}
            />
          </button>
        </div>
      </div>

      {analytics && (
        <>
          <SectionHeader title="Monetization readiness (last 30 days)" />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Verified users" value={kpis.verified_users} format={adminFormat.number} />
            <StatCard label="Active Pro members" value={kpis.active_pro} format={adminFormat.number} />
            <StatCard label="Pro penetration" value={kpis.pro_penetration} format={adminFormat.percent} />
            <StatCard label="Verification rate" value={kpis.verification_rate} format={adminFormat.percent} />
            <StatCard label="Requests from non-Pro users" value={kpis.locked_opportunity} format={adminFormat.number} />
            <StatCard label="Pro's share of listings" value={kpis.pro_listing_share} format={adminFormat.percent} />
          </div>
          <div className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>
            No payment provider is connected. These are operational estimates only — enabling
            this switch does not charge anyone; it only gates access based on existing
            Pro registrations.
          </div>
        </>
      )}
    </div>
  );
}
