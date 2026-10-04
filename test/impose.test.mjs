import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { planSheet, backSlots, impose } from '../engine/lib/impose.mjs';

const A4 = [210, 297], A7 = [74, 105], A6 = [105, 148], A5 = [148, 210];
const mm = (pt) => (pt * 25.4) / 72;

test('cards per A4 sheet: A7 4 (margin 5) / 8 (margin 0); A6 2 / 4; A5 1', () => {
  assert.equal(planSheet({ card: A7, sheet: A4, margin: 5 }).perSheet, 4);
  assert.equal(planSheet({ card: A7, sheet: A4, margin: 0 }).perSheet, 8);
  assert.equal(planSheet({ card: A6, sheet: A4, margin: 5 }).perSheet, 2);
  assert.equal(planSheet({ card: A6, sheet: A4, margin: 0 }).perSheet, 4);
  assert.equal(planSheet({ card: A5, sheet: A4, margin: 5 }).perSheet, 1);
});

test('a card larger than the sheet has no plan', () => {
  assert.equal(planSheet({ card: A4, sheet: A5, margin: 5 }), null);
});

test('duplex backs mirror across the long edge (portrait sheet: left ↔ right)', () => {
  const plan = planSheet({ card: A7, sheet: A4, margin: 5 });   // 2×2, portrait, upright
  assert.equal(plan.landscapeSheet, false);
  const back = backSlots(plan);
  assert.ok(Math.abs(back[0].x - plan.slots[1].x) < 1e-9, 'top-left back sits behind top-right');
  assert.ok(Math.abs(back[0].y - plan.slots[0].y) < 1e-9);
});

async function samplePdf(pages, [w, h]) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([(w * 72) / 25.4, (h * 72) / 25.4]);
    page.drawRectangle({ x: 5, y: 5, width: 20, height: 20 });   // real content (empty pages can't be embedded)
  }
  return doc.save();
}

test('impose: A7 cards → A4 sheets with cut marks; size and sheet count are right', async () => {
  const r = await impose(await samplePdf(5, A7), { card: A7, sheet: 'A4', margin: 5 });
  assert.equal(r.perSheet, 4);
  assert.equal(r.sheets, 2);
  assert.ok(r.marks > 0);
  const out = await PDFDocument.load(r.bytes);
  assert.equal(out.getPageCount(), 2);
  const p = out.getPage(0);
  assert.ok(Math.abs(mm(p.getWidth()) - 210) < 0.5 && Math.abs(mm(p.getHeight()) - 297) < 0.5);
});

test('impose: no margin → 8-up and guides instead of marks', async () => {
  const r = await impose(await samplePdf(8, A7), { card: A7, sheet: 'A4', margin: 0 });
  assert.equal(r.perSheet, 8);
  assert.equal(r.sheets, 1);
  assert.equal(r.marks, 0);
});

test('impose: duplex pairs fronts and backs, and refuses an odd page count', async () => {
  const r = await impose(await samplePdf(4, A7), { card: A7, sheet: 'A4', duplex: true });
  assert.equal(r.sheets, 2);   // one front sheet, one back sheet
  await assert.rejects(impose(await samplePdf(3, A7), { card: A7, sheet: 'A4', duplex: true }), /even page count/);
});

test('impose: fill repeats a short card to use every slot; fill:false leaves slots empty', async () => {
  const one = await samplePdf(1, A7);
  assert.equal((await impose(one, { card: A7, sheet: 'A4' })).placed, 4);
  assert.equal((await impose(one, { card: A7, sheet: 'A4', fill: false })).placed, 1);
  const pair = await samplePdf(2, A7);
  const d = await impose(pair, { card: A7, sheet: 'A4', duplex: true });
  assert.equal(d.placed, 4);   // the front/back pair repeated in all four slots
  assert.equal(d.sheets, 2);
});

test('A7 margin 0 → 8-up needs the landscape sheet (a portrait-only planner gets 4)', () => {
  const plan = planSheet({ card: A7, sheet: A4, margin: 0 });
  assert.equal(plan.landscapeSheet, true);
  assert.equal(plan.perSheet, 8);
});
