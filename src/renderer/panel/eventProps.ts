// The event cards' props (the owner's ask: scenes that show what the card is about, not someone walking past a
// backdrop): each a picture in art/eventprops/ (tools/compose-event-props.cjs cuts them from the packs, already at their
// size on the 320x180 stage), copied beside the page by the builds. Pure data, so the tests can check every prop a
// scene names is here and its file is present.

import sizes from '../art/eventprops/sizes.json';

export interface PropArt {
  /** One frame's size in art px. */
  w: number;
  h: number;
  /** A strip of frames side by side (the fire), played in a loop. */
  frames: number;
}

const FRAMES: Record<string, number> = { fire: 8 };

export const EVENT_PROPS: Readonly<Record<string, PropArt>> = Object.fromEntries(
  Object.entries(sizes as Record<string, number[]>).map(([id, [w, h]]) => [id, { w, h, frames: FRAMES[id] ?? 1 }]),
);

/** Where a prop's picture is served from (beside the page). */
export const propFile = (id: string) => `eventprops/${id}.png`;
/** The sets laid from the pack's tiles, whole 320x180 pictures. */
export const EVENT_SETS = ['hall', 'cottage'] as const;
export const setFile = (id: string) => `eventprops/set_${id}.png`;
