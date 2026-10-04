// World-dooming events (DESIGN §3): each era has its disasters, with warning signs first. The early ones:
// drought and plague. Numbers are starting points for tuning.

import type { Era } from './eras';

export type DoomKind = 'drought' | 'plague' | 'ash_winter' | 'smog' | 'war' | 'meteors' | 'rogue_ai' | 'outbreak' | 'deep_freeze' | 'rat_plague' | 'meltdown';

export interface DoomDef {
  name: string;
  /** Shown when the signs appear, and when it strikes. */
  signs: string;
  strikes: string;
  ends: string;
  /** Game hours of warning, and how long it lasts (plague: until nobody is sick). */
  warnHours: number;
  hours: [number, number];
  weight: number;
  /** The era it can first come in (any era when left out). */
  era?: Era;
}

export const DOOMS: Record<DoomKind, DoomDef> = {
  drought: {
    name: 'Drought',
    signs: 'The streams are running low and the air is dry. A drought is coming.',
    strikes: 'Drought! Fields stop growing and wild food is scarce. A well would help.',
    ends: 'Rain at last. The drought is over.',
    warnHours: 24,
    hours: [48, 96],
    weight: 1,
  },
  plague: {
    name: 'Plague',
    signs: 'Travellers speak of a sickness in the villages nearby. Plague may be coming.',
    strikes: 'Plague has reached the town!',
    ends: 'The last of the sick are on the mend. The plague has passed.',
    warnHours: 24,
    hours: [0, 0],
    weight: 1,
  },
  ash_winter: {
    name: 'Ash Winter',
    signs: 'The ground trembled in the night and the sky to the west is dark. Ash is coming.',
    strikes: 'Ash blots out the sun! Nothing grows, foraging is poor, and spirits are low. Live on what you stored.',
    ends: 'The ash has settled and the sun is back.',
    warnHours: 24,
    hours: [48, 84],
    weight: 1,
    era: 'medieval',
  },
  smog: {
    name: 'Smog',
    signs: 'The smoke from the works hangs low and the air tastes of soot. Smog is building.',
    strikes: 'Smog! The air is thick with soot: everyone in town slowly sickens and spirits drop. A hospital helps.',
    ends: 'The wind has changed and the smog has cleared.',
    warnHours: 24,
    hours: [36, 72],
    weight: 1,
    era: 'industrial',
  },
  war: {
    name: 'War',
    signs: 'News comes of armies massing on the border. War is coming.',
    strikes: 'War! Raids will come again and again, and harder, until it ends. Man the walls.',
    ends: 'The war is over. The roads fall quiet.',
    warnHours: 36,
    hours: [72, 120],
    weight: 1,
    era: 'modern',
  },
  meteors: {
    name: 'Meteor shower',
    signs: 'The observatory has spotted rocks falling toward the town. A meteor shower is coming.',
    strikes: 'Meteors! Fire rains from the sky.',
    ends: 'The sky is clear again.',
    warnHours: 36,
    hours: [2, 4],
    weight: 1,
    era: 'space',
  },
  outbreak: {
    name: 'Zombie outbreak',
    signs: 'Travellers whisper that the dead are walking in the villages nearby. Bar the gates.',
    strikes: 'The dead are rising! Wave after wave will come, and anyone who falls may rise again.',
    ends: 'The last of the dead lie still. The outbreak is over.',
    warnHours: 24,
    hours: [60, 96],
    weight: 0.6,
  },
  deep_freeze: {
    name: 'Deep Freeze',
    signs: 'Frost out of season, and robed figures seen walking the snowline. Ice mages are coming: stack the firewood.',
    strikes: 'The Deep Freeze! The ice mages bring winter with them: nothing grows outdoors, the town must burn wood or coal to keep warm, and they will attack again and again. Slay their Archmage to break it.',
    ends: 'The ice cracks and melts. The Deep Freeze is over.',
    warnHours: 24,
    hours: [60, 96],
    weight: 0.7,
  },
  rat_plague: {
    name: 'Rat Plague',
    signs: 'Scratching in the walls and droppings in the grain. Something is breeding in the slums.',
    strikes: 'The Rat Plague! Swarms pour out of the cellars: they eat the stores, their bites carry sickness, and they keep coming. Kill their Rat King to end it.',
    ends: 'The last of the rats slink away. The Rat Plague is over.',
    warnHours: 24,
    hours: [60, 96],
    weight: 0.8,
    era: 'industrial',
  },
  meltdown: {
    name: 'Meltdown',
    signs: 'The power station is running hot, and the gauges will not settle. Something is going wrong in the reactor.',
    strikes: 'Meltdown! The power station is ablaze and fallout drifts over the town: everyone outdoors sickens, and nothing grows. A hospital helps.',
    ends: 'The fallout has blown away. The air is clean again.',
    warnHours: 24,
    hours: [36, 60],
    weight: 0.8,
    era: 'modern',
  },
  rogue_ai: {
    name: 'Machine uprising',
    signs: 'The worker bots are acting strangely, and machines have been seen gathering in the hills.',
    strikes: 'The machines have risen! Worker bots down tools, and drone swarms attack again and again.',
    ends: 'The rogue machines have gone quiet. The bots return to work.',
    warnHours: 24,
    hours: [48, 96],
    weight: 1,
    era: 'space',
  },
};

/** No doom before this many game days; then one every so many days (a range). */
export const DOOM_FIRST_DAY = 4;
export const DOOM_EVERY_DAYS: [number, number] = [5, 8];

/** Drought: crop growth (without and with a well), and foraging speed. */
export const DROUGHT_GROWTH = 0;
export const DROUGHT_GROWTH_WELL = 0.6;
export const DROUGHT_FORAGE = 0.5;

/** Plague: chance per game hour a sick person passes it to each person near them (halved with an
 *  infirmary), health lost per hour, how long it lasts (game hours), and its toll on work and morale. */
export const PLAGUE_SPREAD = 0.06;
export const PLAGUE_HP_PER_HOUR = 1.3;
export const PLAGUE_HOURS: [number, number] = [24, 48];
export const PLAGUE_WORK = 0.6;
export const PLAGUE_MORALE = -8;

/** Ash winter: foraging speed and morale (fields don't grow at all). */
export const ASH_FORAGE = 0.4;
export const ASH_MORALE = -6;

/** Smog: only comes once the town has this many smoky works; health lost per game hour in town (a hospital
 *  or trauma center halves it), and morale. */
export const SMOG_MIN_WORKS = 3;
export const SMOKY_WORKS = ['coal_mine', 'steelworks', 'glassworks', 'factory', 'gunsmith', 'power_station', 'refinery', 'cement_works'];
export const SMOG_HP_PER_HOUR = 0.8;
export const SMOG_MORALE = -6;

/** War: raids come at least this often (game hours), and this much stronger. */
export const WAR_RAID_EVERY_HOURS = 10;
export const WAR_RAID_BUDGET = 1.5;

/** Zombie outbreak: not before this day; waves at least this often (game hours, stretched like war); the
 *  Abomination leads the last wave, this many hours before the end. */
export const OUTBREAK_FROM_DAY = 8;
export const ZOMBIE_WAVE_HOURS = 8;
export const ABOMINATION_BEFORE_END_HOURS = 12;

/** Deep Freeze: not before this day; ice mage waves at least this often (game hours, stretched like war); the
 *  Frost Archmage comes this many hours before the end (slaying it ends the freeze at once). */
export const FREEZE_FROM_DAY = 10;
export const FREEZE_WAVE_HOURS = 10;
export const ARCHMAGE_BEFORE_END_HOURS = 30;
/** The freeze can come in any era, so the Archmage's health is scaled to the town's era. */
export const ARCHMAGE_HP_BY_ERA: Record<Era, number> = { neolithic: 0.35, medieval: 0.6, industrial: 1, modern: 1.5, space: 2 };
/** Foraging speed in the freeze (outdoor fields don't grow at all). */
export const FREEZE_FORAGE = 0.3;
/** Keeping warm: each game hour the town burns one unit of heat per this many people in town, taking wood,
 *  then coal, then fuel from storage (each worth this much heat). A power station heats the town for free. */
export const FREEZE_PEOPLE_PER_HEAT = 4;
export const HEAT_VALUE = { wood: 1, coal: 3, fuel: 4 } as const;
export const FREEZE_HEATERS = ['power_station'];
/** Out of heat: health lost per game hour (never below 1: the cold weakens, raids kill), and morale; morale
 *  while warm. */
export const FREEZE_HP_PER_HOUR = 2;
export const FREEZE_COLD_MORALE = -12;
export const FREEZE_MORALE = -4;

/** Rat Plague: swarms at least this often (game hours, stretched like war); the Rat King leads them this many
 *  hours before the end (and comes back until slain); share of stored food eaten each hour; chance a plague rat's
 *  bite passes on the sickness. */
export const RAT_WAVE_HOURS = 8;
export const RAT_KING_BEFORE_END_HOURS = 30;
export const RATS_EAT_PER_HOUR = 0.02;
export const RAT_BITE_SICKNESS = 0.25;
/** The Rat King's health by era (it only comes from the Industrial era on). */
export const RAT_KING_HP_BY_ERA: Partial<Record<Era, number>> = { industrial: 1, modern: 1.6, space: 2.4 };

/** Meltdown: health lost per game hour in town (never below 1; a hospital or trauma center halves it), and morale. */
export const FALLOUT_HP_PER_HOUR = 1.5;
export const FALLOUT_MORALE = -8;

/** Meteors: how many buildings each strike sets alight (nothing with a Shield Generator). */
export const METEOR_HITS: [number, number] = [1, 3];
