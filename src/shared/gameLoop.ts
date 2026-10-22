// Drives the sim from real time, independent of any window's frame rate: in the desktop app's main process,
// and on the phone (web) version in the page itself.

import { holdOf } from './sim/popups';
import type { Command } from './sim/commands';
import { battleSpeedNow } from './sim/battle';
import { MAX_TICKS_PER_ADVANCE, Sim } from './sim/sim';
import { journalView, snapshot, type JournalEntryView, type Snapshot } from './sim/snapshot';
import type { GameState } from './sim/state';
import { TICK_MS } from './sim/time';

/** The most a pump spends running ticks (ms): at the fast speeds the rest is caught up on the next pumps, so input and drawing stay responsive. */
const FRAME_BUDGET_MS = 40;

/** How long a frame spends running a raid being skipped (ms). */
const SKIP_SLICE_MS = 24;

export class GameLoop {
  private sim: Sim;
  private last = performance.now();
  private timer: ReturnType<typeof setInterval> | null = null;
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

  /** The page is in the background (set by the page): the game stands still meanwhile, and carries on from there. */
  hidden = false;
  /** The clock is held (the phone's loading screen is up: mobile/loading.ts): no live time passes, so nothing happens
   *  unseen. */
  held = false;
  /** A card only the page knows of is up (a reveal, the event box's outcome, a recap: renderer/mobile/popupHold.ts): the
   *  town stands still, unless a fight is on screen, which plays on. */
  cardsUp = false;

  start(): void {
    this.last = performance.now();
    this.timer ??= setInterval(() => this.pump(), TICK_MS);
  }

  /** Replace the running game (e.g. a new seed). */
  reset(state: GameState): void {
    this.sim = new Sim(state);
    this.last = performance.now();
  }

  command(c: Command): void {
    this.sim.command(c);
  }

  snapshot(): Snapshot {
    return snapshot(this.sim.state);
  }

  journal(): JournalEntryView[] {
    return journalView(this.sim.state);
  }

  private pump(): void {
    // (nothing runs while the page is in the background or the loading screen is up: the clock is simply held, so
    // the town carries on exactly where it stood)
    if (this.held || this.hidden) {
      this.last = performance.now();
      return;
    }
    const now = performance.now();
    // (a raid being skipped to its recap runs flat out, a slice a frame: sim/raidSkip.ts)
    if (this.sim.state.raidSkip && this.sim.state.raid && !this.sim.state.paused && !holdOf(this.sim.state) && !this.cardsUp && this.speed > 0) {
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
    // (a pop-up up holds the town, a fight on screen plays alone: sim/popups.ts; the page's cards hold too: `cardsUp`)
    const hold = holdOf(this.sim.state) ?? (this.cardsUp ? 'popup' : null);
    if (this.sim.advance(ms, MAX_TICKS_PER_ADVANCE * fast, FRAME_BUDGET_MS, hold) > 0) this.onTicks(this.snapshot());
  }
}
