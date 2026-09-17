import { Check, MapPin } from "lucide-react";
import { T } from "../../styles/tokens";
import { propertyPhoto } from "./helpers";

// Note: ProfilePage.jsx has its own separately-implemented PropertyPicker
// (with pagination this one doesn't have) — same name, same purpose, but
// genuinely different behavior, confirmed by comparing both before this
// split. Not a safe unification target the way useMediaQuery was; left as
// two separate components rather than forcing a merge that would change
// one or both's actual behavior.
export function PropertyPicker({ properties = [], value, onChange, label = "Choose a property", hint, emptyText = "No saved properties yet." }) {
  const selected = properties.find((p) => String(p?.id) === String(value));
  const choose = (property) => onChange(property ? String(property.id) : "");

  return (
    <div className="rf-property-picker">
      <label>{label}</label>
      {properties.length === 0 ? (
        <div className="rf-card" style={{ marginTop: 7, padding: 12, color: T.ink60, fontSize: 11 }}>
          {emptyText}
        </div>
      ) : selected ? (
        <div className="rf-property-select-card" role="button" tabIndex={0} onClick={() => choose(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") choose(null); }}>
          <img src={propertyPhoto(selected)} alt="" />
          <div className="rf-property-select-info">
            <div className="rf-property-selected-label"><Check size={11} /> Selected property</div>
            <h4>{selected.title}</h4>
            <p><MapPin size={11} /> {selected.suburb}, {selected.city}</p>
            <div className="rf-property-select-meta"><b>${selected.rent}/mo</b><span>{selected.rooms} rooms</span></div>
          </div>
          <button type="button" className="rf-btn-secondary rf-property-change" onClick={(e) => { e.stopPropagation(); choose(null); }}>Change</button>
        </div>
      ) : (
        <div className="rf-property-choice-grid">
          {properties.map((property) => (
            <button type="button" key={property.id} className="rf-property-choice" onClick={() => choose(property)}>
            <img src={propertyPhoto(property)} alt="" loading="lazy" />
              <span className="rf-property-choice-body">
                <strong>{property.title}</strong>
                <small><MapPin size={10} /> {property.suburb}, {property.city}</small>
                <em>${property.rent}/mo · {property.rooms} rooms</em>
              </span>
            </button>
          ))}
        </div>
      )}
      {hint && <span style={{ fontSize: 9.5, color: T.ink60 }}>{hint}</span>}
    </div>
  );
}
