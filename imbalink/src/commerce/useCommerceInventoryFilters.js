import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commerceCategories, demoProducts } from "./commerceData.json";

// Shared across CommerceHomeFace (Shop Home) and CommerceSearchPage (Shop
// Explore) so both filter the same way instead of each re-implementing it.
export const COMMERCE_TYPE_OPTIONS = ["All", "Art", "Hardware", "Electronics", "Furniture", "Jewelry", "Fashion", "Vehicles", "Services"];
// Real product category (Electronics/Fashion/Home/...), same source of
// truth as commerceData.json and CommerceSellPage's own category picker —
// not a made-up grouping.
export const COMMERCE_CATEGORY_OPTIONS = commerceCategories;
// Condition-based grouping — previously (confusingly) also called
// "category" before this was untangled; lives under "More Filters" now.
export const COMMERCE_CONDITION_OPTIONS = ["All", "New", "Used", "Collectibles", "For Home", "For Work", "Services"];
export const COMMERCE_LOCATION_OPTIONS = ["All", ...Array.from(new Set(demoProducts.map((p) => p.location))).sort()];
export const COMMERCE_PRICE_CEILING = Math.max(...demoProducts.map((p) => p.price), 100);

function matchesConditionGroup(item, group) {
  if (group === "All") return true;
  if (group === "New") return String(item.condition).toLowerCase().startsWith("new");
  if (group === "Used") return String(item.condition).toLowerCase().includes("used");
  if (group === "Services") return item.type === "Services";
  if (group === "For Home") return ["Furniture", "Art"].includes(item.type);
  if (group === "For Work") return ["Hardware", "Electronics", "Services"].includes(item.type);
  // "Collectibles" has no dedicated field on demo listings yet — matches
  // everything for now, same as before this was extracted.
  return true;
}

export function useCommerceInventoryFilters(items, options = {}) {
  const [internalQuery, setInternalQuery] = useState("");
  // Optionally controlled from outside (the desktop topbar's search box
  // drives commerce filtering the same way it drives property filtering)
  // — falls back to its own local state when no external query is given.
  const query = options.query !== undefined ? options.query : internalQuery;
  const setQuery = options.onQueryChange || setInternalQuery;
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeType, setActiveType] = useState("All");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeCondition, setActiveCondition] = useState("All");
  const [activeLocation, setActiveLocation] = useState("All");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(COMMERCE_PRICE_CEILING);
  const [sort, setSort] = useState("newest");
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!openDropdown) return undefined;
    const handlePointerDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [openDropdown]);

  const toggleDropdown = useCallback((key) => {
    setOpenDropdown((current) => (current === key ? null : key));
  }, []);

  const setPriceRange = useCallback((lo, hi) => {
    setMinPrice(lo);
    setMaxPrice(hi);
  }, []);

  const visibleItems = useMemo(() => {
    let list = items;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((item) =>
        `${item.title} ${item.category} ${item.location} ${item.type || ""}`.toLowerCase().includes(q)
      );
    }
    if (verifiedOnly) list = list.filter((item) => item.verified);
    if (activeType !== "All") list = list.filter((item) => item.type === activeType);
    if (activeCategory !== "All") list = list.filter((item) => item.category === activeCategory);
    if (activeCondition !== "All") list = list.filter((item) => matchesConditionGroup(item, activeCondition));
    if (activeLocation !== "All") list = list.filter((item) => item.location === activeLocation);
    if (minPrice > 0 || maxPrice < COMMERCE_PRICE_CEILING) {
      list = list.filter((item) => item.price >= minPrice && item.price <= maxPrice);
    }
    if (sort === "price-low") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-high") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [items, query, verifiedOnly, activeType, activeCategory, activeCondition, activeLocation, minPrice, maxPrice, sort]);

  const isAnyFilterActive = verifiedOnly || activeType !== "All" || activeCategory !== "All"
    || activeCondition !== "All" || activeLocation !== "All"
    || minPrice > 0 || maxPrice < COMMERCE_PRICE_CEILING || sort !== "newest";
  const hasMoreFiltersActive = activeCondition !== "All";

  const clearAll = useCallback(() => {
    setVerifiedOnly(false);
    setActiveType("All");
    setActiveCategory("All");
    setActiveCondition("All");
    setActiveLocation("All");
    setMinPrice(0);
    setMaxPrice(COMMERCE_PRICE_CEILING);
    setSort("newest");
    setOpenDropdown(null);
  }, []);

  const cycleSort = useCallback(() => {
    setSort((v) => (v === "newest" ? "price-low" : v === "price-low" ? "price-high" : "newest"));
  }, []);

  return {
    query, setQuery,
    verifiedOnly, setVerifiedOnly,
    activeType, setActiveType,
    activeCategory, setActiveCategory,
    activeCondition, setActiveCondition,
    activeLocation, setActiveLocation,
    minPrice, maxPrice, setPriceRange, priceCeiling: COMMERCE_PRICE_CEILING,
    sort, setSort, cycleSort,
    openDropdown, setOpenDropdown, toggleDropdown, dropdownRef,
    visibleItems, isAnyFilterActive, hasMoreFiltersActive, clearAll,
    typeOptions: COMMERCE_TYPE_OPTIONS,
    categoryOptions: COMMERCE_CATEGORY_OPTIONS,
    conditionOptions: COMMERCE_CONDITION_OPTIONS,
    locationOptions: COMMERCE_LOCATION_OPTIONS,
  };
}
