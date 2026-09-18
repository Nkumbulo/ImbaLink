import { useState, useEffect } from "react";
import { Preferences } from "@capacitor/preferences";
import useMediaQuery from "../hooks/useMediaQuery";
import {
  ChevronDown,
  LogOut,
  Settings,
  Bell,
} from "lucide-react";
import { T } from "../styles/tokens";
import Avatar from "../components/common/Avatar";
import "./RoommateFinderPage.css";
import { useAuth } from "../auth/AuthContext"; // adjust path if needed
import { HUBS, SETTINGS_ROWS, THEMES, resolveIdentity, resolveAccountLabel } from "./ProfilePage/constants";
import { Stat, HubButton, ProBadge } from "./ProfilePage/StatusPrimitives";
import StudentProfileSection from "./ProfilePage/StudentProfileSection";
import ThemeModal from "./ProfilePage/ThemeModal";
import ProRegistrationModal from "./ProfilePage/ProRegistrationModal";
import NotificationPreferencesModal from "./ProfilePage/NotificationPreferencesModal";
import ReportProblemModal from "./ProfilePage/ReportProblemModal";
import HelpSafetyModal from "./ProfilePage/HelpSafetyModal";
import SettingsModal from "./ProfilePage/SettingsModal";
import { checkStaffRole } from "../services/admin/adminAnalytics";
import { ShieldCheck } from "lucide-react";

export default function ProfilePage({
  saved,
  properties,
  liked,
  threads,
  onNavigate,
  profile,
  proRegistration,
  onRegisterPro,
  landlordRegistration,
  agentRegistration,
  companyRegistration,
  contractorRegistration,
  activeHubType,
  studentMode = false,
  onRequestStudentVerification,
  onUpdateStudentProfile,
  unreadNotifCount = 0,
  onOpenNotifications,
  appMode = "property",
  onSwitchMode: _onSwitchMode,
}) {
  const { signOut, user } = useAuth();
  const [showProModal, setShowProModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showNotificationPreferences, setShowNotificationPreferences] = useState(false);
  const [showReportProblem, setShowReportProblem] = useState(false);
  const [showHelpSafety, setShowHelpSafety] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  useEffect(() => {
    let cancelled = false;
    checkStaffRole().then((res) => { if (!cancelled) setIsStaff(res.isStaff); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [theme, setTheme] = useState(() =>
    typeof document !== "undefined" ? (document.documentElement.dataset.imbalinkTheme || "classic") : "classic"
  );
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    const selected = THEMES.find((item) => item.id === theme) || THEMES[0];
    document.documentElement.dataset.imbalinkTheme = selected.id;
    const root = document.documentElement;
    root.dataset.imbalinkTheme = selected.id;
    root.style.setProperty("--theme-green", selected.color);
    root.style.setProperty("--theme-green-soft", selected.soft);
    root.style.setProperty("--theme-green-deep", selected.deep);
    root.style.setProperty("--theme-surface", selected.surface);
    root.style.setProperty("--theme-surface-2", selected.surface2);
    root.style.setProperty("--theme-surface-3", selected.surface3);
    root.style.setProperty("--theme-ink", selected.ink);
    root.style.setProperty("--theme-muted", selected.muted);
    root.style.setProperty("--theme-line", selected.line);
    root.style.setProperty("--theme-nav-text", selected.navText);
    root.style.setProperty("--theme-green-rgb", selected.rgb || "47,122,85");
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", selected.color);
    void Preferences.set({ key: "imbalink-theme", value: selected.id }).catch(() => {});
  }, [theme]);

  const handleThemeSelect = (nextTheme) => {
    setTheme(nextTheme);
    setShowThemeModal(false);
  };

  // Defensive: these can briefly be undefined before useDatabase hydrates.
  const savedCount = saved?.size ?? 0;
  const likedCount = liked?.size ?? 0;
  const chatCount = threads ? Object.keys(threads).length : 0;

  const { name: displayName, firstName, initial, avatarUrl } = resolveIdentity(profile, user);
  const isPro = !!proRegistration;
  const accountLabel = resolveAccountLabel({ companyRegistration, agentRegistration, landlordRegistration, contractorRegistration, studentMode });

  const handleProSubmit = async (data) => {
    if (onRegisterPro) await onRegisterPro(data);
  };

  if (isTabletOrDesktop) {
    return (
      <div data-imbalink-mode={appMode} className={`app-face-${appMode} pb-8 web-page profile-desktop`}>
        <div className="px-4 pt-3">
          <div className="f-display font-bold" style={{ color: T.ink, fontSize: 24 }}>Profile</div>
        </div>

        <div className="web-surface profile-desktop-card" style={{ background: T.paper, borderRadius: 18, marginTop: 10 }}>
          <div className="profile-desktop-header">
            <div className="profile-desktop-identity">
              <Avatar src={avatarUrl} alt="" grad={["#6E63B8", "#3E3670"]} letter={initial} size={84} />
              <div>
                <div className="profile-desktop-name">{displayName || "Profile"}</div>
                <div className="profile-desktop-meta">
                  <span>{accountLabel}</span>
                  <ProBadge isPro={isPro} onClick={() => setShowProModal(true)} />
                </div>
              </div>
            </div>
            <div className="profile-desktop-header-actions">
              <button className="profile-desktop-icon-btn" onClick={onOpenNotifications} aria-label="Notifications" style={{ position: "relative" }}>
                <Bell size={18} />
                {unreadNotifCount > 0 && (
                  <span
                    style={{ position: "absolute", top: 2, right: 2, minWidth: 14, height: 14, padding: "0 3px", borderRadius: 999, background: T.brick, color: "#fff", fontSize: 8.5, fontWeight: 700, lineHeight: "14px", textAlign: "center" }}
                  >
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </button>
              <button className="profile-desktop-icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
                <Settings size={18} />
              </button>
              <button className="profile-desktop-signout" onClick={signOut}>
                <LogOut size={15} />
                Sign out{firstName ? ` (${firstName})` : ""}
              </button>
            </div>
          </div>

          <div className="profile-desktop-stats">
            <Stat n={savedCount} label="Saved" onClick={() => onNavigate("saved", "saved")} />
            <Stat n={likedCount} label="Liked" onClick={() => onNavigate("saved", "liked")} />
            <Stat n={chatCount} label="Chats" onClick={() => onNavigate("messages")} />
          </div>

          {studentMode && (
            <StudentProfileSection
              studentProfile={profile?.studentProfile}
              verificationStatus={profile?.studentVerificationStatus || "unverified"}
              saved={saved}
              properties={properties}
              onRequestVerification={onRequestStudentVerification}
              onUpdateProfile={onUpdateStudentProfile}
            />
          )}

          <div className="profile-desktop-columns">
            <div className="profile-desktop-hubs">
              <div className="profile-desktop-section-title">Imbalink ecosystem</div>
              {activeHubType && (
                <div className="profile-desktop-hub-note">
                  You're registered as a {activeHubType}. One hub registration per account.
                </div>
              )}
              <div className="profile-hub-grid">
                {HUBS.map((hub) => (
                  <HubButton
                    key={hub.tab}
                    onClick={() => onNavigate(hub.tab)}
                    locked={!!activeHubType && activeHubType !== hub.hubType}
                    {...hub}
                  />
                ))}
                {isStaff && (
                  <HubButton
                    key="admin"
                    onClick={() => onNavigate("admin")}
                    iconBg={T.ink}
                    icon={ShieldCheck}
                    title="Admin"
                    subtitle="Verification, reports & platform tools"
                  />
                )}
              </div>
            </div>

            <div className="profile-desktop-settings">
              <div className="profile-desktop-section-title">Settings</div>
              <div className="profile-desktop-settings-list">
                {SETTINGS_ROWS.map((row) => (
                  <button type="button" key={row} className="profile-desktop-settings-row" onClick={row === "Theme" ? () => setShowThemeModal(true) : row === "Notification preferences" ? () => setShowNotificationPreferences(true) : row === "Report a problem" ? () => setShowReportProblem(true) : row === "Help & safety" ? () => setShowHelpSafety(true) : undefined}>
                    {row}
                    <ChevronDown size={14} style={{ transform: "rotate(-90deg)", color: T.ink60 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showThemeModal && (
          <ThemeModal theme={theme} onSelect={handleThemeSelect} onClose={() => setShowThemeModal(false)} />
        )}

        {showNotificationPreferences && (
          <NotificationPreferencesModal onClose={() => setShowNotificationPreferences(false)} />
        )}

        {showReportProblem && (
          <ReportProblemModal onClose={() => setShowReportProblem(false)} />
        )}

        {showHelpSafety && (
          <HelpSafetyModal onClose={() => setShowHelpSafety(false)} onReport={() => { setShowHelpSafety(false); setShowReportProblem(true); }} />
        )}

        {showSettings && (
          <SettingsModal
            theme={theme}
            onTheme={() => { setShowSettings(false); setShowThemeModal(true); }}
            onNotifications={() => { setShowSettings(false); setShowNotificationPreferences(true); }}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showProModal && (
          <ProRegistrationModal
            profile={profile}
            user={user}
            onClose={() => setShowProModal(false)}
            onSubmit={handleProSubmit}
          />
        )}
      </div>
    );
  }

  return (
    <div data-imbalink-mode={appMode} className={`app-face-${appMode} pb-8 web-page`}>
      <div
        className="web-surface"
        style={{
          background: T.paper,
          borderRadius: 18,
          marginTop: 10,
          overflow: "hidden",
        }}
      >
        {/* Profile header — name is part of the identity block so it blends into
            the page instead of floating as a separate title above the card. */}
        <div
          className="px-4 pt-5 pb-4"
          style={{
            background: `linear-gradient(180deg, ${T.paperDim} 0%, ${T.paper} 100%)`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={avatarUrl} alt="" grad={["#6E63B8", "#3E3670"]} letter={initial} size={64}/>
              <div className="min-w-0">
                <div
                  className="f-mono"
                  style={{
                    color: T.ink60,
                    fontSize: 9,
                    letterSpacing: ".13em",
                    textTransform: "uppercase",
                    marginBottom: 3,
                  }}
                >
                  {accountLabel}
                </div>
                <div
                  className="f-display font-bold truncate"
                  style={{
                    color: T.ink,
                    fontSize: 18,
                    lineHeight: 1.15,
                    letterSpacing: "-.025em",
                  }}
                >
                  {displayName || "Profile"}
                </div>
                <div
                  className="f-body mt-1"
                  style={{ color: T.ink60, fontSize: 10.5 }}
                >
                  Welcome back{firstName ? `, ${firstName}` : ""} 👋
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ProBadge isPro={isPro} onClick={() => setShowProModal(true)}/>
              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label="Notifications"
                style={{
                  position: "relative",
                  color: T.ink60,
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: T.paper,
                  border: `1px solid ${T.line}`,
                }}
              >
                <Bell size={17}/>
                {unreadNotifCount > 0 && (
                  <span
                    style={{ position: "absolute", top: 3, right: 3, minWidth: 13, height: 13, padding: "0 3px", borderRadius: 999, background: T.brick, color: "#fff", fontSize: 8, fontWeight: 700, lineHeight: "13px", textAlign: "center" }}
                  >
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label="Settings"
                onClick={() => setShowSettings(true)}
                style={{
                  color: T.ink60,
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: T.paper,
                  border: `1px solid ${T.line}`,
                }}
              >
                <Settings size={17}/>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 px-4 pb-4">
            {/* second arg tells App.jsx which CollectionsPage sub-view to open */}
            <Stat n={savedCount} label="Saved" onClick={() => onNavigate("saved", "saved")}/>
            <Stat n={likedCount} label="Liked" onClick={() => onNavigate("saved", "liked")}/>
            <Stat n={chatCount} label="Chats" onClick={() => onNavigate("messages")}/>
          </div>

        {studentMode && (
          <StudentProfileSection
            studentProfile={profile?.studentProfile}
            verificationStatus={profile?.studentVerificationStatus || "unverified"}
            saved={saved}
            properties={properties}
            onRequestVerification={onRequestStudentVerification}
            onUpdateProfile={onUpdateStudentProfile}
          />
        )}

        {/* Ecosystem hubs */}
        <div className="px-4 pb-2">
          <div className="f-mono mb-2" style={{ color: T.ink60, fontSize: 10, letterSpacing: ".14em" }}>IMBALINK ECOSYSTEM</div>
          {activeHubType && (
            <div className="f-body mb-2.5" style={{ color: T.ink60, fontSize: 11 }}>
              You're registered as a {activeHubType}. One hub registration per account.
            </div>
          )}
          {HUBS.map((hub) => (
            <HubButton
              key={hub.tab}
              onClick={() => onNavigate(hub.tab)}
              locked={!!activeHubType && activeHubType !== hub.hubType}
              {...hub}
            />
          ))}
          {isStaff && (
            <HubButton
              key="admin"
              onClick={() => onNavigate("admin")}
              iconBg={T.ink}
              icon={ShieldCheck}
              title="Admin"
              subtitle="Verification, reports & platform tools"
            />
          )}
        </div>

        {/* Settings rows */}
        <div className="px-4 pt-5 pb-6 space-y-2">
          {SETTINGS_ROWS.map((row, i) => (
            <button
              type="button"
              key={row}
              onClick={row === "Theme" ? () => setShowThemeModal(true) : row === "Notification preferences" ? () => setShowNotificationPreferences(true) : row === "Report a problem" ? () => setShowReportProblem(true) : row === "Help & safety" ? () => setShowHelpSafety(true) : undefined}
              className="rise w-full flex items-center justify-between f-body px-4 py-3.5 rounded-xl text-left"
              style={{ background: T.paperDim, color: T.ink, animationDelay: `${i * 30}ms`, fontSize: 13, border: "none", cursor: "pointer" }}
            >
              {row}
              <ChevronDown size={14} style={{ transform: "rotate(-90deg)", color: T.ink60 }}/>
            </button>
          ))}
        </div>

        {/* Sign out */}
        <div className="px-4 pb-6">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 f-body font-semibold px-4 py-3.5 rounded-xl"
            style={{ background: "rgba(184,61,49,.1)", color: T.brick, fontSize: 13 }}
          >
            <LogOut size={15}/>
            Sign out{firstName ? ` (${firstName})` : ""}
          </button>
        </div>
      </div>

      {showThemeModal && (
        <ThemeModal theme={theme} onSelect={handleThemeSelect} onClose={() => setShowThemeModal(false)} />
      )}

      {showNotificationPreferences && (
        <NotificationPreferencesModal onClose={() => setShowNotificationPreferences(false)} />
      )}

      {showReportProblem && (
        <ReportProblemModal onClose={() => setShowReportProblem(false)} />
      )}

      {showHelpSafety && (
        <HelpSafetyModal onClose={() => setShowHelpSafety(false)} onReport={() => { setShowHelpSafety(false); setShowReportProblem(true); }} />
      )}

      {showSettings && (
        <SettingsModal
          theme={theme}
          onTheme={() => { setShowSettings(false); setShowThemeModal(true); }}
          onNotifications={() => { setShowSettings(false); setShowNotificationPreferences(true); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showProModal && (
        <ProRegistrationModal
          profile={profile}
          user={user}
          onClose={() => setShowProModal(false)}
          onSubmit={handleProSubmit}
        />
      )}
    </div>
  );
}
