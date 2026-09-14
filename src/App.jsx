import { Suspense } from "react";
import { T } from "./styles/tokens";
import GlobalStyles from "./styles/GlobalStyles";
import BottomNav from "./layouts/BottomNav";
import Splash from "./components/common/Splash";
import UserOnboarding from "./components/common/UserOnboarding";
import HubWelcomeSplash from "./components/common/HubWelcomeSplash";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AppPageContent from "./App/AppPageContent";
import AppOverlays from "./App/AppOverlays";
import useDatabase from "./hooks/useDatabase";
import useOnlineStatus from "./hooks/useOnlineStatus";
import ResponsiveTopbar from "./App/ResponsiveTopbar";
import TabletBottomNav from "./App/TabletBottomNav";
import DesktopSidebar from "./App/DesktopSidebar";
import AdminLoginPage from "./services/admin/AdminLoginPage";
import AdminApp from "./services/admin/AdminApp";
import "./styles/AdminStyles.css";
import useAppNotifications from "./App/useAppNotifications";
import useAppDerivedState from "./App/useAppDerivedState";
import useAppNavigation from "./App/useAppNavigation";
import useAppRegistrations from "./App/useAppRegistrations";
import useAppRoommate from "./App/useAppRoommate";
import useAppUiState from "./App/useAppUiState";
import useAppMessaging from "./App/useAppMessaging";
import useAppPropertyActions from "./App/useAppPropertyActions";
import useAppSessionState from "./App/useAppSessionState";

function AppContent() {
  const { isAuthenticated, user, authLoading, needsProfile } = useAuth();
  const isOnline = useOnlineStatus();
  // Presence is intentionally NOT mounted here at the app shell. It is
  // mounted only inside MessagesPage (via useChatPresence -> useGlobalPresence),
  // so a user is tracked as "online" only while they're actually on the
  // Messages page/a conversation — leaving Messages (even while staying
  // signed in elsewhere in the app) untracks them, which fires a real
  // presence "leave" for anyone currently viewing them and leaves an
  // accurate last_seen_at behind for the "was online X ago" fallback.

  const {
    tab, setTab, city, setCity, query, setQuery, filters, setFilters, sort, setSort,
    homeFilterBarVisible, setHomeFilterBarVisible, showFilters, setShowFilters,
    showCityPicker, setShowCityPicker, selected, setSelected, detailTab, setDetailTab,
    collectionsView, setCollectionsView, hubWelcome, setHubWelcome, showNotifications,
    setShowNotifications, viewingLister, setViewingLister, startupReady,
  } = useAppUiState();

  const {
    loaded, hydrated, properties, saved, setSaved, liked, setLiked, threads, setThreads,
    viewingRequested, setViewingRequested, landlordListings, setLandlordListings,
    contractors, contractorLiked, setContractorLiked, contractorRegistrations, setContractorRegistrations,
    landlordRegistration, setLandlordRegistration, proRegistration, setProRegistration,
    userProfile, setUserProfile, hasMore, setPropertySaveCount, recommendationProfile,
    loadingMore, loadMore, createLandlordListing, deleteLandlordListing, updateLandlordListing,
  } = useDatabase({ city, filters, query, limit: 24, userId: isAuthenticated ? user?.id : null });

  // These are app-level compatibility collections consumed by a few existing
  // dashboard surfaces. Keep them stable here until those surfaces are moved
  // behind their own domain hooks in a later cleanup pass.
  const leads = {};
  const teamMembers = [];

  const currentUserId = isAuthenticated ? (user?.id || null) : null;

  const {
    messagesState, setMessagesState, clearMessagesState, conversationUnreadCounts,
    setConversationUnreadCounts, activeConversationId, setActiveConversationId, sendMessage,
  } = useAppMessaging({ hydrated, currentUserId, setThreads });

  const {
    totalUnread,
    activeFilters,
    results,
    studentMode,
    searchResults,
    homeCityProperties,
    listerListings,
  } = useAppDerivedState({
    properties,
    city,
    query,
    filters,
    user,
    userProfile,
    conversationUnreadCounts,
    viewingLister,
  });

  const { agentRegistration, setAgentRegistration, companyRegistration, setCompanyRegistration } = useAppSessionState({
    isAuthenticated, user, userProfile, setUserProfile,
    setLandlordRegistration, setProRegistration, setContractorRegistrations,
    setSaved, setLiked, setThreads, setViewingRequested, setConversationUnreadCounts,
    setMessagesState, setCollectionsView, setTab,
  });

  const {
    pinnedListingId, openPublicListerProfile, toggleLike, toggleSave, closeAppOverlays,
    openProperty, openChat, requestViewing, createListing, updateListing, toggleListingPause,
    requestStudentVerification, updateStudentProfile,
  } = useAppPropertyActions({
    properties, saved, setSaved, liked, setLiked, viewingRequested, setViewingRequested,
    user, userProfile, currentUserId, landlordRegistration, createLandlordListing,
    updateLandlordListing, setLandlordListings, setPropertySaveCount, setUserProfile, setTab, setDetailTab,
    setShowFilters, setShowCityPicker, setSelected, setViewingLister,
  });

  const {
    shareRequestCounts,
    refreshShareRequestCounts,
    roommatePropertyId,
    openRoommateForProperty,
    returnFromRoommateFinder,
  } = useAppRoommate({
    studentMode,
    tab,
    properties,
    openProperty,
    setTab,
  });

  const activeHubType =
    (landlordRegistration && "landlord") ||
    (contractorRegistrations[0] && "contractor") ||
    (agentRegistration && "agent") ||
    (companyRegistration && "company") ||
    null;

  const {
    registerContractor,
    registerLandlord,
    registerAgent,
    registerCompany,
    registerPro,
  } = useAppRegistrations({
    activeHubType,
    user,
    setAgentRegistration,
    setCompanyRegistration,
    setContractorRegistrations,
    setLandlordRegistration,
    setProRegistration,
    setHubWelcome,
  });

  const { navigate, openMessageThread, openRoommateMessageThread } = useAppNavigation({
    properties,
    setMessagesState,
    setTab,
    setCollectionsView,
  });

  const { notifications, unreadNotifCount, markAllNotificationsRead, resetAllNotifications, openNotification, prepareNotifications } = useAppNotifications({
    hydrated,
    currentUserId,
    setShowNotifications,
    onOpenNotification: (notification) => {
      if (notification.type === "message") {
        setTab("messages");
        return;
      }
      if (notification.subjectType !== "property" || !notification.subjectId) return;
      const property = properties.find((item) => String(item.id) === String(notification.subjectId));
      if (!property) return;
      if (notification.type === "viewing_request") {
        openMessageThread(property.id);
      } else {
        openProperty(property);
      }
    },
  });

  // The initial session check is now async (it reads IndexedDB via
  // localAuthProvider), so there's a brief window before we actually know
  // whether someone's signed in. Reuse the existing Splash screen for that
  // window instead of flashing UserOnboarding for one render on every load.
  if (authLoading) {
    return (
      <div className="min-h-screen app-root" style={{ background: "#F3F0E8" }}><GlobalStyles/>
        <Splash />
      </div>
    );
  }

  // Signed in but no account type yet (fresh Google account) keeps showing
  // onboarding, which switches itself to the profile step.
  if (!isAuthenticated || needsProfile) {
    return <UserOnboarding />;
  }

  return (
    <div className="min-h-screen app-root" style={{background:"#F3F0E8"}}><GlobalStyles/>
      <div className="relative min-h-screen">
        {(!loaded || !startupReady) && <Splash />}
        {loaded && startupReady && (
          <div className="app-layout">
            <DesktopSidebar tab={tab} setTab={setTab} unreadCount={totalUnread} studentMode={studentMode} />
            <div className="app-viewport">
              <ResponsiveTopbar
                tab={tab}
                setTab={setTab}
                city={city}
                setShowCityPicker={setShowCityPicker}
                query={query}
                setQuery={setQuery}
                user={userProfile || user}
                unreadCount={totalUnread}
                unreadNotifCount={unreadNotifCount}
                onOpenNotifications={() => { prepareNotifications(); setShowNotifications(true); }}
                showQuickFilters={(tab === "home" && !homeFilterBarVisible) || tab === "search"}
                quickFilterProperties={homeCityProperties}
                filters={filters}
                setFilters={setFilters}
                sort={sort}
                setSort={setSort}
                isOnline={isOnline}
              />
              <div className={`min-h-screen overflow-y-auto app-main-shell page-${tab}`} style={{ background: T.paper }}>
              <Suspense fallback={<Splash />}>
                <AppPageContent
                  tab={tab}
                  studentMode={studentMode}
                  properties={properties}
                  pinnedListingId={pinnedListingId}
                  liked={liked}
                  saved={saved}
                  toggleLike={toggleLike}
                  toggleSave={toggleSave}
                  openProperty={openProperty}
                  setTab={setTab}
                  user={user}
                  userProfile={userProfile}
                  openPublicListerProfile={openPublicListerProfile}
                  viewingRequested={viewingRequested}
                  requestViewing={requestViewing}
                  sendMessage={sendMessage}
                  openMessageThread={openMessageThread}
                  shareRequestCounts={shareRequestCounts}
                  openRoommateForProperty={openRoommateForProperty}
                  city={city}
                  filters={filters}
                  setFilters={setFilters}
                  sort={sort}
                  setSort={setSort}
                  setShowCityPicker={setShowCityPicker}
                  setShowFilters={setShowFilters}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  loadMore={loadMore}
                  setHomeFilterBarVisible={setHomeFilterBarVisible}
                  query={query}
                  activeFilters={activeFilters}
                  searchResults={searchResults}
                  selected={selected}
                  contractors={contractors}
                  currentUserId={currentUserId}
                  conversationUnreadCounts={conversationUnreadCounts}
                  setActiveConversationId={setActiveConversationId}
                  setConversationUnreadCounts={setConversationUnreadCounts}
                  openChat={openChat}
                  messagesState={messagesState}
                  clearMessagesState={clearMessagesState}
                  threads={threads}
                  navigate={navigate}
                  collectionsView={collectionsView}
                  proRegistration={proRegistration}
                  registerPro={registerPro}
                  landlordRegistration={landlordRegistration}
                  agentRegistration={agentRegistration}
                  companyRegistration={companyRegistration}
                  contractorRegistrations={contractorRegistrations}
                  activeHubType={activeHubType}
                  requestStudentVerification={requestStudentVerification}
                  updateStudentProfile={updateStudentProfile}
                  unreadNotifCount={unreadNotifCount}
                  setShowNotifications={setShowNotifications}
          onOpenNotifications={() => { prepareNotifications(); setShowNotifications(true); }}
                  createListing={createListing}
                  updateListing={updateListing}
                  deleteLandlordListing={deleteLandlordListing}
                  toggleListingPause={toggleListingPause}
                  registerLandlord={registerLandlord}
                  roommatePropertyId={roommatePropertyId}
                  returnFromRoommateFinder={returnFromRoommateFinder}
                  refreshShareRequestCounts={refreshShareRequestCounts}
                  openRoommateMessageThread={openRoommateMessageThread}
                  contractorLiked={contractorLiked}
                  setContractorLiked={setContractorLiked}
                  registerContractor={registerContractor}
                  setMessagesState={setMessagesState}
                  leads={leads}
                  registerAgent={registerAgent}
                  registerCompany={registerCompany}
                  teamMembers={teamMembers}
                  recommendationProfile={recommendationProfile}
                />
              </Suspense>
              </div>
            </div>
          </div>
        )}
      </div>

      {hubWelcome && (
        <HubWelcomeSplash
          hubType={hubWelcome}
          onContinue={() => {
            setTab(hubWelcome === "company" ? "company" : "landlord");
            setHubWelcome(null);
          }}
        />
      )}

      <BottomNav
        tab={tab}
        setTab={setTab}
        unreadCount={totalUnread}
        studentMode={studentMode}
        // Chat threads are meant to be a full-screen experience, same as
        // WhatsApp/Instagram — the tab bar has no business showing while
        // one's open. This used to happen only as an accidental side
        // effect: BottomNav is a plain position:fixed; bottom:0 element
        // with no keyboard-awareness of its own, so it was masked simply
        // because the on-screen keyboard physically covered that part of
        // the screen almost the entire time a thread was open (composing
        // a message keeps the keyboard up). That's not a real fix — it
        // only "worked" while the keyboard happened to be up, and broke
        // the moment keyboard-height detection changed at all (mobile
        // browser vs. native app, this session's Capacitor plugin work,
        // etc.). Hiding it explicitly, keyed off whether a conversation
        // is actually open (activeConversationId, already tracked at this
        // level via onActiveConversationChange below), doesn't depend on
        // keyboard state or platform at all.
        hidden={tab === "messages" && Boolean(activeConversationId)}
      />
      <TabletBottomNav tab={tab} setTab={setTab} unreadCount={totalUnread} studentMode={studentMode} />

      <AppOverlays
        showCityPicker={showCityPicker}
        setShowCityPicker={setShowCityPicker}
        properties={properties}
        city={city}
        setCity={setCity}
        setFilters={setFilters}
        showFilters={showFilters}
        filters={filters}
        onCloseFilters={() => setShowFilters(false)}
        resultCount={results.length}
        selected={selected}
        detailTab={detailTab}
        onCloseProperty={() => setSelected(null)}
        liked={liked.has(String(selected?.id))}
        saved={saved.has(String(selected?.id))}
        onToggleLike={toggleLike}
        onToggleSave={toggleSave}
        onOpenLister={openPublicListerProfile}
        threads={threads}
        onSend={sendMessage}
        viewingRequested={!!viewingRequested[selected?.id]}
        onRequestViewing={() => requestViewing(selected?.id)}
        onOpenMessage={openMessageThread}
        studentMode={studentMode}
        roommateCount={shareRequestCounts[String(selected?.id)] || 0}
        onFindRoommate={() => {
          const property = selected;
          setSelected(null);
          openRoommateForProperty(property, { fromDetail: true });
        }}
        onOpenProperty={openProperty}
        showNotifications={showNotifications}
        notifications={notifications}
        onCloseNotifications={() => setShowNotifications(false)}
        onOpenNotification={openNotification}
        onMarkAllNotificationsRead={markAllNotificationsRead}
        onResetNotifications={async () => {
          if (typeof window !== "undefined" && !window.confirm("Reset all notification history? This cannot be undone.")) return;
          try {
            await resetAllNotifications();
          } catch {
            if (typeof window !== "undefined") {
              window.alert("Could not reset notifications. Please try again.");
            }
          }
        }}
        viewingLister={viewingLister}
        listerListings={listerListings}
        onCloseLister={() => setViewingLister(null)}
      />

    </div>
  );
}

export default function App() {
  // The desktop administration platform is a separate route surface. It is
  // deliberately outside the public AuthProvider so normal ImbaLink users,
  // navigation and the existing in-app AdminPage remain untouched.
  const adminPath = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  if (adminPath) {
    const loginPath = window.location.pathname === "/admin/login" || window.location.pathname === "/admin/login/";
    return loginPath ? <AdminLoginPage /> : <AdminApp />;
  }
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}