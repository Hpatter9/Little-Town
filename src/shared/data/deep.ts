// The Deep (the owner's pick of the content updates: a world under the town). Once the town has learned Delving it
// sinks a shaft, and its miners carve tunnels out into the levels below, one after another: the Burrows, the Old
// Tunnels, the Glowing Lake, the Crystal Halls, the Abyss. Each level is a small map of solid rock (made from the
// seed: sim/deep.ts) with ore in it, richer the deeper, and pockets of something else to break into: an underground
// lake, a grotto of glowing fungus, a ruin of whoever dug here before, a crystal geode, old bones. The digging is
// noisy: what lives down there stirs, and now and then something climbs up the shaft into the town. And the rock can
// come down on the diggers. The player watches it from the shaft's tap card ("Go down into the Deep"), a view of each
// level from above (renderer/deep/deepView.ts).

import type { BuildingDef } from './buildings';
import type { Material } from './materials';
import { habitatRaid, type Habitat } from './menagerie';
import type { RaidKind } from './raids';
import type { Topic } from './research';

/** A level's size in cells. */
export const DEEP_W = 24;
export const DEEP_H = 16;

/** What a cell of a level is: rock (`#`), dug tunnel (`.`), water (`~`), the way up (`^`), the way down (`>`), and the
 *  pockets in the rock (fungus `F`, which becomes a fungus farm `f` once dug into; a ruin `R`; crystal `C`; bones
 *  `B`). */
export type DeepCell = '#' | '.' | '~' | '^' | '>' | 'F' | 'f' | 'R' | 'C' | 'B';

export interface DeepLevelDef {
  depth: number;
  name: string;
  /** What's said when the diggers break through into it. */
  found: string;
  /** Each rock cell holds stone, and maybe one ore: the odds of each and how much. */
  ores: Partial<Record<Material, [number, number]>>;
  stone: number;
  /** The pockets of each kind in the level (how many, each a little blob of cells). */
  pockets: { lake: number; fungus: number; ruin: number; crystal: number; bones: number };
  /** How long a cell takes to dig, against the first level's. */
  hard: number;
  /** How much each cell dug stirs up what lives down there (see `RISE_AT`). */
  stir: number;
  /** The chance a cell dug brings the roof down on the digger. */
  caveIn: number;
  /** What climbs up out of it (data/raids.ts via `DEEP_RAIDS`). */
  raid: string;
  /** Its colours: the rock (base, shadow, light), the tunnel floor (base, speck), and the glow over its pockets. */
  look: { rock: [string, string, string]; floor: [string, string]; glow: number; dark: number };
}

export const DEEP_LEVELS: readonly DeepLevelDef[] = [
  {
    depth: 1,
    name: 'The Burrows',
    found: 'The shaft breaks into the Burrows: damp earth and soft rock, roots hanging from the roof, and something small scuttling off into the dark.',
    ores: { coal: [0.22, 2], copper_ore: [0.18, 2], tin_ore: [0.14, 2], clay: [0.12, 2] },
    stone: 2,
    pockets: { lake: 1, fungus: 1, ruin: 0, crystal: 0, bones: 2 },
    hard: 1,
    stir: 1,
    caveIn: 0.004,
    raid: 'deep_burrows',
    look: { rock: ['#4a3c32', '#241a14', '#6e5a48'], floor: ['#7a6448', '#8a7254'], glow: 0x9ad06a, dark: 0.2 },
  },
  {
    depth: 2,
    name: 'The Old Tunnels',
    found: 'The diggers break into tunnels that were already here: squared off, braced with rotten timber, and scratched with marks nobody in town can read. Someone dug here long ago. Something made them stop.',
    ores: { iron_ore: [0.26, 2], coal: [0.18, 2], silver_ore: [0.1, 2], sulphur: [0.08, 2] },
    stone: 2,
    pockets: { lake: 1, fungus: 1, ruin: 3, crystal: 0, bones: 2 },
    hard: 1.2,
    stir: 1.5,
    caveIn: 0.006,
    raid: 'deep_tunnels',
    look: { rock: ['#3e3a44', '#1e1c24', '#625e6a'], floor: ['#6a6670', '#78747e'], glow: 0xc0a060, dark: 0.28 },
  },
  {
    depth: 3,
    name: 'The Glowing Lake',
    found: 'Below the old tunnels the rock opens on a still black lake, and over it the roof is grown thick with fungus that glows blue-green. It is beautiful. It is also very, very quiet.',
    ores: { silver_ore: [0.14, 2], gold: [0.08, 1], iron_ore: [0.18, 2] },
    stone: 2,
    pockets: { lake: 3, fungus: 3, ruin: 1, crystal: 0, bones: 1 },
    hard: 1.4,
    stir: 2,
    caveIn: 0.007,
    raid: 'deep_lake',
    look: { rock: ['#2c3a44', '#141c24', '#4a6270'], floor: ['#4e6470', '#5a727e'], glow: 0x5ef0c8, dark: 0.34 },
  },
  {
    depth: 4,
    name: 'The Crystal Halls',
    found: 'The picks ring on something that isn\'t rock: a hall of crystal, each one taller than a person, humming faintly when the torches come near.',
    ores: { gems: [0.18, 1], gold: [0.14, 1], silver_ore: [0.14, 2] },
    stone: 2,
    pockets: { lake: 1, fungus: 1, ruin: 1, crystal: 4, bones: 1 },
    hard: 1.6,
    stir: 2.5,
    caveIn: 0.009,
    raid: 'deep_crystal',
    look: { rock: ['#342c4c', '#18142a', '#564c78'], floor: ['#5a5276', '#665e84'], glow: 0x9ab8ff, dark: 0.38 },
  },
  {
    depth: 5,
    name: 'The Abyss',
    found: 'The floor gives way to the Abyss: a warm wind from below, a red light far down, and on the walls carvings of things with too many arms bowing to something with more. The diggers would like to stop now, please.',
    ores: { gems: [0.24, 2], gold: [0.2, 2], rare_minerals: [0.08, 1] },
    stone: 1,
    pockets: { lake: 0, fungus: 1, ruin: 2, crystal: 1, bones: 3 },
    hard: 1.8,
    stir: 3.5,
    caveIn: 0.011,
    raid: 'deep_abyss',
    look: { rock: ['#3e2020', '#1e0c0c', '#643830'], floor: ['#6a4038', '#784a40'], glow: 0xff6a3a, dark: 0.4 },
  },
];

export const DEEPEST = DEEP_LEVELS.length;

/** The Delving topic (Medieval, after Mining), and the shaft it opens. */
export const DELVING: Topic = {
  id: 'delving',
  name: 'Delving',
  branch: 'construction',
  era: 'medieval',
  seconds: 360,
  prereqs: ['mining'],
  unlocks: 'The Shaft: tunnels into the Deep below the town, level after level, richer and stranger the further down',
  effects: [],
};

export const SHAFT = 'deep_shaft';
export const SHAFT_BUILDING: BuildingDef = {
  id: SHAFT,
  name: 'Shaft to the Deep',
  layer: 'mid',
  width: 2,
  cost: { wood: 24, stone: 16 },
  buildSeconds: 140,
  purpose: 'A shaft and winch down into the Deep: miners tunnel into the levels below for ore, and find what else is down there.',
  research: 'delving',
};

/** How many miners work the Deep at once, and how long a cell takes on the first level (s, before the level's
 *  `hard`). */
export const SHAFT_WORKERS = 3;
export const DIG_SECONDS = 50;
/** Cells dug on a level before the way down is found. */
export const OPEN_AFTER = 26;
/** The stir (what lives down there, roused by the digging) that brings something up the shaft, and how much it
 *  settles each hour. Never two risings within `RISE_GAP_HOURS`. */
export const RISE_AT = 40;
export const STIR_SETTLES = 0.6;
export const RISE_GAP_HOURS = 30;
/** A rising's raid budget, as a share of a raid's: more the deeper it came from. */
export const RISE_SHARE = 0.45;
export const RISE_SHARE_PER_DEPTH = 0.1;
/** A cave-in: the share that kills (else a broken bone), and how hard it hits. */
export const CAVE_IN_KILLS = 0.3;
export const CAVE_IN_HURT = 0.45;

/** What the pockets give. A ruin: coins (`RUIN_COINS` a level down) and study (seconds on the topic being learned); a
 *  crystal geode gems; bones bone; a fungus grotto becomes a farm giving `FUNGUS_FOOD` vegetables (cave mushrooms)
 *  each dawn; an underground lake reached gives `LAKE_FISH` fish each dawn. */
export const RUIN_COINS: [number, number] = [15, 45];
export const RUIN_STUDY = 90;
export const CRYSTAL_GEMS = 2;
export const BONES = 3;
export const FUNGUS_FOOD = 3;
export const LAKE_FISH = 2;
/** The hour the farms and lakes give their food. */
export const DEEP_DAWN = 6;

/** What climbs up out of each level: the menagerie's creatures of the right habitats and tiers. */
const RISE: [string, string, Habitat[], [number, number]][] = [
  ['deep_burrows', 'Things out of the Burrows', ['cave'], [1, 3]],
  ['deep_tunnels', 'Things out of the Old Tunnels', ['cave', 'crypt'], [2, 4]],
  ['deep_lake', 'Things out of the Glowing Lake', ['cave', 'swamp'], [3, 6]],
  ['deep_crystal', 'Things out of the Crystal Halls', ['cave', 'arcane'], [4, 7]],
  ['deep_abyss', 'Things out of the Abyss', ['fire', 'crypt', 'cave'], [6, 9]],
];
export const DEEP_RAIDS: readonly RaidKind[] = RISE.map(([id, name, habitats, tiers]) => habitatRaid(id, name, habitats, tiers, { weight: 0, fromDay: 0 }));
