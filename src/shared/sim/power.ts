// Power levels (the owner's ask: "a power level for townsfolk and enemies, so I know what to expect in fights and
// duels"). One rough number for anyone who can fight, worked out from the same figures the fight uses (health,
// blows, aim, armour, dodge, pace), plus a short label for how two sides match. A guide only: it reads the
// fighter, it never changes a fight, and it draws no random numbers.

import { DUNGEON_BY_ID } from '../data/dungeons';
import { ENEMIES, type EnemyGroup } from '../data/enemies';
import type { Destination } from '../data/expeditions';
import { personFighter, unitFighter, type Fighter } from './combat';
import { TICK_HZ } from './time';
import type { Person } from './state';

/** The dodge and armour of the sort of foe a fighter is weighed against (the average of the town's fights). */
const TYPICAL_DODGE = 0.1;
/** Scales the raw worth so a fresh townsperson reads about 10. */
const POWER_SCALE = 1.3;

/** One fighter's power: the square root of how long they last times how hard they hit, so a fighter twice as tough,
 *  or twice as deadly, reads about 1.4 times as strong (and both, twice). */
export function powerOfFighter(f: Pick<Fighter, 'maxHp' | 'damage' | 'accuracy' | 'interval' | 'armor' | 'block' | 'dodge' | 'quirks'>): number {
  const avg = (f.damage[0] + f.damage[1]) / 2;
  const crit = f.quirks?.crit ?? 0;
  const hit = Math.min(1, Math.max(0.05, f.accuracy - TYPICAL_DODGE));
  const blows = TICK_HZ / Math.max(1, f.interval);
  const dps = avg * (1 + crit * (1 + (f.quirks?.critDamage ?? 0))) * hit * blows;
  // (armour and blocking soak blows; dodging turns them aside)
  const soak = Math.max(0.05, (1 - Math.min(0.9, f.armor)) * (1 - Math.min(0.9, f.block)) * (1 - Math.min(0.8, f.dodge)));
  const lasts = f.maxHp / soak;
  return Math.max(0, Math.round(Math.sqrt(lasts * dps) * POWER_SCALE));
}

/** A townsperson's power as they stand now: level, stats, class, weapon, armour, and their wounds and lost parts
 *  (all in `personFighter`). Someone hurt right now reads lower, by the health they have left. */
export function powerOfPerson(p: Person): number {
  const f = personFighter(p, 'fighter', 'front', 1);
  const base = powerOfFighter(f);
  return Math.round(base * Math.sqrt(Math.min(1, Math.max(0.1, f.hp / Math.max(1, f.maxHp)))));
}

/** A kind of foe's power (a raider's `might` multiplies its health and blows). */
export function powerOfEnemy(kind: string, might = 1): number {
  if (!ENEMIES[kind]) return 0;
  const f = unitFighter(kind, 'enemy', 0);
  f.maxHp = Math.round(f.maxHp * might);
  f.damage = [f.damage[0] * might, f.damage[1] * might];
  return powerOfFighter(f);
}

/** A band of foes together. Fighters on a side add up (a side of ten is about ten times one of them), which is
 *  what the square law of a fight comes to when each is weighed by the square root of health times damage. */
export function powerOfGroup(group: EnemyGroup, might = 1): number {
  let t = 0;
  for (const [kind, n] of Object.entries(group)) t += powerOfEnemy(kind, might) * n;
  return t;
}

/** A party of people, together. */
export const powerOfParty = (people: Person[]): number => people.reduce((t, p) => t + (p.hp > 0 && !p.downed ? powerOfPerson(p) : 0), 0);

export type Matchup = 'Easy' | 'Even' | 'Risky' | 'Deadly';

/** How the sides match, from `mine` against `theirs`: Easy (clearly the stronger), Even, Risky (they are the
 *  stronger), Deadly (far stronger). */
export function matchupOf(mine: number, theirs: number): Matchup {
  const r = theirs / Math.max(1, mine);
  return r < 0.65 ? 'Easy' : r < 1.15 ? 'Even' : r < 1.8 ? 'Risky' : 'Deadly';
}

/** "Your party 240 vs about 310: Risky", for an offer. */
export const powerLine = (mine: number, theirs: number, who = 'Your party'): string => `${who} ${Math.round(mine)} vs about ${Math.round(theirs)}: ${matchupOf(mine, theirs)}`;

/** What a place's foes come to: a fight on the road (the groups it may meet, weighted by their odds), and for a dungeon
 *  its bosses (the middle of the bosses that may wait). 0 where nothing is feared. */
export function placeFoes(d: Destination): { foes: number; boss: number } {
  const gs = d.encounters?.groups ?? [];
  const w = gs.reduce((n, g) => n + g.weight, 0) || 1;
  const foes = gs.reduce((n, g) => n + powerOfGroup(g.enemies) * g.weight, 0) / w;
  const bosses = DUNGEON_BY_ID[d.id]?.bosses ?? [];
  const boss = bosses.length ? bosses.reduce((n, g) => n + powerOfGroup(g), 0) / bosses.length : 0;
  return { foes: Math.round(foes), boss: Math.round(boss) };
}

/** The foes an offer weighs against: the worst of a fight on the road and the boss at the bottom. */
export const foesToExpect = (d: Destination): number => {
  const f = placeFoes(d);
  return Math.max(f.foes, f.boss);
};
