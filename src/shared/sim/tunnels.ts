// Tunnels (the owner's ask: the town goes round the mountains, or tunnels through them). A main street of the town plan
// (sim/layout.ts `extendMains`) that runs into a thin ridge of rock, where going round it is far longer than going
// through, is planned through it: the cells of rock become planned street (sim/streets.ts), cut slowly, a cell at a
// time like a bridge; cut, a cell is dug ground (`hall`) with the street on it, a way through with a mouth at each end.
// Anyone may walk it, raiders too (they take the cheapest way in, and a street through the rock is cheap). Only in a
// town whose land has relief (sim/relief.ts), and never in a castle or a hold (whose dug ground is its rooms).

import { castleOn } from './castle';
import { buildable, findPath, groundAt, inMap, isOpen, type Pt } from './land';
import type { GameState } from './state';

/** The thickest ridge a street tunnels through (cells), and how much further going round must be than going through
 *  before it does (cells walked). */
export const TUNNEL_THICK = 6;
export const TUNNEL_DETOUR = 24;
/** Seconds of work to cut a cell of tunnel (a cell of street takes 15, of bridge 60), and the stone it gives. */
export const TUNNEL_SECONDS = 150;
export const TUNNEL_STONE = 3;

/** Whether the town may tunnel at all. */
export const tunnelsHere = (s: GameState) => !!s.land.relief && !castleOn(s);

/** What a cell of tunnel costs a street's planning against a cell of road on land (sim/buildings.ts `layStreet`): a
 *  street goes through a ridge only where going round is far longer. */
export const TUNNEL_COST = 7;

/** The rock a street may tunnel: a range's or an outcrop's (never the dwarves' own mountain), where the ridge is thin,
 *  `TUNNEL_THICK` cells or fewer across one way or the other. Kept while the land's cells are the same. Null when
 *  there's none (or the town doesn't tunnel), so a street's search keeps its quick way. */
const bored = new WeakMap<object, { cells: string; thin: Uint8Array | null }>();
export function thinRock(s: GameState): ((x: number, y: number) => boolean) | null {
  if (!tunnelsHere(s)) return null;
  const m = s.land;
  let had = bored.get(m);
  if (!had || had.cells !== m.cells) {
    const n = m.w * m.h;
    const thin = new Uint8Array(n);
    const rock = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.cells[y * m.w + x] === 'M' && (m.relief![y * m.w + x] === '5' || m.relief![y * m.w + x] === '2');
    let any = false;
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        if (!rock(x, y)) continue;
        const run = (dx: number, dy: number) => {
          let k = 1;
          while (k <= TUNNEL_THICK && rock(x + dx * k, y + dy * k)) k++;
          return k - 1;
        };
        if (run(1, 0) + run(-1, 0) + 1 <= TUNNEL_THICK || run(0, 1) + run(0, -1) + 1 <= TUNNEL_THICK) {
          thin[y * m.w + x] = 1;
          any = true;
        }
      }
    had = { cells: m.cells, thin: any ? thin : null };
    bored.set(m, had);
  }
  const thin = had.thin;
  return thin ? (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && thin[y * m.w + x] === 1 : null;
}

/** Whether a cell is (or will be, once cut) a tunnel: rock under a planned street, or dug ground under a street. */
export const isTunnelCell = (s: GameState, x: number, y: number) => {
  const g = groundAt(s.land, x, y);
  return tunnelsHere(s) && (g === 'mountain' || g === 'hall');
};

/** A street running from `before` (open ground) in direction `d` meets rock: the tunnel's far side (the open cell past
 *  the rock), if the ridge is thin enough, the ground past it is open land to build a street on, and going round is
 *  more than `TUNNEL_DETOUR` cells longer than going through (or there's no way round at all). Null if not. */
export function tunnelThrough(s: GameState, before: Pt, d: Pt): { over: Pt; cells: Pt[] } | null {
  if (!tunnelsHere(s)) return null;
  const m = s.land;
  const cells: Pt[] = [];
  let x = before.x + d.x;
  let y = before.y + d.y;
  while (inMap(m, x, y) && groundAt(m, x, y) === 'mountain' && cells.length <= TUNNEL_THICK) {
    cells.push({ x, y });
    x += d.x;
    y += d.y;
  }
  if (!cells.length || cells.length > TUNNEL_THICK || !inMap(m, x, y) || !isOpen(m, x, y) || !buildable(groundAt(m, x, y))) return null;
  const over = { x, y };
  const round = findPath(m, before, over, undefined, { maxNodes: 6000 });
  if (round && round.length <= cells.length + 1 + TUNNEL_DETOUR) return null;
  return { over, cells };
}

/** The tunnels cut and being cut: each run of rock-or-dug cells under a street or a planned one, with its mouths (the
 *  open cells at its ends), for the snapshot and the map. */
export function tunnelCells(s: GameState): number[] {
  const m = s.land;
  if (!tunnelsHere(s)) return [];
  const out: number[] = [];
  for (let i = 0; i < m.cells.length; i++) {
    const c = m.cells[i];
    if ((c === 'M' || c === 'H') && (m.roads[i] === '#' || m.plannedRoads?.[i] === '#')) out.push(i);
  }
  return out;
}
