import { useEffect, useState } from "react";

/** Owns transient application-shell UI state so App.jsx stays orchestration-only. */
export default function useAppUiState() {
  const [tab, setTab] = useState("home");
  const [city, setCity] = useState("All");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ suburb: "All", type: "All", minPrice: 0, maxPrice: 1000, verifiedOnly: false });
  const [sort, setSort] = useState("newest");
  const [homeFilterBarVisible, setHomeFilterBarVisible] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [collectionsView, setCollectionsView] = useState("saved");
  const [hubWelcome, setHubWelcome] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewingLister, setViewingLister] = useState(null);
  const [startupReady, setStartupReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setStartupReady(true), 200);
    return () => window.clearTimeout(timer);
  }, []);

  return {
    tab, setTab, city, setCity, query, setQuery, filters, setFilters, sort, setSort,
    homeFilterBarVisible, setHomeFilterBarVisible, showFilters, setShowFilters,
    showCityPicker, setShowCityPicker, selected, setSelected, detailTab, setDetailTab,
    collectionsView, setCollectionsView, hubWelcome, setHubWelcome, startupReady,
    showNotifications, setShowNotifications, viewingLister, setViewingLister,
  };
}
