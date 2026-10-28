// Sounds for what the isometric view shows: a burning building's crackle, a hearth's, doors swinging. Pure (no audio, no Pixi), so
// the tests can reach it; main.ts feeds the results to ambience.ts. Both are heard by how near the middle of the view
// they are (soundZones.ts `nearness`, `zoomGain`), and the view is the iso camera's patch of land (world px).

import { nearness, panAt, zoomGain, MORE_SHARE, type View } from './soundZones';

/** A burning building's loudness at its quietest (just alight) and the rest it gains as it burns. */
export const BURN_FLOOR = 0.35;

/** How loud the fires of burning buildings are heard, 0 to 1: the nearest the most, the more it has burned the louder,
 *  a little more for each other; `fire` is how far each has burned (0..1). */
export function burnLevel(burning: readonly { x: number; y: number; fire: number }[], v: View): number {
  let most = 0;
  let rest = 0;
  for (const b of burning) {
    const heard = (BURN_FLOOR + (1 - BURN_FLOOR) * Math.max(0, Math.min(1, b.fire))) * nearness(v, b.x, b.y);
    if (heard > most) {
      rest += most;
      most = heard;
    } else rest += heard;
  }
  return Math.min(1, (most + rest * MORE_SHARE) * zoomGain(v));
}

/** The town's fires that burn on purpose (a campfire, the storyteller's circle, a bonfire or a brazier): each crackles
 *  where it stands, as the camp's fire always did (the owner: "a crackling fire"). */
export const HEARTH = /campfire|storyteller|bonfire|brazier|fire_pit|firepit/;

/** How loud the town's hearths crackle, 0 to 1: the one nearest the middle of the view, a little more for each other;
 *  only finished ones burn. */
export function hearthLevel(buildings: readonly { def: string; status: string; x: number; y: number }[], v: View): number {
  let most = 0;
  let rest = 0;
  for (const b of buildings) {
    if (b.status !== 'done' || !HEARTH.test(b.def)) continue;
    const heard = nearness(v, b.x, b.y);
    if (heard > most) {
      rest += most;
      most = heard;
    } else rest += heard;
  }
  return Math.min(1, (most + rest * MORE_SHARE) * zoomGain(v));
}

/** The longest gap (s) between two door sounds, and the nearness below which a door is too far to hear. */
export const DOOR_GAP = 1.4;
export const DOOR_NEAR = 0.2;

/** A door that has just begun to swing open at (x, y): the sound to make (its pan and a 0..1 loudness) or null if it
 *  is too far, or another door was heard less than `DOOR_GAP` seconds ago. Sparing and quiet by design. */
export function doorSound(v: View, x: number, y: number, sinceLast: number): { pan: number; level: number } | null {
  if (sinceLast < DOOR_GAP) return null;
  const n = nearness(v, x, y);
  if (n < DOOR_NEAR) return null;
  return { pan: panAt(v, x), level: n };
}
