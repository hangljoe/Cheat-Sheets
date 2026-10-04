import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from '../engine/excalidraw-kit.mjs';

function threeBoxes(seed) {
  const s = new Scene({ seed });
  const a = s.box('A', { x: 0, fill: 'yellow' });
  const b = s.box('B', { x: 200, fill: 'green' });
  const c = s.box('C', { x: 400, fill: 'blue' });
  s.arrow(a, b, { label: 'one' });
  s.arrow(b, c, { label: 'two' });
  return s.toJSON();
}

test('kit output is deterministic for a seed', () => {
  assert.equal(JSON.stringify(threeBoxes(1)), JSON.stringify(threeBoxes(1)));
});

test('ids are unique within a scene', () => {
  const ids = threeBoxes(1).elements.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('different seeds produce disjoint ids', () => {
  const a = new Set(threeBoxes(1).elements.map((e) => e.id));
  const b = threeBoxes(2).elements.map((e) => e.id);
  assert.ok(b.every((id) => !a.has(id)));
});
