import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStudentRecommendations } from "../../core/data/domains/students.js";
import { computeRoommateCompatibility } from "../../utils/studentHelpers";

const RECOMMENDATION_LIMIT = 12;
const RECOMMENDATION_REFRESH_MS = 10 * 60 * 1000;
const RECOMMENDATION_REPLACEMENTS_PER_REFRESH = 3;

/**
 * Owns the recommendation lifecycle for Roommate Finder: hydration, refresh,
 * filtering, sorting, and the small random discovery pool.
 */
export function useRoommateRecommendations({ properties = [], userId, myProfile, query, universityFilter, verifiedOnly }) {
  const [generalCandidates, setGeneralCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [lastRecommendationRefresh, setLastRecommendationRefresh] = useState(null);
  const recommendationIdsRef = useRef([]);

  const hydrateRecommendations = useCallback(async ({ refresh = false } = {}) => {
    setLoadingCandidates(true);
    try {
      const excludeIds = refresh ? recommendationIdsRef.current.slice() : [];
      const incoming = await getStudentRecommendations({
        limit: RECOMMENDATION_LIMIT,
        excludeIds,
      });

      const withProperties = incoming.map((candidate) => ({
        ...candidate,
        property: candidate.propertyId != null
          ? properties.find((p) => String(p?.id) === String(candidate.propertyId)) || null
          : null,
      }));

      if (!refresh) {
        const initial = withProperties.slice(0, RECOMMENDATION_LIMIT);
        recommendationIdsRef.current = initial.map((candidate) => String(candidate.id));
        setGeneralCandidates(initial);
      } else if (withProperties.length > 0) {
        setGeneralCandidates((current) => {
          const fresh = withProperties.filter(
            (candidate) => !current.some((existing) => String(existing.id) === String(candidate.id))
          );
          if (!fresh.length) return current;

          const replacementCount = Math.min(
            RECOMMENDATION_REPLACEMENTS_PER_REFRESH,
            fresh.length,
            current.length || RECOMMENDATION_LIMIT
          );
          const replacementIds = new Set(
            current.length <= replacementCount
              ? current.map((candidate) => String(candidate.id))
              : current
                  .map((candidate) => ({ id: String(candidate.id), sort: Math.random() }))
                  .sort((a, b) => a.sort - b.sort)
                  .slice(0, replacementCount)
                  .map((item) => item.id)
          );

          const freshQueue = fresh.slice(0, replacementCount);
          let nextFresh = 0;
          const next = current.map((candidate) => {
            if (!replacementIds.has(String(candidate.id))) return candidate;
            return freshQueue[nextFresh++] || candidate;
          });

          const capped = next.slice(0, RECOMMENDATION_LIMIT);
          recommendationIdsRef.current = capped.map((candidate) => String(candidate.id));
          return capped;
        });
      }

      setLastRecommendationRefresh(new Date());
    } catch (error) {
      console.error("Failed to load student recommendations:", error);
      if (!refresh) setGeneralCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, [properties]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await getStudentRecommendations({ limit: RECOMMENDATION_LIMIT });
        if (!active) return;
        const initial = rows.map((candidate) => ({
          ...candidate,
          property: candidate.propertyId != null
            ? properties.find((p) => String(p?.id) === String(candidate.propertyId)) || null
            : null,
        })).slice(0, RECOMMENDATION_LIMIT);
        recommendationIdsRef.current = initial.map((candidate) => String(candidate.id));
        setGeneralCandidates(initial);
        setLastRecommendationRefresh(new Date());
      } catch (error) {
        if (active) {
          console.error("Failed to load student recommendations:", error);
          setGeneralCandidates([]);
        }
      }
    })();
    return () => { active = false; };
  }, [userId, properties]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      hydrateRecommendations({ refresh: true });
    }, RECOMMENDATION_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [hydrateRecommendations]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return generalCandidates.filter((c) => {
      if (Number(c.sharedPreferenceCount || 0) < 2) return false;
      if (universityFilter !== "Any university" && c.university !== universityFilter) return false;
      if (verifiedOnly && c.verificationStatus !== "verified") return false;
      if (q && !`${c.name} ${c.university} ${c.area} ${c.property?.title || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [generalCandidates, query, universityFilter, verifiedOnly]);

  const sortedCandidates = useMemo(() => {
    return candidates
      .map((c) => ({ candidate: c, compatibility: computeRoommateCompatibility(myProfile, c) }))
      .sort((a, b) => {
        const tagDiff = (b.candidate.sharedPreferenceCount || 0) - (a.candidate.sharedPreferenceCount || 0);
        if (tagDiff) return tagDiff;
        return (b.compatibility?.percent || b.candidate.serverCompatibilityScore || 0)
          - (a.compatibility?.percent || a.candidate.serverCompatibilityScore || 0);
      })
      .slice(0, RECOMMENDATION_LIMIT);
  }, [candidates, myProfile]);

  const findARandomStudents = useCallback(() => {
    const eligible = generalCandidates.filter((c) =>
      String(c.id) !== String(userId) && Number(c.sharedPreferenceCount || 0) >= 2
    );
    return [...eligible].sort(() => Math.random() - 0.5).slice(0, 6);
  }, [generalCandidates, userId]);

  return {
    generalCandidates,
    loadingCandidates,
    lastRecommendationRefresh,
    sortedCandidates,
    findARandomStudents,
  };
}
