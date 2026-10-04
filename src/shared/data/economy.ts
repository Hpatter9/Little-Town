// The townsfolk's own money (the owner's direction, PLAN.md). The coins are theirs, not the town's: each person earns
// by their work and keeps a purse; the town's purse is the founder's **treasury**. What each kind of work pays, so
// some get rich and some don't:
//
// - **Gathering, farming, mining, fishing**: whoever brings a load into the stores sells it to the town there and then,
//   at GATHER_SHARE of its worth (the shop sells it on to travellers at the full price: the treasury's margin).
// - **Building**: a day rate from the treasury, by the hour worked.
// - **Study**: a stipend from the treasury, by the hour.
// - **Crafting**: a piece rate for what's made to sell (data/shop.ts PIECE_RATE; a furnishing bought outright).
// - **Keeping a shop or the tavern**: a cut of every sale.
// - **Adventuring**: every coin a party finds, and every bounty it earns, is split among the party. The richest road,
//   and the deadliest.
//
// The treasury pays for work only from what it holds above TREASURY_KEEP (it must still buy what the town can't
// gather); a poor treasury pays less, and the work still gets done (people's goodwill, for now: rent and tax come
// next, PLAN.md step 2).

/** What the stores pay for a unit brought in, as a share of its worth (data/trade.ts WORTH). */
export const GATHER_SHARE = 0.5;
/** A builder's pay for an hour's work, and a scholar's stipend (both times the era's PURSE_SCALE). */
export const BUILD_PER_HOUR = 2;
export const STUDY_PER_HOUR = 1.5;
/** A keeper's cut of each sale made in their shop or tavern. */
export const KEEPER_CUT = 0.15;
/** Coins the treasury keeps back before it pays for work. */
export const TREASURY_KEEP = 20;
