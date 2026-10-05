// Parties that form themselves (PLAN.md step 5; the owner's decision: the player keeps a veto on a destination and
// the treasury may post a bounty on one). An adventurer at home, rested and healed, proposes a trip; they recruit
// a balanced party by friendship and calling; they go only if the party is strong enough for the place.

/** Hours between one party setting out and the next being formed, and the hours of the day a party sets out. */
export const PARTY_GAP_HOURS = 8;
export const SET_OUT_FROM = 6;
export const SET_OUT_UNTIL = 14;
/** Fit to go: health at least this share of the most, rest and food at least these, and this many hours since their
 *  last trip came home. */
export const FIT_HP = 0.75;
export const FIT_REST = 0.5;
export const FIT_FOOD = 0.4;
export const TRIP_REST_HOURS = 24;
/** The town keeps at least this share of its grown-ups at home (guards, keepers and the founder are kept besides). */
export const KEEP_HOME_SHARE = 0.5;
/** No party leaves a town of fewer grown-ups than this (a founder alone with one companion stays put). */
export const MIN_TOWN_FOR_TRIPS = 3;
/** How strong a party must be for a place: its strength (each member's health, more by level) against the place's
 *  danger (the heaviest group of foes it may meet, by their health), times DARE (a bold leader dares more). */
export const DARE = 1.15;
export const DARE_BOLD = 0.8;
export const STRENGTH_PER_LEVEL = 0.08;
/** What draws a party to a destination: a bounty on it (per coin), loot, a fight for an adventurer, somewhere new. */
export const PULL_BOUNTY = 0.5;
export const PULL_NEW = 6;
export const PULL_FIGHT = 4;
/** Recruiting: the weight of a member's opinion of the party (per point), of filling a needed role, of being an
 *  adventurer, and of being devoted to someone going. */
export const RECRUIT_OPINION = 1 / 20;
export const RECRUIT_ROLE = 4;
export const RECRUIT_ADVENTURER = 2;
export const RECRUIT_DEVOTED = 8;
/** A bounty the treasury may post: the least, and the step the panel offers (times the era's PURSE_SCALE). */
export const BOUNTY_STEP = 25;
export const BOUNTY_MOST = 4;
