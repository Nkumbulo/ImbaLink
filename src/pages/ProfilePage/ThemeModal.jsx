import { useEffect, useState } from "react";
import { Check, X, Palette } from "lucide-react";
import { THEMES } from "./constants";

function ThemeModal({ theme, onSelect, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 180);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose theme"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{ background: "rgba(20,32,26,.48)", opacity: visible ? 1 : 0, transition: "opacity .18s ease" }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5"
        style={{ background: "var(--theme-surface, #FBF8F0)", transform: visible ? "translateY(0)" : "translateY(18px)", transition: "transform .22s ease", boxShadow: "0 24px 70px rgba(0,0,0,.24)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--theme-green-soft)", color: "var(--theme-green)" }}>
              <Palette size={17} />
            </span>
            <div>
              <div className="f-display font-bold" style={{ color: "var(--theme-ink)", fontSize: 16 }}>Theme</div>
              <div className="f-body" style={{ color: "var(--theme-muted)", fontSize: 10.5 }}>Choose your ImbaLink colour palette</div>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Close theme chooser" style={{ color: "var(--theme-muted)" }}><X size={18} /></button>
        </div>

        <div className="mt-4 space-y-2.5">
          {THEMES.map((item) => {
            const active = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
                style={{
                  background: active ? item.soft : "var(--theme-surface-2)",
                  border: `1px solid ${active ? item.color : "var(--theme-line)"}`,
                  boxShadow: active ? `0 0 0 2px ${item.color}20` : "none",
                }}
              >
                <span className="w-11 h-11 rounded-xl shrink-0" style={{ background: `linear-gradient(145deg, ${item.color}, ${item.deep})` }} />
                <span className="flex-1 min-w-0">
                  <span className="block f-display font-semibold" style={{ color: "var(--theme-ink)", fontSize: 13 }}>{item.name}</span>
                  <span className="block f-body mt-0.5" style={{ color: "var(--theme-muted)", fontSize: 10.5 }}>{item.description}</span>
                </span>
                <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ border: `2px solid ${active ? item.color : "var(--theme-line)"}`, background: active ? item.color : "transparent" }}>
                  {active && <Check size={13} style={{ color: "#fff" }} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl px-3 py-2.5" style={{ background: "var(--theme-surface-2)", color: "var(--theme-muted)", fontSize: 10.5 }}>
          Your theme is saved on this device and only changes colours and supporting UI accents — your layout stays the same.
        </div>
      </div>
    </div>
  );
}

export default ThemeModal;
