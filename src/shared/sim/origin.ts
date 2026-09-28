// How the town's origin (data/origins.ts) and the powers it has cast (powers.ts) bend each system: the multipliers
// the rest of the sim asks for. Settlers, with nothing cast, get 1 everywhere.

import { rulesOf } from '../data/origins';
import { FULL_MOON_PHASE, moonPhaseOf } from './monsters';
import type { GameState, Person } from './state';
import { calendar } from './time';

/** Whether a power's lasting effect is still on. */
export const buffOn = (s: GameState, id: string) => (s.buffs?.[id] ?? -1) > s.tick;

const night = (s: GameState) => {
  const h = calendar(s.tick).hour;
  return h >= 20 || h < 5;
};
const fullMoonNow = (s: GameState) => moonPhaseOf(calendar(s.tick).day) === FULL_MOON_PHASE;

/** Everyone's work: by day and by night, under a full moon, and while a power drives them on. */
export function originWork(s: GameState, _p: Person): number {
  const r = rulesOf(s);
  let f = night(s) ? (r.night ?? 1) : (r.day ?? 1);
  if (r.moonFury && fullMoonNow(s)) f *= 1.3;
  if (buffOn(s, 'overclock')) f *= 1.5;
  if (buffOn(s, 'moon_frenzy')) f *= 1.25;
  return f;
}

export const buildSpeed = (s: GameState) => rulesOf(s).build ?? 1;
export const cropSpeed = (s: GameState) => (rulesOf(s).crops ?? 1) * (buffOn(s, 'call_rain') ? 1.5 : 1);
export const forageSpeed = (s: GameState) => rulesOf(s).forage ?? 1;
export const researchSpeed = (s: GameState) => rulesOf(s).research ?? 1;
export const craftSpeed = (s: GameState) => rulesOf(s).craft ?? 1;
/** Grades added to (or taken from) what crafters usually make. */
export const qualityBonus = (s: GameState) => (rulesOf(s).quality ?? 0) + (buffOn(s, 'forge_blessing') ? 2 : 0);
/** How much more often strangers come, and how much more they pay. */
export const travellerRate = (s: GameState) => (rulesOf(s).travellers ?? 1) * (buffOn(s, 'trade_road') ? 3 : 1);
export const priceRate = (s: GameState) => (rulesOf(s).prices ?? 1) * (buffOn(s, 'glamour') ? 2 : 1);

/** Townsfolk's blows in a raid, and the harm they take. */
export function fightRate(s: GameState): number {
  const r = rulesOf(s);
  return (r.fight ?? 1) * (r.moonFury && fullMoonNow(s) ? 1.3 : 1) * (buffOn(s, 'rally') ? 1.3 : 1) * (buffOn(s, 'moon_frenzy') ? 1.25 : 1);
}
export function guardRate(s: GameState): number {
  return (rulesOf(s).guard ?? 1) * (buffOn(s, 'stone_skin') || buffOn(s, 'shield_wall') || buffOn(s, 'bone_ward') ? 0.6 : 1);
}
