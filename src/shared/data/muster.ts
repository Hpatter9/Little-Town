// Sending a party yourself (the owner's ask: control over who goes, without breaking the spell of a town that runs
// itself). From a place on the Expedition Board the player raises a party: an adventurer steps up to lead and puts a
// party together with a reason for each pick; the player swaps people in and out (some say no, and are talked round
// with coins or ordered along), hears the leader's read of the odds, chooses how boldly they go and what they pack, and
// sends them. On the road a commanded party asks one or two questions (the full-screen box, a default if nobody
// answers), and when it's home a debrief says what it cost and what it won. The town still sends its own parties
// when nobody gives an order.

/** What the player may pack: rations (a share of the food a trip needs), spare torches for a dungeon. */
export type Rations = 'lean' | 'normal' | 'plenty';
export const RATIONS: Readonly<Record<Rations, { food: number; name: string; text: string }>> = {
  lean: { food: 0.6, name: 'Lean', text: 'Light packs: more room for loot, hungry by the end' },
  normal: { food: 1, name: 'Enough', text: 'What the trip needs' },
  plenty: { food: 1.5, name: 'Plenty', text: 'Heavy packs: nobody goes hungry, and they come home in better heart' },
};
/** The most spare torches a delving party may take beyond the town's own reckoning. */
export const MOST_EXTRA_TORCHES = 6;
/** Talking round someone who won't go: coins from the treasury into their purse, by the danger (times the era's
 *  PURSE_SCALE). Ordered along instead, they go sore (`ORDER_MORALE` for `ORDER_HOURS`). */
export const PERSUADE_BASE = 8;
export const PERSUADE_PER_DANGER = 1 / 15;
export const ORDER_MORALE = -10;
export const ORDER_HOURS = 48;
/** Of those who'd rather not fight, the share who say so (by who they are and where to). */
export const RELUCTANT_SHARE = 0.4;
/** The leader's read of the odds: the party's strength over the place's danger (sim/parties.ts), at or above each. */
export const ODDS: readonly [number, string][] = [
  [2.2, 'We will walk it.'],
  [1.4, 'It should go our way.'],
  [1, 'Even odds, I would say.'],
  [0.7, 'It will be hard. Some of us may fall.'],
  [0, 'Some of us will not come back.'],
];
/** Questions a commanded party asks on the road: at most this many a trip, the first on the way out. */
export const MOST_CROSSROADS = 2;
/** How long a road question waits for an answer (game hours) before the leader decides. */
export const CROSSROADS_HOURS = 2;
/** A debrief waits this long on screen before it's put away. */
export const DEBRIEF_HOURS = 10;
