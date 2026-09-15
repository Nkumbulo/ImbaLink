import { getPropertiesByIds } from '../core/data/domains/properties.js';
import { useEffect, useState, useRef } from "react";
import { Bookmark, Heart, X } from "lucide-react";
import useMediaQuery from "../hooks/useMediaQuery";
import { T } from "../styles/tokens";
import GridTile from "../components/property/GridTile";


const TABS = [
  ["saved", "Saved", Bookmark],
  ["liked", "Liked", Heart],
];

export default function CollectionsPage({ properties, saved, liked, openProperty, initialView, onToggleSave, onToggleLike }) {
  const isTabletOrDesktop = useMediaQuery("(min-width: 768px)");
  const [view, setView] = useState(initialView === "liked" ? "liked" : "saved");

  useEffect(() => {
    if (initialView) setView(initialView === "liked" ? "liked" : "saved");
  }, [initialView]);

  const idSet = view === "saved" ? saved : liked;
  // A stable, order-independent key for the effect below — so it only
  // re-fetches when the actual set of ids changes, not on every render
  // that happens to pass a new Set object with the same members.
  const idKey = [...idSet].sort().join(",");

  // Previously this page just filtered whatever was already sitting in the
  // main feed's `properties` prop by saved/liked id. That prop is the
  // marketplace feed — paginated and filtered by city/suburb/type/price/
  // search — so a saved listing outside whatever page/filter the feed
  // currently happened to have loaded would silently vanish from
  // Favorites with no explanation, not just genuinely deleted listings.
  // Fetching directly by id (getPropertiesByIds) fixes that, and lets
  // a genuinely-deleted listing be shown as "no longer available" instead
  // of just disappearing — see missingIds below.
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [missingIds, setMissingIds] = useState([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const ids = idKey ? idKey.split(",") : [];
    if (!ids.length) {
      setList([]);
      setMissingIds([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    // Show whatever's already loaded in the main feed immediately (avoids
    // a blank flash for the common case — most saved items ARE already in
    // the feed), then replace with the authoritative fetch once it lands.
    setList(properties.filter((p) => ids.includes(String(p.id))));
    getPropertiesByIds(ids).then(({ found, missingIds: missing }) => {
      if (requestIdRef.current !== requestId) return; // a newer request superseded this one
      setList(found);
      setMissingIds(missing);
    }).catch(() => {
      if (requestIdRef.current !== requestId) return;
      // Fetch failed outright (offline, etc.) — keep the feed-derived list
      // from above rather than clearing it, so the page degrades instead
      // of going blank.
    }).finally(() => {
      if (requestIdRef.current === requestId) setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, view]);

  const removeMissing = (id) => {
    if (view === "saved") onToggleSave?.(id);
    else onToggleLike?.(id);
    setMissingIds((current) => current.filter((x) => x !== id));
  };

  return (
    <div className="pb-4 web-page collections-page">
      <div className="px-4 pt-3">
        <div
          className="f-display font-bold"
          style={{
            color: isTabletOrDesktop ? T.ink : T.paper,
            fontSize: isTabletOrDesktop ? 24 : 19,
          }}
        >
          Collections
        </div>
      </div>

      <div
        className="web-surface"
        style={{
          background: T.paper,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          marginTop: 10,
        }}
      >
        <div className="flex gap-4 px-4 pt-3" style={{ borderBottom: `1px solid ${T.line}` }}>
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className="f-body font-medium pb-2.5 flex items-center gap-1.5"
              style={{
                color: view === id ? T.ink : T.ink60,
                borderBottom: view === id ? `2px solid ${T.brick}` : "2px solid transparent",
                fontSize: 12.5,
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {loading && list.length === 0 ? (
          <div className="fade text-center py-16 f-body" style={{ color: T.ink60, fontSize: 13 }}>
            Loading…
          </div>
        ) : list.length === 0 && missingIds.length === 0 ? (
          <div className="fade text-center py-16 f-body" style={{ color: T.ink60, fontSize: 13 }}>
            {view === "saved"
              ? "Tap the bookmark on a listing to save it here."
              : "Double-tap a photo or the heart to like it."}
          </div>
        ) : (
          <>
            {list.length > 0 && (
              <div
                className="grid collections-grid"
                style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginTop: 12 }}
              >
                {list.map((p) => (
                  <GridTile key={p.id} p={p} onOpen={openProperty} compactDesktop={isTabletOrDesktop} />
                ))}
              </div>
            )}

            {missingIds.length > 0 && (
              <div className="px-4 pb-4" style={{ marginTop: list.length > 0 ? 14 : 12 }}>
                <div className="f-mono mb-2" style={{ color: T.ink60, fontSize: 9.5, letterSpacing: ".1em" }}>
                  NO LONGER AVAILABLE
                </div>
                <div className="space-y-1.5">
                  {missingIds.map((id) => (
                    <div
                      key={id}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ background: T.paperDim }}
                    >
                      <span className="f-body" style={{ color: T.ink60, fontSize: 11.5 }}>
                        This listing has been removed or is no longer available.
                      </span>
                      <button
                        type="button"
                        aria-label="Remove from collection"
                        onClick={() => removeMissing(id)}
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: T.paper, color: T.ink60, border: `1px solid ${T.line}` }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
