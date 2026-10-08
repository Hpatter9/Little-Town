// A cutscene's clock (pure: no Pixi, no DOM; tested in test/cutscenes.test.ts). The script (data/cutscenes.ts) is
// played as a run of beats: each line of a shot is a beat (`lineSeconds` long), and a shot's hold another; a tap moves
// to the next beat. From where the clock stands it works out the camera (the shot's `cam`, drifting toward its `to`
// over the shot, eased) and every actor: where they stand, which way they face, their pose, whether they're walking,
// replaying the acts of every shot so far (a walk takes its time, and is cut short if the shot ends first).

import { FEET, lineSeconds, STAGE_W, type Cam, type CastMember, type Cutscene, type Facing, type Pose, type Shot } from '../../shared/data/cutscenes';

export interface Cursor {
  shot: number;
  /** The beat in the shot: a line's index, or the lines' count for the hold after them. */
  beat: number;
  /** Seconds into the beat, and into the shot. */
  t: number;
  shotT: number;
}

export const start = (): Cursor => ({ shot: 0, beat: 0, t: 0, shotT: 0 });

/** A shot's hold (seconds after its lines; a shot with no lines holds 2.5 s at least). */
const holdOf = (s: Shot) => s.hold ?? (s.lines?.length ? 0 : 2.5);
/** Each beat's length in a shot: its lines, then its hold (if any). */
export function beats(s: Shot): number[] {
  const out = (s.lines ?? []).map((l) => lineSeconds(l.text));
  const h = holdOf(s);
  if (h > 0) out.push(h);
  return out.length ? out : [2.5];
}
export const shotLength = (s: Shot) => beats(s).reduce((n, b) => n + b, 0);

/** The clock moved on by `dt` seconds; null once the scene is over. */
export function tick(c: Cursor, script: Cutscene, dt: number): Cursor | null {
  let { shot, beat, t, shotT } = c;
  t += dt;
  shotT += dt;
  for (;;) {
    const s = script.shots[shot];
    if (!s) return null;
    const b = beats(s);
    if (t < b[beat]) return { shot, beat, t, shotT };
    t -= b[beat];
    beat++;
    if (beat >= b.length) {
      shot++;
      beat = 0;
      shotT = t;
    }
  }
}

/** A tap: straight on to the next beat (the next line, the hold, the next shot). */
export function next(c: Cursor, script: Cutscene): Cursor | null {
  const s = script.shots[c.shot];
  if (!s) return null;
  const b = beats(s);
  const done = b.slice(0, c.beat + 1).reduce((n, x) => n + x, 0);
  if (c.beat + 1 < b.length) return { shot: c.shot, beat: c.beat + 1, t: 0, shotT: done };
  return c.shot + 1 < script.shots.length ? { shot: c.shot + 1, beat: 0, t: 0, shotT: 0 } : null;
}

/** The line being spoken now (null in a hold). */
export const lineNow = (c: Cursor, script: Cutscene) => script.shots[c.shot]?.lines?.[c.beat] ?? null;
/** How much of a line is shown, typed out at `TYPE_RATE` characters a second. */
export const TYPE_RATE = 42;
export const typedChars = (text: string, t: number) => Math.min(text.length, Math.floor(t * TYPE_RATE));

/** The backdrop at a shot: its own, else the last one set before it. */
export function lookAt(script: Cutscene, shot: number): string {
  for (let i = shot; i >= 0; i--) if (script.shots[i]?.look) return script.shots[i].look!;
  return 'town';
}

/* ------------------------------------------------------------ the actors */

export interface ActorNow {
  x: number;
  facing: Facing;
  pose: Pose;
  visible: boolean;
  walking: boolean;
  /** Steps walked (for the walk's frames). */
  walked: number;
}

/** How fast actors walk (stage px a second), and where those coming on or going off start and end. */
export const WALK_PACE = 42;
const OFF = { left: -40, right: STAGE_W + 40 } as const;
/** Poses that last past their shot (the fallen stay down); the rest last their shot only. */
const LASTING: Pose[] = ['kneel', 'down'];

/** Every actor at a point in the scene. */
export function actorsAt(script: Cutscene, c: Cursor): Record<string, ActorNow> {
  const out: Record<string, ActorNow> = {};
  for (const [id, m] of Object.entries(script.cast)) out[id] = { x: m.x, facing: m.facing, pose: 'idle', visible: !(m as CastMember).hidden, walking: false, walked: 0 };
  for (let i = 0; i <= c.shot && i < script.shots.length; i++) {
    const s = script.shots[i];
    const now = i === c.shot;
    const len = shotLength(s);
    // (a pose lasts its shot; the fallen stay down)
    for (const a of Object.values(out)) if (!LASTING.includes(a.pose)) a.pose = 'idle';
    for (const act of s.acts ?? []) {
      const a = out[act.who];
      if (!a) continue;
      if ('face' in act) a.facing = act.face;
      else if ('pose' in act) a.pose = act.pose;
      else {
        const from = 'enter' in act ? OFF[act.from] : a.x;
        const to = 'walk' in act ? act.walk : 'enter' in act ? act.enter : OFF[act.exit];
        // (a walk takes its time, hurried to fit in the shot's first 80%)
        const pace = Math.max(WALK_PACE, Math.abs(to - from) / Math.max(0.5, len * 0.8));
        const took = Math.abs(to - from) / pace;
        const t = now ? Math.min(c.shotT, took) : took;
        a.visible = true;
        if (to !== from) a.facing = to > from ? 'right' : 'left';
        a.x = from + (to - from) * (took > 0 ? t / took : 1);
        a.walked = Math.abs(a.x - from) / 3;
        a.walking = now && c.shotT < took;
        if ('exit' in act && (!now || c.shotT >= took)) a.visible = false;
        // (one who came on faces the stage once there, as the cast said)
        if ('enter' in act && !a.walking) a.facing = script.cast[act.who].facing;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ the camera */

export interface CamNow {
  x: number;
  y: number;
  zoom: number;
  tilt: number;
}

/** Where a head is: an actor's x, a little above the middle of a figure on the feet line. */
const HEAD = FEET - 26;

function resolve(cam: Cam, actors: Record<string, ActorNow>): CamNow {
  const on = cam.on === undefined ? [] : Array.isArray(cam.on) ? cam.on : [cam.on];
  const xs = on.map((id) => actors[id]?.x).filter((x): x is number => x !== undefined);
  const x = cam.x ?? (xs.length ? xs.reduce((n, v) => n + v, 0) / xs.length : STAGE_W / 2);
  return { x, y: cam.y ?? (xs.length ? HEAD : 104), zoom: cam.zoom ?? 1, tilt: cam.tilt ?? 0 };
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The camera now: the shot's, drifting toward its `to` over the shot (each end follows its actors). */
export function cameraAt(script: Cutscene, c: Cursor, actors = actorsAt(script, c)): CamNow {
  const s = script.shots[c.shot];
  if (!s) return { x: STAGE_W / 2, y: 104, zoom: 1, tilt: 0 };
  const a = resolve(s.cam, actors);
  if (!s.to) return a;
  const b = resolve(s.to, actors);
  const k = ease(Math.min(1, c.shotT / Math.max(0.1, shotLength(s))));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.zoom + (b.zoom - a.zoom) * k, tilt: a.tilt + (b.tilt - a.tilt) * k };
}
