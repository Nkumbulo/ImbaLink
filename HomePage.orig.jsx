import React, { useEffect, useLayoutEffect, useRef, useMemo, useCallback, useState } from "react";
import useMediaQuery from "../hooks/useMediaQuery";
import {
  ChevronDown,
  SlidersHorizontal,
  ShieldCheck,
  ArrowUpDown,
  Check,
  RotateCcw,
  MapPin,
  Home,
  DollarSign,
  BedDouble,
  Link2,
  GraduationCap,
} from "lucide-react";
import { T } from "../styles/tokens";
import PostCard from "../components/property/PostCard";
import GridTile from "../components/property/GridTile";
import PropertyQuickView from "../components/property/PropertyQuickView";
import ToggleSwitch from "../components/common/ToggleSwitch";
import PriceHistogramSlider from "../components/common/PriceHistogramSlider";
import { getCityProperties, getPropertyTypes, getPriceCeiling, bedsOf } from "../utils/propertyHelpers";
import {
  isPropertyVerified,
  bathsOf,
  isFurnishedProp,
  isUnfurnishedProp,
  hasParkingProp,
  isAvailableNowProp,
  amenitiesOf,
  isPetFriendlyProp,
} from "./HomePage/propertyPredicates";
import { BEDS_OPTIONS, BATHS_OPTIONS, FURNISHED_OPTIONS, AMENITY_OPTIONS, SORT_OPTIONS } from "./HomePage/filterOptions";
import { FilterPill, DesktopFilterField } from "./HomePage/FilterControls";
import HeroSection from "./HomePage/HeroSection";

// Module-level variable to remember scroll position
let savedHomeScrollTop = 0;

const HomePage = React.memo(function HomePage({
  properties,
  liked,
  saved,
  toggleLike,
  toggleSave,
  openProperty,
  onOpenLister,
  city,
  filters,
  setFilters,
  sort,
  setSort,
  setTab,
  viewingRequested,
  onRequestViewing,
  onSend,
  onOpenMessage,
  setShowCityPicker,
  setShowFilters,
  hasMore = false,
  loadingMore = false,
  loadMore,
  onFilterBarVisibilityChange,
}) {
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)");
  const sentinelRef = useRef(null);
  const loadMoreRef = useRef(loadMore);
  const loadingMoreRef = useRef(loadingMore);
  const throttleTimerRef = useRef(null);
  const isFetchingRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const dropdownRef = useRef(null);
  const mobileHeaderRef = useRef(null);

  const [pressedCity, setPressedCity] = React.useState(false);
  const [pressedFilterBtn, setPressedFilterBtn] = React.useState(false);
  const [pressedSort, setPressedSort] = React.useState(false);
  const [pressedPillKey, setPressedPillKey] = React.useState(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(78);

  const [openDropdown, setOpenDropdown] = useState(null);
  const [quickViewProperty, setQuickViewProperty] = useState(null);

  // Scroll restoration
  useLayoutEffect(() => {
    const container = document.querySelector('.app-main-shell');
    if (container) {
      scrollContainerRef.current = container;
      if (savedHomeScrollTop > 0) {
        container.scrollTop = savedHomeScrollTop;
      }

      let scrollRaf = null;

      const handleScroll = () => {
        if (scrollRaf !== null) return;
        scrollRaf = window.requestAnimationFrame(() => {
          savedHomeScrollTop = container.scrollTop;
          scrollRaf = null;
        });
      };

      container.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        container.removeEventListener("scroll", handleScroll);
        if (scrollRaf !== null) {
          window.cancelAnimationFrame(scrollRaf);
          scrollRaf = null;
        }
        scrollContainerRef.current = null;
      };
    }
  }, []);

  // Measure the fixed mobile header's real height
  useLayoutEffect(() => {
    if (isDesktopLayout) return;
    const el = mobileHeaderRef.current;
    if (!el) return;

    const updateHeight = () => {
      const next = Math.ceil(el.getBoundingClientRect().height);
      if (next > 0) {
        setMobileHeaderHeight((prev) => (prev === next ? prev : next));
      }
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isDesktopLayout]);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
    if (!loadingMore) isFetchingRef.current = false;
  }, [loadingMore]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;

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

  // Let the app shell know when the inline filter row scrolls out of view,
  // so it can surface a compact quick-filter bar in the sticky header.
  useEffect(() => {
    if (!onFilterBarVisibilityChange) return;
    const el = dropdownRef.current;
    if (!el) return;

    // `.app-main-shell` only ever gets a min-height in CSS, so it never
    // actually clips/scrolls internally — the real scrolling happens on the
    // document. Use the default viewport root, not that element.
    const observer = new IntersectionObserver(
      ([entry]) => onFilterBarVisibilityChange(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      onFilterBarVisibilityChange(true);
    };
  }, [onFilterBarVisibilityChange]);

  const cityProperties = useMemo(
    () => getCityProperties(properties, city),
    [properties, city]
  );

  const propertyTypes = useMemo(
    () => getPropertyTypes(cityProperties),
    [cityProperties]
  );

  const priceCeiling = useMemo(
    () => getPriceCeiling(cityProperties),
    [cityProperties]
  );

  const sortedCityProperties = useMemo(() => {
    if (sort === "price_asc") {
      return [...cityProperties].sort(
        (a, b) => (Number(a.rent) || 0) - (Number(b.rent) || 0)
      );
    }
    if (sort === "price_desc") {
      return [...cityProperties].sort(
        (a, b) => (Number(b.rent) || 0) - (Number(a.rent) || 0)
      );
    }
    return [...cityProperties].sort(
      (a, b) => Number(a.postedDaysAgo || 0) - Number(b.postedDaysAgo || 0)
    );
  }, [cityProperties, sort]);

  const feed = useMemo(() => {
    return sortedCityProperties.filter((p) => {
      if (!p) return false;

      if (filters.type !== "All") {
        const typeValue = String(
          p.type || p.propertyType || p.category || ""
        ).toLowerCase();

        if (!typeValue.includes(filters.type.toLowerCase())) return false;
      }

      if (filters.verifiedOnly && !isPropertyVerified(p)) return false;

      if (
        filters.maxPrice != null &&
        Number(p.rent) > Number(filters.maxPrice)
      ) {
        return false;
      }

      if (
        filters.minPrice != null &&
        Number(p.rent) < Number(filters.minPrice)
      ) {
        return false;
      }

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

      if (filters.amenities && filters.amenities.length > 0) {
        const propAmenities = amenitiesOf(p);
        const hasAll = filters.amenities.every((a) => propAmenities.includes(a));
        if (!hasAll) return false;
      }

      return true;
    });
  }, [
    sortedCityProperties,
    filters.type,
    filters.verifiedOnly,
    filters.maxPrice,
    filters.minPrice,
    filters.beds,
    filters.baths,
    filters.furnished,
    filters.petFriendly,
    filters.parking,
    filters.availableNow,
    filters.amenities,
  ]);

  // Render every property currently loaded by the database pagination layer.
  // The database/hook controls how much is fetched; the Home UI must not add
  // a second hard cap that silently hides valid results.
  const renderedFeed = feed;

  const displayLabel = filters.suburb !== "All" ? filters.suburb : city;
  const hasOtherActiveFilters =
    filters.verifiedOnly ||
    filters.type !== "All" ||
    (filters.beds && filters.beds !== "Any") ||
    (filters.baths && filters.baths !== "Any") ||
    (filters.furnished && filters.furnished !== "Any") ||
    filters.petFriendly ||
    filters.parking ||
    filters.availableNow ||
    (filters.amenities && filters.amenities.length > 0) ||
    (filters.maxPrice != null && filters.maxPrice < priceCeiling) ||
    (filters.minPrice != null && filters.minPrice > 0);
  const hasAnyActiveFilter = hasOtherActiveFilters || sort !== "newest";

  const onRequestViewingRef = useRef(onRequestViewing);
  const onSendRef = useRef(onSend);
  const onOpenMessageRef = useRef(onOpenMessage);
  const onOpenListerRef = useRef(onOpenLister);
  const openPropertyRef = useRef(openProperty);
  const toggleLikeRef = useRef(toggleLike);
  const toggleSaveRef = useRef(toggleSave);

  useEffect(() => {
    onRequestViewingRef.current = onRequestViewing;
    onSendRef.current = onSend;
    onOpenMessageRef.current = onOpenMessage;
    onOpenListerRef.current = onOpenLister;
    openPropertyRef.current = openProperty;
    toggleLikeRef.current = toggleLike;
    toggleSaveRef.current = toggleSave;
  }, [
    onRequestViewing,
    onSend,
    onOpenMessage,
    onOpenLister,
    openProperty,
    toggleLike,
    toggleSave,
  ]);

  const cardHandlersRef = useRef(new Map());

  const getCardHandlers = useCallback((id) => {
    const key = String(id);
    const existing = cardHandlersRef.current.get(key);
    if (existing) return existing;

    const handlers = {
      onRequestViewing: () => onRequestViewingRef.current?.(id),
    };

    cardHandlersRef.current.set(key, handlers);
    return handlers;
  }, []);

  useEffect(() => {
    const activeIds = new Set(renderedFeed.map((p) => String(p.id)));

    for (const key of cardHandlersRef.current.keys()) {
      if (!activeIds.has(key)) {
        cardHandlersRef.current.delete(key);
      }
    }

    return () => {
      cardHandlersRef.current.clear();
    };
  }, [renderedFeed]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof loadMoreRef.current !== "function") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && !loadingMoreRef.current && !isFetchingRef.current) {
          if (throttleTimerRef.current) return;
          throttleTimerRef.current = setTimeout(() => {
            isFetchingRef.current = true;
            loadMoreRef.current();
            throttleTimerRef.current = null;
          }, 200);
        }
      },
      { rootMargin: "500px 0px", threshold: 0 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    };
  }, [hasMore, renderedFeed.length]);

  const baseNounPlural = filters.type === "All" ? "homes" : `${filters.type.toLowerCase()}s`;
  const baseNounSingular = filters.type === "All" ? "home" : filters.type.toLowerCase();
  const verifiedLabel = filters.verifiedOnly ? "Verified " : "";
  const subheroLabel =
    feed.length === 0
      ? `No ${verifiedLabel}${baseNounPlural} available`
      : feed.length === 1
      ? `1 ${verifiedLabel}${baseNounSingular} available`
      : `${feed.length} ${verifiedLabel}${baseNounPlural} available`;

  const toggleDropdown = (key) =>
    setOpenDropdown((cur) => (cur === key ? null : key));

  const toggleAmenity = (key) => {
    setFilters?.((f) => {
      const current = Array.isArray(f.amenities) ? f.amenities : [];
      const next = current.includes(key)
        ? current.filter((a) => a !== key)
        : [...current, key];
      return { ...f, amenities: next };
    });
  };

  const clearAll = () => {
    setFilters?.((f) => ({
      ...f,
      type: "All",
      beds: "Any",
      baths: "Any",
      furnished: "Any",
      petFriendly: false,
      parking: false,
      availableNow: false,
      amenities: [],
      minPrice: 0,
      maxPrice: priceCeiling,
      verifiedOnly: false,
    }));
    setSort?.("newest");
    setOpenDropdown(null);
  };

  const pillDense = isDesktopLayout;
  const pillRowClass = isDesktopLayout
    ? "flex flex-wrap items-center gap-1"
    : "grid grid-cols-5 gap-1.5";
  const dropdownPanelStyle = {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    zIndex: 20,
    background: T.paper,
    borderRadius: 14,
    padding: 6,
    minWidth: 150,
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  };

  const bedsValueLabel = (!filters.beds || filters.beds === "Any") ? "Any" : filters.beds;
  const priceValueLabel =
    (filters.maxPrice != null && filters.maxPrice < priceCeiling) ||
    (filters.minPrice != null && filters.minPrice > 0)
      ? `$${filters.minPrice ?? 0} — $${filters.maxPrice ?? priceCeiling}`
      : "$Min — $Max";

  // Create dropdown content for each filter
  const typeDropdown = (
    <div className="fade mobile-filter-dropdown mobile-filter-dropdown-type" style={{ ...dropdownPanelStyle, minWidth: 160 }}>
      {propertyTypes.map((t) => {
        const selected = filters.type === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => {
              setFilters?.((f) => ({ ...f, type: t }));
              setOpenDropdown(null);
            }}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{
              background: selected ? T.paperDim : "transparent",
              color: T.ink,
              fontSize: 12.5,
              border: "none",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {t}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
    </div>
  );

  const bedsDropdown = (
    <div className="fade mobile-filter-dropdown mobile-filter-dropdown-beds" style={{ ...dropdownPanelStyle, minWidth: 140 }}>
      {BEDS_OPTIONS.map((b) => {
        const selected = (filters.beds || "Any") === b;
        return (
          <button
            key={b}
            type="button"
            onClick={() => {
              setFilters?.((f) => ({ ...f, beds: b }));
              setOpenDropdown(null);
            }}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{
              background: selected ? T.paperDim : "transparent",
              color: T.ink,
              fontSize: 12.5,
              border: "none",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {b === "Any" ? "Any beds" : `${b} bed${b === "1" ? "" : "s"}+`}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
    </div>
  );

  const priceDropdown = (
    <div
      className="fade mobile-filter-dropdown mobile-filter-dropdown-price"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        right: 0,
        zIndex: 20,
        background: T.paper,
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      <div
        className="f-body"
        style={{ fontSize: 12, color: T.ink60, marginBottom: 6 }}
      >
        Price range
      </div>
      <PriceHistogramSlider
        cityProperties={cityProperties}
        min={0}
        max={priceCeiling}
        valueMin={filters.minPrice ?? 0}
        valueMax={filters.maxPrice ?? priceCeiling}
        onChange={(minPrice, maxPrice) =>
          setFilters?.((f) => ({ ...f, minPrice, maxPrice }))
        }
      />
      <button
        type="button"
        onClick={() => setOpenDropdown(null)}
        className="f-body font-semibold w-full mt-2 py-2 rounded-full"
        style={{
          background: T.jacaranda,
          color: T.paper,
          fontSize: 12,
          border: "none",
          cursor: "pointer",
        }}
      >
        Apply
      </button>
    </div>
  );

  const sortDropdown = (
    <div
      className="fade mobile-filter-dropdown mobile-filter-dropdown-sort"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        zIndex: 20,
        background: T.paper,
        borderRadius: 14,
        padding: 6,
        minWidth: 190,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      {SORT_OPTIONS.map((opt) => {
        const selected = sort === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              setSort?.(opt.key);
              setOpenDropdown(null);
            }}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{
              background: selected ? T.paperDim : "transparent",
              color: T.ink,
              fontSize: 12.5,
              border: "none",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {opt.label}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="pb-8 web-page home-page">
      {/* Fixed header (mobile) */}
      {!isDesktopLayout && (
        <div
          ref={mobileHeaderRef}
          className="web-hero web-sticky-header flex items-center justify-between px-4 pb-2.5"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                background: "#F1EBDB",
                color: T.msasa,
                border: "1px solid rgba(251,248,240,0.14)",
              }}
            >
              <Link2 size={15} strokeWidth={2.2} />
            </span>
            <div className="f-display font-extrabold" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
              <span style={{ color: "#FFFFFF" }}>Imba</span>
              <span style={{ color: "#DEC5A4" }}>Link</span>
            </div>
          </div>
          <div
            className="flex items-center gap-2 shrink-0"
            style={{ marginLeft: 8 }}
          >
            <button
              type="button"
              onClick={() => setShowCityPicker?.(true)}
              onPointerDown={() => setPressedCity(true)}
              onPointerUp={() => setPressedCity(false)}
              onPointerLeave={() => setPressedCity(false)}
              onPointerCancel={() => setPressedCity(false)}
              className="f-body font-medium flex items-center justify-center gap-1 px-3"
              aria-label={`Choose city, currently ${displayLabel}`}
              title="All cities"
              style={{
                color: T.paper,
                background: "rgba(255,255,255,0.08)",
                minWidth: 44,
                height: 44,
                maxWidth: 132,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                transform: pressedCity ? "scale(0.95)" : "scale(1)",
                transition: "transform 120ms ease",
                overflow: "hidden",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayLabel}
              </span>
              {hasOtherActiveFilters && (
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.paper, flexShrink: 0 }} />
              )}
              <ChevronDown size={11} style={{ flexShrink: 0 }} />
            </button>

            <button
              type="button"
              onClick={() => setTab?.("services")}
              className="f-body font-medium flex items-center justify-center"
              aria-label="Open student accommodation"
              title="Student accommodation"
              style={{
                color: T.paper,
                background: "rgba(255,255,255,0.08)",
                width: 44,
                height: 44,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                flexShrink: 0,
              }}
            >
              <GraduationCap size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* Page content */}
      <div
        className="web-home-content"
        style={{
          paddingTop: isDesktopLayout ? 24 : `calc(env(safe-area-inset-top, 0px) + ${mobileHeaderHeight}px)`,
          boxSizing: "border-box",
        }}
      >
        <HeroSection isDesktop={isDesktopLayout} />

        {/* Filter row + all dropdown panels share one positioned container */}
        <div
          ref={dropdownRef}
          className={isDesktopLayout ? "desktop-filter-shell" : "px-4 pb-3 mobile-only-filter-toolbar"}
          style={
            isDesktopLayout
              ? { padding: "0 24px", position: "relative", marginTop: 32 }
              : { marginTop: 10, position: "relative" }
          }
        >
          {isDesktopLayout ? (
            <>
              {/* Filter card */}
              <div
                className="desktop-filter-card"
                style={{
                  background: "var(--theme-surface, #FBF8F0)",
                  border: `1px solid ${T.line}`,
                  borderRadius: 18,
                  padding: "12px",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <DesktopFilterField
                  label="Location"
                  icon={MapPin}
                  value={city === "All" ? "All Cities" : city}
                  onClick={() => setShowCityPicker?.(true)}
                />
                <DesktopFilterField
                  label="Property Type"
                  icon={Home}
                  value={filters.type === "All" ? "All Types" : filters.type}
                  onClick={() => toggleDropdown("type")}
                  open={openDropdown === "type"}
                  dropdown={typeDropdown}
                />
                <DesktopFilterField
                  label="Price Range"
                  icon={DollarSign}
                  value={priceValueLabel}
                  onClick={() => toggleDropdown("price")}
                  open={openDropdown === "price"}
                  dropdown={priceDropdown}
                  style={{ flex: "1 1 190px", minWidth: 190 }}
                />
                <DesktopFilterField
                  label="Bedrooms"
                  icon={BedDouble}
                  value={bedsValueLabel}
                  onClick={() => toggleDropdown("beds")}
                  open={openDropdown === "beds"}
                  dropdown={bedsDropdown}
                />

                {/* Reset filters */}
                <div className="desktop-filter-reset-wrap" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span
                    className="f-body"
                    style={{ fontSize: 12, color: "transparent", fontWeight: 600, userSelect: "none" }}
                    aria-hidden="true"
                  >
                    Reset
                  </span>
                  <button
                    type="button"
                    onClick={clearAll}
                    aria-label="Reset filters"
                    title="Reset filters"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${T.line}`,
                      borderRadius: 10,
                      width: 40,
                      height: 40,
                      background: "#fff",
                      color: hasAnyActiveFilter ? T.jacaranda : T.ink60,
                      cursor: "pointer",
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilters?.(true)}
                  className="desktop-more-filters"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: `1px solid ${hasOtherActiveFilters ? T.msasa : T.line}`,
                    borderRadius: 10,
                    padding: "0 16px",
                    height: 40,
                    background: "#fff",
                    color: hasOtherActiveFilters ? T.msasa : T.ink,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <SlidersHorizontal size={14} />
                  <span>More Filters</span>
                </button>
              </div>

              {/* Verified toggle + Sort row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 14,
                  padding: "0 2px",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <ToggleSwitch
                    on={filters.verifiedOnly}
                    onToggle={() => setFilters?.((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))}
                  />
                  <span className="f-body" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
                    Show Verified Only
                  </span>
                </label>

                {/* Sort button wrapped in relative container for dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => toggleDropdown("sort")}
                    className="f-body"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: T.ink,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ color: T.ink60 }}>Sort by</span>
                    <ArrowUpDown size={14} />
                    <span style={{ fontWeight: 700 }}>
                      {SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Newest"}
                    </span>
                    <ChevronDown size={14} />
                  </button>
                  {openDropdown === "sort" && sortDropdown}
                </div>
              </div>
            </>
          ) : (
            <div className={pillRowClass}>
              <FilterPill
                label="Type"
                active={filters.type !== "All"}
                pressed={pressedPillKey === "type"}
                onPress={(v) => setPressedPillKey(v ? "type" : null)}
                onClick={() => toggleDropdown("type")}
                dense={pillDense}
              />
              <FilterPill
                label="Beds"
                active={!!filters.beds && filters.beds !== "Any"}
                pressed={pressedPillKey === "beds"}
                onPress={(v) => setPressedPillKey(v ? "beds" : null)}
                onClick={() => toggleDropdown("beds")}
                dense={pillDense}
              />
              <FilterPill
                label="Price"
                active={
                  (filters.maxPrice != null && filters.maxPrice < priceCeiling) ||
                  (filters.minPrice != null && filters.minPrice > 0)
                }
                pressed={pressedPillKey === "price"}
                onPress={(v) => setPressedPillKey(v ? "price" : null)}
                onClick={() => toggleDropdown("price")}
                dense={pillDense}
              />

              <FilterPill
                label=""
                ariaLabel="Reset filters"
                active={hasAnyActiveFilter}
                icon={RotateCcw}
                iconSize={16}
                showActiveDotOnly
                pressed={pressedPillKey === "reset"}
                onPress={(v) => setPressedPillKey(v ? "reset" : null)}
                onClick={clearAll}
                dense={pillDense}
              />
              <button
                type="button"
                onClick={() => toggleDropdown("sort")}
                onPointerDown={() => setPressedSort(true)}
                onPointerUp={() => setPressedSort(false)}
                onPointerLeave={() => setPressedSort(false)}
                onPointerCancel={() => setPressedSort(false)}
                aria-label="Sort"
                className={`f-body font-medium flex items-center gap-1 ${pillDense ? "px-2 py-1" : "px-3 py-1.5"}`}
                style={{
                  color: sort !== "newest" ? T.ink : T.paper,
                  background: sort !== "newest" ? "#DEC5A4" : "rgba(255,255,255,0.08)",
                  fontSize: pillDense ? 10 : 10.5,
                  minHeight: pillDense ? 34 : 44,
                  borderRadius: 8,
                  WebkitTapHighlightColor: "transparent",
                  transitionProperty: "none",
                  touchAction: "manipulation",
                  transform: pressedSort ? "scale(0.95)" : "scale(1)",
                  whiteSpace: "nowrap",
                }}
              >
                <ArrowUpDown size={11} />
                <span>Sort</span>
              </button>
            </div>
          )}

          {/* Mobile dropdowns - only render on mobile since desktop has its own */}
          {!isDesktopLayout && openDropdown === "type" && typeDropdown}
          {!isDesktopLayout && openDropdown === "beds" && bedsDropdown}
          {!isDesktopLayout && openDropdown === "price" && priceDropdown}
          {!isDesktopLayout && openDropdown === "sort" && sortDropdown}
          {!isDesktopLayout && openDropdown === "baths" && (
            <div className="fade mobile-filter-dropdown mobile-filter-dropdown-baths" style={{ ...dropdownPanelStyle, minWidth: 140 }}>
              {BATHS_OPTIONS.map((b) => {
                const selected = (filters.baths || "Any") === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setFilters?.((f) => ({ ...f, baths: b }));
                      setOpenDropdown(null);
                    }}
                    className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{
                      background: selected ? T.paperDim : "transparent",
                      color: T.ink,
                      fontSize: 12.5,
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {b === "Any" ? "Any baths" : `${b} bath${b === "1" ? "" : "s"}+`}
                    {selected && <Check size={13} color={T.jacaranda} />}
                  </button>
                );
              })}
            </div>
          )}
          {!isDesktopLayout && openDropdown === "furnished" && (
            <div className="fade mobile-filter-dropdown mobile-filter-dropdown-furnished" style={{ ...dropdownPanelStyle, minWidth: 150 }}>
              {FURNISHED_OPTIONS.map((f) => {
                const selected = (filters.furnished || "Any") === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFilters?.((prev) => ({ ...prev, furnished: f }));
                      setOpenDropdown(null);
                    }}
                    className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{
                      background: selected ? T.paperDim : "transparent",
                      color: T.ink,
                      fontSize: 12.5,
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {f}
                    {selected && <Check size={13} color={T.jacaranda} />}
                  </button>
                );
              })}
            </div>
          )}
          {!isDesktopLayout && openDropdown === "amenities" && (
            <div className="fade" style={{ ...dropdownPanelStyle, minWidth: 190 }}>
              {AMENITY_OPTIONS.map((a) => {
                const selected = (filters.amenities || []).includes(a.key);
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => toggleAmenity(a.key)}
                    className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{
                      background: selected ? T.paperDim : "transparent",
                      color: T.ink,
                      fontSize: 12.5,
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {a.label}
                    {selected && <Check size={13} color={T.jacaranda} />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setOpenDropdown(null)}
                className="f-body font-semibold w-full mt-1 py-2 rounded-full"
                style={{
                  background: T.jacaranda,
                  color: T.paper,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Result summary (mobile only) */}
        {!isDesktopLayout && (
          <div className="flex items-center justify-between gap-2 px-4 pb-4" style={{ marginTop: 10 }}>
            <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <div
                className="f-body px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(251,248,240,0.78)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {subheroLabel}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <ShieldCheck
                  size={12}
                  style={{ color: filters.verifiedOnly ? "#72B78D" : "rgba(251,248,240,0.6)" }}
                />
                <ToggleSwitch
                  on={filters.verifiedOnly}
                  onToggle={() =>
                    setFilters?.((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))
                  }
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFilters?.(true)}
              onPointerDown={() => setPressedFilterBtn(true)}
              onPointerUp={() => setPressedFilterBtn(false)}
              onPointerLeave={() => setPressedFilterBtn(false)}
              onPointerCancel={() => setPressedFilterBtn(false)}
              className="f-body font-semibold flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shrink-0"
              style={{
                background: T.paper,
                color: T.ink,
                fontSize: 10.5,
                minHeight: 44,
                WebkitTapHighlightColor: "transparent",
                transitionProperty: "none",
                touchAction: "manipulation",
                transform: pressedFilterBtn ? "scale(0.95)" : "scale(1)",
              }}
              aria-label="Open filters"
            >
              <SlidersHorizontal size={14} strokeWidth={2.2} />
              <span>Filter</span>
            </button>
          </div>
        )}

        {/* Property grid - no container UI */}
        <div
          style={{
            marginTop: isDesktopLayout ? 18 : 2,
            padding: isDesktopLayout ? "0 24px" : undefined,
          }}
        >
          <div className="web-property-grid">
            {/* HomePage is a browsing/discovery feed: desktop shows the compact
                GridTile (many properties visible at once, no inline actions --
                clicking opens PropertyDetail for those), mobile shows the
                full-action PostCard (feed-style, one card at a time, like/save/
                message inline). SearchPage.jsx uses the OPPOSITE assignment
                (PostCard on desktop, GridTile on mobile), since a search
                results page is where desktop users are actively evaluating and
                acting on specific listings rather than browsing broadly. Keep
                this in mind before assuming a bug when tracing which card
                renders where -- it's intentional, not inverted by accident. */}
            {renderedFeed
              .filter((p) => p && p.id != null)
              .map((p) => (
                <div key={p.id}>
                  {isTabletOrDesktop ? (
                    <GridTile
                      p={p}
                      onOpen={setQuickViewProperty}
                      activeSuburb={filters.suburb}
                      compactDesktop={isDesktopLayout}
                    />
                  ) : (
                    <PostCard
                      p={p}
                      liked={liked.has(String(p.id))}
                      saved={saved.has(String(p.id))}
                      onToggleLike={toggleLikeRef.current}
                      onToggleSave={toggleSaveRef.current}
                      onOpen={openPropertyRef.current}
                      onOpenLister={onOpenListerRef.current}
                      viewingRequested={!!viewingRequested[p.id]}
                      onRequestViewing={getCardHandlers(p.id).onRequestViewing}
                      onSend={onSendRef.current}
                      onOpenMessage={onOpenMessageRef.current}
                      showDistance={false}
                    />
                  )}
                </div>
              ))}
          </div>

          {feed.length === 0 && (
            <div className="text-center py-14 f-body" style={{ color: T.ink60, fontSize: 13 }}>
              {`No ${verifiedLabel}${baseNounPlural} available.`}
              {filters.verifiedOnly && (
                <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
                  Make sure your properties have a `verified: true` field.
                </div>
              )}
            </div>
          )}

          <div ref={sentinelRef} className="h-12 flex items-center justify-center">
            {loadingMore && (
              <span className="f-body text-xs" style={{ color: T.ink60 }}>
                Loading more…
              </span>
            )}
            {!loadingMore && !hasMore && feed.length > 0 && (
              <span className="f-body text-xs" style={{ color: T.ink60 }}>
                You're all caught up ✓
              </span>
            )}
          </div>
        </div>
      </div>

      {quickViewProperty && (
        <PropertyQuickView
          p={quickViewProperty}
          liked={liked.has(String(quickViewProperty.id))}
          saved={saved.has(String(quickViewProperty.id))}
          onToggleLike={toggleLikeRef.current}
          onToggleSave={toggleSaveRef.current}
          onOpenLister={onOpenListerRef.current}
          viewingRequested={!!viewingRequested[quickViewProperty.id]}
          onRequestViewing={() => onRequestViewingRef.current?.(quickViewProperty.id)}
          onSend={onSendRef.current}
          onOpenMessage={onOpenMessageRef.current}
          onClose={() => setQuickViewProperty(null)}
          onViewFullDetails={(prop) => {
            setQuickViewProperty(null);
            openPropertyRef.current?.(prop);
          }}
          showDistance={false}
        />
      )}
    </div>
  );
});

export default HomePage;
