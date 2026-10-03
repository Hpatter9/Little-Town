// Offline progress (DESIGN §2, §10): time spent closed (or asleep) is simulated tick by tick on return, so
// townsfolk work through their queues and then go idle, expeditions travel, raids come and questions time
// out to their defaults. Afterwards a "while you were away" report goes into the Town Journal.

import { MATERIAL_NAMES, MATERIALS, type Stock } from '../data/materials';
import { blueprintCount, totalStock } from './buildings';
import type { Sim } from './sim';
import { addJournal, notify, type GameState } from './state';
import { holdAtGate, openGate, RAID_WAIT_MS, raidAtGate } from './raidWait';
import { holdEventClock, holdForEvent } from './events';
import { highlights } from './highlights';
import { TICK_MS, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** Gaps shorter than this are just caught up quietly (no report). */
export const OFFLINE_REPORT_MS = 2 * 60_000;
/** Time away passes as in play for this long; after that the town slows down, so a night away is a few days in the
 *  town, not weeks. */
export const AWAY_FULL_MS = 30 * 60_000;
/** How fast time away passes after that, compared with play. */
export const AWAY_RATE = 0.25;
/** At most this much of the town's time is simulated for one absence (one game day); the rest is skipped. */
export const MAX_OFFLINE_MS = 24 * 60_000;

/** How much of the town's time (as play time, ms) an absence of `awayMs` is worth. */
export function awayPlayMs(awayMs: number): number {
  const away = Math.max(0, awayMs);
  return Math.min(MAX_OFFLINE_MS, Math.min(away, AWAY_FULL_MS) + Math.max(0, away - AWAY_FULL_MS) * AWAY_RATE);
}
/** The real time away (ms) that `playMs` of the town's time took, while the absence lasted (the inverse of awayPlayMs,
 *  before its cap). */
export function awayRealMs(playMs: number): number {
  return playMs <= AWAY_FULL_MS ? playMs : AWAY_FULL_MS + (playMs - AWAY_FULL_MS) / AWAY_RATE;
}

/** How many milestones the report quotes before pointing at the Journal. */
const REPORT_EVENTS = 8;

export interface CatchUpResult {
  /** Ticks actually simulated. */
  ticks: number;
  /** The report written to the journal, if the gap was long enough to deserve one. */
  reportId: number | null;
}

/** A catch-up under way: run it in slices (so a long absence doesn't freeze the app), then finish it. */
export interface CatchUpJob {
  /** Ticks still to simulate. */
  left: number;
  /** Share done, 0..1. */
  readonly progress: number;
  /** Simulate up to `ticks` more. Returns true when there's nothing left to do. */
  run(ticks: number): boolean;
  /** Write the "while you were away" report. */
  finish(): CatchUpResult;
}

/** Start simulating `awayMs` of absence. Stops early if the game ends. Paused games don't move. */
export function startCatchUp(sim: Sim, awayMs: number): CatchUpJob {
  const s = sim.state;
  // raiders already held at the gate wait on; long enough, and they come in without the player
  let away = awayMs;
  if (s.raid?.waiting !== undefined) {
    s.raid.waiting += awayMs;
    if (s.raid.waiting >= RAID_WAIT_MS) {
      away = s.raid.waiting - RAID_WAIT_MS;
      openGate(s);
      s.raid!.alone = true;
      notify(s, 'Nobody came to watch: the raiders at the gate attacked.');
    }
  }
  const want = s.paused || s.gameOver ? 0 : Math.floor(awayPlayMs(away) / TICK_MS);
  const before = { tick: s.tick, stock: totalStock(s), people: s.people.length, lastEntry: s.journal.at(-1)?.id ?? 0 };
  const job: CatchUpJob = {
    left: want,
    get progress() {
      return want ? 1 - job.left / want : 1;
    },
    run(ticks) {
      for (let i = 0; i < ticks && job.left > 0; i++, job.left--) {
        // (a choice event stops the town till the player answers: at most one while away)
        if (s.gameOver || s.paused || holdForEvent(s)) {
          job.left = 0;
          break;
        }
        // raiders reaching the gate while nobody's watching: the town waits for the player (unless they're away so
        // long after it that the raid would have played out anyway)
        if (raidAtGate(s)) {
          const left = away - awayRealMs((want - job.left) * TICK_MS);
          if (left < RAID_WAIT_MS) {
            holdAtGate(s, Math.max(0, left));
            job.left = 0;
            break;
          }
          s.raid!.alone = true;
        }
        holdEventClock(s); // (questions wait for the player to come back)
        sim.step();
      }
      return job.left <= 0;
    },
    finish: () => report(s, awayMs, before),
  };
  return job;
}

/** Simulate `awayMs` of absence in one go. */
export function catchUp(sim: Sim, awayMs: number): CatchUpResult {
  const job = startCatchUp(sim, awayMs);
  job.run(job.left);
  return job.finish();
}

function report(s: GameState, awayMs: number, before: { tick: number; stock: Stock; lastEntry: number }): CatchUpResult {
  const ticks = s.tick - before.tick;
  if (ticks <= 0) return { ticks: 0, reportId: null };
  if (awayMs < OFFLINE_REPORT_MS) return { ticks, reportId: null };

  // Milestones are listed (the latest few); everything else is only counted.
  const lines: string[] = [];
  const events = s.journal.filter((e) => e.id > before.lastEntry && !e.lines);
  const key = events.filter((e) => e.key);
  // the dead always come first, however much else happened
  const lost = events.map((e) => / has died (.+?)\.?$/.exec(e.text) && e.text.split(' has died ')).filter((m): m is string[] => !!m).map(([who, how]) => `${who} (${how.split('.')[0]})`);
  if (lost.length) lines.push(`Lost while you were away: ${lost.join(', ')}.`);
  if (key.length > REPORT_EVENTS) lines.push(`(${key.length - REPORT_EVENTS} earlier milestones are in the Journal.)`);
  for (const e of key.slice(-REPORT_EVENTS)) lines.push(e.text);
  const minor = events.length - key.length;
  if (minor) lines.push(`${minor} smaller event${minor === 1 ? '' : 's'}: see the Journal.`);
  const stock = stockChange(before.stock, totalStock(s));
  if (stock) lines.push(`Stores: ${stock}.`);
  if (s.prompts.some((p) => p.kind === 'gate')) lines.push('Raiders are at the gate: the town waits for you to watch the fight.');
  if (s.event?.held) lines.push('A choice is waiting: the town is paused until you answer it.');
  const idle = idleNote(s);
  if (idle) lines.push(idle);
  if (!lines.length) lines.push('A quiet time. Nothing much happened.');
  if (awayPlayMs(awayMs) >= MAX_OFFLINE_MS) {
    const d = Math.round(MAX_OFFLINE_MS / TICK_MS / TICKS_PER_DAY);
    lines.push(`(The town rests while you're away: at most ${d} game day${d === 1 ? '' : 's'} pass${d === 1 ? 'es' : ''}.)`);
  }

  const id = s.nextId++;
  const cards = highlights(s, events);
  addJournal(s, { id, tick: s.tick, text: `While you were away (${realDuration(awayMs)}, ${gameDuration(ticks)})`, lines, ...(cards.length ? { highlights: cards } : {}) });
  s.unreadAway = id;
  return { ticks, reportId: id };
}

function stockChange(a: Stock, b: Stock): string {
  const parts: string[] = [];
  for (const m of MATERIALS) {
    const d = (b[m] ?? 0) - (a[m] ?? 0);
    if (d) parts.push(`${d > 0 ? '+' : '−'}${Math.abs(d)} ${MATERIAL_NAMES[m].toLowerCase()}`);
  }
  return parts.join(', ');
}

/** Nothing left to do: the player should set up the next batch. */
function idleNote(s: GameState): string | null {
  const gathering = s.land.marked.length > 0;
  if (gathering || blueprintCount(s) > 0 || s.research.queue.length > 0) return null;
  return 'The queues ran dry: no building, research or gathering is waiting.';
}

export function realDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ${min % 60}m`;
  return `${Math.floor(h / 24)} days ${h % 24}h`;
}

function gameDuration(ticks: number): string {
  if (ticks >= TICKS_PER_DAY) {
    const d = Math.round((ticks / TICKS_PER_DAY) * 10) / 10;
    return `${d} game day${d === 1 ? '' : 's'}`;
  }
  const h = Math.round(ticks / TICKS_PER_HOUR);
  return `${h} game hour${h === 1 ? '' : 's'}`;
}
