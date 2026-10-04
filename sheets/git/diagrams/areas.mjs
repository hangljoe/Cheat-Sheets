// node sheets/git/diagrams/areas.mjs → areas.excalidraw
import { Scene } from '../../../engine/excalidraw-kit.mjs';

const s = new Scene();
const gap = 230;
const [wd, st, lr, rm] = [
  ['Working\ndir', 'yellow'], ['Staging\n(index)', 'green'], ['Local\nrepo', 'blue'], ['Remote\n(origin)', 'violet'],
].map(([label, fill], i) => s.box(label, { x: i * gap, y: 0, w: 140, h: 80, fill }));

s.arrow(wd, st, { label: 'add' });
s.arrow(st, lr, { label: 'commit' });
s.arrow(lr, rm, { label: 'push' });

const mid = (b) => b.x + b.width / 2;
s.arrow(null, null, { via: [[mid(rm), 92], [mid(rm), 122], [mid(lr), 122], [mid(lr), 92]], dashed: true, ink: 'violet', label: 'fetch / pull' });
s.arrow(null, null, { via: [[mid(lr) - 30, 92], [mid(lr) - 30, 165], [mid(wd), 165], [mid(wd), 92]], dashed: true, ink: 'blue', label: 'switch / restore' });

s.save(new URL('./areas.excalidraw', import.meta.url).pathname);
