// Attributes (the owner's ask: a turn-based fight where stats matter). Everyone who fights has five: Strength (the
// weight of a blow), Dexterity (how often they act, their aim and their footwork), Vitality (health, stamina),
// Intellect (spell power, mana) and Wisdom (healing, mana and how fast it comes back). A plain person has ATTR_BASE of
// each; a class grows them as its people level, each class in its own proportions (CLASS_ATTRS), and the work skills
// add a little (a smith's arm, a scholar's mind). sim/attributes.ts works them out; combat.ts and actions.ts use them.
import type { ClassId } from './classes';

export interface Attrs {
  str: number;
  dex: number;
  vit: number;
  int: number;
  wis: number;
}
export const ATTR_KEYS = ['str', 'dex', 'vit', 'int', 'wis'] as const;
export const ATTR_NAMES: Record<keyof Attrs, string> = { str: 'Strength', dex: 'Dexterity', vit: 'Vitality', int: 'Intellect', wis: 'Wisdom' };

/** What a plain grown-up has of each. */
export const ATTR_BASE = 8;
/** Points a class gives out each level (in its proportions), and at its first level. */
export const ATTR_PER_LEVEL = 1.6;
export const ATTR_AT_START = 6;
/** What a work skill level adds to its attribute. */
export const ATTR_PER_SKILL = 0.35;

/** How each class grows (shares that add up to 1). */
export const CLASS_ATTRS: Record<ClassId, Attrs> = {
  knight: { str: 0.3, dex: 0.1, vit: 0.4, int: 0.05, wis: 0.15 },
  warrior: { str: 0.45, dex: 0.15, vit: 0.35, int: 0.0, wis: 0.05 },
  ranger: { str: 0.15, dex: 0.45, vit: 0.2, int: 0.05, wis: 0.15 },
  archer: { str: 0.15, dex: 0.55, vit: 0.15, int: 0.1, wis: 0.05 },
  beast_tamer: { str: 0.2, dex: 0.25, vit: 0.25, int: 0.05, wis: 0.25 },
  mage: { str: 0.0, dex: 0.15, vit: 0.1, int: 0.55, wis: 0.2 },
  witch: { str: 0.0, dex: 0.15, vit: 0.1, int: 0.45, wis: 0.3 },
  white_mage: { str: 0.05, dex: 0.1, vit: 0.15, int: 0.2, wis: 0.5 },
  monk: { str: 0.3, dex: 0.4, vit: 0.2, int: 0.0, wis: 0.1 },
  assassin: { str: 0.25, dex: 0.55, vit: 0.1, int: 0.05, wis: 0.05 },
  necromancer: { str: 0.0, dex: 0.1, vit: 0.15, int: 0.5, wis: 0.25 },
  summoner: { str: 0.0, dex: 0.1, vit: 0.1, int: 0.45, wis: 0.35 },
  blood_knight: { str: 0.4, dex: 0.15, vit: 0.35, int: 0.05, wis: 0.05 },
  bard: { str: 0.1, dex: 0.35, vit: 0.1, int: 0.2, wis: 0.25 },
  druid: { str: 0.1, dex: 0.15, vit: 0.2, int: 0.25, wis: 0.3 },
  alchemist: { str: 0.05, dex: 0.3, vit: 0.15, int: 0.4, wis: 0.1 },
  engineer: { str: 0.15, dex: 0.3, vit: 0.2, int: 0.3, wis: 0.05 },
  dragoon: { str: 0.4, dex: 0.3, vit: 0.25, int: 0.0, wis: 0.05 },
  samurai: { str: 0.35, dex: 0.4, vit: 0.15, int: 0.0, wis: 0.1 },
  guardian: { str: 0.2, dex: 0.05, vit: 0.55, int: 0.0, wis: 0.2 },
  shaman: { str: 0.1, dex: 0.15, vit: 0.15, int: 0.3, wis: 0.3 },
  spellblade: { str: 0.3, dex: 0.25, vit: 0.15, int: 0.3, wis: 0.0 },
  chronomancer: { str: 0.0, dex: 0.3, vit: 0.1, int: 0.35, wis: 0.25 },
  hunter: { str: 0.25, dex: 0.4, vit: 0.25, int: 0.05, wis: 0.05 },
  dancer: { str: 0.15, dex: 0.55, vit: 0.1, int: 0.05, wis: 0.15 },
};
const PLAIN: Attrs = { str: 0.25, dex: 0.25, vit: 0.3, int: 0.1, wis: 0.1 };
export const classAttrs = (cls: ClassId | null | undefined): Attrs => (cls ? CLASS_ATTRS[cls] : PLAIN);

/* ------------------------------------------------------------ what they do (combat.ts, actions.ts) */

/** Each point over the base: a blow's share more (Strength), a spell's (Intellect), healing's (Wisdom), health's (Vitality). */
export const STR_DAMAGE = 0.03;
export const INT_POWER = 0.03;
export const WIS_HEALING = 0.025;
export const VIT_HP = 0.025;
/** Dexterity: aim and dodge a share per point, and the time between turns ((base + 2) / (dex + 2)) ** DEX_SPEED. */
export const DEX_AIM = 0.006;
export const DEX_DODGE = 0.004;
export const DEX_SPEED = 0.6;
export const speedOfDex = (dex: number) => ((ATTR_BASE + 2) / (Math.max(1, dex) + 2)) ** DEX_SPEED;

/** Mana: spells cost it; it comes of Intellect and Wisdom and returns a little each turn. Stamina: skills cost it; it
 *  comes of Vitality and Dexterity, returns each turn, and a plain blow brings some back. */
export const maxManaOf = (a: Attrs) => Math.round(10 + a.int * 2 + a.wis * 1.5);
export const maxStaminaOf = (a: Attrs) => Math.round(12 + a.vit * 1.5 + a.dex);
export const manaRegenOf = (a: Attrs) => 1 + a.wis * 0.15;
export const staminaRegenOf = (a: Attrs) => 2 + a.dex * 0.1;
export const STAMINA_PER_BLOW = 3;
/** What a spell or skill costs: by the level it's learned at. */
export const spellCost = (level: number) => 4 + Math.round(level / 3);
export const skillCost = (level: number) => 3 + Math.round(level / 4);

/** The limit gauge (0 to 1) behind a class's ultimate: it fills from hurt taken (a share of one's health) and, less,
 *  from hurt dealt (a share of the foe's); full, the ultimate is loosed and it empties. */
export const LIMIT_FROM_HURT = 0.6;
export const LIMIT_FROM_DEALT = 0.25;
