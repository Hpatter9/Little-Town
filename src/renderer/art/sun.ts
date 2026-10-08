// Where the sun stands, for the shadows on the map (the owner's ask: shadows that move with the sun): a building's
// shadow is its picture in black laid flat on the ground before it (MapView `castShadow`), leaning west in the morning,
// east in the evening, long at dawn and dusk and short at noon, and gone at night. Pure, so it is tested.

export interface Sun {
  /** The shadow's lean (a skew, radians: negative falls west, positive east). */
  skew: number;
  /** How long it falls, as a share of the picture's height. */
  length: number;
  /** How dark. */
  alpha: number;
}

/** The sun at an hour of the day (0..24, fractions allowed) and the daylight (0 night .. 1 day). */
export function sunAt(hour: number, daylight: number): Sun {
  // (6 dawn .. 18 dusk: -1 .. 1 across the day)
  const t = Math.max(-1, Math.min(1, (hour - 12) / 6));
  const low = Math.abs(t);
  return {
    skew: t * 0.9,
    length: 0.22 + 0.38 * low * low,
    alpha: Math.max(0, Math.min(1, (daylight - 0.35) / 0.4)) * (0.2 - 0.05 * low),
  };
}
