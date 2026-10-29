// Hard times (data/hardship.ts; docs/notes/deaths-common.md): the dangers of real want. Once an hour, with the
// autopilot on: a fever may break out in a crowded, dirty town and spread among those near the sick; an open wound
// left untended may fester; and in winter everyone eats more and those sleeping on the ground grow cold. Each takes
// health and stops the body mending while it lasts (`noMending`, read by health.ts `heal`), so it kills the weak
// first: the hurt, the hungry, the old. A sickbed, a dressing, a bed and a well are the cures. Each rule draws from
// its own side stream, so the town's own stream is untouched.

import {
  COLD_HP_PER_HOUR,
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
import { WOUNDS } from '../data/injuries';
import { hashSeed, Rng } from '../rng';
import { killPerson } from './health';
import { CELL } from './land';
import { sickbedHealing } from './sickbeds';
import { addItems } from './crafting';
import { notify, tireless, type GameState, type Person } from './state';
import { calendarOf, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { FOOD_PER_HOUR } from './townsfolk';
import { weatherAt } from './weather';

const stream = (s: GameState, rule: string) => new Rng(hashSeed(`${s.seed}:hardship-${rule}:${s.tick}`));
const home = (s: GameState) => s.people.filter((p) => p.away === null && !tireless(p));
const asleepOnGround = (p: Person) => p.task?.type === 'sleep' && p.task.building === null && p.activity === 'sleep';
/** A fever, as against a plague or an event's sickness (which run their own course). */
export const fevered = (p: Person) => !!p.sick?.fever;
export const festering = (p: Person) => !!p.wounds?.some((w) => w.fester);
/** The body doesn't mend while a fever burns, a wound festers or they lie cold on the winter ground. */
export const noMending = (p: Person) => fevered(p) || festering(p) || !!p.cold;

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
  winter(s);
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
      for (const o of here) if (o !== p && catches(s, o) && Math.hypot(o.x - p.x, o.y - p.y) <= near && rng.chance(FEVER_SPREAD * dirt)) catchFever(s, o, rng);
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

/** Winter: everyone burns more to keep warm, and those asleep on the cold ground lose health instead of mending. */
function winter(s: GameState): void {
  const cold = calendarOf(s).season === 'winter';
  const snow = cold && weatherAt(s.seed, s.tick, s.doom?.phase === 'active' ? s.doom.kind : null).kind === 'snow';
  for (const p of [...home(s)]) {
    p.cold = cold && asleepOnGround(p) && !p.downed ? true : undefined;
    if (!cold) continue;
    p.needs.food = Math.max(0, p.needs.food - FOOD_PER_HOUR * WINTER_APPETITE);
    if (!p.cold) continue;
    if (harm(s, p, COLD_HP_PER_HOUR * (snow ? WINTER_SNOW : 1), 'of the cold') && s.gameOver) return;
  }
}
