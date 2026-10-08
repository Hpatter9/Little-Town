// The Calamity (the owner's pick: a world-ending threat that builds over generations, a story for the long game).
// Every town has one, chosen from its seed: a dark lord in a far fortress, a grey rot spreading through the land, or a
// god asleep under the mountains. It wakes some days after the founding, and its **dread** (0 to 100) rises a little
// every day and faster for every monster nest left to grow on the land (data/nests.ts). As the dread climbs it passes
// through stages: omens; the spreading (its scar on the land widens and nests come thicker); cults (townsfolk lured to
// it, sabotage); armies (its raids); and at 100 the final siege, led by its avatar. Win the siege (the avatar falls)
// and the town is saved for good; lose it and the town is ravaged and the dread climbs back, and three sieges lost is
// the end. The town pushes back: clearing nests and the Calamity's heart (a place on the board) lowers the dread, ward
// stones slow it. The rules are in sim/calamity.ts.

import type { EnemyDef } from './enemies';
import type { ItemDef } from './items';
import type { BuildingDef } from './buildings';
import type { RaidKind } from './raids';
import { PACK_SHEETS } from './packSheets';

export type CalamityKind = 'tyrant' | 'rot' | 'sleeper';

export interface CalamityDef {
  kind: CalamityKind;
  /** Its name ("the Ashen Tyrant"), and the heart of it on the land (a place on the board from the spreading). */
  name: string;
  heart: string;
  /** How it wakes (the first stage's telling), and an omen line for each night it shows itself. */
  waking: string;
  omens: string[];
  /** What each stage brings (told as the town passes into it: index 1 to 5). */
  stages: string[];
  /** Its army (the raids it sends from the armies stage on), and its avatar, who leads the final siege. */
  army: string;
  avatar: string;
  /** Who guards its heart, by stage (2 to 5, index 0 to 3). */
  guard: Record<string, number>[];
  /** Its cult's name ("the Ashen Brotherhood"). */
  cult: string;
  /** The words for a picture (data/eventScenes.ts) for its tellings. */
  picture: string;
}

export const CALAMITIES: Record<CalamityKind, CalamityDef> = {
  tyrant: {
    kind: 'tyrant',
    name: 'the Ashen Tyrant',
    heart: 'The Ashen Spire',
    waking:
      'Far off, past the edge of the known land, a tower of black stone has risen where there was none. At night a red light burns at its top, and the old folk say a king who was dead has come back to finish what he began.',
    omens: [
      'A red light burned on the horizon all night, and the dogs would not stop howling.',
      'Ash fell like snow this morning, though there is no fire anywhere near.',
      'The crows have all flown away to the east. Not one is left in the town.',
      'Someone heard marching in the dark, far off, and a horn that was not a horn.',
      'The well water came up grey and tasting of smoke.',
    ],
    stages: [
      '',
      'The Ashen Tyrant stirs. Omens trouble the town.',
      "The Tyrant's shadow spreads: the land round his spire is dying, and creatures gather in its nests.",
      'A cult of the Tyrant has taken root in the land. Some of the town may listen to it.',
      "The Tyrant's armies march: his dead knights ride against the town.",
      'The Ashen Tyrant comes himself, at the head of his whole host. This is the last battle.',
    ],
    army: 'calamity_tyrant',
    avatar: 'ashen_tyrant',
    guard: [{ skeleton_warrior: 3, skeleton_archer: 2 }, { bone_knight: 2, skeleton_archer: 2 }, { death_knight: 1, bone_knight: 2 }, { death_knight: 2, revenant: 2 }],
    cult: 'the Ashen Brotherhood',
    picture: 'war fire ruin dark',
  },
  rot: {
    kind: 'rot',
    name: 'the Grey Rot',
    heart: 'The Rotting Heart',
    waking:
      'In a far valley the trees have turned grey, and the grey is spreading. Whatever it touches sickens and rots, and the things that live in it are no longer only animals. Something at the heart of it is awake, and hungry.',
    omens: [
      'A grey mould crept over the bread in the stores overnight.',
      'The fish in the river came up dead and pale, belly up, all of them.',
      'A sweet rotten smell drifted in on the wind all evening.',
      'The leaves on the trees at the town\'s edge have gone grey at the tips.',
      'A deer staggered out of the woods with grey eyes, and fell dead at the gate.',
    ],
    stages: [
      '',
      'The Grey Rot stirs. Omens trouble the town.',
      'The Rot spreads across the land: everything it touches withers, and its things breed in their nests.',
      'A cult of the Rot preaches that rotting is a rebirth. Some of the town may listen.',
      'The Rot sends its swollen dead against the town.',
      'The Mother of the Rot herself rolls toward the town, with all her brood. This is the last battle.',
    ],
    army: 'calamity_rot',
    avatar: 'rot_mother',
    guard: [{ plague_zombie: 2, bog_zombie: 2 }, { plague_zombie: 2, acid_slime: 3 }, { flesh_giant: 1, plague_zombie: 2 }, { flesh_giant: 1, plague_zombie: 3, acid_slime: 2 }],
    cult: 'the Grey Communion',
    picture: 'plague swamp dead rot',
  },
  sleeper: {
    kind: 'sleeper',
    name: 'the Sleeper Below',
    heart: 'The Dreaming Pit',
    waking:
      'The ground shook in the night, gently, as if something huge had turned over in its sleep. Since then everyone in the town has had the same dream: a pit, and an eye opening at the bottom of it.',
    omens: [
      'Everyone woke at the same moment last night, from the same dream.',
      'The ground trembled at dawn, and a crack opened in the road.',
      'The stars were wrong last night. Nobody can say how, but they were wrong.',
      'A child drew an eye in the mud, over and over, and could not say why.',
      'The animals in the pens all lay down at once, facing the same way.',
    ],
    stages: [
      '',
      'The Sleeper Below stirs in its dreams. Omens trouble the town.',
      'The Sleeper dreams, and its dreams spill out over the land: things crawl out of the earth to nest.',
      'A cult has grown up that waits for the Sleeper to wake. Some of the town may join it.',
      'Things from the Sleeper\'s dreams march on the town.',
      'The Sleeper wakes, and rises from its pit, and comes. This is the last battle.',
    ],
    army: 'calamity_sleeper',
    avatar: 'the_sleeper',
    guard: [{ red_imp: 3, crystal_fiend: 1 }, { brute_demon: 1, red_imp: 3 }, { brute_demon: 1, crystal_fiend: 2, fire_elemental: 1 }, { brute_demon: 2, fire_elemental: 2 }],
    cult: 'the Dreamers',
    picture: 'cave deep dark mountain',
  },
};

export const CALAMITY_KINDS = Object.keys(CALAMITIES) as CalamityKind[];

/** The stages by the dread they begin at (0: asleep, 1 omens ... 5 the siege). */
export const STAGE_AT = [0, 0, 20, 45, 70, 100] as const;
export const STAGE_NAMES = ['Asleep', 'Omens', 'The spreading', 'The cults', 'The armies', 'The last siege'] as const;
export type CalamityStage = 0 | 1 | 2 | 3 | 4 | 5;
export const stageOfDread = (dread: number): CalamityStage => (dread >= 100 ? 5 : dread >= STAGE_AT[4] ? 4 : dread >= STAGE_AT[3] ? 3 : dread >= STAGE_AT[2] ? 2 : 1);

/** It wakes on this day (0-based) at `CALAMITY_HOUR`, and is reckoned each morning at that hour. */
export const CALAMITY_WAKES = 6;
export const CALAMITY_HOUR = 8;
/** The dread rises this much a day on its own, and this much more for each level of each nest on the land; each ward
 *  stone standing takes `WARD_DREAD` a day off it (never below nothing gained). */
export const DREAD_PER_DAY = 0.75;
export const DREAD_PER_NEST_LEVEL = 0.06;
export const WARD_DREAD = 0.3;
/** Clearing a nest takes this much off (and this much more a level); clearing the heart, `HEART_DREAD`. */
export const NEST_CLEARED_DREAD = 2;
export const NEST_CLEARED_PER_LEVEL = 1;
export const HEART_DREAD = 12;
/** After the heart is cleared it reforms in so many days. */
export const HEART_QUIET_DAYS = 8;
/** The heart lies this far off (cells from the camp), and its scar (its blight) is this wide at the spreading,
 *  growing so much a day, up to `SCAR_MOST`. */
export const HEART_FAR = 70;
export const SCAR_START = 3;
export const SCAR_PER_DAY = 0.35;
export const SCAR_MOST = 22;
/** An omen comes on this chance each night of the omens stage and after. */
export const OMEN_NIGHTLY = 0.35;
export const OMEN_HOUR = 22;
/** From the cults on: each morning on this chance the cult does something (a deed), and it lures a townsperson whose
 *  spirits are under `LURE_BELOW` on `LURE_CHANCE` (a cultist, found out on `FOUND_CHANCE` a day by the town's best
 *  at Social or a guard). */
export const CULT_DAILY = 0.3;
export const LURE_BELOW = 45;
export const LURE_CHANCE = 0.35;
export const FOUND_CHANCE = 0.2;
/** From the armies on: each morning a raid is due within a day, on this chance it is the Calamity's (with this share
 *  of the budget, more as the dread climbs). */
export const ARMY_DAILY = 0.5;
export const ARMY_SHARE = 0.8;
/** The last siege: warned this many hours ahead, a host of `SIEGE_SIZE` (and so many more a lost siege) led by the
 *  avatar. Lost, the dread falls back to `SIEGE_LOST_DREAD`, `SIEGE_RUIN` of the buildings burn, and `SIEGES_TO_FALL`
 *  lost is the end of the town. */
export const SIEGE_WARNING_HOURS = 24;
export const SIEGE_SIZE = 28;
export const SIEGE_SIZE_PER_LOSS = 10;
export const SIEGE_LOST_DREAD = 82;
export const SIEGE_RUIN = 3;
export const SIEGES_TO_FALL = 3;
/** Ward stones: one wanted for each stage from the spreading on, up to `WARDS_MOST`. */
export const WARDS_MOST = 3;
export const WARD = 'ward_stone';

const pack = (sheet: keyof typeof PACK_SHEETS, height: number) => ({ sheet, block: 0, scale: +(height / PACK_SHEETS[sheet]).toFixed(2) });

/** The avatars (merged into ENEMIES). */
export const CALAMITY_ENEMIES: Record<string, EnemyDef> = {
  ashen_tyrant: {
    id: 'ashen_tyrant',
    name: 'The Ashen Tyrant',
    hp: 1100,
    damage: [20, 30],
    accuracy: 0.82,
    dodge: 0.1,
    interval: 1.3,
    ranged: false,
    boss: true,
    loot: { iron: 12, cloth: 6 },
    tint: 0xff9080,
    sprite: { sheet: 'dark_knight', block: 0, scale: 2 },
    look: { hue: -20, bright: 0.8 },
    nature: 'undead',
    armor: 0.25,
    kit: {
      roar: 'The Ashen Tyrant rides out of the smoke, and the ground blackens under his horse. "Kneel, or burn."',
      enrage: 'The Tyrant\'s armour cracks, and fire pours out of the cracks!',
      area: { every: 3, targets: 4, name: 'sweeps his burning blade', burns: true, fx: 'fire' },
      summon: { kind: 'death_knight', count: 2, text: 'The Tyrant raises his fallen knights!' },
      trophy: 'tyrants_crown',
    },
  },
  rot_mother: {
    id: 'rot_mother',
    name: 'The Mother of the Rot',
    hp: 1250,
    damage: [17, 26],
    accuracy: 0.74,
    dodge: 0.02,
    interval: 1.6,
    ranged: false,
    boss: true,
    loot: { herbs: 12, hide: 6 },
    sprite: pack('hk_slime_green', 120),
    look: { grey: true, bright: 0.85 },
    nature: 'beast',
    kit: {
      roar: 'A hill of grey flesh rolls out of the woods, and everything it passes rots.',
      enrage: 'The Mother splits open, and her brood spills out!',
      area: { every: 3, targets: 4, name: 'bursts in a cloud of rot', fx: 'acid' },
      summon: { kind: 'plague_zombie', count: 3, text: 'The Rot\'s swollen dead claw their way out of her!' },
      trophy: 'rot_heart',
    },
  },
  the_sleeper: {
    id: 'the_sleeper',
    name: 'The Sleeper, Awake',
    hp: 1400,
    damage: [22, 32],
    accuracy: 0.76,
    dodge: 0.02,
    interval: 1.9,
    ranged: false,
    boss: true,
    loot: { stone: 20, gems: 4 },
    sprite: { sheet: 'behemoth', block: 0, scale: 1.05 },
    look: { hue: 220, bright: 0.75 },
    nature: 'beast',
    armor: 0.2,
    kit: {
      roar: 'The earth splits, and the Sleeper climbs out of it, an eye in every crack of its hide.',
      enrage: 'The Sleeper screams, and the dream breaks over everyone at once!',
      area: { every: 3, targets: 4, name: 'shakes the earth', fx: 'quake' },
      summon: { kind: 'brute_demon', count: 2, text: 'Things from its dream climb out after it!' },
      trophy: 'dreaming_eye',
    },
  },
};

/** Its armies (never rolled: sim/calamity.ts sends them; the siege is one of these led by the avatar). */
export const CALAMITY_RAIDS: RaidKind[] = [
  { id: 'calamity_tyrant', name: "The Ashen Tyrant's host", goal: 'harm', goals: { harm: 4, burn: 2, kidnap: 1 }, enemies: { skeleton_warrior: 9, skeleton_archer: 8, bone_knight: 18, death_knight: 34 }, fromDay: 9999, weight: 0, speed: 40, bribable: false, plural: false },
  { id: 'calamity_rot', name: 'The swollen dead of the Rot', goal: 'harm', goals: { harm: 5, kidnap: 1 }, enemies: { bog_zombie: 6, plague_zombie: 9, acid_slime: 6, flesh_giant: 40 }, fromDay: 9999, weight: 0, speed: 30, bribable: false, plural: true },
  { id: 'calamity_sleeper', name: "Things from the Sleeper's dream", goal: 'harm', goals: { harm: 4, burn: 2 }, enemies: { red_imp: 5, crystal_fiend: 16, fire_elemental: 14, brute_demon: 30 }, fromDay: 9999, weight: 0, speed: 45, bribable: false, plural: true },
];

/** The avatars' trophies (merged into ITEMS): what the town keeps of the Calamity, once it's beaten. */
const relic = (id: string, name: string, slot: ItemDef['slot'], effects: ItemDef['effects'], description: string, icon: ItemDef['icon']): ItemDef => ({
  id, name, slot, station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects, description, icon,
});
export const CALAMITY_TROPHIES: readonly ItemDef[] = [
  relic('tyrants_crown', "The Tyrant's Crown", 'head', { armor: 0.2, morale: 10, power: 0.25 }, 'Black iron, still warm from the fire inside it. Whoever wears it is obeyed.', { sheet: 'Hat', x: 2, y: 1 }),
  relic('rot_heart', 'The Heart of the Rot', 'charm', { armor: 0.15, morale: 4, gather: { forage: 1.4 } }, 'Grey and beating faintly. The land round its bearer grows back twice as rich.', { sheet: 'Flesh', x: 1, y: 0 }),
  relic('dreaming_eye', 'The Dreaming Eye', 'charm', { dodge: 0.12, morale: 6, power: 0.3 }, 'A stone eye that still dreams. Its bearer sees blows before they fall, and their spells burn hotter.', { sheet: 'Magic', x: 7, y: 1 }),
];

/** The ward stone (merged into BUILDINGS; the planner leaves it to sim/calamity.ts, which raises one for each stage
 *  from the spreading on). */
export const WARD_BUILDING: BuildingDef = {
  id: WARD,
  name: 'Ward Stone',
  layer: 'mid',
  width: 1,
  cost: { stone: 12, herbs: 3 },
  buildSeconds: 90,
  purpose: 'A stone carved with old signs against the dark: the Calamity\'s dread rises more slowly while it stands, and no blight comes near it.',
  morale: [1, 'The ward stones stand'],
};
