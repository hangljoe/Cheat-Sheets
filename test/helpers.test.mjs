import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReadable } from './helpers.mjs';

test('assertReadable rejects small measured text', () => {
  assert.throws(() => assertReadable({ pages: [{ page: 1, effectivePt: 6.2, minTextPt: 5.9 }] }));
});

test('assertReadable rejects a small base size', () => {
  assert.throws(() => assertReadable({ pages: [{ page: 1, effectivePt: 5.9, minTextPt: 6.1 }] }));
});

test('assertReadable rejects missing measurements', () => {
  assert.throws(() => assertReadable({ pages: [{ page: 1, effectivePt: 7 }] }));
});

test('assertReadable accepts exactly 6 pt', () => {
  assertReadable({ pages: [{ page: 1, effectivePt: 6, minTextPt: 6 }] });
});
