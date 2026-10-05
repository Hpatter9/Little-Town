// The Monster Hunters' Guild (the owner's ask: hunts posted every now and then, rewards by how hard they are, and
// the parts of what's killed made into rare unique gear). The guild hall (Monster Lore) posts a hunt now and then: a
// quarry of one to five stars, out on the land, for a purse that grows with the stars. The town's parties take the
// hunts they dare (sim/parties.ts); a hunt won brings home the purse and the quarry's parts (`COMPONENTS`, materials),
// and the guild's hunters forge those into gear there is only one of (`FORGE`: unique weapons, rows in uniques.ts
// marked `FORGED`; and `FORGED_ARMOUR`, unique pieces of armour). The rules are in sim/hunts.ts.

import type { BuildingDef } from './buildings';
import type { Era } from './eras';
import type { ItemDef, ItemEffects, Slot } from './items';
import type { Material, Stock } from './materials';
import type { Topic } from './research';
import type { ArmourWeight } from './armour';

/** The monster parts a hunt brings home (in data/materials.ts too): what they're called, what they're worth. */
export const COMPONENTS = ['beast_fang', 'thick_pelt', 'venom_sac', 'chitin', 'great_horn', 'wyrm_scale', 'gorgon_eye', 'ghost_essence', 'monster_heart', 'dragon_heart'] as const satisfies readonly Material[];
export type Component = (typeof COMPONENTS)[number];

export const MONSTER_LORE: Topic = {
  id: 'monster_lore',
  name: 'Monster Lore',
  branch: 'military',
  era: 'neolithic',
  seconds: 240,
  prereqs: ['spear_hunting'],
  unlocks: "The Monster Hunters' Guild: hunts posted for a purse, and gear forged from what's brought home",
  effects: [],
};

export const MONSTER_GUILD: BuildingDef = {
  id: 'monster_guild',
  name: "Monster Hunters' Guild",
  layer: 'mid',
  width: 3,
  cost: { wood: 18, stone: 10, hide: 6, bone: 4 },
  buildSeconds: 120,
  purpose: 'Posts hunts for the monsters of the land, pays for their heads, and forges their parts into gear there is only one of.',
  research: 'monster_lore',
};

/** A hunt's quarry. */
export interface Quarry {
  id: string;
  name: string;
  /** One to five stars: how hard, and how well it pays. */
  stars: 1 | 2 | 3 | 4 | 5;
  era: Era;
  foes: Record<string, number>;
  /** The parts it gives up. */
  parts: Partial<Record<Component, number>>;
  scenery: 'thicket' | 'river' | 'woods' | 'quarry' | 'cave';
  /** What the guild's notice says. */
  text: string;
}

const N: Era = 'neolithic';
const M: Era = 'medieval';

export const QUARRIES: readonly Quarry[] = [
  // one star
  { id: 'dire_pack', name: 'The Dire Pack', stars: 1, era: N, foes: { wolf: 3, wolf_alpha: 1 }, parts: { beast_fang: 3, thick_pelt: 1 }, scenery: 'woods', text: 'Wolves grown bold and big, taking sheep from the folds and following travellers home.' },
  { id: 'old_tusker', name: 'Old Tusker', stars: 1, era: N, foes: { boar: 3 }, parts: { beast_fang: 2, thick_pelt: 1 }, scenery: 'thicket', text: 'A boar the size of a pony and its sounder, rooting up the fields and goring dogs.' },
  { id: 'bat_swarm', name: 'The Bat Cloud', stars: 1, era: N, foes: { vampire_bat: 5 }, parts: { beast_fang: 2, venom_sac: 1 }, scenery: 'cave', text: 'A cloud of blood-bats out of the caves at dusk. Cattle are found white and dry.' },
  // two stars
  { id: 'bog_horror', name: 'The Bog Horror', stars: 2, era: N, foes: { slime: 3, acid_slime: 2 }, parts: { venom_sac: 2, chitin: 1 }, scenery: 'river', text: 'Something in the marsh dissolves what it touches. Two eel-men went in and came out as bones.' },
  { id: 'mossback', name: 'Mossback', stars: 2, era: N, foes: { mossback: 1, wolf: 1 }, parts: { thick_pelt: 2, monster_heart: 1 }, scenery: 'woods', text: 'An old forest beast with a back of moss and a temper like a rockfall.' },
  { id: 'night_hounds', name: 'The Night Hounds', stars: 2, era: N, foes: { zombie_hound: 3, wild_dog: 2 }, parts: { beast_fang: 4, ghost_essence: 1 }, scenery: 'woods', text: 'Dogs that should be dead, running with dogs that soon will be.' },
  // three stars
  { id: 'boar_king', name: 'The Boar King', stars: 3, era: N, foes: { boar_king: 1, boar: 2 }, parts: { great_horn: 2, thick_pelt: 2 }, scenery: 'thicket', text: 'The lord of the boars, with tusks like scythes. Hunters have tried for three generations.' },
  { id: 'thornmaw', name: 'Thornmaw', stars: 3, era: N, foes: { thornmaw: 1, shroom_folk: 2 }, parts: { venom_sac: 2, monster_heart: 1 }, scenery: 'woods', text: 'A briar that walks and eats, and the mushroom folk that tend it.' },
  { id: 'ogre_pass', name: 'The Ogres of the Pass', stars: 3, era: N, foes: { ogre: 2 }, parts: { monster_heart: 1, thick_pelt: 2 }, scenery: 'quarry', text: 'Two ogres have taken the high pass and eat whatever comes through it.' },
  { id: 'gorgon_nest', name: "The Gorgons' Nest", stars: 3, era: M, foes: { gorgon: 2, gorgon_matriarch: 1 }, parts: { gorgon_eye: 1, venom_sac: 2 }, scenery: 'cave', text: 'Statues are turning up on the hill road. They all look terrified.' },
  // four stars
  { id: 'drake_roost', name: 'The Drake Roost', stars: 4, era: M, foes: { drake: 3 }, parts: { wyrm_scale: 3 }, scenery: 'quarry', text: 'Three young drakes roost on the crags, and set fire to the hayricks for sport.' },
  { id: 'grub_mother', name: 'The Grub Mother', stars: 4, era: M, foes: { grub_mother: 1, slime: 2 }, parts: { chitin: 3, venom_sac: 2 }, scenery: 'cave', text: 'Something vast is laying eggs under the old quarry, and the ground is hollow with its brood.' },
  { id: 'yeti_king', name: 'The Yeti King', stars: 4, era: M, foes: { yeti_king: 1, frost_yeti: 2 }, parts: { thick_pelt: 4, monster_heart: 1 }, scenery: 'quarry', text: 'The white king of the high snows has come down with the winter, and his court with him.' },
  { id: 'minotaur_lord', name: 'Asterion', stars: 4, era: M, foes: { minotaur_lord: 1, minotaur: 1 }, parts: { great_horn: 3, monster_heart: 1 }, scenery: 'cave', text: 'The bull-headed lord has left his labyrinth. Herds vanish, and the bellowing carries for miles.' },
  { id: 'barrow_wight', name: 'The Barrow Wight', stars: 4, era: M, foes: { barrow_wight: 1, wraith: 2, grave_ghost: 2 }, parts: { ghost_essence: 3 }, scenery: 'cave', text: 'A cold light walks the barrows at night, and the ghosts follow it in a line.' },
  { id: 'gorgon_queen', name: 'The Gorgon Queen', stars: 4, era: M, foes: { gorgon_queen: 1, gorgon: 2 }, parts: { gorgon_eye: 2, venom_sac: 2 }, scenery: 'cave', text: 'Her garden of stone men grows every month. Her eyes are worth a fortune; so is looking away.' },
  // five stars
  { id: 'cave_troll', name: 'The Cave Troll', stars: 5, era: M, foes: { cave_troll: 1, ogre: 1 }, parts: { monster_heart: 2, thick_pelt: 3 }, scenery: 'cave', text: 'A troll as big as a barn, that heals as fast as you can cut it.' },
  { id: 'salamander', name: 'The Salamander', stars: 5, era: M, foes: { salamander: 1, fire_elemental: 2 }, parts: { wyrm_scale: 3, monster_heart: 1 }, scenery: 'quarry', text: 'A lizard of living flame in the old mine, and the fires it has woken.' },
  { id: 'behemoth', name: 'The Behemoth', stars: 5, era: M, foes: { behemoth: 1 }, parts: { great_horn: 3, monster_heart: 2 }, scenery: 'thicket', text: 'The ground shakes where it walks. Villages move out of its way.' },
  { id: 'rimewyrm', name: 'The Rimewyrm', stars: 5, era: M, foes: { rimewyrm: 1, ice_golem: 1 }, parts: { wyrm_scale: 4, dragon_heart: 1 }, scenery: 'quarry', text: 'A dragon of ice, asleep for a hundred years under the glacier. It is awake.' },
  { id: 'ashen_wyrm', name: 'The Ashen Wyrm', stars: 5, era: M, foes: { ashen_wyrm: 1, drake: 2 }, parts: { wyrm_scale: 4, dragon_heart: 1 }, scenery: 'quarry', text: 'A grey dragon over the burnt hills, with its brood. The guild pays its best for this one.' },
];

export const QUARRY_BY_ID: Record<string, Quarry> = Object.fromEntries(QUARRIES.map((q) => [q.id, q]));

/** The guild's purse for a hunt, by its stars. */
export const HUNT_PURSE: Record<number, number> = { 1: 40, 2: 80, 3: 150, 4: 260, 5: 420 };
/** The guild posts a hunt every `HUNT_EVERY_HOURS` or so (`HUNT_POST_CHANCE` of the hours it may), keeps at most
 *  `MOST_HUNTS` on the board, and each lapses after `HUNT_DAYS`. A town is offered hunts up to `starsFor` its size and
 *  age. */
export const HUNT_EVERY_HOURS = 30;
export const HUNT_POST_CHANCE = 0.25;
export const MOST_HUNTS = 3;
export const HUNT_DAYS = 6;
/** The pull of a hunt on a party choosing where to go: so much a star. */
export const PULL_HUNT_STAR = 3;
/** Seconds out to a hunt's ground (each way), by its stars. */
export const HUNT_OUT = (stars: number) => 50 + stars * 15;

/* ------------------------------------------------------------ the forge */

/** A forged unique's makings, time and the research it waits on (the guild's own, or more for the finer pieces). */
export interface Forging {
  cost: Stock;
  seconds: number;
  research: string[];
}
const R = ['monster_lore'];
const RM = ['monster_lore', 'iron_working'];

/** The unique weapons the guild forges (their rows are in uniques.ts, marked `FORGED`). */
export const FORGE: Record<string, Forging> = {
  fangreaver: { cost: { beast_fang: 6, thick_pelt: 2, flint: 4, wood: 4 }, seconds: 160, research: R },
  venomspite: { cost: { venom_sac: 4, beast_fang: 2, bone: 4 }, seconds: 180, research: R },
  hornbreaker: { cost: { great_horn: 4, monster_heart: 1, stone: 6, wood: 4 }, seconds: 220, research: R },
  gorgons_glare: { cost: { gorgon_eye: 2, venom_sac: 2, lumber: 4 }, seconds: 260, research: RM },
  wyrmscale_blade: { cost: { wyrm_scale: 6, iron: 6 }, seconds: 300, research: RM },
  ghostbinder: { cost: { ghost_essence: 4, bone: 6, lumber: 2 }, seconds: 260, research: RM },
  heart_of_the_wyrm: { cost: { dragon_heart: 1, wyrm_scale: 4, iron: 8 }, seconds: 400, research: RM },
};

/** The unique armour the guild forges. */
type ArmourRow = [string, string, Slot, ArmourWeight, Partial<ItemEffects>, Forging, ItemDef['icon'], string];
const ARMOUR_ROWS: ArmourRow[] = [
  ['wolfhead_hood', 'Wolf-Head Hood', 'head', 'light', { armor: 0.14, dodge: 0.06 }, { cost: { thick_pelt: 2, beast_fang: 3 }, seconds: 140, research: R }, { sheet: 'Hat', x: 2, y: 0 }, "A dire wolf's head, worn as a hood: the jaws over the brow, the pelt down the back."],
  ['trollhide_coat', 'Trollhide Coat', 'body', 'light', { armor: 0.32, dodge: 0.05 }, { cost: { thick_pelt: 6, monster_heart: 1 }, seconds: 220, research: R }, { sheet: 'Armor', x: 1, y: 0 }, 'Stitched from hides that once healed themselves; it still closes over a cut.'],
  ['chitin_bulwark', 'Chitin Bulwark', 'offhand', 'shield', { block: 0.35, armor: 0.04 }, { cost: { chitin: 5, wood: 4 }, seconds: 200, research: R }, { sheet: 'Shield', x: 3, y: 0 }, "A shield of the Grub Mother's shell: light as wicker, hard as iron."],
  ['wyrmscale_mail', 'Wyrmscale Mail', 'body', 'heavy', { armor: 0.55 }, { cost: { wyrm_scale: 8, iron: 6 }, seconds: 360, research: RM }, { sheet: 'Armor', x: 5, y: 0 }, "Overlapping drake scales on a mail shirt. Fire runs off it like rain."],
  ['gorgon_eye_amulet', 'Gorgon-Eye Amulet', 'charm', 'trinket', { dodge: 0.1, power: 0.15, morale: 3 }, { cost: { gorgon_eye: 1, bone: 2 }, seconds: 160, research: R }, { sheet: 'Amulet', x: 1, y: 0 }, 'A gorgon\'s eye in a cage of bone. It still looks; nobody likes to meet it.'],
  ['dragonheart_talisman', 'Dragonheart Talisman', 'charm', 'trinket', { armor: 0.08, power: 0.3, morale: 6 }, { cost: { dragon_heart: 1, gems: 1 }, seconds: 300, research: RM }, { sheet: 'Amulet', x: 4, y: 0 }, "A dragon's heart, shrunk and hardened to a garnet, warm in the hand."],
];

export const FORGED_ARMOUR: readonly ItemDef[] = ARMOUR_ROWS.map(([id, name, slot, weight, effects, f, icon, lore]) => ({
  id,
  name,
  slot,
  station: 'monster_guild',
  cost: f.cost,
  seconds: f.seconds,
  research: f.research,
  relic: true,
  unique: true,
  weight,
  effects: effects as ItemEffects,
  description: `${lore} Unique, forged at the Monster Hunters' Guild.`,
  icon,
}));

/** Every forged unique, weapons and armour. */
export const FORGED_IDS: readonly string[] = [...Object.keys(FORGE), ...FORGED_ARMOUR.map((a) => a.id)];
