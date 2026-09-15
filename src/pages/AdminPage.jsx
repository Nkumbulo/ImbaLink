import { useEffect, useState } from "react";
import { LayoutDashboard, ShieldCheck, Flag, Users, Home, ScrollText, Settings } from "lucide-react";
import { T } from "../styles/tokens";
import { checkStaffRole } from "../services/admin/adminAnalytics";
import DashboardSection from "./AdminPage/DashboardSection";
import VerificationSection from "./AdminPage/VerificationSection";
import ReportsSection from "./AdminPage/ReportsSection";
import UsersSection from "./AdminPage/UsersSection";
import PropertiesSection from "./AdminPage/PropertiesSection";
import AuditLogSection from "./AdminPage/AuditLogSection";
import SettingsSection from "./AdminPage/SettingsSection";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, Component: DashboardSection },
  { id: "verification", label: "Verification", icon: ShieldCheck, Component: VerificationSection },
  { id: "reports", label: "Reports", icon: Flag, Component: ReportsSection },
  { id: "users", label: "Users", icon: Users, Component: UsersSection },
  { id: "properties", label: "Properties", icon: Home, Component: PropertiesSection },
  { id: "audit", label: "Audit log", icon: ScrollText, Component: AuditLogSection },
  // Settings (the monetization switch) is admin-only, not staff-in-general —
  // filtered into the visible list below once role is known, rather than
  // hard-coded here, since every other section is available to any staff role.
  { id: "settings", label: "Settings", icon: Settings, Component: SettingsSection, adminOnly: true },
];

// This is a client-side convenience gate only — every RPC these sections
// call re-checks is_staff_caller() (or the stricter admin-only check for
// verification/settings writes) server-side regardless. A user who somehow
// reached this screen without the role would just see empty/erroring
// sections, not real data — this screen exists so that experience is a
// clear "you don't have access" message instead of a confusing blank page.
export default function AdminPage() {
  const [status, setStatus] = useState("checking"); // checking | denied | ready
  const [role, setRole] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard");

  useEffect(() => {
    let cancelled = false;
    checkStaffRole()
      .then(({ isStaff, role: r }) => {
        if (cancelled) return;
        setRole(r);
        setStatus(isStaff ? "ready" : "denied");
      })
      .catch(() => { if (!cancelled) setStatus("denied"); });
    return () => { cancelled = true; };
  }, []);

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "60vh", color: T.ink60 }}>
        <span className="f-body" style={{ fontSize: 13 }}>Checking access…</span>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "60vh" }}>
        <ShieldCheck size={40} color={T.ink60} style={{ opacity: 0.3, marginBottom: 16 }} />
        <div className="f-display font-semibold mb-1" style={{ color: T.ink, fontSize: 15 }}>
          Staff access required
        </div>
        <div className="f-body" style={{ color: T.ink60, fontSize: 12.5, maxWidth: 280 }}>
          This area is only available to ImbaLink staff accounts.
        </div>
      </div>
    );
  }

  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || role === "admin");
  const active = visibleSections.find((s) => s.id === activeSection) || visibleSections[0];
  const ActiveComponent = active.Component;

  return (
    <div className="pb-10" style={{ minHeight: "100vh", background: T.paperDim }}>
      <div className="px-4 pt-5 pb-3" style={{ background: T.paper, borderBottom: `1px solid ${T.line}` }}>
        <div className="f-display font-bold mb-0.5" style={{ color: T.ink, fontSize: 18 }}>Admin</div>
        <div className="f-body" style={{ color: T.ink60, fontSize: 11.5 }}>
          Signed in as {role === "admin" ? "administrator" : "staff"}
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className="flex items-center gap-1.5 f-body font-medium px-3 py-2 rounded-full shrink-0"
              style={{
                background: active.id === s.id ? T.ink : T.paper,
                color: active.id === s.id ? T.paper : T.ink,
                fontSize: 11.5,
                border: active.id === s.id ? "none" : `1px solid ${T.line}`,
                whiteSpace: "nowrap",
              }}
            >
              <s.icon size={13} />
              {s.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl p-4" style={{ background: T.paper, border: `1px solid ${T.line}` }}>
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
