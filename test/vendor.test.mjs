import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureMermaidBundle } from '../engine/lib/vendor.mjs';
import { ROOT } from './helpers.mjs';

test('builds the mermaid browser bundle once and reuses it', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-vendor-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'm2e.js');

  assert.equal(await ensureMermaidBundle(ROOT, out), out);
  const stat = fs.statSync(out);
  assert.ok(stat.size > 1_000_000, `bundle only ${stat.size} bytes`);
  assert.match(fs.readFileSync(out, 'utf8'), /parseMermaidToExcalidraw/);

  await ensureMermaidBundle(ROOT, out);
  assert.equal(fs.statSync(out).mtimeMs, stat.mtimeMs, 'second call rebuilt the bundle');
});

test('a stamp file newer than the bundle (e.g. a changed lockfile) forces a rebuild', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-vendor-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'm2e.js');
  const stamp = path.join(dir, 'lock.json');
  fs.writeFileSync(stamp, '{}');
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(stamp, old, old);

  await ensureMermaidBundle(ROOT, out, [stamp]);
  const first = fs.statSync(out).mtimeMs;
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(stamp, future, future);
  await ensureMermaidBundle(ROOT, out, [stamp]);
  assert.ok(fs.statSync(out).mtimeMs > first, 'stale bundle was reused');
});

test('concurrent calls share one build and leave no temp files', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-vendor-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'm2e.js');
  const [a, b] = [ensureMermaidBundle(ROOT, out), ensureMermaidBundle(ROOT, out)];
  assert.equal(a, b, 'second caller started its own build');
  await Promise.all([a, b]);
  assert.deepEqual(fs.readdirSync(dir), ['m2e.js']);
});
