import { useEffect, useState } from "react";
import { Bell, Check, Volume2, Monitor, Smartphone, X } from "lucide-react";
import { T } from "../../styles/tokens";
import {
  getNotificationPreferences,
  prepareNotificationExperience,
  setNotificationPreferences,
  notifyUser,
} from "../../services/notifications/notificationEngine";

function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: 42, height: 24, borderRadius: 999, border: `1px solid ${T.line}`, background: checked ? T.jacaranda : T.paperDim, padding: 2, display: "flex", justifyContent: checked ? "flex-end" : "flex-start", alignItems: "center" }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: T.paper, boxShadow: "0 1px 3px rgba(0,0,0,.15)" }} />
    </button>
  );
}

export default function NotificationPreferencesModal({ onClose }) {
  const [prefs, setPrefs] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => { getNotificationPreferences().then(setPrefs); }, []);
  if (!prefs) return null;

  const update = async (patch) => setPrefs(await setNotificationPreferences({ ...prefs, ...patch }));

  const test = async () => {
    setTesting(true);
    await prepareNotificationExperience();
    await notifyUser({ id: `test-${Date.now()}`, type: "default", title: "ImbaLink notifications are working", body: "Your ImbaLink notification sound is working." });
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(20,32,26,.5)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: T.paper, border: `1px solid ${T.line}`, boxShadow: "0 24px 70px rgba(0,0,0,.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: T.paperDim, color: T.jacaranda }}><Bell size={17}/></span>
            <div><div className="f-display font-bold" style={{ color: T.ink, fontSize: 16 }}>Notification settings</div><div className="f-body" style={{ color: T.ink60, fontSize: 11 }}>Control how ImbaLink keeps you informed</div></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: T.ink60 }}><X size={18}/></button>
        </div>

        <div className="p-5 space-y-3">
          {[
            ["enabled", "Notifications", "Allow ImbaLink to alert you", Bell],
            ["sound", "Notification sound", "Play your custom notification sound", Volume2],
            ["desktop", "Desktop notifications", "Show alerts outside the app window", Monitor],
            ["mobile", "Mobile notifications", "Use native notification alerts in the app", Smartphone],
          ].map(([key, title, description, Icon]) => (
            <div key={key} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: T.paperDim }}>
              <Icon size={17} style={{ color: T.jacaranda }} />
              <div className="flex-1"><div className="f-body font-semibold" style={{ color: T.ink, fontSize: 12 }}>{title}</div><div className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>{description}</div></div>
              <Toggle checked={prefs[key]} onChange={(value) => update({ [key]: value })} />
            </div>
          ))}

          <button type="button" onClick={test} disabled={testing || !prefs.enabled}
            className="w-full rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-semibold"
            style={{ background: T.jacaranda, color: T.paper, border: "none", opacity: testing || !prefs.enabled ? .55 : 1 }}>
            <Check size={16}/> {testing ? "Sending test…" : "Test ImbaTone"}
          </button>

          <div className="f-body rounded-2xl p-3" style={{ background: T.paperDim, color: T.ink60, fontSize: 10.5, lineHeight: 1.45 }}>
            For custom sounds, add your files to <strong style={{ color: T.ink }}>public/sounds/</strong> using the names documented in the project notification setup guide. Native iOS/Android builds also require the sound files to be bundled into the native app.
          </div>
        </div>
      </div>
    </div>
  );
}
