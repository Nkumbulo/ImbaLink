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
  Bell,
} from "lucide-react";
import { T } from "../styles/tokens";
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
import HomePropertyFeed from "./HomePage/HomePropertyFeed";
import { useHomeFeedData } from "./HomePage/useHomeFeedData";
import { useHomePageBehavior } from "./HomePage/useHomePageBehavior";
import HomeFilterBar from "./HomePage/HomeFilterBar";

const HomePage = React.memo(function HomePage({
  properties,
  pinnedListingId,
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
  onOpenNotifications,
  unreadNotifCount = 0,
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
  recommendationProfile,
}) {
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)");
  const isFetchingRef = useRef(false);

  const { cityProperties, propertyTypes, priceCeiling, sortedCityProperties, feed } = useHomeFeedData({
    properties, city, filters, sort, pinnedListingId, recommendationProfile,
  });

  // Render every property currently loaded by the database pagination layer.
  // The database/hook controls how much is fetched; the Home UI must not add
  // a second hard cap that silently hides valid results.
  const renderedFeed = feed;

  const {
    pressedCity, setPressedCity, pressedFilterBtn, setPressedFilterBtn, pressedSort, setPressedSort,
    pressedPillKey, setPressedPillKey, mobileHeaderHeight, mobileHeaderRef,
    openDropdown, setOpenDropdown, quickViewProperty, setQuickViewProperty,
    sentinelRef, dropdownRef, toggleDropdown,
  } = useHomePageBehavior({ isDesktopLayout, loadMore, loadingMore, hasMore, renderedFeed, onFilterBarVisibilityChange });

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

  const baseNounPlural = filters.type === "All" ? "homes" : `${filters.type.toLowerCase()}s`;
  const baseNounSingular = filters.type === "All" ? "home" : filters.type.toLowerCase();
  const verifiedLabel = filters.verifiedOnly ? "Verified " : "";
  const subheroLabel =
    feed.length === 0
      ? `No ${verifiedLabel}${baseNounPlural} available`
      : feed.length === 1
      ? `1 ${verifiedLabel}${baseNounSingular} available`
      : `${feed.length} ${verifiedLabel}${baseNounPlural} available`;


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
              onClick={() => onOpenNotifications?.()}
              className="f-body font-medium flex items-center justify-center relative"
              aria-label={`Open notifications${unreadNotifCount ? `, ${unreadNotifCount} unread` : ""}`}
              title="Notifications"
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
              <Bell size={18} strokeWidth={2} />
              {unreadNotifCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute flex items-center justify-center rounded-full f-body font-bold"
                  style={{
                    top: 5,
                    right: 5,
                    minWidth: 15,
                    height: 15,
                    padding: "0 3px",
                    background: T.jacaranda,
                    color: T.paper,
                    fontSize: 8,
                    lineHeight: 1,
                    border: "2px solid rgba(20,32,26,.92)",
                  }}
                >
                  {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                </span>
              )}
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

        <HomeFilterBar
          isDesktopLayout={isDesktopLayout}
          city={city}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          setSort={setSort}
          setShowCityPicker={setShowCityPicker}
          setShowFilters={setShowFilters}
          propertyTypes={propertyTypes}
          cityProperties={cityProperties}
          priceCeiling={priceCeiling}
          hasOtherActiveFilters={hasOtherActiveFilters}
          hasAnyActiveFilter={hasAnyActiveFilter}
          dropdownRef={dropdownRef}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          toggleDropdown={toggleDropdown}
          pressedPillKey={pressedPillKey}
          setPressedPillKey={setPressedPillKey}
          pressedSort={pressedSort}
          setPressedSort={setPressedSort}
        />

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

        <HomePropertyFeed
          renderedFeed={renderedFeed}
          feedLength={feed.length}
          isTabletOrDesktop={isTabletOrDesktop}
          isDesktopLayout={isDesktopLayout}
          filtersSuburb={filters.suburb}
          liked={liked}
          saved={saved}
          toggleLike={toggleLikeRef.current}
          toggleSave={toggleSaveRef.current}
          openProperty={openPropertyRef.current}
          onOpenLister={onOpenListerRef.current}
          viewingRequested={viewingRequested}
          onRequestViewing={onRequestViewingRef.current}
          onSend={onSendRef.current}
          onOpenMessage={onOpenMessageRef.current}
          getCardHandlers={getCardHandlers}
          loadingMore={loadingMore}
          hasMore={hasMore}
          sentinelRef={sentinelRef}
          verifiedOnly={filters.verifiedOnly}
          baseNounPlural={baseNounPlural}
          quickViewProperty={quickViewProperty}
          onSetQuickViewProperty={setQuickViewProperty}
          onCloseQuickView={()=>setQuickViewProperty(null)}
          onViewFullDetails={(prop)=>{setQuickViewProperty(null);openPropertyRef.current?.(prop);}}
        />
      </div>
    </div>
  );
});

export default HomePage;
