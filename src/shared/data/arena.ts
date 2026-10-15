// Tournaments and the arena (the owner's ask). An Arena (`ARENA_BUILDING`, merged into BUILDINGS) holds a fighting
// season the town runs itself: on each of the first `SEASON_DAYS` days of spring, summer and autumn a bout is posted at
// `CARD_HOUR` and fought at `BOUT_HOUR`: one of the town's fighters, or a beast of its ranch (data/ranch.ts), against a
// visiting champion of another people or a rival town. Townsfolk bet from their purses; the player may bet from the
// treasury. The gate's takings, purses, renown and travellers drawn in; a ladder for the season, and a crown at its end.
// A knights' town's tournament (sim/chivalry.ts `tourney`) counts on the same ladder. The rules in sim/arena.ts.

import type { BuildingDef } from './buildings';

export const ARENA_BUILDING: BuildingDef = {
  id: 'arena',
  name: 'Arena',
  layer: 'mid',
  width: 5,
  depth: 4,
  cost: { wood: 30, stone: 14, hide: 4 },
  buildSeconds: 220,
  research: 'spear_hunting',
  purpose: 'A fighting ring with banks for a crowd: a season of bouts against visiting champions, with a purse, a gate and a book of bets.',
};

/** The town raises an arena with this many grown-ups. */
export const ARENA_PEOPLE = 7;
/** The season: the first days of each season but winter; the bout is posted at noon and fought in the evening. */
export const SEASON_DAYS = 6;
export const CARD_HOUR = 12;
export const BOUT_HOUR = 17;
/** A fighter rests this many days between bouts. */
export const REST_DAYS = 2;

/** Each side yields when it falls under this share of its health; only a fighter struck down outright may die, at
 *  these odds (a person, a beast of the ranch, a visitor). */
export const YIELD = 0.3;
export const ARENA_DEATH = 0.2;
export const BEAST_DEATH = 0.3;
export const VISITOR_DEATH = 0.15;

/** How close the bouts are made: the visitor's might against the town's fighter's, between these. */
export const MATCH_LEAST = 0.7;
export const MATCH_MOST = 1.35;

/** The book: the house keeps a share; the odds paid are between these. */
export const HOUSE_CUT = 0.1;
export const PAYS_LEAST = 1.1;
export const PAYS_MOST = 8;
/** Townsfolk bet when they have coins over `BET_KEEP`: a share of the rest, up to `BET_MOST`; how likely by nature. */
export const BET_KEEP = 15;
export const BET_SHARE = 0.2;
export const BET_MOST = 40;
export const BET_LEAST = 2;
export const BET_LEAN: Record<string, number> = { greedy: 0.65, bold: 0.55, jolly: 0.5, restless: 0.45, cheerful: 0.4, proud: 0.35, curious: 0.3, grumpy: 0.25, dreamy: 0.2, kind: 0.15, gloomy: 0.15, shy: 0.1, stern: 0.05, pious: 0.05 };
/** The bets the treasury may place (the Arena tab's buttons). */
export const PLAYER_BETS = [10, 25, 50, 100] as const;

/** Purses: the winner's and the loser's (a person's own; a beast's to the treasury); the season's crown. */
export const PURSE = 20;
export const LOSER_PURSE = 5;
export const CROWN_PRIZE = 60;
/** Points on the ladder: a win, a loss, and a win by a knockout on top. */
export const WIN_POINTS = 3;
export const LOSS_POINTS = 0;
export const KO_POINTS = 1;

/** The gate: coins a bout, more a grown-up and with an Arena Master's Social, and the renown it brings the venues (up
 *  to `RENOWN_MOST`, fading `RENOWN_FADE` a day out of season), and the travellers drawn on a bout day. */
export const GATE_BASE = 6;
export const GATE_PER_PERSON = 0.5;
export const GATE_PER_SOCIAL = 0.03;
export const RENOWN_WIN = 2;
export const RENOWN_LOSS = 0.5;
export const RENOWN_MOST = 30;
export const RENOWN_FADE = 0.5;
export const BOUT_TRAVELLERS = 1.25;

/** How long the result stays up for the fight screen, in ticks. */
export const BOUT_LINGER = 80;
/** Bouts' ids (the fight screen's) start here, apart from the town's own ids. */
export const BOUT_IDS = 7_000_000;
/** A townsperson away in the ring (`Person.away`). */
export const ARENA_AWAY = -5_000_001;

/** Visiting champions' names and epithets. */
export const CHAMPION_NAMES = ['Varn', 'Korra', 'Hask', 'Brenna', 'Ulric', 'Tamsin', 'Grue', 'Oska', 'Drevan', 'Mirela', 'Thane', 'Yorga', 'Castor', 'Ilse', 'Rusk', 'Sabeth', 'Morn', 'Kesh'];
export const EPITHETS = ['the Red', 'Iron-Hand', 'the Unbowed', 'Half-Ear', 'the Smiling', 'Bonebreaker', 'the Quick', 'Stormborn', 'the Grim', 'Two-Axes', 'the Wall', 'Ashfoot'];
/** Who comes when the town knows no powers yet. */
export const WANDERERS = ['bandit', 'soldier', 'raider', 'black_knight', 'bandit_chief'];

/** A bout's place, shaped as a destination for the fight screen (`arena:<id>`; sim/expeditions.ts `destinationOf`). */
export const isArenaDest = (id: string) => id.startsWith('arena:');
export function arenaDestination(id: string): import('./expeditions').Destination {
  return {
    id,
    name: 'the arena',
    type: 'clear',
    outSeconds: 0,
    workSeconds: 0,
    secondsPerUnit: 1,
    loot: {},
    threats: 'a visiting champion',
    encounters: { arrival: 0, ambush: 0, groups: [] },
    recommendedParty: 1,
    scenery: 'arena',
    description: 'A bout in the town\'s arena, before the crowd.',
  };
}
