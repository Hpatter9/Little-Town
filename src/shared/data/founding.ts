// Founding a town: the founder the player makes (name, looks, background, traits) and the scenario the town
// starts from. Chosen in the New town panel; anything left out is rolled from the seed as before.

import { BIOMES, DIFFICULTIES, type Biome, type Difficulty } from './biomes';
import { FOUNDER_BY_ID } from './founders';
import { HAIR_CHOICES, HAIR_STYLES, OUTFIT_CHOICES, SKINS, TRAITS, type Look } from './people';
import type { Material } from './materials';
import { ORIGINS, type OriginId } from './origins';
import { SKILLS, type Skill } from './skills';

/* ------------------------------------------------------------ backgrounds */

export interface Background {
  id: string;
  name: string;
  description: string;
  /** The founder's skill levels; unlisted skills start at 2. */
  skills: Partial<Record<Skill, number>>;
  passions: Skill[];
}

/** (Each is about as strong as the old rolled founder, just pointed a different way. The founder does the
 *  research at first, so nobody starts below 2 in it.) */
export const BACKGROUNDS: readonly Background[] = [
  { id: 'forager', name: 'Forager', description: 'A bit of everything: gathers, builds and thinks.', skills: { gathering: 4, construction: 3, research: 3 }, passions: ['gathering', 'construction'] },
  { id: 'hunter', name: 'Hunter', description: 'Keeps the town fed and safe with spear and bow.', skills: { melee: 4, ranged: 5, animals: 3 }, passions: ['ranged', 'melee'] },
  { id: 'farmer', name: 'Farmer', description: 'Green fields early, and full stores.', skills: { farming: 5, gathering: 4, cooking: 3 }, passions: ['farming', 'gathering'] },
  { id: 'builder', name: 'Builder', description: 'Raises the camp fast and makes the tools.', skills: { construction: 5, crafting: 4 }, passions: ['construction', 'crafting'] },
  { id: 'scholar', name: 'Scholar', description: 'Researches quickly; not much of a fighter.', skills: { research: 5, medicine: 3, melee: 1 }, passions: ['research', 'medicine'] },
  { id: 'healer', name: 'Healer', description: 'Keeps the wounded alive and the town together.', skills: { medicine: 5, social: 4, research: 3 }, passions: ['medicine', 'social'] },
];
export const BACKGROUND_BY_ID: Readonly<Record<string, Background>> = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]));

export function founderSkills(b: Background): Record<Skill, number> {
  return Object.fromEntries(SKILLS.map((k) => [k, b.skills[k] ?? 2])) as Record<Skill, number>;
}

/** Most traits a founder can be given. */
export const MAX_FOUNDER_TRAITS = 2;
export const MAX_NAME_LENGTH = 16;

export interface FounderSpec {
  /** A ready-made founder (data/founders.ts): their background, traits, look and name (unless `name` is given) are
   *  used, and the rest of the spec is ignored. */
  pick?: string;
  /** Blank: a name is rolled. */
  name?: string;
  /** Left out: a look is rolled. */
  look?: Look;
  background: string;
  traits: string[];
}

/* ------------------------------------------------------------ scenarios */

export interface Scenario {
  id: string;
  name: string;
  description: string;
  /** Recruit types that arrive with the founder. */
  companions: string[];
  /** Food and materials at the start: the campfire holds what fits, a stockpile beside it the rest. */
  stores: Partial<Record<Material, number>>;
  /** Research already known. */
  research: string[];
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'lone', name: 'Lone Founder', description: 'You, a campfire and a few berries. The classic start.', companions: [], stores: { berries: 8 }, research: [] },
  { id: 'band', name: 'Band of Three', description: 'Arrive with a gatherer and a hunter. More hands, more mouths.', companions: ['gatherer', 'hunter'], stores: { berries: 20 }, research: [] },
  {
    id: 'tribe',
    name: 'Lost Tribe',
    description: 'Six of you, young and old, and not much food. Put everyone to work fast.',
    companions: ['gatherer', 'hunter', 'crafter', 'elder', 'child'],
    stores: { berries: 36 },
    research: [],
  },
  {
    id: 'supplied',
    name: 'Well Supplied',
    description: 'Alone, but with a stockpile of wood, stone and food, and shelter-making already known.',
    companions: [],
    stores: { berries: 40, wood: 40, stone: 20, fiber: 15 },
    research: ['foraging', 'basic_shelter'],
  },
];
export const SCENARIO_BY_ID: Readonly<Record<string, Scenario>> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

/* ------------------------------------------------------------ checking what the panel sent */

/** The New town panel's choices, checked (on the desktop they arrive over IPC). Null if they don't make sense. */
export function cleanNewGameOptions(raw: unknown): { biome: Biome; difficulty: Difficulty; ironman: boolean; scenario: string; origin: OriginId; founder?: FounderSpec; realms?: number } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const biome = pick(BIOMES, o.biome);
  const difficulty = pick(DIFFICULTIES, o.difficulty);
  const scenario = o.scenario === undefined ? 'lone' : typeof o.scenario === 'string' && SCENARIO_BY_ID[o.scenario] ? o.scenario : null;
  const founder = o.founder === undefined ? undefined : cleanFounder(o.founder);
  const origin = o.origin === undefined ? 'settlers' : pick(ORIGINS, o.origin);
  if (!biome || !difficulty || !scenario || !origin || founder === null) return null;
  // (the conquest's realms, 2 to 12: data/conquest.ts)
  const realms = typeof o.realms === 'number' && Number.isFinite(o.realms) ? Math.max(2, Math.min(12, Math.round(o.realms))) : undefined;
  return { biome, difficulty, ironman: o.ironman === true, scenario, origin, ...(founder ? { founder } : {}), ...(realms ? { realms } : {}) };
}

const pick = <T>(list: readonly T[], v: unknown): T | undefined => list.find((x) => x === v);

/** A look made of the allowed parts, or null. */
export function cleanLook(raw: unknown): Look | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const gender = pick(['m', 'f'] as const, o.gender);
  const skin = pick(SKINS, o.skin);
  const hair = pick(HAIR_STYLES, o.hair);
  const hairColor = pick(HAIR_CHOICES, o.hairColor);
  const outfit = pick(OUTFIT_CHOICES, o.outfit);
  if (!gender || !skin || !hair || !hairColor || !outfit) return null;
  return { gender, skin, hair, hairColor, outfit, beard: gender === 'm' && o.beard === true };
}

/** A founder the rules allow (known background, up to two compatible traits, a short printable name), or null. */
export function cleanFounder(raw: unknown): FounderSpec | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const name0 = typeof o.name === 'string' ? o.name.replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, MAX_NAME_LENGTH) : '';
  // (a ready-made founder brings everything but, perhaps, a new name)
  if (o.pick !== undefined) {
    const def = typeof o.pick === 'string' ? FOUNDER_BY_ID[o.pick] : undefined;
    return def ? { pick: def.id, background: def.background.id, traits: [], ...(name0 ? { name: name0 } : {}) } : null;
  }
  if (typeof o.background !== 'string' || !BACKGROUND_BY_ID[o.background]) return null;
  const traits = Array.isArray(o.traits) ? [...new Set(o.traits.filter((t): t is string => typeof t === 'string'))] : [];
  if (traits.length > MAX_FOUNDER_TRAITS) return null;
  for (const t of traits) {
    const def = TRAITS.find((d) => d.id === t);
    if (!def || traits.some((u) => def.excludes?.includes(u))) return null;
  }
  const name = name0;
  const look = o.look === undefined ? null : cleanLook(o.look);
  if (o.look !== undefined && !look) return null;
  return { background: o.background, traits, ...(name ? { name } : {}), ...(look ? { look } : {}) };
}
