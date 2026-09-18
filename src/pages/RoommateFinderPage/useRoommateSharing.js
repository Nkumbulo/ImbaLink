import { useCallback, useEffect, useMemo, useState } from "react";
import { findProfileById } from "../../core/data/domains/profile.js";
import { backend } from "../../application/backend/index.js";
import { computeRoommateCompatibility } from "../../utils/studentHelpers";

export const PROPERTY_REQUESTERS_PER_PAGE = 12;

const EMPTY_FORM = {
  roommatesNeeded: "1", budget: "", moveInDate: "", preferences: "",
  propertyId: "", aboutMe: "", preferenceTags: [], deposit: "", utilitiesIncluded: "", importantNotes: "",
};

export function useRoommateSharing({ userId, myProfile, focusProperty, focusPropertyId, onShareRequestsChanged, showToast }) {
  const [universities, setUniversities] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [propertyRequesters, setPropertyRequesters] = useState([]);
  const [loadingPropertyRequesters, setLoadingPropertyRequesters] = useState(false);
  const [selectedRequesterId, setSelectedRequesterId] = useState(null);
  const [propertyRequesterPage, setPropertyRequesterPage] = useState(1);
  const [togglingShareInterest, setTogglingShareInterest] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestFormLocked, setRequestFormLocked] = useState(false);
  const [requestForm, setRequestForm] = useState(EMPTY_FORM);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    let active = true;
    backend.studentRepository.getUniversities().then((rows) => { if (active) setUniversities(rows); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const refreshMyRequests = useCallback(async () => {
    const rows = await backend.sharingRepository.getShareRequests(userId).catch(() => []);
    setMyRequests(Array.isArray(rows) ? rows.filter((r) => (r.status || "active") !== "withdrawn") : []);
  }, [userId]);

  useEffect(() => { refreshMyRequests(); }, [refreshMyRequests]);

  const loadPropertyRequesters = useCallback(async (propertyId) => {
    if (propertyId == null) {
      setPropertyRequesters([]);
      return;
    }
    setLoadingPropertyRequesters(true);
    try {
      const requests = await backend.sharingRepository.getActiveShareRequestsForProperty(propertyId);
      const withProfiles = await Promise.all(requests.map(async (request) => {
        const profile = await findProfileById(request.userId).catch(() => null);
        const sp = profile?.studentProfile || {};
        return {
          requestId: request.id,
          userId: request.userId,
          isMe: String(request.userId) === String(userId),
          name: profile?.name || profile?.firstName || "Student",
          university: request.university || sp.university || "",
          studyYear: sp.studyYear || "",
          area: sp.preferredArea || "",
          budget: request.budget || sp.budget || "",
          accommodationPreference: sp.accommodationPreference || "Any",
          roommatesNeeded: request.roommatesNeeded || "1",
          preferences: request.preferences || "",
          aboutMe: request.aboutMe || "",
          preferenceTags: Array.isArray(request.preferenceTags) ? request.preferenceTags : [],
          deposit: request.deposit || "",
          utilitiesIncluded: request.utilitiesIncluded || "",
          importantNotes: request.importantNotes || "",
          propertyId: request.propertyId,
          verificationStatus: profile?.studentVerificationStatus || "unverified",
          createdAt: request.createdAt,
          avatarUrl: profile?.avatarUrl || profile?.photoUrl || "",
        };
      }));
      withProfiles.sort((a, b) => {
        const aUniversity = myProfile.university && a.university === myProfile.university ? 1 : 0;
        const bUniversity = myProfile.university && b.university === myProfile.university ? 1 : 0;
        if (bUniversity !== aUniversity) return bUniversity - aUniversity;
        const aCompatibility = computeRoommateCompatibility(myProfile, a)?.percent || 0;
        const bCompatibility = computeRoommateCompatibility(myProfile, b)?.percent || 0;
        if (bCompatibility !== aCompatibility) return bCompatibility - aCompatibility;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setPropertyRequesters(withProfiles);
    } catch (error) {
      console.error("Failed to load students interested in this property:", error);
      setPropertyRequesters([]);
    } finally {
      setLoadingPropertyRequesters(false);
    }
  }, [myProfile, userId]);

  useEffect(() => {
    loadPropertyRequesters(focusPropertyId);
    setSelectedRequesterId(null);
  }, [focusPropertyId, loadPropertyRequesters]);

  useEffect(() => { setPropertyRequesterPage(1); }, [focusPropertyId]);

  const myRequestForProperty = useMemo(() => propertyRequesters.find((r) => r.isMe) || null, [propertyRequesters]);
  const otherRequesters = useMemo(() => propertyRequesters.filter((r) => !r.isMe), [propertyRequesters]);
  const propertyRequesterPageCount = Math.max(1, Math.ceil(otherRequesters.length / PROPERTY_REQUESTERS_PER_PAGE));
  const visiblePropertyRequesters = useMemo(() => otherRequesters.slice(
    (propertyRequesterPage - 1) * PROPERTY_REQUESTERS_PER_PAGE,
    propertyRequesterPage * PROPERTY_REQUESTERS_PER_PAGE
  ), [otherRequesters, propertyRequesterPage]);
  const selectedRequester = useMemo(
    () => selectedRequesterId ? propertyRequesters.find((r) => r.userId === selectedRequesterId) : null,
    [propertyRequesters, selectedRequesterId]
  );
  const selectedRequesterCompatibility = selectedRequester
    ? computeRoommateCompatibility(myProfile, selectedRequester)
    : null;

  const openShareForm = useCallback((existingRequest, { lockProperty } = {}) => {
    setRequestForm({
      roommatesNeeded: existingRequest?.roommatesNeeded || myProfile.roommatesNeeded || "1",
      budget: existingRequest?.budget || myProfile.budget || "",
      moveInDate: existingRequest?.moveInDate || "",
      preferences: existingRequest?.preferences || "",
      propertyId: lockProperty ? String(focusProperty?.id ?? "") : (existingRequest?.propertyId != null ? String(existingRequest.propertyId) : ""),
      aboutMe: existingRequest?.aboutMe || "",
      preferenceTags: Array.isArray(existingRequest?.preferenceTags) ? existingRequest.preferenceTags : [],
      deposit: existingRequest?.deposit || "",
      utilitiesIncluded: existingRequest?.utilitiesIncluded || "",
      importantNotes: existingRequest?.importantNotes || "",
    });
    setRequestFormLocked(Boolean(lockProperty));
    setShowRequestForm(true);
  }, [focusProperty?.id, myProfile]);

  const removeMyPropertyShare = useCallback(async () => {
    if (!myRequestForProperty) return;
    if (!window.confirm("Remove your roommate listing for this property? Other students will no longer see you as interested in sharing it.")) return;
    setTogglingShareInterest(true);
    try {
      await backend.sharingRepository.deleteShareRequest(myRequestForProperty.requestId);
      showToast("Your roommate listing was removed.");
      await loadPropertyRequesters(focusProperty?.id);
      await refreshMyRequests();
      onShareRequestsChanged?.();
    } catch (error) {
      console.error("Failed to remove this property's share request:", error);
      showToast("Couldn't remove that just now. Please try again.");
    } finally {
      setTogglingShareInterest(false);
    }
  }, [focusProperty?.id, loadPropertyRequesters, myRequestForProperty, onShareRequestsChanged, refreshMyRequests, showToast]);

  const withdrawRequest = useCallback(async (request) => {
    if (!request?.id) return;
    const linkedProperty = request.propertyId != null;
    const label = linkedProperty ? "this property" : "this roommate request";
    if (!window.confirm(`Remove your roommate listing for ${label}? Other students will no longer see you as interested.`)) return;
    try {
      await backend.sharingRepository.deleteShareRequest(request.id);
      await refreshMyRequests();
      if (linkedProperty && focusPropertyId != null && String(request.propertyId) === String(focusPropertyId)) {
        await loadPropertyRequesters(focusPropertyId);
      }
      onShareRequestsChanged?.();
      showToast("Your roommate listing was removed.");
    } catch (error) {
      console.error("Failed to remove roommate request:", error);
      showToast("Couldn't remove that just now. Please try again.");
    }
  }, [focusPropertyId, loadPropertyRequesters, onShareRequestsChanged, refreshMyRequests, showToast]);

  const handlePublishRequest = useCallback(async () => {
    setSubmittingRequest(true);
    try {
      const propertyId = requestForm.propertyId || myProfile.roommatePropertyId || null;
      await backend.sharingRepository.createShareRequest({
        userId, propertyId, university: myProfile.university || "",
        roommatesNeeded: requestForm.roommatesNeeded, budget: requestForm.budget,
        moveInDate: requestForm.moveInDate, preferences: requestForm.preferences,
        aboutMe: requestForm.aboutMe, preferenceTags: requestForm.preferenceTags,
        deposit: requestForm.deposit, utilitiesIncluded: requestForm.utilitiesIncluded,
        importantNotes: requestForm.importantNotes,
      });
      await refreshMyRequests();
      if (focusProperty && String(propertyId) === String(focusProperty.id)) await loadPropertyRequesters(focusProperty.id);
      setShowRequestForm(false);
      onShareRequestsChanged?.();
      showToast(propertyId ? "Your listing is live — other students can now find it." : "Request published — other students can now find it.");
    } catch (error) {
      console.error("Failed to publish share request:", error);
      showToast("Couldn't publish that just now. Please try again.");
    } finally {
      setSubmittingRequest(false);
    }
  }, [focusProperty, loadPropertyRequesters, myProfile, onShareRequestsChanged, refreshMyRequests, requestForm, showToast, userId]);

  return {
    universities,
    myRequests,
    propertyRequesters,
    loadingPropertyRequesters,
    selectedRequesterId,
    setSelectedRequesterId,
    propertyRequesterPage,
    setPropertyRequesterPage,
    propertyRequesterPageCount,
    visiblePropertyRequesters,
    myRequestForProperty,
    otherRequesters,
    selectedRequester,
    selectedRequesterCompatibility,
    togglingShareInterest,
    showRequestForm,
    setShowRequestForm,
    requestFormLocked,
    requestForm,
    setRequestForm,
    submittingRequest,
    openShareForm,
    removeMyPropertyShare,
    withdrawRequest,
    handlePublishRequest,
    refreshMyRequests,
  };
}
