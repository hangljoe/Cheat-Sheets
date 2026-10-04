import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildFixture, assertReadable } from './helpers.mjs';

test('mermaid: inline + file figures render; the broken one is reported and exits 4', () => {
  const { code, report, outDir } = buildFixture('mermaid');
  assert.equal(code, 4);
  assertReadable(report);
  // flowchart (inline), sequence (file), class, pie (image fallback) = 4; excalidraw file = 1
  assert.equal(report.figures.mermaid, 4);
  assert.equal(report.figures.excalidraw, 1);
  assert.equal(report.figures.errors.length, 1);
  assert.match(report.figures.errors[0].src, /^mermaid #5$/);
  assert.deepEqual(report.figures.warnings.map((w) => w.src), ['mermaid #3', 'mermaid #4']); // class + pie → image

  const html = fs.readFileSync(path.join(outDir, 'mermaid.html'), 'utf8');
  assert.equal((html.match(/class="excalidraw-svg/g) || []).length, 5);
  assert.match(html, /<image\b/, 'image fallback (pie/class) lost its file data');
  assert.match(html, /class="fig-error"/);
  assert.doesNotMatch(html, /src="[^"]*\/engine\/client\//);
});

test('tiny-diagram: a wide flowchart squeezed into a small card fails the 6 pt gate', () => {
  const { code, report } = buildFixture('tiny-diagram');
  assert.equal(code, 3);
  assert.ok(report.pages[0].minTextPt < 6, `minTextPt ${report.pages[0].minTextPt}`);
  assert.equal(report.pages[0].minTextAt, 'figure:mermaid #1');
});

test('tall-diagram: a height-limited figure is measured by its real (meet) scale', () => {
  const { code, report } = buildFixture('tall-diagram');
  assert.equal(code, 3);
  assert.equal(report.pages[0].minTextAt, 'figure:mermaid #1');
});

test('missing-figure: a wrong path reports the HTTP status, not a parse error', () => {
  const { code, report } = buildFixture('missing-figure');
  assert.equal(code, 4);
  assert.match(report.figures.errors[0].message, /404 fetching diagrams\/nope\.mmd/);
});

test('tiny-pie: labels inside an image fallback are measured too', () => {
  const { code, report } = buildFixture('tiny-pie');
  assert.equal(code, 3);
  assert.match(report.pages[0].minTextAt, /^figure:mermaid #1 \(image, estimated\)$/);
});

test('twin-figures: the same scene twice on a page never shares DOM ids', () => {
  const { code, outDir } = buildFixture('twin-figures');
  assert.equal(code, 0);
  const html = fs.readFileSync(path.join(outDir, 'twin-figures.html'), 'utf8');
  const svgs = html.match(/<svg[^>]*excalidraw-svg[\s\S]*?<\/svg>/g) || [];
  assert.equal(svgs.length, 2);
  const ids = svgs.flatMap((s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(ids.length > 0, 'expected ids inside the exported SVGs');
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids across figures');
});
