// Disputes the founder judges (sim/disputes.ts): the numbers. A quarrel between two townsfolk who are at odds, or a
// theft one accuses the other of. The judgements and what each does are in sim/disputes.ts.

/** The chance each day that a dispute comes to the founder, the hour, the days between, and the grown folk the town needs. */
export const DISPUTE_PER_DAY = 0.15;
export const DISPUTE_HOUR = 10;
export const DISPUTE_GAP_DAYS = 4;
export const DISPUTE_PEOPLE = 5;
/** Two folk quarrel when they like each other no better than this. */
export const QUARREL_AT = -30;
/** The chance an accused thief did it. */
export const THEFT_GUILTY = 0.6;
/** What a quarrel's or theft's coins come to. */
export const THEFT_COINS: [number, number] = [5, 20];
/** The morale each side takes: the one sided with gains, the other loses; the whole town's mood shifts by `MOOD`. */
export const SIDE_MORALE = 6;
export const MOOD = 1;
/** How much a judgement moves a person's regard for the founder, and the bloc's standing. */
export const REGARD = 10;
export const BLOC_MOVE = 3;
