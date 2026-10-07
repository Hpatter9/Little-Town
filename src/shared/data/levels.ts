// Levels (the pure numbers; sim/levels.ts gives them out). Everything a townsperson does earns them level XP, fighting
// the most: a level makes them a little tougher and stronger, opens their class's skills and spells, and at the stage
// levels (data/classes.ts STAGE_LEVELS) their class evolves.

import { CLASS_DEFS, STAGE_LEVELS, STAGE_STEP, type ClassId, type ClassStats } from './classes';
import { FOUNDER_CLASS, FOUNDER_EDGE } from './founderClasses';
import { PATH_BY_ID } from './paths';

export const MAX_LEVEL = 100;
/** XP to go from a level to the next: grows with the level, and much faster past LEVEL_STEEP (so the last stage's
 *  levels, and with them the last evolution, come late and to few). */
export const xpToLevel = (level: number) => Math.round(LEVEL_BASE * level ** LEVEL_GROWTH * LEVEL_STEEPNESS ** Math.max(0, level - LEVEL_STEEP));
export const LEVEL_STEEP = 40;
export const LEVEL_STEEPNESS = 1.08;
export const LEVEL_BASE = 18;
export const LEVEL_GROWTH = 1.3;
/** Of each bit of skill XP, the share that goes to the level: fighting (melee, ranged) counts for more than work. */
export const LEVEL_SHARE_FIGHT = 0.35;
export const LEVEL_SHARE_WORK = 0.11;
// (both a quarter of what they were: the owner found levelling far too fast; a town's best was level 21 to 29 by
// day 15, and should be about 8 to 12)
/** Each level past the first: health and strength (damage, spell power) a little up. */
export const HP_PER_LEVEL = 0.015;
export const POWER_PER_LEVEL = 0.02;

type Leveled = { cls?: ClassId | null; fcls?: string | null; road?: string | null; level?: number; ascended?: boolean };

export const levelOf = (p: Leveled) => Math.max(1, Math.min(MAX_LEVEL, p.level ?? 1));

/** Who fights in a beast's shape: a Shapeshifter always, and a druid from the Shapeshifter stage (the third). Up close,
 *  tougher and harder hitting (`BEAST_*`), drawn as the beast on the map and the fight screen (`beastForm`). */
export const shapeshifts = (p: Leveled & { cls?: string | null }) => p.cls === 'shapeshifter' || (p.cls === 'druid' && levelOf(p) >= STAGE_LEVELS[2]);
/** The beast a shapeshifter becomes: a creature sheet, its block, and its size against a person. A Shapeshifter's
 *  grows with each stage (wolf, lion, bear, drake, wyvern); a druid's is the bear. */
export interface BeastForm {
  sheet: string;
  block: number;
  scale: number;
  name: string;
}
export const BEAST_FORMS: readonly BeastForm[] = [
  { sheet: 'wolf', block: 1, scale: 1.2, name: 'wolf' },
  { sheet: 'lions', block: 0, scale: 1.3, name: 'lion' },
  { sheet: 'bear', block: 5, scale: 1.3, name: 'bear' },
  { sheet: 'drakes', block: 1, scale: 1.5, name: 'drake' },
  { sheet: 'wyvern', block: 0, scale: 0.55, name: 'wyvern' },
];
export function beastForm(p: Leveled & { cls?: string | null }): BeastForm | null {
  if (!shapeshifts(p)) return null;
  if (p.cls === 'druid') return BEAST_FORMS[2];
  const lv = levelOf(p);
  let stage = 0;
  for (let i = 0; i < STAGE_LEVELS.length; i++) if (lv >= STAGE_LEVELS[i]) stage = i;
  return BEAST_FORMS[stage];
}
export const BEAST_HP = 1.3;
export const BEAST_DAMAGE = 1.25;
export const BEAST_ARMOR = 0.1;

/** Which stage of their class someone is at (0 to 4), from their level. */
export function stageOf(p: Leveled): number {
  // (on a path, the stage is the node they stand on: an evolution is a choice, not a level: sim/classes.ts)
  const node = p.road ? PATH_BY_ID[p.road] : undefined;
  if (node) return node.stage;
  const lv = levelOf(p);
  let st = 0;
  for (let i = 0; i < STAGE_LEVELS.length; i++) if (lv >= STAGE_LEVELS[i]) st = i;
  // (the last stage takes more than levels: an ascension, rare and late, or won through a quest)
  return p.ascended ? st : Math.min(st, STAGE_LEVELS.length - 2);
}

/** A class's stat at someone's stage: its edge over plain (a share above 1, or an amount above 0) grows by STAGE_STEP
 *  each stage. */
export function classStat(p: Leveled, k: keyof ClassStats): number {
  const plain = k === 'dodge' || k === 'armor' || k === 'accuracy' || k === 'crit' ? 0 : 1;
  if (!p.cls) return plain;
  // (a founder's own calling: its signature stats, else its base class's, and a step above either)
  const f = p.fcls ? FOUNDER_CLASS[p.fcls] : undefined;
  const node = p.road ? PATH_BY_ID[p.road] : undefined;
  const v = f?.stats[k] ?? node?.stats?.[k] ?? CLASS_DEFS[p.cls].stats[k];
  if (v === undefined) return plain;
  const grow = (1 + STAGE_STEP * stageOf(p)) * (f ? FOUNDER_EDGE : 1);
  // (speed is better below 1: its edge is how much below)
  return plain + (v - plain) * grow;
}

/** Health: the class's, and a little more each level. */
export const hpMult = (p: Leveled) => classStat(p, 'hp') * (1 + HP_PER_LEVEL * (levelOf(p) - 1));
/** Strength in a fight (damage, spell power): a little more each level. */
export const levelPower = (p: Leveled) => 1 + POWER_PER_LEVEL * (levelOf(p) - 1);
