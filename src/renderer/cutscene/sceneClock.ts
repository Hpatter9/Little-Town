// A cutscene's clock (pure: no Pixi, no DOM; tested in test/cutscenes.test.ts). The script (data/cutscenes.ts) is
// played as a run of beats: each line of a shot is a beat (`lineSeconds` long), and a shot's hold another; a tap moves
// to the next beat. From where the clock stands it works out the camera (the shot's `cam`, drifting toward its `to`
// over the shot, eased) and every actor: where they stand, which way they face, their pose, whether they're walking,
// replaying the acts of every shot so far (a walk takes its time, and is cut short if the shot ends first); and the
// props on the stage, and what's in each hand (`propsAt`, the same way).

import { PROPS, type PropDef } from '../../shared/data/sceneProps';
import { FEET, lineSeconds, STAGE_W, type Act, type Cam, type CastMember, type Cutscene, type Facing, type Pose, type Prop, type Shot } from '../../shared/data/cutscenes';

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
/** When a line of a shot begins (seconds into the shot): where an act waiting for it starts. */
export const lineStart = (s: Shot, line: number) => beats(s).slice(0, line).reduce((n, b) => n + b, 0);
/** When an act starts in its shot (seconds), and how long the shot leaves it. */
const actStart = (s: Shot, a: Act) => (a.line ? lineStart(s, a.line) : 0);

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
  /** What's in hand (a kind in data/sceneProps.ts's HELD), kept from shot to shot. */
  hold: string | null;
}

/** How fast actors walk (stage px a second), and where those coming on or going off start and end. */
export const WALK_PACE = 42;
const OFF = { left: -40, right: STAGE_W + 40 } as const;
/** Poses that last past their shot (the fallen stay down); the rest last their shot only. */
const LASTING: Pose[] = ['kneel', 'down'];

/** Every actor at a point in the scene. */
export function actorsAt(script: Cutscene, c: Cursor): Record<string, ActorNow> {
  const out: Record<string, ActorNow> = {};
  for (const [id, m] of Object.entries(script.cast)) out[id] = { x: m.x, facing: m.facing, pose: 'idle', visible: !(m as CastMember).hidden, walking: false, walked: 0, hold: (m as CastMember).hold ?? null };
  for (let i = 0; i <= c.shot && i < script.shots.length; i++) {
    const s = script.shots[i];
    const now = i === c.shot;
    const len = shotLength(s);
    // (a pose lasts its shot; the fallen stay down)
    for (const a of Object.values(out)) if (!LASTING.includes(a.pose)) a.pose = 'idle';
    for (const act of s.acts ?? []) {
      if (!('who' in act)) continue;
      const a = out[act.who];
      if (!a) continue;
      // (an act waiting for a line hasn't begun until it's spoken)
      const at = actStart(s, act);
      if (now && c.shotT < at) continue;
      if ('face' in act) a.facing = act.face;
      else if ('pose' in act) a.pose = act.pose;
      else if ('hold' in act) a.hold = act.hold;
      else {
        const from = 'enter' in act ? OFF[act.from] : a.x;
        const to = 'walk' in act ? act.walk : 'enter' in act ? act.enter : OFF[act.exit];
        // (a walk takes its time, hurried to fit in what's left of the shot's first 80%)
        const pace = Math.max(WALK_PACE, Math.abs(to - from) / Math.max(0.5, (len - at) * 0.8));
        const took = Math.abs(to - from) / pace;
        const t = now ? Math.min(c.shotT - at, took) : took;
        a.visible = true;
        if (to !== from) a.facing = to > from ? 'right' : 'left';
        a.x = from + (to - from) * (took > 0 ? t / took : 1);
        a.walked = Math.abs(a.x - from) / 3;
        a.walking = now && c.shotT - at < took;
        if ('exit' in act && (!now || c.shotT - at >= took)) a.visible = false;
        // (one who came on faces the stage once there, as the cast said)
        if ('enter' in act && !a.walking) a.facing = script.cast[act.who].facing;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ the props */

export interface PropNow extends Required<Omit<Prop, 'y' | 'anim' | 'lit'>> {
  y: number;
  anim: 'chew' | 'wander';
  lit: boolean;
  /** Seconds since it caught light or went out in this shot (long ago: `LONG_AGO`), for the flare and the last smoke. */
  since: number;
  /** Burned and gone out (charred, or its cold sprite). */
  out: boolean;
  /** Knocked over (a thing burning burns out instead), and when (seconds into this shot, else long ago). */
  broken: boolean;
  sinceBroken: number;
  /** Startled (the goat's bleat, the birds' flight), and seconds since (in this shot, else long ago). */
  startled: boolean;
  sinceStartled: number;
  moving: boolean;
  /** Where a move started, for the goat's steps. */
  walked: number;
}
export const LONG_AGO = 999;

/** Every prop on the stage at a point in the scene: the scene's own, and those of the shots since it last cut to
 *  another place; each as the acts and fx so far have left it. */
export function propsAt(script: Cutscene, c: Cursor): Record<string, PropNow> {
  const out: Record<string, PropNow> = {};
  const place = (p: Prop): PropNow => ({
    id: p.id,
    kind: p.kind,
    x: p.x,
    y: p.y ?? FEET,
    scale: p.scale ?? 1,
    layer: p.layer ?? 'back',
    anim: p.anim ?? 'chew',
    flip: p.flip ?? false,
    lit: p.lit ?? (PROPS[p.kind as keyof typeof PROPS] as PropDef | undefined)?.lit ?? false,
    since: LONG_AGO,
    out: false,
    broken: false,
    sinceBroken: LONG_AGO,
    startled: false,
    sinceStartled: LONG_AGO,
    moving: false,
    walked: 0,
  });
  const own = new Set((script.props ?? []).map((p) => p.id));
  for (const p of script.props ?? []) out[p.id] = place(p);
  let look = '';
  for (let i = 0; i <= c.shot && i < script.shots.length; i++) {
    const s = script.shots[i];
    const now = i === c.shot;
    const since = (at: number) => (now ? c.shotT - at : LONG_AGO);
    // (a cut to another place leaves the last place's things behind)
    if (s.look && s.look !== look) {
      if (i > 0) for (const id of Object.keys(out)) if (!own.has(id)) delete out[id];
      look = s.look;
    }
    for (const p of s.props ?? []) out[p.id] = place(p);
    for (const fx of s.fx ?? []) {
      const [verb, id] = fx.split(':');
      const p = id ? out[id] : undefined;
      if (!p || (verb !== 'ignite' && verb !== 'douse')) continue;
      if (verb === 'douse' && p.lit) p.out = true;
      p.lit = verb === 'ignite';
      p.since = since(0);
    }
    for (const act of s.acts ?? []) {
      if (!('prop' in act)) continue;
      const p = out[act.prop];
      if (!p) continue;
      const at = actStart(s, act);
      if (now && c.shotT < at) continue;
      if ('move' in act) {
        const len = shotLength(s);
        const pace = Math.max(WALK_PACE * 0.5, Math.abs(act.move - p.x) / Math.max(0.5, (len - at) * 0.8));
        const took = Math.abs(act.move - p.x) / pace;
        const t = now ? Math.min(c.shotT - at, took) : took;
        const from = p.x;
        if (act.move !== from) p.flip = act.move < from;
        p.x = from + (act.move - from) * (took > 0 ? t / took : 1);
        p.walked = Math.abs(p.x - from);
        p.moving = now && c.shotT - at < took;
      } else if (act.do === 'light' || act.do === 'douse') {
        if (act.do === 'douse' && p.lit) p.out = true;
        p.lit = act.do === 'light';
        p.since = since(at);
      } else if (act.do === 'break') {
        // (a thing burning burns out; anything else is knocked over)
        if (p.lit) {
          p.lit = false;
          p.out = true;
          p.since = since(at);
        } else p.broken = true;
        p.sinceBroken = since(at);
      } else if (act.do === 'startle') {
        p.startled = true;
        p.sinceStartled = since(at);
      }
      else delete out[act.prop];
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

function resolve(cam: Cam, actors: Record<string, { x: number }>): CamNow {
  const on = cam.on === undefined ? [] : Array.isArray(cam.on) ? cam.on : [cam.on];
  const xs = on.map((id) => actors[id]?.x).filter((x): x is number => x !== undefined);
  const x = cam.x ?? (xs.length ? xs.reduce((n, v) => n + v, 0) / xs.length : STAGE_W / 2);
  return { x, y: cam.y ?? (xs.length ? HEAD : 104), zoom: cam.zoom ?? 1, tilt: cam.tilt ?? 0 };
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The camera now: the shot's, drifting toward its `to` over the shot (each end follows its actors, or props). */
export function cameraAt(script: Cutscene, c: Cursor, actors: Record<string, { x: number }> = { ...propsAt(script, c), ...actorsAt(script, c) }): CamNow {
  const s = script.shots[c.shot];
  if (!s) return { x: STAGE_W / 2, y: 104, zoom: 1, tilt: 0 };
  const a = resolve(s.cam, actors);
  if (!s.to) return a;
  const b = resolve(s.to, actors);
  const k = ease(Math.min(1, c.shotT / Math.max(0.1, shotLength(s))));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.zoom + (b.zoom - a.zoom) * k, tilt: a.tilt + (b.tilt - a.tilt) * k };
}
