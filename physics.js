/** Small deterministic collision helpers shared by the game engine and tests. */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Move an axis-aligned body and resolve collisions on one axis. */
export function moveAxis(body, amount, solids, axis) {
  if (!Number.isFinite(amount) || (axis !== 'x' && axis !== 'y')) {
    throw new TypeError('moveAxis expects a finite amount and axis "x" or "y"');
  }
  body[axis] += amount;
  let collided = false;
  for (const solid of solids) {
    if (!overlaps(body, solid)) continue;
    collided = true;
    if (axis === 'x') {
      if (amount > 0) body.x = solid.x - body.w;
      else if (amount < 0) body.x = solid.x + solid.w;
    } else {
      if (amount > 0) {
        body.y = solid.y - body.h;
        body.grounded = true;
      } else if (amount < 0) {
        body.y = solid.y + solid.h;
      }
    }
  }
  return collided;
}

export function moveBody(body, dx, dy, solids) {
  const hitX = moveAxis(body, dx, solids, 'x');
  body.grounded = false;
  const hitY = moveAxis(body, dy, solids, 'y');
  return { hitX, hitY, grounded: body.grounded };
}
