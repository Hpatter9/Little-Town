// Quality (rarity) of crafted things: gear, wares, fare and furnishings. Each piece is rolled when it's made, and the
// better the crafter's Crafting skill, the better its odds: a novice makes Poor and Common pieces with the odd
// Uncommon; a master makes Epic and Legendary ones, and now and then something Mythic or Divine. Quality scales what
// a piece does: gear's effects, a furnishing's appeal (or comfort), and what it sells for.

import { MAX_SKILL } from './skills';
import type { Rng } from '../rng';

export interface Quality {
  name: string;
  /** For the menus (rarity colours). */
  color: string;
  /** Effects, appeal and price are multiplied by this. */
  mult: number;
}

export const QUALITIES: readonly Quality[] = [
  { name: 'Poor', color: '#9a9a9a', mult: 0.75 },
  { name: 'Common', color: '#e8e0cc', mult: 1 },
  { name: 'Uncommon', color: '#6fd06a', mult: 1.2 },
  { name: 'Rare', color: '#5aa8ff', mult: 1.45 },
  { name: 'Epic', color: '#c070ff', mult: 1.75 },
  { name: 'Legendary', color: '#ff9a30', mult: 2.1 },
  { name: 'Mythic', color: '#ff4a5a', mult: 2.5 },
  { name: 'Divine', color: '#ffe060', mult: 3 },
];
/** Things made before quality existed, or found rather than made, are Common. */
export const COMMON = 1;
export const MAX_QUALITY = QUALITIES.length - 1;

/* A piece's number holds its grade and its +N together: grade + GRADES * plus (so 3 is a Rare piece, 19 a Rare +2).
 * Pieces from before +N existed are +0, and everything that only cares about the grade reads it through gradeOf. */
const GRADES = QUALITIES.length;
export const gradeOf = (q: number | undefined) => Math.max(0, Math.min(MAX_QUALITY, (q ?? COMMON) % GRADES));
export const plusOf = (q: number | undefined) => Math.max(0, Math.min(MAX_PLUS, Math.floor((q ?? COMMON) / GRADES)));
export const piece = (grade: number, plus: number) => grade + GRADES * plus;

export const qualityOf = (q: number | undefined): Quality => QUALITIES[gradeOf(q)];
export const qualityMult = (q: number | undefined) => qualityOf(q).mult;

/** A piece's name: its grade (unless Common), the thing, and its +N. */
export const pieceLabel = (name: string, q: number | undefined) => `${gradeOf(q) !== COMMON ? qualityOf(q).name + ' ' : ''}${name}${plusOf(q) ? ` +${plusOf(q)}` : ''}`;

/* ------------------------------------------------------------ +N */

/** Weapons and armour are made +0 to +5 on top of their grade: each + makes them about this much better at what they
 *  do (damage, aim, armour), so a +5 is worth about three tiers (data/weapons.ts: each tier is 1.28 times the last). */
export const MAX_PLUS = 5;
export const PLUS_STEP = 1.14;
export const plusMult = (q: number | undefined) => PLUS_STEP ** plusOf(q);
/** The chance of the first +, from a novice to a master; each further + is that times PLUS_FADE again, so a master
 *  makes a +1 about one time in three, a +3 about one in a hundred and a +5 about one in fifteen thousand; a novice
 *  all but never gets past +1. */
export const PLUS_FIRST: [number, number] = [0.05, 0.35];
export const PLUS_FADE = 0.65;

/** Roll a piece's +N from its crafter's Crafting level (and a little luck). */
export function rollPlus(rng: Rng, level: number): number {
  const first = PLUS_FIRST[0] + ((PLUS_FIRST[1] - PLUS_FIRST[0]) * (Math.max(1, level) - 1)) / (MAX_SKILL - 1);
  let n = 0;
  while (n < MAX_PLUS && rng.chance(first * PLUS_FADE ** n)) n++;
  return n;
}

/** What a crafter of this Crafting level usually makes (the middle of their range), from Poor-to-Common at level 1
 *  to Epic-to-Legendary at the top. */
export const typicalQuality = (level: number) => 0.6 + (4.6 * (Math.max(1, level) - 1)) / (MAX_SKILL - 1);

/** Roll a piece's quality. Most land within a step of what the crafter usually makes; Mythic and Divine take a
 *  further stroke of luck each, so they stay rare even for a master. */
export function rollQuality(rng: Rng, level: number): number {
  // (three dice make a bell curve around what they usually make)
  const spread = (rng.next() + rng.next() + rng.next() - 1.5) * 1.6;
  let q = Math.round(typicalQuality(level) + spread);
  q = Math.max(0, Math.min(MAX_QUALITY, q));
  if (q >= 6 && !rng.chance(0.4)) q = 5;
  if (q >= 7 && !rng.chance(0.35)) q = 6;
  return q;
}
