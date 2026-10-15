// The orcs' warpath (the Orc Warband's own way; sim/warpath.ts). The horde's fury rises with every peaceful day and
// with every win, and is spent on war: the warchief leads war raids out on the realm's powers (or on the roads) for
// plunder and captives, who are put to work as thralls. Every orc earns glory by the kill and the raid, and the
// bloodiest take names. Fury left to boil over brings brawls; at its height the Waaagh! is called. The Great Waaagh,
// every power of the realm sacked, wins the game.

/** The hour of the horde's reckoning (fury, the war raid's call, the thralls' work). */
export const HORDE_HOUR = 8;

/** Fury, 0 to 100. Each morning it rises `FURY_DAILY` (more, `FURY_IDLE`, after `RESTLESS_DAYS` with no fight); a
 *  raid on the town beaten adds `FURY_DEFENDED`, a war raid won `FURY_WON`; a war raid sent out spends `FURY_SPENT`. */
export const FURY_START = 20;
export const FURY_DAILY = 6;
export const FURY_IDLE = 6;
export const RESTLESS_DAYS = 3;
export const FURY_DEFENDED = 8;
export const FURY_WON = 10;
export const FURY_SPENT = 30;

/** At `BRAWL_AT` fury the bored horde fights itself: each morning on `BRAWL_CHANCE` two orcs come to blows (a wound,
 *  a grudge), and spirits sour (`RESTLESS_MORALE` for a day). */
export const BRAWL_AT = 70;
export const BRAWL_CHANCE = 0.6;
export const BRAWL_HURT = 0.2;
export const RESTLESS_MORALE = -4;

/** The war raid's call: no oftener than `RAID_GAP_DAYS`, once fury reaches `CALL_AT`, in a horde of `RAID_PEOPLE`
 *  grown-ups at home; `RAID_SHARE` of them go (at least `RAID_LEAST`, at most `RAID_MOST`; the warchief stays home
 *  unless the horde is small), out for `RAID_HOURS`. Unanswered in `ASK_HOURS`, the horde goes where it was pointed. */
export const RAID_GAP_DAYS = 3;
export const CALL_AT = 40;
export const RAID_PEOPLE = 4;
export const RAID_SHARE = 0.4;
export const RAID_LEAST = 2;
export const RAID_MOST = 8;
export const RAID_HOURS = 20;
export const ASK_HOURS = 10;

/** The odds: `ODDS_BASE` and the party's might against the power's (`ODDS_PER_MIGHT` a point of difference), between
 *  `ODDS_LEAST` and `ODDS_MOST`; a road raid is `ROAD_ODDS`. Each who goes may fall (`RAID_KILLS` lost, `RAID_HURT`
 *  won) or be hurt. */
export const ODDS_BASE = 0.5;
export const ODDS_PER_MIGHT = 0.01;
export const ODDS_LEAST = 0.2;
export const ODDS_MOST = 0.88;
export const ROAD_ODDS = 0.8;
export const RAID_KILLS_WON = 0.05;
export const RAID_KILLS_LOST = 0.18;
export const RAID_HURT = 0.35;

/** What a win brings home: `PLUNDER_PER_RAIDER` coins a raider (half on the roads), `GOODS` of the power's goods a
 *  raider, captives (`CAPTIVES`, none from the roads) to be thralls; the power loses `TROOPS_LOST` troops and
 *  `RAIDED_GOODWILL`, and may declare war (`WAR_AT` goodwill or less). A road raid scares the travellers off
 *  (`ROAD_TRAVELLERS` for `ROAD_DAYS`). */
export const PLUNDER_PER_RAIDER = 22;
export const GOODS_PER_RAIDER = 3;
export const CAPTIVES: [number, number] = [1, 2];
export const TROOPS_LOST = 6;
export const RAIDED_GOODWILL = -25;
export const WAR_AT = -50;
export const ROAD_TRAVELLERS = 0.5;
export const ROAD_DAYS = 3;

/** Glory, an orc's own: `GLORY_RAID_WON` (`GLORY_RAID_LOST`) a war raid, `GLORY_PER_FELL` a raider felled at home.
 *  At each mark they take a name (`GLORY_NAMES`, picked by who they are). */
export const GLORY_RAID_WON = 10;
export const GLORY_RAID_LOST = 3;
export const GLORY_PER_FELL = 2;
export const GLORY_NAMES: [number, string[]][] = [
  [10, ['the Blooded', 'Redhand', 'the Bold', 'Tuskbiter']],
  [30, ['Skullsplitter', 'Bonebreaker', 'Gutripper', 'the Butcher']],
  [60, ['Ironjaw', 'the Dread', 'Bloodfist', 'Doomtusk']],
  [100, ['Warboss', 'the Unkillable', 'Worldbreaker', 'the Great Green']],
];

/** Thralls: every prisoner of the horde works; each morning `THRALL_WORK` of wood and stone each into the stores. */
export const THRALL_WORK = { wood: 2, stone: 1 };

/** The Waaagh!: at full fury it's called, for `WAAAGH_DAYS`: everyone fights `WAAAGH_FIGHT` harder and builds
 *  `WAAAGH_BUILD` faster, and the horde goes raiding at once with `WAAAGH_BONUS` on its odds and everyone fit to go
 *  (`WAAAGH_MOST`). After it, fury falls to `WAAAGH_AFTER`. */
export const WAAAGH_DAYS = 3;
export const WAAAGH_FIGHT = 1.3;
export const WAAAGH_BUILD = 1.15;
export const WAAAGH_BONUS = 0.15;
export const WAAAGH_MOST = 14;
export const WAAAGH_AFTER = 10;

/** The Great Waaagh: every power of the realm sacked (a war raid won on it, or the power razed) and at least
 *  `WIN_WAAAGHS` Waaaghs called: the game is won. */
export const WIN_WAAAGHS = 2;

export const FURY_NAMES: [number, string][] = [
  [100, 'WAAAGH!'],
  [70, 'Boiling over'],
  [40, 'Spoiling for a fight'],
  [15, 'Restless'],
  [0, 'Sated'],
];
