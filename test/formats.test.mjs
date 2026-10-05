import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLayout, MIN_PT } from '../engine/formats.mjs';

test('A7 floor is raised so base text stays at 6 pt', () => {
  const l = resolveLayout({ format: 'A7', depth: 1 });
  assert.equal(l.minScale, MIN_PT / 6.4);
  assert.equal(l.minScale, 0.9375);
  assert.equal(l.maxScale, 1.25);
});

test('density shifts columns, type, gaps and capacity; balanced is the default', () => {
  const b = resolveLayout({ format: 'A4', depth: 3 });
  const d = resolveLayout({ format: 'A4', depth: 3, density: 'dense' });
  const v = resolveLayout({ format: 'A4', depth: 3, density: 'visual' });
  assert.equal(b.density, 'balanced');
  assert.deepEqual([b.cols, d.cols, v.cols], [4, 5, 3]);
  assert.ok(d.fontPt < b.fontPt && v.fontPt > b.fontPt);
  assert.ok(d.gapMm < b.gapMm && v.gapMm > b.gapMm);
  assert.ok(d.capacity > b.capacity && v.capacity < b.capacity);
  assert.ok(d.suggestedPages <= b.suggestedPages && v.suggestedPages >= b.suggestedPages);
  // dense never pushes the floor below 6 pt: minScale rises with the smaller base size
  assert.ok(d.minScale * d.fontPt >= MIN_PT - 1e-9);
  // columns never drop below 1
  assert.equal(resolveLayout({ format: 'A7', depth: 1, density: 'visual' }).cols, 1);
  assert.throws(() => resolveLayout({ format: 'A4', density: 'sparse' }), /Unknown density/);
});

test('A4 keeps the 0.86 floor (6/7.6 is lower)', () => {
  assert.equal(resolveLayout({ format: 'A4', depth: 3 }).minScale, 0.86);
});

test('a sheet min_scale above the floor wins', () => {
  assert.equal(resolveLayout({ format: 'A4', depth: 3, min_scale: 0.95 }).minScale, 0.95);
});

test('scale < 1 on A7 lifts the floor above 1', () => {
  const l = resolveLayout({ format: 'A7', depth: 1, scale: 0.9 });
  assert.ok(Math.abs(l.minScale - 6 / 5.76) < 1e-9);
  assert.ok(l.minScale > 1.04);
});

test('max_scale can never sit below the floor', () => {
  assert.equal(resolveLayout({ format: 'A4', depth: 3, max_scale: 0.8 }).maxScale, 0.86);
});

test('invalid input throws', () => {
  assert.throws(() => resolveLayout({ format: 'A9' }));
  assert.throws(() => resolveLayout({ format: 'A4', depth: 6 }));
});

test('orientation defaults: A6/A7 portrait, A4 landscape', () => {
  assert.equal(resolveLayout({ format: 'A7' }).landscape, false);
  assert.equal(resolveLayout({ format: 'A6' }).landscape, false);
  assert.equal(resolveLayout({ format: 'A4' }).landscape, true);
});
