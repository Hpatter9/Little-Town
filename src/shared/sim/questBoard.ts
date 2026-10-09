// The quest board (the owner's ask: a quest is offered, the player accepts it, and an accepted quest has its time limit,
// its details, a party formed for it and its progress to follow). A tavern guest's quest (sim/quests.ts) and a guild
// hunt (sim/hunts.ts) are first an **offer**: up for `OFFER_HOURS`, then gone. Accepted (`acceptQuest`, the `quest`
// command), the time limit starts (`QUEST_DAYS` / `HUNT_DAYS` from now), the town's own parties may take it up (only an
// accepted hunt is on the Expedition Board; only an accepted quest draws a party with its reward, `questPull`), and only
// an accepted one pays. Running out of time while accepted it **fails** (`FAIL_MORALE`: a word broken). Declined, it's
// gone at once. An offer nobody answers for `AUTO_ACCEPT_HOURS` the town takes up itself when it has an adventurer to
// go (so a town left alone still goes questing). A town run by hand (the tests' plainGame) takes every quest as offered.
// `s.questLog` keeps the last few ended: done, failed, lapsed or declined.

import { QUARRY_BY_ID, HUNT_DAYS } from '../data/hunts';
import { DUNGEON_BY_ID } from '../data/dungeons';
import { notify, type GameState } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { QUEST_DAYS, type Quest } from './quests';
import { isChild } from './social';

/** How long an offer waits for an answer, and when the town takes it up itself. */
export const OFFER_HOURS = 48;
export const AUTO_ACCEPT_HOURS = 18;
/** Spirits lost when an accepted quest runs out of time, and for how long. */
export const FAIL_MORALE = -3;
const FAIL_HOURS = 24;
/** Ended quests kept in the log. */
export const LOG_MOST = 10;

export type QuestSort = 'quest' | 'hunt';
export type QuestEnd = 'done' | 'failed' | 'lapsed' | 'declined';

export interface QuestLogEntry {
  title: string;
  sort: QuestSort;
  end: QuestEnd;
  day: number;
  /** What came of it, in a line. */
  text: string;
}

/** Posted as an offer, or at once accepted in a town run by hand. */
export function offerUntil(s: GameState, days: number): { accepted?: number; until: number } {
  return s.autopilot === false ? { accepted: s.tick, until: s.tick + days * TICKS_PER_DAY } : { until: s.tick + OFFER_HOURS * TICKS_PER_HOUR };
}

const huntTitle = (quarry: string) => `Hunt: ${QUARRY_BY_ID[quarry]?.name ?? 'a monster'}`;

/** Write an ended quest in the log. */
export function logQuest(s: GameState, title: string, sort: QuestSort, end: QuestEnd, text: string): void {
  (s.questLog ??= []).unshift({ title, sort, end, day: calendar(s.tick).day, text });
  if (s.questLog.length > LOG_MOST) s.questLog.length = LOG_MOST;
}

/** Accept an offer: its time limit starts. */
export function acceptQuest(s: GameState, sort: QuestSort, id: number): boolean {
  if (sort === 'quest') {
    const q = (s.quests ?? []).find((x) => x.id === id);
    if (!q || q.accepted !== undefined) return false;
    q.accepted = s.tick;
    q.until = s.tick + QUEST_DAYS * TICKS_PER_DAY;
    notify(s, `Quest accepted: ${q.title}. ${QUEST_DAYS} days to clear ${DUNGEON_BY_ID[q.dungeon]?.name ?? 'the place'}.`, true);
    return true;
  }
  const h = (s.hunts ?? []).find((x) => x.id === id);
  if (!h || h.accepted !== undefined) return false;
  h.accepted = s.tick;
  h.until = s.tick + HUNT_DAYS * TICKS_PER_DAY;
  notify(s, `Hunt accepted: ${QUARRY_BY_ID[h.quarry]?.name ?? 'the quarry'}. ${HUNT_DAYS} days to bring it down.`, true);
  return true;
}

/** Turn an offer down: it's gone. */
export function declineQuest(s: GameState, sort: QuestSort, id: number): boolean {
  if (sort === 'quest') {
    const q = (s.quests ?? []).find((x) => x.id === id && x.accepted === undefined);
    if (!q) return false;
    s.quests = (s.quests ?? []).filter((x) => x !== q);
    logQuest(s, q.title, 'quest', 'declined', `Turned down; ${q.from} went elsewhere.`);
    return true;
  }
  const h = (s.hunts ?? []).find((x) => x.id === id && x.accepted === undefined);
  if (!h) return false;
  s.hunts = (s.hunts ?? []).filter((x) => x !== h);
  logQuest(s, huntTitle(h.quarry), 'hunt', 'declined', 'Turned down; the guild took its notice down.');
  return true;
}

/** Is there an adventurer at home to take a quest up? */
const adventurerHome = (s: GameState) => s.people.some((p) => p.away === null && !isChild(p) && p.ambition === 'adventurer');

/** Hourly (before the quests' and hunts' own hours): offers taken up by the town or lapsing, accepted ones failing. */
export function questBoardHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const out = new Set(s.expeditions.map((e) => e.dest));
  const auto = s.autopilot !== false && adventurerHome(s);
  const offeredAt = (until: number) => until - OFFER_HOURS * TICKS_PER_HOUR;
  for (const q of [...(s.quests ?? [])]) {
    if (q.accepted === undefined) {
      if (auto && s.tick - offeredAt(q.until) >= AUTO_ACCEPT_HOURS * TICKS_PER_HOUR) {
        acceptQuest(s, 'quest', q.id);
        notify(s, `Nobody said no, so the town's adventurers take up the quest: ${q.title}.`);
      } else if (s.tick >= q.until) {
        s.quests = (s.quests ?? []).filter((x) => x !== q);
        logQuest(s, q.title, 'quest', 'lapsed', `Never answered; ${q.from} gave up and went.`);
        notify(s, `Nobody answered ${q.from}: the quest at ${DUNGEON_BY_ID[q.dungeon]?.name ?? q.dungeon} is gone.`);
      }
    } else if (s.tick >= q.until && !out.has(q.dungeon)) failQuest(s, q);
  }
  for (const h of [...(s.hunts ?? [])]) {
    if (h.accepted === undefined) {
      if (auto && s.tick - offeredAt(h.until) >= AUTO_ACCEPT_HOURS * TICKS_PER_HOUR) acceptQuest(s, 'hunt', h.id);
      else if (s.tick >= h.until) {
        s.hunts = (s.hunts ?? []).filter((x) => x !== h);
        logQuest(s, huntTitle(h.quarry), 'hunt', 'lapsed', 'Never answered; the guild took its notice down.');
      }
    } else if (s.tick >= h.until && !out.has(`mhunt:${h.id}`)) {
      s.hunts = (s.hunts ?? []).filter((x) => x !== h);
      logQuest(s, huntTitle(h.quarry), 'hunt', 'failed', 'Out of time: the quarry went to ground. The guild is disappointed.');
      broken(s, huntTitle(h.quarry));
    }
  }
}

function failQuest(s: GameState, q: Quest): void {
  s.quests = (s.quests ?? []).filter((x) => x !== q);
  logQuest(s, q.title, 'quest', 'failed', `Out of time: ${q.from} has lost hope.`);
  broken(s, q.title);
}

function broken(s: GameState, title: string): void {
  (s.marks ??= []).push({ lever: 'morale', value: FAIL_MORALE, until: s.tick + FAIL_HOURS * TICKS_PER_HOUR, text: `A quest failed: ${title}` });
  notify(s, `Quest failed: ${title}. The town's word wasn't kept.`, true);
}
