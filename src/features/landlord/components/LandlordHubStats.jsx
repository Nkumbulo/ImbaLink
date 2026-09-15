import { T } from "../../../styles/tokens";

export default function LandlordHubStats({ stats, isTabletOrDesktop, isDesktop }) {
  const gridStyle = isTabletOrDesktop
    ? { gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }
    : { gridTemplateColumns: "repeat(4, 1fr)", gap: 8 };

  return (
    <div className="grid" style={gridStyle}>
      {stats.map(([n, label, Icon]) => (
        <div key={label} className="rounded-2xl p-2.5 text-center" style={{ background: T.paperDim }}>
          <Icon size={isDesktop ? 20 : 15} className="mx-auto mb-1" style={{ color: T.jacaranda }} />
          <div className="f-display font-bold" style={{ color: T.ink, fontSize: isDesktop ? 18 : 15 }}>{n}</div>
          <div className="f-body" style={{ color: T.ink60, fontSize: isDesktop ? 11 : 9.5 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
