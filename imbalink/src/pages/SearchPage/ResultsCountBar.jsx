import { ShieldCheck } from "lucide-react";
import { T } from "../../styles/tokens";
import ToggleSwitch from "../../components/common/ToggleSwitch";

export default function ResultsCountBar({ sortedResults, activeFilterCount, filters, setFilters, setRandomSeed }) {
  return (
    <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
      <span className="f-body" style={{ color: T.ink60, fontSize: 11.5 }}>
        {sortedResults.length} results
        {activeFilterCount > 0 && (
          <>
            {" "}·{" "}
            <span className="font-semibold" style={{ color: T.ink }}>
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
            </span>
          </>
        )}
      </span>
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={12} style={{ color: filters.verifiedOnly ? T.msasa : T.ink60 }} />
        <span className="f-body font-medium" style={{ color: filters.verifiedOnly ? T.msasa : T.ink60, fontSize: 11 }}>Verified only</span>
        <ToggleSwitch on={filters.verifiedOnly} onToggle={() => { setFilters((f) => ({ ...f, verifiedOnly: !f.verifiedOnly })); setRandomSeed(0); }} />
      </div>
    </div>
  );
}
