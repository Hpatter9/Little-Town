// What people do each tick: pick a task, walk to it, work it.
// Order: needs (eat, sleep) > put away what you carry (to a blueprint that needs it, else storage) > jobs by the person's priorities (High, Normal, Low;
// within a level: haul, construct, research, gather) > loaf around camp.

import { RING_CLEAR_PULL } from './ringWall';
import { drinkAt, drinking } from './nightOut';
import { finishRelax, relaxSpot, relaxTicks, wantsRelax } from './leisure';
import { LEISURE } from '../data/recreation';
import { onBoard } from './tactics';
import { noteCleared } from './regrow';
import { attending, festive, gatheringPlace } from './ceremonies';
import { injuryPace } from './injuries';
import { RESEARCH_PACE } from '../data/pace';
import { rallied, RALLY_SPEED } from './rally';
import { ADJACENT_TILES, NEAR_SOURCE, NEAR_SOURCE_BONUS } from '../data/buildings';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../data/materials';
import { BEDROLL_SLEEP, ITEM_BY_ID, STATIONS } from '../data/items';
import { FOOD_VALUE, JOBS, type Job } from '../data/people';
import { eraOfResearch, RESEARCH_STATIONS, TOPIC_BY_ID } from '../data/research';
import { WORKPLACES } from '../data/crops';
import { earlier } from '../data/eras';
import { skillSpeed } from '../data/skills';
import { TERRAIN } from '../data/terrain';
import type { Rng } from '../rng';
import { BUILDING_BY_ID } from '../data/buildings';
import { nextPave, pave, paveReady, paveSeconds } from './streets';
import { guardEngages, roamerToHunt } from './roamers';
import { buildingCentre, buildingDoor, defOf, distToBuilding, footprint, stillNeeded, storageFree, storages, townRadius, inWork, overgrownCells, cellCleared } from './buildings';
import { CELL, cellAt, centreOf, groundAt, inMap, isMarked, isPlannedRoad, isRoad, setGround, type Pt, wet, setMarked } from './land';
import { walk } from './walk';
import { swims } from './sea';
import { craftNeeded, craftSeconds, finishPiece, hasBedroll, missingItems, pickTool, stationFor, takeItemInputs, toolSpeed } from './crafting';
import { leavePt } from './breaks';
import { onBuilt } from './era';
import { doomForage } from './doom';
import { biomeOf, openGround } from '../data/biomes';
import { HORSE_HP } from '../data/trade';
import { offerBloodRite, offerLichRite, offerMoonRite } from './occult';
import { cropOf, fieldSpot, fieldToWork, isField, mineToWork, workField, workMine } from './farming';
import { isPen, needsTending, penToTend, workPen } from './livestock';
import { fightFire, fireToFight } from './fire';
import { defenderAttack, defenderReach, nearestRaider, rallyPoint, townEdgeX } from './raids';
import { ENEMIES } from '../data/enemies';
import { THROW_RANGE } from '../data/raids';
import { freeStation, modifiers, researchStations, studyingAt, topicFor } from './research';
import { holderOf, holds, jobOf as heldJob } from './operators';
import { HOLDER_EDGE } from '../data/operators';
import { tireless, remember, addStock, campXY, cellXY, dist, BUILD_MULTIPLIER, carryCapacity, notify, RESEARCH_MULTIPLIER, poolSize, type Building, type GameState, type Person, type Raider, type Task } from './state';
import { calendar, TICK_HZ, TICKS_PER_HOUR } from './time';
import { stabilize } from './health';
import { mended, needsSickbed, sickbedFor } from './sickbeds';
import { drainNeeds, gainSkill, GROUND_SLEEP, HUNGRY, SLEEP_PER_HOUR, SULK_MORALE, wantsSleep, wantsToWake, workFactor } from './townsfolk';
import { buildSpeed, craftSpeed, forageSpeed, researchSpeed } from './origin';
import { accruePay, accruePayFrom, loadPrice, moneyTown, payFromTreasury } from './economy';
import { BUILD_PACE, BUILD_PER_HOUR, buildPower, HIRE_PER_HOUR, STUDY_PER_HOUR, TREASURY_KEEP } from '../data/economy';
import { canWork, skillPace } from './property';
import { isChild } from './social';
import { pastimeFor } from './pastimes';

/** Walking speed in world pixels per second. */
export const WALK_SPEED = 48;
const STEP = WALK_SPEED / TICK_HZ;
/** XP per unit gathered, and per second of building or research work. */
const GATHER_XP = 10;
const BUILD_XP_PER_SEC = 2;
const CRAFT_XP_PER_SEC = 2;
const RESEARCH_XP_PER_SEC = 2;
/** How far from camp an idle person wanders, in cells. */
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
export const DEFEND_INTERVAL = Math.round(1.2 * TICK_HZ);

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
  // (in a fight with a band out on the land: they stand and fight it out, sim/roamers.ts)
  if (p.skirmish !== undefined) {
    p.task = null;
    p.activity = 'fight';
    return;
  }

  if (p.task && !stillValid(s, p, p.task)) p.task = null;
  // (laying a street is spare-time work: any other work comes first, sim/streets.ts)
  const loafing = !p.task || p.task.type === 'wander' || p.task.type === 'idle' || p.task.type === 'pave';
  // someone loafing looks for work once a second (not every tick); anyone else rechecks now and then
  if ((loafing && (!p.task || (s.tick + p.id) % LOOK_TICKS === 0)) || (s.tick + p.id) % RECHECK_TICKS === 0) {
    // Switch only to something strictly more urgent, so ongoing work isn't restarted.
    const next = chooseTask(s, p);
    if (next && (loafing || rank(next, p) < rank(p.task!, p))) p.task = next;
  }
  if (!p.task) {
    // (nothing to do: a stretch of street to lay, sim/streets.ts; a break at a place of leisure with a spot free, else
    // a wander about the camp: sim/leisure.ts)
    const spot = wantsRelax(s, p, true);
    const cell = !spot && !s.raid && p.priorities.construct !== 0 && !isChild(p) ? nextPave(s, p) : null;
    if (cell !== null) p.task = { type: 'pave', cell, progress: 0 };
    else if (spot) p.task = { type: 'relax', building: spot.id, until: s.tick + relaxTicks(spot) };
    else {
      const c = campXY(s);
      p.task = { type: 'wander', targetX: c.x + rng.range(-WANDER_TILES, WANDER_TILES) * CELL, targetY: c.y + rng.range(-WANDER_TILES, WANDER_TILES) * CELL };
      // (a child off to play, an elder to sit by the fire, a couple walking out of an evening: sim/pastimes.ts)
      const pt = pastimeFor(s, p, Math.floor(s.tick / (8 * TICK_HZ)));
      if (pt) p.task = { type: 'wander', targetX: pt.x, targetY: pt.y, pastime: pt.pastime };
    }
  }

  const task = p.task;
  switch (task.type) {
    case 'wander':
      if (goTo(s, p, { x: task.targetX, y: task.targetY })) p.task = { type: 'idle', untilTick: s.tick + rng.int(4, 12) * TICK_HZ, pastime: task.pastime };
      break;
    case 'idle':
      p.activity = task.pastime ?? 'idle';
      if (s.tick >= task.untilTick) p.task = null;
      break;
    case 'gather':
      if (goTo(s, p, cellXY(s, task.tile))) {
        if (task.scrounge) scrounge(s, p, task);
        else workGather(s, p, task, rng);
      }
      break;
    case 'store': {
      const st = byId(s, task.building)!;
      if (!goToB(s, p, st)) break;
      const sold: Stock = {};
      for (const m of MATERIALS) {
        const n = Math.min(p.carrying[m] ?? 0, storageFree(s, st));
        if (n > 0) {
          addStock(st.store, m, n);
          addStock(p.carrying, m, -n);
          sold[m] = n;
        }
      }
      // (what they bring in they sell to the town there and then: data/economy.ts)
      if (moneyTown(s) && !isChild(p)) {
        const price = loadPrice(s, sold);
        if (price > 0) payFromTreasury(s, p, price, 'wages', `Sold ${Object.entries(sold).map(([m, n]) => `${n} ${MATERIAL_NAMES[m as Material].toLowerCase()}`).join(', ')} to the stores (${Math.min(price, Math.max(0, (s.coins ?? 0) - TREASURY_KEEP))} coins)`);
      }
      p.task = null;
      break;
    }
    case 'fetch': {
      const from = byId(s, task.from)!;
      if (!goToB(s, p, from)) break;
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
      if (!goToB(s, p, site)) break;
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
      if (!goToB(s, p, site)) break;
      if (p.activity !== 'build') pickTool(s, p, 'construct');
      p.activity = 'build';
      // (a steep curve by skill, and slower than it was: data/economy.ts)
      const speed = buildPower(p.skills.construction.level) * skillPace(s, p, site) * toolSpeed(p, 'construct') * workFactor(s, p) * stackFactor(ctx, `b${site.id}`);
      site.progress += (speed * buildSpeed(s)) / (defOf(site).buildSeconds * BUILD_PACE * BUILD_MULTIPLIER[earlier(s.era, eraOfResearch(defOf(site).research))] * TICK_HZ);
      gainSkill(p, 'construction', BUILD_XP_PER_SEC / TICK_HZ);
      // (paid by the hour: by the treasury for its works, by the owner for theirs; an owner works for nothing)
      if (site.owner === undefined) accruePay(s, p, BUILD_PER_HOUR, 'wages', 'building', TICKS_PER_HOUR);
      else if (site.owner !== p.id) {
        const owner = s.people.find((q) => q.id === site.owner);
        if (owner) accruePayFrom(s, owner, p, HIRE_PER_HOUR, `building for ${owner.name}`, TICKS_PER_HOUR);
      }
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
    case 'pave': {
      // (stood on the cell, or beside it on the bank for a bridge)
      const c = cellAt(s.land, task.cell);
      let at = centreOf(c.x, c.y);
      if (wet(groundAt(s.land, c.x, c.y))) {
        const bank = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).find((q) => inMap(s.land, q.x, q.y) && (isRoad(s.land, q.x, q.y) || !wet(groundAt(s.land, q.x, q.y))));
        if (bank) at = centreOf(bank.x, bank.y);
      }
      if (!goTo(s, p, at)) break;
      if (p.activity !== 'build') pickTool(s, p, 'construct');
      p.activity = 'build';
      task.progress += (buildPower(p.skills.construction.level) * toolSpeed(p, 'construct') * workFactor(s, p) * buildSpeed(s)) / TICK_HZ;
      gainSkill(p, 'construction', BUILD_XP_PER_SEC / TICK_HZ / 2);
      accruePay(s, p, BUILD_PER_HOUR, 'wages', 'building', TICKS_PER_HOUR);
      if (task.progress >= paveSeconds(s, task.cell)) {
        pave(s, task.cell);
        p.task = null;
      }
      break;
    }
    case 'repair': {
      const wall = byId(s, task.building)!;
      if (!goToB(s, p, wall)) break;
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
      // (a field is worked a section at a time: the farmer stands in the one under way, and moves along)
      if (isPen(field) ? !goToB(s, p, field) : !goTo(s, p, fieldSpot(field), footprint(field))) break;
      // (a sickle for the harvest, a hoe for the sowing; the pens are tended by hand)
      p.activity = isPen(field) ? 'forage' : field.crop?.stage === 'ripe' ? 'reap' : 'till';
      if (isPen(field) ? workPen(s, p, field) : workField(s, p, field)) p.task = null;
      break;
    }
    case 'extinguish': {
      const b = byId(s, task.building);
      if (!b) {
        p.task = null;
        break;
      }
      if (!goToB(s, p, b)) break;
      p.activity = 'build';
      if (fightFire(s, p, b)) p.task = null;
      break;
    }
    case 'attend': {
      const g = s.gathering;
      if (!g || !attending(s, p)) {
        p.task = null;
        break;
      }
      // (in a ring round the spot, each to their own place; at a feast half of them dance round in the ring: once there,
      // they keep to their turning place)
      const at = gatheringPlace(g, g.ids.indexOf(p.id), s.tick);
      const there = dist(p, at) < 10;
      if (there && festive(g)) {
        p.x = at.x;
        p.y = at.y;
      } else if (!goTo(s, p, at)) break;
      p.activity = festive(g) ? 'dance' : 'mourn';
      p.dir = at.dir;
      break;
    }
    case 'drink': {
      // (to the tavern's door, then inside for the evening: the window shows them)
      const n = s.nightOut;
      const tavern = n ? s.buildings.find((b) => b.id === n.tavern) : undefined;
      if (!tavern || !drinking(s, p)) {
        p.task = null;
        break;
      }
      if (!goToB(s, p, tavern)) break;
      drinkAt(s, p);
      p.activity = 'drink';
      break;
    }
    case 'relax': {
      // (a break at a place of leisure: out on its ground at a spot of their own (a stroll moves between them), or
      // inside; the lift comes when it's over: sim/leisure.ts)
      const b = byId(s, task.building);
      const def = b && LEISURE[b.def];
      if (!b || !def) {
        p.task = null;
        break;
      }
      if (s.tick >= task.until) {
        finishRelax(s, p, b, def, rng);
        p.task = null;
        p.activity = 'idle';
        break;
      }
      const spot = relaxSpot(b, p.id + (def.activity === 'stroll' ? Math.floor(s.tick / (6 * TICK_HZ)) : 0));
      if (def.indoors ? !goToB(s, p, b) : !goTo(s, p, spot)) break;
      p.activity = def.activity;
      break;
    }
    case 'toil': {
      const b = s.busy;
      if (!b || !busyNow(s, p)) {
        p.task = null;
        break;
      }
      // (spread out along the line, each to their own spot)
      const spot = { x: b.x + ((p.id % 7) - 3) * 22, y: b.y + ((Math.floor(p.id / 7) % 3) - 1) * 22 };
      if (!goTo(s, p, spot)) break;
      p.activity = b.anim;
      break;
    }
    case 'mine': {
      const mine = byId(s, task.building)!;
      if (!goToB(s, p, mine)) break;
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
    case 'patrol': {
      // (after a band out on the land: on its heels, and the fight is on once they reach it: sim/roamers.ts)
      const band = task.band !== undefined ? (s.roamers ?? []).find((r) => r.id === task.band && r.fighting === undefined) : undefined;
      if (task.band !== undefined && !band) {
        p.task = null;
        break;
      }
      if (band) {
        task.targetX = band.x;
        task.targetY = band.y;
        if (guardEngages(s, p)) break;
      }
      if (goTo(s, p, { x: task.targetX, y: task.targetY })) p.task = null; // then back the other way
      break;
    }
    case 'tend':
      doTend(s, p, task, rng);
      break;
    case 'shelter': {
      const bed = p.bed === null ? undefined : byId(s, p.bed);
      if (!(bed ? goToB(s, p, bed) : goTo(s, p, campXY(s)))) break;
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
  if (!goTo(s, p, q)) return;
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
  // (a hired guard (sim/treasury.ts) keeps watch without a barracks)
  if (!p.guard && !s.buildings.some((b) => b.def === 'barracks' && b.status === 'done')) return false;
  const h = calendar(s.tick).hour;
  const day = h >= 6 && h < 18;
  return (p.id % 2 === 0) === day;
}

/** The far end of the built town from where a guard is: the door of the building farthest from them. */
function patrolEnd(s: GameState, p: Person): Pt {
  let best: Pt = campXY(s);
  let far = -1;
  for (const b of s.buildings) {
    if (b.status !== 'done') continue;
    const d = distToBuilding(b, p);
    if (d > far) {
      far = d;
      best = buildingDoor(b);
    }
  }
  return best;
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
  const mounted = cavalry(s).has(p.id);
  // the battle on the trail (battle.ts): a placed fighter walks to their spot and fights from it; the rest wait at
  // the gate for whoever gets through
  // (on a tactics board: the battle stands them where they are: sim/tactics.ts)
  if (onBoard(s, p)) {
    p.activity = s.tick - (p.lastBlow ?? -999) < 8 ? 'fight' : 'idle';
    return;
  }
  const b = s.raid?.battle;
  const unit = b && b.phase !== 'done' ? b.units.find((u) => u.person === p.id) : undefined;
  if (unit) {
    const q = b!.map.spots.find((x) => x.id === unit.spot)!;
    const at = { x: q.x * CELL, y: q.y * CELL };
    if (goTo(s, p, at) || (mounted && goTo(s, p, at))) {
      p.activity = s.tick - (unit.lastAt ?? -999) < 6 ? 'fight' : 'idle';
      const foe = nearestOnTrail(s, p);
      if (foe && Math.abs(foe.x - p.x) > 1) p.dir = foe.x > p.x ? 1 : -1;
    }
    return;
  }
  const rd = nearestRaider(s, p);
  if (!rd) {
    const rally = rallyPoint(s);
    if (goTo(s, p, rally) || (mounted && goTo(s, p, rally))) p.activity = 'idle'; // wait for them at the edge of camp
    return;
  }
  const reach = defenderReach(p);
  const gap = rd.x - p.x;
  const away = dist(p, rd);
  if (away > reach) {
    // they go out no further than the town's edge: the raiders are met as they come in (or shot at from it); only an
    // archer shooting in from just outside is gone out after, as far as it stands
    const out = ENEMIES[rd.kind]?.ranged ? THROW_RANGE : 0;
    const want = heldToTown(s, { x: rd.x - ((rd.x - p.x) / away) * (reach - 4), y: rd.y - ((rd.y - p.y) / away) * (reach - 4) }, out);
    // riders cover ground twice as fast
    const there = goTo(s, p, want) || (mounted && goTo(s, p, want));
    if (there) {
      p.dir = gap >= 0 ? 1 : -1; // (holding the edge, facing them)
      p.activity = 'idle';
    }
    return;
  }
  p.dir = gap >= 0 ? 1 : -1;
  p.activity = 'fight';
  if (--task.cooldown > 0) return;
  task.cooldown = rallied(s, p) ? Math.round(DEFEND_INTERVAL / RALLY_SPEED) : DEFEND_INTERVAL;
  defenderAttack(s, p, rd, rng, mounted ? CAVALRY_DAMAGE : 0);
}

/** The nearest raider on the battle's trail (still to get through), to face. */
function nearestOnTrail(s: GameState, at: Pt): Raider | null {
  let best: Raider | null = null;
  for (const rd of s.raid?.raiders ?? []) {
    if (rd.down || rd.gone || rd.ally || !rd.bt || rd.bt.out || rd.bt.d < 0) continue;
    if (!best || dist(rd, at) < dist(best, at)) best = rd;
  }
  return best;
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
      if (!goToB(s, p, from)) return;
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
      if (!goToB(s, p, station)) return;
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
      if (!goToB(s, p, station)) return;
      if (!takeItemInputs(s, o)) {
        p.task = null;
        return;
      }
      p.activity = 'build';
      // a steam factory speeds every station's work
      const built = (id: string) => s.buildings.some((b) => b.def === id && b.status === 'done');
      const factory = (built('factory') ? 2 : 1) * (built('fusion_reactor') ? 1.5 : 1);
      const speed = skillSpeed(p.skills.crafting.level) * workFactor(s, p) * factory * nearSource(s, station) * craftSpeed(s) * (holds(p, station) ? HOLDER_EDGE : 1);
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
  // (a topic finished by someone else, or cancelled: on to the next)
  if (!task.topic || !r.queue.includes(task.topic)) task.topic = topicFor(s, p);
  if (!task.topic) {
    p.task = null;
    return;
  }
  if (!(building ? goToB(s, p, building) : goTo(s, p, campXY(s)))) return;
  if (s.tick % TICKS_PER_HOUR === 0 && researchCanWait(s, p)) {
    p.task = null;
    return;
  }
  p.activity = 'research';
  const topic = TOPIC_BY_ID[task.topic];
  const mult = (building ? (RESEARCH_STATIONS[building.def]?.mult ?? 1) : 1) * (holds(p, building) ? HOLDER_EDGE : 1);
  const speed = skillSpeed(p.skills.research.level) * mult * modifiers(r).researchSpeed * workFactor(s, p) * researchSpeed(s);
  // (and the game's pace: a town takes generations to learn it all, data/pace.ts)
  r.progress[topic.id] = (r.progress[topic.id] ?? 0) + speed / (topic.seconds * RESEARCH_MULTIPLIER[earlier(s.era, topic.era ?? 'neolithic')] * RESEARCH_PACE[topic.era ?? 'neolithic'] * TICK_HZ);
  gainSkill(p, 'research', RESEARCH_XP_PER_SEC / TICK_HZ);
  accruePay(s, p, STUDY_PER_HOUR, 'wages', 'study', TICKS_PER_HOUR);
  if (r.progress[topic.id] < 1) return;

  delete r.progress[topic.id];
  r.queue = r.queue.filter((id) => id !== topic.id);
  r.done.push(topic.id);
  notify(s, `Research complete: ${topic.name}`, true);
  if (topic.id === 'blood_rite') offerBloodRite(s);
  if (topic.id === 'moon_rite') offerMoonRite(s);
  if (topic.id === 'lichcraft') offerLichRite(s);
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
  const near = s.buildings.some((b) => b.status === 'done' && sources.includes(b.def) && distToBuilding(b, buildingCentre(station)) <= ADJACENT_TILES * CELL);
  return near ? NEAR_SOURCE_BONUS : 1;
}

function workGather(s: GameState, p: Person, task: Extract<Task, { type: 'gather' }>, rng: Rng): void {
  const def = TERRAIN[groundAt(s.land, cellAt(s.land, task.tile).x, cellAt(s.land, task.tile).y) as keyof typeof TERRAIN];
  if (!def) {
    p.task = null;
    return;
  }
  if (p.activity !== def.anim) pickTool(s, p, def.anim);
  p.activity = def.anim;
  const speed = skillSpeed(p.skills.gathering.level) * modifiers(s.research).gather[def.anim] * toolSpeed(p, def.anim) * workFactor(s, p) * (def.anim === 'forage' ? doomForage(s) * biomeOf(s).forage * forageSpeed(s) : 1);
  // (the land is the same in every era: a tree takes no longer to fell in the Medieval era)
  task.progress += speed / (def.secondsPerUnit * TICK_HZ);
  while (task.progress >= 1 && p.task === task) {
    task.progress -= 1;
    gatherUnit(s, p, task.tile, rng);
    if (poolSize(p.carrying) >= carryCapacity(s, p)) p.task = null; // hands full: go store it
  }
}

/** Hungry with nothing in storage: pick the wild berries off a tile (the trees stay standing), then eat them. */
function scrounge(s: GameState, p: Person, task: Extract<Task, { type: 'gather' }>): void {
  const pool = s.land.pools[task.tile];
  if (!pool) {
    p.task = null;
    return;
  }
  p.activity = 'forage';
  task.progress += (skillSpeed(p.skills.gathering.level) * doomForage(s) * biomeOf(s).forage * forageSpeed(s)) / (SCROUNGE_SECONDS * TICK_HZ);
  if (task.progress < 1) return;
  task.progress = 0;
  addStock(pool, 'berries', -1);
  addStock(p.carrying, 'berries', 1);
  gainSkill(p, 'gathering', GATHER_XP);
  // (picked bare, with nothing else left on it: the cell is clear now)
  const bare = (pool.berries ?? 0) <= 0;
  if (poolSize(pool) === 0) clearCell(s, task.tile);
  // eat on the spot once there's enough for a meal, or once the bush is bare
  if (bare || (p.carrying.berries ?? 0) >= 2) {
    const n = p.carrying.berries ?? 0;
    p.needs.food = Math.min(1, p.needs.food + n * FOOD_VALUE.berries!);
    addStock(p.carrying, 'berries', -n);
    p.task = null;
  }
}

/** A wild cell worked out is open ground now (sand in the desert); a cell of the mountain dug out is a gallery of the
 *  hold (hall), which the dwarves walk and dig on from. */
export function clearCell(s: GameState, i: number): void {
  const c = cellAt(s.land, i);
  // (a cell of the sea fished out stays the sea: it gives again at dawn, sim/sea.ts)
  if (wet(groundAt(s.land, c.x, c.y))) {
    delete s.land.pools[i];
    setMarked(s.land, i, false);
    s.land.version++;
    return;
  }
  if (groundAt(s.land, c.x, c.y) === 'mountain') {
    setGround(s.land, c.x, c.y, 'hall');
    return;
  }
  noteCleared(s, i, groundAt(s.land, c.x, c.y)); // (a wood or a thicket grows back, in time: sim/regrow.ts)
  setGround(s.land, c.x, c.y, openGround(s.biome));
  cellCleared(s, c.x, c.y); // (a blueprint laid over it may be clear to build now)
}

/** The nearest cell with wild berries on it (for someone about to starve), if any. Only the open land counts. */
function wildFood(s: GameState, p: Person): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const [k, pool] of Object.entries(s.land.pools)) {
    if ((pool.berries ?? 0) <= 0) continue;
    const i = Number(k);
    const d = dist(cellXY(s, i), p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Take one unit from the cell's pool (weighted by what's left). Clears the cell when the pool runs out. */
function gatherUnit(s: GameState, p: Person, tileIndex: number, rng: Rng): void {
  const pool = s.land.pools[tileIndex];
  const entries = pool ? (Object.entries(pool) as [Material, number][]).filter(([, n]) => n > 0) : [];
  if (!pool || !entries.length) {
    // (nothing left on it after all: it's clear)
    clearCell(s, tileIndex);
    p.task = null;
    return;
  }
  let r = rng.next() * poolSize(pool);
  let pick = entries[entries.length - 1][0];
  for (const [m, n] of entries) {
    if ((r -= n) < 0) {
      pick = m;
      break;
    }
  }
  addStock(pool, pick, -1);
  addStock(p.carrying, pick, 1);
  gainSkill(p, 'gathering', GATHER_XP);

  if (poolSize(pool) === 0) {
    clearCell(s, tileIndex);
    p.task = null;
    p.activity = 'idle';
  }
}

/* ------------------------------------------------------------ needs */

function doEat(s: GameState, p: Person, task: Extract<Task, { type: 'eat' }>): void {
  const st = byId(s, task.building)!;
  if (!goToB(s, p, st)) return;
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
  if (!(bed ? goToB(s, p, bed) : goTo(s, p, { x: campXY(s).x - CELL, y: campXY(s).y + CELL }))) return;
  p.activity = 'sleep';
  const bedroll = !bed && hasBedroll(s, p);
  p.needs.rest = Math.min(1, p.needs.rest + (SLEEP_PER_HOUR * (bed ? 1 : bedroll ? BEDROLL_SLEEP : GROUND_SLEEP)) / TICKS_PER_HOUR);
  // (in a sickbed they lie till they're mended, getting up only to eat: sim/sickbeds.ts)
  if (task.sick) {
    if (mended(p) || (!p.downed && p.needs.food < HUNGRY)) {
      p.task = null;
      p.activity = 'idle';
    }
    return;
  }
  if (wantsToWake(s, p)) {
    p.lastSlept = bed ? 'bed' : bedroll ? 'bedroll' : 'ground';
    p.roughNights = bed ? 0 : (p.roughNights ?? 0) + 1; // (nights running out of a bed: the mood sinks further each: townsfolk.ts)
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
    case 'toil':
      return -2.4;
    case 'attend':
      return -2.3;
    case 'drink':
    case 'relax':
      return -1.5; // (leisure: after a meal or sleep, before any work)
    case 'eat':
      return -2.1; // (just over sleep: someone starving in the night gets up to eat)
    case 'sleep':
      return -2;
    case 'gather':
      if (t.scrounge) return -2; // (as urgent as eating)
      return p ? p.priorities.gather * 10 + JOBS.indexOf('gather') : 0;
    case 'store':
    case 'deliver':
      // (putting down what's in your hands: nothing but a need comes first, or the load only grows)
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
    case 'pave':
    case 'repair':
    case 'extinguish':
    case 'toil':
    case 'attend':
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

/** So hungry they get up in the night to eat. */
export const WAKE_TO_EAT = 0.12;

function chooseTask(s: GameState, p: Person): Task | null {
  p.blocked = false;
  // The badly hurt stay in bed until they're back on their feet: a sickbed if one's free (sim/sickbeds.ts), else home.
  if (p.downed) {
    const sb = sickbedFor(s, p);
    return sb ? { type: 'sleep', building: sb.id, sick: true } : { type: 'sleep', building: p.bed };
  }
  // A raid: defenders fight, everyone else shelters.
  if (alarmRaised(s)) return p.priorities.defend !== 0 ? (p.task?.type === 'defend' ? p.task : { type: 'defend', cooldown: 0 }) : { type: 'shelter' };
  // Someone is bleeding out: the nearest free hands go to them.
  const patient = patientFor(s, p);
  if (patient) return p.task?.type === 'tend' && p.task.patient === patient.id ? p.task : { type: 'tend', patient: patient.id, progress: 0 };
  // Fire! Everyone who can drops what they're doing and beats it out.
  const fire = fireToFight(s, p);
  if (fire) return p.task?.type === 'extinguish' && p.task.building === fire.id ? p.task : { type: 'extinguish', building: fire.id };
  // At a funeral or a feast: they stand together till it's over (they still eat).
  if (attending(s, p) && p.needs.food >= HUNGRY) return p.task?.type === 'attend' ? p.task : { type: 'attend' };
  // Badly hurt and a sickbed free: they go and lie in it till they're mended (they get up to eat).
  if (needsSickbed(p) && p.needs.food >= HUNGRY) {
    const sb = sickbedFor(s, p);
    if (sb) return { type: 'sleep', building: sb.id, sick: true };
  }
  // Held to the town's work by an event (sim/events.ts `busy`): they eat when they must, and otherwise toil on.
  if (busyNow(s, p) && p.needs.food >= HUNGRY) return p.task?.type === 'toil' ? p.task : { type: 'toil' };
  // Of an evening, those out for a drink go to the tavern and stay (sim/nightOut.ts; they eat first if they must).
  if (drinking(s, p) && p.needs.food >= HUNGRY) return p.task?.type === 'drink' ? p.task : { type: 'drink' };
  // Spirits low: a break at a place of leisure before the day's work (sim/leisure.ts; the hungry eat first).
  if (p.task?.type !== 'relax' && p.needs.food >= HUNGRY) {
    const spot = wantsRelax(s, p, false);
    if (spot) return { type: 'relax', building: spot.id, until: s.tick + relaxTicks(spot) };
  }
  // Walking out of town (a mental break): nothing else matters.
  if (p.breakdown?.kind === 'wander') {
    const out = leavePt(s, p);
    return { type: 'wander', targetX: out.x, targetY: out.y };
  }
  // Needs. Someone asleep and nearly empty gets up to eat (while the stores hold food).
  if (p.task?.type === 'sleep' || wantsSleep(s, p)) {
    const st = p.task?.type === 'sleep' && p.needs.food < WAKE_TO_EAT && !tireless(p) ? nearestStorage(s, p, (b) => !!foodIn(b)) : null;
    return st ? { type: 'eat', building: st.id, until: null } : { type: 'sleep', building: p.bed };
  }
  if (p.needs.food < HUNGRY) {
    const st = nearestStorage(s, p, (b) => !!foodIn(b));
    if (st) return { type: 'eat', building: st.id, until: null };
    // nothing in the stores, but food in their own hands (a harvest they couldn't put away): eat that
    const own = FOODS.find((m) => (p.carrying[m] ?? 0) > 0);
    if (own) {
      addStock(p.carrying, own, -1);
      p.needs.food = Math.min(1, p.needs.food + FOOD_VALUE[own]!);
    }
    // nothing in storage: go and find something wild to eat before they starve
    if (!tireless(p)) {
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
    const site = s.buildings.find((b) => inWork(b) && MATERIALS.some((m) => (p.carrying[m] ?? 0) > 0 && (unreserved(s, p, b)[m] ?? 0) > 0));
    if (site) return { type: 'deliver', building: site.id };
    const st = nearestStorage(s, p, (b) => storageFree(s, b) > 0);
    if (st) return { type: 'store', building: st.id };
    // Nowhere to put it. If a blueprint is waiting on materials, leave it on the ground so hauling and
    // gathering can go on; otherwise keep holding it (building and research still work) and say so.
    // (anything precious, like the Bear Cave's totem, is never thrown away: they keep hold of it)
    const keep = PRECIOUS.filter((m) => (p.carrying[m] ?? 0) > 0);
    if (s.buildings.some((b) => inWork(b) && poolSize(unreserved(s, p, b)) > 0) && poolSize(p.carrying) > keep.reduce((n, m) => n + p.carrying[m]!, 0)) {
      const kept = Object.fromEntries(keep.map((m) => [m, p.carrying[m]!])) as Stock;
      for (const m of keep) delete p.carrying[m];
      // (said once an hour at most: a full store once filled the journal with nothing else)
      if ((s.dropNoted ?? -1e9) + TICKS_PER_HOUR <= s.tick) {
        s.dropNoted = s.tick;
        notify(s, `${p.name} dropped ${listCarried(p)}: no room in storage.`);
      }
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
  // (hands already full, whatever they're doing: no more gathering or fetching on top)
  if (poolSize(p.carrying) >= carryCapacity(s, p)) handsFull = true;
  // Their own post first: the smith works the smithy's orders, the miner digs, the scholar studies at their desk.
  const own = ownWork(s, p, handsFull);
  if (own) return own;
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

/** Study is spare-time work while the town is small: a handful of people build and gather before they sit down
 *  to think, and in any town a site ready to build with nobody on it comes first (research takes generations now:
 *  data/pace.ts, so a topic can't be left to finish first). */
export function researchCanWait(s: GameState, p: Person): boolean {
  const sites = s.buildings.filter(inWork);
  const grown = s.people.filter((q) => q.away === null && q.bornTick == null && !q.downed).length;
  // (a handful of people lay the streets planned before they study: else nobody idles and they're never laid)
  if (grown <= SMALL_TOWN && !s.raid && paveReady(s)) return true;
  if (!sites.length) return false;
  const ready = sites.some((b) => poolSize(stillNeeded(b)) === 0 || b.progress > 0);
  // (a handful of people: anything they could build or gather for comes first; a site waiting on what the land can't
  // give (a desert's fiber) doesn't keep them from their books)
  if (grown <= SMALL_TOWN) return ready || s.land.marked.length > 0;
  return ready && !s.people.some((q) => q !== p && q.task?.type === 'build');
}
/** Up to this many grown-ups, building and gathering come before study. */
const SMALL_TOWN = 3;

function findJob(s: GameState, p: Person, job: Job): Task | null {
  switch (job) {
    case 'haul':
      for (const b of s.buildings) {
        if (!inWork(b)) continue;
        const need = unreserved(s, p, b);
        if (!poolSize(need)) continue;
        const from = nearestStorage(s, p, (st) => (Object.keys(need) as Material[]).some((m) => (st.store[m] ?? 0) > 0));
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
      const b = s.buildings.find((q) => inWork(q) && poolSize(stillNeeded(q)) === 0 && canWork(s, p, q));
      if (b) return { type: 'build', building: b.id };
      const hurt = s.raid ? undefined : s.buildings.find((q) => q.status === 'done' && q.hp !== undefined && q.hp < (defOf(q).hp ?? 0));
      return hurt ? { type: 'repair', building: hurt.id } : null;
    }
    case 'defend':
      // (fighting only happens in raids, see chooseTask; between them, guards on shift patrol)
      if (!onShift(s, p)) return null;
      // (a band roaming near the town: they go out after it)
      const band = roamerToHunt(s, p);
      if (band) return { type: 'patrol', targetX: band.x, targetY: band.y, band: band.id };
      const end = patrolEnd(s, p);
      return { type: 'patrol', targetX: end.x, targetY: end.y };
    case 'research': {
      // (one person to a station: with every one taken, they find other work)
      if (!s.research.queue.length || researchCanWait(s, p)) return null;
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
      // (the fields first; then the pens)
      const field = fieldToWork(s, p) ?? penToTend(s, p);
      return field ? { type: 'farm', building: field.id } : null;
    }
  }
}

/** The work at the building someone holds the job at (sim/operators.ts), if there is any for them now. */
function ownWork(s: GameState, p: Person, handsFull: boolean): Task | null {
  const b = heldJob(s, p);
  if (!b) return null;
  if (!handsFull && p.priorities.craft !== 0 && (STATIONS as readonly string[]).includes(b.def)) return findCraft(s, p, b.def);
  if (!handsFull && WORKPLACES[b.def] && p.priorities.gather !== 0) {
    const diggers = s.people.filter((o) => o !== p && o.task?.type === 'mine' && o.task.building === b.id).length;
    return diggers < WORKPLACES[b.def].workers ? { type: 'mine', building: b.id, work: 0 } : null;
  }
  if (RESEARCH_STATIONS[b.def] && p.priorities.research !== 0 && s.research.queue.length && !researchCanWait(s, p) && !studyingAt(s, b.id, p)) return { type: 'research', station: b.id, topic: topicFor(s, p) };
  return null;
}

/**
 * The first craft order someone can work on: its station is built, nobody else has it, and its item
 * ingredients are in the inventory. Fetch what's missing from the nearest store that has any, or make it.
 * A station's job holder has first pick of its orders: while they're at home and free for them, nobody else takes
 * one (`station`: only that station's orders).
 */
function findCraft(s: GameState, p: Person, station?: string): Task | null {
  for (const o of s.crafting) {
    const def = ITEM_BY_ID[o.item];
    if (station && def.station !== station) continue;
    if (s.people.some((q) => q !== p && q.task?.type === 'craft' && q.task.order === o.id)) continue;
    const at = stationFor(s, def);
    if (!at || missingItems(s, o).length) continue;
    if (!station) {
      const holder = holderOf(s, at);
      if (holder && holder !== p && holder.task?.type !== 'craft') continue;
    }
    const need = craftNeeded(o);
    if (!poolSize(need)) return { type: 'craft', order: o.id, phase: 'work', from: null };
    // already holding some of it (say, after a nap): take it over first
    if (MATERIALS.some((m) => (need[m] ?? 0) > 0 && (p.carrying[m] ?? 0) > 0)) return { type: 'craft', order: o.id, phase: 'deliver', from: null };
    const from = nearestStorage(s, p, (st) => MATERIALS.some((m) => (need[m] ?? 0) > 0 && (st.store[m] ?? 0) > 0));
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

/** The nearest marked cell, preferring ones fewer people are already working; the ring wall's cells to clear
 *  (sim/ringWall.ts) count as `RING_CLEAR_PULL` cells nearer, so the wall's line is cut and mined out first. */
export function bestGatherTile(s: GameState, p: Person): number | null {
  const workers = new Map<number, number>();
  for (const o of s.people) if (o !== p && o.task?.type === 'gather') workers.set(o.task.tile, (workers.get(o.task.tile) ?? 0) + 1);
  const ring = s.ring?.clearing;
  // (the trees and rocks under a blueprint are cleared first, as the ring's are: the site waits on them)
  const sites = new Set<number>();
  for (const b of s.buildings) if (b.overgrown && !b.planned) for (const i of overgrownCells(s, b)) sites.add(i);
  let best: number | null = null;
  let bestCost = Infinity;
  for (const i of s.land.marked) {
    const w = workers.get(i) ?? 0;
    if (w >= MAX_PER_TILE) continue;
    const cost = dist(cellXY(s, i), p) + w * 20 * CELL - (ring?.includes(i) || sites.has(i) ? RING_CLEAR_PULL * CELL : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  }
  return best;
}

/** A task is dropped when what it works on was unmarked, demolished, finished, emptied or filled up. */
function stillValid(s: GameState, p: Person, t: Task): boolean {
  const site = 'building' in t && t.building !== null ? byId(s, t.building) : undefined;
  switch (t.type) {
    case 'gather': {
      const pool = s.land.pools[t.tile];
      if (t.scrounge) return (pool?.berries ?? 0) > 0;
      return !!pool && isMarked(s.land, t.tile) && p.priorities.gather !== 0;
    }
    case 'store':
      return !!site && storageFree(s, site) > 0;
    case 'fetch':
      return !!site && inWork(site) && !!byId(s, t.from) && p.priorities.haul !== 0;
    case 'deliver':
      return !!site && inWork(site);
    case 'build':
      return !!site && inWork(site) && poolSize(stillNeeded(site)) === 0 && p.priorities.construct !== 0 && canWork(s, p, site);
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
    case 'pave': {
      const c = cellAt(s.land, t.cell);
      return !s.raid && isPlannedRoad(s.land, c.x, c.y) && p.priorities.construct !== 0;
    }
    case 'craft': {
      const o = s.crafting.find((q) => q.id === t.order);
      return !!o && !!stationFor(s, ITEM_BY_ID[o.item]) && p.priorities.craft !== 0;
    }
    case 'farm':
      if (site && isPen(site)) return (needsTending(s, site) || (site.herd?.work ?? 0) > 0) && p.priorities.farm !== 0;
      return !!site && isField(site) && cropOf(site).stage !== 'growing' && p.priorities.farm !== 0;
    case 'mine':
      return site?.status === 'done' && p.priorities.gather !== 0;
    case 'extinguish':
      return !!site && site.fire !== undefined && !alarmRaised(s);
    case 'toil':
      return busyNow(s, p) && !alarmRaised(s);
    case 'attend':
      return attending(s, p) && !alarmRaised(s);
    case 'drink':
      return drinking(s, p) && !alarmRaised(s);
    case 'relax': {
      // (the break ends in its own turn, with the lift it gives: leisure.ts)
      const b = byId(s, t.building);
      return !!b && b.status === 'done' && !alarmRaised(s) && !s.raid;
    }
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

/** Held to the town's work by an event, now (not in a raid). */
export const busyNow = (s: GameState, p: Person) => !!s.busy && s.tick < s.busy.until && s.busy.ids.includes(p.id) && p.away === null && !p.downed && !alarmRaised(s);

/** Step toward a point along a path over the land. Returns true once there. */
function goTo(s: GameState, p: Person, to: Pt, through?: ReturnType<typeof footprint>): boolean {
  const there = walk(s, p, to, STEP * injuryPace(p), through, s.tick, swims(s, p)); // (a lame leg slows them: sim/injuries.ts)
  if (!there) p.activity = 'walk';
  return there;
}

/** Step toward a building: to its door. */
const goToB = (s: GameState, p: Person, b: Building) => goTo(s, p, buildingDoor(b), footprint(b));

/** Step toward a point (for visitors and the like). Returns true once there. */
export function walkTo(s: GameState, p: Person, to: Pt): boolean {
  return goTo(s, p, to);
}

/** A point held back to within the town's edge (plus `out` px): where defenders go no further than. */
function heldToTown(s: GameState, want: Pt, out: number): Pt {
  const c = campXY(s);
  const r = (townRadius(s) + 1) * CELL + out;
  return { x: Math.max(townEdgeX(s, -1) - out, Math.min(townEdgeX(s, 1) + out, want.x)), y: Math.max(c.y - r, Math.min(c.y + r, want.y)) };
}

const listCarried = (p: Person) =>
  MATERIALS.filter((m) => (p.carrying[m] ?? 0) > 0)
    .map((m) => `${p.carrying[m]} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

function byId(s: GameState, id: number): Building | undefined {
  return s.buildings.find((b) => b.id === id);
}

function nearestStorage(s: GameState, at: Pt, ok: (b: Building) => boolean): Building | null {
  let best: Building | null = null;
  for (const b of storages(s)) {
    if (!ok(b)) continue;
    if (!best || distToBuilding(b, at) < distToBuilding(best, at)) best = b;
  }
  return best;
}
