// Background music (TinyRPGMusic by ansimuz, see CREDITS.md): a quiet town theme, and battle music while
// raiders are in town. Off by default; nothing plays while the strip is hidden.

const VOLUME = 0.22;
const FADE_MS = 1500;

export interface Music {
  update(on: boolean, battle: boolean): void;
}

export function createMusic(): Music {
  const tracks = { town: track('music/town.ogg'), battle: track('music/battle.ogg') };
  let playing: HTMLAudioElement | null = null;
  const fadeTo = (next: HTMLAudioElement | null) => {
    if (next === playing) return;
    const prev = playing;
    playing = next;
    if (prev) fade(prev, 0, () => prev.pause());
    if (next) {
      next.volume = 0;
      void next.play().catch(() => {}); // (blocked autoplay just means silence)
      fade(next, VOLUME);
    }
  };
  return {
    update(on, battle) {
      fadeTo(on ? (battle ? tracks.battle : tracks.town) : null);
    },
  };
}

function track(src: string): HTMLAudioElement {
  const a = new Audio(src);
  a.loop = true;
  a.preload = 'none';
  return a;
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
