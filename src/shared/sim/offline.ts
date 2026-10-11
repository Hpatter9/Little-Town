// Offline progress (DESIGN §2, §10): time spent closed (or asleep) is simulated tick by tick on return, so
// townsfolk work through their queues and then go idle, expeditions travel, raids come and questions time
// out to their defaults.

import type { Sim } from './sim';
import { notify } from './state';
import { holdAtGate, openGate, RAID_WAIT_MS, raidAtGate } from './raidWait';
import { holdEventClock, holdForEvent } from './events';
import { runtime } from './watchAsk';
import { TICK_MS } from './time';

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

export interface CatchUpResult {
  /** Ticks actually simulated. */
  ticks: number;
}

/** A catch-up under way: run it in slices (so a long absence doesn't freeze the app), then finish it. */
export interface CatchUpJob {
  /** Ticks still to simulate. */
  left: number;
  /** Share done, 0..1. */
  readonly progress: number;
  /** Simulate up to `ticks` more. Returns true when there's nothing left to do. */
  run(ticks: number): boolean;
  /** Finish the catch-up and return how much game time passed. */
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
  const beforeTick = s.tick;
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
        runtime.quiet = true; // (nobody to ask about watching a party's fight: sim/watchAsk.ts)
        try {
          sim.step();
        } finally {
          runtime.quiet = false;
        }
      }
      return job.left <= 0;
    },
    finish: () => ({ ticks: s.tick - beforeTick }),
  };
  return job;
}

/** Simulate `awayMs` of absence in one go. */
export function catchUp(sim: Sim, awayMs: number): CatchUpResult {
  const job = startCatchUp(sim, awayMs);
  job.run(job.left);
  return job.finish();
}
