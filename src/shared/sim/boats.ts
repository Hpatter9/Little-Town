// The town's boats (data/boats.ts; the owner's design). The boatyard stands at the water's edge and builds them, one
// kind an age, through the crafting orders (`launch` when one is finished: she joins the fleet, named in turn). A
// boat at home goes out fishing (her catch each evening) and is mended each dawn; a boat away carries a party: an
// island only a boat reaches, a market over the sea, or a trip along the water made faster. At sea there are storms
// (her hull battered, someone maybe swept over the side), the sea's foes and pirates (fought on the FF screen); with
// her hull gone she's wrecked, and those aboard may drown. The town plans all of it itself (`planBoats`).

import { BOAT_BY_KIND, BOAT_ITEMS, BOAT_NAMES, BOATS, DROWN, DROWN_SWIMMER, FISH_HOUR, FISHING_STORM, FLEET_MOST, MONSTER_HOURLY, OVERBOARD, OVERBOARD_AT, PIRATE_HOURLY, REPAIR_SHARE, SEA_FOES, SEAWORTHY, STORM_HOURLY, STORM_HURT, WINTER_CATCH, type BoatDef, type BoatKind } from '../data/boats';
import { BUILDING_BY_ID } from '../data/buildings';
import { eraReached } from '../data/eras';
import { the, type Destination } from '../data/expeditions';
import type { EnemyGroup } from '../data/enemies';
import { HIDDEN_IN, REGIONS } from '../data/regions';
import { regionScouted } from '../data/regions';
import { canQueueCraft, queueCraft } from './crafting';
import { buildingCentre, depositNear, depthOf, footprints, placeBlueprint, totalStock } from './buildings';
import { isChild } from './social';
import { takeFromStorage } from './expeditions';
import { peopleOf } from './strangers';
import { killPerson } from './health';
import { groundAt, spiralSpot, touchesWater, wet, type LandMap, type Rect } from './land';
export { touchesWater };
import type { Rng } from '../rng';
import { swims } from './sea';
import { addStock, campCell, notify, type Boat, type Expedition, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

/** How far the town will open its land looking for water for a boatyard (the planner's own furthest). */
const OPEN_TO_WATER = 40;

export const fleet = (s: Pick<GameState, 'boats'>): Boat[] => s.boats ?? [];
export const boatDef = (b: Boat): BoatDef => BOAT_BY_KIND[b.kind];
/** The finished boatyard, if the town has one. */
export const boatyardOf = (s: GameState) => s.buildings.find((b) => b.def === 'boatyard' && b.status === 'done');

/* ------------------------------------------------------------ the water's edge */

/** The water cell beside a boatyard where her boats lie moored (the renderer draws them there). */
export function mooring(m: LandMap, r: Rect): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  for (let x = r.x - 3; x <= r.x + r.w + 2; x++)
    for (let y = r.y - 3; y <= r.y + r.h + 2; y++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h || !wet(groundAt(m, x, y))) continue;
      // (not just behind the yard, where its roof hides her: beside it or before it)
      const behind = y < r.y && x >= r.x - 1 && x <= r.x + r.w;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + (behind ? 6 : 0);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  return best;
}

/** Where the town would put its boatyard: the nearest spot by the water within the known land. */
export function boatyardSpot(s: GameState): { x: number; y: number } | null {
  const def = BUILDING_BY_ID.boatyard;
  const r = spiralSpot(s.land, def.width, depthOf(def), footprints(s), campCell(s), { ok: (rect) => touchesWater(s.land, rect) });
  return r ? { x: r.x, y: r.y } : null;
}

/* ------------------------------------------------------------ the fleet */

/** A boat is finished at the boatyard: she joins the fleet (and the worst is broken up past FLEET_MOST). */
export function launch(s: GameState, kind: BoatKind): Boat {
  const n = s.boatsBuilt ?? 0;
  s.boatsBuilt = n + 1;
  const def = BOAT_BY_KIND[kind];
  const boat: Boat = { id: s.nextId++, kind, name: BOAT_NAMES[n % BOAT_NAMES.length] + (n >= BOAT_NAMES.length ? ` ${Math.floor(n / BOAT_NAMES.length) + 1}` : ''), hull: def.hull, away: null };
  s.boats = [...fleet(s), boat];
  notify(s, `A new boat is launched at the boatyard: the ${boat.name}, a ${def.name.toLowerCase()}.`, true);
  const home = fleet(s).filter((b) => b.away === null);
  if (fleet(s).length > FLEET_MOST && home.length > 1) {
    const worst = [...home].sort((a, b) => rank(a) - rank(b))[0];
    if (worst !== boat) {
      s.boats = fleet(s).filter((b) => b !== worst);
      notify(s, `The old ${worst.name} is broken up for timber.`);
    }
  }
  return boat;
}
const rank = (b: Boat) => BOATS.findIndex((d) => d.kind === b.kind);

/** Fit to sail: at home, her hull above SEAWORTHY. */
export const seaworthy = (b: Boat) => b.away === null && b.hull >= boatDef(b).hull * SEAWORTHY;
/** The best boat free to sail, if any. */
export function freeBoat(s: GameState): Boat | undefined {
  return fleet(s)
    .filter(seaworthy)
    .sort((a, b) => rank(b) - rank(a) || b.hull - a.hull || a.id - b.id)[0];
}

/** The places reached by water as well as by land (the river, and everything in the island regions): a boat makes
 *  those trips faster. */
const SEA_REGIONS = new Set(['southern_isle', 'the_sea', 'far_isles']);
export function waterside(id: string): boolean {
  if (id === 'riverbank') return true;
  const region = HIDDEN_IN[id] ?? regionScouted(id) ?? (id.startsWith('trade:') ? id.slice(6) : undefined);
  return !!region && SEA_REGIONS.has(region) && REGIONS.some((r) => r.id === region);
}
/** Whether a trip to this place goes by boat: always for an island, and along the water when a boat is free. */
export const sailsTo = (d: Destination) => !!d.byBoat || waterside(d.id);

/* ------------------------------------------------------------ at home: fishing, mending, and the plan */

/** Each hour: the evening catch, the dawn's mending, and the town's plans for its boats. */
export function boatsHourly(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const { hour, season } = calendar(s.tick);
  const yard = boatyardOf(s);
  if (hour === FISH_HOUR && yard) fish(s, yard, season === 'winter', rng);
  if (hour === 6) mend(s);
  if (s.autopilot !== false) planBoats(s);
}

function fish(s: GameState, yard: ReturnType<typeof boatyardOf> & object, winter: boolean, rng: Rng): void {
  let caught = 0;
  for (const b of fleet(s)) {
    if (b.away !== null || b.hull <= 0) continue;
    caught += Math.round(boatDef(b).catch * (winter ? WINTER_CATCH : 1));
    // (now and then the weather catches a fishing boat out)
    if (rng.chance(FISHING_STORM * (winter ? 2 : 1))) {
      b.hull = Math.max(1, b.hull - Math.round(boatDef(b).hull * 0.2));
      notify(s, `The ${b.name} came in battered by a squall.`);
    }
  }
  if (!caught) return;
  const at = buildingCentre(yard);
  const stock = { fish: caught };
  depositNear(s, at, stock);
}

function mend(s: GameState): void {
  const yard = boatyardOf(s);
  if (!yard) return;
  const stock = totalStock(s);
  for (const b of fleet(s)) {
    const max = boatDef(b).hull;
    if (b.away !== null || b.hull >= max) continue;
    const wood: 'lumber' | 'wood' | null = (stock.lumber ?? 0) > 0 ? 'lumber' : (stock.wood ?? 0) > 0 ? 'wood' : null;
    if (!wood) return;
    takeFromStorage(s, wood, 1);
    addStock(stock, wood, -1);
    b.hull = Math.min(max, b.hull + Math.round(max * REPAIR_SHARE));
  }
}

/** The best boat the town has learned to build. */
export function bestBoat(s: GameState): BoatDef | undefined {
  return [...BOATS].reverse().find((b) => s.research.done.includes(b.research) && eraReached(s.era, b.era));
}

/** The town's plans: a boatyard by the water once it can build boats, then a boat, a second once it's a few strong,
 *  and a better one as each age brings one (one order at a time, only with the makings in the stores). */
export function planBoats(s: GameState): void {
  if (!s.research.done.includes('boatbuilding')) return;
  const yards = s.buildings.filter((b) => b.def === 'boatyard');
  if (!yards.length) {
    const at = boatyardSpot(s);
    if (at) placeBlueprint(s, 'boatyard', at.x, at.y);
    // (no water within the known land, or only at its very edge: the town looks a little further out)
    else if (s.land.open < OPEN_TO_WATER) {
      s.land.open = Math.min(OPEN_TO_WATER, s.land.open + 2);
      s.land.version++;
    }
    return;
  }
  if (!boatyardOf(s)) return;
  if (s.crafting.some((o) => BOAT_ITEMS.some((i) => i.id === o.item))) return;
  const best = bestBoat(s);
  if (!best) return;
  const boats = fleet(s);
  const grown = s.people.filter((p) => !isChild(p)).length;
  const want = boats.length === 0 || (boats.length < 2 && grown >= 6) || (boats.every((b) => rank(b) < BOATS.indexOf(best)) && boats.length <= FLEET_MOST);
  if (!want) return;
  const stock = totalStock(s);
  if (!Object.entries(best.cost).every(([m, n]) => (stock[m as keyof typeof stock] ?? 0) >= (n ?? 0) + 4)) return;
  const id = `boat_${best.kind}`;
  if (canQueueCraft(s, id).ok) queueCraft(s, id);
}

/* ------------------------------------------------------------ at sea */

/** One who swims like a fish: anyone of a shore town, and a merrow anywhere. */
const swimmer = (s: GameState, p: Person) => swims(s, p) || peopleOf(s, p) === 'merfolk';

/** The share of a party's speed a boat gives (1 on foot). */
export const sailSpeed = (b: Boat | undefined) => (b ? boatDef(b).speed : 1);

/** An hour at sea: maybe a storm (and someone over the side), the sea's foes or pirates; a wreck when the hull goes. */
export function seaHour(s: GameState, e: Expedition, members: Person[], rng: Rng, fight: (group: EnemyGroup) => void): void {
  const b = fleet(s).find((q) => q.id === e.boat);
  if (!b) return;
  const def = boatDef(b);
  const { season } = calendar(s.tick);
  if (rng.chance(STORM_HOURLY[season])) {
    const share = STORM_HURT[0] + rng.next() * (STORM_HURT[1] - STORM_HURT[0]);
    // (an iron hull rides it out better)
    const hurt = Math.round(def.hull * share * (rank(b) >= 3 ? 0.5 : 1));
    b.hull -= hurt;
    notify(s, `A storm catches the ${b.name} at sea.`, true);
    if (b.hull <= 0) return wreck(s, e, b, members, rng);
    if (share >= OVERBOARD_AT && rng.chance(OVERBOARD)) {
      const up = members.filter((p) => !p.downed);
      const lost = up.length ? up[rng.int(0, up.length - 1)] : members[0];
      if (lost && !rng.chance(swimmer(s, lost) ? 1 - DROWN_SWIMMER : 0.5)) killPerson(s, lost, 'swept overboard in a storm');
      else if (lost) notify(s, `${lost.name} went over the side in the storm, and was hauled back aboard.`);
    }
    return;
  }
  if (e.battle) return;
  const foes = SEA_FOES[s.era] ?? SEA_FOES.neolithic;
  if (eraReached(s.era, 'medieval') && rng.chance(PIRATE_HOURLY)) {
    notify(s, `Pirates come alongside the ${b.name}!`, true);
    return fight({ sea_reaver: s.era === 'medieval' ? 2 : 3 });
  }
  if (rng.chance(MONSTER_HOURLY)) {
    notify(s, `Something rises out of the water by the ${b.name}.`, true);
    fight(foes[rng.int(0, foes.length - 1)]);
  }
}

/** Her hull is gone: the boat goes down. Those aboard may drown; the rest cling to the wreck and make for home with
 *  nothing. */
export function wreck(s: GameState, e: Expedition, b: Boat, members: Person[], rng: Rng): void {
  s.boats = fleet(s).filter((q) => q !== b);
  e.boat = undefined;
  e.loot = {};
  e.wrecked = true;
  notify(s, `The ${b.name} is wrecked and goes down!`, true);
  for (const p of members) {
    if (rng.chance(swimmer(s, p) ? DROWN_SWIMMER : DROWN)) killPerson(s, p, `drowned when the ${b.name} went down`);
  }
}

/** The party is home: their boat with them. */
export function boatHome(s: GameState, e: Expedition): void {
  const b = fleet(s).find((q) => q.id === e.boat);
  if (b) b.away = null;
}

/** A line for the board: which boat a trip would take. */
export const boatLine = (s: GameState, d: Destination) => {
  const b = freeBoat(s);
  return d.byBoat ? (b ? `By boat: the ${b.name}` : 'Needs a seaworthy boat') : waterside(d.id) && b ? `By boat, faster: the ${b.name}` : '';
};
export const placeName = (d: Destination) => the(d.name);
