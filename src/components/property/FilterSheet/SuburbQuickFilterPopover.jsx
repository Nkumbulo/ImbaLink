import { X } from "lucide-react";
import { T } from "../../../styles/tokens";
import { Label, FilterOption } from "./FilterControls";

export default function SuburbQuickFilterPopover({
  selectedSuburb,
  propertyTypes,
  tempType,
  setTempType,
  tempBeds,
  setTempBeds,
  tempMaxPrice,
  setTempMaxPrice,
  applyPopoverFilters,
}) {
  return (
    <div
      className="suburb-popover-overlay fixed inset-0 z-[120] flex items-center justify-center p-6"
      style={{
        background: "rgba(20,32,26,0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={applyPopoverFilters} // click outside applies and closes
    >
      <div
        className="popover-card w-full max-w-sm p-5 rounded-3xl"
        style={{
          background: T.paper,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="f-display font-semibold" style={{ color: T.ink, fontSize: 16 }}>
            {selectedSuburb} — quick filters
          </div>
          <button
            type="button"
            onClick={applyPopoverFilters}
            style={{
              border: "none",
              background: "transparent",
              color: T.ink60,
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Type chips */}
        <Label>TYPE</Label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {propertyTypes.slice(0, 5).map((type) => (
            <FilterOption
              key={type}
              value={type}
              selected={tempType === type}
              onClick={() => setTempType(type)}
            />
          ))}
        </div>

        {/* Beds */}
        <Label>BEDS</Label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {["Any", "1", "2", "3", "4", "5+"].map((b) => (
            <FilterOption
              key={b}
              value={b}
              selected={tempBeds === b}
              onClick={() => setTempBeds(b)}
            />
          ))}
        </div>

        {/* Max rent */}
        <Label>MAX RENT</Label>
        <input
          type="range"
          min={40}
          max={1000}
          step={5}
          value={tempMaxPrice}
          onChange={(e) => setTempMaxPrice(Number(e.target.value))}
          className="w-full mb-2"
          style={{ accentColor: T.jacaranda }}
        />
        <div className="flex justify-between f-body text-xs mb-4" style={{ color: T.ink60 }}>
          <span>$40</span>
          <span>${tempMaxPrice >= 1000 ? "1,000+" : tempMaxPrice}</span>
        </div>

        <button
          type="button"
          onClick={applyPopoverFilters}
          className="w-full py-3 rounded-full f-display font-semibold"
          style={{
            background: T.brick,
            color: T.paper,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
          }}
        >
          Apply & view results
        </button>
      </div>
    </div>
  );
}
