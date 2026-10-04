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

// Depth = how far the sheet goes. Budget = total cards the topic should get.
export const DEPTHS = {
  1: { name: 'Glance', budget: 5, intent: 'The core idea and the handful of things you must never forget.' },
  2: { name: 'Essentials', budget: 12, intent: 'The 80/20: what covers most real situations.' },
  3: { name: 'Working', budget: 24, intent: 'Daily-use reference: commands, patterns, examples, gotchas.' },
  4: { name: 'Deep', budget: 45, intent: 'Edge cases, comparisons, decision rules, troubleshooting.' },
  5: { name: 'Reference', budget: 80, intent: 'Near-exhaustive: everything a practitioner looks up.' },
};

export function resolveLayout(meta) {
  const key = String(meta.format || 'A4').toUpperCase();
  const f = FORMATS[key];
  if (!f) throw new Error(`Unknown format "${meta.format}". Use one of ${Object.keys(FORMATS).join(', ')}.`);
  const landscape = (meta.orientation || (['A6', 'A7'].includes(key) ? 'portrait' : 'landscape')) === 'landscape';
  const depth = DEPTHS[meta.depth || 3];
  if (!depth) throw new Error(`Depth must be 1-5, got "${meta.depth}".`);
  const fontPt = f.font * (meta.scale || 1);
  const minScale = Math.max(meta.min_scale ?? 0.86, MIN_PT / fontPt);
  return {
    format: key,
    landscape,
    widthMm: landscape ? f.h : f.w,
    heightMm: landscape ? f.w : f.h,
    cols: meta.columns && meta.columns !== 'auto' ? Number(meta.columns) : f.cols[landscape ? 1 : 0],
    fontPt,
    minScale,
    maxScale: Math.max(meta.max_scale ?? 1.25, minScale),
    marginMm: f.margin,
    gapMm: f.gap,
    capacity: f.capacity,
    depth: Number(meta.depth || 3),
    depthName: depth.name,
    suggestedPages: Math.max(1, Math.ceil(depth.budget / f.capacity)),
  };
}
