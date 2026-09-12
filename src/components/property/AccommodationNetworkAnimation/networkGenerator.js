// Pure layout math for the accommodation network animation.
// No React/DOM here — just deterministic generation of house positions
// and the curved routes that connect them, so the component can stay
// focused on rendering and the network can be unit-tested in isolation.

// Small seeded PRNG (mulberry32) so a given tier always produces the
// same organic-looking layout instead of reshuffling on every render.
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h;
}

// Fewer houses/dots/routes at smaller tiers, per the "simplify on mobile"
// requirement — the network should feel lighter, not just visually cropped.
export const NETWORK_TIER_PRESETS = {
  desktop: { width: 1180, height: 340, houseCount: 9, cols: 3, extraRoutes: 3 },
  tablet: { width: 900, height: 300, houseCount: 6, cols: 3, extraRoutes: 2 },
  mobile: { width: 520, height: 230, houseCount: 4, cols: 2, extraRoutes: 1 },
};

function buildRoute(a, b, rand) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // Perpendicular offset from the midpoint gives each connector a gentle,
  // non-identical curve rather than a rigid straight line.
  const nx = -dy / dist;
  const ny = dx / dist;
  const bend = (rand() - 0.5) * Math.min(dist * 0.3, 60);
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  const d = `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  // Longer routes take proportionally longer to travel, so speed reads
  // as roughly constant across very different route lengths.
  const dur = +(5.5 + Math.min(dist / 38, 7) + rand() * 2.2).toFixed(2);
  const delay = +(rand() * 4.5).toFixed(2);
  const pulseDelay = +(rand() * 3).toFixed(2);
  const opacityDur = +(3.6 + rand() * 2.6).toFixed(2);
  return { id: `r-${a.id}-${b.id}`, d, dist, dur, delay, pulseDelay, opacityDur };
}

/**
 * Generates a stable, organic house-and-route layout for a given
 * responsive tier. Re-running with the same tier always yields the same
 * layout (seeded), so React can memoize on tier alone.
 */
export function generateNetwork(tier = "desktop") {
  const preset = NETWORK_TIER_PRESETS[tier] || NETWORK_TIER_PRESETS.desktop;
  const { width, height, houseCount, cols, extraRoutes } = preset;
  const rand = mulberry32(hashSeed(`imbalink-network-${tier}`));

  const marginX = width * 0.09;
  const marginY = height * 0.14;
  const rows = Math.ceil(houseCount / cols);
  const cellW = (width - marginX * 2) / cols;
  const cellH = (height - marginY * 2) / rows;

  const houses = [];
  for (let i = 0; i < houseCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = (rand() - 0.5) * cellW * 0.55;
    const jitterY = (rand() - 0.5) * cellH * 0.55;
    const x = marginX + cellW * (col + 0.5) + jitterX;
    const y = marginY + cellH * (row + 0.5) + jitterY;
    const scale = +(0.82 + rand() * 0.34).toFixed(2);
    houses.push({ id: `h${i}`, x, y, scale });
  }

  const routeKeys = new Set();
  const routes = [];
  const addRoute = (a, b) => {
    if (!a || !b || a.id === b.id) return;
    const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
    if (routeKeys.has(key)) return;
    routeKeys.add(key);
    routes.push(buildRoute(a, b, rand));
  };

  // Connect every house to its nearest neighbour (guarantees a fully
  // linked network), and sometimes its second-nearest too for density.
  houses.forEach((house) => {
    const others = houses
      .filter((h) => h.id !== house.id)
      .map((h) => ({ h, dist: Math.hypot(h.x - house.x, h.y - house.y) }))
      .sort((a, b) => a.dist - b.dist);
    if (others[0]) addRoute(house, others[0].h);
    if (others[1] && rand() > 0.35) addRoute(house, others[1].h);
  });

  // A few extra long-haul routes so the network isn't perfectly tidy —
  // "some routes should be longer... some should intersect".
  for (let i = 0; i < extraRoutes && houses.length > 2; i++) {
    const a = houses[Math.floor(rand() * houses.length)];
    const b = houses[Math.floor(rand() * houses.length)];
    addRoute(a, b);
  }

  return { width, height, houses, routes };
}
