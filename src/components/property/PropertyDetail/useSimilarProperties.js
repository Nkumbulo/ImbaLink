import { getSimilarProperties } from '../../../core/data/domains/properties.js';
import { useEffect, useState } from "react";
// Similar properties — same suburb+type first, getSimilarProperties
// handles broadening the search itself if there aren't enough results.
export function useSimilarProperties(property) {
  const [similarProperties, setSimilarProperties] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!property?.id) { setSimilarProperties([]); return undefined; }
    getSimilarProperties(property, 6).then((rows) => {
      if (!cancelled) setSimilarProperties(rows);
    }).catch(() => { if (!cancelled) setSimilarProperties([]); });
    return () => { cancelled = true; };
  }, [property?.id]);

  return similarProperties;
}
