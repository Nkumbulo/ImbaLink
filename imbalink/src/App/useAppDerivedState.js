import { useMemo } from "react";
import { getCityProperties, bedsOf } from "../utils/propertyHelpers";
import { isStudentAccommodation } from "../utils/studentHelpers";

/**
 * Centralizes AppContent's pure derived state. No persistence, effects or
 * navigation live here; this hook is deliberately deterministic.
 */
export default function useAppDerivedState({
  properties,
  city,
  query,
  filters,
  user,
  userProfile,
  conversationUnreadCounts,
  viewingLister,
}) {
  const totalUnread = useMemo(() => (
    Object.values(conversationUnreadCounts || {}).reduce(
      (sum, count) => sum + (Number(count) || 0),
      0
    )
  ), [conversationUnreadCounts]);

  const activeFilters = useMemo(() => ({
    ...filters,
    active: filters.suburb !== "All" ||
      filters.type !== "All" ||
      Number(filters.maxPrice) < 1000 ||
      filters.minPrice > 0 ||
      filters.verifiedOnly,
  }), [filters]);

  const results = useMemo(() => (properties || []).filter((property) => {
    if (!property) return false;
    if (city !== "All" && property.city !== city) return false;
    if (
      query &&
      !(`${property.title || ""} ${property.suburb || ""} ${property.type || ""} ${property.landlord || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()))
    ) return false;
    if (filters.suburb !== "All" && property.suburb !== filters.suburb) return false;
    if (filters.type !== "All" && property.type !== filters.type) return false;
    // 1000 is the UI ceiling sentinel (shown as "$1,000+"). It is not an upper bound.
    if (Number.isFinite(Number(filters.maxPrice)) && Number(filters.maxPrice) < 1000 && property.rent > Number(filters.maxPrice)) return false;
    if (filters.minPrice && property.rent < filters.minPrice) return false;
    if (filters.verifiedOnly && property.verification !== "verified") return false;

    if (filters.beds && filters.beds !== "Any") {
      const min = filters.beds === "5+" ? 5 : Number(filters.beds);
      const beds = bedsOf(property);
      if (Number.isNaN(beds) || beds < min) return false;
    }

    if (filters.furnished === "Furnished" && !property.furnished) return false;
    if (filters.furnished === "Unfurnished" && property.furnished) return false;
    if (filters.parking && !property.parking) return false;
    if (filters.baths && filters.baths !== "Any") {
      const min = filters.baths === "3+" ? 3 : Number(filters.baths);
      const baths = Number(property.bathrooms) || 0;
      if (baths < min) return false;
    }

    return true;
  }), [
    properties,
    city,
    query,
    filters.suburb,
    filters.type,
    filters.maxPrice,
    filters.minPrice,
    filters.verifiedOnly,
    filters.beds,
    filters.furnished,
    filters.parking,
    filters.baths,
  ]);

  const studentMode = (userProfile || user)?.accountType === "student";

  const searchResults = useMemo(
    () => (studentMode ? results.filter(isStudentAccommodation) : results),
    [results, studentMode]
  );

  const homeCityProperties = useMemo(
    () => getCityProperties(properties, city),
    [properties, city]
  );

  const listerListings = useMemo(() => {
    if (!viewingLister) return [];
    return (properties || []).filter(
      (property) => property && String(property.ownerUserId || property.landlordRegistrationId || "") === String(viewingLister.id)
    );
  }, [properties, viewingLister]);

  return {
    totalUnread,
    activeFilters,
    results,
    studentMode,
    searchResults,
    homeCityProperties,
    listerListings,
  };
}
