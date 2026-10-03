// Enemies by era (DESIGN §15 and on). Numbers are starting points for tuning.

import { DUNGEON_BOSSES } from './dungeonBosses';
import { PACK_BOSSES } from './pack';
import type { Stock } from './materials';
import { BESTIARY_ENEMIES } from './bestiary';
import type { PackSheetId } from './packSheets';

/** How a human enemy is drawn: which outfit, and what they hold (an LPC weapon layer, or none). */
export interface HumanSprite {
  people: 'rival' | 'bandit' | 'soldier' | 'zombie' | 'frost' | 'archmage';
  weapon: 'spear' | 'mace' | 'dagger' | 'bow' | 'sword' | null;
}

/** Creature sheets (see renderer/art/creatures.ts). */
export type CreatureSheetId = 'wolf' | 'boar' | 'bear' | 'horse' | 'wyvern' | 'drakes' | 'golems' | 'skeleghouls' | 'zombieanimals' | 'wolfman' | 'horror' | 'dark_knight' | 'golems2' | 'snowmonkey' | 'ghosts' | 'mouse' | 'champ_necromancer' | 'champ_summoner' | 'champ_beast_tamer' | 'champ_blood_knight' | 'blood_monster' | 'demon' | 'goblin' | 'slime' | 'champ_sage' | 'champ_mercenary' | 'champ_dragoon' | 'lions' | 'wilddogs' | 'crocodiles' | 'behemoth' | 'tomes' | 'bats' | 'camel' | 'shrooms' | 'mimic' | PackSheetId;

/** A single still image (see renderer/art/stills.ts); hover ones bob in the air. */
export interface StillSprite {
  still: 'observer' | 'steel_eagle' | 'drone' | 'sentinel' | 'ogre' | 'mummy' | 'wizard' | 'slime' | 'metal_slug' | ElementalStill;
  scale: number;
  hover?: boolean;
}

/** Golems and elementals (batareya): the rival origins' big troops. */
export type ElementalStill = 'elem_treant' | 'elem_stone_golem' | 'elem_water_elemental' | 'elem_homunculus' | 'elem_iron_sentry' | 'elem_wraith' | 'elem_crystal_fiend' | 'elem_fire_elemental';

/** A machine (Robotic & Space): drawn in code. */
export interface MachineSprite {
  machine: 'tank';
  scale: number;
}

/** How a boss's sweeping attack looks: a jet of fire, the ground breaking, a shell bursting, a beam, a spray of
 *  acid, a nova of frost. */
export type AreaFx = 'fire' | 'quake' | 'shell' | 'beam' | 'acid' | 'frost';

/** An epic boss's abilities. */

export interface BossKit {
  /** Shown when it appears (it roars: the town's morale takes a knock). */
  roar: string;
  /** Below half health it rages: harder and faster. */
  enrage: string;
  /** Every few attacks, a sweeping attack that hits several at once (and may set a building alight in town). */
  area?: { every: number; targets: number; name: string; burns?: boolean; fx: AreaFx };
  /** At half health it calls for help. */
  summon?: { kind: string; count: number; text: string };
  /** The unique item it drops (a dungeon's boss has none: it guards the hoard). */
  trophy?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  damage: [number, number];
  /** Chance to hit before the target's dodge. */
  accuracy: number;
  /** Chance to dodge an attack. */
  dodge: number;
  /** Seconds between attacks. */
  interval: number;
  ranged: boolean;
  boss?: boolean;
  /** Dropped when killed. */
  loot: Stock;
  /** Epic bosses: what they can do (see bosses.ts). */
  kit?: BossKit;
  /** How it's drawn: a block of an MV creature sheet, or an LPC person. */
  sprite: { sheet: CreatureSheetId; block: number; scale: number } | HumanSprite | MachineSprite | StillSprite;
  /** Drawn tinted (a rival origin's colours: sea-green merfolk, pale thralls). */
  tint?: number;
  /** Recoloured in the watched fights (a tint only darkens): its hue turned (degrees), greyed, or brightened. */
  look?: { hue?: number; grey?: boolean; bright?: number };
  /** What it is, when its id doesn't say (natureOf), and the share of each blow its hide or plate takes away. */
  nature?: Nature;
  armor?: number;
}

/** What a foe is, for the weapons made against such things (data/weapons.ts: banes). */
export type Nature = 'beast' | 'undead' | 'machine' | 'person';
const UNDEAD = /zombie|skelet|ghost|wraith|mummy|lich|grave|bone|ghoul|vampire|revenant|abomination|thrall|spectre|banshee/;
const MACHINE = /drone|bot\b|_bot|mech|sentry|machine|tank|rogue_ai|turret|overmind|eagle|sentinel|automaton/;
const ARMOURED = /knight|baron|soldier|golem|sentry|guard|warlord|mech|tank|war_bot/;
export function natureOf(kind: string): Nature {
  const d = ENEMIES[kind];
  if (d?.nature) return d.nature;
  if (UNDEAD.test(kind)) return 'undead';
  if (MACHINE.test(kind) || (d && 'machine' in d.sprite)) return 'machine';
  return d && 'sheet' in d.sprite ? 'beast' : 'person';
}
/** The share of a blow a foe's hide or plate takes away (weapons that pierce get past some of it). */
export const enemyArmor = (kind: string) => ENEMIES[kind]?.armor ?? (ARMOURED.test(kind) ? 0.2 : natureOf(kind) === 'machine' ? 0.25 : 0);

export const ENEMIES: Readonly<Record<string, EnemyDef>> = {
  // (the Craftpix packs' foes and bosses: data/bestiary.ts)
  ...BESTIARY_ENEMIES,
  // (the dungeons' bosses: data/dungeonBosses.ts)
  ...DUNGEON_BOSSES,
  ...PACK_BOSSES,
  wolf: { id: 'wolf', name: 'Wolf', hp: 28, damage: [3, 6], accuracy: 0.7, dodge: 0.12, interval: 1.1, ranged: false, loot: { hide: 1, meat: 1, bone: 1 }, sprite: { sheet: 'wolf', block: 1, scale: 1 } },
  wolf_alpha: { id: 'wolf_alpha', name: 'Wolf Pack Alpha', hp: 55, damage: [5, 9], accuracy: 0.75, dodge: 0.15, interval: 1.0, ranged: false, loot: { hide: 2, meat: 2, bone: 1 }, sprite: { sheet: 'wolf', block: 2, scale: 1.2 } },
  boar: { id: 'boar', name: 'Boar', hp: 45, damage: [5, 10], accuracy: 0.6, dodge: 0.08, interval: 1.5, ranged: false, loot: { meat: 3, hide: 1, bone: 1 }, sprite: { sheet: 'boar', block: 0, scale: 1 } },
  cave_bear: { id: 'cave_bear', name: 'Cave Bear', hp: 240, damage: [12, 20], accuracy: 0.7, dodge: 0.05, interval: 1.8, ranged: false, boss: true, loot: { hide: 4, meat: 4, bone: 3 }, sprite: { sheet: 'bear', block: 5, scale: 1.8 }, kit: { roar: 'The Cave Bear rears up and roars: the whole cave shakes!', enrage: 'Bleeding and cornered, the Cave Bear goes berserk!', area: { every: 3, targets: 2, name: 'slams the ground', fx: 'quake' }, trophy: 'bearskin_cloak' } },
  rival_spear: { id: 'rival_spear', name: 'Rival Tribesman', hp: 40, damage: [4, 8], accuracy: 0.65, dodge: 0.12, interval: 1.2, ranged: false, loot: { flint: 1 }, sprite: { people: 'rival', weapon: 'spear' } },
  rival_slinger: { id: 'rival_slinger', name: 'Rival Slinger', hp: 30, damage: [3, 6], accuracy: 0.6, dodge: 0.1, interval: 1.4, ranged: true, loot: { stone: 2 }, sprite: { people: 'rival', weapon: null } },

  // Medieval
  bandit: { id: 'bandit', name: 'Bandit', hp: 50, damage: [5, 9], accuracy: 0.68, dodge: 0.12, interval: 1.2, ranged: false, loot: { iron: 1, cloth: 1 }, sprite: { people: 'bandit', weapon: 'mace' } },
  bandit_archer: { id: 'bandit_archer', name: 'Bandit Archer', hp: 38, damage: [4, 8], accuracy: 0.66, dodge: 0.1, interval: 1.4, ranged: true, loot: { arrows: 4, leather: 1 }, sprite: { people: 'bandit', weapon: 'bow' } },
  bandit_chief: { id: 'bandit_chief', name: 'Bandit Chief', hp: 120, damage: [8, 13], accuracy: 0.72, dodge: 0.15, interval: 1.2, ranged: false, loot: { iron: 3, bread: 2, cloth: 2 }, sprite: { people: 'bandit', weapon: 'sword' } },
  guild_hunter: { id: 'guild_hunter', name: 'Guild Hunter', hp: 80, damage: [8, 12], accuracy: 0.76, dodge: 0.15, interval: 1.2, ranged: false, loot: { iron: 2, cloth: 1 }, sprite: { people: 'soldier', weapon: 'sword' } },
  // Industrial
  gangster: { id: 'gangster', name: 'Gang Member', hp: 60, damage: [7, 12], accuracy: 0.68, dodge: 0.14, interval: 1.3, ranged: true, loot: { steel: 1, cloth: 1, shot: 5 }, sprite: { people: 'bandit', weapon: null } },
  rifleman: { id: 'rifleman', name: 'Rifleman', hp: 90, damage: [10, 16], accuracy: 0.74, dodge: 0.12, interval: 1.5, ranged: true, loot: { steel: 2, shot: 8 }, sprite: { people: 'soldier', weapon: null } },
  // Epic bosses: each rules a legendary destination, and now and then leads a raid. See bosses.ts.
  black_knight: { id: 'black_knight', name: 'The Black Knight', hp: 420, damage: [14, 22], accuracy: 0.8, dodge: 0.15, interval: 1.3, ranged: false, boss: true, loot: { iron: 8, leather: 4 }, sprite: { sheet: 'dark_knight', block: 0, scale: 1.5 }, kit: { roar: 'The Black Knight lowers his visor. "Kneel, or be broken."', enrage: 'The Black Knight casts aside his shield and fights like a storm!', summon: { kind: 'soldier', count: 2, text: 'The Black Knight sounds his horn: his sworn men answer!' }, trophy: 'black_blade' } },
  dragon: { id: 'dragon', name: 'Vermithrax the Red', hp: 900, damage: [18, 28], accuracy: 0.8, dodge: 0.1, interval: 2, ranged: true, boss: true, loot: { hide: 10, bone: 12 }, sprite: { sheet: 'wyvern', block: 0, scale: 1.1 }, kit: { roar: 'A roar splits the sky. Vermithrax the Red has come!', enrage: 'Blood on its scales, the dragon rises in fury!', area: { every: 3, targets: 3, name: 'breathes fire', burns: true, fx: 'fire' }, summon: { kind: 'drake', count: 2, text: 'Hatchlings scramble out of the crags to defend their mother!' }, trophy: 'dragonscale_armor' } },
  drake: { id: 'drake', name: 'Dragon Hatchling', hp: 90, damage: [8, 14], accuracy: 0.72, dodge: 0.15, interval: 1.4, ranged: false, loot: { hide: 2, bone: 2 }, sprite: { sheet: 'drakes', block: 1, scale: 1 } },
  iron_baron: { id: 'iron_baron', name: 'The Iron Baron', hp: 480, damage: [18, 28], accuracy: 0.8, dodge: 0.1, interval: 1.4, ranged: true, boss: true, loot: { steel: 8, shot: 30 }, sprite: { people: 'soldier', weapon: null }, kit: { roar: '"Men, machines: to work!" bellows the Iron Baron.', enrage: 'The Iron Baron empties both pistols in a rage!', summon: { kind: 'rifleman', count: 2, text: 'The Iron Baron whistles up his hired guns!' }, trophy: 'barons_pistols' } },
  iron_colossus: { id: 'iron_colossus', name: 'The Iron Colossus', hp: 1100, damage: [22, 32], accuracy: 0.72, dodge: 0, interval: 2.2, ranged: false, boss: true, loot: { steel: 14, coal: 12 }, sprite: { sheet: 'golems', block: 1, scale: 2 }, kit: { roar: 'Steam shrieks from its vents: the Iron Colossus lumbers into view!', enrage: 'Its boiler glowing white, the Colossus overdrives!', area: { every: 3, targets: 2, name: 'brings its fists down', burns: false, fx: 'quake' }, trophy: 'colossus_core' } },
  warlord: { id: 'warlord', name: 'The Warlord', hp: 650, damage: [22, 32], accuracy: 0.82, dodge: 0.15, interval: 1.3, ranged: true, boss: true, loot: { electronics: 6, cartridges: 40 }, sprite: { people: 'soldier', weapon: 'sword' }, kit: { roar: 'The Warlord stands on his tank and points your way.', enrage: 'Wounded, the Warlord calls in everything he has!', summon: { kind: 'trooper', count: 2, text: 'Reinforcements drop in for the Warlord!' }, trophy: 'warlords_banner' } },
  war_machine: { id: 'war_machine', name: 'The War Machine', hp: 1400, damage: [24, 36], accuracy: 0.75, dodge: 0, interval: 2.4, ranged: true, boss: true, loot: { steel: 16, fuel: 12, electronics: 4 }, sprite: { machine: 'tank', scale: 1.15 }, kit: { roar: 'Treads grind and the ground shakes: the War Machine rolls in!', enrage: 'Smoking and sparking, the War Machine fires everything at once!', area: { every: 3, targets: 3, name: 'fires its cannon', burns: true, fx: 'shell' }, trophy: 'tank_plating' } },
  pirate_king: { id: 'pirate_king', name: 'The Pirate King', hp: 900, damage: [26, 38], accuracy: 0.85, dodge: 0.2, interval: 1.2, ranged: true, boss: true, loot: { alloys: 8, power_cells: 30 }, sprite: { people: 'bandit', weapon: 'sword' }, kit: { roar: '"Your stars are mine now," laughs the Pirate King.', enrage: 'The Pirate King draws a second blade!', summon: { kind: 'space_pirate', count: 2, text: 'The Pirate King calls down his boarding crew!' }, trophy: 'pirate_crown' } },
  star_mech: { id: 'star_mech', name: 'The Star Reaver', hp: 1800, damage: [28, 40], accuracy: 0.8, dodge: 0.05, interval: 2, ranged: true, boss: true, loot: { alloys: 14, circuits: 8, power_cells: 20 }, sprite: { still: 'sentinel', scale: 0.9 }, kit: { roar: 'A war-mech the size of a house drops from the clouds: the Star Reaver!', enrage: 'Its armour cracked, the Star Reaver\'s core burns red!', area: { every: 3, targets: 3, name: 'sweeps its beam', burns: true, fx: 'beam' }, trophy: 'reaver_core' } },  // Allies (special classes): a Summoner's spirit; a Beast Tamer's wolf; the Necromancer raises the fallen instead
  // (a Necromancer calls the town's own dead up out of the graveyard to defend it)
  grave_ghost: { id: 'grave_ghost', name: 'Restless Dead', hp: 45, damage: [6, 11], accuracy: 0.75, dodge: 0.35, interval: 1.3, ranged: false, loot: {}, sprite: { sheet: 'ghosts', block: 1, scale: 1.1 } },
  spirit: { id: 'spirit', name: 'Summoned Spirit', hp: 60, damage: [6, 10], accuracy: 0.8, dodge: 0.3, interval: 1.2, ranged: true, loot: {}, sprite: { sheet: 'skeleghouls', block: 4, scale: 1 } },
  companion_wolf: { id: 'companion_wolf', name: 'Wolf Companion', hp: 50, damage: [5, 9], accuracy: 0.75, dodge: 0.15, interval: 1.0, ranged: false, loot: {}, sprite: { sheet: 'wolf', block: 3, scale: 1 } },
  // More from tiny-rpg-town's battle sprites
  ogre: { id: 'ogre', name: 'Ogre', hp: 170, damage: [12, 20], accuracy: 0.62, dodge: 0.02, interval: 2, ranged: false, loot: { hide: 3, meat: 4, bone: 2 }, sprite: { still: 'ogre', scale: 0.55 } },
  hedge_wizard: { id: 'hedge_wizard', name: 'Hedge Wizard', hp: 55, damage: [9, 15], accuracy: 0.72, dodge: 0.12, interval: 1.6, ranged: true, loot: { herbs: 3, cloth: 1 }, sprite: { still: 'wizard', scale: 0.42 } },
  slime: { id: 'slime', name: 'Bog Slime', hp: 30, damage: [3, 6], accuracy: 0.6, dodge: 0.05, interval: 1.4, ranged: false, loot: { fiber: 1, herbs: 1 }, sprite: { still: 'slime', scale: 0.35 } },
  mummy: { id: 'mummy', name: 'Mummy', hp: 80, damage: [6, 11], accuracy: 0.62, dodge: 0.02, interval: 1.8, ranged: false, loot: { cloth: 2, bone: 1 }, sprite: { still: 'mummy', scale: 0.6 } },
  slug_bot: { id: 'slug_bot', name: 'Crawler Bot', hp: 140, damage: [14, 20], accuracy: 0.72, dodge: 0.02, interval: 1.6, ranged: false, loot: { alloys: 1, circuits: 1 }, sprite: { still: 'metal_slug', scale: 0.5 } },
  // The dead (a zombie outbreak, any era)
  zombie: { id: 'zombie', name: 'Zombie', hp: 45, damage: [4, 8], accuracy: 0.6, dodge: 0.02, interval: 1.6, ranged: false, loot: { bone: 1 }, sprite: { people: 'zombie', weapon: null } },
  zombie_hound: { id: 'zombie_hound', name: 'Rotting Hound', hp: 35, damage: [4, 7], accuracy: 0.7, dodge: 0.1, interval: 1.1, ranged: false, loot: { bone: 1 }, sprite: { sheet: 'zombieanimals', block: 0, scale: 1 } },
  // The Rat Plague (see doom.ts): swarms out of the slums, and the Rat King behind them
  rat: { id: 'rat', name: 'Rat', hp: 14, damage: [2, 5], accuracy: 0.7, dodge: 0.3, interval: 0.8, ranged: false, loot: {}, sprite: { sheet: 'mouse', block: 0, scale: 1.5 } },
  plague_rat: { id: 'plague_rat', name: 'Plague Rat', hp: 22, damage: [3, 6], accuracy: 0.7, dodge: 0.25, interval: 0.9, ranged: false, loot: {}, sprite: { sheet: 'mouse', block: 5, scale: 1.7 } },
  rat_king: { id: 'rat_king', name: 'The Rat King', hp: 650, damage: [14, 22], accuracy: 0.78, dodge: 0.15, interval: 1.2, ranged: false, boss: true, loot: { leather: 4 }, sprite: { sheet: 'mouse', block: 3, scale: 3.6 }, kit: { roar: 'A squealing tide parts, and the Rat King drags its knotted bulk into the light!', enrage: 'Bleeding, the Rat King shrieks, and every rat in the walls answers!', area: { every: 3, targets: 3, name: 'sprays filth', fx: 'acid' }, summon: { kind: 'plague_rat', count: 4, text: 'Rats boil up out of the drains to defend their king!' }, trophy: 'rat_king_crown' } },
  // The Deep Freeze (see doom.ts): ice mages and what they raise out of the snow, and the Archmage behind it
  ice_mage: { id: 'ice_mage', name: 'Ice Mage', hp: 50, damage: [8, 13], accuracy: 0.72, dodge: 0.12, interval: 1.6, ranged: true, loot: { herbs: 2, cloth: 1 }, sprite: { people: 'frost', weapon: null } },
  ice_golem: { id: 'ice_golem', name: 'Ice Golem', hp: 120, damage: [10, 16], accuracy: 0.64, dodge: 0, interval: 2, ranged: false, loot: { stone: 3 }, sprite: { sheet: 'golems2', block: 1, scale: 1.3 } },
  frost_yeti: { id: 'frost_yeti', name: 'Frost Yeti', hp: 85, damage: [9, 15], accuracy: 0.7, dodge: 0.1, interval: 1.3, ranged: false, loot: { hide: 3, meat: 2 }, sprite: { sheet: 'snowmonkey', block: 1, scale: 1.3 } },
  frost_archmage: { id: 'frost_archmage', name: 'The Frost Archmage', hp: 700, damage: [16, 26], accuracy: 0.8, dodge: 0.12, interval: 1.5, ranged: true, boss: true, loot: { herbs: 6, cloth: 4 }, sprite: { people: 'archmage', weapon: null }, kit: { roar: 'The air turns to knives. The Frost Archmage has come to bury the town in ice!', enrage: 'Cracked and bleeding frost, the Archmage calls down the whole winter!', area: { every: 3, targets: 3, name: 'unleashes a frost nova', fx: 'frost' }, summon: { kind: 'ice_golem', count: 2, text: 'The Archmage raises golems out of the snow!' }, trophy: 'staff_of_rime' } },
  zombie_bear: { id: 'zombie_bear', name: 'Rotting Bear', hp: 150, damage: [10, 16], accuracy: 0.62, dodge: 0, interval: 1.9, ranged: false, loot: { bone: 3, hide: 1 }, sprite: { sheet: 'zombieanimals', block: 2, scale: 1.4 } },
  zombie_brute: { id: 'zombie_brute', name: 'Bloated Brute', hp: 120, damage: [8, 14], accuracy: 0.6, dodge: 0, interval: 2, ranged: false, loot: { bone: 3 }, sprite: { people: 'zombie', weapon: 'mace' } },
  abomination: { id: 'abomination', name: 'The Abomination', hp: 700, damage: [14, 24], accuracy: 0.7, dodge: 0, interval: 1.8, ranged: false, boss: true, loot: { bone: 10, herbs: 6 }, sprite: { sheet: 'horror', block: 0, scale: 1.4 }, kit: { roar: 'A wet, many-throated howl: the Abomination drags itself forward!', enrage: 'The Abomination splits open and lashes out wildly!', area: { every: 3, targets: 2, name: 'flails its many arms', fx: 'acid' }, summon: { kind: 'zombie', count: 3, text: 'The Abomination spews up more of the dead!' }, trophy: 'abomination_heart' } },
  // Robotic & Space
  space_pirate: { id: 'space_pirate', name: 'Space Pirate', hp: 130, damage: [14, 22], accuracy: 0.76, dodge: 0.16, interval: 1.2, ranged: true, loot: { power_cells: 6, alloys: 1 }, sprite: { people: 'bandit', weapon: null } },
  combat_drone: { id: 'combat_drone', name: 'Combat Drone', hp: 80, damage: [12, 18], accuracy: 0.8, dodge: 0.3, interval: 1.0, ranged: true, loot: { circuits: 1, power_cells: 2 }, sprite: { still: 'observer', scale: 0.45, hover: true } },
  war_bot: { id: 'war_bot', name: 'War Bot', hp: 220, damage: [18, 26], accuracy: 0.74, dodge: 0.05, interval: 1.5, ranged: false, loot: { alloys: 2, circuits: 1 }, sprite: { still: 'steel_eagle', scale: 0.55, hover: true } },
  rogue_ai: { id: 'rogue_ai', name: 'Rogue AI Core', hp: 500, damage: [22, 32], accuracy: 0.85, dodge: 0.05, interval: 1.4, ranged: true, boss: true, loot: { circuits: 8, alloys: 6 }, sprite: { still: 'drone', scale: 0.8, hover: true } },
  // Modern
  trooper: { id: 'trooper', name: 'Trooper', hp: 110, damage: [12, 18], accuracy: 0.76, dodge: 0.14, interval: 1.3, ranged: true, loot: { cartridges: 10, plastic: 1 }, sprite: { people: 'soldier', weapon: null } },
  raider: { id: 'raider', name: 'Raider', hp: 90, damage: [10, 15], accuracy: 0.7, dodge: 0.16, interval: 1.2, ranged: true, loot: { fuel: 2, electronics: 1 }, sprite: { people: 'bandit', weapon: null } },
  commander: { id: 'commander', name: 'Commander', hp: 200, damage: [14, 22], accuracy: 0.8, dodge: 0.15, interval: 1.2, ranged: true, boss: true, loot: { electronics: 3, cartridges: 20 }, sprite: { people: 'soldier', weapon: 'sword' } },
  soldier: { id: 'soldier', name: 'Warband Soldier', hp: 70, damage: [7, 11], accuracy: 0.72, dodge: 0.14, interval: 1.2, ranged: false, loot: { iron: 2, leather: 1 }, sprite: { people: 'soldier', weapon: 'spear' } },

  // The land's own beasts: prides of lions and wild dog packs in the desert, crocodiles on the coast; and the
  // Behemoth, which now and then drives a beast raid before it
  lion: { id: 'lion', name: 'Lion', hp: 60, damage: [7, 12], accuracy: 0.72, dodge: 0.12, interval: 1.2, ranged: false, loot: { hide: 2, meat: 2, bone: 1 }, sprite: { sheet: 'lions', block: 0, scale: 1.05 } },
  lioness: { id: 'lioness', name: 'Lioness', hp: 45, damage: [5, 10], accuracy: 0.76, dodge: 0.16, interval: 1.0, ranged: false, loot: { hide: 1, meat: 2 }, sprite: { sheet: 'lions', block: 1, scale: 1 } },
  wild_dog: { id: 'wild_dog', name: 'Wild Dog', hp: 24, damage: [3, 6], accuracy: 0.7, dodge: 0.16, interval: 0.9, ranged: false, loot: { hide: 1, meat: 1 }, sprite: { sheet: 'wilddogs', block: 0, scale: 0.9 } },
  crocodile: { id: 'crocodile', name: 'Crocodile', hp: 95, damage: [9, 15], accuracy: 0.66, dodge: 0.02, interval: 1.8, ranged: false, loot: { hide: 3, meat: 3 }, sprite: { sheet: 'crocodiles', block: 0, scale: 0.7 } },
  behemoth: { id: 'behemoth', name: 'The Behemoth', hp: 650, damage: [16, 26], accuracy: 0.72, dodge: 0.02, interval: 2, ranged: false, boss: true, loot: { hide: 8, meat: 10, bone: 8 }, sprite: { sheet: 'behemoth', block: 0, scale: 0.85 }, kit: { roar: 'The ground shakes. The Behemoth drives the beasts before it!', enrage: 'Wounded, the Behemoth tramples everything in its way!', area: { every: 3, targets: 3, name: 'stamps the earth', fx: 'quake' }, trophy: 'behemoth_horn' } },
  // Things that come alive inside the town (sim/lurkers.ts): a chest a traveller left at the shop, and the tomes of a
  // library
  mimic: { id: 'mimic', name: 'Mimic', hp: 150, damage: [9, 15], accuracy: 0.74, dodge: 0.05, interval: 1.3, ranged: false, loot: { iron: 3, cloth: 3, leather: 2 }, sprite: { sheet: 'mimic', block: 0, scale: 0.8 } },
  possessed_tome: { id: 'possessed_tome', name: 'Possessed Tome', hp: 28, damage: [4, 8], accuracy: 0.74, dodge: 0.35, interval: 1.3, ranged: true, loot: { fiber: 2 }, sprite: { sheet: 'tomes', block: 0, scale: 0.9 } },
  // A druid grove's walking mushrooms, woken by Entangle to fight for it
  shroom_folk: { id: 'shroom_folk', name: 'Walking Mushroom', hp: 50, damage: [4, 8], accuracy: 0.72, dodge: 0.1, interval: 1.2, ranged: false, loot: {}, sprite: { sheet: 'shrooms', block: 0, scale: 0.9 } },
  // Rival origins (see data/rivals.ts): the towns founded the other ways, come to take this one. Each army is led by
  // its own lord, who casts that origin's spells against the town (sim/rivals.ts).
  // (the Lich Lord and the dead)
  lich_lord: { id: 'lich_lord', name: 'The Lich Lord', hp: 300, damage: [10, 16], accuracy: 0.78, dodge: 0.12, interval: 1.6, ranged: true, boss: true, loot: { bone: 12, cloth: 3 }, tint: 0xb8d0b0, sprite: { sheet: 'champ_necromancer', block: 4, scale: 2.2 }, kit: { roar: 'Bells toll from nowhere. The Lich Lord has come to add this town to the dead!', enrage: 'Cracked, the Lich Lord shrieks, and the grave-cold spills out of it!', area: { every: 4, targets: 3, name: 'unleashes a wave of grave-cold', fx: 'frost' }, summon: { kind: 'wraith', count: 2, text: 'Wraiths tear themselves out of the ground for the Lich Lord!' }, trophy: 'lich_phylactery' } },
  flying_skull: { id: 'flying_skull', name: 'Flying Skull', hp: 24, damage: [3, 6], accuracy: 0.7, dodge: 0.3, interval: 1.1, ranged: false, loot: { bone: 1 }, sprite: { sheet: 'skeleghouls', block: 0, scale: 0.8 } },
  wraith: { id: 'wraith', name: 'Wraith', hp: 45, damage: [5, 9], accuracy: 0.74, dodge: 0.35, interval: 1.3, ranged: false, loot: { cloth: 1 }, sprite: { still: 'elem_wraith', scale: 0.55, hover: true } },
  // (the Archdruid and the wild)
  archdruid: { id: 'archdruid', name: 'The Archdruid', hp: 280, damage: [9, 15], accuracy: 0.76, dodge: 0.14, interval: 1.5, ranged: true, boss: true, loot: { herbs: 10, wood: 12 }, tint: 0xc0e8a8, sprite: { sheet: 'champ_beast_tamer', block: 4, scale: 2.2 }, kit: { roar: 'The trees lean in. The Archdruid has come to take the land back!', enrage: 'Bleeding sap, the Archdruid calls on the whole forest!', summon: { kind: 'treant', count: 1, text: 'A tree tears up its roots and walks for the Archdruid!' }, trophy: 'archdruid_staff' } },
  treant: { id: 'treant', name: 'Treant', hp: 130, damage: [9, 15], accuracy: 0.62, dodge: 0, interval: 2, ranged: false, loot: { wood: 6 }, sprite: { still: 'elem_treant', scale: 0.62 } },
  // (the Countess and her thralls)
  countess: { id: 'countess', name: 'The Countess', hp: 280, damage: [11, 17], accuracy: 0.82, dodge: 0.25, interval: 1.2, ranged: false, boss: true, loot: { cloth: 4, iron: 2 }, tint: 0xf0dce8, sprite: { sheet: 'champ_blood_knight', block: 2, scale: 2.2 }, kit: { roar: 'Fog rolls in, and in it, a smile. The Countess has come to feed!', enrage: 'The Countess bares her fangs, and her beauty falls away!', summon: { kind: 'night_shade', count: 2, text: 'Demons claw their way up out of the shadows to serve the Countess!' }, trophy: 'countess_ring' } },
  vampire_bat: { id: 'vampire_bat', name: 'Vampire Bat', hp: 22, damage: [3, 6], accuracy: 0.74, dodge: 0.4, interval: 0.9, ranged: false, loot: {}, sprite: { sheet: 'bats', block: 0, scale: 0.8 } },
  thrall: { id: 'thrall', name: 'Blood Fiend', hp: 50, damage: [5, 9], accuracy: 0.66, dodge: 0.1, interval: 1.2, ranged: false, loot: { cloth: 1 }, sprite: { sheet: 'blood_monster', block: 0, scale: 2 } },
  night_shade: { id: 'night_shade', name: 'Demon', hp: 40, damage: [5, 9], accuracy: 0.72, dodge: 0.35, interval: 1.2, ranged: false, loot: {}, sprite: { sheet: 'demon', block: 0, scale: 2 } },
  // (the Alpha and the pack)
  the_alpha: { id: 'the_alpha', name: 'The Alpha', hp: 320, damage: [12, 18], accuracy: 0.78, dodge: 0.18, interval: 1.1, ranged: false, boss: true, loot: { hide: 6, meat: 4, bone: 2 }, sprite: { sheet: 'wolfman', block: 4, scale: 1.4 }, kit: { roar: 'A howl, then a hundred. The Alpha has come to hunt!', enrage: 'Hurt, the Alpha goes mad with blood!', area: { every: 4, targets: 2, name: 'tears through the line', fx: 'quake' }, summon: { kind: 'werewolf', count: 2, text: 'Werewolves bound out of the dark to the Alpha\'s side!' }, trophy: 'alpha_pelt' } },
  werewolf: { id: 'werewolf', name: 'Werewolf', hp: 80, damage: [7, 12], accuracy: 0.72, dodge: 0.16, interval: 1.1, ranged: false, loot: { hide: 2, meat: 1 }, sprite: { sheet: 'wolfman', block: 2, scale: 1.1 } },
  // (the Overmind and its machines)
  overmind: { id: 'overmind', name: 'The Overmind', hp: 300, damage: [10, 16], accuracy: 0.84, dodge: 0.08, interval: 1.4, ranged: true, boss: true, loot: { alloys: 6, circuits: 4 }, tint: 0xa8e0ff, sprite: { still: 'drone', scale: 0.7, hover: true }, kit: { roar: 'A voice in every direction: "THIS SETTLEMENT WILL BE OPTIMISED."', enrage: '"DAMAGE CRITICAL. ALL UNITS: PRIORITY ZERO."', area: { every: 3, targets: 3, name: 'sweeps a beam across the town', fx: 'beam' }, summon: { kind: 'iron_sentry', count: 2, text: 'The Overmind prints two more sentries!' }, trophy: 'overmind_core' } },
  iron_sentry: { id: 'iron_sentry', name: 'Iron Sentry', hp: 90, damage: [8, 13], accuracy: 0.72, dodge: 0.02, interval: 1.5, ranged: false, loot: { stone: 2, iron: 1 }, sprite: { still: 'elem_iron_sentry', scale: 0.55 } },
  scout_drone: { id: 'scout_drone', name: 'Scout Drone', hp: 35, damage: [4, 7], accuracy: 0.78, dodge: 0.3, interval: 1.0, ranged: true, loot: { stone: 1 }, sprite: { still: 'observer', scale: 0.35, hover: true } },
  // (the Thane and the hold)
  thane: { id: 'thane', name: 'The Thane', hp: 360, damage: [12, 18], accuracy: 0.76, dodge: 0.08, interval: 1.5, ranged: false, boss: true, loot: { iron: 6, stone: 10 }, tint: 0xf0c890, sprite: { people: 'soldier', weapon: 'mace' }, kit: { roar: 'Drums under the earth. The Thane of the Deep Hold has come for your stone and iron!', enrage: 'The Thane roars a war-oath his fathers knew!', area: { every: 3, targets: 2, name: 'brings the hammer down', fx: 'quake' }, summon: { kind: 'stone_golem', count: 1, text: 'The ground heaves: a stone golem answers the Thane!' }, trophy: 'thane_hammer' } },
  hold_warrior: { id: 'hold_warrior', name: 'Hold Warrior', hp: 70, damage: [6, 10], accuracy: 0.7, dodge: 0.06, interval: 1.3, ranged: false, loot: { iron: 1, stone: 1 }, tint: 0xe8c898, sprite: { people: 'soldier', weapon: 'mace' } },
  hold_crossbow: { id: 'hold_crossbow', name: 'Hold Crossbow', hp: 50, damage: [5, 9], accuracy: 0.72, dodge: 0.06, interval: 1.6, ranged: true, loot: { arrows: 3 }, tint: 0xe8c898, sprite: { people: 'soldier', weapon: 'bow' } },
  stone_golem: { id: 'stone_golem', name: 'Stone Golem', hp: 140, damage: [9, 15], accuracy: 0.6, dodge: 0, interval: 2.1, ranged: false, loot: { stone: 5 }, sprite: { still: 'elem_stone_golem', scale: 0.62 } },
  // (the Tide Queen and her clan)
  tide_queen: { id: 'tide_queen', name: 'The Tide Queen', hp: 290, damage: [10, 16], accuracy: 0.8, dodge: 0.2, interval: 1.4, ranged: true, boss: true, loot: { meat: 8, herbs: 4 }, sprite: { sheet: 'champ_dragoon', block: 4, scale: 2.2 }, kit: { roar: 'The tide comes in, all the way to the square. The Tide Queen is here!', enrage: 'The Tide Queen raises the sea itself!', area: { every: 3, targets: 3, name: 'drives a wave through the town', fx: 'frost' }, summon: { kind: 'coral_golem', count: 1, text: 'The surf rises and walks: a water elemental!' }, trophy: 'tide_trident' } },
  tide_warrior: { id: 'tide_warrior', name: 'Tide Warrior', hp: 60, damage: [6, 10], accuracy: 0.7, dodge: 0.14, interval: 1.2, ranged: false, loot: { meat: 1 }, tint: 0x80e0d0, sprite: { people: 'frost', weapon: 'spear' } },
  tide_caller: { id: 'tide_caller', name: 'Tide Caller', hp: 44, damage: [6, 10], accuracy: 0.72, dodge: 0.12, interval: 1.6, ranged: true, loot: { herbs: 1 }, tint: 0x80e0d0, sprite: { people: 'frost', weapon: null } },
  coral_golem: { id: 'coral_golem', name: 'Water Elemental', hp: 120, damage: [8, 14], accuracy: 0.62, dodge: 0, interval: 2, ranged: false, loot: { stone: 3 }, sprite: { still: 'elem_water_elemental', scale: 0.6 } },
  // (the Khan and the horde)
  the_khan: { id: 'the_khan', name: 'The Khan', hp: 280, damage: [11, 17], accuracy: 0.84, dodge: 0.2, interval: 1.2, ranged: true, boss: true, loot: { hide: 6, cloth: 3, leather: 2 }, sprite: { sheet: 'champ_mercenary', block: 0, scale: 2.2 }, kit: { roar: 'Hoofbeats like thunder. The Khan has come to take tribute!', enrage: 'The Khan draws his sabre and rides straight in!', summon: { kind: 'horse_rider', count: 2, text: 'More riders crest the hill for the Khan!' }, trophy: 'khan_bow' } },
  horse_rider: { id: 'horse_rider', name: 'Horde Rider', hp: 60, damage: [6, 10], accuracy: 0.7, dodge: 0.18, interval: 1.1, ranged: false, loot: { hide: 1, leather: 1 }, tint: 0xf0d8b0, sprite: { people: 'bandit', weapon: 'spear' } },
  horse_archer: { id: 'horse_archer', name: 'Horse Archer', hp: 45, damage: [5, 9], accuracy: 0.72, dodge: 0.18, interval: 1.3, ranged: true, loot: { arrows: 3 }, tint: 0xf0d8b0, sprite: { people: 'bandit', weapon: 'bow' } },
  // (the Queen of the Wild Hunt and her court)
  hunt_queen: { id: 'hunt_queen', name: 'The Queen of the Wild Hunt', hp: 270, damage: [10, 16], accuracy: 0.84, dodge: 0.3, interval: 1.3, ranged: true, boss: true, loot: { herbs: 8, cloth: 3 }, tint: 0xf0c8ff, sprite: { sheet: 'champ_summoner', block: 4, scale: 2.2 }, kit: { roar: 'Horns, and laughter in the trees. The Wild Hunt rides for your town!', enrage: 'The Queen\'s glamour cracks: underneath is something old and terrible!', summon: { kind: 'wisp', count: 3, text: 'Wisps flicker out of the hedges for their Queen!' }, trophy: 'hunt_crown' } },
  wisp: { id: 'wisp', name: "Will-o'-Wisp", hp: 26, damage: [4, 7], accuracy: 0.74, dodge: 0.4, interval: 1.1, ranged: true, loot: {}, sprite: { sheet: 'skeleghouls', block: 5, scale: 0.8 } },
  redcap: { id: 'redcap', name: 'Redcap', hp: 50, damage: [6, 10], accuracy: 0.72, dodge: 0.2, interval: 1.1, ranged: false, loot: { cloth: 1 }, sprite: { sheet: 'goblin', block: 0, scale: 0.8 } },
  // (the Mad Alchemist and the experiments)
  mad_alchemist: { id: 'mad_alchemist', name: 'The Mad Alchemist', hp: 260, damage: [10, 16], accuracy: 0.78, dodge: 0.12, interval: 1.5, ranged: true, boss: true, loot: { herbs: 8, glass: 2 }, sprite: { sheet: 'champ_sage', block: 0, scale: 2.2 }, kit: { roar: '"Test subjects!" cackles the Mad Alchemist. "A whole town of them!"', enrage: 'The Mad Alchemist drinks something that glows, and grows!', area: { every: 3, targets: 3, name: 'hurls a crate of flasks', burns: true, fx: 'acid' }, summon: { kind: 'homunculus', count: 2, text: 'The Mad Alchemist uncorks two homunculi!' }, trophy: 'philosophers_stone' } },
  fire_elemental: { id: 'fire_elemental', name: 'Fire Elemental', hp: 95, damage: [9, 14], accuracy: 0.7, dodge: 0.1, interval: 1.4, ranged: false, loot: { coal: 2 }, sprite: { still: 'elem_fire_elemental', scale: 0.55 } },
  crystal_fiend: { id: 'crystal_fiend', name: 'Crystal Fiend', hp: 110, damage: [9, 15], accuracy: 0.7, dodge: 0.08, interval: 1.6, ranged: false, loot: { stone: 3, glass: 1 }, sprite: { still: 'elem_crystal_fiend', scale: 0.55 } },
  homunculus: { id: 'homunculus', name: 'Brass Homunculus', hp: 80, damage: [7, 11], accuracy: 0.68, dodge: 0.05, interval: 1.4, ranged: false, loot: { iron: 1 }, sprite: { still: 'elem_homunculus', scale: 0.55 } },
  acid_slime: { id: 'acid_slime', name: 'Acid Slime', hp: 36, damage: [4, 8], accuracy: 0.62, dodge: 0.05, interval: 1.3, ranged: false, loot: { herbs: 1 }, sprite: { sheet: 'slime', block: 0, scale: 0.8 } },
  // (the Grand Master and the Order)
  grand_master: { id: 'grand_master', name: 'The Grand Master', hp: 380, damage: [12, 19], accuracy: 0.8, dodge: 0.12, interval: 1.3, ranged: false, boss: true, loot: { iron: 6, cloth: 3 }, tint: 0xfff0b0, sprite: { sheet: 'dark_knight', block: 0, scale: 1.5 }, kit: { roar: 'Banners on the road. The Grand Master of the Order has come to claim this town!', enrage: 'The Grand Master lowers his lance: no quarter!', summon: { kind: 'order_knight', count: 2, text: 'The Order\'s knights ride to their Grand Master!' }, trophy: 'order_shield' } },
  order_knight: { id: 'order_knight', name: 'Knight of the Order', hp: 90, damage: [7, 12], accuracy: 0.74, dodge: 0.1, interval: 1.3, ranged: false, loot: { iron: 1, leather: 1 }, tint: 0xfff0d0, sprite: { people: 'soldier', weapon: 'sword' } },
  order_crossbow: { id: 'order_crossbow', name: 'Order Crossbowman', hp: 55, damage: [6, 10], accuracy: 0.74, dodge: 0.1, interval: 1.6, ranged: true, loot: { arrows: 3 }, tint: 0xfff0d0, sprite: { people: 'soldier', weapon: 'bow' } },
};

/** A group of enemies: id -> count. */
export type EnemyGroup = Record<string, number>;
