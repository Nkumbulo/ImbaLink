import { memo } from "react";
import { T } from "../../styles/tokens";
import PhotoCarousel from "../common/PhotoCarousel";
import PriceTag from "../common/PriceTag";
import { LIKE_ANIM_STYLES } from "./PostCard/animationStyles";
import { getCompactCardStyles } from "./PostCard/postCardStyles";
import { usePostCardInteractions } from "./PostCard/usePostCardInteractions";
import PostCardHeader from "./PostCard/PostCardHeader";
import PostCardMeta from "./PostCard/PostCardMeta";
import PostCardDesktopOverlay from "./PostCard/PostCardDesktopOverlay";
import PostCardCTAButtons from "./PostCard/PostCardCTAButtons";
import PostCardDetailsSheet from "./PostCard/PostCardDetailsSheet";
import PostCardToast from "./PostCard/PostCardToast";

const PostCard = memo(function PostCard({
  p,
  index,
  saved,
  onToggleSave,
  onOpen,
  onOpenLister,
  viewingRequested,
  onRequestViewing,
  onSend: _onSend,
  onOpenMessage,
  showDistance = true,
  hideCard = false,
  autoOpen = false,
  scrollLockElement = null,
  onSheetClose,
  compactDesktop = false,
  desktopSelected = false,
  onSelectCard,
  // Student Mode only — see GridTile.jsx for the same contract.
  // `roommateCount`, when provided, is a REAL count of active
  // student_share_requests for this property, never fabricated.
  showRoommateAction = false,
  roommateCount,
  onFindRoommate,
  appMode = "property",
}) {
  const {
    burst, burstAction,
    desktopPhotoIndex, nextDesktopPhoto,
    isSheetOpen, openSheet, closeSheet,
    sentFlash, requestingViewing, handleRequestViewing,
    saveAnim, triggerSave,
    linkButtonScale, linkPressHandlers,
    toastVisible, toastText,
    photos, uploadStatus,
    cardRef,
    handleDesktopSelect,
    handleRecommendationTap,
    handleShareProperty,
    handlePhotoTap,
    handleOpenLister,
    listingVerified,
  } = usePostCardInteractions({
    p, compactDesktop, saved, onToggleSave, onSelectCard, autoOpen,
    onSheetClose, scrollLockElement, viewingRequested, onRequestViewing,
    onOpenLister, onOpen,
  });

  if (!p) return null;

  // Save animation is applied directly to the bookmark.

  return (
    <>
      <style>{getCompactCardStyles(T)}</style>
      <style>{LIKE_ANIM_STYLES}</style>

      {!hideCard && (
        <div
          ref={cardRef}
          data-imbalink-mode={appMode}
          className={compactDesktop ? "post-card-compact" : "rise"}
          data-property-card-id={p.id}
          data-property-card-selected={desktopSelected ? "true" : "false"}
          onClick={handleDesktopSelect}
          style={{
            background: T.paper,
            animationDelay: `${index * 40}ms`,
            borderBottom: `1px solid ${T.line}`,
            zIndex: compactDesktop && desktopSelected ? 50 : 1,
          }}
        >
          {/* Header */}
          <PostCardHeader
            p={p}
            compactDesktop={compactDesktop}
            showDistance={showDistance}
            listingVerified={listingVerified}
            onHeaderClick={(e) => { e.stopPropagation(); handleOpenLister(e); }}
          />

          {/* Photo carousel */}
          <div
            className="select-none"
            onClick={(e) => {
              if (compactDesktop && typeof onSelectCard === "function") {
                e.stopPropagation();
                onSelectCard(p);
                return;
              }
              handlePhotoTap();
              openSheet();
            }}
            style={{ touchAction: "manipulation", cursor: "pointer" }}
          >
            <PhotoCarousel
              height={compactDesktop ? 220 : 380}
              photos={photos}
              propertyId={p?.id}
              priceTag={<PriceTag rent={p.rent || ''} onClick={(e) => { e?.stopPropagation?.(); if (compactDesktop && typeof onSelectCard === "function") onSelectCard(p); else openSheet(); }} />}
              burstKey={burst}
              burstAction={burstAction}
              burstLabel={burstAction === "removed" ? "Removed from collection" : "Saved to collection"}
              preloadAdjacent={!compactDesktop}
            />
          </div>

          {/* Actions & description */}
          <div className={compactDesktop ? "px-3 pt-1.5 pb-2" : "px-3.5 pt-2 pb-3.5"}>
            <PostCardMeta
              p={p}
              compactDesktop={compactDesktop}
              saved={saved}
              saveAnim={saveAnim}
              triggerSave={triggerSave}
              linkButtonScale={linkButtonScale}
              linkPressHandlers={linkPressHandlers}
              handleRecommendationTap={handleRecommendationTap}
              handleShareProperty={handleShareProperty}
              showRoommateAction={showRoommateAction}
              roommateCount={roommateCount}
              onFindRoommate={onFindRoommate}
            />

            {compactDesktop && (
              <PostCardDesktopOverlay
                p={p}
                desktopSelected={desktopSelected}
                photos={photos}
                desktopPhotoIndex={desktopPhotoIndex}
                uploadStatus={uploadStatus}
                saved={saved}
                onToggleSave={onToggleSave}
                handleRecommendationTap={handleRecommendationTap}
                handleShareProperty={handleShareProperty}
                onSelectCard={onSelectCard}
                nextDesktopPhoto={nextDesktopPhoto}
                onOpen={onOpen}
              />
            )}

            {/* Action buttons */}
            <PostCardCTAButtons
              p={p}
              compactDesktop={compactDesktop}
              viewingRequested={viewingRequested}
              onOpenMessage={onOpenMessage}
              sentFlash={sentFlash}
              requestingViewing={requestingViewing}
              handleRequestViewing={handleRequestViewing}
              onSelectCard={onSelectCard}
              openSheet={openSheet}
            />
          </div>
        </div>
      )}

      {/* Details popup */}
      <PostCardDetailsSheet
        isSheetOpen={isSheetOpen}
        closeSheet={closeSheet}
        handleShareProperty={handleShareProperty}
        p={p}
        showDistance={showDistance}
        listingVerified={listingVerified}
        handleOpenLister={handleOpenLister}
        saved={saved}
        saveAnim={saveAnim}
        triggerSave={triggerSave}
        linkButtonScale={linkButtonScale}
        linkPressHandlers={linkPressHandlers}
        handleRecommendationTap={handleRecommendationTap}
        viewingRequested={viewingRequested}
        onOpenMessage={onOpenMessage}
        sentFlash={sentFlash}
        requestingViewing={requestingViewing}
        handleRequestViewing={handleRequestViewing}
        onOpen={onOpen}
      />

      {/* Toast */}
      <PostCardToast toastVisible={toastVisible} toastText={toastText} />
    </>
  );
});

export default PostCard;
