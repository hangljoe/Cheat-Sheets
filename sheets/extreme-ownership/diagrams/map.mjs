// node sheets/extreme-ownership/diagrams/map.mjs → map.excalidraw
// The book's twelve principles in its three parts, left to right.
import { Scene } from '../../../engine/excalidraw-kit.mjs';

const s = new Scene();
const PARTS = [
  ['I · Win the war within', 'yellow', ['Extreme\nOwnership', 'No bad teams,\nonly bad leaders', 'Believe', 'Check\nthe ego']],
  ['II · Laws of combat', 'blue', ['Cover\n& Move', 'Simple', 'Prioritize\n& Execute', 'Decentralized\nCommand']],
  ['III · Sustain victory', 'green', ['Plan', 'Lead up & down\nthe chain', 'Decisiveness amid\nuncertainty', 'Discipline\n= Freedom']],
];

const W = 300, H = 160, GAP = 50;
const frames = PARTS.map(([title, fill, items], i) => {
  const x0 = i * (W + GAP);
  const frame = s.box('', { x: x0, y: 0, w: W, h: H, fill: 'transparent', style: 'solid', ink: '#8a8f99' });
  s.text(title, { x: x0 + 12, y: 8, size: 18 });
  items.forEach((label, j) => {
    s.box(label, { x: x0 + 10 + (j % 2) * 144, y: 40 + Math.floor(j / 2) * 58, w: 136, h: 50, fill, size: 14 });
  });
  return frame;
});
s.arrow(frames[0], frames[1]);
s.arrow(frames[1], frames[2]);

s.save(new URL('./map.excalidraw', import.meta.url).pathname);
