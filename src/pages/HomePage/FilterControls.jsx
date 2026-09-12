import { ChevronDown } from "lucide-react";
import { T } from "../../styles/tokens";

export function FilterPill({
  label,
  ariaLabel,
  active,
  onClick,
  icon: Icon = ChevronDown,
  emoji,
  pressed,
  onPress,
  iconSize = 11,
  showActiveDotOnly = false,
  dense = false,
}) {
  const hasLabel = Boolean(label);

  const activeBg = "#DEC5A4";
  const activeText = T.ink;
  const inactiveBg = "rgba(255,255,255,0.08)";
  const inactiveText = T.paper;

  const effectiveActive = showActiveDotOnly ? false : active;
  const bg = effectiveActive ? activeBg : inactiveBg;
  const textColor = effectiveActive ? activeText : inactiveText;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label || "filter"}
      onPointerDown={() => onPress?.(true)}
      onPointerUp={() => onPress?.(false)}
      onPointerLeave={() => onPress?.(false)}
      onPointerCancel={() => onPress?.(false)}
      className={`f-body font-medium flex items-center gap-1 ${dense ? "px-2 py-1" : "px-3 py-1.5"}`}
      style={{
        color: textColor,
        background: bg,
        fontSize: dense ? 10 : 10.5,
        minHeight: dense ? 34 : 44,
        borderRadius: 8,
        WebkitTapHighlightColor: "transparent",
        transitionProperty: "none",
        touchAction: "manipulation",
        transform: pressed ? "scale(0.95)" : "scale(1)",
        justifyContent: hasLabel ? "flex-start" : "center",
        whiteSpace: "nowrap",
      }}
    >
      {hasLabel && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
      {emoji ? (
        <span
          className="shrink-0"
          style={{
            fontSize: 10,
            lineHeight: 1,
            display: "inline-flex",
            transform: "translateY(0.5px)",
          }}
        >
          {emoji}
        </span>
      ) : (
        <Icon size={iconSize} className="shrink-0" style={{ opacity: active ? 0.9 : 0.7 }} />
      )}
      {showActiveDotOnly && active && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.paper, marginLeft: 1 }} />
      )}
    </button>
  );
}

// Updated to accept dropdown and open props
export function DesktopFilterField({ label, icon: Icon, value, onClick, style, dropdown, open }) {
  return (
    <div className="desktop-filter-field" style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 150px", minWidth: 140, position: "relative", ...style }}>
      <span className="f-body" style={{ fontSize: 12, color: T.ink60, fontWeight: 600 }}>
        {label}
      </span>
      <button
        type="button"
        onClick={onClick}
        className="f-body"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "10px 12px",
          background: "#fff",
          fontSize: 13,
          color: T.ink,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        <Icon size={15} style={{ color: T.ink60, flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </span>
        <ChevronDown size={14} style={{ color: T.ink60, flexShrink: 0 }} />
      </button>
      {open && dropdown}
    </div>
  );
}
