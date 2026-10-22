// The seasons of war's own state on the town (`s.war`, optional: an older save has none and is given one when it is
// first wanted) and the little things every part of it uses: the season of war, its own dice, the war's news.

import { SEASON_OF_WAR, WAR_NEWS_MOST, type WarSeason } from '../../data/war';
import { hashSeed, Rng } from '../../rng';
import { notify, type GameState } from '../state';
import { calendarOf } from '../time';

/** A campaign: a power's host marching on a province of a power it is at war with (or the town's own war party on a
 *  power's land), which may have called the town to march with it. */
export interface Campaign {
  id: number;
  /** Who marches ('town' for the town's own), on whom, and in which season's way (a harvest raid takes no province). */
  by: string;
  against: string;
  harvest: boolean;
  /** The province it marches on (the War tab's map), when the world has one for both sides. */
  province: number | null;
  /** The troops it marches with (the power's own), and when it set out. */
  troops: number;
  start: number;
  /** The town's part: asked (the tick), its answer, the party's expedition and who went, and until when the
   *  destination is open for a party to set out. */
  call?: { asked: number; answer: 'march' | 'coin' | 'refuse' | null; until: number; party?: number; members?: number[]; levy: number };
  /** Settled: won or lost by the side that marched. */
  done?: 'won' | 'lost';
}

/** The town in a power's hands: the garrison left behind, the day it began, the tax and food it has taken, and the
 *  resistance growing toward a rising. */
export interface Occupation {
  by: string;
  since: number;
  garrison: number;
  resistance: number;
  taxed: number;
  /** A rising under way: the raid of the garrison inside the town. */
  rising?: boolean;
}

/** One of the town's war dead: who, where, in which war, and who they left. */
export interface WarDead {
  id: number;
  name: string;
  war: string;
  where: string;
  tick: number;
  widow?: string;
  orphans?: string[];
}

export interface WarState {
  nextId: number;
  campaigns: Campaign[];
  /** The last strike (tick) of each war between powers, by its pair ("a|b"). */
  struck?: Record<string, number>;
  /** The last call to arms (tick), and the council's last word on each power (what it would do, and why). */
  lastCall?: number;
  council?: Record<string, { lean: string; why: string }>;
  /** A siege mustered (the power and whether the town was asked to yield), sieges lost and held. */
  siege?: { by: string; asked?: boolean; yielded?: boolean };
  sieges?: { lost: number; held: number };
  occupation?: Occupation;
  /** The war's news, newest last; the town's war dead; the powers that fell; the memorials raised (by war). */
  news: { tick: number; text: string }[];
  dead: WarDead[];
  fallen?: { id: string; by: string; tick: number }[];
  memorials?: string[];
  /** The last campaign's recap (the War tab, the news bubble). */
  recap?: { tick: number; title: string; lines: string[]; won: boolean };
  /** Tallies, for the annals and the soaks. */
  joined?: number;
  won?: number;
  lost?: number;
  spoils?: number;
  tribute?: number;
  /** Deserters on their way (a raid of the loser's people when they come), the last that came, the gifts sent. */
  deserters?: { from: string; at: number; n: number }[];
  lastDeserters?: number;
  gifted?: Record<string, number>;
  /** The season of war last seen (its turn is told once), and the machines' arms sold this season. */
  season?: WarSeason;
  armsSold?: number;
  /** Peoples' own: the nomads' last harvest raid (tick). */
  nomadRaid?: number;
}

export const warOf = (s: GameState): WarState => (s.war ??= { nextId: 1, campaigns: [], news: [], dead: [] });

/** The season of war it is now: march (spring, summer), harvest (autumn), hold (winter). */
export const warSeason = (s: Pick<GameState, 'tick'>): WarSeason => SEASON_OF_WAR[calendarOf(s).season];

/** The war's own dice: never the town's stream. */
export const warRng = (s: GameState, salt: string | number = 0): Rng => new Rng(hashSeed(`${s.seed}:war:${s.tick}:${salt}`));

/** A line of war news: in the War tab's list, and (key) in the Journal. */
export function warNews(s: GameState, text: string, key = true): void {
  warLog(s, text);
  notify(s, text, key);
}
/** A line in the War tab's list only (the news was told already, by whatever did it). */
export function warLog(s: GameState, text: string): void {
  const w = warOf(s);
  w.news.push({ tick: s.tick, text });
  if (w.news.length > WAR_NEWS_MOST) w.news.splice(0, w.news.length - WAR_NEWS_MOST);
}

/** The pair a war between two powers is known by. */
export const pairOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
