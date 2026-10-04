// Excalidraw element factory shared by the node kit and the in-browser Mermaid
// converter. Pure ESM, no node imports. Seeded, so the same input always yields
// byte-identical output (stable diffs, reproducible renders).

export const FILLS = { yellow: '#ffec99', green: '#b2f2bb', blue: '#a5d8ff', violet: '#eebefa', red: '#ffc9c9',
  orange: '#ffd8a8', gray: '#e9ecef', teal: '#96f2d7', none: 'transparent' };
export const INK = { blue: '#1971c2', violet: '#9c36b5', red: '#e03131', green: '#2f9e44', orange: '#e8590c',
  gray: '#495057', black: '#1e1e1e' };

// mulberry32: tiny, fast, good enough for hand-drawn jitter seeds.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ids are `e<seed>_<n>`: unique within a factory and across factories with different seeds.
export function makeFactory(seed = 1) {
  const random = mulberry32(seed);
  let n = 0;
  const rnd = () => Math.floor(random() * 2 ** 31);
  const base = (o) => ({
    id: `e${seed}_${++n}`, angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent',
    fillStyle: 'hachure', strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [],
    frameId: null, roundness: null, seed: rnd(), version: 1, versionNonce: rnd(), isDeleted: false,
    boundElements: [], updated: 1, link: null, locked: false, ...o,
  });
  return { base, rnd };
}
