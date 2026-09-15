import { MapPin, Check } from "lucide-react";
import { T } from "../../styles/tokens";

export default function CityPicker({
  properties,
  city,
  setCity,
  setFilters,
  onClose,
}) {
  const cities = [
    "All",
    ...Array.from(
      new Set(properties.map((p) => p?.city).filter(Boolean))
    ),
  ];

  return (
    <div
      className="city-picker-overlay fixed inset-0 z-50 flex items-end md:items-center md:justify-center fade"
      onClick={onClose}
      style={{
        background: "rgba(20,32,26,0.55)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div
        className="city-picker-panel w-full p-5 rise noscroll"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.paper,
          maxHeight: "88vh",
          overflowY: "auto",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: "0 -12px 40px rgba(20,32,26,0.22)",
        }}
      >
        <div
          className="w-10 h-1.5 rounded-full mx-auto mb-4"
          style={{ background: T.line }}
        />

        <div className="flex items-center justify-between mb-5">
          <div>
            <div
              className="f-display font-semibold"
              style={{ color: T.ink, fontSize: 18 }}
            >
              Choose a city
            </div>

            <div
              className="f-body mt-1"
              style={{ color: T.ink60, fontSize: 11.5 }}
            >
              Browse listings by location
            </div>
          </div>

          <div
            className="city-picker-count f-mono"
            style={{
              color: T.ink60,
              fontSize: 11,
              background: T.paperDim,
              border: `1px solid ${T.line}`,
              borderRadius: 999,
              padding: "6px 9px",
            }}
          >
            {cities.length - 1}
          </div>
        </div>

        <div className="city-picker-list flex flex-col gap-1.5">
          {cities.map((c) => {
            const count =
              c === "All"
                ? properties.length
                : properties.filter((p) => p?.city === c).length;

            const active = c === city;

            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCity(c);
                  setFilters((f) => ({
                    ...f,
                    suburb: "All",
                    type: "All",
                  }));
                  onClose();

                  window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: "smooth",
                  });
                }}
                className="city-option w-full flex items-center justify-between px-3.5 py-3 rounded-xl active:scale-[0.99]"
                style={{
                  background: active
                    ? T.jacaranda
                    : T.paperDim,
                  border: "none",
                  transition:
                    "transform 0.15s ease, background 0.15s ease",
                  cursor: "pointer",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin
                    size={15}
                    color={active ? T.paper : T.ink60}
                  />

                  <span
                    className="f-body font-semibold truncate"
                    style={{
                      color: active ? T.paper : T.ink,
                      fontSize: 14,
                    }}
                  >
                    {c}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="f-body"
                    style={{
                      color: active
                        ? "rgba(251,248,240,0.8)"
                        : T.ink60,
                      fontSize: 11.5,
                    }}
                  >
                    {count} places
                  </span>

                  {active && (
                    <Check
                      size={15}
                      color={T.paper}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
