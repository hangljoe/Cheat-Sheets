// Build .excalidraw scenes from code, so diagrams stay editable in excalidraw.com
// afterwards (open the file there, tweak by hand, save back).
//
//   import { Scene } from '../../engine/excalidraw-kit.mjs';
//   const s = new Scene();           // new Scene({ seed: 2 }) for a second, id-disjoint scene
//   const a = s.box('Working\ndir', { x: 0, y: 0, fill: 'yellow' });
//   const b = s.box('Staging', { x: 220, y: 0, fill: 'green' });
//   s.arrow(a, b, { label: 'git add' });
//   s.save('sheets/git/diagrams/areas.excalidraw');
//
// Shapes: box | ellipse | diamond. Fills: yellow green blue violet red orange gray
// or any hex. Fonts: 5 = Excalifont (hand), 3 = mono, 2 = sans.
// Output is deterministic for a given seed (byte-identical on every run).

import fs from 'node:fs';
import { FILLS, INK, makeFactory } from './client/elements.js';

export class Scene {
  elements = [];

  constructor({ seed = 1 } = {}) {
    this.base = makeFactory(seed).base;
  }

  _shape(type, label, { x = 0, y = 0, w = 140, h = 80, fill = 'gray', style = 'hachure', ink = 'black', size = 20, font = 5 } = {}) {
    const shape = this.base({ type, x, y, width: w, height: h, backgroundColor: FILLS[fill] ?? fill, fillStyle: style,
      strokeColor: INK[ink] ?? ink, roundness: type === 'rectangle' ? { type: 3 } : { type: 2 } });
    this.elements.push(shape);
    if (label) {
      const lines = String(label).split('\n');
      const t = this.base({ type: 'text', x: x + 8, y: y + h / 2 - (lines.length * size * 1.25) / 2, width: w - 16,
        height: lines.length * size * 1.25, text: label, originalText: label, fontSize: size, fontFamily: font,
        textAlign: 'center', verticalAlign: 'middle', containerId: shape.id, lineHeight: 1.25, autoResize: true,
        strokeColor: INK[ink] ?? ink });
      shape.boundElements.push({ type: 'text', id: t.id });
      this.elements.push(t);
    }
    return shape;
  }
  box(label, o) { return this._shape('rectangle', label, o); }
  ellipse(label, o) { return this._shape('ellipse', label, o); }
  diamond(label, o) { return this._shape('diamond', label, o); }

  text(str, { x = 0, y = 0, size = 16, font = 5, ink = 'black', align = 'left', w } = {}) {
    const lines = String(str).split('\n');
    const width = w ?? Math.max(...lines.map((l) => l.length)) * size * 0.55;
    const t = this.base({ type: 'text', x, y, width, height: lines.length * size * 1.25, text: str, originalText: str,
      fontSize: size, fontFamily: font, textAlign: align, verticalAlign: 'top', containerId: null, lineHeight: 1.25,
      autoResize: true, strokeColor: INK[ink] ?? ink });
    this.elements.push(t);
    return t;
  }

  // Arrow between two shapes (straight, edge to edge) or along explicit points.
  // opts: label, ink, dashed, via: [[x,y],...] absolute waypoints, both: double-headed.
  arrow(from, to, { label, ink = 'black', dashed = false, via, both = false, size = 14, font = 3 } = {}) {
    const c = (s) => [s.x + s.width / 2, s.y + s.height / 2];
    let pts;
    if (via) pts = via;
    else {
      const [ax, ay] = c(from), [bx, by] = c(to);
      const horiz = Math.abs(bx - ax) >= Math.abs(by - ay);
      const sx = horiz ? (bx > ax ? from.x + from.width + 6 : from.x - 6) : ax;
      const sy = horiz ? ay : (by > ay ? from.y + from.height + 6 : from.y - 6);
      const ex = horiz ? (bx > ax ? to.x - 6 : to.x + to.width + 6) : bx;
      const ey = horiz ? by : (by > ay ? to.y - 6 : to.y + to.height + 6);
      pts = [[sx, sy], [ex, ey]];
    }
    const [x0, y0] = pts[0];
    const rel = pts.map(([x, y]) => [x - x0, y - y0]);
    const xs = rel.map((p) => p[0]), ys = rel.map((p) => p[1]);
    const a = this.base({ type: 'arrow', x: x0, y: y0, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
      points: rel, endArrowhead: 'arrow', startArrowhead: both ? 'arrow' : null, strokeColor: INK[ink] ?? ink,
      strokeStyle: dashed ? 'dashed' : 'solid', fillStyle: 'solid', roundness: via ? null : { type: 2 } });
    this.elements.push(a);
    if (label) {
      // Label sits above the middle segment.
      const mid = Math.floor((pts.length - 1) / 2);
      const [mx, my] = [(pts[mid][0] + pts[mid + 1][0]) / 2, (pts[mid][1] + pts[mid + 1][1]) / 2];
      const w = label.length * size * 0.62;
      this.text(label, { x: mx - w / 2, y: my - size * 1.6, w, size, font, ink, align: 'center' });
    }
    return a;
  }

  toJSON() {
    return { type: 'excalidraw', version: 2, source: 'cheat-sheets', elements: this.elements,
      appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {} };
  }
  save(file) { fs.writeFileSync(file, JSON.stringify(this.toJSON(), null, 1)); return file; }
}
