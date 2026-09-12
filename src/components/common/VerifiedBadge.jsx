import { useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, Clock3, ShieldAlert, X } from "lucide-react";
import { T } from "../../styles/tokens";

const CONFIG = {
  verified: {
    label: "Verified",
    color: T.msasa,
    Icon: ShieldCheck,
    title: "Verified landlord",
    body: "This landlord's identity has been checked against a government-issued ID. Listing details have also been reviewed for accuracy.",
  },
  pending: {
    label: "Pending",
    color: T.ochre,
    Icon: Clock3,
    title: "Verification pending",
    body: "This landlord is new to the platform and their ID verification is still in progress. Proceed with the usual care — meet in person and confirm details before paying anything.",
  },
  flagged: {
    label: "Flagged",
    color: T.brick,
    Icon: ShieldAlert,
    title: "Listing flagged",
    body: "One or more tenants have reported an issue with this listing (for example, unavailability on arrival or inaccurate details). It's under review — we'd recommend caution or choosing another listing.",
  },
};

export default function VerifiedBadge({ status, compact, size = 15 }) {
  const [open, setOpen] = useState(false);
  const cfg = CONFIG[status];
  if (!cfg) return null;

  const { label, color, Icon, title, body } = cfg;

  const show = (e) => {
    e.stopPropagation();
    setOpen(true);
  };
  const hide = (e) => {
    e?.stopPropagation();
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleCloseKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      hide(e);
    }
  };

  return (
    <>
      {compact ? (
        <span
          role="button"
          tabIndex={0}
          onClick={show}
          onKeyDown={handleKeyDown}
          className="inline-flex items-center justify-center rounded-full shrink-0"
          style={{
            width: size,
            height: size,
            background: color,
            border: "none",
            padding: 0,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
          aria-label={`${label} — tap to learn more`}
          title={label}
        >
          <Icon size={size * 0.62} color={T.white} strokeWidth={3} />
        </span>
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={show}
          onKeyDown={handleKeyDown}
          className="f-body inline-flex items-center gap-1 font-semibold px-2 rounded-full"
          style={{
            color: T.white,
            background: color,
            fontSize: 10.5,
            paddingTop: 3,
            paddingBottom: 3,
            border: "none",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
          aria-label={`${label} — tap to learn more`}
        >
          <Icon size={11} /> {label}
        </span>
      )}

      {open &&
        createPortal(
          <>
            <style>{`
              @keyframes badgeSheetBackdropIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes badgeSheetSlideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
              .badge-sheet-backdrop { animation: badgeSheetBackdropIn .18s ease both; }
              .badge-sheet-panel { animation: badgeSheetSlideUp .25s cubic-bezier(0.2,0.8,0.2,1) both; }
              @media (prefers-reduced-motion: reduce) {
                .badge-sheet-backdrop, .badge-sheet-panel { animation: none !important; }
              }
            `}</style>
            <div
              className="badge-sheet-backdrop fixed inset-0 flex items-end justify-center"
              style={{ background: "rgba(20,32,26,0.55)", zIndex: 9999 }}
              onClick={hide}
            >
              <div
                className="badge-sheet-panel"
                style={{
                  width: "100%",
                  maxWidth: 420,
                  background: T.paper,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
                  boxShadow: "0 -8px 30px rgba(0,0,0,0.25)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex items-center justify-center rounded-full shrink-0"
                      style={{ width: 34, height: 34, background: color }}
                    >
                      <Icon size={17} color={T.white} strokeWidth={2.5} />
                    </span>
                    <div>
                      <div className="f-display font-bold" style={{ color: T.ink, fontSize: 15 }}>
                        {title}
                      </div>
                      <div
                        className="f-body font-semibold"
                        style={{ color, fontSize: 10.5, letterSpacing: "0.02em", textTransform: "uppercase" }}
                      >
                        {label}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={hide}
                    onKeyDown={handleCloseKeyDown}
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: T.paperDim, border: "none", cursor: "pointer" }}
                    aria-label="Close"
                  >
                    <X size={16} color={T.ink} />
                  </button>
                </div>

                <p
                  className="f-body leading-relaxed"
                  style={{ color: T.ink60, fontSize: 13, marginTop: 14 }}
                >
                  {body}
                </p>

                <button
                  type="button"
                  onClick={hide}
                  onKeyDown={handleCloseKeyDown}
                  className="w-full f-display font-semibold"
                  style={{
                    marginTop: 18,
                    padding: "12px 0",
                    borderRadius: 999,
                    background: T.paperDim,
                    color: T.ink,
                    fontSize: 13.5,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}