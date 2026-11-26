import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterFor, isInWater, beamContains, advanceHoldProgress } from '../lib/level.js';

test('chapter routing follows the six cinematic areas in order', () => {
  assert.equal(chapterFor(120).name, 'THE DROWNED');
  assert.equal(chapterFor(1200).name, 'THE TIMBER GATE');
  assert.equal(chapterFor(2600).name, 'THE WATCHER');
  assert.equal(chapterFor(3700).name, 'OBSERVATION WING');
  assert.equal(chapterFor(4700).name, 'THE HOLLOW WALK');
  assert.equal(chapterFor(5600).name, 'THE LAST CROWD');
});

test('water movement is active only before the shoreline', () => {
  assert.equal(isInWater(300), true);
  assert.equal(isInWater(890), true);
  assert.equal(isInWater(900), false);
});

test('search beam detects a standing player in its cone', () => {
  const light = { x: 100, y: 100 };
  assert.equal(beamContains({ x: 100, y: 360 }, light, 0), true);
  assert.equal(beamContains({ x: 420, y: 360 }, light, 0), false);
});

test('holding an interaction fills progress and releasing decays it', () => {
  assert.equal(advanceHoldProgress(0.4, true, 30, 60), 0.9);
  assert.ok(Math.abs(advanceHoldProgress(0.4, false, 30, 60) - 0.15) < 1e-9);
  assert.equal(advanceHoldProgress(0.9, true, 30, 60), 1);
});
