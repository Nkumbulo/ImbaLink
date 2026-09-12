import { T } from "../../styles/tokens";
import { HEADER_TRANSITION_MS } from "./searchConstants";
import SearchBar from "./SearchBar";
import FilterPillsRow from "./FilterPillsRow";
import ResultsCountBar from "./ResultsCountBar";

export default function SearchHeader({
  headerRef,
  leaving,
  query,
  setQuery,
  searchPlaceholder,
  setShowFilters,
  isAnyFilterActive,
  studentMode,
  isOnline,
  dropdownRef,
  filters,
  setFilters,
  priceCeiling,
  clearAll,
  sort,
  setSort,
  openDropdown,
  setOpenDropdown,
  toggleDropdown,
  propertyTypes,
  setRandomSeed,
  sortedResults,
  activeFilterCount,
}) {
  return (
    <div
      ref={headerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: T.paper,
        transform: leaving ? "translateY(-100%)" : "translateY(0)",
        transition: `transform ${HEADER_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        willChange: "transform",
      }}
    >
      <div className="px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 0px))", paddingBottom: 10 }}>
        <SearchBar
          query={query}
          setQuery={setQuery}
          searchPlaceholder={searchPlaceholder}
          setShowFilters={setShowFilters}
          isAnyFilterActive={isAnyFilterActive}
          studentMode={studentMode}
          isOnline={isOnline}
        />

        <FilterPillsRow
          dropdownRef={dropdownRef}
          filters={filters}
          setFilters={setFilters}
          priceCeiling={priceCeiling}
          isAnyFilterActive={isAnyFilterActive}
          clearAll={clearAll}
          sort={sort}
          setSort={setSort}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          toggleDropdown={toggleDropdown}
          propertyTypes={propertyTypes}
          setRandomSeed={setRandomSeed}
        />

        <ResultsCountBar
          sortedResults={sortedResults}
          activeFilterCount={activeFilterCount}
          filters={filters}
          setFilters={setFilters}
          setRandomSeed={setRandomSeed}
        />
      </div>
    </div>
  );
}
