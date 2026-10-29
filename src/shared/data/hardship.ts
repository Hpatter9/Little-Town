// Hard times (docs/notes/deaths-common.md, the owner's "deaths should be common"): the dangers that come of real want,
// not of the townsfolk's own slips. A fever breaks out where the town is crowded and dirty, an open wound left
// untended may fester, and winter is cold to those sleeping rough and hungrier for everyone. The rules are in
// sim/hardship.ts; each runs only with the autopilot on. None of them kills the founder (the player's character): they
// are laid low, at 1 health, as a raid's blow never lets them bleed out in town.

/** Fevers: none in a town of fewer than this many at home (a band round one fire keeps clean enough), nor in its
 *  first days (a new camp is clean). */
export const FEVER_FROM = 5;
export const FEVER_FROM_DAY = 6;
/** The chance a day that a fever breaks out, for a town of `FEVER_TOWN` with every bed filled and a well; more with
 *  more people, those without a bed (`FEVER_BEDLESS` at all of them), no well (`FEVER_NO_WELL`) and in winter
 *  (`FEVER_WINTER`). */
export const FEVER_DAILY = 0.4;
export const FEVER_TOWN = 10;
export const FEVER_BEDLESS = 2;
export const FEVER_NO_WELL = 0.6;
export const FEVER_WINTER = 0.6;
/** The sick pass it on: the chance an hour for each person within `FEVER_NEAR` cells (by the same squalor). */
export const FEVER_SPREAD = 0.015;
export const FEVER_NEAR = 2;
/** Someone who has had it is spared another for this many days (so a fever burns out). */
export const FEVER_SPARED_DAYS = 20;
/** How long a fever burns (game hours), and the health it takes an hour (half that in a sickbed). While it burns the
 *  body doesn't mend. */
export const FEVER_HOURS: [number, number] = [18, 36];
export const FEVER_HP_PER_HOUR = 2;
export const FEVER_TENDED = 0.5;

/** Festering: an open wound (a cut, bite or burn) at least this bad, untended (not in a sickbed), may turn bad: the
 *  chance an hour, twice that for someone with no bed. A dressing in store cleans it instead. */
export const FESTER_FROM = 0.3;
export const FESTER_CHANCE = 0.02;
export const FESTER_BEDLESS = 2;
/** A festering wound takes this much health an hour, and nothing mends meanwhile, till the body throws it off: the
 *  chance an hour in a sickbed, in a bed of their own, and up and about. */
export const FESTER_HP_PER_HOUR = 2;
export const FESTER_CLEARS = { sickbed: 0.25, bed: 0.06, about: 0.035 } as const;

/** Winter: everyone eats this much more (a share of the ordinary hunger), and someone asleep on the ground loses this
 *  much health an hour and doesn't mend (`WINTER_SNOW` times that in snow). */
export const WINTER_APPETITE = 0.25;
export const COLD_HP_PER_HOUR = 2.5;
export const WINTER_SNOW = 1.5;
