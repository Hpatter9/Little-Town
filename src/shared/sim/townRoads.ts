// The town lays its own roads again (the owner's ask: "Let's go back to roads being built automatically by the town.
// Just make sure the roads make sense for a town layout"). Not worn footpaths made streets, as before 0.209.0, but a
// planned layout from the town plan (sim/layout.ts): the square at the heart, paved; a main street from it out west,
// east and south along the plan's lines (where the ring wall's gates stand), a few cells ahead of the town; a street
// from each gate in to the rest; and a side street from each building's door to the streets, planned when the building
// is ordered (buildings.ts `placeBlueprint`) so the builders lay it with it. Every street is planned
// (`LandMap.plannedRoads`) and paved by the town's hands as the player's are (sim/streets.ts `paveTask`, `pave`).
//
// A side street finds its way by `route`: the cheapest way over the cells a path may take (pathPlans.ts `refusalOn`:
// seen ground, no building, no field or pen, the ring wall only at a gate, a river as a bridge, a thin ridge as a
// tunnel), with a price on each turn (so it runs straight, with clean corners), on running beside a street one or two
// cells off (no doubled or parallel streets), on bridges, tunnels and bare wild ground, and in a town laid out in
// blocks on leaving the plan's lines, on cutting through a wood or up a cliff. It ends on the streets that reach the
// square, so the town's streets are one network. The player's own paths (sim/pathPlans.ts) are never lifted: a
// building's street may end on one, and a path of theirs cut off from the rest is joined to it.

import { openGround } from '../data/biomes';
import { builtOnIndex, cellCleared, defOf, doorCell, NO_ROAD } from './buildings';
import { buildable, groundAt, idx, inMap, isMarked, isPlannedRoad, isRoad, planRoad, setGround, setMarked, setRoad, wet, wildToClear, type Pt } from './land';
import { coreRadius, onPlanLine, type TownLayout } from './layout';
import { pathGround, refusalOn, type PathGround } from './pathPlans';
import { cliffAhead } from './relief';
import { isGate, isRingPiece, riverCell, sideOn } from './ringWall';
import { seaTown } from './sea';
import { campCell, type Building, type GameState } from './state';
import { TICKS_PER_HOUR } from './time';
import { TUNNEL_THICK } from './tunnels';

/** The main streets reach this many cells past the town's furthest building. */
export const STREET_AHEAD = 4;
/** A gate's street runs on this many cells out beyond it, the way travellers come in. */
export const GATE_PATH_OUT = 3;
/** A main street bridges a river this wide at most (cells); a wider one ends it, and the side streets find a way. */
export const MAIN_BRIDGE = 6;
/** What a side street's step costs on top of 1: a turn; a cell beside a street running the same way, one or two cells
 *  off; a cell that makes a square of four street cells; a bridge; a pier (a shore town); a tunnel; bare wild ground
 *  (cleared as it is planned); a wood or rocks (cut first); steps up a cliff; a cell off the plan's lines (in blocks);
 *  and a street already there (cheap: it joins up). */
export const TURN_COST = 3;
export const PARALLEL_COST = 6;
export const BLOB_COST = 10;
export const BRIDGE_COST = 10;
export const PIER_COST = 2.5;
export const TUNNEL_COST = 7;
export const WILD_COST = 3;
export const WOODS_COST = 6;
export const CLIFF_COST = 8;
export const OFF_PLAN = 0.9;
export const ON_STREET = 0.3;
/** How far a side street may run (cells walked), and how many cells its search looks at. */
export const ROAD_REACH = 60;
const MAX_NODES = 60000;
/** A player's path cut off from the streets is joined when it has this many cells. */
export const JOIN_MIN = 2;
/** The streets are seen to every this many hours (and a building's own street at once, when it is ordered). */
export const ROADS_EVERY = 6;

const N4: readonly Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Whether the town lays its own streets: with the autopilot on, a plan laid, and settled (a tribe on the move lays
 *  none). */
const laysRoads = (s: GameState) => s.autopilot !== false && !!s.layout;

/** Whether a cell is a street, laid or planned. */
const street = (s: GameState, x: number, y: number) => isRoad(s.land, x, y) || isPlannedRoad(s.land, x, y);

/** Plan (or, at the founding, lay at once) a street on a cell; bare wild ground under it is cleared, and a wood or rocks
 *  marked for the axe and the pick (the street is paved there once they're gone: streets.ts `uncleared`). */
function lay(s: GameState, x: number, y: number, now: boolean): void {
  const m = s.land;
  if (street(s, x, y)) return;
  const i = idx(m, x, y);
  if (wildToClear(m, x, y)) {
    if (!m.pools[i]) {
      setGround(m, x, y, openGround(s.biome));
      cellCleared(s, x, y);
    } else {
      if (!isMarked(m, i)) setMarked(m, i, true);
      planRoad(m, x, y);
      return;
    }
  }
  if (now) setRoad(m, x, y);
  else planRoad(m, x, y);
}

/* ------------------------------------------------------------ the network */

/** The streets that reach the square (laid or planned, joined edge to edge), by cell: what a new street ends on. With
 *  no street at the square yet, the ground before the fire (or the castle's gate). */
export function network(s: GameState): Uint8Array {
  const m = s.land;
  const net = new Uint8Array(m.w * m.h);
  const L = s.layout;
  const seeds: number[] = [];
  if (L) for (let y = L.sq.y; y < L.sq.y + L.sq.h; y++) for (let x = L.sq.x; x < L.sq.x + L.sq.w; x++) if (inMap(m, x, y) && street(s, x, y)) seeds.push(idx(m, x, y));
  if (!seeds.length) {
    const c = campCell(s);
    for (let r = 0; r <= 3 && !seeds.length; r++)
      for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) if (inMap(m, x, y) && street(s, x, y)) seeds.push(idx(m, x, y));
  }
  if (!seeds.length) {
    const c = L ? { x: L.col, y: L.row } : campCell(s);
    if (inMap(m, c.x, c.y)) net[idx(m, c.x, c.y)] = 1;
    return net;
  }
  for (const i of seeds) net[i] = 1;
  const q = seeds.slice();
  for (let k = 0; k < q.length; k++) {
    const x = q[k] % m.w, y = Math.floor(q[k] / m.w);
    for (const d of N4) {
      const nx = x + d.x, ny = y + d.y;
      if (!inMap(m, nx, ny)) continue;
      const n = ny * m.w + nx;
      if (net[n] || !street(s, nx, ny)) continue;
      net[n] = 1;
      q.push(n);
    }
  }
  return net;
}

/* ------------------------------------------------------------ finding a way */

/** The way a side street takes from any of the `from` cells to a cell of `goal` (both ends included), or null. A
 *  search over (cell, heading), so a turn can be priced; deterministic (ties go to the lower state). */
export function route(s: GameState, from: readonly Pt[], goal: Uint8Array, ground: PathGround = pathGround(s), reach = ROAD_REACH): Pt[] | null {
  const m = s.land;
  const W = m.w;
  const L = s.layout;
  const grid = !!L && L.style === 'grid';
  const pier = seaTown(s);
  const N = m.w * m.h * 4;
  const dist = new Float64Array(N).fill(Infinity);
  const steps = new Uint16Array(N);
  const prev = new Int32Array(N).fill(-1);
  const heap = new Heap();
  // (what a cell costs to step on: Infinity where no street may go)
  const cellCost = new Float32Array(m.w * m.h).fill(-1);
  const costOf = (x: number, y: number): number => {
    const i = y * W + x;
    if (cellCost[i] >= 0) return cellCost[i];
    let c: number;
    if (street(s, x, y)) c = ON_STREET;
    else {
      const no = refusalOn(ground, x, y);
      const g = groundAt(m, x, y);
      // (wild ground: bare, cleared as it's planned; a wood or rocks, cut first, so dearer)
      if (no) c = layable(s, ground, x, y) ? 1 + (m.pools[i] ? WOODS_COST : WILD_COST) : Infinity;
      else if (wet(g)) c = 1 + (pier && !riverCell(m, { x, y }) ? PIER_COST : BRIDGE_COST);
      else if (g === 'mountain') c = 1 + TUNNEL_COST;
      else c = 1;
      if (c < Infinity && grid && !onPlanLine(s, x, y)) c += OFF_PLAN;
    }
    cellCost[i] = c;
    return c;
  };
  // (beside a street running the same way, one or two cells off: a doubled street)
  const alongside = (x: number, y: number, d: Pt): boolean => {
    if (street(s, x, y)) return false;
    for (const k of [1, 2])
      for (const side of [-1, 1]) {
        const ax = x + d.y * side * k, ay = y + d.x * side * k;
        if (!inMap(m, ax, ay) || !street(s, ax, ay)) continue;
        // (a street there running the same way: its next cell along is a street too)
        if (street(s, ax + d.x, ay + d.y) || street(s, ax - d.x, ay - d.y)) return true;
      }
    return false;
  };
  // (a cell that would make a square of four street cells with the streets beside it: a doubled street; the cell
  // just come from counts as street)
  const blob = (x: number, y: number, px: number, py: number): boolean => {
    if (street(s, x, y)) return false;
    const on = (cx: number, cy: number) => (cx === px && cy === py) || (inMap(m, cx, cy) && street(s, cx, cy));
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (on(x + dx, y) && on(x, y + dy) && on(x + dx, y + dy)) return true;
    return false;
  };
  for (const f of from) {
    if (!inMap(m, f.x, f.y)) continue;
    if (goal[f.y * W + f.x]) return [{ x: f.x, y: f.y }];
    for (let h = 0; h < 4; h++) {
      const st = (f.y * W + f.x) * 4 + h;
      dist[st] = 0;
      heap.push(st, 0);
    }
  }
  let seen = 0;
  while (heap.size) {
    const [st, dd] = heap.pop();
    if (dd > dist[st]) continue;
    if (++seen > MAX_NODES) return null;
    const i = st >> 2, h = st & 3;
    const x = i % W, y = Math.floor(i / W);
    if (goal[i] && prev[st] >= 0) {
      const out: Pt[] = [];
      for (let k = st; k >= 0; k = prev[k]) out.push({ x: (k >> 2) % W, y: Math.floor((k >> 2) / W) });
      return out.reverse().filter((p, j, a) => j === 0 || p.x !== a[j - 1].x || p.y !== a[j - 1].y);
    }
    if (steps[st] >= reach) continue;
    for (let nh = 0; nh < 4; nh++) {
      const d = N4[nh];
      const nx = x + d.x, ny = y + d.y;
      if (!inMap(m, nx, ny)) continue;
      const c = costOf(nx, ny);
      if (c === Infinity) continue;
      // (up a cliff: the street cuts steps in it, sim/relief.ts, but goes round where it can)
      const cliff = cliffAhead(m, x, y, nx, ny) ? CLIFF_COST : 0;
      // (a tunnel or a bridge runs straight: no turning inside one)
      const odd = (cx: number, cy: number) => !street(s, cx, cy) && (wet(groundAt(m, cx, cy)) || groundAt(m, cx, cy) === 'mountain');
      if (nh !== h && prev[st] >= 0 && odd(x, y)) continue;
      const turn = prev[st] >= 0 && nh !== h ? TURN_COST : 0;
      const par = (alongside(nx, ny, d) && !goal[ny * W + nx] ? PARALLEL_COST : 0) + (blob(nx, ny, x, y) ? BLOB_COST : 0);
      const ns = (ny * W + nx) * 4 + nh;
      const nd = dd + c + turn + par + cliff;
      if (nd < dist[ns]) {
        dist[ns] = nd;
        prev[ns] = st;
        steps[ns] = steps[st] + 1;
        heap.push(ns, nd);
      }
    }
  }
  return null;
}

/** A small binary heap of states by cost (ties: the lower state first, so the search is the same every run). */
class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  private less(a: number, b: number) {
    return this.v[a] < this.v[b] || (this.v[a] === this.v[b] && this.k[a] < this.k[b]);
  }
  private swap(a: number, b: number) {
    [this.k[a], this.k[b]] = [this.k[b], this.k[a]];
    [this.v[a], this.v[b]] = [this.v[b], this.v[a]];
  }
  push(key: number, val: number) {
    this.k.push(key);
    this.v.push(val);
    for (let i = this.k.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.k[0], this.v[0]];
    const lk = this.k.pop()!, lv = this.v.pop()!;
    if (this.k.length) {
      this.k[0] = lk;
      this.v[0] = lv;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let b = i;
        if (l < this.k.length && this.less(l, b)) b = l;
        if (r < this.k.length && this.less(r, b)) b = r;
        if (b === i) break;
        this.swap(i, b);
        i = b;
      }
    }
    return top;
  }
}

/* ------------------------------------------------------------ the parts of the plan */

/** The square paved: at once for a town just founded, else planned for its pavers. Cells built on, or not buildable,
 *  are left. */
function square(s: GameState, L: TownLayout, now: boolean): void {
  const m = s.land;
  const on = builtOnIndex(s);
  for (let y = L.sq.y; y < L.sq.y + L.sq.h; y++)
    for (let x = L.sq.x; x < L.sq.x + L.sq.w; x++) {
      if (!inMap(m, x, y) || on(x, y) || street(s, x, y) || !buildable(groundAt(m, x, y))) continue;
      lay(s, x, y, now);
    }
}

/** The main streets out from the square along the plan's lines: the high street west and east, the road south,
 *  `STREET_AHEAD` cells past the town's furthest building, straight (up a cliff in steps); through a gate of the ring
 *  wall and `GATE_PATH_OUT` cells beyond it. A short river is bridged and a thin ridge tunnelled straight across;
 *  anything else in the way (a building, a wood, the wall's line) ends the street there, and the side streets go
 *  round. */
function mains(s: GameState, L: TownLayout, now: boolean, ground: PathGround): void {
  const m = s.land;
  const reach = coreRadius(s, L) + STREET_AHEAD;
  const ends: [Pt, Pt][] = [
    [{ x: L.sq.x, y: L.row }, { x: -1, y: 0 }],
    [{ x: L.sq.x + L.sq.w - 1, y: L.row }, { x: 1, y: 0 }],
    [{ x: L.col, y: L.sq.y + L.sq.h - 1 }, { x: 0, y: 1 }],
  ];
  const ok = (x: number, y: number) => !refusalOn(ground, x, y) || (street(s, x, y) && !ground.on(x, y));
  for (const [from, d] of ends) {
    let gateAt = -1;
    for (let k = 1; k <= reach + GATE_PATH_OUT + 2; k++) {
      const x = from.x + d.x * k, y = from.y + d.y * k;
      if (gateAt >= 0 && k > gateAt + GATE_PATH_OUT) break;
      if (k > reach && gateAt < 0 && !gateAhead(ground, x, y)) break;
      if (!inMap(m, x, y)) break;
      const b = ground.on(x, y);
      if (b && isGate(b.def)) gateAt = k;
      const g = groundAt(m, x, y);
      if (wet(g) || g === 'mountain') {
        // (a short river bridged, a thin ridge tunnelled: straight across to open ground past it)
        let j = k;
        while (inMap(m, from.x + d.x * j, from.y + d.y * j) && j - k <= MAIN_BRIDGE && (g === 'mountain' ? groundAt(m, from.x + d.x * j, from.y + d.y * j) === 'mountain' : wet(groundAt(m, from.x + d.x * j, from.y + d.y * j)))) j++;
        const over = { x: from.x + d.x * j, y: from.y + d.y * j };
        const most = g === 'mountain' ? TUNNEL_THICK : MAIN_BRIDGE;
        if (j - k > most || !inMap(m, over.x, over.y) || refusalOn(ground, over.x, over.y)) break;
        let fine = true;
        for (let t = k; t < j && fine; t++) fine = ok(from.x + d.x * t, from.y + d.y * t);
        if (!fine) break;
        for (let t = k; t <= j; t++) lay(s, from.x + d.x * t, from.y + d.y * t, now);
        k = j;
        continue;
      }
      if (!ok(x, y)) break;
      lay(s, x, y, now);
    }
  }
}

/** Whether a gate stands within a few cells on along a main street's line (it runs on to it, past its reach). */
function gateAhead(ground: PathGround, x: number, y: number): boolean {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const b = ground.on(x + dx, y + dy);
    if (b && isGate(b.def)) return true;
  }
  return false;
}

/** A street from each gate of the ring wall in to the town's streets, and out beyond it a few cells. */
function gateStreets(s: GameState, now: boolean, ground: PathGround): void {
  const ring = s.ring;
  if (!ring) return;
  const m = s.land;
  for (const g of ring.gates) {
    const b = ground.on(g.x, g.y);
    if (!b || !isGate(b.def)) continue;
    const side = sideOn(ring, g);
    const [ix, iy] = side === 'w' ? [1, 0] : side === 'e' ? [-1, 0] : side === 'n' ? [0, 1] : [0, -1];
    // (a gate is two cells along the wall: a main street through its other cell already serves it)
    const pair = side === 'w' || side === 'e' ? { x: g.x, y: g.y + 1 } : { x: g.x + 1, y: g.y };
    if (inMap(m, pair.x, pair.y) && network(s)[idx(m, pair.x, pair.y)] && !street(s, g.x, g.y)) continue;
    const inside = { x: g.x + ix, y: g.y + iy };
    if (!inMap(m, inside.x, inside.y) || refusalOn(ground, inside.x, inside.y)) continue;
    const net = network(s);
    if (!net[idx(m, g.x, g.y)] || !net[idx(m, inside.x, inside.y)]) {
      const way = net[idx(m, inside.x, inside.y)] ? [inside] : route(s, [inside], net, ground, ROAD_REACH * 2);
      if (!way) continue;
      for (const c of way) lay(s, c.x, c.y, now);
      lay(s, g.x, g.y, now);
    }
    // (and out beyond the gate, the way travellers come in)
    for (let k = 1; k <= GATE_PATH_OUT; k++) {
      const x = g.x - ix * k, y = g.y - iy * k;
      if (!inMap(m, x, y) || refusalOn(ground, x, y) || wet(groundAt(m, x, y)) || groundAt(m, x, y) === 'mountain' || cliffAhead(m, x + ix, y + iy, x, y)) break;
      lay(s, x, y, now);
    }
  }
}

/** Whether a street may be laid on a cell: one a path may take (pathPlans.ts `refusalOn`), or wild ground to clear
 *  with nothing built on it; or a street already. */
function layable(s: GameState, ground: PathGround, x: number, y: number): boolean {
  if (!inMap(s.land, x, y)) return false;
  if (street(s, x, y)) return !ground.on(x, y) || isGate(ground.on(x, y)!.def);
  const no = refusalOn(ground, x, y);
  return !no || (no.startsWith('Wild') && wildToClear(s.land, x, y) && !ground.on(x, y));
}

/** Whether a building wants a street to its door: not a field, a pen, a wall, a defence, the fire, a room of the
 *  castle, a piece of the ring, nor a home in the sea of a town that swims (sim/sea.ts). */
export function wantsStreet(s: GameState, b: Building): boolean {
  if (b.room || isRingPiece(b.def) || NO_ROAD(defOf(b))) return false;
  const d = doorCell(b);
  return !(seaTown(s) && inMap(s.land, d.x, d.y) && wet(groundAt(s.land, d.x, d.y)));
}

/** Whether a building's door is on a street: its door cell or one beside it. */
export function doorOnStreet(s: GameState, b: Building): boolean {
  const d = doorCell(b);
  return street(s, d.x, d.y) || N4.some((n) => street(s, d.x + n.x, d.y + n.y));
}

/** Whether a building's door is on the streets that reach the square (`network`). */
export function doorReached(s: GameState, b: Building, net: Uint8Array): boolean {
  const m = s.land;
  const d = doorCell(b);
  return [{ x: 0, y: 0 }, ...N4].some((n) => inMap(m, d.x + n.x, d.y + n.y) && net[(d.y + n.y) * m.w + d.x + n.x] === 1);
}

/** A side street from a building's door to the streets that reach the square (planned for its builders; at the
 *  founding, laid): from the door, or from a street it is already on (a path of the player's, say). With no way yet,
 *  the cell before its door is kept for one, so nothing is built in front of it. True when its door is reached now. */
export function roadToDoor(s: GameState, b: Building, now = false, ground: PathGround = pathGround(s), net: Uint8Array = network(s)): boolean {
  if (!wantsStreet(s, b) || doorReached(s, b, net)) return true;
  const m = s.land;
  const d = doorCell(b);
  if (!inMap(m, d.x, d.y)) return false;
  // (from the door, and every street cell joined to it)
  const from: Pt[] = [];
  const seen = new Set<number>();
  const q: Pt[] = [];
  const add = (p: Pt) => {
    const i = idx(m, p.x, p.y);
    if (seen.has(i)) return;
    seen.add(i);
    from.push(p);
    if (street(s, p.x, p.y)) q.push(p);
  };
  if (layable(s, ground, d.x, d.y)) add(d);
  // (a door built in front of since, an upgrade's wider walls say: from beside it)
  else for (const n of N4) if (layable(s, ground, d.x + n.x, d.y + n.y)) add({ x: d.x + n.x, y: d.y + n.y });
  for (const n of N4) if (inMap(m, d.x + n.x, d.y + n.y) && street(s, d.x + n.x, d.y + n.y)) add({ x: d.x + n.x, y: d.y + n.y });
  for (let k = 0; k < q.length && from.length < 400; k++)
    for (const n of N4) {
      const x = q[k].x + n.x, y = q[k].y + n.y;
      if (inMap(m, x, y) && street(s, x, y)) add({ x, y });
    }
  if (!from.length) return false;
  const way = route(s, from, net, ground);
  if (!way) {
    if (!street(s, d.x, d.y) && layable(s, ground, d.x, d.y)) lay(s, d.x, d.y, false);
    return false;
  }
  for (const c of way) lay(s, c.x, c.y, now);
  return true;
}

/** The player's paths cut off from the streets (`JOIN_MIN` cells or more, near the town) are joined to them: a street
 *  from the nearest of their cells. They are never lifted. */
function joinPaths(s: GameState, L: TownLayout, now: boolean, ground: PathGround): void {
  const m = s.land;
  const net = network(s);
  const seen = new Uint8Array(m.w * m.h);
  const R = coreRadius(s, L) + ROAD_REACH / 2;
  for (let y = Math.max(0, L.row - R); y <= Math.min(m.h - 1, L.row + R); y++)
    for (let x = Math.max(0, L.col - R); x <= Math.min(m.w - 1, L.col + R); x++) {
      const i = y * m.w + x;
      if (seen[i] || net[i] || !street(s, x, y)) continue;
      const part: Pt[] = [];
      const q = [i];
      seen[i] = 1;
      for (let k = 0; k < q.length; k++) {
        const cx = q[k] % m.w, cy = Math.floor(q[k] / m.w);
        part.push({ x: cx, y: cy });
        for (const d of N4) {
          const nx = cx + d.x, ny = cy + d.y;
          if (!inMap(m, nx, ny) || seen[ny * m.w + nx] || !street(s, nx, ny)) continue;
          seen[ny * m.w + nx] = 1;
          q.push(ny * m.w + nx);
        }
      }
      if (part.length < JOIN_MIN || part.some((p) => net[p.y * m.w + p.x])) continue;
      const way = route(s, part, network(s), ground);
      if (way) for (const c of way) lay(s, c.x, c.y, now);
    }
}

/** The whole plan seen to: the square, the main streets, the gates' streets, a street to every door that has none,
 *  and the player's paths joined. `now` lays them at once (a town just founded); else they're planned. */
export function planTownRoads(s: GameState, now = false): void {
  const L = s.layout;
  if (!laysRoads(s) || !L) return;
  square(s, L, now);
  let ground = pathGround(s);
  mains(s, L, now, ground);
  gateStreets(s, now, ground);
  ground = pathGround(s);
  for (const b of s.buildings) {
    if (!wantsStreet(s, b)) continue;
    const net = network(s);
    if (!doorReached(s, b, net)) roadToDoor(s, b, now, ground, net);
  }
  joinPaths(s, L, now, ground);
}

/** When a building is ordered (or upgraded): its side street planned with it, so the builders lay it as they build. */
export function streetForNew(s: GameState, b: Building): void {
  if (!laysRoads(s) || b.room) return;
  roadToDoor(s, b);
}

/** Every `ROADS_EVERY` hours (sim/streets.ts `streetsHourly`): the plan seen to as the town grows. An older town (one
 *  with only the player's paths, or none) gets its streets planned from now on, round what stands. */
export function townRoadsHourly(s: GameState): void {
  if (!laysRoads(s)) return;
  if (Math.floor(s.tick / TICKS_PER_HOUR) % ROADS_EVERY !== 3) return;
  planTownRoads(s);
}
