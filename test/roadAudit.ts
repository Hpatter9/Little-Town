// What a town's streets look like, by the rules the town lays them by (sim/townRoads.ts): shared by
// test/townRoads.test.ts and tools/roads-map.ts.
import { CROPS } from '../src/shared/data/crops';
import { HERDS } from '../src/shared/data/livestock';
import { doorCell, footprint } from '../src/shared/sim/buildings';
import { inMap, isPlannedRoad, isRoad } from '../src/shared/sim/land';
import type { GameState } from '../src/shared/sim/state';
import { doorOnStreet, network, wantsStreet } from '../src/shared/sim/townRoads';

export interface RoadAudit {
  /** Street cells, laid and planned. */
  cells: number;
  /** Finished buildings that want a street whose door has none within a cell, and those whose street doesn't reach
   *  the square. */
  doorless: string[];
  cutOff: string[];
  /** Gates whose cell isn't on the streets that reach the square. */
  gatesOff: number;
  /** Two-by-two blocks of street outside the square (a doubled street), and runs of three side by side one cell
   *  apart (a parallel street). */
  doubled: number;
  parallel: number;
  /** Street cells on a field or a pen. */
  onFields: number;
  /** Where the doubled and parallel streets are (x,y). */
  where: string[];
}

export function auditRoads(s: GameState): RoadAudit {
  const m = s.land;
  const st = (x: number, y: number) => inMap(m, x, y) && (isRoad(m, x, y) || isPlannedRoad(m, x, y));
  const L = s.layout;
  const inSq = (x: number, y: number) => !!L && x >= L.sq.x - 1 && x <= L.sq.x + L.sq.w && y >= L.sq.y - 1 && y <= L.sq.y + L.sq.h;
  const net = network(s);
  const a: RoadAudit = { cells: 0, doorless: [], cutOff: [], gatesOff: 0, doubled: 0, parallel: 0, onFields: 0, where: [] };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (st(x, y)) a.cells++;
  for (const b of s.buildings) {
    if (b.status !== 'done' || !wantsStreet(s, b)) continue;
    if (!s.layout) continue; // (a tribe on the move lays no streets)
    if (!doorOnStreet(s, b)) a.doorless.push(`${b.def}@${b.tile},${b.row}`);
    else {
      const d = doorCell(b);
      const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inMap(m, d.x + dx, d.y + dy) && net[(d.y + dy) * m.w + d.x + dx]);
      if (!near) a.cutOff.push(`${b.def}@${b.tile},${b.row}`);
    }
  }
  for (const b of s.buildings) {
    if (!(CROPS[b.def] || HERDS[b.def])) continue;
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (st(x, y)) a.onFields++;
  }
  // (a gate is two cells along the wall: reached at either)
  if (s.ring?.done) for (const g of s.ring.gates) if (!net[g.y * m.w + g.x] && !net[(g.y + 1) * m.w + g.x] && !net[g.y * m.w + g.x + 1]) a.gatesOff++;
  for (let y = 0; y < m.h - 1; y++)
    for (let x = 0; x < m.w - 1; x++) {
      if (inSq(x, y) || inSq(x + 1, y + 1)) continue;
      if (st(x, y) && st(x + 1, y) && st(x, y + 1) && st(x + 1, y + 1)) {
        a.doubled++;
        a.where.push(`doubled ${x},${y}`);
      }
      // (side by side one cell apart, three long, the cells between bare)
      if ([0, 1, 2].every((k) => st(x + k, y) && st(x + k, y + 2) && !st(x + k, y + 1))) {
        a.parallel++;
        a.where.push(`parallel ${x},${y}`);
      }
      if ([0, 1, 2].every((k) => st(x, y + k) && st(x + 2, y + k) && !st(x + 1, y + k))) {
        a.parallel++;
        a.where.push(`parallel ${x},${y}`);
      }
    }
  return a;
}
