import { T } from "../../styles/tokens";
import ProfileHeader from "./ContractorProfileView/ProfileHeader";
import ProfileHero from "./ContractorProfileView/ProfileHero";
import VerificationBanner from "./ContractorProfileView/VerificationBanner";
import QuickInfoCards from "./ContractorProfileView/QuickInfoCards";
import AboutSection from "./ContractorProfileView/AboutSection";
import RatingCard from "./ContractorProfileView/RatingCard";
import ContactSection from "./ContractorProfileView/ContactSection";
import ProfileActionButtons from "./ContractorProfileView/ProfileActionButtons";

// Previously an inline `if (selectedContractor) { return (...) }` early
// return inside ContractorsPage's render — a genuinely self-contained
// alternate view (confirmed via grep it only ever touches `liked`,
// `closeContractorProfile`, `toggleLike`, `handleRequestQuote` from the
// parent's scope, all passed through as props here under their new
// names). The parent now renders this component conditionally itself
// (`{selectedContractor && <ContractorProfileView .../>}`), so the
// original inner `if (selectedContractor) {...}` wrapper and its
// `const contractor = selectedContractor;` reassignment were removed —
// `contractor` is simply this component's own prop now.
export default function ContractorProfileView({ contractor, liked, isTabletOrDesktop, onClose, onToggleLike, onRequestQuote }) {
  /*
   * ------------------------------------------------------------
   * CONTRACTOR PROFILE VIEW
   * ------------------------------------------------------------
   */

  const contractorKey = String(contractor.id);
  const isLiked = liked?.has(contractorKey);
  const displayedRating = Math.min(5, Number(contractor.rating || 0) + (isLiked ? 0.1 : 0));
  const businessName = contractor.business || contractor.name || "Contractor";
  const contractorName = contractor.name || "Contractor";

  return (
    <div className="web-page pb-10" style={{ minHeight: "100vh", background: T.paperDim }}>
      <ProfileHeader
        onClose={onClose}
        onToggleLike={onToggleLike}
        contractorId={contractor.id}
        isLiked={isLiked}
      />

      <ProfileHero
        contractor={contractor}
        businessName={businessName}
        contractorName={contractorName}
        displayedRating={displayedRating}
      />

      {/* Main profile content */}
      <div
        className={isTabletOrDesktop ? "contractors-detail-columns" : undefined}
        style={{ maxWidth: 1000, margin: "0 auto", padding: "16px" }}
      >
        <div className={isTabletOrDesktop ? "contractors-detail-main" : undefined}>
          <VerificationBanner contractor={contractor} />
          <QuickInfoCards contractor={contractor} />
          <AboutSection contractor={contractor} businessName={businessName} />
        </div>

        <div className={isTabletOrDesktop ? "contractors-detail-side" : undefined}>
          <RatingCard displayedRating={displayedRating} />
          <ContactSection contractor={contractor} />
          <ProfileActionButtons
            contractor={contractor}
            isTabletOrDesktop={isTabletOrDesktop}
            onRequestQuote={onRequestQuote}
          />
        </div>
      </div>
    </div>
  );
}
