#!/usr/bin/env node
// Scaffold a sheet folder.
//
//   npm run new -- <slug> [--title "..."] [--format A5] [--orientation portrait] [--depth 2]
//                         [--pages 1] [--theme sketch] [--icon book-open] [--variant main] [--pages-mode]
//
// Default: content mode — content.html (a flat list of cards, paginated automatically)
// plus a `variants:` block in sheet.yaml; add more formats as more lines there.
// --pages-mode: the explicit sheet.html with one <section class="page"> per page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { resolveLayout } from './formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOOLEAN = new Set(['pages-mode']);
const [slug, ...rest] = process.argv.slice(2);
if (!slug || slug.startsWith('--')) { console.error('Usage: npm run new -- <slug> [--format A4] [--depth 3] ...'); process.exit(1); }
const opt = {};
for (let i = 0; i < rest.length; i++) {
  const key = rest[i].replace(/^--/, '');
  if (BOOLEAN.has(key)) opt[key] = true;
  else opt[key] = rest[++i];
}

const format = (opt.format || 'A4').toUpperCase();
const variant = {
  format,
  orientation: opt.orientation || (['A6', 'A7'].includes(format) ? 'portrait' : 'landscape'),
  depth: Number(opt.depth || 3),
  theme: opt.theme || 'studio',
};
const layout = resolveLayout(variant);
const pages = Number(opt.pages || layout.suggestedPages);
const base = {
  title: opt.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  subtitle: opt.subtitle || '',
  icon: opt.icon || 'sparkles',
};

const dir = path.join(ROOT, 'sheets', slug);
if (fs.existsSync(dir)) { console.error(`sheets/${slug} already exists.`); process.exit(1); }
fs.mkdirSync(path.join(dir, 'diagrams'), { recursive: true });

if (opt['pages-mode']) {
  fs.writeFileSync(path.join(dir, 'sheet.yaml'), YAML.stringify({ ...base, ...variant, pages }));
  const page = (i) => `<section class="page" data-layout="grid">
  <div class="card">
    <h2><i data-icon="sparkles"></i>Section ${i}</h2>
    <ul class="dots"><li>Point</li></ul>
  </div>
</section>`;
  fs.writeFileSync(path.join(dir, 'sheet.html'), Array.from({ length: pages }, (_, i) => page(i + 1)).join('\n\n') + '\n');
} else {
  const name = opt.variant || 'main';
  fs.writeFileSync(path.join(dir, 'sheet.yaml'), YAML.stringify({ ...base, variants: { [name]: { ...variant, pages } } }));
  fs.writeFileSync(path.join(dir, 'content.html'), `<!-- One card per idea. data-tier="N" = the smallest depth that shows it (1 = always). -->
<div class="card" data-tier="1">
  <h2><i data-icon="lightbulb"></i>Core idea</h2>
  <p class="big">The one sentence to <em>remember</em>.</p>
</div>
<div class="card" data-tier="1">
  <h2><i data-icon="list-checks"></i>Must know</h2>
  <ul class="dots"><li>First essential</li><li>Second essential</li><li data-tier="3">A detail for deeper sheets</li></ul>
</div>
<div class="card" data-tier="2">
  <h2><i data-icon="triangle-alert"></i>Pitfalls</h2>
  <div class="callout warn"><i data-icon="triangle-alert"></i><p><b>Watch out</b> for this.</p></div>
</div>
`);
}
console.log(`Created sheets/${slug}/ — ${opt['pages-mode'] ? 'explicit pages' : 'content mode'}, ${format} ${variant.orientation}, ` +
  `depth ${variant.depth} (${layout.depthName}), ${pages} page(s), ${layout.cols} columns, theme ${variant.theme}.`);
