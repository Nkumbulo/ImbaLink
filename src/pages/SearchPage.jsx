import useOnlineStatus from "../hooks/useOnlineStatus";
import useMediaQuery from "../hooks/useMediaQuery";
import { useSearchPageState } from "./SearchPage/useSearchPageState";
import SearchHeader from "./SearchPage/SearchHeader";
import SearchResultsGrid from "./SearchPage/SearchResultsGrid";
import MobileDetailSheet from "./SearchPage/MobileDetailSheet";

export default function SearchPage({
  properties,
  query,
  setQuery,
  filters,
  setFilters,
  setShowFilters,
  results,
  studentMode = false,
  shareRequestCounts = {},
  onFindRoommate,
  openProperty,
  city,
  isActive = true,
  hasMore = false,
  loadingMore = false,
  loadMore,
  liked,
  saved,
  toggleLike,
  toggleSave,
  onOpenLister,
  viewingRequested,
  onRequestViewing,
  onSend,
  onOpenMessage,
}) {
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");
  const isOnline = useOnlineStatus();

  const {
    pageRef, headerRef, dropdownRef,
    headerHeight, leaving, activeCard, setActiveCard, selectDesktopCard,
    openDropdown, setOpenDropdown, sort, setSort, setRandomSeed,
    handleOpenProperty,
    propertyTypes, priceCeiling, activeFilterCount, isAnyFilterActive,
    sortedResults, hasMoreResults, loadMoreSentinelRef,
    searchPlaceholder, clearAll, toggleDropdown, handleSuburbClick,
    handleToggleLike, handleToggleSave, handleRequestViewing,
    handleSend, handleOpenMessage, handleOpenLister,
  } = useSearchPageState({
    properties, query, setQuery, filters, setFilters, results, city, isActive,
    hasMore, loadingMore, loadMore, openProperty, toggleLike, toggleSave,
    onRequestViewing, onSend, onOpenMessage, onOpenLister, isTabletOrDesktop,
  });

  return (
    <div ref={pageRef} className="pb-8 web-page search-page desktop-light-search-page" style={{ position: "relative" }}>
      <SearchHeader
        headerRef={headerRef}
        leaving={leaving}
        query={query}
        setQuery={setQuery}
        searchPlaceholder={searchPlaceholder}
        setShowFilters={setShowFilters}
        isAnyFilterActive={isAnyFilterActive}
        studentMode={studentMode}
        isOnline={isOnline}
        dropdownRef={dropdownRef}
        filters={filters}
        setFilters={setFilters}
        priceCeiling={priceCeiling}
        clearAll={clearAll}
        sort={sort}
        setSort={setSort}
        openDropdown={openDropdown}
        setOpenDropdown={setOpenDropdown}
        toggleDropdown={toggleDropdown}
        propertyTypes={propertyTypes}
        setRandomSeed={setRandomSeed}
        sortedResults={sortedResults}
        activeFilterCount={activeFilterCount}
      />

      <SearchResultsGrid
        headerHeight={headerHeight}
        sortedResults={sortedResults}
        clearAll={clearAll}
        isTabletOrDesktop={isTabletOrDesktop}
        liked={liked}
        saved={saved}
        handleToggleLike={handleToggleLike}
        handleToggleSave={handleToggleSave}
        handleOpenProperty={handleOpenProperty}
        selectDesktopCard={selectDesktopCard}
        activeCard={activeCard}
        handleOpenLister={handleOpenLister}
        viewingRequested={viewingRequested}
        handleRequestViewing={handleRequestViewing}
        handleSend={handleSend}
        handleOpenMessage={handleOpenMessage}
        handleSuburbClick={handleSuburbClick}
        filters={filters}
        studentMode={studentMode}
        shareRequestCounts={shareRequestCounts}
        onFindRoommate={onFindRoommate}
        hasMoreResults={hasMoreResults}
        loadMoreSentinelRef={loadMoreSentinelRef}
        loadingMore={loadingMore}
      />

      <MobileDetailSheet
        activeCard={activeCard}
        isTabletOrDesktop={isTabletOrDesktop}
        liked={liked}
        saved={saved}
        toggleLike={toggleLike}
        toggleSave={toggleSave}
        handleOpenProperty={handleOpenProperty}
        onOpenLister={onOpenLister}
        viewingRequested={viewingRequested}
        onRequestViewing={onRequestViewing}
        onSend={onSend}
        onOpenMessage={onOpenMessage}
        studentMode={studentMode}
        shareRequestCounts={shareRequestCounts}
        onFindRoommate={onFindRoommate}
        pageRef={pageRef}
        setActiveCard={setActiveCard}
      />
    </div>
  );
}
