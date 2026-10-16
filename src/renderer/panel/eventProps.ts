// The event cards' props (the owner's ask: scenes that show what the card is about, not someone walking past a
// backdrop): each a picture in art/eventprops/ (tools/compose-event-props.cjs cuts them from the packs, already at their
// size on the 320x180 stage), or one the cutscenes already cut from the same picture (art/scene/), drawn at a share of
// its pixels; both folders are copied beside the page by the builds. Pure data, so the tests can check every prop a
// scene names is here and its file is present.

import sizes from '../art/eventprops/sizes.json';

export interface PropArt {
  /** One frame's size on the stage, in art px. */
  w: number;
  h: number;
  /** A strip of frames side by side (the fire), played in a loop. */
  frames: number;
  /** Its picture, under art/, and the share of its pixels it's drawn at (1: as cut for the stage). */
  file: string;
  k: number;
}

const FRAMES: Record<string, number> = { fire: 8 };

export const EVENT_PROPS: Readonly<Record<string, PropArt>> = Object.fromEntries(
  Object.entries(sizes as Record<string, (number | string)[]>).map(([id, [w, h, file, k]]) => [
    id,
    { w: w as number, h: h as number, frames: FRAMES[id] ?? 1, file: (file as string | undefined) ?? `eventprops/${id}.png`, k: (k as number | undefined) ?? 1 },
  ]),
);

/** Where a prop's picture is served from (beside the page, as under art/). */
export const propFile = (id: string) => EVENT_PROPS[id]?.file ?? `eventprops/${id}.png`;
/** The sets laid from the pack's tiles, whole 320x180 pictures. */
export const EVENT_SETS = ['hall', 'cottage'] as const;
export const setFile = (id: string) => `eventprops/set_${id}.png`;
