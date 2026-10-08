// Visiting bands (the owner's ask: caravans who trade, travellers passing through, bandits sneaking in to attack
// from the inside, refugees looking for aid and rest). A band is a few strangers walking the land together
// (`Traveller`s with `band` set: the shop leaves them alone, the map draws them like any traveller) and the band's
// own state (`Band` in state.ts: where they stop, what phase they're in, a caravan's wagon, a refugee band's
// question, a bandit band's hour). A trade caravan's merchants come in with its wagon and stay at the market while it
// trades (sim/trade.ts); travellers come in one gate, rest a while at the tavern (else the market or the fire) and go
// out the far gate; a band of "travellers" is now and then bandits in disguise, who loiter by day and strike from inside
// the town in the small hours (a raid begun where they stand: sim/raids.ts `startRaid` with `inside`) unless a guard on
// watch sees through them first; refugees camp at the town's edge and ask for aid and rest: a prompt of kind
// `refugees` (take them in, feed them, turn them away; unanswered, fed if the stores can spare it). Off with the
// autopilot (the tests' plainGame); the tests spawn bands themselves.

import { BAND_FIRST_DAY, BAND_HOURLY, BAND_SIZE, BAND_SPEED, BAND_WEIGHTS, BANDIT_BUDGET_SHARE, BANDITS_FROM_DAY, BANDITS_PEOPLE, CATCH_BASE, CATCH_PER_LEVEL, MEMBER_KIND, PASS_HOURS, REFUGEE_FOOD, REFUGEE_OPTIONS, REFUGEE_REPUTATION, REFUGEE_REST_HOURS, REFUGEE_WAIT_HOURS, STRIKE_FROM, STRIKE_UNTIL, WAGON_LAG, type BandKind } from '../data/bands';
import { venueOfDef } from '../data/shop';
import type { Material } from '../data/materials';
import { ORIGIN_DEFS, rulesOf } from '../data/origins';
import { FOOD_VALUE, randomLook } from '../data/people';
import { RAID_KIND_BY_ID } from '../data/raids';
import { hashSeed, mixSeed, Rng } from '../rng';
import { buildingDoor, totalStock } from './buildings';
import { takeFromStorage } from './expeditions';
import { CELL, type Pt } from './land';
import { onShift } from './people';
import { raidBudget, startRaid } from './raids';
import { strangerName } from './shop';
import { makeStranger, strangerLook, strangerOrigin } from './strangers';
import { campXY, edgeXY, makePerson, notify, townFull, type Band, type GameState, type Person, type Traveller } from './state';
import { calendar, TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { eventPicture } from '../data/eventScenes';
import { seaTown } from './sea';
import { weatherAt } from './weather';
import { campEdge, foodPerHead, housingCapacity } from './townsfolk';
import { walk } from './walk';

const bandsOf = (s: GameState): Band[] => (s.bands ??= []);
/** The band's members still on the land. */
export const membersOf = (s: GameState, b: Band): Traveller[] => (s.travellers ?? []).filter((t) => t.band === b.id);
const drop = (s: GameState, b: Band): void => {
  s.bands = bandsOf(s).filter((x) => x !== b);
};

/** Where a band stops: a caravan's merchants before the market; travellers (and bandits) at the tavern's door, else
 *  the market's or the shop's, else by the fire; refugees just outside the town's edge on their side. */
export function stopAt(s: GameState, kind: BandKind, side: -1 | 1): Pt {
  const done = (id: string) => s.buildings.find((b) => b.def === id && b.status === 'done');
  const before = (b: NonNullable<ReturnType<typeof done>>): Pt => {
    const d = buildingDoor(b);
    return { x: d.x, y: d.y + CELL };
  };
  const market = done('market');
  if (kind === 'caravan' && market) return before(market);
  if (kind === 'refugees') {
    const e = campEdge(s, side);
    return { x: e.x + side * 2 * CELL, y: e.y + CELL };
  }
  const tavern = s.buildings.find((b) => b.status === 'done' && venueOfDef(b.def) === 'tavern');
  const shop = s.buildings.find((b) => b.status === 'done' && venueOfDef(b.def) === 'shop');
  const at = tavern ?? market ?? shop;
  if (at) return before(at);
  const c = campXY(s);
  return { x: c.x + side * 3 * CELL, y: c.y + 2 * CELL };
}
/** The i-th member's place about the band's stop. */
const spotOf = (b: Band, i: number): Pt => ({ x: b.at.x + ((i % 3) - 1) * 18, y: b.at.y + Math.floor(i / 3) * 16 });

/** The next tick in the small hours (STRIKE_FROM to STRIKE_UNTIL), some way into them. */
function nextStrike(s: GameState, rng: Rng): number {
  const hour = calendar(s.tick).hour;
  const toNight = hour >= STRIKE_FROM || hour < STRIKE_UNTIL ? 0 : (STRIKE_FROM - hour + 24) % 24;
  return s.tick + toNight * TICKS_PER_HOUR + rng.int(0, 2) * TICKS_PER_HOUR + rng.int(0, TICKS_PER_HOUR - 1);
}

/** A band comes in from one side of the land. */
export function spawnBand(s: GameState, rng: Rng, kind: BandKind, side: -1 | 1 = rng.chance(0.5) ? -1 : 1): Band {
  const n = rng.int(BAND_SIZE[kind][0], BAND_SIZE[kind][1]);
  const band: Band = { id: s.nextId++, kind, members: [], side, at: stopAt(s, kind, side), phase: 'coming', until: 0 };
  // (a caravan's or a refugee band's people are one people, now and then another than the town's)
  const origin = kind === 'refugees' || kind === 'caravan' ? strangerOrigin(s, rng, true) : null;
  const edge = edgeXY(s, side);
  for (let i = 0; i < n; i++) {
    const t: Traveller = {
      id: s.nextId++,
      name: strangerName(s, rng),
      kind: MEMBER_KIND[kind],
      look: randomLook(rng),
      x: edge.x - side * i * 18,
      y: edge.y + (i % 2 ? 10 : -8),
      dir: side < 0 ? 1 : -1,
      phase: 'arriving',
      toX: band.at.x,
      toY: band.at.y,
      until: 0,
      purse: kind === 'caravan' ? rng.int(20, 60) : kind === 'refugees' ? 0 : rng.int(2, 12),
      band: band.id,
    };
    if (origin) {
      t.origin = origin;
      strangerLook(t, origin);
    }
    (s.travellers ??= []).push(t);
    band.members.push(t.id);
  }
  if (kind === 'caravan') band.wagon = { x: edge.x - side * (n * 18 + WAGON_LAG), y: edge.y };
  if (kind === 'bandits') band.strikeAt = nextStrike(s, rng);
  bandsOf(s).push(band);
  const who = origin ? ` of the ${ORIGIN_DEFS[origin].name}` : '';
  notify(
    s,
    kind === 'caravan'
      ? `The caravan's merchants${who} are bringing their wagon in to the market.`
      : kind === 'refugees'
        ? `${n} refugees${who} are coming to the gate, footsore, asking for aid and rest.`
        : `${n} travellers are coming into town from the ${side < 0 ? 'west' : 'east'}, passing through.`,
    kind === 'refugees',
  );
  return band;
}

/** Each hour: a caravan's merchants come with it; now and then another band (one at a time), by the day and the
 *  town: bandits only from BANDITS_FROM_DAY in a town of BANDITS_PEOPLE, refugees never to a town that takes nobody. */
function spawnHourly(s: GameState, rng: Rng): void {
  if (s.gameOver || s.autopilot === false) return;
  const c = s.caravan;
  if (c && c.arrived !== undefined && s.lastCaravanBand !== c.arrived && !bandsOf(s).some((b) => b.kind === 'caravan')) {
    s.lastCaravanBand = c.arrived;
    spawnBand(s, rng, 'caravan').until = c.leavesTick;
  }
  if (s.tick < BAND_FIRST_DAY * TICKS_PER_DAY || s.raid || bandsOf(s).some((b) => b.kind !== 'caravan')) return;
  if (!rng.chance(BAND_HOURLY)) return;
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  const grown = s.people.filter((p) => p.away === null && p.bornTick == null).length;
  const weights: Record<string, number> = { ...BAND_WEIGHTS };
  if (day < BANDITS_FROM_DAY || grown < BANDITS_PEOPLE) delete weights.bandits;
  if (rulesOf(s).noWanderers) delete weights.refugees;
  spawnBand(s, rng, rng.weighted(weights) as BandKind);
}

/** The bands' own rolls, by the town's seed and the tick (never the town's stream: a band coming or not leaves
 *  everything else as it would have been). */
const bandRng = (s: GameState): Rng => new Rng(mixSeed(hashSeed(s.seed), 0xba4d5, s.tick));

/** Every tick: the bands come in, stay, and go. */
export function bandsTick(s: GameState, _rng?: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 && !s.bands?.length) return;
  const rng = bandRng(s);
  if (s.tick % TICKS_PER_HOUR === 0) spawnHourly(s, rng);
  if (!s.bands?.length) return;
  const step = BAND_SPEED / TICK_HZ;
  for (const b of [...s.bands]) moveBand(s, b, rng, step);
}

function moveBand(s: GameState, b: Band, rng: Rng, step: number): void {
  const members = membersOf(s, b);
  if (!members.length) return drop(s, b);
  // (raiders at the gates: everyone but the bandits hurries on)
  if (b.phase !== 'leaving' && s.raid?.phase === 'active' && b.kind !== 'bandits') return startLeaving(s, b, -b.side as -1 | 1);
  if (b.phase === 'coming') {
    let all = true;
    members.forEach((t, i) => {
      if (!walk(s, t, spotOf(b, i), step, undefined, s.tick)) all = false;
    });
    if (b.wagon) rollWagon(b, members[0], step);
    if (!all) return;
    b.phase = 'staying';
    if (b.kind === 'travellers' || b.kind === 'bandits') b.until = s.tick + Math.round(rng.range(PASS_HOURS[0], PASS_HOURS[1]) * TICKS_PER_HOUR);
    else if (b.kind === 'caravan') b.until = b.until || s.caravan?.leavesTick || s.tick + 6 * TICKS_PER_HOUR;
    else if (b.kind === 'refugees') {
      b.until = s.tick + REFUGEE_WAIT_HOURS * TICKS_PER_HOUR;
      askRefugees(s, b);
    }
    return;
  }
  if (b.phase === 'staying') {
    if (b.kind === 'bandits') {
      if (s.raid) return; // (they wait for the fight to pass)
      if (s.tick % TICKS_PER_HOUR === 0) {
        const guard = seenThrough(s, rng);
        if (guard) return strike(s, b, rng, guard);
      }
      if (s.tick >= (b.strikeAt ?? 0)) return strike(s, b, rng, null);
      return;
    }
    if (b.kind === 'caravan' && !s.caravan) b.until = Math.min(b.until, s.tick);
    if (b.kind === 'refugees' && b.answer == null) {
      // (unanswered, their wait up: fed if the stores can spare it, else turned away)
      if (s.tick >= b.until) answerRefugees(s, foodPerHead(s) >= 1 ? REFUGEE_OPTIONS[1] : REFUGEE_OPTIONS[2], rng);
      return;
    }
    if (s.tick >= b.until) startLeaving(s, b, b.kind === 'refugees' ? b.side : (-b.side as -1 | 1));
    return;
  }
  for (const t of members) if (walk(s, t, { x: t.toX, y: t.toY }, step, undefined, s.tick)) s.travellers = s.travellers!.filter((q) => q !== t);
  if (b.wagon) rollWagon(b, members[0], step);
  if (!membersOf(s, b).length) drop(s, b);
}

/** The wagon rolls along behind the lead merchant. */
function rollWagon(b: Band, lead: Traveller, step: number): void {
  const w = b.wagon!;
  const tx = lead.x - lead.dir * WAGON_LAG;
  const ty = lead.y + 6;
  const d = Math.hypot(tx - w.x, ty - w.y);
  if (d <= step) {
    w.x = tx;
    w.y = ty;
    return;
  }
  w.x += ((tx - w.x) / d) * step;
  w.y += ((ty - w.y) / d) * step;
}

/** The band moves on, out of the land on a side. */
export function startLeaving(s: GameState, b: Band, side: -1 | 1): void {
  b.phase = 'leaving';
  const out = edgeXY(s, side);
  for (const t of membersOf(s, b)) {
    t.phase = 'leaving';
    t.toX = out.x;
    t.toY = out.y;
    t.dir = side;
  }
}

/* ------------------------------------------------------------ bandits */

/** A guard on watch who sees through the "travellers" this hour, if any (by their best fighting skill). */
export function seenThrough(s: GameState, rng: Rng): Person | null {
  const watch = s.people.filter((p) => p.away === null && !p.downed && p.guard && onShift(s, p));
  if (!watch.length) return null;
  const best = [...watch].sort((a, b) => fighting(b) - fighting(a))[0];
  return rng.chance(CATCH_BASE + CATCH_PER_LEVEL * fighting(best)) ? best : null;
}
const fighting = (p: Person) => Math.max(p.skills.melee.level, p.skills.ranged.level);

/** The bandits throw off their cloaks: a raid begun where they stand (by night, or in the open when a guard has seen
 *  through them). */
export function strike(s: GameState, b: Band, rng: Rng, guard: Person | null): void {
  const n = membersOf(s, b).length;
  s.travellers = (s.travellers ?? []).filter((t) => t.band !== b.id);
  drop(s, b);
  if (s.raid) return;
  const budget = Math.max(14 * n, Math.round(raidBudget(s) * BANDIT_BUDGET_SHARE));
  startRaid(s, RAID_KIND_BY_ID.band_bandits, budget, rng, b.at);
  notify(s, guard ? `${guard.name} saw through the "travellers" in the town: bandits! They draw their blades in the open.` : 'The "travellers" throw off their cloaks in the small hours: bandits, inside the town!', true);
}

/* ------------------------------------------------------------ refugees */

function askRefugees(s: GameState, b: Band): void {
  const cal = calendar(s.tick);
  const members = membersOf(s, b);
  const n = members.length;
  const origin = members[0]?.origin;
  const beds = Math.max(0, housingCapacity(s) - s.people.length);
  const food = Math.floor(Object.entries(totalStock(s)).reduce((t, [m, k]) => t + (FOOD_VALUE[m as Material] ? (k ?? 0) : 0), 0));
  s.prompts.push({
    id: s.nextId++,
    kind: 'refugees',
    expedition: null,
    title: `${n} refugees at the gate`,
    text: `${n} refugees${origin ? ` of the ${ORIGIN_DEFS[origin].name}` : ''} have come to the edge of town, footsore and hungry, asking for aid and a night's rest. ${beds ? `There ${beds === 1 ? 'is a bed' : `are ${beds} beds`} free.` : 'There is no bed free.'} The stores hold ${food} food.`,
    options: [...REFUGEE_OPTIONS],
    defaultOption: foodPerHead(s) >= 1 ? 1 : 2,
    expiresTick: b.until + TICKS_PER_HOUR,
    story: `${n} refugees${origin ? ` of the ${ORIGIN_DEFS[origin].name}` : ''} have come to the edge of town, footsore and hungry, with what they could carry. They ask for aid and a night's rest.\n\n${beds ? `There ${beds === 1 ? 'is a bed' : `are ${beds} beds`} free.` : 'There is no bed free.'} The stores hold ${food} food. Taken in, they will need beds; fed, they rest a day by the gate and go on.`,
    picture: eventPicture(`refugees:${b.id}`, 'refugees road travellers camp hungry', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
  });
  b.asked = true;
  b.answer = null;
}

/** The player's answer (or the default when their wait is up): the refugees join the town (as many as it will take),
 *  are fed and rest a day by the gate, or are turned away. */
export function answerRefugees(s: GameState, option: string, rng: Rng): void {
  const b = bandsOf(s).find((x) => x.kind === 'refugees' && x.answer == null);
  if (!b) return;
  s.prompts = s.prompts.filter((q) => q.kind !== 'refugees');
  const members = membersOf(s, b);
  if (option === REFUGEE_OPTIONS[0]) {
    let taken = 0;
    for (const t of members) {
      if (townFull(s)) break;
      const p = makePerson(rng, s.nextId++, 'wanderer', { x: t.x, y: t.y }, s.people.map((q) => q.name));
      p.name = t.name;
      p.look = t.look;
      p.dir = t.dir;
      if (t.origin) makeStranger(s, p, t.origin);
      s.people.push(p);
      s.travellers = s.travellers!.filter((q) => q !== t);
      taken++;
    }
    s.reputation += REFUGEE_REPUTATION.taken;
    s.lastVisit = s.tick;
    b.answer = 'taken';
    notify(s, taken === members.length ? `The ${taken} refugees are taken in. They have nothing, and will need beds.` : `${taken} of the refugees are taken in; the town has room for no more, and the rest trudge on.`, true);
    if (membersOf(s, b).length) startLeaving(s, b, b.side);
    else drop(s, b);
    return;
  }
  if (option === REFUGEE_OPTIONS[1]) {
    let want = members.length * REFUGEE_FOOD;
    let fed = 0;
    for (const m of Object.keys(FOOD_VALUE) as Material[]) {
      if (want <= 0) break;
      const got = takeFromStorage(s, m, want);
      want -= got;
      fed += got;
    }
    s.reputation += REFUGEE_REPUTATION.fed;
    b.answer = 'fed';
    b.until = s.tick + REFUGEE_REST_HOURS * TICKS_PER_HOUR;
    notify(s, fed ? `The refugees are given ${fed} food, and rest a day by the gate before they go on.` : 'The stores had nothing to give the refugees; they rest a day by the gate before they go on.', true);
    return;
  }
  s.reputation += REFUGEE_REPUTATION.turned;
  b.answer = 'turned';
  startLeaving(s, b, b.side);
  notify(s, 'The refugees are turned from the gate, and trudge away the way they came.', true);
}
