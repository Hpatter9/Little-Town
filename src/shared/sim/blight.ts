// Where the land is blighted (sim/nests.ts, sim/calamity.ts): round every monster nest by its level and round the
// Calamity's heart by its scar, kept off by the ward stones. Kept apart, with few imports, so farming and the regrowth
// can ask without pulling in the raids.

import { nestBlight } from '../data/nests';
import { WARD } from '../data/calamity';
import type { GameState } from './state';

/* ------------------------------------------------------------ the blight */

/** Where the land is blighted: round every nest (by its level) and round the Calamity's heart (its scar), in cells. */
export function blightSources(s: GameState): { x: number; y: number; r: number }[] {
  const out = (s.places ?? []).filter((p) => p.nest && p.state === 'waiting').map((p) => ({ x: p.x + 0.5, y: p.y + 0.5, r: nestBlight(p.nest!.level) }));
  const c = s.calamity;
  if (c?.heart && c.scar > 0) out.push({ x: c.heart.x + 0.5, y: c.heart.y + 0.5, r: c.scar });
  return out;
}

/** The ward stones standing (cells), and how far each keeps the blight off. */
export const WARD_REACH = 10;
const wards = (s: GameState) => s.buildings.filter((b) => b.def === WARD && b.status === 'done').map((b) => ({ x: b.tile + 0.5, y: b.row + 0.5 }));

/** Whether a cell is blighted: within a source's reach and no ward stone near. */
export function blighted(s: GameState, cx: number, cy: number, sources = blightSources(s)): boolean {
  const x = cx + 0.5;
  const y = cy + 0.5;
  if (!sources.some((b) => Math.hypot(b.x - x, b.y - y) <= b.r)) return false;
  return !wards(s).some((w) => Math.hypot(w.x - x, w.y - y) <= WARD_REACH);
}

/** Crops in blighted ground grow this much slower. */
export const BLIGHT_CROPS = 0.5;
