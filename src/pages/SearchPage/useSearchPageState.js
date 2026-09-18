import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Module-level (not component state) so it survives this page unmounting
// entirely — e.g. tapping "Find a Roommate" from a card and then "Back"
// swaps SearchPage out of and back into .app-main-shell, which never
// itself unmounts (see App.jsx). Same pattern HomePage.jsx uses, and
// deliberately separate from `savedScrollRef` below, which exists for a
// different purpose (restoring position after clearing a suburb filter).
let savedSearchScrollTop = 0;

// All of SearchPage's interactive/derived state, moved here verbatim from
// the original monolithic component. Kept as one hook rather than several
// smaller ones because most of this state is genuinely interdependent
// (clearAll touches filters/sort/query/dropdown/randomSeed/scroll all at
// once; sortedResults depends on sort+randomSeed+filter state; the
// infinite-scroll refs all track each other) — same reasoning already
// documented for PostCard's usePostCardInteractions.
export function useSearchPageState({
  properties,
  query: _query,
  setQuery,
  filters,
  setFilters,
  results,
  city,
  isActive,
  hasMore,
  loadingMore,
  loadMore,
  openProperty,
  toggleLike,
  toggleSave,
  onRequestViewing,
  onSend,
  onOpenMessage,
  onOpenLister,
  isTabletOrDesktop,
}) {
  const pageRef = useRef(null);
  const headerRef = useRef(null);
  const dropdownRef = useRef(null);
  const savedScrollRef = useRef(0);
  const restoredScrollRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(108);
  const [leaving, setLeaving] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const activeCardRef = useRef(null);

  const selectDesktopCard = useCallback((property) => {
    if (!property?.id) return;
    setActiveCard((current) => {
      if (current && String(current.id) === String(property.id)) return null;
      return property;
    });
  }, []);

  useEffect(() => {
    activeCardRef.current = activeCard;
  }, [activeCard]);

  useEffect(() => {
    if (!isTabletOrDesktop || !activeCard) return;
    const handleOutsidePointer = (e) => {
      const card = e.target?.closest?.("[data-property-card-id]");
      if (!card || String(card.getAttribute("data-property-card-id")) !== String(activeCard.id)) {
        setActiveCard(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setActiveCard(null);
    };
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeCard, isTabletOrDesktop]);

  const [openDropdown, setOpenDropdown] = useState(null);
  const [sort, setSort] = useState("newest");
  const [randomSeed, setRandomSeed] = useState(0);

  const openingRef = useRef(false);
  const openTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) {
        window.clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (isActive) setLeaving(false);
  }, [isActive]);

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

  const handleOpenProperty = useCallback((property) => {
    if (!property || openingRef.current) return;
    openingRef.current = true;

    // Open the full PropertyDetail immediately. The previous implementation
    // waited for HEADER_TRANSITION_MS after clearing the mobile sheet. During
    // that gap the page could render only the green app background, making the
    // "View full details" button appear broken.
    setActiveCard(null);
    setLeaving(false);
    openProperty(property);

    // Release the guard on the next frame so repeated taps cannot race the
    // state transition but the detail view is never delayed.
    window.requestAnimationFrame(() => {
      openingRef.current = false;
    });
  }, [openProperty]);

  const propertyTypes = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          (city === "All" ? properties : properties.filter((p) => p.city === city))
            .map((p) => p.type)
            .filter(Boolean)
        )
      ),
    ],
    [properties, city]
  );

  const priceCeiling = useMemo(() => {
    const max = Math.max(1000, ...properties.map((p) => Number(p.price) || 0));
    return Math.ceil(max / 100) * 100;
  }, [properties]);

  const activeFilterCount =
    (filters.type !== "All" ? 1 : 0) +
    (filters.beds && filters.beds !== "Any" ? 1 : 0) +
    (filters.baths && filters.baths !== "Any" ? 1 : 0) +
    (filters.furnished && filters.furnished !== "Any" ? 1 : 0) +
    (filters.parking ? 1 : 0) +
    (filters.maxPrice < priceCeiling ? 1 : 0) +
    (filters.suburb !== "All" ? 1 : 0) +
    (filters.verifiedOnly ? 1 : 0);

  const isAnyFilterActive = activeFilterCount > 0;

  const sortedResults = useMemo(() => {
    if (randomSeed > 0 && !isAnyFilterActive && sort === "newest") {
      // A useMemo callback must be a pure function of its declared inputs
      // (same results/sort/randomSeed => same output), so the shuffle is
      // seeded from randomSeed itself instead of calling Math.random()
      // directly — the same seed now always reshuffles the same way,
      // and a new seed (set by the "shuffle" trigger below) still looks
      // freshly randomized to the user, same as before.
      let state = randomSeed >>> 0 || 1;
      const seededRandom = () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const shuffled = [...results];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    if (sort === "price_asc") {
      return [...results].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }
    if (sort === "price_desc") {
      return [...results].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    }
    return results;
  }, [results, sort, randomSeed, isAnyFilterActive]);

  // Scroll restoration — see savedSearchScrollTop above. `results` comes
  // in as a prop and can legitimately start empty for a moment (e.g.
  // right after a tab switch, before the parent's derived data settles),
  // so this keeps re-attempting the restore (via the length dependency)
  // until real content exists to scroll into, then stops — so it never
  // fights the user's own scrolling or filtering afterward.
  useLayoutEffect(() => {
    const container = document.querySelector(".app-main-shell");
    if (!container) return;

    if (!restoredScrollRef.current && savedSearchScrollTop > 0) {
      container.scrollTop = savedSearchScrollTop;
      if (sortedResults.length > 0) restoredScrollRef.current = true;
    }

    let raf = null;
    const handleScroll = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        savedSearchScrollTop = container.scrollTop;
        raf = null;
      });
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [sortedResults.length]);

  // The database hook already paginates the source data. Search renders every
  // property currently loaded and asks the hook for the next database page
  // when the sentinel enters the prefetch window. There is intentionally no
  // second UI-only 12-result pagination layer.
  const hasMoreResults = hasMore;
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const loadMoreFnRef = useRef(loadMore);
  const loadMoreObserverRef = useRef(null);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
  useEffect(() => { loadMoreFnRef.current = loadMore; }, [loadMore]);

  const loadMoreSentinelRef = useCallback((node) => {
    if (loadMoreObserverRef.current) {
      loadMoreObserverRef.current.disconnect();
      loadMoreObserverRef.current = null;
    }
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      if (!hasMoreRef.current || loadingMoreRef.current) return;
      loadMoreFnRef.current?.();
    }, { rootMargin: "500px 0px", threshold: 0 });

    observer.observe(node);
    loadMoreObserverRef.current = observer;
  }, []);

  useEffect(() => {
    // When another page is appended, the sentinel DOM position changes.
    // Reconnect the same guarded observer so an already-intersecting sentinel
    // can request the next page exactly once instead of getting stuck after
    // page 1. The loadMore guard prevents duplicate requests.
    const observer = loadMoreObserverRef.current;
    if (!observer) return undefined;
    observer.disconnect();
    const node = document.querySelector("[data-imbalink-search-load-more]");
    if (node) observer.observe(node);
    return undefined;
  }, [sortedResults.length, hasMore]);

  useEffect(() => () => loadMoreObserverRef.current?.disconnect(), []);

  const searchPlaceholder = useMemo(() => {
    if (filters.suburb !== "All") return `Search in ${filters.suburb}`;
    if (city !== "All") return `Search in ${city}`;
    return "Search suburb, type, landlord";
  }, [filters.suburb, city]);

  const clearAll = useCallback(() => {
    if (!isAnyFilterActive && sort === "newest") {
      setRandomSeed((s) => s + 1);
      return;
    }

    setFilters((f) => ({
      ...f,
      suburb: "All",
      type: "All",
      beds: "Any",
      baths: "Any",
      furnished: "Any",
      parking: false,
      maxPrice: priceCeiling,
      verifiedOnly: false,
      active: false,
    }));
    setSort("newest");
    setQuery("");
    setOpenDropdown(null);
    setRandomSeed(0);
    if (savedScrollRef.current) {
      window.scrollTo({ top: savedScrollRef.current, behavior: "smooth" });
      savedScrollRef.current = 0;
    }
  }, [isAnyFilterActive, sort, priceCeiling, setFilters, setQuery]);

  const toggleDropdown = useCallback((key) => {
    setOpenDropdown((cur) => (cur === key ? null : key));
  }, []);

  const handleSuburbClick = useCallback((suburb) => {
    savedScrollRef.current = window.scrollY || document.querySelector(".app-main-shell")?.scrollTop || 0;
    setFilters((f) => ({
      ...f,
      suburb: f.suburb === suburb ? "All" : suburb,
      active: true,
    }));
    setActiveCard(null);
    setOpenDropdown(null);
    setRandomSeed(0);
  }, [setFilters]);

  // Stable callbacks for card actions
  const handleToggleLike = useCallback((id) => toggleLike(id), [toggleLike]);
  const handleToggleSave = useCallback((id) => toggleSave(id), [toggleSave]);
  const handleRequestViewing = useCallback((id) => onRequestViewing?.(id), [onRequestViewing]);
  const handleSend = useCallback((id, text) => onSend?.(id, text), [onSend]);
  const handleOpenMessage = useCallback((id) => onOpenMessage?.(id), [onOpenMessage]);
  const handleOpenLister = useCallback((lister) => onOpenLister?.(lister), [onOpenLister]);

  return {
    pageRef, headerRef, dropdownRef,
    headerHeight, leaving, activeCard, setActiveCard, selectDesktopCard,
    openDropdown, setOpenDropdown, sort, setSort, randomSeed, setRandomSeed,
    handleOpenProperty,
    propertyTypes, priceCeiling, activeFilterCount, isAnyFilterActive,
    sortedResults, hasMoreResults, loadMoreSentinelRef,
    searchPlaceholder, clearAll, toggleDropdown, handleSuburbClick,
    handleToggleLike, handleToggleSave, handleRequestViewing,
    handleSend, handleOpenMessage, handleOpenLister,
  };
}
