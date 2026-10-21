// Duels (sim/duel.ts): the numbers. The founder may challenge a rival, a troublemaker or the visiting champion; a rival
// may challenge them.

/** The founder (and a person they fight) away in the duel (`Person.away`). */
export const DUEL_AWAY = -5_000_002;
/** Duels' ids (the fight screen's) start here, apart from the arena's and the town's own ids. */
export const DUEL_IDS = 7_500_000;
/** In a duel to yield, each side gives in under this share of its health. */
export const DUEL_YIELD = 0.3;
/** In a duel to yield, the chance that the one struck down outright does not get up again. */
export const DUEL_DEATH = 0.15;
/** The founder wants at least this share of their health to step out. */
export const DUEL_FIT = 0.4;
/** Renown (`GameState.reputation`) for winning, and lost for losing or for turning a rival's challenge down. */
export const DUEL_RENOWN_WIN = 2;
export const DUEL_RENOWN_LOSS = 1;
/** The town's morale after a win. */
export const DUEL_MORALE_WIN = 4;
/** A blocs' liking for a win over a troublemaker (commons) or a rival (soldiers). */
export const DUEL_BLOC_WIN = 4;
/** What the champion's backers pay the winner over them. */
export const DUEL_CHAMPION_PURSE = 25;
/** A rival's challenge: the chance each day, the hour it comes, the days between, and the share that are to the death. */
export const CHALLENGE_PER_DAY = 0.1;
export const CHALLENGE_HOUR = 17;
export const CHALLENGE_GAP_DAYS = 6;
export const CHALLENGE_DEATH_SHARE = 0.25;
/** How long the result stays up for the fight screen, in ticks. */
export const DUEL_LINGER = 80;
/** The stand-in foe a person is fought as on the fight screen (their own figures are copied over it). */
export const DUEL_STAND_IN = 'bandit';
