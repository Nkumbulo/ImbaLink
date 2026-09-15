import { useMemo } from "react";
import { computeRoommateCompatibility } from "../../utils/studentHelpers";

export function useRoommateDerivedState({ properties, selectedId, sortedCandidates, generalCandidates, myProfile, saved, liked }) {
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return sortedCandidates.find((c) => c.candidate.id === selectedId) || (() => {
      const candidate = generalCandidates.find((c) => c.id === selectedId);
      return candidate ? { candidate, compatibility: computeRoommateCompatibility(myProfile, candidate) } : null;
    })();
  }, [selectedId, sortedCandidates, generalCandidates, myProfile]);

  const savedProperties = useMemo(
    () => (Array.isArray(properties) ? properties : []).filter((p) => saved?.has?.(String(p?.id))),
    [properties, saved]
  );
  const likedProperties = useMemo(
    () => (Array.isArray(properties) ? properties : []).filter((p) => liked?.has?.(String(p?.id))),
    [properties, liked]
  );
  const pickableProperties = useMemo(() => {
    const byId = new Map();
    for (const p of savedProperties) byId.set(String(p.id), p);
    for (const p of likedProperties) if (!byId.has(String(p.id))) byId.set(String(p.id), p);
    return Array.from(byId.values());
  }, [savedProperties, likedProperties]);

  return { selected, pickableProperties };
}
