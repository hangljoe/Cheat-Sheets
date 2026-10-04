import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture, assertReadable } from './helpers.mjs';

test('balance: the balancer picks spans so the page fits, in source order', () => {
  const { code, report } = buildFixture('balance');
  const p = report.pages[0];
  assert.equal(code, 0);
  assert.equal(p.overflow, false);
  assert.equal(p.balance.applied, true);
  assert.equal(p.balance.inOrder, true);
  assert.ok(new Set(p.cards.map((c) => c.span)).size >= 2, `spans ${p.cards.map((c) => c.span)}`);
  assert.deepEqual(p.cards.map((c) => c.label), ['Long list A', 'Tiny 1', 'Tiny 2', 'Long list B', 'Tiny 3', 'Tiny 4', 'Figure']);
  // Every row is full: spans sum to a multiple of 12.
  assert.equal(p.cards.reduce((s, c) => s + c.span, 0) % 12, 0);
  // The measuring host must reproduce the real layout (fonts, --fig-max on the section and card, …).
  const err = Math.abs(p.balance.predictedPx - p.balance.actualPx) / p.balance.actualPx;
  assert.ok(err < 0.02, `predicted ${p.balance.predictedPx}px vs actual ${p.balance.actualPx}px`);
  // Hollow space is reported per page and per card, as a share in [0, 1].
  assert.ok(p.hollow >= 0 && p.hollow <= 1, `hollow ${p.hollow}`);
  assert.ok(p.cards.every((c) => c.slack >= 0 && c.slack <= 1));
  assertReadable(report);
});

test('balance-off: same content with data-balance="off" keeps default spans and overflows', () => {
  const { code, report } = buildFixture('balance-off');
  const p = report.pages[0];
  assert.equal(code, 2);
  assert.equal(p.balance.reason, 'off');
  assert.ok(p.cards.every((c) => c.span === null));
});

test('balance-rows: pages with rows-N cards are left as authored', () => {
  const { report } = buildFixture('balance-rows');
  const p = report.pages[0];
  assert.equal(p.balance.applied, false);
  assert.equal(p.balance.reason, 'row-spans');
  assert.ok(p.cards.every((c) => c.span === null));
});

test('balance-dense: the order check catches grid backfilling (author spans, balancer off)', () => {
  const { report } = buildFixture('balance-dense');
  assert.equal(report.pages[0].balance.inOrder, false);
});

test('balance-span11: an unusable fixed span is reported, not silently ignored', () => {
  const { report } = buildFixture('balance-span11');
  assert.equal(report.pages[0].balance.reason, 'fixed-span-11');
});

test('balance-wide: one too-wide card falls back to full width; hidden children are left out', () => {
  const { report } = buildFixture('balance-wide');
  const p = report.pages[0];
  assert.equal(p.balance.applied, true);
  const byLabel = Object.fromEntries(p.cards.map((c) => [c.label, c.span]));
  assert.equal(byLabel['Long command'], 12);
  assert.equal(byLabel.Hidden, null);
});

test('balance-fixed: a fixed half-width card on a one-column format still balances', () => {
  const { report } = buildFixture('balance-fixed');
  const p = report.pages[0];
  assert.equal(p.balance.applied, true);
  assert.deepEqual(p.cards.map((c) => c.span), [6, 6]);
});

test('flow pages carry no grid order verdict', () => {
  const { report } = buildFixture('hidden-tiny');
  assert.equal(report.pages[0].balance.reason, 'not-grid');
  assert.equal(report.pages[0].balance.inOrder, undefined);
});
