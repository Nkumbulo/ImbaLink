import { Briefcase, MapPin } from "lucide-react";
import { T } from "../../../styles/tokens";

function InfoCard({ icon, label, value, valueStyle }) {
  return (
    <div style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 18, padding: "14px" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: T.paperDim,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        {icon}
      </div>

      <div className="f-body" style={{ fontSize: 10, color: T.ink60 }}>
        {label}
      </div>

      <div className="f-body font-semibold" style={{ fontSize: 12, color: T.ink, marginTop: 3, ...valueStyle }}>
        {value}
      </div>
    </div>
  );
}

export default function QuickInfoCards({ contractor }) {
  return (
    <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 14 }}>
      <InfoCard
        icon={<MapPin size={16} color={T.jacaranda} />}
        label="Service area"
        value={contractor.area || "Zimbabwe"}
      />
      <InfoCard
        icon={<Briefcase size={16} color={T.jacaranda} />}
        label="Service"
        value={contractor.category || "Property services"}
        valueStyle={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      />
    </div>
  );
}
