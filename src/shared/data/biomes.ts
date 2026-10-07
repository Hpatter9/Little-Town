// Starting biomes (DESIGN §4): picked when a new town is founded. Each has its own mix of land, its own
// growing and foraging, and its own threats. Forest is the classic start (and what old saves were).
//
// Ten lands (the owner's ask: more, and more diverse, with the asset packs behind each): the four of old (forest,
// desert, tundra, coast) and six more: the fenlands (marsh and mist, the swamp's crawlers and the drowned), the
// jungle (deep green, apes and great cats, satyrs), the highlands (crag and scree, cave things and eagles), the
// ashlands (cinders and lava-rock, fire and the charred dead), the steppe (open grass, lions and riders) and the
// taiga (pines and snow, the beasts of the cold). Each sets what the land is made of (`mid`, `open`, `wildShare`,
// the river), its climate flags (read by the renderer: snow, dust, haze, breath, scenery), the menagerie habitats
// its lairs and biome raids draw on (`habitats`), and which fight scenes its green scenes become (`scenes`).

import type { DoomKind } from './doom';

export const BIOMES = ['forest', 'desert', 'tundra', 'coast', 'swamp', 'jungle', 'highlands', 'ashlands', 'steppe', 'taiga'] as const;
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
  /** The open ground between the wild: grass, or sand (the desert's sand, the ashlands' cinders). */
  open?: 'grass' | 'sand';
  /** How much of the home vale is wild (0.5 is the forest's). */
  wildShare?: number;
  /** The river's widest (cells): 1 a stream, 3 a broad river. */
  river?: 1 | 2 | 3;
  /** The river's banks: rich soil only, or soil with marsh in it; `marshy` lands bank in marsh mostly. */
  banks?: 'fertile' | 'mixed' | 'marshy';
  /** Climate: cold lands keep snow and show breath; dry ones blow dust and grow dry trees; hot ones shimmer; wet ones
   *  mist over. The renderer reads these, so a new land needs no new switch there. */
  cold?: boolean;
  dry?: boolean;
  hot?: boolean;
  wet?: boolean;
  /** The menagerie habitats (data/menagerie.ts `Habitat`) the land's lairs and its own raids draw on. */
  habitats: string[];
  /** The fight scenes (data/scenes.ts) the green scenes become on this land. */
  scenes: Partial<Record<string, string>>;
  /** The ground's look on the map (renderer/map/groundArt.ts `BIOME_LOOKS`), and the props set its wild cells wear
   *  (renderer/map/mapView.ts). */
  look: string;
  props: string[];
}

export const BIOME_DEFS: Record<Biome, BiomeDef> = {
  forest: {
    name: 'Forest',
    description: 'Woods, rivers and meadows. Plenty of timber; wolves in the trees.',
    mid: { forest: 5, rock: 2, marsh: 1.2, hill: 1.5 },
    back: { meadow: 3, forest: 4, hills: 2.5, marsh: 1, fertile: 1.5 },
    crops: 1,
    forage: 1,
    habitats: ['forest', 'fae'],
    scenes: {},
    look: 'green',
    props: ['wild'],
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
    open: 'sand',
    wildShare: 0.4,
    river: 1,
    banks: 'fertile',
    dry: true,
    hot: true,
    habitats: ['desert'],
    scenes: { meadow: 'dunes', pinewoods: 'dunes', riverbank: 'dunes' },
    look: 'sand',
    props: ['desert', 'wild'],
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
    cold: true,
    habitats: ['snow'],
    scenes: { meadow: 'tundra', pinewoods: 'tundra', riverbank: 'tundra' },
    look: 'green',
    props: ['winter', 'wild'],
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
    habitats: ['swamp', 'sky'],
    scenes: { meadow: 'coast' },
    look: 'green',
    props: ['coast', 'wild'],
  },
  swamp: {
    name: 'Fenlands',
    description: 'Reed beds, black pools and mist. Rich foraging, slow fields, fevers; crocodiles and the drowned.',
    mid: { forest: 2.5, rock: 0.5, marsh: 6, hill: 0.6 },
    back: { meadow: 2, forest: 2, hills: 0.8, marsh: 5, fertile: 1.5 },
    crops: 0.85,
    forage: 1.35,
    raids: { crocodiles: 2, slimes: 2, wolves: 0.5, satyrs: 1.3 },
    dooms: { plague: 2.2, drought: 0.3, rat_plague: 1.5 },
    wildShare: 0.55,
    river: 3,
    banks: 'marshy',
    wet: true,
    habitats: ['swamp', 'crypt'],
    scenes: { meadow: 'fen', pinewoods: 'fen', riverbank: 'fen' },
    look: 'fen',
    props: ['wild', 'grove'],
  },
  jungle: {
    name: 'Jungle',
    description: 'Deep green and dripping. Everything grows, and everything hunts: apes, great cats and satyr revels.',
    mid: { forest: 7, rock: 0.6, marsh: 1.5, hill: 0.8 },
    back: { meadow: 1.5, forest: 6, hills: 1, marsh: 1.5, fertile: 2.5 },
    crops: 1.15,
    forage: 1.4,
    raids: { satyrs: 1.6, slimes: 1.3, wolves: 0.4, boars: 1.3 },
    dooms: { plague: 2, drought: 0.4, deep_freeze: 0.1 },
    wildShare: 0.6,
    river: 3,
    banks: 'mixed',
    wet: true,
    hot: true,
    habitats: ['forest', 'fae', 'swamp'],
    scenes: { meadow: 'jungle', pinewoods: 'jungle', riverbank: 'jungle' },
    look: 'jungle',
    props: ['wild', 'grove'],
  },
  highlands: {
    name: 'Highlands',
    description: 'Crag, scree and thin soil under a wide sky. Stone to spare, hard farming; cave things and eagles.',
    mid: { forest: 2, rock: 5, marsh: 0.2, hill: 5 },
    back: { meadow: 2, forest: 1.5, hills: 5, marsh: 0.2, fertile: 0.7 },
    crops: 0.75,
    forage: 0.9,
    raids: { steppe_riders: 1.4, wild_dogs: 1.3, rivals: 1.2, bandits: 1.2 },
    dooms: { deep_freeze: 1.6, ash_winter: 1.3, drought: 0.6 },
    wildShare: 0.55,
    river: 2,
    banks: 'fertile',
    cold: true,
    habitats: ['cave', 'sky'],
    scenes: { meadow: 'highlands', pinewoods: 'pinewoods', riverbank: 'highlands' },
    look: 'crag',
    props: ['wild', 'cave'],
  },
  ashlands: {
    name: 'Ashlands',
    description: 'Cinders and lava-rock under a red sky. Little grows; fire and the charred dead come out of the waste.',
    mid: { forest: 1, rock: 5, marsh: 0.2, hill: 3 },
    back: { meadow: 2, forest: 0.5, hills: 4, marsh: 0.2, fertile: 0.6 },
    crops: 0.6,
    forage: 0.6,
    raids: { wolves: 0.3, rivals: 1.5, bandits: 1.2, wild_dogs: 1.2 },
    dooms: { ash_winter: 3, drought: 1.5, meteors: 2, plague: 0.6 },
    open: 'sand',
    wildShare: 0.45,
    river: 1,
    banks: 'fertile',
    dry: true,
    hot: true,
    habitats: ['fire', 'crypt'],
    scenes: { meadow: 'ashland', pinewoods: 'ashland', riverbank: 'ashland', highlands: 'crater' },
    look: 'ash',
    props: ['undead', 'desert'],
  },
  steppe: {
    name: 'Steppe',
    description: 'Open grass to the horizon. Herds and horse-riders, lions in the long grass; caravans cross it.',
    mid: { forest: 1.2, rock: 1.5, marsh: 0.4, hill: 3 },
    back: { meadow: 5, forest: 0.8, hills: 3, marsh: 0.4, fertile: 1.5 },
    crops: 0.9,
    forage: 0.9,
    raids: { lions: 1.3, steppe_riders: 1.6, wild_dogs: 1.3, bandits: 1.2, wolves: 0.6 },
    dooms: { drought: 2, plague: 0.8 },
    caravans: 1.4,
    wildShare: 0.35,
    river: 2,
    banks: 'fertile',
    dry: true,
    habitats: ['desert', 'wild'],
    scenes: { meadow: 'steppe', pinewoods: 'steppe', riverbank: 'riverbank' },
    look: 'steppe',
    props: ['wild'],
  },
  taiga: {
    name: 'Taiga',
    description: 'Pine forest and long winters. Timber without end, thin harvests; wolves, bears and the beasts of the snow.',
    mid: { forest: 6, rock: 2, marsh: 1, hill: 2 },
    back: { meadow: 2, forest: 5, hills: 2.5, marsh: 1, fertile: 0.8 },
    crops: 0.7,
    forage: 0.9,
    raids: { wolves: 1.8, boars: 1.3, wild_dogs: 0.8 },
    dooms: { deep_freeze: 1.8, ash_winter: 1.3, drought: 0.4 },
    wildShare: 0.6,
    river: 2,
    banks: 'mixed',
    cold: true,
    habitats: ['snow', 'forest'],
    scenes: { meadow: 'pinewoods', riverbank: 'pinewoods' },
    look: 'taiga',
    props: ['wild'],
  },
};

export const biomeOf = (s: { biome?: Biome }): BiomeDef => BIOME_DEFS[s.biome ?? 'forest'];
/** A land's def by its id (the renderer has only the id; an unknown one is the forest). */
export const biomeById = (id: string | undefined): BiomeDef => BIOME_DEFS[(id ?? 'forest') as Biome] ?? BIOME_DEFS.forest;
/** The open ground between the wild on a land. */
export const openGround = (id: string | undefined): 'grass' | 'sand' => biomeById(id).open ?? 'grass';

/** Difficulty (DESIGN §3 threat scaling): raid strength, and how often raids and disasters come. */
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_DEFS: Record<Difficulty, { name: string; description: string; raidStrength: number; raidGap: number; doomGap: number }> = {
  easy: { name: 'Easy', description: 'Smaller raids, further apart; fewer disasters.', raidStrength: 0.6, raidGap: 1.5, doomGap: 1.5 },
  normal: { name: 'Normal', description: 'As designed.', raidStrength: 1, raidGap: 1, doomGap: 1 },
  hard: { name: 'Hard', description: 'Bigger raids, more often; more disasters.', raidStrength: 1.4, raidGap: 0.75, doomGap: 0.75 },
};
export const difficultyOf = (s: { difficulty?: Difficulty }) => DIFFICULTY_DEFS[s.difficulty ?? 'normal'];
