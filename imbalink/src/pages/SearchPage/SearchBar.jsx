import { GraduationCap, Search, SlidersHorizontal, WifiOff, X } from "lucide-react";
import { T } from "../../styles/tokens";

export default function SearchBar({
  query,
  setQuery,
  searchPlaceholder,
  setShowFilters,
  isAnyFilterActive,
  studentMode,
  isOnline,
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center gap-2 h-10 px-3.5 rounded-full"
          style={{ background: T.paperDim, border: `1px solid ${T.line}`, minWidth: 0 }}
        >
          <Search size={15} style={{ color: T.ink60, flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="f-body bg-transparent outline-none flex-1"
            style={{ color: T.ink, fontSize: 14, minWidth: 0 }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{
                border: "none",
                background: "transparent",
                padding: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={14} color={T.ink60} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(true)}
          aria-label="Open filters"
          className="active:scale-90"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: isAnyFilterActive ? T.msasa : T.ink,
            border: "none",
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
        >
          <SlidersHorizontal size={16} color={isAnyFilterActive ? T.paper : T.paper} />
        </button>
      </div>

      {studentMode && (
        <div
          className="flex items-center gap-1.5"
          style={{
            marginTop: 8,
            background: T.jacaranda,
            color: T.paper,
            borderRadius: 10,
            padding: "7px 10px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <GraduationCap size={13} />
          Showing student accommodation only — this is automatic in Student Mode.
        </div>
      )}

      {!isOnline && (
        <div
          className="flex items-center gap-1.5"
          style={{
            marginTop: 8,
            background: T.ink,
            color: T.paper,
            borderRadius: 10,
            padding: "7px 10px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <WifiOff size={13} />
          You're offline — showing what's already loaded.
        </div>
      )}
    </>
  );
}
