import { useEffect, useState } from "react";
import { requestViewing as requestViewingApi } from "../core/data/domains/interactions.js";
import { setPropertyLike, setPropertySave, toggleLandlordListingPause } from "../core/data/domains/properties.js";
import { requestStudentVerification as requestStudentVerificationApi, saveUserProfile } from "../core/data/domains/profile.js";
import { useListingUploadStatus } from "../hooks/useListingUploadStatus";

/** Property/profile mutations and shell-level property navigation actions. */
export default function useAppPropertyActions({
  properties, saved, setSaved, liked, setLiked, viewingRequested, setViewingRequested,
  user, userProfile, currentUserId, landlordRegistration, createLandlordListing,
  updateLandlordListing, setLandlordListings, setPropertySaveCount, setUserProfile, setTab, setDetailTab,
  setShowFilters, setShowCityPicker, setSelected, setViewingLister,
}) {
  const [pinnedListingId, setPinnedListingId] = useState(null);
  const pinnedUploadStatus = useListingUploadStatus(pinnedListingId);

  useEffect(() => {
    if (pinnedListingId && pinnedUploadStatus?.status === "done") setPinnedListingId(null);
  }, [pinnedListingId, pinnedUploadStatus?.status]);

  const openPublicListerProfile = async (target) => {
    if (!target?.id) return;
    setShowFilters(false);
    setShowCityPicker(false);
    setSelected(null);
    setViewingLister({ ...target, id: String(target.id) });
  };

  const toggleLike = (id) => {
    const key = String(id);
    setLiked((current) => {
      const next = new Set(current);
      const willLike = !next.has(key);
      willLike ? next.add(key) : next.delete(key);
      setPropertyLike(key, willLike).catch(() => {});
      return next;
    });
  };

  const toggleSave = (id) => {
    const key = String(id);
    const willSave = !saved.has(key);
    setSaved((current) => {
      const next = new Set(current);
      willSave ? next.add(key) : next.delete(key);
      return next;
    });
    setPropertySave(key, willSave)
      .then((count) => setPropertySaveCount(key, count))
      .catch((error) => {
        setSaved((current) => {
          const next = new Set(current);
          willSave ? next.delete(key) : next.add(key);
          return next;
        });
        console.error("Failed to update property save:", error);
      });
  };

  const closeAppOverlays = () => {
    setShowFilters(false); setShowCityPicker(false); setSelected(null); setViewingLister(null);
  };

  const openProperty = (property) => {
    setViewingLister(null); setShowFilters(false); setShowCityPicker(false); setDetailTab("overview"); setSelected(property);
  };

  const openChat = (property) => {
    setViewingLister(null); setShowFilters(false); setShowCityPicker(false); setDetailTab("message"); setSelected(property);
  };

  const requestViewing = async (propertyId) => {
    if (viewingRequested[propertyId]) return true;
    const property = properties.find((item) => String(item.id) === String(propertyId));
    if (property?.isPaused) throw new Error("This listing is temporarily paused by the owner. Viewing requests are currently unavailable.");
    if (!currentUserId) throw new Error("You must be signed in to request a viewing.");
    const result = await requestViewingApi(propertyId);
    setViewingRequested((current) => ({ ...current, [String(propertyId)]: true }));
    return result || true;
  };

  const createListing = async (listing, { onProgress } = {}) => {
    const created = await createLandlordListing({
      ...listing, userId: user?.id, landlordRegistrationId: landlordRegistration?.id || null,
      landlord: landlordRegistration?.fullName || userProfile?.name || "My landlord account",
      landlordVerified: landlordRegistration?.verificationStatus === "verified",
      city: listing.city || "Harare", verification: "pending",
    }, { onProgress });
    setTab("home");
    setPinnedListingId(created?.id ?? null);
    return created;
  };

  const updateListing = (propertyId, listing, { onProgress } = {}) =>
    updateLandlordListing(propertyId, { ...listing, city: listing.city || "Harare" }, { onProgress });

  const toggleListingPause = async (propertyId, paused) => {
    const updated = await toggleLandlordListingPause(propertyId, paused);
    setLandlordListings?.((current) => current.map((listing) =>
      String(listing.id) === String(propertyId) ? { ...listing, isPaused: Boolean(paused) } : listing
    ));
    return updated;
  };

  const requestStudentVerification = async () => {
    const updated = await requestStudentVerificationApi();
    if (updated) setUserProfile(updated);
    return updated;
  };

  const updateStudentProfile = async (updates) => {
    const updated = await saveUserProfile({
      accountType: "student", studentProfile: { ...(userProfile?.studentProfile || {}), ...updates },
    });
    if (updated) setUserProfile(updated);
    return updated;
  };

  return {
    pinnedListingId, openPublicListerProfile, toggleLike, toggleSave, closeAppOverlays,
    openProperty, openChat, requestViewing, createListing, updateListing, toggleListingPause,
    requestStudentVerification, updateStudentProfile,
  };
}
