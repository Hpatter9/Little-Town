// The merfolk's shore (the owner's request: the Tide Clan lives on the coast, half its land the sea, building on the
// land and in the water, swimming). The land's `sea` shape (land.ts: the south half water, shallows along the shore)
// comes from the origin's `shape` rule; everyone of the town swims (`swims`: the sea costs them less than a walk),
// their homes, seat, shrines and defences may stand in the water (`seaBuild`), and the sea's cells hold fish, kelp
// and pearls (land.ts `seaPool`), which it gives again each dawn (`replenishSea`).
import type { BuildingDef } from '../data/buildings';
import { ORIGIN_DEFS } from '../data/origins';
import { isSeat } from '../data/seats';
import type { Rng } from '../rng';
import { cellAt, groundAt, idx, inMap, isOpen, seaPool, wet, type LandMap } from './land';
import type { GameState, Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

/** Whether the town is a shore town: its land shaped by the sea. */
export const seaTown = (s: Pick<GameState, 'origin'>) => ORIGIN_DEFS[s.origin ?? 'settlers']?.rules.shape === 'sea';

/** Whether someone swims: the merfolk, every one of them (strangers and raiders don't). */
export const swims = (s: Pick<GameState, 'origin'>, _p?: Pick<Person, 'id'>) => seaTown(s);

/** Buildings besides the homes that may stand in the sea. */
const SEA_IDS = new Set(['shrine', 'watchtower', 'well', 'storytellers_circle', 'graveyard', 'phylactery', 'trophy_hall']);

/** Whether a building may stand in the sea (shallows or open water): in a shore town, the homes, the seat, the
 *  defences and a few more; never a field, a pen or a workshop, which want dry ground. */
export function seaBuild(s: Pick<GameState, 'origin'>, def: BuildingDef): boolean {
  if (!seaTown(s)) return false;
  return (def.housing ?? 0) > 0 || isSeat(def.id) || !!def.defense || SEA_IDS.has(def.id);
}

/** Whether a footprint lies (wholly) in the sea. */
export function inSea(m: LandMap, r: { x: number; y: number; w: number; h: number }): boolean {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!inMap(m, x, y) || !wet(groundAt(m, x, y))) return false;
  return true;
}

/** How much of the sea's cells within the open land are emptied before the sea gives again (a share, each dawn). */
export const SEA_REFILL = 0.25;
const DAWN = 6;

/** Each dawn the sea gives again: a share of the fished-out cells in the open land get a new pool. */
export function replenishSea(s: GameState, rng: Rng): void {
  if (!seaTown(s) || s.tick % TICKS_PER_HOUR !== 0 || calendar(s.tick).hour !== DAWN) return;
  const m = s.land;
  let n = 0;
  for (let i = 0; i < m.cells.length; i++) {
    const c = cellAt(m, i);
    const g = groundAt(m, c.x, c.y);
    if (!wet(g) || m.pools[i] || !isOpen(m, c.x, c.y)) continue;
    if (!rng.chance(SEA_REFILL)) continue;
    m.pools[idx(m, c.x, c.y)] = seaPool(g, rng);
    n++;
  }
  if (n) m.version++;
}
