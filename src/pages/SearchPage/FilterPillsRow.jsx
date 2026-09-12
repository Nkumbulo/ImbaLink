import { ArrowUpDown, Check, RotateCcw } from "lucide-react";
import { T } from "../../styles/tokens";
import FilterPill from "./FilterPill";
import { BEDS_OPTIONS, SORT_OPTIONS } from "./searchConstants";

export default function FilterPillsRow({
  dropdownRef,
  filters,
  setFilters,
  priceCeiling,
  isAnyFilterActive,
  clearAll,
  sort,
  setSort,
  openDropdown,
  setOpenDropdown,
  toggleDropdown,
  propertyTypes,
  setRandomSeed,
}) {
  return (
    <div ref={dropdownRef} style={{ position: "relative", marginTop: 8 }}>
      <div
        className="flex items-center gap-1.5 overflow-x-auto noscroll"
        style={{ paddingBottom: 2, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        <FilterPill label="Type" active={filters.type !== "All"} onClick={() => toggleDropdown("type")} />
        <FilterPill label="Beds" active={!!filters.beds && filters.beds !== "Any"} onClick={() => toggleDropdown("beds")} />
        <FilterPill label="Price" active={filters.maxPrice < priceCeiling} onClick={() => toggleDropdown("price")} />

        <button
          type="button"
          onClick={clearAll}
          aria-label="Reset filters"
          className="active:scale-95 flex items-center justify-center shrink-0"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: isAnyFilterActive ? T.msasa : T.paperDim,
            border: `1px solid ${isAnyFilterActive ? T.msasa : T.line}`,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={13} color={isAnyFilterActive ? T.paper : T.ink} />
        </button>

        <button
          type="button"
          onClick={() => toggleDropdown("sort")}
          aria-label="Sort"
          className="active:scale-95 flex items-center justify-center shrink-0"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            marginLeft: "auto",
            background: sort !== "newest" ? T.jacaranda : T.paperDim,
            border: `1px solid ${sort !== "newest" ? T.jacaranda : T.line}`,
            cursor: "pointer",
          }}
        >
          <ArrowUpDown size={13} color={sort !== "newest" ? T.paper : T.ink} />
        </button>
      </div>

      {/* Dropdowns */}
      {openDropdown === "type" && (
        <div className="fade" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, padding: 6, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {propertyTypes.map((t) => {
            const selected = filters.type === t;
            return (
              <button key={t} type="button" onClick={() => { setFilters((f) => ({ ...f, type: t })); setOpenDropdown(null); setRandomSeed(0); }} className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: selected ? T.paperDim : "transparent", color: T.ink, fontSize: 12.5, border: "none", textAlign: "left", cursor: "pointer" }}>
                {t}
                {selected && <Check size={13} color={T.jacaranda} />}
              </button>
            );
          })}
        </div>
      )}

      {openDropdown === "beds" && (
        <div className="fade" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, padding: 6, minWidth: 140, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {BEDS_OPTIONS.map((b) => {
            const selected = (filters.beds || "Any") === b;
            return (
              <button key={b} type="button" onClick={() => { setFilters((f) => ({ ...f, beds: b })); setOpenDropdown(null); setRandomSeed(0); }} className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: selected ? T.paperDim : "transparent", color: T.ink, fontSize: 12.5, border: "none", textAlign: "left", cursor: "pointer" }}>
                {b === "Any" ? "Any beds" : `${b} bed${b === "1" ? "" : "s"}+`}
                {selected && <Check size={13} color={T.jacaranda} />}
              </button>
            );
          })}
        </div>
      )}

      {openDropdown === "price" && (
        <div className="fade" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          <div className="f-body flex items-center justify-between" style={{ fontSize: 12, color: T.ink60 }}>
            <span>Max price</span>
            <span className="font-semibold" style={{ color: T.ink }}>${filters.maxPrice}/mo</span>
          </div>
          <input type="range" min={0} max={priceCeiling} step={10} value={filters.maxPrice} onChange={(e) => { setFilters((f) => ({ ...f, maxPrice: Number(e.target.value) })); setRandomSeed(0); }} style={{ width: "100%", marginTop: 8 }} />
          <button type="button" onClick={() => setOpenDropdown(null)} className="f-body font-semibold w-full mt-2 py-2 rounded-full" style={{ background: T.jacaranda, color: T.paper, fontSize: 12, border: "none", cursor: "pointer" }}>Apply</button>
        </div>
      )}

      {openDropdown === "sort" && (
        <div className="fade" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, padding: 6, minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {SORT_OPTIONS.map((opt) => {
            const selected = sort === opt.key;
            return (
              <button key={opt.key} type="button" onClick={() => { setSort(opt.key); setOpenDropdown(null); setRandomSeed(0); }} className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: selected ? T.paperDim : "transparent", color: T.ink, fontSize: 12.5, border: "none", textAlign: "left", cursor: "pointer" }}>
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
