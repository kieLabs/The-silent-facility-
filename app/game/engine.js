import { clamp, moveAxis, overlaps } from '../../lib/physics.js';
import { LEVEL_CHAPTERS, chapterFor, isInWater, beamContains, advanceHoldProgress } from '../../lib/level.js';

// NOCTURNE: original cinematic 2.5D side-scroller. All artwork is procedural Canvas art.
const W = 1280;
const H = 720;
const WORLD = 6300;
const FLOOR = 590;
const LAND_START = 900;
const CHAPTERS = LEVEL_CHAPTERS;

const floorSegments = [
  { x: LAND_START, y: FLOOR, w: 3450, h: 360 },
  { x: 5050, y: FLOOR, w: WORLD - 5050, h: 360 },
];
const bridgePlatforms = [
  { x: 4410, y: 525, w: 130, h: 22 },
  { x: 4600, y: 475, w: 136, h: 22 },
  { x: 4800, y: 510, w: 145, h: 22 },
];
const gate = { x: 1640, y: 392, w: 42, h: 198 };
const crateStart = { x: 1195, y: FLOOR - 76, w: 74, h: 76 };
const lever = { x: 5305, y: FLOOR - 92, w: 42, h: 92 };
const exit = { x: 6030, y: FLOOR - 200, w: 90, h: 200 };
const finalShutter = { x: 5952, y: 205, w: 72, h: 385 };

const rnd = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const rect = (x, y, w, h) => ({ x, y, w, h });

function polygon(ctx, points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}
function glow(ctx, x, y, radius, inner, outer = 'rgba(0,0,0,0)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function drawLimb(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

export function createGame(canvas, callbacks = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');

  let raf = 0, last = 0, elapsed = 0, started = false, paused = true;
  let destroyed = false, finished = false, muted = false, audioContext = null;
  let dpr = 1, cameraX = 0, chapterIndex = 0, lastHudAt = 0;
  let deaths = 0, checkpointX = 900, hintUntil = 0, hintText = 'The water is cold. Follow the light.';
  let gateOpen = false, leverOn = false, gateProgress = 0, leverProgress = 0, crateFade = 1;
  let flash = 0, deathTimer = 0, swimEntryShown = false;
  let jumpWasDown = false;
  const input = { left: false, right: false, jump: false, crouch: false, interact: false };
  const keysDown = new Set();
  const player = { x: 140, y: 345, w: 30, h: 72, vx: 0, vy: 0, grounded: false, facing: 1, crouching: false, anim: 0, swim: true };
  const crate = { ...crateStart, vx: 0, vy: 0, grounded: true };
  const search = { x: 2700, y: 164, angle: 0 };
  const particles = Array.from({ length: 230 }, (_, i) => ({
    x: (rnd(i + 2) * WORLD), y: 40 + rnd(i + 12) * 620,
    r: 0.45 + rnd(i + 21) * 1.8, speed: 0.15 + rnd(i + 31) * 0.6, phase: rnd(i + 41) * 6.28,
  }));
  const bubbles = Array.from({ length: 55 }, (_, i) => ({ x: rnd(i + 50) * 900, y: rnd(i + 90) * 720, r: 1.2 + rnd(i + 120) * 4, speed: 0.5 + rnd(i + 140) * 1.6 }));
  const silhouettes = [
    { x: 170, y: 350, s: 1.05, rot: 0.3 }, { x: 360, y: 305, s: 0.78, rot: -0.2 },
    { x: 570, y: 390, s: 1.15, rot: 0.15 }, { x: 745, y: 290, s: 0.72, rot: -0.35 },
  ];

  function beep(freq = 360, duration = 0.09, type = 'sine', volume = 0.025) {
    if (muted || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioContext) audioContext = new AC();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch { /* Sound is optional. */ }
  }

  function setHint(text, seconds = 3.2) { hintText = text; hintUntil = elapsed + seconds; }
  function inWater() { return isInWater(player.x); }
  function chapterAt(x) { return CHAPTERS.indexOf(chapterFor(x)); }
  function solids() {
    const out = [...floorSegments, ...bridgePlatforms];
    if (!gateOpen) out.push(gate);
    if (!leverOn) out.push(finalShutter);
    return out;
  }
  function resetAtCheckpoint() {
    player.x = checkpointX + (checkpointX < 1500 ? 0 : 30);
    player.y = checkpointX < 900 ? 345 : FLOOR - player.h;
    player.vx = 0; player.vy = 0; player.h = 72; player.w = 30;
    player.crouching = false; player.swim = checkpointX < LAND_START; player.grounded = checkpointX >= LAND_START;
    crate.x = crateStart.x; crate.y = crateStart.y; crate.vx = 0; crate.vy = 0;
    if (checkpointX >= 900) gateOpen = false;
    cameraX = clamp(player.x - 410, 0, WORLD - W);
    deathTimer = 0; flash = 0.75;
  }
  function die(message = 'Something found you.') {
    if (deathTimer > 0 || finished) return;
    deaths += 1; deathTimer = 0.8; setHint(`${message} Returning to the last safe place.`, 1.25); beep(105, 0.24, 'sawtooth', 0.035);
    callbacks.onDeath?.(deaths);
  }
  function canInteract(target, range = 100) {
    return Math.abs((player.x + player.w / 2) - (target.x + target.w / 2)) < range && Math.abs((player.y + player.h / 2) - (target.y + target.h / 2)) < 155;
  }

  function update(dt) {
    elapsed += dt / 60;
    if (!started || paused || finished) return;
    if (deathTimer > 0) { deathTimer -= dt / 60; if (deathTimer <= 0) resetAtCheckpoint(); return; }
    flash = Math.max(0, flash - dt / 60);
    const nextChapter = chapterAt(player.x);
    if (nextChapter !== chapterIndex) {
      chapterIndex = nextChapter;
      callbacks.onChapter?.(CHAPTERS[chapterIndex].name);
      callbacks.onObjective?.(CHAPTERS[chapterIndex].objective);
      setHint(CHAPTERS[chapterIndex].name, 2.4);
      if (chapterIndex === 1 && !swimEntryShown) { swimEntryShown = true; setHint('Get out of the water. The service gate is ahead.', 4); }
    }

    if (inWater()) {
      player.swim = true; player.crouching = false; player.grounded = false;
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.crouch ? 1 : 0) - (input.jump ? 1 : 0);
      player.vx += (dx * 3.25 - player.vx) * Math.min(1, 0.12 * dt);
      player.vy += (dy * 3.0 - player.vy) * Math.min(1, 0.10 * dt);
      player.x += player.vx * dt; player.y += player.vy * dt;
      player.y += Math.sin(elapsed * 1.9 + player.x * 0.015) * 0.16 * dt;
      player.y = clamp(player.y, 105, 632 - player.h);
      player.x = clamp(player.x, 40, LAND_START + 10);
      if (dx) player.facing = dx;
      player.anim += (Math.abs(player.vx) + Math.abs(player.vy)) * dt * 0.045;
      if (player.x >= LAND_START - 18) {
        player.x = LAND_START + 3; player.y = FLOOR - player.h; player.vx = 0; player.vy = 0;
        player.swim = false; player.grounded = true; checkpointX = LAND_START;
        setHint('Air. Concrete under your feet. Keep going.', 3.8); beep(180, 0.15, 'triangle', 0.018);
        callbacks.onCheckpoint?.();
      }
    } else {
      player.swim = false;
      const bottom = player.y + player.h;
      const crouchNow = input.crouch;
      if (crouchNow !== player.crouching) {
        player.crouching = crouchNow; player.h = crouchNow ? 48 : 72; player.y = bottom - player.h;
      }
      const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const speed = player.crouching ? 1.45 : 3.45;
      const targetVx = direction * speed;
      player.vx += (targetVx - player.vx) * Math.min(1, (player.grounded ? 0.34 : 0.13) * dt);
      if (direction) player.facing = direction;
      player.anim += Math.abs(player.vx) * dt * 0.095;

      // The heavy timber crate can be pushed along the floor.
      if (!gateOpen && player.grounded && !player.crouching && direction && overlaps({ ...player, x: player.x + player.vx * dt, y: player.y }, crate)) {
        const nextX = crate.x + direction * Math.abs(player.vx) * dt * 0.92;
        const blocked = !gateOpen && nextX + crate.w > gate.x - 4;
        if (!blocked) { crate.x = clamp(nextX, 1010, gateOpen ? 2150 : 1570); crate.vx = direction * Math.abs(player.vx) * 0.92; }
        else player.vx = 0;
      }
      if (!gateOpen) { crate.vx *= Math.pow(0.72, dt); crate.x += crate.vx * dt; }
      else crateFade = Math.max(0, crateFade - dt / 55);
      if (!gateOpen && player.x > crate.x - player.w && player.x < crate.x + crate.w && player.y + player.h > crate.y + 10 && player.y < crate.y + crate.h) {
        if (player.x < crate.x) player.x = crate.x - player.w;
        else player.x = crate.x + crate.w;
      }
      if (input.jump && !jumpWasDown && player.grounded && !player.crouching) { player.vy = -13.4; player.grounded = false; beep(245, 0.07, 'triangle', 0.02); }
      jumpWasDown = input.jump;
      const colliders = gateOpen ? solids() : [...solids(), crate];
      const hitX = moveAxis(player, player.vx * dt, colliders, 'x');
      if (hitX) player.vx = 0;
      player.vy = Math.min(player.vy + 0.68 * dt, 15);
      player.grounded = false;
      const hitY = moveAxis(player, player.vy * dt, colliders, 'y');
      if (hitY) player.vy = 0;
      if (player.y > 850) die('The flooded shaft swallowed the path.');
    }

    // Hold E near the timber barricade to loosen and break the old boards.
    if (!gateOpen && canInteract(gate, 145) && input.interact) {
      gateProgress = advanceHoldProgress(gateProgress, true, dt, 82);
      if (gateProgress >= 1) { gateOpen = true; crateFade = 1; beep(110, 0.28, 'sawtooth', 0.03); setHint('The rotten boards give way. The passage is open.', 4); }
    } else if (!gateOpen) gateProgress = advanceHoldProgress(gateProgress, false, dt, 70);

    // Searchlight: the cone sweeps across the industrial hall.
    search.angle = Math.sin(elapsed * 0.72) * 0.62;
    if (player.x > 2240 && player.x < 3140 && !player.crouching) {
      const px = player.x + player.w * 0.5, py = player.y + player.h * 0.46;
      if (beamContains({ x: px, y: py }, search, search.angle)) die('The search beam catches your silhouette.');
    }

    // Contextual switch interaction at the far end of the broken walk.
    if (!leverOn && canInteract(lever, 130) && input.interact) {
      leverProgress = advanceHoldProgress(leverProgress, true, dt, 45);
      if (leverProgress >= 1) { leverOn = true; beep(560, 0.23, 'sine', 0.035); setHint('Power restored. The final shutter is opening.', 4); callbacks.onObjective?.('The exit is open. Reach the doorway.'); }
    } else if (!leverOn) leverProgress = advanceHoldProgress(leverProgress, false, dt, 55);

    if (player.x > 3310 && checkpointX < 3300) { checkpointX = 3330; setHint('A quiet checkpoint. Take a breath.', 3.2); callbacks.onCheckpoint?.(); beep(660, 0.13, 'sine', 0.026); }
    if (player.x > 5980 && leverOn) {
      finished = true; beep(760, 0.28, 'sine', 0.035); callbacks.onFinish?.({ deaths, time: Math.floor(elapsed) });
    }

    cameraX += (clamp(player.x - 410, 0, WORLD - W) - cameraX) * Math.min(1, 0.085 * dt);
    if (elapsed - lastHudAt > 0.14) {
      lastHudAt = elapsed;
      callbacks.onHud?.({
        chapter: CHAPTERS[chapterIndex].name,
        objective: chapterIndex === 0 ? CHAPTERS[0].objective : chapterIndex === 1 && !gateOpen ? 'Hold E near the boards to break the barricade.' : chapterIndex === 5 && !leverOn ? 'Hold E beside the switch to release the shutter.' : (leverOn && chapterIndex === 5 ? 'The exit is open. Keep moving.' : CHAPTERS[chapterIndex].objective),
        progress: Math.min(100, Math.round((player.x / 6000) * 100)), deaths,
        hint: elapsed < hintUntil ? hintText : '', plateActive: gateOpen, powerOn: leverOn,
      });
    }
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#080f14'); sky.addColorStop(0.46, '#1a2b31'); sky.addColorStop(1, '#060b0e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // Far industrial skyline — long perspective silhouettes.
    for (let layer = 0; layer < 4; layer++) {
      const parallax = 0.08 + layer * 0.105;
      const step = 520 + layer * 70;
      const offset = -((cameraX * parallax) % step);
      ctx.fillStyle = ['#111d22', '#10191e', '#0c1418', '#080f13'][layer];
      for (let i = -1; i < 5; i++) {
        const x = offset + i * step;
        const base = 525 + layer * 20;
        const roof = 190 + rnd(i + layer * 91) * 110;
        polygon(ctx, [[x, base], [x, roof + 42], [x + 78, roof + 18], [x + 146, roof - 30], [x + 210, roof + 30], [x + 285, roof + 5], [x + 365, base]], ctx.fillStyle);
        ctx.fillRect(x + 55, roof + 70, 8, base - roof - 70);
        ctx.fillRect(x + 300, roof + 25, 17, base - roof - 25);
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = layer === 0 ? 'rgba(173,190,180,.085)' : 'rgba(150,174,177,.04)';
          ctx.fillRect(x + 95 + k * 48, base - 135, 25, 52);
        }
        ctx.fillStyle = ['#111d22', '#10191e', '#0c1418', '#080f13'][layer];
      }
    }
    // Low drifting fog bands create scale and depth.
    for (let i = 0; i < 6; i++) {
      const x = ((i * 247 - cameraX * (0.20 + i * 0.025) + elapsed * (5 + i)) % (W + 500)) - 250;
      const y = 380 + i * 34 + Math.sin(elapsed * 0.22 + i) * 8;
      glow(ctx, x, y, 165 + i * 17, `rgba(142,166,169,${0.025 + i * 0.003})`);
    }
    // Floating dust is fixed in world space so it drifts through the camera.
    for (const p of particles) {
      const sx = p.x - cameraX * 0.55;
      if (sx < -6 || sx > W + 6) continue;
      const a = 0.06 + (Math.sin(elapsed * p.speed + p.phase) + 1) * 0.025;
      ctx.fillStyle = `rgba(202,217,211,${a})`;
      ctx.beginPath(); ctx.arc(sx, p.y + Math.sin(elapsed * 0.35 + p.phase) * 7, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawUnderwater() {
    const water = ctx.createLinearGradient(0, 0, 0, H);
    water.addColorStop(0, '#182d36'); water.addColorStop(0.35, '#263f49'); water.addColorStop(0.7, '#172b34'); water.addColorStop(1, '#07141b');
    ctx.fillStyle = water; ctx.fillRect(0, 0, Math.max(940, W + cameraX + 24), H);
    // Moonlight through the surface.
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(220 + i * 115 + Math.sin(elapsed * 0.15 + i) * 15, 0);
      ctx.rotate((i - 2) * 0.085);
      const beam = ctx.createLinearGradient(0, 0, 0, 570);
      beam.addColorStop(0, 'rgba(197,220,221,.12)'); beam.addColorStop(1, 'rgba(197,220,221,0)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-95, 560); ctx.lineTo(90, 560); ctx.lineTo(15, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Distant underwater structure and ceiling silhouettes.
    polygon(ctx, [[0, 120], [160, 135], [260, 108], [410, 128], [520, 90], [700, 135], [Math.max(940, W + cameraX + 24), 108], [Math.max(940, W + cameraX + 24), 0], [0, 0]], '#0c1b22');
    polygon(ctx, [[0, 680], [145, 648], [305, 666], [480, 638], [660, 664], [820, 642], [Math.max(940, W + cameraX + 24), 668], [Math.max(940, W + cameraX + 24), 720], [0, 720]], '#0a171e');
    // Swaying weeds and root-like growths.
    for (let i = 0; i < 17; i++) {
      const x = 22 + i * 53; const base = 670 + Math.sin(i * 4) * 12;
      ctx.strokeStyle = `rgba(5,15,20,${0.55 + rnd(i) * 0.25})`; ctx.lineWidth = 3 + rnd(i + 20) * 4;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.bezierCurveTo(x - 16, 600, x + Math.sin(elapsed + i) * 25, 535, x + Math.sin(elapsed * .6 + i) * 35, 475 - rnd(i + 5) * 55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, base); ctx.bezierCurveTo(x + 25, 614, x - Math.sin(elapsed + i) * 22, 570, x - 25, 515); ctx.stroke();
    }
    // Suspended human-shaped silhouettes (environmental storytelling, non-interactive).
    for (const s of silhouettes) {
      ctx.save(); ctx.translate(s.x, s.y + Math.sin(elapsed * 0.7 + s.x) * 7); ctx.rotate(s.rot); ctx.scale(s.s, s.s);
      ctx.strokeStyle = 'rgba(4,12,17,.86)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(1, 32); ctx.moveTo(0, 0); ctx.lineTo(-14, 20); ctx.moveTo(0, 2); ctx.lineTo(17, 18); ctx.moveTo(1, 30); ctx.lineTo(-10, 61); ctx.moveTo(1, 30); ctx.lineTo(12, 59); ctx.stroke();
      ctx.fillStyle = 'rgba(3,10,15,.92)'; ctx.beginPath(); ctx.ellipse(0, -24, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Bubbles.
    for (const b of bubbles) {
      const y = ((b.y - elapsed * 28 * b.speed) % 780 + 780) % 780;
      ctx.strokeStyle = 'rgba(200,225,229,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, y, b.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(213,235,236,.04)'; ctx.fill();
    }
    glow(ctx, 590, 330, 265, 'rgba(202,226,229,.26)', 'rgba(0,0,0,0)');
    // Surface boundary, rippling at the escape point.
    const surface = ctx.createLinearGradient(0, 0, 0, 35); surface.addColorStop(0, 'rgba(190,221,219,.24)'); surface.addColorStop(1, 'rgba(190,221,219,0)');
    ctx.fillStyle = surface; ctx.fillRect(885, 0, 65, H);
    ctx.strokeStyle = 'rgba(190,218,218,.28)'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let y = 0; y <= H; y += 18) { const x = 910 + Math.sin(y * .028 + elapsed * 1.1) * 5; if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
  }

  function drawFloorAndPlatforms() {
    for (const s of floorSegments) {
      const g = ctx.createLinearGradient(0, s.y, 0, s.y + 240);
      g.addColorStop(0, '#394448'); g.addColorStop(.06, '#222d31'); g.addColorStop(1, '#080e12');
      ctx.fillStyle = g; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = 'rgba(182,194,182,.25)'; ctx.fillRect(s.x, s.y, s.w, 3);
      for (let x = s.x + 20; x < s.x + s.w; x += 95) {
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x, s.y + 18 + rnd(x) * 16, 42, 2);
        ctx.fillStyle = 'rgba(180,193,183,.06)'; ctx.fillRect(x + 40, s.y + 2, 1, 45 + rnd(x + 2) * 80);
      }
    }
    for (const p of bridgePlatforms) {
      ctx.fillStyle = '#29363b'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#a2acad'; ctx.fillRect(p.x, p.y, p.w, 3);
      ctx.fillStyle = 'rgba(0,0,0,.44)'; ctx.fillRect(p.x + 6, p.y + 5, p.w - 12, p.h - 6);
      for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(180,194,194,.14)'; ctx.beginPath(); ctx.moveTo(p.x + 10 + i * 30, p.y + 4); ctx.lineTo(p.x + 4 + i * 34, p.y + p.h - 4); ctx.stroke(); }
    }
    // Water and deep void under the broken walkway.
    const water = ctx.createLinearGradient(0, FLOOR + 8, 0, H + 220);
    water.addColorStop(0, '#172f37'); water.addColorStop(.28, '#0d2029'); water.addColorStop(1, '#02090e');
    ctx.fillStyle = water; ctx.fillRect(4260, FLOOR, 810, 300);
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = `rgba(151,188,192,${.05 + i * .006})`; ctx.lineWidth = 2;
      ctx.beginPath(); for (let x = 4260; x <= 5070; x += 24) { const y = FLOOR + 18 + i * 24 + Math.sin(x * .025 + elapsed * 1.2 + i) * 3; if (x === 4260) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    }
  }

  function drawTimberGate() {
    const x = 1450;
    // Massive recessed doorway with perspective timber frame.
    ctx.fillStyle = '#090f12'; ctx.fillRect(x - 135, 145, 490, 447);
    polygon(ctx, [[x - 108, 165], [x + 245, 190], [x + 245, 590], [x - 108, 590]], '#172126', '#303b3f', 6);
    polygon(ctx, [[x - 70, 212], [x + 212, 230], [x + 212, 588], [x - 70, 588]], '#080d10', '#3f4947', 5);
    const boardAlpha = gateOpen ? .22 : .9;
    ctx.save(); ctx.globalAlpha = boardAlpha;
    for (let i = 0; i < 7; i++) {
      const y = 258 + i * 45;
      ctx.fillStyle = i % 2 ? '#4b4a40' : '#343a36';
      ctx.fillRect(x - 55, y, 260, 17 + (i % 3) * 3);
      ctx.fillStyle = 'rgba(191,177,143,.18)'; ctx.fillRect(x - 48, y + 2, 240, 2);
      for (let k = 0; k < 5; k++) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x - 45 + k * 54, y + 8, 27, 1); }
    }
    ctx.strokeStyle = '#827b66'; ctx.lineWidth = 15; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.moveTo(x - 55, 545); ctx.lineTo(x + 202, 275); ctx.moveTo(x - 55, 285); ctx.lineTo(x + 202, 542); ctx.stroke();
    ctx.strokeStyle = 'rgba(10,13,13,.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 40, 534); ctx.lineTo(x + 190, 292); ctx.stroke();
    ctx.restore();
    if (!gateOpen) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 135, 590, 495, 28);
      glow(ctx, x + 65, 420, 180, 'rgba(189,176,134,.06)');
    } else {
      const openGlow = ctx.createLinearGradient(x, 220, x + 300, 590); openGlow.addColorStop(0, 'rgba(188,205,196,.13)'); openGlow.addColorStop(1, 'rgba(188,205,196,0)');
      ctx.fillStyle = openGlow; ctx.fillRect(x - 70, 220, 290, 360);
    }
    // Loose splintered beams on the ground.
    ctx.fillStyle = '#262c2b'; polygon(ctx, [[x - 100, 610], [x + 70, 595], [x + 190, 605], [x + 4, 621]], '#202829');
  }

  function drawSearchlightHall() {
    // tall concrete columns and steel trusses
    for (let i = 0; i < 5; i++) {
      const x = 2070 + i * 255;
      ctx.fillStyle = 'rgba(3,8,11,.72)'; ctx.fillRect(x, 140 + (i % 2) * 45, 32, 455);
      ctx.fillStyle = 'rgba(142,163,162,.09)'; ctx.fillRect(x + 32, 195, 160, 8);
      ctx.strokeStyle = 'rgba(158,177,173,.10)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 32, 196); ctx.lineTo(x + 160, 292); ctx.lineTo(x + 210, 196); ctx.stroke();
      for (let j = 0; j < 3; j++) { ctx.fillStyle = 'rgba(176,192,187,.045)'; ctx.fillRect(x + 60 + j * 43, 305, 27, 78); }
    }
    // Distant machinery and a large lamp head.
    ctx.fillStyle = '#070d10'; ctx.fillRect(2580, 112, 245, 46);
    polygon(ctx, [[2660, 156], [2780, 156], [2807, 210], [2635, 210]], '#141d20', '#3b4748', 4);
    glow(ctx, search.x, search.y + 48, 255, 'rgba(204,219,210,.12)');
    // moving light cone, projected in world coordinates
    ctx.save(); ctx.translate(search.x, search.y); ctx.rotate(search.angle);
    const cone = ctx.createLinearGradient(0, 0, 0, 540);
    cone.addColorStop(0, 'rgba(231,237,215,.34)'); cone.addColorStop(.32, 'rgba(213,225,210,.16)'); cone.addColorStop(1, 'rgba(205,218,208,0)');
    polygon(ctx, [[-11, 0], [-180, 530], [180, 530], [11, 0]], cone);
    ctx.restore();
    // dark security camera with twin amber lenses
    ctx.fillStyle = '#060a0d'; ctx.fillRect(search.x - 42, search.y - 16, 84, 34);
    ctx.fillStyle = '#1c272a'; ctx.fillRect(search.x - 30, search.y - 25, 60, 18);
    glow(ctx, search.x - 14, search.y + 2, 28, 'rgba(222,170,67,.15)');
    ctx.fillStyle = '#d7a84f'; ctx.beginPath(); ctx.arc(search.x - 13, search.y + 3, 4, 0, Math.PI * 2); ctx.arc(search.x + 13, search.y + 3, 4, 0, Math.PI * 2); ctx.fill();
    // crate-like cover in the hall
    ctx.fillStyle = '#151f22'; ctx.fillRect(2345, 480, 115, 110); ctx.strokeStyle = 'rgba(162,178,170,.18)'; ctx.lineWidth = 3; ctx.strokeRect(2350, 485, 105, 100);
    ctx.beginPath(); ctx.moveTo(2355, 490); ctx.lineTo(2450, 580); ctx.moveTo(2450, 490); ctx.lineTo(2355, 580); ctx.stroke();
  }

  function drawObservationWing() {
    const x = 3400;
    // Glass-fronted room set into a monolithic dark building.
    ctx.fillStyle = '#060b0e'; ctx.fillRect(x - 85, 140, 690, 465);
    polygon(ctx, [[x - 55, 170], [x + 575, 170], [x + 555, 575], [x - 55, 575]], '#18252a', '#354346', 8);
    ctx.fillStyle = '#0b151a'; ctx.fillRect(x - 31, 203, 565, 345);
    const interior = ctx.createLinearGradient(0, 205, 0, 550); interior.addColorStop(0, 'rgba(140,164,164,.23)'); interior.addColorStop(1, 'rgba(40,58,61,.12)');
    ctx.fillStyle = interior; ctx.fillRect(x - 26, 208, 554, 336);
    // Visible room, table and equipment behind glass.
    glow(ctx, x + 250, 380, 230, 'rgba(194,207,193,.11)');
    ctx.fillStyle = 'rgba(5,11,14,.8)'; ctx.fillRect(x + 90, 441, 270, 16);
    ctx.fillRect(x + 120, 457, 16, 65); ctx.fillRect(x + 324, 457, 16, 65);
    ctx.fillStyle = 'rgba(177,195,187,.25)'; ctx.fillRect(x + 198, 385, 80, 48);
    ctx.fillStyle = 'rgba(3,8,10,.8)'; ctx.fillRect(x + 211, 358, 49, 28);
    // silhouettes observing something inside
    drawFigure(x + 165, 438, .74, 'rgba(5,10,12,.88)', 0);
    drawFigure(x + 390, 438, .84, 'rgba(5,10,12,.92)', 0);
    ctx.strokeStyle = 'rgba(170,193,188,.25)'; ctx.lineWidth = 6;
    ctx.strokeRect(x - 28, 205, 558, 341);
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - 28 + i * 112, 205); ctx.lineTo(x - 28 + i * 112, 546); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x - 28, 365); ctx.lineTo(x + 530, 365); ctx.stroke();
    // Reflections and fingerprints on glass
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(205,222,218,${.025 + rnd(i) * .035})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 10 + i * 39, 220); ctx.lineTo(x + 32 + i * 37, 525); ctx.stroke();
    }
    // Safety rail outside the room.
    ctx.strokeStyle = '#121c20'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x + 590, 420); ctx.lineTo(x + 780, 420); ctx.moveTo(x + 590, 420); ctx.lineTo(x + 590, 585); ctx.moveTo(x + 780, 420); ctx.lineTo(x + 780, 585); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 590, 477); ctx.lineTo(x + 780, 477); ctx.moveTo(x + 590, 535); ctx.lineTo(x + 780, 535); ctx.stroke();
  }

  function drawFigure(x, y, scale = 1, color = '#05090b', phase = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, -60, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-9, -49, 18, 35);
    drawLimb(ctx, -5, -18, -8 + Math.sin(phase) * 2, 0, 6, color);
    drawLimb(ctx, 5, -18, 8 - Math.sin(phase) * 2, 0, 6, color);
    drawLimb(ctx, -8, -43, -15, -23, 5, color); drawLimb(ctx, 8, -43, 15, -23, 5, color);
    ctx.restore();
  }

  function drawWalkway() {
    // The open shaft is crossed by staggered concrete and timber slabs.
    for (let i = 0; i < 6; i++) {
      const x = 4245 + i * 150;
      const y = 120 + (i % 3) * 58;
      ctx.fillStyle = '#0a1217'; ctx.fillRect(x, y, 82, 420 - (i % 2) * 35);
      ctx.fillStyle = 'rgba(133,157,159,.09)'; ctx.fillRect(x + 10, y + 16, 5, 300);
    }
    // Far-side light spills across the broken edges.
    glow(ctx, 4910, 420, 300, 'rgba(185,205,199,.12)');
    ctx.save(); ctx.translate(4320, 0);
    const shaft = ctx.createLinearGradient(0, 200, 0, 640); shaft.addColorStop(0, 'rgba(208,225,220,.18)'); shaft.addColorStop(1, 'rgba(208,225,220,0)');
    ctx.fillStyle = shaft; ctx.beginPath(); ctx.moveTo(360, 200); ctx.lineTo(95, 640); ctx.lineTo(610, 640); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Broken timber edges and loose planks.
    ctx.fillStyle = '#303638'; polygon(ctx, [[4380, 550], [4510, 548], [4495, 562], [4380, 565]], '#303638');
    ctx.fillStyle = '#3a3c37'; polygon(ctx, [[4690, 505], [4810, 508], [4790, 522], [4690, 520]], '#3a3c37');
    ctx.fillStyle = '#1d272b'; ctx.save(); ctx.translate(4865, 485); ctx.rotate(.12); ctx.fillRect(0, 0, 105, 9); ctx.restore();
  }

  function drawLastHall() {
    // A vast opening into a mist-filled courtyard.
    ctx.fillStyle = '#060b0e'; ctx.fillRect(5350, 100, 600, 500);
    polygon(ctx, [[5400, 128], [5910, 140], [5910, 590], [5400, 590]], '#0b151a', '#1d2a2e', 16);
    const distant = ctx.createLinearGradient(0, 160, 0, 590); distant.addColorStop(0, '#1c3037'); distant.addColorStop(.55, '#263c42'); distant.addColorStop(1, '#0b171c');
    ctx.fillStyle = distant; ctx.fillRect(5420, 155, 465, 435);
    glow(ctx, 5660, 390, 285, 'rgba(181,204,202,.23)');
    // procession of distant worker silhouettes
    for (let i = 0; i < 8; i++) {
      const x = 5500 + i * 48 + Math.sin(elapsed * .35 + i) * 2;
      const s = .56 + rnd(i + 9) * .18;
      drawFigure(x, 545, s, 'rgba(4,9,12,.86)', elapsed + i);
    }
    // Large shutter frame that opens after the switch is activated.
    if (!leverOn) {
      ctx.fillStyle = '#182428'; ctx.fillRect(5952, 205, 72, 385);
      for (let y = 220; y < 580; y += 36) { ctx.fillStyle = '#455053'; ctx.fillRect(5960, y, 56, 5); }
      ctx.fillStyle = '#c0ab78'; ctx.fillRect(5971, 365, 26, 8);
    } else {
      ctx.fillStyle = 'rgba(180,211,197,.12)'; ctx.fillRect(5952, 205, 72, 385);
      glow(ctx, 6015, 400, 210, 'rgba(202,222,208,.17)');
    }
  }

  function drawCrateAndSwitch() {
    // heavy timber crate
    if (crateFade > 0) {
      ctx.save(); ctx.globalAlpha = crateFade;
      ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(crate.x + 35, FLOOR + 3, 64, 8, 0, 0, Math.PI * 2); ctx.fill();
      const cg = ctx.createLinearGradient(crate.x, crate.y, crate.x + crate.w, crate.y + crate.h); cg.addColorStop(0, '#59605a'); cg.addColorStop(.55, '#333d3a'); cg.addColorStop(1, '#151f22');
      ctx.fillStyle = cg; ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
      ctx.strokeStyle = 'rgba(190,192,166,.35)'; ctx.lineWidth = 4; ctx.strokeRect(crate.x + 4, crate.y + 4, crate.w - 8, crate.h - 8);
      ctx.beginPath(); ctx.moveTo(crate.x + 8, crate.y + 8); ctx.lineTo(crate.x + crate.w - 8, crate.y + crate.h - 8); ctx.moveTo(crate.x + crate.w - 8, crate.y + 8); ctx.lineTo(crate.x + 8, crate.y + crate.h - 8); ctx.stroke();
      ctx.restore();
    }
    // Switch console
    ctx.fillStyle = '#111c20'; ctx.fillRect(lever.x - 25, lever.y + 42, 90, 50);
    ctx.fillStyle = '#424c49'; ctx.fillRect(lever.x - 18, lever.y + 49, 76, 37);
    glow(ctx, lever.x + 20, lever.y + 12, 55, leverOn ? 'rgba(142,223,172,.35)' : 'rgba(196,160,82,.12)');
    ctx.fillStyle = leverOn ? '#8dc39d' : '#b99b59'; ctx.beginPath(); ctx.arc(lever.x + 20, lever.y + 13, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#818a7c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(lever.x + 20, lever.y + 24); ctx.lineTo(lever.x + 34, lever.y + (leverOn ? 2 : -22)); ctx.stroke();
  }

  function drawPlayer() {
    const x = player.x + player.w / 2;
    const y = player.y + player.h;
    const moving = Math.abs(player.vx) + Math.abs(player.vy) > .35;
    const stride = moving ? Math.sin(player.anim) * (player.swim ? 9 : 8) : 0;
    ctx.save(); ctx.translate(x, y); if (player.facing < 0) ctx.scale(-1, 1);
    // Floor/contact shadow; underwater shadow is softer and displaced.
    ctx.fillStyle = player.swim ? 'rgba(0,5,9,.18)' : 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.ellipse(0, player.swim ? 13 : 2, player.swim ? 28 : 22, player.swim ? 6 : 4, 0, 0, Math.PI * 2); ctx.fill();
    if (player.swim) {
      // Horizontal swimming silhouette with little red jacket detail.
      ctx.save(); ctx.rotate(clamp(player.vy * .035, -.28, .28));
      drawLimb(ctx, -2, -43, -22 + stride, -27, 7, '#080e11');
      drawLimb(ctx, 2, -43, 23 - stride, -28, 7, '#080e11');
      ctx.fillStyle = '#131c20'; ctx.beginPath(); ctx.ellipse(0, -43, 13, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#733b39'; ctx.beginPath(); ctx.ellipse(1, -49, 13, 13, -.12, 0, Math.PI * 2); ctx.fill();
      drawLimb(ctx, -6, -53, -22, -67 + stride * .35, 5, '#101719');
      drawLimb(ctx, 6, -53, 22, -62 - stride * .35, 5, '#101719');
      ctx.fillStyle = '#080e11'; ctx.beginPath(); ctx.arc(0, -69, 10, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (player.crouching) {
      drawLimb(ctx, -7, -22, -18, -2, 8, '#070c0f'); drawLimb(ctx, 7, -22, 20, -2, 8, '#070c0f');
      ctx.fillStyle = '#11191c'; ctx.fillRect(-14, -38, 29, 23);
      ctx.fillStyle = '#703936'; polygon(ctx, [[-14, -41], [12, -41], [17, -18], [-11, -18]], '#703936');
      ctx.fillStyle = '#080e11'; ctx.beginPath(); ctx.arc(9, -48, 11, 0, Math.PI * 2); ctx.fill();
    } else {
      drawLimb(ctx, -6, -30, -9 + stride * .55, -2, 8, '#080e11');
      drawLimb(ctx, 6, -30, 9 - stride * .55, -2, 8, '#080e11');
      ctx.fillStyle = '#070c0f'; ctx.beginPath(); ctx.ellipse(-10 + stride * .55, -2, 9, 4, 0, 0, Math.PI * 2); ctx.ellipse(10 - stride * .55, -2, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#121a1d'; ctx.fillRect(-13, -66, 26, 38);
      polygon(ctx, [[-14, -64], [13, -64], [12, -31], [-12, -31]], '#743c39');
      // Jacket seam and shoulder folds catch a very small amount of cold light.
      ctx.strokeStyle = 'rgba(185,147,130,.22)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-5, -60); ctx.lineTo(-7, -34); ctx.stroke();
      drawLimb(ctx, -12, -59, -18 - stride * .22, -35, 6, '#11191c');
      drawLimb(ctx, 12, -59, 17 + stride * .22, -39, 6, '#11191c');
      ctx.fillStyle = '#070d10'; ctx.beginPath(); ctx.arc(0, -77, 12.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(160,173,168,.12)'; ctx.beginPath(); ctx.arc(-4, -82, 4, 0, Math.PI * 2); ctx.fill();
      // Small hair silhouette on back of head.
      polygon(ctx, [[-10, -85], [-15, -91], [-8, -89], [-4, -94], [0, -87]], '#050a0c');
    }
    ctx.restore();
  }

  function drawInteractionPrompt() {
    let target = null, label = '';
    if (!gateOpen && canInteract(gate, 145)) { target = gate; label = 'HOLD  E  ·  BREAK BOARDS'; }
    else if (!leverOn && canInteract(lever, 130)) { target = lever; label = 'HOLD  E  ·  RELEASE SWITCH'; }
    if (!target || !started || paused) return;
    const sx = target.x + target.w / 2 - cameraX;
    ctx.save(); ctx.font = '10px monospace'; const width = ctx.measureText(label).width + 24;
    ctx.fillStyle = 'rgba(3,8,10,.82)'; ctx.fillRect(sx - width / 2, target.y - 45, width, 28);
    ctx.strokeStyle = 'rgba(210,221,207,.35)'; ctx.strokeRect(sx - width / 2, target.y - 45, width, 28);
    ctx.fillStyle = '#d6dfd6'; ctx.textAlign = 'center'; ctx.fillText(label, sx, target.y - 27);
    const progress = target === gate ? gateProgress : leverProgress;
    ctx.fillStyle = 'rgba(216,228,216,.25)'; ctx.fillRect(sx - width / 2, target.y - 13, width, 2);
    ctx.fillStyle = '#a8c7ae'; ctx.fillRect(sx - width / 2, target.y - 13, width * progress, 2);
    ctx.restore();
  }

  function drawLightAtmosphere() {
    // A little floor bounce, cinematic vignette and cold lens falloff.
    const edge = ctx.createRadialGradient(W / 2, H / 2, 230, W / 2, H / 2, 780);
    edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,.68)'); ctx.fillStyle = edge; ctx.fillRect(0, 0, W, H);
    const topShade = ctx.createLinearGradient(0, 0, 0, 170); topShade.addColorStop(0, 'rgba(0,0,0,.5)'); topShade.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = topShade; ctx.fillRect(0, 0, W, 170);
    if (flash > 0) { ctx.fillStyle = `rgba(180,211,195,${flash * .14})`; ctx.fillRect(0, 0, W, H); }
  }

  function render() {
    const boxW = canvas.width, boxH = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#050a0e'; ctx.fillRect(0, 0, boxW, boxH);
    const scale = Math.min(boxW / W, boxH / H);
    const ox = (boxW - W * scale) / 2, oy = (boxH - H * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    drawBackground();
    ctx.save(); ctx.translate(-cameraX, 0);
    if (cameraX < 920) drawUnderwater();
    drawTimberGate(); drawSearchlightHall(); drawObservationWing(); drawWalkway(); drawLastHall();
    drawFloorAndPlatforms(); drawCrateAndSwitch(); drawPlayer();
    // Water-edge transition spray near the shoreline.
    if (cameraX < 920) {
      glow(ctx, 900, 560, 80, 'rgba(175,204,203,.11)');
      for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(194,220,220,${.07 + rnd(i) * .12})`; ctx.fillRect(890 + rnd(i + 30) * 26, 510 + rnd(i + 60) * 125, 2, 14); }
    }
    ctx.restore();
    drawInteractionPrompt(); drawLightAtmosphere();
  }

  function resize() {
    const box = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * dpr)); canvas.height = Math.max(1, Math.round(box.height * dpr)); render();
  }
  function frame(timestamp) {
    if (destroyed) return;
    const dt = last ? clamp((timestamp - last) / 16.667, 0, 2.3) : 1;
    last = timestamp; update(dt); render(); raf = requestAnimationFrame(frame);
  }
  function syncInput() {
    input.left = keysDown.has('a') || keysDown.has('arrowleft');
    input.right = keysDown.has('d') || keysDown.has('arrowright');
    input.jump = keysDown.has(' ') || keysDown.has('w') || keysDown.has('arrowup');
    input.crouch = keysDown.has('s') || keysDown.has('arrowdown');
    input.interact = keysDown.has('e');
  }
  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'w', 'a', 's', 'd', 'e'].includes(key)) event.preventDefault();
    if (key === 'escape' || key === 'p') { if (started && !finished) callbacks.onPauseRequest?.(); return; }
    if (key === 'r') { if (started && !finished) resetAtCheckpoint(); return; }
    keysDown.add(key); syncInput();
  }
  function onKeyUp(event) { keysDown.delete(event.key.toLowerCase()); syncInput(); }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp); window.addEventListener('resize', resize);
  resize(); raf = requestAnimationFrame(frame);

  return {
    start() { started = true; paused = false; beep(165, .22, 'sine', .02); setHint('The cold water carries no sound. Follow the pale glow.', 4.5); },
    pause() { paused = true; }, resume() { if (started && !finished) paused = false; }, isPaused() { return paused; },
    setInput(name, active) { if (Object.hasOwn(input, name)) input[name] = Boolean(active); },
    setMuted(value) { muted = Boolean(value); },
    restart() {
      elapsed = 0; deaths = 0; checkpointX = 140; cameraX = 0; chapterIndex = 0;
      gateOpen = false; leverOn = false; gateProgress = 0; leverProgress = 0; crateFade = 1; finished = false; swimEntryShown = false;
      crate.x = crateStart.x; crate.y = crateStart.y; crate.vx = 0; crate.vy = 0;
      player.x = 140; player.y = 345; player.w = 30; player.h = 72; player.vx = 0; player.vy = 0; player.swim = true; player.crouching = false;
      resetAtCheckpoint(); paused = false; started = true; callbacks.onHud?.({ chapter: CHAPTERS[0].name, objective: CHAPTERS[0].objective, progress: 0, deaths: 0, hint: 'The cold water carries no sound.', plateActive: false, powerOn: false });
    },
    destroy() {
      destroyed = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('resize', resize);
      if (audioContext) audioContext.close().catch(() => {});
    },
  };
}
