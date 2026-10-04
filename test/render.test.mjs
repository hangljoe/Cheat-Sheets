import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildFixture, assertReadable } from './helpers.mjs';

const mm = (pt) => (pt * 25.4) / 72;

test('fits: exit 0, exact A5 landscape PDF, post-boot snapshot', async () => {
  const { code, report, outDir } = buildFixture('fits');
  assert.equal(code, 0);
  assert.ok(report.pages.every((p) => p.overflow === false));
  assertReadable(report);
  const pdf = await PDFDocument.load(fs.readFileSync(path.join(outDir, 'fits.pdf')));
  const page = pdf.getPage(0);
  assert.ok(Math.abs(mm(page.getWidth()) - 210) < 0.5, `width ${mm(page.getWidth())}`);
  assert.ok(Math.abs(mm(page.getHeight()) - 148) < 0.5, `height ${mm(page.getHeight())}`);
  const html = fs.readFileSync(path.join(outDir, 'fits.html'), 'utf8');
  assert.match(html, /class="page-body/);
  assert.doesNotMatch(html, /client\/boot\.js/);
});

test('overflow-a7: exit 2, shrink stops at the A7 floor, small components still >= 6 pt', () => {
  const { code, report } = buildFixture('overflow-a7');
  assert.equal(code, 2);
  assert.equal(report.pages[0].overflow, true);
  assert.ok(report.pages[0].scale >= 0.94, `scale ${report.pages[0].scale}`);
  assertReadable(report);
});

test('missing-icon: unknown icon is reported', () => {
  const { report } = buildFixture('missing-icon');
  assert.deepEqual(report.iconsMissing, ['definitely-not-an-icon']);
  assertReadable(report);
});

test('scaled-a7: start scale lifts base to 6 pt; bare <small> and <h6> are floored', () => {
  const { code, report } = buildFixture('scaled-a7');
  assert.equal(code, 0);
  assert.ok(report.pages[0].scale >= 1.04, `scale ${report.pages[0].scale}`);
  assertReadable(report);
});

test('scaled-a7-full: overflowing scaled sheet never drops below the floor', () => {
  const { code, report } = buildFixture('scaled-a7-full');
  assert.equal(code, 2);
  assert.equal(report.pages[0].overflow, true);
  assert.ok(report.pages[0].scale >= 1.0416, `scale ${report.pages[0].scale}`);
  assertReadable(report);
});

test('tiny-text: author CSS under 6 pt fails the build with exit 3', () => {
  const { code, report } = buildFixture('tiny-text');
  assert.equal(code, 3);
  assert.ok(report.pages[0].minTextPt < 4.5, `minTextPt ${report.pages[0].minTextPt}`);
  assert.match(report.pages[0].minTextAt, /tiny/);
});

test('figure-only: a page without measurable text is not a failure', () => {
  const { code, report } = buildFixture('figure-only');
  assert.equal(code, 0);
  assert.equal(report.pages[0].minTextPt, null);
});

test('hidden-tiny: display:none text is never printed, so it does not fail the build', () => {
  const { code, report } = buildFixture('hidden-tiny');
  assert.equal(code, 0);
  assertReadable(report);
});

test('floor-override: lowering --min-text in sheet.css fails the build with exit 3', () => {
  const { code, report } = buildFixture('floor-override');
  assert.equal(code, 3);
  assert.equal(report.pages[0].minTextFloorPt, 2);
});

test('capped: max_scale below 1 is honoured even when the page fits', () => {
  const { code, report } = buildFixture('capped');
  assert.equal(code, 0);
  assert.equal(report.pages[0].scale, 0.9);
  assertReadable(report);
});
