import { T } from "../../../styles/tokens";

export default function AboutSection({ contractor, businessName }) {
  return (
    <section style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 20, padding: "18px", marginBottom: 14 }}>
      <h2 className="f-display" style={{ margin: 0, fontSize: 15, color: T.ink }}>
        About this contractor
      </h2>

      <p className="f-body" style={{ margin: "8px 0 0", color: T.ink60, fontSize: 12, lineHeight: 1.7 }}>
        {contractor.description || `${businessName} provides professional ${contractor.category || "property"} services through ImbaLink.`}
      </p>
    </section>
  );
}
