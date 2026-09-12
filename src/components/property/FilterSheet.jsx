import { useMemo, useState, useEffect } from "react";
import { X } from "lucide-react";
import { T } from "../../styles/tokens"; // ✅ corrected: two levels up
import ToggleSwitch from "../common/ToggleSwitch";
import { Label, FilterOption } from "./FilterSheet/FilterControls";
import SuburbQuickFilterPopover from "./FilterSheet/SuburbQuickFilterPopover";

export default function FilterSheet({
  properties,
  filters,
  setFilters,
  onClose,
  resultCount,
  city,
}) {
  const [showAllSuburbs, setShowAllSuburbs] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(true); // controls slide-down
  const [showPopover, setShowPopover] = useState(false);
  const [selectedSuburb, setSelectedSuburb] = useState(null);

  // Temporary filters for the popover
  const [tempType, setTempType] = useState("All");
  const [tempBeds, setTempBeds] = useState("Any");
  const [tempMaxPrice, setTempMaxPrice] = useState(1000);

  const citySuburbs = useMemo(() => {
    const source =
      city === "All"
        ? properties
        : properties.filter((p) => p.city === city);
    return ["All", ...Array.from(new Set(source.map((p) => p.suburb).filter(Boolean)))];
  }, [properties, city]);

  const propertyTypes = useMemo(() => {
    return ["All", ...Array.from(new Set(properties.map((p) => p.type).filter(Boolean)))];
  }, [properties]);

  // When the sheet is hidden, after the slide-down animation finish, show popover
  useEffect(() => {
    if (!sheetVisible) {
      const timer = setTimeout(() => {
        setShowPopover(true);
      }, 300); // same as CSS animation duration
      return () => clearTimeout(timer);
    }
  }, [sheetVisible]);

  const reset = () => {
    setFilters((f) => ({
      ...f,
      suburb: "All",
      type: "All",
      maxPrice: 1000,
      verifiedOnly: false,
      beds: "Any",
      baths: "Any",
      furnished: "Any",
      parking: false,
    }));
    setShowAllSuburbs(false);
    setShowAllTypes(false);
  };

  const handleSuburbTap = (suburb) => {
    if (suburb === "All") {
      setFilters((f) => ({ ...f, suburb: "All" }));
      return;
    }
    setSelectedSuburb(suburb);
    // Initialize temp filters from current state
    setTempType(filters.type);
    setTempBeds(filters.beds || "Any");
    setTempMaxPrice(filters.maxPrice);
    // Trigger sheet slide-down
    setSheetVisible(false);
  };

  const applyPopoverFilters = () => {
    setFilters((f) => ({
      ...f,
      suburb: selectedSuburb,
      type: tempType,
      beds: tempBeds,
      maxPrice: tempMaxPrice,
      verifiedOnly: filters.verifiedOnly,
    }));
    setShowPopover(false);
    onClose(); // unmount FilterSheet, returning to search page
  };

  return (
    <>
      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes slideDown {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
        .filter-sheet-overlay.fade-out {
          animation: fadeOut 0.3s ease forwards;
          pointer-events: none;
        }
        .filter-sheet-panel.slide-down {
          animation: slideDown 0.3s ease forwards;
        }
        @keyframes popoverFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .suburb-popover-overlay {
          animation: popoverFadeIn 0.25s ease forwards;
        }
      `}</style>

      {/* Main filter sheet (visible until suburb is tapped) */}
      <div
        className={`filter-sheet-overlay fixed inset-0 z-50 flex items-end md:items-center md:justify-center ${
          sheetVisible ? "fade" : "fade-out"
        }`}
        style={{
          background: "rgba(20,32,26,0.55)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
        onClick={onClose}
      >
        <div
          className={`filter-sheet-panel w-full p-0 rise ${
            sheetVisible ? "" : "slide-down"
          }`}
          style={{
            background: T.paper,
            maxHeight: "88vh",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            boxShadow: "0 -10px 40px rgba(0,0,0,0.18)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed header */}
          <div
            style={{
              padding: "16px 20px 12px 20px",
              flexShrink: 0,
              borderBottom: `1px solid ${T.line}`,
            }}
          >
            <div className="w-10 h-1.5 rounded-full mx-auto mb-3" style={{ background: T.line }} />
            <div className="flex items-center justify-between">
              <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 18 }}>
                Filters
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={reset}
                  className="f-body font-semibold"
                  style={{
                    color: T.ink60,
                    fontSize: 12,
                    textDecoration: "underline",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close filters"
                  title="Close filters"
                  className="flex items-center justify-center rounded-full active:scale-90"
                  style={{
                    width: 36,
                    height: 36,
                    border: `1px solid ${T.line}`,
                    background: T.paperDim,
                    color: T.ink,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <X size={19} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div
            style={{
              padding: "16px 20px 20px 20px",
              overflowY: "auto",
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* SUBURB */}
            <div className="mb-5">
              <Label>SUBURB</Label>
              <div
                style={{
                  maxHeight: showAllSuburbs ? "1000px" : "200px",
                  overflow: "hidden",
                  transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <div className="flex flex-wrap gap-1.5">
                  {citySuburbs.map((suburb) => (
                    <FilterOption
                      key={suburb}
                      value={suburb}
                      selected={filters.suburb === suburb}
                      onClick={() => handleSuburbTap(suburb)}
                    />
                  ))}
                </div>
              </div>
              {citySuburbs.length > 7 && (
                <button
                  type="button"
                  onClick={() => setShowAllSuburbs((v) => !v)}
                  className="f-body font-semibold mt-2"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: T.jacaranda,
                    fontSize: 11.5,
                    padding: "6px 2px",
                    cursor: "pointer",
                  }}
                >
                  {showAllSuburbs ? "Show less" : `See more (+${citySuburbs.length - 7})`}
                </button>
              )}
            </div>

            {/* PROPERTY TYPE */}
            <div className="mb-5">
              <Label>PROPERTY TYPE</Label>
              <div
                style={{
                  maxHeight: showAllTypes ? "1000px" : "200px",
                  overflow: "hidden",
                  transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <div className="flex flex-wrap gap-1.5">
                  {propertyTypes.map((type) => (
                    <FilterOption
                      key={type}
                      value={type}
                      selected={filters.type === type}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          type: type !== "All" && f.type === type ? "All" : type,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
              {propertyTypes.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllTypes((v) => !v)}
                  className="f-body font-semibold mt-2"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: T.jacaranda,
                    fontSize: 11.5,
                    padding: "6px 2px",
                    cursor: "pointer",
                  }}
                >
                  {showAllTypes ? "Show less" : `See more (+${propertyTypes.length - 5})`}
                </button>
              )}
            </div>

            {/* MAX RENT */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <Label>MAX RENT</Label>
                <div className="f-mono font-semibold" style={{ color: T.ink, fontSize: 13 }}>
                  {filters.maxPrice >= 1000 ? "$1,000+" : `$${filters.maxPrice}`}
                </div>
              </div>
              <input
                type="range"
                min={40}
                max={1000}
                step={5}
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, maxPrice: Number(e.target.value) }))
                }
                className="w-full"
                style={{ accentColor: T.jacaranda }}
              />
              <div className="flex items-center justify-between f-body mt-1" style={{ color: T.ink60, fontSize: 10.5 }}>
                <span>$40</span>
                <span>$1,000+</span>
              </div>
            </div>

            {/* BEDS */}
            <div className="mb-5">
              <Label>BEDS</Label>
              <div className="flex flex-wrap gap-1.5">
                {["Any", "1", "2", "3", "4", "5+"].map((b) => (
                  <FilterOption
                    key={b}
                    value={b === "Any" ? "Any" : `${b}+`}
                    selected={(filters.beds || "Any") === b}
                    onClick={() => setFilters((f) => ({ ...f, beds: b }))}
                  />
                ))}
              </div>
            </div>

            {/* BATHROOMS */}
            <div className="mb-5">
              <Label>BATHROOMS</Label>
              <div className="flex flex-wrap gap-1.5">
                {["Any", "1", "2", "3+"].map((b) => (
                  <FilterOption
                    key={b}
                    value={b === "Any" ? "Any" : `${b}+`}
                    selected={(filters.baths || "Any") === b}
                    onClick={() => setFilters((f) => ({ ...f, baths: b }))}
                  />
                ))}
              </div>
            </div>

            {/* FURNISHED */}
            <div className="mb-5">
              <Label>FURNISHED</Label>
              <div className="flex flex-wrap gap-1.5">
                {["Any", "Furnished", "Unfurnished"].map((value) => (
                  <FilterOption
                    key={value}
                    value={value}
                    selected={(filters.furnished || "Any") === value}
                    onClick={() => setFilters((f) => ({ ...f, furnished: value }))}
                  />
                ))}
              </div>
            </div>

            {/* PARKING */}
            <div
              className="mb-5 flex items-center justify-between rounded-2xl p-3.5"
              style={{ background: T.paperDim, border: `1px solid ${T.line}` }}
            >
              <div>
                <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 13 }}>
                  Parking required
                </div>
                <div className="f-body mt-0.5" style={{ color: T.ink60, fontSize: 11 }}>
                  Only show listings with parking
                </div>
              </div>
              <ToggleSwitch
                on={!!filters.parking}
                onToggle={() =>
                  setFilters((f) => ({ ...f, parking: !f.parking }))
                }
              />
            </div>

            {/* VERIFIED LANDLORDS */}
            <div
              className="mb-5 flex items-center justify-between rounded-2xl p-3.5"
              style={{ background: T.paperDim, border: `1px solid ${T.line}` }}
            >
              <div>
                <div className="f-body font-semibold" style={{ color: T.ink, fontSize: 13 }}>
                  Verified landlords only
                </div>
                <div className="f-body mt-0.5" style={{ color: T.ink60, fontSize: 11 }}>
                  Hide pending & flagged listings
                </div>
              </div>
              <ToggleSwitch
                on={filters.verifiedOnly}
                onToggle={() =>
                  setFilters((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))
                }
              />
            </div>

            {/* SHOW RESULTS */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-full f-display font-semibold mt-1 active:scale-[0.98]"
              style={{
                background: T.brick,
                color: T.paper,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 5px 18px rgba(0,0,0,0.12)",
              }}
            >
              {resultCount != null ? `Show ${resultCount} results` : "Show results"}
            </button>
          </div>
        </div>
      </div>

      {/* Popover overlay – z-index raised to cover search header */}
      {showPopover && selectedSuburb && (
        <SuburbQuickFilterPopover
          selectedSuburb={selectedSuburb}
          propertyTypes={propertyTypes}
          tempType={tempType}
          setTempType={setTempType}
          tempBeds={tempBeds}
          setTempBeds={setTempBeds}
          tempMaxPrice={tempMaxPrice}
          setTempMaxPrice={setTempMaxPrice}
          applyPopoverFilters={applyPopoverFilters}
        />
      )}
    </>
  );
}