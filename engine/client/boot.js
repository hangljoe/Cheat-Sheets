// Runs inside the headless browser: builds page chrome, renders Excalidraw
// figures, waits for fonts, and exposes __fitPages() to the renderer.

import { planRows, allowedSpans, MAX_BALANCE_CARDS } from './balance.js';

const meta = JSON.parse(document.getElementById('sheet-meta').textContent);
const L = meta.layout;
const allPages = () => [...document.querySelectorAll('section.page')];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Number Mermaid figures in SOURCE order before anything is filtered, so a figure keeps
// its name and hand-drawn seed in every variant.
document.querySelectorAll('figure[data-mermaid]').forEach((f, k) => { f.dataset.figIndex = String(k + 1); });

// 0. Depth: drop everything tiered deeper than this variant (any nesting level).
window.__tierErrors = [];
for (const el of document.querySelectorAll('[data-tier]')) {
  const t = el.dataset.tier.trim();
  if (!/^[1-5]$/.test(t)) {
    window.__tierErrors.push(`${el.tagName.toLowerCase()} data-tier="${t}"`);
    console.error(`invalid data-tier="${t}" (use 1–5) — element kept`);
    continue;
  }
  if (Number(t) > L.depth) el.remove();
}
// 0b. Variant gate: data-variants="mono,poster" keeps an element only in the named variants
// (e.g. banner headings that belong to one layout). Without variants nothing is gated.
for (const el of document.querySelectorAll('[data-variants]')) {
  const names = el.dataset.variants.split(',').map((s) => s.trim()).filter(Boolean);
  if (meta.variant && names.length && !names.includes(meta.variant)) el.remove();
}

// 1. Page chrome: wrap content in .page-body, add header (page 1) and footer.
function buildChrome(page, i) {
  const layout = page.dataset.layout || meta.layout_mode || 'flow';
  if (!page.dataset.density) page.dataset.density = L.density || 'balanced';   // CSS keys off it
  const body = document.createElement('div');
  body.className = `page-body layout-${layout}`;
  if (page.dataset.cols) body.style.setProperty('--cols', page.dataset.cols);
  if (page.dataset.align === 'top') body.classList.add('top');
  while (page.firstChild) body.appendChild(page.firstChild);

  const showHead = meta.header !== false && (i === 0 || page.dataset.header === 'repeat');
  if (showHead) {
    const head = document.createElement('header');
    head.className = 'sheet-head';
    const tags = (meta.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
    head.innerHTML = `
      ${meta.icon ? `<div class="head-icon"><i data-icon-late="${esc(meta.icon)}"></i></div>` : ''}
      <div class="head-text">
        <h1>${esc(meta.title)}</h1>
        ${meta.subtitle ? `<p class="subtitle">${esc(meta.subtitle)}</p>` : ''}
      </div>
      <div class="head-meta">${tags}<span class="chip depth">L${L.depth} · ${esc(L.depthName)}</span></div>`;
    page.appendChild(head);
  }
  page.appendChild(body);
  if (meta.footer !== false) {
    const foot = document.createElement('footer');
    foot.className = 'sheet-foot';
    foot.innerHTML = `<span>${esc(meta.title)}${meta.source ? ` · ${esc(meta.source)}` : ''}</span><span class="foot-right"></span>`;
    page.appendChild(foot);
  }
  return body;
}

// Footer text needs the final page count, so it is (re)written separately.
function refreshFooters() {
  const ps = allPages();
  ps.forEach((page, i) => {
    const right = page.querySelector('.sheet-foot .foot-right');
    if (right) right.textContent = `${meta.version || ''}${ps.length > 1 ? `${meta.version ? ' · ' : ''}${i + 1}/${ps.length}` : ''}`;
  });
}

allPages().forEach((page, i) => buildChrome(page, i));
refreshFooters();

// Header icon is injected by the renderer's icon map (icons are inlined server-side,
// so the header icon arrives as a hidden template; see #icon-pool).
for (const slot of document.querySelectorAll('[data-icon-late]')) {
  const src = document.querySelector(`#icon-pool [data-name="${slot.dataset.iconLate}"] svg`);
  if (src) slot.replaceWith(src.cloneNode(true));
}

// 2. Figures. Excalidraw files and Mermaid definitions both end up as
// hand-drawn SVG through the same exportToSvg path.
//   <figure data-excalidraw="diagrams/x.excalidraw"></figure>
//   <figure data-mermaid="diagrams/flow.mmd"></figure>
//   <figure data-mermaid><script type="text/mermaid">flowchart LR; A-->B</script></figure>
window.__figures = { excalidraw: 0, mermaid: 0, errors: [], warnings: [] };

let exportToSvgFn;
async function toSvg({ elements, appState = {}, files = {} }) {
  if (!exportToSvgFn) {
    window.EXCALIDRAW_ASSET_PATH = '/node_modules/@excalidraw/utils/dist/prod/';
    ({ exportToSvg: exportToSvgFn } = await import('/node_modules/@excalidraw/utils/dist/prod/index.js'));
  }
  const svg = await exportToSvgFn({
    data: {
      elements: elements.filter((e) => !e.isDeleted),
      appState: { ...appState, exportBackground: false, exportWithDarkMode: false },
      files,
    },
    config: { padding: 6, canvasBackgroundColor: 'transparent' },
  });
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.classList.add('excalidraw-svg');
  return scopeIds(svg, `f${++figureCount}-`);
}

// exportToSvg derives DOM ids (masks, clip paths) from element ids, and two
// figures may share element ids. Prefix every id and its references per figure.
let figureCount = 0;
function scopeIds(svg, prefix) {
  const ids = new Set([...svg.querySelectorAll('[id]')].map((el) => el.id));
  if (!ids.size) return svg;
  for (const el of svg.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (attr.name === 'id' && ids.has(attr.value)) { el.id = prefix + attr.value; continue; }
      const v = attr.value.replace(/url\(#([^)]+)\)/g, (m, id) => (ids.has(id) ? `url(#${prefix}${id})` : m))
        .replace(/^#(.+)$/, (m, id) => ((attr.name === 'href' || attr.name === 'xlink:href') && ids.has(id) ? `#${prefix}${id}` : m));
      if (v !== attr.value) el.setAttribute(attr.name, v);
    }
  }
  return svg;
}

// Mermaid fallbacks are SVG images whose labels the page can't see. At conversion
// we lay the image's SVG out at its natural width in a hidden box and record its
// smallest label (px at natural size); minText then scales that like the image.
const IMAGE_LABEL_PX = 14;   // used only if the image can't be inspected

async function smallestImageLabelPx(files, elements) {
  let min = Infinity;
  for (const img of elements.filter((e) => e.type === 'image')) {
    const url = files[img.fileId]?.dataURL;
    if (!url?.startsWith('data:image/svg+xml')) continue;
    const markup = url.includes(';base64,')
      ? new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))
      : decodeURIComponent(url.split(',')[1]);
    const box = Object.assign(document.createElement('div'), { innerHTML: markup });
    box.style.cssText = `position:absolute;left:-99999px;top:0;width:${img.width}px;visibility:hidden`;
    document.body.appendChild(box);
    const svg = box.querySelector('svg');
    if (svg) {
      svg.style.width = `${img.width}px`;
      svg.style.height = `${img.height}px`;
      for (const t of svg.querySelectorAll('text, foreignObject *')) {
        if (!t.textContent.trim() || t.children.length) continue;
        const r = t.getBoundingClientRect();
        if (!r.width) continue;
        // Font size is in viewBox units; k maps them to px at the image's natural size.
        const vb = svg.viewBox?.baseVal;
        const k = vb && vb.width ? Math.min(img.width / vb.width, img.height / vb.height) : 1;
        min = Math.min(min, parseFloat(getComputedStyle(t).fontSize) * k);
      }
    }
    box.remove();
  }
  return Number.isFinite(min) ? min : null;
}
const FIGURE_TIMEOUT_MS = 15000;
function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms); })])
    .finally(() => clearTimeout(t));
}

function figureName(fig) {
  if (!fig) return '?';
  if (fig.dataset.excalidraw) return fig.dataset.excalidraw;
  return fig.dataset.mermaid || `mermaid #${fig.dataset.figIndex}`;
}

async function fetchText(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${res.status} fetching ${src}`);
  return res.text();
}

function figureError(fig, src, e) {
  const message = e?.message ?? String(e);
  window.__figures.errors.push({ src, message });
  console.error(`figure ${src}: ${message}`);
  const kind = fig.dataset.excalidraw ? 'Excalidraw' : 'Mermaid';
  fig.prepend(Object.assign(document.createElement('div'), {
    className: 'fig-error', textContent: `⚠ ${kind} figure ${src} failed – see build log`,
  }));
}

async function renderMermaid() {
  const figs = [...document.querySelectorAll('figure[data-mermaid]')];
  if (!figs.length) return;
  let parseMermaidToExcalidraw, skeletonToElements;
  try {
    ({ parseMermaidToExcalidraw } = await import('/engine/vendor/mermaid-to-excalidraw.js'));
    ({ skeletonToElements } = await import('/engine/client/skeleton.js'));
  } catch (e) {
    // A broken bundle must not hang the build: every mermaid figure reports it.
    for (const fig of figs) figureError(fig, figureName(fig), e);
    return;
  }
  for (const [k, fig] of figs.entries()) {
    const src = figureName(fig);
    try {
      const def = fig.dataset.mermaid
        ? await fetchText(fig.dataset.mermaid)
        : fig.querySelector('script[type="text/mermaid"]')?.textContent ?? '';
      const r = await withTimeout(parseMermaidToExcalidraw(def.trim(), { themeVariables: { fontSize: '16px' } }),
        FIGURE_TIMEOUT_MS, 'Mermaid conversion');
      // Seeds 1000+ keep mermaid ids clear of kit scenes (default seed 1).
      const { elements, files, skipped } = skeletonToElements(r.elements, {
        seed: 1000 + Number(fig.dataset.figIndex || k + 1), hand: fig.dataset.hand !== 'false', files: r.files || {},
      });
      if (elements.some((e) => e.type === 'image')) {
        const px = await smallestImageLabelPx(files, elements);
        if (px) fig.dataset.imageLabelPx = String(px);
      }
      if (elements.length && elements.every((e) => e.type === 'image')) {
        window.__figures.warnings.push({ src, image: true });
        console.warn(`figure ${src}: rendered as a plain image (not hand-drawn); labels are estimated`);
      }
      if (skipped.length) {
        window.__figures.warnings.push({ src, skipped });
        console.warn(`figure ${src}: unsupported parts dropped: ${skipped.join(', ')}`);
      }
      fig.prepend(await toSvg({ elements, files }));
      window.__figures.mermaid++;
    } catch (e) {
      figureError(fig, src, e);
    }
  }
}

async function renderExcalidraw() {
  for (const fig of document.querySelectorAll('[data-excalidraw]')) {
    try {
      const scene = JSON.parse(await fetchText(fig.dataset.excalidraw));
      fig.prepend(await toSvg({ elements: scene.elements, appState: scene.appState || {}, files: scene.files || {} }));
      window.__figures.excalidraw++;
    } catch (e) {
      figureError(fig, fig.dataset.excalidraw, e);
    }
  }
}

// 3. Fit: shrink or grow type in small steps until each page is full, never below the floor.
function overflowing(body) {
  return body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1;
}
function fillRatio(body) {
  const box = body.getBoundingClientRect();
  let used = 0;
  for (const el of body.children) {
    const r = el.getBoundingClientRect();
    used += r.width * r.height;
  }
  return Math.min(1, used / (box.width * box.height));
}
// Smallest computed font size (pt) of any element that owns visible text.
// Blind spots: text inside SVG figures and CSS ::before/::after content.
function minText(page) {
  let min = Infinity, at = '';
  for (const el of page.querySelectorAll('*')) {
    if (el.closest('svg, script, style, [hidden]')) continue;
    const owns = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!owns) continue;
    // Not rendered (display:none, or inside it) or invisible → never printed.
    if (el.getClientRects().length === 0 || getComputedStyle(el).visibility === 'hidden') continue;
    const pt = parseFloat(getComputedStyle(el).fontSize) * 0.75;
    if (pt < min) { min = pt; at = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''); }
  }
  // Diagram labels: an SVG is scaled to fit its box (default preserveAspectRatio
  // "meet"), so the printed size is font-size × min(width ratio, height ratio).
  for (const svg of page.querySelectorAll('svg.excalidraw-svg')) {
    const vb = svg.viewBox?.baseVal;
    const box = svg.getBoundingClientRect();
    if (!vb || !vb.width || !vb.height || !box.width || !box.height) continue;
    const scale = Math.min(box.width / vb.width, box.height / vb.height);
    for (const t of svg.querySelectorAll('text')) {
      if (!t.textContent.trim()) continue;
      const pt = parseFloat(t.getAttribute('font-size') || getComputedStyle(t).fontSize) * scale * 0.75;
      if (pt < min) { min = pt; at = `figure:${figureName(svg.closest('figure'))}`; }
    }
    // exportToSvg defines images once as <symbol><image/></symbol> and draws them via <use>.
    for (const use of svg.querySelectorAll('use')) {
      const ref = (use.getAttribute('href') || use.getAttribute('xlink:href') || '').slice(1);
      if (!ref || !svg.querySelector(`[id="${CSS.escape(ref)}"] image, image[id="${CSS.escape(ref)}"]`)) continue;
      const w = parseFloat(use.getAttribute('width'));
      const rendered = use.getBoundingClientRect().width;
      if (!w || !rendered) continue;
      const px = Number(svg.closest('figure')?.dataset.imageLabelPx) || IMAGE_LABEL_PX;
      const pt = px * (rendered / w) * 0.75;
      if (pt < min) { min = pt; at = `figure:${figureName(svg.closest('figure'))} (image, estimated)`; }
    }
  }
  return { minTextPt: Number.isFinite(min) ? +min.toFixed(2) : null, minTextAt: at, minTextFloorPt: floorPt(page) };
}

// The page's effective --min-text in pt (sheet.css can override it, which would
// silently disable every CSS floor rule).
function floorPt(page) {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--min-text)';
  page.appendChild(probe);
  const pt = parseFloat(getComputedStyle(probe).fontSize) * 0.75;
  probe.remove();
  return +pt.toFixed(2);
}

// 4. Balance: on grid pages, choose each card's span (see balance.js).
// Split into measure (cached) → plan (pure) → apply, so the S4 paginator can
// plan many candidate pages without re-measuring or touching the DOM.
const label = (el) => (el.querySelector('h2,h3,h4')?.textContent || el.className || el.tagName).trim().slice(0, 40);
const USABLE_FIXED = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);   // spans that have a CSS rule
const fixedSpanRaw = (el) => Number(/(?:^|\s)span-(\d+)(?:\s|$)/.exec(el.className)?.[1]) || null;
const fixedSpan = (el) => { const n = fixedSpanRaw(el); return USABLE_FIXED.has(n) ? n : null; };
const heightCache = new WeakMap();   // card → Map("fit|width" → px)

function gridContext(page, body) {
  const cs = getComputedStyle(body);
  const cols = Number(cs.getPropertyValue('--cols')) || L.cols;
  const g = parseFloat(cs.columnGap) || 0;
  const W = body.clientWidth;
  return {
    cols, gap: parseFloat(cs.rowGap) || g,
    fit: page.style.getPropertyValue('--fit'),
    width: (s) => ((W - 11 * g) * s) / 12 + (s - 1) * g,
  };
}

// Natural height of each card at each candidate span. Measured inside the page
// (section-scoped vars like --fig-max apply) but outside the grid; cached per scale.
function measureCards(page, cards, ctx) {
  const free = allowedSpans(ctx.cols);
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;';
  page.appendChild(host);
  try {
    return cards.map((card) => {
      const fixed = fixedSpan(card);
      let cache = heightCache.get(card);
      if (!cache) heightCache.set(card, (cache = new Map()));
      const heights = new Map();
      for (const s of fixed ? [fixed] : [...free, 12].filter((v, i, a) => a.indexOf(v) === i)) {
        const w = ctx.width(s);
        const key = `${ctx.fit}|${w.toFixed(1)}`;
        if (!cache.has(key)) {
          const clone = card.cloneNode(true);
          clone.style.removeProperty('grid-column');          // the balancer's own, never author styles
          for (const el of clone.querySelectorAll('[id]')) el.removeAttribute('id');
          clone.style.width = `${w}px`;
          host.replaceChildren(clone);
          cache.set(key, { h: clone.offsetHeight, wide: clone.scrollWidth > clone.clientWidth + 1 });
        }
        heights.set(s, cache.get(key));
      }
      // Too wide at every span (e.g. a long nowrap command): fall back to full width
      // rather than dropping balancing for the whole page.
      const anyFits = [...heights.values()].some((m) => !m.wide);
      return {
        fixed,
        heights: new Map([...heights].map(([s, m]) => [s, m.wide && (anyFits || s !== 12) ? Infinity : m.h])),
      };
    });
  } finally {
    host.remove();
  }
}

function planPage(page, body) {
  if (!body.classList.contains('layout-grid')) return { reason: 'not-grid' };
  if (page.dataset.balance === 'off') return { reason: 'off' };
  const all = [...body.children];
  if (all.some((c) => /(?:^|\s)rows-\d(?:\s|$)/.test(c.className))) return { reason: 'row-spans' };
  const bad = all.map(fixedSpanRaw).find((n) => n && !USABLE_FIXED.has(n));
  if (bad) return { reason: `fixed-span-${bad}` };
  const cards = all.filter((c) => getComputedStyle(c).display !== 'none');   // the grid skips these too
  if (!cards.length) return { reason: 'empty' };
  if (cards.length > MAX_BALANCE_CARDS) return { reason: 'too-many-cards' };  // before measuring
  const ctx = gridContext(page, body);
  const measured = measureCards(page, cards, ctx);
  // The stack must fit the page body; headroom under it counts as hollow (rows stretch to fill it).
  const opts = { gap: ctx.gap, maxHollow: L.maxHollow, maxHeight: body.clientHeight };
  let plan = planRows(measured, { cols: ctx.cols, ...opts });
  // Fixed spans the format's free widths can't complement: let free cards take any
  // width from 2 up (allowedSpans(6) = 2…12), measured on demand (cached).
  if (!plan) {
    const wide = { ...ctx, cols: 6 };
    plan = planRows(measureCards(page, cards, wide), { cols: wide.cols, ...opts });
  }
  if (!plan || plan.skipped) return { reason: plan?.skipped ?? 'no-partition' };
  return { cards, plan };
}

function applyPlan(body, { cards, plan }) {
  let changed = false;
  cards.forEach((card, i) => {
    if (fixedSpan(card)) return;
    const v = `span ${plan.spans[i]}`;
    if (card.style.gridColumn !== v) { card.style.gridColumn = v; changed = true; }
  });
  return changed;
}

function balancePage(page, body) {
  const t0 = performance.now();
  const r = planPage(page, body);
  if (!r.plan) return { applied: false, reason: r.reason, ms: Math.round(performance.now() - t0) };
  const changed = applyPlan(body, r);
  return { applied: true, changed, predictedPx: Math.round(r.plan.height), plannedHollow: r.plan.hollow,
    atScale: Number(page.style.getPropertyValue('--fit')), ms: Math.round(performance.now() - t0), cards: r.cards };
}

// Grid cards appear in source order when each starts at or after the previous (row-major).
function inSourceOrder(body) {
  const r = [...body.children].filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.getBoundingClientRect());
  return r.every((b, i) => !i || b.top > r[i - 1].top + 1 || (Math.abs(b.top - r[i - 1].top) <= 1 && b.left > r[i - 1].left));
}

// Void: empty regions big enough to notice. Rasterise the page body into 3 mm cells, mark the cells
// touched by content (text line boxes, figures, icons, images, each padded by one cell), then count
// every cell inside a fully empty 21 mm × 21 mm window. Gaps and padding stay under that size; hollow card bottoms, unused
// width beside short lines and air around a small figure do not. Share of the page body area.
function voidShare(page, body) {
  const box = body.getBoundingClientRect();
  if (!(box.width > 0 && box.height > 0)) return 0;
  const pxPerMm = page.getBoundingClientRect().width / L.widthMm;
  const cell = 3 * pxPerMm, win = 7, pad = 1;
  const cols = Math.ceil(box.width / cell), rows = Math.ceil(box.height / cell);
  const hit = new Uint8Array(cols * rows);
  const mark = (r) => {
    if (!(r.width > 0 && r.height > 0)) return;
    const c0 = Math.max(0, Math.floor((r.left - box.left) / cell) - pad), c1 = Math.min(cols - 1, Math.floor((r.right - box.left - 0.01) / cell) + pad);
    const r0 = Math.max(0, Math.floor((r.top - box.top) / cell) - pad), r1 = Math.min(rows - 1, Math.floor((r.bottom - box.top - 0.01) / cell) + pad);
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) hit[y * cols + x] = 1;
  };
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim() || n.parentElement.closest('svg, script, style, [hidden]')) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) mark(r);
  }
  for (const el of body.querySelectorAll('svg, img, canvas')) if (!el.parentElement.closest('svg')) mark(el.getBoundingClientRect());
  const isVoid = new Uint8Array(cols * rows);
  for (let y = 0; y + win <= rows; y++) for (let x = 0; x + win <= cols; x++) {
    let empty = true;
    for (let dy = 0; dy < win && empty; dy++) for (let dx = 0; dx < win; dx++) if (hit[(y + dy) * cols + x + dx]) { empty = false; break; }
    if (empty) for (let dy = 0; dy < win; dy++) for (let dx = 0; dx < win; dx++) isVoid[(y + dy) * cols + x + dx] = 1;
  }
  let v = 0;
  for (let i = 0; i < isVoid.length; i++) v += isVoid[i];
  return +(v / (cols * rows)).toFixed(3);
}

const stackHeight = (body, cards) =>
  Math.round(Math.max(...cards.map((c) => c.getBoundingClientRect().bottom)) - body.getBoundingClientRect().top);

// Hollow space: the part of a card's box below its last child (rows are stretched to the tallest
// card, so a short card next to a tall one ends in empty space). Measured on the final layout.
// Per card: slack = hollow height / card height. Per page: hollow area / total card area.
function hollowSpace(body) {
  let hollow = 0, area = 0;
  const slack = [...body.children].map((card) => {
    const r = card.getBoundingClientRect();
    if (!card.children.length || r.height <= 0) return 0;
    const pad = parseFloat(getComputedStyle(card).paddingBottom) || 0;
    const inner = Math.max(...[...card.children].map((k) => k.getBoundingClientRect().bottom)) - r.top + pad;
    const empty = Math.max(0, r.height - inner);
    hollow += empty * r.width;
    area += r.height * r.width;
    return +(empty / r.height).toFixed(3);
  });
  return { slack, hollow: area ? +(hollow / area).toFixed(3) : 0 };
}

window.__fitPages = (fit) => allPages().map((page, i) => {
  const body = page.querySelector('.page-body');
  const set = (v) => page.style.setProperty('--fit', v);
  // Start at the floor when the base size alone is under it (e.g. scale: 0.9 on A7).
  let scale = Math.min(Math.max(1, L.minScale), L.maxScale);
  set(scale);
  page.classList.add('measuring');          // grid rows at natural height while fitting

  const fitScale = () => {
    // Too full: shrink in 0.02 steps, never below the per-format floor.
    while (overflowing(body)) {
      const next = +(scale - 0.02).toFixed(2);
      if (next < L.minScale) break;
      set(scale = next);
    }
    // Sparse: grow until the next step would overflow, then keep the last value that fitted.
    if (!overflowing(body)) {
      for (;;) {
        const next = +(scale + 0.02).toFixed(2);
        if (next > L.maxScale + 1e-9) break;
        const prev = scale;
        set(scale = next);
        if (overflowing(body)) { set(scale = prev); break; }
      }
    }
  };

  // Balance at the start scale, fit, then re-balance at the fitted scale (heights change with type size).
  let balance = balancePage(page, body);
  if (fit) {
    fitScale();
    if (balance.applied && scale !== Number(balance.atScale ?? NaN)) {
      const again = balancePage(page, body);
      if (again.applied) {
        balance = { ...again, ms: balance.ms + again.ms };
        if (again.changed) fitScale();
      } else {
        // Keep the pass-1 layout (it is still on the page) and say why pass 2 didn't apply.
        balance = { ...balance, rebalance: again.reason, ms: balance.ms + again.ms };
      }
    }
  }
  // Hollow check: growing the type into a layout with half-empty cards is a bad trade. If the page
  // ends over the cap, step the type down (at most 5 steps of 0.02, never below the floor) and keep the
  // first scale whose layout is under the cap, or the least hollow one seen; otherwise stay put.
  const hollowNow = (b) => {
    const { hollow } = hollowSpace(body);
    const slack = b.applied && b.cards ? Math.max(0, body.clientHeight - stackHeight(body, b.cards)) / body.clientHeight : 0;
    return hollow + (1 - hollow) * slack;
  };
  if (fit && balance.applied && !overflowing(body) && hollowNow(balance) > L.maxHollow + 1e-9) {
    const start = scale;
    let best = { scale, hollow: hollowNow(balance), balance };
    for (let s = +(start - 0.02).toFixed(2); s >= Math.max(L.minScale, start - 0.1) - 1e-9; s = +(s - 0.02).toFixed(2)) {
      set(scale = s);
      const b = balancePage(page, body);
      if (!b.applied || overflowing(body)) continue;
      const h = hollowNow(b);
      if (h < best.hollow - 1e-6) best = { scale: s, hollow: h, balance: { ...b, ms: balance.ms + b.ms, stepped: +(start - s).toFixed(2) } };
      if (h <= L.maxHollow + 1e-9) break;
    }
    if (best.scale !== scale) { set(scale = best.scale); balancePage(page, body); }
    balance = best.balance;
  }
  const overflow = overflowing(body);
  const fill = fillRatio(body);
  if (balance.applied) {
    // Measured at the final scale; predictedPx is for atScale (the last planning scale).
    balance.actualPx = stackHeight(body, balance.cards);
  }
  delete balance.cards;
  page.classList.remove('measuring');
  if (body.classList.contains('layout-grid')) balance.inOrder = inSourceOrder(body);
  const box = body.getBoundingClientRect();
  const cut = overflow
    ? [...body.querySelectorAll(':scope > *')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > box.bottom + 1 || r.right > box.right + 1; })
        .map(label)
    : [];
  const { slack, hollow } = hollowSpace(body);
  const voidPct = voidShare(page, body);
  // span null = the CSS default (span 4) — the balancer did not set one.
  const cards = [...body.children].map((el, index) => ({
    index, id: el.id || el.dataset.id || null, label: label(el),
    span: fixedSpan(el) ?? (Number(/span (\d+)/.exec(el.style.gridColumn)?.[1]) || null),
    slack: slack[index],
  }));
  delete balance.changed;
  return { page: i + 1, scale, effectivePt: +(L.fontPt * scale).toFixed(2), ...minText(page), overflow, fill, hollow, void: voidPct, cut, balance, cards };
});

// 5. Pagination (content mode): pour the cards of a section[data-auto] into as many
// pages as needed. Runs after figures and fonts (heights are final) and decides
// "full" at the start scale; __fitPages then fine-tunes each page.
function newPageAfter(source, prev) {
  const page = document.createElement('section');
  for (const { name, value } of source.attributes) if (name !== 'data-header') page.setAttribute(name, value);
  prev.after(page);
  buildChrome(page, 1);    // never the first page → no header
  return page;
}

// Pour the cards into pages at `scale`; returns the page count.
function pour(source, cards, scale) {
  // Reset: everything back into the source page, continuation pages removed.
  for (const p of allPages()) if (p !== source && p.dataset.autoPage) p.remove();
  let page = source;
  let body = page.querySelector('.page-body');
  body.replaceChildren();
  const setup = (p) => { p.style.setProperty('--fit', scale); p.classList.add('measuring'); };
  setup(page);
  const grid = () => body.classList.contains('layout-grid');
  // Balance first (a card that is too tall at span 4 may fit wider), then test.
  const full = () => {
    if (grid()) {
      const r = planPage(page, body);
      if (r.plan) { applyPlan(body, r); return overflowing(body); }
      if (r.reason === 'too-many-cards') return true;
    }
    return overflowing(body);
  };
  for (const card of cards) {
    card.style.removeProperty('grid-column');   // spans from an earlier page/attempt don't apply here
    body.appendChild(card);
    if (full() && body.children.length > 1) {
      card.remove();
      // A banner (section heading) never ends a page: it travels with the card after it.
      const carry = [];
      while (body.children.length > 1 && body.lastElementChild.classList.contains('banner')) {
        const b = body.lastElementChild;
        b.remove();
        carry.unshift(b);
      }
      if (grid()) { const r = planPage(page, body); if (r.plan) applyPlan(body, r); }
      page = newPageAfter(source, page);
      page.dataset.autoPage = '1';
      body = page.querySelector('.page-body');
      setup(page);
      for (const b of carry) body.appendChild(b);
      body.appendChild(card);
      full();   // a card that overflows an empty page stays; __fitPages reports it
    }
  }
  return allPages().length;
}

function paginate() {
  const source = document.querySelector('section.page[data-auto]');
  if (!source) return null;
  const cards = [...source.querySelector('.page-body').children];
  const start = Math.min(Math.max(1, L.minScale), L.maxScale);
  // Try the natural scale first; if a pages: limit is exceeded, re-pour at smaller
  // scales down to the floor before giving up (the fit can shrink that far anyway).
  const limit = Number(meta.pages) || 0;
  let scale = start;
  let n = pour(source, cards, scale);
  while (limit && n > limit && scale > L.minScale) {
    scale = Math.max(L.minScale, +(scale - 0.04).toFixed(2));
    n = pour(source, cards, scale);
  }
  for (const p of allPages()) { p.classList.remove('measuring'); p.style.removeProperty('--fit'); }
  refreshFooters();
  return { scale, pages: n };
}

await renderMermaid();
await renderExcalidraw();
await document.fonts.ready;
// A pagination crash must not hang the build at the ready-wait: record it and go on.
try {
  window.__pagination = paginate();
} catch (e) {
  window.__pagination = { error: e?.message ?? String(e) };
  console.error(`pagination failed: ${window.__pagination.error}`);
}
window.__sheetReady = true;
