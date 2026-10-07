// The conquest's troops (the owner's call: nameless soldiers, unlike the townsfolk): what a hero of the town leads
// to war in a squad of up to nine on a three-by-three formation, in the manner of Symphony of War. Each kind has a
// role in the line (`kind`), an age and a study that opens it, what it costs to raise (coins and a material from the
// stores, besides a recruit from the held provinces), its health, blow and guard, and whether it fights from the
// back. The peoples have one kind of their own each. Counters (`COUNTERS`): spears beat horse, horse rides down
// archers, archers pick off skirmishers, magic burns through shields, skirmishers get at the mages behind. See
// sim/conquest/squads.ts for squads, hero power and command.

import type { ClassId, ClassRole } from './classes';
import type { Era } from './eras';
import type { Material } from './materials';
import type { OriginId } from './origins';

export type TroopKind = 'melee' | 'shield' | 'spear' | 'ranged' | 'horse' | 'magic' | 'healer' | 'skirmish' | 'beast' | 'siege';

export interface TroopDef {
  id: string;
  name: string;
  /** One soldier of it, as the journal names them. */
  one: string;
  kind: TroopKind;
  era: Era;
  /** A topic the town must know (data/research.ts), beside the age. */
  research?: string;
  /** A people's own kind: only their town raises it. */
  origin?: OriginId;
  hp: number;
  attack: number;
  defence: number;
  /** Fights from the back rows (shoots or casts over the front). */
  ranged?: boolean;
  /** Mends the squad each round instead of striking. */
  heal?: number;
  /** Magic: armour is no help against it. */
  magic?: boolean;
  /** Quick: strikes first in a clash. */
  quick?: boolean;
  /** A share of each blow dealt comes back as health. */
  drain?: number;
  /** Strikes walls `walls` times as hard (siege crews). */
  walls?: number;
  cost: { coins: number; material?: Material; amount?: number };
  text: string;
}

const T = (d: TroopDef) => d;

export const TROOPS: readonly TroopDef[] = [
  // the Stone Age
  T({ id: 'militia', name: 'Militia', one: 'militiaman', kind: 'melee', era: 'neolithic', hp: 20, attack: 4, defence: 1, cost: { coins: 4 }, text: 'Townsfolk with clubs and courage. Cheap, and they know it.' }),
  T({ id: 'spearmen', name: 'Spearmen', one: 'spearman', kind: 'spear', era: 'neolithic', hp: 24, attack: 5, defence: 2, cost: { coins: 6, material: 'wood', amount: 1 }, text: 'A wall of points. Horses will not ride at it.' }),
  T({ id: 'slingers', name: 'Slingers', one: 'slinger', kind: 'ranged', era: 'neolithic', ranged: true, hp: 16, attack: 4, defence: 0, cost: { coins: 5, material: 'stone', amount: 1 }, text: 'Stones from the back row. Better than nothing, and not by much.' }),
  T({ id: 'skirmishers', name: 'Skirmishers', one: 'skirmisher', kind: 'skirmish', era: 'neolithic', quick: true, hp: 18, attack: 6, defence: 1, cost: { coins: 6, material: 'hide', amount: 1 }, text: 'Light and fast: they go round the line and at whoever stands behind it.' }),
  T({ id: 'war_hounds', name: 'War Hounds', one: 'war hound', kind: 'beast', era: 'neolithic', quick: true, hp: 20, attack: 7, defence: 1, cost: { coins: 8, material: 'meat', amount: 1 }, text: 'Hounds bred for the fight. They need a master who understands beasts.' }),
  // the Medieval age
  T({ id: 'archers', name: 'Archers', one: 'archer', kind: 'ranged', era: 'medieval', research: 'archery', ranged: true, hp: 18, attack: 7, defence: 1, cost: { coins: 8, material: 'wood', amount: 1 }, text: 'Bows from the back row. They thin a charge before it lands.' }),
  T({ id: 'shieldbearers', name: 'Shieldbearers', one: 'shieldbearer', kind: 'shield', era: 'medieval', research: 'iron_working', hp: 30, attack: 5, defence: 4, cost: { coins: 10, material: 'iron', amount: 1 }, text: 'A shield wall. Arrows glance off it; magic does not.' }),
  T({ id: 'swordsmen', name: 'Swordsmen', one: 'swordsman', kind: 'melee', era: 'medieval', research: 'iron_working', hp: 26, attack: 8, defence: 3, cost: { coins: 12, material: 'iron', amount: 1 }, text: 'Iron in hand and mail on the chest: the line\'s backbone.' }),
  T({ id: 'pikemen', name: 'Pikemen', one: 'pikeman', kind: 'spear', era: 'medieval', research: 'fortification', hp: 26, attack: 6, defence: 3, cost: { coins: 10, material: 'wood', amount: 2 }, text: 'Long pikes in close order. Death to horse.' }),
  T({ id: 'light_horse', name: 'Light Horse', one: 'rider', kind: 'horse', era: 'medieval', quick: true, hp: 28, attack: 8, defence: 2, cost: { coins: 16, material: 'hide', amount: 2 }, text: 'Riders who ride down archers and run from pikes.' }),
  T({ id: 'heavy_horse', name: 'Heavy Horse', one: 'knight', kind: 'horse', era: 'medieval', research: 'iron_working', hp: 36, attack: 10, defence: 5, cost: { coins: 24, material: 'iron', amount: 2 }, text: 'Armoured riders. A charge that breaks lines, if it isn\'t met by pikes.' }),
  T({ id: 'crossbowmen', name: 'Crossbowmen', one: 'crossbowman', kind: 'ranged', era: 'medieval', research: 'siege_engines', ranged: true, hp: 20, attack: 9, defence: 2, cost: { coins: 12, material: 'iron', amount: 1 }, text: 'Slow to load, hard to stop: bolts that go through mail.' }),
  T({ id: 'battlemages', name: 'Battlemages', one: 'battlemage', kind: 'magic', era: 'medieval', research: 'arcane_arts', ranged: true, magic: true, hp: 16, attack: 11, defence: 0, cost: { coins: 18, material: 'herbs', amount: 1 }, text: 'Fire from the back row that no shield turns. Frail; keep spears before them.' }),
  T({ id: 'healers', name: 'Healers', one: 'healer', kind: 'healer', era: 'medieval', research: 'physick', ranged: true, heal: 6, hp: 16, attack: 2, defence: 0, cost: { coins: 14, material: 'herbs', amount: 1 }, text: 'They mend the squad between blows. A squad with healers outlasts one without.' }),
  T({ id: 'siege_crew', name: 'Siege Crew', one: 'engineer', kind: 'siege', era: 'medieval', research: 'siege_engines', ranged: true, walls: 4, hp: 20, attack: 6, defence: 1, cost: { coins: 30, material: 'lumber', amount: 3 }, text: 'A ram and a mantlet. Walls come down before them; men not so much.' }),
  // the Industrial age and after
  T({ id: 'musketeers', name: 'Musketeers', one: 'musketeer', kind: 'ranged', era: 'industrial', research: 'firearms', ranged: true, hp: 22, attack: 12, defence: 2, cost: { coins: 20, material: 'iron', amount: 2 }, text: 'A volley that goes through plate. Slow between shots.' }),
  T({ id: 'grenadiers', name: 'Grenadiers', one: 'grenadier', kind: 'melee', era: 'industrial', research: 'drill_manuals', hp: 26, attack: 11, defence: 3, cost: { coins: 22, material: 'iron', amount: 2 }, text: 'Picked men, drilled hard, with bombs for the walls.' }),
  T({ id: 'riflemen', name: 'Riflemen', one: 'rifleman', kind: 'ranged', era: 'modern', research: 'rifles', ranged: true, hp: 24, attack: 15, defence: 3, cost: { coins: 28, material: 'iron', amount: 2 }, text: 'Rifles that reach across the field. Nothing old stands against them.' }),
  // each people's own
  T({ id: 'thralls', name: 'Thralls', one: 'thrall', kind: 'melee', era: 'medieval', origin: 'vampire', drain: 0.3, hp: 30, attack: 8, defence: 2, cost: { coins: 10, material: 'blood', amount: 1 }, text: 'The Court\'s bound soldiers. Every blow they land feeds them.' }),
  T({ id: 'bone_legion', name: 'Bone Legion', one: 'skeleton', kind: 'shield', era: 'medieval', origin: 'lich', hp: 24, attack: 6, defence: 3, cost: { coins: 6, material: 'bone', amount: 2 }, text: 'The raised dead in ranks. They feel nothing and fear less.' }),
  T({ id: 'wolf_pack', name: 'Wolf Pack', one: 'wolf', kind: 'beast', era: 'medieval', origin: 'werewolf', quick: true, hp: 26, attack: 9, defence: 1, cost: { coins: 8, material: 'meat', amount: 2 }, text: 'The pack\'s own, running with the Moon Pack\'s heroes.' }),
  T({ id: 'constructs', name: 'Constructs', one: 'construct', kind: 'shield', era: 'medieval', origin: 'robot', hp: 36, attack: 9, defence: 5, cost: { coins: 14, material: 'iron', amount: 3 }, text: 'Built, not born. Plated and tireless.' }),
  T({ id: 'ironbreakers', name: 'Ironbreakers', one: 'ironbreaker', kind: 'melee', era: 'medieval', origin: 'dwarves', hp: 32, attack: 8, defence: 5, cost: { coins: 14, material: 'iron', amount: 2 }, text: 'The Hold\'s axes, in mail no smith above ground could make.' }),
  T({ id: 'tide_guard', name: 'Tide Guard', one: 'guard', kind: 'spear', era: 'medieval', origin: 'merfolk', hp: 26, attack: 7, defence: 3, cost: { coins: 10, material: 'fish', amount: 2 }, text: 'Tridents of the Tide Clan, at home on any shore.' }),
  T({ id: 'horse_archers', name: 'Horse Archers', one: 'horse archer', kind: 'horse', era: 'medieval', origin: 'nomads', ranged: true, quick: true, hp: 24, attack: 8, defence: 1, cost: { coins: 14, material: 'hide', amount: 2 }, text: 'The Horde\'s riders: a shower of arrows and gone before the answer.' }),
  T({ id: 'glamour_knights', name: 'Glamour Knights', one: 'knight', kind: 'melee', era: 'medieval', origin: 'fae', quick: true, hp: 24, attack: 9, defence: 2, cost: { coins: 14, material: 'herbs', amount: 2 }, text: 'Fae riders that are not quite where they seem to be.' }),
  T({ id: 'bombardiers', name: 'Bombardiers', one: 'bombardier', kind: 'ranged', era: 'medieval', origin: 'alchemists', ranged: true, magic: true, hp: 18, attack: 12, defence: 1, cost: { coins: 16, material: 'sulphur', amount: 1 }, text: 'Flasks of fire from the back row. Everyone near the mark burns.' }),
  T({ id: 'templars', name: 'Templars', one: 'templar', kind: 'shield', era: 'medieval', origin: 'knights', hp: 32, attack: 9, defence: 5, cost: { coins: 16, material: 'iron', amount: 2 }, text: 'The Order\'s sworn: plate, faith and a shield that does not move.' }),
  T({ id: 'briar_wardens', name: 'Briar Wardens', one: 'warden', kind: 'healer', era: 'medieval', origin: 'druid', heal: 3, hp: 26, attack: 6, defence: 3, cost: { coins: 12, material: 'herbs', amount: 2 }, text: 'The Circle\'s own: they fight, and the green mends them as they do.' }),
];
export const TROOP_BY_ID: Readonly<Record<string, TroopDef>> = Object.fromEntries(TROOPS.map((t) => [t.id, t]));

/** The kinds a hero of each fighting role leads: what fits round them in the formation. */
export const LEADS: Readonly<Record<ClassRole, readonly TroopKind[]>> = {
  tank: ['shield', 'spear', 'melee'],
  bruiser: ['melee', 'spear', 'horse'],
  striker: ['melee', 'skirmish', 'horse'],
  shooter: ['ranged', 'skirmish', 'spear'],
  caster: ['magic', 'spear', 'shield'],
  healer: ['healer', 'shield', 'melee'],
  support: ['healer', 'ranged', 'melee'],
};
/** Callings that lead beasts or siege crews besides their role's kinds. */
export const LEADS_TOO: Partial<Record<ClassId, readonly TroopKind[]>> = {
  beast_tamer: ['beast'], shapeshifter: ['beast'], druid: ['beast'], hunter: ['beast'], ranger: ['beast'],
  engineer: ['siege'], alchemist: ['siege'],
};

/** Counters: the striking kind against the struck, as a share of the blow (1 is even). */
export const COUNTERS: Partial<Record<TroopKind, Partial<Record<TroopKind, number>>>> = {
  spear: { horse: 1.6, beast: 1.3 },
  horse: { ranged: 1.5, skirmish: 1.4, magic: 1.4, healer: 1.4, spear: 0.6 },
  ranged: { skirmish: 1.3, beast: 1.3, shield: 0.6 },
  magic: { shield: 1.4, melee: 1.2 },
  skirmish: { magic: 1.4, healer: 1.4, ranged: 1.3, shield: 0.7 },
  shield: { skirmish: 1.2 },
  beast: { ranged: 1.3, magic: 1.2, spear: 0.7 },
  siege: { melee: 0.6, shield: 0.6, horse: 0.5 },
};

/** The formation: nine places, three rows of three (0 to 2 the front, 6 to 8 the back). */
export const SQUAD_SLOTS = 9;
export const ROW_OF = (slot: number) => Math.floor(slot / 3) as 0 | 1 | 2;

/** A hero's command: how many troops they may lead (from `LEAD_BASE`, more by level, stage and Charisma, never over
 *  the formation), and how much better their troops fight for them (`COMMAND_*`: a share each). */
export const LEAD_BASE = 2;
export const LEAD_PER_LEVELS = 8;
export const LEAD_PER_CHA = 4;
export const COMMAND_PER_LEVEL = 0.015;
export const COMMAND_PER_STAGE = 0.08;
export const COMMAND_PER_CHA = 0.02;
/** A hero's own strength in the squad (sim/conquest/squads.ts heroStrength): troops' worth of them, by their health
 *  and blows against a plain soldier's (`TROOP_HP`, `TROOP_ATTACK`), weighted so that a seasoned hero in fine gear
 *  carries a squad (the owner's ask). */
export const TROOP_HP = 24;
export const TROOP_ATTACK = 6;
export const HERO_WEIGHT = 2;
/** The hero's strength is eased past the middle (a power under 1 on the troops' worth), so a capped hero in the best
 *  gear is a dozen squads' worth, not a hundred. */
export const HERO_CURVE = 0.85;

/** Raising troops: recruits come from the provinces held (a day's `recruits` each: data/conquest.ts TIERS, and
 *  `RECRUITS_HOME` from the town itself), a batch trains in `TRAIN_HOURS` (half with a barracks standing), and every
 *  soldier costs `UPKEEP` coins a day from the treasury. */
export const RECRUITS_HOME = 1;
export const RECRUITS_MOST = 60;
export const TRAIN_HOURS = 12;
export const TRAIN_BATCH_MOST = 9;
export const UPKEEP = 0.2;
/** Unpaid, this share of the troops waiting in the war camp drift home each day. */
export const DESERT_SHARE = 0.1;

/* ------------------------------------------------------------ armies (sim/conquest/armies.ts) */

/** Squads in one army at most. */
export const ARMY_SQUADS = 6;
/** A march from one province to the next, in game hours (longer the further apart their middles lie; a crossroads
 *  reached in `CROSSROADS_PACE` of it). */
export const MARCH_HOURS = 6;
export const MARCH_PER_CELL = 0.35;
export const CROSSROADS_PACE = 0.6;
/** Soldiers afield (an army outside the town's own provinces) cost this much more upkeep: they forage and buy. */
export const UPKEEP_AFIELD = 2;
/** A province of the town's without a garrison of `GARRISON_HOLDS` soldiers or an army in it may revolt and go free
 *  each day, from `REVOLT_GRACE_DAYS` after it was taken; the capital never. */
export const GARRISON_HOLDS = 3;
export const REVOLT_CHANCE = 0.02;
export const REVOLT_GRACE_DAYS = 5;

/* ------------------------------------------------------------ province battles (sim/conquest/battles.ts) */

/** The board: squads as pieces on a grid, the attackers from the west, the defenders in the east. */
export const BOARD_W = 12;
export const BOARD_H = 8;
/** A squad acts every BEAT_TICKS (one side, then the other), moves MOVE cells a turn, and strikes within reach. */
export const BEAT_TICKS = 20;
export const MOVE = 2;
/** A squad with RANGED_SHARE of its troops ranged strikes from REACH_RANGED. */
export const RANGED_SHARE = 0.34;
export const REACH_RANGED = 2;
/** The struck squad strikes back at this share of a blow. */
export const RIPOSTE = 0.6;
/** A hero's blow in a clash, in plain blows per point of their strength; their health in plain soldiers' per point. */
export const HERO_BLOW = 0.5;
export const HERO_HP = 1;
/** A squad routs when its worth falls under this share of what it marched in with, or its hero falls. */
export const ROUT_AT = 0.35;
/** A fort: the wall line's column, the walls' strength per fort level, the guard it gives those behind it, and how
 *  much a siege troop's `walls` takes off it a turn. */
export const WALL_X = 9;
export const WALL_HP = 12;
export const WALL_GUARD = 0.5;
export const SIEGE_PER_WALLS = 1;
/** A hero struck down: wounded, captured or killed (the owner's call); the founder gentler. */
export const HERO_FATE = { wounded: 0.6, captured: 0.3, killed: 0.1 };
export const FOUNDER_FATE = { wounded: 0.8, captured: 0.18, killed: 0.02 };
/** A captive's ransom: coins by their strength. */
export const RANSOM_PER_STRENGTH = 6;
export const RANSOM_LEAST = 30;
/** Experience to a hero for a battle won, and for one lost. */
export const XP_WON = 120;
export const XP_LOST = 40;
/** The foes' captains: strength and command by the day and the settlement's tier. */
export const CAPTAIN_BASE = 4;
export const CAPTAIN_PER_DAY = 0.35;
export const CAPTAIN_MOST = 45;
export const CAPTAIN_PER_TIER = 2;
/** Defending squads by settlement tier (hamlet to capital), and a lair's. */
export const DEFENDERS_BY_TIER = [1, 2, 2, 3, 4];
export const LAIR_SQUADS = 2;
/** The foes' own troops: beasts of a lair, and the garrison folk of a settlement with no study to its name. */
export const FOE_TROOPS: readonly TroopDef[] = [
  { id: 'lair_beasts', name: 'Lair beasts', one: 'beast', kind: 'beast', era: 'neolithic', hp: 30, attack: 7, defence: 1, quick: true, cost: { coins: 0 }, text: 'The things that den in a wild province.' },
  { id: 'great_beast', name: 'Great beast', one: 'great beast', kind: 'beast', era: 'neolithic', hp: 90, attack: 14, defence: 3, cost: { coins: 0 }, text: 'The lair\'s master.' },
  { id: 'levies', name: 'Levies', one: 'levy', kind: 'melee', era: 'neolithic', hp: 20, attack: 4, defence: 1, cost: { coins: 0 }, text: 'A province\'s folk under arms.' },
  { id: 'town_guard', name: 'Town guard', one: 'guard', kind: 'shield', era: 'neolithic', hp: 26, attack: 5, defence: 3, cost: { coins: 0 }, text: 'The watch of a settlement.' },
  { id: 'town_archers', name: 'Town archers', one: 'archer', kind: 'ranged', era: 'neolithic', hp: 18, attack: 6, defence: 0, ranged: true, cost: { coins: 0 }, text: 'Bows on the walls.' },
];
export const ALL_TROOPS: Readonly<Record<string, TroopDef>> = { ...TROOP_BY_ID, ...Object.fromEntries(FOE_TROOPS.map((t) => [t.id, t])) };

/* ------------------------------------------------------------ the rival realms (sim/conquest/rivals.ts) */

/** A rival realm moves an army no oftener than this (days), and on this share of the days it may. */
export const RIVAL_MOVE_DAYS = 5;
export const RIVAL_MOVE_CHANCE = 0.35;
/** ...and less the more it holds already (a share off per province). */
export const RIVAL_SATED = 0.08;
/** A rival army's strength (in squads' worth): a share of the power's troops, and a little a province held. */
export const RIVAL_PER_TROOP = 0.35;
export const RIVAL_PER_PROVINCE = 1.5;
/** A lair is cleared by a rival army of at least this strength. */
export const RIVAL_LAIR_STRENGTH = 18;
/** What a province held against a rival is worth in defence: its garrison's worth, its settlement's tier, its
 *  walls; the attacker needs `RIVAL_EDGE` times it. The troops a rival loses in the taking, per point of defence. */
export const DEFENCE_PER_TIER = 3;
export const DEFENCE_PER_WALL = 4;
export const RIVAL_EDGE = 1.25;
export const RIVAL_LOSS_PER_DEFENCE = 1.5;
