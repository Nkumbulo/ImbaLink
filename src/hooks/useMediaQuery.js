import { useState, useEffect } from "react";

// Previously defined locally, near-identically, in 11 different page files
// (ProfilePage, HomePage, SearchPage, MessagesPage, ContractorsPage,
// CollectionsPage, LandlordDashboardPage, StudentPage, AgentHubPage,
// PerformanceTrendsPage, CompanyHubPage) — verified byte-for-byte logical
// equivalence across all 11 copies before unifying (the only differences
// were whitespace/line-break formatting, never behavior) so this
// consolidation changes nothing observable in any of them.
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);

  return matches;
}
