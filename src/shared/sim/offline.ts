// Offline progress (DESIGN §2, §10): time spent closed (or asleep) is simulated tick by tick on return, so
// townsfolk work through their queues and then go idle, expeditions travel, raids come and questions time
// out to their defaults. Afterwards a "while you were away" report goes into the Town Journal.

import { MATERIAL_NAMES, MATERIALS, type Stock } from '../data/materials';
import { blueprintCount, totalStock } from './buildings';
import type { Sim } from './sim';
import { addJournal, type GameState } from './state';
import { TICK_MS, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** Gaps shorter than this are just caught up quietly (no report). */
export const OFFLINE_REPORT_MS = 2 * 60_000;
/** At most this much absence is simulated; the rest is skipped. */
export const MAX_OFFLINE_MS = 3 * 24 * 3_600_000;
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
  const want = s.paused || s.gameOver ? 0 : Math.floor(Math.min(Math.max(0, awayMs), MAX_OFFLINE_MS) / TICK_MS);
  const before = { tick: s.tick, stock: totalStock(s), people: s.people.length, lastEntry: s.journal.at(-1)?.id ?? 0 };
  const job: CatchUpJob = {
    left: want,
    get progress() {
      return want ? 1 - job.left / want : 1;
    },
    run(ticks) {
      for (let i = 0; i < ticks && job.left > 0; i++, job.left--) {
        if (s.gameOver || s.paused) job.left = 0;
        else sim.step();
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
  const idle = idleNote(s);
  if (idle) lines.push(idle);
  if (!lines.length) lines.push('A quiet time. Nothing much happened.');
  if (awayMs > MAX_OFFLINE_MS) lines.push(`(Only the first ${MAX_OFFLINE_MS / 3_600_000} hours away were simulated.)`);

  const id = s.nextId++;
  addJournal(s, { id, tick: s.tick, text: `While you were away (${realDuration(awayMs)}, ${gameDuration(ticks)})`, lines });
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
  const gathering = s.tiles.some((t) => t.designated);
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
