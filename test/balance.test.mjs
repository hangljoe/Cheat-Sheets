import test from 'node:test';
import assert from 'node:assert/strict';
import { planRows, allowedSpans, MAX_BALANCE_CARDS } from '../engine/client/balance.js';

const card = (heights, fixed = null) => ({ fixed, heights: new Map(Object.entries(heights).map(([k, v]) => [Number(k), v])) });

test('(a) three cards fit one row: [4,4,4] at 100 beats 6+6/12 (120) and 12×3 (170)', () => {
  const cards = [0, 1, 2].map(() => card({ 4: 100, 6: 60, 12: 50 }));
  const r = planRows(cards, { cols: 3, gap: 10 });
  assert.deepEqual(r.spans, [4, 4, 4]);
  assert.equal(r.height, 100);
});

test('(b) a fixed span-8 card leaves 4 for its neighbour', () => {
  const r = planRows([card({ 8: 50 }, 8), card({ 4: 80, 6: 60, 12: 40 })], { cols: 3 });
  assert.deepEqual(r.spans, [8, 4]);
});

test('(c) Infinity and missing spans are never chosen', () => {
  const r = planRows([card({ 3: Infinity, 6: 50, 9: 40 }), card({ 3: 30, 6: 60, 9: 40 })], { cols: 4 });
  assert.ok(!r.spans.includes(4));
  assert.notEqual(r.spans[0], 3);
});

test('(d) fixed spans that cannot complete a row → null', () => {
  assert.equal(planRows([card({ 5: 10 }, 5), card({ 5: 10 }, 5), card({ 5: 10 }, 5)], { cols: 3 }), null);
});

test('(e) cost budget: 31 cards skipped, 30 balanced', () => {
  const many = (n) => Array.from({ length: n }, () => card({ 4: 50, 6: 40, 12: 30 }));
  assert.deepEqual(planRows(many(MAX_BALANCE_CARDS + 1), { cols: 3 }), { skipped: 'too-many-cards' });
  assert.equal(planRows(many(MAX_BALANCE_CARDS), { cols: 3 }).spans.length, MAX_BALANCE_CARDS);
});

test('(f) equal height → the layout with less wasted area wins', () => {
  // [4,8] is enumerated first: heights (100,40), waste 60·8 = 480. [6,6]: heights (100,100), waste 0.
  // Both stack 100 high, so only the waste tie-break can prefer [6,6].
  const cards = [card({ 4: 100, 6: 100 }), card({ 8: 40, 6: 100 })];
  const r = planRows(cards, { cols: 3 });
  assert.equal(r.height, 100);
  assert.deepEqual(r.spans, [6, 6]);
  assert.equal(r.waste, 0);
});

test('allowed spans follow the format columns', () => {
  assert.deepEqual(allowedSpans(3), [4, 5, 6, 7, 8, 9, 10, 12]);
  assert.deepEqual(allowedSpans(1), [12]);
  assert.ok(allowedSpans(6).includes(2));
});

test('rows report card indices in source order', () => {
  const cards = [0, 1, 2, 3].map(() => card({ 6: 50, 12: 80 }));
  const r = planRows(cards, { cols: 2 });
  assert.deepEqual(r.rows.flat(), [0, 1, 2, 3]);
});

test('(g) a fixed span below the format minimum is still honoured (span-2 at cols 4)', () => {
  const r = planRows([card({ 2: 40 }, 2), card({ 4: 50, 6: 40, 10: 30, 12: 20 })], { cols: 4 });
  assert.deepEqual(r.spans, [2, 10]);
});

test('free cards never take a span below the format minimum', () => {
  const r = planRows([card({ 2: 10, 4: 50, 12: 30 }), card({ 2: 10, 4: 50, 12: 30 }), card({ 2: 10, 4: 50, 8: 40, 12: 30 })], { cols: 3 });
  assert.ok(r.spans.every((s) => s >= 4), String(r.spans));
});
