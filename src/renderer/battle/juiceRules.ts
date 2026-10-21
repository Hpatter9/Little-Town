// The raid screens' "juice" (the owner's ask: a much flashier battle UI): the pure rules behind battle/juice.ts, kept
// free of Pixi and the DOM so they can be tested. Shake as trauma that decays, kill and combo callouts, how a banner
// slides in and out, how a health bar's ghost drains after a blow.

/** Trauma added by a blow: its share of the target's health (a kill and a big blow shake hardest). */
export function traumaFor(share: number, kill = false, ult = false): number {
  return Math.min(1, 0.12 + share * 0.9 + (kill ? 0.25 : 0) + (ult ? 0.45 : 0));
}
/** Trauma fades by `TRAUMA_FADE` a second. */
export const TRAUMA_FADE = 1.6;
/** How far (px) the screen shakes at full trauma; the shake goes as trauma squared. */
export const SHAKE_PX = 14;
export const shakeOf = (trauma: number) => trauma * trauma * SHAKE_PX;
export const fadeTrauma = (trauma: number, dt: number) => Math.max(0, trauma - TRAUMA_FADE * dt);

/** Kills within this many seconds of the last count toward a multi-kill. */
export const MULTI_WINDOW = 2.2;
/** The callout for kills in a row (null for one). */
export function killCallout(n: number): string | null {
  if (n < 2) return null;
  if (n === 2) return 'DOUBLE KILL!';
  if (n === 3) return 'TRIPLE KILL!';
  if (n === 4) return 'QUAD KILL!';
  return n < 7 ? 'RAMPAGE!' : 'UNSTOPPABLE!';
}

/** Blows on the raiders within this many seconds of each other keep a combo going; the town's own hurt breaks it. */
export const COMBO_WINDOW = 3;
/** A combo is shown from this many blows. */
export const COMBO_FROM = 3;
export function comboText(n: number): string | null {
  return n >= COMBO_FROM ? `${n} HIT COMBO${n >= 10 ? '!!' : n >= 6 ? '!' : ''}` : null;
}

/** A blow this big a share of the target's health is a heavy one: bigger number, gold, a burst. */
export const HEAVY_SHARE = 0.3;

/** A banner's motion at `t` seconds of `life`: slid in from the right with a punch of scale, held, slid out left. */
export function bannerMotion(t: number, life: number): { x: number; scale: number; alpha: number } {
  const IN = 0.28, OUT = 0.35;
  if (t < IN) {
    const p = t / IN;
    const e = 1 - (1 - p) ** 3;
    return { x: 1 - e, scale: 1.35 - 0.35 * e, alpha: p };
  }
  if (t > life - OUT) {
    const p = Math.min(1, (t - (life - OUT)) / OUT);
    return { x: -p * p, scale: 1, alpha: 1 - p };
  }
  // (a slow breath while it's held)
  return { x: 0, scale: 1 + Math.sin((t - IN) * 7) * 0.02, alpha: 1 };
}

/** How a number pops: big at first, settling to 1. */
export const popScale = (t: number) => (t < 0.12 ? 1.9 - (t / 0.12) * 0.7 : t < 0.3 ? 1.2 - ((t - 0.12) / 0.18) * 0.2 : 1);

/** A health bar's ghost (the health just lost, shown in white): it holds `GHOST_HOLD` seconds, then drains. */
export const GHOST_HOLD = 0.35;
export const GHOST_DRAIN = 1.4;
export function ghostStep(ghost: number, value: number, held: number, dt: number): number {
  if (value >= ghost) return value;
  if (held < GHOST_HOLD) return ghost;
  return Math.max(value, ghost - GHOST_DRAIN * dt);
}

/* ------------------------------------------------------------ hit-stop, zoom, slow-motion, sparks (the second flashier pass) */

/** How hard a blow landed: a crit is half the target's health or more, or a kill that took a third of it. */
export type BlowTier = 'normal' | 'heavy' | 'crit';
export const CRIT_SHARE = 0.5;
export function blowTier(share: number, kill = false, ult = false): BlowTier {
  if (ult || share >= CRIT_SHARE || (kill && share >= HEAVY_SHARE)) return 'crit';
  return share >= HEAVY_SHARE || kill ? 'heavy' : 'normal';
}
/** The number's size (px) and colour for a tier (the town's own hurt are red, mending green: juice.ts). */
export const NUMBER_SIZE: Record<BlowTier, number> = { normal: 22, heavy: 32, crit: 44 };
export const NUMBER_COLOUR: Record<BlowTier, number> = { normal: 0xffffff, heavy: 0xffd040, crit: 0xff7a28 };
/** The screen holds still this many seconds on a blow (the hit-stop), and the camera punches in by this share. */
export const HIT_STOP: Record<BlowTier, number> = { normal: 0, heavy: 0.045, crit: 0.085 };
export const ZOOM_PUNCH: Record<BlowTier, number> = { normal: 0, heavy: 0.03, crit: 0.07 };
/** A kill adds to both. */
export const KILL_STOP = 0.035;
export const KILL_PUNCH = 0.04;
/** The zoom punch eases back at this much of itself a second. */
export const PUNCH_FADE = 5;
export const fadePunch = (punch: number, dt: number) => (punch < 0.002 ? 0 : punch * Math.exp(-PUNCH_FADE * dt));
/** The final blow: the board runs at this rate for this long (seconds). */
export const SLOWMO_RATE = 0.3;
export const SLOWMO_SECS = 0.9;
/** The most the view's clock may be held behind the real one (ms), so a long fight never lags the sim. */
export const LAG_MAX_MS = 450;
/** Sparks thrown by a blow, and the most alive at once (a phone must stay smooth). */
export const SPARKS: Record<BlowTier, number> = { normal: 3, heavy: 7, crit: 12 };
export const SPARK_CAP = 48;
/** The most hit sprites alive at once. */
export const IMPACT_CAP = 14;
/** A word slammed onto the screen: huge at first, overshooting down to rest. */
export const slamScale = (t: number) => (t < 0.1 ? 2.8 - (t / 0.1) * 1.6 : t < 0.22 ? 1.2 - ((t - 0.1) / 0.12) * 0.25 : t < 0.32 ? 0.95 + ((t - 0.22) / 0.1) * 0.05 : 1);
/** The word for the first of the town's felling blows, and for a broken band. */
export const FIRST_BLOOD = 'FIRST BLOOD!';
export const ROUTED = 'ROUTED!';
