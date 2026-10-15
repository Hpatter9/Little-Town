// How a fighter moves on the fight screen, worked out only from the sim's tick counts (ticks since its last action,
// since it was last hit, whether it is down), so it never outlasts the sim's turn: at a faster battle speed the ticks
// come faster and the motion with them. A blow has a wind-up (a step back), a lunge toward the foe, a hit and a recoil
// back to place; a bow or a spell a draw and a kick as it's loosed; the struck flash, are knocked back and recover; the
// fallen topple and lie. This only moves a sprite (offsets, a lean, a squash): the pictures are the packs' own frames.
// Pure functions, so tests can import it.

/** Ticks a blow's motion lasts (the sim's turns are longer than this at battle speed 1). */
export const LUNGE_TICKS = 9;
/** Ticks into a close blow when it lands (the lunge's peak): its number, flinch and spark wait this long. */
export const MELEE_LAND = 3;
/** Ticks a hit's recoil, and a fall, take. */
export const RECOIL_TICKS = 7;
export const FALL_TICKS = 6;
/** A blow that takes this share of someone's health is a heavy one: a shake of the screen and a harder knock. */
export const HEAVY = 0.25;

export interface MotionIn {
  /** +1 if the fighter's foes are to its right (foes face right, so the party faces left: -1). */
  toward: 1 | -1;
  sinceAction: number;
  sinceHit: number;
  down: boolean;
  /** A bow, sling or spell rather than a close blow. */
  ranged: boolean;
  /** How hard the last blow was (its share of max health, 0 if none) and whether it was a heal or a miss. */
  hard: number;
  /** Ticks since a friend fell (999: none lately). */
  friendDown: number;
  /** A low, long body (a wolf, a boar): it flattens where it falls instead of toppling like a person. */
  wide: boolean;
  /** The fight is won and this fighter is still up. */
  cheering: boolean;
  /** For the idle: milliseconds, and an offset so one fighter isn't in step with the next. */
  now: number;
  ref: number;
}

export interface Motion {
  /** Offset toward the foes (px, signed by the screen: + is right) and up (+ is up). */
  dx: number;
  dy: number;
  /** Lean (radians, about the feet, + clockwise) and a squash about the feet (1 = none). */
  rot: number;
  sx: number;
  sy: number;
  /** A white flash on the first ticks of a hit, a red tint after (0 to 1), and the alpha. */
  flash: number;
  alpha: number;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** The offset of a close blow at `t` ticks in, toward the foe: a step back (wind-up), a quick lunge to the peak, a slower
 *  return to place. Returns [forward px, lean 0..1 as the wind-up gathers]. */
export function lungeAt(t: number): [number, number] {
  if (t < 0 || t >= LUNGE_TICKS) return [0, 0];
  if (t < 1.5) return [-3 * ease(t / 1.5), ease(t / 1.5)]; // wind-up
  if (t < MELEE_LAND) return [-3 + 17 * ease((t - 1.5) / (MELEE_LAND - 1.5)), 1 - ease((t - 1.5) / (MELEE_LAND - 1.5))]; // lunge
  return [14 * (1 - ease((t - MELEE_LAND) / (LUNGE_TICKS - MELEE_LAND))), 0]; // back to place
}

export function motionOf(m: MotionIn): Motion {
  const o: Motion = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, flash: 0, alpha: 1 };
  const dir = m.toward;
  // the fallen: a hold for a beat (the death registers), then the topple, then lying
  if (m.down) {
    const t = m.sinceHit - 2;
    if (t < 0) {
      o.flash = 0.6;
      o.dx = -dir * 2;
      return o;
    }
    const k = ease(clamp01(t / FALL_TICKS));
    if (m.wide) {
      o.rot = -dir * 0.1 * k;
      o.dx = -dir * 4 * k;
      o.sx = 1 + 0.12 * k;
      o.sy = 1 - 0.5 * k;
      return o;
    }
    o.rot = -dir * (Math.PI / 2) * k;
    o.dx = -dir * 7 * k;
    o.sy = 1 - 0.1 * k;
    return o;
  }
  // idle: breathing and a shift of weight, each out of step with the next
  const ph = m.now / 700 + m.ref * 1.7;
  o.sy = 1 + 0.018 * Math.sin(ph);
  o.sx = 1 - 0.008 * Math.sin(ph);
  o.dx = Math.round(Math.sin(ph / 3) * 0.6);
  if (m.cheering) o.dy = Math.abs(Math.sin(m.now / 260 + m.ref * 0.9)) * 4;
  // a friend falls: a flinch back and a dip
  if (m.friendDown < 6) {
    const k = 1 - m.friendDown / 6;
    o.dx -= dir * 3 * k;
    o.dy -= 1.5 * Math.sin(k * Math.PI);
  }
  // acting
  const a = m.sinceAction;
  if (a < LUNGE_TICKS) {
    if (m.ranged) {
      // a draw (lean back, rise a little) then the kick as it's loosed
      if (a < 2) {
        o.dx += -dir * 2 * ease(a / 2);
        o.dy += 1.5 * ease(a / 2);
        o.rot += -dir * 0.05 * ease(a / 2);
      } else {
        const k = 1 - clamp01((a - 2) / 4);
        o.dx += -dir * 2 * k + dir * 1 * k;
        o.dy += 1.5 * k;
        o.rot += -dir * 0.05 * k;
      }
    } else {
      const [fwd, lean] = lungeAt(a);
      o.dx += dir * fwd;
      o.rot += -dir * 0.12 * lean + dir * 0.1 * (fwd > 4 ? (fwd - 4) / 10 : 0);
    }
  }
  // struck: a white flash, a knock back away from the striker, a squash and recover
  const h = m.sinceHit;
  if (h < RECOIL_TICKS) {
    const k = 1 - h / RECOIL_TICKS;
    const push = (m.hard >= HEAVY ? 9 : 5) * (h < 1 ? 0.5 + h * 0.5 : k);
    o.dx += -dir * push;
    o.sy *= 1 - 0.07 * k;
    o.sx *= 1 + 0.07 * k;
    o.rot += -dir * (m.hard >= HEAVY ? 0.16 : 0.08) * k;
    o.flash = h < 2 ? 1 : 0.4 * k;
  }
  return o;
}

/** A corpse's alpha, `since` ticks after it fell: solid while it topples and a while on, then a fade to a dim body that stays. */
export function corpseAlpha(since: number, side: 'party' | 'enemy'): number {
  if (side === 'party') return 1;
  if (since < 14) return 1;
  return 0.45 + 0.55 * (1 - clamp01((since - 14) / 20));
}

/** Smooths a sim's whole-tick counters into fractions of a tick between changes, from the wall-clock time they last
 *  changed (and how long a tick has been taking lately, so a faster battle speed plays the motion faster). */
export class TickClock {
  private readonly seen = new Map<string, { v: number; at: number; ms: number }>();
  /** The counter `v` for `key` plus the part of a tick elapsed since it last changed (never a whole tick over). */
  fine(key: string, v: number, now: number): number {
    let e = this.seen.get(key);
    if (!e) this.seen.set(key, (e = { v, at: now, ms: 100 }));
    if (v !== e.v) {
      if (v > e.v) e.ms = Math.max(20, Math.min(400, e.ms * 0.6 + ((now - e.at) / (v - e.v)) * 0.4));
      e.v = v;
      e.at = now;
    }
    return v + Math.min(0.99, (now - e.at) / e.ms);
  }
  /** Forget everything not touched since `keep` last listed them. */
  prune(keep: Set<string>): void {
    for (const k of this.seen.keys()) if (!keep.has(k)) this.seen.delete(k);
  }
}

/** The bits of a sprite the motion moves (a Pixi Sprite fits, and tests can use a plain object). */
export interface Movable {
  x: number;
  y: number;
  rotation: number;
  scale: { x: number; y: number; set(x: number, y?: number): void };
  position: { set(x: number, y: number): void };
}

/** Moves a sprite already placed with its feet at (fx, fy): squashes and leans it about its feet, then shifts it by the
 *  motion's offset (`k` scales the offset down for a smaller picture, as on the map). `topple: false` leaves the lean and
 *  shift off for a picture that is already a dying one. */
export function moveSprite(s: Movable, fx: number, fy: number, m: Motion, k = 1, topple = true): void {
  let px = fx + (s.x - fx) * m.sx;
  let py = fy + (s.y - fy) * m.sy;
  s.scale.set(s.scale.x * m.sx, s.scale.y * m.sy);
  const rot = topple ? m.rot : 0;
  s.rotation = rot;
  if (rot) {
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const ox = px - fx;
    const oy = py - fy;
    px = fx + ox * c - oy * sn;
    py = fy + ox * sn + oy * c;
  }
  s.position.set(Math.round(px + (topple ? m.dx * k : 0)), Math.round(py - m.dy * k));
}
