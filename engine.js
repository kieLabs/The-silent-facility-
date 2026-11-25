import { clamp, moveAxis, moveBody, overlaps } from '../../lib/physics.js';

const VIEW_W = 1280;
const VIEW_H = 720;
const WORLD_W = 4680;
const FLOOR_Y = 590;

const BASE_SOLIDS = [
  { x: 0, y: FLOOR_Y, w: 2180, h: 420, kind: 'floor' },
  { x: 2540, y: FLOOR_Y, w: WORLD_W - 2540, h: 420, kind: 'floor' },
  { x: 2210, y: 540, w: 135, h: 28, kind: 'platform' },
  { x: 2390, y: 500, w: 125, h: 28, kind: 'platform' },
];

const CHAPTERS = [
  { at: 0, end: 1240, name: 'THE DROWNED YARD', objective: 'Move the crate onto the pressure plate.' },
  { at: 1240, end: 2160, name: 'THE WATCHER', objective: 'Stay low. The searchlight is looking for movement.' },
  { at: 2160, end: 3240, name: 'THE BROKEN SPAN', objective: 'Cross the flooded gap using the broken platforms.' },
  { at: 3240, end: WORLD_W, name: 'THE OBSERVATION WING', objective: 'Find the control switch and reach the exit.' },
];

function rect(x, y, w, h, extra = {}) { return { x, y, w, h, ...extra }; }

export function createGame(canvas, callbacks = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');

  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let started = false;
  let paused = false;
  let finished = false;
  let destroyed = false;
  let muted = false;
  let audioContext = null;
  let lastHudAt = 0;
  let deathTimer = 0;
  let flashTimer = 0;
  let cameraX = 0;
  let dpr = 1;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let chapterIndex = 0;
  let hintUntil = 0;
  let hintText = 'A quiet place. Keep moving.';
  let currentObjective = CHAPTERS[0].objective;
  let checkpointX = 130;
  let deaths = 0;
  let jumpWasDown = false;
  let interactWasDown = false;
  let droneDetectedCooldown = 0;

  const input = { left: false, right: false, jump: false, crouch: false, interact: false };
  const keysDown = new Set();
  const player = { x: 130, y: FLOOR_Y - 88, w: 38, h: 88, vx: 0, vy: 0, grounded: false, facing: 1, crouching: false, anim: 0 };
  const crate = { x: 470, y: FLOOR_Y - 78, w: 72, h: 78, vx: 0, vy: 0, grounded: false };
  const plate = rect(860, FLOOR_Y - 12, 92, 12);
  const firstDoor = rect(1168, 385, 44, 205);
  const finalGate = rect(4010, 365, 48, 225);
  const lever = rect(3425, FLOOR_Y - 76, 30, 76);
  const drone = { x: 1740, y: 278, angle: 1.57 };
  const checkpointMarker = rect(2800, FLOOR_Y - 90, 20, 90);
  const exitMarker = rect(4500, FLOOR_Y - 150, 70, 150);
  const particles = Array.from({ length: 95 }, (_, i) => ({
    x: (i * 173 + 41) % WORLD_W,
    y: 80 + ((i * 97) % 520),
    r: 0.7 + ((i * 13) % 10) / 10,
    drift: 0.3 + ((i * 7) % 8) / 10,
    phase: i * 0.72,
  }));

  function beep(freq = 420, duration = 0.07, type = 'sine', gain = 0.035) {
    if (muted || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') audioContext.resume();
      const osc = audioContext.createOscillator();
      const amp = audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      amp.gain.setValueAtTime(gain, audioContext.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      osc.connect(amp);
      amp.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + duration);
    } catch { /* Audio is optional; gameplay never depends on it. */ }
  }

  function setHint(text, seconds = 3.4) {
    hintText = text;
    hintUntil = elapsed + seconds;
  }

  function currentChapter() {
    let idx = CHAPTERS.findIndex((chapter) => player.x >= chapter.at && player.x < chapter.end);
    if (idx < 0) idx = CHAPTERS.length - 1;
    return idx;
  }

  function solidWorld() {
    const solids = [...BASE_SOLIDS];
    if (!isPlateActive()) solids.push(firstDoor);
    if (!leverActivated) solids.push(finalGate);
    return solids;
  }

  let leverActivated = false;
  let plateLatched = false;

  function isPlateActive() {
    const crateCenter = crate.x + crate.w / 2;
    return crateCenter > plate.x - 2 && crateCenter < plate.x + plate.w + 2 && crate.y + crate.h >= FLOOR_Y - 5;
  }

  function resetAtCheckpoint() {
    player.x = checkpointX;
    player.y = FLOOR_Y - player.h;
    player.vx = 0;
    player.vy = 0;
    player.crouching = false;
    player.h = 88;
    player.grounded = true;
    crate.vx = 0;
    crate.vy = 0;
    if (checkpointX < 150) crate.x = 470;
    cameraX = clamp(player.x - 420, 0, WORLD_W - VIEW_W);
    deathTimer = 0;
    flashTimer = 0.65;
    droneDetectedCooldown = 1.2;
  }

  function die(reason = 'You were seen.') {
    if (deathTimer > 0 || finished) return;
    deaths += 1;
    deathTimer = 0.72;
    setHint(reason + ' Returning to the last safe point.', 1.2);
    beep(130, 0.22, 'sawtooth', 0.045);
    callbacks.onDeath?.(deaths);
  }

  function updateCrate(dt, solids) {
    crate.vy = Math.min(crate.vy + 0.68 * dt, 16);
    crate.grounded = false;
    moveAxis(crate, crate.vx * dt, solids, 'x');
    const result = moveBody(crate, 0, crate.vy * dt, solids);
    if (result.grounded) crate.vy = 0;
    crate.vx *= Math.pow(0.82, dt);
  }

  function tryPushCrate(dx, solids) {
    if (plateLatched) return;
    if (!overlaps({ ...player, x: player.x + dx }, crate)) return;
    const push = dx * 0.94;
    const testCrate = { ...crate, x: crate.x + push };
    if (solids.some((solid) => overlaps(testCrate, solid))) return;
    crate.x += push;
    crate.vx = 0;
  }

  function tryInteract() {
    const px = player.x + player.w / 2;
    const lx = lever.x + lever.w / 2;
    if (!leverActivated && Math.abs(px - lx) < 112 && Math.abs((player.y + player.h) - (lever.y + lever.h)) < 96) {
      leverActivated = true;
      beep(660, 0.1, 'triangle', 0.04);
      setHint('Power restored. The final gate is opening.', 4.5);
      currentObjective = 'Power restored. Reach the lit exit.';
      callbacks.onObjective?.(currentObjective);
      return;
    }
    if (!isPlateActive() && Math.abs(px - (plate.x + plate.w / 2)) < 130) {
      setHint('The plate needs weight. Push the metal crate onto it.', 3.5);
    } else if (Math.abs(px - lx) < 180 && !leverActivated) {
      setHint('A manual control switch. Press E to activate it.', 3.5);
    }
  }

  function update(dt) {
    elapsed += dt / 60;
    if (!started || paused || finished) return;
    if (deathTimer > 0) {
      deathTimer -= dt / 60;
      if (deathTimer <= 0) resetAtCheckpoint();
      return;
    }
    flashTimer = Math.max(0, flashTimer - dt / 60);
    droneDetectedCooldown = Math.max(0, droneDetectedCooldown - dt / 60);

    const chapter = currentChapter();
    if (chapter !== chapterIndex) {
      chapterIndex = chapter;
      const title = CHAPTERS[chapter].name;
      currentObjective = CHAPTERS[chapter].objective;
      callbacks.onChapter?.(title);
      callbacks.onObjective?.(currentObjective);
      setHint(title, 2.6);
    }

    const wasCrouching = player.crouching;
    player.crouching = input.crouch;
    if (player.crouching !== wasCrouching) {
      const bottom = player.y + player.h;
      player.h = player.crouching ? 54 : 88;
      player.y = bottom - player.h;
    }

    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const speed = player.crouching ? 1.55 : 3.7;
    player.vx = direction * speed;
    if (direction) player.facing = direction;
    player.anim += Math.abs(player.vx) * dt * 0.07;

    const solids = solidWorld();
    updateCrate(dt, solids);
    tryPushCrate(player.vx * dt, solids);

    if (input.jump && !jumpWasDown && player.grounded && !player.crouching) {
      player.vy = -14.6;
      player.grounded = false;
      beep(300, 0.06, 'triangle', 0.025);
    }
    jumpWasDown = input.jump;

    const dynamicSolids = [...solids, crate];
    const horizontalHit = moveAxis(player, player.vx * dt, dynamicSolids, 'x');
    if (horizontalHit) player.vx = 0;
    player.vy = Math.min(player.vy + 0.72 * dt, 17);
    const oldGrounded = player.grounded;
    player.grounded = false;
    const verticalHit = moveAxis(player, player.vy * dt, dynamicSolids, 'y');
    if (verticalHit) player.vy = 0;
    if (player.y > 850) die('The water swallowed the path.');

    if (input.interact && !interactWasDown) tryInteract();
    interactWasDown = input.interact;

    if (isPlateActive() && !callbacks.plateDone) {
      callbacks.plateDone = true;
      plateLatched = true;
      beep(520, 0.15, 'sine', 0.045);
      setHint('Pressure plate engaged. The passage is open.', 4.2);
      currentObjective = 'Passage open. Keep going.';
      callbacks.onObjective?.(currentObjective);
    }

    // The search beam sweeps the yard. Staying low keeps the silhouette beneath it.
    drone.angle = 1.57 + Math.sin(elapsed * 0.7) * 0.48;
    if (player.x > 1515 && player.x < 1995 && !player.crouching && droneDetectedCooldown <= 0) {
      const originX = drone.x;
      const originY = drone.y + 15;
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      const dx = cx - originX;
      const dy = cy - originY;
      const along = dx * Math.cos(drone.angle) + dy * Math.sin(drone.angle);
      const across = Math.abs(-dx * Math.sin(drone.angle) + dy * Math.cos(drone.angle));
      if (along > 20 && along < 390 && across < along * 0.23 + 12) {
        die('The searchlight found you.');
      }
    }

    if (player.x > 2740 && checkpointX < 2600) {
      checkpointX = 2800;
      setHint('Checkpoint reached. You are safe here.', 3.5);
      beep(740, 0.12, 'sine', 0.04);
      callbacks.onCheckpoint?.();
    }

    if (player.x > 4430 && leverActivated) {
      finished = true;
      beep(880, 0.25, 'sine', 0.04);
      callbacks.onFinish?.({ deaths, time: Math.floor(elapsed) });
    }

    cameraX += (clamp(player.x - 430, 0, WORLD_W - VIEW_W) - cameraX) * Math.min(1, 0.095 * dt);
    if (elapsed - lastHudAt > 0.16) {
      lastHudAt = elapsed;
      callbacks.onHud?.({
        chapter: CHAPTERS[chapterIndex].name,
        objective: currentObjective,
        progress: Math.min(100, Math.round((player.x / 4500) * 100)),
        deaths,
        hint: elapsed < hintUntil ? hintText : '',
        plateActive: isPlateActive(),
        powerOn: leverActivated,
      });
    }
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, '#071014');
    sky.addColorStop(0.48, '#142128');
    sky.addColorStop(1, '#05090c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // A distant, cold light gives the level a cinematic silhouette.
    const glowX = 720 - (cameraX * 0.08 % 260);
    const glow = ctx.createRadialGradient(glowX, 340, 8, glowX, 340, 620);
    glow.addColorStop(0, 'rgba(164,191,198,0.18)');
    glow.addColorStop(0.35, 'rgba(76,109,119,0.07)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Layered factory silhouettes, shifted at different rates for parallax.
    for (let layer = 0; layer < 3; layer++) {
      const parallax = 0.13 + layer * 0.12;
      const offset = -((cameraX * parallax) % 520);
      ctx.fillStyle = ['#0b1419', '#0a1115', '#080e12'][layer];
      for (let i = -1; i < 4; i++) {
        const x = offset + i * 520;
        const base = 490 + layer * 24;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x, 240 + layer * 30);
        ctx.lineTo(x + 62, 240 + layer * 30);
        ctx.lineTo(x + 105, 185 + layer * 18);
        ctx.lineTo(x + 158, 245 + layer * 25);
        ctx.lineTo(x + 200, 215 + layer * 22);
        ctx.lineTo(x + 268, base);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(x + 310, base - 150, 18, 150);
        ctx.fillRect(x + 345, base - 190, 8, 190);
        for (let w = 0; w < 3; w++) {
          ctx.fillStyle = layer === 0 ? 'rgba(137,168,174,0.08)' : 'rgba(115,146,154,0.045)';
          ctx.fillRect(x + 22 + w * 65, base - 95, 26, 44);
        }
        ctx.fillStyle = ['#0b1419', '#0a1115', '#080e12'][layer];
      }
    }

    // Sparse floating dust, fixed to world space so it drifts through the camera.
    for (const p of particles) {
      const sx = p.x - cameraX * 0.58;
      if (sx < -10 || sx > VIEW_W + 10) continue;
      const alpha = 0.08 + (Math.sin(elapsed * p.drift + p.phase) + 1) * 0.035;
      ctx.fillStyle = `rgba(194,216,218,${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, p.y + Math.sin(elapsed * 0.4 + p.phase) * 8, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawIndustrialDetails() {
    const screenX = (x) => x;
    // Tall columns and window bays across the facility.
    for (let x = 120; x < WORLD_W; x += 420) {
      const sx = screenX(x);
      if (sx < -150 || sx > VIEW_W + 100) continue;
      ctx.fillStyle = 'rgba(3,7,9,0.7)';
      ctx.fillRect(sx, 185, 38, 405);
      ctx.fillRect(sx + 250, 245, 22, 345);
      ctx.fillStyle = 'rgba(125,159,165,0.07)';
      ctx.fillRect(sx + 60, 255, 160, 150);
      ctx.strokeStyle = 'rgba(132,160,164,0.12)';
      ctx.lineWidth = 4;
      ctx.strokeRect(sx + 60, 255, 160, 150);
      ctx.beginPath();
      ctx.moveTo(sx + 140, 255); ctx.lineTo(sx + 140, 405);
      ctx.moveTo(sx + 60, 330); ctx.lineTo(sx + 220, 330);
      ctx.stroke();
    }

    // A boarded service entrance near the opening area.
    const gateX = screenX(650);
    if (gateX > -350 && gateX < VIEW_W + 50) {
      ctx.fillStyle = '#090e11';
      ctx.fillRect(gateX - 60, 250, 330, 340);
      ctx.fillStyle = '#1c292d';
      ctx.fillRect(gateX - 42, 276, 292, 270);
      ctx.fillStyle = '#0a0e10';
      ctx.fillRect(gateX - 25, 296, 260, 244);
      ctx.strokeStyle = 'rgba(160,175,173,0.24)';
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(gateX - 12, 520); ctx.lineTo(gateX + 220, 320);
      ctx.moveTo(gateX + 4, 330); ctx.lineTo(gateX + 225, 520);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(150,166,162,0.15)';
        ctx.fillRect(gateX - 32, 310 + i * 37, 280, 5);
      }
    }

    // Factory windows in the observation wing.
    const windowX = screenX(3540);
    if (windowX > -700 && windowX < VIEW_W + 80) {
      ctx.fillStyle = '#060b0e';
      ctx.fillRect(windowX, 225, 560, 345);
      ctx.fillStyle = 'rgba(111,143,146,0.11)';
      ctx.fillRect(windowX + 24, 246, 510, 292);
      ctx.strokeStyle = 'rgba(144,174,176,0.22)';
      ctx.lineWidth = 7;
      ctx.strokeRect(windowX + 24, 246, 510, 292);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(windowX + 24 + i * 102, 246);
        ctx.lineTo(windowX + 24 + i * 102, 538);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(windowX + 24, 365); ctx.lineTo(windowX + 534, 365);
      ctx.stroke();
      const labGlow = ctx.createRadialGradient(windowX + 265, 378, 18, windowX + 265, 378, 250);
      labGlow.addColorStop(0, 'rgba(174,198,190,0.13)');
      labGlow.addColorStop(1, 'rgba(174,198,190,0)');
      ctx.fillStyle = labGlow;
      ctx.fillRect(windowX, 220, 560, 350);
      ctx.fillStyle = 'rgba(160,178,171,0.3)';
      ctx.fillRect(windowX + 210, 455, 105, 12);
      ctx.fillRect(windowX + 244, 414, 38, 42);
    }
  }

  function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);

    // Ground and platform geometry.
    for (const s of BASE_SOLIDS) {
      ctx.fillStyle = s.kind === 'platform' ? '#303b3d' : '#141d20';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = s.kind === 'platform' ? '#829092' : '#566365';
      ctx.fillRect(s.x, s.y, s.w, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      for (let x = s.x + 26; x < s.x + s.w; x += 140) ctx.fillRect(x, s.y + 27, 58, 2);
      for (let x = s.x + 72; x < s.x + s.w; x += 210) {
        ctx.fillStyle = 'rgba(150,166,164,0.1)';
        ctx.fillRect(x, s.y + 14, 2, Math.min(220, s.h));
      }
    }

    // The flooded break below the platforms.
    const water = ctx.createLinearGradient(0, 586, 0, 760);
    water.addColorStop(0, 'rgba(27,55,62,0.68)');
    water.addColorStop(1, 'rgba(2,10,14,0.96)');
    ctx.fillStyle = water;
    ctx.fillRect(2180, 590, 360, 220);
    ctx.strokeStyle = 'rgba(131,174,178,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = 612 + i * 24;
      ctx.beginPath();
      for (let x = 2180; x <= 2540; x += 15) {
        const yy = y + Math.sin(x * 0.025 + elapsed * 2 + i) * 3;
        if (x === 2180) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Pressure plate, status light and first sliding gate.
    ctx.fillStyle = '#0b1113';
    ctx.fillRect(plate.x - 8, plate.y + 8, plate.w + 16, 12);
    ctx.fillStyle = isPlateActive() ? '#9fc6b4' : '#4b5b5c';
    ctx.fillRect(plate.x, plate.y, plate.w, 7);
    ctx.fillStyle = isPlateActive() ? 'rgba(133,220,183,0.4)' : 'rgba(170,190,187,0.08)';
    ctx.fillRect(plate.x - 35, plate.y - 18, plate.w + 70, 18);

    if (!isPlateActive()) {
      ctx.fillStyle = '#20292b';
      ctx.fillRect(firstDoor.x, firstDoor.y, firstDoor.w, firstDoor.h);
      ctx.fillStyle = '#596568';
      ctx.fillRect(firstDoor.x + 7, firstDoor.y + 10, 5, firstDoor.h - 20);
      ctx.fillRect(firstDoor.x + 22, firstDoor.y + 10, 5, firstDoor.h - 20);
      ctx.fillStyle = '#c5b98b';
      ctx.fillRect(firstDoor.x + 12, firstDoor.y + 26, 20, 5);
    } else {
      ctx.fillStyle = 'rgba(146,198,172,0.15)';
      ctx.fillRect(firstDoor.x, firstDoor.y, firstDoor.w, firstDoor.h);
    }

    // The pushable crate.
    ctx.fillStyle = '#172124';
    ctx.fillRect(crate.x + 5, crate.y + 6, crate.w, crate.h);
    ctx.fillStyle = '#465255';
    ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
    ctx.strokeStyle = 'rgba(188,197,187,0.34)';
    ctx.lineWidth = 4;
    ctx.strokeRect(crate.x + 4, crate.y + 4, crate.w - 8, crate.h - 8);
    ctx.beginPath();
    ctx.moveTo(crate.x + 8, crate.y + crate.h - 8);
    ctx.lineTo(crate.x + crate.w - 8, crate.y + 8);
    ctx.moveTo(crate.x + 8, crate.y + 8);
    ctx.lineTo(crate.x + crate.w - 8, crate.y + crate.h - 8);
    ctx.stroke();

    // Sweeping searchlight drone.
    ctx.save();
    ctx.translate(drone.x, drone.y);
    ctx.rotate(drone.angle - Math.PI / 2);
    const beam = ctx.createLinearGradient(0, 0, 0, 410);
    beam.addColorStop(0, 'rgba(211,226,210,0.23)');
    beam.addColorStop(0.5, 'rgba(202,219,209,0.11)');
    beam.addColorStop(1, 'rgba(202,219,209,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-115, 410);
    ctx.lineTo(115, 410);
    ctx.lineTo(12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#060b0d';
    ctx.beginPath(); ctx.arc(drone.x, drone.y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a68c4a';
    ctx.beginPath(); ctx.arc(drone.x - 8, drone.y + 4, 3, 0, Math.PI * 2); ctx.arc(drone.x + 8, drone.y + 4, 3, 0, Math.PI * 2); ctx.fill();

    // Switch, final gate, and exit light.
    ctx.fillStyle = '#182326';
    ctx.fillRect(lever.x - 16, lever.y + 38, 62, 38);
    ctx.fillStyle = leverActivated ? '#92bca3' : '#59686a';
    ctx.beginPath();
    ctx.arc(lever.x + 18, lever.y + 15, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#738184';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(lever.x + 18, lever.y + 24);
    ctx.lineTo(lever.x + 28, lever.y + (leverActivated ? 5 : -22));
    ctx.stroke();

    if (!leverActivated) {
      ctx.fillStyle = '#172124';
      ctx.fillRect(finalGate.x, finalGate.y, finalGate.w, finalGate.h);
      ctx.fillStyle = '#5a6668';
      for (let y = finalGate.y + 12; y < finalGate.y + finalGate.h - 4; y += 34) ctx.fillRect(finalGate.x + 8, y, finalGate.w - 16, 5);
    } else {
      ctx.fillStyle = 'rgba(151,205,173,0.14)';
      ctx.fillRect(finalGate.x, finalGate.y, finalGate.w, finalGate.h);
    }
    const exitGlow = ctx.createRadialGradient(exitMarker.x + 34, exitMarker.y + 42, 6, exitMarker.x + 34, exitMarker.y + 42, 150);
    exitGlow.addColorStop(0, leverActivated ? 'rgba(174,218,183,0.38)' : 'rgba(150,169,160,0.07)');
    exitGlow.addColorStop(1, 'rgba(150,169,160,0)');
    ctx.fillStyle = exitGlow;
    ctx.fillRect(exitMarker.x - 120, exitMarker.y - 100, 310, 310);
    ctx.fillStyle = '#253235';
    ctx.fillRect(exitMarker.x, exitMarker.y, exitMarker.w, exitMarker.h);
    ctx.fillStyle = leverActivated ? '#bad9c0' : '#69777a';
    ctx.fillRect(exitMarker.x + 25, exitMarker.y + 18, 20, 95);

    // Checkpoint beacon.
    ctx.fillStyle = '#202a2c';
    ctx.fillRect(checkpointMarker.x, checkpointMarker.y, checkpointMarker.w, checkpointMarker.h);
    ctx.fillStyle = '#9db9ad';
    ctx.beginPath(); ctx.arc(checkpointMarker.x + 10, checkpointMarker.y + 10, 8, 0, Math.PI * 2); ctx.fill();

    drawIndustrialDetails();
    drawPlayer();
    ctx.restore();
  }

  function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const cx = x + player.w / 2;
    const walking = Math.abs(player.vx) > 0.15 && player.grounded;
    const swing = walking ? Math.sin(player.anim) * 8 : 0;
    ctx.save();
    ctx.translate(cx, y + player.h);
    if (player.facing < 0) ctx.scale(-1, 1);

    // Soft floor shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 1, player.crouching ? 24 : 22, 5, 0, 0, Math.PI * 2); ctx.fill();

    if (player.crouching) {
      ctx.fillStyle = '#101719';
      ctx.fillRect(-13, -36, 28, 17);
      ctx.fillStyle = '#6f3432';
      ctx.fillRect(-10, -43, 22, 17);
      ctx.fillStyle = '#080d0f';
      ctx.beginPath(); ctx.arc(4, -51, 11, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#080d0f';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, -31); ctx.lineTo(-10 + swing * 0.5, -4);
      ctx.moveTo(7, -31); ctx.lineTo(10 - swing * 0.5, -4);
      ctx.stroke();
      ctx.fillStyle = '#080d0f';
      ctx.beginPath(); ctx.ellipse(-10 + swing * 0.5, -3, 9, 4, 0, 0, Math.PI * 2); ctx.ellipse(10 - swing * 0.5, -3, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#171e20';
      ctx.fillRect(-13, -72, 26, 43);
      ctx.fillStyle = '#743c39';
      ctx.beginPath(); ctx.moveTo(-14, -69); ctx.lineTo(13, -69); ctx.lineTo(10, -36); ctx.lineTo(-12, -36); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#111719';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-12, -64); ctx.lineTo(-18 - swing * 0.2, -39); ctx.moveTo(12, -64); ctx.lineTo(18 + swing * 0.2, -42); ctx.stroke();
      ctx.fillStyle = '#090f11';
      ctx.beginPath(); ctx.arc(0, -82, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(173,190,185,0.14)';
      ctx.beginPath(); ctx.arc(-4, -87, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawOverlay() {
    // Faint vignette.
    const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 220, VIEW_W / 2, VIEW_H / 2, 770);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.56)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (flashTimer > 0) {
      ctx.fillStyle = `rgba(172,205,190,${flashTimer * 0.15})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (!started) {
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function render() {
    const width = canvas.width;
    const height = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05090b';
    ctx.fillRect(0, 0, width, height);
    scale = Math.min(width / VIEW_W, height / VIEW_H);
    offsetX = (width - VIEW_W * scale) / 2;
    offsetY = (height - VIEW_H * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    drawBackground();
    drawWorld();
    drawOverlay();
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    render();
  }

  function frame(timestamp) {
    if (destroyed) return;
    const dt = last ? clamp((timestamp - last) / 16.667, 0, 2.5) : 1;
    last = timestamp;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'w', 'a', 's', 'd', 'e'].includes(key)) event.preventDefault();
    if (key === 'escape' || key === 'p') {
      if (started && !finished) callbacks.onPauseRequest?.();
      return;
    }
    if (key === 'r') {
      if (started && !finished) resetAtCheckpoint();
      return;
    }
    keysDown.add(key);
    input.left = keysDown.has('a') || keysDown.has('arrowleft');
    input.right = keysDown.has('d') || keysDown.has('arrowright');
    input.jump = keysDown.has(' ') || keysDown.has('w') || keysDown.has('arrowup');
    input.crouch = keysDown.has('s') || keysDown.has('arrowdown');
    input.interact = keysDown.has('e');
  }

  function onKeyUp(event) {
    keysDown.delete(event.key.toLowerCase());
    input.left = keysDown.has('a') || keysDown.has('arrowleft');
    input.right = keysDown.has('d') || keysDown.has('arrowright');
    input.jump = keysDown.has(' ') || keysDown.has('w') || keysDown.has('arrowup');
    input.crouch = keysDown.has('s') || keysDown.has('arrowdown');
    input.interact = keysDown.has('e');
  }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', resize);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    start() { started = true; paused = false; beep(500, 0.08, 'triangle', 0.025); setHint('Find a way through. Stay out of the light.', 4); },
    pause() { paused = true; },
    resume() { if (started && !finished) paused = false; },
    isPaused() { return paused; },
    setInput(name, active) { if (Object.hasOwn(input, name)) input[name] = Boolean(active); },
    setMuted(value) { muted = Boolean(value); },
    restart() {
      checkpointX = 130;
      crate.x = 470; crate.y = FLOOR_Y - crate.h; crate.vx = 0; crate.vy = 0;
      leverActivated = false; plateLatched = false; callbacks.plateDone = false;
      elapsed = 0; chapterIndex = 0; deaths = 0; finished = false;
      currentObjective = CHAPTERS[0].objective;
      resetAtCheckpoint();
      paused = false; started = true;
      callbacks.onHud?.({ chapter: CHAPTERS[0].name, objective: currentObjective, progress: 0, deaths: 0, hint: 'A quiet place. Keep moving.', plateActive: false, powerOn: false });
      setHint('Find a way through. Stay out of the light.', 4);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      if (audioContext) audioContext.close().catch(() => {});
    },
  };
}
