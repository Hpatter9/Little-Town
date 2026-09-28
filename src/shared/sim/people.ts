// What people do each tick: pick a task, walk to it, work it.
// Order: needs (eat, sleep) > put away what you carry (to a blueprint that needs it, else storage) > jobs by the person's priorities (High, Normal, Low;
// within a level: haul, construct, research, gather) > loaf around camp.

import { ADJACENT_TILES, NEAR_SOURCE, NEAR_SOURCE_BONUS } from '../data/buildings';
import { TILE } from '../constants';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../data/materials';
import { BEDROLL_SLEEP, ITEM_BY_ID } from '../data/items';
import { FOOD_VALUE, JOBS, type Job } from '../data/people';
import { RESEARCH_STATIONS, TOPIC_BY_ID } from '../data/research';
import { skillSpeed } from '../data/skills';
import { TERRAIN } from '../data/terrain';
import type { Rng } from '../rng';
import { BUILDING_BY_ID } from '../data/buildings';
import { buildingCentreX, defOf, stillNeeded, storageFree, storages } from './buildings';
import { craftNeeded, craftSeconds, finishPiece, hasBedroll, missingItems, pickTool, stationFor, takeItemInputs, toolSpeed } from './crafting';
import { leaveX } from './breaks';
import { onBuilt } from './era';
import { doomForage } from './doom';
import { biomeOf } from '../data/biomes';
import { HORSE_HP } from '../data/trade';
import { offerBloodRite, offerMoonRite } from './occult';
import { cropOf, fieldToWork, isField, mineToWork, workField, workMine } from './farming';
import { fightFire, fireToFight } from './fire';
import { defenderAttack, defenderReach, nearestRaider, rallyX } from './raids';
import { freeStation, modifiers, researchStations, studyingAt, topicFor } from './research';
import { remember, addStock, campX, BUILD_MULTIPLIER, carryCapacity, ERA_MULTIPLIER, notify, RESEARCH_MULTIPLIER, poolSize, tileCentreX, type Building, type GameState, type Person, type Task } from './state';
import { calendar, TICK_HZ, TICKS_PER_HOUR } from './time';
import { stabilize } from './health';
import { drainNeeds, gainSkill, GROUND_SLEEP, HUNGRY, SLEEP_PER_HOUR, SULK_MORALE, wantsSleep, wantsToWake, workFactor } from './townsfolk';

/** Walking speed in world pixels per second. */
export const WALK_SPEED = 48;
const STEP = WALK_SPEED / TICK_HZ;
/** XP per unit gathered, and per second of building or research work. */
const GATHER_XP = 10;
const BUILD_XP_PER_SEC = 2;
const CRAFT_XP_PER_SEC = 2;
const RESEARCH_XP_PER_SEC = 2;
/** How far from camp an idle person wanders, in tiles. */
const WANDER_TILES = 3;
/** Each extra person on the same site or topic adds this fraction of the one before (diminishing returns). */
const STACKING = 0.7;
/** At most this many people gather one tile. */
const MAX_PER_TILE = 2;
/** Long tasks are reconsidered this often, in case something more urgent came up. */
const RECHECK_TICKS = 5 * TICK_HZ;
/** Extra damage for a defender on horseback. */
const CAVALRY_DAMAGE = 4;
/** Someone with nothing to do looks for work this often. */
const LOOK_TICKS = TICK_HZ;
const EAT_TICKS = 3 * TICK_HZ;
/** Wall repair: HP per second at skill speed 1. */
const REPAIR_HP_PER_SEC = 8;
/** Tending the bleeding: seconds of work per attempt at skill speed 1 (a quarter of a game hour), Medicine XP
 *  per second, the chance an attempt works (by Medicine level), and the time a failed attempt costs the patient. */
/** Materials that are never dropped for want of storage room (there's only one, and a lot hangs on it). */
const PRECIOUS: Material[] = ['totem'];
/** Picking one wild berry to eat (seconds at skill speed 1): quick, it's what's to hand. */
const SCROUNGE_SECONDS = 4;
const TEND_SECONDS = 15;
const TEND_XP_PER_SEC = 3;
const tendChance = (medicine: number) => Math.min(0.9, 0.2 + 0.08 * medicine);
const TEND_SETBACK_TICKS = TICKS_PER_HOUR / 4;
/** Each level of Medicine counts as being this much nearer, when working out who goes to tend someone. */
const TEND_SKILL_PX = 40;
/** Ticks between a defender's strikes. */
const DEFEND_INTERVAL = Math.round(1.2 * TICK_HZ);

/** Per-tick bookkeeping shared by everyone updated this tick (work stacking). */
export interface TickContext {
  workers: Map<string, number>;
}

export function newTickContext(): TickContext {
  return { workers: new Map() };
}

/** Diminishing-returns factor for the next worker on `key` this tick. */
function stackFactor(ctx: TickContext, key: string): number {
  const n = ctx.workers.get(key) ?? 0;
  ctx.workers.set(key, n + 1);
  return STACKING ** n;
}

export function updatePerson(s: GameState, p: Person, rng: Rng, ctx: TickContext): void {
  drainNeeds(p, p.task?.type === 'sleep' && p.activity === 'sleep');

  if (p.task && !stillValid(s, p, p.task)) p.task = null;
  const loafing = !p.task || p.task.type === 'wander' || p.task.type === 'idle';
  // someone loafing looks for work once a second (not every tick); anyone else rechecks now and then
  if ((loafing && (!p.task || (s.tick + p.id) % LOOK_TICKS === 0)) || (s.tick + p.id) % RECHECK_TICKS === 0) {
    // Switch only to something strictly more urgent, so ongoing work isn't restarted.
    const next = chooseTask(s, p);
    if (next && (loafing || rank(next, p) < rank(p.task!, p))) p.task = next;
  }
  if (!p.task) p.task = { type: 'wander', targetX: campX(s) + rng.range(-WANDER_TILES, WANDER_TILES) * TILE };

  const task = p.task;
  switch (task.type) {
    case 'wander':
      if (walkTo(p, task.targetX)) p.task = { type: 'idle', untilTick: s.tick + rng.int(4, 12) * TICK_HZ };
      break;
    case 'idle':
      p.activity = 'idle';
      if (s.tick >= task.untilTick) p.task = null;
      break;
    case 'gather':
      if (walkTo(p, tileCentreX(task.tile))) {
        if (task.scrounge) scrounge(s, p, task);
        else workGather(s, p, task, rng);
      }
      break;
    case 'store': {
      const st = byId(s, task.building)!;
      if (!walkTo(p, buildingCentreX(st))) break;
      for (const m of MATERIALS) {
        const n = Math.min(p.carrying[m] ?? 0, storageFree(s, st));
        if (n > 0) {
          addStock(st.store, m, n);
          addStock(p.carrying, m, -n);
        }
      }
      p.task = null;
      break;
    }
    case 'fetch': {
      const from = byId(s, task.from)!;
      if (!walkTo(p, buildingCentreX(from))) break;
      for (const m of MATERIALS) {
        const n = Math.min(task.amounts[m] ?? 0, from.store[m] ?? 0, carryCapacity(s, p) - poolSize(p.carrying));
        if (n > 0) {
          addStock(from.store, m, -n);
          addStock(p.carrying, m, n);
        }
      }
      p.task = { type: 'deliver', building: task.building };
      break;
    }
    case 'deliver': {
      const site = byId(s, task.building)!;
      if (!walkTo(p, buildingCentreX(site))) break;
      const need = stillNeeded(site);
      for (const m of MATERIALS) {
        const n = Math.min(p.carrying[m] ?? 0, need[m] ?? 0);
        if (n > 0) {
          addStock(site.delivered, m, n);
          addStock(p.carrying, m, -n);
        }
      }
      p.task = null; // anything left over gets stored next
      break;
    }
    case 'build': {
      const site = byId(s, task.building)!;
      if (!walkTo(p, buildingCentreX(site))) break;
      if (p.activity !== 'build') pickTool(s, p, 'construct');
      p.activity = 'build';
      const speed = skillSpeed(p.skills.construction.level) * toolSpeed(p, 'construct') * workFactor(s, p) * stackFactor(ctx, `b${site.id}`);
      site.progress += speed / (defOf(site).buildSeconds * BUILD_MULTIPLIER[s.era] * TICK_HZ);
      gainSkill(p, 'construction', BUILD_XP_PER_SEC / TICK_HZ);
      if (site.progress >= 1) {
        site.progress = 1;
        site.status = 'done';
        site.delivered = {}; // used up
        if (defOf(site).hp) site.hp = defOf(site).hp;
        p.task = null;
        notify(s, `Finished building: ${defOf(site).name}`, true);
        onBuilt(s, site);
      }
      break;
    }
    case 'repair': {
      const wall = byId(s, task.building)!;
      if (!walkTo(p, buildingCentreX(wall))) break;
      if (p.activity !== 'build') pickTool(s, p, 'construct');
      p.activity = 'build';
      const max = defOf(wall).hp ?? 0;
      wall.hp = Math.min(max, (wall.hp ?? 0) + (REPAIR_HP_PER_SEC * skillSpeed(p.skills.construction.level) * toolSpeed(p, 'construct') * workFactor(s, p)) / TICK_HZ);
      gainSkill(p, 'construction', BUILD_XP_PER_SEC / TICK_HZ);
      if (wall.hp >= max) p.task = null;
      break;
    }
    case 'research':
      workResearch(s, p, task);
      break;
    case 'craft':
      doCraft(s, p, task, rng);
      break;
    case 'farm': {
      const field = byId(s, task.building)!;
      if (!walkTo(p, buildingCentreX(field))) break;
      p.activity = 'forage';
      if (workField(s, p, field)) p.task = null;
      break;
    }
    case 'extinguish': {
      const b = byId(s, task.building);
      if (!b) {
        p.task = null;
        break;
      }
      if (!walkTo(p, buildingCentreX(b))) break;
      p.activity = 'build';
      if (fightFire(s, p, b)) p.task = null;
      break;
    }
    case 'mine': {
      const mine = byId(s, task.building)!;
      if (!walkTo(p, buildingCentreX(mine))) break;
      if (p.activity !== 'mine') pickTool(s, p, 'mine');
      p.activity = 'mine';
      if (workMine(s, p, mine, task)) p.task = null; // off to store the load
      break;
    }
    case 'eat':
      doEat(s, p, task);
      break;
    case 'sleep':
      doSleep(s, p, task);
      break;
    case 'defend':
      doDefend(s, p, task, rng);
      break;
    case 'patrol':
      if (walkTo(p, task.targetX)) p.task = null; // then back the other way
      break;
    case 'tend':
      doTend(s, p, task, rng);
      break;
    case 'shelter': {
      const bed = p.bed === null ? undefined : byId(s, p.bed);
      if (!walkTo(p, bed ? buildingCentreX(bed) : campX(s))) break;
      p.activity = bed ? 'sleep' : 'idle'; // inside, out of sight; or huddled by the fire
      break;
    }
  }
}

/* ------------------------------------------------------------ the wounded */

/** Someone bleeding in town that `p` should go and tend: the nearest nobody else is seeing to. */
function patientFor(s: GameState, p: Person): Person | undefined {
  if (p.downed || p.bornTick != null || p.away !== null) return undefined;
  const bleeding = s.people.filter((q) => q !== p && q.away === null && q.downed?.bleedUntil != null);
  if (!bleeding.length) return undefined;
  return bleeding.filter((q) => !closerTender(s, p, q)).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
}

/** How well placed someone is to tend a patient (lower is better): distance, less a head start for skill. */
const tendCost = (p: Person, patient: Person) => Math.abs(p.x - patient.x) - p.skills.medicine.level * TEND_SKILL_PX;

/** Someone other than `p` is already on their way to `patient`, and better placed (nearer, or handier). */
function closerTender(s: GameState, p: Person, patient: Person): boolean {
  const mine = tendCost(p, patient);
  return s.people.some((q) => {
    if (q === p || q.task?.type !== 'tend' || q.task.patient !== patient.id) return false;
    const theirs = tendCost(q, patient);
    return theirs < mine || (theirs === mine && q.id < p.id); // (a tie goes to the lower id, so one of them stays)
  });
}

/** Kneel by the wounded and try to stop the bleeding. A dressing from storage always works; otherwise it's down
 *  to skill, and a failed try opens the wound further. */
function doTend(s: GameState, p: Person, task: Extract<Task, { type: 'tend' }>, rng: Rng): void {
  const q = s.people.find((x) => x.id === task.patient);
  if (!q?.downed || q.downed.bleedUntil === null) {
    p.task = null;
    return;
  }
  if (!walkTo(p, q.x)) return;
  p.dir = q.x >= p.x ? 1 : -1;
  p.activity = 'forage';
  task.progress += (skillSpeed(p.skills.medicine.level) * workFactor(s, p)) / (TEND_SECONDS * TICK_HZ);
  gainSkill(p, 'medicine', TEND_XP_PER_SEC / TICK_HZ);
  if (task.progress < 1) return;
  task.progress = 0;
  const dressing = (s.items.bandage ?? 0) > 0 ? 'bandage' : (s.items.poultice ?? 0) > 0 ? 'poultice' : null;
  if (dressing) s.items[dressing] -= 1;
  if (dressing || rng.chance(tendChance(p.skills.medicine.level))) {
    stabilize(q);
    notify(s, `${p.name} stopped ${q.name}'s bleeding${dressing ? ` with a ${dressing}` : ''}.`);
    p.task = null;
    return;
  }
  q.downed.bleedUntil -= TEND_SETBACK_TICKS;
  notify(s, `${p.name} couldn't stop ${q.name}'s bleeding, and the wound tore wider. They keep trying.`);
}

/* ------------------------------------------------------------ raids */

/** The alarm has gone up: raiders are on their way (and it's not being paid off) or already here. */
export const alarmRaised = (s: GameState) => {
  const r = s.raid;
  if (!r || (r.phase !== 'active' && r.prompt !== null)) return false;
  // once every raider left is running off empty-handed, the town comes out again (to tend the wounded, put out
  // fires...); thieves and kidnappers are still chased
  return r.phase !== 'active' || r.raiders.some((rd) => !rd.ally && !rd.down && !rd.gone && (!rd.fleeing || !!rd.captive || poolSize(rd.carrying) > 0));
};

/** Patrol shifts (DESIGN §10): with a Barracks, guards on Defend High take day or night shifts (by turns). */
export function onShift(s: GameState, p: Person): boolean {
  if (p.priorities.defend !== 1 || p.bornTick != null) return false;
  if (!s.buildings.some((b) => b.def === 'barracks' && b.status === 'done')) return false;
  const h = calendar(s.tick).hour;
  const day = h >= 6 && h < 18;
  return (p.id % 2 === 0) === day;
}

/** The far end of the built town from where a guard is. */
function patrolEnd(s: GameState, p: Person): number {
  const xs = s.buildings.filter((b) => b.status === 'done').map((b) => buildingCentreX(b));
  const lo = Math.min(...xs) - TILE;
  const hi = Math.max(...xs) + TILE;
  return Math.abs(p.x - lo) > Math.abs(p.x - hi) ? lo : hi;
}

/** Cavalry (DESIGN §10): the fit horses at home carry the first defenders on High into a fight. Horse coat by rider. */
export function cavalry(s: GameState): Map<number, number> {
  const out = new Map<number, number>();
  if (!s.raid) return out;
  const horses = s.horses.filter((h) => h.hp >= HORSE_HP / 2);
  const riders = s.people.filter((p) => p.away === null && !p.downed && p.task?.type === 'defend' && p.priorities.defend === 1).sort((a, b) => a.id - b.id);
  riders.slice(0, horses.length).forEach((p, i) => out.set(p.id, horses[i].coat));
  return out;
}

function doDefend(s: GameState, p: Person, task: Extract<Task, { type: 'defend' }>, rng: Rng): void {
  const rd = nearestRaider(s, p.x);
  const mounted = cavalry(s).has(p.id);
  if (!rd) {
    if (walkTo(p, rallyX(s)) || (mounted && walkTo(p, rallyX(s)))) p.activity = 'idle'; // wait for them at the edge of camp
    return;
  }
  const reach = defenderReach(p);
  const gap = rd.x - p.x;
  if (Math.abs(gap) > reach) {
    // riders cover ground twice as fast
    if (!walkTo(p, rd.x - Math.sign(gap) * (reach - 4)) && mounted) walkTo(p, rd.x - Math.sign(gap) * (reach - 4));
    return;
  }
  p.dir = gap >= 0 ? 1 : -1;
  p.activity = 'fight';
  if (--task.cooldown > 0) return;
  task.cooldown = DEFEND_INTERVAL;
  defenderAttack(s, p, rd, rng, mounted ? CAVALRY_DAMAGE : 0);
}

/* ------------------------------------------------------------ work */

function doCraft(s: GameState, p: Person, task: Extract<Task, { type: 'craft' }>, rng: Rng): void {
  const o = s.crafting.find((q) => q.id === task.order)!;
  const def = ITEM_BY_ID[o.item];
  const station = stationFor(s, def)!;
  // a commission: the crafter takes it on from whoever asked (once)
  if (o.for && !(o.for.told ?? []).includes(p.id)) {
    (o.for.told ??= []).push(p.id);
    const keeper = s.people.find((q) => q.id === o.for!.by);
    const place = s.buildings.find((b) => b.status === 'done' && BUILDING_BY_ID[b.def]?.floor?.venue === o.for!.venue);
    const where = place ? `the ${BUILDING_BY_ID[place.def].name}` : `the ${o.for.venue}`;
    remember(s, p, `Took an order${keeper ? ` from ${keeper.name}` : ''}: a ${def.name} for ${where}, for ${o.for.pay} coins`);
    if (keeper && keeper !== p) remember(s, keeper, `Asked ${p.name} to make a ${def.name} for ${o.for.pay} coins`);
  }
  switch (task.phase) {
    case 'fetch': {
      const from = task.from === null ? undefined : byId(s, task.from);
      if (!from) {
        p.task = null;
        return;
      }
      if (!walkTo(p, buildingCentreX(from))) return;
      const need = craftNeeded(o);
      for (const m of MATERIALS) {
        const n = Math.min((need[m] ?? 0) - (p.carrying[m] ?? 0), from.store[m] ?? 0, carryCapacity(s, p) - poolSize(p.carrying));
        if (n > 0) {
          addStock(from.store, m, -n);
          addStock(p.carrying, m, n);
        }
      }
      task.phase = 'deliver';
      return;
    }
    case 'deliver': {
      if (!walkTo(p, buildingCentreX(station))) return;
      const need = craftNeeded(o);
      for (const m of MATERIALS) {
        const n = Math.min(p.carrying[m] ?? 0, need[m] ?? 0);
        if (n > 0) {
          addStock(o.delivered, m, n);
          addStock(p.carrying, m, -n);
        }
      }
      if (poolSize(craftNeeded(o)) > 0) p.task = null; // more to fetch (chosen again next)
      else task.phase = 'work';
      return;
    }
    case 'work': {
      if (!walkTo(p, buildingCentreX(station))) return;
      if (!takeItemInputs(s, o)) {
        p.task = null;
        return;
      }
      p.activity = 'build';
      // a steam factory speeds every station's work
      const built = (id: string) => s.buildings.some((b) => b.def === id && b.status === 'done');
      const factory = (built('factory') ? 2 : 1) * (built('fusion_reactor') ? 1.5 : 1);
      const speed = skillSpeed(p.skills.crafting.level) * workFactor(s, p) * factory * nearSource(s, station);
      o.progress += speed / (craftSeconds(def, s.era) * TICK_HZ);
      gainSkill(p, 'crafting', CRAFT_XP_PER_SEC / TICK_HZ);
      if (o.progress >= 1) {
        finishPiece(s, o, p, rng);
        p.task = null;
      }
      return;
    }
  }
}

/** Study at one's own station (one person to each), on a topic of one's own where there is one. */
function workResearch(s: GameState, p: Person, task: Extract<Task, { type: 'research' }>): void {
  const r = s.research;
  const building = task.station != null ? byId(s, task.station) : undefined;
  const at = building ? buildingCentreX(building) : campX(s);
  // (a topic finished by someone else, or cancelled: on to the next)
  if (!task.topic || !r.queue.includes(task.topic)) task.topic = topicFor(s, p);
  if (!task.topic) {
    p.task = null;
    return;
  }
  if (!walkTo(p, at)) return;
  p.activity = 'research';
  const topic = TOPIC_BY_ID[task.topic];
  const mult = building ? (RESEARCH_STATIONS[building.def]?.mult ?? 1) : 1;
  const speed = skillSpeed(p.skills.research.level) * mult * modifiers(r).researchSpeed * workFactor(s, p);
  r.progress[topic.id] = (r.progress[topic.id] ?? 0) + speed / (topic.seconds * RESEARCH_MULTIPLIER[s.era] * TICK_HZ);
  gainSkill(p, 'research', RESEARCH_XP_PER_SEC / TICK_HZ);
  if (r.progress[topic.id] < 1) return;

  delete r.progress[topic.id];
  r.queue = r.queue.filter((id) => id !== topic.id);
  r.done.push(topic.id);
  notify(s, `Research complete: ${topic.name}`, true);
  if (topic.id === 'blood_rite') offerBloodRite(s);
  if (topic.id === 'moon_rite') offerMoonRite(s);
  if (topic.effects.some((e) => e.type === 'eraCapstone')) {
    s.eraReady = true;
    notify(
      s,
      s.era === 'neolithic' ? 'The elders have gathered. Build the Elder Lodge to begin a new era.' : 'The town is granted its charter. Build the Town Hall to begin a new era.',
      true,
    );
  }
  p.task = null;
}

/** A workshop near the source of its raw material (a smithy by the mine) works faster. */
function nearSource(s: GameState, station: Building): number {
  const sources = NEAR_SOURCE[station.def];
  if (!sources) return 1;
  const near = s.buildings.some((b) => b.status === 'done' && sources.includes(b.def) && Math.abs(b.tile - station.tile) <= ADJACENT_TILES);
  return near ? NEAR_SOURCE_BONUS : 1;
}

function workGather(s: GameState, p: Person, task: Extract<Task, { type: 'gather' }>, rng: Rng): void {
  const tile = s.tiles[task.tile];
  const def = TERRAIN[tile.terrain as keyof typeof TERRAIN];
  if (p.activity !== def.anim) pickTool(s, p, def.anim);
  p.activity = def.anim;
  const speed = skillSpeed(p.skills.gathering.level) * modifiers(s.research).gather[def.anim] * toolSpeed(p, def.anim) * workFactor(s, p) * (def.anim === 'forage' ? doomForage(s) * biomeOf(s).forage : 1);
  // (foraging is food: people eat on the same clock in every era, so it isn't stretched)
  task.progress += speed / (def.secondsPerUnit * (def.anim === 'forage' ? 1 : ERA_MULTIPLIER[s.era]) * TICK_HZ);
  while (task.progress >= 1 && p.task === task) {
    task.progress -= 1;
    gatherUnit(s, p, task.tile, rng);
    if (poolSize(p.carrying) >= carryCapacity(s, p)) p.task = null; // hands full: go store it
  }
}

/** Hungry with nothing in storage: pick the wild berries off a tile (the trees stay standing), then eat them. */
function scrounge(s: GameState, p: Person, task: Extract<Task, { type: 'gather' }>): void {
  const tile = s.tiles[task.tile];
  p.activity = 'forage';
  task.progress += (skillSpeed(p.skills.gathering.level) * doomForage(s) * biomeOf(s).forage) / (SCROUNGE_SECONDS * TICK_HZ);
  if (task.progress < 1) return;
  task.progress = 0;
  addStock(tile.pool, 'berries', -1);
  addStock(p.carrying, 'berries', 1);
  gainSkill(p, 'gathering', GATHER_XP);
  // (picked bare, with nothing else left on it: the tile is clear now)
  if (poolSize(tile.pool) === 0) {
    tile.terrain = 'clear';
    tile.designated = false;
    s.tileRev++;
  }
  // eat on the spot once there's enough for a meal, or once the bush is bare
  if ((tile.pool.berries ?? 0) <= 0 || (p.carrying.berries ?? 0) >= 2) {
    const n = p.carrying.berries ?? 0;
    p.needs.food = Math.min(1, p.needs.food + n * FOOD_VALUE.berries!);
    addStock(p.carrying, 'berries', -n);
    p.task = null;
  }
}

/** The nearest tile with wild berries on it (for someone about to starve), if any. */
function wildFood(s: GameState, p: Person): number | null {
  let best: number | null = null;
  s.tiles.forEach((t, i) => {
    if ((t.pool.berries ?? 0) > 0 && (best === null || Math.abs(tileCentreX(i) - p.x) < Math.abs(tileCentreX(best) - p.x))) best = i;
  });
  return best;
}

/** Take one unit from the tile's pool (weighted by what's left). Clears the tile when the pool runs out. */
function gatherUnit(s: GameState, p: Person, tileIndex: number, rng: Rng): void {
  const tile = s.tiles[tileIndex];
  const entries = (Object.entries(tile.pool) as [Material, number][]).filter(([, n]) => n > 0);
  if (!entries.length) {
    // (nothing left on it after all: it's clear)
    tile.terrain = 'clear';
    tile.designated = false;
    p.task = null;
    s.tileRev++;
    return;
  }
  let r = rng.next() * poolSize(tile.pool);
  let pick = entries[entries.length - 1][0];
  for (const [m, n] of entries) {
    if ((r -= n) < 0) {
      pick = m;
      break;
    }
  }
  addStock(tile.pool, pick, -1);
  addStock(p.carrying, pick, 1);
  gainSkill(p, 'gathering', GATHER_XP);

  if (poolSize(tile.pool) === 0) {
    tile.terrain = 'clear';
    tile.designated = false;
    p.task = null;
    p.activity = 'idle';
    s.tileRev++;
  }
}

/* ------------------------------------------------------------ needs */

function doEat(s: GameState, p: Person, task: Extract<Task, { type: 'eat' }>): void {
  const st = byId(s, task.building)!;
  if (!walkTo(p, buildingCentreX(st))) return;
  if (task.until === null) {
    const food = foodIn(st);
    if (!food) {
      p.task = null;
      return;
    }
    addStock(st.store, food, -1);
    p.needs.food = Math.min(1, p.needs.food + FOOD_VALUE[food]!);
    task.until = s.tick + EAT_TICKS;
  }
  p.activity = 'eat';
  if (s.tick >= task.until) p.task = null;
}

function doSleep(s: GameState, p: Person, task: Extract<Task, { type: 'sleep' }>): void {
  const bed = task.building === null ? undefined : byId(s, task.building);
  if (!walkTo(p, bed ? buildingCentreX(bed) : campX(s) - TILE)) return;
  p.activity = 'sleep';
  const bedroll = !bed && hasBedroll(s, p);
  p.needs.rest = Math.min(1, p.needs.rest + (SLEEP_PER_HOUR * (bed ? 1 : bedroll ? BEDROLL_SLEEP : GROUND_SLEEP)) / TICKS_PER_HOUR);
  if (wantsToWake(s, p)) {
    p.lastSlept = bed ? 'bed' : bedroll ? 'bedroll' : 'ground';
    p.task = null;
    p.activity = 'idle';
  }
}

const FOODS = Object.keys(FOOD_VALUE) as Material[];
const foodIn = (b: Building): Material | undefined => FOODS.find((m) => (b.store[m] ?? 0) > 0);

/* ------------------------------------------------------------ choosing work */

/** How urgent a task is (lower = more urgent). Needs first, then the person's job priority. */
function rank(t: Task, p?: Person): number {
  switch (t.type) {
    case 'defend':
    case 'shelter':
      return -3;
    case 'tend':
      return -2.7;
    case 'extinguish':
      return -2.5;
    case 'eat':
    case 'sleep':
      return -2;
    case 'gather':
      if (t.scrounge) return -2; // (as urgent as eating)
      return p ? p.priorities.gather * 10 + JOBS.indexOf('gather') : 0;
    case 'store':
      return -1;
    case 'wander':
    case 'idle':
      return 99;
    default: {
      const job = jobOf(t);
      return p ? p.priorities[job] * 10 + JOBS.indexOf(job) : 0;
    }
  }
}

function jobOf(t: Task): Job {
  switch (t.type) {
    case 'build':
    case 'repair':
    case 'extinguish':
      return 'construct';
    case 'defend':
    case 'patrol':
      return 'defend';
    case 'research':
      return 'research';
    case 'gather':
    case 'mine':
      return 'gather';
    case 'craft':
      return 'craft';
    case 'farm':
      return 'farm';
    default:
      return 'haul';
  }
}

function chooseTask(s: GameState, p: Person): Task | null {
  p.blocked = false;
  // The badly hurt stay in bed until they're back on their feet.
  if (p.downed) return { type: 'sleep', building: p.bed };
  // A raid: defenders fight, everyone else shelters.
  if (alarmRaised(s)) return p.priorities.defend !== 0 ? (p.task?.type === 'defend' ? p.task : { type: 'defend', cooldown: 0 }) : { type: 'shelter' };
  // Someone is bleeding out: the nearest free hands go to them.
  const patient = patientFor(s, p);
  if (patient) return p.task?.type === 'tend' && p.task.patient === patient.id ? p.task : { type: 'tend', patient: patient.id, progress: 0 };
  // Fire! Everyone who can drops what they're doing and beats it out.
  const fire = fireToFight(s, p);
  if (fire) return p.task?.type === 'extinguish' && p.task.building === fire.id ? p.task : { type: 'extinguish', building: fire.id };
  // Walking out of town (a mental break): nothing else matters.
  if (p.breakdown?.kind === 'wander') return { type: 'wander', targetX: leaveX(p) };
  // Needs.
  if (p.task?.type === 'sleep' || wantsSleep(s, p)) return { type: 'sleep', building: p.bed };
  if (p.needs.food < HUNGRY) {
    const st = nearestStorage(s, p.x, (b) => !!foodIn(b));
    if (st) return { type: 'eat', building: st.id, until: null };
    // nothing in the stores, but food in their own hands (a harvest they couldn't put away): eat that
    const own = FOODS.find((m) => (p.carrying[m] ?? 0) > 0);
    if (own) {
      addStock(p.carrying, own, -1);
      p.needs.food = Math.min(1, p.needs.food + FOOD_VALUE[own]!);
    }
    // nothing in storage: go and find something wild to eat before they starve
    if (p.monster !== 'undead') {
      if (p.task?.type === 'gather' && p.task.scrounge) return p.task;
      const wild = wildFood(s, p);
      if (wild !== null) return { type: 'gather', tile: wild, progress: 0, scrounge: true };
    }
  }
  // Put away what you're carrying (unless it belongs to what you're doing: a gather with room left, a
  // delivery, or materials on the way to a craft station).
  const t = p.task;
  const carryingForTask =
    (t?.type === 'gather' && poolSize(p.carrying) < carryCapacity(s, p)) || t?.type === 'fetch' || t?.type === 'deliver' || (t?.type === 'craft' && t.phase !== 'work');
  let handsFull = false;
  if (poolSize(p.carrying) > 0 && !carryingForTask) {
    // Straight to a blueprint that needs it, skipping storage.
    const site = s.buildings.find((b) => b.status === 'blueprint' && MATERIALS.some((m) => (p.carrying[m] ?? 0) > 0 && (unreserved(s, p, b)[m] ?? 0) > 0));
    if (site) return { type: 'deliver', building: site.id };
    const st = nearestStorage(s, p.x, (b) => storageFree(s, b) > 0);
    if (st) return { type: 'store', building: st.id };
    // Nowhere to put it. If a blueprint is waiting on materials, leave it on the ground so hauling and
    // gathering can go on; otherwise keep holding it (building and research still work) and say so.
    // (anything precious, like the Bear Cave's totem, is never thrown away: they keep hold of it)
    const keep = PRECIOUS.filter((m) => (p.carrying[m] ?? 0) > 0);
    if (s.buildings.some((b) => b.status === 'blueprint' && poolSize(unreserved(s, p, b)) > 0) && poolSize(p.carrying) > keep.reduce((n, m) => n + p.carrying[m]!, 0)) {
      const kept = Object.fromEntries(keep.map((m) => [m, p.carrying[m]!])) as Stock;
      for (const m of keep) delete p.carrying[m];
      notify(s, `${p.name} dropped ${listCarried(p)}: no room in storage.`);
      p.carrying = kept;
      if (keep.length) {
        p.blocked = true;
        handsFull = true;
      }
    } else {
      p.blocked = true;
      handsFull = true;
    }
  }
  if (p.morale < SULK_MORALE || p.breakdown) return null; // sulking (or in the middle of a break)
  // Jobs, by the person's priorities.
  for (const level of [1, 2, 3]) {
    for (const job of JOBS) {
      if (p.priorities[job] !== level || (handsFull && (job === 'haul' || job === 'gather' || job === 'craft'))) continue;
      const t = findJob(s, p, job);
      if (t) return t;
    }
  }
  return null;
}

function findJob(s: GameState, p: Person, job: Job): Task | null {
  switch (job) {
    case 'haul':
      for (const b of s.buildings) {
        if (b.status !== 'blueprint') continue;
        const need = unreserved(s, p, b);
        if (!poolSize(need)) continue;
        const from = nearestStorage(s, p.x, (st) => (Object.keys(need) as Material[]).some((m) => (st.store[m] ?? 0) > 0));
        if (!from) continue;
        const amounts: Stock = {};
        let room = carryCapacity(s, p);
        for (const m of MATERIALS) {
          const n = Math.min(need[m] ?? 0, from.store[m] ?? 0, room);
          if (n > 0) {
            amounts[m] = n;
            room -= n;
          }
        }
        return { type: 'fetch', building: b.id, from: from.id, amounts };
      }
      return null;
    case 'construct': {
      const b = s.buildings.find((q) => q.status === 'blueprint' && poolSize(stillNeeded(q)) === 0);
      if (b) return { type: 'build', building: b.id };
      const hurt = s.raid ? undefined : s.buildings.find((q) => q.status === 'done' && q.hp !== undefined && q.hp < (defOf(q).hp ?? 0));
      return hurt ? { type: 'repair', building: hurt.id } : null;
    }
    case 'defend':
      // (fighting only happens in raids, see chooseTask; between them, guards on shift patrol)
      return onShift(s, p) ? { type: 'patrol', targetX: patrolEnd(s, p) } : null;
    case 'research': {
      // (one person to a station: with every one taken, they find other work)
      if (!s.research.queue.length) return null;
      const station = freeStation(s, p);
      return station === undefined ? null : { type: 'research', station, topic: topicFor(s, p) };
    }
    case 'gather': {
      const tile = bestGatherTile(s, p);
      if (tile !== null) return { type: 'gather', tile, progress: 0 };
      const mine = mineToWork(s, p);
      return mine ? { type: 'mine', building: mine.id, work: 0 } : null;
    }
    case 'craft':
      return findCraft(s, p);
    case 'farm': {
      const field = fieldToWork(s, p);
      return field ? { type: 'farm', building: field.id } : null;
    }
  }
}

/**
 * The first craft order someone can work on: its station is built, nobody else has it, and its item
 * ingredients are in the inventory. Fetch what's missing from the nearest store that has any, or make it.
 */
function findCraft(s: GameState, p: Person): Task | null {
  for (const o of s.crafting) {
    if (s.people.some((q) => q !== p && q.task?.type === 'craft' && q.task.order === o.id)) continue;
    if (!stationFor(s, ITEM_BY_ID[o.item]) || missingItems(s, o).length) continue;
    const need = craftNeeded(o);
    if (!poolSize(need)) return { type: 'craft', order: o.id, phase: 'work', from: null };
    // already holding some of it (say, after a nap): take it over first
    if (MATERIALS.some((m) => (need[m] ?? 0) > 0 && (p.carrying[m] ?? 0) > 0)) return { type: 'craft', order: o.id, phase: 'deliver', from: null };
    const from = nearestStorage(s, p.x, (st) => MATERIALS.some((m) => (need[m] ?? 0) > 0 && (st.store[m] ?? 0) > 0));
    if (from) return { type: 'craft', order: o.id, phase: 'fetch', from: from.id };
  }
  return null;
}

/** What a blueprint still needs that nobody else is already fetching or carrying to it. */
function unreserved(s: GameState, p: Person, b: Building): Stock {
  const need = stillNeeded(b);
  for (const o of s.people) {
    if (o === p || !o.task || !('building' in o.task) || o.task.building !== b.id) continue;
    const coming = o.task.type === 'fetch' ? o.task.amounts : o.task.type === 'deliver' ? o.carrying : {};
    for (const m of MATERIALS) if (coming[m]) addStock(need, m, -Math.min(need[m] ?? 0, coming[m]!));
  }
  return need;
}

/** The nearest marked tile, preferring ones fewer people are already working. */
function bestGatherTile(s: GameState, p: Person): number | null {
  const workers = new Map<number, number>();
  for (const o of s.people) if (o !== p && o.task?.type === 'gather') workers.set(o.task.tile, (workers.get(o.task.tile) ?? 0) + 1);
  let best: number | null = null;
  let bestCost = Infinity;
  s.tiles.forEach((t, i) => {
    if (!t.designated) return;
    const w = workers.get(i) ?? 0;
    if (w >= MAX_PER_TILE) return;
    const cost = Math.abs(tileCentreX(i) - p.x) + w * 20 * TILE;
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  });
  return best;
}

/** A task is dropped when what it works on was unmarked, demolished, finished, emptied or filled up. */
function stillValid(s: GameState, p: Person, t: Task): boolean {
  const site = 'building' in t && t.building !== null ? byId(s, t.building) : undefined;
  switch (t.type) {
    case 'gather': {
      const tile = s.tiles[t.tile];
      if (t.scrounge) return (tile.pool.berries ?? 0) > 0;
      return tile.designated && tile.terrain !== 'clear' && p.priorities.gather !== 0;
    }
    case 'store':
      return !!site && storageFree(s, site) > 0;
    case 'fetch':
      return site?.status === 'blueprint' && !!byId(s, t.from) && p.priorities.haul !== 0;
    case 'deliver':
      return site?.status === 'blueprint';
    case 'build':
      return site?.status === 'blueprint' && poolSize(stillNeeded(site)) === 0 && p.priorities.construct !== 0;
    case 'research':
      // (still their station: built, standing, and nobody else's)
      return (
        s.research.queue.length > 0 &&
        p.priorities.research !== 0 &&
        t.station !== undefined &&
        (t.station === null ? !researchStations(s).length : byId(s, t.station)?.status === 'done') &&
        !studyingAt(s, t.station, p)
      );
    case 'eat':
      return !!site;
    case 'sleep':
      return t.building === null || !!site;
    case 'defend':
      return alarmRaised(s) && p.priorities.defend !== 0 && !p.downed;
    case 'shelter':
      return alarmRaised(s);
    case 'patrol':
      return !alarmRaised(s) && onShift(s, p);
    case 'repair':
      return !!site && !s.raid && (site.hp ?? 0) < (defOf(site).hp ?? 0) && p.priorities.construct !== 0;
    case 'craft': {
      const o = s.crafting.find((q) => q.id === t.order);
      return !!o && !!stationFor(s, ITEM_BY_ID[o.item]) && p.priorities.craft !== 0;
    }
    case 'farm':
      return !!site && isField(site) && cropOf(site).stage !== 'growing' && p.priorities.farm !== 0;
    case 'mine':
      return site?.status === 'done' && p.priorities.gather !== 0;
    case 'extinguish':
      return !!site && site.fire !== undefined && !alarmRaised(s);
    case 'tend': {
      // (while the alarm is up, everyone fights or shelters: the wounded wait)
      // (and step aside if someone nearer has come to help)
      const q = s.people.find((x) => x.id === t.patient);
      return !!q?.downed && q.downed.bleedUntil !== null && q.away === null && !alarmRaised(s) && !p.downed && !closerTender(s, p, q);
    }
    default:
      return true;
  }
}

/* ------------------------------------------------------------ helpers */

/** Step toward x. Returns true once there. */
export function walkTo(p: Person, x: number): boolean {
  const d = x - p.x;
  if (Math.abs(d) <= STEP) {
    p.x = x;
    return true;
  }
  p.dir = d > 0 ? 1 : -1;
  p.x += p.dir * STEP;
  p.activity = 'walk';
  return false;
}

const listCarried = (p: Person) =>
  MATERIALS.filter((m) => (p.carrying[m] ?? 0) > 0)
    .map((m) => `${p.carrying[m]} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

function byId(s: GameState, id: number): Building | undefined {
  return s.buildings.find((b) => b.id === id);
}

function nearestStorage(s: GameState, x: number, ok: (b: Building) => boolean): Building | null {
  let best: Building | null = null;
  for (const b of storages(s)) {
    if (!ok(b)) continue;
    if (!best || Math.abs(buildingCentreX(b) - x) < Math.abs(buildingCentreX(best) - x)) best = b;
  }
  return best;
}
