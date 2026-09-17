import { T } from "../../styles/tokens";

export function StatCard({ label, value, growth, format = (v) => v }) {
  const growthNum = Number(growth);
  const hasGrowth = Number.isFinite(growthNum) && growthNum !== 0;
  return (
    <div className="rounded-2xl p-4" style={{ background: T.paperDim }}>
      <div className="f-body" style={{ color: T.ink60, fontSize: 11, marginBottom: 6 }}>{label}</div>
      <div className="f-display font-bold" style={{ color: T.ink, fontSize: 22 }}>{format(value)}</div>
      {hasGrowth && (
        <div
          className="f-mono"
          style={{ color: growthNum > 0 ? T.msasa : T.brick, fontSize: 10.5, marginTop: 4 }}
        >
          {growthNum > 0 ? "+" : ""}{growthNum}% vs prior period
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS = {
  verified: T.msasa,
  pending: T.ochre,
  rejected: T.brick,
  flagged: T.brick,
  open: T.ochre,
  reviewing: T.jacaranda,
  resolved: T.msasa,
  dismissed: T.ink60,
};

export function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || T.ink60;
  return (
    <span
      className="f-mono font-semibold inline-block"
      style={{
        color,
        background: `${color}1A`,
        fontSize: 9.5,
        letterSpacing: "0.04em",
        padding: "3px 8px",
        borderRadius: 999,
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

export function EmptyState({ label }) {
  return (
    <div
      className="f-body text-center"
      style={{ color: T.ink60, fontSize: 12.5, padding: "32px 0" }}
    >
      {label}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }) {
  return (
    <div
      className="f-body text-center"
      style={{ color: T.ink60, fontSize: 12.5, padding: "32px 0" }}
    >
      {label}
    </div>
  );
}

export function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 14 }}>{title}</div>
      {action}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="f-body w-full px-3 py-2 rounded-xl outline-none"
      style={{ background: T.paperDim, color: T.ink, fontSize: 12.5, border: `1px solid ${T.line}` }}
    />
  );
}

export function Pagination({ page, hasMore, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between mt-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="f-body px-3 py-1.5 rounded-full"
        style={{ background: T.paperDim, color: T.ink, fontSize: 11.5, opacity: page <= 1 ? 0.4 : 1, border: "none" }}
      >
        Previous
      </button>
      <span className="f-body" style={{ color: T.ink60, fontSize: 11 }}>Page {page}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasMore}
        className="f-body px-3 py-1.5 rounded-full"
        style={{ background: T.paperDim, color: T.ink, fontSize: 11.5, opacity: !hasMore ? 0.4 : 1, border: "none" }}
      >
        Next
      </button>
    </div>
  );
}
