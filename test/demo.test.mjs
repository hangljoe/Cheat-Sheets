import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, assertReadable } from './helpers.mjs';

// The real demo topic: every variant must build clean, readable and on budget.
test('demo: sheets/git builds every variant cleanly in under 60 s', () => {
  const t0 = Date.now();
  let code = 0;
  try {
    execFileSync(process.execPath, ['engine/render.mjs', 'git', '--no-png'], { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    code = e.status ?? 1;
  }
  const ms = Date.now() - t0;
  assert.equal(code, 0);
  assert.ok(ms < 60_000, `demo build took ${ms} ms`);
  const variants = fs.readdirSync(path.join(ROOT, 'out', 'git'));
  assert.deepEqual(variants.sort(), ['desk', 'pocket']);
  for (const v of variants) {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'git', v, 'report.json'), 'utf8'));
    assert.ok(r.pages.every((p) => p.overflow === false), `${v} overflows`);
    assert.deepEqual(r.figures.errors, [], `${v} has figure errors`);
    if (r.requestedPages) assert.ok(r.pages.length <= r.requestedPages, `${v} needs more pages`);
    assertReadable(r);
  }
  // The pocket card ships with an A4 print sheet: 4 cards, cut marks.
  const pocket = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'git', 'pocket', 'report.json'), 'utf8'));
  assert.equal(pocket.print.perSheet, 4);
  assert.equal(pocket.print.placed, 4);
  assert.ok(pocket.print.marks > 0);
  assert.ok(fs.existsSync(path.join(ROOT, pocket.print.pdf)));
});
