// The skies (data/skies.ts; the owner's ask). The airship mast builds the town's airships through the crafting orders
// (`launchAirship` when one is finished: she joins the fleet, named in turn), moors them and mends them each dawn. An
// airship at home carries the next party anywhere it goes (not only by water: `fliesWith`), at her speed, with her hold
// on top of their packs; the far places in the sky (`bySky`) only she reaches. Aloft there are storms, sky pirates,
// flyers and, from a power at war with the town, guns from below (`skyHour`); her hull gone, she falls (`crash`) and
// those aboard may die. Sky pirates raid the town from their own ship (`skyPiratesHourly`): a town that flies, or any
// town from the Modern age. Flying creatures hunt the townsfolk from the air (`skyHuntersHourly`; they move with the
// land's bands in sim/roamers.ts), and the town shoots back (`skyVolley`). The town plans all of it itself
// (`planAirships`). Every roll is the skies' own side stream: a town without airships plays out as before.

import {
  AIRSHIP_BY_KIND,
  AIRSHIP_ITEMS,
  AIRSHIP_NAMES,
  AIRSHIPS,
  AIRSHIPS_MOST,
  AIRWORTHY,
  CAUGHT_A_LINE,
  CRASH_KILLS,
  FLAK_HOURLY,
  FLAK_HURT,
  FLEE_AT,
  FLYER_HOURLY,
  ROOST_QUIET_DAYS,
  SKY_FLYERS,
  SKY_HUNT_FIRST_DAY,
  SKY_HUNT_HIGHLANDS,
  SKY_HUNT_HOURLY,
  SKY_HUNT_HOURS,
  SKY_HUNT_PEOPLE,
  SKY_HUNTERS,
  SKY_HUNTERS_MOST,
  SKY_PIRATE_GROUP,
  SKY_PIRATE_HOURLY,
  SKY_PIRATES_ERA,
  SKY_RAID_DUE,
  SKY_RAID_FROM_DAY,
  SKY_RAID_GAP_DAYS,
  SKY_RAID_HOURLY,
  SKY_RAID_SHARE,
  SKY_REPAIR_SHARE,
  SKY_STORM_HOURLY,
  SKY_STORM_HURT,
  SKY_WARNING_HOURS,
  skyRaidFor,
  THROWN,
  THROWN_AT,
  VOLLEY_CELLS,
  VOLLEY_HIT,
  VOLLEY_HURT,
  VOLLEY_TICKS,
  type AirshipDef,
  type AirshipKind,
} from '../data/skies';
import { BUILDING_BY_ID } from '../data/buildings';
import { ENEMIES, type EnemyGroup } from '../data/enemies';
import { eraReached } from '../data/eras';
import { HUNT_DEST } from '../data/pack';
import { RAID_KIND_BY_ID } from '../data/raids';
import type { Destination } from '../data/expeditions';
import { hashSeed, Rng } from '../rng';
import { canQueueCraft, queueCraft } from './crafting';
import { buildingCentre, defOf, depositNear, totalStock } from './buildings';
import { takeFromStorage } from './expeditions';
import { killPerson } from './health';
import { findSpot } from './planner';
import { placeBlueprint } from './buildings';
import { raidBudget, scheduleNextRaid, startRaid } from './raids';
import { isChild } from './social';
import { addStock, campXY, notify, type Airship, type Expedition, type GameState, type Person, type Roamer } from './state';
import { calendar, paceDay, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

const CELL = 32;

/** The skies' own rolls (a side stream: drawing from the town's would change how every town plays out). */
const roll = (s: GameState, ...salt: (string | number)[]) => new Rng(hashSeed(`${s.seed}:skies:${salt.join(':')}`));

export const airfleet = (s: Pick<GameState, 'airships'>): Airship[] => s.airships ?? [];
export const airshipDef = (a: Airship): AirshipDef => AIRSHIP_BY_KIND[a.kind];
/** The finished airship mast, if the town has one. */
export const mastOf = (s: GameState) => s.buildings.find((b) => b.def === 'airship_mast' && b.status === 'done');
const rank = (a: Airship) => AIRSHIPS.findIndex((d) => d.kind === a.kind);

/* ------------------------------------------------------------ the fleet */

/** An airship is finished at the mast: she joins the fleet (and the worst is broken up past AIRSHIPS_MOST). */
export function launchAirship(s: GameState, kind: AirshipKind): Airship {
  const n = s.airshipsBuilt ?? 0;
  s.airshipsBuilt = n + 1;
  const def = AIRSHIP_BY_KIND[kind];
  const ship: Airship = { id: s.nextId++, kind, name: AIRSHIP_NAMES[n % AIRSHIP_NAMES.length] + (n >= AIRSHIP_NAMES.length ? ` ${Math.floor(n / AIRSHIP_NAMES.length) + 1}` : ''), hull: def.hull, away: null };
  s.airships = [...airfleet(s), ship];
  notify(s, `A new airship rises at the mast: the ${ship.name}, a ${def.name.toLowerCase()}.`, true);
  const home = airfleet(s).filter((a) => a.away === null);
  if (airfleet(s).length > AIRSHIPS_MOST && home.length > 1) {
    const worst = [...home].sort((a, b) => rank(a) - rank(b))[0];
    if (worst !== ship) {
      s.airships = airfleet(s).filter((a) => a !== worst);
      notify(s, `The old ${worst.name} is taken down and her gasbag cut up for cloth.`);
    }
  }
  return ship;
}

/** Fit to fly: at home, her hull above AIRWORTHY. */
export const airworthy = (a: Airship) => a.away === null && a.hull >= airshipDef(a).hull * AIRWORTHY;
/** The best airship free to fly, if any (one that seats `n`, when given). */
export function freeAirship(s: GameState, n = 0): Airship | undefined {
  return airfleet(s)
    .filter((a) => airworthy(a) && airshipDef(a).crew >= n)
    .sort((a, b) => rank(b) - rank(a) || b.hull - a.hull || a.id - b.id)[0];
}

/** The airship a party of `n` would fly in to a place: a free one that seats them all (the full moon's hunt runs on
 *  foot, and a fight on the land is no trip). */
export function fliesWith(s: GameState, d: Destination, n: number): Airship | undefined {
  if (d.id === HUNT_DEST || d.id.startsWith('wild:')) return undefined;
  return freeAirship(s, n);
}
/** How much faster an airship makes a trip (1 on foot). */
export const flySpeed = (a: Airship | undefined) => (a ? airshipDef(a).speed : 1);

/** A line for the board: which airship a trip would take, or that it waits for one. */
export function airshipLine(s: GameState, d: Destination): string {
  const a = freeAirship(s);
  if (d.bySky) return a ? `By air: the ${a.name}` : 'Needs an airworthy airship';
  return a ? `By air, faster: the ${a.name}` : '';
}

/* ------------------------------------------------------------ at home: mending, and the plan */

/** Each hour: the dawn's mending, the town's plans, sky pirates and the hunters of the sky. */
export function skiesHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const { hour } = calendar(s.tick);
  if (hour === 6) mendAirships(s);
  if (s.autopilot === false) return;
  planAirships(s);
  skyPiratesHourly(s);
  skyHuntersHourly(s);
}

function mendAirships(s: GameState): void {
  if (!mastOf(s)) return;
  const stock = totalStock(s);
  for (const a of airfleet(s)) {
    const max = airshipDef(a).hull;
    if (a.away !== null || a.hull >= max) continue;
    const m: 'steel' | 'cloth' | null = (stock.steel ?? 0) > 0 ? 'steel' : (stock.cloth ?? 0) > 0 ? 'cloth' : null;
    if (!m) return;
    takeFromStorage(s, m, 1);
    addStock(stock, m, -1);
    a.hull = Math.min(max, a.hull + Math.round(max * SKY_REPAIR_SHARE));
  }
}

/** The best airship the town has learned to build. */
export function bestAirship(s: GameState): AirshipDef | undefined {
  return [...AIRSHIPS].reverse().find((a) => s.research.done.includes(a.research) && eraReached(s.era, a.era));
}

/** The town's plans: a mast once it has Aeronautics and a few people, then an airship, a second once it's bigger, a
 *  better one as each age brings one (one order at a time, only with the makings in the stores and some to spare). */
export function planAirships(s: GameState): void {
  if (!s.research.done.includes('aeronautics')) return;
  const grown = s.people.filter((p) => !isChild(p)).length;
  if (!s.buildings.some((b) => b.def === 'airship_mast')) {
    if (grown < 4) return;
    const at = findSpot(s, BUILDING_BY_ID.airship_mast);
    if (at) placeBlueprint(s, 'airship_mast', at.x, at.y, false, false, !!at.wild);
    return;
  }
  if (!mastOf(s)) return;
  if (s.crafting.some((o) => AIRSHIP_ITEMS.some((i) => i.id === o.item))) return;
  const best = bestAirship(s);
  if (!best) return;
  const ships = airfleet(s);
  const better = AIRSHIPS.indexOf(best);
  const want = ships.length === 0 || (ships.length < 2 && grown >= 10) || (ships.every((a) => rank(a) < better) && ships.length <= AIRSHIPS_MOST);
  if (!want) return;
  const stock = totalStock(s);
  if (!Object.entries(best.cost).every(([m, n]) => (stock[m as keyof typeof stock] ?? 0) >= (n ?? 0) + 4)) return;
  const id = `airship_${best.kind}`;
  if (canQueueCraft(s, id).ok) queueCraft(s, id);
}

/** What the planner wants for the next airship (so the town gathers for it): the best one's makings, while it has
 *  none of that kind and a mast stands. */
export function airshipWants(s: GameState): Partial<Record<string, number>> {
  if (!mastOf(s)) return {};
  const best = bestAirship(s);
  if (!best || airfleet(s).some((a) => a.kind === best.kind)) return {};
  return best.cost;
}

/* ------------------------------------------------------------ aloft */

/** The party sets out in her (sim/expeditions.ts): she's away with them. */
export function boardAirship(a: Airship, e: Expedition): void {
  a.away = e.id;
  e.airship = a.id;
}

/** An hour aloft: maybe a storm (and someone thrown out), guns from below, sky pirates or flyers; she falls when her
 *  hull goes. A fight is fought on the FF screen (`fight`, given the skies' own stream). */
export function skyHour(s: GameState, e: Expedition, members: Person[], fight: (group: EnemyGroup, g: Rng) => void): void {
  const a = airfleet(s).find((q) => q.id === e.airship);
  if (!a) return;
  const def = airshipDef(a);
  const g = roll(s, 'aloft', e.id, s.tick);
  const { season } = calendar(s.tick);
  if (g.chance(SKY_STORM_HOURLY[season])) {
    const share = SKY_STORM_HURT[0] + g.next() * (SKY_STORM_HURT[1] - SKY_STORM_HURT[0]);
    // (a later ship, all frame and engines, rides it out better)
    a.hull -= Math.round(def.hull * share * (rank(a) >= 2 ? 0.6 : 1));
    notify(s, `A storm throws the ${a.name} about the sky.`, true);
    if (a.hull <= 0) return crash(s, e, a, members, g, 'torn apart in a storm');
    if (share >= THROWN_AT && g.chance(THROWN)) {
      const up = members.filter((p) => !p.downed);
      const lost = up.length ? g.pick(up) : undefined;
      if (lost && !g.chance(CAUGHT_A_LINE)) killPerson(s, lost, `was thrown from the ${a.name} in a storm`);
      else if (lost) notify(s, `${lost.name} was thrown from the gondola in the storm, and caught a line.`);
    }
    return;
  }
  // (a power at war with the town fires on her as she passes over)
  const war = (s.factions ?? []).filter((f) => f.known && f.stance === 'war');
  if (war.length && g.chance(FLAK_HOURLY * Math.min(2, war.length))) {
    const share = FLAK_HURT[0] + g.next() * (FLAK_HURT[1] - FLAK_HURT[0]);
    a.hull -= Math.round(def.hull * share);
    notify(s, `Guns open up on the ${a.name} from below!`, true);
    if (a.hull <= 0) return crash(s, e, a, members, g, 'shot down');
    return;
  }
  if (e.battle) return;
  if (eraReached(s.era, 'industrial') && g.chance(SKY_PIRATE_HOURLY)) {
    notify(s, `Sky pirates come alongside the ${a.name}, grapples flying!`, true);
    return fight(drivenOff(SKY_PIRATE_GROUP[s.era], def, g), g);
  }
  if (g.chance(FLYER_HOURLY)) {
    const groups = SKY_FLYERS[s.era] ?? SKY_FLYERS.industrial;
    notify(s, `Things with wings come at the ${a.name} out of the clouds.`, true);
    fight(drivenOff(g.pick(groups), def, g), g);
  }
}

/** Her guns drive off a share of what comes at her before it comes to blows (always one left to fight). */
function drivenOff(group: EnemyGroup, def: AirshipDef, g: Rng): EnemyGroup {
  const out: EnemyGroup = {};
  for (const [id, n] of Object.entries(group)) {
    let k = 0;
    for (let i = 0; i < n; i++) if (!g.chance(def.guns)) k++;
    if (k) out[id] = k;
  }
  if (!Object.keys(out).length) {
    const [id] = Object.keys(group);
    out[id] = 1;
  }
  return out;
}

/** Her hull is gone: she falls. Those aboard may die; the rest walk home from where she came down, with nothing. */
export function crash(s: GameState, e: Expedition, a: Airship, members: Person[], g: Rng, how: string): void {
  s.airships = airfleet(s).filter((q) => q !== a);
  s.skies = { ...(s.skies ?? {}), lost: (s.skies?.lost ?? 0) + 1 };
  e.airship = undefined;
  e.loot = {};
  e.crashed = true;
  notify(s, `The ${a.name} is ${how}, and falls out of the sky!`, true);
  for (const p of members) if (g.chance(CRASH_KILLS)) killPerson(s, p, `died when the ${a.name} came down`);
  // (on foot from here: what's left of the way takes as long as walking it)
  const pace = airshipDef(a).speed;
  if (e.phase === 'back') e.backTicks = Math.round(e.elapsed + (e.backTicks - e.elapsed) * pace);
}

/** The party is home: their airship with them; a party back from Gale's Roost with the job done quiets the pirates. */
export function airshipHome(s: GameState, e: Expedition, done: boolean): void {
  const a = airfleet(s).find((q) => q.id === e.airship);
  if (a) a.away = null;
  if (e.dest === 'gales_roost' && done && !e.crashed) {
    s.skies = { ...(s.skies ?? {}), quietUntil: s.tick + ROOST_QUIET_DAYS * TICKS_PER_DAY };
    notify(s, `Gale's Roost is cleared: the sky pirates will keep away for a good while.`, true);
  }
}

/** Nobody came back: their airship is lost with them. */
export function airshipLost(s: GameState, e: Expedition): void {
  const a = airfleet(s).find((q) => q.id === e.airship);
  if (!a) return;
  s.airships = airfleet(s).filter((q) => q !== a);
  s.skies = { ...(s.skies ?? {}), lost: (s.skies?.lost ?? 0) + 1 };
  notify(s, `The ${a.name} never comes home.`, true);
}

/* ------------------------------------------------------------ sky pirates */

/** Whether sky pirates may come: a town that flies, or any town from the Modern age, once the Roost is quiet again. */
export function piratesMayCome(s: GameState): boolean {
  if (!eraReached(s.era, 'industrial')) return false;
  if ((s.skies?.quietUntil ?? 0) > s.tick) return false;
  return airfleet(s).length > 0 || eraReached(s.era, SKY_PIRATES_ERA);
}

/** Hourly: the pirates' ship is seen (in place of a raid that's due), and an hour later they drop in. */
export function skyPiratesHourly(s: GameState): void {
  const sk = s.skies;
  if (sk?.pirates) {
    if (s.tick >= sk.pirates.at) dropIn(s);
    return;
  }
  if (!piratesMayCome(s) || s.raid || paceDay(s.tick) < SKY_RAID_FROM_DAY) return;
  if (sk?.lastPirates !== undefined && s.tick - sk.lastPirates < SKY_RAID_GAP_DAYS * TICKS_PER_DAY) return;
  if (s.tick < s.nextRaidTick - SKY_RAID_DUE * TICKS_PER_HOUR) return;
  const g = roll(s, 'pirates', s.tick);
  if (!g.chance(SKY_RAID_HOURLY)) return;
  seePirates(s, g);
}

/** Their ship is seen in the clouds: where they'll drop (the stores, else the camp). */
export function seePirates(s: GameState, g: Rng = roll(s, 'seen', s.tick)): void {
  const store = s.buildings.filter((b) => b.status === 'done' && (defOf(b).storage ?? 0) > 0);
  const at = store.length ? buildingCentre(g.pick(store)) : campXY(s);
  s.skies = { ...(s.skies ?? {}), pirates: { at: s.tick + SKY_WARNING_HOURS * TICKS_PER_HOUR, x: at.x, y: at.y + CELL, kind: skyRaidFor(s.era), seen: s.tick } };
  notify(s, 'A ship with black gasbags comes out of the clouds: sky pirates!', true);
}

/** They slide down their ropes into the middle of the town. */
function dropIn(s: GameState): void {
  const p = s.skies?.pirates;
  if (!p) return;
  if (s.raid) {
    // (another raid has the town: they hang about a while longer)
    p.at = s.tick + TICKS_PER_HOUR;
    return;
  }
  const kind = RAID_KIND_BY_ID[p.kind];
  const g = roll(s, 'drop', s.tick);
  s.skies = { ...(s.skies ?? {}), pirates: undefined, lastPirates: s.tick, dropped: { x: p.x, y: p.y } };
  if (!kind) return;
  startRaid(s, kind, Math.max(10, raidBudget(s) * SKY_RAID_SHARE), g, { x: p.x, y: p.y });
  scheduleNextRaid(s, g);
  notify(s, 'Sky pirates slide down their ropes into the town!', true);
}

/* ------------------------------------------------------------ hunters from the sky */

const night = (hour: number) => hour >= 20 || hour < 5;

/** Hourly: a hunter may come over the town from far off (a side roll, so the land's bands are as before). */
export function skyHuntersHourly(s: GameState): void {
  const flying = (s.roamers ?? []).filter((r) => r.flying);
  if (flying.length >= SKY_HUNTERS_MOST) return;
  if (calendar(s.tick).day - 1 < SKY_HUNT_FIRST_DAY) return;
  const grown = s.people.filter((p) => p.away === null && !isChild(p)).length;
  if (grown < SKY_HUNT_PEOPLE) return;
  const g = roll(s, 'hunt', s.tick);
  if (!g.chance(SKY_HUNT_HOURLY * (s.biome === 'highlands' ? SKY_HUNT_HIGHLANDS : 1))) return;
  spawnSkyHunter(s, g);
}

/** A hunter comes in over the town from beyond the known land, to circle over it. */
export function spawnSkyHunter(s: GameState, g: Rng = roll(s, 'spawn', s.tick), group?: EnemyGroup): Roamer | null {
  const { hour } = calendar(s.tick);
  const pool = SKY_HUNTERS[s.era] ?? SKY_HUNTERS.neolithic;
  const chosen = group ?? g.pick(night(hour) ? pool.night : pool.day);
  if (Object.keys(chosen).some((id) => !ENEMIES[id])) return null;
  const c = campXY(s);
  const a = g.next() * Math.PI * 2;
  const far = Math.max(12, s.land.open + 4) * CELL;
  const x = Math.max(CELL, Math.min((s.land.w - 1) * CELL, c.x + Math.cos(a) * far));
  const y = Math.max(CELL, Math.min((s.land.h - 1) * CELL, c.y + Math.sin(a) * far));
  // (it circles over the town: somewhere near the camp)
  const hx = c.x + g.range(-5, 5) * CELL;
  const hy = c.y + g.range(-5, 5) * CELL;
  const r: Roamer = { id: s.nextId++, kind: 'sky', group: { ...chosen }, x, y, homeX: hx, homeY: hy, tx: hx, ty: hy, until: s.tick + Math.round(g.range(SKY_HUNT_HOURS[0], SKY_HUNT_HOURS[1]) * TICKS_PER_HOUR), chasing: null, dir: 1, flying: true, hurt: 0 };
  (s.roamers ??= []).push(r);
  const names = Object.keys(chosen).map((id) => ENEMIES[id].name.toLowerCase());
  notify(s, `Wings over the town: ${names.join(' and ')} ${Object.values(chosen).reduce((n, k) => n + k, 0) > 1 ? 'are' : 'is'} hunting from the sky!`, true);
  return r;
}

/** Whoever can shoot at a hunter over the town: the defence engines, and anyone at home with a bow, a gun or a
 *  spell, within reach of it. */
function shooters(s: GameState, r: Roamer): number {
  const reach = VOLLEY_CELLS * CELL;
  let n = 0;
  for (const b of s.buildings) {
    if (b.status !== 'done' || !defOf(b).defense) continue;
    const c = buildingCentre(b);
    if (Math.hypot(c.x - r.x, c.y - r.y) <= reach) n++;
  }
  for (const p of s.people) {
    if (p.away !== null || p.downed || isChild(p) || p.skirmish !== undefined || p.task?.type === 'sleep') continue;
    if (!aims(p)) continue;
    if (Math.hypot(p.x - r.x, (p.y ?? 0) - r.y) <= reach) n++;
  }
  return n;
}
const aims = (p: Person) => {
  const w = p.gear?.weapon;
  return (!!w && /bow|sling|gun|rifle|musket|pistol|crossbow|javelin|blaster|laser|wand|staff/.test(w)) || p.cls === 'mage';
};

/** Every few seconds: the town shoots at the hunters over it; hurt enough they fly off, struck down they fall. */
export function skyVolley(s: GameState): void {
  if (s.tick % VOLLEY_TICKS !== 0 || !s.roamers?.length) return;
  for (const r of [...s.roamers]) {
    if (!r.flying || r.fighting !== undefined) continue;
    const n = shooters(s, r);
    if (!n) continue;
    const g = roll(s, 'volley', r.id, s.tick);
    let hits = 0;
    for (let i = 0; i < n; i++) if (g.chance(VOLLEY_HIT)) hits++;
    if (!hits) continue;
    r.hurt = Math.min(1, (r.hurt ?? 0) + hits * VOLLEY_HURT);
    const name = Object.keys(r.group).map((id) => ENEMIES[id].name.toLowerCase()).join(' and ');
    if (r.hurt >= 1) {
      s.roamers = s.roamers.filter((q) => q !== r);
      const loot: Record<string, number> = {};
      for (const [id, k] of Object.entries(r.group)) for (const [m, q] of Object.entries(ENEMIES[id].loot)) loot[m] = (loot[m] ?? 0) + (q ?? 0) * k;
      depositNear(s, { x: r.x, y: r.y }, loot);
      notify(s, `The town's shooting brings down the ${name} out of the sky.`, true);
    } else if (r.hurt >= FLEE_AT) {
      r.until = s.tick;
      r.chasing = null;
      r.homeX = r.x + (r.x - campXY(s).x) * 4;
      r.homeY = r.y + (r.y - campXY(s).y) * 4;
      notify(s, `Wounded by the town's shooting, the ${name} ${Object.values(r.group).reduce((a, b) => a + b, 0) > 1 ? 'fly' : 'flies'} off.`);
    }
  }
}

/** Every tick: the pirates' ship drops them in on time, and the town shoots at what hunts over it. */
export function skiesTick(s: GameState): void {
  if (s.skies?.pirates && s.tick >= s.skies.pirates.at && s.tick % 10 === 0) dropIn(s);
  skyVolley(s);
}
