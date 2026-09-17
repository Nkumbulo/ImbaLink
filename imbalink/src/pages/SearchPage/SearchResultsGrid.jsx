import { T } from "../../styles/tokens";
import { isShareableProperty } from "../../utils/studentHelpers";
import SearchResultCard from "./SearchResultCard";

export default function SearchResultsGrid({
  headerHeight,
  sortedResults,
  clearAll,
  isTabletOrDesktop,
  liked,
  saved,
  handleToggleLike,
  handleToggleSave,
  handleOpenProperty,
  selectDesktopCard,
  activeCard,
  handleOpenLister,
  viewingRequested,
  handleRequestViewing,
  handleSend,
  handleOpenMessage,
  handleSuburbClick,
  filters,
  studentMode,
  shareRequestCounts,
  onFindRoommate,
  hasMoreResults,
  loadMoreSentinelRef,
  loadingMore,
}) {
  return (
    <div className="web-search-content desktop-light-content" style={{ paddingTop: `calc(${headerHeight}px + env(safe-area-inset-top, 0px))`, background: T.paper, minHeight: 500 }}>
      {sortedResults.length === 0 ? (
        <div className="fade text-center py-14 px-6" style={{ minHeight: 300 }}>
          <div className="f-body" style={{ color: T.ink60, fontSize: 13 }}>No matches — try adjusting your filters or search.</div>
          <button type="button" onClick={clearAll} className="f-body font-semibold mt-3 px-4 py-2 rounded-full" style={{ background: T.paperDim, color: T.ink, fontSize: 12, border: "none", cursor: "pointer" }}>Clear filters</button>
        </div>
      ) : (
        <div className="web-search-grid px-4" style={{ paddingTop: 8 }} role="list">
          {sortedResults.map((property, index) => (
            <SearchResultCard
              key={property.id}
              property={property}
              index={index}
              isTabletOrDesktop={isTabletOrDesktop}
              liked={liked?.has ? liked.has(String(property.id)) : false}
              saved={saved?.has ? saved.has(String(property.id)) : false}
              onToggleLike={handleToggleLike}
              onToggleSave={handleToggleSave}
              onOpen={handleOpenProperty}
              onSelectCard={selectDesktopCard}
              desktopSelected={!!activeCard && String(activeCard.id) === String(property.id)}
              onOpenLister={handleOpenLister}
              viewingRequested={!!viewingRequested?.[property.id]}
              onRequestViewing={handleRequestViewing}
              onSend={handleSend}
              onOpenMessage={handleOpenMessage}
              showDistance={false}
              compactDesktop={isTabletOrDesktop}
              onSuburbClick={handleSuburbClick}
              activeSuburb={filters.suburb}
              showRoommateAction={studentMode && isShareableProperty(property)}
              roommateCount={shareRequestCounts[String(property.id)] || 0}
              onFindRoommate={onFindRoommate}
            />
          ))}
        </div>
      )}
      {hasMoreResults && (
        <div ref={loadMoreSentinelRef} data-imbalink-search-load-more aria-hidden="true" style={{ height: 1 }}>
          {loadingMore && (
            <div style={{ padding: "12px 0", textAlign: "center", fontSize: 11, color: T.muted }}>
              Loading more homes…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
