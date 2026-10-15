// Seafaring and islands (data/seafaring.ts has the numbers; the owner's design: the sea a real place). A coastal town's
// harbour shelters and berths its fleet and lands a bigger catch; the shoals move with the seasons (inshore for the
// small boats, the deep for the big ships); a squall at home can sink a fishing boat and drown the men in her; a sea
// monster hunts the moored fleet by night; ships wear with age; wrecks wash up timber and castaways; pirate crews land
// on the beach; and a prosperous town sends settlers to an isle, a colony that works like a daughter village
// (sim/villages.ts) but is reached by ship (its goods sail home every few days, at the sea's risk). The merfolk have
// the boats from the start, parley with the deep, and the isles fall to them first. Autopilot only (the tests'
// plainGame keeps its fishing as it was), on a side stream of its own ('sea').

import { BOATS, ISLANDS, type BoatKind } from '../data/boats';
import { BUILDING_BY_ID } from '../data/buildings';
import { eraReached } from '../data/eras';
import {
  AGE_FROM_DAYS, AGE_WEAR, CLAIM_DAYS, COLONISTS, COLONY_BREAK_AT, COLONY_FROM_DAY, COLONY_FROM_DAY_MERFOLK, COLONY_GAP_DAYS, COLONY_GROWTH, COLONY_ISLES, COLONY_LOYALTY_START, COLONY_MAKES_PER_HEAD, COLONY_MOST, COLONY_MOST_FOLK, COLONY_MOST_MERFOLK, COLONY_PEOPLE, COLONY_PEOPLE_MERFOLK,
  COLONY_PIRATES_DAILY, COLONY_RUN_DAYS, COLONY_RUN_STORM, DRIFT_DAILY, FISHER_DROWN, FISHER_DROWN_SWIMMER, FISHERS_PER_BOAT, HARBOUR_BERTHS, HARBOUR_CATCH, HARBOUR_SHELTER, MONSTER_FROM_DAY, MONSTER_HARBOUR, MONSTER_HULL, MONSTER_NAMES, MONSTER_NIGHTLY, MONSTER_PARLEY,
  PARLEY_CATCH, PARLEY_DAILY, PIRATE_BUDGET, PIRATE_FROM_DAY, PIRATE_GAP, ROT_AT, SEA_RAID_KIND, SHOALS, SINK_CHANCE, SINK_HULL, WASH_LOOT, WRECK_CASTAWAY, WRECK_WASH_CHANCE, WRONG_GROUND,
} from '../data/seafaring';
import { FLEET_MOST } from '../data/boats';
import { hashSeed, Rng } from '../rng';
import { spawnBand } from './bands';
import { buildingCentre, depositNear, footprint, depthOf, footprints, placeBlueprint, totalStock } from './buildings';
import { killPerson } from './health';
import { CELL, groundAt, isOpen, spiralSpot, touchesWater, wet } from './land';
import { raidBudget, startRaid } from './raids';
import { seaTown } from './sea';
import { isChild } from './social';
import { peopleOf } from './strangers';
import { campCell, campXY, notify, type Boat, type GameState, type Person } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds } from './townsfolk';
import { boatDef, boatyardOf, fleet, freeBoat, mooring } from './boats';

/** A colony on an isle: settlers from the town, and what they make to send home by ship. */
export interface Colony {
  id: number;
  /** The isle's destination id (data/boats.ts), and the colony's own name. */
  isle: string;
  name: string;
  founded: number;
  leader: number;
  folk: Person[];
  pop: number;
  loyalty: number;
  goods: Record<string, number>;
  /** The day of its last run home. */
  lastRun: number;
  news: string[];
}

/** The town's sea book (the Harbour tab's numbers, and the side stream's schedule). */
export interface SeaBook {
  gift?: boolean;
  /** When the next pirate crew lands. */
  nextPirate?: number;
  lastColony?: number;
  /** Isles the Tide Clan has taken (a town not its own). */
  claimed?: string[];
  /** The catch brought in: today (reset at dawn), over the last days, and in all. */
  today: number;
  recent: number[];
  total: number;
  boatsLost: number;
  menLost: number;
  piratesBeaten?: number;
  /** A merfolk town's leviathan escort lasts to this tick. */
  parley?: number;
  /** The sea's latest news, newest first. */
  log: string[];
  /** The season the shoal was last told in. */
  shoalSeason?: string;
}

export const colonies = (s: Pick<GameState, 'colonies'>): Colony[] => s.colonies ?? [];
export const seaBook = (s: GameState): SeaBook => (s.sea ??= { today: 0, recent: [], total: 0, boatsLost: 0, menLost: 0, log: [] });
const tell = (s: GameState, line: string, important = false) => {
  const b = seaBook(s);
  b.log.unshift(line);
  if (b.log.length > 10) b.log.length = 10;
  notify(s, line, important);
};
const rngAt = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:sea:${s.tick}:${salt}`));
const merfolk = (s: GameState) => seaTown(s);
const dayOf = (s: GameState) => calendar(s.tick).day;

/* ------------------------------------------------------------ the harbour, and the fleet's room */

export const harbourOf = (s: GameState) => s.buildings.find((b) => b.def === 'harbour' && b.status === 'done');
/** The boats a town may keep: the harbour berths more. */
export const fleetMost = (s: GameState) => FLEET_MOST + (harbourOf(s) ? HARBOUR_BERTHS : 0);
/** Whether the town lies by the sea (a boatyard or harbour stands, a boat sails, or it is a shore town). */
export const coastal = (s: GameState) => merfolk(s) || !!boatyardOf(s) || !!harbourOf(s) || fleet(s).length > 0;
/** The quay: the harbour's middle, else the boatyard's, else the camp's. */
export function portAt(s: GameState): { x: number; y: number } {
  const h = harbourOf(s) ?? boatyardOf(s);
  return h ? buildingCentre(h) : campXY(s);
}

/* ------------------------------------------------------------ fishing: shoals and squalls */

/** The class of a boat's fishing: dugouts and longboats fish inshore, carracks and the bigger ships the deep. */
const fishesDeep = (kind: BoatKind) => BOATS.findIndex((d) => d.kind === kind) >= 2;
/** A day's catch multiplier for a boat: the season's shoal (right ground or wrong), the harbour's landing and a
 *  merfolk leviathan's escort. 1 without the autopilot. */
export function catchFactor(s: GameState, b: Boat): number {
  if (s.autopilot === false) return 1;
  const shoal = SHOALS[calendar(s.tick).season];
  const right = (shoal.ground === 'deep') === fishesDeep(b.kind);
  return shoal.rich * (right ? 1 : WRONG_GROUND) * (harbourOf(s) ? HARBOUR_CATCH : 1) * ((seaBook(s).parley ?? 0) > s.tick ? PARLEY_CATCH : 1);
}
/** Count a day's catch for the book. */
export function noteCatch(s: GameState, n: number): void {
  if (s.autopilot === false || n <= 0) return;
  const b = seaBook(s);
  b.today += n;
  b.total += n;
}
/** The harbour's shelter against squalls (1 = none). */
export const squallShelter = (s: GameState) => (s.autopilot !== false && harbourOf(s) ? HARBOUR_SHELTER : 1);

/** Who is in a boat when she goes down: two or three of the town's grown folk, who drown (a swimmer, rarely). */
function drown(s: GameState, b: Boat, how: string, rng: Rng): number {
  const pool = s.people.filter((p) => p.away === null && !isChild(p) && !p.downed && p.id !== s.mainId);
  let n = 0;
  const crew = rng.int(FISHERS_PER_BOAT[0], FISHERS_PER_BOAT[1]);
  for (let i = 0; i < crew && pool.length; i++) {
    const p = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    const swimmer = merfolk(s) || peopleOf(s, p) === 'merfolk';
    if (rng.chance(swimmer ? FISHER_DROWN_SWIMMER : FISHER_DROWN)) {
      killPerson(s, p, `drowned when the ${b.name} ${how}`);
      n++;
    }
  }
  seaBook(s).menLost += n;
  return n;
}

/** A squall catches a boat fishing at home (boats.ts `fish`, after its battering): with her hull low she may founder
 *  (the men aboard drown, the sea gives back some of her). True when she's lost. */
export function squallSinks(s: GameState, b: Boat): boolean {
  if (s.autopilot === false) return false;
  const rng = rngAt(s, `squall:${b.id}`);
  const low = b.hull < boatDef(b).hull * SINK_HULL;
  if (!low && !rng.chance(SINK_CHANCE)) return false;
  const n = drown(s, b, 'foundered in a squall', rng);
  loseBoat(s, b, n ? `The ${b.name} foundered in a squall off the point; ${n} ${n === 1 ? 'was' : 'were'} lost with her.` : `The ${b.name} foundered in a squall, though her crew were hauled out alive.`, rng);
  return true;
}

function loseBoat(s: GameState, b: Boat, line: string, rng: Rng): void {
  s.boats = fleet(s).filter((q) => q !== b);
  seaBook(s).boatsLost++;
  tell(s, line, true);
  washUp(s, b, rng);
}

/* ------------------------------------------------------------ wrecks wash up */

/** The sea gives some of a wreck back: timber and cloth on the beach, and now and then a castaway. */
export function washUp(s: GameState, b: Pick<Boat, 'name'>, rng: Rng): void {
  if (s.autopilot === false) return;
  if (rng.chance(WRECK_WASH_CHANCE)) {
    const table = WASH_LOOT[s.era === 'neolithic' ? 'neolithic' : s.era === 'medieval' ? 'medieval' : 'industrial'];
    const stock: Record<string, number> = {};
    for (const [m, r] of Object.entries(table)) {
      const n = rng.int(r![0], r![1]);
      if (n > 0) stock[m] = n;
    }
    depositNear(s, portAt(s), stock);
    notify(s, `Timbers and cloth from the ${b.name} wash up on the beach: ${Object.entries(stock).map(([m, n]) => `${n} ${m}`).join(', ')}.`);
  }
  if (rng.chance(WRECK_CASTAWAY) && coastal(s)) {
    const sea = shoreSide(s);
    spawnBand(s, rng, 'refugees', sea, `{n} castaways, washed ashore from the wreck of the ${b.name}, crawl up the beach asking for aid.`);
  }
}
/** Which side of the camp the water lies (the castaways come from there). */
function shoreSide(s: GameState): -1 | 1 {
  const c = campXY(s);
  const p = portAt(s);
  return p.x < c.x ? -1 : 1;
}

/* ------------------------------------------------------------ the monster, the escort, the pirates */

function monsterHunt(s: GameState, rng: Rng): void {
  const home = fleet(s).filter((b) => b.away === null);
  if (!home.length || dayOf(s) < MONSTER_FROM_DAY) return;
  const odds = MONSTER_NIGHTLY * Math.min(3, home.length) * (harbourOf(s) ? MONSTER_HARBOUR : 1) * (merfolk(s) ? MONSTER_PARLEY : 1);
  if (!rng.chance(odds)) return;
  const name = MONSTER_NAMES[rng.int(0, MONSTER_NAMES.length - 1)];
  const b = home[rng.int(0, home.length - 1)];
  b.hull -= Math.round(boatDef(b).hull * (MONSTER_HULL[0] + rng.next() * (MONSTER_HULL[1] - MONSTER_HULL[0])));
  if (b.hull <= 0) {
    const n = drown(s, b, `was dragged under by ${name}`, rng);
    loseBoat(s, b, `${name[0].toUpperCase()}${name.slice(1)} rose in the night and took the ${b.name}${n ? `; ${n} drowned` : ''}.`, rng);
  } else {
    tell(s, `${name[0].toUpperCase()}${name.slice(1)} rose by the moorings in the night and mauled the ${b.name}.`, true);
  }
}

/** A pirate crew lands on the beach: a raid of sea raiders, set down at the water's edge nearest the camp. */
function pirates(s: GameState, rng: Rng): void {
  const book = seaBook(s);
  if (book.nextPirate === undefined) {
    book.nextPirate = s.tick + rng.int(PIRATE_GAP[0], PIRATE_GAP[1]) * TICKS_PER_DAY;
    return;
  }
  if (s.tick < book.nextPirate || s.raid || !coastal(s) || !eraReached(s.era, 'medieval') || dayOf(s) < PIRATE_FROM_DAY) return;
  book.nextPirate = s.tick + rng.int(PIRATE_GAP[0], PIRATE_GAP[1]) * TICKS_PER_DAY;
  const raid = startRaid(s, SEA_RAID_KIND, Math.round(raidBudget(s) * PIRATE_BUDGET), rng);
  raid.landing = true;
  const beach = beachNear(s);
  if (beach) {
    raid.side = beach.x < campXY(s).x ? -1 : 1;
    raid.raiders.forEach((r, i) => {
      // (all on the beach's one cell, huddled)
      r.x = beach.x + ((i % 4) - 1.5) * (CELL / 8);
      r.y = beach.y + (Math.floor(i / 4) - 0.5) * (CELL / 8);
      r.dir = raid.side < 0 ? 1 : -1;
    });
  }
  s.nextRaidTick = Math.max(s.nextRaidTick, s.tick + 24 * TICKS_PER_HOUR);
  tell(s, 'A pirate ship stands in off the beach, and its crew wades ashore!', true);
}

/** The nearest bit of beach to the camp within the known land: a land cell with water beside it (px), if any. */
export function beachNear(s: GameState): { x: number; y: number } | null {
  const m = s.land;
  const c = m.camp;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  const reach = Math.round(m.open) + 2;
  for (let y = Math.max(1, c.y - reach); y <= Math.min(m.h - 2, c.y + reach); y++)
    for (let x = Math.max(1, c.x - reach); x <= Math.min(m.w - 2, c.x + reach); x++) {
      if (wet(groundAt(m, x, y)) || !isOpen(m, x, y)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wet(groundAt(m, x + dx, y + dy)))) continue;
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < bestD) {
        bestD = d;
        best = { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL };
      }
    }
  return best;
}

/** The water cell where the fleet lies moored: by the harbour, else the boatyard, else (a shore town with a boat and
 *  no yard yet) the water nearest the camp. */
export function quay(s: GameState): { x: number; y: number } | null {
  const h = harbourOf(s) ?? boatyardOf(s);
  if (h) return mooring(s.land, footprint(h));
  if (!fleet(s).length) return null;
  const b = beachNear(s);
  if (!b) return null;
  const x = Math.floor(b.x / CELL);
  const y = Math.floor(b.y / CELL);
  const w = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find((c) => wet(groundAt(s.land, c.x, c.y)));
  return w ?? null;
}

/* ------------------------------------------------------------ ships age */

function ageBoats(s: GameState, rng: Rng): void {
  for (const b of [...fleet(s)]) {
    b.built ??= s.tick;
    const age = (s.tick - b.built) / TICKS_PER_DAY;
    if (age <= AGE_FROM_DAYS) continue;
    const def = boatDef(b);
    b.hull = Math.max(b.away !== null ? 1 : 0, b.hull - Math.max(1, Math.round(def.hull * AGE_WEAR * (1 + (age - AGE_FROM_DAYS) / AGE_FROM_DAYS))));
    if (b.away === null && b.hull <= def.hull * ROT_AT) {
      s.boats = fleet(s).filter((q) => q !== b);
      tell(s, `The old ${b.name} has rotted at her moorings and is broken up for firewood.`);
      void rng;
    }
  }
}

/* ------------------------------------------------------------ islands: the Tide Clan's claims, and colonies */

/** The day the Tide Clan claims an isle in a town that isn't its own (fixed for the seed). */
export function claimDay(s: GameState, isle: string): number {
  return CLAIM_DAYS[0] + (hashSeed(`${s.seed}:claim:${isle}`) % (CLAIM_DAYS[1] - CLAIM_DAYS[0] + 1));
}
export const claimed = (s: GameState, isle: string) => !merfolk(s) && dayOf(s) >= claimDay(s, isle);

/** Whether the isle can be settled: its trip unlocked, not settled already, not the Tide Clan's. */
export function settleable(s: GameState, isle: string): boolean {
  const d = ISLANDS.find((i) => i.id === isle);
  if (!d || !COLONY_ISLES[isle]) return false;
  if (d.research && !s.research.done.includes(d.research)) return false;
  if (d.era && !eraReached(s.era, d.era)) return false;
  return !colonies(s).some((c) => c.isle === isle) && !claimed(s, isle);
}

function maybeFound(s: GameState, rng: Rng): void {
  const mer = merfolk(s);
  if (dayOf(s) < (mer ? COLONY_FROM_DAY_MERFOLK : COLONY_FROM_DAY)) return;
  if (colonies(s).length >= (mer ? COLONY_MOST_MERFOLK : COLONY_MOST)) return;
  const book = seaBook(s);
  if (book.lastColony !== undefined && s.tick - book.lastColony < COLONY_GAP_DAYS * TICKS_PER_DAY) return;
  const grown = s.people.filter((p) => p.away === null && !isChild(p) && !p.downed);
  if (grown.length < (mer ? COLONY_PEOPLE_MERFOLK : COLONY_PEOPLE)) return;
  if (!freeBoat(s)) return;
  const isles = Object.keys(COLONY_ISLES).filter((i) => settleable(s, i));
  if (!isles.length) return;
  const stock = totalStock(s);
  if ((stock.fish ?? 0) + (stock.bread ?? 0) + (stock.rations ?? 0) + (stock.dried_meat ?? 0) < 20) return;
  const isle = isles[rng.int(0, isles.length - 1)];
  const n = Math.min(rng.int(COLONISTS[0], COLONISTS[1]), Math.floor(grown.length / 4));
  const goers = grown.filter((p) => p.partner == null).sort((a, b) => b.id - a.id).slice(0, n);
  if (goers.length < 2) return;
  foundColony(s, isle, goers);
}

/** Settlers leave the town aboard the best free boat to found a colony on an isle. */
export function foundColony(s: GameState, isle: string, goers: Person[]): Colony {
  const info = COLONY_ISLES[isle];
  const boat = freeBoat(s);
  s.people = s.people.filter((p) => !goers.includes(p));
  for (const p of goers) {
    p.task = null;
    p.guard = false;
    if (p.partner != null) {
      const q = s.people.find((o) => o.id === p.partner);
      if (q) q.partner = null;
      p.partner = null;
    }
  }
  const dest = ISLANDS.find((i) => i.id === isle);
  const c: Colony = { id: s.nextId++, isle, name: info.name, founded: s.tick, leader: goers[0].id, folk: goers, pop: goers.length, loyalty: COLONY_LOYALTY_START, goods: {}, lastRun: dayOf(s), news: [] };
  s.colonies = [...colonies(s), c];
  seaBook(s).lastColony = s.tick;
  assignBeds(s);
  c.news.unshift(`Founded by ${goers[0].name} and ${goers.length - 1} others, ${info.word}.`);
  notify(s, `${goers[0].name} leads ${goers.length - 1} others ${boat ? `aboard the ${boat.name} ` : ''}to found ${info.name} on ${dest ? dest.name : 'an isle'}.`, true);
  return c;
}

/** A colony's day: it grows, makes its goods, and every few days its goods sail home. */
function colonyDay(s: GameState, c: Colony, rng: Rng): void {
  if (rng.chance(Math.min(1, c.pop * COLONY_GROWTH)) && c.pop < COLONY_MOST_FOLK) c.pop++;
  for (const [m, per] of Object.entries(COLONY_ISLES[c.isle].makes)) c.goods[m] = (c.goods[m] ?? 0) + c.pop * COLONY_MAKES_PER_HEAD * per;
  c.loyalty += (60 - c.loyalty) * 0.04;
  if (rng.chance(COLONY_PIRATES_DAILY) && eraReached(s.era, 'medieval')) {
    const lost = Math.min(c.pop - 1, rng.int(1, 3));
    if (lost > 0) {
      c.pop -= lost;
      c.loyalty -= 10;
      c.news.unshift('Pirates raided the cove.');
      tell(s, `Pirates fell on ${c.name}: ${lost} of its folk were killed or carried off.`, true);
    }
  }
  if (dayOf(s) - c.lastRun >= COLONY_RUN_DAYS) sailHome(s, c, rng);
  if (c.news.length > 8) c.news.length = 8;
  if (c.loyalty < COLONY_BREAK_AT) {
    s.colonies = colonies(s).filter((q) => q !== c);
    tell(s, `${c.name} has gone its own way, and sends no more ships.`, true);
  }
}

function sailHome(s: GameState, c: Colony, rng: Rng): void {
  const boat = freeBoat(s);
  const load = Object.fromEntries(Object.entries(c.goods).map(([m, n]) => [m, Math.floor(n)]).filter(([, n]) => (n as number) > 0));
  if (!Object.keys(load).length) return;
  if (!boat) {
    c.loyalty -= 3;
    c.lastRun = dayOf(s) - COLONY_RUN_DAYS + 1;
    return;
  }
  c.lastRun = dayOf(s);
  const winter = calendar(s.tick).season === 'winter';
  if (rng.chance(COLONY_RUN_STORM * (winter ? 2 : 1) * squallShelter(s))) {
    boat.hull -= Math.round(boatDef(boat).hull * (0.25 + rng.next() * 0.35));
    if (boat.hull <= 0) {
      const n = drown(s, boat, `went down in a storm bringing home ${c.name}'s goods`, rng);
      c.goods = {};
      loseBoat(s, boat, `The ${boat.name} was lost in a storm on the run from ${c.name}${n ? `; ${n} drowned` : ''}.`, rng);
      return;
    }
    notify(s, `A storm battered the ${boat.name} on the run from ${c.name}.`);
  }
  depositNear(s, portAt(s), load);
  for (const m of Object.keys(load)) c.goods[m] -= load[m] as number;
  c.loyalty = Math.min(100, c.loyalty + 2);
  c.news.unshift(`The ${boat.name} brought its goods home.`);
}

/* ------------------------------------------------------------ the town plans its harbour */

/** Once there is a boatyard and a boat, a town of a few hands with lumber to spare lays a harbour beside the water. */
function planHarbour(s: GameState): void {
  if (!s.research.done.includes('shipwrighting') || !boatyardOf(s) || !fleet(s).length) return;
  if (s.buildings.some((b) => b.def === 'harbour')) return;
  if (s.people.filter((p) => !isChild(p)).length < 8) return;
  const def = BUILDING_BY_ID.harbour;
  const stock = totalStock(s);
  if (!Object.entries(def.cost).every(([m, n]) => (stock[m as keyof typeof stock] ?? 0) >= (n ?? 0) + 4)) return;
  const r = spiralSpot(s.land, def.width, depthOf(def), footprints(s), campCell(s), { ok: (rect) => touchesWater(s.land, rect) });
  if (r) placeBlueprint(s, 'harbour', r.x, r.y);
}

/* ------------------------------------------------------------ the step */

/** Each hour (with the autopilot on). */
export function seafaringHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const { hour, season, dayOfSeason } = calendar(s.tick);
  const rng = rngAt(s, 'hour');
  const book = seaBook(s);
  // (the merfolk's shore starts with a boat)
  if (merfolk(s) && !book.gift && s.tick > 0) {
    book.gift = true;
    if (!fleet(s).length) {
      const n = s.boatsBuilt ?? 0;
      s.boatsBuilt = n + 1;
      const def = BOATS[0];
      s.boats = [{ id: s.nextId++, kind: def.kind, name: 'Gull', hull: def.hull, away: null, built: s.tick }];
      tell(s, 'The Tide Clan push a dugout canoe out onto the water. The sea is home.');
    }
  }
  if (coastal(s)) pirates(s, rng);
  if (hour === 10) planHarbour(s);
  if (hour === 2) monsterHunt(s, rng);
  if (hour !== 6) return;
  // (dawn)
  book.recent.push(book.today);
  if (book.recent.length > 7) book.recent.shift();
  book.today = 0;
  if (book.shoalSeason !== season && coastal(s)) {
    book.shoalSeason = season;
    if (fleet(s).length) tell(s, `${SHOALS[season].name[0].toUpperCase()}${SHOALS[season].name.slice(1)} have come ${SHOALS[season].ground === 'deep' ? 'out into the deep water' : 'close inshore'}.`);
  }
  void dayOfSeason;
  ageBoats(s, rng);
  // (the Tide Clan's claims, told once)
  if (!merfolk(s) && coastal(s)) {
    for (const isle of Object.keys(COLONY_ISLES)) {
      if (claimed(s, isle) && !(book.claimed ??= []).includes(isle)) {
        book.claimed.push(isle);
        const d = ISLANDS.find((i) => i.id === isle);
        if (d && !colonies(s).some((c) => c.isle === isle)) tell(s, `Merfolk canoes have settled ${d.name}: it is the Tide Clan's now.`);
      }
    }
  }
  if (merfolk(s) && fleet(s).length && !((book.parley ?? 0) > s.tick) && rng.chance(PARLEY_DAILY)) {
    book.parley = s.tick + TICKS_PER_DAY;
    tell(s, 'A great shape rolls beside the boats and the Tide Clan sing to it: it will see the fleet to the shoals today.');
  }
  // (an old wreck comes ashore on its own in the autumn and winter gales)
  if ((season === 'autumn' || season === 'winter') && coastal(s) && rng.chance(DRIFT_DAILY)) washUp(s, { name: 'old ship' }, rng);
  for (const c of [...colonies(s)]) colonyDay(s, c, rng);
  if (coastal(s)) maybeFound(s, rng);
}

/** The Harbour tab's numbers (the snapshot). */
export function harbourReport(s: GameState) {
  const book = seaBook(s);
  const shoal = SHOALS[calendar(s.tick).season];
  return {
    harbour: !!harbourOf(s),
    berths: fleetMost(s),
    shoal: { name: shoal.name, ground: shoal.ground, rich: shoal.rich },
    catchToday: book.today,
    catchWeek: book.recent.reduce((a, b) => a + b, 0) + book.today,
    catchTotal: book.total,
    boatsLost: book.boatsLost,
    menLost: book.menLost,
    escort: (book.parley ?? 0) > s.tick,
    log: book.log.slice(0, 6),
    colonies: colonies(s).map((c) => ({ id: c.id, name: c.name, isle: c.isle, pop: c.pop, loyalty: Math.round(c.loyalty), news: c.news[0] ?? '' })),
    claimed: (book.claimed ?? []).slice(),
  };
}
