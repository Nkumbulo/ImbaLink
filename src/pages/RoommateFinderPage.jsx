import React, { useMemo, useState, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import { T } from "../styles/tokens";
import "./RoommateFinderPage.css";
import RoommateFinderStyles from "./RoommateFinderPage/RoommateFinderStyles";
import RoommateHero from "./RoommateFinderPage/RoommateHero";
import RoommateFocusSection from "./RoommateFinderPage/RoommateFocusSection";
import RoommateDiscoverySection from "./RoommateFinderPage/RoommateDiscoverySection";
import RoommateMyRequestsSection from "./RoommateFinderPage/RoommateMyRequestsSection";
import RoommateHowItWorks from "./RoommateFinderPage/RoommateHowItWorks";
import RoommateModals from "./RoommateFinderPage/RoommateModals";
import { useToast } from "./RoommateFinderPage/useToast";
import { useRoommateRecommendations } from "./RoommateFinderPage/useRoommateRecommendations";
import { useRoommateSharing } from "./RoommateFinderPage/useRoommateSharing";
import { useRoommateInterests } from "./RoommateFinderPage/useRoommateInterests";
import { useRoommateMotionEffects } from "./RoommateFinderPage/useRoommateMotionEffects";
import { useRoommateDerivedState } from "./RoommateFinderPage/useRoommateDerivedState";

export default function RoommateFinderPage({
  properties = [],
  saved,
  liked,
  user,
  studentProfile,
  studentVerificationStatus,
  onUpdateStudentProfile,
  setTab,
  onOpenMessageThread,
  focusPropertyId,
  onClearPropertyFocus,
  onShareRequestsChanged,
  shareRequestCounts = {},
  onFindRoommate,
}) {
  const userId = user?.id || null;
  const myProfile = useMemo(() => studentProfile || {}, [studentProfile]);
  // Refs for cursor‑reactive effects
  const heroSectionRef = useRef(null);
  const animationWrapperRef = useRef(null);
  const videoCardRef = useRef(null);

  // State for inline video playback
  const [videoPlaying, setVideoPlaying] = useState(false);

  const focusProperty = useMemo(
    () => (focusPropertyId != null ? properties.find((p) => String(p?.id) === String(focusPropertyId)) : null),
    [properties, focusPropertyId]
  );

  const [toastText, showToast] = useToast();
  const [query, setQuery] = useState("");
  const [universityFilter, setUniversityFilter] = useState("Any university");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFindA, setShowFindA] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState("compact");
  const toggleViewMode = () => setViewMode((prev) => (prev === "card" ? "compact" : "card"));

  const {
    universities, myRequests, propertyRequesters, loadingPropertyRequesters, selectedRequesterId,
    setSelectedRequesterId, propertyRequesterPage, setPropertyRequesterPage, propertyRequesterPageCount,
    visiblePropertyRequesters, myRequestForProperty, otherRequesters, selectedRequester,
    selectedRequesterCompatibility, togglingShareInterest, showRequestForm, setShowRequestForm,
    requestFormLocked, requestForm, setRequestForm, submittingRequest, openShareForm,
    removeMyPropertyShare, withdrawRequest, handlePublishRequest,
  } = useRoommateSharing({
    userId, myProfile, focusProperty, focusPropertyId, onShareRequestsChanged, showToast,
  });

  const { interested, toggleInterested } = useRoommateInterests({ userId, showToast });

  const universityOptions = useMemo(() => ["Any university", ...universities.map((u) => u.name)], [universities]);

  const {
    generalCandidates,
    loadingCandidates,
    lastRecommendationRefresh,
    sortedCandidates,
    findARandomStudents,
  } = useRoommateRecommendations({
    properties,
    userId,
    myProfile,
    query,
    universityFilter,
    verifiedOnly,
  });

  const { selected, pickableProperties } = useRoommateDerivedState({
    properties,
    selectedId,
    sortedCandidates,
    generalCandidates,
    myProfile,
    saved,
    liked,
  });

  useRoommateMotionEffects({ heroSectionRef, animationWrapperRef, videoCardRef });

  const [findAStudents, setFindAStudents] = useState([]);
  const openFindA = () => {
    setFindAStudents(findARandomStudents());
    setShowFindA(true);
  };
  const closeFindA = () => setShowFindA(false);

  const openMessage = (candidate) => {
    onOpenMessageThread?.(
      candidate.id,
      candidate.name,
      `Hi ${candidate.name}, I saw your roommate profile on ImbaLink — would you be open to chatting about sharing a place?`
    );
  };

  const openRequesterMessage = (requester) => {
    if (!requester?.userId) return;
    onOpenMessageThread?.(
      requester.userId,
      requester.name,
      `Hi ${requester.name}, I saw that you're interested in sharing ${focusProperty?.title || "a property"} on ImbaLink — would you like to chat?`
    );
  };

  const inputStyle = {
    border: `1px solid ${T.line}`,
    borderRadius: 9,
    padding: "9px 11px",
    background: T.white,
    fontSize: 12,
    color: T.ink,
    outline: "none",
    width: "100%",
  };

  return (
    <main className="rf-page">
      <RoommateFinderStyles />

      <RoommateHero
        focusProperty={focusProperty}
        onClearPropertyFocus={onClearPropertyFocus}
        heroSectionRef={heroSectionRef}
        animationWrapperRef={animationWrapperRef}
        videoCardRef={videoCardRef}
        videoPlaying={videoPlaying}
        setVideoPlaying={setVideoPlaying}
      />

      <div className="rf-container">
        {/* The rest of the component remains unchanged */}
        {!myProfile.university && (
          <section className="rf-section">
            <div className="rf-incomplete-banner">
              <ShieldAlert size={18} color={T.brick} />
              <div style={{ fontSize: 11.5, color: T.ink, lineHeight: 1.5 }}>
                Add your university so we can show you relevant roommates and homes near your campus.
                <button type="button" className="rf-link-inline" style={{ marginLeft: 6, border: 0, background: "none", color: T.brick, fontWeight: 700, cursor: "pointer" }} onClick={() => setTab?.("profile")}>
                  Set it now
                </button>
              </div>
            </div>
          </section>
        )}

      <RoommateFocusSection
        focusProperty={focusProperty}
        myProfile={myProfile}
        myRequestForProperty={myRequestForProperty}
        togglingShareInterest={togglingShareInterest}
        openShareForm={openShareForm}
        removeMyPropertyShare={removeMyPropertyShare}
        toggleViewMode={toggleViewMode}
        viewMode={viewMode}
        loadingPropertyRequesters={loadingPropertyRequesters}
        otherRequesters={otherRequesters}
        visiblePropertyRequesters={visiblePropertyRequesters}
        setSelectedRequesterId={setSelectedRequesterId}
        openRequesterMessage={openRequesterMessage}
        propertyRequesterPageCount={propertyRequesterPageCount}
        propertyRequesterPage={propertyRequesterPage}
        setPropertyRequesterPage={setPropertyRequesterPage}
        onFindRoommate={onFindRoommate}
      />

      <RoommateDiscoverySection
        query={query}
        setQuery={setQuery}
        sortedCandidates={sortedCandidates}
        toggleViewMode={toggleViewMode}
        viewMode={viewMode}
        openFindA={openFindA}
        onFindRoommate={onFindRoommate}
        setSelectedId={setSelectedId}
        openMessage={openMessage}
        interested={interested}
        toggleInterested={toggleInterested}
        lastRecommendationRefresh={lastRecommendationRefresh}
      />

      <RoommateMyRequestsSection
        myRequests={myRequests}
        properties={properties}
        shareRequestCounts={shareRequestCounts}
        setSelectedId={setSelectedId}
        withdrawRequest={withdrawRequest}
        onFindRoommate={onFindRoommate}
        openShareForm={openShareForm}
      />

      <RoommateHowItWorks />
      </div>

      {/* Roommate profile detail modal (candidate) */}
      <RoommateModals
        showFindA={showFindA}
        closeFindA={closeFindA}
        findAStudents={findAStudents}
        setFindAStudents={setFindAStudents}
        findARandomStudents={findARandomStudents}
        selected={selected}
        setSelectedId={setSelectedId}
        openMessage={openMessage}
        showToast={showToast}
        selectedRequester={selectedRequester}
        setSelectedRequesterId={setSelectedRequesterId}
        focusProperty={focusProperty}
        onFindRoommate={onFindRoommate}
        selectedRequesterCompatibility={selectedRequesterCompatibility}
        openRequesterMessage={openRequesterMessage}
        showRequestForm={showRequestForm}
        setShowRequestForm={setShowRequestForm}
        requestFormLocked={requestFormLocked}
        requestForm={requestForm}
        setRequestForm={setRequestForm}
        pickableProperties={pickableProperties}
        submittingRequest={submittingRequest}
        handlePublishRequest={handlePublishRequest}
        inputStyle={inputStyle}
        myProfile={myProfile}
        interested={interested}
        toggleInterested={toggleInterested}
        setTab={setTab}
        />
      {toastText && (
        <div className="rf-toast rise" role="status">{toastText}</div>
      )}
    </main>
  );
}
