import { useEffect, useLayoutEffect, useRef, useState } from "react";

let savedHomeScrollTop = 0;

export function useHomePageBehavior({
  isDesktopLayout,
  loadMore,
  loadingMore,
  hasMore,
  renderedFeed,
  onFilterBarVisibilityChange,
}) {
  const [pressedCity, setPressedCity] = useState(false);
  const [pressedFilterBtn, setPressedFilterBtn] = useState(false);
  const [pressedSort, setPressedSort] = useState(false);
  const [pressedPillKey, setPressedPillKey] = useState(null);
  const [mobileHeaderHeight, setMobileHeaderHeight] = useState(78);

  const [openDropdown, setOpenDropdown] = useState(null);
  const [quickViewProperty, setQuickViewProperty] = useState(null);
  const scrollContainerRef = useRef(null);
  const dropdownRef = useRef(null);
  const mobileHeaderRef = useRef(null);
  const sentinelRef = useRef(null);
  const loadMoreRef = useRef(loadMore);
  const loadingMoreRef = useRef(loadingMore);
  const throttleTimerRef = useRef(null);
  const isFetchingRef = useRef(false);

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


  return {
    pressedCity, setPressedCity, pressedFilterBtn, setPressedFilterBtn, pressedSort, setPressedSort,
    pressedPillKey, setPressedPillKey, mobileHeaderHeight, mobileHeaderRef,
    openDropdown, setOpenDropdown, quickViewProperty, setQuickViewProperty,
    sentinelRef, dropdownRef,
    toggleDropdown: (key) => setOpenDropdown((cur) => (cur === key ? null : key)),
  };
}
