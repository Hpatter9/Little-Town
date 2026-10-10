// The time away replayed, sped up (the owner's ask; the frames and the sums in shared/replay.ts). While the catch-up
// runs the town is veiled ("While you were away…", how far it's got); then the frames play through the map renderer
// for a few seconds (`replayLength`), black bars top and foot, the day count in the foot bar ("Day 12 → Day 13"), the
// running clock and season under it, what was raised, and a bar of how far it's played; the hours turn smoothly
// between the frames (`lightBetween`). A tap anywhere skips it. Then the town as it is now, and the report card. In the
// strip's page (index.html `#replay`).

import { lightBetween, replayAt, replayClock, replayLength, replayTally, replayTitle, hoursOf, type Replay, type ReplayFrame } from '../../shared/replay';

/** How long the bars take to come in and go (ms). */
const BARS_MS = 450;

export interface ReplayHooks {
  /** Draw the town as a frame shows it. */
  apply(frame: ReplayFrame): void;
  /** The light between frames: the daylight and the hour. */
  light(daylight: number, hour: number): void;
  /** Played through or skipped: back to the town as it is. */
  done(): void;
  /** On and off (the phone page gives it the whole screen). */
  shown(on: boolean): void;
}

export interface ReplayPlayer {
  readonly playing: boolean;
  start(r: Replay, now: number): void;
  /** Each frame of the strip's ticker. */
  tick(now: number): void;
  skip(): void;
  /** While the catch-up runs: how far it's got (0..1), or null to lift the veil. */
  veil(progress: number | null): void;
}

export function createReplayPlayer(root: HTMLElement, hooks: ReplayHooks): ReplayPlayer {
  const el = document.createElement('div');
  el.id = 'replay';
  el.setAttribute('data-hit', '');
  el.innerHTML =
    '<div class="rp-bar top"><span class="rp-kicker">While you were away</span><span class="rp-skip">Tap to skip ▸▸</span></div>' +
    '<div class="rp-bar bottom"><div class="rp-card"><div class="rp-title"></div><div class="rp-clock"></div><div class="rp-tally"></div><div class="rp-track"><div class="rp-fill"></div></div></div></div>' +
    '<div class="rp-veil"><div class="rp-veil-card"><div class="rp-veil-title">While you were away…</div><div class="rp-veil-sub">The town went on without you</div><div class="rp-track"><div class="rp-fill"></div></div></div></div>';
  root.append(el);
  const $ = (q: string) => el.querySelector(q) as HTMLElement;
  const title = $('.rp-title');
  const clock = $('.rp-clock');
  const tally = $('.rp-tally');
  const fill = $('.rp-bar .rp-fill');
  const veilFill = $('.rp-veil .rp-fill');
  let run: { frames: ReplayFrame[]; length: number; t0: number; shown: number; ending: number } | null = null;

  const finish = () => {
    if (!run) return;
    run = null;
    el.classList.remove('on');
    hooks.shown(false);
    hooks.done();
  };
  el.addEventListener('click', () => {
    if (run) finish();
  });

  return {
    get playing() {
      return !!run;
    },
    start(r, now) {
      const frames = r.frames;
      if (frames.length < 2) return;
      // (`window.__replaySlow` stretches it, for previews in a slow headless browser)
      const slow = (window as unknown as { __replaySlow?: number }).__replaySlow ?? 1;
      run = { frames, length: replayLength(hoursOf(frames)) * slow, t0: now + BARS_MS, shown: -1, ending: 0 };
      title.textContent = replayTitle(frames[0], frames[frames.length - 1]);
      tally.textContent = replayTally(frames[0], frames[frames.length - 1]);
      tally.hidden = !tally.textContent;
      el.classList.remove('veiled');
      el.classList.add('on');
      hooks.shown(true);
      hooks.apply(frames[0]);
      run.shown = 0;
    },
    tick(now) {
      if (!run) return;
      const at = replayAt(run.frames, now - run.t0, run.length);
      if (at.i !== run.shown) {
        run.shown = at.i;
        hooks.apply(run.frames[at.i]);
      }
      const a = run.frames[at.i];
      const b = run.frames[Math.min(run.frames.length - 1, at.i + 1)];
      const l = lightBetween(a, b, at.f);
      hooks.light(l.daylight, l.hour);
      clock.textContent = replayClock(at.f > 0.5 ? b : a, l.hour);
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, (now - run.t0) / run.length)) * 100)}%`;
      // (the last frame held a moment, then the bars go)
      if (at.done) {
        if (!run.ending) {
          run.ending = now;
          hooks.apply(run.frames[run.frames.length - 1]);
        } else if (now - run.ending > BARS_MS) finish();
      }
    },
    skip: finish,
    veil(progress) {
      if (run) return;
      el.classList.toggle('veiled', progress !== null);
      if (progress !== null) veilFill.style.width = `${Math.round(progress * 100)}%`;
    },
  };
}
