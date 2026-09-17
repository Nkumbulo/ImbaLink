import { useState } from "react";
import { ArrowUpDown, Check, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { T } from "../../styles/tokens";
import { demoProducts } from "../commerceData.json";
import CommerceGridTile from "./CommerceGridTile";
import CommerceProductDetailOverlay from "./CommerceProductDetailOverlay";
import CommerceHomeFilterBar from "./CommerceHomeFilterBar";
// The same light-page-themed pill Property's own Search page uses.
import FilterPill from "../../pages/SearchPage/FilterPill";
import { useCommerceInventoryFilters } from "../useCommerceInventoryFilters";

export default function CommerceExploreView({ onMessage, onSwitchMode, showHeading = true, compactDesktop = false, query, onQueryChange }) {
  const {
    query: activeQuery, setQuery, verifiedOnly, setVerifiedOnly,
    activeType, setActiveType, activeCategory, setActiveCategory,
    activeCondition, setActiveCondition, activeLocation, setActiveLocation,
    minPrice, maxPrice, setPriceRange, priceCeiling,
    sort, setSort, cycleSort, openDropdown, toggleDropdown, dropdownRef,
    visibleItems, isAnyFilterActive, hasMoreFiltersActive, clearAll,
    typeOptions, categoryOptions, conditionOptions, locationOptions,
  } = useCommerceInventoryFilters(demoProducts, { query, onQueryChange });
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Shown as Marketplace's own desktop content (compactDesktop): mirror
  // Property Home's page shape exactly — filter bar (Location/Type/
  // Category/Price Range/Reset/More Filters + Verified toggle/Sort), no
  // second search box (the desktop topbar's search already covers that,
  // same as Property Home), then cards on Property Home's own grid class.
  if (compactDesktop) {
    return (
      <>
        <CommerceHomeFilterBar
          activeType={activeType} setActiveType={setActiveType} typeOptions={typeOptions}
          activeCategory={activeCategory} setActiveCategory={setActiveCategory} categoryOptions={categoryOptions}
          activeCondition={activeCondition} setActiveCondition={setActiveCondition} conditionOptions={conditionOptions}
          activeLocation={activeLocation} setActiveLocation={setActiveLocation} locationOptions={locationOptions}
          minPrice={minPrice} maxPrice={maxPrice} setPriceRange={setPriceRange} priceCeiling={priceCeiling}
          verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
          sort={sort} setSort={setSort}
          isAnyFilterActive={isAnyFilterActive} hasMoreFiltersActive={hasMoreFiltersActive} clearAll={clearAll}
          openDropdown={openDropdown} toggleDropdown={toggleDropdown} dropdownRef={dropdownRef}
        />

        {visibleItems.length ? (
          // Property Home's own grid class — this content is standing in
          // for Property Home specifically now, not Property Search.
          <div className="web-property-grid" style={{ marginTop: 18 }}>
            {visibleItems.map((p) => (
              <CommerceGridTile key={p.id} product={p} onOpen={setSelectedProduct} compactDesktop />
            ))}
          </div>
        ) : (
          <div className="commerce-inner" style={{ paddingTop: 0 }}>
            <div className="commerce-empty">
              <Search size={28} />
              <h2>No matching listings</h2>
              <p>Try adjusting your filters.</p>
            </div>
          </div>
        )}

        {selectedProduct && (
          <CommerceProductDetailOverlay
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onConnectBuy={onMessage}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="commerce-inner" style={{ paddingBottom: 0 }}>
        {showHeading && (
          <div className="commerce-search-head">
            <div><span className="commerce-eyebrow">Explore</span><h1>Find something nearby</h1></div>
            <button onClick={onSwitchMode} className="commerce-mode-switch">Property</button>
          </div>
        )}

        <div className="commerce-search large" style={showHeading ? undefined : { marginTop: 0 }}>
          <Search size={18} />
          <input
            value={activeQuery}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, services or categories"
          />
          {activeQuery && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" style={{ border: "none", background: "transparent", padding: 4, display: "flex", cursor: "pointer" }}>
              <X size={16} color={T.ink60} />
            </button>
          )}
        </div>

        <div ref={dropdownRef} style={{ position: "relative", marginTop: 16, marginBottom: 8 }}>
          <div className="flex items-center gap-1.5" style={{ overflowX: "auto", paddingBottom: 2 }}>
            <FilterPill label="Type" active={activeType !== "All"} onClick={() => toggleDropdown("type")} />
            <FilterPill label="Verified" icon={ShieldCheck} active={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)} />

            <button
              type="button"
              onClick={clearAll}
              aria-label="Reset filters"
              className="active:scale-95 flex items-center justify-center shrink-0"
              style={{ width: 28, height: 28, borderRadius: "50%", background: isAnyFilterActive ? T.msasa : T.paperDim, border: `1px solid ${isAnyFilterActive ? T.msasa : T.line}`, cursor: "pointer" }}
            >
              <RotateCcw size={13} color={isAnyFilterActive ? T.paper : T.ink} />
            </button>

            <button
              type="button"
              onClick={cycleSort}
              aria-label="Sort"
              className="active:scale-95 flex items-center justify-center shrink-0"
              style={{ width: 28, height: 28, borderRadius: "50%", marginLeft: "auto", background: sort !== "newest" ? T.jacaranda : T.paperDim, border: `1px solid ${sort !== "newest" ? T.jacaranda : T.line}`, cursor: "pointer" }}
            >
              <ArrowUpDown size={13} color={sort !== "newest" ? T.paper : T.ink} />
            </button>
          </div>

          {openDropdown === "type" && (
            <div className="fade" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, padding: 6, minWidth: 170, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
              {typeOptions.map((t) => {
                const selected = activeType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setActiveType(t); toggleDropdown("type"); }}
                    className="f-body w-full flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: selected ? T.paperDim : "transparent", color: T.ink, fontSize: 12.5, border: "none", textAlign: "left", cursor: "pointer" }}
                  >
                    {t}
                    {selected && <Check size={13} color={T.jacaranda} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="f-body" style={{ fontSize: 11.5, fontWeight: 800, color: T.ink60, margin: "8px 0 4px" }}>
          {visibleItems.length} Listed Item{visibleItems.length === 1 ? "" : "s"}
        </div>
      </div>

      {visibleItems.length ? (
        // Property Search's own grid class (not Property Home's
        // web-property-grid) — this is Shop Explore's own mobile content,
        // so it should match Property's Explore/Search page specifically.
        <div className="web-search-grid">
          {visibleItems.map((p) => (
            <CommerceGridTile key={p.id} product={p} onOpen={setSelectedProduct} compactDesktop={compactDesktop} />
          ))}
        </div>
      ) : (
        <div className="commerce-inner" style={{ paddingTop: 0 }}>
          <div className="commerce-empty">
            <Search size={28} />
            <h2>No matching listings</h2>
            <p>Try a different search term or clear your filters.</p>
          </div>
        </div>
      )}

      {selectedProduct && (
        <CommerceProductDetailOverlay
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onConnectBuy={onMessage}
        />
      )}
    </>
  );
}
