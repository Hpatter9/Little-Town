// Neolithic expedition destinations (DESIGN §8, §15). Times are the base round trip; numbers are for tuning.

import { BESTIARY_LAIRS } from './bestiary';
import { SCOUT_DESTINATIONS } from './regions';
import { TRADE_DESTINATIONS } from './minerals';
import { DUNGEON_DESTINATIONS } from './dungeons';
import { ISLANDS } from './boats';
import type { EnemyGroup } from './enemies';
import type { Era } from './eras';
import type { Material } from './materials';

export type ExpeditionType = 'gather' | 'hunt' | 'legendary' | 'salvage' | 'clear' | 'rescue' | 'scout' | 'delve' | 'trade';

export interface Encounters {
  /** Chance of a fight on arrival. */
  arrival: number;
  /** Chance of an ambush on the way home. */
  ambush: number;
  /** Possible groups, with relative odds. */
  groups: { enemies: EnemyGroup; weight: number }[];
}

export interface Destination {
  id: string;
  name: string;
  type: ExpeditionType;
  /** Base seconds for each leg: walk out, work there, walk back (unloaded). */
  outSeconds: number;
  workSeconds: number;
  /** Base seconds of work per unit of loot, per party member. */
  secondsPerUnit: number;
  /** Loot odds by material. */
  loot: Partial<Record<Material, number>>;
  /** Always brought back (on top of the loot), e.g. the Bear Cave's totem. */
  guaranteed?: Partial<Record<Material, number>>;
  threats: string;
  encounters: Encounters;
  recommendedParty: number;
  /** Research needed before it appears on the board. */
  research?: string;
  /** A trade caravan: the coins it sets out with (spent when it leaves; what it buys comes home as loot). */
  coins?: number;
  /** The era it opens in (neolithic when left out). */
  era?: Era;
  /** Scenery for the split view. */
  scenery: 'thicket' | 'river' | 'woods' | 'quarry' | 'cave';
  description: string;
  /** Only a boat reaches it: an island, a market over the sea (data/boats.ts). */
  byBoat?: boolean;
}

/** Names that carry their own article, or are a doing rather than a place. */
const OWN_ARTICLE = /^(the|scout|trade with) /i;
/** "at the Riverbank", but "at The Labyrinth" (a place whose name has its own "The"). */
export const atPlace = (name: string) => (OWN_ARTICLE.test(name) ? `at ${name}` : `at the ${name}`);
/** "the Riverbank", but "The Labyrinth" (a place whose name has its own "The"), and a trip named for what it does
 *  ("Scout the Far Isles", "Trade with the hill folk") as it is; and the same at the start of a sentence. */
export const the = (name: string) => (OWN_ARTICLE.test(name) ? name : `the ${name}`);
export const The = (name: string) => (/^the /i.test(name) ? name : OWN_ARTICLE.test(name) ? name : `The ${name}`);

export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'berry_thicket',
    name: 'Berry Thicket',
    type: 'gather',
    outSeconds: 70,
    workSeconds: 40,
    secondsPerUnit: 4,
    loot: { berries: 6, fiber: 3, herbs: 2 },
    threats: 'A wild boar, now and then',
    encounters: { arrival: 0.15, ambush: 0, groups: [{ enemies: { boar: 1 }, weight: 1 }] },
    recommendedParty: 1,
    scenery: 'thicket',
    description: 'Bramble and fruit a short walk away.',
  },
  {
    id: 'riverbank',
    name: 'Riverbank',
    type: 'gather',
    outSeconds: 140,
    workSeconds: 80,
    secondsPerUnit: 5,
    loot: { clay: 4, flint: 3, stone: 3 },
    threats: 'Low: a stray wolf',
    encounters: { arrival: 0.05, ambush: 0.03, groups: [{ enemies: { wolf: 1 }, weight: 1 }] },
    recommendedParty: 2,
    scenery: 'river',
    description: 'Clay banks and flint in the shallows.',
  },
  {
    id: 'deep_woods',
    name: 'Deep Woods',
    type: 'hunt',
    outSeconds: 230,
    workSeconds: 140,
    secondsPerUnit: 7,
    loot: { meat: 5, hide: 3, bone: 3 },
    threats: 'Wolves',
    encounters: {
      arrival: 0.6,
      ambush: 0.1,
      groups: [
        { enemies: { wolf: 2 }, weight: 3 },
        { enemies: { wolf: 3 }, weight: 2 },
        { enemies: { wolf_alpha: 1, wolf: 2 }, weight: 1 },
      ],
    },
    recommendedParty: 2,
    research: 'spear_hunting',
    scenery: 'woods',
    description: 'Game trails under the old pines.',
  },
  {
    id: 'old_quarry',
    name: 'Old Quarry',
    type: 'gather',
    outSeconds: 350,
    workSeconds: 200,
    secondsPerUnit: 4,
    loot: { stone: 6, flint: 4 },
    threats: 'Rival tribe scouts',
    encounters: {
      arrival: 0.45,
      ambush: 0.15,
      groups: [
        { enemies: { rival_spear: 2 }, weight: 2 },
        { enemies: { rival_spear: 2, rival_slinger: 1 }, weight: 1 },
      ],
    },
    recommendedParty: 3,
    research: 'scouting',
    scenery: 'quarry',
    description: 'Broken stone in heaps, if you can carry it.',
  },
  {
    id: 'bear_cave',
    name: 'Bear Cave',
    type: 'legendary',
    outSeconds: 700,
    workSeconds: 400,
    secondsPerUnit: 8,
    loot: { hide: 4, bone: 4, meat: 3 },
    guaranteed: { totem: 1 },
    threats: 'The Cave Bear (boss)',
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { cave_bear: 1 }, weight: 1 }] },
    recommendedParty: 3,
    research: 'scouting',
    scenery: 'cave',
    description: 'Something huge sleeps here. Its totem is needed for the Elder Lodge.',
  },

  // Medieval (times stretched by the era multiplier)
  {
    id: 'iron_hills',
    name: 'Iron Hills',
    type: 'gather',
    outSeconds: 260,
    workSeconds: 200,
    secondsPerUnit: 5,
    loot: { iron_ore: 5, stone: 3, flint: 1 },
    threats: 'Wolves and bandits',
    encounters: {
      arrival: 0.3,
      ambush: 0.1,
      groups: [
        { enemies: { wolf: 3 }, weight: 1 },
        { enemies: { bandit: 2 }, weight: 1 },
      ],
    },
    recommendedParty: 3,
    research: 'mining',
    era: 'medieval',
    scenery: 'quarry',
    description: 'Rust-red rock full of ore.',
  },
  {
    id: 'old_ruins',
    name: 'Old Ruins',
    type: 'salvage',
    outSeconds: 320,
    workSeconds: 240,
    secondsPerUnit: 7,
    loot: { bricks: 3, iron: 2, cloth: 2, bone: 1 },
    threats: 'Bandits hiding in the rubble',
    encounters: {
      arrival: 0.5,
      ambush: 0.1,
      groups: [
        { enemies: { bandit: 2, bandit_archer: 1 }, weight: 2 },
        { enemies: { wolf: 3 }, weight: 1 },
      ],
    },
    recommendedParty: 3,
    research: 'writing',
    era: 'medieval',
    scenery: 'quarry',
    description: 'Fallen walls of an older people. Old writings here can speed your research.',
  },
  {
    id: 'bandit_camp',
    name: 'Bandit Camp',
    type: 'clear',
    outSeconds: 300,
    workSeconds: 100,
    secondsPerUnit: 6,
    loot: { iron: 2, cloth: 2, bread: 3, leather: 2 },
    threats: 'A bandit gang and its chief',
    encounters: {
      arrival: 1,
      ambush: 0,
      groups: [
        { enemies: { bandit: 3, bandit_archer: 1 }, weight: 2 },
        { enemies: { bandit: 2, bandit_archer: 1, bandit_chief: 1 }, weight: 1 },
      ],
    },
    recommendedParty: 3,
    era: 'medieval',
    scenery: 'woods',
    description: 'Win here and the raids stop for a few days.',
  },
  {
    id: 'lost_village',
    name: 'Lost Village',
    type: 'rescue',
    outSeconds: 360,
    workSeconds: 120,
    secondsPerUnit: 10,
    loot: { grain: 4, cloth: 1 },
    threats: 'Bandits on the road',
    encounters: { arrival: 0.35, ambush: 0.15, groups: [{ enemies: { bandit: 2 }, weight: 1 }] },
    recommendedParty: 2,
    era: 'medieval',
    scenery: 'river',
    description: 'Survivors of a burned village. Bring some of them home.',
  },

  // Industrial (times stretched 6x)
  {
    id: 'coal_fields',
    name: 'Coal Fields',
    type: 'gather',
    outSeconds: 240,
    workSeconds: 200,
    secondsPerUnit: 4,
    loot: { coal: 6, iron_ore: 3, stone: 2 },
    threats: 'Gangs',
    encounters: { arrival: 0.3, ambush: 0.15, groups: [{ enemies: { gangster: 2 }, weight: 1 }] },
    recommendedParty: 3,
    research: 'coal_mining',
    era: 'industrial',
    scenery: 'quarry',
    description: 'Black seams in the hills, free for the taking.',
  },
  {
    id: 'abandoned_mill',
    name: 'Abandoned Mill',
    type: 'salvage',
    outSeconds: 300,
    workSeconds: 240,
    secondsPerUnit: 6,
    loot: { steel: 2, glass: 2, cloth: 3, lumber: 3 },
    threats: 'Squatters with guns',
    encounters: { arrival: 0.5, ambush: 0.1, groups: [{ enemies: { gangster: 3 }, weight: 1 }] },
    recommendedParty: 3,
    era: 'industrial',
    scenery: 'quarry',
    description: 'A gutted mill. Old records here can speed your research.',
  },
  {
    id: 'gang_hideout',
    name: 'Gang Hideout',
    type: 'clear',
    outSeconds: 280,
    workSeconds: 100,
    secondsPerUnit: 6,
    loot: { steel: 3, shot: 20, bread: 4 },
    threats: 'The gang, in force',
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { gangster: 4 }, weight: 2 }, { enemies: { gangster: 3, rifleman: 1 }, weight: 1 }] },
    recommendedParty: 3,
    era: 'industrial',
    scenery: 'woods',
    description: 'Break the gang and the raids stop for a few days (and any captives come home).',
  },

  // Modern (times stretched 15x: take a truck)
  {
    id: 'oil_fields',
    name: 'Oil Fields',
    type: 'gather',
    outSeconds: 240,
    workSeconds: 200,
    secondsPerUnit: 4,
    loot: { oil: 6, coal: 2, steel: 1 },
    threats: 'Marauders',
    encounters: { arrival: 0.3, ambush: 0.15, groups: [{ enemies: { raider: 2 }, weight: 2 }, { enemies: { raider: 3 }, weight: 1 }] },
    recommendedParty: 3,
    research: 'oil_drilling',
    era: 'modern',
    scenery: 'quarry',
    description: 'Abandoned wells that still seep oil.',
  },
  {
    id: 'ghost_city',
    name: 'Ghost City',
    type: 'salvage',
    outSeconds: 300,
    workSeconds: 240,
    secondsPerUnit: 6,
    loot: { electronics: 2, plastic: 3, steel: 3, glass: 2, concrete: 3 },
    threats: 'Marauders among the ruins',
    encounters: { arrival: 0.5, ambush: 0.1, groups: [{ enemies: { raider: 3 }, weight: 2 }, { enemies: { trooper: 2 }, weight: 1 }] },
    recommendedParty: 3,
    era: 'modern',
    scenery: 'quarry',
    description: 'An emptied city. Old files here can speed your research.',
  },
  {
    id: 'militia_compound',
    name: 'Militia Compound',
    type: 'clear',
    outSeconds: 280,
    workSeconds: 100,
    secondsPerUnit: 6,
    loot: { cartridges: 30, electronics: 2, fuel: 6 },
    threats: 'Troopers and their commander',
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { trooper: 3, commander: 1 }, weight: 1 }, { enemies: { raider: 3, trooper: 1 }, weight: 1 }] },
    recommendedParty: 3,
    era: 'modern',
    scenery: 'woods',
    description: 'Take the compound and the raids stop for a few days (and any captives come home).',
  },

  // Robotic & Space (times stretched 40x: take a truck)
  {
    id: 'crater',
    name: 'Meteor Crater',
    type: 'gather',
    outSeconds: 200,
    workSeconds: 200,
    secondsPerUnit: 5,
    loot: { rare_minerals: 5, stone: 3, steel: 1 },
    threats: 'Drones guarding the site',
    encounters: { arrival: 0.35, ambush: 0.1, groups: [{ enemies: { combat_drone: 2 }, weight: 2 }, { enemies: { combat_drone: 1, war_bot: 1 }, weight: 1 }] },
    recommendedParty: 3,
    research: 'deep_mining',
    era: 'space',
    scenery: 'quarry',
    description: 'A fresh crater, glittering with rare minerals.',
  },
  {
    id: 'fallen_satellite',
    name: 'Fallen Satellite',
    type: 'salvage',
    outSeconds: 260,
    workSeconds: 220,
    secondsPerUnit: 7,
    loot: { circuits: 2, alloys: 2, power_cells: 4, electronics: 2 },
    threats: 'Pirates want it too',
    encounters: { arrival: 0.5, ambush: 0.15, groups: [{ enemies: { space_pirate: 2 }, weight: 2 }, { enemies: { space_pirate: 3 }, weight: 1 }] },
    recommendedParty: 3,
    era: 'space',
    scenery: 'woods',
    description: 'A satellite came down in the forest. Its data banks can speed your research.',
  },
  {
    id: 'rogue_foundry',
    name: 'Rogue Foundry',
    type: 'clear',
    outSeconds: 260,
    workSeconds: 100,
    secondsPerUnit: 6,
    loot: { alloys: 4, circuits: 3, power_cells: 10 },
    threats: 'War bots and the AI that builds them',
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { war_bot: 2, combat_drone: 2 }, weight: 2 }, { enemies: { rogue_ai: 1, combat_drone: 2 }, weight: 1 }] },
    recommendedParty: 3,
    era: 'space',
    scenery: 'quarry',
    description: 'Shut down the machines and the raids stop for a few days (and any captives come home).',
  },
  // Era bosses (legendary: a boss and its guard; rare finds, and a relic more often than not)
  { id: 'dark_keep', name: 'The Dark Keep', type: 'legendary', outSeconds: 400, workSeconds: 200, secondsPerUnit: 8, loot: { iron: 5, cloth: 4, bread: 4 }, guaranteed: { iron: 10 }, threats: 'The Black Knight (boss)', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { black_knight: 1, soldier: 2 }, weight: 1 }] }, recommendedParty: 3, research: 'armoring', era: 'medieval', scenery: 'cave', description: 'A knight in black armour holds the keep, and the roads around it.' },
  { id: 'dragon_lair', name: 'The Red Crags', type: 'legendary', outSeconds: 440, workSeconds: 200, secondsPerUnit: 8, loot: { iron: 6, cloth: 6, bread: 4 }, guaranteed: { iron: 14, leather: 8 }, threats: 'Vermithrax the Red (dragon)', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { dragon: 1 }, weight: 1 }] }, recommendedParty: 3, research: 'fortification', era: 'medieval', scenery: 'cave', description: 'A dragon sleeps on a hoard in the crags. Bring your best, and water for the burns.' },
  { id: 'baron_manor', name: "The Baron's Works", type: 'legendary', outSeconds: 360, workSeconds: 200, secondsPerUnit: 7, loot: { steel: 4, glass: 4, coal: 6 }, guaranteed: { steel: 12 }, threats: 'The Iron Baron and his Iron Colossus (bosses)', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { iron_baron: 1, iron_colossus: 1 }, weight: 1 }] }, recommendedParty: 3, research: 'firearms', era: 'industrial', scenery: 'quarry', description: 'A robber baron and his hired guns. His vaults are full.' },
  { id: 'warlord_fort', name: "The Warlord's Fort", type: 'legendary', outSeconds: 340, workSeconds: 200, secondsPerUnit: 7, loot: { electronics: 3, fuel: 8, concrete: 6 }, guaranteed: { electronics: 10 }, threats: 'The Warlord and his War Machine (bosses)', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { warlord: 1, war_machine: 1 }, weight: 1 }] }, recommendedParty: 3, research: 'rifles', era: 'modern', scenery: 'woods', description: 'A warlord has carved out a kingdom in the hills.' },
  { id: 'pirate_flagship', name: 'The Pirate Flagship', type: 'legendary', outSeconds: 320, workSeconds: 200, secondsPerUnit: 7, loot: { alloys: 3, circuits: 3, power_cells: 10 }, guaranteed: { alloys: 12 }, threats: 'The Pirate King and the Star Reaver (bosses)', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { pirate_king: 1, star_mech: 1 }, weight: 1 }] }, recommendedParty: 3, research: 'energy_weapons', era: 'space', scenery: 'quarry', description: 'The pirates crashed their flagship here. Their king is still aboard.' },
  // the new bosses' lairs (data/bestiary.ts)
  ...BESTIARY_LAIRS,
  // (the scouting trips that map the fogged regions: data/regions.ts)
  ...SCOUT_DESTINATIONS,
  ...TRADE_DESTINATIONS,
  // (the dungeons to delve: data/dungeons.ts)
  ...DUNGEON_DESTINATIONS,
  ...ISLANDS,
];

export const DESTINATION_BY_ID: Readonly<Record<string, Destination>> = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));

export const EXPEDITION_TYPE_NAMES: Record<ExpeditionType, string> = { gather: 'Gather', hunt: 'Hunt', legendary: 'Legendary', salvage: 'Salvage', clear: 'Clear a threat', rescue: 'Rescue', scout: 'Scout', delve: 'Delve', trade: 'Trade caravan' };

/** Clearing the bandit camp keeps raids away this many game days. */
export const CLEARED_RAID_DELAY_DAYS = 3;
/** Salvage: chance of finding old writings that halve a research topic's remaining time. */
export const SALVAGE_NOTES_CHANCE = 0.5;
/** Rescue: how many survivors come back (at most). */
export const RESCUE_MAX = 2;

/** A truck (Modern): what it carries, how much of the walk it takes, the fuel a trip burns, and the chance
 *  it's lost when the party is overrun. */
export const TRUCK_CARRY = 80;
export const TRUCK_SPEEDUP = 0.4;
export const TRUCK_FUEL = 6;
export const TRUCK_LOST_ON_LOSS = 0.5;

/** Party size limit (research will raise it later) and how many expeditions can be out at once. */
export const MAX_PARTY = 3;
/** A delving party may be bigger (the player picks it). */
export const MAX_DELVERS = 5;
export const MAX_EXPEDITIONS = 2;
/** A fully loaded party walks home this much slower. */
export const LOADED_SLOWDOWN = 0.25;
/** Carrying a downed member home slows the party this much more. */
export const CARRYING_WOUNDED_SLOWDOWN = 0.4;

/* ------------------------------------------------------------ party setup */

export type Role = 'fighter' | 'scout' | 'medic' | 'porter';

export const ROLES: Readonly<Record<Role, { name: string; description: string }>> = {
  fighter: { name: 'Fighter', description: 'Front row. Fights.' },
  scout: { name: 'Scout', description: 'May spot trouble first and slip past it (not bosses). Fights from the back.' },
  medic: { name: 'Medic', description: 'Back row. Heals the hurt and stops the bleeding of the downed.' },
  porter: { name: 'Porter', description: 'Back row. Carries 50% more and stays out of fights.' },
};

export type Stance = 'cautious' | 'balanced' | 'bold';

export const STANCES: Readonly<Record<Stance, { name: string; retreatAt: number; description: string }>> = {
  cautious: { name: 'Cautious', retreatAt: 0.6, description: 'Falls back early and avoids trouble.' },
  balanced: { name: 'Balanced', retreatAt: 0.4, description: 'Fights on while it goes well.' },
  bold: { name: 'Bold', retreatAt: 0.2, description: 'Fights to the last and takes risks for reward.' },
};

/** A scout's chance to spot a (non-boss) encounter first and avoid it. */
export const SCOUT_AVOID = 0.3;
/** Porters carry this much more. */
export const PORTER_CARRY = 1.5;
