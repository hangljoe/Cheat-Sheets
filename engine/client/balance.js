// Grid balancer: choose a 12-column span for every card so consecutive cards
// form full rows and the page's stack is as short as possible. Pure — the
// browser measures heights, this decides. Card order is never changed.

export const MAX_BALANCE_CARDS = 30;
const SPANS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

export function allowedSpans(cols) {
  return SPANS.filter((s) => s >= Math.floor(12 / cols));
}

// All ordered tuples of `k` spans (from `set`) that sum to 12.
function tuples(k, set) {
  const out = [];
  const walk = (left, acc) => {
    if (acc.length === k) { if (left === 0) out.push(acc); return; }
    for (const s of set) if (s <= left) walk(left - s, [...acc, s]);
  };
  walk(12, []);
  return out;
}

// cards[i] = { fixed: number|null, heights: Map<span, px> }.
// A span missing from `heights` (or Infinity) is not allowed for that card.
// Returns { spans, rows, height, waste } · { skipped } · null (no full-row partition).
export function planRows(cards, { cols, gap = 0, maxCards = MAX_BALANCE_CARDS } = {}) {
  if (cards.length > maxCards) return { skipped: 'too-many-cards' };
  const n = cards.length;
  if (!n) return { spans: [], rows: [], height: 0, waste: 0 };
  // Free cards use the format's spans; fixed spans are legal at any width and join the tuple set.
  const allowed = new Set(allowedSpans(cols));
  const set = [...new Set([...allowed, ...cards.map((c) => c.fixed).filter((f) => f != null)])].sort((x, y) => x - y);
  const maxRow = Math.max(cols, ...cards.map((c) => (c.fixed ? Math.floor(12 / c.fixed) : 0)));
  const byLen = Array.from({ length: maxRow + 1 }, (_, k) => (k ? tuples(k, set) : []));
  const h = (i, s) => {
    const c = cards[i];
    if (c.fixed != null && c.fixed !== s) return Infinity;
    if (c.fixed == null && !allowed.has(s)) return Infinity;
    const v = c.heights.get(s);
    return v === undefined ? Infinity : v;
  };

  // best[i] = cheapest layout of cards i..n-1 (height includes a gap before each row).
  const best = new Array(n + 1).fill(null);
  best[n] = { height: 0, waste: 0, rows: [] };
  for (let i = n - 1; i >= 0; i--) {
    for (let k = 1; k <= maxRow && i + k <= n; k++) {
      const rest = best[i + k];
      if (!rest) continue;
      for (const spans of byLen[k]) {
        const hs = spans.map((s, j) => h(i + j, s));
        if (hs.some((x) => x === Infinity)) continue;
        const rowH = Math.max(...hs);
        const waste = hs.reduce((w, x, j) => w + (rowH - x) * spans[j], 0);
        const cand = { height: rowH + gap + rest.height, waste: waste + rest.waste, rows: [spans, ...rest.rows] };
        const cur = best[i];
        if (!cur || cand.height < cur.height - 1e-6 || (Math.abs(cand.height - cur.height) <= 1e-6 && cand.waste < cur.waste)) {
          best[i] = cand;
        }
      }
    }
  }
  if (!best[0]) return null;
  let i = 0;
  const rows = best[0].rows.map((spans) => spans.map(() => i++));
  return { spans: best[0].rows.flat(), rows, height: best[0].height - gap, waste: best[0].waste };
}
