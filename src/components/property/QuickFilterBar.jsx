import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ArrowUpDown, RotateCcw, Check, MapPin } from "lucide-react";
import { T } from "../../styles/tokens";
import { getPropertyTypes, getPriceCeiling, getSuburbs } from "../../utils/propertyHelpers";
import PriceHistogramSlider from "../common/PriceHistogramSlider";

const BEDS_OPTIONS = ["Any", "1", "2", "3", "4", "5+"];
const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
];

// Compact filter controls meant to sit in the app header, next to the search
// box, once the main filter row on the home page has scrolled out of view.
export default function QuickFilterBar({ cityProperties, filters, setFilters, sort, setSort }) {
  const containerRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });

  const propertyTypes = useMemo(() => getPropertyTypes(cityProperties), [cityProperties]);
  const suburbs = useMemo(() => getSuburbs(cityProperties), [cityProperties]);
  const priceCeiling = useMemo(() => getPriceCeiling(cityProperties), [cityProperties]);

  useEffect(() => {
    if (!openDropdown) return;
    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
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

  const toggleDropdown = (key, e) => {
    const container = containerRef.current;
    const button = e?.currentTarget;
    if (container && button) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setAnchor({
        left: buttonRect.left - containerRect.left,
        top: buttonRect.bottom - containerRect.top + 8,
      });
    }
    setOpenDropdown((cur) => (cur === key ? null : key));
  };

  const hasActiveFilter =
    filters.type !== "All" ||
    (filters.suburb && filters.suburb !== "All") ||
    (filters.beds && filters.beds !== "Any") ||
    (filters.maxPrice != null && filters.maxPrice < priceCeiling) ||
    (filters.minPrice != null && filters.minPrice > 0) ||
    sort !== "newest";

  const clear = () => {
    setFilters?.((f) => ({ ...f, type: "All", suburb: "All", beds: "Any", minPrice: 0, maxPrice: priceCeiling }));
    setSort?.("newest");
    setOpenDropdown(null);
  };

  const panelStyle = {
    position: "absolute",
    zIndex: 60,
    background: "#fff",
    borderRadius: 12,
    padding: 6,
    minWidth: 150,
    boxShadow: "0 12px 28px rgba(20,32,26,0.18)",
    border: `1px solid ${T.line}`,
    // Location/Type lists are only as long as the real data — a city
    // with many suburbs (more of a risk here than Type, which has a
    // fixed small vocabulary) could otherwise extend past the viewport
    // with no way to reach the rest. Same convention already used for
    // HomePage's and StudentPage's own dropdowns.
    maxHeight: "min(320px, 60vh)",
    overflowY: "auto",
  };

  const optionButtonStyle = (selected) => ({
    background: selected ? T.paperDim : "transparent",
    color: T.ink,
    fontSize: 12.5,
    border: "none",
    textAlign: "left",
    cursor: "pointer",
  });

  const pillStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${active ? T.jacaranda : "#E4E1D8"}`,
    background: active ? T.paperDim : "#F7F6F2",
    color: active ? T.jacaranda : "#30362F",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const bedsLabel = !filters.beds || filters.beds === "Any" ? "Beds" : `${filters.beds} bed${filters.beds === "1" ? "" : "s"}+`;

  return (
    <div ref={containerRef} className="topbar-quick-filters desktop-filter-controls" style={{ position: "relative" }}>
      <button type="button" style={pillStyle(!!filters.suburb && filters.suburb !== "All")} onClick={(e) => toggleDropdown("suburb", e)}>
        <MapPin size={12} />
        {!filters.suburb || filters.suburb === "All" ? "Location" : filters.suburb}
        <ChevronDown size={12} />
      </button>
      <button type="button" style={pillStyle(filters.type !== "All")} onClick={(e) => toggleDropdown("type", e)}>
        {filters.type === "All" ? "Type" : filters.type}
        <ChevronDown size={12} />
      </button>
      <button type="button" style={pillStyle(!!filters.beds && filters.beds !== "Any")} onClick={(e) => toggleDropdown("beds", e)}>
        {bedsLabel}
        <ChevronDown size={12} />
      </button>
      <button
        type="button"
        style={pillStyle(
          (filters.maxPrice != null && filters.maxPrice < priceCeiling) ||
          (filters.minPrice != null && filters.minPrice > 0)
        )}
        onClick={(e) => toggleDropdown("price", e)}
      >
        Price
        <ChevronDown size={12} />
      </button>
      <button type="button" style={pillStyle(sort !== "newest")} onClick={(e) => toggleDropdown("sort", e)}>
        <ArrowUpDown size={12} />
        Sort
      </button>
      <button
        type="button"
        aria-label="Reset filters"
        title="Reset filters"
        style={{ ...pillStyle(hasActiveFilter), padding: 0, width: 34, justifyContent: "center" }}
        onClick={clear}
      >
        <RotateCcw size={14} />
      </button>

      {openDropdown === "suburb" && (
        <div className="fade" style={{ ...panelStyle, left: anchor.left, top: anchor.top, minWidth: 170 }}>
          {suburbs.map((s) => {
            const selected = (filters.suburb || "All") === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setFilters?.((f) => ({ ...f, suburb: s }));
                  setOpenDropdown(null);
                }}
                className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
                style={optionButtonStyle(selected)}
              >
                {s === "All" ? "All locations" : s}
                {selected && <Check size={13} color={T.jacaranda} />}
              </button>
            );
          })}
        </div>
      )}

      {openDropdown === "type" && (
        <div className="fade" style={{ ...panelStyle, left: anchor.left, top: anchor.top, minWidth: 160 }}>
          {propertyTypes.map((t) => {
            const selected = filters.type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setFilters?.((f) => ({ ...f, type: t }));
                  setOpenDropdown(null);
                }}
                className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
                style={optionButtonStyle(selected)}
              >
                {t}
                {selected && <Check size={13} color={T.jacaranda} />}
              </button>
            );
          })}
        </div>
      )}

      {openDropdown === "beds" && (
        <div className="fade" style={{ ...panelStyle, left: anchor.left, top: anchor.top, minWidth: 140 }}>
          {BEDS_OPTIONS.map((b) => {
            const selected = (filters.beds || "Any") === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setFilters?.((f) => ({ ...f, beds: b }));
                  setOpenDropdown(null);
                }}
                className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
                style={optionButtonStyle(selected)}
              >
                {b === "Any" ? "Any beds" : `${b} bed${b === "1" ? "" : "s"}+`}
                {selected && <Check size={13} color={T.jacaranda} />}
              </button>
            );
          })}
        </div>
      )}

      {openDropdown === "price" && (
        <div className="fade" style={{ ...panelStyle, left: anchor.left, top: anchor.top, width: 280, padding: 14 }}>
          <div className="f-body" style={{ fontSize: 12, color: T.ink60, marginBottom: 6 }}>
            Price range
          </div>
          <PriceHistogramSlider
            cityProperties={cityProperties}
            min={0}
            max={priceCeiling}
            valueMin={filters.minPrice ?? 0}
            valueMax={filters.maxPrice ?? priceCeiling}
            onChange={(minPrice, maxPrice) =>
              setFilters?.((f) => ({ ...f, minPrice, maxPrice }))
            }
          />
          <button
            type="button"
            onClick={() => setOpenDropdown(null)}
            className="f-body font-semibold w-full mt-2 py-2 rounded-full"
            style={{ background: T.jacaranda, color: T.paper, fontSize: 12, border: "none", cursor: "pointer" }}
          >
            Apply
          </button>
        </div>
      )}

      {openDropdown === "sort" && (
        <div className="fade" style={{ ...panelStyle, left: anchor.left, top: anchor.top, minWidth: 190 }}>
          {SORT_OPTIONS.map((opt) => {
            const selected = sort === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setSort?.(opt.key);
                  setOpenDropdown(null);
                }}
                className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
                style={optionButtonStyle(selected)}
              >
                {opt.label}
                {selected && <Check size={13} color={T.jacaranda} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
