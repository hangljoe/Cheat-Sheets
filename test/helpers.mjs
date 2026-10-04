// Shared test helpers: build a fixture through the real CLI and read its report.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(target, extraArgs) {
  let code = 0, stderr = '', stdout = '';
  try {
    stdout = execFileSync(process.execPath, ['engine/render.mjs', `test/fixtures/${target}`, '--no-png', ...extraArgs],
      { cwd: ROOT, stdio: 'pipe' }).toString();
  } catch (e) {
    code = e.status ?? 1;
    stderr = String(e.stderr || '');
    stdout = String(e.stdout || '');
  }
  return { code, stderr, stdout };
}
export { run as runRender };

// Build every variant of a content-mode fixture; reports keyed by variant name.
export function buildAll(name, extraArgs = []) {
  const { code, stderr, stdout } = run(name, extraArgs);
  const dir = path.join(ROOT, 'out', name);
  const reports = {};
  for (const v of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const f = path.join(dir, v, 'report.json');
    if (fs.existsSync(f)) reports[v] = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  if (!Object.keys(reports).length) throw new Error(`build of ${name} wrote no reports (exit ${code}):\n${stderr}`);
  return { code, reports, stdout, stderr, outDir: dir };
}

// Each fixture name is unique, so no two tests share (or wipe) an out/ dir.
export function buildFixture(name, extraArgs = []) {
  const { code, stderr } = run(name, extraArgs);
  const outDir = path.join(ROOT, 'out', name);
  const reportPath = path.join(outDir, 'report.json');
  if (!fs.existsSync(reportPath)) throw new Error(`build of ${name} wrote no report (exit ${code}):\n${stderr}`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return { code, report, outDir };
}

// Every page: base size and smallest measured text at least 6 pt.
export function assertReadable(report) {
  for (const p of report.pages) {
    assert.ok(p.effectivePt >= 6, `page ${p.page}: effectivePt ${p.effectivePt} < 6`);
    assert.ok(p.minTextPt >= 6, `page ${p.page}: minTextPt ${p.minTextPt} < 6 at ${p.minTextAt}`);
  }
}
