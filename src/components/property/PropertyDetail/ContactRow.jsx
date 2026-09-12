import { ChevronRight } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function ContactRow({ method }) {
  const { label, value, href, Icon, iconBg } = method;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 active:scale-[0.98] transition-transform"
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        background: T.paperDim,
        textDecoration: "none",
      }}
    >
      <span
        className="flex items-center justify-center shrink-0"
        style={{ width: 38, height: 38, borderRadius: 12, background: iconBg }}
      >
        <Icon size={18} color={T.white} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 13 }}>
          {label}
        </div>
        <div className="f-body truncate" style={{ color: T.ink60, fontSize: 11.5 }}>
          {value}
        </div>
      </div>
      <ChevronRight size={16} color={T.ink60} />
    </a>
  );
}
