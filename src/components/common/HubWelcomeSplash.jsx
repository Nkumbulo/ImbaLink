import { Building2, CheckCircle2, ChevronRight, ShieldCheck, Sparkles, X } from "lucide-react";
import { T } from "../../styles/tokens";

export default function HubWelcomeSplash({ hubType = "landlord", onContinue }) {
  const isCompany = hubType === "company";
  const title = isCompany ? "Welcome to Company Hub" : "Welcome to Landlord Hub";
  const subtitle = isCompany
    ? "Your company workspace is ready. Manage properties, your team, conversations and performance from one place."
    : "Your landlord workspace is ready. Manage properties, viewings and tenant conversations from one place.";

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ background: "rgba(9, 17, 13, 0.58)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full overflow-hidden rounded-t-[32px] border-t md:max-w-3xl md:rounded-[32px] md:mb-6"
        style={{
          minHeight: "50vh",
          background: T.paper,
          borderColor: "rgba(20,32,26,.10)",
          boxShadow: "0 -24px 80px rgba(0,0,0,.22)",
        }}
      >
        <div
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "rgba(222,197,164,.30)" }}
        />
        <div
          className="absolute -left-28 bottom-0 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "rgba(47,122,85,.12)" }}
        />

        <button
          type="button"
          onClick={onContinue}
          aria-label="Close welcome message"
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95"
          style={{ background: "rgba(20,32,26,.07)", color: T.ink }}
        >
          <X size={17} />
        </button>

        <div className="relative flex min-h-[50vh] flex-col justify-between px-6 pb-7 pt-12 sm:px-10 sm:pb-10 sm:pt-14">
          <div>
            <div
              className="mb-7 flex h-16 w-16 items-center justify-center rounded-[20px] shadow-sm"
              style={{ background: T.ink, color: T.gold || "#DEC5A4" }}
            >
              {isCompany ? <Building2 size={29} strokeWidth={1.8} /> : <ShieldCheck size={30} strokeWidth={1.8} />}
            </div>

            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: T.msasa || "#2F7A55" }}>
              <CheckCircle2 size={14} /> Registration complete
            </div>

            <h2
              className="f-display max-w-xl font-extrabold leading-[0.98]"
              style={{ color: T.ink, fontSize: "clamp(34px, 6vw, 58px)", letterSpacing: "-0.04em" }}
            >
              {title}
            </h2>

            <p className="f-body mt-5 max-w-xl text-sm leading-6 sm:text-base" style={{ color: T.muted || "rgba(20,32,26,.62)" }}>
              {subtitle}
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs font-semibold" style={{ color: T.ink, opacity: 0.72 }}>
              <Sparkles size={15} />
              Everything is synced to your ImbaLink account.
            </div>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold shadow-lg transition-transform active:scale-[.99]"
            style={{ background: T.ink, color: T.paper }}
          >
            Continue to {isCompany ? "Company Hub" : "Landlord Hub"}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
