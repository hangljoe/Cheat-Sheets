// DIN paper formats and the layout defaults that make each one readable.
// Sizes are portrait mm. cols = default flow columns [portrait, landscape].
// font = base body size in pt. capacity = rough number of standard cards one
// page holds at depth-appropriate density (used to suggest page counts).

export const FORMATS = {
  A3: { w: 297, h: 420, cols: [4, 6], font: 8.6, margin: 10, gap: 4.2, capacity: 26 },
  A4: { w: 210, h: 297, cols: [3, 4], font: 7.6, margin: 8, gap: 3.4, capacity: 13 },
  A5: { w: 148, h: 210, cols: [2, 3], font: 7.1, margin: 6.5, gap: 2.8, capacity: 6 },
  A6: { w: 105, h: 148, cols: [1, 2], font: 6.8, margin: 5, gap: 2.2, capacity: 3 },
  A7: { w: 74, h: 105, cols: [1, 2], font: 6.4, margin: 4, gap: 1.8, capacity: 2 },
};

// No printed text may be smaller than this, whatever the format or auto-fit does.
export const MIN_PT = 6;

// A grid page may leave at most this share of its card area hollow (empty space under a card's
// content, where rows stretch to the tallest card). The balancer plans within it and the build
// prints `△ hollow` when the final page still exceeds it. Per sheet: `max_hollow:` in sheet.yaml.
export const MAX_HOLLOW = 0.10;

// Depth = how far the sheet goes. Budget = total cards the topic should get.
export const DEPTHS = {
  1: { name: 'Glance', budget: 5, intent: 'The core idea and the handful of things you must never forget.' },
  2: { name: 'Essentials', budget: 12, intent: 'The 80/20: what covers most real situations.' },
  3: { name: 'Working', budget: 24, intent: 'Daily-use reference: commands, patterns, examples, gotchas.' },
  4: { name: 'Deep', budget: 45, intent: 'Edge cases, comparisons, decision rules, troubleshooting.' },
  5: { name: 'Reference', budget: 80, intent: 'Near-exhaustive: everything a practitioner looks up.' },
};

// Which smaller DIN format the content would fill: each step halves the page, so a page whose
// content covers `used` of it would cover 2·used of the next size down. Returns the smallest format
// that stays ≤ 92 % used (never over-full), or null when the page is already well used.
export function smallerFormat(format, used) {
  const order = ['A3', 'A4', 'A5', 'A6', 'A7'];
  let i = order.indexOf(String(format).toUpperCase()), u = used, pick = null;
  while (i >= 0 && i < order.length - 1 && u * 2 <= 0.92) { i++; u *= 2; pick = { format: order[i], used: +u.toFixed(2) }; }
  return pick;
}

// Density = how much air the page gets. `dense` packs text like a reference card (no card boxes,
// one more column, smaller type, tighter gaps); `visual` is poster-like (one column fewer, bigger type
// and icons, wider gaps, few items). cols is added to the format's default (never below 1);
// font and gap multiply; capacity multiplies the cards a page is assumed to hold.
export const DENSITIES = {
  dense: { name: 'Dense', cols: 1, font: 0.9, gap: 0.6, capacity: 1.8, intent: 'As much as fits, still readable: a text-first reference card.' },
  balanced: { name: 'Balanced', cols: 0, font: 1, gap: 1, capacity: 1, intent: 'Cards, icons and one diagram per page: the default mix.' },
  visual: { name: 'Visual', cols: -1, font: 1.1, gap: 1.3, capacity: 0.55, intent: 'Few items, big icons, lots of air: a poster.' },
};

export function resolveLayout(meta) {
  const key = String(meta.format || 'A4').toUpperCase();
  const f = FORMATS[key];
  if (!f) throw new Error(`Unknown format "${meta.format}". Use one of ${Object.keys(FORMATS).join(', ')}.`);
  const landscape = (meta.orientation || (['A6', 'A7'].includes(key) ? 'portrait' : 'landscape')) === 'landscape';
  const depth = DEPTHS[meta.depth || 3];
  if (!depth) throw new Error(`Depth must be 1-5, got "${meta.depth}".`);
  const densityKey = String(meta.density || 'balanced').toLowerCase();
  const d = DENSITIES[densityKey];
  if (!d) throw new Error(`Unknown density "${meta.density}". Use one of ${Object.keys(DENSITIES).join(', ')}.`);
  const fontPt = f.font * d.font * (meta.scale || 1);
  const minScale = Math.max(meta.min_scale ?? 0.86, MIN_PT / fontPt);
  const maxHollow = meta.max_hollow ?? MAX_HOLLOW;
  if (typeof maxHollow !== 'number' || !(maxHollow >= 0 && maxHollow <= 1)) {
    throw new Error(`max_hollow must be a number from 0 to 1 (1 = shortest stack only), got "${meta.max_hollow}".`);
  }
  return {
    maxHollow,
    format: key,
    landscape,
    widthMm: landscape ? f.h : f.w,
    heightMm: landscape ? f.w : f.h,
    cols: meta.columns && meta.columns !== 'auto' ? Number(meta.columns) : Math.max(1, f.cols[landscape ? 1 : 0] + d.cols),
    fontPt,
    minScale,
    maxScale: Math.max(meta.max_scale ?? 1.25, minScale),
    marginMm: f.margin,
    gapMm: +(f.gap * d.gap).toFixed(2),
    capacity: Math.round(f.capacity * d.capacity),
    density: densityKey,
    densityName: d.name,
    depth: Number(meta.depth || 3),
    depthName: depth.name,
    suggestedPages: Math.max(1, Math.ceil(depth.budget / Math.max(1, f.capacity * d.capacity))),
  };
}
