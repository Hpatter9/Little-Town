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

export const MAX_SKILL = 20;

export interface SkillLevel {
  level: number;
  xp: number;
}

/** Work speed from skill: level 1 = 1x, level 15 = 4x (DESIGN §2), rising linearly. */
export function skillSpeed(level: number): number {
  return 1 + ((level - 1) * 3) / 14;
}

/** XP needed to go from `level` to the next. */
export function xpToNext(level: number): number {
  return 40 * level;
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
