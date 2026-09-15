import { ArrowRight, Sparkles } from "lucide-react";
import StudentHomeTile from "./StudentHomeTile";
import { isShareableProperty } from "../../utils/studentHelpers";

export default function StudentHomesSection({
  homes,
  campusCity,
  area,
  openFindA,
  setTab,
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
  shareRequestCounts,
  onFindRoommate,
}) {
  return (
    <div className="student-container">
      <section id="student-homes" className="student-section">
        <div className="student-section-head">
          <div>
            <h2>Accommodation around your campus</h2>
            <p>Start with places students can actually use, share and afford.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="student-find-a-btn" onClick={openFindA}>
              <Sparkles size={14} /> Find-a
            </button>
            <button type="button" className="student-link-btn" onClick={() => setTab?.("search")}>Explore all listings <ArrowRight size={13} /></button>
          </div>
        </div>

        {homes.length === 0 ? (
          <div className="student-empty">
            No listings in {campusCity}{area !== "Any area" ? ` · ${area}` : ""} right now — try another area or explore the full listings.
          </div>
        ) : (
          <div className="web-property-grid">
            {homes.map((property) => (
              <StudentHomeTile
                key={property.id}
                property={property}
                isTabletOrDesktop={isTabletOrDesktop}
                isDesktopLayout={isDesktopLayout}
                liked={liked?.has?.(String(property.id))}
                saved={saved?.has?.(String(property.id))}
                toggleLike={toggleLike}
                toggleSave={toggleSave}
                openProperty={openProperty}
                onOpenLister={onOpenLister}
                viewingRequested={viewingRequested}
                onRequestViewing={onRequestViewing}
                onSend={onSend}
                onOpenMessage={onOpenMessage}
                showRoommateAction={isShareableProperty(property)}
                roommateCount={shareRequestCounts[String(property.id)] || 0}
                onFindRoommate={onFindRoommate}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
