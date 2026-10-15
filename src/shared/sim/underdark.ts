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
  FLOOD_KILLS, GALLERY_MOST, GIFT_COINS, GIFT_WARMTH, isUnderOpen, NIGHT_FROM, NIGHT_TO, RISE_GAP_HOURS, RUIN_COINS, RUIN_STUDY, SITE_CLEAR, SITE_COUNTS, SITE_NAMES, SITE_SIZES, SITE_TRIPS,
  SITE_YIELD, SNUB, TAKEN, TRADE_WARMTH, TRIP_OUT_SECONDS, TRIP_WORK_SECONDS, UD_CAVE_IN, UD_CAVE_IN_KILLS, UD_H, UD_W, UNDER_ENTRIES, UNDER_VILLAGE_DAY, UNDER_VILLAGE_NAMES, UNDER_VILLAGE_PEOPLE,
  UNDER_VILLAGE_PEOPLE_DWARVES, type UnderCell, type UnderSiteKind,
} from '../data/underdark';
import type { Destination } from '../data/expeditions';
import type { Material, Stock } from '../data/materials';
import { RAID_KIND_BY_ID } from '../data/raids';
import { hashSeed, Rng } from '../rng';
import { buildingCentre, depositNear, footprint } from './buildings';
import { holdOf } from './castle';
import { killPerson } from './health';
import { woundPerson } from './injuries';
import { raidBudget, startRaid } from './raids';
import { askWays } from './telling';
import { foundVillage, pickSettlers } from './villages';
import { addStock, earn, maxHp, notify, type Building, type GameState, type Person, type Prompt } from './state';
import { calendar, paceDay, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

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

/** The nearest cave that was always there, from a cell. */
function nearestNatural(u: Underdark, from: number): number {
  const { x, y } = udXY(from);
  let best = -1;
  let bd = Infinity;
  for (let j = 0; j < u.cells.length; j++) {
    if (!natural(u.cells[j])) continue;
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

/** Whether the town's tunnels have reached the caves: told once. */
function checkThrough(s: GameState, u: Underdark): void {
  if (u.through !== undefined) return;
  const r = reached(u);
  for (let i = 0; i < r.length; i++)
    if (r[i] && natural(u.cells[i])) {
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
  if (g.chance(UD_CAVE_IN)) caveIn(s, p, g);
}

/** The roof comes down on someone cutting below: buried, or dragged out broken. */
export function caveIn(s: GameState, p: Person, g: Rng): void {
  findLine(s.underdark!, `The roof came down on ${p.name}.`);
  if (g.chance(UD_CAVE_IN_KILLS)) {
    killPerson(s, p, 'was buried in a cave-in below the town');
    notify(s, `The rock comes down in the tunnels below: ${p.name} is buried under it.`, true);
    return;
  }
  const hurt = maxHp(p) * 0.5;
  p.hp = Math.max(1, p.hp - hurt);
  woundPerson(s, p, hurt, 'fracture', g);
  notify(s, `The roof comes down in the tunnels below: ${p.name} is dug out with broken bones.`, true);
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
  const r = reached(u);
  explore(s, u, r);
  const hour = calendar(s.tick).hour;
  if (hour === 6) {
    underDawn(s, u, r);
    for (const t of u.towns) caveDay(s, u, t, r);
    feuds(s, u);
    underVillage(s, u);
  }
  if (isNight(hour) && paceDay(s.tick) >= DANGER_DAY && s.people.length >= DANGER_PEOPLE) night(s, u, r);
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
  if (Object.keys(got).length) depositNear(s, buildingCentre(entry), got);
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
      t.attitude = clamp(t.attitude + TRADE_WARMTH);
      findLine(u, `${cap(d.name)} traded ${d.goodsWords}.`);
      notify(s, `A train from ${d.name} comes up the shaft with ${d.goodsWords}, for ${d.price} coins.`, true);
    }
  }
  // an envoy
  if (!s.prompts.some((p) => p.ways?.system === 'underdark') && (t.envoyAt === undefined || day - t.envoyAt >= CAVE_ENVOY_DAYS)) {
    t.envoyAt = day;
    envoy(s, t);
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
function night(s: GameState, u: Underdark, r: Uint8Array): void {
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
    t.troops = Math.max(0, t.troops - 3);
    findLine(u, `${cap(peopleOf(t).name)} raided up the shaft.`);
    notify(s, `${cap(peopleOf(t).name)} come up out of the shaft in the night: ${kind.name.toLowerCase()}!`, true);
    return;
  }
  // what lives in the dark
  if (!s.raid && gapOk && g.chance(DARK_RISE)) {
    const kind = RAID_KIND_BY_ID.under_dark;
    if (kind && Object.keys(kind.enemies).length) {
      startRaid(s, kind, Math.max(6, raidBudget(s) * DARK_SHARE), g, buildingCentre(entry));
      u.rose = s.tick;
      findLine(u, 'Things came up out of the dark.');
      notify(s, 'Something comes up out of the Underdark in the night: things from the dark pour out of the shaft!', true);
      return;
    }
  }
  const work = below(s, u);
  // someone taken
  if (work.length && g.chance(TAKEN)) {
    const p = work[g.int(0, work.length - 1)];
    findLine(u, `${p.name} was taken in the dark.`);
    killPerson(s, p, 'was dragged off into the dark below the town');
    notify(s, `A scream from the tunnels below, then nothing. ${p.name} is gone, taken by something in the dark.`, true);
    return;
  }
  // the river floods the town's tunnels
  if (wetReached(u, r) && (u.floodUntil === undefined || s.tick >= u.floodUntil) && g.chance(FLOOD)) {
    u.floodUntil = s.tick + FLOOD_HOURS * TICKS_PER_HOUR;
    findLine(u, 'The river flooded the tunnels.');
    const lost: string[] = [];
    for (const p of work.slice(0, 2)) {
      if (g.chance(FLOOD_KILLS)) {
        lost.push(p.name);
        killPerson(s, p, 'drowned when the underground river flooded the tunnels');
      } else {
        const hurt = maxHp(p) * 0.35;
        p.hp = Math.max(1, p.hp - hurt);
        woundPerson(s, p, hurt, 'bruise', g);
      }
    }
    notify(s, `The underground river breaks into the town's tunnels and floods the shaft${lost.length ? `: ${lost.join(' and ')} drowned` : ''}. The digging stops until it drains.`, true);
  }
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
  const site = u.sites.find((x) => x.id === Number(id.slice(UNDER_DEST.length)));
  if (!site || !u.found.includes(site.id)) return undefined;
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
export const underDestinations = (s: GameState): Destination[] => (s.underdark?.sites ?? []).map((x) => underDestination(s, `${UNDER_DEST}${x.id}`)).filter((d): d is Destination => !!d);

/* ------------------------------------------------------------ seen */

export interface UnderSummary {
  through: boolean;
  dug: number;
  found: { name: string; kind: UnderSiteKind }[];
  towns: { id: string; name: string; kind: string; stance: CaveStance; attitude: number; troops: number; feud: string | null }[];
  finds: string[];
  /** The trips below a party may take (the Trips tab's cards). */
  dests: Destination[];
}

/** What the menus show of the Underdark (known towns only). */
export function underSummary(s: GameState): UnderSummary | null {
  const u = s.underdark;
  if (!u) return null;
  return {
    through: u.through !== undefined,
    dug: u.dug,
    found: u.sites.filter((x) => u.found.includes(x.id)).map((x) => ({ name: x.name, kind: x.kind })),
    towns: u.towns.filter((t) => t.known).map((t) => ({ id: t.people, name: peopleOf(t).name, kind: peopleOf(t).kind, stance: t.stance, attitude: Math.round(t.attitude), troops: Math.round(t.troops), feud: t.feud ? CAVE_PEOPLE_BY_ID[t.feud].name : null })),
    finds: [...u.finds],
    dests: underDestinations(s),
  };
}

export interface UnderView {
  w: number;
  h: number;
  /** The cells, with those not yet seen as `?`. */
  cells: string;
  entries: number[];
  sites: { name: string; kind: UnderSiteKind; at: number; x: number; y: number; stance?: CaveStance }[];
  /** Miners at work below, and whether the river's in flood. */
  miners: number;
  flooded: boolean;
  through: boolean;
  finds: string[];
}

/** The Underdark view's picture (while it's watched). */
export function underView(s: GameState): UnderView | null {
  const u = s.underdark;
  if (!u || !s.watchingUnder) return null;
  let cells = '';
  for (let i = 0; i < u.cells.length; i++) cells += u.seen[i] === '1' ? u.cells[i] : '?';
  return {
    w: UD_W,
    h: UD_H,
    cells,
    entries: [...u.entries],
    sites: u.sites.filter((x) => u.found.includes(x.id)).map((x) => ({ name: x.name, kind: x.kind, at: x.at, x: x.x, y: x.y, ...(x.people ? { stance: caveTownById(s, x.people)?.stance } : {}) })),
    miners: below(s, u).length,
    flooded: u.floodUntil !== undefined && s.tick < u.floodUntil,
    through: u.through !== undefined,
    finds: u.finds.slice(-5),
  };
}
