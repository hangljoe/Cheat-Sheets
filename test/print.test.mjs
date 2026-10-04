import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildFixture, ROOT } from './helpers.mjs';
import { printOptions } from '../engine/lib/build.mjs';

test('printOptions: true / "A3" / object / absent, with defaults', () => {
  assert.equal(printOptions({}, undefined), null);
  assert.equal(printOptions({ print: false }, undefined), null);
  assert.deepEqual(printOptions({ print: true }, undefined), { sheet: 'A4', duplex: false, margin: 5, marks: true, fill: true });
  assert.equal(printOptions({}, 'a3').sheet, 'A3');
  assert.equal(printOptions({ print: { sheet: 'A4', duplex: true } }, 'A3').sheet, 'A3', 'the CLI flag wins');
});

test('--print A3 on an A5 sheet writes a 2-up A3 print PDF', async () => {
  const { code, report } = buildFixture('fits', ['--print', 'A3']);
  assert.equal(code, 0);
  assert.equal(report.print.sheet, 'A3');
  assert.equal(report.print.perSheet, 2);
  assert.ok(report.print.marks > 0);
  const pdf = await PDFDocument.load(fs.readFileSync(path.join(ROOT, report.print.pdf)));
  const mm = (pt) => (pt * 25.4) / 72;
  const { width, height } = pdf.getPage(0).getSize();
  assert.deepEqual([Math.round(mm(Math.min(width, height))), Math.round(mm(Math.max(width, height)))], [297, 420]);
});

test('a print problem is reported and exits 4 instead of crashing the build', () => {
  const { code, report } = buildFixture('print-odd');
  assert.equal(code, 4);
  assert.match(report.print.error, /even page count/);
  assert.ok(fs.existsSync(path.join(ROOT, report.pdf)), 'the normal PDF is still there');
});
