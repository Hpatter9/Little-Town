// Background music (the owner's ask: more music, not always the same two songs). What plays follows the town's mood
// (`Mood`: day, night, winter, the dark peoples, a feast, the sea, the knights' heroics, a battle, a boss): the game's
// own composed pieces (musicScore.ts, played by musicGen.ts: each a different take every time) in turn with the
// recorded tracks (TinyRPGMusic by ansimuz and the boss themes, see CREDITS.md), never the same one twice running. A
// change of mood fades to something of the new mood. Off by default; nothing plays while the strip is hidden.

import { createPlayer, type Player } from './musicGen';
import { piecesFor, type Mood } from './musicScore';

const VOLUME = 0.22;
const FADE_MS = 1500;
/** A short rest between pieces in the town (not in a fight). */
const REST_MS = 6000;

export type { Mood };

export interface Music {
  update(on: boolean, mood: Mood): void;
  /** For previews: what's playing. */
  readonly now: string | null;
}

/** The recorded tracks, by the moods they suit. */
const FILES: { id: string; src: string; moods: Mood[] }[] = [
  { id: 'file:town', src: 'music/town.ogg', moods: ['day', 'feast', 'heroic', 'sea'] },
  { id: 'file:battle', src: 'music/battle.ogg', moods: ['battle'] },
  { id: 'file:boss', src: 'music/boss.ogg', moods: ['boss'] },
  { id: 'file:boss2', src: 'music/boss2.ogg', moods: ['boss', 'battle'] },
];

/** What's next for a mood: a composed piece or a file, never `last`. Recorded tracks come up about one time in four
 *  in the town and half the time in a fight. Pure. */
export function nextFor(mood: Mood, last: string | null, r: number): string {
  const pieces = piecesFor(mood).map((p) => p.id);
  const files = FILES.filter((f) => f.moods.includes(mood)).map((f) => f.id);
  const fileShare = mood === 'battle' || mood === 'boss' ? 0.5 : 0.25;
  const pool = (files.length && r < fileShare ? files : pieces).filter((x) => x !== last);
  const all = [...pieces, ...files].filter((x) => x !== last);
  const from = pool.length ? pool : all.length ? all : pieces;
  const k = Math.floor(((r * 7919) % 1) * from.length);
  return from[Math.min(from.length - 1, k)];
}

export function createMusic(): Music {
  let player: Player | null = null;
  let audio: HTMLAudioElement | null = null;
  let now: string | null = null;
  let mood: Mood | null = null;
  let on = false;
  let rest: number | null = null;
  let seed = Math.floor(Math.random() * 1e6);

  const stopAll = () => {
    if (rest !== null) clearTimeout(rest);
    rest = null;
    player?.stop();
    if (audio) {
      const a = audio;
      fade(a, 0, () => a.pause());
    }
    audio = null;
    now = null;
  };

  const begin = () => {
    if (!on || !mood) return;
    const id = nextFor(mood, now, Math.random());
    now = id;
    const after = () => {
      if (now !== id || !on) return;
      const fight = mood === 'battle' || mood === 'boss';
      rest = window.setTimeout(() => {
        rest = null;
        if (now === id && on) begin();
      }, fight ? 300 : REST_MS);
    };
    const file = FILES.find((f) => f.id === id);
    if (file) {
      const a = new Audio(file.src);
      a.preload = 'auto';
      a.volume = 0;
      audio = a;
      a.onended = () => {
        if (audio === a) audio = null;
        after();
      };
      a.onerror = () => after();
      void a.play().catch(() => after());
      fade(a, VOLUME);
      return;
    }
    player ??= createPlayer();
    const piece = piecesFor(mood).find((p) => p.id === id);
    if (!player || !piece) return;
    player.setVolume(VOLUME * 0.9);
    player.play(piece, seed++, after);
  };

  return {
    get now() {
      return now;
    },
    update(want, m) {
      if (!want) {
        if (on) stopAll();
        on = false;
        return;
      }
      if (on && m === mood) return;
      // a fight's music starts at once, and ends with the fight; a quieter change (dusk, a feast, winter) waits for
      // the piece playing to end, and the next is of the new mood
      const fight = (x: Mood | null) => x === 'battle' || x === 'boss';
      const was = mood;
      const wasOn = on;
      on = true;
      mood = m;
      if (!wasOn || !now || fight(m) || fight(was)) {
        stopAll();
        begin();
      }
    },
  };
}

function fade(a: HTMLAudioElement, to: number, done?: () => void): void {
  const from = a.volume;
  const start = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / FADE_MS);
    a.volume = from + (to - from) * t;
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}
