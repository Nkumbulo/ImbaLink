import { useMemo } from "react";
import { T } from "../../styles/tokens";
import { getPriceHistogram } from "../../utils/propertyHelpers";

const TRACK_HEIGHT = 56;
const BAR_GAP = 3;

// A dual-thumb price range slider with a histogram of actual listing
// counts behind it, so the bars reflect where the real inventory sits
// across the price range rather than being decorative.
export default function PriceHistogramSlider({
  cityProperties,
  min = 0,
  max,
  valueMin,
  valueMax,
  onChange,
  step = 10,
  bins = 20,
}) {
  const ceiling = max > min ? max : min + step;
  const lo = Math.max(min, Math.min(valueMin ?? min, ceiling));
  const hi = Math.max(min, Math.min(valueMax ?? ceiling, ceiling));

  const bars = useMemo(
    () => getPriceHistogram(cityProperties, ceiling, bins),
    [cityProperties, ceiling, bins]
  );
  const maxCount = Math.max(1, ...bars);

  const handleMinChange = (e) => {
    const next = Math.min(Number(e.target.value), hi - step);
    onChange?.(Math.max(min, next), hi);
  };
  const handleMaxChange = (e) => {
    const next = Math.max(Number(e.target.value), lo + step);
    onChange?.(lo, Math.min(ceiling, next));
  };

  const span = ceiling - min || 1;
  const loPct = ((lo - min) / span) * 100;
  const hiPct = ((hi - min) / span) * 100;

  return (
    <div>
      <style>{`
        .price-hist-input {
          -webkit-appearance: none;
          appearance: none;
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          background: transparent;
          pointer-events: none;
        }
        .price-hist-input::-webkit-slider-runnable-track {
          -webkit-appearance: none;
          background: transparent;
          height: 100%;
        }
        .price-hist-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid ${T.brick};
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: grab;
        }
        .price-hist-input::-moz-range-track {
          background: transparent;
          height: 100%;
          border: none;
        }
        .price-hist-input::-moz-range-thumb {
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid ${T.brick};
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: grab;
        }
      `}</style>

      <div style={{ position: "relative", height: TRACK_HEIGHT + 14 }}>
        {/* Histogram bars */}
        <div
          className="flex items-end"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 14,
            height: TRACK_HEIGHT,
            gap: BAR_GAP,
          }}
        >
          {bars.map((count, i) => {
            const barStart = min + (i / bins) * span;
            const barEnd = min + ((i + 1) / bins) * span;
            const active = barEnd > lo && barStart < hi;
            const h = count > 0 ? Math.max(3, (count / maxCount) * TRACK_HEIGHT) : 2;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  borderRadius: 2,
                  background: active ? T.brick : T.paperDim,
                  transition: "background 0.15s ease",
                }}
              />
            );
          })}
        </div>

        {/* Track + selected range */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 6,
            height: 4,
            borderRadius: 2,
            background: T.line,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 6,
            height: 4,
            borderRadius: 2,
            background: T.brick,
            left: `${loPct}%`,
            width: `${Math.max(0, hiPct - loPct)}%`,
          }}
        />

        {/* Dual range thumbs */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 18 }}>
          <input
            type="range"
            className="price-hist-input"
            min={min}
            max={ceiling}
            step={step}
            value={lo}
            onChange={handleMinChange}
            aria-label="Minimum price"
          />
          <input
            type="range"
            className="price-hist-input"
            min={min}
            max={ceiling}
            step={step}
            value={hi}
            onChange={handleMaxChange}
            aria-label="Maximum price"
          />
        </div>
      </div>

      <div
        className="f-body flex items-center justify-between"
        style={{ fontSize: 12, color: T.ink60, marginTop: 2 }}
      >
        <span className="font-semibold" style={{ color: T.ink }}>${lo}</span>
        <span>to</span>
        <span className="font-semibold" style={{ color: T.ink }}>
          {hi >= ceiling ? `$${ceiling}+` : `$${hi}`}
        </span>
      </div>
    </div>
  );
}
