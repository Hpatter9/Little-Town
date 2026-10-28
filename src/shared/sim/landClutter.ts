// Stumps and ruins: what lies on open ground that the Clear tool takes away (the owner's asks: "clear stumps with clear
// land too", and a ruin's old walls must be removable). A stump stands on a wood felled and not yet grown back
// (`LandMap.regrow`, was 'forest'); a ruin is a starting valley's landmark (sim/startValleys.ts: old walls, a broken
// pillar, a cart...) on the ground the valley laid, not yet cleared (`LandMap.cleared`). Marking one (`markClear`) gives
// it a small pool to work, as a wild cell has: a stump some wood, a ruin its stones. When that is worked out the cell
// is clear for good: the stump grubbed out (the wood won't grow back there) or the ruin gone (the map stops drawing it).

import type { Material } from '../data/materials';
import type { WorkAnim } from '../data/terrain';
import { valleyById, valleyCells, valleyLandmarks, type LandmarkKind } from './startValleys';
import { groundAt, WILD, type Ground, type LandMap } from './land';
import { builtOnNow } from './buildings';
import type { GameState } from './state';

export type ClutterKind = 'stump' | 'ruin';

/** How a piece of clutter is worked: like a wild cell's TERRAIN entry (data/terrain.ts). */
export const CLUTTER_WORK: Readonly<Record<ClutterKind, { name: string; verb: string; anim: WorkAnim; secondsPerUnit: number }>> = {
  stump: { name: 'A stump', verb: 'Grubbing out', anim: 'chop', secondsPerUnit: 8 },
  ruin: { name: 'Old ruins', verb: 'Clearing', anim: 'mine', secondsPerUnit: 10 },
};

/** Landmarks that are only the land's dressing, never cleared: the reeds and the flowers. */
const DRESSING: readonly LandmarkKind[] = ['reeds', 'flowers'];

/** What working a piece of clutter out yields, all told (its pool when marked). */
export function clutterPool(kind: ClutterKind, mark?: LandmarkKind): Partial<Record<Material, number>> {
  if (kind === 'stump' || mark === 'stump') return { wood: 2 };
  if (mark === 'cart' || mark === 'signpost') return { wood: 3 };
  if (mark === 'bones' || mark === 'skeleton') return { bone: 2 };
  return { stone: mark === 'wall' || mark === 'ruin' ? 4 : 3 };
}

/** A starting valley's landmarks on this land, by cell, with the ground the valley laid under each ('grass' where it
 *  laid none), as the map draws them (iso/isoView.ts `setValley`). Kept for the last valley asked about. */
export interface Landmark {
  kind: LandmarkKind;
  ground: Ground;
}
let marksMade: { key: string; marks: Map<number, Landmark> } | null = null;
export function landmarksOf(valley: string | undefined, land: Pick<LandMap, 'w' | 'h' | 'camp'>): Map<number, Landmark> {
  const key = `${valley}|${land.w}|${land.h}|${land.camp.x},${land.camp.y}`;
  if (marksMade?.key === key) return marksMade.marks;
  const marks = new Map<number, Landmark>();
  const m = valleyById(valley);
  if (m) {
    const ground = new Map(valleyCells(m, land.w, land.h, land.camp));
    for (const [i, kind] of valleyLandmarks(m, land.w, land.camp)) if (i >= 0 && i < land.w * land.h) marks.set(i, { kind, ground: ground.get(i) ?? 'grass' });
  }
  marksMade = { key, marks };
  return marks;
}

/** Whether a landmark still stands on its cell: not cleared, and the cell lies as the valley left it. */
export function landmarkStands(land: Pick<LandMap, 'w' | 'cells' | 'cleared'>, i: number, mark: Landmark | undefined): boolean {
  if (!mark || land.cleared?.includes(i)) return false;
  return groundAt(land as LandMap, i % land.w, Math.floor(i / land.w)) === mark.ground;
}

/** The clutter on a cell, if any: a stump, or a ruin that can be cleared. Wild cells (a wood, rock) are gathered as
 *  they always were, so they are never clutter. Pure, for the map's Clear tool too. */
export function clutterAt(land: Pick<LandMap, 'w' | 'cells' | 'regrow' | 'roads' | 'cleared'>, marks: Map<number, Landmark>, i: number): ClutterKind | null {
  const g = groundAt(land as LandMap, i % land.w, Math.floor(i / land.w));
  if (WILD.includes(g) || g === 'water' || g === 'shallows' || land.roads[i] === '#') return null;
  const mark = marks.get(i);
  if (mark && !DRESSING.includes(mark.kind) && landmarkStands(land, i, mark)) return 'ruin';
  if (land.regrow?.[i]?.[0] === 'forest') return 'stump';
  return null;
}

/** The clutter on a cell of this town, if any (nothing under a building). */
export function clutterOf(s: GameState, i: number): ClutterKind | null {
  const kind = clutterAt(s.land, landmarksOf(s.valley, s.land), i);
  if (!kind || builtOnNow(s, i % s.land.w, Math.floor(i / s.land.w))) return null;
  return kind;
}

/** Marked for clearing: the clutter is given its pool to work. Whether it could be. */
export function markClutter(s: GameState, i: number): boolean {
  const kind = clutterOf(s, i);
  if (!kind) return false;
  s.land.pools[i] ??= clutterPool(kind, kind === 'ruin' ? landmarksOf(s.valley, s.land).get(i)?.kind : undefined);
  return true;
}

/** Unmarked before it was worked out: its pool goes again (the cell is open ground; only the mark gave it one). */
export function unmarkClutter(s: GameState, i: number): void {
  if (clutterOf(s, i)) delete s.land.pools[i];
}

/** Worked out (people.ts `clearCell`): the stump is grubbed out, or the ruin cleared away, for good. */
export function clearClutter(s: GameState, i: number): void {
  const kind = clutterOf(s, i);
  if (kind === 'stump') {
    delete s.land.regrow![i];
    if (!Object.keys(s.land.regrow!).length) delete s.land.regrow;
  } else if (kind === 'ruin') (s.land.cleared ??= []).push(i);
}

/** How a gather task works a cell of clutter (people.ts `workGather`), or null for none. */
export function clutterWork(s: GameState, i: number) {
  const kind = clutterOf(s, i);
  return kind ? CLUTTER_WORK[kind] : null;
}
