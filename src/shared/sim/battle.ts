// Tower-defence raids (CLAUDE.md, "Tower-defence raids"). When raiders arrive they don't simply walk into the town:
// they come down a trail over the town's own land (the cheapest way in from its edge to the town's gate), and the
// townsfolk are the towers. Melee fighters
// stand on the trail and block it, each holding a few raiders; archers stand on the wall spots (or the few ground spots
// beside the trail) and shoot; the town's defence buildings are fixed towers; the founder is a hero. Raiders walk the
// trail at their own pace, fight whoever blocks them, shoot from range if they can, and run back if they break. Whoever
// gets to the end of the trail is through: they reach the town and do what raiders do there (raids.ts takes them on).
//
// Before the raiders come there's a placing phase: the player places the fighters (the `battlePlace` command), or the
// town places them itself when the time runs out, when the player has asked it to (auto-watch, `s.autoBattle`), or
// when the raid plays out without them (`Raid.alone`). Big raids come in waves, with a breather between.
//
// Everything here is part of the deterministic sim: battles play out the same in the forecast, in time away and in
// the tests. The map is laid out when the battle starts (from the land and the town as they stand then) and kept on
// the raid. Spots, trails and aims are in the land's cells (CELL px each); the raiders' px positions follow them.

import { before, credit, TOWERS } from './raidRecap';
import { RUN_DOWN_CELLS, tryRunDown } from './raiderWounds';
import { ringGate } from './ringWall';
import { fireAt, speedOf } from './defenses';
import { BUILDING_BY_ID } from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import { RAID_KIND_BY_ID, THROW_RANGE, RAID_FEROCITY } from '../data/raids';
import { TILE } from '../constants';
import { hashSeed, mixSeed, Rng } from '../rng';
import { footprint } from './buildings';
import { CELL, findPath, groundAt, inMap, SWIM_COST, wet, type Pt } from './land';
import { blockedBy } from './walk';
import { personFighter, weaponOf, weaponRange } from './combat';
import { held, kitOf, takeTurn, tickStatuses, type Arena, type Combatant, type Kit, type Statuses } from './actions';
import { ally } from './classes';
import { castsFire, castsMagic } from '../data/classes';
import { HOST_WAVES, HOST_WAVE_SIZE, SIEGE_REACH, SIEGE_SILENCE, SIEGE_WALL } from '../data/factions';
import { enemyArmor } from '../data/enemies';
import { attackPerson, biteOf, defenderAttack, defenderReach, townEdgeX } from './raids';
import { turretsDown } from './rivals';
import { rallied, RALLY_SPEED } from './rally';
import { isChild } from './social';
import { maxHp, notify, type Building, type GameState, type Person, type Raid, type Raider } from './state';
import { TICK_HZ, TICKS_PER_HOUR } from './time';

/* ------------------------------------------------------------ the shapes of things */

/** A spot a fighter can stand on: on the trail (blocking it), on the wall, or on the ground beside the trail; or one of
 *  the town's defence buildings (a fixed tower: `building`) or a trap on the trail. */
export interface BattleSpot {
  id: number;
  kind: 'block' | 'wall' | 'ground' | 'tower' | 'trap';
  x: number;
  y: number;
  /** A tower or trap: the building it is. */
  building?: number;
}

export interface BattleMap {
  /** How long the main trail is (cells). */
  len: number;
  /** The trails, as corner points (cells of the town's land, centres at .5): 0 the main one, from the land's edge on
   *  the side the raid comes to the town's gate; then the other lanes in from that side, and a way in from the other
   *  side for a party coming round. */
  paths: [number, number][][];
  /** Which side each trail comes in from: 0 the raid's own side, 1 the other (a flanking party). Left out (an older
   *  battle): the first trail is the raid's, the second the flank's. */
  sides?: number[];
  spots: BattleSpot[];
  /** Where the main trail ends: the town's edge, where whoever gets through comes in. */
  gate: [number, number];
  /** The town's look (its origin), for drawing; and what its walls are made of (its best wall). */
  style: string;
  wall?: string;
}

/** A fighter on a spot: a townsperson (`person`), or one of the town's allies (`ally`: a raider fighting for it). */
export interface BattleUnit {
  person?: number;
  ally?: number;
  spot: number;
  cooldown: number;
  /** The tick of its last blow (for the drawing). */
  lastAt?: number;
  /** A townsperson's spells and skills (actions.ts), and the statuses on them. */
  kit?: Kit;
  st?: Statuses;
}

/** A raider's part in the battle (on the Raider): how far along its trail, which trail, who's holding it. */
export interface RaiderBattle {
  /** Cells along the trail; below 0, not yet come in (waiting for its wave). */
  d: number;
  lane: number;
  wave: number;
  /** The fighter holding it (their spot), and whether it's running back. */
  held?: number;
  back?: boolean;
  /** Its last blow, at whom (a spot), for the drawing. */
  hit?: number;
  /** When it came onto the trail; and `out`: through to the town (raids.ts has it now). */
  enteredAt?: number;
  out?: boolean;
  /** Statuses on it (actions.ts: stunned, slowed, poisoned...). */
  st?: Statuses;
}

export interface Battle {
  map: BattleMap;
  phase: 'placing' | 'fighting' | 'breather' | 'done';
  /** When the placing time (or the breather) runs out. */
  until: number;
  started: number;
  /** When this placing (or breather) began: the set-up never lasts past `SETUP_MOST` from it. */
  opened?: number;
  /** The count is up and the town's placed everyone: waiting for the last to reach their spots. */
  settling?: boolean;
  wave: number;
  waves: number;
  units: BattleUnit[];
  /** The town placed everyone and fights alone (auto-watch, or nobody watching). */
  auto: boolean;
  /** Raiders through to the town, killed, and run off, so far. */
  through: number;
  killed: number;
  /** Where a spell is being aimed (for the moment of casting: powers.ts reads it). */
  aim?: [number, number];
  /** Spells cast at the map, for the drawing: where, what, when. */
  casts?: { at: [number, number]; power: string; tick: number }[];
  /** Arrows and bolts in flight, for the drawing (from a spot or a raider, to a raider or a person). */
  shots?: { from: [number, number]; to: [number, number]; tick: number; kind: 'arrow' | 'bolt' | 'tower' | 'fire' }[];
  /** The spells and skills used lately: by whom (a person id), what, and on which raiders (for the drawing). */
  acts?: { tick: number; ref: number; name: string; at: number[] }[];
}

/* ------------------------------------------------------------ tuning */

/** Real seconds to place the fighters before the raiders come (the town places whoever's left). */
export const PLACE_TICKS = 30 * TICK_HZ;
/** The breather between waves. */
export const BREATHER_TICKS = 12 * TICK_HZ;
/** A battle fighting itself goes on as soon as its fighters stand at their spots, but no sooner than this (a lone
 *  founder rushed onto the trail by a short count lost a leg and never grew the town). */
export const AUTO_READY_TICKS = 2 * TICK_HZ;
/** The set-up stage: the raiders stay in the fog until everyone placed stands at their spot, however long the count,
 *  but never longer than this from its start (someone stuck on the way doesn't hold the raid off for ever). */
export const SETUP_MOST = 90 * TICK_HZ;
/** A raider comes onto the trail this long after the one before it. */
const ENTER_GAP = Math.round(1.4 * TICK_HZ);
/** How fast raiders walk the trail: cells a second for each px a second they'd walk the town. */
const PACE = 1 / 42;
/** Reach (cells): a melee blow, a thrown or shot one, the extra from up on a wall, a tower's from its px. */
const MELEE_CELLS = 1.3;
const SHOT_CELLS = THROW_RANGE / TILE;
const WALL_REACH = 1.5;
/** Ticks between a fighter's blows (as in town), and a hero's extra damage. */
const INTERVAL = Math.round(1.0 * TICK_HZ);
/** On ground the town chose (each where they were placed), a fighter's blows count for this much more than in a scramble. */
const GROUND = 1.2;
const HERO_BONUS = 4;
/** A mage casts slower than a bow shoots, but its fire bursts over those within this many cells of where it lands. */
const MAGE_INTERVAL = Math.round(1.6 * TICK_HZ);
const MAGE_BURST = 1.3;
/** A cleaving blow carries into a raider within this many cells of the one struck. */
const CLEAVE_CELLS = 1;
/** How close (cells) a blocker must be on the trail to stop a raider. */
const BLOCK_NEAR = 0.7;
/** How near their spot (cells) a fighter must stand to fight from it. */
export const IN_PLACE = 1.2;

/** How many townsfolk placed are still on their way to their spots. */
function onTheWay(s: GameState, b: Battle): number {
  return b.units.filter((u) => {
    if (u.person === undefined) return false;
    const p = s.people.find((x) => x.id === u.person);
    const q = b.map.spots.find((x) => x.id === u.spot);
    return !!p && !!q && Math.hypot(p.x / CELL - q.x, p.y / CELL - q.y) > IN_PLACE;
  }).length;
}
/** Every townsperson placed stands at their spot (the raiders wait for it). */
const allInPlace = (s: GameState, b: Battle) => onTheWay(s, b) === 0;
/** A fighter this hurt (a share of their health) falls back off the line. */
const FALL_BACK = 0.12;
/** A raider this hurt (a share of its health) turns and runs. */
const ROUT = 0.15;
/** A spell's reach (cells) round where it's aimed. */
export const AIM_RADIUS = 2.6;
/** How many raiders a wave holds before the raid is split into more. */
const WAVE_SIZE = 6;

/* ------------------------------------------------------------ who fights, and on which trail */

/** The townsfolk who'll fight (as the defend task picks them: grown-ups at home, up, and willing). */
export function fighters(s: GameState): Person[] {
  return s.people.filter((p) => p.away === null && !p.downed && !isChild(p) && p.priorities.defend !== 0);
}

/** Whether someone fights from range (archers, slingers; mages later). */
export const ranged = (p: Person) => defenderReach(p) === THROW_RANGE;

/** The town's own allies in the raid (summoned, raised, tamed). */
const allies = (r: Raid) => r.raiders.filter((rd) => rd.ally && !rd.down && !rd.gone);

/** Battles are on (an old town, or a test, may turn them off: the raid is fought in the town as before). */
export const battlesOn = (s: GameState) => s.battles !== false;

/* ------------------------------------------------------------ the map */

/** How far (cells) from the trail a wall counts as overlooking it, a tower (past its own range) as covering it, and
 *  a trap as lying on it. */
const WALL_NEAR = 5;
const TOWER_NEAR = 2;
const TRAP_NEAR = 1.5;
/** Blocking spots along a trail: the first this far in, then one every so many cells, none in the last stretch. */
const BLOCK_FROM = 3;
/** The town holds the stretch of trail nearest its gate: blocking and ground spots go no further out than this many
 *  cells along it (the raiders walk the rest under the towers' fire; fighters sent to the fog's edge met the raiders
 *  coming out of it, and ran on past them). */
export const HOLD_REACH = 14;
const BLOCK_EVERY = 3;
const BLOCK_END = 1.5;
/** Ground spots for shooters: so many a way in, at least this far (cells) apart. */
const GROUND_PER_LANE = 3;
/** Shooters stand along the held stretch and a little beyond it (a share of `HOLD_REACH`). */
const SHOOT_REACH = 1.25;
const GROUND_APART = 2;
/** A trap laid on a way in: this far (cells) before the gate, and the next on the same lane so much further out. */
const TRAP_FROM_GATE = 3;
const TRAP_APART = 2.5;
/** What wading a river costs a raiding party finding its way in (in cells of plain ground). */
const FORD = 4;
/** The nomads' wagons, drawn up by the trail's end while they have no walls: wall spots. */
const WAGONS = 4;

const wallDef = (id: string) => !!BUILDING_BY_ID[id]?.hp && BUILDING_BY_ID[id]?.layer === 'fore';
const towerDef = (id: string) => !!BUILDING_BY_ID[id]?.defense;

/** How far into the fog beyond the open land the raiders come from (cells): out of the dark, where they can be seen;
 *  and the least a trail runs before the gate (further into the dark when the town sprawls to the fog). */
const TRAIL_FROM = 6;
const MIN_TRAIL = 20;

/** Where a raid from one side comes out of the fog: on the camp's row, `TRAIL_FROM` cells past the open land, at
 *  least `MIN_TRAIL` out from the gate (never past the land's edge), or the nearest cell up or down from there that
 *  isn't water. */
function landEdge(s: GameState, side: -1 | 1, gate: Pt): Pt {
  const m = s.land;
  const far = Math.max(Math.round(m.open + TRAIL_FROM), Math.abs(gate.x - m.camp.x) + MIN_TRAIL);
  const x = Math.max(0, Math.min(m.w - 1, m.camp.x + side * far));
  const y0 = m.camp.y;
  for (let k = 0; k < m.h; k++) for (const y of k ? [y0 - k, y0 + k] : [y0]) if (inMap(m, x, y) && groundAt(m, x, y) !== 'water' && groundAt(m, x, y) !== 'mountain') return { x, y };
  return { x, y: y0 };
}

/** Where a raid from the sea comes out of the fog: in the water south of the camp, past what the town knows. */
function seaEdge(s: GameState): Pt {
  const m = s.land;
  return { x: m.camp.x, y: Math.min(m.h - 1, m.camp.y + Math.round(m.open) + TRAIL_FROM) };
}
/** Where a raid from the sea makes land: the first dry cell north of the deep water below the camp (the strand). */
function strandCell(s: GameState): Pt {
  const m = s.land;
  const from = seaEdge(s);
  for (let y = from.y; y > m.camp.y; y--) if (!wet(groundAt(m, from.x, y))) return { x: from.x, y };
  return { x: m.camp.x, y: m.camp.y + 1 };
}

/** The town's gate on one side: the town's edge there (townEdgeX) on the camp's row, as a cell. */
function gateCell(s: GameState, side: -1 | 1): Pt {
  const m = s.land;
  const ring = ringGate(s, side); // (a walled town: its ring's gate on that side)
  if (ring) return ring;
  return { x: Math.max(0, Math.min(m.w - 1, Math.floor(townEdgeX(s, side) / CELL))), y: m.camp.y };
}

/** The trail a raid comes in by: the cheapest way over the land from its edge to the gate (roads quick, forest and
 *  marsh slow, a river forded where it must be, buildings gone round), as cell centres; straight at the gate if there
 *  is none. Cells in a straight run are folded into its two ends. */
export function trail(s: GameState, side: -1 | 1, sea = false): [number, number][] {
  const { from, to } = ends(s, side, sea);
  return fold([from, ...(leg(s, from, to, sea) ?? (from.x === to.x && from.y === to.y ? [] : [to]))]);
}

/** Where a trail from a side starts and ends. (A raid from the sea: out of the deep water south of the town, swimming
 *  ashore to its strand, or to the ring wall's gate on that side if it has one.) */
function ends(s: GameState, side: -1 | 1, sea: boolean): { from: Pt; to: Pt } {
  const to = sea ? (ringGate(s, side) ?? strandCell(s)) : gateCell(s, side);
  return { from: sea ? seaEdge(s) : landEdge(s, side, to), to };
}

/** The cheapest way from one cell to another for a raiding party (round the buildings if it can), or null. */
function leg(s: GameState, from: Pt, to: Pt, sea: boolean): Pt[] | null {
  const limits = sea ? { maxNodes: 24000, swim: SWIM_COST } : { maxNodes: 24000, ford: FORD };
  return findPath(s.land, from, to, blockedBy(s), limits) ?? findPath(s.land, from, to, undefined, limits);
}

/* ------------------------------------------------------------ lanes and bends (the owner's ask: more ways in, and
 * trails that feel random, after the RPG tower defences (Fantasica, Kingdom Rush, Arknights): several spawn points,
 * paths that wind back and forth and meet near the base, so the shooters and engines get more blows in) */

/** The most ways in from the raid's side; the town draws more as its fighters grow (2, then 3 at 6, 4 at 12). */
export const LANES_MOST = 4;
const LANE_PER_FIGHTERS = 6;
/** Bends in each trail, and how far (cells) each swings off the straight way: the bends nearest the gate swing less,
 *  so the raiders zigzag in under the towers and walls rather than out of their reach. */
const BENDS = 3;
const SWING = [3, 9] as const;
const SWING_NEAR = [2, 5] as const;
/** Each further way in comes out of the fog turned this far (radians) round the gate from the main one, alternately
 *  either side. */
const SPAWN_TURN = [0.45, 0.9] as const;
/** The far reaches of a trail (beyond this many cells from its end) are walked quicker: out in the dark there's
 *  nothing to see, and winding trails are long. */
const FAR_FROM_GATE = 2 * HOLD_REACH;
const FAR_PACE = 1.8;

/** How many ways in a raid from one side takes. */
export function lanesFor(s: GameState): number {
  return Math.min(LANES_MOST, 2 + Math.floor(fighters(s).length / LANE_PER_FIGHTERS));
}

/** Somewhere a party can stand: on the land, not mountain, not built over, and dry unless it swims. */
function walkable(s: GameState, x: number, y: number, sea: boolean, blocked: (x: number, y: number) => boolean): boolean {
  const m = s.land;
  if (!inMap(m, x, y)) return false;
  const g = groundAt(m, x, y);
  return g !== 'mountain' && (sea || g !== 'water') && !blocked(x, y);
}
/** The nearest such cell to a point, within a few cells; null if there's none. */
function nearWalkable(s: GameState, x: number, y: number, sea: boolean, blocked: (x: number, y: number) => boolean): Pt | null {
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let r = 0; r <= 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walkable(s, cx + dx, cy + dy, sea, blocked)) return { x: cx + dx, y: cy + dy };
      }
  return null;
}

/** A winding trail from `from` to `to`: through `BENDS` bends swung off the straight way, alternately either side, by
 *  random amounts (kept outside the town: never nearer the camp than the gate is), each stretch the cheapest way over
 *  the land. The straight trail when a bend can't be reached. */
export function windingTrail(s: GameState, from: Pt, to: Pt, rng: Rng, sea = false): [number, number][] {
  const m = s.land;
  const blocked = blockedBy(s);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const keepOut = Math.hypot(to.x - m.camp.x, to.y - m.camp.y) + 2;
  const stops: Pt[] = [from];
  let sign = rng.chance(0.5) ? 1 : -1;
  for (let k = 1; k <= BENDS; k++) {
    const t = Math.max(0.1, Math.min(0.9, k / (BENDS + 1) + rng.range(-0.07, 0.07)));
    const [lo, hi] = k === BENDS ? SWING_NEAR : SWING;
    const sw = rng.range(lo, hi) * sign;
    sign = -sign;
    let x = from.x + dx * t + nx * sw;
    let y = from.y + dy * t + ny * sw;
    // (outside the town: pushed out from the camp to past the gate's distance)
    const cd = Math.hypot(x - m.camp.x, y - m.camp.y);
    if (cd < keepOut) {
      const f = keepOut / Math.max(0.5, cd);
      x = m.camp.x + (x - m.camp.x) * f;
      y = m.camp.y + (y - m.camp.y) * f;
    }
    const at = nearWalkable(s, Math.max(1, Math.min(m.w - 2, x)), Math.max(1, Math.min(m.h - 2, y)), sea, blocked);
    if (at && !(at.x === stops[stops.length - 1].x && at.y === stops[stops.length - 1].y)) stops.push(at);
  }
  stops.push(to);
  const cells: Pt[] = [from];
  for (let i = 1; i < stops.length; i++) {
    const part = leg(s, stops[i - 1], stops[i], sea);
    if (!part) return fold([from, ...(leg(s, from, to, sea) ?? [to])]);
    cells.push(...part);
  }
  return fold(cells);
}

/** Every way in for a raid: `n` winding lanes from its side (the first out of the fog where the straight trail starts,
 *  the rest turned round the gate either side of it), and one more from the other side for a flanking party. */
export function lanesOf(s: GameState, side: -1 | 1, flank: boolean, sea: boolean, rng: Rng, n = lanesFor(s)): { paths: [number, number][][]; sides: number[] } {
  const m = s.land;
  const { from, to } = ends(s, side, sea);
  const paths: [number, number][][] = [];
  const sides: number[] = [];
  const blocked = blockedBy(s);
  for (let k = 0; k < n; k++) {
    let start: Pt | null = from;
    if (k > 0) {
      const turn = (k % 2 ? 1 : -1) * rng.range(SPAWN_TURN[0], SPAWN_TURN[1]) * Math.ceil(k / 2);
      if (sea) start = nearWalkable(s, Math.max(1, Math.min(m.w - 2, from.x + Math.sign(turn) * rng.range(5, 12) * Math.ceil(k / 2))), from.y, true, blocked);
      else {
        const vx = from.x - to.x;
        const vy = from.y - to.y;
        const c = Math.cos(turn);
        const sn = Math.sin(turn);
        start = nearWalkable(s, Math.max(1, Math.min(m.w - 2, to.x + vx * c - vy * sn)), Math.max(1, Math.min(m.h - 2, to.y + vx * sn + vy * c)), false, blocked);
      }
    }
    if (!start) continue;
    paths.push(windingTrail(s, start, to, rng, sea));
    sides.push(0);
  }
  if (flank) {
    const o = ends(s, -side as -1 | 1, false);
    paths.push(windingTrail(s, o.from, o.to, rng));
    sides.push(1);
  }
  return { paths, sides };
}

/** Cells in a straight run folded into its two ends, as cell centres. */
function fold(pts: Pt[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i > 0 && i < pts.length - 1) {
      const a = pts[i - 1];
      const b = pts[i + 1];
      if (b.x - p.x === p.x - a.x && b.y - p.y === p.y - a.y) continue;
    }
    out.push([p.x + 0.5, p.y + 0.5]);
  }
  return out;
}

/** How far a point is from a trail (cells): to the nearest point on any of its runs. */
function distToTrail(p: [number, number], path: [number, number][]): number {
  if (path.length === 1) return dist(p, path[0]);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const vx = bx - ax;
    const vy = by - ay;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - ay) * vy) / Math.max(1e-6, vx * vx + vy * vy)));
    best = Math.min(best, Math.hypot(p[0] - (ax + vx * t), p[1] - (ay + vy * t)));
  }
  return best;
}

/** Lay out the battle on the town's own land: the trail in from the side the raid comes (and a second for a party
 *  coming round the other way), blocking spots along it, ground spots beside it, the town's walls that overlook its
 *  end as wall spots, its defence buildings in reach as towers, its traps on it. Everything is in the land's cells. */
export function layOut(s: GameState, side: -1 | 1, flank: boolean, sea = false, salt = s.tick): BattleMap {
  const m = s.land;
  const done = s.buildings.filter((b) => b.status === 'done');
  const { paths, sides } = lanesOf(s, side, flank, sea, new Rng(mixSeed(hashSeed(s.seed), salt, 0xba771e)));
  const path = paths[0];
  const cum = cumulative(path);
  const gate = path[path.length - 1];
  const nearest = (p: [number, number]) => Math.min(...paths.map((q) => distToTrail(p, q)));

  // what's taken: the trails' cells, the water, the buildings, and the spots as they're made
  const taken = new Set<string>();
  const key = (cx: number, cy: number) => `${Math.floor(cx)},${Math.floor(cy)}`;
  for (const p of paths) rasterize(p, (cx, cy) => taken.add(key(cx, cy)));
  const blocked = blockedBy(s);
  const free = (cx: number, cy: number) => inMap(m, cx, cy) && groundAt(m, cx, cy) !== 'water' && !blocked(cx, cy) && !taken.has(key(cx, cy));
  const spots: BattleSpot[] = [];
  let id = 0;
  const spot = (kind: BattleSpot['kind'], cx: number, cy: number, building?: number) => {
    spots.push({ id: id++, kind, x: cx, y: cy, ...(building !== undefined ? { building } : {}) });
    if (kind !== 'block' && kind !== 'trap') taken.add(key(cx, cy));
  };

  // blocking spots along each trail (every few cells, not right at either end)
  for (const p of paths) {
    const c = cumulative(p);
    const end = c[c.length - 1];
    const every = end < 15 ? 2 : BLOCK_EVERY; // (a short trail, early on: spots closer together)
    for (let d = Math.max(BLOCK_FROM, end - HOLD_REACH); d < end - BLOCK_END; d += every) {
      const [bx, by] = pointAt(p, c, d);
      if (groundAt(m, Math.floor(bx), Math.floor(by)) === 'water') continue; // (nobody holds a ford)
      spot('block', bx, by);
    }
  }

  // the town's walls that overlook a trail: a wall spot on each (shooters stand up on them)
  const centre = (b: Building): [number, number] => {
    const r = footprint(b);
    return [r.x + r.w / 2, r.y + r.h / 2];
  };
  const walls = done.filter((b) => wallDef(b.def));
  for (const b of walls) {
    const c = centre(b);
    if (nearest(c) <= WALL_NEAR) spot('wall', c[0], c[1], b.id);
  }
  // (the nomads' wagons, drawn up beside the trail's end while they have no walls)
  if (!walls.length && s.origin === 'nomads') {
    const beside = besideTrail(path, cum, free, Math.max(0, cum[cum.length - 1] - 4), cum[cum.length - 1]);
    for (const [cx, cy] of beside.slice(0, WAGONS)) spot('wall', cx + 0.5, cy + 0.5);
  }

  // the town's towers in reach of a trail, and its traps lying on one
  let laid = 0;
  for (const b of done.filter((q) => towerDef(q.def))) {
    const def = BUILDING_BY_ID[b.def];
    const c = centre(b);
    if (def.layer === 'fore' && (def.defense?.range ?? 0) < TILE) {
      // a trap: on the trail where it crosses one; else the town lays it out on a way in, as the tower defences have
      // their traps on the path (on each lane in turn, along the stretch before the gate, where every raider passes)
      let best: [number, number] | null = null;
      for (const p of paths) {
        const cc = cumulative(p);
        for (let d = 0; d < cc[cc.length - 1]; d += 0.5) {
          const at = pointAt(p, cc, d);
          if (dist(at, c) <= TRAP_NEAR && (!best || dist(at, c) < dist(best, c))) best = at;
        }
      }
      if (!best) {
        const p = paths[laid % paths.length];
        const cc = cumulative(p);
        const end = cc[cc.length - 1];
        best = pointAt(p, cc, Math.max(0, end - TRAP_FROM_GATE - Math.floor(laid / paths.length) * TRAP_APART));
        laid++;
      }
      spot('trap', best[0], best[1], b.id);
      continue;
    }
    if (nearest(c) <= (def.defense?.range ?? 0) / CELL + TOWER_NEAR) spot('tower', c[0], c[1], b.id);
  }

  // spots on open ground for shooters where there's no wall: where they see the most trail (the bends and the
  // crossroads where lanes meet, as the tower defences put their archers), along the stretch the town holds and a
  // little beyond it, a few for each way in, never two side by side
  const holdPts: [number, number][] = [];
  const farPts: [number, number][] = [];
  for (const p of paths) {
    const c = cumulative(p);
    const end = c[c.length - 1];
    for (let d = 0; d <= end; d += 0.5) (d >= end - HOLD_REACH * SHOOT_REACH ? holdPts : farPts).push(pointAt(p, c, d));
  }
  const nearestOf = (pts: [number, number][], at: [number, number]) => pts.reduce((m, q) => Math.min(m, dist(q, at)), Infinity);
  const seen = new Set<string>();
  const cands: { x: number; y: number; n: number }[] = [];
  for (const [px, py] of holdPts)
    for (let oy = -3; oy <= 3; oy++)
      for (let ox = -3; ox <= 3; ox++) {
        const cx = Math.floor(px) + ox;
        const cy = Math.floor(py) + oy;
        const k = key(cx, cy);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!free(cx, cy)) continue;
        const at: [number, number] = [cx + 0.5, cy + 0.5];
        // (never out where a far stretch of some lane runs nearer than the held one: a shooter there would stand
        // out past the raiders, as fighters once did)
        if (nearest(at) < 1 || nearestOf(farPts, at) < nearestOf(holdPts, at)) continue;
        cands.push({ x: at[0], y: at[1], n: holdPts.filter((q) => dist(q, at) <= SHOT_CELLS).length });
      }
  cands.sort((a, b) => b.n - a.n || a.x - b.x || a.y - b.y);
  const want = Math.max(2, paths.length * GROUND_PER_LANE);
  const chosen: { x: number; y: number }[] = [];
  for (const q of cands) {
    if (chosen.length >= want) break;
    if (chosen.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < GROUND_APART)) continue;
    chosen.push(q);
    spot('ground', q.x, q.y);
  }

  const wallOrder = ['force_wall', 'concrete_wall', 'brick_wall', 'stone_wall', 'palisade_wall'];
  const wall = !walls.length && s.origin === 'nomads' ? 'wagon_circle' : wallOrder.find((w) => done.some((b) => b.def === w));
  return { len: cum[cum.length - 1], paths, sides, spots, gate, ...(wall ? { wall } : {}), style: s.origin ?? 'settlers' };
}

/** The cells a trail runs through (its corners are joined by straight runs along or across). */
function rasterize(path: [number, number][], at: (cx: number, cy: number) => void): void {
  if (path.length === 1) at(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2) + 1;
    for (let k = 0; k <= n; k++) at(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
  }
}

/** Free cells beside a trail (either side), in order along it, between two distances along it. */
function besideTrail(path: [number, number][], cum: number[], free: (x: number, y: number) => boolean, from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  for (let d = from; d < to; d += 1) {
    const [px, py] = pointAt(path, cum, d);
    for (const [dx, dy] of [[0, -1.2], [0, 1.2], [-1.2, 0], [1.2, 0]]) {
      const cx = Math.floor(px + dx);
      const cy = Math.floor(py + dy);
      const k = `${cx},${cy}`;
      if (seen.has(k) || !free(cx, cy)) continue;
      seen.add(k);
      out.push([cx, cy]);
    }
  }
  return out;
}

/** How far along a trail each corner is. */
const cums = new WeakMap<object, number[]>();
export function cumulative(path: [number, number][]): number[] {
  let c = cums.get(path);
  if (c) return c;
  c = [0];
  for (let i = 1; i < path.length; i++) c.push(c[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  cums.set(path, c);
  return c;
}

/** The point `d` cells along a trail. */
export function pointAt(path: [number, number][], cum: number[], d: number): [number, number] {
  if (d <= 0) return [...path[0]];
  for (let i = 1; i < path.length; i++) {
    if (d <= cum[i]) {
      const t = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
    }
  }
  return [...path[path.length - 1]];
}

/** Which side a trail comes in from (0 the raid's own, 1 the other). */
export const laneSide = (map: BattleMap, i: number): number => map.sides?.[i] ?? (i === 1 ? 1 : 0);

/** Where a raider is on the map. */
export function foeAt(map: BattleMap, rd: Raider): [number, number] {
  const bt = rd.bt!;
  const path = map.paths[bt.lane] ?? map.paths[0];
  return pointAt(path, cumulative(path), Math.max(0, bt.d));
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/* ------------------------------------------------------------ starting a battle */

/** The raiders have come: lay out the map, sort them into waves, and open the placing phase. */
export function startBattle(s: GameState, r: Raid): void {
  const foes = r.raiders.filter((rd) => !rd.ally && !rd.down && !rd.gone);
  const flank = foes.some((rd) => rd.side !== undefined && rd.side !== r.side);
  const map = layOut(s, r.side, flank, !!RAID_KIND_BY_ID[r.kind]?.fromSea);
  // waves: a big raid comes in several (a war, a rival's army and a boss's raid one more), the leaders last
  const big = (s.doom?.kind === 'war' && s.doom.phase === 'active') || !!RAID_KIND_BY_ID[r.kind]?.leader || foes.some((rd) => ENEMIES[rd.kind].kit);
  // (a war host comes in more and bigger waves: data/factions.ts)
  const waves = r.host ? Math.min(HOST_WAVES, Math.max(2, Math.ceil(foes.length / HOST_WAVE_SIZE))) : Math.min(4, Math.max(1, Math.ceil(foes.length / WAVE_SIZE)) + (big && foes.length > 3 ? 1 : 0));
  const order = [...foes].sort((a, b) => (ENEMIES[a.kind].kit || ENEMIES[a.kind].boss ? 1 : 0) - (ENEMIES[b.kind].kit || ENEMIES[b.kind].boss ? 1 : 0));
  // (each wave spread over the ways in from its side, in turn, so every lane sees raiders)
  const lanesFrom = (side: number) => map.paths.map((_, i) => i).filter((i) => laneSide(map, i) === side);
  const turn = [0, 0];
  order.forEach((rd, i) => {
    const wave = Math.min(waves - 1, Math.floor((i * waves) / order.length));
    const side = flank && rd.side !== undefined && rd.side !== r.side ? 1 : 0;
    const lanes = lanesFrom(side).length ? lanesFrom(side) : [0];
    rd.bt = { d: -1, lane: lanes[turn[side]++ % lanes.length], wave };
  });
  const auto = s.autoBattle !== false || !!r.alone; // (on unless the player turned it off: the owner's call)
  r.battle = { map, phase: 'placing', until: s.tick + PLACE_TICKS, started: s.tick, opened: s.tick, wave: 0, waves, units: [], auto, through: 0, killed: 0 };
  // (time to fight it out: the raid doesn't give up while the battle's on)
  r.leavesTick = Math.max(r.leavesTick, s.tick + 3 * TICKS_PER_HOUR);
  if (auto) autoPlace(s, r.battle, r);
  else notify(s, `${foes.length} raiders on the trail${waves > 1 ? `, in ${waves} waves` : ''}: place your fighters!`, true);
}

/* ------------------------------------------------------------ placing */

/** Who's on a spot now. */
export const unitOn = (b: Battle, spot: number) => b.units.find((u) => u.spot === spot);

/** Whether a spot suits someone: blockers on the trail, shooters on walls and ground (anyone may stand on a wall). */
function suits(spot: BattleSpot, shooter: boolean): boolean {
  if (spot.kind === 'tower' || spot.kind === 'trap') return false;
  if (spot.kind === 'block') return true;
  return shooter || spot.kind === 'wall';
}

/** Put a townsperson on a spot (or take them off it: `spot` null). Returns whether it was done. */
export function placeFighter(s: GameState, person: number, spot: number | null): boolean {
  const r = s.raid;
  const b = r?.battle;
  if (!b || (b.phase !== 'placing' && b.phase !== 'breather')) return false;
  const p = s.people.find((q) => q.id === person);
  if (!p || !fighters(s).includes(p)) return false;
  b.units = b.units.filter((u) => u.person !== person);
  if (spot === null) return true;
  const sp = b.map.spots.find((q) => q.id === spot);
  if (!sp || !suits(sp, ranged(p))) return false;
  b.units = b.units.filter((u) => u.spot !== spot); // (whoever was there steps off)
  b.units.push({ person, spot, cooldown: 0 });
  return true;
}

/** The town places its fighters itself (whoever the player hasn't): the best blockers on the trail where the most
 *  shooters can cover them, the shooters on the walls, then on the ground. Allies take blocking spots too. */
export function autoPlace(s: GameState, b: Battle, r: Raid): void {
  const placed = new Set(b.units.map((u) => u.person ?? -1));
  const taken = new Set(b.units.map((u) => u.spot));
  const shooterSpots = b.map.spots.filter((q) => q.kind === 'wall' || q.kind === 'ground');
  const cover = (q: BattleSpot) => shooterSpots.filter((w) => Math.hypot(w.x - q.x, w.y - q.y) <= SHOT_CELLS + (w.kind === 'wall' ? WALL_REACH : 0)).length;
  // (blocking spots in the order they're best held: covered by most shooters, then nearer the gate)
  const toGate = (q: BattleSpot) => Math.hypot(q.x - b.map.gate[0], q.y - b.map.gate[1]);
  const blocks = b.map.spots.filter((q) => q.kind === 'block' && !taken.has(q.id)).sort((a, c) => cover(c) - cover(a) || toGate(a) - toGate(c));
  // (wall and ground spots in order of how much trail they see, every way in counted)
  const sees = (q: BattleSpot) => {
    let n = 0;
    for (const path of b.map.paths) {
      const cum = cumulative(path);
      for (let d = 0; d < cum[cum.length - 1]; d += 1) if (dist([q.x, q.y], pointAt(path, cum, d)) <= SHOT_CELLS + (q.kind === 'wall' ? WALL_REACH : 0)) n++;
    }
    return n + (q.kind === 'wall' ? 100 : 0);
  };
  const shoots = shooterSpots.filter((q) => !taken.has(q.id)).sort((a, c) => sees(c) - sees(a));
  // (the hired guards first: it's what they're paid for)
  const strength = (p: Person) => p.skills.melee.level + p.skills.ranged.level + p.hp / 20 + (p.id === s.mainId ? 5 : 0) + (p.guard ? 50 : 0);
  // (the town doesn't send the badly hurt back out)
  const left = fighters(s).filter((p) => !placed.has(p.id) && p.hp >= maxHp(p) * FALL_BACK * 1.6).sort((a, c) => strength(c) - strength(a));
  for (const p of left) {
    const list = ranged(p) && shoots.length ? shoots : blocks.length ? blocks : shoots;
    const q = list.shift();
    if (!q) break;
    b.units.push({ person: p.id, spot: q.id, cooldown: 0 });
  }
  for (const a of allies(r)) {
    if (b.units.some((u) => u.ally === a.id)) continue;
    const q = blocks.shift();
    if (!q) break;
    b.units.push({ ally: a.id, spot: q.id, cooldown: 0 });
  }
}

/** The player is ready: the raiders come on now (whoever isn't placed is placed by the town). */
export function battleGo(s: GameState): void {
  const b = s.raid?.battle;
  if (b && (b.phase === 'placing' || b.phase === 'breather')) b.until = s.tick;
}

/** The speeds a battle can be played at (the top bar's button cycles through them). */
export const BATTLE_SPEEDS = [1, 2, 3] as const;

/** The player sets how fast battles play (kept for later battles). */
export function setBattleSpeed(s: GameState, speed: number): void {
  s.battleSpeed = (BATTLE_SPEEDS as readonly number[]).includes(speed) ? speed : 1;
}

/** The player sets how fast the town runs between battles (the clock bar's 1×/2×/3× button). */
export function setGameSpeed(s: GameState, speed: number): void {
  s.gameSpeed = (BATTLE_SPEEDS as readonly number[]).includes(speed) ? speed : 1;
}

/** How many times real time the game runs now: the battle speed while a battle is on, else the town's speed
 *  (GameLoop reads it). */
export function battleSpeedNow(s: GameState): number {
  const b = s.raid?.battle;
  return b && b.phase !== 'done' ? (s.battleSpeed ?? 1) : (s.gameSpeed ?? 1);
}

/** The player sets auto-watch (kept for later battles): on, the town places and fights by itself. */
export function setAutoBattle(s: GameState, on: boolean): void {
  s.autoBattle = on;
  const r = s.raid;
  if (r?.battle && on) {
    r.battle.auto = true;
    if (r.battle.phase === 'placing' || r.battle.phase === 'breather') {
      autoPlace(s, r.battle, r);
      r.battle.until = Math.min(r.battle.until, s.tick + TICK_HZ);
    }
  } else if (r?.battle && !on && !r.alone) r.battle.auto = false;
}

/* ------------------------------------------------------------ the fight */

/** One tick of the battle. Returns true while it's still on (raids.ts leaves the raiders in it alone). */
export function stepBattle(s: GameState, r: Raid, rng: Rng): boolean {
  const b = r.battle;
  if (!b || b.phase === 'done') return false;
  const map = b.map;
  // (raiders who joined since it began, summoned by a boss or a lord, come in with the wave on now)
  for (const rd of r.raiders) if (!rd.ally && !rd.down && !rd.gone && !rd.bt && (rd.x < 0 || rd.x > s.land.w * CELL)) rd.bt = { d: 0, lane: 0, wave: b.wave, enteredAt: s.tick };
  // (the fallen and the gone step off their spots, and the badly hurt fall back off the line, unless they're the last)
  const fallingBack: BattleUnit[] = [];
  b.units = b.units.filter((u) => {
    if (u.person !== undefined) {
      const p = s.people.find((q) => q.id === u.person);
      if (!p || p.downed || p.away !== null) return false;
      if (p.hp < maxHp(p) * FALL_BACK && b.units.length > 1) {
        notify(s, `${p.name} falls back, badly hurt.`);
        fallingBack.push(u);
        return false;
      }
      return true;
    }
    const a = r.raiders.find((q) => q.id === u.ally);
    return !!a && !a.down && !a.gone;
  });
  if (b.phase === 'placing' || b.phase === 'breather') {
    // the set-up: the count runs (a battle fighting itself needn't wait it out once everyone stands ready), then the
    // town places whoever's left, and the raiders come on only once everyone placed has reached their spot
    const opened = b.opened ?? b.started;
    const counted = s.tick >= b.until || (b.auto && s.tick >= opened + AUTO_READY_TICKS && allInPlace(s, b));
    if (!counted) return true;
    if (!b.settling) {
      autoPlace(s, b, r);
      b.settling = true;
    }
    if (!allInPlace(s, b) && s.tick < opened + SETUP_MOST) return true;
    b.settling = false;
    b.phase = 'fighting';
    if (b.wave === 0) notify(s, `The raiders are on the trail!`);
  }
  const wave = r.raiders.filter((rd) => rd.bt && !rd.bt.out && rd.bt.wave === b.wave && !rd.ally);
  // raiders come onto the trail one after another
  const waiting = wave.filter((rd) => rd.bt!.d < 0 && !rd.down && !rd.gone);
  const lastIn = Math.max(-Infinity, ...wave.filter((rd) => rd.bt!.d >= 0).map((rd) => rd.bt!.enteredAt ?? -Infinity));
  if (waiting.length && s.tick - lastIn >= ENTER_GAP) {
    const rd = waiting[0];
    rd.bt!.d = 0;
    rd.bt!.enteredAt = s.tick;
  }
  const kind = RAID_KIND_BY_ID[r.kind];
  const pace = (kind?.speed ?? 40) * PACE / TICK_HZ;
  // (the raiders within so many px of one, along the trail, for a splash or a chained bolt)
  const nearOnTrail = (rd: Raider, px: number) => wave.filter((q) => q !== rd && !q.down && !q.gone && q.bt && !q.bt.out && q.bt.d >= 0 && dist(foeAt(map, q), foeAt(map, rd)) * CELL <= px);
  const people = new Map(s.people.map((p) => [p.id, p]));
  const spotOf = new Map(map.spots.map((q) => [q.id, q]));
  const unitPos = (u: BattleUnit): [number, number] => {
    const q = spotOf.get(u.spot)!;
    return [q.x, q.y];
  };
  // a fighter falling back turns their back on the raiders they were holding: each gets a parting blow at it as they
  // go (so leaving the line is a danger, not a refuge), and then walks on
  for (const u of fallingBack)
    for (const rd of r.raiders) {
      if (rd.ally || rd.down || rd.gone || !rd.bt || rd.bt.out || rd.bt.held !== u.spot) continue;
      rd.bt.held = undefined;
      const p = people.get(u.person!);
      if (!p || p.downed) continue;
      strikeUnit(s, r, rd, u, rng, b, unitPos);
    }
  const holding = (u: BattleUnit) => wave.filter((rd) => rd.bt!.held === u.spot && !rd.down && !rd.gone).length;
  const capacity = (u: BattleUnit) => {
    if (u.ally !== undefined) return 2;
    const p = people.get(u.person!)!;
    // (a spear or polearm keeps one more at its point)
    return Math.min(3, 1 + Math.floor(p.skills.melee.level / 4)) + (p.id === s.mainId ? 1 : 0) + (weaponOf(p).reach ? 1 : 0);
  };
  // (a townsperson fights from their spot once they've walked to it; an ally is simply there)
  const inPlace = (u: BattleUnit) => {
    if (u.person === undefined) return true;
    const p = people.get(u.person);
    const q = spotOf.get(u.spot);
    return !!p && !!q && Math.hypot(p.x / CELL - q.x, p.y / CELL - q.y) <= IN_PLACE;
  };

  // lingering statuses (poison, regeneration...)
  mapStatuses(s, b, wave, people, rng);

  // the raiders
  for (const rd of wave) {
    const bt = rd.bt!;
    if (rd.down || rd.gone || bt.d < 0) continue;
    // stunned, asleep, frozen, stopped, charmed: it stands where it is
    if (bt.st && held({ st: bt.st } as Combatant, s.tick)) continue;
    const def = ENEMIES[rd.kind];
    const path = map.paths[bt.lane] ?? map.paths[0];
    const cum = cumulative(path);
    const end = cum[cum.length - 1];
    rd.cooldown--;
    // breaking: back down the trail and away
    const coward = !def.kit && (rd.hp < rd.maxHp * ROUT || !!rd.routed);
    if (!bt.back && (coward || s.tick >= r.leavesTick)) {
      bt.back = true;
      bt.held = undefined;
      // (turning to run, it takes a parting blow from every fighter in reach, as a fighter falling back does: a rout
      // is a danger, so a raid that breaks still leaves some of its raiders on the trail)
      if (coward) partingBlows(s, b, rd, pointAt(path, cum, bt.d), people, rng);
      if (rd.down) {
        fell(b, rd);
        continue;
      }
    }
    if (bt.back) {
      // (a lame runner may be run down by a fighter close by: sim/raiderWounds.ts)
      if (rd.lame) {
        const at = pointAt(path, cum, bt.d);
        const near = b.units.find((u) => u.person !== undefined && inPlace(u) && dist(unitPos(u), at) <= RUN_DOWN_CELLS);
        if (tryRunDown(s, rd, near ? people.get(near.person!) : undefined)) {
          fell(b, rd);
          continue;
        }
      }
      bt.d -= pace * 3 * (1 - (rd.lame ?? 0)); // (a rout is quick: the wave doesn't wait on it; a lame one limps)
      if (bt.d <= 0) {
        rd.gone = true;
        bt.d = 0;
      }
      continue;
    }
    // held: the holder may have fallen
    const holder = bt.held !== undefined ? b.units.find((u) => u.spot === bt.held && inPlace(u)) : undefined;
    if (bt.held !== undefined && !holder) bt.held = undefined;
    const here = pointAt(path, cum, bt.d);
    // a siege engine batters the walls, the gate and the towers in its reach rather than the people
    if (rd.cooldown <= 0 && rd.kind === 'siege_engine' && siegeBlow(s, b, rd, here, path[path.length - 1], rng)) continue;
    // blows: on the one holding it, else (a shooter) on whoever's in reach
    if (rd.cooldown <= 0) {
      let target: BattleUnit | undefined = holder;
      if (!target && def.ranged) target = b.units.filter((u) => dist(unitPos(u), here) <= SHOT_CELLS).sort((a, c) => dist(unitPos(a), here) - dist(unitPos(c), here))[0];
      if (target) {
        rd.cooldown = Math.round(def.interval * TICK_HZ);
        rd.lastAction = s.tick;
        bt.hit = target.spot;
        if (def.ranged && !holder) shot(b, s, here, unitPos(target), 'arrow');
        strikeUnit(s, r, rd, target, rng, b, unitPos);
      }
    }
    if (bt.held !== undefined) continue;
    // on along the trail, unless a blocker with room stops it
    // (out in the far reaches of a long winding trail they come on quicker)
    const far = end - bt.d > FAR_FROM_GATE ? FAR_PACE : 1;
    const next = Math.min(end, bt.d + far * pace * speedOf(rd, s.tick) * ((bt.st?.slow?.until ?? 0) > s.tick ? 0.5 : 1) * ((bt.st?.haste?.until ?? 0) > s.tick ? 1.5 : 1));
    const at = pointAt(path, cum, next);
    const blocker = b.units.find((u) => {
      const q = spotOf.get(u.spot)!;
      return q.kind === 'block' && dist([q.x, q.y], at) <= BLOCK_NEAR && holding(u) < capacity(u) && inPlace(u);
    });
    if (blocker) {
      bt.held = blocker.spot;
      continue;
    }
    bt.d = next;
    // traps on the trail bite as it passes
    for (const q of map.spots) {
      if (q.kind !== 'trap' || dist([q.x, q.y], at) > 0.5) continue;
      const tb = s.buildings.find((x) => x.id === q.building);
      const d = tb && BUILDING_BY_ID[tb.def]?.defense;
      if (!d || (tb!.readyTick ?? 0) > s.tick || turretsDown(s)) continue;
      tb!.readyTick = s.tick + Math.round(d.interval * TICK_HZ);
      const was = before(wave);
      fireAt(s, rng, { ...d, accuracy: 2 }, rd, nearOnTrail, (x, dmg) => hurt(x, dmg, s, b)); // (a trap never misses what steps in it)
      credit(s, TOWERS, was);
    }
    if (bt.d >= end) through(s, r, b, rd);
    if (bt.out) continue;
  }

  // (where each is on the land now: the trail is drawn over the town's own map, and the raiders walk it there)
  for (const rd of wave) {
    if (rd.down || rd.gone || !rd.bt || rd.bt.out || rd.bt.d < 0) continue;
    const [cx, cy] = foeAt(map, rd);
    const nx = cx * CELL;
    if (Math.abs(nx - rd.x) > 0.5) rd.dir = nx > rd.x ? 1 : -1;
    rd.x = nx;
    rd.y = cy * CELL;
  }
  for (const u of b.units) {
    if (u.ally === undefined) continue;
    const a = r.raiders.find((q) => q.id === u.ally);
    const q = spotOf.get(u.spot);
    if (a && q) {
      a.x = q.x * CELL;
      a.y = q.y * CELL;
    }
  }

  // the fighters
  for (const u of b.units) {
    if (--u.cooldown > 0) continue;
    if (!inPlace(u)) continue; // (still on the way to their spot: people.ts walks them there)
    const pos = unitPos(u);
    const sp = spotOf.get(u.spot)!;
    const p = u.person !== undefined ? people.get(u.person) : undefined;
    const shooter = p ? ranged(p) : false;
    // (each strikes only what's in its weapon's range: a dagger at arm's length, a spear a step further, a longbow far
    // down the trail; up on a wall a shooter sees a little further)
    const reach = p ? weaponRange(p, shooter) + (shooter && sp.kind === 'wall' ? WALL_REACH : 0) : MELEE_CELLS;
    // (a blocker hits what it's holding first; a shooter the one furthest along, the nearest to getting through)
    const inReach = wave.filter((rd) => !rd.down && !rd.gone && !rd.bt!.out && rd.bt!.d >= 0 && dist(foeAt(map, rd), pos) <= reach);
    const mage = castsFire(p?.cls);
    const magic = castsMagic(p?.cls);
    // (a quick weapon strikes more often, a heavy one less; hastened or slowed by a spell)
    const quick = (u.st?.haste?.until ?? 0) > s.tick ? 0.65 : 1;
    const every = p ? Math.round((mage ? MAGE_INTERVAL : INTERVAL) * weaponOf(p).speed * quick) : 0;
    // a spell or a skill, when one is ready and worth it: on the raiders in reach (a spell reaches further) and the
    // town's own fighters
    if (p && (u.kit ??= kitOf(p))) {
      const spellReach = Math.max(reach, SHOT_CELLS);
      const near = wave.filter((rd) => !rd.down && !rd.gone && !rd.bt!.out && rd.bt!.d >= 0 && dist(foeAt(map, rd), pos) <= spellReach);
      const arena = mapArena(s, b, r, u, p, near, people, rng);
      const was = near.map((rd) => [rd, rd.down] as const);
      const tallied = before(wave);
      if ((near.length || u.kit.actions.some((x) => x.use === 'heal' || x.use === 'support')) && takeTurn(arena, arena.me)) {
        credit(s, p.id, tallied);
        u.cooldown = rallied(s, p) ? Math.round(every / RALLY_SPEED) : every;
        u.lastAt = s.tick;
        p.lastBlow = s.tick; // (a spell or a skill plays the striking pose, as a blow does)
        for (const [o, d] of was) if (o.down && !d) fell(b, o);
        continue;
      }
    }
    if (!inReach.length) continue;
    const target = inReach.sort((a, c) => (c.bt!.held === u.spot ? 1 : 0) - (a.bt!.held === u.spot ? 1 : 0) || c.bt!.d - a.bt!.d)[0];
    u.lastAt = s.tick;
    if (p) {
      u.cooldown = rallied(s, p) ? Math.round(every / RALLY_SPEED) : every;
      // (a mage's fire bursts over those round the one it's aimed at; a cleaving blow carries into one beside it)
      const at = foeAt(map, target);
      const near = wave.filter((o) => o !== target && !o.down && !o.gone && !o.bt!.out && o.bt!.d >= 0 && dist(foeAt(map, o), at) <= (mage ? MAGE_BURST : CLEAVE_CELLS));
      const hit = [target, ...(near ?? [])].map((o) => [o, o.down] as const);
      defenderAttack(s, p, target, rng, p.id === s.mainId ? HERO_BONUS : 0, GROUND, near);
      if (shooter) shot(b, s, pos, at, mage ? 'fire' : magic ? 'bolt' : 'arrow');
      for (const [o, was] of hit) if (o.down && !was) fell(b, o);
    } else {
      const a = r.raiders.find((q) => q.id === u.ally)!;
      const ad = ENEMIES[a.kind];
      u.cooldown = Math.round(ad.interval * TICK_HZ);
      a.lastAction = s.tick;
      if (rng.next() < ad.accuracy - ENEMIES[target.kind].dodge) hurt(target, rng.int(ad.damage[0], ad.damage[1]), s, b);
    }
  }

  // the town's towers
  if (!turretsDown(s))
    for (const q of map.spots) {
      if (q.kind !== 'tower') continue;
      const tb = s.buildings.find((x) => x.id === q.building);
      const d = tb && tb.status === 'done' ? BUILDING_BY_ID[tb.def]?.defense : undefined;
      if (!d || (tb!.readyTick ?? 0) > s.tick) continue;
      const reach = d.range / TILE + 1;
      const target = wave.filter((rd) => !rd.down && !rd.gone && !rd.bt!.out && rd.bt!.d >= 0 && dist(foeAt(map, rd), [q.x, q.y]) <= reach).sort((a, c) => c.bt!.d - a.bt!.d)[0];
      if (!target) continue;
      tb!.readyTick = s.tick + Math.round(d.interval * TICK_HZ);
      shot(b, s, [q.x, q.y], foeAt(map, target), tb!.def === 'laser_turret' || tb!.def === 'tesla_coil' ? 'bolt' : 'tower');
      const was = before(wave);
      const volley = fireAt(s, rng, d, target, nearOnTrail, (x, dmg) => hurt(x, dmg, s, b));
      credit(s, TOWERS, was);
      for (const { rd } of volley.struck) rd.hitFx = tb!.def === 'laser_turret' || tb!.def === 'tesla_coil' ? 'shock' : null;
    }

  // (spent shots and old casts are cleared away)
  if (b.shots) b.shots = b.shots.filter((x) => s.tick - x.tick < TICK_HZ);
  if (b.casts) b.casts = b.casts.filter((x) => s.tick - x.tick < 3 * TICK_HZ);

  // the wave is over when every raider in it has fallen, run, or got through
  // (those turned back count as beaten: they're seen off the map as the next wave comes, or the battle ends)
  if (wave.every((rd) => rd.down || rd.gone || rd.bt!.out || rd.bt!.back)) {
    for (const rd of wave) if (rd.bt!.back && !rd.down) rd.gone = true;
    if (b.wave + 1 < b.waves) {
      b.wave++;
      b.phase = 'breather';
      b.until = s.tick + BREATHER_TICKS;
      b.opened = s.tick;
      notify(s, `Wave ${b.wave} beaten. ${b.waves - b.wave} more coming: a moment to regroup.`, true);
    } else {
      b.phase = 'done';
      notify(s, `The battle is over: ${b.killed} raiders down${b.through ? `, ${b.through} got through to the town` : ''}.`, true);
      r.leavesTick = Math.max(r.leavesTick, s.tick + TICKS_PER_HOUR);
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------ spells and skills on the map */

/** A raid map as the spells and skills see it (actions.ts): this fighter and the town's others, the raiders in their
 *  reach. Each is a stand-in whose health and statuses are the real person's, unit's or raider's. */
function mapArena(s: GameState, b: Battle, r: Raid, u: BattleUnit, p: Person, near: Raider[], people: Map<number, Person>, rng: Rng): Arena & { me: Combatant } {
  const asPerson = (unit: BattleUnit, q: Person): Combatant => {
    const f = personFighter(q, 'fighter', 'front');
    return {
      side: 'party',
      ref: q.id,
      kind: 'person',
      name: q.name,
      get hp() { return q.hp; },
      set hp(v) { q.hp = Math.max(0, Math.round(v)); },
      maxHp: f.maxHp,
      get down() { return !!q.downed || q.hp <= 0; },
      set down(_v) { /* (a townsperson falls through attackPerson, not here) */ },
      damage: f.damage,
      accuracy: f.accuracy,
      dodge: f.dodge,
      armor: f.armor,
      interval: f.interval,
      cooldown: unit.cooldown,
      ranged: f.ranged,
      st: (unit.st ??= {}),
      kit: unit.kit,
    };
  };
  const asRaider = (rd: Raider): Combatant => {
    const d = ENEMIES[rd.kind];
    return {
      side: 'enemy',
      ref: rd.id,
      kind: rd.kind,
      name: d.name,
      get hp() { return rd.hp; },
      set hp(v) { rd.hp = Math.max(0, Math.round(v)); },
      maxHp: rd.maxHp,
      get down() { return rd.down; },
      set down(v) { rd.down = v; },
      damage: d.damage,
      accuracy: d.accuracy,
      dodge: d.dodge,
      armor: enemyArmor(rd.kind),
      interval: Math.round(d.interval * TICK_HZ),
      get cooldown() { return rd.cooldown; },
      set cooldown(v) { rd.cooldown = v; },
      ranged: d.ranged,
      st: rd.bt ? (rd.bt.st ??= {}) : {},
    };
  };
  const me = asPerson(u, p);
  const friends = b.units.filter((o) => o !== u && o.person !== undefined && people.get(o.person)).map((o) => asPerson(o, people.get(o.person!)!));
  const foes = near.map(asRaider);
  return {
    me,
    tick: s.tick,
    rng,
    all: () => [me, ...friends, ...foes],
    summon: (_user, kind) => {
      if (!ENEMIES[kind]) return null;
      // (called up beside the caster: it fights from their spot for the rest of the battle)
      const q = b.map.spots.find((x) => x.id === u.spot)!;
      const a = ally(s, kind, q.x * CELL, -r.side as 1 | -1, q.y * CELL);
      a.conjuredAt = s.tick;
      r.raiders.push(a);
      b.units.push({ ally: a.id, spot: u.spot, cooldown: 5 });
      return asRaider(a);
    },
    log: (user: Combatant, name: string, targets: Combatant[]) => {
      (b.acts ??= []).push({ tick: s.tick, ref: user.ref, name, at: targets.filter((t) => t.side === 'enemy').map((t) => t.ref) });
      if (b.acts.length > 12) b.acts.shift();
    },
  };
}

/** Each tick on the map: the raiders' lingering statuses (poison, burning) and the fighters' (regeneration). */
function mapStatuses(s: GameState, b: Battle, wave: Raider[], people: Map<number, Person>, rng: Rng): void {
  const arena: Arena = { tick: s.tick, rng, all: () => [], summon: () => null, log: () => {} };
  for (const rd of wave) {
    if (rd.down || rd.gone || !rd.bt?.st) continue;
    const was = rd.down;
    const proxy = { get hp() { return rd.hp; }, set hp(v: number) { rd.hp = Math.max(0, Math.round(v)); }, get down() { return rd.down; }, set down(v: boolean) { rd.down = v; }, maxHp: rd.maxHp, kind: rd.kind, st: rd.bt.st } as unknown as Combatant;
    tickStatuses(arena, proxy);
    if (rd.down && !was) fell(b, rd);
  }
  for (const u of b.units) {
    const p = u.person !== undefined ? people.get(u.person) : undefined;
    if (!p || !u.st) continue;
    const proxy = { get hp() { return p.hp; }, set hp(v: number) { p.hp = Math.max(1, Math.round(v)); }, down: false, maxHp: maxHp(p), kind: 'person', st: u.st, kit: u.kit } as unknown as Combatant;
    tickStatuses(arena, proxy);
  }
}

/** A raider turning to run takes one blow from each placed fighter who has it in their weapon's reach. */
function partingBlows(s: GameState, b: Battle, rd: Raider, at: [number, number], people: Map<number, Person>, rng: Rng): void {
  for (const u of b.units) {
    const p = u.person !== undefined ? people.get(u.person) : undefined;
    if (!p || p.downed || rd.down) continue;
    const sp = b.map.spots.find((q) => q.id === u.spot);
    if (!sp) continue;
    const shooter = ranged(p);
    const reach = weaponRange(p, shooter) + (shooter && sp.kind === 'wall' ? WALL_REACH : 0);
    if (dist([sp.x, sp.y], at) > reach) continue;
    defenderAttack(s, p, rd, rng, 0, GROUND);
    if (shooter) shot(b, s, [sp.x, sp.y], at, castsFire(p.cls) ? 'fire' : castsMagic(p.cls) ? 'bolt' : 'arrow');
  }
}

/** A raider is hurt (by a tower, a trap, an ally, a spell): down at 0. */
function hurt(rd: Raider, dmg: number, s: GameState, b?: Battle): void {
  if (rd.down || rd.gone) return;
  rd.hp = Math.max(0, rd.hp - Math.round(dmg));
  rd.lastHit = s.tick;
  if (rd.hp === 0) {
    rd.down = true;
    if (b) fell(b, rd);
  }
}

function fell(b: Battle, rd: Raider): void {
  b.killed++;
  if (rd.bt) rd.bt.held = undefined;
}

function shot(b: Battle, s: GameState, from: [number, number], to: [number, number], kind: 'arrow' | 'bolt' | 'tower' | 'fire'): void {
  (b.shots ??= []).push({ from, to, tick: s.tick, kind });
  if (b.shots.length > 40) b.shots.splice(0, b.shots.length - 40);
}

/** A raider strikes a fighter: a townsperson (as in town: a killing blow may fall), or an ally. */
function strikeUnit(s: GameState, r: Raid, rd: Raider, u: BattleUnit, rng: Rng, b: Battle, posOf: (u: BattleUnit) => [number, number]): void {
  if (u.person !== undefined) {
    const p = s.people.find((q) => q.id === u.person);
    if (!p) return;
    // (a boss's sweep reaches those near the one it strikes)
    const pos = posOf(u);
    const area = b.units
      .filter((o) => o.person !== undefined && dist(posOf(o), pos) <= 1.6)
      .map((o) => s.people.find((q) => q.id === o.person)!)
      .filter(Boolean);
    attackPerson(s, rd, p, rng, area);
    return;
  }
  const a = r.raiders.find((q) => q.id === u.ally);
  if (!a) return;
  const def = ENEMIES[rd.kind];
  if (rng.next() < def.accuracy - ENEMIES[a.kind].dodge) hurt(a, rng.int(def.damage[0], def.damage[1]) * (rd.might ?? 1) * biteOf(s, RAID_FEROCITY), s);
}

/** A raider has got to the end of the trail: it's through, into the town (raids.ts takes it on from the town's edge). */
/** A siege engine's blow (data/factions.ts): the nearest wall, gate or tower within `SIEGE_REACH` cells of it (the
 *  gate at the trail's end counts), struck `SIEGE_WALL` times as hard as a raider strikes a wall; a tower it hits is
 *  silenced a while (`SIEGE_SILENCE`), and a wall or gate brought to nothing falls. False when nothing is in reach. */
export function siegeBlow(s: GameState, b: Battle, rd: Raider, here: [number, number], end: [number, number], rng: Rng): boolean {
  const ids = new Set<number>();
  for (const q of b.map.spots) if ((q.kind === 'wall' || q.kind === 'tower') && q.building !== undefined && dist([q.x, q.y], here) <= SIEGE_REACH) ids.add(q.building);
  if (dist(end, here) <= SIEGE_REACH)
    for (const x of s.buildings) {
      const f = footprint(x);
      if (x.status === 'done' && BUILDING_BY_ID[x.def]?.hp && end[0] >= f.x - 0.5 && end[0] <= f.x + f.w + 0.5 && end[1] >= f.y - 0.5 && end[1] <= f.y + f.h + 0.5) ids.add(x.id);
    }
  const targets = s.buildings.filter((x) => ids.has(x.id) && x.status === 'done');
  if (!targets.length) return false;
  const t = targets.sort((a, c) => dist(foot(a), here) - dist(foot(c), here))[0];
  const def = ENEMIES[rd.kind];
  rd.cooldown = Math.round(def.interval * TICK_HZ);
  rd.lastAction = s.tick;
  shot(b, s, here, foot(t), 'tower');
  const blow = rng.int(def.damage[0], def.damage[1]) * SIEGE_WALL;
  if (BUILDING_BY_ID[t.def]?.defense) t.readyTick = Math.max(t.readyTick ?? 0, s.tick + SIEGE_SILENCE * TICK_HZ);
  if (BUILDING_BY_ID[t.def]?.hp) {
    t.hp = Math.max(0, (t.hp ?? BUILDING_BY_ID[t.def].hp!) - blow);
    if (t.hp === 0) {
      s.buildings = s.buildings.filter((x) => x !== t);
      notify(s, `A siege engine brought down the ${BUILDING_BY_ID[t.def].name.toLowerCase()}!`, true);
    }
  }
  return true;
}
const foot = (x: Building): [number, number] => {
  const f = footprint(x);
  return [f.x + f.w / 2, f.y + f.h / 2];
};

function through(s: GameState, r: Raid, b: Battle, rd: Raider): void {
  b.through++;
  const side = rd.side ?? r.side;
  const path = b.map.paths[rd.bt!.lane] ?? b.map.paths[0];
  const [gx, gy] = path[path.length - 1];
  rd.x = gx * CELL;
  rd.y = gy * CELL;
  rd.dir = side < 0 ? 1 : -1;
  rd.bt!.out = true;
  rd.bt!.held = undefined;
  notify(s, `A ${ENEMIES[rd.kind].name.toLowerCase()} got through to the town!`);
}

/* ------------------------------------------------------------ spells on the map */

/** Raiders a spell aimed at a point reaches. */
export function aimedFoes(s: GameState): Raider[] | null {
  const b = s.raid?.battle;
  if (!b?.aim || b.phase === 'done') return null;
  return s.raid!.raiders.filter((rd) => !rd.ally && !rd.down && !rd.gone && rd.bt && !rd.bt.out && rd.bt.d >= 0 && dist(foeAt(b.map, rd), b.aim!) <= AIM_RADIUS);
}

/** Where the town would aim a spell: where the most raiders are bunched on the trail. */
export function bestAim(s: GameState): [number, number] | null {
  const b = s.raid?.battle;
  if (!b || b.phase !== 'fighting') return null;
  const on = s.raid!.raiders.filter((rd) => !rd.ally && !rd.down && !rd.gone && rd.bt && !rd.bt.out && rd.bt.d >= 0).map((rd) => foeAt(b.map, rd));
  let best: [number, number] | null = null;
  let most = 0;
  for (const p of on) {
    const n = on.filter((q) => dist(p, q) <= AIM_RADIUS).length;
    if (n > most) {
      most = n;
      best = p;
    }
  }
  return best;
}

/** A battle on now (placing, fighting or between waves). */
export const inBattle = (s: GameState) => !!s.raid?.battle && s.raid.battle.phase !== 'done';

/** The founder's (and everyone's) max health, for the battle view. */
export const healthOf = (p: Person) => ({ hp: p.hp, max: maxHp(p) });

/* ------------------------------------------------------------ what the screen sees */

export interface BattleView {
  map: BattleMap;
  phase: Battle['phase'];
  /** Real seconds left to place (placing, between waves), else null. */
  secondsLeft: number | null;
  wave: number;
  waves: number;
  auto: boolean;
  /** How fast it plays (1, 2 or 3 times). */
  speed: number;
  through: number;
  killed: number;
  /** Every raider the town faces in this raid (its allies aside): the battle bar's whole. */
  total: number;
  /** Raiders still to come (this wave and the ones after). */
  coming: number;
  units: { spot: number; person: number | null; ally: number | null; sinceAction: number }[];
  foes: { id: number; x: number; y: number; held: boolean; back: boolean; sinceAction: number; hit: number | null }[];
  /** Who can fight, placed or not (for the placing bar). */
  /** While setting up: how many placed fighters are still walking to their spots (the raiders wait for them). */
  onTheWay: number;
  roster: { id: number; name: string; ranged: boolean; mage: boolean; hp: number; maxHp: number; spot: number | null; hero: boolean }[];
  /** The origin's spells that strike raiders: aimed at the map by the player. */
  spells: { id: string; name: string; readyIn: number; affordable: boolean }[];
  casts: { x: number; y: number; power: string; age: number }[];
  shots: { from: [number, number]; to: [number, number]; age: number; kind: 'arrow' | 'bolt' | 'tower' | 'fire' }[];
  /** The fighters' spells and skills just used (by name), on which raiders (ids), and how long ago (s). */
  acts: { name: string; at: number[]; age: number }[];
}

/** The battle as the screen sees it (null when there's none on). `spells`: the origin's aimable powers (powers.ts
 *  passes them in, to keep this module free of it). */
export function battleView(s: GameState, spells: BattleView['spells']): BattleView | null {
  const r = s.raid;
  const b = r?.battle;
  if (!r || !b || b.phase === 'done') return null;
  const foes = r.raiders.filter((rd) => !rd.ally && rd.bt && !rd.bt.out && rd.bt.d >= 0 && !rd.gone && !rd.down);
  return {
    map: b.map,
    phase: b.phase,
    secondsLeft: b.phase === 'placing' || b.phase === 'breather' ? Math.max(0, (b.until - s.tick) / TICK_HZ) : null,
    onTheWay: b.phase === 'placing' || b.phase === 'breather' ? onTheWay(s, b) : 0,
    wave: b.wave,
    waves: b.waves,
    auto: b.auto,
    speed: s.battleSpeed ?? 1,
    through: b.through,
    killed: b.killed,
    total: r.raiders.filter((rd) => !rd.ally).length,
    coming: r.raiders.filter((rd) => !rd.ally && !rd.down && !rd.gone && rd.bt && !rd.bt.out && rd.bt.d < 0).length,
    units: b.units.map((u) => ({ spot: u.spot, person: u.person ?? null, ally: u.ally ?? null, sinceAction: s.tick - (u.lastAt ?? -999) })),
    foes: foes.map((rd) => {
      const [x, y] = foeAt(b.map, rd);
      return { id: rd.id, x, y, held: rd.bt!.held !== undefined, back: !!rd.bt!.back, sinceAction: s.tick - rd.lastAction, hit: rd.bt!.hit ?? null };
    }),
    roster: fighters(s).map((p) => ({ id: p.id, name: p.name, ranged: ranged(p), mage: castsMagic(p.cls), hp: p.hp, maxHp: maxHp(p), spot: b.units.find((u) => u.person === p.id)?.spot ?? null, hero: p.id === s.mainId })),
    spells,
    casts: (b.casts ?? []).map((c) => ({ x: c.at[0], y: c.at[1], power: c.power, age: (s.tick - c.tick) / TICK_HZ })),
    shots: (b.shots ?? []).map((x) => ({ from: x.from, to: x.to, kind: x.kind, age: (s.tick - x.tick) / TICK_HZ })),
    acts: (b.acts ?? []).filter((a) => s.tick - a.tick < 3 * TICK_HZ).map((a) => ({ name: a.name, at: a.at, age: (s.tick - a.tick) / TICK_HZ })),
  };
}
