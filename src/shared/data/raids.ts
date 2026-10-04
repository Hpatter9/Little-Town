// Raids by era (DESIGN §10, §15): wolf packs, boar charges, rival tribe scouting parties; then bandits and
// warbands. Numbers are starting points for tuning.

import { PACK_RAIDS } from './pack';
import { BESTIARY_RAIDS } from './bestiary';
import type { Era } from './eras';

/** What a raider is after (DESIGN §10): hurting people, stealing, setting fires, carrying someone off. */
export type RaidGoal = 'harm' | 'steal' | 'burn' | 'kidnap';

export interface RaidKind {
  id: string;
  name: string;
  /** What they're after: beasts go for people (then food), rivals go for the food. Each raider gets one
   *  of `goals` (weighted); `goal` is the main one. */
  goal: RaidGoal;
  goals?: Partial<Record<RaidGoal, number>>;
  /** What thieves take: only food, or anything of value. */
  steals?: 'food' | 'valuables';
  /** Enemy ids and what each costs out of the raid's strength budget. */
  enemies: Record<string, number>;
  /** Raids of this kind only happen from this day on, and only between these eras. */
  fromDay: number;
  era?: Era;
  untilEra?: Era;
  weight: number;
  /** Walking speed in px per second. */
  speed: number;
  /** Can be paid off. */
  bribable: boolean;
  /** The name takes a plural verb ("the scouts are here"). */
  plural: boolean;
  /** A rival origin's army (data/rivals.ts): it never comes to a town founded the same way, and its lord always
   *  leads it. */
  origin?: string;
  leader?: string;
  /** Only in these lands (data/biomes.ts); anywhere if unset. */
  biomes?: string[];
  /** Comes out of the sea, and only to a shore town (the merfolk: sim/sea.ts `seaTown`): its raiders start in deep
   *  water south of the town and swim ashore (battle.ts `trail`; raids.ts `offSea`). */
  fromSea?: boolean;
}

const BASE_RAID_KINDS: readonly RaidKind[] = [
  { id: 'wolves', name: 'Wolf pack', goal: 'harm', enemies: { wolf: 8, wolf_alpha: 20 }, fromDay: 0, untilEra: 'industrial', weight: 3, speed: 80, bribable: false, plural: false },
  { id: 'boars', name: 'Boar charge', goal: 'harm', enemies: { boar: 11 }, fromDay: 0, untilEra: 'medieval', weight: 2, speed: 60, bribable: false, plural: false },
  { id: 'rivals', name: 'Rival tribe scouts', goal: 'steal', enemies: { rival_spear: 12, rival_slinger: 10 }, fromDay: 3, untilEra: 'neolithic', weight: 2, speed: 50, bribable: true, plural: true },
  { id: 'slimes', name: 'Bog slimes', goal: 'harm', enemies: { slime: 6 }, fromDay: 2, untilEra: 'medieval', weight: 1, speed: 25, bribable: false, plural: true },
  // Medieval
  { id: 'bandits', name: 'Bandits', goal: 'steal', goals: { steal: 4, burn: 1, kidnap: 1 }, steals: 'valuables', enemies: { bandit: 14, bandit_archer: 12, bandit_chief: 30 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 4, speed: 55, bribable: true, plural: true },
  // (never picked at random: sent by the Hunter's Guild, see monsters.ts)
  { id: 'hunters', name: "Hunter's Guild", goal: 'harm', enemies: { guild_hunter: 20 }, fromDay: 9999, weight: 0, speed: 55, bribable: false, plural: false },
  // Industrial
  { id: 'gang', name: 'Gang', goal: 'steal', goals: { steal: 4, burn: 2, kidnap: 1 }, steals: 'valuables', enemies: { gangster: 18 }, fromDay: 0, era: 'industrial', untilEra: 'modern', weight: 4, speed: 60, bribable: true, plural: false },
  { id: 'army', name: 'Rival army', goal: 'harm', goals: { harm: 3, burn: 1 }, enemies: { rifleman: 24, soldier: 20 }, fromDay: 0, era: 'industrial', untilEra: 'industrial', weight: 2, speed: 50, bribable: true, plural: false },
  // Modern
  { id: 'marauders', name: 'Marauders', goal: 'steal', goals: { steal: 4, burn: 2, kidnap: 1 }, steals: 'valuables', enemies: { raider: 24 }, fromDay: 0, era: 'modern', untilEra: 'modern', weight: 4, speed: 70, bribable: true, plural: true },
  { id: 'mechanized', name: 'Mechanized force', goal: 'harm', goals: { harm: 3, burn: 2 }, enemies: { trooper: 28, commander: 60 }, fromDay: 0, era: 'modern', untilEra: 'modern', weight: 2, speed: 65, bribable: true, plural: false },
  // (never picked at random: the waves of a zombie outbreak, see doom.ts)
  { id: 'zombies', name: 'Walking dead', goal: 'harm', enemies: { zombie: 8, zombie_hound: 7, mummy: 14, zombie_brute: 22, zombie_bear: 26 }, fromDay: 9999, weight: 0, speed: 28, bribable: false, plural: true },
  // (never picked at random: the ice mages of a Deep Freeze, see doom.ts)
  { id: 'frost', name: 'Ice mages', goal: 'harm', goals: { harm: 4, steal: 1 }, steals: 'food', enemies: { ice_mage: 12, frost_yeti: 16, ice_golem: 24 }, fromDay: 9999, weight: 0, speed: 40, bribable: false, plural: true },
  // (never picked at random: the swarms of a Rat Plague, see doom.ts)
  { id: 'rats', name: 'Rat swarm', goal: 'steal', goals: { steal: 3, harm: 2 }, steals: 'food', enemies: { rat: 3, plague_rat: 6 }, fromDay: 9999, weight: 0, speed: 75, bribable: false, plural: false },
  // Robotic & Space
  { id: 'pirates', name: 'Space pirates', goal: 'steal', goals: { steal: 4, burn: 1, kidnap: 2 }, steals: 'valuables', enemies: { space_pirate: 30 }, fromDay: 0, era: 'space', weight: 4, speed: 75, bribable: true, plural: true },
  { id: 'drones', name: 'Drone swarm', goal: 'harm', goals: { harm: 3, burn: 2 }, enemies: { combat_drone: 22, slug_bot: 32, war_bot: 40 }, fromDay: 0, era: 'space', weight: 3, speed: 90, bribable: false, plural: false },
  { id: 'warband', name: 'Warband', goal: 'harm', goals: { harm: 3, burn: 2 }, enemies: { soldier: 20, bandit_archer: 12, ogre: 32, hedge_wizard: 18 }, fromDay: 0, era: 'medieval', untilEra: 'industrial', weight: 2, speed: 50, bribable: true, plural: false },
  // The land's own beasts
  { id: 'lions', name: 'Pride of lions', goal: 'harm', enemies: { lion: 16, lioness: 11 }, fromDay: 4, untilEra: 'industrial', weight: 3, speed: 70, bribable: false, plural: false, biomes: ['desert'] },
  { id: 'wild_dogs', name: 'Wild dog pack', goal: 'harm', enemies: { wild_dog: 6 }, fromDay: 3, untilEra: 'industrial', weight: 2, speed: 90, bribable: false, plural: false, biomes: ['desert', 'tundra'] },
  { id: 'crocodiles', name: 'Crocodiles', goal: 'harm', enemies: { crocodile: 18 }, fromDay: 3, untilEra: 'modern', weight: 3, speed: 35, bribable: false, plural: true, biomes: ['coast'] },
  // (never picked at random: things that come alive inside the town, see lurkers.ts)
  { id: 'cave_bear', name: 'The Cave Bear', goal: 'harm', enemies: { cave_bear: 1 }, fromDay: 9999, weight: 0, speed: 26, bribable: false, plural: false },
  { id: 'mimic', name: 'Mimic', goal: 'harm', enemies: { mimic: 30 }, fromDay: 9999, weight: 0, speed: 30, bribable: false, plural: false },
  { id: 'tomes', name: 'Possessed tomes', goal: 'harm', enemies: { possessed_tome: 8 }, fromDay: 9999, weight: 0, speed: 40, bribable: false, plural: true },
  // Rival origins (data/rivals.ts): any era, from day 8, never to a town founded the same way
  { id: 'rival_lich', name: 'The Lich Lord\'s dead', goal: 'harm', goals: { harm: 4, burn: 1 }, enemies: { flying_skull: 6, zombie: 8, wraith: 10, mummy: 14 }, fromDay: 8, weight: 0.3, speed: 30, bribable: false, plural: true, origin: 'lich', leader: 'lich_lord' },
  { id: 'rival_druid', name: 'The Archdruid\'s wild', goal: 'harm', enemies: { wolf: 8, boar: 11, treant: 24 }, fromDay: 8, weight: 0.3, speed: 55, bribable: false, plural: false, origin: 'druid', leader: 'archdruid' },
  { id: 'rival_vampire', name: 'The Blood Court', goal: 'harm', goals: { harm: 3, kidnap: 2 }, enemies: { thrall: 10, night_shade: 9, vampire_bat: 6 }, fromDay: 8, weight: 0.3, speed: 50, bribable: false, plural: false, origin: 'vampire', leader: 'countess' },
  { id: 'rival_werewolf', name: 'The Moon Pack', goal: 'harm', enemies: { wolf: 8, wolf_alpha: 18, werewolf: 16 }, fromDay: 8, weight: 0.3, speed: 80, bribable: false, plural: false, origin: 'werewolf', leader: 'the_alpha' },
  { id: 'rival_robot', name: 'The Machine Colony', goal: 'harm', goals: { harm: 3, burn: 1 }, enemies: { scout_drone: 8, iron_sentry: 18 }, fromDay: 8, weight: 0.3, speed: 45, bribable: false, plural: false, origin: 'robot', leader: 'overmind' },
  { id: 'rival_dwarves', name: 'The Deep Hold', goal: 'steal', goals: { steal: 4, harm: 2 }, steals: 'valuables', enemies: { hold_warrior: 14, hold_crossbow: 11, stone_golem: 26 }, fromDay: 8, weight: 0.3, speed: 40, bribable: true, plural: false, origin: 'dwarves', leader: 'thane' },
  { id: 'rival_merfolk', name: 'The Tide Clan', goal: 'steal', goals: { steal: 3, kidnap: 2, harm: 1 }, steals: 'food', enemies: { tide_warrior: 12, tide_caller: 10, coral_golem: 22 }, fromDay: 8, weight: 0.3, speed: 50, bribable: true, plural: false, origin: 'merfolk', leader: 'tide_queen' },
  { id: 'rival_nomads', name: 'The Horde', goal: 'steal', goals: { steal: 4, burn: 1, kidnap: 1 }, steals: 'valuables', enemies: { horse_rider: 12, horse_archer: 10 }, fromDay: 8, weight: 0.3, speed: 85, bribable: true, plural: false, origin: 'nomads', leader: 'the_khan' },
  { id: 'rival_fae', name: 'The Wild Hunt', goal: 'kidnap', goals: { kidnap: 3, harm: 2, steal: 1 }, steals: 'food', enemies: { wisp: 6, redcap: 10, crystal_fiend: 22 }, fromDay: 8, weight: 0.3, speed: 70, bribable: false, plural: false, origin: 'fae', leader: 'hunt_queen' },
  { id: 'rival_alchemists', name: 'The Mad Alchemist\'s experiments', goal: 'harm', goals: { harm: 3, burn: 2 }, enemies: { acid_slime: 7, homunculus: 16, fire_elemental: 20 }, fromDay: 8, weight: 0.3, speed: 40, bribable: false, plural: true, origin: 'alchemists', leader: 'mad_alchemist' },
  { id: 'rival_knights', name: 'The Order', goal: 'harm', goals: { harm: 3, burn: 1, steal: 1 }, steals: 'valuables', enemies: { order_knight: 18, order_crossbow: 12 }, fromDay: 8, weight: 0.3, speed: 55, bribable: true, plural: false, origin: 'knights', leader: 'grand_master' },
  // the Craftpix packs' foes (data/bestiary.ts)
  ...BESTIARY_RAIDS,
];

export const RAID_KINDS: readonly RaidKind[] = [...BASE_RAID_KINDS, ...PACK_RAIDS];
export const RAID_KIND_BY_ID: Readonly<Record<string, RaidKind>> = Object.fromEntries(RAID_KINDS.map((k) => [k.id, k]));

/** No raids before this many game hours. */
export const RAID_GRACE_HOURS = 48;
/** Hours between raids: a base that shrinks as days pass, never below the minimum, plus some randomness. */
export const RAID_INTERVAL_HOURS = 30;
export const RAID_INTERVAL_MIN = 14;
export const RAID_INTERVAL_JITTER = 6;
/** Strength budget: base + per day survived + per 25 points of wealth (stock units, 5 per building). */
/** Every raid's budget is multiplied by this (the owner's call: deaths should be common, and small towns since arrivals
 *  became the player's choice drew raids of two or three beasts that never downed anyone). */
export const RAID_BITE = 1.4;
/** Raiders' blows land this much harder, in town and on the battle map (with RAID_BITE: raids that down people). */
export const RAID_FEROCITY = 1.25;
/** Both bite only from this many grown-ups: a founder alone or with one companion meets the raids of old. */
export const RAID_BITE_FROM = 3;
export const RAID_BUDGET_BASE = 18;
export const RAID_BUDGET_PER_DAY = 3;
export const RAID_BUDGET_PER_WEALTH = 1 / 25;
export const RAID_MAX_SIZE = 6;
/** A big town draws hardened raiders: health and blows up by this much per grown-up beyond RAID_MIGHT_FREE, up to
 *  RAID_MIGHT_MAX times. */
export const RAID_MIGHT_PER_PERSON = 0.03;
export const RAID_MIGHT_FREE = 8;
export const RAID_MIGHT_MAX = 2;
/** A seasoned town (its grown-ups' levels, data/levels.ts) draws seasoned raiders too: this much more might per level of
 *  the grown-ups' average beyond the first, up to RAID_SEASONED_MAX times (on top of the above). */
export const RAID_MIGHT_PER_LEVEL = 0.07;
export const RAID_SEASONED_MAX = 2.5;
/** Struck down by a raider, someone may die there and then (a boss's blow more often; the founder less, since the town
 *  passes to an heir), rather than lying wounded to be tended. */
export const KILLING_BLOW = 0.38;
export const BOSS_KILLING_BLOW = 0.6;
export const FOUNDER_KILLING_BLOW = 0.12;
/** ...and a bigger town draws a bigger raid: one more raider for every RAID_SIZE_PER_PEOPLE grown-ups beyond
 *  RAID_SIZE_FREE, up to RAID_SIZE_CAP. */
export const RAID_SIZE_PER_PEOPLE = 4;
export const RAID_SIZE_FREE = 8;
export const RAID_SIZE_CAP = 16;
/** The raid grows with the town: budget per grown-up living there (beyond the first few). */
export const RAID_BUDGET_PER_PERSON = 1.5;
export const RAID_BUDGET_FREE_PEOPLE = 4;
/** A bigger raid (at least FLANK_MIN raiders) may split: a party comes round to the other end of the town, where nobody
 *  is waiting. The chance grows a little each day, up to FLANK_MAX. */
export const FLANK_MIN = 4;
export const FLANK_CHANCE = 0.2;
export const FLANK_PER_DAY = 0.02;
export const FLANK_MAX = 0.5;
/** Warning before raiders appear: without and with a Lookout Platform (game minutes). */
export const WARNING_MINUTES = 10;
export const LOOKOUT_WARNING_MINUTES = 60;
/** Extra warning while guards are out on patrol (see Barracks). */
export const PATROL_WARNING_MINUTES = 30;
/** Raiders give up and leave after this long in town. */
export const RAID_MAX_HOURS = 3;
/** Raiders run when hurt below this share of health: beasts fight on longer than rival scouts. */
export const RAIDER_FLEE: Record<RaidGoal, number> = { harm: 0.25, steal: 0.4, burn: 0.4, kidnap: 0.4 };
/** What each unit is worth to a thief (anything unlisted counts 1). */
export const LOOT_VALUE: Partial<Record<string, number>> = { iron: 6, cloth: 4, leather: 4, bread: 3, bricks: 2, lumber: 2, iron_ore: 2, arrows: 2, dried_meat: 2, rations: 3, steel: 5, glass: 3, electronics: 8, plastic: 3, fuel: 3, concrete: 2, cartridges: 1, shot: 1, rare_minerals: 6, alloys: 10, circuits: 12, power_cells: 2 };

/* ------------------------------------------------------------ fire */

/** A burning building is gone after this many game hours unless put out. */
export const BURN_HOURS = 4;
/** Chance each game hour that fire jumps to a flammable neighbour (within a tile). */
export const SPREAD_PER_HOUR = 0.35;
/** Seconds of one person's work (at skill 1) to put out a fire that has just started. */
export const EXTINGUISH_SECONDS = 25;
/** What rivals can carry off, each. */
export const RAIDER_CARRY = 5;
/** Food it takes to pay off a raid, per raider. */
export const BRIBE_FOOD_PER_RAIDER = 3;
/** Deaths: a raider out to hurt people, standing over someone downed with nobody else in reach, finishes them off
 *  with this chance per blow (never the founder). After a raid an infirmary (or better) takes in all the fallen;
 *  without one they must be tended where they lie (people.ts), and some bleed out first. */
export const FINISH_OFF_CHANCE = 0.3;

/** Reach of melee and thrown attacks, in px. */
export const MELEE_RANGE = 22;
export const THROW_RANGE = 120;

/** A mage's fire (sim/raids.ts mageFire): its chance to land, its damage (plus more per level of Research), the share
 *  it does to those beside the one hit, and how near (px in town) they must be. */
export const MAGE_ACCURACY = 0.85;
export const MAGE_DAMAGE: [number, number] = [6, 10];
export const MAGE_PER_LEVEL = 1.2;
export const MAGE_SPLASH = 0.5;
export const MAGE_BURST_PX = 24;
