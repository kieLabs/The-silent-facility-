import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../app/game/engine.js';

function makeCanvas() {
  const gradient = { addColorStop() {} };
  const target = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (value) => ({ width: String(value).length * 6 }),
  };
  const ctx = new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key];
      return () => {};
    },
    set(object, key, value) { object[key] = value; return true; },
  });
  return {
    width: 1280, height: 720,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 1280, height: 720 }),
  };
}

test('game engine creates, advances underwater gameplay, and destroys cleanly', () => {
  const oldWindow = globalThis.window;
  const oldRAF = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame;
  let queuedFrame = null;
  let lastHud = null;
  let finishStats = null;
  globalThis.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = (callback) => { queuedFrame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => { queuedFrame = null; };
  const game = createGame(makeCanvas(), { onHud: (hud) => { lastHud = hud; }, onFinish: (stats) => { finishStats = stats; } });
  try {
    game.start();
    game.setInput('right', true);
    let timestamp = 0;
    for (let i = 0; i < 40; i++) {
      const callback = queuedFrame;
      assert.equal(typeof callback, 'function');
      callback(timestamp += 16.667);
    }
    assert.ok(lastHud && lastHud.chapter === 'THE DROWNED');
    assert.ok(lastHud.progress > 0, 'world progress advances while swimming right');

    // Continue to the timber gate, hold the interaction, and verify passage opens.
    for (let i = 0; i < 410; i++) queuedFrame(timestamp += 16.667);
    assert.equal(lastHud.chapter, 'THE TIMBER GATE');
    game.setInput('right', false);
    game.setInput('interact', true);
    for (let i = 0; i < 100; i++) queuedFrame(timestamp += 16.667);
    assert.equal(lastHud.plateActive, true, 'holding interact breaks the timber barricade');

    // Move past the gate and crouch through the searchlight corridor.
    game.setInput('interact', false);
    game.setInput('right', true);
    for (let i = 0; i < 210; i++) queuedFrame(timestamp += 16.667);
    assert.equal(lastHud.chapter, 'THE WATCHER');
    game.setInput('crouch', true);
    for (let i = 0; i < 780; i++) queuedFrame(timestamp += 16.667);
    assert.equal(lastHud.chapter, 'OBSERVATION WING');
    assert.equal(lastHud.deaths, 0, 'crouching allows the player to pass the searchlight safely');
    game.setInput('crouch', false);
    game.setInput('right', true);

    // Four timed jumps cross the broken elevated walk.
    for (const threshold of [72, 75, 78, 82]) {
      let guard = 0;
      while (lastHud.progress < threshold && guard < 900) {
        queuedFrame(timestamp += 16.667);
        guard += 1;
      }
      assert.ok(guard < 900, `reached jump point ${threshold}%`);
      game.setInput('jump', true);
      queuedFrame(timestamp += 16.667);
      game.setInput('jump', false);
      for (let i = 0; i < 36; i++) queuedFrame(timestamp += 16.667);
      assert.equal(lastHud.deaths, 0, `jump at ${threshold}% lands without a fall`);
    }

    // Activate the final switch and verify that the exit sequence completes.
    let leverGuard = 0;
    while (lastHud.progress < 88 && leverGuard < 900) {
      queuedFrame(timestamp += 16.667);
      leverGuard += 1;
    }
    assert.ok(leverGuard < 900, 'reached the final release switch');
    game.setInput('right', false);
    game.setInput('interact', true);
    for (let i = 0; i < 60; i++) queuedFrame(timestamp += 16.667);
    assert.equal(lastHud.powerOn, true, 'holding interact activates the final release switch');
    game.setInput('interact', false);
    game.setInput('right', true);
    for (let i = 0; i < 500; i++) queuedFrame(timestamp += 16.667);
    assert.ok(finishStats, 'the player reaches the open exit');
    assert.equal(finishStats.deaths, 0);
  } finally {
    game.destroy();
    globalThis.window = oldWindow;
    globalThis.requestAnimationFrame = oldRAF;
    globalThis.cancelAnimationFrame = oldCancel;
  }
});
