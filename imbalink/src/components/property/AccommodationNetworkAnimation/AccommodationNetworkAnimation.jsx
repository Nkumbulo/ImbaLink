import { useMemo } from "react";
import { generateNetwork } from "./networkGenerator";
import { useNetworkTier, usePrefersReducedMotion, NETWORK_STYLE } from "./networkAnimation";

// Purely decorative "living map of the housing market": small vector
// houses, linked by soft curved routes, with dots travelling between
// them — arriving, pausing, then heading back out. Native SMIL
// (animateMotion / animate) does the animating, so nothing here causes
// React to re-render on every frame; the layout itself is generated
// once per responsive tier and memoized.
export default function AccommodationNetworkAnimation({ className = "" }) {
  const tier = useNetworkTier();
  const reducedMotion = usePrefersReducedMotion();
  const { width, height, houses, routes } = useMemo(() => generateNetwork(tier), [tier]);

  return (
    <svg
      className={`anw-root${className ? ` ${className}` : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <symbol id="anw-house" viewBox="0 0 32 28">
          <path d="M2 15 L16 2 L30 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 13 V26 H25 V13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="14" y="17" width="4" height="9" fill="currentColor" opacity=".7" />
        </symbol>
      </defs>

      {routes.map((route) => (
        <g key={route.id}>
          <path d={route.d} fill="none" stroke={NETWORK_STYLE.lineColor} strokeWidth="1.1" strokeLinecap="round">
            {!reducedMotion && (
              <animate
                attributeName="opacity"
                values="0.14;0.4;0.14"
                dur={`${route.opacityDur}s`}
                begin={`${route.pulseDelay}s`}
                repeatCount="indefinite"
              />
            )}
          </path>

          {!reducedMotion && (
            <circle r={NETWORK_STYLE.dotRadius} fill={NETWORK_STYLE.dotColor}>
              {/* Travel out, dwell at the far house, travel back, dwell at
                  home — a single motion path avoids per-frame React work. */}
              <animateMotion
                path={route.d}
                dur={`${route.dur}s`}
                begin={`${route.delay}s`}
                repeatCount="indefinite"
                calcMode="linear"
                keyPoints="0;0;1;1;0"
                keyTimes="0;0.12;0.5;0.62;1"
              />
              <animate
                attributeName="opacity"
                values="0.55;0.85;0.55"
                dur="2.6s"
                begin={`${route.pulseDelay}s`}
                repeatCount="indefinite"
              />
            </circle>
          )}
        </g>
      ))}

      {houses.map((house) => {
        const w = 32 * house.scale;
        const h = 28 * house.scale;
        return (
          <use
            key={house.id}
            href="#anw-house"
            x={house.x - w / 2}
            y={house.y - h / 2}
            width={w}
            height={h}
            color={NETWORK_STYLE.houseColor}
          />
        );
      })}
    </svg>
  );
}
