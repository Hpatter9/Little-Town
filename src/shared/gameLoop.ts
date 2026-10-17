// Drives the sim from real time, independent of any window's frame rate: in the desktop app's main process,
// and on the phone (web) version in the page itself.

import { fightOnScreen } from './sim/raidWait';
import type { Command } from './sim/commands';
import { battleSpeedNow } from './sim/battle';
import { awayBefore, awaySummary, awayWatch, type AwayBefore } from './sim/awaySummary';
import { startCatchUp, type CatchUpJob, type CatchUpResult } from './sim/offline';
import { MAX_TICKS_PER_ADVANCE, Sim } from './sim/sim';
import { journalView, snapshot, type JournalEntryView, type Snapshot } from './sim/snapshot';
import type { GameState } from './sim/state';
import { TICK_MS } from './sim/time';

/** A gap in the wall clock longer than this means the PC slept: it's treated as time away. */
const SLEEP_GAP_MS = 60_000;
/** Catching up runs in slices of about this long, back to back, so the page stays responsive; the town isn't drawn
 *  meanwhile (only a progress line), which once took two thirds of the time. */
const CATCH_UP_SLICE_MS = 200;
const CATCH_UP_BATCH = 500;
/** How often a snapshot goes out while catching up (for its progress), ms. */
const CATCH_UP_SNAP_MS = 400;

/** The most a pump spends running ticks (ms): at the fast speeds the rest is caught up on the next pumps, so input and drawing stay responsive. */
const FRAME_BUDGET_MS = 40;

/** How long a frame spends running a raid being skipped (ms). */
const SKIP_SLICE_MS = 24;

export class GameLoop {
  private sim: Sim;
  private last = performance.now();
  private lastWall = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Time away being simulated, a slice per pump. */
  private job: { job: CatchUpJob; awayMs: number; t0: number; before: AwayBefore; snapAt: number; done?: (r: CatchUpResult) => void } | null = null;
  /** Debug time multiplier (1 = real time). */
  speed = 1;

  constructor(
    state: GameState,
    private readonly onTicks: (snap: Snapshot) => void,
  ) {
    this.sim = new Sim(state);
  }

  get state(): GameState {
    return this.sim.state;
  }

  /** The page is in the background (set by the page): a fight on screen waits meanwhile. */
  hidden = false;
  /** The clock is held (the phone's loading screen is up: mobile/loading.ts): no live time passes, so nothing happens
   *  unseen. Time away is still caught up meanwhile; it is told after, as ever. */
  held = false;

  /** Whether time away is still being simulated (don't save mid-way: the save would lose the rest). */
  get catchingUp(): boolean {
    return !!this.job;
  }

  start(): void {
    this.last = performance.now();
    this.lastWall = Date.now();
    this.timer ??= setInterval(() => this.pump(), TICK_MS);
  }

  /** Replace the running game (e.g. a new seed). */
  reset(state: GameState): void {
    this.sim = new Sim(state);
    this.job = null;
    this.last = performance.now();
    this.lastWall = Date.now();
  }

  /** Start simulating time spent away (the game closed, or the PC asleep); `done` runs when it's finished. */
  catchUp(ms: number, done?: (r: CatchUpResult) => void): void {
    if (this.job) return;
    if (fightOnScreen(this.sim.state)) return void done?.({ ticks: 0 }); // (a fight left on screen waits for the player) // (already catching up: the rest of this gap is dropped)
    const before = awayBefore(this.sim.state);
    this.job = { job: startCatchUp(this.sim, ms), awayMs: ms, t0: performance.now(), before, snapAt: 0, done };
  }

  command(c: Command): void {
    this.sim.command(c);
  }

  snapshot(): Snapshot {
    const snap = snapshot(this.sim.state);
    if (this.job) snap.catchingUp = this.job.job.progress;
    return snap;
  }

  journal(): JournalEntryView[] {
    return journalView(this.sim.state);
  }

  private pump(): void {
    if (this.job) return this.catchUpSlice();
    if (this.held) {
      this.last = performance.now();
      this.lastWall = Date.now();
      return;
    }
    const wallGap = Date.now() - this.lastWall;
    // (a raid or a fight on the screen waits while the page is in the background, and the time away is not played:
    // the player comes back to it as they left it; sim/raidWait.ts)
    if ((this.hidden || wallGap > SLEEP_GAP_MS) && fightOnScreen(this.sim.state)) {
      this.last = performance.now();
      this.lastWall = Date.now();
      return;
    }
    if (wallGap > SLEEP_GAP_MS) {
      this.catchUp(wallGap);
      return;
    }
    this.lastWall = Date.now();
    const now = performance.now();
    // (a raid being skipped to its recap runs flat out, a slice a frame: sim/raidSkip.ts)
    if (this.sim.state.raidSkip && this.sim.state.raid && !this.sim.state.paused && this.speed > 0) {
      const until = now + SKIP_SLICE_MS;
      while (this.sim.state.raid && performance.now() < until) this.sim.step();
      this.last = performance.now();
      this.onTicks(this.snapshot());
      return;
    }
    // (a raid's battle can be played at 2 or 3 times: the sim simply runs that much more time)
    const fast = this.speed * battleSpeedNow(this.sim.state);
    const ms = (now - this.last) * fast;
    this.last = now;
    if (this.sim.advance(ms, MAX_TICKS_PER_ADVANCE * fast, FRAME_BUDGET_MS) > 0) this.onTicks(this.snapshot());
  }

  private catchUpSlice(): void {
    const j = this.job!;
    const until = performance.now() + CATCH_UP_SLICE_MS;
    let finished = false;
    while (!finished && performance.now() < until) {
      finished = j.job.run(CATCH_UP_BATCH);
      awayWatch(this.sim.state, j.before); // (raids that end one after another: only the last recap stays)
    }
    if (finished) {
      const r = j.job.finish();
      this.job = null;
      if (r.ticks) console.log(`[offline] simulated ${r.ticks} ticks for ${Math.round(j.awayMs / 1000)}s away in ${Math.round(performance.now() - j.t0)}ms`);
      // (time kept passing while we caught up: that little bit is simply skipped)
      this.last = performance.now();
      this.lastWall = Date.now();
      j.done?.(r);
      const snap = this.snapshot();
      if (r.ticks) snap.away = awaySummary(this.sim.state, j.before);
      this.onTicks(snap);
      return;
    }
    if (performance.now() - j.snapAt < CATCH_UP_SNAP_MS) return;
    j.snapAt = performance.now();
    this.onTicks(this.snapshot());
  }
}
