// Mental breaks (DESIGN §7): at the breaking point, people sulk, binge on the food, pick a fight with
// someone they can't stand, or give up and walk out of town. A break lets off steam: morale recovers a
// little afterwards. The main character never leaves (they sulk instead).

import { WORLD_WIDTH } from '../constants';
import { FOOD_VALUE } from '../data/people';
import type { Material } from '../data/materials';
import type { Rng } from '../rng';
import { storages } from './buildings';
import { relationsChanged, rivalsOf } from './social';
import { addStock, notify, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';

/** Morale at or below which a break can come, after this many hours there, with this chance an hour. */
export const BREAK_MORALE = 10;
const BREAK_AFTER_HOURS = 2;
const BREAK_CHANCE = 0.35;
/** Below this, walking out of town becomes possible. */
const LEAVE_MORALE = 5;
/** Morale regained when a break ends. */
const RELIEF = 15;

type Kind = NonNullable<Person['breakdown']>['kind'];

/** Once an hour: breaks start, run their course, and end. */
export function updateBreaks(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  for (const p of [...s.people]) {
    if (p.away !== null || p.bornTick != null) continue;
    const b = p.breakdown;
    if (b) {
      if (b.kind === 'binge') binge(s, p);
      if (s.tick >= b.until && b.kind !== 'wander') {
        p.breakdown = null;
        p.morale = Math.min(100, p.morale + RELIEF);
        notify(s, `${p.name} has calmed down.`);
      }
      continue;
    }
    p.lowMoraleHours = p.morale <= BREAK_MORALE ? (p.lowMoraleHours ?? 0) + 1 : 0;
    if (p.lowMoraleHours < BREAK_AFTER_HOURS || !rng.chance(BREAK_CHANCE)) continue;
    startBreak(s, p, rng);
  }
}

function startBreak(s: GameState, p: Person, rng: Rng): void {
  const rival = rivalsOf(s, p).find((r) => r.away === null && !r.downed);
  const odds: Partial<Record<Kind, number>> = { sulk: 3, binge: 2 };
  if (rival) odds.brawl = 3;
  if (p.morale <= LEAVE_MORALE && p.id !== s.mainId) odds.wander = 2;
  const kind = rng.weighted(odds as Record<Kind, number>);
  const hours = rng.int(3, 6);
  p.breakdown = { kind, until: s.tick + hours * TICKS_PER_HOUR };
  p.lowMoraleHours = 0;
  p.task = null;
  switch (kind) {
    case 'sulk':
      notify(s, `${p.name} has had enough and is sulking.`, true);
      return;
    case 'binge':
      notify(s, `${p.name} is stress-eating the town's food.`, true);
      binge(s, p);
      return;
    case 'brawl': {
      // a fight breaks out: both get hurt, and it doesn't help how they feel about each other
      const hurt = (q: Person) => (q.hp = Math.max(1, q.hp - rng.int(6, 14)));
      hurt(p);
      hurt(rival!);
      s.relations[p.id < rival!.id ? `${p.id}-${rival!.id}` : `${rival!.id}-${p.id}`] = -60;
      relationsChanged(s);
      p.breakdown.target = rival!.id;
      notify(s, `${p.name} started a fight with ${rival!.name}!`, true);
      return;
    }
    case 'wander':
      notify(s, `${p.name} can't take it any more and is walking out of town.`, true);
      return;
  }
}

/** Eat two portions from the stores, hungry or not. */
function binge(s: GameState, p: Person): void {
  let eaten = 0;
  for (const st of storages(s)) {
    for (const m of Object.keys(FOOD_VALUE) as Material[]) {
      while (eaten < 2 && (st.store[m] ?? 0) > 0) {
        addStock(st.store, m, -1);
        eaten++;
      }
    }
  }
  p.needs.food = 1;
}

/** Colony collapse (DESIGN §3): average morale this low for this many game hours, and the town is
 *  abandoned. A warning comes halfway. */
export const DESPAIR_MORALE = 8;
export const DESPAIR_HOURS = 24;

/** Once an hour: is the whole town in despair? */
export function checkDespair(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver) return;
  const here = s.people.filter((p) => p.away === null);
  const avg = here.length ? here.reduce((n, p) => n + p.morale, 0) / here.length : 100;
  // (a better hour eases it, but doesn't wipe it out)
  s.despairHours = avg <= DESPAIR_MORALE ? (s.despairHours ?? 0) + 1 : Math.max(0, (s.despairHours ?? 0) - 2);
  if (s.despairHours === DESPAIR_HOURS / 2) notify(s, 'The town is in despair. If spirits don\'t lift soon, everyone will abandon it.', true);
  if (s.despairHours >= DESPAIR_HOURS) {
    s.gameOver = { tick: s.tick, text: 'Hope ran out. One by one, the townsfolk packed up and left, and the town fell silent.' };
    notify(s, s.gameOver.text, true);
  }
}

/** Where someone leaving town walks to. */
export const leaveX = (p: Person) => (p.x < WORLD_WIDTH / 2 ? 0 : WORLD_WIDTH);

/** Every tick: someone walking out who has reached the edge is gone for good. */
export function checkLeavers(s: GameState): void {
  for (const p of s.people) {
    if (p.breakdown?.kind !== 'wander' || Math.abs(p.x - leaveX(p)) > 1) continue;
    s.people = s.people.filter((q) => q !== p);
    if (p.partner != null) {
      const partner = s.people.find((q) => q.id === p.partner);
      if (partner) partner.partner = null;
    }
    notify(s, `${p.name} left town for good.`, true);
    return; // (one a tick is plenty)
  }
}
