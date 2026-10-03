// How the town's origin (data/origins.ts) and the powers it has cast (powers.ts) bend each system: the multipliers
// the rest of the sim asks for. Settlers, with nothing cast, get 1 everywhere.

import { RENOWN_FIGHT, RENOWN_FIGHT_MAX } from '../data/pack';
import type { Lever } from '../data/events';
import { rulesOf } from '../data/origins';
import { FULL_MOON_PHASE, moonPhaseOf } from './monsters';
import { researchMods } from './research';
import type { GameState, Person } from './state';
import { calendar } from './time';

/** The product of the choice events' marks on a lever right now (1 when there are none; sim/events.ts). */
export function markMult(s: GameState, lever: Lever): number {
  let f = 1;
  for (const m of s.marks ?? []) if (m.lever === lever && m.until > s.tick) f *= m.value;
  return f;
}

/** Everyone's morale from the choice events' marks: [reason, value] for each still on. */
export const moraleMarks = (s: GameState): [string, number][] => (s.marks ?? []).filter((m) => m.lever === 'morale' && m.until > s.tick).map((m) => [m.text, m.value]);

/** Whether a power's lasting effect is still on. */
export const buffOn = (s: GameState, id: string) => (s.buffs?.[id] ?? -1) > s.tick;

const night = (s: GameState) => {
  const h = calendar(s.tick).hour;
  return h >= 20 || h < 5;
};
const fullMoonNow = (s: GameState) => moonPhaseOf(calendar(s.tick).day) === FULL_MOON_PHASE;

/** What the town's research adds to each lever (1 where nothing does). */
const learned = (s: GameState) => researchMods(s.research).rules;

/** Everyone's work: by day and by night, under a full moon, and while a power drives them on. */
export function originWork(s: GameState, _p: Person): number {
  const r = rulesOf(s);
  let f = night(s) ? (r.night ?? 1) * learned(s).night : (r.day ?? 1) * learned(s).day;
  if (r.moonFury && fullMoonNow(s)) f *= 1.3;
  if (buffOn(s, 'overclock')) f *= 1.5;
  if (buffOn(s, 'moon_frenzy')) f *= 1.25;
  return f * markMult(s, 'work');
}

export const buildSpeed = (s: GameState) => (rulesOf(s).build ?? 1) * learned(s).build * markMult(s, 'build');
export const cropSpeed = (s: GameState) => (rulesOf(s).crops ?? 1) * (buffOn(s, 'call_rain') ? 1.5 : 1) * markMult(s, 'crops');
export const forageSpeed = (s: GameState) => (rulesOf(s).forage ?? 1) * markMult(s, 'forage');
export const researchSpeed = (s: GameState) => (rulesOf(s).research ?? 1) * markMult(s, 'research');
export const craftSpeed = (s: GameState) => (rulesOf(s).craft ?? 1) * learned(s).craft * markMult(s, 'craft');
/** Grades added to (or taken from) what crafters usually make. */
export const qualityBonus = (s: GameState) => (rulesOf(s).quality ?? 0) + researchMods(s.research).quality + (buffOn(s, 'forge_blessing') ? 2 : 0);
/** How much more often strangers come, and how much more they pay. */
export const travellerRate = (s: GameState) => (rulesOf(s).travellers ?? 1) * learned(s).travellers * (buffOn(s, 'trade_road') ? 3 : 1) * markMult(s, 'travellers');
export const priceRate = (s: GameState) => (rulesOf(s).prices ?? 1) * learned(s).prices * (buffOn(s, 'glamour') ? 2 : 1) * markMult(s, 'prices');

/** Townsfolk's blows in a raid, and the harm they take. */
export function fightRate(s: GameState): number {
  const r = rulesOf(s);
  // (the Moon Pack's renown is in every blow: data/pack.ts)
  const pack = s.origin === 'werewolf' && s.pack ? 1 + Math.min(RENOWN_FIGHT_MAX, s.pack.renown * RENOWN_FIGHT) : 1;
  return (r.fight ?? 1) * learned(s).fight * (r.moonFury && fullMoonNow(s) ? 1.3 : 1) * (buffOn(s, 'rally') ? 1.3 : 1) * (buffOn(s, 'moon_frenzy') ? 1.25 : 1) * markMult(s, 'fight') * pack;
}
export function guardRate(s: GameState): number {
  return (rulesOf(s).guard ?? 1) * learned(s).guard * (buffOn(s, 'stone_skin') || buffOn(s, 'shield_wall') || buffOn(s, 'bone_ward') ? 0.6 : 1) * markMult(s, 'guard');
}
