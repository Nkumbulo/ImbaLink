import { lazy } from "react";
import HomePage from "../pages/HomePage";
import StudentPage from "../pages/StudentPage";
const SearchPage = lazy(() => import("../pages/SearchPage"));
const MessagesPage = lazy(() => import("../pages/MessagesPage"));
const CollectionsPage = lazy(() => import("../pages/CollectionsPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const LandlordDashboardPage = lazy(() => import("../pages/LandlordDashboardPage"));
const ContractorsPage = lazy(() => import("../pages/ContractorsPage"));
const RoommateFinderPage = lazy(() => import("../pages/RoommateFinderPage"));
const AgentHubPage = lazy(() => import("../pages/agent/AgentHubPage"));
const PerformanceTrendsPage = lazy(() => import("../pages/agent/PerformanceTrendsPage"));
const CompanyHubPage = lazy(() => import("../pages/company/CompanyHubPage"));
const AdminPage = lazy(() => import("../pages/AdminPage"));

export default function AppPageContent({
  tab,
  studentMode,
  properties,
  pinnedListingId,
  liked,
  saved,
  toggleLike,
  toggleSave,
  openProperty,
  setTab,
  user,
  userProfile,
  openPublicListerProfile,
  viewingRequested,
  requestViewing,
  sendMessage,
  openMessageThread,
  shareRequestCounts,
  openRoommateForProperty,
  city,
  filters,
  setFilters,
  sort,
  setSort,
  setShowCityPicker,
  setShowFilters,
  hasMore,
  loadingMore,
  loadMore,
  setHomeFilterBarVisible,
  query,
  activeFilters,
  searchResults,
  selected,
  contractors,
  currentUserId,
  conversationUnreadCounts,
  setActiveConversationId,
  setConversationUnreadCounts,
  openChat,
  messagesState,
  clearMessagesState,
  threads,
  navigate,
  collectionsView,
  proRegistration,
  registerPro,
  landlordRegistration,
  agentRegistration,
  companyRegistration,
  contractorRegistrations,
  activeHubType,
  requestStudentVerification,
  updateStudentProfile,
  unreadNotifCount,
  setShowNotifications,
  onOpenNotifications,
  createListing,
  updateListing,
  deleteLandlordListing,
  toggleListingPause,
  registerLandlord,
  roommatePropertyId,
  returnFromRoommateFinder,
  refreshShareRequestCounts,
  openRoommateMessageThread,
  contractorLiked,
  setContractorLiked,
  registerContractor,
  setMessagesState,
  leads,
  registerAgent,
  registerCompany,
  teamMembers,
  recommendationProfile,
}) {
  return (
    <>
      {tab === "home" && (
        studentMode ? (
          <StudentPage
            properties={properties}
            liked={liked}
            saved={saved}
            toggleLike={toggleLike}
            toggleSave={toggleSave}
            openProperty={openProperty}
            setTab={setTab}
            user={userProfile || user}
            onOpenLister={openPublicListerProfile}
            viewingRequested={viewingRequested}
            onRequestViewing={requestViewing}
            onSend={(propertyId, text) => sendMessage({ recipientId: propertyId, recipientType: "property", text })}
            onOpenMessage={openMessageThread}
            shareRequestCounts={shareRequestCounts}
            onFindRoommate={openRoommateForProperty}
          />
        ) : (
          <HomePage
            properties={properties}
            pinnedListingId={pinnedListingId}
            recommendationProfile={recommendationProfile}
            liked={liked}
            saved={saved}
            toggleLike={toggleLike}
            toggleSave={toggleSave}
            openProperty={openProperty}
            onOpenLister={openPublicListerProfile}
            city={city}
            filters={filters}
            setFilters={setFilters}
            sort={sort}
            setSort={setSort}
            setTab={setTab}
            unreadNotifCount={unreadNotifCount}
            onOpenNotifications={onOpenNotifications}
            viewingRequested={viewingRequested}
            onRequestViewing={requestViewing}
            onSend={(propertyId, text) => sendMessage({ recipientId: propertyId, recipientType: "property", text })}
            onOpenMessage={openMessageThread}
            setShowCityPicker={setShowCityPicker}
            setShowFilters={setShowFilters}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadMore={loadMore}
            onFilterBarVisibilityChange={setHomeFilterBarVisible}
          />
        )
      )}

      {tab === "search" && (
        <SearchPage
          properties={properties}
          query={query}
          filters={activeFilters}
          setFilters={setFilters}
          setShowFilters={setShowFilters}
          results={searchResults}
          studentMode={studentMode}
          shareRequestCounts={shareRequestCounts}
          onFindRoommate={openRoommateForProperty}
          openProperty={openProperty}
          city={city}
          isActive={tab === "search" && !selected}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadMore={loadMore}
          liked={liked}
          saved={saved}
          toggleLike={toggleLike}
          toggleSave={toggleSave}
          onOpenLister={openPublicListerProfile}
          viewingRequested={viewingRequested}
          onRequestViewing={requestViewing}
          onSend={(propertyId, text) => sendMessage({ recipientId: propertyId, recipientType: "property", text })}
          onOpenMessage={openMessageThread}
        />
      )}

      {tab === "saved" && (
        <CollectionsPage
          properties={properties}
          saved={saved}
          liked={liked}
          openProperty={openProperty}
          initialView={collectionsView}
          onToggleSave={toggleSave}
          onToggleLike={toggleLike}
        />
      )}

      {tab === "messages" && (
        <MessagesPage
          properties={properties}
          contractors={contractors}
          currentUserId={currentUserId}
          openProperty={openProperty}
          unreadCounts={conversationUnreadCounts}
          onActiveConversationChange={(conversationId) => {
            const id = conversationId ? String(conversationId) : null;
            setActiveConversationId(id);
            if (id) setConversationUnreadCounts((current) => ({ ...current, [id]: 0 }));
          }}
          onOpenThread={openChat}
          contractorId={messagesState.contractorId}
          contractorName={messagesState.contractorName}
          roommateId={messagesState.roommateId}
          roommateName={messagesState.roommateName}
          templateMessage={messagesState.templateMessage}
          propertyId={messagesState.propertyId}
          otherUserId={messagesState.otherUserId}
          clearMessagesState={clearMessagesState}
        />
      )}

      {tab === "profile" && (
        <ProfilePage
          saved={saved}
          properties={properties}
          liked={liked}
          threads={threads}
          onNavigate={navigate}
          profile={userProfile}
          proRegistration={proRegistration}
          onRegisterPro={registerPro}
          landlordRegistration={landlordRegistration}
          agentRegistration={agentRegistration}
          companyRegistration={companyRegistration}
          contractorRegistration={contractorRegistrations[0]}
          activeHubType={activeHubType}
          studentMode={studentMode}
          onRequestStudentVerification={requestStudentVerification}
          onUpdateStudentProfile={updateStudentProfile}
          unreadNotifCount={unreadNotifCount}
          onOpenNotifications={onOpenNotifications}
        />
      )}

      {tab === "landlord" && (
        <LandlordDashboardPage
          properties={properties}
          viewingRequested={viewingRequested}
          threads={threads}
          onCreateListing={createListing}
          onUpdateListing={updateListing}
          onDeleteListing={deleteLandlordListing}
          onToggleListingPause={toggleListingPause}
          onOpenProperty={openProperty}
          onOpenMessages={openMessageThread}
          landlordRegistration={landlordRegistration}
          onRegisterLandlord={registerLandlord}
          profile={userProfile}
        />
      )}

      {tab === "services" && (
        studentMode ? (
          <RoommateFinderPage
            properties={properties}
            saved={saved}
            liked={liked}
            user={userProfile || user}
            studentProfile={(userProfile || user)?.studentProfile}
            studentVerificationStatus={(userProfile || user)?.studentVerificationStatus}
            onUpdateStudentProfile={updateStudentProfile}
            setTab={setTab}
            onOpenMessageThread={openRoommateMessageThread}
            focusPropertyId={roommatePropertyId}
            onClearPropertyFocus={returnFromRoommateFinder}
            onShareRequestsChanged={refreshShareRequestCounts}
            shareRequestCounts={shareRequestCounts}
            onFindRoommate={openRoommateForProperty}
          />
        ) : (
          <StudentPage
            properties={properties}
            liked={liked}
            saved={saved}
            toggleLike={toggleLike}
            toggleSave={toggleSave}
            openProperty={openProperty}
            setTab={setTab}
            user={userProfile || user}
            onOpenLister={openPublicListerProfile}
            viewingRequested={viewingRequested}
            onRequestViewing={requestViewing}
            onSend={(propertyId, text) => sendMessage({ recipientId: propertyId, recipientType: "property", text })}
            onOpenMessage={openMessageThread}
          />
        )
      )}

      {tab === "contractors" && (
        <ContractorsPage
          contractors={contractors}
          liked={contractorLiked}
          setLiked={setContractorLiked}
          registration={contractorRegistrations[0]}
          onRegister={registerContractor}
          profile={userProfile}
          setTab={setTab}
          setMessagesState={setMessagesState}
        />
      )}

      {tab === "agent" && (
        <AgentHubPage
          properties={properties}
          leads={leads}
          threads={threads}
          onCreateListing={createListing}
          onOpenProperty={openProperty}
          agentRegistration={agentRegistration}
          onRegisterAgent={registerAgent}
          profile={userProfile}
          onViewPerformance={() => setTab("performance")}
        />
      )}

      {tab === "performance" && (
        <PerformanceTrendsPage
          properties={properties}
          leads={leads}
          threads={threads}
          viewingRequested={viewingRequested}
          onOpenProperty={openProperty}
          onBack={() => setTab("agent")}
          ownerId={user?.id || null}
        />
      )}

      {tab === "company" && (
        <CompanyHubPage
          properties={properties}
          teamMembers={teamMembers}
          threads={threads}
          viewingRequested={viewingRequested}
          onCreateListing={createListing}
          onOpenProperty={openProperty}
          companyRegistration={companyRegistration}
          onRegisterCompany={registerCompany}
          profile={userProfile}
        />
      )}

      {tab === "admin" && <AdminPage />}
    </>
  );
}