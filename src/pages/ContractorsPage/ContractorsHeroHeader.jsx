import { T } from "../../styles/tokens";

export default function ContractorsHeroHeader({ isTabletOrDesktop, registration, setShowRegistration }) {
  if (isTabletOrDesktop) {
    return (
      <div className="px-4 pt-3">
        <div className="f-display font-bold" style={{ color: T.ink, fontSize: 24 }}>
          Contractors
        </div>
        <div className="f-body" style={{ color: T.ink60, fontSize: 13, marginTop: 4 }}>
          Find trusted people for repairs, maintenance and property upgrades.
        </div>
      </div>
    );
  }

  return (
    <div
      className="web-hero web-sticky-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        width: "100%",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div style={{ padding: "12px 16px 16px" }}>
        <div className="f-display font-bold" style={{ color: T.bannerText, fontSize: 19 }}>
          Contractors
        </div>

        <div className="f-body" style={{ color: T.bannerTextMuted, fontSize: 11.5, marginTop: 4 }}>
          Find trusted people for repairs, maintenance and property upgrades.
        </div>

        <button
          onClick={() => setShowRegistration(true)}
          className="w-full rounded-2xl p-3 text-left"
          style={{
            background: T.paper,
            color: T.ink,
            border: "none",
            cursor: "pointer",
            marginTop: 12,
          }}
        >
          <div className="f-display font-semibold" style={{ fontSize: 12.5 }}>
            {registration ? "Manage contractor registration" : "Register as a contractor"}
          </div>

          <div className="f-body" style={{ fontSize: 10, color: T.ink60, marginTop: 2 }}>
            {registration
              ? `Application status: ${registration.verificationStatus || "pending"}`
              : "Create your contractor profile and submit it for verification."}
          </div>
        </button>
      </div>
    </div>
  );
}
