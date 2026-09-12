import ContractorRegistration from "../components/contractor/ContractorRegistration";
import useMediaQuery from "../hooks/useMediaQuery";
import { T } from "../styles/tokens";
import ContractorProfileView from "./ContractorsPage/ContractorProfileView";
import { useContractorSearch } from "./ContractorsPage/useContractorSearch";
import ContractorsHeroHeader from "./ContractorsPage/ContractorsHeroHeader";
import ContractorsToolbar from "./ContractorsPage/ContractorsToolbar";
import ContractorsGrid from "./ContractorsPage/ContractorsGrid";

export default function ContractorsPage({
  contractors = [],
  liked = new Set(),
  setLiked,
  registration,
  onRegister,
  profile,
  setTab,
  setMessagesState,
}) {
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");

  const {
    showRegistration, setShowRegistration,
    selectedContractor, openContractorProfile, closeContractorProfile,
    query, setQuery, category, setCategory,
    categories, results,
    toggleLike, handleRequestQuote,
  } = useContractorSearch({ contractors, setLiked, setMessagesState, setTab });

  if (selectedContractor) {
    return (
      <ContractorProfileView
        contractor={selectedContractor}
        liked={liked}
        isTabletOrDesktop={isTabletOrDesktop}
        onClose={closeContractorProfile}
        onToggleLike={toggleLike}
        onRequestQuote={handleRequestQuote}
      />
    );
  }

  /*
   * ------------------------------------------------------------
   * CONTRACTOR LIST VIEW
   * ------------------------------------------------------------
   */

  return (
    <div className="pb-8 web-page" style={{ minHeight: "100vh", background: T.paperDim }}>
      {/* Sticky header (mobile) / page title (tablet+desktop) */}
      <ContractorsHeroHeader
        isTabletOrDesktop={isTabletOrDesktop}
        registration={registration}
        setShowRegistration={setShowRegistration}
      />

      {/* Content */}
      <div
        className={isTabletOrDesktop ? "web-surface" : undefined}
        style={{
          background: T.paper,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          minHeight: 600,
          overflow: "hidden",
          marginTop: isTabletOrDesktop ? 10 : 0,
        }}
      >
        {/* Search & filters */}
        <ContractorsToolbar
          isTabletOrDesktop={isTabletOrDesktop}
          query={query}
          setQuery={setQuery}
          category={category}
          setCategory={setCategory}
          categories={categories}
          results={results}
          registration={registration}
          setShowRegistration={setShowRegistration}
        />

        {/* Contractor grid */}
        <ContractorsGrid
          results={results}
          liked={liked}
          openContractorProfile={openContractorProfile}
          toggleLike={toggleLike}
          handleRequestQuote={handleRequestQuote}
        />
      </div>

      {/* Registration modal */}
      {showRegistration && (
        <ContractorRegistration
          profile={profile}
          onClose={() => setShowRegistration(false)}
          onSubmit={async (data) => {
            try {
              await onRegister?.(data);
              setShowRegistration(false);
            } catch (error) {
              console.error("Contractor registration failed:", error);
            }
          }}
        />
      )}
    </div>
  );
}
