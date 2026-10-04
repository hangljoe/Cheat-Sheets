// Print imposition: place small pages (A5–A7) several to a sheet (A4/A3) with
// cut marks, optionally duplex. Pure layout math + a pdf-lib composer.
import { PDFDocument, rgb } from 'pdf-lib';
import { FORMATS } from '../formats.mjs';

const PT = 72 / 25.4;   // pt per mm

// Best grid of card slots on a sheet: tries a portrait and a landscape sheet and keeps the one
// holding more cards (tie: portrait). Cards stay upright — rotating a card on a portrait sheet is
// the same geometry as an upright card on a landscape one. Cards abut, so one cut line serves two
// cards. Slots in mm, PDF origin bottom-left, row-major from the top-left.
export function planSheet({ card: [cw, ch], sheet: [sw, sh], margin = 5 }) {
  let best = null;
  for (const landscapeSheet of [false, true]) {
    const [W, H] = landscapeSheet ? [Math.max(sw, sh), Math.min(sw, sh)] : [Math.min(sw, sh), Math.max(sw, sh)];
    const [w, h] = [cw, ch];
    const cols = Math.floor((W - 2 * margin + 1e-9) / w);
    const rows = Math.floor((H - 2 * margin + 1e-9) / h);
    const n = cols * rows;
    if (n > 0 && (!best || n > best.perSheet)) best = { sheetW: W, sheetH: H, cols, rows, landscapeSheet, perSheet: n, w, h };
  }
  if (!best) return null;
  const x0 = (best.sheetW - best.cols * best.w) / 2;
  const top = (best.sheetH + best.rows * best.h) / 2;
  best.slots = [];
  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++) best.slots.push({ x: x0 + c * best.w, y: top - (r + 1) * best.h, w: best.w, h: best.h });
  }
  return best;
}

// Long-edge duplex: the back of each slot, as seen when printing the back side.
// Portrait sheet flips around the vertical axis; landscape sheet around the horizontal one.
export function backSlots(plan) {
  return plan.slots.map((s) => (plan.landscapeSheet
    ? { ...s, y: plan.sheetH - s.y - s.h }
    : { ...s, x: plan.sheetW - s.x - s.w }));
}

// Cut lines through the grid, with marks in the margin (or hairline guides when there is no margin).
function drawMarks(page, plan, margin) {
  const xs = [...new Set(plan.slots.flatMap((s) => [s.x, s.x + s.w]).map((v) => +v.toFixed(3)))];
  const ys = [...new Set(plan.slots.flatMap((s) => [s.y, s.y + s.h]).map((v) => +v.toFixed(3)))];
  const left = Math.min(...xs), right = Math.max(...xs), bottom = Math.min(...ys), top = Math.max(...ys);
  let marks = 0;
  if (margin >= 5) {
    const len = 4, off = 1;
    const line = (x1, y1, x2, y2) => { page.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: 0.25, color: rgb(0, 0, 0) }); marks++; };
    for (const x of xs) { line(x, top + off, x, top + off + len); line(x, bottom - off, x, bottom - off - len); }
    for (const y of ys) { line(left - off, y, left - off - len, y); line(right + off, y, right + off + len, y); }
  } else {
    // No room for marks outside the grid: faint guides on the cut lines instead.
    const guide = (x1, y1, x2, y2) => page.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: 0.2, color: rgb(0.75, 0.75, 0.75) });
    for (const x of xs) guide(x, bottom, x, top);
    for (const y of ys) guide(left, y, right, y);
  }
  return marks;
}

// srcBytes: the variant's PDF. card: nominal [w, h] mm of its pages (Playwright pages are a hair larger).
// Returns { bytes, perSheet, sheets, marks } or throws for an impossible request.
// fill: when the card has fewer pages than a sheet has slots, repeat them to fill the sheet.
export async function impose(srcBytes, { card, sheet = 'A4', duplex = false, margin = 5, marks: withMarks = true, fill = true }) {
  const s = FORMATS[String(sheet).toUpperCase()];
  if (!s) throw new Error(`unknown print sheet "${sheet}"`);
  const plan = planSheet({ card, sheet: [s.w, s.h], margin });
  if (!plan) throw new Error(`a ${card[0]}×${card[1]} mm page does not fit on ${sheet} with ${margin} mm margin`);
  const src = await PDFDocument.load(srcBytes);
  const count = src.getPageCount();
  if (duplex && count % 2) throw new Error(`duplex needs an even page count (front/back pairs), got ${count}`);
  const doc = await PDFDocument.create();
  const embedded = await doc.embedPdf(src, [...Array(count).keys()]);
  let fronts = duplex ? embedded.filter((_, i) => i % 2 === 0) : embedded;
  let backs = duplex ? embedded.filter((_, i) => i % 2 === 1) : [];
  if (fill && fronts.length < plan.perSheet) {
    const reps = Math.floor(plan.perSheet / fronts.length);
    fronts = Array.from({ length: reps }, () => fronts).flat();
    backs = Array.from({ length: reps }, () => backs).flat();
  }
  const backPos = duplex ? backSlots(plan) : null;
  let marks = 0, sheets = 0;

  const place = (page, emb, slot) =>
    page.drawPage(emb, { x: slot.x * PT, y: slot.y * PT, width: card[0] * PT, height: card[1] * PT });
  for (let i = 0; i < fronts.length; i += plan.perSheet) {
    const front = doc.addPage([plan.sheetW * PT, plan.sheetH * PT]);
    fronts.slice(i, i + plan.perSheet).forEach((emb, k) => place(front, emb, plan.slots[k]));
    if (withMarks) marks += drawMarks(front, plan, margin);
    sheets++;
    if (duplex) {
      const back = doc.addPage([plan.sheetW * PT, plan.sheetH * PT]);
      backs.slice(i, i + plan.perSheet).forEach((emb, k) => place(back, emb, backPos[k]));
      sheets++;
    }
  }
  return { bytes: await doc.save(), perSheet: plan.perSheet, placed: fronts.length, sheets, marks };
}
