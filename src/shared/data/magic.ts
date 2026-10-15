// Magic as a system of the town (sim/magic.ts). The land has leylines: a few straight lines of power across it from
// the seed, stronger where they cross (a well) and in some lands than others (`LEY_BIOME`). Once the town has learned
// Leyline Lore it gathers mana (`MANA_*`): a Mage Tower drinks from the ley under it, and every caster adds a little.
// Seven schools are studied like any topic (`SCHOOLS`, merged into the research tree as `MAGIC_TOPICS`); each opens
// spells a caster may learn by study beyond their calling's own (`SCHOOL_SPELLS`, from data/spells.ts), a tome that
// speeds the study (`tome_<school>`, crafted at the Arcane Library) and the town's rites (`RITES`): wards and
// foresight against raids, fire on raiders on the road, healing rites, enchanted tools, rain called down, the world
// map scried, servants animated, and the Forbidden Arts' blood rite. Foci (charms only casters carry: `FOCI`) are made
// at the Mage Tower. Every rite costs mana and stirs the wild magic (`FLUX_*`), and may miscast; mages go mad; past
// `SURGE_AT` the wild magic surges (fire, deaths, a plague, a tear into another world, a cursed thing left behind).
// Enchanted and cursed one-of-a-kind charms are `MAGIC_UNIQUES`. Each people has its own flavour (`FLAVOURS`).

import type { BuildingDef } from './buildings';
import type { Biome } from './biomes';
import type { ItemDef } from './items';
import type { OriginId } from './origins';
import type { Topic } from './research';

export type SchoolId = 'evocation' | 'abjuration' | 'restoration' | 'divination' | 'transmutation' | 'conjuration' | 'forbidden';
export const SCHOOL_IDS: readonly SchoolId[] = ['evocation', 'abjuration', 'restoration', 'divination', 'transmutation', 'conjuration', 'forbidden'];

export interface SchoolDef {
  id: SchoolId;
  name: string;
  /** Its research topic. */
  topic: string;
  /** What it is for, in a line (the Magic tab). */
  text: string;
  /** The pixel-effects element its rites are drawn in (data/actFx.ts ids: `px:<element>-<shape>`). */
  fx: string;
}

export const SCHOOLS: Record<SchoolId, SchoolDef> = {
  evocation: { id: 'evocation', name: 'Evocation', topic: 'school_evocation', text: 'Fire and lightning: raiders burned on the road before they reach the town.', fx: 'px:fire-explosion' },
  abjuration: { id: 'abjuration', name: 'Abjuration', topic: 'school_abjuration', text: 'Wards over the town that sap raiders as they come, and curses broken.', fx: 'px:light-shield' },
  restoration: { id: 'restoration', name: 'Restoration', topic: 'school_restoration', text: 'Healing rites: the downed kept from bleeding out, the hurt mended, the sick eased.', fx: 'px:forest-sparkle' },
  divination: { id: 'divination', name: 'Divination', topic: 'school_divination', text: 'Scrying: raiders seen coming long before they arrive, and far lands mapped from the tower.', fx: 'px:star-rune' },
  transmutation: { id: 'transmutation', name: 'Transmutation', topic: 'school_transmutation', text: 'Enchanted tools that quicken all work, and rain called down on a drought or a fire.', fx: 'px:water-rain' },
  conjuration: { id: 'conjuration', name: 'Conjuration', topic: 'school_conjuration', text: 'Servants animated to fetch wood and stone, fed on mana; starved, they turn.', fx: 'px:star-circle' },
  forbidden: { id: 'forbidden', name: 'The Forbidden Arts', topic: 'school_forbidden', text: 'Mana drawn from blood. Strong, wicked, and the surest road to madness.', fx: 'px:dark-vortex' },
};

/** The first topic: the leylines understood, the Mage Tower raised and mana gathered. */
export const LEY_LORE = 'ley_lore';

export const MAGIC_TOPICS: readonly Topic[] = [
  { id: LEY_LORE, name: 'Leyline Lore', branch: 'society', era: 'medieval', seconds: 420, prereqs: ['arcane_arts'], unlocks: 'The Mage Tower and the Arcane Library: the town gathers mana from the leylines, and its casters study', effects: [] },
  { id: 'school_evocation', name: 'Evocation', branch: 'military', era: 'medieval', seconds: 480, prereqs: [LEY_LORE], unlocks: 'Evocation: war spells to learn, and fire on raiders on the road', effects: [] },
  { id: 'school_abjuration', name: 'Abjuration', branch: 'military', era: 'medieval', seconds: 480, prereqs: [LEY_LORE], unlocks: 'Abjuration: wards that sap raiders, shields to learn, curses broken', effects: [] },
  { id: 'school_restoration', name: 'Restoration', branch: 'medicine', era: 'medieval', seconds: 480, prereqs: [LEY_LORE], unlocks: 'Restoration: healing rites, and mending spells to learn', effects: [] },
  { id: 'school_divination', name: 'Divination', branch: 'society', era: 'medieval', seconds: 480, prereqs: [LEY_LORE], unlocks: 'Divination: raids foreseen, far lands scried', effects: [] },
  { id: 'school_transmutation', name: 'Transmutation', branch: 'crafting', era: 'medieval', seconds: 540, prereqs: [LEY_LORE], unlocks: 'Transmutation: enchanted tools, rain called down', effects: [] },
  { id: 'school_conjuration', name: 'Conjuration', branch: 'crafting', era: 'medieval', seconds: 540, prereqs: ['school_transmutation'], unlocks: 'Conjuration: servants animated to fetch and carry', effects: [] },
  { id: 'school_forbidden', name: 'The Forbidden Arts', branch: 'occult', era: 'medieval', seconds: 720, prereqs: ['school_conjuration'], unlocks: 'The Forbidden Arts: mana from blood, and darker spells to learn', effects: [] },
];

/** The spells (data/spells.ts ids) each school teaches to any caster who studies it. */
export const SCHOOL_SPELLS: Record<SchoolId, readonly string[]> = {
  evocation: ['fire_bolt', 'frost_shard', 'thunder_jolt', 'flame_wave', 'ice_lance', 'chain_lightning', 'fireball', 'thunderstorm', 'meteor'],
  abjuration: ['ward', 'protect', 'arcane_shield', 'holy_shield', 'mana_shield', 'temporal_shield', 'spell_reflect', 'divine_ward'],
  restoration: ['mend', 'cure', 'rejuvenate', 'regen', 'cura', 'healing_rain', 'chain_heal', 'raise', 'curaga'],
  divination: ['flash', 'dispel_magic', 'slow_spell', 'quicken', 'rewind', 'stasis', 'banish'],
  transmutation: ['barkskin', 'accelerate', 'age', 'earthbind', 'call_lightning', 'elemental_burst', 'hurricane'],
  conjuration: ['call_spirit', 'spirit_bolt', 'call_wolf', 'call_salamander', 'call_treant', 'call_undine', 'call_golem', 'call_drake'],
  forbidden: ['hex_bolt', 'life_tap', 'wither', 'blood_hex', 'raise_dead', 'soul_rend', 'death_coil', 'doom_curse', 'finger_of_death'],
};

/* ------------------------------------------------------------ the leylines */

/** Leylines across the land, and how far either side of one its power is felt (cells). */
export const LEY_LINES = 3;
export const LEY_HALF = 6;
/** Wells where lines cross: how far their power reaches (cells) and how much stronger it is. */
export const WELL_R = 8;
export const WELL_POWER = 1.5;
/** The first line passes this near the camp (cells): every town has a line it can reach. */
export const LEY_NEAR_CAMP = 18;
/** How strongly each land holds the leylines. */
export const LEY_BIOME: Record<Biome, number> = { forest: 1.1, desert: 0.8, tundra: 1.2, coast: 1, swamp: 1.3, jungle: 1.2, highlands: 1.25, ashlands: 1.4, steppe: 0.9, taiga: 1.1 };

/* ------------------------------------------------------------ mana and the wild magic */

/** A finished Mage Tower's mana an hour, times (`TOWER_BASE` + the ley under it). */
export const TOWER_MANA = 3;
export const TOWER_BASE = 0.4;
/** Each caster at home adds this much an hour. */
export const CASTER_MANA = 0.25;
/** The most mana the town can hold: a base, and more for each tower and library. */
export const MANA_CAP = 30;
export const MANA_CAP_TOWER = 60;
export const MANA_CAP_LIBRARY = 30;
/** The wild magic: each point of mana spent on a rite stirs it this much; it settles by `FLUX_SETTLES` a share an
 *  hour; a tower on a strong line stirs it a little by itself (`FLUX_LEY` an hour per point of ley over 1). */
export const FLUX_PER_MANA = 0.012;
export const FLUX_SETTLES = 0.015;
export const FLUX_LEY = 0.004;
/** Past this the wild magic surges; afterwards it falls back to `SURGE_LEAVES`. */
export const SURGE_AT = 1;
export const SURGE_LEAVES = 0.2;
/** A surge: how far from the tower it reaches (cells), and its odds on each person there, and on the town. */
export const SURGE_R = 14;
export const SURGE_WOUNDS = 0.35;
export const SURGE_KILLS = 0.08;
export const SURGE_FIRES: [number, number] = [1, 2];
export const SURGE_TEAR = 0.35;
export const SURGE_PLAGUE = 0.3;
export const SURGE_CURSE = 0.3;

/* ------------------------------------------------------------ study, practice, madness */

/** Hours of study a spell needs for each of its levels. */
export const STUDY_PER_LEVEL = 2;
/** A caster may study spells this many levels beyond their own. */
export const STUDY_AHEAD = 5;
/** Study goes this much faster at the Arcane Library, or at the Mage Tower; and with the school's tome in store. */
export const STUDY_LIBRARY = 2;
export const STUDY_TOWER = 1.4;
export const STUDY_TOME = 1.5;
/** Intellect over the base quickens study this much a point. */
export const STUDY_INT = 0.03;
/** Practice: a rite gives `PRACTICE_RITE`, a spell learned `PRACTICE_SPELL`; mastery is practice / (practice +
 *  `MASTERY_HALF`), at most `MASTERY_MAX`: a master miscasts that much less. */
export const PRACTICE_RITE = 1;
export const PRACTICE_SPELL = 0.5;
export const MASTERY_HALF = 20;
export const MASTERY_MAX = 0.8;
/** A rite is this much stronger for each spell of its school the caster knows. */
export const POTENCY_PER_SPELL = 0.15;
/** A mage's madness: settles this much an hour; past `MAD_AT` the town must decide what to do with them. */
export const MAD_SETTLES = 0.004;
export const MAD_AT = 1;
/** A miscast's madness, and each Forbidden rite's; high wild magic weighs on every caster this much an hour. */
export const MAD_MISCAST = 0.35;
export const MAD_FORBIDDEN = 0.12;
export const MAD_FLUX = 0.006;
/** Locked away, a mad mage rests this many days. */
export const LOCK_DAYS = 5;
/** Let work on, a mad mage turns on someone this often. */
export const MAD_TURNS = 0.35;
/** A miscast's outcome shares, in order: a backlash (a burn), madness, death, the spell running wild, a tear. */
export const MISCAST_ODDS: [number, number, number, number, number] = [0.35, 0.2, 0.17, 0.14, 0.14];
/** A backlash takes this share of the caster's health. */
export const BACKLASH = 0.45;

/* ------------------------------------------------------------ the rites */

export type RiteId = 'firestorm' | 'ward' | 'foresight' | 'mending' | 'uncurse' | 'rain' | 'enchant' | 'scrying' | 'animate' | 'blood_rite';

export interface RiteDef {
  id: RiteId;
  name: string;
  school: SchoolId;
  mana: number;
  /** Hours before it's cast again. */
  cooldown: number;
  /** The base chance of a miscast. */
  danger: number;
  /** Alignment pushes (sim/alignment.ts): good or evil, order or chaos. */
  align?: number;
  order?: number;
}

export const RITES: Record<RiteId, RiteDef> = {
  firestorm: { id: 'firestorm', name: 'Firestorm', school: 'evocation', mana: 25, cooldown: 4, danger: 0.07 },
  ward: { id: 'ward', name: 'The Great Ward', school: 'abjuration', mana: 25, cooldown: 4, danger: 0.04, order: 0.3 },
  foresight: { id: 'foresight', name: 'Foresight', school: 'divination', mana: 12, cooldown: 4, danger: 0.03 },
  mending: { id: 'mending', name: 'Rite of Mending', school: 'restoration', mana: 15, cooldown: 8, danger: 0.03, align: 0.5 },
  uncurse: { id: 'uncurse', name: 'Breaking of Curses', school: 'abjuration', mana: 20, cooldown: 24, danger: 0.08, align: 0.3 },
  rain: { id: 'rain', name: 'Rain-calling', school: 'transmutation', mana: 30, cooldown: 36, danger: 0.06 },
  enchant: { id: 'enchant', name: 'Enchanting the Tools', school: 'transmutation', mana: 20, cooldown: 24, danger: 0.04 },
  scrying: { id: 'scrying', name: 'Scrying', school: 'divination', mana: 20, cooldown: 60, danger: 0.04 },
  animate: { id: 'animate', name: 'Animation', school: 'conjuration', mana: 22, cooldown: 24, danger: 0.06, order: -0.2 },
  blood_rite: { id: 'blood_rite', name: 'The Blood Rite', school: 'forbidden', mana: 0, cooldown: 30, danger: 0.12, align: -3, order: -0.5 },
};
/** The order the town considers its rites each hour (only one is cast an hour). */
export const RITE_ORDER: readonly RiteId[] = ['ward', 'firestorm', 'foresight', 'mending', 'uncurse', 'rain', 'blood_rite', 'scrying', 'animate', 'enchant'];

/** Foresight: a raid seen coming arrives this many hours later (the town has time to ready itself). */
export const FORESIGHT_HOURS = 2;
/** Foresight's omen: a raid due within this many hours is foretold. */
export const OMEN_HOURS = 12;
/** The Great Ward saps every raider this share of their health as they come (times the rite's potency, at most
 *  `WARD_MOST`). */
export const WARD_SAP = 0.15;
export const WARD_MOST = 0.4;
/** Firestorm: this many raiders burned for this share of their health (by potency). */
export const STORM_HITS = 3;
export const STORM_BURN = 0.45;
/** Mending: the hurt get back this share of their health; a downed is kept from bleeding out. */
export const MEND_SHARE = 0.4;
export const MEND_MOST = 6;
/** Enchanted tools: work goes this much faster, for this many hours. */
export const ENCHANT_WORK = 1.12;
export const ENCHANT_HOURS = 24;
/** Animated servants: the most (with one more per tower), their upkeep in mana an hour, what each fetches an hour. */
export const SERVANTS_MOST = 2;
export const SERVANT_UPKEEP = 0.6;
export const SERVANT_FETCH = 0.5;
/** A servant starved of mana turns: it hurts someone this badly (a share of their health) and is gone. */
export const SERVANT_TURNS = 0.5;
/** The Blood Rite: mana it gives, and the share of health it takes from whoever bleeds for it. */
export const BLOOD_MANA = 45;
export const BLOOD_TAKES = 0.5;
/** It's cast only when the town's mana is below this share of what it can hold. */
export const BLOOD_WHEN = 0.3;

/* ------------------------------------------------------------ each people's flavour */

export interface Flavour {
  /** What they call it. */
  mana: string;
  /** Mana gathered this much faster. */
  gather: number;
  /** Schools they're good at (rites stronger, study quicker: `FAVOURED`). */
  favoured: SchoolId[];
  /** A school they won't touch. */
  shuns?: SchoolId;
  /** Their animated servants. */
  servants: string;
  /** The Blood Rite's weight on the alignment (a share: the undead and the Court think nothing of it). */
  bloodGuilt?: number;
  /** Mana gathered at night this much faster (the Moon Pack). */
  night?: number;
}
export const FAVOURED = 1.3;

export const FLAVOURS: Record<OriginId, Flavour> = {
  settlers: { mana: 'mana', gather: 1, favoured: ['restoration'], servants: 'scarecrows' },
  lich: { mana: 'grave-essence', gather: 1.2, favoured: ['forbidden', 'conjuration'], servants: 'skeletal thralls', bloodGuilt: 0.3 },
  druid: { mana: 'the green', gather: 1.2, favoured: ['restoration', 'transmutation'], shuns: 'forbidden', servants: 'woken saplings' },
  vampire: { mana: 'sanguine power', gather: 1, favoured: ['forbidden', 'divination'], servants: 'blood-thralls', bloodGuilt: 0.3 },
  werewolf: { mana: 'moonlight', gather: 0.9, favoured: ['evocation'], servants: 'wolf-spirits', night: 1.8 },
  robot: { mana: 'aether', gather: 0.8, favoured: ['conjuration', 'divination'], servants: 'clockwork drones' },
  dwarves: { mana: 'rune-power', gather: 1, favoured: ['abjuration', 'transmutation'], servants: 'stone golems' },
  merfolk: { mana: 'tide-magic', gather: 1.1, favoured: ['restoration', 'divination'], servants: 'water-sprites' },
  nomads: { mana: 'star-lore', gather: 1, favoured: ['divination'], servants: 'dust-devils' },
  fae: { mana: 'glamour', gather: 1.3, favoured: ['divination', 'transmutation'], servants: 'pixies' },
  alchemists: { mana: 'quintessence', gather: 1.1, favoured: ['transmutation', 'conjuration'], servants: 'homunculi' },
  knights: { mana: 'grace', gather: 1, favoured: ['abjuration', 'restoration'], shuns: 'forbidden', servants: 'animated armour' },
  orcs: { mana: 'war-magic', gather: 0.9, favoured: ['evocation', 'forbidden'], servants: 'gremlins' },
};

/* ------------------------------------------------------------ buildings */

export const MAGE_TOWER = 'mage_tower';
export const ARCANE_LIBRARY = 'arcane_library';
export const MAGIC_BUILDINGS: BuildingDef[] = [
  { id: MAGE_TOWER, name: 'Mage Tower', layer: 'mid', width: 2, cost: { stone: 30, wood: 10, gems: 1 }, buildSeconds: 240, purpose: 'Drinks mana from the leyline under it (stand it on a strong line): the town\'s rites draw on it. Casters study here, and foci are made here.', research: LEY_LORE },
  { id: ARCANE_LIBRARY, name: 'Arcane Library', layer: 'mid', width: 3, cost: { wood: 20, stone: 10, hide: 6 }, buildSeconds: 180, purpose: 'Shelves of spellbooks: casters study here twice as fast, and the schools\' tomes are written here.', research: LEY_LORE },
];

/* ------------------------------------------------------------ items: tomes, foci, enchanted and cursed things */

/** Foci: charms only a caster can carry (sim/classes.ts canWear). */
export const FOCI: readonly string[] = ['apprentice_focus', 'ley_crystal', 'runed_orb'];

const tome = (school: SchoolId, x: number, y: number): ItemDef => ({
  id: `tome_${school}`,
  name: `Tome of ${SCHOOLS[school].name.replace(/^The /, '')}`,
  slot: null,
  station: 'arcane_library',
  cost: { hide: 2, fiber: 3 },
  seconds: 140,
  research: [SCHOOLS[school].topic],
  effects: {},
  description: `Kept in the stores: the town's casters learn ${SCHOOLS[school].name.replace(/^The /, 'the ')} spells half again as fast.`,
  icon: { sheet: 'Book', x, y },
});

export const MAGIC_ITEMS: ItemDef[] = [
  tome('evocation', 0, 0),
  tome('abjuration', 1, 0),
  tome('restoration', 2, 0),
  tome('divination', 3, 0),
  tome('transmutation', 4, 0),
  tome('conjuration', 5, 0),
  tome('forbidden', 6, 0),
  { id: 'apprentice_focus', name: "Apprentice's Focus", slot: 'charm', station: 'mage_tower', cost: { bone: 2, wood: 2 }, seconds: 90, research: [LEY_LORE], effects: { power: 0.1 }, weight: 'trinket', description: 'A carved bone on a cord to fix the mind on. A caster\'s spells 10% stronger, their rites steadier.', icon: { sheet: 'Amulet', x: 0, y: 0 } },
  { id: 'ley_crystal', name: 'Ley Crystal', slot: 'charm', station: 'mage_tower', cost: { stone: 4, gems: 1 }, seconds: 160, research: [LEY_LORE, 'school_abjuration'], effects: { power: 0.2, morale: 2 }, weight: 'trinket', description: 'A crystal grown on the leyline. A caster\'s spells 20% stronger, their rites steadier.', icon: { sheet: 'Magic', x: 0, y: 0 } },
  { id: 'runed_orb', name: 'Runed Orb', slot: 'charm', station: 'mage_tower', cost: { glass: 2, silver: 1 }, seconds: 220, research: [LEY_LORE, 'school_transmutation', 'glassblowing'], effects: { power: 0.3, morale: 3 }, weight: 'trinket', description: 'Glass cut with runes, cold to the touch. A caster\'s spells 30% stronger, their rites steadier.', icon: { sheet: 'Magic', x: 1, y: 0 } },
];

/** A focus's steadying of the rites (a share off the miscast chance, by its power). */
export const FOCUS_STEADY = 1;

/** Enchanted and cursed one-of-a-kind charms: never made; an enchanted one is a master mage's life's work, a cursed one
 *  is left behind by a surge or a Blood Rite. Cursed: madness and a drain on whoever bears it, until it's broken. */
const unique = (id: string, name: string, effects: ItemDef['effects'], description: string, icon: ItemDef['icon']): ItemDef => ({ id, name, slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, unique: true, weight: 'trinket', effects, description, icon });
export const MAGIC_UNIQUES: ItemDef[] = [
  unique('leyheart', 'The Leyheart', { power: 0.4, morale: 4 }, 'An orb with a leyline running through it like a vein. Its bearer\'s spells are 40% stronger, and the tower drinks deeper while they live.', { sheet: 'Magic', x: 2, y: 0 }),
  unique('star_mantle', 'Mantle of Stars', { power: 0.25, dodge: 0.1, morale: 3 }, 'Woven of the night sky over the tower. Hard to hit, and its bearer\'s spells burn hotter.', { sheet: 'Magic', x: 3, y: 1 }),
  unique('quiet_ring', 'Ring of Quiet Mending', { armor: 0.1, power: 0.15, morale: 5 }, 'A plain silver band that hums when someone near is hurt.', { sheet: 'Ring', x: 1, y: 1 }),
  unique('ashen_grimoire', 'The Ashen Grimoire', { power: 0.6 }, 'Cursed. Its pages are warm and whisper. Its bearer\'s spells are far stronger, and their mind wears thin.', { sheet: 'Book', x: 7, y: 1 }),
  unique('hollow_crown', 'The Hollow Crown', { armor: 0.15, morale: 8 }, 'Cursed. A circlet of black iron that will not come off: it lifts the spirits and empties the mind.', { sheet: 'Magic', x: 5, y: 2 }),
  unique('bloodstone', 'The Bloodstone', { power: 0.35, lifesteal: 0.1 }, 'Cursed. A red stone that drinks: from foes in a fight, and from its bearer every hour between.', { sheet: 'Ring', x: 3, y: 2 }),
];
export const ENCHANTED: readonly string[] = ['leyheart', 'star_mantle', 'quiet_ring'];
export const CURSED: readonly string[] = ['ashen_grimoire', 'hollow_crown', 'bloodstone'];
/** A cursed thing's madness and drain (a share of health) on its bearer, an hour. */
export const CURSE_MADNESS = 0.012;
export const CURSE_DRAIN = 0.02;
/** A caster with this many spells learned by study makes their masterwork (one of `ENCHANTED`), once each. */
export const MASTER_SPELLS = 6;

/** What a magic topic is worth to the planner (sim/planner.ts topicScore): the lore once the town is a few strong, the
 *  schools after it, the ones against raiders more once it has been raided. */
export function magicTopicWorth(id: string, people: number, raided: boolean): number {
  if (id === LEY_LORE) return people >= 6 ? 26 : 4;
  const school = SCHOOL_IDS.find((k) => SCHOOLS[k].topic === id);
  if (!school) return 0;
  if (people < 6) return 2;
  return 12 + (raided && (school === 'evocation' || school === 'abjuration' || school === 'divination') ? 10 : 0) + (school === 'restoration' ? 4 : 0);
}

/** The names over magic's other marks on the map (`magic:<id>` spells, beside the rites'). */
export const MAGIC_FX_NAMES: Record<string, string> = { surge: 'Wild Surge', miscast: 'Miscast', mad: 'Mad Magic' };
