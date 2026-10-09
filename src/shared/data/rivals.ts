// Rival origins: every way of founding a town (data/origins.ts) that the player didn't choose is out there somewhere,
// and now and then it comes for this town. Each sends its own army behind its own lord, and the lord casts that
// origin's spells against the town: the Lich Lord drains the living and raises the fallen, the Archdruid roots the
// defenders where they stand, the Overmind sends out a pulse that stops machines dead. See sim/rivals.ts.
// Numbers are starting points for tuning.

import type { OriginId } from './origins';
import { RISING } from './risingPowers';

/** What a rival lord's spell does (see sim/rivals.ts). */
export type RivalSpellKind =
  /** Hurt the townsfolk nearest the caster, and heal it by as much. */
  | 'drain'
  /** Hurt several townsfolk at once (from anywhere). */
  | 'storm'
  /** Fallen raiders stand up again. */
  | 'raise'
  /** Heal every raider. */
  | 'mend'
  /** More raiders come. */
  | 'summon'
  /** A hex on the defenders for a while: held (they often can't strike), fogged (they miss more), or a pulse that
   *  stops machines and turrets dead. */
  | 'hold'
  | 'fog'
  | 'emp'
  /** A blessing on the raiders for a while: they hit harder and faster, or they're warded (take less). */
  | 'frenzy'
  | 'ward'
  /** Everyone's spirits sink. */
  | 'dread'
  /** Break down walls. */
  | 'shatter'
  /** Take coin from the town's purse. */
  | 'plunder';

export interface RivalSpell {
  id: string;
  name: string;
  kind: RivalSpellKind;
  /** Seconds between casts (the first comes a little after the lord arrives). */
  every: number;
  /** How strong: damage for drain and storm, share healed for mend, raiders raised or summoned, seconds a hex or
   *  blessing lasts, morale lost for dread, wall damage for shatter, share of the purse for plunder. */
  power: number;
  /** For summon: what comes. For storm: whether it also starts a fire. */
  summons?: string;
  burns?: boolean;
  /** Said when it's cast. */
  text: string;
}

export interface RivalDef {
  origin: Exclude<OriginId, 'settlers'>;
  /** The raid kind (data/raids.ts) and its lord (an enemy with a kit). */
  raid: string;
  leader: string;
  spells: RivalSpell[];
}

export const RIVALS: Record<Exclude<OriginId, 'settlers'>, RivalDef> = {
  lich: {
    origin: 'lich',
    raid: 'rival_lich',
    leader: 'lich_lord',
    spells: [
      { id: 'drain_life', name: 'Drain Life', kind: 'drain', every: 12, power: 14, text: 'The Lich Lord drains the life from the living!' },
      { id: 'raise_fallen', name: 'Raise the Fallen', kind: 'raise', every: 20, power: 2, text: 'The Lich Lord speaks a word, and the fallen dead get up again!' },
      { id: 'bone_ward', name: 'Bone Ward', kind: 'ward', every: 30, power: 10, text: 'A ward of bone rises round the dead army!' },
    ],
  },
  druid: {
    origin: 'druid',
    raid: 'rival_druid',
    leader: 'archdruid',
    spells: [
      { id: 'entangle', name: 'Entangle', kind: 'hold', every: 18, power: 8, text: 'Roots burst from the ground and bind the defenders!' },
      { id: 'storm', name: 'Call Storm', kind: 'storm', every: 14, power: 9, text: 'The Archdruid calls down lightning on the town!' },
      { id: 'regrowth', name: 'Regrowth', kind: 'mend', every: 20, power: 0.3, text: 'Green light: the Archdruid\'s beasts heal.' },
    ],
  },
  vampire: {
    origin: 'vampire',
    raid: 'rival_vampire',
    leader: 'countess',
    spells: [
      { id: 'mesmerise', name: 'Mesmerise', kind: 'hold', every: 18, power: 8, text: 'The Countess\'s eyes catch the defenders: they stand dazed!' },
      { id: 'blood_drain', name: 'Blood Drain', kind: 'drain', every: 12, power: 16, text: 'The Countess drinks deep!' },
      { id: 'night_terror', name: 'Night Terror', kind: 'dread', every: 40, power: 8, text: 'Nightmares crawl through the town. Everyone is shaken.' },
    ],
  },
  werewolf: {
    origin: 'werewolf',
    raid: 'rival_werewolf',
    leader: 'the_alpha',
    spells: [
      { id: 'howl', name: 'Howl', kind: 'summon', every: 25, power: 2, summons: 'wolf', text: 'The Alpha howls, and more wolves come running!' },
      { id: 'frenzy', name: 'Blood Frenzy', kind: 'frenzy', every: 20, power: 10, text: 'The pack goes into a frenzy!' },
    ],
  },
  robot: {
    origin: 'robot',
    raid: 'rival_robot',
    leader: 'overmind',
    spells: [
      { id: 'overclock', name: 'Overclock', kind: 'frenzy', every: 20, power: 10, text: '"OVERCLOCK." The machines speed up!' },
      { id: 'repair', name: 'Repair Swarm', kind: 'mend', every: 16, power: 0.25, text: 'A cloud of tiny drones patches up the machines.' },
      { id: 'emp', name: 'EMP', kind: 'emp', every: 22, power: 8, text: 'A pulse from the Overmind: machines and turrets go dead!' },
    ],
  },
  dwarves: {
    origin: 'dwarves',
    raid: 'rival_dwarves',
    leader: 'thane',
    spells: [
      { id: 'stone_skin', name: 'Stone Skin', kind: 'ward', every: 22, power: 10, text: 'The Thane\'s warriors turn grey as granite!' },
      { id: 'rockfall', name: 'Rockfall', kind: 'shatter', every: 14, power: 45, text: 'Rocks rain down on the walls!' },
    ],
  },
  merfolk: {
    origin: 'merfolk',
    raid: 'rival_merfolk',
    leader: 'tide_queen',
    spells: [
      { id: 'whirlpool', name: 'Whirlpool', kind: 'hold', every: 18, power: 7, text: 'A whirlpool opens in the square: the defenders are swept off their feet!' },
      { id: 'sea_fog', name: 'Sea Fog', kind: 'fog', every: 25, power: 14, text: 'A thick fog rolls in off the sea. The defenders can barely see.' },
      { id: 'tide', name: 'High Tide', kind: 'summon', every: 30, power: 2, summons: 'tide_warrior', text: 'The tide brings more warriors in!' },
    ],
  },
  nomads: {
    origin: 'nomads',
    raid: 'rival_nomads',
    leader: 'the_khan',
    spells: [
      { id: 'volley', name: 'Arrow Volley', kind: 'storm', every: 10, power: 7, text: 'The sky goes dark with arrows!' },
      { id: 'plunder', name: 'Plunder', kind: 'plunder', every: 30, power: 0.15, text: 'Riders break off to loot the purse!' },
    ],
  },
  fae: {
    origin: 'fae',
    raid: 'rival_fae',
    leader: 'hunt_queen',
    spells: [
      { id: 'glamour', name: 'Glamour', kind: 'hold', every: 20, power: 9, text: 'The Queen smiles, and the defenders forget why they\'re fighting!' },
      { id: 'faerie_fire', name: 'Faerie Fire', kind: 'storm', every: 12, power: 9, burns: true, text: 'Faerie fire dances over the rooftops!' },
    ],
  },
  alchemists: {
    origin: 'alchemists',
    raid: 'rival_alchemists',
    leader: 'mad_alchemist',
    spells: [
      { id: 'volatile_flask', name: 'Volatile Flask', kind: 'storm', every: 12, power: 11, burns: true, text: 'A flask arcs over the wall and bursts!' },
      { id: 'elixir', name: 'Elixir', kind: 'mend', every: 18, power: 0.3, text: 'The Mad Alchemist hands out something bubbling. The experiments heal.' },
      { id: 'transmute', name: 'Transmute', kind: 'shatter', every: 25, power: 60, text: 'The walls turn to sand!' },
    ],
  },
  knights: {
    origin: 'knights',
    raid: 'rival_knights',
    leader: 'grand_master',
    spells: [
      { id: 'rally', name: 'Rally', kind: 'frenzy', every: 22, power: 10, text: '"For the Order!" The knights charge!' },
      { id: 'shield_wall', name: 'Shield Wall', kind: 'ward', every: 22, power: 10, text: 'The Order locks shields!' },
      { id: 'oath', name: 'Oath of Mending', kind: 'raise', every: 30, power: 2, text: 'The Grand Master swears an oath, and the fallen knights rise!' },
    ],
  },
  orcs: {
    origin: 'orcs',
    raid: 'rival_orcs',
    leader: 'orc_warlord',
    spells: [
      { id: 'war_cry', name: 'War Cry', kind: 'frenzy', every: 18, power: 10, text: 'WAAAGH! The warband roars and charges!' },
      { id: 'war_drums', name: 'War Drums', kind: 'dread', every: 24, power: 6, text: 'The war drums beat, and the defenders\' hearts sink.' },
      { id: 'more_orcs', name: 'More Orcs', kind: 'summon', every: 30, power: 3, summons: 'orc_grunt', text: 'Gorbag bellows, and more orcs come running!' },
    ],
  },
};

/** The rival (if any) behind a raid kind, and the one whose lord this is. */
export const rivalOfRaid = (kind: string): RivalDef | undefined => Object.values(RIVALS).find((r) => r.raid === kind);
export const rivalOfLeader = (enemy: string): Pick<RivalDef, 'raid' | 'leader' | 'spells'> | undefined =>
  Object.values(RIVALS).find((r) => r.leader === enemy) ?? Object.values(RISING).filter((r) => r.lord === enemy).map((r) => ({ raid: r.raids[0], leader: r.lord, spells: r.spells }))[0];
/** Every lord's spells, the rival peoples' and the rising powers'. */
export const ALL_LORD_SPELLS = (): RivalSpell[] => [...Object.values(RIVALS).flatMap((r) => r.spells), ...Object.values(RISING).flatMap((r) => r.spells)];

/** (When they come, and how often, is in data/raids.ts: from day 8, in any era.) */
/** A lord grows stronger as the days pass: this share of its health at first, and this much more per day. */
export const RIVAL_HP_BASE = 0.55;
export const RIVAL_HP_PER_DAY = 0.045;
/** The budget the lord takes up (the rest goes on its army). */
export const RIVAL_LEADER_COST = 20;
/** Hexes: a held defender loses this share of their strikes (a machine hit by an EMP loses them all, and so do
 *  turrets); fog takes this much off their aim; frenzy makes raiders strike this much harder and faster; a ward
 *  takes this share off what raiders are hit for. */
export const HOLD_LOSS = 0.6;
export const FOG_AIM = 0.2;
export const FRENZY = 1.35;
export const WARD = 0.55;
