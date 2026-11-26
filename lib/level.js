export const LEVEL_CHAPTERS = Object.freeze([
  { at: 0, end: 900, name: 'THE DROWNED', objective: 'Swim toward the pale light. Keep moving right.' },
  { at: 900, end: 2050, name: 'THE TIMBER GATE', objective: 'Find a way through the barricaded service entrance.' },
  { at: 2050, end: 3200, name: 'THE WATCHER', objective: 'Cross the searchlight hall without being seen.' },
  { at: 3200, end: 4320, name: 'OBSERVATION WING', objective: 'Move quietly past the glass rooms.' },
  { at: 4320, end: 5200, name: 'THE HOLLOW WALK', objective: 'Cross the broken platforms above the dark water.' },
  { at: 5200, end: 6300, name: 'THE LAST CROWD', objective: 'Find the release switch and reach the open doorway.' },
]);

export function chapterFor(worldX) {
  return LEVEL_CHAPTERS.find((chapter) => worldX >= chapter.at && worldX < chapter.end) ?? LEVEL_CHAPTERS.at(-1);
}

export function isInWater(worldX) {
  return Number.isFinite(worldX) && worldX < 892;
}

/** Tests whether a point lies inside a downward-facing, rotating searchlight cone. */
export function beamContains(point, light, angle, maxLength = 520, spread = 0.13) {
  const dx = point.x - light.x;
  const dy = point.y - light.y;
  const along = dx * Math.sin(angle) + dy * Math.cos(angle);
  const across = Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle));
  return along > 30 && along < maxLength && across < along * spread + 18;
}

export function advanceHoldProgress(current, holding, deltaFrames, durationFrames) {
  if (![current, deltaFrames, durationFrames].every(Number.isFinite) || durationFrames <= 0 || deltaFrames < 0) {
    throw new TypeError('Invalid interaction progress arguments.');
  }
  const next = holding
    ? current + deltaFrames / durationFrames
    : current - deltaFrames / (durationFrames * 2);
  return Math.max(0, Math.min(1, next));
}
