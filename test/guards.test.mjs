import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runRender, buildFixture, ROOT } from './helpers.mjs';
import { combineExitCodes, safeRemove } from '../engine/lib/build.mjs';

test('a variant name that escapes out/ is refused before anything is deleted', () => {
  const sentinel = path.join(ROOT, 'out', 'zz-sentinel.txt');
  fs.mkdirSync(path.dirname(sentinel), { recursive: true });
  fs.writeFileSync(sentinel, 'keep me');
  const r = runRender('evil-variant', []);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /invalid variant name "\.\."/);
  assert.ok(fs.existsSync(sentinel), 'out/ was wiped');
  fs.rmSync(sentinel);
});

// SANDBOXED: safeRemove is only ever exercised against a throwaway temp root —
// never the repository (a guard test must stay harmless when the guard is broken).
test('safeRemove deletes inside <root>/out/ and refuses everything else', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-safe-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'out', 'x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'keep.txt'), 'keep');
  assert.throws(() => safeRemove(root, path.join(root, 'out', '..')), /refusing to delete/);
  assert.throws(() => safeRemove(root, path.join(root, 'out')), /refusing to delete/);
  assert.ok(fs.existsSync(path.join(root, 'keep.txt')));
  safeRemove(root, path.join(root, 'out', 'x'));
  assert.ok(!fs.existsSync(path.join(root, 'out', 'x')));
});

test('an empty variants: block fails instead of building nothing', () => {
  const r = runRender('empty-variants', []);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /non-empty map/);
});

test('a bad theme in one variant fails up front and leaves existing output alone', () => {
  const dir = path.join(ROOT, 'out', 'bad-theme', 'ok');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'marker'), 'x');
  const r = runRender('bad-theme', []);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /\[broken\] Unknown theme "nosuchtheme"/);
  assert.ok(fs.existsSync(path.join(dir, 'marker')), 'output wiped before validation');
});

test('a non-numeric data-tier is reported and the element kept', () => {
  const { report } = buildFixture('bad-tier');
  assert.deepEqual(report.tierErrors, ['div data-tier="core"']);
  assert.ok(report.pages[0].cards.some((c) => c.label === 'Kept'));
});

test('sheet.html and content.html together are refused', () => {
  const r = runRender('both-files', []);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /both sheet\.html and content\.html exist/);
});

test('exit codes combine by severity, not by size', () => {
  assert.equal(combineExitCodes([4, 2]), 2);
  assert.equal(combineExitCodes([3, 4, 0]), 3);
  assert.equal(combineExitCodes([4, 1, 2]), 1);
  assert.equal(combineExitCodes([0, 0]), 0);
});

test('plan-first: a card too wide at span 4 is widened instead of starting a new page', () => {
  const { code, report } = buildFixture('plan-first');
  assert.equal(code, 0);
  assert.equal(report.pages.length, 1);
});

test('squeeze: a pages: limit re-pours at a smaller scale before failing', () => {
  const { code, report } = buildFixture('squeeze');
  assert.equal(code, 0);
  assert.equal(report.pages.length, 1);
  assert.ok(report.paginateScale < 1, `paginateScale ${report.paginateScale}`);
});
