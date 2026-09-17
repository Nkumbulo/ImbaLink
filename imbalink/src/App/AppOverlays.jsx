import CityPicker from "../components/property/CityPicker";
import FilterSheet from "../components/property/FilterSheet";
import PropertyDetail from "../components/property/PropertyDetail";
import ListerProfile from "../components/property/ListerProfile";
import NotificationsPanel from "../components/notifications/NotificationsPanel";

/**
 * App-level overlays only.
 *
 * This component intentionally owns no application state or business logic.
 * App.jsx remains the source of truth for every overlay callback and state
 * transition; this file only keeps the large modal/sheet JSX out of the app
 * orchestration component.
 */
export default function AppOverlays({
  showCityPicker,
  setShowCityPicker,
  properties,
  city,
  setCity,
  setFilters,
  showFilters,
  filters,
  onCloseFilters,
  resultCount,
  selected,
  detailTab,
  onCloseProperty,
  liked,
  saved,
  onToggleLike,
  onToggleSave,
  onOpenLister,
  threads,
  onSend,
  viewingRequested,
  onRequestViewing,
  onOpenMessage,
  studentMode,
  roommateCount,
  onFindRoommate,
  onOpenProperty,
  showNotifications,
  notifications,
  onCloseNotifications,
  onOpenNotification,
  onMarkAllNotificationsRead,
  viewingLister,
  listerListings,
  onCloseLister,
}) {
  return (
    <>
      {showCityPicker && (
        <CityPicker
          properties={properties}
          city={city}
          setCity={setCity}
          setFilters={setFilters}
          onClose={() => setShowCityPicker(false)}
        />
      )}

      {showFilters && (
        <FilterSheet
          properties={properties}
          filters={filters}
          setFilters={setFilters}
          onClose={onCloseFilters}
          resultCount={resultCount}
          city={city}
        />
      )}

      {selected && (
        <PropertyDetail
          p={selected}
          initialTab={detailTab}
          onClose={onCloseProperty}
          liked={liked}
          saved={saved}
          onToggleLike={onToggleLike}
          onToggleSave={onToggleSave}
          onOpenLister={onOpenLister}
          threads={threads}
          onSend={onSend}
          viewingRequested={viewingRequested}
          onRequestViewing={onRequestViewing}
          onOpenMessage={onOpenMessage}
          studentMode={studentMode}
          roommateCount={roommateCount}
          onFindRoommate={onFindRoommate}
          onOpenProperty={onOpenProperty}
        />
      )}

      {showNotifications && (
        <NotificationsPanel
          notifications={notifications}
          onClose={onCloseNotifications}
          onOpenNotification={onOpenNotification}
          onMarkAllRead={onMarkAllNotificationsRead}
        />
      )}

      {viewingLister && (
        <ListerProfile
          lister={viewingLister}
          listings={listerListings}
          onClose={onCloseLister}
          onOpen={onOpenProperty}
        />
      )}
    </>
  );
}
