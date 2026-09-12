import { T } from "../../../styles/tokens";

export default function ContactSection({ contractor }) {
  return (
    <section style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 20, padding: "18px", marginBottom: 20 }}>
      <h2 className="f-display" style={{ margin: 0, fontSize: 15, color: T.ink }}>
        Contact
      </h2>

      <div className="f-body" style={{ marginTop: 8, fontSize: 12, color: T.ink60 }}>
        {contractor.phone || "Phone number not available"}
      </div>
    </section>
  );
}
