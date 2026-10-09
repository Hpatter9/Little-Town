// How a flame flickers (the owner's ask: the light on the ground wavers as a flame does; electric light holds steady).
// Pure, so it can be tested: the light map (map/lightMap.ts) and the street lamps' glows (map/streetLamps.ts) both
// read it each frame. A light's brightness is a share of its full strength, wavering on two slow beats and a quick
// one, each light on its own phase so no two keep time; a torch or a fire wavers most, a lantern less, a gas lamp a
// little, and electric light not at all.

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
};

/** Does this kind of light flicker? */
export const flickers = (kind: string): boolean => (FLICKER[kind] ?? 0.15) > 0;

/** A light's phase, from where it stands, so neighbours don't flicker together. */
export const phaseOf = (x: number, y: number): number => ((Math.imul(Math.floor(x * 16) + 1, 73856093) ^ Math.imul(Math.floor(y * 16) + 1, 19349663)) >>> 0) % 6283 / 1000;

/** The share of its strength a light gives at time `t` (seconds): from 1 - its waver up to 1, never more. */
export function flicker(kind: string, t: number, phase: number): number {
  const a = FLICKER[kind] ?? 0.15;
  if (a <= 0) return 1;
  // (two slow beats and a quick one, folded into 0..1)
  const w = 0.5 * Math.sin(t * 2.3 + phase) * Math.sin(t * 5.1 + phase * 1.7) + 0.3 * Math.sin(t * 11.7 + phase * 2.9) + 0.2 * Math.sin(t * 17.3 + phase * 0.6);
  const share = (w + 1) / 2;
  return 1 - a * Math.max(0, Math.min(1, share));
}
