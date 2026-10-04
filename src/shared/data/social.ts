import { CHILD_DAYS } from './pace';
// Relationships and families (DESIGN §7). All numbers are starting points for tuning.

/** Opinion runs -100..100. At or above FRIEND they're friends; at or below RIVAL, rivals. */
export const FRIEND = 40;
export const RIVAL = -30;
/** Two single adults this fond of each other may become a couple (chance per hour), and marry. */
export const COUPLE = 75;
export const COUPLE_CHANCE = 0.02;
export const MARRY = 90;
export const MARRY_CHANCE = 0.02;
/** A married couple with a free bed may welcome a child (chance per hour), up to this many. */
export const CHILD_CHANCE = 0.01;
export const MAX_CHILDREN = 2;
/** Children grow up after about a week of real time (a game hour is a real minute). */
export const CHILD_HOURS = CHILD_DAYS * 24;
/** Skill levels a School adds to every skill when a child grows up. */
export const SCHOOL_BONUS = 2;

/** Each game hour near each other: opinion gained (times the pair's chemistry, more with Social skill),
 *  and the chance of friction. Chemistry is fixed per pair, from -0.4 (they clash) to 1.4. */
export const WARM_PER_HOUR = 1.2;
export const FRICTION_CHANCE = 0.03;
export const FRICTION = 3;
/** People count as together within this many pixels. */
export const NEAR_PX = 6 * 32;

/** Grief: for a partner, a friend (morale and game hours). */
export const GRIEF_PARTNER: [number, number] = [-20, 72];
export const GRIEF_FRIEND: [number, number] = [-8, 24];
/** With a graveyard: grief lasts this share as long, and the town's mourning weighs this much (instead of -8). */
export const GRAVEYARD_GRIEF = 0.5;
export const MOURNING_MORALE = -8;
export const MOURNING_LAID_TO_REST = -3;
/** A wedding cheers everyone up this much, for this many game hours. */
export const WEDDING_MORALE: [number, number] = [5, 24];
