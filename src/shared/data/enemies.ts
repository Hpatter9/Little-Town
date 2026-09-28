// Enemies by era (DESIGN §15 and on). Numbers are starting points for tuning.

import type { Stock } from './materials';

/** How a human enemy is drawn: which outfit, and what they hold (an LPC weapon layer, or none). */
export interface HumanSprite {
  people: 'rival' | 'bandit' | 'soldier' | 'zombie' | 'frost' | 'archmage';
  weapon: 'spear' | 'mace' | 'dagger' | 'bow' | 'sword' | null;
}

/** Creature sheets (see renderer/art/creatures.ts). */
export type CreatureSheetId = 'wolf' | 'boar' | 'bear' | 'horse' | 'wyvern' | 'drakes' | 'golems' | 'skeleghouls' | 'zombieanimals' | 'wolfman' | 'horror' | 'dark_knight' | 'golems2' | 'snowmonkey' | 'ghosts' | 'mouse';

/** A single still image (see renderer/art/stills.ts); hover ones bob in the air. */
export interface StillSprite {
  still: 'observer' | 'steel_eagle' | 'drone' | 'sentinel' | 'ogre' | 'mummy' | 'wizard' | 'slime' | 'metal_slug';
  scale: number;
  hover?: boolean;
}

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
  /** The unique item it drops. */
  trophy: string;
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
}

export const ENEMIES: Readonly<Record<string, EnemyDef>> = {
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
};

/** A group of enemies: id -> count. */
export type EnemyGroup = Record<string, number>;
