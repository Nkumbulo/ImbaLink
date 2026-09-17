import { ChevronDown } from "lucide-react";
import { T } from "../../styles/tokens";

export default function FilterPill({ label, active, onClick, icon: Icon = ChevronDown, emoji }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="f-body font-medium px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 active:scale-95 flex items-center gap-1"
      style={{
        background: active ? T.msasa : T.paperDim,
        color: active ? T.paper : T.ink,
        fontSize: 11.5,
        border: `1px solid ${active ? T.msasa : T.line}`,
        cursor: "pointer",
      }}
    >
      {label}
      {emoji ? (
        <span style={{ fontSize: 11, lineHeight: 1, display: "inline-flex", transform: "translateY(0.5px)" }}>
          {emoji}
        </span>
      ) : (
        <Icon size={12} style={{ opacity: 0.7 }} />
      )}
    </button>
  );
}
