import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, overlaps, moveAxis, moveBody } from '../lib/physics.js';

test('clamp keeps values inside the requested range', () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(5, 0, 10), 5);
});

test('overlaps detects intersecting rectangles but not touching edges', () => {
  assert.equal(overlaps({x:0,y:0,w:10,h:10}, {x:9,y:9,w:5,h:5}), true);
  assert.equal(overlaps({x:0,y:0,w:10,h:10}, {x:10,y:0,w:5,h:5}), false);
});

test('horizontal movement stops at the near face of a wall', () => {
  const actor = { x: 0, y: 0, w: 10, h: 10 };
  const hit = moveAxis(actor, 20, [{x:15,y:0,w:20,h:30}], 'x');
  assert.equal(hit, true);
  assert.equal(actor.x, 5);
});

test('falling bodies land on a platform and become grounded', () => {
  const actor = { x: 5, y: 0, w: 10, h: 10, grounded: false };
  const result = moveBody(actor, 0, 20, [{x:0,y:15,w:30,h:10}]);
  assert.equal(actor.y, 5);
  assert.equal(result.grounded, true);
});
