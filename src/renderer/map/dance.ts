// How the townsfolk move at a gathering (the `dance` and `mourn` activities: sim/ceremonies.ts). At a feast everyone
// dances to one beat: the ring dancers skip round the spot (the sim turns the ring), the rest each have a move of their
// own by their id (a hop, a cheer with an arm thrown up, a clap, a spin, a sway). At a funeral the mourners kneel or
// stand with bowed heads, still. No Pixi here, so the tests can check the steps.

import type { HkFacing } from '../art/hkFolk';

/** The beat everyone dances to (ms). */
export const BEAT = 420;

export type DanceMove = 'hop' | 'cheer' | 'clap' | 'spin' | 'sway';
const MOVES: DanceMove[] = ['hop', 'cheer', 'clap', 'spin', 'sway'];
/** Each person's own move, by their id. */
export const danceMove = (id: number): DanceMove => MOVES[(id * 7 + 3) % MOVES.length];

/** One moment of a dance: the Himeko cell's column (null: as they'd stand or walk), which way they face (null: as
 *  they are), how far off the ground (px), and a squash as they land (1: none). */
export interface DanceStep {
  col: number | null;
  facing: HkFacing | null;
  lift: number;
  squash: number;
}

// (the Himeko cells: 0 standing, 1 and 2 the steps, 3 an arm raised, 4 a lunge, 5 and 6 the punches, 7 kneeling)
const SPIN: HkFacing[] = ['down', 'right', 'up', 'left'];

/** Where someone is in their dance at `now` (ms). `ring`: dancing round in the turning ring (moving). */
export function danceStep(id: number, now: number, ring: boolean): DanceStep {
  const beats = now / BEAT;
  const beat = Math.floor(beats);
  const into = beats - beat; // 0..1 through the beat
  const hop = Math.sin(into * Math.PI); // 0 at each beat, 1 halfway
  if (ring) {
    // (skipping round: a step each beat, high on the half beat)
    return { col: beat % 2 ? 1 : 2, facing: null, lift: Math.round(hop * 4), squash: into < 0.12 ? 0.94 : 1 };
  }
  switch (danceMove(id)) {
    case 'hop':
      return { col: beat % 2 ? 1 : 2, facing: null, lift: Math.round(hop * 5), squash: into < 0.12 ? 0.92 : 1 };
    case 'cheer':
      // (an arm thrown up on every other beat, with a little jump; standing clapping between)
      return beat % 2 ? { col: 3, facing: 'down', lift: Math.round(hop * 3), squash: 1 } : { col: 0, facing: 'down', lift: 0, squash: into < 0.15 ? 0.95 : 1 };
    case 'clap':
      // (the hands together twice a beat, a bob of the knees)
      return { col: into < 0.5 ? 5 : 6, facing: 'down', lift: Math.round(hop * 1.5), squash: 1 };
    case 'spin': {
      // (a turn on the spot every four beats: round through the four facings, then a step each way)
      const bar = beat % 4;
      if (bar === 0) return { col: 1, facing: SPIN[Math.floor(into * 4) % 4], lift: Math.round(hop * 3), squash: 1 };
      return { col: bar % 2 ? 1 : 2, facing: bar === 1 ? 'left' : bar === 2 ? 'down' : 'right', lift: Math.round(hop * 2), squash: 1 };
    }
    case 'sway':
    default:
      // (side to side, a step and a lean each beat)
      return { col: beat % 2 ? 1 : 2, facing: beat % 2 ? 'left' : 'right', lift: Math.round(hop * 1.5), squash: 1 };
  }
}

/** A mourner: a third of them kneel by the grave, the rest stand still, turned to it (the sim turns them to the middle). */
export function mournStep(id: number): DanceStep {
  return { col: id % 3 === 0 ? 7 : 0, facing: null, lift: 0, squash: 1 };
}

/** At a rite before the temple (sim/ceremonies.ts): two in three kneel, the rest stand, all turned to it (up the map:
 *  they gather below its door). */
export function prayStep(id: number): DanceStep {
  return { col: id % 3 === 0 ? 0 : 7, facing: 'up', lift: 0, squash: 1 };
}
