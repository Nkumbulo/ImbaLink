import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { T } from "../../styles/tokens";
import { coordsForProperty } from "../../utils/mapCoords";

// A plain SVG pin instead of Leaflet's default marker image — Leaflet's
// default icon references relative image paths that don't resolve
// correctly through Vite's bundler (a well-known issue, not specific to
// this app), so a DivIcon sidesteps it entirely rather than needing an
// asset-path workaround.
function pinIcon(color) {
  return L.divIcon({
    className: "imbalink-map-pin",
    html: `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 23 15 23s15-12.5 15-23c0-8.3-6.7-15-15-15z" fill="${color}"/>
      <circle cx="15" cy="15" r="6" fill="#fff"/>
    </svg>`,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
  });
}

// Renders the general area a property is in, not its exact address — see
// utils/mapCoords.js for why. `approximate` is always true today (no
// property has real lat/lng), so the radius circle and copy below are not
// conditional on it, but the field exists for if that ever changes.
export default function PropertyMap({ property, height = 180 }) {
  const coords = coordsForProperty(property);
  if (!coords) return null;

  const center = [coords.lat, coords.lng];
  const color = T.brick || "#B83D31";

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${T.line}` }}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        dragging={true}
        style={{ height, width: "100%" }}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Circle
          center={center}
          radius={500}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1 }}
        />
        <Marker position={center} icon={pinIcon(color)}>
          <Popup>
            {property.suburb ? `${property.suburb}, ` : ""}
            {property.city || "Harare"}
          </Popup>
        </Marker>
      </MapContainer>
      <div
        className="f-body px-3 py-2"
        style={{ background: T.paperDim, color: T.ink60, fontSize: 10.5 }}
      >
        Approximate area shown, not the exact address — message the landlord for the precise location.
      </div>
    </div>
  );
}
