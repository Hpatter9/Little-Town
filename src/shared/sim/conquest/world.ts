// The conquest's world (data/conquest.ts): a map of its own, made from the town's seed and the number of realms, cut
// into provinces. The land is an island of noise (the sea round it, mountains on the heights, one of the ten lands by
// warmth and wet), the provinces grown over it from seeds thrown far apart (so each is one piece of ground, its
// neighbours those it shares a border with on land, and a harbour joins coasts across a strait where nothing else
// would), each realm's capital set far from the others with one province beside it, and the rest free. Everything
// is seeded, so a world replays from its seed and a save holds only what changes (who holds what).

import type { Biome } from '../../data/biomes';
import {
  CELL_CODE, CELL_CODES, FORTS, LAND_SHARE, LANDMARK_CHANCE, LANDMARK_ODDS, NAME_FIRST, NAME_SECOND, PROVINCES_PER_REALM, REALMS_MAX,
  REALMS_MIN, START_PROVINCES, TIERS, worldSide, YIELD_BY_LAND, type LandmarkKind, type WorldCell,
} from '../../data/conquest';
import { hashSeed, mixSeed, Rng } from '../../rng';
import { noise } from '../land';

export interface Province {
  id: number;
  name: string;
  /** The land it mostly is. */
  land: Biome;
  /** Its cells (indices into the world's grid), and the middle (the seed it grew from). */
  cells: number[];
  x: number;
  y: number;
  /** Provinces it shares a border with (and across the water, through a harbour). */
  neighbours: number[];
  /** Lies on the sea. */
  coast: boolean;
  /** Settlement tier (index into TIERS) and fort (index into FORTS) as founded. */
  tier: number;
  fort: number;
  landmark: LandmarkKind | null;
  /** The realm whose capital this is (index into the world's realms), if any. */
  capitalOf: number | null;
}

export interface WorldRealm {
  /** 'town' for the player's, else the faction id (sim/factions.ts). */
  id: string;
  capital: number;
  /** The provinces it holds at the founding. */
  starts: number[];
}

export interface ConquestWorld {
  seed: string;
  realms: WorldRealm[];
  side: number;
  /** One character a cell: the index into CELL_CODES, as a digit or letter. */
  cells: string;
  /** Each cell's province, -1 for the sea. */
  owner: Int16Array;
  provinces: Province[];
}

const CODE_CHARS = '0123456789ab';
export const cellOf = (w: ConquestWorld, x: number, y: number): WorldCell => CELL_CODES[CODE_CHARS.indexOf(w.cells[y * w.side + x])] ?? 'water';

/** The world for a seed and a number of realms (the town first, then the rival factions by id). */
export function makeWorld(seed: string, realmIds: string[]): ConquestWorld {
  const realms = Math.max(REALMS_MIN, Math.min(REALMS_MAX, realmIds.length));
  const side = worldSide(realms);
  const h = mixSeed(hashSeed(seed), 0xc0c0);
  const rng = new Rng(h);
  const n = side * side;

  // ---- the land: height makes the sea and the mountains, warmth and wet pick the land
  const height = noise(h ^ 0x11, side / 3.2);
  const ridge = noise(h ^ 0x19, side / 7); // (finer, so the peaks come as ranges, not one mass)
  const warmth = noise(h ^ 0x23, side / 1.4);
  const wet = noise(h ^ 0x37, side / 2.2);
  const hs = new Float32Array(n);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      // (an island: the heights fall off toward the edges)
      const dx = (x + 0.5) / side - 0.5;
      const dy = (y + 0.5) / side - 0.5;
      const edge = Math.max(0, 1 - Math.hypot(dx, dy) * 2.3);
      hs[y * side + x] = height(x, y) * 0.55 + ridge(x, y) * 0.25 + edge * 0.45;
    }
  const sorted = Array.from(hs).sort((a, b) => a - b);
  const seaLevel = sorted[Math.floor(n * (1 - LAND_SHARE))];
  const peakLevel = sorted[Math.floor(n * 0.96)];
  const codes = new Uint8Array(n);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const i = y * side + x;
      let cell: WorldCell;
      if (hs[i] < seaLevel) cell = 'water';
      else if (hs[i] >= peakLevel) cell = 'mountain';
      else {
        const t = warmth(x, y) * 0.6 + ((y + 0.5) / side) * 0.4; // (warmer to the south)
        const m = wet(x, y);
        const high = (hs[i] - seaLevel) / Math.max(1e-6, peakLevel - seaLevel);
        cell = landFor(t, m, high);
      }
      codes[i] = CELL_CODE[cell];
    }
  // the coast: dry cells by the sea become the coast land where they're low and warm enough
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const i = y * side + x;
      if (codes[i] === CELL_CODE.water || codes[i] === CELL_CODE.mountain) continue;
      if (bySea(codes, side, x, y) && rng.chance(0.55)) codes[i] = CELL_CODE.coast;
    }

  // ---- the provinces: seeds thrown far apart on dry ground, grown out over the land
  const count = PROVINCES_PER_REALM * realms;
  const dry: number[] = [];
  for (let i = 0; i < n; i++) if (codes[i] !== CELL_CODE.water && codes[i] !== CELL_CODE.mountain) dry.push(i);
  const seeds = farApart(rng, dry, side, count);
  const owner = new Int16Array(n).fill(-1);
  const cells: number[][] = seeds.map(() => []);
  const queue: number[] = [];
  seeds.forEach((c, p) => {
    owner[c] = p;
    cells[p].push(c);
    queue.push(c);
  });
  // (a breadth-first growth from every seed at once over the passable land; then the mountains are claimed from
  // whatever stands beside them, so no gaps are left)
  const grow = (over: (j: number) => boolean) => {
    let head = 0;
    while (head < queue.length) {
      const c = queue[head++];
      const p = owner[c];
      const x = c % side;
      const y = (c - x) / side;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= side || ny >= side) continue;
        const j = ny * side + nx;
        if (owner[j] >= 0 || !over(j)) continue;
        owner[j] = p;
        cells[p].push(j);
        queue.push(j);
      }
    }
  };
  grow((j) => codes[j] !== CELL_CODE.water && codes[j] !== CELL_CODE.mountain);
  queue.length = 0;
  for (let i = 0; i < n; i++) if (owner[i] >= 0) queue.push(i);
  grow((j) => codes[j] !== CELL_CODE.water);
  // (a scrap of dry ground no seed could reach, an islet, goes under the sea)
  for (let i = 0; i < n; i++) if (owner[i] < 0) codes[i] = CELL_CODE.water;

  // ---- what each province is
  const provinces: Province[] = seeds.map((c, p) => {
    const tally: Partial<Record<WorldCell, number>> = {};
    let coast = false;
    for (const i of cells[p]) {
      const k = CELL_CODES[codes[i]];
      tally[k] = (tally[k] ?? 0) + 1;
      if (!coast && bySea(codes, side, i % side, Math.floor(i / side))) coast = true;
    }
    let land: Biome = 'forest';
    let best = -1;
    for (const k of Object.keys(tally) as WorldCell[]) if (k !== 'water' && k !== 'mountain' && tally[k]! > best) (best = tally[k]!), (land = k);
    return { id: p, name: '', land, cells: cells[p], x: c % side, y: Math.floor(c / side), neighbours: [], coast, tier: 0, fort: 0, landmark: null, capitalOf: null };
  });
  // neighbours: a border on land
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const a = owner[y * side + x];
      if (a < 0) continue;
      for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
        if (nx >= side || ny >= side) continue;
        const b = owner[ny * side + nx];
        if (b < 0 || b === a) continue;
        if (!provinces[a].neighbours.includes(b)) provinces[a].neighbours.push(b);
        if (!provinces[b].neighbours.includes(a)) provinces[b].neighbours.push(a);
      }
    }
  // every province reachable: islands are joined to the mainland by a harbour each side of the shortest strait
  joinIslands(provinces, rng);
  for (const p of provinces) p.neighbours.sort((a, b) => a - b);

  // ---- the realms: capitals far apart, the town's first; one province beside each to begin with
  const capitals = farApartProvinces(provinces, realms, rng);
  const taken = new Set<number>(capitals);
  const worldRealms: WorldRealm[] = realmIds.slice(0, realms).map((id, r) => {
    const cap = capitals[r];
    provinces[cap].capitalOf = r;
    provinces[cap].tier = id === 'town' ? 1 : 2;
    provinces[cap].fort = id === 'town' ? 1 : 2;
    provinces[cap].landmark = null;
    const starts = [cap];
    const free = provinces[cap].neighbours.filter((q) => !taken.has(q) && provinces[q].capitalOf === null);
    for (let i = 1; i < START_PROVINCES && free.length; i++) {
      const q = free.splice(rng.int(0, free.length - 1), 1)[0];
      taken.add(q);
      starts.push(q);
    }
    return { id, capital: cap, starts };
  });

  // ---- settlements, forts and landmarks for the rest, and names for all
  const used = new Set<string>();
  for (const p of provinces) {
    if (p.capitalOf === null) {
      p.tier = rng.chance(0.55) ? 0 : rng.chance(0.7) ? 1 : 2;
      p.fort = p.tier >= 2 && rng.chance(0.6) ? 1 : p.tier >= 1 && rng.chance(0.2) ? 1 : 0;
      if (rng.chance(LANDMARK_CHANCE)) p.landmark = rng.weighted(LANDMARK_ODDS) as LandmarkKind;
    }
    for (let tries = 0; tries < 20; tries++) {
      const name = rng.pick(NAME_FIRST[p.land]) + rng.pick(NAME_SECOND);
      if (!used.has(name)) {
        used.add(name);
        p.name = name;
        break;
      }
    }
    if (!p.name) p.name = `${rng.pick(NAME_FIRST[p.land])}${rng.pick(NAME_SECOND)} ${p.id + 1}`;
  }

  let str = '';
  for (let i = 0; i < n; i++) str += CODE_CHARS[codes[i]];
  return { seed, realms: worldRealms, side, cells: str, owner, provinces };
}

/** Which land warmth, wet and height make. */
function landFor(t: number, m: number, high: number): Biome {
  if (high > 0.72) return t < 0.4 ? 'tundra' : 'highlands';
  if (t < 0.3) return m > 0.55 ? 'taiga' : 'tundra';
  if (t < 0.52) return m > 0.6 ? 'swamp' : m > 0.35 ? 'forest' : 'highlands';
  if (t < 0.72) return m > 0.62 ? 'jungle' : m > 0.4 ? 'forest' : 'steppe';
  return m > 0.6 ? 'jungle' : m > 0.35 ? 'ashlands' : 'desert';
}

function bySea(codes: Uint8Array, side: number, x: number, y: number): boolean {
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
    if (nx < 0 || ny < 0 || nx >= side || ny >= side) return true; // (the map's edge is the open sea)
    if (codes[ny * side + nx] === CELL_CODE.water) return true;
  }
  return false;
}

/** `count` cells of `pool` spread out: the first at random, each next the farthest from those picked (with a little
 *  noise, so worlds differ). */
function farApart(rng: Rng, pool: number[], side: number, count: number): number[] {
  const picked: number[] = [pool[rng.int(0, pool.length - 1)]];
  const dist = new Float32Array(pool.length).fill(Infinity);
  const xy = (c: number) => [c % side, Math.floor(c / side)];
  while (picked.length < count && picked.length < pool.length) {
    const [lx, ly] = xy(picked[picked.length - 1]);
    let best = -1;
    let bestD = -1;
    for (let i = 0; i < pool.length; i++) {
      const [x, y] = xy(pool[i]);
      const d = Math.min(dist[i], Math.hypot(x - lx, y - ly));
      dist[i] = d;
      const score = d * (0.85 + rng.next() * 0.3);
      if (score > bestD && d > 0) (bestD = score), (best = i);
    }
    if (best < 0) break;
    picked.push(pool[best]);
  }
  return picked;
}

/** Capitals: provinces far apart by the graph and the ground, big enough to live in (never a lair). */
function farApartProvinces(provinces: Province[], count: number, rng: Rng): number[] {
  const able = provinces.filter((p) => p.cells.length >= 6 && p.neighbours.length >= 1);
  const pool = able.length >= count ? able : provinces;
  const picked: number[] = [pool[rng.int(0, pool.length - 1)].id];
  while (picked.length < count) {
    let best = -1;
    let bestD = -1;
    for (const p of pool) {
      if (picked.includes(p.id)) continue;
      let d = Infinity;
      for (const q of picked) d = Math.min(d, Math.hypot(p.x - provinces[q].x, p.y - provinces[q].y));
      const score = d * (0.9 + rng.next() * 0.2);
      if (score > bestD) (bestD = score), (best = p.id);
    }
    if (best < 0) break;
    picked.push(best);
  }
  return picked;
}

/** Join the provinces into one graph: while two pieces stand apart, the nearest coastal pair across the water is
 *  given harbours and made neighbours. */
function joinIslands(provinces: Province[], rng: Rng): void {
  const part = (start: number): Set<number> => {
    const seen = new Set<number>([start]);
    const stack = [start];
    while (stack.length) for (const q of provinces[stack.pop()!].neighbours) if (!seen.has(q)) (seen.add(q), stack.push(q));
    return seen;
  };
  for (let guard = 0; guard < provinces.length; guard++) {
    const main = part(0);
    if (main.size === provinces.length) return;
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const a of provinces) {
      if (!main.has(a.id)) continue;
      for (const b of provinces) {
        if (main.has(b.id)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y) * ((a.coast ? 1 : 1.5) * (b.coast ? 1 : 1.5));
        if (d < bestD) (bestD = d), (best = [a.id, b.id]);
      }
    }
    if (!best) return;
    const [a, b] = best;
    provinces[a].neighbours.push(b);
    provinces[b].neighbours.push(a);
    for (const id of [a, b]) if (provinces[id].capitalOf === null) provinces[id].landmark = 'harbour';
    void rng;
  }
}

/** What a province gives its holder a day. */
export function provinceYield(p: Province): { coins: number; recruits: number; material: string; amount: number } {
  const tier = TIERS[p.tier];
  const y = YIELD_BY_LAND[p.land];
  const mine = p.landmark === 'mine' ? 1.5 : 1;
  const cross = p.landmark === 'crossroads' ? 1.5 : 1;
  return { coins: Math.round(tier.coins * cross), recruits: tier.recruits, material: y.material, amount: Math.round(y.amount * tier.yieldMult * mine * 10) / 10 };
}
export const fortName = (p: Province) => FORTS[p.fort].name;
export const tierName = (p: Province) => TIERS[p.tier].name;
