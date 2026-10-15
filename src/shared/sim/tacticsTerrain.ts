// The raid board's lay of the land, and the rules the pieces carry (the owner's ask: boards with more variety, random,
// with hills that can be climbed from one side only, trees and other nature pieces). Pure functions on the board's
// tiles: `layTerrain` strews hills with a ramp and steep faces, copses, outcrops, thickets, fallen logs, ponds and a
// stream with its ford over the field before the wall; `boardOk` checks every unit can still reach the fight;
// `canStep`, `sightClear` and `coverChance` are the rules that match (what a step costs, what a bow can see, what a
// tree turns aside). The pieces are laid from a side stream ('board', seeded by the town's seed and the raid's tick), so
// the town's own stream is never drawn on.

import type { Rng } from '../rng';
import type { Biome } from '../data/biomes';
import type { Ground } from './land';
import type { Tactics, TacTile } from './tactics';

type Grid = Pick<Tactics, 'w' | 'h' | 'tiles'>;
type At = { u: number; v: number };

/** The most steps a foot can climb in one tile, however nimble: a face of three is a cliff, climbed from nowhere. */
export const CLIMB_MAX = 2;
/** What each step climbed costs besides the tile's own (a hill is climbed slowly). */
export const CLIMB_COST = 1;
/** A hill's top stands this many steps over its ground. */
export const HILL_RISE = 3;
/** A fallen log is climbed over: it costs this much more. */
export const LOG_COST = 1;
/** Shots turned aside: by a tree or a bush the target stands in, and by a tree, boulder or log beside it on the
 *  shooter's side; a shooter high above finds the target through the cover (it counts half). */
export const SHOT_COVER = { tree: 0.3, bush: 0.2, log: 0.2, beside: 0.15, most: 0.5 };

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const at = (g: Grid, u: number, v: number): TacTile | null => (u >= 0 && v >= 0 && u < g.w && v < g.h ? g.tiles[v * g.w + u] : null);

/** The ground a tile is, for those that can't be stood on at all (rock face of a mountain; deep water for the town). */
function standing(tile: TacTile | null, swim: boolean): boolean {
  if (!tile) return false;
  if (tile.g === 'mountain') return false;
  if (tile.g === 'water' && !swim) return false;
  return tile.block !== 'building' && tile.block !== 'rock';
}

/** What a step from one tile to the next costs a fighter who can jump `jump`, or null if it can't be taken: a climb
 *  of more than `CLIMB_MAX` (or than they jump) is a cliff, a drop of more than a step past their jump is too far; each
 *  step climbed costs `CLIMB_COST` more, marsh and water two, a log over. */
export function canStep(from: TacTile, to: TacTile, jump: number): number | null {
  const rise = to.h - from.h;
  if (rise > Math.min(jump, CLIMB_MAX) || -rise > jump + 1) return null;
  let cost = to.g === 'marsh' || to.g === 'shallows' || to.g === 'water' ? 2 : 1;
  if (rise > 0) cost += rise * CLIMB_COST;
  if (to.log) cost += LOG_COST;
  return cost;
}

/** Whether a shot, a bolt or a straight spell flies from one tile to the other: the tiles between must not stand over
 *  the line from the shooter's eye to the mark (a tree two high, a boulder, a hill's brow). Walls and gates are shot
 *  over, as the town's always been. */
export function sightClear(g: Grid, a: At, b: At): boolean {
  const ta = at(g, a.u, a.v);
  const tb = at(g, b.u, b.v);
  if (!ta || !tb) return false;
  const n = Math.max(Math.abs(b.u - a.u), Math.abs(b.v - a.v));
  if (n <= 1) return true;
  const eye = ta.h + 1.6;
  const mark = tb.h + 1;
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const t = at(g, Math.round(a.u + (b.u - a.u) * f), Math.round(a.v + (b.v - a.v) * f));
    if (!t || t.block === 'wall' || t.gate) continue;
    const top = t.h + (t.tree ? 2 : t.block === 'rock' ? 1.6 : t.log ? 0.5 : 0);
    if (top > eye + (mark - eye) * f + 1e-6) return false;
  }
  return true;
}

/** The share of shots turned aside where the target stands, from a shooter at `from`: a tree or a bush it stands in,
 *  a log, and a tree, boulder or log beside it on the shooter's side. */
export function coverChance(g: Grid, from: At, to: At): number {
  const t = at(g, to.u, to.v);
  const f = at(g, from.u, from.v);
  if (!t || !f) return 0;
  let c = t.tree ? SHOT_COVER.tree : t.bush ? SHOT_COVER.bush : t.log ? SHOT_COVER.log : 0;
  const du = from.u - to.u;
  const dv = from.v - to.v;
  const step: [number, number] = Math.abs(du) >= Math.abs(dv) ? [Math.sign(du), 0] : [0, Math.sign(dv)];
  const near = at(g, to.u + step[0], to.v + step[1]);
  if (near && (near.tree || near.block === 'rock' || near.log)) c += SHOT_COVER.beside;
  if (f.h - t.h >= 2) c *= 0.5;
  return Math.min(SHOT_COVER.most, c);
}

/* ------------------------------------------------------------ what each land lays */

interface Look {
  /** Expected numbers: copses of trees, hills, outcrops of rock, extra thickets, fallen logs. */
  copses: number;
  hills: number;
  rocks: number;
  bushes: number;
  logs: number;
  /** The odds of a pond and of a stream across the field. */
  pond: number;
  stream: number;
}
const LOOKS: Record<Biome, Look> = {
  forest: { copses: 3, hills: 0.7, rocks: 1, bushes: 3, logs: 3, pond: 0.25, stream: 0.3 },
  jungle: { copses: 4, hills: 0.5, rocks: 1, bushes: 4, logs: 3, pond: 0.3, stream: 0.45 },
  taiga: { copses: 3, hills: 0.7, rocks: 2, bushes: 2, logs: 2, pond: 0.2, stream: 0.25 },
  steppe: { copses: 1, hills: 1, rocks: 1, bushes: 2, logs: 0, pond: 0.1, stream: 0.15 },
  highlands: { copses: 1, hills: 2, rocks: 4, bushes: 1, logs: 0, pond: 0.1, stream: 0.3 },
  desert: { copses: 0, hills: 1, rocks: 3, bushes: 1, logs: 0, pond: 0.05, stream: 0 },
  tundra: { copses: 1, hills: 1, rocks: 2, bushes: 1, logs: 0, pond: 0.15, stream: 0.1 },
  coast: { copses: 1, hills: 0.6, rocks: 2, bushes: 1, logs: 2, pond: 0.1, stream: 0.4 },
  swamp: { copses: 2, hills: 0.3, rocks: 0, bushes: 3, logs: 4, pond: 0.8, stream: 0.5 },
  ashlands: { copses: 0, hills: 1.5, rocks: 4, bushes: 0, logs: 0, pond: 0, stream: 0 },
};

const ROLLING: ReadonlySet<Ground> = new Set<Ground>(['grass', 'fertile', 'forest', 'hill', 'sand', 'marsh']);

/** A whole number from an expected one: the whole part, and one more by the fraction's odds. */
const count = (x: number, rng: Rng) => Math.floor(x) + (rng.next() < x - Math.floor(x) ? 1 : 0);

/** Limit the board's steps to what a foot can climb, lowering the higher tile (the land's own relief and the lumps
 *  of lieOfTheLand pile up into faces nobody could cross; the hills laid afterwards are the cliffs). */
export function easeRelief(g: Grid): void {
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let v = 0; v < g.h; v++)
      for (let u = 0; u < g.w; u++) {
        const a = g.tiles[v * g.w + u];
        if (a.g === 'mountain' || a.g === 'water') continue;
        for (const [du, dv] of [DIRS[0], DIRS[1]]) {
          const b = at(g, u + du, v + dv);
          if (!b || b.g === 'mountain' || b.g === 'water' || b.block === 'wall') continue;
          const d = a.h - b.h;
          if (Math.abs(d) <= CLIMB_MAX) continue;
          if (d > 0) a.h = b.h + CLIMB_MAX;
          else b.h = a.h + CLIMB_MAX;
          moved = true;
        }
      }
    if (!moved) break;
  }
}

/** Strew the field (columns 2 to `along - 2`, the town's wall and the raiders' edge left alone) with hills, copses,
 *  outcrops, thickets, logs, a pond and a stream, by the land's look. `share` is how much of the board the land
 *  itself makes wooded, hilly and wet (0 to 1). */
export function layTerrain(g: Grid, along: number, rng: Rng, biome: Biome, share: { wood: number; hill: number; wet: number }, water?: (g: Ground) => [number, number] | null): void {
  const look = LOOKS[biome] ?? LOOKS.forest;
  const lo = 2;
  const hi = along - 2;
  if (hi - lo < 3) return;
  const used = new Set<number>();
  const free = (t: TacTile | null) => !!t && ROLLING.has(t.g) && !t.road && !t.block && t.trap === undefined && !t.hill && !t.log;
  const mark = (u: number, v: number) => used.add(v * g.w + u);
  // (water laid here is painted from a cell of real water, when the land has any)
  const wetted = (t: TacTile) => {
    const cell = water?.(t.g === 'water' ? 'water' : 'shallows') ?? water?.('water');
    if (cell) t.art = cell;
  };
  const pickU = () => rng.int(lo, hi);
  const pickV = () => rng.int(0, g.h - 1);

  // a stream across the field (the way in runs along the board, the stream across it), a ford or two in it
  const wet = g.tiles.filter((t, i) => i % g.w >= lo && i % g.w <= hi && (t.g === 'water' || t.g === 'shallows')).length;
  if (wet < 6 && rng.next() < Math.min(0.85, look.stream + share.wet * 0.5)) {
    let u = rng.int(lo + 1, hi - 1);
    const fords = [rng.int(1, g.h - 3)];
    if (rng.next() < 0.5) fords.push((fords[0] + rng.int(4, 7)) % (g.h - 1));
    for (let v = 0; v < g.h; v++) {
      const t = at(g, u, v);
      if (t && ROLLING.has(t.g) && !t.road && !t.block) {
        const ford = fords.some((f) => v === f || v === f + 1);
        t.g = ford ? 'shallows' : 'water';
        t.h = ford ? Math.max(0, Math.min(t.h, 1) - 1) : 0;
        wetted(t);
        delete t.tree;
        delete t.bush;
        delete t.trap;
        mark(u, v);
      }
      if (rng.next() < 0.3) u = Math.max(lo + 1, Math.min(hi - 1, u + (rng.next() < 0.5 ? -1 : 1)));
    }
  }

  // a pond, shallows round its deep middle
  if (rng.next() < Math.min(0.9, look.pond + share.wet * 0.3)) {
    const cu = rng.int(lo + 1, hi - 1);
    const cv = pickV();
    const r = rng.range(1.4, 2.4);
    for (let v = 0; v < g.h; v++)
      for (let u = lo; u <= hi; u++) {
        const d = Math.hypot(u - cu, (v - cv) * 1.15);
        const t = at(g, u, v)!;
        if (d > r || !free(t) || used.has(v * g.w + u)) continue;
        t.g = d < r - 0.9 ? 'water' : 'shallows';
        t.h = 0;
        wetted(t);
        delete t.tree;
        delete t.bush;
        delete t.trap;
        mark(u, v);
      }
  }

  // hills: a flat-topped rise on level ground, a ramp up one side, a cliff on the rest
  const hills = count(look.hills + 0.5 + share.hill * 2, rng);
  for (let k = 0; k < hills; k++) {
    for (let tries = 0; tries < 12; tries++) {
      const w = rng.int(3, 4);
      const h = rng.int(3, 4);
      const u0 = rng.int(lo + 2, Math.max(lo + 2, hi - w - 1));
      const v0 = rng.int(2, Math.max(2, g.h - h - 3));
      // (the hill and two tiles round it must be open ground)
      const area: number[] = [];
      let ok = u0 + w + 1 <= hi + 1 && v0 + h + 2 <= g.h;
      for (let v = v0 - 2; ok && v < v0 + h + 2; v++)
        for (let u = u0 - 2; u < u0 + w + 2; u++) {
          const t = at(g, u, v);
          // (boulders, trees and logs in the way are cleared)
          if (!t || u < lo || u > hi + 1 || !(ROLLING.has(t.g) && !t.road && !t.hill && t.trap === undefined && (!t.block || t.block === 'rock')) || used.has(v * g.w + u)) {
            ok = false;
            break;
          }
          area.push(v * g.w + u);
        }
      if (!ok) continue;
      const base = Math.max(1, Math.round(area.reduce((n, i) => n + g.tiles[i].h, 0) / area.length));
      for (const i of area) {
        const t = g.tiles[i];
        t.h = base;
        delete t.tree;
        delete t.bush;
        delete t.log;
        delete t.block;
        used.add(i);
      }
      for (let v = v0; v < v0 + h; v++)
        for (let u = u0; u < u0 + w; u++) {
          const t = at(g, u, v)!;
          t.h = base + HILL_RISE;
          t.hill = 'top';
        }
      // (the ramp: two tiles wide, up the side the dice name, in steps of one)
      const way = rng.int(0, 3);
      const [du, dv] = DIRS[way];
      const horizontal = du !== 0;
      const span = horizontal ? h : w;
      const first = (horizontal ? v0 : u0) + Math.floor((span - 2) * rng.next());
      for (let q = 0; q < 2; q++) {
        const lane = first + q;
        // (the edge tile on the ramp's side, then the one outside it)
        const eu = horizontal ? (du > 0 ? u0 + w - 1 : u0) : lane;
        const ev = horizontal ? lane : dv > 0 ? v0 + h - 1 : v0;
        const edge = at(g, eu, ev)!;
        edge.h = base + 2;
        edge.hill = 'ramp';
        const out = at(g, eu + du, ev + dv);
        if (out) {
          out.h = base + 1;
          out.hill = 'ramp';
        }
      }
      break;
    }
  }

  // copses (a knot of trees, cover and a screen for shots), outcrops of boulders, thickets, fallen logs
  const knots = (n: number, size: [number, number], put: (t: TacTile) => void) => {
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 10; tries++) {
        const cu = pickU();
        const cv = pickV();
        const r = rng.range(size[0], size[1]);
        const spot: TacTile[] = [];
        for (let v = Math.floor(cv - r); v <= Math.ceil(cv + r); v++)
          for (let u = Math.floor(cu - r); u <= Math.ceil(cu + r); u++) {
            const t = at(g, u, v);
            if (u >= lo && u <= hi && free(t) && !used.has(v * g.w + u) && Math.hypot(u - cu, v - cv) <= r && rng.next() < 0.7) spot.push(t!);
          }
        if (spot.length < 2) continue;
        for (const t of spot) put(t);
        break;
      }
    }
  };
  knots(count(look.copses + share.wood * 3, rng), [1, 2], (t) => {
    if (t.g !== 'marsh' || rng.next() < 0.5) t.tree = true;
    delete t.bush;
  });
  knots(count(look.rocks, rng), [0.8, 1.4], (t) => {
    if (rng.next() < 0.6) {
      t.block = 'rock';
      t.h += 1;
      delete t.tree;
      delete t.bush;
    }
  });
  knots(count(look.bushes, rng), [0.8, 1.6], (t) => {
    if (!t.tree) t.bush = true;
  });
  for (let i = count(look.logs, rng); i > 0; i--) {
    const t = at(g, pickU(), pickV());
    if (free(t) && !t!.tree && !t!.bush && !used.has(g.tiles.indexOf(t!))) t!.log = true;
  }
}

/** Whether every unit of the town can get about the board: from the gate, over the ground the town can walk, every
 *  tile that can be stood on is reached and the gate reached from it (a hill's top by its ramp, a pond or a cliff
 *  never walling off a corner), the raiders' edge above all. A few strays are let go (a pit made by the land). */
export function boardOk(g: Grid, along: number): boolean {
  const n = g.tiles.length;
  const ok = (i: number) => standing(g.tiles[i], false) && g.tiles[i].block !== 'wall' && g.tiles[i].bld === undefined;
  const gate: number[] = [];
  for (let v = 0; v < g.h; v++) {
    const i = v * g.w + along;
    if (g.tiles[i].gate && standing(g.tiles[i], false)) gate.push(i);
  }
  if (!gate.length) return true; // (a ring of water or stone, with no gate to reach: the land's own, left as it is)
  const walk = (reverse: boolean): Set<number> => {
    const seen = new Set<number>(gate);
    const queue = [...gate];
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi];
      const [u, v] = [i % g.w, Math.floor(i / g.w)];
      for (const [du, dv] of DIRS) {
        const j = (v + dv) * g.w + u + du;
        if (u + du < 0 || v + dv < 0 || u + du >= g.w || v + dv >= g.h || seen.has(j) || !standing(g.tiles[j], false)) continue;
        // (forward: from the gate out; reverse: the tiles from which a step leads to this one)
        const step = reverse ? canStep(g.tiles[j], g.tiles[i], 2) : canStep(g.tiles[i], g.tiles[j], 2);
        if (step === null) continue;
        seen.add(j);
        queue.push(j);
      }
    }
    return seen;
  };
  const out = walk(false);
  const back = walk(true);
  let lost = 0;
  let all = 0;
  for (let i = 0; i < n; i++) {
    if (!ok(i)) continue;
    all++;
    if (out.has(i) && back.has(i)) continue;
    // (nobody may start in a pocket: the raiders' two edge columns and the town's own are kept whole)
    if (i % g.w < 2) return false;
    lost++;
  }
  return lost <= Math.floor(all * 0.03);
}
