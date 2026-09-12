import GridTile from "../../components/property/GridTile";
import PostCard from "../../components/property/PostCard";

export default function StudentHomeTile({
  property,
  isTabletOrDesktop,
  isDesktopLayout,
  liked,
  saved,
  toggleLike,
  toggleSave,
  openProperty,
  onOpenLister,
  viewingRequested,
  onRequestViewing,
  onSend,
  onOpenMessage,
  showRoommateAction,
  roommateCount,
  onFindRoommate,
}) {
  return (
    <div className="student-home-tile">
      {isTabletOrDesktop ? (
        <GridTile
          p={property}
          onOpen={openProperty}
          compactDesktop={isDesktopLayout}
          showRoommateAction={showRoommateAction}
          roommateCount={roommateCount}
          onFindRoommate={onFindRoommate}
        />
      ) : (
        <PostCard
          p={property}
          liked={liked}
          saved={saved}
          onToggleLike={toggleLike}
          onToggleSave={toggleSave}
          onOpen={openProperty}
          onOpenLister={onOpenLister}
          viewingRequested={!!viewingRequested?.[property.id]}
          onRequestViewing={() => onRequestViewing?.(property.id)}
          onSend={onSend}
          onOpenMessage={onOpenMessage}
          showDistance={false}
          showRoommateAction={showRoommateAction}
          roommateCount={roommateCount}
          onFindRoommate={onFindRoommate}
        />
      )}
    </div>
  );
}
