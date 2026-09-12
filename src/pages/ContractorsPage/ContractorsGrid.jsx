import { Wrench } from "lucide-react";
import { T } from "../../styles/tokens";
import ContractorCard from "./ContractorCard";

export default function ContractorsGrid({ results, liked, openContractorProfile, toggleLike, handleRequestQuote }) {
  return (
    <div
      className="web-contractor-grid px-4 pt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      style={{ paddingBottom: 24 }}
    >
      {results.map((contractor) => (
        <ContractorCard
          key={contractor.id}
          contractor={contractor}
          liked={liked}
          openContractorProfile={openContractorProfile}
          toggleLike={toggleLike}
          handleRequestQuote={handleRequestQuote}
        />
      ))}

      {results.length === 0 && (
        <div
          className="text-center py-14 f-body"
          style={{ color: T.ink60, fontSize: 12, gridColumn: "1 / -1" }}
        >
          <Wrench size={38} style={{ opacity: 0.2, margin: "0 auto 12px" }} />

          <div style={{ fontWeight: 500, color: T.ink }}>
            No contractors found
          </div>

          <div style={{ marginTop: 4, opacity: 0.7 }}>
            Try a different search or category.
          </div>
        </div>
      )}
    </div>
  );
}
