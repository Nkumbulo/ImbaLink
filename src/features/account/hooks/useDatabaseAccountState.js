import { useCallback, useEffect, useState } from 'react';
import { getContractors } from '../../../core/data/domains/interactions.js';
import { getUserProfile, getUserState, saveUserState } from '../../../core/data/domains/profile.js';
import { getLandlordListings, getPropertyRecommendationProfile } from '../../../core/data/domains/properties.js';
import { getContractorRegistrations, getLandlordRegistration, getProRegistration } from '../../../core/data/domains/registrations.js';
import { localCache } from '../../../core/cache';

const MOBILE_FEED_TIMEOUT_MS = 6500;

const withTimeout = (promise, ms, fallback) => Promise.race([
  promise,
  new Promise((resolve) => window.setTimeout(() => resolve(fallback), ms)),
]);

export function useDatabaseAccountState(userId) {
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(new Set());
  const [liked, setLiked] = useState(new Set());
  const [contractorLiked, setContractorLiked] = useState(new Set());
  const [threads, setThreads] = useState({});
  const [viewingRequested, setViewingRequested] = useState({});
  const [landlordListings, setLandlordListings] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [contractorRegistrations, setContractorRegistrations] = useState([]);
  const [landlordRegistration, setLandlordRegistration] = useState(null);
  const [proRegistration, setProRegistration] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [recommendationProfile, setRecommendationProfile] = useState(null);

  useEffect(() => {
    let active = true;
    setHydrated(false);
    setLandlordListings([]);
    setContractorRegistrations([]);
    setLandlordRegistration(null);
    setProRegistration(null);
    setUserProfile(null);
    setRecommendationProfile(null);
    setSaved(new Set());
    setLiked(new Set());
    setContractorLiked(new Set());
    setThreads({});
    setViewingRequested({});

    if (!userId) {
      setHydrated(true);
      return () => { active = false; };
    }

    (async () => {
      try {
        const cached = await localCache.getSmall(`user-state:${userId}`, 5 * 60 * 1000);
        if (cached?.hasCache && cached.value && active) {
          const state = cached.value;
          setLandlordRegistration(state.landlordRegistration || null);
          setProRegistration(state.proRegistration || null);
          setUserProfile(state.userProfile || null);
          setSaved(new Set(state.savedIds || []));
          setLiked(new Set(state.likedIds || []));
          setContractorLiked(new Set(state.contractorLikedIds || []));
          setViewingRequested(state.viewingRequested || {});
          setHydrated(true);
        }
      } catch {}

      try {
        const [profile, listings, contractorData, userState, contractorRegs, landlordReg, proReg, recommendationData] = await Promise.all([
          withTimeout(getUserProfile().catch(() => null), MOBILE_FEED_TIMEOUT_MS, null),
          withTimeout(getLandlordListings(userId).catch(() => []), MOBILE_FEED_TIMEOUT_MS, []),
          withTimeout(getContractors().catch(() => []), MOBILE_FEED_TIMEOUT_MS, []),
          withTimeout(getUserState().catch(() => null), MOBILE_FEED_TIMEOUT_MS, null),
          withTimeout(getContractorRegistrations(userId).catch(() => []), MOBILE_FEED_TIMEOUT_MS, []),
          withTimeout(getLandlordRegistration(userId).catch(() => null), MOBILE_FEED_TIMEOUT_MS, null),
          withTimeout(getProRegistration(userId).catch(() => null), MOBILE_FEED_TIMEOUT_MS, null),
          withTimeout(getPropertyRecommendationProfile().catch(() => null), MOBILE_FEED_TIMEOUT_MS, null),
        ]);

        if (!active) return;
        setLandlordListings(Array.isArray(listings) ? listings : []);
        setContractors(Array.isArray(contractorData) ? contractorData : []);
        setContractorRegistrations(Array.isArray(contractorRegs) ? contractorRegs : []);
        setLandlordRegistration(landlordReg || null);
        setProRegistration(proReg || null);
        setUserProfile(profile || userState?.profile || null);
        setRecommendationProfile(recommendationData || null);
        setSaved(new Set(userState?.savedIds || []));
        setLiked(new Set(userState?.likedIds || []));
        setContractorLiked(new Set(userState?.contractorLikedIds || []));
        setThreads(userState?.threads || {});
        setViewingRequested(userState?.viewingRequested || {});

        void localCache.setSmall(`user-state:${userId}`, {
          landlordRegistration: landlordReg || null,
          proRegistration: proReg || null,
          userProfile: profile || userState?.profile || null,
          savedIds: userState?.savedIds || [],
          likedIds: userState?.likedIds || [],
          contractorLikedIds: userState?.contractorLikedIds || [],
          viewingRequested: userState?.viewingRequested || {},
        });
      } finally {
        if (active) setHydrated(true);
      }
    })();

    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!hydrated || !userId || typeof window === 'undefined') return;
    const refreshRecommendations = () => {
      getPropertyRecommendationProfile().then(setRecommendationProfile).catch(() => {});
    };
    window.addEventListener('imbalink-recommendation-updated', refreshRecommendations);
    return () => window.removeEventListener('imbalink-recommendation-updated', refreshRecommendations);
  }, [hydrated, userId]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    saveUserState({
      savedIds: [...saved],
      likedIds: [...liked],
      contractorLikedIds: [...contractorLiked],
      viewingRequested,
    });
  }, [saved, liked, contractorLiked, viewingRequested, hydrated, userId]);

  return {
    hydrated,
    saved, setSaved,
    liked, setLiked,
    contractorLiked, setContractorLiked,
    threads, setThreads,
    viewingRequested, setViewingRequested,
    landlordListings, setLandlordListings,
    contractors,
    contractorRegistrations, setContractorRegistrations,
    landlordRegistration, setLandlordRegistration,
    proRegistration, setProRegistration,
    userProfile, setUserProfile,
    recommendationProfile,
  };
}
