// The God creature on the isometric map: which of its sheet's moves it plays for what the snapshot says it is doing
// (art/iso/creature/<kind>/, the folk's layout: iso/folkLoader.ts `loadCreatureSet`). No Pixi and no DOM, so the
// tests can run it. The facing is the folk's (folkRules.ts `facingFromVector`).

import type { CreatureDeed, CreatureKind } from '../../shared/data/creature';
import type { CreatureView } from '../../shared/sim/creature';

/** The God creature's sheets (art/iso/creature/<kind>/, copied by build.mjs to `iso/creature` beside the page). */
export const CREATURE_ROOT = { url: 'iso/creature' };

/** Every move a creature's sheet may have ('stand' is the still rotation frame: every kind has it). */
export type CreatureAnim =
  | 'stand' | 'walk' | 'run' | 'idle' | 'pickup' | 'throw' | 'push' | 'pull' | 'eat' | 'punch' | 'uppercut'
  | 'hit' | 'death' | 'getup' | 'miracle' | 'sad' | 'joy';

/** What the map has seen of it lately, beside its snapshot (seconds, on the map's own clock). */
export interface CreatureSeen {
  /** How fast it moved lately (world px a second). */
  speed: number;
  /** Since its health last dropped, since it was praised, since it woke (Infinity: not lately). */
  sinceHurt: number;
  sincePraised: number;
  sinceWoke: number;
}

/** Below this speed it stands; from `CREATURE_RUN` it runs (a hunt or a chase runs from a walk's pace). */
export const CREATURE_MOVING = 4;
export const CREATURE_RUN = 70;
/** How long a blow, a praise and a waking show (seconds). */
export const HURT_SHOW = 0.7;
export const JOY_SHOW = 2.5;
export const GETUP_SHOW = 0.8;
/** Below this share of its health it looks sorry for itself. */
export const SAD_HURT = 0.3;

/** The work it does at a deed's spot, played in turn (a pair alternates: it picks a load up, then throws it down). */
const AT_WORK: Record<CreatureDeed, CreatureAnim[]> = {
  haul: ['pickup', 'throw'],
  build: ['push', 'pull'],
  farm: ['pull'],
  guard: ['idle'],
  hunt: ['punch', 'uppercut'],
  fight: ['punch', 'uppercut'],
  play: ['throw', 'pickup'],
  heal: ['miracle'],
  eat_crops: ['eat'],
  steal: ['pickup', 'eat'],
  scare: ['punch'],
  eat_villager: ['uppercut', 'eat'],
  eat: ['eat'],
  sleep: ['idle'],
  wander: ['idle'],
};
/** Deeds it hurries to. */
const HURRIES: ReadonlySet<CreatureDeed> = new Set(['hunt', 'fight', 'scare', 'eat_villager']);

/** The moves it would like now, played in turn (one is played over and over). Before checking what its sheet has. */
export function creatureMoves(v: Pick<CreatureView, 'doing' | 'asleep' | 'mood' | 'hp' | 'maxHp' | 'dead'>, seen: CreatureSeen): CreatureAnim[] {
  if (v.dead) return ['death'];
  if (seen.sinceHurt < HURT_SHOW) return ['hit'];
  // (asleep, it lies down: the fall played once and held; it gets up when it wakes)
  if (v.asleep) return ['death'];
  if (seen.sinceWoke < GETUP_SHOW) return ['getup'];
  if (seen.speed > CREATURE_MOVING) return [seen.speed >= CREATURE_RUN || HURRIES.has(v.doing) ? 'run' : 'walk'];
  if (seen.sincePraised < JOY_SHOW) return ['joy'];
  const work = AT_WORK[v.doing];
  if (work[0] !== 'idle') return work;
  if (v.mood === 'lonely' || v.mood === 'afraid' || v.hp < v.maxHp * SAD_HURT) return ['sad'];
  return ['idle'];
}

/** What to try, in order, when a sheet lacks a move (joy is still coming for some). */
const FALLBACK: Record<CreatureAnim, CreatureAnim[]> = {
  stand: [],
  idle: ['stand'],
  walk: ['stand'],
  run: ['walk', 'stand'],
  joy: ['miracle', 'idle', 'stand'],
  getup: ['idle', 'stand'],
  hit: ['idle', 'stand'],
  death: ['stand'],
  sad: ['idle', 'stand'],
  miracle: ['idle', 'stand'],
  pickup: ['push', 'idle', 'stand'],
  throw: ['pickup', 'push', 'idle', 'stand'],
  push: ['pull', 'idle', 'stand'],
  pull: ['push', 'idle', 'stand'],
  eat: ['idle', 'stand'],
  punch: ['uppercut', 'idle', 'stand'],
  uppercut: ['punch', 'idle', 'stand'],
};
const FPS: Record<CreatureAnim, number> = {
  stand: 1, idle: 4, walk: 8, run: 12, joy: 9, getup: 7, hit: 10, death: 8, sad: 5, miracle: 7,
  pickup: 7, throw: 8, push: 7, pull: 7, eat: 6, punch: 9, uppercut: 9,
};
/** Played once and held on the last frame. */
const ONCE: ReadonlySet<CreatureAnim> = new Set(['death', 'getup', 'hit']);

/** The move to play: the wanted one, or the first its sheet has. A sheet with no `run` walks faster (`rate`). */
export function creaturePlay(wanted: CreatureAnim, has: (a: CreatureAnim) => boolean): { anim: CreatureAnim; fps: number; loop: boolean; rate: number } {
  const anim = [wanted, ...FALLBACK[wanted]].find((a) => a === 'stand' || has(a)) ?? 'stand';
  return { anim, fps: FPS[anim], loop: !ONCE.has(anim), rate: wanted === 'run' && anim === 'walk' ? 1.5 : 1 };
}

/** Which of a turn's moves is playing, and the frame in it, `t` seconds into the turn: each move plays through once,
 *  then the next (the turn loops). A one-off move holds its last frame. `frames(i)` is the frame count of move i. */
export function turnFrame(frames: (i: number) => number, fps: number[], n: number, t: number, loop: boolean): { i: number; frame: number } {
  if (n <= 1) {
    const c = Math.max(1, frames(0));
    const f = Math.floor(Math.max(0, t) * fps[0]);
    return { i: 0, frame: loop ? f % c : Math.min(c - 1, f) };
  }
  const lens = Array.from({ length: n }, (_, i) => Math.max(1, frames(i)) / fps[i]);
  const total = lens.reduce((a, b) => a + b, 0);
  let r = ((Math.max(0, t) % total) + total) % total;
  for (let i = 0; i < n; i++) {
    if (r < lens[i]) return { i, frame: Math.min(Math.max(1, frames(i)) - 1, Math.floor(r * fps[i])) };
    r -= lens[i];
  }
  return { i: n - 1, frame: Math.max(1, frames(n - 1)) - 1 };
}

/** Its tint on the sheet, gentler than the stand-in's (the sheets are drawn in their own colours): a share of the way
 *  from white to its nature's tint (data/creature.ts `creatureTint`), so a good wolf stays a grey wolf with a warm cast
 *  and a cruel one goes darker and red. A cruel tint is taken further: darkness reads less than warmth. */
export const GOOD_TINT_SHARE = 0.35;
export const EVIL_TINT_SHARE = 0.6;
export function gentleTint(tint: number, align: number): number {
  const share = align >= 0 ? GOOD_TINT_SHARE : EVIL_TINT_SHARE;
  const ch = (sh: number) => Math.round(255 + (((tint >> sh) & 255) - 255) * share);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Each kind's action move in the lineup (mobile/beastLineup.ts): the ape and the bear throw, the wolf and the bull
 *  punch, the golem works a miracle. */
export const LINEUP_MOVE: Record<CreatureKind, CreatureAnim> = { ape: 'throw', wolf: 'punch', bear: 'throw', bull: 'punch', golem: 'miracle' };
