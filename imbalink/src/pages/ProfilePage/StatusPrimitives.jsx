import { Lock, ArrowRight, Crown, BadgeCheck, ShieldQuestion } from "lucide-react";
import { T } from "../../styles/tokens";
import { GOLD } from "./constants";

export function Stat({ n, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 transition-transform active:scale-95"
      style={{ background: T.paperDim, WebkitTapHighlightColor: "transparent" }}
    >
      <span className="f-display font-bold" style={{ color: T.ink, fontSize: 15 }}>{n}</span>
      <span className="f-body" style={{ color: T.ink60, fontSize: 10.5 }}>{label}</span>
    </button>
  );
}

export function HubButton({ onClick, iconBg, icon: Icon, title, subtitle, dark, locked }) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-left mb-2"
      style={{
        background: dark && !locked ? T.ink : T.paperDim,
        color: dark && !locked ? T.paper : T.ink,
        opacity: locked ? 0.5 : 1,
        cursor: locked ? "not-allowed" : "pointer",
      }}
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: locked ? T.ink60 : iconBg, color: T.paper }}>
        <Icon size={18}/>
      </span>
      <span className="flex-1 min-w-0">
        <span className="f-display font-semibold block" style={{ fontSize: 13 }}>{title}</span>
        <span className="f-body block mt-0.5" style={{ color: dark && !locked ? undefined : T.ink60, opacity: dark && !locked ? 0.65 : 1, fontSize: 10.5 }}>
          {subtitle}
        </span>
      </span>
      {locked ? <Lock size={14} style={{ color: T.ink60 }}/> : <ArrowRight size={16}/>}
    </button>
  );
}

export function ProBadge({ isPro, onClick }) {
  if (isPro) {
    return (
      <span className="flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 shrink-0" style={{ background: `${GOLD}1F` }}>
        <Crown size={10.5} style={{ color: GOLD }}/>
        <span className="f-mono font-semibold" style={{ color: GOLD, fontSize: 9.5, letterSpacing: ".04em" }}>PRO</span>
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 shrink-0 transition-transform active:scale-95"
      style={{ background: `${GOLD}1F` }}
    >
      <Crown size={10.5} style={{ color: GOLD }}/>
      <span className="f-mono font-semibold" style={{ color: GOLD, fontSize: 9.5, letterSpacing: ".04em" }}>GO PRO</span>
    </button>
  );
}

// Verified/pending/unverified badge for a Student Login account. Never
// claims "verified" unless studentVerificationStatus actually is —
// see the verification rule in services/DATABASE-SCHEMA.md.
export function StudentVerificationBadge({ status }) {
  if (status === "verified") {
    return (
      <span className="flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 shrink-0" style={{ background: "rgba(62,145,90,.14)" }}>
        <BadgeCheck size={11} style={{ color: T.msasa }} />
        <span className="f-mono font-semibold" style={{ color: T.msasa, fontSize: 9.5, letterSpacing: ".04em" }}>VERIFIED STUDENT</span>
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 shrink-0" style={{ background: "rgba(108,56,255,.12)" }}>
        <ShieldQuestion size={11} style={{ color: T.jacaranda }} />
        <span className="f-mono font-semibold" style={{ color: T.jacaranda, fontSize: 9.5, letterSpacing: ".04em" }}>VERIFICATION PENDING</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 shrink-0" style={{ background: T.paperDim }}>
      <ShieldQuestion size={11} style={{ color: T.ink60 }} />
      <span className="f-mono font-semibold" style={{ color: T.ink60, fontSize: 9.5, letterSpacing: ".04em" }}>UNVERIFIED</span>
    </span>
  );
}
