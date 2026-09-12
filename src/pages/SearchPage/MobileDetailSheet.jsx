import PostCard from "../../components/property/PostCard";
import { isShareableProperty } from "../../utils/studentHelpers";

export default function MobileDetailSheet({
  activeCard,
  isTabletOrDesktop,
  liked,
  saved,
  toggleLike,
  toggleSave,
  handleOpenProperty,
  onOpenLister,
  viewingRequested,
  onRequestViewing,
  onSend,
  onOpenMessage,
  studentMode,
  shareRequestCounts,
  onFindRoommate,
  pageRef,
  setActiveCard,
}) {
  if (!activeCard || isTabletOrDesktop) return null;

  return (
    <PostCard
      key={activeCard.id}
      p={activeCard}
      index={0}
      liked={liked?.has ? liked.has(String(activeCard.id)) : false}
      saved={saved?.has ? saved.has(String(activeCard.id)) : false}
      onToggleLike={toggleLike}
      onToggleSave={toggleSave}
      onOpen={handleOpenProperty}
      onOpenLister={onOpenLister}
      viewingRequested={!!viewingRequested?.[activeCard.id]}
      onRequestViewing={() => onRequestViewing?.(activeCard.id)}
      onSend={onSend}
      onOpenMessage={onOpenMessage}
      showDistance={false}
      hideCard
      autoOpen
      scrollLockElement={pageRef.current}
      onSheetClose={() => setActiveCard(null)}
      showRoommateAction={studentMode && isShareableProperty(activeCard)}
      roommateCount={shareRequestCounts[String(activeCard.id)] || 0}
      onFindRoommate={onFindRoommate}
    />
  );
}
