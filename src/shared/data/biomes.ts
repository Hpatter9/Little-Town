// Starting biomes (DESIGN §4): picked when a new town is founded. Each has its own mix of land, its own
// growing and foraging, and its own threats. Forest is the classic start (and what old saves were).

import type { DoomKind } from './doom';

export const BIOMES = ['forest', 'desert', 'tundra', 'coast'] as const;
export type Biome = (typeof BIOMES)[number];

export interface BiomeDef {
  name: string;
  description: string;
  /** Odds of each wild terrain along the town's edges (midground), and of each background terrain. */
  mid: { forest: number; rock: number; marsh: number; hill: number };
  back: { meadow: number; forest: number; hills: number; marsh: number; fertile: number };
  /** Field growth and foraging speed. */
  crops: number;
  forage: number;
  /** Raid kinds and disasters made more (or less) likely. */
  raids?: Partial<Record<string, number>>;
  dooms?: Partial<Record<DoomKind, number>>;
  /** Caravans come this much more often. */
  caravans?: number;
}

export const BIOME_DEFS: Record<Biome, BiomeDef> = {
  forest: {
    name: 'Forest',
    description: 'Woods, rivers and meadows. Plenty of timber; wolves in the trees.',
    mid: { forest: 5, rock: 2, marsh: 1.2, hill: 1.5 },
    back: { meadow: 3, forest: 4, hills: 2.5, marsh: 1, fertile: 1.5 },
    crops: 1,
    forage: 1,
  },
  desert: {
    name: 'Desert',
    description: 'Rock and sand, little wood, poor soil. Droughts are common, and rivals prowl.',
    mid: { forest: 1, rock: 5, marsh: 0.3, hill: 3 },
    back: { meadow: 3, forest: 0.5, hills: 4, marsh: 0.3, fertile: 0.8 },
    crops: 0.7,
    forage: 0.8,
    raids: { wolves: 0.4, rivals: 1.6, bandits: 1.3 },
    dooms: { drought: 3, plague: 0.7, deep_freeze: 0.3 },
  },
  tundra: {
    name: 'Tundra',
    description: 'Cold and hard. Short growing, pine and stone, hungry wolves, and ice mages in the north.',
    mid: { forest: 3, rock: 3, marsh: 0.6, hill: 2 },
    back: { meadow: 3, forest: 2.5, hills: 3, marsh: 0.8, fertile: 0.6 },
    crops: 0.6,
    forage: 0.8,
    raids: { wolves: 2, boars: 0.6 },
    dooms: { drought: 0.3, ash_winter: 2, deep_freeze: 2.5 },
  },
  coast: {
    name: 'Coast',
    description: 'Shore and marsh with rich foraging and busy trade, but raiders come by sea.',
    mid: { forest: 3, rock: 1.5, marsh: 2.5, hill: 1 },
    back: { meadow: 3, forest: 2, hills: 1.5, marsh: 2.5, fertile: 2 },
    crops: 1,
    forage: 1.3,
    raids: { rivals: 1.3, bandits: 1.3, pirates: 1.5, slimes: 2 },
    dooms: { plague: 1.5 },
    caravans: 1.5,
  },
};

export const biomeOf = (s: { biome?: Biome }): BiomeDef => BIOME_DEFS[s.biome ?? 'forest'];

/** Difficulty (DESIGN §3 threat scaling): raid strength, and how often raids and disasters come. */
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_DEFS: Record<Difficulty, { name: string; description: string; raidStrength: number; raidGap: number; doomGap: number }> = {
  easy: { name: 'Easy', description: 'Smaller raids, further apart; fewer disasters.', raidStrength: 0.6, raidGap: 1.5, doomGap: 1.5 },
  normal: { name: 'Normal', description: 'As designed.', raidStrength: 1, raidGap: 1, doomGap: 1 },
  hard: { name: 'Hard', description: 'Bigger raids, more often; more disasters.', raidStrength: 1.4, raidGap: 0.75, doomGap: 0.75 },
};
export const difficultyOf = (s: { difficulty?: Difficulty }) => DIFFICULTY_DEFS[s.difficulty ?? 'normal'];