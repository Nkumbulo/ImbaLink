import { ShieldCheck } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function VerificationBanner({ contractor }) {
  if (!contractor.verified) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 16,
        background: "color-mix(in srgb, var(--theme-green) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--theme-green) 22%, transparent)",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--theme-green) 12%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ShieldCheck size={18} color={T.msasa} />
      </div>

      <div>
        <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 12 }}>
          Verified contractor
        </div>

        <div className="f-body" style={{ color: T.ink60, fontSize: 10.5, marginTop: 2 }}>
          This contractor has completed ImbaLink's verification process.
        </div>
      </div>
    </div>
  );
}
