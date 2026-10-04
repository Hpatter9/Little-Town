// Skills (DESIGN §7) and how skill level turns into work speed (DESIGN §2).

export const SKILLS = ['construction', 'crafting', 'research', 'farming', 'cooking', 'gathering', 'medicine', 'melee', 'ranged', 'social', 'animals'] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_NAMES: Record<Skill, string> = {
  construction: 'Construction',
  crafting: 'Crafting',
  research: 'Research',
  farming: 'Farming',
  cooking: 'Cooking',
  gathering: 'Gathering',
  medicine: 'Medicine',
  melee: 'Melee',
  ranged: 'Ranged',
  social: 'Social',
  animals: 'Animal Handling',
};

/** Skills run to 100 (the owner's call). The first SKILL_KNEE levels come as they always did; past it each level costs
 *  SKILL_STEEPNESS more than the last, so the top is the work of a lifetime, and the finest work (data/quality.ts)
 *  rarer still. */
export const MAX_SKILL = 100;
export const SKILL_KNEE = 20;
export const SKILL_STEEPNESS = 1.06;

export interface SkillLevel {
  level: number;
  xp: number;
}

/** Work speed from skill: level 1 = 1x, level 15 = 4x (DESIGN §2), rising linearly; past that a little more each
 *  level (about 6.5x at the top). */
export function skillSpeed(level: number): number {
  return 1 + (Math.min(level - 1, 14) * 3) / 14 + Math.max(0, level - 15) * 0.03;
}

/** XP needed to go from `level` to the next. */
export function xpToNext(level: number): number {
  return Math.round(40 * level * SKILL_STEEPNESS ** Math.max(0, level - SKILL_KNEE));
}

/** Add XP, levelling up as needed. Returns true if the level changed. */
export function gainXp(s: SkillLevel, xp: number): boolean {
  const before = s.level;
  s.xp += xp;
  while (s.level < MAX_SKILL && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
  }
  if (s.level === MAX_SKILL) s.xp = 0;
  return s.level !== before;
}
