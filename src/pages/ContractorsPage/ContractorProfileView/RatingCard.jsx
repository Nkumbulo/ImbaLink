import { Star } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function RatingCard({ displayedRating }) {
  return (
    <section style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 20, padding: "18px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 className="f-display" style={{ margin: 0, fontSize: 15, color: T.ink }}>
            Contractor rating
          </h2>

          <div className="f-body" style={{ marginTop: 4, fontSize: 10.5, color: T.ink60 }}>
            Based on ImbaLink recommendations
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Star size={18} fill={T.ochre} color={T.ochre} />

          <span className="f-display font-bold" style={{ fontSize: 20, color: T.ink }}>
            {displayedRating.toFixed(1)}
          </span>
        </div>
      </div>
    </section>
  );
}
