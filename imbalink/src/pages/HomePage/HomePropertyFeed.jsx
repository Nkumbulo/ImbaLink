import React from "react";
import { T } from "../../styles/tokens";
import PostCard from "../../components/property/PostCard";
import GridTile from "../../components/property/GridTile";
import PropertyQuickView from "../../components/property/PropertyQuickView";
import UploadProgressStrip from "../../components/property/UploadProgressStrip";

export default function HomePropertyFeed({renderedFeed,feedLength,isTabletOrDesktop,isDesktopLayout,filtersSuburb,liked,saved,toggleLike,toggleSave,openProperty,onOpenLister,viewingRequested,onRequestViewing,onSend,onOpenMessage,getCardHandlers,loadingMore,hasMore,sentinelRef,verifiedOnly,baseNounPlural,quickViewProperty,onSetQuickViewProperty,onCloseQuickView,onViewFullDetails}) {
  return (
    <>
      <div style={{marginTop:isDesktopLayout?18:2,padding:isDesktopLayout?"0 24px":undefined}}>
        <div className="web-property-grid">
          {renderedFeed.filter((p)=>p&&p.id!=null).map((p)=>(
            <div key={p.id} className="relative">
              <UploadProgressStrip propertyId={p.id} ownerId={p.ownerUserId} />
              {isTabletOrDesktop ? (
                <GridTile p={p} onOpen={onSetQuickViewProperty} activeSuburb={filtersSuburb} compactDesktop={isDesktopLayout}/>
              ) : (
                <PostCard p={p} liked={liked.has(String(p.id))} saved={saved.has(String(p.id))} onToggleLike={toggleLike} onToggleSave={toggleSave} onOpen={openProperty} onOpenLister={onOpenLister} viewingRequested={!!viewingRequested[p.id]} onRequestViewing={getCardHandlers(p.id).onRequestViewing} onSend={onSend} onOpenMessage={onOpenMessage} showDistance={false}/>
              )}
            </div>
          ))}
        </div>
        {feedLength===0 && (
          <div className="text-center py-14 f-body" style={{color:T.ink60,fontSize:13}}>
            {`No ${verifiedOnly ? "Verified " : ""}${baseNounPlural} available.`}
            {verifiedOnly && <div style={{fontSize:11,marginTop:6,opacity:0.7}}>Make sure your properties have a `verified: true` field.</div>}
          </div>
        )}
        <div ref={sentinelRef} className="h-12 flex items-center justify-center">
          {loadingMore && <span className="f-body text-xs" style={{color:T.ink60}}>Loading more…</span>}
          {!loadingMore && !hasMore && feedLength>0 && <span className="f-body text-xs" style={{color:T.ink60}}>You're all caught up ✓</span>}
        </div>
      </div>
      {quickViewProperty && <PropertyQuickView p={quickViewProperty} liked={liked.has(String(quickViewProperty.id))} saved={saved.has(String(quickViewProperty.id))} onToggleLike={toggleLike} onToggleSave={toggleSave} onOpenLister={onOpenLister} viewingRequested={!!viewingRequested[quickViewProperty.id]} onRequestViewing={()=>onRequestViewing?.(quickViewProperty.id)} onSend={onSend} onOpenMessage={onOpenMessage} onClose={onCloseQuickView} onViewFullDetails={onViewFullDetails} showDistance={false}/>}
    </>
  );
}
