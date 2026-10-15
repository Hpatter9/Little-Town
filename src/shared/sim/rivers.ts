// Rivers that move (the living wilderness). After a big flood the river may not go back to its bed: over a stretch near
// the town it cuts a new channel a few cells to one side, and the old bed is left as silt with an oxbow pond in its
// middle. What stood in the way of the new channel (fields, huts, a street's bridge) is lost. The land stays walkable: a
// change is tried on a copy of the ground first, and made only if everything the camp could walk to is still reachable
// (the ring wall, the camp, the seat and the land's places are never touched). Rare: `RIVER_SHIFT_CHANCE` of the floods.
// Its own seeded stream ('wild:river'); off with the autopilot.

import { RIVER_REACH, RIVER_SHIFT, RIVER_SHIFT_CHANCE } from '../data/wild';
import { Rng, hashSeed } from '../rng';
import { defOf, demolish, footprint, townRadius } from './buildings';
import { cellOf, groundAt, idx, inMap, planRoad, setRoad, wet, type LandMap } from './land';
import { notify, type GameState } from './state';

const HALF = 7; // (the stretch moved: 2*HALF+1 cells along the river)

/** Called when a flood ends. */
export function maybeShiftRiver(s: GameState): boolean {
  if (s.autopilot === false) return false;
  const g = new Rng(hashSeed(`${s.seed}:wild:river:${s.tick}`));
  if (!g.chance(RIVER_SHIFT_CHANCE)) return false;
  return shiftRiver(s, g);
}

interface Row {
  lo: number;
  hi: number;
}

/** Across a river running along one axis (`v` runs down the rows), the water of each row from -HALF to HALF about a
 *  cell, or null if the water doesn't run clean through. */
function rowsAt(m: LandMap, a: number, b: number, v: boolean): Row[] | null {
  const at = (lat: number, along: number) => (v ? inMap(m, lat, along) && groundAt(m, lat, along) === 'water' : inMap(m, along, lat) && groundAt(m, along, lat) === 'water');
  const out: Row[] = [];
  let centre = a;
  for (let t = -HALF; t <= HALF; t++) {
    let lo = centre;
    // (the water nearest the last row's middle)
    let found = false;
    for (const d of [0, 1, -1, 2, -2]) if (at(centre + d, b + t)) { lo = centre + d; found = true; break; }
    if (!found) return null;
    let hi = lo;
    while (at(lo - 1, b + t)) lo--;
    while (at(hi + 1, b + t)) hi++;
    if (hi - lo + 1 > 5) return null;
    out.push({ lo, hi });
    centre = Math.round((lo + hi) / 2);
  }
  return out;
}

/** Try to move the river near the town. Returns whether it moved. */
export function shiftRiver(s: GameState, g: Rng): boolean {
  const m = s.land;
  const c = m.camp;
  const span = RIVER_REACH + Math.ceil(townRadius(s));
  const cand: { a: number; b: number; v: boolean }[] = [];
  for (let y = Math.max(HALF + 1, c.y - span); y <= Math.min(m.h - HALF - 2, c.y + span); y++)
    for (let x = Math.max(HALF + 1, c.x - span); x <= Math.min(m.w - HALF - 2, c.x + span); x++) {
      if (groundAt(m, x, y) !== 'water' || Math.hypot(x - c.x, y - c.y) > span) continue;
      // (the start of a short run of water in a row, or in a column)
      if (groundAt(m, x - 1, y) !== 'water') cand.push({ a: x, b: y, v: true });
      if (groundAt(m, x, y - 1) !== 'water') cand.push({ a: y, b: x, v: false });
    }
  if (!cand.length) return false;
  // (nearest the camp first, a few tried)
  cand.sort((p, q) => dist(m, p) - dist(m, q) || p.a - q.a || p.b - q.b);
  const pool = cand.slice(0, 40);
  for (let tries = 0; tries < 8 && pool.length; tries++) {
    const k = g.int(0, pool.length - 1);
    const [one] = pool.splice(k, 1);
    const rows = rowsAt(m, one.a, one.b, one.v);
    if (!rows) continue;
    if (tryShift(s, g, one, rows)) return true;
  }
  return false;
}

const dist = (m: LandMap, p: { a: number; b: number; v: boolean }) => (p.v ? Math.hypot(p.a - m.camp.x, p.b - m.camp.y) : Math.hypot(p.b - m.camp.x, p.a - m.camp.y));

function tryShift(s: GameState, g: Rng, at: { a: number; b: number; v: boolean }, rows: Row[]): boolean {
  const m = s.land;
  const move = g.int(RIVER_SHIFT[0], RIVER_SHIFT[1]) * (g.chance(0.5) ? 1 : -1);
  const cell = (lat: number, t: number): [number, number] => (at.v ? [lat, at.b + t] : [at.b + t, lat]);
  const olds = new Set<number>();
  const news = new Set<number>();
  for (let t = -HALF; t <= HALF; t++) {
    const off = Math.round((move * (1 + Math.cos((Math.PI * t) / (HALF + 1)))) / 2);
    const { lo, hi } = rows[t + HALF];
    for (let lat = lo; lat <= hi; lat++) {
      const [x, y] = cell(lat, t);
      olds.add(idx(m, x, y));
      const [nx, ny] = cell(lat + off, t);
      if (!inMap(m, nx, ny)) return false;
      news.add(idx(m, nx, ny));
    }
  }
  // what the new channel may cross
  const ring = s.ring?.rect;
  const lost = new Set<number>();
  for (const i of news) {
    const x = i % m.w;
    const y = Math.floor(i / m.w);
    const gr = groundAt(m, x, y);
    if (gr === 'mountain' || gr === 'hall' || gr === 'rock') return false;
    if (Math.hypot(x - m.camp.x, y - m.camp.y) < 5) return false;
    if (ring && x >= ring.x - 1 && x <= ring.x + ring.w && y >= ring.y - 1 && y <= ring.y + ring.h) return false;
    if ((s.places ?? []).some((p) => p.x === x && p.y === y)) return false;
    for (const b of s.buildings) {
      const f = footprint(b);
      if (x < f.x || x >= f.x + f.w || y < f.y || y >= f.y + f.h) continue;
      if (defOf(b).seat || b.def === 'campfire' || b.room) return false;
      lost.add(b.id);
    }
  }
  if (lost.size > 6) return false;
  // the ground after: new water, old bed to silt (an oxbow pond left in the middle)
  const pondFrom = Math.round(-HALF / 3);
  const pondTo = Math.round(HALF / 3);
  const after = m.cells.split('');
  const pond: number[] = [];
  const silt: number[] = [];
  for (const i of olds) {
    if (news.has(i)) continue;
    const x = i % m.w;
    const y = Math.floor(i / m.w);
    const t = (at.v ? y : x) - at.b;
    const apart = [...news].every((j) => Math.abs((j % m.w) - x) + Math.abs(Math.floor(j / m.w) - y) >= 3);
    if (t >= pondFrom && t <= pondTo && apart) pond.push(i);
    else silt.push(i);
  }
  for (const i of news) after[i] = 'w';
  for (const i of silt) after[i] = 'F';
  const before = m.cells;
  const reachBefore = reach(m);
  m.cells = after.join('');
  const reachAfter = reach(m);
  m.cells = before;
  for (const i of reachBefore) if (!news.has(i) && !reachAfter.has(i)) return false;

  // — do it —
  m.cells = after.join('');
  for (const i of news) {
    const x = i % m.w;
    const y = Math.floor(i / m.w);
    if (m.roads[i] === '#') setRoad(m, x, y, false);
    planRoad(m, x, y, false);
    delete m.pools[i];
    delete m.regrow?.[i];
    delete m.rubble?.[i];
    if (m.marked.includes(i)) m.marked = m.marked.filter((q) => q !== i);
  }
  for (const i of silt) delete m.pools[i];
  m.version++;
  const names: string[] = [];
  for (const id of lost) {
    const b = s.buildings.find((q) => q.id === id)!;
    names.push(defOf(b).name.toLowerCase());
    demolish(s, id, 'felled');
  }
  // anyone left standing in the new water is carried to the nearest bank
  for (const p of s.people) {
    const cp = cellOf(p);
    if (!news.has(idx(m, cp.x, cp.y))) continue;
    const to = nearestDry(m, cp.x, cp.y);
    if (to) {
      p.x = (to.x + 0.5) * 32;
      p.y = (to.y + 0.5) * 32;
    }
  }
  if (s.wild) {
    for (const h of s.wild.herds) {
      const to = news.has(idx(m, Math.floor(h.x), Math.floor(h.y))) ? nearestDry(m, Math.floor(h.x), Math.floor(h.y)) : null;
      if (to) {
        h.x = to.x + 0.5;
        h.y = to.y + 0.5;
      }
    }
  }
  const side = at.v ? (move > 0 ? 'east' : 'west') : move > 0 ? 'south' : 'north';
  notify(
    s,
    `🌊 The flood has changed the river's course! It cut a new channel ${Math.abs(move)} cells to the ${side}, leaving ${pond.length ? 'an oxbow pond' : 'rich silt'} where it ran${names.length ? `; the ${names.join(', the ')} in its way ${names.length > 1 ? 'were' : 'was'} swept away` : ''}.`,
    true,
  );
  return true;
}

/** Every cell the camp can walk to (4-way over ground that isn't deep water or mountain), as indices. */
function reach(m: LandMap): Set<number> {
  const seen = new Set<number>();
  const start = idx(m, m.camp.x, m.camp.y);
  const stack = [start];
  seen.add(start);
  const lim = m.open + 3;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % m.w;
    const y = Math.floor(i / m.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inMap(m, nx, ny) || Math.hypot(nx - m.camp.x, ny - m.camp.y) > lim) continue;
      const j = idx(m, nx, ny);
      if (seen.has(j)) continue;
      const gr = groundAt(m, nx, ny);
      if (gr === 'water' || gr === 'mountain') continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return seen;
}

function nearestDry(m: LandMap, x: number, y: number): { x: number; y: number } | null {
  for (let r = 1; r <= 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inMap(m, x + dx, y + dy)) continue;
        if (!wet(groundAt(m, x + dx, y + dy)) && groundAt(m, x + dx, y + dy) !== 'mountain') return { x: x + dx, y: y + dy };
      }
  return null;
}
