// How a flame flickers (the owner's ask: the light on the ground wavers as a flame does; electric light holds steady).
// Pure, so it can be tested: the light map (map/lightMap.ts), the street lamps' glows (map/streetLamps.ts) and the
// isometric view's lamps, fires and lit windows (iso/isoView.ts) all read it each frame. A light's brightness is a
// share of its full strength, wavering on smooth noise (three beats, slow to quick, none of them regular), each light on
// its own phase so no two keep time; a torch or a fire wavers most, a lantern less, a gas lamp a little, and electric
// light not at all. With "Reduce motion" on (`gentle`) a flame wavers a third as much, and more slowly.

/** How far each kind of light wavers (a share of its strength). */
export const FLICKER: Record<string, number> = {
  torch: 0.2,
  lantern: 0.12,
  'gas lamp': 0.06,
  'electric lamp': 0,
  'light panel': 0,
  campfire: 0.22,
  storytellers_circle: 0.22,
  bloomery: 0.16,
  kiln: 0.14,
  smithy: 0.16,
  glassworks: 0.12,
  carried: 0.14,
  /** A brazier or a lantern hung on a building, a forge's mouth. */
  brazier: 0.22,
  forge: 0.18,
  /** A candle or a hearth seen through a window. */
  candle: 0.12,
};

/** How much a flame wavers and how fast with "Reduce motion" on. */
export const GENTLE_AMOUNT = 0.35;
export const GENTLE_PACE = 0.5;

/** Does this kind of light flicker? */
export const flickers = (kind: string): boolean => (FLICKER[kind] ?? 0.15) > 0;

/** A light's phase, from where it stands, so neighbours don't flicker together. */
export const phaseOf = (x: number, y: number): number => ((Math.imul(Math.floor(x * 16) + 1, 73856093) ^ Math.imul(Math.floor(y * 16) + 1, 19349663)) >>> 0) % 6283 / 1000;

/** A whole number's hash in 0..1 (the same every run). */
function hash1(i: number, seed: number): number {
  let h = Math.imul(i + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise in 0..1: random values at whole numbers, eased between (no jumps, so no strobing). */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  const a = hash1(i, seed);
  return a + (hash1(i + 1, seed) - a) * s;
}

/** The waver at time `t`, 0..1 (0 the flame at its brightest): a slow sway, a quicker flutter and a little shiver. */
function waver(t: number, phase: number): number {
  const seed = Math.floor(phase * 1000);
  const off = phase * 7.3;
  return 0.55 * noise1(t * 1.4 + off, seed) + 0.3 * noise1(t * 3.9 + off, seed + 17) + 0.15 * noise1(t * 8.5 + off, seed + 31);
}

/** The share of its strength a light gives at time `t` (seconds): from 1 - its waver up to 1, never more. */
export function flicker(kind: string, t: number, phase: number, gentle = false): number {
  const a = (FLICKER[kind] ?? 0.15) * (gentle ? GENTLE_AMOUNT : 1);
  if (a <= 0) return 1;
  return 1 - a * Math.max(0, Math.min(1, waver(gentle ? t * GENTLE_PACE : t, phase)));
}

/** How big a flame's light is at time `t`, round 1: a little larger as it flares and smaller as it sinks (with
 *  `flicker`'s own beat), by at most a fifth of its waver either way. */
export function flickerSize(kind: string, t: number, phase: number, gentle = false): number {
  const a = (FLICKER[kind] ?? 0.15) * (gentle ? GENTLE_AMOUNT : 1);
  if (a <= 0) return 1;
  return 1 + (flicker(kind, t, phase, gentle) - (1 - a / 2)) * 0.4;
}
