import { ShieldCheck, Star } from "lucide-react";
import { T } from "../../../styles/tokens";
import Avatar from "../../../components/common/Avatar";

export default function ProfileHero({ contractor, businessName, contractorName, displayedRating }) {
  return (
    <div className="contractor-detail-dark" style={{ background: T.ink, padding: "8px 20px 30px", color: T.paper }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Avatar
            src={contractor.avatarUrl}
            grad={["#6E63B8", "#3E3670"]}
            letter={(contractorName?.[0] || businessName?.[0] || "?").toUpperCase()}
            size={82}
            alt={`${contractorName || businessName} profile picture`}
          />

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <h1 className="f-display" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: T.paper, lineHeight: 1.1 }}>
                {businessName}
              </h1>

              {contractor.verified && (
                <ShieldCheck size={19} color={T.msasa} />
              )}
            </div>

            <div className="f-body" style={{ marginTop: 6, color: "rgba(251,248,240,.65)", fontSize: 12 }}>
              {contractorName}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.paper }}>
                <Star size={13} fill={T.ochre} color={T.ochre} />
                {displayedRating.toFixed(1)}
              </span>

              {contractor.category && (
                <span
                  style={{
                    padding: "4px 9px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.09)",
                    color: "rgba(251,248,240,.8)",
                    fontSize: 10,
                  }}
                >
                  {contractor.category}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
