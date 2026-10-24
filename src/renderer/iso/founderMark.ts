// The founder's marker (the owner's choice: "a marker over the head", so the player's character stands out in the
// town): a small gold crown floating over their head and a soft gold ring on the ground at their feet. Where they go,
// from the PixelLab look's frame; no Pixi and no DOM, so the tests can run it. Drawn by map/mapPeople.ts.

/** Who wears it: the snapshot's `mainId`, while they're in sight (not indoors, not away on a trip). */
export const wearsMark = (p: { id: number; indoors: boolean; away: string | null }, mainId: number | null): boolean =>
  mainId !== null && p.id === mainId && !p.indoors && !p.away;

/** In a look's 156px frame, measured across the peoples' looks: the top of the head stands 127px up from the frame's
 *  foot, the feet 30px up. */
export const HEAD_UP = 127;
export const FEET_UP = 30;
/** The crown floats this far (world px) over the head, bobbing `BOB` px. */
export const CROWN_GAP = 3;
export const CROWN_BOB = 1.5;
/** The crown icon (16px) is drawn at this scale: under a third of a person's height, so it reads at phone size but
 *  hides nobody behind. */
export const CROWN_SCALE = 1;
/** The ring under their feet (world px across). */
export const RING_W = 26;

/** Where the crown's foot and the ring's middle go (world y), for a look whose frame foot is at `frameFootY`, drawn
 *  at `scale` (the folk's scale times their height), `t` seconds into its bob. */
export function markAt(frameFootY: number, scale: number, t: number): { crownY: number; ringY: number } {
  const bob = Math.sin(t * 2.4) * CROWN_BOB;
  return { crownY: frameFootY - HEAD_UP * scale - CROWN_GAP + bob, ringY: frameFootY - FEET_UP * scale };
}
