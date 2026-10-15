// The Underdark (the owner's ask: a living world beneath the map). Under the town's land lies a second map: a cave
// layer of solid rock threaded with what was always down there: winding tunnels, fungus forests, an underground
// river and its lake, crystal caverns, a magma vent, the ruins of whoever came before, and the towns of other peoples
// (deep gnomes, a court of the dark, the mushroom folk, dwarves of another line). The town reaches it from below its
// own ground: the Deep's shaft, any mine, or (the dwarves) the hold's hallways. Its miners cut toward the caves from
// the open side, cell by cell (sim/underdark.ts), and once through, it explores, works what it finds, meets the cave
// towns, trades and feuds with them, and is raided up its own shaft at night. The numbers are here; the rules there.

import type { EnemyDef } from './enemies';
import type { Destination } from './expeditions';
import type { Material, Stock } from './materials';
import { habitatRaid, MENAGERIE, raidCost } from './menagerie';
import type { RaidKind } from './raids';

/** The cave layer's size in cells. Each cell lies under `land.w / UD_W` land cells (a land of 192: four). */
export const UD_W = 48;
export const UD_H = 48;

/** What a cell is: rock (`#`, dug by the town's miners), a natural tunnel (`.`), the town's own dug cells (`d`), the
 *  foot of a shaft (`e`), a fungus forest (`g`), water (`~`: the river and the lake), a crystal cavern (`c`), magma
 *  (`v`), lost ruins (`r`) and a cave town's ground (`t`). */
export type UnderCell = '#' | '.' | 'd' | 'e' | 'g' | '~' | 'c' | 'v' | 'r' | 't';

/** Open ground: walked, seen, and worked. Water and magma are not. */
export const isUnderOpen = (c: string) => c === '.' || c === 'd' || c === 'e' || c === 'g' || c === 'c' || c === 'r' || c === 't';

/** The kinds of place below (each a blob of cells: `UnderSite`). */
export type UnderSiteKind = 'fungus' | 'lake' | 'crystal' | 'magma' | 'ruins' | 'town';

/** How many of each are made, and how big (cells, before the tunnels between them). */
export const SITE_COUNTS: Record<Exclude<UnderSiteKind, 'town'>, number> = { fungus: 2, lake: 1, crystal: 1, magma: 1, ruins: 1 };
export const SITE_SIZES: Record<UnderSiteKind, [number, number]> = { fungus: [22, 34], lake: [24, 36], crystal: [14, 22], magma: [8, 12], ruins: [12, 18], town: [16, 24] };
/** The sites are made at least this far (cells) from the middle (under the camp), so the town has rock to cut first. */
export const SITE_CLEAR = 9;

export const SITE_NAMES: Record<Exclude<UnderSiteKind, 'town'>, string[]> = {
  fungus: ['the Glowmoss Wood', 'the Capwood', 'the Pale Forest', 'the Sporewood', 'the Gillwood', 'the Lantern Grove'],
  lake: ['the Black Lake', 'the Stillwater', 'the Mirror Lake', 'the Sunless Mere'],
  crystal: ['the Singing Caverns', 'the Prism Halls', 'the Geode Vaults', 'the Glass Gallery'],
  magma: ['the Ember Vent', 'the Burning Throat', 'the Red Deep', 'the Cinder Well'],
  ruins: ['the Drowned Halls', 'the Hollow Kings\' Gate', 'the First Delving', 'the Broken Stair'],
};

/** What each place gives the town once it's found and the tunnels reach it, each dawn (sim/underdark.ts
 *  `underDawn`): the fungus forests mushrooms (vegetables) and glowmoss (herbs), the lake cave fish (fish), the
 *  crystal caverns crystals (gems), now and then. The ruins give once, when first found: old coins and study. */
export const SITE_YIELD: Partial<Record<UnderSiteKind, Stock>> = { fungus: { vegetables: 3, herbs: 1 }, lake: { fish: 3 }, crystal: { gems: 1 } };
export const RUIN_COINS = 60;
export const RUIN_STUDY = 240;

/* ------------------------------------------------------------ the digging */

/** The buildings a way down opens from: the Deep's shaft, the mines, and a dwarf hold's hallways. */
export const UNDER_ENTRIES = ['deep_shaft', 'mine', 'coal_mine', 'deep_mine', 'hold_hallway'] as const;
/** The share of a cell of the Underdark cut with each load dug at an entry (four loads a cell). */
export const DIG_PER_LOAD = 0.25;
/** The most cells the town cuts below once it's through (galleries for the deep ore). */
export const GALLERY_MOST = 70;
/** What a cell of rock cut below gives: stone, and one in so many cells a deep ore (by these odds). */
export const DEEP_ORE_ODDS = 0.45;
export const DEEP_ORES: Partial<Record<Material, number>> = { iron_ore: 4, silver_ore: 2, gold: 1.2, coal: 2, rare_minerals: 0.3 };
/** The chance a cell cut below brings the roof down on the digger, and the share of those that kill. */
export const UD_CAVE_IN = 0.035;
export const UD_CAVE_IN_KILLS = 0.55;
/** Cells of the caves the scouts see each hour once the town is through (spreading through the open ground). */
export const EXPLORE_PER_HOUR = 10;

/* ------------------------------------------------------------ the dark at night */

/** The night's hours, when things come up. */
export const NIGHT_FROM = 21;
export const NIGHT_TO = 4;
/** Nothing comes up before this (paced) day, nor into a town of fewer people (a dwarf hold opens on the caves from
 *  its first hallway, and a hamlet of three would be eaten). */
export const DANGER_DAY = 3;
export const DANGER_PEOPLE = 6;
/** Each night hour, once through: the chance something comes up the shaft (`under_dark`), a share of a raid's
 *  budget; and never two within `RISE_GAP_HOURS`. */
export const DARK_RISE = 0.012;
export const DARK_SHARE = 0.5;
export const RISE_GAP_HOURS = 36;
/** Each night hour: the chance one working an entry is taken by something in the dark (killed). */
export const TAKEN = 0.004;
/** The river reached: each night hour the chance it floods the town's tunnels (drowning or hurting those at the
 *  entries, and stopping the digging a while). */
export const FLOOD = 0.003;
export const FLOOD_KILLS = 0.5;
export const FLOOD_HOURS = 30;

/* ------------------------------------------------------------ the cave towns */

export type CaveTemper = 'trader' | 'proud' | 'sly' | 'calm';

export interface CavePeople {
  id: string;
  name: string;
  /** What they are, a few words. */
  kind: string;
  temper: CaveTemper;
  /** What they sell the town on a trade (comes up the shaft), and what it costs. */
  goods: Stock;
  /** The goods' names in their own words (glowmoss, deep ore, cave fish, crystals). */
  goodsWords: string;
  price: number;
  /** Their warriors (a raid kind, below) and their lord. */
  raid: string;
  lord: string;
  /** How they feel about the town at first, and to a town of dwarves (who they know of old). */
  start: number;
  dwarves: number;
  /** Their envoy's greeting. */
  hello: string;
}

export const CAVE_PEOPLES: readonly CavePeople[] = [
  {
    id: 'glimmerdeep',
    name: 'the Glimmerdeep',
    kind: 'deep gnomes',
    temper: 'trader',
    goods: { gems: 3, iron_ore: 4 },
    goodsWords: 'crystals and deep ore',
    price: 55,
    raid: 'ud_gnomes',
    lord: 'ud_gnome_artificer',
    start: 10,
    dwarves: 25,
    hello: 'Small grey folk with lamps on their caps come up out of the dark, bowing a great deal and counting everything they see.',
  },
  {
    id: 'umbral',
    name: 'the Umbral Court',
    kind: 'a court of the dark',
    temper: 'sly',
    goods: { silver_ore: 3, cloth: 3 },
    goodsWords: 'silver and spider-silk',
    price: 60,
    raid: 'ud_umbral',
    lord: 'ud_umbral_matron',
    start: -10,
    dwarves: 0,
    hello: 'Pale-eyed courtiers in black silk step out of the shadows by the shaft, smiling as if they already own the place.',
  },
  {
    id: 'sporemoot',
    name: 'the Sporemoot',
    kind: 'mushroom folk',
    temper: 'calm',
    goods: { vegetables: 8, herbs: 4 },
    goodsWords: 'cave mushrooms and glowmoss',
    price: 35,
    raid: 'ud_spores',
    lord: 'ud_spore_elder',
    start: 15,
    dwarves: 20,
    hello: 'A drift of spores, and then they are there: tall soft folk with caps for heads, who speak by puffs of scent nobody understands at first.',
  },
  {
    id: 'greyhold',
    name: 'Clan Greyhold',
    kind: 'dwarves of another line',
    temper: 'proud',
    goods: { iron_ore: 5, gold: 1, fish: 4 },
    goodsWords: 'deep ore, gold and cave fish',
    price: 60,
    raid: 'ud_greyhold',
    lord: 'ud_grey_thane',
    start: 0,
    dwarves: 30,
    hello: 'Grey-bearded dwarves in iron masks come up the shaft and look the town over as if pricing it.',
  },
];
export const CAVE_PEOPLE_BY_ID: Readonly<Record<string, CavePeople>> = Object.fromEntries(CAVE_PEOPLES.map((p) => [p.id, p]));
/** How many cave towns a layer holds. */
export const CAVE_TOWNS: [number, number] = [2, 3];

/** Where their goodwill settles (by temper), and how fast it drifts there each day. */
export const CAVE_REST: Record<CaveTemper, number> = { trader: 20, proud: 0, sly: -15, calm: 20 };
export const CAVE_DRIFT = 0.1;
/** Their warriors grow each day, up to the most. */
export const CAVE_TROOPS: [number, number] = [8, 16];
export const CAVE_TROOPS_PER_DAY = 0.5;
export const CAVE_TROOPS_MOST = 40;
/** Days between envoys from a town that knows the town, and between its trades. */
export const CAVE_ENVOY_DAYS = 5;
export const CAVE_TRADE_DAYS = 3;
/** Goodwill: below `CAVE_WAR` they make war (raids up the shaft at night); at `CAVE_FRIEND` and over, they trade. */
export const CAVE_WAR = -40;
export const CAVE_FRIEND = 15;
/** At war, the chance each night hour they raid up the shaft, and the raid's budget: a share of a raid's, more with
 *  their troops. */
export const CAVE_RAID = 0.02;
export const CAVE_RAID_SHARE = 0.4;
export const CAVE_RAID_PER_TROOP = 0.02;
/** A trade made warms them; a gift costs this and warms them this much; refusing them cools them. */
export const TRADE_WARMTH = 3;
export const GIFT_COINS = 40;
export const GIFT_WARMTH = 15;
export const SNUB = 12;
/** The chance each day two cave towns fall out (a feud: each loses troops daily, and a weak one may fall), and the
 *  chance a feud ends. */
export const FEUD_CHANCE = 0.04;
export const FEUD_END = 0.08;
export const FEUD_LOSS = 1.5;

/* ------------------------------------------------------------ an under-village */

/** A daughter village founded below (sim/villages.ts, `below`): the town's people at least (fewer for the dwarves,
 *  whose home ground it is), from the day, and the fungus and the water found first. */
export const UNDER_VILLAGE_PEOPLE = 16;
export const UNDER_VILLAGE_PEOPLE_DWARVES = 9;
export const UNDER_VILLAGE_DAY = 6;
/** What an under-village makes (it has no land to read): mushrooms, cave fish, deep ore. */
export const UNDER_MAKES: readonly Material[] = ['vegetables', 'fish', 'iron_ore'];
export const UNDER_VILLAGE_NAMES = ['Lampdeep', 'Glowhollow', 'Undermere', 'Capstone', 'Stillhollow', 'Gloamdelve'];

/* ------------------------------------------------------------ the foes */

const like = (id: string, base: string, name: string, more: Partial<EnemyDef> = {}): EnemyDef => ({ ...MENAGERIE[base], id, name, ...more });

/** The cave peoples' warriors and lords, and the things in the dark (the menagerie's cave creatures, renamed and
 *  tinted for their folk). */
export const UNDERDARK_ENEMIES: Record<string, EnemyDef> = {
  // the deep gnomes
  ud_gnome_sapper: like('ud_gnome_sapper', 'kobold', 'Deep Gnome Sapper', { tint: 0xa8b4c8, nature: 'person' }),
  ud_gnome_slinger: like('ud_gnome_slinger', 'kobold', 'Deep Gnome Slinger', { tint: 0x98a8c0, ranged: true, nature: 'person' }),
  ud_burrow_mole: like('ud_burrow_mole', 'mole', 'Burrowing Mole'),
  ud_gnome_artificer: like('ud_gnome_artificer', 'kobold_chief', 'The Glimmerdeep Artificer', { boss: true, hp: 220, damage: [9, 15], tint: 0xc0c8e0, nature: 'person' }),
  // the Umbral Court
  ud_umbral_blade: { id: 'ud_umbral_blade', name: 'Umbral Blade', hp: 52, damage: [6, 11], accuracy: 0.74, dodge: 0.2, interval: 1.1, ranged: false, loot: { cloth: 1, silver_ore: 1 }, tint: 0x8a7ac8, sprite: { people: 'bandit', weapon: 'dagger' } },
  ud_umbral_crossbow: { id: 'ud_umbral_crossbow', name: 'Umbral Crossbow', hp: 40, damage: [5, 10], accuracy: 0.74, dodge: 0.16, interval: 1.5, ranged: true, loot: { arrows: 3 }, tint: 0x8a7ac8, sprite: { people: 'bandit', weapon: 'bow' } },
  ud_court_spider: like('ud_court_spider', 'giant_spider', 'Court Spider', { tint: 0x9a80c0 }),
  ud_umbral_matron: { id: 'ud_umbral_matron', name: 'The Umbral Matron', hp: 300, damage: [10, 17], accuracy: 0.8, dodge: 0.22, interval: 1.3, ranged: false, boss: true, loot: { silver: 4, cloth: 4 }, tint: 0x7a6ab8, sprite: { people: 'bandit', weapon: 'sword' }, kit: { roar: 'The torches gutter. The Umbral Matron steps out of the dark, and it follows her.', enrage: 'The Matron hisses a word, and the shadows bite!', area: { every: 3, targets: 2, name: 'spins in a ring of knives', fx: 'acid' }, summon: { kind: 'ud_court_spider', count: 2, text: 'Spiders drop from the roof at her call!' } } },
  // the Sporemoot
  ud_sporeling: { id: 'ud_sporeling', name: 'Sporeling', hp: 48, damage: [4, 8], accuracy: 0.7, dodge: 0.08, interval: 1.2, ranged: false, loot: { vegetables: 1, herbs: 1 }, sprite: { sheet: 'shrooms', block: 0, scale: 0.9 }, tint: 0xb8e0c0 },
  ud_spore_cloud: like('ud_spore_cloud', 'spore_cloud', 'Choking Spores'),
  ud_spore_elder: { id: 'ud_spore_elder', name: 'The Spore Elder', hp: 260, damage: [8, 14], accuracy: 0.7, dodge: 0.04, interval: 1.6, ranged: false, boss: true, loot: { herbs: 6, vegetables: 6 }, sprite: { sheet: 'shrooms', block: 0, scale: 1.4 }, tint: 0x9ad0a8, kit: { roar: 'The air turns thick and sweet. The Spore Elder has come up out of the dark.', enrage: 'The Elder bursts, and the town chokes on spores!', area: { every: 3, targets: 3, name: 'breathes out a cloud of spores', fx: 'acid' }, summon: { kind: 'ud_sporeling', count: 2, text: 'Sporelings push up out of the ground!' } } },
  // Clan Greyhold
  ud_grey_warrior: { id: 'ud_grey_warrior', name: 'Greyhold Warrior', hp: 72, damage: [6, 11], accuracy: 0.7, dodge: 0.06, interval: 1.3, ranged: false, loot: { iron: 1, stone: 1 }, tint: 0xb0b0c0, sprite: { people: 'soldier', weapon: 'mace' } },
  ud_grey_crossbow: { id: 'ud_grey_crossbow', name: 'Greyhold Crossbow', hp: 50, damage: [5, 9], accuracy: 0.72, dodge: 0.06, interval: 1.6, ranged: true, loot: { arrows: 3 }, tint: 0xb0b0c0, sprite: { people: 'soldier', weapon: 'bow' } },
  ud_grey_thane: { id: 'ud_grey_thane', name: 'The Grey Thane', hp: 340, damage: [12, 18], accuracy: 0.76, dodge: 0.08, interval: 1.5, ranged: false, boss: true, loot: { iron: 6, gold: 2 }, tint: 0xa0a0b4, sprite: { people: 'soldier', weapon: 'mace' }, kit: { roar: 'Iron masks in the shaft\'s mouth. The Grey Thane has come to take what the surface folk dug from his rock!', enrage: 'The Grey Thane roars an oath older than the town!', area: { every: 3, targets: 2, name: 'brings the hammer down', fx: 'quake' }, summon: { kind: 'stone_golem', count: 1, text: 'The rock walks at the Thane\'s word!' } } },
};

/** What comes up the shaft: each cave town's warriors (never rolled at random), and the things in the dark. */
export const UNDERDARK_RAIDS: readonly RaidKind[] = [
  { id: 'ud_gnomes', name: 'The Glimmerdeep\'s sappers', goal: 'steal', goals: { steal: 4, burn: 1 }, steals: 'valuables', enemies: { ud_gnome_sapper: raidCost('kobold'), ud_gnome_slinger: raidCost('kobold'), ud_burrow_mole: raidCost('mole') }, fromDay: 0, weight: 0, speed: 45, bribable: true, plural: true, leader: 'ud_gnome_artificer' },
  { id: 'ud_umbral', name: 'The Umbral Court\'s raiders', goal: 'kidnap', goals: { kidnap: 3, harm: 2, steal: 1 }, steals: 'valuables', enemies: { ud_umbral_blade: 14, ud_umbral_crossbow: 12, ud_court_spider: raidCost('giant_spider') }, fromDay: 0, weight: 0, speed: 60, bribable: true, plural: true, leader: 'ud_umbral_matron' },
  { id: 'ud_spores', name: 'The Sporemoot\'s creeping folk', goal: 'harm', goals: { harm: 3, steal: 1 }, steals: 'food', enemies: { ud_sporeling: 10, ud_spore_cloud: raidCost('spore_cloud') }, fromDay: 0, weight: 0, speed: 30, bribable: false, plural: true, leader: 'ud_spore_elder' },
  { id: 'ud_greyhold', name: 'Clan Greyhold\'s warband', goal: 'steal', goals: { steal: 4, harm: 2 }, steals: 'valuables', enemies: { ud_grey_warrior: 14, ud_grey_crossbow: 11, stone_golem: 26 }, fromDay: 0, weight: 0, speed: 40, bribable: true, plural: false, leader: 'ud_grey_thane' },
  habitatRaid('under_dark', 'Things from the dark', ['cave', 'crypt'], [2, 6], { weight: 0, fromDay: 0 }),
];

/* ------------------------------------------------------------ trips below */

/** A party's trip to a place below (the destination `under:<site>`): what it is and what it brings. */
export const SITE_TRIPS: Partial<Record<UnderSiteKind, Pick<Destination, 'type' | 'loot' | 'threats' | 'secondsPerUnit' | 'description'> & { foes: Record<string, number>; arrival: number }>> = {
  fungus: { type: 'gather', loot: { vegetables: 5, herbs: 4, fiber: 2 }, secondsPerUnit: 5, threats: 'Spiders, and things that eat mushroom-pickers', foes: { giant_spider: 2, dire_rat: 2 }, arrival: 0.35, description: 'A forest of giant mushrooms in the dark, lit by the glowmoss on their stems. Food, and herbs for the healers.' },
  lake: { type: 'gather', loot: { fish: 6, kelp: 1 }, secondsPerUnit: 5, threats: 'What lives in the black water', foes: { black_eel: 1, giant_toad: 2 }, arrival: 0.35, description: 'A still black lake under the rock, full of pale blind fish. Something bigger moves out in the middle.' },
  crystal: { type: 'gather', loot: { gems: 3, stone: 3, silver_ore: 2 }, secondsPerUnit: 9, threats: 'Crystal spiders and jewel beetles', foes: { crystal_spider: 2, jewel_beetle: 2 }, arrival: 0.45, description: 'Caverns of crystal, humming when the lamps come near. Gems for the taking, and the creatures that grow them.' },
  magma: { type: 'clear', loot: { sulphur: 4, gold: 2, rare_minerals: 1 }, secondsPerUnit: 10, threats: 'Fire things, and the heat', foes: { black_drake: 1, boulder_beast: 2 }, arrival: 0.7, description: 'A vent where the rock runs red. Sulphur and gold crust its edges; things that like the heat guard them.' },
  ruins: { type: 'salvage', loot: { gold: 2, iron: 3, gems: 1 }, secondsPerUnit: 9, threats: 'The dead who kept it, and a troll', foes: { skeleton_warrior: 2, troll: 1 }, arrival: 0.6, description: 'Halls of a people who dug here before anyone above was born, and stopped. Their treasure is still in them, and so are they.' },
};
/** How far below each trip goes (the walk down and through the caves), and how long they work. */
export const TRIP_OUT_SECONDS = 140;
export const TRIP_WORK_SECONDS = 60;
