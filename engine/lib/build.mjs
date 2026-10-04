// Build one sheet: HTML document → headless Chromium → fit → PDF, PNGs,
// a debug snapshot of the booted page, and report.json.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { resolveLayout, MIN_PT } from '../formats.mjs';
import { inlineIcons } from '../icons.mjs';
import { startServer } from './server.mjs';
import { ensureMermaidBundle } from './vendor.mjs';

// Remove every module script the engine injected (boot.js today, more later) so a
// saved snapshot can never boot twice. Other scripts (e.g. inline Mermaid) stay.
export function stripEngineScripts(html) {
  return html.replace(/<script\b[^>]*\bsrc="\/engine\/[^"]*"[^>]*><\/script>/g, '');
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// content.html is a flat list of cards; boot.js paginates it (section[data-auto]).
// page_style (sheet.yaml or variant) carries section-level CSS vars, e.g. "--fig-max: 30mm".
export function contentPage(meta, content) {
  const attrs = [`data-layout="${esc(meta.layout || 'grid')}"`];
  if (meta.balance === false) attrs.push('data-balance="off"');
  if (meta.page_style) attrs.push(`style="${esc(meta.page_style)}"`);
  return `<section class="page" data-auto ${attrs.join(' ')}>\n${content}\n</section>`;
}

// Throws on settings that would fail mid-build (checked for every variant up front).
export function checkMeta(root, meta) {
  resolveLayout(meta);
  const theme = meta.theme || 'studio';
  if (!fs.existsSync(path.join(root, 'engine/styles/themes', `${theme}.css`))) {
    throw new Error(`Unknown theme "${theme}". See engine/styles/themes/.`);
  }
}

// Recursive delete, but only strictly inside <root>/out/.
export function safeRemove(root, dir) {
  const out = path.join(root, 'out') + path.sep;
  const target = path.resolve(dir);
  if (!target.startsWith(out)) throw new Error(`refusing to delete ${target}: not inside ${out}`);
  fs.rmSync(target, { recursive: true, force: true });
}

// Exit-code precedence across variants: a crash, then overflow/pages, then text, then figures.
const SEVERITY = [1, 2, 3, 4];
export function combineExitCodes(codes) {
  for (const c of SEVERITY) if (codes.includes(c)) return c;
  return 0;
}

export function readMeta(sheetDir) {
  return YAML.parse(fs.readFileSync(path.join(sheetDir, 'sheet.yaml'), 'utf8'));
}

export function sheetDocument({ root, sheetDir, meta, layout, theme, body }) {
  const rel = (p) => '/' + path.relative(root, p).split(path.sep).join('/');
  return `<!doctype html>
<html lang="${esc(meta.lang || 'en')}">
<head>
<meta charset="utf-8">
<title>${esc(meta.title)}</title>
<base href="${rel(sheetDir)}/">
<link rel="stylesheet" href="/engine/styles/fonts.css">
<link rel="stylesheet" href="/engine/styles/base.css">
<link rel="stylesheet" href="/engine/styles/themes/${theme}.css">
${fs.existsSync(path.join(sheetDir, 'sheet.css')) ? '<link rel="stylesheet" href="sheet.css">' : ''}
<style>
  @page { size: ${layout.widthMm}mm ${layout.heightMm}mm; margin: 0; }
  :root {
    --pw: ${layout.widthMm}mm; --ph: ${layout.heightMm}mm;
    --margin: ${layout.marginMm}mm; --gap: ${layout.gapMm}mm;
    --cols: ${layout.cols}; --base: ${layout.fontPt}pt; --min-text: ${MIN_PT}pt;
    ${meta.accent ? `--accent: ${meta.accent};` : ''}
  }
</style>
</head>
<body class="fmt-${layout.format} ${layout.landscape ? 'landscape' : 'portrait'} depth-${layout.depth}">
<script type="application/json" id="sheet-meta">${JSON.stringify({ ...meta, layout }).replace(/</g, '\\u003c')}</script>
${body}
<script type="module" src="/engine/client/boot.js"></script>
</body>
</html>`;
}

// meta / html default to sheetDir's sheet.yaml / sheet.html; callers that build
// variants pass their own (merged meta, generated pages) without touching disk.
export async function buildSheet({ root, sheetDir, outDir, name, meta: metaIn, html: htmlIn, flags = new Set(), browser }) {
  const meta = metaIn ?? readMeta(sheetDir);
  checkMeta(root, meta);
  const layout = resolveLayout(meta);
  const theme = meta.theme || 'studio';

  const iconPool = meta.icon ? `\n<div id="icon-pool" hidden><span data-name="${meta.icon}"><i data-icon="${meta.icon}"></i></span></div>` : '';
  const hasPages = fs.existsSync(path.join(sheetDir, 'sheet.html'));
  const hasContent = fs.existsSync(path.join(sheetDir, 'content.html'));
  if (!htmlIn && hasPages && hasContent) {
    throw new Error('both sheet.html and content.html exist — keep one (content.html for automatic pages)');
  }
  const auto = !htmlIn && hasContent;
  const source = htmlIn ?? (auto ? contentPage(meta, fs.readFileSync(path.join(sheetDir, 'content.html'), 'utf8'))
    : fs.readFileSync(path.join(sheetDir, 'sheet.html'), 'utf8'));
  const { html: body, missing } = inlineIcons(source + iconPool, root);
  const bundleErrors = [];
  if (source.includes('data-mermaid')) {
    // A bundler failure must not abort the build; the browser then reports each figure.
    try { await ensureMermaidBundle(root); } catch (e) { bundleErrors.push({ src: 'vendor bundle', message: e.message }); }
  }
  const doc = sheetDocument({ root, sheetDir, meta, layout, theme, body });

  safeRemove(root, outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const server = await startServer(root, new Map([['/__sheet', doc]]));
  const pxPerMm = 96 / 25.4;
  const page = await browser.newPage({
    viewport: { width: Math.ceil(layout.widthMm * pxPerMm), height: Math.ceil(layout.heightMm * pxPerMm) },
    deviceScaleFactor: 2,
  });
  try {
    page.on('console', (m) => {
      if (!['error', 'warning'].includes(m.type()) || /subsetting|Worker/.test(m.text())) return;
      console.warn(`  [page] ${m.text()}`);
    });
    page.on('pageerror', (e) => console.warn(`  [page error] ${e.message}`));
    await page.goto(`${server.base}/__sheet`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__sheetReady === true, null, { timeout: 60000 });
    const pages = await page.evaluate((fit) => window.__fitPages(fit), !flags.has('--no-fit'));
    const figures = await page.evaluate(() => window.__figures);
    const { pagination, tierErrors } = await page.evaluate(() => ({ pagination: window.__pagination ?? null, tierErrors: window.__tierErrors ?? [] }));
    if (pagination?.error) throw new Error(`pagination failed: ${pagination.error}`);
    figures.errors.unshift(...bundleErrors);

    // Debug snapshot of the booted DOM. Boot script and meta are stripped so it can
    // never boot twice; asset URLs point at the (now closed) build server.
    const snapshot = stripEngineScripts(await page.content())
      .replace(/<script type="application\/json" id="sheet-meta">[\s\S]*?<\/script>/, '')
      .replace(/(href|src)="\//g, `$1="${server.base}/`);
    fs.writeFileSync(path.join(outDir, `${name}.html`), snapshot);

    await page.pdf({ path: path.join(outDir, `${name}.pdf`), width: `${layout.widthMm}mm`, height: `${layout.heightMm}mm`,
      printBackground: true, preferCSSPageSize: true });
    if (!flags.has('--no-png')) {
      const els = await page.$$('section.page');
      for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(outDir, `page-${i + 1}.png`) });
    }

    const report = {
      title: meta.title, format: layout.format, landscape: layout.landscape, depth: layout.depth,
      depthName: layout.depthName, theme, basePt: layout.fontPt, minScale: layout.minScale,
      requestedPages: meta.pages ? Number(meta.pages) : null, auto, variant: meta.variant ?? null,
      paginateScale: pagination?.scale ?? null, tierErrors,
      pages, figures, iconsMissing: [...new Set(missing)],
      pdf: path.relative(root, path.join(outDir, `${name}.pdf`)),
    };
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    return report;
  } finally {
    await page.close();
    await server.close();
  }
}

// A page is unreadable when its base size, its smallest measured text, or its CSS
// floor (--min-text, overridable in sheet.css) is under MIN_PT. minTextPt === null
// means the page has no measurable text (e.g. figures only) — that is not a failure.
// A missing minTextFloorPt fails like a missing minTextPt: boot.js always emits it.
// effectivePt can't drop below MIN_PT in a real build (minScale guarantees it); the
// check stays as a guard on that invariant.
export function pageUnreadable(p) {
  return !(p.effectivePt >= MIN_PT)
    || (p.minTextPt !== null && !(p.minTextPt >= MIN_PT))
    || !(p.minTextFloorPt >= MIN_PT);
}

export function floorOverridden(p) {
  return !(p.minTextFloorPt >= MIN_PT);
}

// 0 = ok, 2 = a page overflows, 3 = text under the readability floor,
// 4 = a figure failed to render (the PDF shows a ⚠ tile in its place).
export function exitCodeFor(report) {
  if (report.pages.some((p) => p.overflow)) return 2;
  if (report.auto && report.requestedPages && report.pages.length > report.requestedPages) return 2;
  if (report.pages.some(pageUnreadable)) return 3;
  if (report.figures?.errors?.length) return 4;
  return 0;
}
