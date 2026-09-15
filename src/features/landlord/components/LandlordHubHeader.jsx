import { Plus, ShieldCheck, ChevronRight } from "lucide-react";
import { T } from "../../../styles/tokens";

export default function LandlordHubHeader({ isTabletOrDesktop, isDesktop, landlordRegistration, profile, onAdd }) {
  const actionLabel = landlordRegistration
    ? "Add a property"
    : (profile?.accountType === "landlord" ? "Verify Identity" : "Register as a landlord");

  return isTabletOrDesktop ? (
    <div className="px-4 pt-3" style={{ maxWidth: isDesktop ? 1200 : "100%", margin: isDesktop ? "0 auto" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div className="f-display font-bold" style={{ color: T.ink, fontSize: 24 }}>Landlord Hub</div>
          <div className="f-body mt-1" style={{ color: T.ink60, fontSize: 13 }}>
            Register first, then manage properties, viewings and tenant conversations.
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <button type="button" onClick={onAdd} className="contractors-desktop-register-btn">
            {landlordRegistration ? <Plus size={15} /> : <ShieldCheck size={15} />}
            {actionLabel}
          </button>
          {landlordRegistration && profile?.accountType !== "landlord" && (
            <div className="contractors-desktop-reg-status" style={{ textAlign: "right" }}>
              Status: {landlordRegistration.verificationStatus || "pending"}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="web-hero web-sticky-header" style={{ position: "sticky", top: 0, zIndex: 10, width: "100%", paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div style={{ padding: "12px 16px 16px" }}>
        <div className="f-display font-bold" style={{ color: T.bannerText, fontSize: 19 }}>Landlord Hub</div>
        <div className="f-body" style={{ color: T.bannerTextMuted, fontSize: 11.5, marginTop: 4 }}>
          Register first, then manage properties, viewings and tenant conversations.
        </div>
        <button type="button" onClick={onAdd} className="w-full rounded-2xl p-3 text-left flex items-center justify-between" style={{ background: T.paper, color: T.ink, border: "none", cursor: "pointer", marginTop: 12 }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: landlordRegistration ? T.brick : T.paperDim }}>
              {landlordRegistration ? <Plus size={17} /> : <ShieldCheck size={16} />}
            </span>
            <div className="min-w-0">
              <div className="f-display font-semibold" style={{ fontSize: 12.5 }}>{actionLabel}</div>
              <div className="f-body" style={{ fontSize: 10, color: T.ink60, marginTop: 2 }}>
                {profile?.accountType === "landlord" && !landlordRegistration
                  ? "Confirm your identity to keep your landlord account trusted."
                  : (landlordRegistration ? "Publish a rental listing" : "Complete registration before publishing a listing.")}
              </div>
            </div>
          </div>
          <ChevronRight size={17} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}
