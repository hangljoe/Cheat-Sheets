#!/usr/bin/env node
// Render a cheat sheet folder to print-ready PDF + PNG previews.
//
//   node engine/render.mjs <slug[:variant] | path/to/sheet-dir> [--no-fit] [--no-png] [--open]
//
// A sheet folder holds sheet.yaml (meta) and either content.html (a flat list of
// cards, paginated automatically) or sheet.html (one <section class="page"> per page).
// `variants:` in sheet.yaml builds several formats from the same content into
// out/<slug>/<variant>/; without it, output lands in out/<slug>/. Exit codes:
// 0 ok · 1 a build failed · 2 overflow or more pages than `pages:` · 3 text under 6 pt ·
// 4 a figure failed. Across variants the most severe code wins, in that order (1, 2, 3, 4).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { buildSheet, exitCodeFor, pageUnreadable, floorOverridden, readMeta, checkMeta, safeRemove, combineExitCodes } from './lib/build.mjs';
import { MIN_PT } from './formats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('Usage: npm run build -- <slug[:variant]> [--no-fit] [--no-png] [--open]');
  process.exit(1);
}

// Resolve "slug[:variant]": an existing sheet/path wins as a whole (so a directory
// named "a:b" still works); otherwise split at the LAST colon. Drive letters only on Windows.
const exists = (t) => fs.existsSync(path.join(ROOT, 'sheets', t)) || fs.existsSync(path.resolve(t));
let base = target, only;
if (!exists(target)) {
  const i = target.lastIndexOf(':');
  const drive = process.platform === 'win32' && i === 1;
  if (i > 0 && !drive) [base, only] = [target.slice(0, i), target.slice(i + 1)];
}
const sheetDir = fs.existsSync(path.join(ROOT, 'sheets', base)) ? path.join(ROOT, 'sheets', base) : path.resolve(base);
const slug = path.basename(sheetDir);
const fail = (msg) => { console.error(msg); process.exit(1); };
if (!fs.existsSync(path.join(sheetDir, 'sheet.yaml'))) fail(`no sheet.yaml in ${path.relative(ROOT, sheetDir) || sheetDir}`);
const { variants, ...baseMeta } = readMeta(sheetDir);

// Variant names become directory names that are deleted recursively: only [\w-]+.
const SAFE = /^[\w-]+$/;
let jobs;
if (variants !== undefined) {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(variants) || !Object.keys(variants).length) fail('variants: must be a non-empty map of name → settings');
  const names = Object.keys(variants);
  const bad = names.find((n) => !SAFE.test(n));
  if (bad !== undefined) fail(`invalid variant name "${bad}" — use letters, digits, - and _ only`);
  const badEntry = names.find((n) => variants[n] !== null && !isObj(variants[n]));
  if (badEntry) fail(`variant "${badEntry}" must be a map, e.g. { format: A4, depth: 3 }`);
  if (only && !names.includes(only)) fail(`unknown variant "${only}" — valid: ${names.join(', ')}`);
  jobs = (only ? [only] : names).map((v) => ({
    meta: { ...baseMeta, ...(variants[v] ?? {}), variant: v },
    outDir: path.join(ROOT, 'out', slug, v),
    name: `${slug}-${v}`,
  }));
} else {
  if (only) fail(`${slug} has no variants`);
  jobs = [{ meta: baseMeta, outDir: path.join(ROOT, 'out', slug), name: slug }];
}

// Validate every variant before anything is deleted or built.
for (const job of jobs) {
  try { checkMeta(ROOT, job.meta); } catch (e) { fail(`${job.meta.variant ? `[${job.meta.variant}] ` : ''}${e.message}`); }
}
// A full build owns out/<slug>/ (removes stale variants); a single-variant build only its own dir.
if (variants && !only) safeRemove(ROOT, path.join(ROOT, 'out', slug));

const browser = await chromium.launch();
try {
  const codes = [];
  for (const job of jobs) {
    try {
      const report = await buildSheet({ root: ROOT, sheetDir, flags, browser, ...job });
      printReport(report);
      if (flags.has('--open') && process.platform === 'darwin') execFileSync('open', [path.join(ROOT, report.pdf)]);
      codes.push(exitCodeFor(report));
    } catch (e) {
      // One broken variant must not take the others down with it.
      console.error(`\n✗ ${job.name}: build failed — ${e.message}`);
      codes.push(1);
    }
  }
  process.exitCode = combineExitCodes(codes);
} finally {
  await browser.close();
}

function printReport(r) {
  if (r.iconsMissing.length) console.warn(`⚠ unknown icons (rendered empty): ${r.iconsMissing.join(', ')}`);
  for (const e of r.figures?.errors ?? []) console.warn(`⚠ figure failed: ${e.src}: ${e.message}`);
  for (const w of r.figures?.warnings ?? []) {
    console.warn(w.image
      ? `⚠ figure ${w.src}: rendered as a plain image (not hand-drawn) — consider a flowchart or the kit`
      : `⚠ figure ${w.src}: unsupported parts dropped (${w.skipped.join(', ')})`);
  }
  console.log(`\n${r.title}${r.variant ? ` [${r.variant}]` : ''} — ${r.format} ${r.landscape ? 'landscape' : 'portrait'}, ` +
    `depth ${r.depth} (${r.depthName}), theme ${r.theme}, ${r.pages.length} page(s)`);
  let problems = (r.figures?.errors?.length ?? 0) + r.iconsMissing.length, overridden = false;
  for (const p of r.pages) {
    const floorOff = floorOverridden(p);
    const tiny = pageUnreadable(p) && !floorOff;
    overridden ||= floorOff;
    const status = p.overflow ? '✗ OVERFLOW' : floorOff ? '✗ FLOOR OVERRIDDEN' : tiny ? `✗ TEXT < ${MIN_PT}pt`
      : p.fill < 0.55 ? '△ sparse' : '✓ fits';
    if (p.overflow || tiny || floorOff || p.fill < 0.55) problems++;
    console.log(`  page ${p.page}: ${status}  fill ${(p.fill * 100).toFixed(0)}%  scale ${p.scale.toFixed(2)}` +
      (p.minTextPt === null ? '  no measurable text' : `  min text ${p.minTextPt.toFixed(1)} pt`) +
      (p.overflow ? `  → cut off: ${p.cut.join(' | ')}` : '') +
      (floorOff ? `  → sheet.css sets --min-text to ${p.minTextFloorPt} pt` : '') +
      (tiny ? `  → smallest at ${p.minTextAt}` : ''));
  }
  if (r.requestedPages && r.auto && r.pages.length > r.requestedPages) {
    console.log(`  ✗ needs ${r.pages.length} pages (pages: ${r.requestedPages} in sheet.yaml) — trim, lower the depth, or allow more pages.`);
  } else if (r.requestedPages && r.requestedPages !== r.pages.length) {
    console.log(`  note: sheet.yaml asks for ${r.requestedPages} page(s), the sheet has ${r.pages.length}.`);
  }
  console.log(`  → ${r.pdf}`);
  const figureTiny = r.pages.some((p) => pageUnreadable(p) && String(p.minTextAt).startsWith('figure:'));
  if (r.figures?.errors?.length) console.log('  Fix: check the Mermaid syntax / file path of the failed figure(s) above.');
  if (overridden) console.log(`  Fix: remove the --min-text override from sheet.css (the floor is ${MIN_PT} pt).`);
  else if (figureTiny) console.log('  Fix: the diagram is scaled down too far — widen its card, raise --fig-max, cut nodes, or (if width-limited) switch LR → TD.');
  else if (problems > (r.figures?.errors?.length ?? 0) + r.iconsMissing.length) console.log('  Fix: trim or split content, enlarge tiny text, or add a page / go up a format.');
}
