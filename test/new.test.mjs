import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { ROOT } from './helpers.mjs';

// Only ever removes the two scratch slugs this test creates.
const cleanup = (slug) => {
  if (!/^zz-[a-z]+$/.test(slug)) throw new Error(`refusing to clean ${slug}`);
  fs.rmSync(path.join(ROOT, 'sheets', slug), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'out', slug), { recursive: true, force: true });
};
const node = (args) => execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'pipe' }).toString();

test('new: content mode scaffolds content.html + variants and builds clean', (t) => {
  t.after(() => cleanup('zz-smoke'));
  cleanup('zz-smoke');
  node(['engine/new.mjs', 'zz-smoke', '--format', 'A6', '--depth', '2']);
  const dir = path.join(ROOT, 'sheets', 'zz-smoke');
  assert.ok(fs.existsSync(path.join(dir, 'content.html')));
  assert.ok(!fs.existsSync(path.join(dir, 'sheet.html')));
  const meta = YAML.parse(fs.readFileSync(path.join(dir, 'sheet.yaml'), 'utf8'));
  assert.deepEqual(Object.keys(meta.variants), ['main']);
  assert.equal(meta.variants.main.format, 'A6');
  node(['engine/render.mjs', 'zz-smoke', '--no-png']);   // throws on a non-zero exit
  assert.ok(fs.existsSync(path.join(ROOT, 'out', 'zz-smoke', 'main', 'report.json')));
});

test('new: --pages-mode is a boolean flag and does not swallow the next option', (t) => {
  t.after(() => cleanup('zz-pages'));
  cleanup('zz-pages');
  node(['engine/new.mjs', 'zz-pages', '--pages-mode', '--format', 'A5']);
  const dir = path.join(ROOT, 'sheets', 'zz-pages');
  assert.ok(fs.existsSync(path.join(dir, 'sheet.html')));
  assert.equal(YAML.parse(fs.readFileSync(path.join(dir, 'sheet.yaml'), 'utf8')).format, 'A5');
});
