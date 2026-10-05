import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAll, buildFixture, runRender, assertReadable, ROOT } from './helpers.mjs';

const ids = (report) => report.pages.flatMap((p) => p.cards.map((c) => c.id));
const snapshot = (dir, v, name = 'topic') => fs.readFileSync(path.join(dir, v, `${name}-${v}.html`), 'utf8');

test('one content.html builds every variant; depth filters cards and nested rows', () => {
  const { code, reports, outDir } = buildAll('topic');
  assert.deepEqual(Object.keys(reports).sort(), ['big', 'small', 'tight']);
  assert.equal(code, 2, 'tight asks for 1 page but needs more');

  assert.deepEqual(ids(reports.small), ['c1', 'c2']);
  assert.doesNotMatch(snapshot(outDir, 'small'), /Tier three detail/);
  assert.match(snapshot(outDir, 'small'), /Always shown/);
  assert.deepEqual(ids(reports.big), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']);
  assert.match(snapshot(outDir, 'big'), /Tier three detail/);
  for (const v of ['small', 'big']) assertReadable(reports[v]);
});

test('data-variants keeps an element only in the named variants', () => {
  const { reports } = buildAll('variant-only');
  assert.deepEqual(ids(reports.a), ['c1', 'c2']);
  assert.deepEqual(ids(reports.b), ['c1', 'c3']);
});

test('pagination respects pages:, numbers footers, and carries page_style to every page', () => {
  const { reports, outDir } = buildAll('topic');
  const tight = reports.tight;
  assert.ok(tight.auto);
  assert.ok(tight.pages.length > 1, `pages ${tight.pages.length}`);
  assert.deepEqual(ids(tight), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'], 'cards lost or reordered across pages');
  const html = snapshot(outDir, 'tight');
  const n = tight.pages.length;
  for (let i = 1; i <= n; i++) assert.match(html, new RegExp(`>${i}/${n}<`));
  const sections = html.match(/<section class="page"[^>]*>/g);
  assert.equal(sections.length, n);
  assert.ok(sections.every((s) => /--fig-max: 30mm/.test(s)), 'page_style missing on a continuation page');
  assert.equal((html.match(/class="sheet-head"/g) || []).length, 1, 'header only on page 1');
});

test('slug:variant builds only that variant; unknown variants fail clearly', () => {
  fs.rmSync(path.join(ROOT, 'out', 'topic-one'), { recursive: true, force: true });
  const one = runRender('topic-one:small', []);
  assert.equal(one.code, 0);
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'out', 'topic-one')), ['small']);
  // A single-variant build must not wipe its siblings.
  assert.equal(runRender('topic-one:big', []).code, 0);
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'out', 'topic-one')).sort(), ['big', 'small']);
  const bad = runRender('topic-one:nope', []);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /unknown variant "nope" — valid: small, big, tight/);
});

test('a figure card that does not fit page 1 moves to page 2 with its diagram', () => {
  const { code, report } = buildFixture('topic-figure');
  assert.equal(code, 0);
  assert.ok(report.auto);
  assert.ok(report.pages.length >= 2);
  assert.ok(!report.pages[0].cards.some((c) => c.id === 'fig'), 'diagram stayed on the full page 1');
  assert.ok(report.pages.slice(1).some((p) => p.cards.some((c) => c.id === 'fig')));
  assert.equal(report.figures.mermaid, 1);
  assert.deepEqual(report.figures.errors, []);
  assertReadable(report);
});
