// Convert mermaid-to-excalidraw "skeleton" elements into full Excalidraw
// elements. @excalidraw/utils has no convertToExcalidrawElements, so this is
// ours. Pure ESM — runs in the browser and in node tests.
import { FILLS, makeFactory } from './elements.js';

const PASTELS = ['yellow', 'green', 'blue', 'violet', 'orange', 'teal'].map((k) => FILLS[k]);
const SHAPES = new Set(['rectangle', 'ellipse', 'diamond']);

// Point halfway along a polyline (by length), and whether that segment is mostly vertical.
export function midpoint(pts) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(len); total += len;
  }
  let walk = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const len = segs[i - 1];
    if (walk <= len || i === pts.length - 1) {
      const t = len ? Math.min(1, walk / len) : 0;
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, vertical: Math.abs(by - ay) > Math.abs(bx - ax) };
    }
    walk -= len;
  }
  return { x: pts[0][0], y: pts[0][1], vertical: false };
}

// seed: one per figure (document order) so ids never collide across diagrams.
// files: the `files` map parseMermaidToExcalidraw returns (image fallbacks).
export function skeletonToElements(skeletons, { seed = 1, hand = true, files = {} } = {}) {
  const { base } = makeFactory(seed);
  const elements = [];
  const skipped = [];
  const idMap = new Map();     // skeleton id → element
  const arrows = [];
  let pastel = 0;

  const textEl = (o) => base({
    type: 'text', fontSize: o.fontSize, fontFamily: o.fontFamily, text: o.text, originalText: o.text,
    textAlign: o.textAlign ?? 'center', verticalAlign: o.verticalAlign ?? 'top', lineHeight: 1.25, autoResize: true,
    strokeColor: o.strokeColor ?? '#1e1e1e', containerId: o.containerId ?? null,
    x: o.x, y: o.y, width: o.width, height: o.height, fillStyle: 'solid',
  });

  for (const sk of skeletons) {
    if (SHAPES.has(sk.type)) {
      const shape = base({
        type: sk.type, x: sk.x, y: sk.y, width: sk.width, height: sk.height,
        roundness: sk.type === 'rectangle' ? { type: 3 } : { type: 2 },
        // Group boxes (subgraphs: label at the top) stay unfilled behind their nodes.
        backgroundColor: sk.backgroundColor ?? (sk.label?.verticalAlign === 'top' ? 'transparent' : PASTELS[pastel++ % PASTELS.length]),
        fillStyle: sk.fillStyle ?? 'hachure', strokeColor: sk.strokeColor ?? '#1e1e1e',
        strokeWidth: sk.strokeWidth ?? 2, strokeStyle: sk.strokeStyle ?? 'solid',
      });
      elements.push(shape);
      if (sk.id) idMap.set(sk.id, shape);
      if (sk.label?.text) {
        const fontSize = sk.label.fontSize ?? 16;
        const lines = String(sk.label.text).split('\n').length;
        const height = lines * fontSize * 1.25;
        const valign = sk.label.verticalAlign ?? 'middle';
        const y = valign === 'top' ? sk.y + 5 : valign === 'bottom' ? sk.y + sk.height - height - 5 : sk.y + (sk.height - height) / 2;
        const t = textEl({
          text: sk.label.text, fontSize, fontFamily: hand ? 5 : 2, containerId: shape.id, verticalAlign: valign,
          textAlign: sk.label.textAlign, strokeColor: sk.label.strokeColor, x: sk.x + 5, y, width: sk.width - 10, height,
        });
        shape.boundElements.push({ type: 'text', id: t.id });
        elements.push(t);
      }
    } else if (sk.type === 'arrow' || sk.type === 'line') {
      const pts = sk.points ?? [[0, 0], [sk.width ?? 0, sk.height ?? 0]];
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const el = base({
        type: sk.type, x: sk.x, y: sk.y, points: pts,
        width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
        strokeColor: sk.strokeColor ?? '#1e1e1e', strokeWidth: sk.strokeWidth ?? 2, strokeStyle: sk.strokeStyle ?? 'solid',
        roundness: sk.roundness ?? null, fillStyle: 'solid',
        startArrowhead: sk.startArrowhead ?? null,
        endArrowhead: sk.type === 'arrow' ? (sk.endArrowhead === undefined ? 'arrow' : sk.endArrowhead) : null,
      });
      elements.push(el);
      if (sk.type === 'arrow') arrows.push({ el, start: sk.start?.id, end: sk.end?.id });
      if (sk.label?.text) {
        const fontSize = sk.label.fontSize ?? 14;
        const width = String(sk.label.text).length * fontSize * 0.6;
        const height = fontSize * 1.25;
        const { x: mx, y: my, vertical } = midpoint(pts);
        // Beside a vertical segment, above a horizontal one — never on the stroke.
        const x = vertical ? sk.x + mx + 6 : sk.x + mx - width / 2;
        const y = vertical ? sk.y + my - height / 2 : sk.y + my - height - 4;
        elements.push(textEl({
          text: sk.label.text, fontSize, fontFamily: 3, strokeColor: '#495057', x, y, width, height,
          textAlign: vertical ? 'left' : 'center',
        }));
      }
    } else if (sk.type === 'text') {
      const fontSize = sk.fontSize ?? 16;
      elements.push(textEl({
        text: sk.text, fontSize, fontFamily: hand ? 5 : 2, strokeColor: sk.strokeColor,
        x: sk.x, y: sk.y, width: sk.width ?? String(sk.text).length * fontSize * 0.6, height: sk.height ?? fontSize * 1.25,
      }));
    } else if (sk.type === 'image') {
      elements.push(base({
        type: 'image', x: sk.x, y: sk.y, width: sk.width, height: sk.height, fileId: sk.fileId,
        status: 'saved', scale: [1, 1], strokeColor: 'transparent', fillStyle: 'solid',
      }));
    } else {
      skipped.push(sk.type);
    }
  }

  // Bind arrows to the shapes they connect (via the skeleton id map).
  for (const { el, start, end } of arrows) {
    for (const [key, sid] of [['startBinding', start], ['endBinding', end]]) {
      const target = sid && idMap.get(sid);
      if (!target) continue;
      el[key] = { elementId: target.id, focus: 0, gap: 4 };
      target.boundElements.push({ type: 'arrow', id: el.id });
    }
  }

  return { elements, files, skipped };
}
