import { T } from "../../styles/tokens";

function UnreadBadge({ count }) {
  if (count <= 0) return null;

  return (
    <div
      aria-label={`${count} unread message${
        count === 1
          ? ""
          : "s"
      }`}
      style={{
        minWidth:
          count > 9 ? 24 : 20,
        height: 20,
        borderRadius: 999,
        background:
          T.jacaranda,
        color: T.paper,
        fontSize: 11,
        fontWeight: 600,
        padding: "0 6px",
        display: "flex",
        alignItems:
          "center",
        justifyContent:
          "center",
        boxShadow:
          "0 2px 8px rgba(108,56,255,0.4)",
        flexShrink: 0,
      }}
    >
      {count > 9
        ? "9+"
        : count}
    </div>
  );
}

// Shared "nothing to show yet" treatment for the inbox panel — used for the
// empty state, the loading state, and the error state so all three look
// like the same design language instead of three different one-offs.
function InboxStatus({ icon: Icon, label, sublabel, spin, actionLabel, onAction }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: T.ink60,
        fontSize: 14,
        textAlign: "center",
        padding: "0 24px",
      }}
    >
      <Icon
        size={56}
        color={T.ink60}
        className={spin ? "spin" : undefined}
        style={{ opacity: 0.2, marginBottom: 16 }}
      />
      <div style={{ fontWeight: 500 }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>{sublabel}</div>
      )}
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 14,
            border: `1px solid ${T.jacaranda}`,
            background: "transparent",
            color: T.jacaranda,
            borderRadius: 999,
            padding: "6px 18px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Same idea as InboxStatus but sized/positioned for the (already-scrollable)
// message list area instead of the full inbox panel.
function MessageAreaStatus({ icon: Icon, label, sublabel, spin }) {
  return (
    <div
      className="text-center py-16"
      style={{ color: T.ink60, fontSize: 14 }}
    >
      <Icon
        size={40}
        color={T.ink60}
        className={spin ? "spin" : undefined}
        style={{ opacity: 0.3, marginBottom: 12 }}
      />
      <div>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>{sublabel}</div>
      )}
    </div>
  );
}

export { UnreadBadge, InboxStatus, MessageAreaStatus };
