// Mountains in every land (the owner's ask: "Mountains should be a part of every terrain to some extent. Whether it's
// sparse hills or full-on mountains. The town either has to use it, mine it, build into it, tunnel through it, or go
// around it."). The land's relief is a second layer over its ground, one character per cell (`LandMap.relief`):
//   '0' level ground;
//   '1' rolling hills (the downs: walked a little slower, fields do less well, grazing and orchards better);
//   '2' rocky hills (walkable, with outcrops of solid rock among them: `mountain` ground, quarried);
//   '3' high ground (foothills: a shelf ringed by cliffs, jumped down from anywhere, climbed only by a ramp or a street);
//   '4' a ramp up onto the high ground (a cell of it that can be climbed to);
//   '5' a range (true mountains: solid `mountain` rock, with passes through it).
// Each land's table (data/biomes.ts `relief`) says how much of it lies in each form. Laid from the seed after the rest
// of the land, on streams of its own, so every cell it leaves alone is the cell that seed always made; and only for a
// town founded with it (state.ts `newGame`, `relief`): a town's land is kept in its save, so older towns keep theirs.

import type { Biome } from '../data/biomes';
import { BIOME_DEFS } from '../data/biomes';
import type { Ground, LandMap } from './land';
import { hashSeed, Rng } from '../rng';

/** The relief codes. */
export const LEVEL = '0';
export const DOWNS = '1';
export const ROCKY = '2';
export const HIGH = '3';
export const RAMP = '4';
export const RANGE = '5';
export type ReliefKind = 'downs' | 'rocky' | 'high' | 'range';

/** How near the camp each form may lie (cells): the downs anywhere past the camp's clearing; outcrops beyond the
 *  first stretch of wild; the cliffs and the ranges beyond the land known at the start. */
export const DOWNS_NEAR = 7;
export const OUTCROP_NEAR = 12;
export const HIGH_NEAR = 14;
export const RANGE_NEAR = 16;
/** How much of the rocky hills is outcrop (the top of a fine noise). */
export const OUTCROP_SHARE = 0.22;
/** A shelf of high ground smaller than this is only rocky hill; a shelf has a ramp for every `RAMP_EVERY` cells. */
export const HIGH_LEAST = 10;
export const RAMP_EVERY = 70;
/** A pocket of open ground shut in by a range smaller than this is filled in; a larger one gets a pass cut to it. */
export const POCKET_FILL = 40;

/** What a step onto each form costs, times its ground's own cost. */
export const RELIEF_COST: Readonly<Record<string, number>> = { '1': 1.15, '2': 1.25, '3': 1.05, '4': 1.15 };

/** A cell's relief code ('0' on a land with none). */
export const reliefAt = (m: Pick<LandMap, 'relief' | 'w'>, x: number, y: number): string => (m.relief ? m.relief[y * m.w + x] ?? LEVEL : LEVEL);
/** Whether a code is the high ground (a shelf, its ramps included). */
export const isHigh = (c: string) => c === HIGH || c === RAMP;
/** Whether a cell is hill country of any sort (the downs, rocky hills or the high ground). */
export const isHilly = (c: string) => c === DOWNS || c === ROCKY || c === HIGH || c === RAMP;

/** Whether stepping from cell a onto cell b climbs a cliff (from below the high ground onto it, but at a ramp or a
 *  street: a street cut up the face makes steps). A drop down is always allowed (a jump). */
export function climbs(relief: string, roads: string, a: number, b: number): boolean {
  const cb = relief.charCodeAt(b);
  if (cb !== 51) return false; // ('3': only the high ground's own cells are cliff-topped; a ramp is climbed)
  const ca = relief.charCodeAt(a);
  if (ca === 51 || ca === 52) return false;
  return roads.charCodeAt(b) !== 35 && roads.charCodeAt(a) !== 35; // ('#')
}

/** Whether two side-by-side cells have a cliff between them (one on the high ground proper, the other below it; a ramp
 *  or a street already there is a way up). */
export function cliffAhead(m: Pick<LandMap, 'relief' | 'roads' | 'w' | 'h'>, ax: number, ay: number, bx: number, by: number): boolean {
  if (!m.relief || ax < 0 || ay < 0 || bx < 0 || by < 0 || ax >= m.w || bx >= m.w || ay >= m.h || by >= m.h) return false;
  const a = ay * m.w + ax;
  const b = by * m.w + bx;
  return climbs(m.relief, m.roads, a, b) || climbs(m.relief, m.roads, b, a);
}

/** Rock a building may stand against or be cut into: the solid rock of a range or an outcrop (never the dwarves'
 *  own mountain, nor dug ground). */
export const rockCell = (m: Pick<LandMap, 'relief' | 'cells' | 'w' | 'h'>, x: number, y: number) =>
  !!m.relief && x >= 0 && y >= 0 && x < m.w && y < m.h && m.cells[y * m.w + x] === 'M' && (m.relief[y * m.w + x] === RANGE || m.relief[y * m.w + x] === ROCKY);
/** How many cells of rock touch a footprint along its sides (a quarry needs `QUARRY_ROCK`). */
export function rockBeside(m: Pick<LandMap, 'relief' | 'cells' | 'w' | 'h'>, r: { x: number; y: number; w: number; h: number }): number {
  let n = 0;
  for (let x = r.x; x < r.x + r.w; x++) n += (rockCell(m, x, r.y - 1) ? 1 : 0) + (rockCell(m, x, r.y + r.h) ? 1 : 0);
  for (let y = r.y; y < r.y + r.h; y++) n += (rockCell(m, r.x - 1, y) ? 1 : 0) + (rockCell(m, r.x + r.w, y) ? 1 : 0);
  return n;
}
export const QUARRY_ROCK = 2;
/** Whether a footprint is cut into a cliff face: its back (top) row is rock with more rock behind it, the door at its
 *  front on open ground. */
export function cutInto(m: Pick<LandMap, 'relief' | 'cells' | 'w' | 'h'>, r: { x: number; y: number; w: number; h: number }): boolean {
  if (r.h < 2) return false;
  for (let x = r.x; x < r.x + r.w; x++) if (!rockCell(m, x, r.y) || !rockCell(m, x, r.y - 1)) return false;
  return true;
}

/** The share of a land's cells in each form. */
export function reliefShares(m: Pick<LandMap, 'relief'>): Record<ReliefKind, number> {
  const out: Record<ReliefKind, number> = { downs: 0, rocky: 0, high: 0, range: 0 };
  if (!m.relief) return out;
  for (let i = 0; i < m.relief.length; i++) {
    const c = m.relief[i];
    if (c === DOWNS) out.downs++;
    else if (c === ROCKY) out.rocky++;
    else if (c === HIGH || c === RAMP) out.high++;
    else if (c === RANGE) out.range++;
  }
  const n = m.relief.length;
  for (const k of Object.keys(out) as ReliefKind[]) out[k] /= n;
  return out;
}

type Noise = (x: number, y: number) => number;

/** Lay the relief over a land's ground (in place: `grid` is the ground, row by row; pools of cells turned to rock are
 *  dropped). Returns the relief string. */
export function layRelief(grid: Ground[], pools: LandMap['pools'], w: number, h: number, camp: { x: number; y: number }, biome: Biome, seed: string, noise: (seed: number, scale: number) => Noise): string {
  const table = BIOME_DEFS[biome].relief;
  const seedHash = hashSeed(`${seed}:relief`);
  const rng = new Rng(seedHash);
  const n = w * h;
  const rel = new Uint8Array(n).fill(48);
  const dist = (i: number) => Math.hypot((i % w) - camp.x, Math.floor(i / w) - camp.y);
  // the lie of the land: a broad swell and a ridged field (ranges run along the ridges), low by the camp
  const broad = noise(seedHash ^ 0x91, 26);
  const ridge = noise(seedHash ^ 0x92, 14);
  const pass = noise(seedHash ^ 0x93, 9);
  const fine = noise(seedHash ^ 0x94, 2.5);
  // (a land with ranges has one along one side of the camp, the north mostly: the town plan grows south of its square,
  // its graveyard and its learned quarter behind it, sim/layout.ts, so the town has its back to the range)
  const ranged = table.range > 0;
  const angle = -Math.PI / 2 + (rng.next() - 0.5) * (Math.PI / 2);
  const bx = Math.cos(angle);
  const by = Math.sin(angle);
  const height = new Float32Array(n);
  const elig: number[] = [];
  for (let i = 0; i < n; i++) {
    const g = grid[i];
    if (g === 'water' || g === 'shallows' || g === 'mountain' || g === 'hall') continue;
    const x = i % w;
    const y = (i - x) / w;
    const d = dist(i);
    if (d <= DOWNS_NEAR) continue;
    const r = ridge(x, y);
    let v = broad(x, y) * 0.6 + (1 - Math.abs(r * 2 - 1)) * 0.4;
    if (ranged) v += (Math.max(-1, Math.min(1, ((x - camp.x) * bx + (y - camp.y) * by) / 50)) + 1) * 0.12;
    v -= Math.max(0, 22 - d) * 0.012; // (the vale about the camp lies low)
    height[i] = v;
    elig.push(i);
  }
  elig.sort((a, b) => height[b] - height[a] || a - b);
  // the highest cells are the range, then the high ground, the rocky hills and the downs, each its share of the land
  const want = { range: Math.round(table.range * n), high: Math.round(table.high * n), rocky: Math.round(table.rocky * n), downs: Math.round(table.downs * n) };
  const got = { range: 0, high: 0, rocky: 0, downs: 0 };
  for (const i of elig) {
    const d = dist(i);
    if (got.range < want.range && d >= RANGE_NEAR) {
      // (a pass winds through the range where the pass field runs near its middle)
      if (Math.abs(pass(i % w, Math.floor(i / w)) - 0.5) < 0.03) continue;
      rel[i] = 53;
      got.range++;
    } else if (got.high < want.high && d >= HIGH_NEAR) {
      rel[i] = 51;
      got.high++;
    } else if (got.rocky < want.rocky && d >= OUTCROP_NEAR - 3) {
      rel[i] = 50;
      got.rocky++;
    } else if (got.downs < want.downs) {
      rel[i] = 49;
      got.downs++;
    } else if (got.range >= want.range && got.high >= want.high && got.rocky >= want.rocky) break;
  }
  // (the passes left in the range: the rocky ground of the way through)
  for (const i of elig) if (rel[i] === 48 && got.range > 0 && Math.abs(pass(i % w, Math.floor(i / w)) - 0.5) < 0.03 && height[i] >= height[elig[Math.min(elig.length - 1, want.range)]]) rel[i] = 50;

  const N4 = [1, -1, w, -w];
  const nb = (i: number, k: number) => {
    const x = i % w;
    if ((k === 0 && x === w - 1) || (k === 1 && x === 0)) return -1;
    const j = i + N4[k];
    return j < 0 || j >= n ? -1 : j;
  };
  // the range is solid rock
  for (let i = 0; i < n; i++) if (rel[i] === 53) grid[i] = 'mountain';
  // outcrops among the rocky hills
  for (let i = 0; i < n; i++) if (rel[i] === 50 && dist(i) >= OUTCROP_NEAR && fine(i % w, Math.floor(i / w)) > 1 - OUTCROP_SHARE - 0.08) grid[i] = 'mountain';

  // every open cell can be reached from the camp: pockets shut in by rock are filled, or a pass is cut to them
  const solid = (i: number) => grid[i] === 'mountain' || grid[i] === 'hall';
  const campI = camp.y * w + camp.x;
  for (let round = 0; round < 12; round++) {
    const seen = new Uint8Array(n);
    const q = [campI];
    seen[campI] = 1;
    for (let k = 0; k < q.length; k++) for (let t = 0; t < 4; t++) {
      const j = nb(q[k], t);
      if (j >= 0 && !seen[j] && !solid(j)) {
        seen[j] = 1;
        q.push(j);
      }
    }
    let changed = false;
    for (let lone = 0; lone < n; lone++) {
      if (seen[lone] || solid(lone)) continue;
      // (the pocket it lies in)
      const pocket = [lone];
      seen[lone] = 2;
      for (let k = 0; k < pocket.length; k++) for (let t = 0; t < 4; t++) {
        const j = nb(pocket[k], t);
        if (j >= 0 && !seen[j] && !solid(j)) {
          seen[j] = 2;
          pocket.push(j);
        }
      }
      // (a pocket shut in by the dwarves' own mountain, or one an older land had already, is left as it was)
      const ours = pocket.some((i) => { for (let t = 0; t < 4; t++) { const j = nb(i, t); if (j >= 0 && solid(j) && rel[j] !== 53 && rel[j] !== 50) return true; } return false; });
      if (ours) continue;
      changed = true;
      const wet = pocket.some((i) => grid[i] === 'water' || grid[i] === 'shallows');
      if (pocket.length < POCKET_FILL && !wet) {
        for (const i of pocket) {
          grid[i] = 'mountain';
          rel[i] = 53;
        }
        continue;
      }
      // (a pass, two cells wide, from the pocket's cell nearest the camp straight towards the camp)
      let from = pocket[0];
      for (const i of pocket) if (dist(i) < dist(from)) from = i;
      let x = from % w;
      let y = Math.floor(from / w);
      for (let guard = 0; guard < w + h; guard++) {
        const dx = camp.x - x;
        const dy = camp.y - y;
        const along = Math.abs(dx) >= Math.abs(dy);
        if (along) x += Math.sign(dx);
        else y += Math.sign(dy);
        let reached = false;
        for (const [cx, cy] of [[x, y], [x + (along ? 0 : 1), y + (along ? 1 : 0)]]) {
          if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
          const j = cy * w + cx;
          if (seen[j] === 1) reached = true;
          if (solid(j) && (rel[j] === 53 || rel[j] === 50)) {
            grid[j] = 'grass';
            rel[j] = 50;
            seen[j] = 2; // (the pass is this pocket's: not taken later this round for a pocket of its own)
          }
        }
        if (reached || (x === camp.x && y === camp.y)) break;
      }
    }
    if (!changed) break;
  }
  // (the open ground of a sandy land is sand: a pass cut through rock there is too)
  const open = BIOME_DEFS[biome].open ?? 'grass';
  if (open !== 'grass') for (let i = 0; i < n; i++) if (grid[i] === 'grass' && rel[i] === 50) grid[i] = open;
  for (let i = 0; i < n; i++) if (grid[i] === 'mountain' && rel[i] !== 48) delete pools[i];

  // the high ground: shelves too small are only rocky hill; the rest get ramps
  const comp = new Int32Array(n).fill(-1);
  const shelves: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (rel[i] !== 51 || comp[i] >= 0 || solid(i)) continue;
    const cells = [i];
    comp[i] = shelves.length;
    for (let k = 0; k < cells.length; k++) for (let t = 0; t < 4; t++) {
      const j = nb(cells[k], t);
      if (j >= 0 && rel[j] === 51 && comp[j] < 0 && !solid(j)) {
        comp[j] = shelves.length;
        cells.push(j);
      }
    }
    shelves.push(cells);
  }
  const lowNb = (i: number) => { for (let t = 0; t < 4; t++) { const j = nb(i, t); if (j >= 0 && !solid(j) && rel[j] !== 51 && rel[j] !== 52 && grid[j] !== 'water' && grid[j] !== 'shallows') return true; } return false; };
  const sideRng = new Rng(hashSeed(`${seed}:relief:ramps`));
  for (const cells of shelves) {
    if (cells.length < HIGH_LEAST) {
      for (const i of cells) rel[i] = 50;
      continue;
    }
    // (a ramp nearest the camp, and more spread round the edge for a big shelf)
    const edge = cells.filter(lowNb).sort((a, b) => dist(a) - dist(b) || a - b);
    if (!edge.length) continue;
    rel[edge[0]] = 52;
    const more = Math.floor(cells.length / RAMP_EVERY);
    for (let k = 0; k < more; k++) rel[edge[sideRng.int(0, edge.length - 1)]] = 52;
  }
  // (and a shelf any cell can't be got down from or up to, the way the walkers go, gets another ramp till all can)
  for (let round = 0; round < 30; round++) if (!rampFix(rel, grid, w, h, campI, nb, round >= 20)) break;
  // (the sea land's water and the dwarves' halls are never hill)
  for (let i = 0; i < n; i++) if ((grid[i] === 'water' || grid[i] === 'shallows') && rel[i] !== 48) rel[i] = 48;
  return decode(rel);
}

const decode = (rel: Uint8Array) => {
  let out = '';
  for (let i = 0; i < rel.length; i += 4096) out += String.fromCharCode(...rel.subarray(i, i + 4096));
  return out;
};

/** One round of making every cell reachable both ways: a shelf the camp can't climb to gets a ramp where its edge
 *  meets ground the camp reaches (or, with none, is only rocky hill); low ground shut in below a cliff gets a ramp up
 *  the face, onto a shelf the camp can be got back to from if there is one. Late on (`last`), a shelf that still shuts
 *  ground in is only rocky hill. Ground cut off by rock alone (the dwarves' own pockets) is left. How many were mended. */
function rampFix(rel: Uint8Array, grid: Ground[], w: number, h: number, campI: number, nb: (i: number, k: number) => number, last = false): number {
  const n = w * h;
  const pass = (i: number) => grid[i] !== 'mountain' && grid[i] !== 'hall';
  const high = (i: number) => rel[i] === 51 || rel[i] === 52;
  // (a step a→b climbs when b is the high ground proper and a isn't high)
  const ok = (a: number, b: number) => !(rel[b] === 51 && !high(a));
  const flood = (dir: 0 | 1 | 2) => {
    const seen = new Uint8Array(n);
    const q = [campI];
    seen[campI] = 1;
    for (let k = 0; k < q.length; k++)
      for (let t = 0; t < 4; t++) {
        const j = nb(q[k], t);
        if (j < 0 || seen[j] || !pass(j)) continue;
        if (dir === 1 ? !ok(q[k], j) : dir === 2 ? !ok(j, q[k]) : false) continue;
        seen[j] = 1;
        q.push(j);
      }
    return seen;
  };
  const any = flood(0);
  const fwd = flood(1);
  const bwd = flood(2);
  const done = new Uint8Array(n);
  let mended = 0;
  for (let i = 0; i < n; i++) {
    if (!any[i] || done[i] || (fwd[i] && bwd[i])) continue;
    const up = high(i);
    const area = spread(i, nb, (j) => pass(j) && high(j) === up);
    for (const c of area) done[c] = 1;
    if (up && !fwd[i]) {
      let edge = -1;
      for (const c of area) {
        for (let t = 0; t < 4 && edge < 0; t++) {
          const j = nb(c, t);
          if (j >= 0 && fwd[j] && !high(j)) edge = c;
        }
        if (edge >= 0) break;
      }
      if (edge >= 0) rel[edge] = 52;
      else for (const c of area) rel[c] = 50;
      mended++;
    } else if (!up && !bwd[i]) {
      let face = -1;
      let home = -1;
      for (const c of area)
        for (let t = 0; t < 4; t++) {
          const j = nb(c, t);
          if (j < 0 || rel[j] !== 51) continue;
          if (face < 0) face = j;
          if (home < 0 && bwd[j]) home = j;
        }
      if (last && face >= 0) {
        // (the shelves about it brought down to rocky hill: no cliff left to shut it in)
        for (const c of area)
          for (let t = 0; t < 4; t++) {
            const j = nb(c, t);
            if (j >= 0 && rel[j] === 51) for (const e of spread(j, nb, (q) => high(q) && pass(q))) rel[e] = 50;
          }
        mended++;
      } else if (face >= 0) {
        rel[home >= 0 ? home : face] = 52;
        mended++;
      }
    }
  }
  return mended;
}

function spread(from: number, nb: (i: number, k: number) => number, keep: (i: number) => boolean): number[] {
  const out = [from];
  const seen = new Set([from]);
  for (let k = 0; k < out.length && out.length < 4000; k++)
    for (let t = 0; t < 4; t++) {
      const j = nb(out[k], t);
      if (j >= 0 && !seen.has(j) && keep(j)) {
        seen.add(j);
        out.push(j);
      }
    }
  return out;
}
