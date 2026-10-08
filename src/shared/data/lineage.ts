// Schools, apprenticeships and family trees (the owner's pick of the content updates, the eighth; sim/lineage.ts).

/** Lessons run of a morning, apprenticeships of an afternoon (game hours). */
export const LESSON_FROM = 9;
export const LESSON_UNTIL = 12;
export const APPRENTICE_FROM = 13;
export const APPRENTICE_UNTIL = 17;
/** A school teaches twice as fast as the elders at a study or the fire. */
export const SCHOOL_PACE = 2;
/** Hours of lessons for a level of learning at coming of age (spread over research, social and their passion). */
export const LESSON_HOURS_PER_LEVEL = 10;
/** The most levels schooling gives in all. */
export const LESSON_LEVELS_MOST = 6;
/** A child is apprenticed from this far through childhood (a share of it). */
export const APPRENTICE_FROM_SHARE = 0.4;
/** Hours at a master's side for a level of their trade, and the share of the master's level it may reach. */
export const APPRENTICE_HOURS_PER_LEVEL = 6;
export const APPRENTICE_SHARE = 0.6;
/** What a child takes from their parents at coming of age: each parent's trait on this chance (up to two), a parent's
 *  nature on this one; and how a parent's enemy is thought of. */
export const INHERIT_TRAIT = 0.3;
export const INHERIT_TRAITS_MOST = 2;
export const INHERIT_NATURE = 0.45;
export const INHERITED_GRUDGE = -35;
/** A family line's renown (each member's titles, foes felled and level, and the line's own deeds), and when it is famous. */
export const RENOWN_TITLE = 10;
export const RENOWN_FELLED = 2;
export const RENOWN_LEVEL = 1;
export const RENOWN_BLACK = -15;
export const FAMOUS_AT = 60;
/** Families kept in the record (the oldest dead without living kin forgotten past it). */
export const KIN_MOST = 400;
