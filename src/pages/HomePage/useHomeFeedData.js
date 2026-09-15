import { useMemo } from "react";
import { getCityProperties, getPropertyTypes, getPriceCeiling, bedsOf } from "../../utils/propertyHelpers";
import {
  isPropertyVerified,
  bathsOf,
  isFurnishedProp,
  isUnfurnishedProp,
  hasParkingProp,
  isAvailableNowProp,
  amenitiesOf,
  isPetFriendlyProp,
} from "./propertyPredicates";

/**
 * Owns Home's derived property-feed data so the page component can focus on UI.
 * This is deliberately pure: filtering/sorting stays deterministic and easy to test.
 */
export function useHomeFeedData({ properties, city, filters, sort, pinnedListingId, recommendationProfile }) {
  const recommendationScore = (p) => {
    const profile = recommendationProfile;
    if (!profile || Number(profile.signals) < 3 || !p) return 0;
    const key = (value) => String(value || '').trim();
    const scoreMap = (obj, value) => Number(obj?.[key(value)] || 0);
    const maxMap = (obj) => Math.max(1, ...Object.values(obj || {}).map(Number));
    const cityScore = scoreMap(profile.cities, p.city) / maxMap(profile.cities);
    const suburbScore = scoreMap(profile.suburbs, p.suburb) / maxMap(profile.suburbs);
    const typeScore = scoreMap(profile.types, p.type || p.propertyType) / maxMap(profile.types);
    const rent = Number(p.rent) || 0;
    const avgRent = Number(profile.avgRent) || 0;
    const rentSpan = Math.max(50, Number(profile.maxRent || 0) - Number(profile.minRent || 0));
    const rentScore = avgRent > 0 ? Math.max(0, 1 - Math.abs(rent - avgRent) / rentSpan) : 0;
    const rooms = Number(p.rooms) || 0;
    const avgRooms = Number(profile.avgRooms) || 0;
    const roomScore = avgRooms > 0 ? Math.max(0, 1 - Math.abs(rooms - avgRooms) / Math.max(2, avgRooms)) : 0;
    const furnishedScore = Boolean(p.furnished) === (Number(profile.furnishedScore) >= 0.5) ? 1 : 0;
    const parkingScore = Boolean(p.parking) === (Number(profile.parkingScore) >= 0.5) ? 1 : 0;
    return cityScore * 32 + suburbScore * 28 + typeScore * 15 + rentScore * 12 + roomScore * 5 + furnishedScore * 4 + parkingScore * 4;
  };
  const cityProperties = useMemo(() => getCityProperties(properties, city), [properties, city]);
  const propertyTypes = useMemo(() => getPropertyTypes(cityProperties), [cityProperties]);
  const priceCeiling = useMemo(() => getPriceCeiling(cityProperties), [cityProperties]);

  const sortedCityProperties = useMemo(() => {
    const sorted = [...cityProperties].sort((a, b) => {
      if (sort === "price_asc") return (Number(a.rent) || 0) - (Number(b.rent) || 0);
      if (sort === "price_desc") return (Number(b.rent) || 0) - (Number(a.rent) || 0);
      const recommendationDelta = recommendationScore(b) - recommendationScore(a);
      if (Number(recommendationProfile?.signals) >= 3 && recommendationDelta !== 0) return recommendationDelta;
      return Number(a.postedDaysAgo || 0) - Number(b.postedDaysAgo || 0);
    });

    // A freshly submitted listing stays at the top while background work completes.
    if (pinnedListingId != null) {
      const idx = sorted.findIndex((p) => String(p.id) === String(pinnedListingId));
      if (idx > 0) {
        const [pinned] = sorted.splice(idx, 1);
        sorted.unshift(pinned);
      }
    }
    return sorted;
  }, [cityProperties, sort, pinnedListingId, recommendationProfile]);

  const feed = useMemo(() => sortedCityProperties.filter((p) => {
    if (!p) return false;
    if (filters.type !== "All") {
      const typeValue = String(p.type || p.propertyType || p.category || "").toLowerCase();
      if (!typeValue.includes(filters.type.toLowerCase())) return false;
    }
    if (filters.verifiedOnly && !isPropertyVerified(p)) return false;
    if (filters.maxPrice != null && Number(p.rent) > Number(filters.maxPrice)) return false;
    if (filters.minPrice != null && Number(p.rent) < Number(filters.minPrice)) return false;
    if (filters.beds && filters.beds !== "Any") {
      const min = filters.beds === "5+" ? 5 : Number(filters.beds);
      const beds = bedsOf(p);
      if (Number.isNaN(beds) || beds < min) return false;
    }
    if (filters.baths && filters.baths !== "Any") {
      const min = filters.baths === "3+" ? 3 : Number(filters.baths);
      const baths = bathsOf(p);
      if (Number.isNaN(baths) || baths < min) return false;
    }
    if (filters.furnished && filters.furnished !== "Any") {
      if (filters.furnished === "Furnished" && !isFurnishedProp(p)) return false;
      if (filters.furnished === "Unfurnished" && !isUnfurnishedProp(p)) return false;
    }
    if (filters.petFriendly && !isPetFriendlyProp(p)) return false;
    if (filters.parking && !hasParkingProp(p)) return false;
    if (filters.availableNow && !isAvailableNowProp(p)) return false;
    if (filters.amenities?.length) {
      const propAmenities = amenitiesOf(p);
      if (!filters.amenities.every((a) => propAmenities.includes(a))) return false;
    }
    return true;
  }), [sortedCityProperties, filters]);

  return { cityProperties, propertyTypes, priceCeiling, sortedCityProperties, feed };
}
