// Monster nests on the town's land (the owner's pick, the Calamity's first stage): goblin warrens, spider dens and
// barrows of the restless dead come up out on the land and grow, a level every few days, up to five. Each spreads a
// blight round it (the land goes grey and dead: nothing regrows, crops wither), sends its creatures out to roam the
// land and, once it's grown, raids the town. The town clears them with a party (they're places on the Expedition
// Board, sim/places.ts) or lets them fester. The rules are in sim/nests.ts; the Calamity's dread feeds on them
// (sim/calamity.ts).

import type { EnemyDef } from './enemies';
import type { RaidKind } from './raids';
import type { Material } from './materials';
import { MENAGERIE } from './menagerie';

export type NestKind = 'warren' | 'den' | 'barrow';

export interface NestDef {
  kind: NestKind;
  name: string;
  /** Its creatures, in the news ("goblins"). */
  folk: string;
  /** What's found there (the feed's line), and what's said as it grows. */
  found: string;
  grows: string;
  /** Who waits there, by level (1 to 5): the last always has its master. */
  foes: Record<string, number>[];
  /** What roams out of it, by level (a band's group: sim/roamers.ts). */
  roam: Record<string, number>[];
  /** The raid it sends once grown (data/raids.ts via `NEST_RAIDS`). */
  raid: string;
  /** What a party brings home when it's cleared, with the odds for the trip's loot. */
  hoard: Partial<Record<Material, number>>;
  loot: Partial<Record<Material, number>>;
  coins: [number, number];
  scenery: 'woods' | 'cave' | 'quarry' | 'thicket' | 'river';
  /** The ground it prefers to come up on (else anywhere dry). */
  ground: string[];
}

export const NEST_DEFS: Record<NestKind, NestDef> = {
  warren: {
    kind: 'warren',
    name: 'Goblin Warren',
    folk: 'goblins',
    found: 'A burrow in the hillside, ringed with gnawed bones and rubbish: goblins, and more of them every night.',
    grows: 'The goblin warren digs deeper: more of them come out at night.',
    foes: [{ redcap: 2 }, { redcap: 2, pink_gremlin: 2 }, { redcap: 3, giant_rat: 2, goblin_warlock: 1 }, { redcap: 4, goblin_warlock: 2, pink_gremlin: 2 }, { goblin_king: 1, redcap: 3, goblin_warlock: 1 }],
    roam: [{ redcap: 1 }, { redcap: 2 }, { redcap: 2, giant_rat: 1 }, { redcap: 2, goblin_warlock: 1 }, { redcap: 3, goblin_warlock: 1 }],
    raid: 'nest_warren',
    hoard: { flint: 4, hide: 3, iron: 2 },
    loot: { flint: 3, hide: 3, cloth: 2 },
    coins: [20, 70],
    scenery: 'cave',
    ground: ['hill', 'rock', 'forest'],
  },
  den: {
    kind: 'den',
    name: 'Spider Den',
    folk: 'spiders',
    found: 'Webs strung between the trees like grey sails, and cocoons hanging in them. Something big spins here.',
    grows: 'The spider den spreads its webs further: the woods round it have gone silent.',
    foes: [{ giant_spider: 1 }, { giant_spider: 1, blood_tick: 2 }, { giant_spider: 2, wasp: 2 }, { giant_spider: 2, crystal_spider: 1, blood_tick: 2 }, { brood_mother: 1, giant_spider: 2 }],
    roam: [{ blood_tick: 2 }, { giant_spider: 1 }, { giant_spider: 1, blood_tick: 1 }, { giant_spider: 2 }, { giant_spider: 2, crystal_spider: 1 }],
    raid: 'nest_den',
    hoard: { cloth: 6, herbs: 3, hide: 2 },
    loot: { cloth: 4, herbs: 3 },
    coins: [10, 50],
    scenery: 'thicket',
    ground: ['forest', 'marsh'],
  },
  barrow: {
    kind: 'barrow',
    name: 'Restless Barrow',
    folk: 'the risen dead',
    found: 'An old grave-mound with its door thrown open from the inside. The grass round it has died.',
    grows: 'The barrow stirs: more of the old dead climb out of it after dark.',
    foes: [{ rotling: 3 }, { rotling: 2, skeleton_warrior: 2 }, { skeleton_warrior: 2, skeleton_archer: 2, ghoul: 1 }, { bone_knight: 1, skeleton_warrior: 2, ghoul: 2 }, { barrow_wight: 1, bone_knight: 1, skeleton_archer: 2 }],
    roam: [{ rotling: 2 }, { rotling: 2, skeleton_warrior: 1 }, { skeleton_warrior: 2, ghoul: 1 }, { skeleton_warrior: 2, bone_knight: 1 }, { ghoul: 2, bone_knight: 1 }],
    raid: 'nest_barrow',
    hoard: { bone: 8, iron: 3, cloth: 2 },
    loot: { bone: 4, iron: 2 },
    coins: [30, 90],
    scenery: 'quarry',
    ground: ['grass', 'hill', 'marsh'],
  },
};

export const NEST_KINDS = Object.keys(NEST_DEFS) as NestKind[];

/** The spider den's master (the menagerie's giant spider, grown huge). */
export const NEST_ENEMIES: Record<string, EnemyDef> = {
  brood_mother: {
    ...MENAGERIE.giant_spider,
    id: 'brood_mother',
    name: 'The Brood Mother',
    hp: 360,
    damage: [12, 19],
    accuracy: 0.74,
    dodge: 0.1,
    boss: true,
    loot: { cloth: 8, herbs: 4 },
    sprite: { ...(MENAGERIE.giant_spider.sprite as { sheet: 'dawn'; block: number; scale: number }), scale: 6 },
    look: { hue: -40, bright: 0.85 },
    nature: 'beast',
    kit: {
      roar: 'Something the size of a cart unfolds its legs in the dark of the den.',
      enrage: 'The Brood Mother shrieks, and the webs all round shake with her young!',
      area: { every: 3, targets: 3, name: 'sprays her web', fx: 'acid' },
      summon: { kind: 'blood_tick', count: 3, text: 'Her brood boils out of the cocoons!' },
    },
  },
};

/** The raids a grown nest sends (never rolled: sim/nests.ts starts them). */
export const NEST_RAIDS: RaidKind[] = [
  { id: 'nest_warren', name: 'Goblins from the warren', goal: 'steal', goals: { steal: 4, harm: 2, kidnap: 1 }, steals: 'food', enemies: { redcap: 8, pink_gremlin: 5, giant_rat: 6, goblin_warlock: 16 }, fromDay: 9999, weight: 0, speed: 60, bribable: false, plural: true },
  { id: 'nest_den', name: 'Spiders from the den', goal: 'harm', goals: { harm: 4, kidnap: 2 }, enemies: { giant_spider: 14, blood_tick: 5, wasp: 5 }, fromDay: 9999, weight: 0, speed: 55, bribable: false, plural: true },
  { id: 'nest_barrow', name: 'The dead from the barrow', goal: 'harm', goals: { harm: 4, burn: 1 }, enemies: { rotling: 4, skeleton_warrior: 9, skeleton_archer: 8, ghoul: 12 }, fromDay: 9999, weight: 0, speed: 35, bribable: false, plural: true },
];

/** Nests come up from this day (0-based), checked at `NEST_HOUR` each morning, on this chance, while there are fewer
 *  than `NESTS_MOST` (and one more for each of the Calamity's stages). */
export const NEST_FIRST_DAY = 4;
export const NEST_HOUR = 7;
export const NEST_DAILY = 0.22;
export const NESTS_MOST = 2;
/** Where on the land (cells from the camp), and no nearer another place than `NEST_APART`. */
export const NEST_NEAR = 22;
export const NEST_FAR = 64;
export const NEST_APART = 8;
/** A nest grows a level every so many days (fewer as the Calamity rises), up to `NEST_MAX_LEVEL`. */
export const NEST_GROW_DAYS = 6;
export const NEST_MAX_LEVEL = 5;
/** The blight round a nest: this many cells, and so many more a level. */
export const NEST_BLIGHT = 1.5;
export const NEST_BLIGHT_PER_LEVEL = 1.2;
export const nestBlight = (level: number) => NEST_BLIGHT + NEST_BLIGHT_PER_LEVEL * level;
/** Each hour a band may come out of a nest on this chance a level (sim/roamers.ts takes it from there). */
export const NEST_ROAM_HOURLY = 0.01;
/** From this level a nest raids the town: each morning a raid is due within `NEST_RAID_DUE` hours, on this chance a
 *  level past the one before, the nest's raid comes in its place (the next is reckoned from it, as any raid's is). */
export const NEST_RAID_LEVEL = 3;
export const NEST_RAID_DAILY = 0.3;
export const NEST_RAID_DUE = 12;
/** A nest's raid has this share of an ordinary raid's budget, and so much more a level. */
export const NEST_RAID_SHARE = 0.4;
export const NEST_RAID_PER_LEVEL = 0.08;
/** How many cells a party walks a second (the trip's length). */
export const NEST_SECONDS_PER_CELL = 6;

/** A nest's name with its level ("Goblin Warren (grown 3)"). */
export const nestName = (kind: NestKind, level: number) => `${NEST_DEFS[kind].name}${level > 1 ? `, grown ${level}` : ''}`;
