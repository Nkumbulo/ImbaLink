import { useDatabaseAccountState } from '../features/account/hooks/useDatabaseAccountState.js';
import { usePropertyFeed } from '../features/properties/hooks/usePropertyFeed.js';

export default function useDatabase({ city = 'All', filters = {}, query = '', limit = 24, userId = null } = {}) {
  const account = useDatabaseAccountState(userId);
  const feed = usePropertyFeed({
    city,
    filters,
    query,
    limit,
    hydrated: account.hydrated,
    landlordListings: account.landlordListings,
    setLandlordListings: account.setLandlordListings,
  });

  return {
    loaded: feed.loaded,
    hydrated: account.hydrated,
    properties: feed.properties,
    hasMore: feed.hasMore,
    loadingMore: feed.loadingMore,
    loadMore: feed.loadMore,
    landlordListings: account.landlordListings,
    setLandlordListings: account.setLandlordListings,
    createLandlordListing: feed.createLandlordListing,
    deleteLandlordListing: feed.deleteLandlordListing,
    updateLandlordListing: feed.updateLandlordListing,
    setPropertySaveCount: feed.setPropertySaveCount,
    recommendationProfile: account.recommendationProfile,
    contractors: account.contractors,
    saved: account.saved,
    setSaved: account.setSaved,
    liked: account.liked,
    setLiked: account.setLiked,
    contractorLiked: account.contractorLiked,
    setContractorLiked: account.setContractorLiked,
    contractorRegistrations: account.contractorRegistrations,
    setContractorRegistrations: account.setContractorRegistrations,
    landlordRegistration: account.landlordRegistration,
    setLandlordRegistration: account.setLandlordRegistration,
    proRegistration: account.proRegistration,
    setProRegistration: account.setProRegistration,
    userProfile: account.userProfile,
    setUserProfile: account.setUserProfile,
    threads: account.threads,
    setThreads: account.setThreads,
    viewingRequested: account.viewingRequested,
    setViewingRequested: account.setViewingRequested,
  };
}
