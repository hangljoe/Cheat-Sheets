import test from 'node:test';
import assert from 'node:assert/strict';
import { skeletonToElements, midpoint } from '../engine/client/skeleton.js';

// Shapes as returned by parseMermaidToExcalidraw (probe, 2026-10-04).
const flow = () => [
  { id: 'A', type: 'rectangle', x: 8, y: 35, width: 141, height: 54, strokeWidth: 2, label: { text: 'Working dir', fontSize: 16 } },
  { id: 'B', type: 'rectangle', x: 225, y: 35, width: 111, height: 54, strokeWidth: 2, label: { text: 'Staging', fontSize: 16 } },
  { id: 'A_B', type: 'arrow', x: 149, y: 62, strokeWidth: 2, points: [[0, 0], [38, 0], [72, 0]],
    label: { text: 'add', fontSize: 16 }, roundness: { type: 2 }, start: { id: 'A' }, end: { id: 'B' } },
];

test('flowchart → 2 shapes, 2 bound labels, 1 arrow, 1 arrow label', () => {
  const { elements } = skeletonToElements(flow());
  assert.equal(elements.length, 6);
  const types = elements.map((e) => e.type).sort();
  assert.deepEqual(types, ['arrow', 'rectangle', 'rectangle', 'text', 'text', 'text']);
  const [a] = elements;
  const label = elements.find((e) => e.containerId === a.id);
  assert.equal(label.text, 'Working dir');
  assert.deepEqual(a.boundElements.find((b) => b.type === 'text'), { type: 'text', id: label.id });
});

test('arrow bindings point at the new element ids, not skeleton ids', () => {
  const { elements } = skeletonToElements(flow());
  const arrow = elements.find((e) => e.type === 'arrow');
  const [a, b] = elements.filter((e) => e.type === 'rectangle');
  assert.equal(arrow.startBinding.elementId, a.id);
  assert.equal(arrow.endBinding.elementId, b.id);
  assert.notEqual(arrow.startBinding.elementId, 'A');
  assert.equal(arrow.endArrowhead, 'arrow');
  assert.ok(a.boundElements.some((x) => x.type === 'arrow' && x.id === arrow.id));
});

test('different seeds give disjoint ids; the same seed is reproducible', () => {
  const one = skeletonToElements(flow(), { seed: 1 }).elements.map((e) => e.id);
  const two = skeletonToElements(flow(), { seed: 2 }).elements.map((e) => e.id);
  assert.ok(two.every((id) => !one.includes(id)));
  assert.deepEqual(skeletonToElements(flow(), { seed: 1 }), skeletonToElements(flow(), { seed: 1 }));
});

test('image fallback keeps its file data', () => {
  const files = { f1: { id: 'f1', mimeType: 'image/svg+xml', dataURL: 'data:image/svg+xml;base64,AA==' } };
  const out = skeletonToElements([{ type: 'image', x: 0, y: 0, width: 300, height: 250, fileId: 'f1', status: 'saved' }], { files });
  assert.equal(out.elements[0].type, 'image');
  assert.equal(out.elements[0].fileId, 'f1');
  assert.equal(out.files, files);
});

test('unknown skeleton types are reported, not silently dropped', () => {
  const { skipped, elements } = skeletonToElements([{ type: 'frame', x: 0, y: 0 }]);
  assert.deepEqual(skipped, ['frame']);
  assert.equal(elements.length, 0);
});

test('hand=false uses the clean font for labels', () => {
  const { elements } = skeletonToElements(flow(), { hand: false });
  assert.equal(elements.find((e) => e.text === 'Staging').fontFamily, 2);
});

test('midpoint walks the polyline by length (3-point arrow is centred, not on segment 2)', () => {
  const m = midpoint([[0, 0], [38, 0], [72, 0]]);
  assert.equal(m.x, 36);
  assert.equal(m.vertical, false);
  assert.equal(midpoint([[0, 0], [0, 100]]).vertical, true);
});

test('labels on vertical arrows sit beside the stroke, not on it', () => {
  const { elements } = skeletonToElements([{ type: 'arrow', x: 100, y: 0, points: [[0, 0], [0, 80]], label: { text: 'add', fontSize: 16 } }]);
  const label = elements.find((e) => e.type === 'text');
  assert.ok(label.x > 100, `label x ${label.x} overlaps the line at x=100`);
});

test('subgraph-style containers keep a top label and stay unfilled', () => {
  const { elements } = skeletonToElements([{ id: 'G', type: 'rectangle', x: 0, y: 0, width: 300, height: 200,
    label: { text: 'Group', fontSize: 16, verticalAlign: 'top' } }]);
  const [box, label] = elements;
  assert.equal(box.backgroundColor, 'transparent');
  assert.equal(label.verticalAlign, 'top');
  assert.ok(label.y < 20, `label y ${label.y} is not at the top`);
});
