// The Underdark (data/underdark.ts has the numbers and the story): a second map under the town's land. It is made
// from the seed the first time a way down stands (`makeUnderdark`, its own side stream `under`): solid rock with the
// caves that were always there (tunnels, fungus forests, the river and its lake, crystal caverns, a magma vent, lost
// ruins, two or three cave towns of other peoples), kept clear of the rock under the town. Each way down (the Deep's
// shaft, a mine, a dwarf hold's hallway: `UNDER_ENTRIES`) opens a little chamber below itself (`openEntry`), and the
// town's miners cut on from it, cell by cell from the open side, as the hold is dug: each load dug at a way down cuts
// a share of a cell (`underDug`, from farming.ts `workMine`), toward the nearest cave until they break through, and
// then galleries for the deep ore. A dwarf hold's hallways open straight into the caves. Once through, the town's
// scouts see more of the caves each hour, the places they find give each dawn, and the cave towns are met; they send
// envoys (questions in the event box: `answerUnder`), trade up the shaft, feud with each other, and at war raid up it
// at night. Things come up at night besides: what lives in the dark, someone taken, the river in flood. A town of
// enough people founds an under-village (a daughter village below: sim/villages.ts `below`). The town digs down only
// under the Growth or Knowledge direction (the dwarves always: it's their home ground). Off with the autopilot.

import {
  CAVE_DRIFT, CAVE_ENVOY_DAYS, CAVE_FRIEND, CAVE_PEOPLE_BY_ID, CAVE_PEOPLES, CAVE_RAID, CAVE_RAID_PER_TROOP, CAVE_RAID_SHARE, CAVE_REST, CAVE_TOWNS, CAVE_TRADE_DAYS, CAVE_TROOPS,
  CAVE_TROOPS_MOST, CAVE_TROOPS_PER_DAY, CAVE_WAR, DANGER_DAY, DANGER_PEOPLE, DARK_RISE, DARK_SHARE, DEEP_ORE_ODDS, DEEP_ORES, DIG_PER_LOAD, EXPLORE_PER_HOUR, FEUD_CHANCE, FEUD_END, FEUD_LOSS, FLOOD, FLOOD_HOURS,
  FLOOD_KILLS, GALLERY_MOST, DAY_DANGER, UPPER_LOST, GIFT_COINS, GIFT_WARMTH, isUnderOpen, NIGHT_FROM, NIGHT_TO, RISE_GAP_HOURS, RUIN_COINS, RUIN_STUDY, SITE_CLEAR, SITE_COUNTS, SITE_NAMES, SITE_SIZES, SITE_TRIPS,
  SITE_YIELD, SNUB, TAKEN, TRADE_WARMTH, TRIP_OUT_SECONDS, TRIP_WORK_SECONDS, UD_CAVE_IN, UD_CAVE_IN_KILLS, UD_H, UD_W, UNDER_ENTRIES, UNDER_VILLAGE_DAY, UNDER_VILLAGE_NAMES, UNDER_VILLAGE_PEOPLE,
  UNDER_VILLAGE_PEOPLE_DWARVES, type UnderCell, type UnderSiteKind,
  DEEP_ONCE, DEEP_PEOPLE, DEEP_SITE_CELL, DEEP_TRIP_OUT, DEEP_TRIPS, DEEP_YIELD, DEN_GOODS, DEPTH_BY_N, DESCEND_HOURS, HEARTVEIN, MARK_HOURS, MARKS_KEPT, SEARCH_DEN, SEARCH_HOURS, TAKERS, UNDER_DEPTHS,
  type DeepSiteKind, type UnderTally,
} from '../data/underdark';
import type { Destination } from '../data/expeditions';
import type { Material, Stock } from '../data/materials';
import { ENEMIES } from '../data/enemies';
import { RAID_KIND_BY_ID } from '../data/raids';
import { hashSeed, Rng } from '../rng';
import { buildingCentre, depositNear, footprint } from './buildings';
import { holdOf } from './castle';
import { killPerson } from './health';
import { isChild } from './social';
import { woundPerson } from './injuries';
import { raidBudget, startRaid } from './raids';
import { askWays } from './telling';
import { foundVillage, pickSettlers, villageById } from './villages';
import { addStock, earn, maxHp, notify, type Building, type GameState, type Person, type Prompt } from './state';
import { calendar, paceDay, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { closeCall } from './closeCalls';

export interface UnderSite {
  id: number;
  kind: UnderSiteKind;
  name: string;
  /** Its middle, and an open cell of it the tunnels reach (found when that's seen). */
  x: number;
  y: number;
  at: number;
  /** A cave town's people (data/underdark.ts CAVE_PEOPLES). */
  people?: string;
}

export type CaveStance = 'peace' | 'friend' | 'war' | 'fallen';

export interface CaveTown {
  people: string;
  site: number;
  known: boolean;
  attitude: number;
  troops: number;
  stance: CaveStance;
  /** The cave town it's feuding with. */
  feud?: string;
  envoyAt?: number;
  tradeAt?: number;
  /** Its first envoy has come. */
  met?: boolean;
}

export interface Underdark {
  /** One character a cell (data/underdark.ts UnderCell), row by row, `UD_W` by `UD_H`. */
  cells: string;
  /** '1' for each cell the town has seen. */
  seen: string;
  sites: UnderSite[];
  towns: CaveTown[];
  /** The buildings whose ways down are open, and the cells below them. */
  from: number[];
  entries: number[];
  /** The share of the next cell cut, the cells cut, and when the town broke through into the caves. */
  dig: number;
  dug: number;
  through?: number;
  /** The sites found (by id). */
  found: number[];
  rose?: number;
  floodUntil?: number;
  /** The under-village's id (sim/villages.ts). */
  village?: number;
  /** What's happened below, newest last (for the view): a few words each. */
  finds: string[];
  /** (The second pass, claude/underdark-2; all optional, for towns made before it.) The deepest depth opened (0 or
   *  missing: the upper caves only), each deeper depth's state (`deeps[n - 1]`), the hours the scouts have spent
   *  seeking the stair under the ruins, what's happened lately for the view to show (`marks`), a search party out after
   *  someone taken, and the tally of what the Underdark has given and taken. */
  depth?: number;
  deeps?: DeepState[];
  descend?: number;
  marks?: UnderMark[];
  search?: { at: number; who: string; cell: number; foe: string };
  tally?: UnderTally;
}

/** A deeper depth's state: what's been seen and found of it (its map is made from the seed: `depthMap`), when it was
 *  opened, and when its dweller was slain. */
export interface DeepState {
  seen: string;
  found: number[];
  opened: number;
  slain?: number;
}

/** Something that happened below, kept a few hours so the view can show it: a train of goods or an envoy walking up
 *  from a cave town to the shaft, a cave-in, a flood, someone dragged off and the search for them, things rising up
 *  the shaft, a cave town fallen, a scout lost. `cell` is where it happened (or set out from), `to` where it went. */
export interface UnderMark {
  kind: 'trade' | 'envoy' | 'cavein' | 'flood' | 'taken' | 'search' | 'rise' | 'fall' | 'lost' | 'slain';
  at: number;
  cell: number;
  to?: number;
  depth?: number;
  who?: string;
  /** The creature (an enemy id), or the cave people. */
  foe?: string;
  people?: string;
}

export const udIndex = (x: number, y: number) => y * UD_W + x;
export const udXY = (i: number) => ({ x: i % UD_W, y: Math.floor(i / UD_W) });
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < UD_W && y < UD_H;
const FOUR = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const EIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
/** Ground that was always open (not the town's own cutting). */
const natural = (c: string) => c === '.' || c === 'g' || c === 'c' || c === 'r' || c === 't';
const ownCell = (c: string) => c === 'd' || c === 'e';
const setAt = (str: string, i: number, c: string) => str.slice(0, i) + c + str.slice(i + 1);

/** The cell below a cell of the land. */
export function underCellOf(s: Pick<GameState, 'land'>, x: number, y: number): number {
  const ux = Math.max(0, Math.min(UD_W - 1, Math.floor((x * UD_W) / s.land.w)));
  const uy = Math.max(0, Math.min(UD_H - 1, Math.floor((y * UD_H) / s.land.h)));
  return udIndex(ux, uy);
}

/* ------------------------------------------------------------ the map */

/** The cave layer as it lies before anyone digs: made from the seed, with the rock under `mid` (the camp's cell) kept
 *  solid so the town has rock to cut first. */
export function makeUnderdark(seed: string | number, mid: { x: number; y: number }, peoples?: string[]): Underdark {
  const g = new Rng(hashSeed(`${seed}:under`));
  const cells: string[] = new Array(UD_W * UD_H).fill('#');
  const siteOf = new Int16Array(UD_W * UD_H).fill(-1);
  const sites: UnderSite[] = [];
  // the river, east to west, well clear of the town's rock
  const top = g.chance(0.5);
  let ry = top ? g.int(4, 10) : g.int(UD_H - 11, UD_H - 5);
  for (let x = 0; x < UD_W; x++) {
    if (g.chance(0.35)) ry = Math.max(2, Math.min(UD_H - 3, ry + (g.chance(0.5) ? 1 : -1)));
    for (const y of [ry, ry + (g.chance(0.5) ? 1 : 0)]) if (Math.hypot(x - mid.x, y - mid.y) > SITE_CLEAR) cells[udIndex(x, y)] = '~';
  }
  // the places: the cave towns first (two or three of the peoples), then the rest
  const pick = peoples ?? [...CAVE_PEOPLES].sort((a, b) => hashSeed(`${seed}:under:${a.id}`) - hashSeed(`${seed}:under:${b.id}`)).slice(0, g.int(CAVE_TOWNS[0], CAVE_TOWNS[1])).map((p) => p.id);
  const kinds: { kind: UnderSiteKind; people?: string }[] = [...pick.map((people) => ({ kind: 'town' as const, people }))];
  for (const [k, n] of Object.entries(SITE_COUNTS) as [UnderSiteKind, number][]) for (let i = 0; i < n; i++) kinds.push({ kind: k });
  const names: Record<string, string[]> = Object.fromEntries(Object.entries(SITE_NAMES).map(([k, v]) => [k, [...v]]));
  const CH: Record<UnderSiteKind, UnderCell> = { fungus: 'g', lake: '~', crystal: 'c', magma: 'v', ruins: 'r', town: 't' };
  for (const { kind, people } of kinds) {
    let cx = 0;
    let cy = 0;
    for (let tries = 0, gap = 9; tries < 120; tries++) {
      if (tries % 30 === 29) gap--;
      cx = g.int(4, UD_W - 5);
      cy = g.int(4, UD_H - 5);
      if (Math.hypot(cx - mid.x, cy - mid.y) < SITE_CLEAR + 3) continue;
      if (sites.some((o) => Math.hypot(o.x - cx, o.y - cy) < gap)) continue;
      break;
    }
    const id = sites.length;
    const [lo, hi] = SITE_SIZES[kind];
    const size = g.int(lo, hi);
    const todo = [{ x: cx, y: cy }];
    const blob: number[] = [];
    while (todo.length && blob.length < size) {
      const q = todo.splice(g.int(0, todo.length - 1), 1)[0];
      if (!inside(q.x, q.y) || q.x < 1 || q.y < 1 || q.x > UD_W - 2 || q.y > UD_H - 2) continue;
      const i = udIndex(q.x, q.y);
      if (siteOf[i] >= 0 || blob.includes(i) || Math.hypot(q.x - mid.x, q.y - mid.y) < SITE_CLEAR) continue;
      blob.push(i);
      for (const [dx, dy] of FOUR) todo.push({ x: q.x + dx, y: q.y + dy });
    }
    for (const i of blob) {
      cells[i] = CH[kind];
      siteOf[i] = id;
    }
    // (water and fire get a shore of open rock round them, to stand on)
    if (kind === 'lake' || kind === 'magma')
      for (const i of blob) {
        const { x, y } = udXY(i);
        for (const [dx, dy] of FOUR) {
          const j = udIndex(x + dx, y + dy);
          if (inside(x + dx, y + dy) && cells[j] === '#' && Math.hypot(x + dx - mid.x, y + dy - mid.y) >= SITE_CLEAR) {
            cells[j] = '.';
            siteOf[j] = id;
          }
        }
      }
    const open = blob.concat([...siteOf.keys()].filter((j) => siteOf[j] === id && !blob.includes(j))).filter((j) => isUnderOpen(cells[j]));
    const at = open.length ? open.reduce((a, b) => (dist(b, cx, cy) < dist(a, cx, cy) ? b : a)) : udIndex(cx, cy);
    if (!isUnderOpen(cells[at])) cells[at] = '.';
    const list = names[kind];
    const name = kind === 'town' ? CAVE_PEOPLE_BY_ID[people!].name : list.length ? list.splice(g.int(0, list.length - 1), 1)[0] : 'a nameless cave';
    sites.push({ id, kind, name, x: cx, y: cy, at, ...(people ? { people } : {}) });
  }
  // the tunnels: each place joined to the nearest already joined, winding
  const joined = [sites[0]];
  for (const site of sites.slice(1).sort((a, b) => dist(udIndex(a.x, a.y), sites[0].x, sites[0].y) - dist(udIndex(b.x, b.y), sites[0].x, sites[0].y))) {
    const to = joined.reduce((a, b) => (Math.hypot(b.x - site.x, b.y - site.y) < Math.hypot(a.x - site.x, a.y - site.y) ? b : a));
    tunnel(cells, g, udXY(site.at), udXY(to.at), mid);
    joined.push(site);
  }
  // and a few dead ends wandering off
  for (let k = 0; k < 6; k++) {
    const from = udXY(g.pick(sites).at);
    tunnel(cells, g, from, { x: g.int(2, UD_W - 3), y: g.int(2, UD_H - 3) }, mid, g.int(6, 14));
  }
  return { cells: cells.join(''), seen: '0'.repeat(UD_W * UD_H), sites, towns: [], from: [], entries: [], dig: 0, dug: 0, found: [], finds: [] };
}

const dist = (i: number, x: number, y: number) => {
  const p = udXY(i);
  return Math.hypot(p.x - x, p.y - y);
};

/** A winding tunnel from one cell toward another (fording the river), never into the town's rock; at most `most`
 *  steps. */
function tunnel(cells: string[], g: Rng, a: { x: number; y: number }, b: { x: number; y: number }, mid: { x: number; y: number }, most = 400): void {
  let { x, y } = a;
  for (let n = 0; n < most && (x !== b.x || y !== b.y); n++) {
    const toward = g.chance(0.72);
    let dx = 0;
    let dy = 0;
    if (toward) {
      if (Math.abs(b.x - x) > Math.abs(b.y - y) || (Math.abs(b.x - x) === Math.abs(b.y - y) && g.chance(0.5))) dx = Math.sign(b.x - x);
      else dy = Math.sign(b.y - y);
    } else [dx, dy] = g.pick(FOUR);
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 1 || ny < 1 || nx > UD_W - 2 || ny > UD_H - 2) continue;
    if (Math.hypot(nx - mid.x, ny - mid.y) < SITE_CLEAR - 1) continue;
    x = nx;
    y = ny;
    const i = udIndex(x, y);
    if (cells[i] === '#' || cells[i] === '~' || cells[i] === 'v') cells[i] = '.';
  }
}

/* ------------------------------------------------------------ the ways down */

/** The buildings a way down opens from (finished). */
export const entryBuildings = (s: GameState): Building[] => s.buildings.filter((b) => b.status === 'done' && (UNDER_ENTRIES as readonly string[]).includes(b.def));
/** The way down raids come up and goods go down: the Deep's shaft first, then a hallway, then a mine. */
export function mainEntry(s: GameState): Building | undefined {
  const u = s.underdark;
  const open = entryBuildings(s).filter((b) => !u || u.from.includes(b.id));
  for (const def of UNDER_ENTRIES) {
    const b = open.find((o) => o.def === def);
    if (b) return b;
  }
  return undefined;
}

/** The town digs down under the Growth or Knowledge direction; the dwarves always. */
export const digsDown = (s: GameState) => s.autopilot !== false && (holdOf(s) === 'mountain' || s.origin === 'dwarves' || (s.direction ?? 'growth') === 'growth' || s.direction === 'knowledge');

/** The Underdark, made the first time a way down stands (the autopilot's: never in the tests' plain towns unless
 *  asked for). */
export function underdarkOf(s: GameState): Underdark | null {
  if (s.underdark) return s.underdark;
  if (s.autopilot === false || !entryBuildings(s).length) return null;
  const mid = udXY(underCellOf(s, s.land.camp.x, s.land.camp.y));
  const u = makeUnderdark(s.seed, mid);
  const dwarves = s.origin === 'dwarves';
  u.towns = u.sites.filter((t) => t.kind === 'town').map((t) => {
    const d = CAVE_PEOPLE_BY_ID[t.people!];
    const g = new Rng(hashSeed(`${s.seed}:under:town:${d.id}`));
    // (the cave peoples know the dwarves of old: met from the first, and warmer)
    return { people: d.id, site: t.id, known: dwarves, attitude: d.start + (dwarves ? d.dwarves : 0), troops: g.int(CAVE_TROOPS[0], CAVE_TROOPS[1]), stance: 'peace' as CaveStance };
  });
  for (const t of u.towns) t.stance = stanceFor(t);
  s.underdark = u;
  return u;
}

/** Open the way down below a building: a little chamber cut out of the rock, its foot in the middle. A dwarf hold's
 *  hallway opens straight into the nearest cave. */
export function openEntry(s: GameState, u: Underdark, b: Building): void {
  const r = footprint(b);
  let at = underCellOf(s, r.x + r.w / 2, r.y + r.h / 2);
  // (never under water or fire: the nearest rock or open ground instead)
  if (u.cells[at] === '~' || u.cells[at] === 'v') {
    const { x, y } = udXY(at);
    let best = at;
    let bd = Infinity;
    for (let j = 0; j < u.cells.length; j++) {
      if (u.cells[j] === '~' || u.cells[j] === 'v') continue;
      const d = dist(j, x, y);
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    at = best;
  }
  u.from.push(b.id);
  if (!u.entries.includes(at)) u.entries.push(at);
  const { x, y } = udXY(at);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!inside(x + dx, y + dy)) continue;
      const i = udIndex(x + dx, y + dy);
      if (u.cells[i] === '#') u.cells = setAt(u.cells, i, 'd');
    }
  u.cells = setAt(u.cells, at, 'e');
  if (b.def === 'hold_hallway') {
    // (the hold's hallways open on the caves: a passage cut straight to the nearest)
    const goal = nearestNatural(u, at);
    if (goal >= 0) {
      let p = udXY(at);
      const q = udXY(goal);
      while (p.x !== q.x || p.y !== q.y) {
        if (p.x !== q.x) p = { x: p.x + Math.sign(q.x - p.x), y: p.y };
        else p = { x: p.x, y: p.y + Math.sign(q.y - p.y) };
        const i = udIndex(p.x, p.y);
        if (u.cells[i] === '#' || u.cells[i] === '~' || u.cells[i] === 'v') u.cells = setAt(u.cells, i, 'd');
      }
    }
  }
  see(u, at, 1);
  checkThrough(s, u);
}

/** The open ground joined to the caves' places (the network the tunnels make). A pocket of open ground off it (a
 *  shore across the lake from the rest, say) isn't the way in: the first pass let a hold's hallway or a mine break into
 *  such a pocket, and the scouts never found anything. */
export function caveNetwork(u: Pick<Underdark, 'cells' | 'sites'>): Uint8Array {
  const out = new Uint8Array(u.cells.length);
  const q = u.sites.map((x) => x.at).filter((i) => isUnderOpen(u.cells[i]));
  for (const i of q) out[i] = 1;
  for (let k = 0; k < q.length; k++) {
    const { x, y } = udXY(q[k]);
    for (const [dx, dy] of FOUR) {
      if (!inside(x + dx, y + dy)) continue;
      const j = udIndex(x + dx, y + dy);
      if (!out[j] && isUnderOpen(u.cells[j])) {
        out[j] = 1;
        q.push(j);
      }
    }
  }
  return out;
}

/** The nearest cave that was always there, from a cell (on the caves' network). */
function nearestNatural(u: Underdark, from: number): number {
  const { x, y } = udXY(from);
  const net = caveNetwork(u);
  let best = -1;
  let bd = Infinity;
  for (let j = 0; j < u.cells.length; j++) {
    if (!natural(u.cells[j]) || !net[j]) continue;
    const d = Math.abs(udXY(j).x - x) + Math.abs(udXY(j).y - y);
    if (d < bd) {
      bd = d;
      best = j;
    }
  }
  return best;
}

/** The open ground the town can walk to from its ways down. */
export function reached(u: Underdark): Uint8Array {
  const out = new Uint8Array(u.cells.length);
  const q = [...u.entries];
  for (const i of q) out[i] = 1;
  for (let k = 0; k < q.length; k++) {
    const { x, y } = udXY(q[k]);
    for (const [dx, dy] of FOUR) {
      if (!inside(x + dx, y + dy)) continue;
      const j = udIndex(x + dx, y + dy);
      if (!out[j] && isUnderOpen(u.cells[j])) {
        out[j] = 1;
        q.push(j);
      }
    }
  }
  return out;
}

/** Mark cells seen round a cell. */
function see(u: Underdark, i: number, r: number): void {
  const { x, y } = udXY(i);
  let seen = u.seen;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inside(x + dx, y + dy) && seen[udIndex(x + dx, y + dy)] !== '1') seen = setAt(seen, udIndex(x + dx, y + dy), '1');
  u.seen = seen;
}

const findLine = (u: Underdark, text: string) => {
  u.finds.push(text);
  if (u.finds.length > 12) u.finds.splice(0, u.finds.length - 12);
};

/** The tally (made the first time it's needed). */
export const tallyOf = (u: Underdark): UnderTally => (u.tally ??= { goods: 0, coins: 0, trades: 0, deaths: 0, caveIns: 0, floods: 0, rises: 0, dwellers: 0 });
const goodsCount = (g: Stock) => Object.values(g).reduce((a, n) => a + (n ?? 0), 0);
/** Something for the view to show (kept `MARKS_KEPT`). */
function mark(s: GameState, u: Underdark, m: Omit<UnderMark, 'at'>): void {
  (u.marks ??= []).push({ ...m, at: s.tick });
  if (u.marks.length > MARKS_KEPT) u.marks.splice(0, u.marks.length - MARKS_KEPT);
}
/** Someone of the town lost below: killed, counted. */
function lostBelow(s: GameState, u: Underdark, p: Person, cause: string): void {
  killPerson(s, p, cause);
  tallyOf(u).deaths++;
}

/** Whether the town's tunnels have reached the caves: told once. */
function checkThrough(s: GameState, u: Underdark): void {
  if (u.through !== undefined) return;
  const r = reached(u);
  const net = caveNetwork(u);
  for (let i = 0; i < r.length; i++)
    if (r[i] && natural(u.cells[i]) && net[i]) {
      u.through = s.tick;
      const line = s.origin === 'dwarves' ? 'The hold breaks into the Underdark, the dwarves\' old home ground: tunnels running off into the dark, the smell of water and mushrooms, and far off, lamps.' : 'The miners break through into the Underdark: a cave that goes on and on, a draught from somewhere far below, and in the dark, faint lights that are not theirs.';
      findLine(u, 'The town broke through into the Underdark.');
      notify(s, line, true);
      return;
    }
}

/* ------------------------------------------------------------ the digging */

/** The next cell to cut: rock beside the town's own cells, toward the nearest cave until through, then galleries
 *  wandering off from the town's tunnels. */
export function nextCut(u: Underdark): number {
  let goal = -1;
  if (u.through === undefined) {
    let bd = Infinity;
    for (const e of u.entries) {
      const n = nearestNatural(u, e);
      if (n < 0) continue;
      const d = dist(n, udXY(e).x, udXY(e).y);
      if (d < bd) {
        bd = d;
        goal = n;
      }
    }
  }
  const gp = goal >= 0 ? udXY(goal) : null;
  let best = -1;
  let bs = Infinity;
  for (let i = 0; i < u.cells.length; i++) {
    if (u.cells[i] !== '#') continue;
    const { x, y } = udXY(i);
    let beside = 0;
    for (const [dx, dy] of FOUR) if (inside(x + dx, y + dy) && ownCell(u.cells[udIndex(x + dx, y + dy)])) beside++;
    if (!beside) continue;
    const wobble = (hashSeed(`ud:${i}`) % 1000) / 1000;
    const score = gp ? Math.abs(x - gp.x) + Math.abs(y - gp.y) + wobble * 0.9 + beside * 0.4 : wobble * 6 + beside * 2;
    if (score < bs) {
      bs = score;
      best = i;
    }
  }
  return best;
}

/** A load dug at a way down: a share of a cell of the Underdark cut, and when a whole one's cut, its ore to the town,
 *  the chance of the roof coming down on the digger, and maybe the breakthrough. */
export function underDug(s: GameState, p: Person, b: Building): void {
  const u = s.underdark;
  if (!u || !u.from.includes(b.id) || !digsDown(s)) return;
  if (u.floodUntil !== undefined && s.tick < u.floodUntil) return;
  if (u.through !== undefined && u.dug >= GALLERY_MOST) return;
  u.dig += DIG_PER_LOAD;
  if (u.dig < 1) return;
  u.dig -= 1;
  const i = nextCut(u);
  if (i < 0) return;
  u.cells = setAt(u.cells, i, 'd');
  u.dug++;
  see(u, i, 1);
  const g = new Rng(hashSeed(`${s.seed}:under:cut:${i}:${s.tick}`));
  const got: Stock = { stone: 1 };
  if (g.chance(DEEP_ORE_ODDS)) addStock(got, g.weighted(DEEP_ORES as Record<Material, number>), 2);
  depositNear(s, buildingCentre(b), got);
  checkThrough(s, u);
  if (g.chance(UD_CAVE_IN)) caveIn(s, p, g, i);
}

/** The roof comes down on someone cutting below: buried, or dragged out broken. */
export function caveIn(s: GameState, p: Person, g: Rng, cell?: number): void {
  const u = s.underdark!;
  findLine(u, `The roof came down on ${p.name}.`);
  tallyOf(u).caveIns++;
  mark(s, u, { kind: 'cavein', cell: cell ?? u.entries[0] ?? 0, who: p.name });
  if (g.chance(UD_CAVE_IN_KILLS)) {
    lostBelow(s, u, p, 'was buried in a cave-in below the town');
    notify(s, `The rock comes down in the tunnels below: ${p.name} is buried under it.`, true);
    return;
  }
  const hurt = maxHp(p) * 0.5;
  p.hp = Math.max(1, p.hp - hurt);
  woundPerson(s, p, hurt, 'fracture', g);
  notify(s, `The roof comes down in the tunnels below: ${p.name} is dug out with broken bones.`, true);
  closeCall(s, p, `${p.name} was nearly buried when the roof came down below, and was dug out alive.`); // (sim/closeCalls.ts)
}

/* ------------------------------------------------------------ the hour */

const isNight = (hour: number) => hour >= NIGHT_FROM || hour <= NIGHT_TO;
const roll = (s: GameState, ...salt: (string | number)[]) => new Rng(hashSeed(`${s.seed}:under:${salt.join(':')}:${s.tick}`));
/** Those at work in the ways down (the miners at an open entry). */
const below = (s: GameState, u: Underdark) => s.people.filter((p) => p.task?.type === 'mine' && u.from.includes(p.task.building) && !p.downed && p.away === null);

export function underdarkHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  const u = underdarkOf(s);
  if (!u) return;
  for (const b of entryBuildings(s)) if (!u.from.includes(b.id)) openEntry(s, u, b);
  if (u.through === undefined) return;
  let r = reached(u);
  if (reconnect(s, u, r)) r = reached(u);
  explore(s, u, r);
  depthsHourly(s, u, r);
  searchHome(s, u, r);
  const hour = calendar(s.tick).hour;
  if (hour === 6) {
    underDawn(s, u, r);
    deepDawn(s, u);
    for (const t of u.towns) caveDay(s, u, t, r);
    feuds(s, u);
    underVillage(s, u);
  }
  if (paceDay(s.tick) >= DANGER_DAY && s.people.length >= DANGER_PEOPLE) {
    if (isNight(hour)) night(s, u);
    dangers(s, u, r, isNight(hour));
  }
}

/** The scouts see a little more of the caves each hour, outward from the town's tunnels; a place seen is found. */
function explore(s: GameState, u: Underdark, r: Uint8Array): void {
  let left = EXPLORE_PER_HOUR;
  const q = [...u.entries];
  const done = new Uint8Array(u.cells.length);
  for (const i of q) done[i] = 1;
  for (let k = 0; k < q.length && left > 0; k++) {
    const i = q[k];
    if (u.seen[i] !== '1') {
      see(u, i, 1);
      left--;
    }
    const { x, y } = udXY(i);
    for (const [dx, dy] of FOUR) {
      if (!inside(x + dx, y + dy)) continue;
      const j = udIndex(x + dx, y + dy);
      if (!done[j] && r[j]) {
        done[j] = 1;
        q.push(j);
      }
    }
  }
  for (const site of u.sites) if (!u.found.includes(site.id) && u.seen[site.at] === '1') foundSite(s, u, site);
}

const FOUND_LINE: Record<UnderSiteKind, (n: string) => string> = {
  fungus: (n) => `Scouts below find ${n}: a forest of giant mushrooms, glowing. Food, if anyone dares pick it.`,
  lake: (n) => `Scouts below find ${n}, and in it pale, blind fish. Something larger moves out in the middle.`,
  crystal: (n) => `Scouts below find ${n}: crystal from floor to roof, humming when the lamps come near.`,
  magma: (n) => `Scouts below find ${n}, where the rock runs red. The air there could cook a man.`,
  ruins: (n) => `Scouts below find ${n}: halls of a people who dug here first. They bring back old coins, and carvings to puzzle over.`,
  town: (n) => `Scouts below come on ${n}: a town in the dark, lamps and walls and folk who are not ours.`,
};

function foundSite(s: GameState, u: Underdark, site: UnderSite): void {
  u.found.push(site.id);
  findLine(u, `Found ${site.name}.`);
  notify(s, FOUND_LINE[site.kind](site.name), true);
  if (site.kind === 'ruins') {
    s.coins = (s.coins ?? 0) + RUIN_COINS;
    earn(s, 'goods', RUIN_COINS);
    tallyOf(u).coins += RUIN_COINS;
    const topic = s.research.queue[0];
    if (topic) s.research.progress[topic] = (s.research.progress[topic] ?? 0) + RUIN_STUDY;
  }
  if (site.kind === 'town') {
    const t = u.towns.find((o) => o.site === site.id);
    if (t && !t.known) {
      t.known = true;
      t.envoyAt = undefined;
    }
  }
}

/** Each dawn: the places found and reached give (food, glowmoss, crystals), up the main way down. */
function underDawn(s: GameState, u: Underdark, r: Uint8Array): void {
  const entry = mainEntry(s);
  if (!entry) return;
  const got: Stock = {};
  for (const site of u.sites) {
    const y = SITE_YIELD[site.kind];
    if (!y || !u.found.includes(site.id) || !r[site.at]) continue;
    for (const [m, n] of Object.entries(y) as [Material, number][]) addStock(got, m, n);
  }
  if (Object.keys(got).length) {
    depositNear(s, buildingCentre(entry), got);
    tallyOf(u).goods += goodsCount(got);
  }
}

/* ------------------------------------------------------------ the cave towns */

const peopleOf = (t: CaveTown) => CAVE_PEOPLE_BY_ID[t.people];
const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n)));
function stanceFor(t: CaveTown): CaveStance {
  if (t.stance === 'fallen') return 'fallen';
  if (t.attitude <= CAVE_WAR) return 'war';
  if (t.stance === 'war' && t.attitude < CAVE_WAR + 15) return 'war';
  return t.attitude >= CAVE_FRIEND ? 'friend' : 'peace';
}
function setStance(s: GameState, u: Underdark, t: CaveTown): void {
  const was = t.stance;
  t.stance = stanceFor(t);
  if (was === t.stance || !t.known) return;
  const n = peopleOf(t).name;
  const line = t.stance === 'war' ? `${cap(n)} have turned against the town: their warriors will come up the shaft by night.` : t.stance === 'friend' ? `${cap(n)} call the town friends now, and will trade.` : `${cap(n)} are at peace with the town.`;
  findLine(u, line);
  notify(s, line, true);
}
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1);
export const caveTownById = (s: GameState, id: string) => s.underdark?.towns.find((t) => t.people === id);

/** A cave town's day: its warriors grow, its goodwill drifts, it trades with a friendly town, it sends envoys. */
function caveDay(s: GameState, u: Underdark, t: CaveTown, r: Uint8Array): void {
  if (t.stance === 'fallen') return;
  const d = peopleOf(t);
  t.troops = Math.min(CAVE_TROOPS_MOST, t.troops + CAVE_TROOPS_PER_DAY);
  t.attitude = clamp(t.attitude + (CAVE_REST[d.temper] + (s.origin === 'dwarves' ? d.dwarves : 0) - t.attitude) * CAVE_DRIFT);
  setStance(s, u, t);
  if (!t.known) return;
  const site = u.sites[t.site];
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  // a train of goods up the shaft
  if (t.stance === 'friend' && r[site.at] && (t.tradeAt === undefined || day - t.tradeAt >= CAVE_TRADE_DAYS) && (s.coins ?? 0) >= d.price) {
    const entry = mainEntry(s);
    if (entry) {
      t.tradeAt = day;
      s.coins = (s.coins ?? 0) - d.price;
      earn(s, 'goods', -d.price);
      depositNear(s, buildingCentre(entry), { ...d.goods });
      const tl = tallyOf(u);
      tl.trades++;
      tl.goods += goodsCount(d.goods);
      mark(s, u, { kind: 'trade', cell: site.at, to: u.entries[0], people: t.people });
      t.attitude = clamp(t.attitude + TRADE_WARMTH);
      findLine(u, `${cap(d.name)} traded ${d.goodsWords}.`);
      notify(s, `A train from ${d.name} comes up the shaft with ${d.goodsWords}, for ${d.price} coins.`, true);
    }
  }
  // an envoy
  if (!s.prompts.some((p) => p.ways?.system === 'underdark') && (t.envoyAt === undefined || day - t.envoyAt >= CAVE_ENVOY_DAYS)) {
    t.envoyAt = day;
    if (envoy(s, t) && r[site.at]) mark(s, u, { kind: 'envoy', cell: site.at, to: u.entries[0], people: t.people });
  }
}

/** What a cave town's envoy has come about: a first greeting, help in a feud, terms at war, or the price of
 *  friendship. */
export function envoyAbout(t: CaveTown, first: boolean): 'greet' | 'aid' | 'terms' | 'gift' | null {
  if (first) return 'greet';
  if (t.stance === 'war') return 'terms';
  if (t.feud) return 'aid';
  if (t.stance === 'peace') return 'gift';
  return null;
}

function envoy(s: GameState, t: CaveTown): Prompt | null {
  const d = peopleOf(t);
  const about = envoyAbout(t, !t.met);
  if (!about) return null;
  t.met = true;
  const rich = (s.coins ?? 0) >= GIFT_COINS * 3;
  const demand = Math.round(30 + t.troops * 3);
  if (about === 'greet') findLine(s.underdark!, `Met ${d.name}.`);
  const foe = t.feud ? CAVE_PEOPLE_BY_ID[t.feud]?.name : '';
  const text = {
    greet: [`Envoys from ${d.name}`, `${d.hello} They are ${d.kind}, from a town down in the Underdark, and they want to know what the town means by digging into their dark.`, ['Welcome them', 'Send them back down'], 0],
    aid: [`${cap(d.name)} ask for help`, `${cap(d.name)} are at war with ${foe} down in the dark, and their envoy asks the town for help: coin for arms, ${GIFT_COINS} of it.`, [`Send ${GIFT_COINS} coins`, 'Stay out of it'], rich ? 0 : 1],
    terms: [`Terms from ${d.name}`, `An envoy from ${d.name} comes up the shaft under a white rag. Pay ${demand} coins, they say, and their warriors stay below.`, [`Pay ${demand} coins`, 'Refuse'], (s.coins ?? 0) >= demand * 2 ? 0 : 1],
    gift: [`${cap(d.name)} would trade`, `${cap(d.name)} would open trade in ${d.goodsWords}, their envoy says, once the town shows good faith: a gift of ${GIFT_COINS} coins.`, [`Send ${GIFT_COINS} coins`, 'Not now'], rich ? 0 : 1],
  }[about] as [string, string, string[], number];
  return askWays(s, { system: 'underdark', about: `${about}:${t.people}`, id: about === 'terms' ? demand : undefined }, text[0], text[1], 'cave underground envoy dark', text[2], text[3], 10);
}

/** A cave town's envoy answered (from sim/heritage.ts `answerWays`). */
export function answerUnder(s: GameState, prompt: Prompt, option: number): void {
  const [about, id] = (prompt.ways?.about ?? '').split(':');
  const u = s.underdark;
  const t = caveTownById(s, id);
  if (!u || !t) return;
  const d = peopleOf(t);
  const pay = (n: number) => {
    if ((s.coins ?? 0) < n) return false;
    s.coins = (s.coins ?? 0) - n;
    earn(s, 'realm', -n);
    return true;
  };
  if (about === 'greet') t.attitude = clamp(t.attitude + (option === 0 ? 10 : -SNUB));
  else if (about === 'aid') {
    if (option === 0 && pay(GIFT_COINS)) {
      t.attitude = clamp(t.attitude + GIFT_WARMTH);
      t.troops += 3;
      const foe = t.feud ? caveTownById(s, t.feud) : undefined;
      if (foe) foe.attitude = clamp(foe.attitude - 10);
    } else t.attitude = clamp(t.attitude - 3);
  } else if (about === 'terms') {
    if (option === 0 && pay(prompt.ways?.id ?? 0)) t.attitude = Math.max(t.attitude, CAVE_WAR + 20);
    else t.attitude = clamp(t.attitude - 5);
  } else if (about === 'gift') {
    if (option === 0 && pay(GIFT_COINS)) t.attitude = clamp(t.attitude + GIFT_WARMTH);
    else t.attitude = clamp(t.attitude - 2);
  }
  setStance(s, u, t);
  void d;
}

/** The cave towns quarrel among themselves: a feud wears both down, and a weak town may fall. */
function feuds(s: GameState, u: Underdark): void {
  const g = roll(s, 'feuds');
  const standing = u.towns.filter((t) => t.stance !== 'fallen');
  for (const t of standing) {
    if (!t.feud) continue;
    const foe = u.towns.find((o) => o.people === t.feud);
    if (!foe || foe.stance === 'fallen') {
      t.feud = undefined;
      continue;
    }
    t.troops = Math.max(0, t.troops - FEUD_LOSS * g.range(0.5, 1.5));
    if (t.troops <= 2) {
      t.stance = 'fallen';
      t.feud = undefined;
      foe.feud = undefined;
      const line = `${cap(peopleOf(t).name)} have fallen to ${peopleOf(foe).name}, down in the dark. Their lamps are out.`;
      findLine(u, line);
      mark(s, u, { kind: 'fall', cell: u.sites[t.site].at, people: t.people, foe: foe.people });
      if (t.known || foe.known) notify(s, line, true);
    }
  }
  for (const t of u.towns) if (t.feud && g.chance(FEUD_END)) {
    const foe = u.towns.find((o) => o.people === t.feud);
    t.feud = undefined;
    if (foe) foe.feud = undefined;
    if (t.known) findLine(u, `${cap(peopleOf(t).name)} made peace with ${foe ? peopleOf(foe).name : 'their foes'}.`);
  }
  const free = standing.filter((t) => !t.feud && t.stance !== 'fallen');
  if (free.length >= 2 && g.chance(FEUD_CHANCE)) {
    const a = free[g.int(0, free.length - 1)];
    const b = free.filter((o) => o !== a)[g.int(0, free.length - 2)];
    a.feud = b.people;
    b.feud = a.people;
    const line = `${cap(peopleOf(a).name)} and ${peopleOf(b).name} have gone to war down in the dark.`;
    findLine(u, line);
    if (a.known || b.known) notify(s, line, true);
  }
}

/* ------------------------------------------------------------ the night */

/** At night, things come up: what lives in the dark (a raid up the main way down), someone at work below taken, the
 *  river in flood, and a cave town at war raiding. */
function night(s: GameState, u: Underdark): void {
  const entry = mainEntry(s);
  if (!entry) return;
  const g = roll(s, 'night');
  const gapOk = u.rose === undefined || s.tick - u.rose >= RISE_GAP_HOURS * TICKS_PER_HOUR;
  // a cave town at war comes up the shaft
  for (const t of u.towns) {
    if (t.stance !== 'war' || !t.known || s.raid || !gapOk) continue;
    if (!g.chance(CAVE_RAID)) continue;
    const kind = RAID_KIND_BY_ID[peopleOf(t).raid];
    if (!kind) continue;
    startRaid(s, kind, Math.max(8, raidBudget(s) * (CAVE_RAID_SHARE + CAVE_RAID_PER_TROOP * t.troops)), g, buildingCentre(entry));
    u.rose = s.tick;
    tallyOf(u).rises++;
    mark(s, u, { kind: 'rise', cell: u.sites[t.site].at, to: u.entries[0], people: t.people });
    t.troops = Math.max(0, t.troops - 3);
    findLine(u, `${cap(peopleOf(t).name)} raided up the shaft.`);
    notify(s, `${cap(peopleOf(t).name)} come up out of the shaft in the night: ${kind.name.toLowerCase()}!`, true);
    return;
  }
  // a dweller of a depth opened and not yet slain comes up itself
  for (let n = 1; n <= (u.depth ?? 0); n++) {
    const d = DEPTH_BY_N[n];
    const ds = u.deeps?.[n - 1];
    if (!d || !ds || ds.slain !== undefined || s.raid || !gapOk || !g.chance(d.stir)) continue;
    const base = RAID_KIND_BY_ID[d.rise];
    if (!base || !Object.keys(base.enemies).length) continue;
    startRaid(s, { ...base, leader: d.dweller }, Math.max(10, raidBudget(s) * d.riseShare), g, buildingCentre(entry));
    u.rose = s.tick;
    const tl = tallyOf(u);
    tl.rises++;
    tl.dwellers++;
    mark(s, u, { kind: 'rise', cell: u.entries[0], foe: d.dweller, depth: n });
    findLine(u, `${ENEMY_NAME(d.dweller)} came up the shaft.`);
    notify(s, `The ground shakes in the night, and up out of the shaft comes ${enemyMid(d.dweller)}, up from ${d.name}, with what lives there at its heels!`, true);
    return;
  }
  // what lives in the dark (from the deepest depth open: worse the deeper the town has gone)
  const deep = DEPTH_BY_N[u.depth ?? 0];
  if (!s.raid && gapOk && g.chance(DARK_RISE)) {
    const kind = RAID_KIND_BY_ID[deep?.rise ?? 'under_dark'];
    if (kind && Object.keys(kind.enemies).length) {
      startRaid(s, kind, Math.max(6, raidBudget(s) * (deep?.riseShare ?? DARK_SHARE)), g, buildingCentre(entry));
      u.rose = s.tick;
      tallyOf(u).rises++;
      mark(s, u, { kind: 'rise', cell: u.entries[0], foe: kind.id });
      findLine(u, deep ? `Things came up from ${deep.name}.` : 'Things came up out of the dark.');
      notify(s, deep ? `Something comes up from ${deep.name} in the night: ${kind.name.toLowerCase()} pour out of the shaft!` : 'Something comes up out of the Underdark in the night: things from the dark pour out of the shaft!', true);
      return;
    }
  }
}

/** Every hour, by day or night (the tunnels are dark either way, but worse at night): one at work below taken by
 *  something in the dark, the river breaking into the town's tunnels, and a scout lost in the upper caves while there's
 *  still dark to scout. */
function dangers(s: GameState, u: Underdark, r: Uint8Array, dark: boolean): void {
  const g = roll(s, 'danger');
  const odds = dark ? 1 : DAY_DANGER;
  const work = below(s, u);
  // a scout lost in the upper caves
  if (u.seen.length && g.chance(UPPER_LOST * odds) && unscouted(u, r)) {
    const pool = s.people.filter((p) => p.id !== s.mainId && p.away === null && !p.downed && !isChild(p));
    if (pool.length) {
      const p = pool[g.int(0, pool.length - 1)];
      findLine(u, `${p.name} was lost scouting the caves.`);
      mark(s, u, { kind: 'lost', cell: u.entries[0] ?? 0, who: p.name });
      lostBelow(s, u, p, 'was lost scouting the caves under the town');
      notify(s, `${p.name} went scouting into the caves below with a lamp and a rope, and has not come back up.`, true);
      return;
    }
  }
  // someone taken
  if (work.length && g.chance(TAKEN * odds)) {
    const p = work[g.int(0, work.length - 1)];
    const foe = TAKERS[g.int(0, TAKERS.length - 1)];
    const cell = u.entries[0] ?? 0;
    findLine(u, `${p.name} was taken in the dark.`);
    mark(s, u, { kind: 'taken', cell, who: p.name, foe, to: darkCellNear(u, r, cell, g) });
    lostBelow(s, u, p, 'was dragged off into the dark below the town');
    // (the search party goes after them with torches: sim `searchHome` says what it found)
    u.search = { at: s.tick + SEARCH_HOURS * TICKS_PER_HOUR, who: p.name, cell, foe };
    mark(s, u, { kind: 'search', cell, who: p.name });
    notify(s, `A scream from the tunnels below, then nothing. ${p.name} is gone, dragged off by something in the dark. A search party goes down after them with torches.`, true);
    return;
  }
  // the river floods the town's tunnels
  if (wetReached(u, r) && (u.floodUntil === undefined || s.tick >= u.floodUntil) && g.chance(FLOOD * odds)) {
    u.floodUntil = s.tick + FLOOD_HOURS * TICKS_PER_HOUR;
    findLine(u, 'The river flooded the tunnels.');
    tallyOf(u).floods++;
    mark(s, u, { kind: 'flood', cell: u.entries[0] ?? 0 });
    const lost: string[] = [];
    for (const p of work.slice(0, 2)) {
      if (g.chance(FLOOD_KILLS)) {
        lost.push(p.name);
        lostBelow(s, u, p, 'drowned when the underground river flooded the tunnels');
      } else {
        const hurt = maxHp(p) * 0.35;
        p.hp = Math.max(1, p.hp - hurt);
        woundPerson(s, p, hurt, 'bruise', g);
        closeCall(s, p, `${p.name} was nearly drowned when the river flooded the tunnels below.`); // (sim/closeCalls.ts)
      }
    }
    notify(s, `The underground river breaks into the town's tunnels and floods the shaft${lost.length ? `: ${lost.join(' and ')} drowned` : ''}. The miners are driven out, and nobody works the ways down until it drains.`, true);
  }
}

/** Whether the reached caves have cells the scouts haven't seen yet. */
function unscouted(u: Underdark, r: Uint8Array): boolean {
  for (let i = 0; i < r.length; i++) if (r[i] && u.seen[i] !== '1') return true;
  return false;
}

/** Whether the town's tunnels touch the river or the lake. */
function wetReached(u: Underdark, r: Uint8Array): boolean {
  for (let i = 0; i < r.length; i++) {
    if (!r[i]) continue;
    const { x, y } = udXY(i);
    for (const [dx, dy] of EIGHT) if (inside(x + dx, y + dy) && u.cells[udIndex(x + dx, y + dy)] === '~') return true;
  }
  return false;
}

/* ------------------------------------------------------------ the second pass: repair, the taken, the depths */

const ENEMY_NAME = (id: string) => ENEMIES[id]?.name ?? 'something from below';
/** The same, mid-sentence ("the lair of the Warden"). */
const enemyMid = (id: string) => ENEMY_NAME(id).replace(/^The /, 'the ');

/** A town whose ways down broke into a pocket off the caves' network (the first pass's hallway or mine could) gets
 *  its passage on: a cut straight from the nearest of its own ground to the nearest of the network. Told once. */
function reconnect(s: GameState, u: Underdark, r: Uint8Array): boolean {
  if (u.sites.some((x) => r[x.at])) return false;
  const net = caveNetwork(u);
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let i = 0; i < r.length; i++) {
    if (!r[i]) continue;
    const a = udXY(i);
    for (let j = 0; j < net.length; j++) {
      if (!net[j]) continue;
      const b = udXY(j);
      const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (d < bd) {
        bd = d;
        best = [i, j];
      }
    }
  }
  if (!best) return false;
  let p = udXY(best[0]);
  const q = udXY(best[1]);
  while (p.x !== q.x || p.y !== q.y) {
    if (p.x !== q.x) p = { x: p.x + Math.sign(q.x - p.x), y: p.y };
    else p = { x: p.x, y: p.y + Math.sign(q.y - p.y) };
    const i = udIndex(p.x, p.y);
    if (!isUnderOpen(u.cells[i])) u.cells = setAt(u.cells, i, 'd');
  }
  findLine(u, 'The miners found the way on into the caves.');
  notify(s, 'The cave the town broke into was a pocket, walled off by water. The miners cut on from it, and find the way into the caves proper.', true);
  return true;
}

/** A dark cell of the reached caves a few cells from one (where a thing drags its prey). */
function darkCellNear(u: Underdark, r: Uint8Array, from: number, g: Rng): number {
  const { x, y } = udXY(from);
  const near: number[] = [];
  for (let i = 0; i < r.length; i++) {
    if (!r[i] || ownCell(u.cells[i])) continue;
    const d = dist(i, x, y);
    if (d >= 4 && d <= 12) near.push(i);
  }
  return near.length ? near[g.int(0, near.length - 1)] : from;
}

/** The search party back: what it found of the one taken, and now and then the thing's den. */
function searchHome(s: GameState, u: Underdark, r: Uint8Array): void {
  const sr = u.search;
  if (!sr || s.tick < sr.at) return;
  u.search = undefined;
  const g = roll(s, 'search');
  const foe = ENEMY_NAME(sr.foe).toLowerCase();
  if (g.chance(SEARCH_DEN)) {
    const entry = mainEntry(s);
    if (entry) depositNear(s, buildingCentre(entry), { ...DEN_GOODS });
    tallyOf(u).goods += goodsCount(DEN_GOODS);
    const den = darkCellNear(u, r, sr.cell, g);
    see(u, den, 3);
    findLine(u, `The search party found the den of the ${foe} that took ${sr.who}.`);
    notify(s, `The search party comes back up with ${sr.who}'s lamp, and no ${sr.who}. They found the den of the ${foe} that took them, and what it had dragged there before: some gems, some old iron.`, true);
  } else {
    findLine(u, `The search for ${sr.who} found nothing.`);
    notify(s, `The search party comes back up out of the dark with torches burnt low. Of ${sr.who} they found only a boot, and the tracks of a ${foe}.`, true);
  }
}

/** Whether the ways down from a building are flooded: its miners driven out, nobody works it until it drains. */
export function underFlooded(s: GameState, b: Building): boolean {
  const u = s.underdark;
  return !!u && u.floodUntil !== undefined && s.tick < u.floodUntil && u.from.includes(b.id) && u.through !== undefined;
}

/* ------------------------------------------------------------ the deeper depths */

export interface DeepSite {
  id: number;
  kind: DeepSiteKind;
  name: string;
  x: number;
  y: number;
  at: number;
}
export interface DepthMap {
  n: number;
  cells: string;
  sites: DeepSite[];
  /** Where the stair from above comes down. */
  arrive: number;
}

const depthCache = new Map<string, DepthMap>();
/** A deeper depth's map, made from the seed (never stored: the same seed makes the same caves). Each depth has its own
 *  look: the Deep Roads straight-cut roads between square halls, the Sunless Sea a great black water with its shores,
 *  the Magma Deep rivers of fire through black rock. */
export function depthMap(seed: string | number, n: number): DepthMap {
  const key = `${seed}:${n}`;
  const had = depthCache.get(key);
  if (had) return had;
  const d = DEPTH_BY_N[n];
  const g = new Rng(hashSeed(`${seed}:under:depth:${n}`));
  const cells: string[] = new Array(UD_W * UD_H).fill('#');
  const set = (x: number, y: number, c: string) => {
    if (x >= 1 && y >= 1 && x <= UD_W - 2 && y <= UD_H - 2) cells[udIndex(x, y)] = c;
  };
  // the arrival, near a corner
  const ax = g.chance(0.5) ? g.int(4, 9) : g.int(UD_W - 10, UD_W - 5);
  const ay = g.int(4, 9);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(ax + dx, ay + dy, '.');
  const arrive = udIndex(ax, ay);
  cells[arrive] = 'e';
  if (d?.id === 'sea') {
    // a great black water, its shores round it
    const cx = UD_W / 2 + g.int(-3, 3);
    const cy = UD_H / 2 + g.int(0, 5);
    for (let y = 1; y < UD_H - 1; y++)
      for (let x = 1; x < UD_W - 1; x++) {
        const q = Math.hypot((x - cx) / 15, (y - cy) / 11) + Math.sin(x * 0.7 + y * 0.3) * 0.06;
        if (q < 1) set(x, y, '~');
        else if (q < 1.2) set(x, y, '.');
      }
  } else if (d?.id === 'magma') {
    // rivers of fire running down through the rock
    for (let k = 0; k < 3; k++) {
      let x = g.int(10, UD_W - 10);
      for (let y = 1; y < UD_H - 1; y++) {
        if (g.chance(0.4)) x = Math.max(3, Math.min(UD_W - 4, x + (g.chance(0.5) ? 1 : -1)));
        set(x, y, 'v');
        if (g.chance(0.5)) set(x + 1, y, 'v');
      }
    }
  }
  const kinds: { kind: DeepSiteKind; name: string }[] = [...(d?.sites ?? []), { kind: 'lair', name: d?.lairName ?? 'a lair' }, ...(n < UNDER_DEPTHS.length ? [{ kind: 'stair' as const, name: 'the stair down' }] : [])];
  const sites: DeepSite[] = [];
  for (const { kind, name } of kinds) {
    let cx = 0;
    let cy = 0;
    for (let tries = 0, gap = 12; tries < 160; tries++) {
      if (tries % 40 === 39) gap -= 2;
      cx = g.int(5, UD_W - 6);
      cy = g.int(5, UD_H - 6);
      if (Math.hypot(cx - ax, cy - ay) < 8) continue;
      // (the lair and the stair lie far from the arrival)
      if ((kind === 'lair' || kind === 'stair') && Math.hypot(cx - ax, cy - ay) < 22 && tries < 120) continue;
      if (cells[udIndex(cx, cy)] === '~' || cells[udIndex(cx, cy)] === 'v') continue;
      if (sites.some((o) => Math.hypot(o.x - cx, o.y - cy) < gap)) continue;
      break;
    }
    const ch = DEEP_SITE_CELL[kind];
    // (the roads' halls are square; elsewhere a rounded blob)
    const rw = kind === 'stair' ? 1 : d?.id === 'roads' ? g.int(2, 3) : g.int(2, 3);
    for (let dy = -rw; dy <= rw; dy++)
      for (let dx = -rw; dx <= rw; dx++) {
        if (d?.id !== 'roads' && Math.hypot(dx, dy) > rw + 0.4) continue;
        set(cx + dx, cy + dy, ch === 'x' ? '.' : ch);
      }
    set(cx, cy, ch);
    sites.push({ id: sites.length, kind, name, x: cx, y: cy, at: udIndex(cx, cy) });
  }
  // the roads and tunnels between: from the arrival to each place, the roads straight, the rest winding
  const straight = d?.id === 'roads';
  const mid = { x: -99, y: -99 };
  const order = [...sites].sort((a, b) => Math.hypot(a.x - ax, a.y - ay) - Math.hypot(b.x - ax, b.y - ay));
  const joined: { x: number; y: number }[] = [{ x: ax, y: ay }];
  for (const site of order) {
    const to = joined.reduce((a, b) => (Math.hypot(b.x - site.x, b.y - site.y) < Math.hypot(a.x - site.x, a.y - site.y) ? b : a));
    if (straight) {
      // (a road: along, then down, two cells wide)
      let x = to.x;
      let y = to.y;
      while (x !== site.x) {
        x += Math.sign(site.x - x);
        for (const yy of [y, y + 1]) if (cells[udIndex(x, Math.min(UD_H - 2, yy))] === '#') set(x, yy, '.');
      }
      while (y !== site.y) {
        y += Math.sign(site.y - y);
        for (const xx of [x, x + 1]) if (cells[udIndex(Math.min(UD_W - 2, xx), y)] === '#') set(xx, y, '.');
      }
    } else tunnel(cells, g, { x: site.x, y: site.y }, to, mid);
    joined.push({ x: site.x, y: site.y });
  }
  for (let k = 0; k < 5; k++) {
    const from = g.pick(sites);
    tunnel(cells, g, { x: from.x, y: from.y }, { x: g.int(2, UD_W - 3), y: g.int(2, UD_H - 3) }, mid, g.int(6, 12));
  }
  // (each place's own cell stays its own, whatever a tunnel made of it)
  for (const x of sites) cells[x.at] = DEEP_SITE_CELL[x.kind];
  const out: DepthMap = { n, cells: cells.join(''), sites, arrive };
  depthCache.set(key, out);
  return out;
}

/** The open ground of a depth joined to its arrival. */
function depthReached(m: DepthMap): Uint8Array {
  const out = new Uint8Array(m.cells.length);
  const q = [m.arrive];
  out[m.arrive] = 1;
  for (let k = 0; k < q.length; k++) {
    const { x, y } = udXY(q[k]);
    for (const [dx, dy] of FOUR) {
      if (!inside(x + dx, y + dy)) continue;
      const j = udIndex(x + dx, y + dy);
      if (!out[j] && isUnderOpen(m.cells[j])) {
        out[j] = 1;
        q.push(j);
      }
    }
  }
  return out;
}

/** Open the next depth down: told, its arrival seen. */
function openDepth(s: GameState, u: Underdark, n: number): void {
  const d = DEPTH_BY_N[n];
  if (!d) return;
  const m = depthMap(s.seed, n);
  u.deeps ??= [];
  u.deeps[n - 1] = { seen: '0'.repeat(UD_W * UD_H), found: [], opened: s.tick };
  u.depth = n;
  seeDeep(u.deeps[n - 1], m.arrive, 2);
  findLine(u, `Found the way down to ${d.name}.`);
  notify(s, d.opened, true);
}

function seeDeep(ds: DeepState, i: number, r: number): void {
  const { x, y } = udXY(i);
  let seen = ds.seen;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inside(x + dx, y + dy) && seen[udIndex(x + dx, y + dy)] !== '1') seen = setAt(seen, udIndex(x + dx, y + dy), '1');
  ds.seen = seen;
}

/** Each hour: the scouts seek the stair under the ruins (until the Deep Roads are open), explore the depths opened
 *  (losing one of them now and then: the deeper, the likelier), find their places, and take the stair on down once
 *  a depth's dweller is slain. */
function depthsHourly(s: GameState, u: Underdark, r: Uint8Array): void {
  const depth = u.depth ?? 0;
  if (s.people.length < DEEP_PEOPLE) return;
  if (depth === 0) {
    const ruins = u.sites.find((x) => x.kind === 'ruins' && u.found.includes(x.id) && r[x.at]);
    if (!ruins) return;
    u.descend = (u.descend ?? 0) + 1;
    if (u.descend >= DESCEND_HOURS) openDepth(s, u, 1);
    return;
  }
  for (let n = 1; n <= depth; n++) {
    const ds = u.deeps?.[n - 1];
    const d = DEPTH_BY_N[n];
    if (!ds || !d) continue;
    const m = depthMap(s.seed, n);
    const dr = depthReached(m);
    let left = d.explore;
    let unseen = false;
    const q = [m.arrive];
    const done = new Uint8Array(m.cells.length);
    done[m.arrive] = 1;
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      if (ds.seen[i] !== '1') {
        if (left > 0) {
          seeDeep(ds, i, 1);
          left--;
        } else unseen = true;
      }
      const { x, y } = udXY(i);
      for (const [dx, dy] of FOUR) {
        if (!inside(x + dx, y + dy)) continue;
        const j = udIndex(x + dx, y + dy);
        if (!done[j] && dr[j]) {
          done[j] = 1;
          q.push(j);
        }
      }
    }
    for (const site of m.sites) if (!ds.found.includes(site.id) && ds.seen[site.at] === '1') foundDeep(s, u, n, site);
    // (a scout lost, while there's still dark to scout)
    if (unseen && left <= 0) {
      const g = roll(s, 'scout', n);
      if (g.chance(d.lost)) {
        const pool = s.people.filter((p) => p.id !== s.mainId && p.away === null && !p.downed && !isChild(p));
        if (pool.length) {
          const p = pool[g.int(0, pool.length - 1)];
          findLine(u, `${p.name} was lost in ${d.name}.`);
          mark(s, u, { kind: 'lost', cell: m.arrive, depth: n, who: p.name });
          lostBelow(s, u, p, `was lost scouting ${d.name}`);
          notify(s, `A scout's rope comes back up cut. ${p.name}, scouting ${d.name}, will not be coming home.`, true);
        }
      }
    }
  }
  // the stair on down, once the dweller that guards it is slain
  const last = u.deeps?.[depth - 1];
  if (last && last.slain !== undefined && depth < UNDER_DEPTHS.length) {
    const m = depthMap(s.seed, depth);
    const stair = m.sites.find((x) => x.kind === 'stair');
    if (stair && last.found.includes(stair.id)) openDepth(s, u, depth + 1);
  }
}

const DEEP_FOUND: Record<DeepSiteKind, (n: string, d: string) => string> = {
  hall: (n, d) => `Scouts in ${d} find ${n}: a hall of the road-builders, its doors broken in. They bring back old coins, and carvings nobody above can read.`,
  forge: (n, d) => `Scouts in ${d} find ${n}: forges gone cold, and ore heaped round them for the taking.`,
  shore: (n, d) => `Scouts on ${d} find ${n}, where blind white fish crowd the shallows. Pearls lie among the stones.`,
  grotto: (n, d) => `Scouts in ${d} find ${n}, its rock shot through with crystal and silver.`,
  vein: (n, d) => `Scouts in ${d} find ${n}: gold, in the hot rock, enough to make a king weep.`,
  hold: (n) => `Scouts at the bottom of the world find ${n} of the First Delvers: gates as tall as a house, halls of gold, and its dead still at their posts. They come back up laden.`,
  lair: (n, d) => `Scouts in ${d} come on ${n}, and what sleeps there. They do not stay to look.`,
  stair: (_n, d) => `Scouts in ${d} find a stair going on down, behind the lair.`,
};

function foundDeep(s: GameState, u: Underdark, n: number, site: DeepSite): void {
  const ds = u.deeps![n - 1];
  const d = DEPTH_BY_N[n];
  ds.found.push(site.id);
  findLine(u, `Found ${site.name}.`);
  notify(s, DEEP_FOUND[site.kind](site.name, d.name), true);
  const once = DEEP_ONCE[site.kind];
  if (once) {
    s.coins = (s.coins ?? 0) + once.coins;
    earn(s, 'goods', once.coins);
    const topic = s.research.queue[0];
    if (topic) s.research.progress[topic] = (s.research.progress[topic] ?? 0) + once.study;
    const entry = mainEntry(s);
    if (entry) depositNear(s, buildingCentre(entry), { ...once.goods });
    const tl = tallyOf(u);
    tl.coins += once.coins;
    tl.goods += goodsCount(once.goods);
  }
}

/** Each dawn: the deeper places found give up the shaft, and the Heartvein once the Wyrm is slain. */
function deepDawn(s: GameState, u: Underdark): void {
  const entry = mainEntry(s);
  if (!entry || !u.deeps?.length) return;
  const got: Stock = {};
  u.deeps.forEach((ds, k) => {
    if (!ds) return;
    const m = depthMap(s.seed, k + 1);
    for (const site of m.sites) {
      const y = DEEP_YIELD[site.kind];
      if (!y || !ds.found.includes(site.id)) continue;
      for (const [mat, n] of Object.entries(y) as [Material, number][]) addStock(got, mat, n);
    }
    if (k + 1 === UNDER_DEPTHS.length && ds.slain !== undefined) for (const [mat, n] of Object.entries(HEARTVEIN) as [Material, number][]) addStock(got, mat, n);
  });
  if (!Object.keys(got).length) return;
  depositNear(s, buildingCentre(entry), got);
  tallyOf(u).goods += goodsCount(got);
}

/** A party home from a trip below: from a dweller's lair, cleared, the dweller is slain and its hoard comes up. */
export function underHome(s: GameState, dest: string, cleared: boolean, at: { x: number; y: number }): void {
  const u = s.underdark;
  const deep = parseDeepDest(dest);
  if (!u || !deep || !cleared) return;
  const ds = u.deeps?.[deep.n - 1];
  const d = DEPTH_BY_N[deep.n];
  const site = depthMap(s.seed, deep.n).sites[deep.site];
  if (!ds || !d || !site || site.kind !== 'lair' || ds.slain !== undefined) return;
  ds.slain = s.tick;
  depositNear(s, at, { ...d.hoard });
  tallyOf(u).goods += goodsCount(d.hoard);
  mark(s, u, { kind: 'slain', cell: site.at, depth: deep.n, foe: d.dweller });
  findLine(u, `${ENEMY_NAME(d.dweller)} was slain.`);
  notify(s, `${d.slain} The party brings up its hoard: ${Object.entries(d.hoard).map(([m, n]) => `${n} ${m.replace(/_/g, ' ')}`).join(', ')}.`, true);
}

/* ------------------------------------------------------------ the under-village */

/** A big enough town, with the fungus and the water found below, sends some of its people down to found a village
 *  there (once). */
function underVillage(s: GameState, u: Underdark): void {
  if (u.village !== undefined || calendar(s.tick).day < UNDER_VILLAGE_DAY) return;
  const dwarves = s.origin === 'dwarves';
  if (s.people.length < (dwarves ? UNDER_VILLAGE_PEOPLE_DWARVES : UNDER_VILLAGE_PEOPLE)) return;
  const has = (k: UnderSiteKind) => u.sites.some((x) => x.kind === k && u.found.includes(x.id));
  if (!has('fungus') || !has('lake')) return;
  const entry = mainEntry(s);
  if (!entry) return;
  const g = roll(s, 'village');
  const plan = pickSettlers(s, g);
  if (!plan) return;
  const ids = dwarves ? plan.ids : plan.ids.slice(0, Math.max(3, plan.ids.length));
  const r = footprint(entry);
  const v = foundVillage(s, { ids, leader: plan.leader.id, x: r.x + Math.floor(r.w / 2), y: r.y + r.h, name: g.pick(UNDER_VILLAGE_NAMES) }, dwarves ? 80 : 60, g);
  if (!v) return;
  v.below = true;
  v.plots = [];
  u.village = v.id;
  findLine(u, `${v.name} was founded below.`);
  notify(s, `${v.name} is founded in the Underdark, by the fungus and the black water: a village below the town.`, true);
}

/* ------------------------------------------------------------ trips below */

const UNDER_DEST = 'under:';
export const isUnderDest = (id: string) => id.startsWith(UNDER_DEST);

/** A trip to a place found below (a party sent the usual way: the Trips tab, or the town's own). */
export function underDestination(s: GameState, id: string): Destination | undefined {
  const u = s.underdark;
  if (!u || !isUnderDest(id)) return undefined;
  const deep = parseDeepDest(id);
  if (deep) return deepDestination(s, u, deep.n, deep.site);
  const site = u.sites.find((x) => x.id === Number(id.slice(UNDER_DEST.length)));
  if (!site || !u.found.includes(site.id)) return undefined;
  if (site.kind === 'town') return fallenTownDestination(u, site);
  const trip = SITE_TRIPS[site.kind];
  if (!trip) return undefined;
  return {
    id: `${UNDER_DEST}${site.id}`,
    name: `${cap(site.name.replace(/^the /, ''))} (below)`,
    type: trip.type,
    outSeconds: TRIP_OUT_SECONDS,
    workSeconds: TRIP_WORK_SECONDS,
    secondsPerUnit: trip.secondsPerUnit,
    loot: trip.loot,
    threats: trip.threats,
    encounters: { arrival: trip.arrival, ambush: 0.25, groups: [{ enemies: trip.foes, weight: 1 }] },
    recommendedParty: site.kind === 'magma' || site.kind === 'ruins' ? 5 : 3,
    scenery: 'cave',
    description: `In the Underdark. ${trip.description}`,
  };
}
export const underDestinations = (s: GameState): Destination[] => {
  const u = s.underdark;
  if (!u) return [];
  const ids = u.sites.map((x) => `${UNDER_DEST}${x.id}`);
  (u.deeps ?? []).forEach((ds, k) => {
    if (ds) for (const id of ds.found) ids.push(`${UNDER_DEST}d${k + 1}:${id}`);
  });
  return ids.map((id) => underDestination(s, id)).filter((d): d is Destination => !!d);
};

/** A deeper place's destination id, read: `under:d<depth>:<site>`. */
export function parseDeepDest(id: string): { n: number; site: number } | null {
  const m = /^under:d(\d+):(\d+)$/.exec(id);
  return m ? { n: Number(m[1]), site: Number(m[2]) } : null;
}

/** A trip to a place found in a deeper depth: its own foes and loot, a longer walk down; the dweller's lair a
 *  fight with the dweller itself (until it's slain). */
function deepDestination(s: GameState, u: Underdark, n: number, siteId: number): Destination | undefined {
  const ds = u.deeps?.[n - 1];
  const d = DEPTH_BY_N[n];
  if (!ds || !d || !ds.found.includes(siteId)) return undefined;
  const site = depthMap(s.seed, n).sites[siteId];
  if (!site) return undefined;
  const base = { id: `${UNDER_DEST}d${n}:${siteId}`, outSeconds: TRIP_OUT_SECONDS + DEEP_TRIP_OUT * n, workSeconds: TRIP_WORK_SECONDS, scenery: 'cave' as const };
  if (site.kind === 'lair') {
    if (ds.slain !== undefined) return undefined;
    return {
      ...base,
      name: `${cap(site.name.replace(/^the /, ''))} (${d.name.replace(/^the /, '')})`,
      type: 'clear',
      secondsPerUnit: 12,
      loot: { gold: 2 },
      threats: `${ENEMY_NAME(d.dweller)}, and what serves it`,
      encounters: { arrival: 1, ambush: 0.3, groups: [{ enemies: { [d.dweller]: 1, ...d.lairFoes }, weight: 1 }] },
      recommendedParty: 6,
      description: `Deep below, in ${d.name}. ${ENEMY_NAME(d.dweller)} guards the way on down. Slay it, and its hoard is the town's.`,
    };
  }
  const trip = DEEP_TRIPS[site.kind];
  if (!trip) return undefined;
  return {
    ...base,
    name: `${cap(site.name.replace(/^the /, ''))} (${d.name.replace(/^the /, '')})`,
    type: trip.type,
    secondsPerUnit: trip.secondsPerUnit,
    loot: trip.loot,
    threats: trip.threats,
    encounters: { arrival: trip.arrival, ambush: 0.3, groups: [{ enemies: trip.foes, weight: 1 }] },
    recommendedParty: 3 + n,
    description: `Deep below, in ${d.name}. ${trip.description}`,
  };
}

/** A fallen cave town: its ruins, picked over by what lives in the dark now. */
function fallenTownDestination(u: Underdark, site: UnderSite): Destination | undefined {
  const t = u.towns.find((o) => o.site === site.id);
  if (!t || t.stance !== 'fallen') return undefined;
  const d = peopleOf(t);
  const loot: Stock = {};
  for (const [m, n] of Object.entries(d.goods) as [Material, number][]) loot[m] = Math.ceil(n * 1.5);
  return {
    id: `${UNDER_DEST}${site.id}`,
    name: `The ruins of ${d.name.replace(/^the /, '')} (below)`,
    type: 'salvage',
    outSeconds: TRIP_OUT_SECONDS,
    workSeconds: TRIP_WORK_SECONDS,
    secondsPerUnit: 8,
    loot,
    threats: 'Whatever took it, and the scavengers since',
    encounters: { arrival: 0.5, ambush: 0.3, groups: [{ enemies: { ghoul: 2, dire_rat: 2 }, weight: 1 }] },
    recommendedParty: 4,
    scenery: 'cave',
    description: `In the Underdark. The town of ${d.kind} that was ${d.name}, its lamps out and its doors broken. What they left is still there, and so is what killed them.`,
  };
}

/* ------------------------------------------------------------ seen */

/** What a place below gives and what lives there, in a few words each (the tap card, the Trips section). */
const SITE_WORDS: Record<string, { gives: string; lives: string }> = {
  fungus: { gives: 'cave mushrooms and glowmoss each dawn', lives: 'giant spiders and dire rats' },
  lake: { gives: 'blind cave fish each dawn', lives: 'black eels, giant toads, and something bigger' },
  crystal: { gives: 'a crystal each dawn', lives: 'crystal spiders and jewel beetles' },
  magma: { gives: 'sulphur and gold, to a party that braves it', lives: 'black drakes and boulder beasts' },
  ruins: { gives: 'old coins and carvings (once), and the stair down', lives: 'the dead who kept it, and a troll' },
  hall: { gives: 'old coins and lore (once); salvage', lives: 'ratfolk and a bugbear' },
  forge: { gives: 'iron ore and coal each dawn', lives: 'iron beetles' },
  shore: { gives: 'cave fish and pearls each dawn', lives: 'black eels and giant toads' },
  grotto: { gives: 'gems and silver each dawn', lives: 'crystal spiders' },
  vein: { gives: 'gold and rare minerals each dawn', lives: 'fire spiders and magma slimes' },
  hold: { gives: 'the First Delvers\' gold (once); salvage', lives: 'their dead, still on guard' },
  stair: { gives: 'the way on down, behind the lair', lives: 'nothing that lets you pass' },
};

export interface UnderTownSeen {
  id: string;
  name: string;
  kind: string;
  stance: CaveStance;
  attitude: number;
  troops: number;
  feud: string | null;
  goods: string;
  price: number;
  mats: Material[];
}

export interface UnderDepthSeen {
  n: number;
  name: string;
  blurb: string;
  /** Places found there, its dweller's name and whether it's slain, how much of it is scouted. */
  found: { name: string; kind: string; gives: string; mats: Material[] }[];
  dweller: string;
  slain: boolean;
  scouted: number;
}

export interface UnderSummary {
  through: boolean;
  dug: number;
  found: { name: string; kind: UnderSiteKind; gives: string; mats: Material[] }[];
  towns: UnderTownSeen[];
  finds: string[];
  /** The trips below a party may take (the Trips tab's cards). */
  dests: Destination[];
  /** The deeper depths opened, and the hours left seeking the first stair (once the ruins are found). */
  depths: UnderDepthSeen[];
  seeking: number | null;
  tally: UnderTally;
  village: { name: string; pop: number } | null;
  flooded: boolean;
  searching: string | null;
}

const townSeen = (t: CaveTown): UnderTownSeen => {
  const d = peopleOf(t);
  return { id: t.people, name: d.name, kind: d.kind, stance: t.stance, attitude: Math.round(t.attitude), troops: Math.round(t.troops), feud: t.feud ? CAVE_PEOPLE_BY_ID[t.feud].name : null, goods: d.goodsWords, price: d.price, mats: Object.keys(d.goods) as Material[] };
};

/** What the menus show of the Underdark (known towns only). */
export function underSummary(s: GameState): UnderSummary | null {
  const u = s.underdark;
  if (!u) return null;
  const ruinsFound = u.sites.some((x) => x.kind === 'ruins' && u.found.includes(x.id));
  const v = u.village !== undefined ? villageById(s, u.village) : undefined;
  return {
    through: u.through !== undefined,
    dug: u.dug,
    found: u.sites.filter((x) => u.found.includes(x.id) && x.kind !== 'town').map((x) => ({ name: x.name, kind: x.kind, gives: SITE_WORDS[x.kind]?.gives ?? '', mats: Object.keys(SITE_YIELD[x.kind] ?? SITE_TRIPS[x.kind]?.loot ?? {}) as Material[] })),
    towns: u.towns.filter((t) => t.known).map(townSeen),
    finds: [...u.finds],
    dests: underDestinations(s),
    depths: (u.deeps ?? []).map((ds, k) => {
      const d = DEPTH_BY_N[k + 1];
      const m = depthMap(s.seed, k + 1);
      const r = depthReached(m);
      let open = 0;
      let seen = 0;
      for (let i = 0; i < r.length; i++)
        if (r[i]) {
          open++;
          if (ds?.seen[i] === '1') seen++;
        }
      return {
        n: k + 1,
        name: d.name,
        blurb: d.blurb,
        found: m.sites.filter((x) => ds?.found.includes(x.id) && x.kind !== 'stair').map((x) => ({ name: x.name, kind: x.kind, gives: x.kind === 'lair' ? `the lair of ${enemyMid(d.dweller)}` : SITE_WORDS[x.kind]?.gives ?? '', mats: Object.keys(x.kind === 'lair' ? d.hoard : DEEP_YIELD[x.kind] ?? DEEP_ONCE[x.kind]?.goods ?? {}) as Material[] })),
        dweller: ENEMY_NAME(d.dweller),
        slain: ds?.slain !== undefined,
        scouted: open ? Math.round((seen / open) * 100) : 100,
      };
    }),
    // (the hours left seeking the stair; 0 while the town is too small to send scouts down it)
    seeking: (u.depth ?? 0) === 0 && ruinsFound ? (s.people.length < DEEP_PEOPLE ? 0 : Math.max(1, DESCEND_HOURS - (u.descend ?? 0))) : null,
    tally: { ...tallyOf(u) },
    village: v ? { name: v.name, pop: v.pop } : null,
    flooded: u.floodUntil !== undefined && s.tick < u.floodUntil,
    searching: u.search && s.tick < u.search.at ? u.search.who : null,
  };
}

/** A person drawn below (the view's paper dolls). */
export interface UnderFolk {
  id: number;
  look: Person['look'];
  gear: Person['gear'];
}
const folkOf = (p: Person): UnderFolk => ({ id: p.id, look: p.look, gear: p.gear });

export interface UnderSiteSeen {
  id: number;
  name: string;
  kind: string;
  at: number;
  x: number;
  y: number;
  /** The tap card's lines: what it gives, what lives there. */
  gives: string;
  lives: string;
  /** A cave town's people, stance, warriors, and the cell of the town it's feuding with. */
  people?: string;
  stance?: CaveStance;
  troops?: number;
  feudAt?: number;
  /** A dweller's lair: the dweller (an enemy id) and whether it's slain. */
  dweller?: string;
  slain?: boolean;
}

export interface UnderView {
  w: number;
  h: number;
  /** Which depth is shown (0: the upper caves) and the depths there are to look at. */
  depth: number;
  depths: { n: number; name: string }[];
  name: string;
  /** The cells, with those not yet seen as `?` (and the open ground beyond what's seen as `,`, drawn as a faint
   *  outline in the dark). */
  cells: string;
  /** The town's ways down (the upper caves) or the stair's foot (a deeper depth), and which building each way down is. */
  entries: number[];
  ways: { cell: number; def: string }[];
  sites: UnderSiteSeen[];
  /** Miners at work below (and some of them, to draw), and whether the river's in flood. */
  miners: number;
  workers: UnderFolk[];
  flooded: boolean;
  through: boolean;
  finds: string[];
  /** What's happened here lately (for the view to show), the tick, and the hour (the shaft's daylight). */
  marks: UnderMark[];
  tick: number;
  hour: number;
  /** A raid up the shaft from below going on now. */
  rising: boolean;
  /** The under-village: where it stands below, and some of its folk. */
  village: { name: string; cell: number; pop: number; folk: UnderFolk[] } | null;
  /** The creatures that roam this depth (enemy ids, for the lurkers in the dark). */
  creatures: string[];
}

const UNDER_RAID_KINDS = new Set(['under_dark', 'under_roads', 'under_sea', 'under_magma', ...CAVE_PEOPLES.map((p) => p.raid)]);
const ROAMERS: Record<number, string[]> = {
  0: ['giant_spider', 'dire_rat', 'cave_bat', 'mole', 'jewel_beetle'],
  1: ['ratfolk', 'iron_beetle', 'bugbear', 'rock_worm', 'giant_bat'],
  2: ['black_eel', 'giant_toad', 'abyss_naga', 'gloomfish', 'drift_jelly'],
  3: ['fire_spider', 'magma_slime', 'ember_sprite', 'hell_hound', 'fire_bat'],
};

/** Where the under-village stands below: the open ground nearest between the fungus and the water. */
function villageCell(u: Underdark, r: Uint8Array): number {
  const f = u.sites.find((x) => x.kind === 'fungus' && u.found.includes(x.id));
  const l = u.sites.find((x) => x.kind === 'lake' && u.found.includes(x.id));
  const tx = f && l ? (f.x + l.x) / 2 : (f ?? l ?? u.sites[0]).x;
  const ty = f && l ? (f.y + l.y) / 2 : (f ?? l ?? u.sites[0]).y;
  let best = u.entries[0] ?? 0;
  let bd = Infinity;
  for (let i = 0; i < r.length; i++) {
    if (!r[i] || !natural(u.cells[i]) || u.cells[i] === 't') continue;
    const d = dist(i, tx, ty);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** The Underdark view's picture (while it's watched): the upper caves, or a deeper depth. */
export function underView(s: GameState): UnderView | null {
  const u = s.underdark;
  if (!u || !s.watchingUnder) return null;
  const opened = (u.deeps ?? []).map((ds, k) => (ds ? k + 1 : 0)).filter((n) => n > 0);
  const depth = opened.includes(s.watchingUnderDepth ?? 0) ? (s.watchingUnderDepth ?? 0) : 0;
  const depths = [{ n: 0, name: 'the upper caves' }, ...opened.map((n) => ({ n, name: DEPTH_BY_N[n].name }))];
  const recent = (u.marks ?? []).filter((m) => s.tick - m.at < MARK_HOURS * TICKS_PER_HOUR && (m.depth ?? 0) === depth);
  const raid = s.raid;
  const rising = !!raid && UNDER_RAID_KINDS.has(raid.kind);
  const work = below(s, u);
  const base = { w: UD_W, h: UD_H, depth, depths, miners: work.length, workers: work.slice(0, 6).map(folkOf), flooded: u.floodUntil !== undefined && s.tick < u.floodUntil, through: u.through !== undefined, finds: u.finds.slice(-5), marks: recent, tick: s.tick, hour: calendar(s.tick).hour, rising };
  const outline = (cells: string, seen: string, net: Uint8Array) => {
    let out = '';
    for (let i = 0; i < cells.length; i++) out += seen[i] === '1' ? cells[i] : net[i] ? ',' : '?';
    return out;
  };
  if (depth > 0) {
    const ds = u.deeps![depth - 1];
    const d = DEPTH_BY_N[depth];
    const m = depthMap(s.seed, depth);
    return {
      ...base,
      name: d.name,
      cells: outline(m.cells, ds.seen, depthReached(m)),
      entries: [m.arrive],
      ways: [],
      sites: m.sites.filter((x) => ds.found.includes(x.id)).map((x) => ({
        id: x.id,
        name: x.kind === 'stair' ? `The stair down` : x.name,
        kind: x.kind,
        at: x.at,
        x: x.x,
        y: x.y,
        gives: x.kind === 'lair' ? (ds.slain !== undefined ? 'nothing now: its dweller is dead, its hoard taken' : `a hoard, to the party that slays ${enemyMid(d.dweller)}`) : SITE_WORDS[x.kind]?.gives ?? '',
        lives: x.kind === 'lair' ? (ds.slain !== undefined ? 'nothing; the bones of its dweller' : ENEMY_NAME(d.dweller)) : DEEP_TRIPS[x.kind]?.threats ?? SITE_WORDS[x.kind]?.lives ?? '',
        ...(x.kind === 'lair' ? { dweller: d.dweller, slain: ds.slain !== undefined } : {}),
      })),
      workers: [],
      miners: 0,
      village: null,
      creatures: ROAMERS[depth] ?? [],
    };
  }
  const r = reached(u);
  const v = u.village !== undefined ? villageById(s, u.village) : undefined;
  return {
    ...base,
    name: 'the Underdark',
    cells: outline(u.cells, u.seen, caveNetwork(u)),
    entries: [...u.entries],
    ways: entryBuildings(s)
      .filter((b) => u.from.includes(b.id))
      .map((b) => {
        const f = footprint(b);
        let cell = underCellOf(s, f.x + f.w / 2, f.y + f.h / 2);
        if (!u.entries.includes(cell)) cell = u.entries.reduce((a, e) => (dist(e, udXY(cell).x, udXY(cell).y) < dist(a, udXY(cell).x, udXY(cell).y) ? e : a), u.entries[0]);
        return { cell, def: b.def };
      }),
    sites: u.sites
      .filter((x) => u.found.includes(x.id))
      .map((x) => {
        const t = x.people ? caveTownById(s, x.people) : undefined;
        const foe = t?.feud ? caveTownById(s, t.feud) : undefined;
        const d = t ? peopleOf(t) : undefined;
        return {
          id: x.id,
          name: x.name,
          kind: x.kind,
          at: x.at,
          x: x.x,
          y: x.y,
          gives: d ? (t!.stance === 'fallen' ? 'nothing now: its ruins, to a party that will pick them over' : `${d.goodsWords} up the shaft, for ${d.price} coins, when they're friends`) : SITE_WORDS[x.kind]?.gives ?? '',
          lives: d ? (t!.stance === 'fallen' ? 'ghouls and rats, in the ruins' : `${d.kind}, ${Math.round(t!.troops)} warriors`) : SITE_WORDS[x.kind]?.lives ?? '',
          ...(t ? { people: t.people, stance: t.stance, troops: Math.round(t.troops), ...(foe && foe.stance !== 'fallen' ? { feudAt: u.sites[foe.site].at } : {}) } : {}),
        };
      }),
    village: v ? { name: v.name, cell: villageCell(u, r), pop: v.pop, folk: v.folk.slice(0, 5).map(folkOf) } : null,
    creatures: ROAMERS[0],
  };
}
