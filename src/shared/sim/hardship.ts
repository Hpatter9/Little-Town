// Hard times (data/hardship.ts; docs/notes/deaths-common.md): the dangers of real want. Once an hour, with the
// autopilot on: a fever may break out in a crowded, dirty town and spread among those near the sick; an open wound
// left untended may fester; and in winter everyone eats more and those sleeping on the ground grow cold. Each takes
// health and stops the body mending while it lasts (`noMending`, read by health.ts `heal`), so it kills the weak
// first: the hurt, the hungry, the old. A sickbed, a dressing, a bed and a well are the cures. Each rule draws from
// its own side stream, so the town's own stream is untouched. Winter is a season to prepare for
// (docs/notes/winter-plague-delves.md): nothing is harvested and little foraged, the hearths burn firewood (with none,
// even those in bed are cold), fevers come more readily, and all year food left in the open spoils.

import {
  COLD_HP_PER_HOUR,
  COLD_AWAKE,
  COLD_IN_BED,
  FEVER_WEAK,
  FIREWOOD_PER_HEAD,
  SPOIL_DAILY,
  SPOIL_GRANARY,
  SPOIL_WINTER,
  WINTER_FORAGE,
  FESTER_BEDLESS,
  FESTER_CHANCE,
  FESTER_CLEARS,
  FESTER_FROM,
  FESTER_HP_PER_HOUR,
  FEVER_BEDLESS,
  FEVER_DAILY,
  FEVER_FROM,
  FEVER_FROM_DAY,
  FEVER_HOURS,
  FEVER_HP_PER_HOUR,
  FEVER_NEAR,
  FEVER_NO_WELL,
  FEVER_SPARED_DAYS,
  FEVER_SPREAD,
  FEVER_TENDED,
  FEVER_TOWN,
  FEVER_WINTER,
  WINTER_APPETITE,
  WINTER_SNOW,
} from '../data/hardship';
import { FREEZE_HEATERS, HEAT_VALUE } from '../data/doom';
import { WOUNDS } from '../data/injuries';
import type { Material } from '../data/materials';
import { hashSeed, Rng } from '../rng';
import { killPerson } from './health';
import { CELL } from './land';
import { sickbedHealing } from './sickbeds';
import { addItems } from './crafting';
import { storages } from './buildings';
import { addStock, notify, tireless, type GameState, type Person } from './state';
import { calendarOf, DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { FOOD_PER_HOUR } from './townsfolk';
import { weatherAt } from './weather';

const stream = (s: GameState, rule: string) => new Rng(hashSeed(`${s.seed}:hardship-${rule}:${s.tick}`));
const home = (s: GameState) => s.people.filter((p) => p.away === null && !tireless(p));
const asleepOnGround = (p: Person) => p.task?.type === 'sleep' && p.task.building === null && p.activity === 'sleep';
/** A fever, as against a plague or an event's sickness (which run their own course). */
export const fevered = (p: Person) => !!p.sick?.fever;
export const festering = (p: Person) => !!p.wounds?.some((w) => w.fester);
/** The body doesn't mend while a fever burns, the plague wastes them (sim/doom.ts), a wound festers or they lie cold
 *  on the winter ground. */
export const noMending = (p: Person) => fevered(p) || !!p.sick?.wasting || festering(p) || !!p.cold;

/** How crowded and dirty the town is: 1 with every bed filled and a well, more with each without a bed, no well,
 *  and in winter (when everyone huddles indoors). */
export function squalor(s: GameState): number {
  const here = home(s);
  if (!here.length) return 1;
  const bedless = here.filter((p) => p.bed === null).length / here.length;
  const well = s.buildings.some((b) => b.def === 'well' && b.status === 'done');
  return 1 + FEVER_BEDLESS * bedless + (well ? 0 : FEVER_NO_WELL) + (calendarOf(s).season === 'winter' ? FEVER_WINTER : 0);
}

/** Hardship takes `hp` from someone, and kills them of `cause` at none left; the founder is only laid low. Returns
 *  whether they died. */
function harm(s: GameState, p: Person, hp: number, cause: string): boolean {
  p.hp -= hp;
  if (p.hp > 0) return false;
  if (p.id === s.mainId) {
    p.hp = Math.min(1, p.hp + hp);
    return false;
  }
  killPerson(s, p, cause);
  return true;
}

/** Once an hour (from sim.ts). */
export function hardshipHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  fevers(s);
  if (s.gameOver) return;
  fester(s);
  if (s.gameOver) return;
  stackWoodpile(s);
  winter(s);
  if (calendarOf(s).hour === SPOIL_HOUR) spoil(s);
}

/** Fevers: one breaks out now and then in a town big and crowded enough; the sick pass it to those near them, lose
 *  health while it burns (half in a sickbed), and get over it or die. Outside a plague, any sickness runs its course
 *  here (an event's sickness used to last until a plague came). */
function fevers(s: GameState): void {
  const plague = s.doom?.kind === 'plague' && s.doom.phase === 'active';
  if (plague) return; // (the plague's own rules hold the sick: sim/doom.ts)
  const rng = stream(s, 'fever');
  const here = home(s);
  const dirt = squalor(s);
  if (here.length >= FEVER_FROM && s.tick >= FEVER_FROM_DAY * TICKS_PER_DAY && !here.some(fevered) && rng.chance((FEVER_DAILY / 24) * (here.length / FEVER_TOWN) * dirt)) {
    const pool = here.filter((p) => catches(s, p));
    if (pool.length) {
      const p = pool[Math.floor(rng.next() * pool.length)];
      catchFever(s, p, rng);
      notify(s, `${p.name} has come down with a fever. ${dirt > 1.5 ? 'The town is crowded and dirty: it may spread.' : 'Keep the sick apart.'}`, true);
    }
  }
  for (const p of [...here]) {
    if (!p.sick) continue;
    if (fevered(p)) {
      const near = FEVER_NEAR * CELL;
      for (const o of here) if (o !== p && catches(s, o) && Math.hypot(o.x - p.x, o.y - p.y) <= near && rng.chance(FEVER_SPREAD * dirt * (weak(o) ? FEVER_WEAK : 1))) catchFever(s, o, rng);
      if (harm(s, p, FEVER_HP_PER_HOUR * (sickbedHealing(s, p) !== null ? FEVER_TENDED : 1), 'of a fever')) {
        if (s.gameOver) return;
        continue;
      }
    }
    if (s.tick >= p.sick.until) {
      const was = fevered(p);
      p.sick = null;
      if (!was) continue;
      p.feverSpared = s.tick + FEVER_SPARED_DAYS * TICKS_PER_DAY;
      notify(s, `${p.name}'s fever has broken.`);
    }
  }
}

/** Cold or going hungry: a fever takes them more readily. */
const weak = (p: Person) => !!p.cold || !!p.starving;

/** Not sick already, nor over a fever lately. */
const catches = (s: GameState, p: Person) => !p.sick && s.tick >= (p.feverSpared ?? 0);

function catchFever(s: GameState, p: Person, rng: Rng): void {
  p.sick = { until: s.tick + rng.int(FEVER_HOURS[0], FEVER_HOURS[1]) * TICKS_PER_HOUR, fever: true };
  if (p.task?.type === 'sleep' && p.activity === 'sleep') return;
  notify(s, `${p.name} is feverish.`);
}

/** Festering: an open wound left untended may turn bad (a dressing in store cleans it instead); it takes health till
 *  the body throws it off, likeliest in a sickbed. */
function fester(s: GameState): void {
  const rng = stream(s, 'fester');
  for (const p of [...home(s)]) {
    if (!p.wounds?.length || p.downed) continue;
    const tended = sickbedHealing(s, p) !== null;
    const bad = p.wounds.find((w) => w.fester);
    if (bad) {
      if (harm(s, p, FESTER_HP_PER_HOUR, 'of a festering wound')) {
        if (s.gameOver) return;
        continue;
      }
      const inBed = p.task?.type === 'sleep' && p.task.building !== null && p.activity === 'sleep';
      if (rng.chance(tended ? FESTER_CLEARS.sickbed : inBed ? FESTER_CLEARS.bed : FESTER_CLEARS.about)) {
        bad.fester = undefined;
        notify(s, `The rot has gone out of ${p.name}'s ${WOUNDS[bad.kind].name}.`);
      }
      continue;
    }
    if (tended) continue;
    const open = p.wounds.find((w) => (w.kind === 'cut' || w.kind === 'bite' || w.kind === 'burn') && w.sev >= FESTER_FROM);
    if (!open || !rng.chance(FESTER_CHANCE * (p.bed === null ? FESTER_BEDLESS : 1))) continue;
    const dressing = (s.items.bandage ?? 0) > 0 ? 'bandage' : (s.items.poultice ?? 0) > 0 ? 'poultice' : null;
    if (dressing) {
      addItems(s, dressing, -1);
      notify(s, `${p.name}'s ${WOUNDS[open.kind].name} was turning bad: it was cleaned and dressed with a ${dressing}.`);
      continue;
    }
    open.fester = true;
    notify(s, `${p.name}'s ${WOUNDS[open.kind].name} has begun to fester! A sickbed or a dressing would help.`, true);
  }
}

/** Winter: everyone burns more to keep warm, and those asleep on the cold ground lose health instead of mending. The
 *  hearths burn firewood (`hearths`): with none left, everyone at home is cold, those asleep in a bed at
 *  `COLD_IN_BED`, those up and about at `COLD_AWAKE`. */
function winter(s: GameState): void {
  const cold = calendarOf(s).season === 'winter';
  const snow = cold && weatherAt(s.seed, s.tick, s.doom?.phase === 'active' ? s.doom.kind : null).kind === 'snow';
  const warm = cold ? hearths(s) : true;
  for (const p of [...home(s)]) {
    const asleep = p.task?.type === 'sleep' && p.activity === 'sleep';
    const ground = asleepOnGround(p);
    p.cold = cold && !p.downed && (ground || !warm) ? true : undefined;
    if (!cold) continue;
    p.needs.food = Math.max(0, p.needs.food - FOOD_PER_HOUR * WINTER_APPETITE);
    if (!p.cold) continue;
    if (harm(s, p, COLD_HP_PER_HOUR * (snow ? WINTER_SNOW : 1) * (ground ? 1 : asleep ? COLD_IN_BED : COLD_AWAKE), 'of the cold') && s.gameOver) return;
  }
}

/** The winter's hearths, once an hour: the town burns `FIREWOOD_PER_HEAD` a head a day, from the woodpile put by
 *  (`s.woodpile`), then the stores' wood, then coal, owing a part of a log to the next hour. Returns whether the
 *  hearths are lit. A heater warms the town for nothing, and in a Deep Freeze the disaster's own burning keeps the
 *  town warm or not (sim/doom.ts `keepWarm`). */
export function hearths(s: GameState): boolean {
  if (s.doom?.kind === 'deep_freeze' && s.doom.phase === 'active') return !s.doom.cold;
  if (heated(s)) return true;
  let need = (s.hearthOwed ?? 0) + home(s).length * (FIREWOOD_PER_HEAD / 24);
  const pile = Math.min(s.woodpile ?? 0, Math.floor(need));
  s.woodpile = (s.woodpile ?? 0) - pile || undefined;
  need -= pile;
  for (const m of ['wood', 'coal'] as const)
    for (const st of storages(s))
      while (need >= 1 && (st.store[m] ?? 0) > 0) {
        addStock(st.store, m, -1);
        need -= HEAT_VALUE[m];
      }
  const lit = need < 1;
  s.hearthOwed = Math.max(0, Math.min(1, need)) || undefined;
  if (!lit && !s.hearthsCold) notify(s, 'The woodpile is bare and the hearths have gone cold! Gather firewood, or the townsfolk will freeze in their beds.', true);
  if (lit && s.hearthsCold) notify(s, 'There is firewood again: the hearths are lit.');
  s.hearthsCold = lit ? undefined : true;
  return lit;
}

/** A heater the Deep Freeze knows (a power station) warms the town for nothing. */
const heated = (s: GameState) => FREEZE_HEATERS.some((h) => s.buildings.some((b) => b.def === h && b.status === 'done'));

/** A winter's burning for everyone at home, from autumn on, less each winter day gone (none with a heater). */
function winterNeed(s: GameState): number {
  if (s.autopilot === false) return 0;
  const cal = calendarOf(s);
  if (cal.season !== 'autumn' && cal.season !== 'winter') return 0;
  if (heated(s)) return 0;
  const days = cal.season === 'winter' ? DAYS_PER_SEASON - cal.dayOfSeason + 1 : DAYS_PER_SEASON;
  return Math.ceil(home(s).length * FIREWOOD_PER_HEAD * days);
}

/** Firewood the town still wants put by: the winter's need less what's on the woodpile. The planner gathers it
 *  (sim/planner.ts `needs`), and the wall's haulers leave it in the stores (people.ts `findJob`). */
export const firewoodWanted = (s: GameState): number => Math.max(0, winterNeed(s) - (s.woodpile ?? 0));

/** Once an hour from autumn on: wood in the stores is stacked on the woodpile till it holds the winter's need. The
 *  woodpile is the hearths' alone: the lamps, the crafts and the builders never draw on it. */
function stackWoodpile(s: GameState): void {
  let want = Math.floor(firewoodWanted(s));
  for (const st of storages(s)) {
    if (want <= 0) return;
    const n = Math.min(want, Math.floor(st.store.wood ?? 0));
    if (n <= 0) continue;
    addStock(st.store, 'wood', -n);
    s.woodpile = (s.woodpile ?? 0) + n;
    want -= n;
  }
}

/** Foraging's pace in the season: the winter's land is bare (people.ts, the foragers and the hungry scrounging). */
export const winterForage = (s: GameState): number => (s.autopilot !== false && calendarOf(s).season === 'winter' ? WINTER_FORAGE : 1);

/** The hour food spoils, once a day. */
const SPOIL_HOUR = 6;

/** Food spoils, once a day: a share of each pile of fresh food left in an open store (a campfire's cache, a
 *  stockpile) rots, less in a granary and in the winter's cold; what's dried, baked or packed keeps. */
function spoil(s: GameState): void {
  const chill = calendarOf(s).season === 'winter' ? SPOIL_WINTER : 1;
  let lost = 0;
  for (const st of storages(s)) {
    const kept = st.def === 'granary' ? SPOIL_GRANARY : 1;
    for (const [m, rate] of Object.entries(SPOIL_DAILY) as [Material, number][]) {
      const have = st.store[m] ?? 0;
      if (have <= 0) continue;
      // (a share of the pile, rounded by the pile's own day so a small pile rots now and then, not never)
      const n = Math.floor(have * rate * kept * chill + frac(s, st.id, m));
      if (n <= 0) continue;
      addStock(st.store, m, -n);
      lost += n;
    }
  }
  if (lost >= SPOIL_NOTICE) notify(s, `${lost} of the town's food has spoiled in the stores. A granary keeps it; dried meat and bread keep best.`);
}
/** A pile's rounding for the day, steady for it (hashed, so no stream is drawn). */
const frac = (s: GameState, id: number, m: string) => (hashSeed(`${s.seed}:hardship-spoil:${id}:${m}:${Math.floor(s.tick / TICKS_PER_DAY)}`) % 1000) / 1000;
/** Spoilage worth telling the town about. */
const SPOIL_NOTICE = 5;
