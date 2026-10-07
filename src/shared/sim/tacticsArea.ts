// The reach and the area of a spell or skill on the tactics board, as in FF Tactics: how far off it may be aimed
// (`min`..`max` tiles), and the tiles it touches round the mark: one tile, a cross, a square, a line out from the
// user, or a ring round them. Worked out from the act itself (whom its effects touch, spell or skill, an ultimate,
// and what its name says it does), so every one of the 360 spells and skills has a shape without a table.

import type { KitAction } from './actions';

export type AreaShape = 'one' | 'cross' | 'square' | 'line' | 'ring' | 'self';

export interface TacArea {
  shape: AreaShape;
  /** The cross's or the square's reach from the mark, the line's length, the ring's reach round the user. */
  size: number;
  /** How far from the user the mark may be (tiles, counted along the board's rows and columns). */
  min: number;
  max: number;
}

/** A tile on the board. */
export type Tile = readonly [number, number];

/** Names that say the act runs out in a line, sweeps round the user, or bursts over a patch of ground. */
const LINE = /\b(beam|lance|pierc|ray|arrow|charge|thrust|spear|lightning|chain|volley|rush|dash|impale|javelin|bolt|lunge|stampede|breath|cannon|rail)/i;
const RING = /\b(whirl|spin|sweep|cleave|cyclone|quake|stomp|roar|howl|shout|nova|cry|tremor|slam|shockwave|earthshatter|tornado|vortex|aura|fury)/i;
const BURST = /\b(fire|blizzard|storm|meteor|flare|inferno|frost|thunder|explos|bomb|burst|blast|hail|rain|plague|cloud|swarm|eruption|fireball|comet|wave|miasma|flood)/i;

/** The act's area. `reach` is the user's own weapon reach (a weapon art goes as far as the weapon). */
export function areaOf(act: KitAction, reach = 1): TacArea {
  const targets = act.effects.map((e) => e.target);
  const ult = act.pool === 'limit';
  const name = act.name;
  if (targets.every((x) => x === 'self') || act.use === 'summon') return { shape: 'self', size: 0, min: 0, max: 0 };
  const friendly = !targets.some((x) => x === 'foe' || x === 'foes' || x === 'random_foes');
  const many = targets.some((x) => x === 'foes' || x === 'allies' || x === 'random_foes');
  if (friendly) {
    // (mending: one friend in reach; for all, the friends round the user, or a patch of them for a spell)
    if (!many) return { shape: 'one', size: 0, min: 0, max: 4 };
    return act.spell ? { shape: 'square', size: ult ? 2 : 1, min: 0, max: 4 } : { shape: 'ring', size: ult ? 3 : 2, min: 0, max: 0 };
  }
  if (RING.test(name)) return { shape: 'ring', size: ult ? 2 : 1, min: 0, max: 0 };
  if (LINE.test(name)) return { shape: 'line', size: ult ? 6 : act.spell ? 5 : 4, min: 1, max: 1 };
  if (targets.includes('random_foes')) return { shape: 'square', size: 1, min: 1, max: 5 };
  if (many) return act.spell ? { shape: 'square', size: ult ? 2 : 1, min: 2, max: 5 } : { shape: 'cross', size: ult ? 2 : 1, min: 1, max: 3 };
  if (act.spell) return BURST.test(name) || ult ? { shape: 'cross', size: ult ? 2 : 1, min: 1, max: 5 } : { shape: 'one', size: 0, min: 1, max: 5 };
  // (a weapon art: on one foe as far as the weapon goes; an ultimate's blow lands in a cross)
  return ult ? { shape: 'cross', size: 1, min: 1, max: Math.max(1, Math.floor(reach)) } : { shape: 'one', size: 0, min: 1, max: Math.max(1, Math.floor(reach)) };
}

const apart = (a: Tile, b: Tile) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const DIRS: Tile[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Where the mark may be put from `me` on a board `w` x `h`: the tiles within the reach (a line is aimed by the tile
 *  beside the user it starts from; a ring or a self act only at the user). */
export function aimTiles(area: TacArea, me: Tile, w: number, h: number): Tile[] {
  if (area.shape === 'ring' || area.shape === 'self') return [me];
  if (area.shape === 'line') return DIRS.map(([du, dv]) => [me[0] + du, me[1] + dv] as Tile).filter(([u, v]) => u >= 0 && v >= 0 && u < w && v < h);
  const out: Tile[] = [];
  for (let v = Math.max(0, me[1] - area.max); v <= Math.min(h - 1, me[1] + area.max); v++)
    for (let u = Math.max(0, me[0] - area.max); u <= Math.min(w - 1, me[0] + area.max); u++) {
      const d = apart([u, v], me);
      if (d >= area.min && d <= area.max) out.push([u, v]);
    }
  return out;
}

/** The tiles the act touches, marked at `at` by `me`. */
export function areaTiles(area: TacArea, me: Tile, at: Tile, w: number, h: number): Tile[] {
  const on = ([u, v]: Tile) => u >= 0 && v >= 0 && u < w && v < h;
  const out: Tile[] = [];
  switch (area.shape) {
    case 'self':
      return [me];
    case 'one':
      return [at];
    case 'line': {
      const du = Math.sign(at[0] - me[0]);
      const dv = Math.sign(at[1] - me[1]);
      if (du && dv) return [at];
      for (let k = 1; k <= area.size; k++) {
        const t: Tile = [me[0] + du * k, me[1] + dv * k];
        if (on(t)) out.push(t);
      }
      return out;
    }
    case 'ring':
      for (let v = me[1] - area.size; v <= me[1] + area.size; v++)
        for (let u = me[0] - area.size; u <= me[0] + area.size; u++) if ((u !== me[0] || v !== me[1]) && apart([u, v], me) <= area.size + 1 && on([u, v])) out.push([u, v]);
      return out;
    case 'cross':
      for (let v = at[1] - area.size; v <= at[1] + area.size; v++)
        for (let u = at[0] - area.size; u <= at[0] + area.size; u++) if (apart([u, v], at) <= area.size && on([u, v])) out.push([u, v]);
      return out;
    case 'square':
      for (let v = at[1] - area.size; v <= at[1] + area.size; v++) for (let u = at[0] - area.size; u <= at[0] + area.size; u++) if (on([u, v])) out.push([u, v]);
      return out;
  }
}

/** The area in a few words, for the menu: "3×3, range 2–5", "Line of 4", "All round, 1". */
export function areaLabel(area: TacArea): string {
  const reach = area.max === 0 ? '' : area.min === area.max ? `, range ${area.max}` : `, range ${area.min}–${area.max}`;
  switch (area.shape) {
    case 'self':
      return 'Self';
    case 'one':
      return `One${reach}`;
    case 'line':
      return `Line of ${area.size}`;
    case 'ring':
      return `All round, ${area.size}`;
    case 'cross':
      return `Cross ${area.size * 2 + 1}${reach}`;
    case 'square':
      return `${area.size * 2 + 1}×${area.size * 2 + 1}${reach}`;
  }
}

/** Whether the area touches more than its mark: then an act whose effects hit one hits all in it, a little lighter. */
export const spreads = (area: TacArea) => area.shape !== 'one' && area.shape !== 'self';
/** What each one in a spread act's area takes, of what the single mark would. */
export const SPREAD_POWER = 0.75;
