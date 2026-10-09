// Drives the sim from real time, independent of any window's frame rate: in the desktop app's main process,
// and on the phone (web) version in the page itself.

import type { Command } from './sim/commands';
import { battleSpeedNow } from './sim/battle';
import { startCatchUp, type CatchUpJob, type CatchUpResult } from './sim/offline';
import { MAX_TICKS_PER_ADVANCE, Sim } from './sim/sim';
import { journalView, snapshot, type JournalEntryView, type Snapshot } from './sim/snapshot';
import type { GameState } from './sim/state';
import { TICK_MS } from './sim/time';

/** A gap in the wall clock longer than this means the PC slept: it's treated as time away. */
const SLEEP_GAP_MS = 60_000;
/** Catching up runs in slices of about this long, so the app stays responsive (and the town visibly fast-forwards). */
const CATCH_UP_SLICE_MS = 80;
const CATCH_UP_BATCH = 500;

/** How long a frame spends running a raid being skipped (ms). */
const SKIP_SLICE_MS = 24;

export class GameLoop {
  private sim: Sim;
  private last = performance.now();
  private lastWall = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Time away being simulated, a slice per pump. */
  private job: { job: CatchUpJob; awayMs: number; t0: number; done?: (r: CatchUpResult) => void } | null = null;
  /** Debug time multiplier (1 = real time). */
  speed = 1;
  /** While time away is caught up, a snapshot every `every` ticks (`done` false), and one more when it's finished (`done`
   *  true): the phone's replay of the time away (shared/replay.ts). The catch-up's batches stop at each, so they fall on
   *  the hour; the ticks simulated are the same either way. */
  sampler: { every: number; take: (snap: Snapshot, done: boolean) => void } | null = null;
  private nextSample = 0;

  constructor(
    state: GameState,
    private readonly onTicks: (snap: Snapshot) => void,
  ) {
    this.sim = new Sim(state);
  }

  get state(): GameState {
    return this.sim.state;
  }

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
    if (this.job) return; // (already catching up: the rest of this gap is dropped)
    this.job = { job: startCatchUp(this.sim, ms), awayMs: ms, t0: performance.now(), done };
    this.nextSample = this.sim.state.tick;
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
    const wallGap = Date.now() - this.lastWall;
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
    if (this.sim.advance(ms, MAX_TICKS_PER_ADVANCE * fast) > 0) this.onTicks(this.snapshot());
  }

  private catchUpSlice(): void {
    const j = this.job!;
    const until = performance.now() + CATCH_UP_SLICE_MS;
    let finished = false;
    while (!finished && performance.now() < until) {
      const sampler = this.sampler;
      if (sampler && this.sim.state.tick >= this.nextSample) {
        sampler.take(this.snapshot(), false);
        this.nextSample = this.sim.state.tick + sampler.every;
      }
      finished = j.job.run(sampler ? Math.max(1, Math.min(CATCH_UP_BATCH, this.nextSample - this.sim.state.tick)) : CATCH_UP_BATCH);
    }
    if (finished) {
      const r = j.job.finish();
      this.job = null;
      this.sampler?.take(this.snapshot(), true);
      if (r.ticks) console.log(`[offline] simulated ${r.ticks} ticks for ${Math.round(j.awayMs / 1000)}s away in ${Math.round(performance.now() - j.t0)}ms`);
      // (time kept passing while we caught up: that little bit is simply skipped)
      this.last = performance.now();
      this.lastWall = Date.now();
      j.done?.(r);
    }
    this.onTicks(this.snapshot());
  }
}
