// Seasons of war with the realm (the owner's ask; the rules are in sim/war/). The powers of the realm make war by the
// season: in spring and summer their hosts march on each other's provinces (the War tab's map), in autumn they raid
// for the harvest, in winter they hold and plot. The town is drawn in by envoys (a call to arms, tribute, levies),
// raided by the deserters of the side that lost, besieged, occupied and freed; its council answers for it, by the
// direction, the town's alignment and how it stands with each power. Numbers are starting points for tuning.

import type { OriginId } from './origins';

/** What each season is for, in war. */
export type WarSeason = 'march' | 'harvest' | 'hold';
export const SEASON_OF_WAR: Readonly<Record<'spring' | 'summer' | 'autumn' | 'winter', WarSeason>> = { spring: 'march', summer: 'march', autumn: 'harvest', winter: 'hold' };
export const SEASON_LINE: Readonly<Record<WarSeason, string>> = {
  march: 'The hosts march: the powers at war strike at each other\'s provinces, and call on their friends.',
  harvest: 'The harvest raids: no province changes hands, but the hosts ride out to burn and carry off the crops.',
  hold: 'The hosts hold their winter quarters, and the lords plot: envoys, demands, treaties made and broken.',
};

/* ------------------------------------------------------------ wars between the powers (s.feuds, sim/worldLife.ts) */

/** A war's strikes come no oftener than this many days apart (the hosts must gather between). */
export const STRIKE_GAP_DAYS = 3;
/** A harvest raid costs the loser this share of its folk (and half that of its troops), and takes no province. */
export const HARVEST_LOSS = 0.08;
/** Wars begin on this many mornings in a hundred of a plotting season (autumn and winter), a third of it in the
 *  marching; and end on that many in winter, a third of it in the rest of the year. */
export const WAR_START_PLOT = 14;
export const WAR_END_WINTER = 16;
export const OFF_SEASON = 1 / 3;
/** A strike on a province: the defender's troops count this much more at a capital, and a province held so long it
 *  holds. A power with no province left but its capital falls when the capital is taken. */
export const CAPITAL_GUARD = 0.6;

/** The hosts against the town by the season: this much likelier in the marching seasons (reached over the town's
 *  first `MARCH_RAMP_DAYS` paced days from its `MARCH_RAMP_FROM`th, so a young town's first spring is no worse than
 *  before), this much in autumn, none in winter. */
export const MARCH_HOSTS = 1.6;
export const HARVEST_HOSTS = 0.8;
export const MARCH_RAMP_FROM = 6;
export const MARCH_RAMP_DAYS = 10;
/** The deserters of the side that lost a strike: on this chance a band of them comes for the town (a small raid of
 *  that power's people), more likely when the town fought against them; this many at most, by the loser's troops. */
export const DESERT_CHANCE = 0.22;
export const DESERT_AGAINST_TOWN = 2;
export const DESERT_SHARE = 0.12;
export const DESERT_MOST = 7;
/** Deserters wait this many hours after the strike before they reach the town, and never come within this many hours
 *  of another raid of theirs. */
export const DESERT_HOURS = 10;
export const DESERT_GAP_HOURS = 48;
/** No deserters come to a town of fewer grown-ups than this, and a band is never more than half its grown-ups. */
export const DESERT_TOWN_LEAST = 5;

/* ------------------------------------------------------------ the town called to a campaign */

/** An ally (or a friend warm enough) calls the town to march with its host: the warmth it needs without an alliance. */
export const CALL_WARMTH = 25;
/** A power at war with one the town is at war with calls it too, unless it thinks less of the town than this. */
export const COMMON_FOE_WARMTH = -20;
/** A call no oftener than this many days apart (all the powers together). */
export const CALL_GAP_DAYS = 6;
/** How long a campaign waits for the town's party to set out (hours), and the most the town sends; the levy asked
 *  grows with the town (a grown-up in this many, at least `LEVY_LEAST`). */
export const CAMPAIGN_OPEN_HOURS = 30;
export const LEVY_LEAST = 3;
export const LEVY_PER = 4;
export const LEVY_MOST = 8;
/** The town keeps at least this share of its grown-ups home whatever it sends. */
export const CAMPAIGN_KEEP_HOME = 0.5;
/** The ally's own host fights beside the town's party: this many of its troops (and a share more for a big power). */
export const ALLY_HOST: [number, number] = [5, 9];
/** The waves the party meets: the enemy's troops in waves of about this many, at most this many waves before its
 *  captain's; a harvest raid is half of it. */
export const CAMPAIGN_WAVE_TROOPS = 12;
export const CAMPAIGN_WAVES_MOST = 4;
/** The spoils of a campaign won: coins by the beaten power's troops (this many a troop, at least `SPOILS_LEAST`), and a
 *  load of its goods; a harvest raid brings food instead. */
export const SPOILS_PER_TROOP = 2.2;
export const SPOILS_LEAST = 30;
export const SPOILS_GOODS = 12;
export const SPOILS_FOOD = 30;
/** Sending coin in place of fighters (the cautious answer), and what each answer does to the caller's goodwill. */
export const CAMPAIGN_COIN = 40;
export const MARCHED_WARMTH = 18;
export const COIN_WARMTH = 6;
export const REFUSED_COLD = 10;
/** An ally the town refuses: this much colder again (the oath sworn). */
export const REFUSED_ALLY_COLD = 12;
/** The power marched against thinks this much less of the town, and goes to war with it below `WAR_AT` (as ever). */
export const MARCHED_AGAINST = 22;

/* ------------------------------------------------------------ sieges and occupation */

/** A host is a siege when its power is this many times the town's might, has sent a host before, and in the marching
 *  seasons, on this chance: bigger (`SIEGE_BIGGER`), with more engines, and it asks the town to yield before it comes. */
export const SIEGE_STRONG = 1.5;
export const SIEGE_CHANCE = 0.35;
export const SIEGE_BIGGER = 1.3;
/** The siege is lost when fewer than this share of the host fell and its lord was not struck down; two sieges lost to
 *  the realm's powers are the end of the town (as the Great Enemy's are, data/greatEnemy.ts). */
export const SIEGE_LOST_FELL = 0.35;
export const SIEGES_TO_FALL = 2;
/** A siege lost: the sack, this share of the town in the streets cut down, and so many buildings fired. */
export const SACK_SLAIN = 0.12;
export const SACK_BURN = 2;
/** The council yields to a siege when the host is this many times the town's might (less for a peaceful direction). */
export const YIELD_AT = 2.6;

/** An occupation: the garrison (a share of the host left behind), the tax taken each day (a share of the treasury
 *  over its keep, and of the food in store), the resistance growing each day toward a rising (at 100), and how long
 *  it lasts at most before the occupier, paid, marches off. */
export const GARRISON_SHARE = 0.35;
export const GARRISON_MOST = 14;
export const OCCUPY_TAX = 0.18;
export const OCCUPY_FOOD = 0.06;
export const RESIST_BASE = 6;
export const RESIST_PER_GARRISON = 0.25;
/** The resistance grows at least this much a day, however big the garrison. */
export const RESIST_LEAST = 2;
export const OCCUPY_DAYS_MOST = 15;
/** A rising crushed: this many of the resistance hanged, and the resistance starts again from nothing. */
export const RISING_HANGED = 2;
/** An ally at war with the occupier frees the town on this chance a day of the marching seasons. */
export const ALLY_FREES = 0.12;

/* ------------------------------------------------------------ the council (the town's own answers) */

/** Below this alignment the town is wicked enough to break its word for gain; above this, good enough to answer a
 *  just call gladly. */
export const EVIL_AT = -30;
export const GOOD_AT = 25;
/** A treaty is broken only when the town is this much the stronger, and the power rich enough to be worth it. */
export const BREAK_STRONGER = 1.6;
export const BREAK_RICH_FOLK = 40;
/** The council's score to join a call: at this or more, it marches. */
export const JOIN_AT = 2;
/** A town too small to march: the fewest grown-ups fit to fight. */
export const FIGHTERS_LEAST = 3;
/** Growth and Trade buy peace in winter: a gift once a few days to each power at war, while the treasury holds this
 *  many times it. */
export const PEACE_GIFT_EVERY_DAYS = 3;
export const PEACE_TREASURY = 3;
/** Even a proud people pays a power this many times its might (and is ashamed of it). */
export const PROUD_BOWS = 2;
/** Knowledge's envoys: a demand talked down to this share, and a war between two friends brokered to peace on this
 *  chance a winter day. */
export const TALKED_DOWN = 0.6;
export const BROKER_CHANCE = 0.18;

/** Each people's way with war (data/origins.ts): a lean to march (`join`), whether a just war counts double and an
 *  unjust one against (`just`), whether it ever pays tribute or yields (`proud`), when it breaks its word (`oath`:
 *  never, when strong and wicked, or when strong at all), the spoils it takes, and its own turn: the nomads ride out on
 *  their own harvest raids, the machines sell arms to both sides. */
export interface WarWays {
  join: number;
  just?: boolean;
  proud?: boolean;
  oath: 'never' | 'wicked' | 'strong';
  spoils: number;
  harvestRaids?: boolean;
  arms?: boolean;
  line: string;
}
export const WAR_WAYS: Partial<Record<OriginId, WarWays>> & { default: WarWays } = {
  default: { join: 0, oath: 'wicked', spoils: 1, line: 'The council weighs each war by what it costs and what it is for.' },
  orcs: { join: 4, proud: true, oath: 'strong', spoils: 1.3, line: 'The warband answers every call to war, never pays and never kneels, and keeps its word only while it must.' },
  knights: { join: 1, just: true, proud: true, oath: 'never', spoils: 0.8, line: 'The Order marches only in a just cause, never breaks its word, and would rather fall than kneel.' },
  nomads: { join: 1, oath: 'wicked', spoils: 1.2, harvestRaids: true, line: 'The horde rides with whoever pays, and in autumn raids its weaker neighbours\' harvests on its own.' },
  robot: { join: -1, oath: 'wicked', spoils: 1, arms: true, line: 'The colony sells arms to both sides of every war, and marches only when the numbers say it wins.' },
  dwarves: { join: 0, proud: true, oath: 'never', spoils: 1.1, line: 'The hold keeps its oaths to the letter and pays nobody; its gates are its answer to a siege.' },
  vampire: { join: 1, oath: 'wicked', spoils: 1.2, line: 'The Court joins any war it can feed on, and keeps its treaties only as long as they are useful.' },
};
/** The machines' arms trade: coins each marching season for each war they can sell into. */
export const ARMS_COINS = 14;
/** The nomads' own harvest raid: on this chance each autumn morning, on a neighbour this much weaker. */
export const NOMAD_RAID_CHANCE = 0.2;
export const NOMAD_RAID_WEAKER = 0.9;

/* ------------------------------------------------------------ memory */

/** War news kept for the War tab, the war dead remembered, and how many fallen in one war raise its memorial. */
export const WAR_NEWS_MOST = 30;
export const WAR_DEAD_MOST = 80;
export const MEMORIAL_AT = 3;
/** A campaign's survivors' morale after a war won or lost (the whole town's, for so many hours). */
export const VICTORY_MORALE = 4;
export const GRIEF_MORALE = -5;
export const MORALE_HOURS = 72;
