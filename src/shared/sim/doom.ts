// World-dooming events (DESIGN §3). A disaster is scheduled every week or so; its signs show a day ahead,
// then it strikes: a drought stalls the fields and the foraging, a plague spreads between people who spend
// time together. The town gets through it with wells, infirmaries and dressings (or loses people).

import {
  ASH_FORAGE,
  DOOM_EVERY_DAYS,
  DOOM_FIRST_DAY,
  DOOMS,
  METEOR_HITS,
  DROUGHT_FORAGE,
  DROUGHT_GROWTH,
  DROUGHT_GROWTH_WELL,
  PLAGUE_HOURS,
  PLAGUE_HP_PER_HOUR,
  PLAGUE_SPREAD,
  SMOG_HP_PER_HOUR,
  SMOG_MIN_WORKS,
  SMOKY_WORKS,
  WAR_RAID_EVERY_HOURS,
  OUTBREAK_FROM_DAY,
  ZOMBIE_WAVE_HOURS,
  ABOMINATION_BEFORE_END_HOURS,
  ARCHMAGE_BEFORE_END_HOURS,
  ARCHMAGE_HP_BY_ERA,
  FREEZE_FORAGE,
  FREEZE_FROM_DAY,
  FREEZE_HEATERS,
  FREEZE_HP_PER_HOUR,
  FREEZE_PEOPLE_PER_HEAT,
  FREEZE_WAVE_HOURS,
  HEAT_VALUE,
  FALLOUT_HP_PER_HOUR,
  RAT_KING_BEFORE_END_HOURS,
  RAT_KING_HP_BY_ERA,
  RAT_WAVE_HOURS,
  RATS_EAT_PER_HOUR,
  type DoomKind,
} from '../data/doom';
import { FOOD_VALUE } from '../data/people';
import type { Material } from '../data/materials';
import { buildingCentreX, storages } from './buildings';
import { eraReached } from '../data/eras';
import { biomeOf, difficultyOf } from '../data/biomes';
import { NEAR_PX } from '../data/social';
import { hashSeed, mixSeed, type Rng } from '../rng';
import { killPerson } from './health';
import { setFire } from './fire';
import { raidBudget, shielded, startRaid } from './raids';
import { isLich } from './turning';
import { RAID_KIND_BY_ID } from '../data/raids';
import { ENEMIES } from '../data/enemies';
import { addStock, ERA_MULTIPLIER, notify, personFx, type GameState, type Person } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export interface Doom {
  kind: DoomKind;
  phase: 'signs' | 'active';
  /** Signs: when it strikes. Active: when it ends (drought; a plague ends when nobody is sick). */
  untilTick: number;
  /** Outbreak: the Abomination has come; the lich founder commands the dead. */
  bossSent?: boolean;
  commanded?: boolean;
  /** Deep Freeze: the town ran out of heat last hour; heat it still owes (a fraction of a unit); when the
   *  Archmage can come again. */
  cold?: boolean;
  heatOwed?: number;
  bossAgainTick?: number;
}

/** Disasters come less often in later eras (by the era multiplier) and last longer (by its square root). But not
 *  the ones that stop the food: people eat on the same clock in every era, so a ten-day ash winter would just be
 *  a famine. Those (and the waves and the cold of a Deep Freeze) keep the same length in every era. */
const FOOD_DOOMS: readonly DoomKind[] = ['drought', 'ash_winter', 'deep_freeze', 'meltdown'];
const stretch = (s: GameState) => (s.doom && FOOD_DOOMS.includes(s.doom.kind) ? 1 : Math.sqrt(ERA_MULTIPLIER[s.era]));

const built = (s: GameState, def: string) => s.buildings.some((b) => b.def === def && b.status === 'done');

/** A drought is on. */
export const drought = (s: GameState) => s.doom?.kind === 'drought' && s.doom.phase === 'active';

export const isSick = (p: Person) => p.sick != null;

/** Which disaster is striking right now, if any. */
export const striking = (s: GameState, kind: DoomKind) => s.doom?.kind === kind && s.doom.phase === 'active';

/** The disasters that can come now: by era, and smog only to a town with enough smoky works. */
export function possibleDooms(s: GameState): DoomKind[] {
  const works = s.buildings.filter((b) => b.status === 'done' && SMOKY_WORKS.includes(b.def)).length;
  return (Object.keys(DOOMS) as DoomKind[]).filter((k) => eraReached(s.era, DOOMS[k].era) && (k !== 'smog' || works >= SMOG_MIN_WORKS) && (k !== 'rogue_ai' || s.research.done.includes('robotics')) && (k !== 'outbreak' || s.tick >= OUTBREAK_FROM_DAY * TICKS_PER_DAY) && (k !== 'deep_freeze' || s.tick >= FREEZE_FROM_DAY * TICKS_PER_DAY) && (k !== 'meltdown' || built(s, 'power_station')));
}

/** Once an hour: schedule, warn, strike, run and end disasters. */
export function updateDoom(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  // (the first date comes from the seed, not the RNG, so nothing else's randomness shifts before then)
  if (!s.nextDoomTick) s.nextDoomTick = DOOM_FIRST_DAY * TICKS_PER_DAY + (mixSeed(hashSeed(s.seed), 0xd0) % 48) * TICKS_PER_HOUR;
  const d = s.doom;
  if (!d) {
    if (s.tick < s.nextDoomTick) return;
    const odds = biomeOf(s).dooms ?? {};
    const kind = rng.weighted(Object.fromEntries(possibleDooms(s).map((k) => [k, DOOMS[k].weight * (odds[k] ?? 1)])) as Record<DoomKind, number>);
    s.doom = { kind, phase: 'signs', untilTick: s.tick + Math.round(DOOMS[kind].warnHours * stretch(s) * TICKS_PER_HOUR) };
    notify(s, DOOMS[kind].signs, true);
    return;
  }
  const def = DOOMS[d.kind];
  if (d.phase === 'signs') {
    if (s.tick < d.untilTick) return;
    d.phase = 'active';
    d.untilTick = s.tick + Math.round(rng.int(def.hours[0], def.hours[1]) * stretch(s) * TICKS_PER_HOUR);
    notify(s, def.strikes, true);
    if (d.kind === 'plague') {
      const here = s.people.filter((p) => p.away === null);
      if (here.length) infect(s, rng.pick(here), rng);
    }
    if (d.kind === 'meteors') meteorStrike(s, rng);
    if (d.kind === 'meltdown') {
      const reactor = s.buildings.find((b) => b.def === 'power_station' && b.status === 'done');
      if (reactor) setFire(s, reactor, true);
    }
    // a hidden gift: the dead know a lich when they see one
    if (d.kind === 'outbreak' && isLich(s)) {
      const main = s.people.find((p) => p.id === s.mainId);
      s.prompts.push({
        id: s.nextId++,
        kind: 'lich',
        expedition: null,
        title: 'The dead hear their master',
        text: `The walking dead turn their heads toward ${main?.name ?? 'the lich'}. They are waiting for a command.`,
        options: ['Command the dead', 'Let them be'],
        defaultOption: 0,
        expiresTick: s.tick + 6 * TICKS_PER_HOUR,
      });
    }
    return;
  }
  if (d.kind === 'plague') spreadPlague(s, rng);
  if (d.kind === 'smog') breatheSmog(s);
  if (d.kind === 'meltdown') breatheSmog(s, FALLOUT_HP_PER_HOUR);
  // in a war the raids keep coming
  if (d.kind === 'outbreak') {
    s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + Math.round(ZOMBIE_WAVE_HOURS * stretch(s) * TICKS_PER_HOUR));
    // the last wave: the Abomination itself
    if (!d.bossSent && !s.raid && d.untilTick - s.tick <= ABOMINATION_BEFORE_END_HOURS * stretch(s) * TICKS_PER_HOUR) {
      d.bossSent = true;
      const wave = startRaid(s, RAID_KIND_BY_ID.zombies, raidBudget(s), rng);
      wave.raiders.push({ ...wave.raiders[0], id: s.nextId++, kind: 'abomination', hp: ENEMIES.abomination.hp, maxHp: ENEMIES.abomination.hp, x: wave.raiders[0].x + wave.side * 30, ally: false });
    }
  }
  // in a Deep Freeze the town burns what it can to keep warm; the ice mages keep coming, and at last their Archmage
  if (d.kind === 'deep_freeze') {
    keepWarm(s, d, stretch(s));
    const gap = Math.round(FREEZE_WAVE_HOURS * stretch(s) * TICKS_PER_HOUR);
    s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + gap);
    // near the end the Archmage leads the waves itself, and keeps coming back until it's slain
    leadWaves(s, d, rng, 'frost', 'frost_archmage', ARCHMAGE_BEFORE_END_HOURS, ARCHMAGE_HP_BY_ERA[s.era], gap, 'The Frost Archmage strides back out of the storm!');
  }
  // a Rat Plague: the rats get into the stores, the swarms keep coming, and at last the Rat King
  if (d.kind === 'rat_plague') {
    gnawStores(s);
    const gap = Math.round(RAT_WAVE_HOURS * stretch(s) * TICKS_PER_HOUR);
    s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + gap);
    leadWaves(s, d, rng, 'rats', 'rat_king', RAT_KING_BEFORE_END_HOURS, RAT_KING_HP_BY_ERA[s.era] ?? 1, gap, 'The Rat King crawls back up out of the sewers!');
  }
  if (d.kind === 'war' || d.kind === 'rogue_ai') s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + Math.round(WAR_RAID_EVERY_HOURS * stretch(s) * TICKS_PER_HOUR));
  const over = d.kind === 'plague' ? !s.people.some(isSick) : s.tick >= d.untilTick;
  if (over) {
    s.doom = null;
    s.nextDoomTick = s.tick + Math.round(rng.int(DOOM_EVERY_DAYS[0] * 24, DOOM_EVERY_DAYS[1] * 24) * ERA_MULTIPLIER[s.era] * difficultyOf(s).doomGap * TICKS_PER_HOUR);
    notify(s, def.ends, true);
  }
}

/** Near the end of an invasion (the Deep Freeze, the Rat Plague), its boss leads a wave itself whenever the town
 *  is clear, and keeps coming back (once every `gap`) until it's slain, which ends the whole thing. */
function leadWaves(s: GameState, d: Doom, rng: Rng, raidKind: string, boss: string, beforeEndHours: number, hpScale: number, gap: number, again: string): void {
  if (s.raid || s.tick < (d.bossAgainTick ?? 0) || d.untilTick - s.tick > beforeEndHours * stretch(s) * TICKS_PER_HOUR) return;
  if (d.bossSent) notify(s, again, true);
  d.bossSent = true;
  d.bossAgainTick = s.tick + gap;
  const wave = startRaid(s, RAID_KIND_BY_ID[raidKind], raidBudget(s), rng);
  const hp = Math.round(ENEMIES[boss].hp * hpScale);
  wave.raiders.push({ ...wave.raiders[0], id: s.nextId++, kind: boss, hp, maxHp: hp, x: wave.raiders[0].x + wave.side * 30, goal: 'harm', carrying: {} });
}

/** Rat Plague: once an hour the rats eat a share of every pile of food in storage (small piles they leave). */
function gnawStores(s: GameState): void {
  for (const st of storages(s)) {
    for (const m of Object.keys(FOOD_VALUE) as Material[]) {
      const n = Math.round((st.store[m] ?? 0) * RATS_EAT_PER_HOUR);
      if (n > 0) addStock(st.store, m, -n);
    }
  }
}

/** Deep Freeze: once an hour the town burns heat for everyone in town (wood, then coal, then fuel), unless a
 *  power station warms it. Without enough, the living grow weak with cold. The undead don't feel it. Later
 *  freezes last longer (`stretch`), so each hour costs that much less: a whole freeze takes the same heat in
 *  any era. */
function keepWarm(s: GameState, d: Doom, stretch: number): void {
  const here = s.people.filter((p) => p.away === null && p.monster !== 'undead');
  const wasCold = !!d.cold;
  let need = FREEZE_HEATERS.some((h) => built(s, h)) ? 0 : (d.heatOwed ?? 0) + here.length / FREEZE_PEOPLE_PER_HEAT / stretch;
  for (const m of ['wood', 'coal', 'fuel'] as const) {
    for (const st of storages(s)) {
      while (need >= 1 && (st.store[m] ?? 0) > 0) {
        addStock(st.store, m, -1);
        need -= HEAT_VALUE[m];
      }
    }
  }
  d.cold = need >= 1;
  // (a fraction carries over to the next hour; a debt that can't be paid is the cold, not a growing bill)
  d.heatOwed = Math.min(1, need);
  if (d.cold) for (const p of here) if (!p.downed && p.hp > 1) p.hp = Math.max(1, p.hp - FREEZE_HP_PER_HOUR);
  if (d.cold && !wasCold) notify(s, 'There is nothing left to burn: the town is freezing! Gather wood (or coal) to keep warm.', true);
  if (!d.cold && wasCold) notify(s, 'Fires are lit again, and the town thaws out a little.');
}

/** Someone catches the plague's sickness (from a rat's bite, say), plague or no plague. */
export const sicken = (s: GameState, p: Person, rng: Rng) => infect(s, p, rng);

function infect(s: GameState, p: Person, rng: Rng): void {
  if (isSick(p) || p.monster === 'undead') return; // (the dead can't sicken)
  p.sick = { until: s.tick + rng.int(PLAGUE_HOURS[0], PLAGUE_HOURS[1]) * TICKS_PER_HOUR };
  notify(s, `${p.name} has fallen sick.`);
}

/** The plague runs its course: the sick lose health and pass it on; some recover, some don't. */
function spreadPlague(s: GameState, rng: Rng): void {
  const guard = (built(s, 'infirmary') || built(s, 'hospital') ? 0.5 : 1) * (s.research.done.includes('sanitation') ? 0.3 : 1);
  for (const p of [...s.people]) {
    if (!isSick(p) || p.away !== null) continue;
    for (const o of s.people) if (o !== p && o.away === null && !isSick(o) && Math.abs(o.x - p.x) <= NEAR_PX && rng.chance(PLAGUE_SPREAD * guard)) infect(s, o, rng);
    p.hp -= PLAGUE_HP_PER_HOUR;
    if (p.hp <= 0) {
      killPerson(s, p, 'of the plague');
      if (s.gameOver) return;
      continue;
    }
    if (s.tick >= p.sick!.until) {
      p.sick = null;
      notify(s, `${p.name} has recovered.`);
    }
  }
}

/** Meteors: a few buildings are hit and catch fire (whatever they're made of), unless a shield is up. */
function meteorStrike(s: GameState, rng: Rng): void {
  if (shielded(s)) {
    notify(s, 'The shield flares white, and the meteors burn up above the town.', true);
    return;
  }
  const targets = s.buildings.filter((b) => b.status === 'done' && b.fire === undefined && b.def !== 'campfire');
  const hits = Math.min(targets.length, rng.int(METEOR_HITS[0], METEOR_HITS[1]));
  for (let i = 0; i < hits; i++) {
    const b = targets.splice(rng.int(0, targets.length - 1), 1)[0];
    setFire(s, b, true);
    s.impacts = [...(s.impacts ?? []).filter((m) => s.tick - m.tick < TICKS_PER_HOUR), { tick: s.tick, x: buildingCentreX(b) }];
  }
}

/** Smog: everyone in town loses a little health each hour (less with a hospital). It never kills outright:
 *  it stops at 1 health, but leaves people weak for raids. */
function breatheSmog(s: GameState, perHour = SMOG_HP_PER_HOUR): void {
  const guard = built(s, 'hospital') || built(s, 'trauma_center') ? 0.5 : 1;
  for (const p of s.people) if (p.away === null && !p.downed && p.hp > 1 && p.monster !== 'undead') p.hp = Math.max(1, p.hp - perHour * guard);
}

/** A dressing (bandage or poultice) cuts someone's sickness short (once). Returns true if it was used. */
export function treatSickness(s: GameState, p: Person): boolean {
  if (!p.sick || p.sick.treated) return false;
  p.sick.until = s.tick + Math.max(0, p.sick.until - s.tick) / 2;
  p.sick.treated = true;
  return true;
}

/** How fast fields grow and wild food is foraged right now. */
export function doomGrowth(s: GameState): number {
  if (striking(s, 'ash_winter') || striking(s, 'deep_freeze') || striking(s, 'meltdown')) return 0;
  if (!drought(s)) return 1;
  return built(s, 'well') ? DROUGHT_GROWTH_WELL : DROUGHT_GROWTH;
}
export const doomForage = (s: GameState) => (drought(s) ? DROUGHT_FORAGE : striking(s, 'ash_winter') ? ASH_FORAGE : striking(s, 'deep_freeze') ? FREEZE_FORAGE : 1);

/** The lich's answer to the dead. */
export function answerLich(s: GameState, label: string): void {
  if (s.doom?.kind !== 'outbreak') return;
  if (label.startsWith('Command')) {
    s.doom.commanded = true;
    personFx(s, s.mainId, 'undead');
    notify(s, 'The lich raises a hand, and most of the dead bow. Each wave, they turn on their own kind.', true);
  } else notify(s, 'The lich lets the dead go their own way.');
}

/** Of a wave of the dead, those that answer to a lich (two of every three; never the Abomination). */
export function bindTheDead(s: GameState, raiders: { kind: string; ally?: boolean }[]): void {
  if (s.doom?.kind !== 'outbreak' || !s.doom.commanded) return;
  raiders.forEach((r, i) => {
    if (r.kind !== 'abomination' && i % 3 !== 0) r.ally = true;
  });
}