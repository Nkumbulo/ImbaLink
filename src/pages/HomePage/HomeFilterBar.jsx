import { ChevronDown, SlidersHorizontal, ArrowUpDown, Check, RotateCcw, MapPin, Home, DollarSign, BedDouble } from "lucide-react";
import { T } from "../../styles/tokens";
import ToggleSwitch from "../../components/common/ToggleSwitch";
import PriceHistogramSlider from "../../components/common/PriceHistogramSlider";
import { BEDS_OPTIONS, BATHS_OPTIONS, FURNISHED_OPTIONS, AMENITY_OPTIONS, SORT_OPTIONS } from "./filterOptions";
import { FilterPill, DesktopFilterField } from "./FilterControls";

export default function HomeFilterBar({
  isDesktopLayout, city, filters, setFilters, sort, setSort, setShowCityPicker, setShowFilters,
  propertyTypes, cityProperties, priceCeiling, hasOtherActiveFilters, hasAnyActiveFilter,
  openDropdown, setOpenDropdown, toggleDropdown, dropdownRef,
  pressedPillKey, setPressedPillKey, pressedSort, setPressedSort,
}) {
const toggleAmenity = (key) => {
  setFilters?.((f) => {
    const current = Array.isArray(f.amenities) ? f.amenities : [];
    const next = current.includes(key)
      ? current.filter((a) => a !== key)
      : [...current, key];
    return { ...f, amenities: next };
  });
};

const clearAll = () => {
  setFilters?.((f) => ({
    ...f,
    type: "All",
    beds: "Any",
    baths: "Any",
    furnished: "Any",
    petFriendly: false,
    parking: false,
    availableNow: false,
    amenities: [],
    minPrice: 0,
    maxPrice: priceCeiling,
    verifiedOnly: false,
  }));
  setSort?.("newest");
  setOpenDropdown(null);
};

const pillDense = isDesktopLayout;
const pillRowClass = isDesktopLayout
  ? "flex flex-wrap items-center gap-1"
  : "grid grid-cols-5 gap-1.5";
const dropdownPanelStyle = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 20,
  background: T.paper,
  borderRadius: 14,
  padding: 6,
  minWidth: 150,
  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
};

const bedsValueLabel = (!filters.beds || filters.beds === "Any") ? "Any" : filters.beds;
const priceValueLabel =
  (filters.maxPrice != null && filters.maxPrice < priceCeiling) ||
  (filters.minPrice != null && filters.minPrice > 0)
    ? `$${filters.minPrice ?? 0} — $${filters.maxPrice ?? priceCeiling}`
    : "$Min — $Max";

// Create dropdown content for each filter
const typeDropdown = (
  <div className="fade mobile-filter-dropdown mobile-filter-dropdown-type" style={{ ...dropdownPanelStyle, minWidth: 160 }}>
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
          style={{
            background: selected ? T.paperDim : "transparent",
            color: T.ink,
            fontSize: 12.5,
            border: "none",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {t}
          {selected && <Check size={13} color={T.jacaranda} />}
        </button>
      );
    })}
  </div>
);

const bedsDropdown = (
  <div className="fade mobile-filter-dropdown mobile-filter-dropdown-beds" style={{ ...dropdownPanelStyle, minWidth: 140 }}>
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
          style={{
            background: selected ? T.paperDim : "transparent",
            color: T.ink,
            fontSize: 12.5,
            border: "none",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {b === "Any" ? "Any beds" : `${b} bed${b === "1" ? "" : "s"}+`}
          {selected && <Check size={13} color={T.jacaranda} />}
        </button>
      );
    })}
  </div>
);

const priceDropdown = (
  <div
    className="fade mobile-filter-dropdown mobile-filter-dropdown-price"
    style={{
      position: "absolute",
      top: "calc(100% + 6px)",
      left: 0,
      right: 0,
      zIndex: 20,
      background: T.paper,
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    }}
  >
    <div
      className="f-body"
      style={{ fontSize: 12, color: T.ink60, marginBottom: 6 }}
    >
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
      style={{
        background: T.jacaranda,
        color: T.paper,
        fontSize: 12,
        border: "none",
        cursor: "pointer",
      }}
    >
      Apply
    </button>
  </div>
);

const sortDropdown = (
  <div
    className="fade mobile-filter-dropdown mobile-filter-dropdown-sort"
    style={{
      position: "absolute",
      top: "calc(100% + 6px)",
      right: 0,
      zIndex: 20,
      background: T.paper,
      borderRadius: 14,
      padding: 6,
      minWidth: 190,
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    }}
  >
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
          style={{
            background: selected ? T.paperDim : "transparent",
            color: T.ink,
            fontSize: 12.5,
            border: "none",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {opt.label}
          {selected && <Check size={13} color={T.jacaranda} />}
        </button>
      );
    })}
  </div>
);


  return (
<div
  ref={dropdownRef}
  className={isDesktopLayout ? "desktop-filter-shell" : "px-4 pb-3 mobile-only-filter-toolbar"}
  style={
    isDesktopLayout
      ? { padding: "0 24px", position: "relative", marginTop: 32 }
      : { marginTop: 10, position: "relative" }
  }
>
  {isDesktopLayout ? (
    <>
      {/* Filter card */}
      <div
        className="desktop-filter-card"
        style={{
          background: "var(--theme-surface, #FBF8F0)",
          border: `1px solid ${T.line}`,
          borderRadius: 18,
          padding: "12px",
          display: "flex",
          alignItems: "flex-end",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <DesktopFilterField
          label="Location"
          icon={MapPin}
          value={city === "All" ? "All Cities" : city}
          onClick={() => setShowCityPicker?.(true)}
        />
        <DesktopFilterField
          label="Property Type"
          icon={Home}
          value={filters.type === "All" ? "All Types" : filters.type}
          onClick={() => toggleDropdown("type")}
          open={openDropdown === "type"}
          dropdown={typeDropdown}
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
        <DesktopFilterField
          label="Bedrooms"
          icon={BedDouble}
          value={bedsValueLabel}
          onClick={() => toggleDropdown("beds")}
          open={openDropdown === "beds"}
          dropdown={bedsDropdown}
        />

        {/* Reset filters */}
        <div className="desktop-filter-reset-wrap" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            className="f-body"
            style={{ fontSize: 12, color: "transparent", fontWeight: 600, userSelect: "none" }}
            aria-hidden="true"
          >
            Reset
          </span>
          <button
            type="button"
            onClick={clearAll}
            aria-label="Reset filters"
            title="Reset filters"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${T.line}`,
              borderRadius: 10,
              width: 40,
              height: 40,
              background: "#fff",
              color: hasAnyActiveFilter ? T.jacaranda : T.ink60,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters?.(true)}
          className="desktop-more-filters"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${hasOtherActiveFilters ? T.msasa : T.line}`,
            borderRadius: 10,
            padding: "0 16px",
            height: 40,
            background: "#fff",
            color: hasOtherActiveFilters ? T.msasa : T.ink,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <SlidersHorizontal size={14} />
          <span>More Filters</span>
        </button>
      </div>

      {/* Verified toggle + Sort row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 14,
          padding: "0 2px",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <ToggleSwitch
            on={filters.verifiedOnly}
            onToggle={() => setFilters?.((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))}
          />
          <span className="f-body" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
            Show Verified Only
          </span>
        </label>

        {/* Sort button wrapped in relative container for dropdown */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => toggleDropdown("sort")}
            className="f-body"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: T.ink,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ color: T.ink60 }}>Sort by</span>
            <ArrowUpDown size={14} />
            <span style={{ fontWeight: 700 }}>
              {SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Newest"}
            </span>
            <ChevronDown size={14} />
          </button>
          {openDropdown === "sort" && sortDropdown}
        </div>
      </div>
    </>
  ) : (
    <div className={pillRowClass}>
      <FilterPill
        label="Type"
        active={filters.type !== "All"}
        pressed={pressedPillKey === "type"}
        onPress={(v) => setPressedPillKey(v ? "type" : null)}
        onClick={() => toggleDropdown("type")}
        dense={pillDense}
      />
      <FilterPill
        label="Beds"
        active={!!filters.beds && filters.beds !== "Any"}
        pressed={pressedPillKey === "beds"}
        onPress={(v) => setPressedPillKey(v ? "beds" : null)}
        onClick={() => toggleDropdown("beds")}
        dense={pillDense}
      />
      <FilterPill
        label="Price"
        active={
          (filters.maxPrice != null && filters.maxPrice < priceCeiling) ||
          (filters.minPrice != null && filters.minPrice > 0)
        }
        pressed={pressedPillKey === "price"}
        onPress={(v) => setPressedPillKey(v ? "price" : null)}
        onClick={() => toggleDropdown("price")}
        dense={pillDense}
      />

      <FilterPill
        label=""
        ariaLabel="Reset filters"
        active={hasAnyActiveFilter}
        icon={RotateCcw}
        iconSize={16}
        showActiveDotOnly
        pressed={pressedPillKey === "reset"}
        onPress={(v) => setPressedPillKey(v ? "reset" : null)}
        onClick={clearAll}
        dense={pillDense}
      />
      <button
        type="button"
        onClick={() => toggleDropdown("sort")}
        onPointerDown={() => setPressedSort(true)}
        onPointerUp={() => setPressedSort(false)}
        onPointerLeave={() => setPressedSort(false)}
        onPointerCancel={() => setPressedSort(false)}
        aria-label="Sort"
        className={`f-body font-medium flex items-center gap-1 ${pillDense ? "px-2 py-1" : "px-3 py-1.5"}`}
        style={{
          color: sort !== "newest" ? T.ink : T.paper,
          background: sort !== "newest" ? "#DEC5A4" : "rgba(255,255,255,0.08)",
          fontSize: pillDense ? 10 : 10.5,
          minHeight: pillDense ? 34 : 44,
          borderRadius: 8,
          WebkitTapHighlightColor: "transparent",
          transitionProperty: "none",
          touchAction: "manipulation",
          transform: pressedSort ? "scale(0.95)" : "scale(1)",
          whiteSpace: "nowrap",
        }}
      >
        <ArrowUpDown size={11} />
        <span>Sort</span>
      </button>
    </div>
  )}

  {/* Mobile dropdowns - only render on mobile since desktop has its own */}
  {!isDesktopLayout && openDropdown === "type" && typeDropdown}
  {!isDesktopLayout && openDropdown === "beds" && bedsDropdown}
  {!isDesktopLayout && openDropdown === "price" && priceDropdown}
  {!isDesktopLayout && openDropdown === "sort" && sortDropdown}
  {!isDesktopLayout && openDropdown === "baths" && (
    <div className="fade mobile-filter-dropdown mobile-filter-dropdown-baths" style={{ ...dropdownPanelStyle, minWidth: 140 }}>
      {BATHS_OPTIONS.map((b) => {
        const selected = (filters.baths || "Any") === b;
        return (
          <button
            key={b}
            type="button"
            onClick={() => {
              setFilters?.((f) => ({ ...f, baths: b }));
              setOpenDropdown(null);
            }}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{
              background: selected ? T.paperDim : "transparent",
              color: T.ink,
              fontSize: 12.5,
              border: "none",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {b === "Any" ? "Any baths" : `${b} bath${b === "1" ? "" : "s"}+`}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
    </div>
  )}
  {!isDesktopLayout && openDropdown === "furnished" && (
    <div className="fade mobile-filter-dropdown mobile-filter-dropdown-furnished" style={{ ...dropdownPanelStyle, minWidth: 150 }}>
      {FURNISHED_OPTIONS.map((f) => {
        const selected = (filters.furnished || "Any") === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilters?.((prev) => ({ ...prev, furnished: f }));
              setOpenDropdown(null);
            }}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{
              background: selected ? T.paperDim : "transparent",
              color: T.ink,
              fontSize: 12.5,
              border: "none",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {f}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
    </div>
  )}
  {!isDesktopLayout && openDropdown === "amenities" && (
    <div className="fade" style={{ ...dropdownPanelStyle, minWidth: 190 }}>
      {AMENITY_OPTIONS.map((a) => {
        const selected = (filters.amenities || []).includes(a.key);
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => toggleAmenity(a.key)}
            className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
            style={{
              background: selected ? T.paperDim : "transparent",
              color: T.ink,
              fontSize: 12.5,
              border: "none",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {a.label}
            {selected && <Check size={13} color={T.jacaranda} />}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setOpenDropdown(null)}
        className="f-body font-semibold w-full mt-1 py-2 rounded-full"
        style={{
          background: T.jacaranda,
          color: T.paper,
          fontSize: 12,
          border: "none",
          cursor: "pointer",
        }}
      >
        Done
      </button>
    </div>
  )}
</div>

  );
}
