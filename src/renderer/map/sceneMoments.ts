// How the small scenes about town look (sim/idleScenes.ts says who's at which; this is how each is drawn), pure so
// the tests can read it: sheltering under the eaves (a shiver, a look up at the sky), splashing in puddles (a jump,
// a splash as they land), tag (the one who's "it" calls out, the rest jeer), an elder feeding the pigeons (sat, a
// handful thrown now and then), a couple by the water (sat side by side looking out, a heart now and then), and the
// busker (an instrument played, a note over their head). No Pixi here.

import type { Emote } from '../art/effects';
import type { DanceStep } from './dance';
import type { HkFacing } from '../art/hkFolk';

export interface SceneMoment {
  step?: DanceStep;
  dx?: number;
  line?: string;
  emote?: Emote;
  prop?: 'lute' | 'flute';
}

/** A puddle jump: the time of each (ms), how long one is in the air, and how high (px). */
export const SPLASH_EVERY = 1100;
export const SPLASH_AIR = 420;
export const SPLASH_HIGH = 7;

/** How high a child is off the ground mid-jump (0 between jumps), and whether they've just landed (the splash). */
export function splashJump(id: number, now: number): { lift: number; landed: boolean } {
  const t = (now + id * 377) % SPLASH_EVERY;
  if (t < SPLASH_AIR) return { lift: Math.round(Math.sin((t / SPLASH_AIR) * Math.PI) * SPLASH_HIGH), landed: false };
  return { lift: 0, landed: t < SPLASH_AIR + 180 };
}

/** The elder throws a handful of crumbs this often (ms), the arm out for this long. */
export const CRUMBS_EVERY = 3400;
export const CRUMBS_FOR = 500;
/** Whether the elder's arm is out with a handful now, and how far through the throw. */
export function throwing(id: number, now: number): number | null {
  const t = (now + id * 911) % CRUMBS_EVERY;
  return t < CRUMBS_FOR ? t / CRUMBS_FOR : null;
}

/** What tag's players call out, now and then. */
export const TAG_IT = ['Coming to get you!', 'You\'re it... no, YOU!', 'Got you!', 'I\'ll catch you!'];
export const TAG_RUN = ['Can\'t catch me!', 'Too slow!', 'Missed!', 'Ha ha!'];
/** A call this long (ms) in every so long, by their id. */
const CALL_EVERY = 7000;
const CALL_FOR = 1800;

/** The busker plays one of DawnLike's instruments: a lyre or a flute, by their id. */
export const instrumentOf = (id: number): 'lute' | 'flute' => (id % 2 ? 'flute' : 'lute');

/** A scene's look this frame, or null when it isn't one (or they're on their way to it). `water` is which way the
 *  water lies from a couple sat by it. */
export function sceneMoment(kind: string, o: { id: number; now: number; moving: boolean; it?: boolean; water?: HkFacing | null }): SceneMoment | null {
  const { id, now, moving } = o;
  const still = (col: number, facing: HkFacing, lift = 0): DanceStep => ({ col, facing, lift, squash: 1 });
  switch (kind) {
    case 'tag': {
      const t = (now + id * 1301) % CALL_EVERY;
      const lines = o.it ? TAG_IT : TAG_RUN;
      return t < CALL_FOR ? { line: lines[Math.floor((now + id * 1301) / CALL_EVERY) % lines.length] } : null;
    }
    case 'splash': {
      if (moving) return null;
      const j = splashJump(id, now);
      return { step: { col: j.lift > 0 ? 3 : 0, facing: 'down', lift: j.lift, squash: j.landed ? 0.86 : 1 } };
    }
    case 'eaves': {
      if (moving) return null;
      // (a look up at the sky now and then, and a shiver)
      const t = (now / 1000 + id * 1.9) % 9;
      return { step: still(0, t < 1.6 ? 'up' : 'down'), dx: t > 4 && t < 4.6 ? (Math.floor(now / 60) % 2 ? 1 : -1) : 0 };
    }
    case 'pigeons': {
      if (moving) return null;
      const th = throwing(id, now);
      return { step: still(th !== null ? 5 : 7, 'down'), emote: (now / 1000 + id) % 14 < 1.2 ? 'heart' : undefined };
    }
    case 'riverside': {
      if (moving) return null;
      return { step: still(7, o.water ?? 'up'), emote: (now / 1000 + id * 2.3) % 16 < 1.5 ? 'heart' : undefined };
    }
    case 'busk': {
      if (moving) return null;
      // (playing: the hands at the instrument, swaying to the tune, a note now and then)
      const beat = Math.floor((now + id * 211) / 380) % 4;
      return { step: still(beat % 2 ? 5 : 6, 'down', beat === 0 ? 1 : 0), prop: instrumentOf(id), emote: (now / 1000 + id) % 5 < 2.4 ? 'note' : undefined };
    }
    default:
      return null;
  }
}

/** Whether it's raining on them (a hood up): rain or a storm, out of doors and not under the eaves. */
export const hooded = (weather: string, indoors: boolean, pastime: string | undefined) => (weather === 'rain' || weather === 'storm') && !indoors && pastime !== 'eaves';
