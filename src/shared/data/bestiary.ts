// The bestiary from the Craftpix packs (renderer/art/creatures/packs/, built by tools/compose-sheets.cjs): new foes,
// the raids they come in, a dozen new bosses with their trophies, and the lairs they rule (legendary expedition
// destinations, each with its place on the world map and its scenes). Merged into the game's own lists by
// enemies.ts, raids.ts, items.ts, expeditions.ts, worldMap.ts and scenes.ts.

import type { EnemyDef } from './enemies';
import type { Destination } from './expeditions';
import type { ItemDef } from './items';
import { PACK_SHEETS, type PackSheetId } from './packSheets';
import type { RaidKind } from './raids';
import type { SceneId } from './scenes';

/** Drawn this tall (px) in town, whatever the size of the pack's frames. */
const sprite = (sheet: PackSheetId, height: number) => ({ sheet, block: 0, scale: +(height / PACK_SHEETS[sheet]).toFixed(2) });

type Stats = Omit<EnemyDef, 'id' | 'sprite'> & { sheet: PackSheetId; height: number };
const foe = (id: string, s: Stats): EnemyDef => {
  const { sheet, height, ...def } = s;
  return { id, ...def, sprite: sprite(sheet, height) };
};
const PERSON = 46;

export const BESTIARY_ENEMIES: Record<string, EnemyDef> = {
  // Out of the sea, against a shore town (the merfolk): reavers off a black-sailed ship, the drowned, the deep's spawn
  sea_reaver: foe('sea_reaver', { name: 'Sea Reaver', hp: 50, damage: [6, 10], accuracy: 0.7, dodge: 0.12, interval: 1.1, ranged: false, loot: { cloth: 1, pearls: 1 }, sheet: 'pirate_leader', height: PERSON }),
  drowned_sailor: foe('drowned_sailor', { name: 'Drowned Sailor', hp: 46, damage: [5, 9], accuracy: 0.64, dodge: 0.04, interval: 1.3, ranged: false, loot: { cloth: 1 }, sheet: 'pirate_zombie', height: PERSON, nature: 'undead' }),
  squid_spawn: foe('squid_spawn', { name: 'Squid Spawn', hp: 58, damage: [6, 11], accuracy: 0.66, dodge: 0.1, interval: 1.2, ranged: false, loot: { meat: 2 }, sheet: 'squidman', height: PERSON - 4, nature: 'beast' }),
  // Stone Age: gremlins that raid the stores, giant rats, the woods' satyrs
  pink_gremlin: foe('pink_gremlin', { name: 'Pink Gremlin', hp: 18, damage: [2, 4], accuracy: 0.66, dodge: 0.25, interval: 0.9, ranged: false, loot: { berries: 1 }, sheet: 'imp_pink', height: 22 }),
  owlet_gremlin: foe('owlet_gremlin', { name: 'Owlet Gremlin', hp: 16, damage: [2, 4], accuracy: 0.7, dodge: 0.3, interval: 0.9, ranged: true, loot: { fiber: 1 }, sheet: 'imp_owlet', height: 22 }),
  blue_gremlin: foe('blue_gremlin', { name: 'Blue Gremlin', hp: 22, damage: [3, 5], accuracy: 0.66, dodge: 0.22, interval: 1.0, ranged: false, loot: { herbs: 1 }, sheet: 'imp_dude', height: 22 }),
  giant_rat: foe('giant_rat', { name: 'Giant Rat', hp: 26, damage: [3, 6], accuracy: 0.7, dodge: 0.2, interval: 1.0, ranged: false, loot: { hide: 1, meat: 1 }, sheet: 'horde_1', height: 24, nature: 'beast' }),
  satyr: foe('satyr', { name: 'Satyr', hp: 44, damage: [4, 8], accuracy: 0.68, dodge: 0.18, interval: 1.1, ranged: false, loot: { hide: 1, herbs: 1 }, sheet: 'satyr_1', height: PERSON, nature: 'beast' }),
  satyr_shaman: foe('satyr_shaman', { name: 'Satyr Shaman', hp: 40, damage: [5, 9], accuracy: 0.7, dodge: 0.14, interval: 1.4, ranged: true, loot: { herbs: 3 }, sheet: 'satyr_2', height: PERSON + 4, nature: 'beast' }),
  satyr_reveller: foe('satyr_reveller', { name: 'Satyr Reveller', hp: 52, damage: [5, 9], accuracy: 0.66, dodge: 0.16, interval: 1.0, ranged: false, loot: { berries: 2, hide: 1 }, sheet: 'satyr_3', height: PERSON, nature: 'beast' }),
  mossback: foe('mossback', { name: 'Mossback Brute', hp: 160, damage: [10, 16], accuracy: 0.64, dodge: 0.04, interval: 1.8, ranged: false, boss: true, loot: { wood: 6, herbs: 3 }, sheet: 'forest_boss_2', height: 58, nature: 'beast' }),
  // Medieval: werewolves, gorgons, minotaurs, ronin, shinobi, rogue mages, yokai, fallen knights, the restless dead,
  // steppe lancers
  black_werewolf: foe('black_werewolf', { name: 'Black Werewolf', hp: 90, damage: [8, 13], accuracy: 0.74, dodge: 0.18, interval: 1.1, ranged: false, loot: { hide: 2, meat: 1 }, sheet: 'werewolf_black', height: 54, nature: 'beast' }),
  blood_werewolf: foe('blood_werewolf', { name: 'Blood Werewolf', hp: 100, damage: [9, 15], accuracy: 0.74, dodge: 0.16, interval: 1.0, ranged: false, loot: { hide: 2, meat: 2 }, sheet: 'werewolf_red', height: 54, nature: 'beast' }),
  silver_werewolf: foe('silver_werewolf', { name: 'Silver Werewolf', hp: 130, damage: [11, 17], accuracy: 0.78, dodge: 0.2, interval: 1.0, ranged: false, loot: { hide: 3, bone: 2 }, sheet: 'werewolf_white', height: 58, nature: 'beast' }),
  gorgon: foe('gorgon', { name: 'Gorgon', hp: 75, damage: [8, 13], accuracy: 0.72, dodge: 0.14, interval: 1.3, ranged: false, loot: { leather: 1, herbs: 2 }, sheet: 'gorgon_1', height: 56, nature: 'beast' }),
  gorgon_matriarch: foe('gorgon_matriarch', { name: 'Gorgon Matriarch', hp: 95, damage: [10, 15], accuracy: 0.76, dodge: 0.14, interval: 1.5, ranged: true, loot: { leather: 2, stone: 3 }, sheet: 'gorgon_2', height: 58, nature: 'beast' }),
  minotaur: foe('minotaur', { name: 'Minotaur', hp: 160, damage: [12, 19], accuracy: 0.66, dodge: 0.05, interval: 1.7, ranged: false, loot: { hide: 3, meat: 3, bone: 2 }, sheet: 'minotaur_1', height: 60, nature: 'beast', armor: 0.1 }),
  minotaur_brute: foe('minotaur_brute', { name: 'Minotaur Brute', hp: 200, damage: [14, 22], accuracy: 0.62, dodge: 0.03, interval: 1.9, ranged: false, loot: { hide: 4, meat: 4, bone: 3 }, sheet: 'minotaur_2', height: 62, nature: 'beast', armor: 0.12 }),
  ronin: foe('ronin', { name: 'Ronin', hp: 80, damage: [9, 14], accuracy: 0.78, dodge: 0.18, interval: 1.1, ranged: false, loot: { iron: 1, cloth: 1 }, sheet: 'samurai', height: PERSON + 2, armor: 0.1 }),
  ronin_archer: foe('ronin_archer', { name: 'Ronin Archer', hp: 58, damage: [7, 12], accuracy: 0.78, dodge: 0.14, interval: 1.4, ranged: true, loot: { arrows: 5, cloth: 1 }, sheet: 'samurai_archer', height: 56 }),
  kunoichi: foe('kunoichi', { name: 'Kunoichi', hp: 62, damage: [8, 12], accuracy: 0.8, dodge: 0.32, interval: 0.9, ranged: false, loot: { cloth: 2 }, sheet: 'kunoichi', height: PERSON }),
  shadow_monk: foe('shadow_monk', { name: 'Shadow Monk', hp: 72, damage: [8, 13], accuracy: 0.78, dodge: 0.26, interval: 1.0, ranged: false, loot: { cloth: 1, herbs: 2 }, sheet: 'ninja_monk', height: PERSON }),
  dart_ninja: foe('dart_ninja', { name: 'Dart Ninja', hp: 48, damage: [6, 10], accuracy: 0.8, dodge: 0.28, interval: 1.1, ranged: true, loot: { cloth: 1 }, sheet: 'ninja_peasant', height: PERSON }),
  fire_wizard: foe('fire_wizard', { name: 'Fire Wizard', hp: 56, damage: [11, 17], accuracy: 0.74, dodge: 0.1, interval: 1.7, ranged: true, loot: { herbs: 2, cloth: 1 }, sheet: 'fire_wizard', height: PERSON + 2 }),
  storm_mage: foe('storm_mage', { name: 'Storm Mage', hp: 54, damage: [10, 18], accuracy: 0.76, dodge: 0.12, interval: 1.7, ranged: true, loot: { glass: 1, cloth: 1 }, sheet: 'lightning_mage', height: PERSON }),
  wandering_magus: foe('wandering_magus', { name: 'Wandering Magus', hp: 62, damage: [9, 15], accuracy: 0.8, dodge: 0.16, interval: 1.5, ranged: true, loot: { herbs: 2, bread: 1 }, sheet: 'wanderer_mage', height: PERSON + 2 }),
  karasu_tengu: foe('karasu_tengu', { name: 'Karasu Tengu', hp: 95, damage: [10, 15], accuracy: 0.78, dodge: 0.26, interval: 1.1, ranged: false, loot: { cloth: 1, leather: 1 }, sheet: 'karasu_tengu', height: 56 }),
  yamabushi_tengu: foe('yamabushi_tengu', { name: 'Yamabushi Tengu', hp: 120, damage: [12, 18], accuracy: 0.76, dodge: 0.2, interval: 1.2, ranged: false, loot: { cloth: 2, iron: 1 }, sheet: 'yamabushi_tengu', height: 60 }),
  fallen_knight: foe('fallen_knight', { name: 'Fallen Knight', hp: 100, damage: [9, 14], accuracy: 0.74, dodge: 0.1, interval: 1.3, ranged: false, loot: { iron: 2, leather: 1 }, sheet: 'knight_1', height: PERSON + 4, armor: 0.22 }),
  crimson_knight: foe('crimson_knight', { name: 'Crimson Knight', hp: 115, damage: [10, 16], accuracy: 0.76, dodge: 0.1, interval: 1.3, ranged: false, loot: { iron: 2, cloth: 1 }, sheet: 'knight_2', height: PERSON + 4, armor: 0.24 }),
  knight_captain: foe('knight_captain', { name: 'Knight-Captain', hp: 140, damage: [12, 18], accuracy: 0.8, dodge: 0.12, interval: 1.2, ranged: false, loot: { iron: 3, leather: 2 }, sheet: 'knight_3', height: PERSON + 6, armor: 0.26 }),
  skeleton_warrior: foe('skeleton_warrior', { name: 'Skeleton Warrior', hp: 55, damage: [6, 10], accuracy: 0.7, dodge: 0.1, interval: 1.2, ranged: false, loot: { bone: 2 }, sheet: 'skeleton_warrior', height: PERSON }),
  skeleton_spearman: foe('skeleton_spearman', { name: 'Skeleton Spearman', hp: 60, damage: [7, 11], accuracy: 0.72, dodge: 0.08, interval: 1.3, ranged: false, loot: { bone: 2, iron: 1 }, sheet: 'skeleton_spearman', height: PERSON + 4 }),
  skeleton_archer: foe('skeleton_archer', { name: 'Skeleton Archer', hp: 42, damage: [5, 9], accuracy: 0.72, dodge: 0.1, interval: 1.4, ranged: true, loot: { bone: 1, arrows: 3 }, sheet: 'skeleton_archer', height: PERSON }),
  steppe_lancer: foe('steppe_lancer', { name: 'Steppe Lancer', hp: 85, damage: [10, 15], accuracy: 0.74, dodge: 0.14, interval: 1.2, ranged: false, loot: { leather: 2, meat: 1 }, sheet: 'horde_2', height: 58 }),
  rock_shaman: foe('rock_shaman', { name: 'Rock Shaman', hp: 50, damage: [9, 14], accuracy: 0.72, dodge: 0.06, interval: 1.6, ranged: true, loot: { stone: 4, herbs: 1 }, sheet: 'horde_3', height: 44 }),
  squidbeard: foe('squidbeard', { name: 'Squidbeard', hp: 260, damage: [12, 18], accuracy: 0.74, dodge: 0.1, interval: 1.4, ranged: false, boss: true, loot: { leather: 4, cloth: 4 }, sheet: 'squidman', height: 74, nature: 'beast' }),
  // Modern and the space age: the Iron Legion
  infantry_bot: foe('infantry_bot', { name: 'Infantry Bot', hp: 130, damage: [13, 19], accuracy: 0.78, dodge: 0.08, interval: 1.4, ranged: true, loot: { electronics: 1, steel: 1 }, sheet: 'robot_infantry', height: 52, nature: 'machine', armor: 0.2 }),
  blade_bot: foe('blade_bot', { name: 'Blade Bot', hp: 150, damage: [15, 22], accuracy: 0.8, dodge: 0.14, interval: 1.1, ranged: false, loot: { alloys: 1, electronics: 1 }, sheet: 'robot_swordsman', height: 52, nature: 'machine', armor: 0.2 }),

  // ---- bosses: each rules a lair (BESTIARY_LAIRS), drops its trophy, and some lead a raid now and then
  boar_king: foe('boar_king', {
    name: 'The Boar King', hp: 260, damage: [12, 19], accuracy: 0.7, dodge: 0.06, interval: 1.6, ranged: false, boss: true, loot: { hide: 6, meat: 6, bone: 3 }, sheet: 'boar_king', height: 76, nature: 'beast',
    kit: { roar: 'The Boar King squeals a challenge, and the whole wallow charges!', enrage: 'Bleeding, the Boar King lowers his tusks and charges blind!', summon: { kind: 'boar', count: 3, text: 'The Boar King calls his sounder: boars burst from the brush!' }, trophy: 'boar_king_tusk' },
  }),
  shaman_king: foe('shaman_king', {
    name: 'The Shaman King', hp: 230, damage: [11, 18], accuracy: 0.76, dodge: 0.1, interval: 1.5, ranged: true, boss: true, loot: { herbs: 6, bone: 4, totem: 1 }, sheet: 'shaman_king', height: 76,
    kit: { roar: 'The Shaman King shakes his rattle: the spirits howl through the totems.', enrage: 'The Shaman King tears off his mask and screams to the old gods!', area: { every: 3, targets: 3, name: 'calls down spirit fire', fx: 'fire' }, trophy: 'shaman_mask' },
  }),
  thornmaw: foe('thornmaw', {
    name: 'Thornmaw', hp: 280, damage: [13, 20], accuracy: 0.72, dodge: 0.04, interval: 1.6, ranged: false, boss: true, loot: { wood: 8, herbs: 4, fiber: 4 }, sheet: 'forest_boss_1', height: 60, nature: 'beast',
    kit: { roar: 'Thornmaw opens its petal-jaws and the Thornwood falls silent.', enrage: 'Thornmaw thrashes, flinging thorns in every direction!', area: { every: 3, targets: 3, name: 'lashes out with thorned vines', fx: 'acid' }, summon: { kind: 'satyr', count: 2, text: 'Satyrs dance out of the trees to defend their master!' }, trophy: 'thornmaw_seed' },
  }),
  gilded_idol: foe('gilded_idol', {
    name: 'The Gilded Idol', hp: 300, damage: [12, 18], accuracy: 0.74, dodge: 0.02, interval: 1.7, ranged: false, boss: true, loot: { stone: 8, rare_minerals: 1 }, sheet: 'forest_boss_3', height: 54, armor: 0.3,
    kit: { roar: 'The Gilded Idol stirs on its plinth, and its eyes begin to glow.', enrage: 'Cracks of light split the Gilded Idol: it grinds forward in fury!', area: { every: 4, targets: 3, name: 'stamps the earth', fx: 'quake' }, summon: { kind: 'mossback', count: 1, text: 'The Idol wakes a Mossback Brute from the forest floor!' }, trophy: 'gilded_heart' },
  }),
  minotaur_lord: foe('minotaur_lord', {
    name: 'Asterion, the Minotaur Lord', hp: 460, damage: [16, 25], accuracy: 0.72, dodge: 0.06, interval: 1.6, ranged: false, boss: true, loot: { hide: 6, iron: 4, bone: 4 }, sheet: 'minotaur_3', height: 72, nature: 'beast', armor: 0.15,
    kit: { roar: 'A bellow shakes the Labyrinth: Asterion has caught your scent.', enrage: 'Asterion snorts, paws the ground, and charges through the walls!', area: { every: 3, targets: 3, name: 'sweeps his great axe', fx: 'quake' }, summon: { kind: 'minotaur', count: 2, text: 'More horned shapes come thundering out of the maze!' }, trophy: 'asterions_labrys' },
  }),
  gorgon_queen: foe('gorgon_queen', {
    name: 'Euryale, the Gorgon Queen', hp: 380, damage: [14, 21], accuracy: 0.78, dodge: 0.16, interval: 1.4, ranged: true, boss: true, loot: { leather: 4, stone: 6, rare_minerals: 1 }, sheet: 'gorgon_3', height: 66, nature: 'beast',
    kit: { roar: 'Euryale uncoils, and her serpent hair hisses as one.', enrage: 'Euryale lifts her veil: her gaze turns the very air to stone!', area: { every: 3, targets: 3, name: 'turns her stony gaze on them', fx: 'frost' }, summon: { kind: 'gorgon', count: 2, text: 'Her sisters slither out of the ruins!' }, trophy: 'gorgon_aegis' },
  }),
  ronin_warlord: foe('ronin_warlord', {
    name: 'Kagemaru, the Ronin Warlord', hp: 420, damage: [15, 23], accuracy: 0.82, dodge: 0.18, interval: 1.2, ranged: false, boss: true, loot: { iron: 6, cloth: 4 }, sheet: 'samurai_commander', height: 62, armor: 0.2,
    kit: { roar: 'Kagemaru plants his banner. "Masterless, but not without honour. Draw!"', enrage: 'Kagemaru casts his banner aside and draws his second blade!', area: { every: 3, targets: 2, name: 'cuts in a single flashing arc', fx: 'beam' }, summon: { kind: 'ronin', count: 2, text: 'His sworn ronin step out of the mist!' }, trophy: 'kagemarus_katana' },
  }),
  kitsune: foe('kitsune', {
    name: 'Tamamo, the Nine-Tailed Fox', hp: 360, damage: [13, 20], accuracy: 0.82, dodge: 0.3, interval: 1.2, ranged: true, boss: true, loot: { cloth: 4, herbs: 4, glass: 2 }, sheet: 'kitsune', height: 62, nature: 'beast',
    kit: { roar: 'Nine tails fan out behind the shrine maiden: Tamamo smiles.', enrage: 'Tamamo drops her disguise: foxfire blazes from all nine tails!', area: { every: 3, targets: 3, name: 'scatters foxfire', fx: 'fire' }, summon: { kind: 'karasu_tengu', count: 2, text: 'Crow-tengu drop from the cedars at her call!' }, trophy: 'kitsune_tail' },
  }),
  devil_lord: foe('devil_lord', {
    name: 'Azgoroth, the Devil Lord', hp: 520, damage: [18, 27], accuracy: 0.78, dodge: 0.1, interval: 1.4, ranged: false, boss: true, loot: { coal: 8, steel: 4, rare_minerals: 2 }, sheet: 'devil_leader', height: 78,
    kit: { roar: 'Azgoroth steps through the gate in a gust of sulphur. "Mortals. How quaint."', enrage: 'Azgoroth roars, and the ground around him splits with fire!', area: { every: 3, targets: 3, name: 'breathes hellfire', burns: true, fx: 'fire' }, summon: { kind: 'fire_wizard', count: 2, text: 'His cultists rise from the brimstone!' }, trophy: 'azgoroths_horn' },
  }),
  drowned_captain: foe('drowned_captain', {
    name: 'The Drowned Captain', hp: 340, damage: [14, 21], accuracy: 0.74, dodge: 0.08, interval: 1.4, ranged: false, boss: true, loot: { cloth: 4, iron: 3, leather: 3 }, sheet: 'pirate_zombie', height: 74, nature: 'undead',
    kit: { roar: 'Seawater pours from the Drowned Captain\'s coat. "Ye\'ll crew me ship forever!"', enrage: 'The Drowned Captain bellows, and the bilge rises around his boots!', area: { every: 3, targets: 2, name: 'swings his anchor-chain', fx: 'quake' }, summon: { kind: 'skeleton_warrior', count: 2, text: 'His drowned crew climb out of the hold!' }, trophy: 'drowned_compass' },
  }),
  blackwake: foe('blackwake', {
    name: 'Captain Blackwake', hp: 360, damage: [15, 22], accuracy: 0.8, dodge: 0.16, interval: 1.2, ranged: true, boss: true, loot: { iron: 4, cloth: 4, shot: 10 }, sheet: 'pirate_leader', height: 74,
    kit: { roar: 'Captain Blackwake cocks both pistols. "Your gold, or your lives. I\'ll take both."', enrage: 'Blackwake fires off a broadside of pistols in every direction!', area: { every: 3, targets: 3, name: 'fires a volley', fx: 'shell' }, summon: { kind: 'squidbeard', count: 1, text: 'Squidbeard, his first mate, heaves over the rail!' }, trophy: 'blackwakes_hat' },
  }),
  the_destroyer: foe('the_destroyer', {
    name: 'The Destroyer', hp: 600, damage: [20, 30], accuracy: 0.8, dodge: 0.06, interval: 1.5, ranged: true, boss: true, loot: { alloys: 4, electronics: 4, steel: 6 }, sheet: 'robot_destroyer', height: 64, nature: 'machine', armor: 0.3,
    kit: { roar: 'The Destroyer powers up. "THREAT ASSESSMENT: TOTAL."', enrage: 'Warning lights flare across the Destroyer\'s chassis: overdrive engaged!', area: { every: 3, targets: 3, name: 'fires its arm cannon', burns: true, fx: 'beam' }, summon: { kind: 'infantry_bot', count: 2, text: 'Infantry bots march out of the citadel!' }, trophy: 'destroyer_core' },
  }),
};

/** Raids by the new foes (picked at random like the rest, by era, day and land). */
export const BESTIARY_RAIDS: readonly RaidKind[] = [
  // out of the sea, only against a shore town: they swim ashore to the town's strand
  { id: 'tide_beasts', name: 'Things from the deep', goal: 'harm', goals: { harm: 3, steal: 1 }, steals: 'food', enemies: { squid_spawn: 13, crocodile: 12 }, fromDay: 1, weight: 2, speed: 55, bribable: false, plural: true, fromSea: true },
  { id: 'sea_reavers', name: 'Sea reavers', goal: 'steal', goals: { steal: 3, kidnap: 1, harm: 1 }, steals: 'valuables', enemies: { sea_reaver: 14, squid_spawn: 13 }, fromDay: 2, weight: 2, speed: 60, bribable: true, plural: true, fromSea: true },
  // (the Kraken itself comes ashore at a shore town, its spawn about it: the Kraken Deep's lord, data/boats.ts)
  { id: 'leviathan', name: 'The Leviathan', goal: 'harm', enemies: { squid_spawn: 13 }, fromDay: 6, era: 'medieval', weight: 0.6, speed: 36, bribable: false, plural: false, fromSea: true, leader: 'kraken' },
  { id: 'drowned_crew', name: 'The drowned crew', goal: 'harm', goals: { harm: 3, kidnap: 1 }, enemies: { drowned_sailor: 12, sea_reaver: 14 }, fromDay: 3, era: 'medieval', weight: 1.5, speed: 45, bribable: false, plural: false, fromSea: true },
  { id: 'gremlins', name: 'Gremlins', goal: 'steal', goals: { steal: 4, harm: 1 }, steals: 'food', enemies: { pink_gremlin: 4, owlet_gremlin: 4, blue_gremlin: 5 }, fromDay: 2, untilEra: 'medieval', weight: 1.5, speed: 85, bribable: false, plural: true },
  { id: 'giant_rats', name: 'Giant rats', goal: 'steal', goals: { steal: 3, harm: 2 }, steals: 'food', enemies: { giant_rat: 5 }, fromDay: 1, untilEra: 'industrial', weight: 1, speed: 70, bribable: false, plural: true },
  { id: 'satyrs', name: 'Satyr revel', goal: 'kidnap', goals: { kidnap: 2, steal: 2, harm: 1 }, steals: 'food', enemies: { satyr: 12, satyr_reveller: 13, satyr_shaman: 16 }, fromDay: 4, untilEra: 'medieval', weight: 1.5, speed: 60, bribable: true, plural: false, biomes: ['forest', 'coast'] },
  { id: 'moon_werewolves', name: 'Werewolves', goal: 'harm', goals: { harm: 4, kidnap: 1 }, enemies: { black_werewolf: 18, blood_werewolf: 20, silver_werewolf: 26 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 1.5, speed: 80, bribable: false, plural: true },
  { id: 'gorgons', name: 'Gorgon sisters', goal: 'harm', goals: { harm: 3, kidnap: 1 }, enemies: { gorgon: 16, gorgon_matriarch: 21 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 1, speed: 40, bribable: false, plural: true },
  { id: 'minotaurs', name: 'Minotaur stampede', goal: 'harm', goals: { harm: 3, burn: 1 }, enemies: { minotaur: 24, minotaur_brute: 30 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 1, speed: 55, bribable: false, plural: false },
  { id: 'ronin', name: 'Ronin band', goal: 'steal', goals: { steal: 3, harm: 2 }, steals: 'valuables', enemies: { ronin: 16, ronin_archer: 13 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 1.5, speed: 55, bribable: true, plural: false },
  { id: 'shinobi', name: 'Shinobi clan', goal: 'kidnap', goals: { kidnap: 2, steal: 3, burn: 1 }, steals: 'valuables', enemies: { kunoichi: 14, shadow_monk: 15, dart_ninja: 11 }, fromDay: 0, era: 'medieval', untilEra: 'modern', weight: 1.5, speed: 75, bribable: true, plural: false },
  { id: 'mage_cabal', name: 'Rogue mages', goal: 'harm', goals: { harm: 3, burn: 2 }, enemies: { fire_wizard: 18, storm_mage: 18, wandering_magus: 16 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 1, speed: 45, bribable: true, plural: true },
  { id: 'yokai', name: 'Night parade of yokai', goal: 'kidnap', goals: { kidnap: 2, harm: 2, steal: 1 }, steals: 'food', enemies: { karasu_tengu: 19, yamabushi_tengu: 24 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 1, speed: 65, bribable: false, plural: false },
  { id: 'fallen_order', name: 'The Fallen Order', goal: 'harm', goals: { harm: 3, burn: 1, steal: 1 }, steals: 'valuables', enemies: { fallen_knight: 20, crimson_knight: 22, knight_captain: 28 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 1.5, speed: 45, bribable: true, plural: false },
  { id: 'restless_dead', name: 'The restless dead', goal: 'harm', goals: { harm: 4, kidnap: 1 }, enemies: { skeleton_warrior: 10, skeleton_spearman: 12, skeleton_archer: 10 }, fromDay: 0, era: 'medieval', untilEra: 'modern', weight: 2, speed: 35, bribable: false, plural: false },
  { id: 'steppe_riders', name: 'Steppe riders', goal: 'steal', goals: { steal: 4, burn: 1, kidnap: 1 }, steals: 'valuables', enemies: { steppe_lancer: 16, rock_shaman: 13 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 1.5, speed: 85, bribable: true, plural: true, biomes: ['desert', 'tundra', 'forest'] },
  { id: 'iron_legion', name: 'The Iron Legion', goal: 'harm', goals: { harm: 3, burn: 2 }, enemies: { infantry_bot: 22, blade_bot: 24 }, fromDay: 0, era: 'modern', weight: 2.5, speed: 50, bribable: false, plural: false },
];

/** The new bosses' trophies: relics, one of each, found only on the boss's body. */
const relic = (id: string, name: string, slot: ItemDef['slot'], effects: ItemDef['effects'], description: string, icon: ItemDef['icon'], extra: Partial<ItemDef> = {}): ItemDef => ({
  id, name, slot, station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects, description, icon, ...extra,
});
export const BESTIARY_TROPHIES: readonly ItemDef[] = [
  relic('boar_king_tusk', "The Boar King's Tusk", 'charm', { damage: 5, beastDamage: 6, morale: 3 }, 'A tusk as long as a forearm. +5 damage, and beasts think twice.', { sheet: 'Flesh', x: 2, y: 2 }),
  relic('shaman_mask', "The Shaman King's Mask", 'head', { armor: 0.15, morale: 6, power: 0.2 }, 'Painted bark and bone. Spells come stronger to whoever wears it.', { sheet: 'Hat', x: 2, y: 1 }),
  relic('thornmaw_seed', "Thornmaw's Seed", 'charm', { armor: 0.1, morale: 4, gather: { forage: 1.3 } }, 'It hums faintly. Foragers find twice the berries near it.', { sheet: 'Magic', x: 0, y: 1 }),
  relic('gilded_heart', 'The Gilded Heart', 'charm', { armor: 0.2, morale: 6 }, 'A heart of beaten gold, still warm. Takes a fifth off every blow.', { sheet: 'Amulet', x: 2, y: 1 }),
  relic('asterions_labrys', "Asterion's Labrys", 'weapon', { damage: 18, accuracy: 0.05, cleave: 0.5 }, 'The Minotaur Lord\'s double axe. +18 damage, and it cleaves into whoever stands beside the target.', { sheet: 'LongWep', x: 3, y: 0 }, { family: 'ax', tier: 10 }),
  relic('gorgon_aegis', 'The Gorgon Aegis', 'offhand', { armor: 0.25, stun: 0.15 }, 'A shield with a stony face. Takes a quarter off every hit, and foes who look at it freeze.', { sheet: 'Shield', x: 7, y: 0 }, { weight: 'shield' }),
  relic('kagemarus_katana', "Kagemaru's Katana", 'weapon', { damage: 17, accuracy: 0.15, crit: 0.15 }, 'Folded a thousand times. +17 damage, it rarely misses, and it often strikes true.', { sheet: 'LongWep', x: 3, y: 0 }, { family: 'sw', tier: 10 }),
  relic('kitsune_tail', "Tamamo's Ninth Tail", 'charm', { dodge: 0.12, morale: 6, power: 0.25 }, 'Soft as smoke. Its bearer is hard to hit, and their spells burn hotter.', { sheet: 'Magic', x: 7, y: 1 }),
  relic('azgoroths_horn', "Azgoroth's Horn", 'charm', { damage: 10, morale: -3 }, 'Still smouldering. +10 damage, but nobody likes sleeping near it.', { sheet: 'Flesh', x: 1, y: 0 }),
  relic('drowned_compass', 'The Drowned Compass', 'charm', { accuracy: 0.1, morale: 4, undeadDamage: 8 }, 'It points to the nearest grave. Its bearer strikes the dead true.', { sheet: 'Amulet', x: 2, y: 1 }),
  relic('blackwakes_hat', "Captain Blackwake's Hat", 'head', { armor: 0.15, accuracy: 0.12, morale: 8 }, 'A tricorn with a skull on it. Whoever wears it shoots straighter and swaggers more.', { sheet: 'Hat', x: 3, y: 1 }),
  relic('destroyer_core', 'The Destroyer Core', 'charm', { damage: 9, armor: 0.12, machineDamage: 10 }, 'A war machine\'s heart, humming. +9 damage, and machines fall faster to its bearer.', { sheet: 'Custom', x: 0, y: 0, name: 'core' }),
];

/** The new bosses' lairs: legendary expeditions (a boss and its guard; a relic more often than not). */
const lair = (d: Omit<Destination, 'type' | 'ambush' | 'recommendedParty' | 'encounters' | 'scenery'> & { guard: Record<string, number> }): Destination => {
  const { guard, ...rest } = d;
  return { ...rest, type: 'legendary', recommendedParty: 3, scenery: 'cave', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: guard, weight: 1 }] } };
};
export const BESTIARY_LAIRS: readonly Destination[] = [
  lair({ id: 'boar_wallow', name: "The Boar King's Wallow", outSeconds: 260, workSeconds: 160, secondsPerUnit: 6, loot: { hide: 4, meat: 6, bone: 2 }, guaranteed: { hide: 6, meat: 8 }, threats: 'The Boar King (boss) and his sounder', guard: { boar_king: 1, boar: 2 }, research: 'spear_hunting', description: 'A stinking mud-hollow where a boar the size of a hut rules the woods.' }),
  lair({ id: 'shaman_totems', name: 'The Totem Ring', outSeconds: 300, workSeconds: 180, secondsPerUnit: 6, loot: { herbs: 6, bone: 4, stone: 4 }, guaranteed: { herbs: 8 }, threats: 'The Shaman King (boss) and his gremlins', guard: { shaman_king: 1, pink_gremlin: 2, blue_gremlin: 1 }, research: 'storytelling', description: 'Carved poles on a windy hill. The Shaman King speaks with spirits there, and they answer.' }),
  lair({ id: 'thornwood', name: 'The Thornwood', outSeconds: 320, workSeconds: 180, secondsPerUnit: 6, loot: { wood: 8, herbs: 4, fiber: 4, berries: 4 }, guaranteed: { wood: 12 }, threats: 'Thornmaw (boss) and the satyrs', guard: { thornmaw: 1, satyr: 1, satyr_shaman: 1 }, research: 'trail_marking', description: 'The trees here have teeth. At the heart of the wood, something enormous blooms.' }),
  lair({ id: 'idol_grove', name: 'The Gilded Grove', outSeconds: 340, workSeconds: 180, secondsPerUnit: 7, loot: { stone: 6, clay: 4, rare_minerals: 1 }, guaranteed: { stone: 10 }, threats: 'The Gilded Idol (boss) and a Mossback Brute', guard: { gilded_idol: 1, mossback: 1 }, research: 'sling_stones', description: 'A golden statue stands in a ring of moss. The moss moves.' }),
  lair({ id: 'labyrinth', name: 'The Labyrinth', outSeconds: 380, workSeconds: 200, secondsPerUnit: 8, loot: { iron: 4, stone: 6, bread: 3 }, guaranteed: { iron: 8 }, threats: 'Asterion, the Minotaur Lord (boss)', guard: { minotaur_lord: 1, minotaur: 1 }, research: 'fortification', era: 'medieval', description: 'Walls without end, and somewhere inside, the bellowing of a bull.' }),
  lair({ id: 'gorgon_isle', name: "Gorgon's Isle", outSeconds: 400, workSeconds: 200, secondsPerUnit: 8, loot: { stone: 8, leather: 3, glass: 2 }, guaranteed: { stone: 12, leather: 4 }, threats: 'Euryale, the Gorgon Queen (boss), and her sisters', guard: { gorgon_queen: 1, gorgon: 2 }, research: 'cartography', era: 'medieval', description: 'An island of statues. Every one of them was a hero once.' }),
  lair({ id: 'ronin_pass', name: 'Ronin Pass', outSeconds: 360, workSeconds: 200, secondsPerUnit: 8, loot: { iron: 5, cloth: 4, arrows: 10 }, guaranteed: { iron: 8 }, threats: 'Kagemaru, the Ronin Warlord (boss), and his band', guard: { ronin_warlord: 1, ronin: 1, ronin_archer: 1 }, research: 'armoring', era: 'medieval', description: 'A mountain pass held by masterless swordsmen. Their warlord takes a toll in blood.' }),
  lair({ id: 'fox_shrine', name: 'The Fox Shrine', outSeconds: 380, workSeconds: 200, secondsPerUnit: 8, loot: { cloth: 4, herbs: 6, glass: 2 }, guaranteed: { cloth: 6, herbs: 6 }, threats: 'Tamamo, the Nine-Tailed Fox (boss), and the tengu', guard: { kitsune: 1, yamabushi_tengu: 1 }, research: 'writing', era: 'medieval', description: 'Red gates climb a misty hill to a shrine where a fox-woman keeps court.' }),
  lair({ id: 'sunken_galleon', name: 'The Sunken Galleon', outSeconds: 400, workSeconds: 220, secondsPerUnit: 8, loot: { cloth: 4, iron: 4, leather: 3 }, guaranteed: { cloth: 8, iron: 6 }, threats: 'The Drowned Captain (boss) and his crew', guard: { drowned_captain: 1, skeleton_warrior: 1, skeleton_archer: 1 }, research: 'cartography', era: 'medieval', description: 'A wreck on the reef at low tide. Its captain never left.' }),
  lair({ id: 'smugglers_cove', name: "Smugglers' Cove", outSeconds: 360, workSeconds: 200, secondsPerUnit: 7, loot: { cloth: 4, steel: 2, shot: 20 }, guaranteed: { steel: 6, shot: 30 }, threats: 'Captain Blackwake (boss) and Squidbeard', guard: { blackwake: 1, squidbeard: 1 }, research: 'firearms', era: 'industrial', description: 'Lanterns in a sea cave, and a ship that flies no flag.' }),
  lair({ id: 'devils_gate', name: "The Devil's Gate", outSeconds: 400, workSeconds: 200, secondsPerUnit: 8, loot: { coal: 8, steel: 4, rare_minerals: 2 }, guaranteed: { coal: 12, steel: 6 }, threats: 'Azgoroth, the Devil Lord (boss), and his cultists', guard: { devil_lord: 1, fire_wizard: 2 }, research: 'drill_manuals', era: 'industrial', description: 'The miners dug too deep. Something came up the shaft.' }),
  lair({ id: 'iron_citadel', name: 'The Iron Citadel', outSeconds: 360, workSeconds: 200, secondsPerUnit: 7, loot: { alloys: 3, electronics: 4, steel: 6 }, guaranteed: { electronics: 8, steel: 8 }, threats: 'The Destroyer (boss) and the Iron Legion', guard: { the_destroyer: 1, infantry_bot: 1, blade_bot: 1 }, research: 'field_tactics', era: 'modern', description: 'A fortress that builds itself, ruled by a machine made for war.' }),
];

/** Where the lairs are on the world map (768x768). */
export const BESTIARY_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  boar_wallow: { x: 470, y: 300 },
  shaman_totems: { x: 300, y: 120 },
  thornwood: { x: 560, y: 220 },
  idol_grove: { x: 500, y: 520 },
  labyrinth: { x: 160, y: 430 },
  gorgon_isle: { x: 470, y: 720 },
  ronin_pass: { x: 250, y: 60 },
  fox_shrine: { x: 700, y: 250 },
  sunken_galleon: { x: 230, y: 710 },
  smugglers_cove: { x: 60, y: 520 },
  devils_gate: { x: 160, y: 520 },
  iron_citadel: { x: 720, y: 460 },
};

/** Each lair's scene on the road there, and inside it. */
export const BESTIARY_ROUTES: Readonly<Record<string, [SceneId, SceneId]>> = {
  boar_wallow: ['pinewoods', 'pinewoods'],
  shaman_totems: ['highlands', 'ruins'],
  thornwood: ['meadow', 'pinewoods'],
  idol_grove: ['meadow', 'ruins'],
  labyrinth: ['ruins', 'crypt'],
  gorgon_isle: ['coast', 'crypt'],
  ronin_pass: ['highlands', 'keep'],
  fox_shrine: ['pinewoods', 'ruins'],
  sunken_galleon: ['coast', 'ship_hold'],
  smugglers_cove: ['coast', 'cave'],
  devils_gate: ['coal_fields', 'dragon_den'],
  iron_citadel: ['ghost_city', 'vault'],
};
