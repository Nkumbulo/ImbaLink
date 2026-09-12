import { useState, useEffect, useMemo } from "react";
import { Check, MapPin } from "lucide-react";
import { T } from "../../styles/tokens";
import { photosFor } from "../../utils/propertyHelpers";

// Note: RoommateFinderPage.jsx has its own separately-implemented
// PropertyPicker (no pagination, uses a wrapped propertyPhoto() helper
// instead of photosFor() directly) — same name, same purpose, genuinely
// different behavior, confirmed by comparing both during that file's
// split. Not a safe unification target; left as two separate components.

function PropertyPicker({ properties = [], value, onChange, label = "Choose a property", hint, emptyText = "No saved properties yet." }) {
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;
  const selected = properties.find((p) => String(p?.id) === String(value));
  const choose = (property) => {
    onChange(property ? String(property.id) : "");
    setPage(1); // reset pagination on selection
  };

  const pageCount = Math.max(1, Math.ceil(properties.length / PER_PAGE));
  const visibleProperties = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return properties.slice(start, start + PER_PAGE);
  }, [properties, page, PER_PAGE]);

  // Reset page if properties shrink below current page
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [pageCount, page]);

  return (
    <div className="rf-property-picker">
      <style>{`
        .rf-property-picker .rf-property-choice-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 8px;
          margin-top: 7px;
        }
        .rf-property-picker .rf-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
          font-size: 10px;
          color: ${T.ink60};
        }
        .rf-property-picker .rf-pagination button {
          border: 1px solid ${T.line};
          background: ${T.white};
          color: ${T.ink};
          border-radius: 6px;
          padding: 5px 8px;
          font-size: 10px;
          cursor: pointer;
        }
        .rf-property-picker .rf-pagination button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
      <label>{label}</label>
      {properties.length === 0 ? (
        <div className="rf-card" style={{ marginTop: 7, padding: 12, color: T.ink60, fontSize: 11 }}>
          {emptyText}
        </div>
      ) : selected ? (
        <div className="rf-property-select-card" role="button" tabIndex={0} onClick={() => choose(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") choose(null); }}>
          <img src={photosFor(selected.id)[0]} alt="" />
          <div className="rf-property-select-info">
            <div className="rf-property-selected-label"><Check size={11} /> Selected property</div>
            <h4>{selected.title}</h4>
            <p><MapPin size={11} /> {selected.suburb}, {selected.city}</p>
            <div className="rf-property-select-meta"><b>${selected.rent}/mo</b><span>{selected.rooms} rooms</span></div>
          </div>
          <button type="button" className="rf-btn-secondary rf-property-change" onClick={(e) => { e.stopPropagation(); choose(null); }}>Change</button>
        </div>
      ) : (
        <>
          <div className="rf-property-choice-grid">
            {visibleProperties.map((property) => (
              <button type="button" key={property.id} className="rf-property-choice" onClick={() => choose(property)}>
                <img src={photosFor(property.id)[0]} alt="" />
                <span className="rf-property-choice-body">
                  <strong>{property.title}</strong>
                  <small><MapPin size={10} /> {property.suburb}, {property.city}</small>
                  <em>${property.rent}/mo · {property.rooms} rooms</em>
                </span>
              </button>
            ))}
          </div>
          {pageCount > 1 && (
            <div className="rf-pagination">
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
              <span>Page {page} of {pageCount}</span>
              <button disabled={page === pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>Next</button>
            </div>
          )}
        </>
      )}
      {hint && <span style={{ fontSize: 9.5, color: T.ink60 }}>{hint}</span>}
    </div>
  );
}

export default PropertyPicker;
