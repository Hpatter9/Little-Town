// Fog of war (the owner's ask): the land is black until someone sees it, grey once seen and left, clear while in
// sight. What has ever been seen is a rule of the world (saved, whether or not the autopilot is on); who sees
// what right now is worked out here too, in the same pass, and handed to the snapshot as a string.
// Deterministic: no randomness, only the people and buildings as they stand.

import { FOG_EVERY, SIGHT_BASE, SIGHT_BUILDING, SIGHT_CLASS, SIGHT_FOUNDER, SIGHT_LEAST, SIGHT_NIGHT, SIGHT_TALL, SIGHT_WALL, START_EXPLORED, TALL_BUILDINGS } from '../data/sight';
import { isSeat } from '../data/seats';
import { CELL } from './land';
import { isNight } from './lighting';
import { campCell, type GameState, type Person } from './state';

/** The working copies: a byte a cell, '0' (48) or '1' (49) so they read straight into a string. */
interface Cache {
  /** The `explored` string these bytes were made from (a loaded save brings a new one). */
  src: string | undefined;
  ex: Uint8Array;
  vis: Uint8Array;
  /** The sight string last handed out, and whether `vis` has changed since. */
  visText: string;
  dirty: boolean;
}
const caches = new WeakMap<GameState, Cache>();
const LATIN1 = new TextDecoder('latin1');
const ZERO = 48;
const ONE = 49;

/** How far a person sees now, in cells. */
export function sightOf(s: GameState, p: Person, night = isNight(s)): number {
  let r = SIGHT_BASE + (p.cls ? (SIGHT_CLASS[p.cls] ?? 0) : 0) + (p.id === s.mainId ? SIGHT_FOUNDER : 0);
  if (night) r = Math.max(SIGHT_LEAST, r - SIGHT_NIGHT);
  return r;
}

/** Light up the cells within `r` of (cx, cy) in `a`. */
function disk(a: Uint8Array, w: number, h: number, cx: number, cy: number, r: number): void {
  const r2 = r * r + r; // (a rounder edge than r*r)
  for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
    const dy = y - cy;
    const row = y * w;
    for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) a[row + x] = ONE;
    }
  }
}

function cacheOf(s: GameState): Cache {
  const n = s.land.w * s.land.h;
  let c = caches.get(s);
  if (!c || c.ex.length !== n) {
    c = { src: undefined, ex: new Uint8Array(n).fill(ZERO), vis: new Uint8Array(n).fill(ZERO), visText: '', dirty: true };
    caches.set(s, c);
  }
  if (c.src !== s.explored) {
    // (a loaded save, or a state copied: read what it holds)
    c.ex.fill(ZERO);
    const t = s.explored;
    if (t && t.length === n) for (let i = 0; i < n; i++) if (t.charCodeAt(i) === ONE) c.ex[i] = ONE;
    c.src = s.explored;
  }
  return c;
}

/** Work out what is in sight and add it to what has been seen. A town without `explored` (a new one, or an older
 *  save) starts with the land about the camp, and all that its people and buildings see, explored. */
export function updateFog(s: GameState): void {
  const { w, h } = s.land;
  const c = cacheOf(s);
  const fresh = s.explored === undefined;
  c.vis.fill(ZERO);
  const night = isNight(s);
  for (const p of s.people) {
    if (p.away !== null) continue;
    disk(c.vis, w, h, Math.floor(p.x / CELL), Math.floor(p.y / CELL), sightOf(s, p, night));
  }
  for (const b of s.buildings) {
    if (b.status !== 'done') continue;
    const tall = isSeat(b.def) || TALL_BUILDINGS.includes(b.def);
    const r = tall ? SIGHT_TALL : b.ring !== undefined ? SIGHT_WALL : SIGHT_BUILDING;
    disk(c.vis, w, h, b.tile, b.row, r);
  }
  if (fresh) {
    const camp = campCell(s);
    disk(c.ex, w, h, camp.x, camp.y, START_EXPLORED);
  }
  let grew = fresh;
  for (let i = 0; i < c.vis.length; i++)
    if (c.vis[i] === ONE && c.ex[i] !== ONE) {
      c.ex[i] = ONE;
      grew = true;
    }
  if (grew) {
    s.explored = LATIN1.decode(c.ex);
    c.src = s.explored;
  }
  c.dirty = true;
}

/** The fog's step: every few ticks (the land is 192 by 192). */
export function fogTick(s: GameState): void {
  if (s.tick % FOG_EVERY === 0 || s.explored === undefined) updateFog(s);
}

/** The cells in sight now, a character each ('1' in sight), for the snapshot. */
export function sightNow(s: GameState): string {
  if (s.explored === undefined) updateFog(s); // (a snapshot before the first step: the same pass, nothing else changes)
  const c = cacheOf(s);
  if (c.dirty) {
    c.visText = LATIN1.decode(c.vis);
    c.dirty = false;
  }
  return c.visText;
}

/** Whether a cell has ever been seen. */
export function isExplored(s: Pick<GameState, 'explored'>, cell: number): boolean {
  return s.explored === undefined || s.explored.charCodeAt(cell) === ONE;
}

/** The explored cells as bits in base 64 for the save (a cell a bit: 192 by 192 is about 6 KB). */
export function packExplored(text: string): string {
  const bytes = new Uint8Array(Math.ceil(text.length / 8));
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === ONE) bytes[i >> 3] |= 1 << (i & 7);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function unpackExplored(packed: string, cells: number): string {
  const bin = atob(packed);
  const out = new Uint8Array(cells).fill(ZERO);
  for (let i = 0; i < cells; i++) if ((bin.charCodeAt(i >> 3) >> (i & 7)) & 1) out[i] = ONE;
  return LATIN1.decode(out);
}
