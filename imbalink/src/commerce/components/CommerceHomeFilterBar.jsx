import React from "react";
import { ChevronDown, SlidersHorizontal, ArrowUpDown, Check, RotateCcw, MapPin, Tag, Grid3x3, DollarSign } from "lucide-react";
import { T } from "../../styles/tokens";
import ToggleSwitch from "../../components/common/ToggleSwitch";
import PriceHistogramSlider from "../../components/common/PriceHistogramSlider";
import { DesktopFilterField } from "../../pages/HomePage/FilterControls";
import { demoProducts } from "../commerceData.json";

const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "price-low", label: "Price: Low to High" },
  { key: "price-high", label: "Price: High to Low" },
];

// PriceHistogramSlider (and getPriceHistogram under it) reads a `.rent`
// field — this is Property's own component, reused as-is rather than
// forked, so demo listings are adapted to that shape instead of the slider
// being modified.
const RENT_SHAPED_LISTINGS = demoProducts.map((p) => ({ rent: p.price }));

export default function CommerceHomeFilterBar({
  activeType, setActiveType, typeOptions,
  activeCategory, setActiveCategory, categoryOptions,
  activeCondition, setActiveCondition, conditionOptions,
  activeLocation, setActiveLocation, locationOptions,
  minPrice, maxPrice, setPriceRange, priceCeiling,
  verifiedOnly, setVerifiedOnly,
  sort, setSort,
  isAnyFilterActive, hasMoreFiltersActive, clearAll,
  openDropdown, toggleDropdown, dropdownRef,
}) {
  const priceValueLabel = (minPrice > 0 || maxPrice < priceCeiling) ? `$${minPrice} — $${maxPrice}` : "$Min — $Max";

  const optionDropdown = (options, active, onSelect, key) => (
    <div
      className={`fade mobile-filter-dropdown mobile-filter-dropdown-${key}`}
      style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, background: T.paper, borderRadius: 14, padding: 6, minWidth: 170, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
    >
      {options.map((option) => {
        const selected = active === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => { onSelect(option); toggleDropdown(key); }}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: selected ? T.paperDim : "transparent", color: T.ink, fontSize: 12.5, border: "none", textAlign: "left", cursor: "pointer" }}
          >
            {option}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
    </div>
  );

  const priceDropdown = (
    <div
      className="fade mobile-filter-dropdown mobile-filter-dropdown-price"
      style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20, background: T.paper, borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
    >
      <div className="f-body" style={{ fontSize: 12, color: T.ink60, marginBottom: 6 }}>Price range</div>
      <PriceHistogramSlider
        cityProperties={RENT_SHAPED_LISTINGS}
        min={0}
        max={priceCeiling}
        valueMin={minPrice}
        valueMax={maxPrice}
        onChange={(lo, hi) => setPriceRange(lo, hi)}
      />
      <button
        type="button"
        onClick={() => toggleDropdown("price")}
        className="f-body font-semibold w-full mt-2 py-2 rounded-full"
        style={{ background: T.jacaranda, color: T.paper, fontSize: 12, border: "none", cursor: "pointer" }}
      >
        Apply
      </button>
    </div>
  );

  const moreFiltersDropdown = (
    <div
      className="fade mobile-filter-dropdown mobile-filter-dropdown-more"
      style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, background: T.paper, borderRadius: 14, padding: 6, minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
    >
      <div className="f-body" style={{ fontSize: 11, color: T.ink60, fontWeight: 700, padding: "6px 10px 2px" }}>Condition</div>
      {conditionOptions.map((option) => {
        const selected = activeCondition === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => { setActiveCondition(option); toggleDropdown("more"); }}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: selected ? T.paperDim : "transparent", color: T.ink, fontSize: 12.5, border: "none", textAlign: "left", cursor: "pointer" }}
          >
            {option}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
    </div>
  );

  const sortDropdown = (
    <div
      className="fade mobile-filter-dropdown mobile-filter-dropdown-sort"
      style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, background: T.paper, borderRadius: 14, padding: 6, minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
    >
      {SORT_OPTIONS.map((opt) => {
        const selected = sort === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => { setSort(opt.key); toggleDropdown("sort"); }}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: selected ? T.paperDim : "transparent", color: T.ink, fontSize: 12.5, border: "none", textAlign: "left", cursor: "pointer" }}
          >
            {opt.label}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={dropdownRef} className="desktop-filter-shell" style={{ padding: "0 24px", position: "relative", marginTop: 32 }}>
      <div
        className="desktop-filter-card"
        style={{ background: "var(--theme-surface, #FBF8F0)", border: `1px solid ${T.line}`, borderRadius: 18, padding: 12, display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}
      >
        <DesktopFilterField
          label="Location"
          icon={MapPin}
          value={activeLocation === "All" ? "All Locations" : activeLocation}
          onClick={() => toggleDropdown("location")}
          open={openDropdown === "location"}
          dropdown={optionDropdown(locationOptions, activeLocation, setActiveLocation, "location")}
        />
        <DesktopFilterField
          label="Type"
          icon={Tag}
          value={activeType === "All" ? "All Types" : activeType}
          onClick={() => toggleDropdown("type")}
          open={openDropdown === "type"}
          dropdown={optionDropdown(typeOptions, activeType, setActiveType, "type")}
        />
        <DesktopFilterField
          label="Category"
          icon={Grid3x3}
          value={activeCategory === "All" ? "All Categories" : activeCategory}
          onClick={() => toggleDropdown("category")}
          open={openDropdown === "category"}
          dropdown={optionDropdown(categoryOptions, activeCategory, setActiveCategory, "category")}
        />
        <DesktopFilterField
          label="Price Range"
          icon={DollarSign}
          value={priceValueLabel}
          onClick={() => toggleDropdown("price")}
          open={openDropdown === "price"}
          dropdown={priceDropdown}
          style={{ flex: "1 1 190px", minWidth: 190 }}
        />

        <div className="desktop-filter-reset-wrap" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="f-body" style={{ fontSize: 12, color: "transparent", fontWeight: 600, userSelect: "none" }} aria-hidden="true">Reset</span>
          <button
            type="button"
            onClick={clearAll}
            aria-label="Reset filters"
            title="Reset filters"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.line}`, borderRadius: 10, width: 40, height: 40, background: "#fff", color: isAnyFilterActive ? T.jacaranda : T.ink60, cursor: "pointer" }}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => toggleDropdown("more")}
            className="desktop-more-filters"
            style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${hasMoreFiltersActive ? T.msasa : T.line}`, borderRadius: 10, padding: "0 16px", height: 40, background: "#fff", color: hasMoreFiltersActive ? T.msasa : T.ink, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <SlidersHorizontal size={14} />
            <span>More Filters</span>
          </button>
          {openDropdown === "more" && moreFiltersDropdown}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "0 2px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <ToggleSwitch on={verifiedOnly} onToggle={() => setVerifiedOnly((v) => !v)} />
          <span className="f-body" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>Show Verified Only</span>
        </label>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => toggleDropdown("sort")}
            className="f-body"
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink, background: "transparent", border: "none", cursor: "pointer" }}
          >
            <span style={{ color: T.ink60 }}>Sort by</span>
            <ArrowUpDown size={14} />
            <span style={{ fontWeight: 700 }}>{SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Newest"}</span>
            <ChevronDown size={14} />
          </button>
          {openDropdown === "sort" && sortDropdown}
        </div>
      </div>
    </div>
  );
}
