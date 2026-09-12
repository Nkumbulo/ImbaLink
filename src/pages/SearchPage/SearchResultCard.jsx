import { memo } from "react";
import GridTile from "../../components/property/GridTile";
import PostCard from "../../components/property/PostCard";

// Memoized card component for better performance
const SearchResultCard = memo(function SearchResultCard({
  property,
  index,
  isTabletOrDesktop,
  liked,
  saved,
  onToggleLike,
  onToggleSave,
  onOpen,
  onSelectCard,
  desktopSelected,
  onOpenLister,
  viewingRequested,
  onRequestViewing,
  onSend,
  onOpenMessage,
  showDistance,
  compactDesktop,
  onSuburbClick,
  activeSuburb,
  showRoommateAction,
  roommateCount,
  onFindRoommate,
}) {
  // Search results is where desktop users are actively evaluating and
  // acting on specific listings, so desktop/tablet gets the full-action
  // PostCard (like/save/request-viewing inline) and mobile gets the compact
  // GridTile. This is the OPPOSITE assignment from HomePage.jsx's browsing
  // feed (GridTile on desktop, PostCard on mobile) -- intentional, see the
  // comment there for the reasoning behind each.
  if (isTabletOrDesktop) {
    return (
      <PostCard
        p={property}
        index={index}
        liked={liked}
        saved={saved}
        onToggleLike={onToggleLike}
        onToggleSave={onToggleSave}
        onOpen={onOpen}
        onSelectCard={onSelectCard}
        desktopSelected={desktopSelected}
        onOpenLister={onOpenLister}
        viewingRequested={viewingRequested}
        onRequestViewing={() => onRequestViewing?.(property.id)}
        onSend={onSend}
        onOpenMessage={onOpenMessage}
        showDistance={showDistance}
        compactDesktop={compactDesktop}
        showRoommateAction={showRoommateAction}
        roommateCount={roommateCount}
        onFindRoommate={onFindRoommate}
      />
    );
  }

  return (
    <GridTile
      p={property}
      onOpen={onOpen}
      onSuburbClick={onSuburbClick}
      activeSuburb={activeSuburb}
      showRoommateAction={showRoommateAction}
      roommateCount={roommateCount}
      onFindRoommate={onFindRoommate}
    />
  );
});

export default SearchResultCard;
