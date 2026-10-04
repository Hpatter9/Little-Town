// Classes: twenty-five callings, each a line of five stages that a townsperson grows through as they level (levels.ts),
// so a hundred and twenty-five in all. Every grown-up is given one once, at random but weighted by what they're good
// at (`affinity`) and by how common the calling is (`rarity`: some are rare indeed), and keeps it for life. A class
// sets what its people wear and wield (`armour`, `weapons`: a mage in cloth with a staff, a knight in plate with a
// sword and shield), how they fight (`role`, `stats`), and the skills and spells they learn as they level
// (data/abilities.ts, data/spells.ts).

import type { ArmourWeight } from './armour';
import type { Skill } from './skills';
import type { FamilyId } from './weapons';

export const CLASSES = [
  'knight', 'warrior', 'ranger', 'archer', 'beast_tamer',
  'mage', 'witch', 'white_mage', 'monk', 'assassin',
  'necromancer', 'summoner', 'blood_knight', 'bard', 'druid',
  'alchemist', 'engineer', 'dragoon', 'samurai', 'guardian',
  'shaman', 'spellblade', 'chronomancer', 'hunter', 'dancer',
] as const;
export type ClassId = (typeof CLASSES)[number];

/** How a class fights: in the line holding foes back, striking, shooting, casting, healing, or lifting the others. */
export type ClassRole = 'tank' | 'bruiser' | 'striker' | 'shooter' | 'caster' | 'healer' | 'support';

/** What a class adds, as shares (hp 1.2: a fifth more health) or plain amounts (dodge 0.05: five in a hundred more). */
export interface ClassStats {
  hp: number;
  damage: number;
  accuracy: number;
  dodge: number;
  armor: number;
  /** Spell power (a share more), and healing done (a share more). */
  power: number;
  healing: number;
  /** Time between actions (a share: under 1 is quicker). */
  speed: number;
  crit: number;
}

export interface ClassDef {
  id: ClassId;
  /** The five stages' names, from what they start as to what they become. */
  stages: readonly [string, string, string, string, string];
  description: string;
  role: ClassRole;
  /** Fights from range (shooters and casters) whatever they hold. */
  ranged: boolean;
  /** How common it is: 1 for the common callings, down to a few in a hundred for the rarest. */
  rarity: number;
  /** The work skills that draw someone to it, and how strongly. */
  affinity: Partial<Record<Skill, number>>;
  /** What its people may wear (trinkets go with anything) and wield. */
  armour: readonly ArmourWeight[];
  weapons: readonly FamilyId[];
  stats: Partial<ClassStats>;
}

const C = (d: ClassDef) => d;
const COMMON = 1;
const UNCOMMON = 0.5;
const RARE = 0.2;
const VERY_RARE = 0.07;

export const CLASS_DEFS: Readonly<Record<ClassId, ClassDef>> = {
  knight: C({ id: 'knight', stages: ['Squire', 'Knight', 'Knight Errant', 'Paladin', 'Lord Paladin'], description: 'Holds the line in plate behind a shield; later calls on holy light.', role: 'tank', ranged: false, rarity: COMMON, affinity: { melee: 2, social: 1 }, armour: ['heavy', 'medium', 'shield'], weapons: ['sw', 'mc', 'sp', 'pl', 'gs'], stats: { hp: 1.25, armor: 0.05, damage: 1 } }),
  warrior: C({ id: 'warrior', stages: ['Brawler', 'Warrior', 'Berserker', 'Warlord', 'Titan'], description: 'Fights with whatever is heaviest, and harder the worse it gets.', role: 'bruiser', ranged: false, rarity: COMMON, affinity: { melee: 2, construction: 0.5 }, armour: ['medium', 'heavy', 'light', 'shield'], weapons: ['ax', 'gs', 'mc', 'sw', 'fl', 'th'], stats: { hp: 1.15, damage: 1.2 } }),
  ranger: C({ id: 'ranger', stages: ['Scout', 'Ranger', 'Pathfinder', 'Warden', 'Wildlord'], description: 'At home in the wild: bow and blade, beast lore and a little nature magic.', role: 'shooter', ranged: true, rarity: COMMON, affinity: { ranged: 1.5, gathering: 1, animals: 0.5 }, armour: ['light', 'medium'], weapons: ['bw', 'lb', 'sp', 'sw', 'dg', 'th'], stats: { accuracy: 0.05, dodge: 0.03 } }),
  archer: C({ id: 'archer', stages: ['Bowman', 'Archer', 'Marksman', 'Sharpshooter', 'Hawkeye'], description: 'Shoots from the back, and rarely misses: bows, crossbows, and in time guns.', role: 'shooter', ranged: true, rarity: COMMON, affinity: { ranged: 2.5 }, armour: ['light'], weapons: ['bw', 'lb', 'cb', 'sl', 'th', 'pi', 'lg', 'ag'], stats: { accuracy: 0.08, crit: 0.05, damage: 1.05 } }),
  beast_tamer: C({ id: 'beast_tamer', stages: ['Herder', 'Beast Tamer', 'Beastmaster', 'Packleader', 'Beast Lord'], description: 'Fights beside a beast companion, and wins wild ones over.', role: 'support', ranged: false, rarity: UNCOMMON, affinity: { animals: 2.5 }, armour: ['light'], weapons: ['fl', 'sp', 'dg', 'cl', 'bw'], stats: { hp: 1.05 } }),
  mage: C({ id: 'mage', stages: ['Apprentice', 'Mage', 'Sorcerer', 'Archmage', 'Arcanist'], description: 'Fire, frost and lightning from afar; frail up close.', role: 'caster', ranged: true, rarity: UNCOMMON, affinity: { research: 2.5 }, armour: ['cloth'], weapons: ['st', 'wd', 'dg'], stats: { hp: 0.85, power: 1.3 } }),
  witch: C({ id: 'witch', stages: ['Hedge Witch', 'Witch', 'Hexer', 'Coven Mother', 'Crone Queen'], description: 'Curses, poisons and sleeps: weakens foes more than it burns them.', role: 'caster', ranged: true, rarity: UNCOMMON, affinity: { medicine: 1, research: 1.5 }, armour: ['cloth'], weapons: ['wd', 'st', 'dg', 'sc'], stats: { hp: 0.9, power: 1.2 } }),
  white_mage: C({ id: 'white_mage', stages: ['Acolyte', 'White Mage', 'Cleric', 'High Priest', 'Saint'], description: 'Heals, shields and raises the fallen; holy light against the dead.', role: 'healer', ranged: true, rarity: COMMON, affinity: { medicine: 2.5, social: 0.5 }, armour: ['cloth', 'light', 'shield'], weapons: ['mc', 'st', 'wd'], stats: { hp: 0.95, healing: 1.4, power: 1.1 } }),
  monk: C({ id: 'monk', stages: ['Novice', 'Monk', 'Master', 'Grandmaster', 'Ascendant'], description: 'Bare-handed or with a staff: quick, hard to hit, and heals themselves.', role: 'striker', ranged: false, rarity: COMMON, affinity: { melee: 1.5, medicine: 0.5 }, armour: ['cloth', 'light'], weapons: ['cl', 'st', 'mc', 'sp'], stats: { dodge: 0.08, speed: 0.85, damage: 1.05 } }),
  assassin: C({ id: 'assassin', stages: ['Cutpurse', 'Thief', 'Assassin', 'Shadow', 'Nightblade'], description: 'Quick blades and poison from the shadows: strikes true more than most.', role: 'striker', ranged: false, rarity: UNCOMMON, affinity: { melee: 1, ranged: 1, social: 0.5 }, armour: ['light'], weapons: ['dg', 'th', 'sw', 'cb', 'pi', 'cl'], stats: { crit: 0.12, dodge: 0.06, speed: 0.9 } }),
  necromancer: C({ id: 'necromancer', stages: ['Gravedigger', 'Necromancer', 'Deathcaller', 'Lich Lord', 'Death Incarnate'], description: 'Raises fallen enemies to fight for the town; drains life and spreads decay.', role: 'caster', ranged: true, rarity: VERY_RARE, affinity: { research: 1.5, medicine: 1 }, armour: ['cloth'], weapons: ['st', 'wd', 'sc', 'dg'], stats: { hp: 0.9, power: 1.25 } }),
  summoner: C({ id: 'summoner', stages: ['Caller', 'Summoner', 'Evoker', 'Conjurer', 'Planeswalker'], description: 'Calls spirits, elementals and beasts of legend to fight at their side.', role: 'caster', ranged: true, rarity: RARE, affinity: { research: 1.5, social: 1 }, armour: ['cloth'], weapons: ['st', 'wd'], stats: { hp: 0.85, power: 1.25 } }),
  blood_knight: C({ id: 'blood_knight', stages: ['Bloodsworn', 'Blood Knight', 'Reaver', 'Blood Lord', 'Sanguine King'], description: 'Heals from the wounds they deal, and hits harder the more hurt they are.', role: 'bruiser', ranged: false, rarity: VERY_RARE, affinity: { melee: 2.5 }, armour: ['heavy', 'medium'], weapons: ['sw', 'gs', 'ax', 'sc'], stats: { hp: 1.15, damage: 1.15 } }),
  bard: C({ id: 'bard', stages: ['Minstrel', 'Bard', 'Skald', 'Virtuoso', 'Maestro'], description: 'Songs that steady the party and shake the foe.', role: 'support', ranged: true, rarity: UNCOMMON, affinity: { social: 2.5 }, armour: ['light', 'cloth'], weapons: ['sw', 'dg', 'bw', 'wd'], stats: { power: 1.1 } }),
  druid: C({ id: 'druid', stages: ['Herbalist', 'Druid', 'Shapeshifter', 'Archdruid', 'Green Sage'], description: 'Roots, thorns and storms; mends with the green; takes a beast\'s shape.', role: 'healer', ranged: true, rarity: UNCOMMON, affinity: { farming: 1.5, gathering: 1, medicine: 0.5 }, armour: ['light', 'cloth'], weapons: ['st', 'sc', 'sp', 'wd'], stats: { healing: 1.2, power: 1.15 } }),
  alchemist: C({ id: 'alchemist', stages: ['Apothecary', 'Alchemist', 'Bombardier', 'Transmuter', 'Philosopher'], description: 'Throws flasks of fire and acid, and brews tonics for the party.', role: 'support', ranged: true, rarity: UNCOMMON, affinity: { crafting: 1.5, medicine: 1 }, armour: ['light', 'cloth'], weapons: ['th', 'dg', 'pi', 'wd'], stats: { power: 1.1, healing: 1.1 } }),
  engineer: C({ id: 'engineer', stages: ['Tinker', 'Engineer', 'Gunsmith', 'Artificer', 'Machinist'], description: 'Guns, turrets and contraptions; mends armour mid-fight.', role: 'shooter', ranged: true, rarity: UNCOMMON, affinity: { construction: 1.5, crafting: 1.5 }, armour: ['medium', 'light', 'shield'], weapons: ['pi', 'lg', 'sg', 'ag', 'en', 'hv', 'mc', 'cb'], stats: { armor: 0.03, damage: 1.05 } }),
  dragoon: C({ id: 'dragoon', stages: ['Pikeman', 'Lancer', 'Dragoon', 'Wyvern Knight', 'Dragon Lord'], description: 'Leaps high and comes down spear-first.', role: 'bruiser', ranged: false, rarity: RARE, affinity: { melee: 1.5, animals: 1 }, armour: ['heavy', 'medium'], weapons: ['sp', 'pl'], stats: { damage: 1.2, hp: 1.1 } }),
  samurai: C({ id: 'samurai', stages: ['Swordsman', 'Blademaster', 'Samurai', 'Kensei', 'Sword Saint'], description: 'One perfect cut: draws and strikes true more than any.', role: 'striker', ranged: false, rarity: RARE, affinity: { melee: 2.5 }, armour: ['medium', 'light'], weapons: ['sw', 'gs', 'lb'], stats: { crit: 0.1, damage: 1.15, accuracy: 0.05 } }),
  guardian: C({ id: 'guardian', stages: ['Shieldbearer', 'Guardian', 'Sentinel', 'Bulwark', 'Aegis'], description: 'A wall of a person: draws the blows and turns them.', role: 'tank', ranged: false, rarity: COMMON, affinity: { melee: 1, construction: 1 }, armour: ['heavy', 'shield', 'medium'], weapons: ['mc', 'sw', 'sp', 'ax'], stats: { hp: 1.35, armor: 0.08, damage: 0.9 } }),
  shaman: C({ id: 'shaman', stages: ['Spirit Talker', 'Shaman', 'Witch Doctor', 'Spirit Chief', 'Totem Lord'], description: 'Totems and spirits: heals and hexes in one hand.', role: 'healer', ranged: true, rarity: UNCOMMON, affinity: { medicine: 1, animals: 1, social: 1 }, armour: ['light', 'cloth'], weapons: ['st', 'sp', 'mc', 'wd'], stats: { healing: 1.15, power: 1.15 } }),
  spellblade: C({ id: 'spellblade', stages: ['Spellsword', 'Red Mage', 'Battlemage', 'Spellblade', 'Arcane Knight'], description: 'Sword in one hand, spell in the other: a little of everything.', role: 'bruiser', ranged: false, rarity: RARE, affinity: { melee: 1, research: 1 }, armour: ['medium', 'light', 'cloth'], weapons: ['sw', 'gs', 'st', 'wd'], stats: { power: 1.1, damage: 1.05 } }),
  chronomancer: C({ id: 'chronomancer', stages: ['Timekeeper', 'Chronomancer', 'Time Weaver', 'Epoch Sage', 'Chronarch'], description: 'Hastens friends and slows foes; at the last, stops time itself.', role: 'support', ranged: true, rarity: VERY_RARE, affinity: { research: 2.5 }, armour: ['cloth'], weapons: ['st', 'wd'], stats: { power: 1.25, speed: 0.9, hp: 0.85 } }),
  hunter: C({ id: 'hunter', stages: ['Trapper', 'Hunter', 'Stalker', 'Beast Slayer', 'Monster Hunter'], description: 'Traps, nets and big shots: deadly to beasts and monsters.', role: 'shooter', ranged: true, rarity: COMMON, affinity: { ranged: 1.5, gathering: 1.5 }, armour: ['light', 'medium'], weapons: ['cb', 'bw', 'lb', 'lg', 'sg', 'sp', 'th', 'ax'], stats: { damage: 1.05, crit: 0.04 } }),
  dancer: C({ id: 'dancer', stages: ['Performer', 'Dancer', 'Blade Dancer', 'Mirage', 'Muse'], description: 'Dances that charm foes and quicken friends; impossible to pin down.', role: 'support', ranged: false, rarity: RARE, affinity: { social: 1.5, melee: 0.5 }, armour: ['light', 'cloth'], weapons: ['dg', 'fl', 'cl', 'th'], stats: { dodge: 0.1, speed: 0.9 } }),
};

/** The levels at which each stage is reached (levels.ts: a class evolves into its next stage there). */
export const STAGE_LEVELS = [1, 12, 30, 55, 85] as const;
/** The last stage: from its level on, the chance each day someone ascends to it (otherwise only a quest or an event
 *  brings it, or a wanderer who already has). */
export const ASCEND_DAILY = 0.015;
/** Each stage past the first adds this much to the class's stats' edge (hp, damage, power...). */
export const STAGE_STEP = 0.12;

/** A Blood Knight's: the share of damage dealt they heal, and their extra damage below half health. */
export const BLOOD_LIFESTEAL = 0.35;
export const BLOOD_FURY = 1.3;
/** Allies raised by one Necromancer in one fight, and the range (px) they reach in town. */
export const NECRO_RAISES = 2;
export const NECRO_RANGE = 250;
/** Beast Tamer: how close a wild beast must come to be tamed (px), and how often (seconds). */
export const TAME_RANGE = 150;
export const TAME_EVERY = 20;

/** What a class's name is at a stage (0 to 4). */
export const className = (cls: ClassId, stage: number) => CLASS_DEFS[cls].stages[Math.max(0, Math.min(4, stage))];
