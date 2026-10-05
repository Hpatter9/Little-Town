// The small things that make a castle's or a hold's rooms lived in (the owner's ask: rooms had one piece each and felt
// empty): barrels, crates, jars, chests, stools, tables, shelves and books from Craftpix's top-down dungeon packs
// (`art/clutter/`, cut by hand from the two packs' Objects sheets), set along each room's walls and in its corners by
// what the room is (`kindOf`: a home, a store, a study, a forge, the healer's, a kitchen, a treasury, a mine...),
// kept clear of the room's own piece (`occupied`), its doorways and the carpet to the gate; and its lights, which
// flicker: torches on the back walls and in the galleries, braziers in the halls, forges and throne rooms, candles in
// homes and studies (the dungeon pack's fire and candle animations), each with a warm pool of light on the floor under
// it (`Flame`, moved each frame by `flickerCastle`). Everything is placed from a stream seeded by the room, so a room
// keeps its things as the castle is drawn again.

import { AnimatedSprite, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { kindOf, type RoomKind } from './roomKinds';
import { CELL, type Rect } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { loadImage } from '../art/loadImage';
import { glowTexture } from '../town/layer';
import firesUrl from '../art/delve/fires.png';
import candlesUrl from '../art/clutter/candles.png';
import barrel from '../art/packs/do_barrel.png';
import book from '../art/clutter/book.png';
import bookOpen from '../art/clutter/book_open.png';
import chest from '../art/clutter/chest.png';
import chestGold from '../art/clutter/chest_gold.png';
import crate from '../art/clutter/crate.png';
import crateBarrel from '../art/clutter/crate_barrel.png';
import crateDark from '../art/clutter/crate_dark.png';
import crateHeap from '../art/clutter/crate_heap.png';
import crateSmall from '../art/clutter/crate_small.png';
import crateStack from '../art/clutter/crate_stack.png';
import cratesPair from '../art/clutter/crates_pair.png';
import cratesTall from '../art/clutter/crates_tall.png';
import desk1 from '../art/clutter/desk1.png';
import desk2 from '../art/clutter/desk2.png';
import desk3 from '../art/clutter/desk3.png';
import desk4 from '../art/clutter/desk4.png';
import desk5 from '../art/clutter/desk5.png';
import flaskBlue from '../art/clutter/flask_blue.png';
import flaskRed from '../art/clutter/flask_red.png';
import gold1 from '../art/clutter/gold1.png';
import gold2 from '../art/clutter/gold2.png';
import gold3 from '../art/clutter/gold3.png';
import jar from '../art/clutter/jar.png';
import jar2 from '../art/clutter/jar2.png';
import jarBlue from '../art/clutter/jar_blue.png';
import jarBlueS from '../art/clutter/jar_blue_s.png';
import jarS from '../art/clutter/jar_s.png';
import mushroom from '../art/clutter/mushroom.png';
import plants from '../art/clutter/plants.png';
import potions from '../art/clutter/potions.png';
import potionsS from '../art/clutter/potions_s.png';
import pots1 from '../art/clutter/pots1.png';
import pots2 from '../art/clutter/pots2.png';
import pots3 from '../art/clutter/pots3.png';
import rack1 from '../art/clutter/rack1.png';
import rack2 from '../art/clutter/rack2.png';
import rack3 from '../art/clutter/rack3.png';
import shelf1 from '../art/clutter/shelf1.png';
import shelf2 from '../art/clutter/shelf2.png';
import shelf3 from '../art/clutter/shelf3.png';
import shelf4 from '../art/clutter/shelf4.png';
import shelf5 from '../art/clutter/shelf5.png';
import shelf6 from '../art/clutter/shelf6.png';
import shields from '../art/clutter/shields.png';
import stool from '../art/clutter/stool.png';
import table from '../art/clutter/table.png';
import tableLong from '../art/clutter/table_long.png';
import tableSmall from '../art/clutter/table_small.png';

/** Light kinds: a torch on a wall, a brazier standing on the floor, a cluster of candles. */
type LightKind = 'torch' | 'brazier' | 'candles';

/** What stands against the back wall (tall), along the sides (middling) and in the corners (small), by the room. */
const SETS: Record<RoomKind, { back: string[]; side: string[]; small: string[]; lights: LightKind[] }> = {
  hall: { back: [tableLong, shields, cratesTall, desk3], side: [barrel, crateBarrel, table, pots3], small: [stool, stool, jar, chest], lights: ['brazier', 'torch'] },
  home: { back: [shelf3, shelf6, cratesTall, tableSmall], side: [chest, barrel, table, pots1], small: [jarS, stool, book, jar2, jarBlueS], lights: ['candles', 'torch'] },
  store: { back: [crateHeap, cratesPair, cratesTall, crateStack, rack1], side: [barrel, crate, crateDark, crateBarrel, pots2, pots3], small: [crateSmall, jar, jar2, jarS, jarBlue], lights: ['torch'] },
  study: { back: [shelf1, shelf2, shelf4, shelf5, desk2, desk1], side: [desk4, table, chest], small: [book, bookOpen, stool, jarBlueS], lights: ['candles', 'candles', 'torch'] },
  forge: { back: [rack1, rack2, shields, crateHeap], side: [barrel, crateBarrel, crate, table], small: [crateSmall, jarS, stool], lights: ['brazier', 'torch'] },
  healer: { back: [shelf2, shelf5, desk5, desk3], side: [potions, table, desk4, plants], small: [flaskBlue, flaskRed, potionsS, mushroom, jarS], lights: ['candles', 'torch'] },
  kitchen: { back: [crateStack, cratesTall, rack3, tableLong], side: [barrel, pots3, pots2, table, crateBarrel], small: [jar, jar2, jarS, stool, mushroom], lights: ['brazier', 'torch'] },
  treasury: { back: [shields, crateHeap, rack2], side: [chestGold, chest, pots1], small: [gold1, gold2, gold3, jarBlue], lights: ['brazier', 'torch'] },
  mine: { back: [cratesTall, crateHeap], side: [crateBarrel, barrel, crate, pots2], small: [gold2, gold3, crateSmall, jarS, mushroom], lights: ['torch'] },
  work: { back: [rack3, cratesTall, desk1, shelf6], side: [table, barrel, crate, chest], small: [stool, jar, crateSmall, book], lights: ['torch', 'candles'] },
};

/** Things set out together on the open floor: the first is the middle, the rest at offsets from its feet (px). */
type Group = [string, number, number][];
const GROUPS: Record<RoomKind, Group[]> = {
  hall: [[[tableLong, 0, 0], [stool, -40, 2], [stool, 40, 2], [stool, -14, 12], [stool, 14, 12]], [[table, 0, 0], [stool, -24, 2], [stool, 24, 2]], [[barrel, 0, 0], [barrel, 22, 4], [jar, -16, 2]]],
  home: [[[tableSmall, 0, 0], [stool, -16, 0]], [[table, 0, 0], [stool, -22, 2], [jarS, 20, 2]]],
  store: [[[crate, 0, 0], [barrel, 22, 2], [jar2, -14, 3]], [[crateHeap, 0, 0], [crateSmall, 24, 2]], [[barrel, 0, 0], [barrel, 24, 0], [barrel, 12, 10]]],
  study: [[[desk4, 0, 0], [stool, 0, 14]], [[desk2, 0, 0], [stool, -20, 4], [book, 22, 2]], [[table, 0, 0], [stool, -22, 2], [bookOpen, 22, 2]]],
  forge: [[[barrel, 0, 0], [crate, 24, 2]], [[table, 0, 0], [crateSmall, 26, 2], [stool, -24, 2]]],
  healer: [[[desk5, 0, 0], [stool, 0, 14]], [[table, 0, 0], [flaskRed, -22, 2], [flaskBlue, 22, 2]], [[plants, 0, 0], [jarS, 28, 2]]],
  kitchen: [[[tableLong, 0, 0], [stool, -40, 2], [stool, 40, 2], [barrel, 0, 16]], [[barrel, 0, 0], [pots3, 26, 2]]],
  treasury: [[[chestGold, 0, 0], [gold1, -22, 2], [gold3, 22, 2]], [[pots1, 0, 0], [gold2, 18, 2]]],
  mine: [[[crateBarrel, 0, 0], [gold2, 26, 2]], [[cratesTall, 0, 0], [jarS, 18, 2]]],
  work: [[[table, 0, 0], [stool, -22, 2], [stool, 22, 2]], [[crate, 0, 0], [barrel, 22, 2]]],
};

/* ------------------------------------------------------------ the pictures */

const textures = new Map<string, Texture | null>();
let onLoad: (() => void) | null = null;
/** A picture as a texture, once it has loaded (null until then; `onClutterArt` is called as each comes). */
function tex(url: string): Texture | null {
  if (textures.has(url)) return textures.get(url)!;
  textures.set(url, null);
  loadImage(url).then(
    (im) => {
      const t = Texture.from(im);
      t.source.scaleMode = 'nearest';
      textures.set(url, t);
      onLoad?.();
    },
    () => undefined,
  );
  return null;
}
export function onClutterArt(cb: () => void): void {
  onLoad = cb;
}
/** How many of the clutter's pictures have loaded (part of the castle's key, so it's drawn again as they come). */
export const clutterLoaded = (): number => [...textures.values()].filter(Boolean).length;

/** Ask for every picture at once (the castle is drawn again as they come). */
function preload(): void {
  for (const s of Object.values(SETS)) for (const u of [...s.back, ...s.side, ...s.small]) tex(u);
  tex(firesUrl);
  tex(candlesUrl);
}

/** The fire sheet (art/delve/fires.png, 4 columns of 44x48, 6 frames down): a wall torch, a big and a small brazier. */
const FIRE_COL: Record<'torch' | 'brazier', number> = { torch: 1, brazier: 3 };
const frames = new Map<string, Texture[]>();
function flameFrames(kind: LightKind, variant: number): Texture[] | null {
  const key = `${kind}|${variant}`;
  const have = frames.get(key);
  if (have) return have;
  const sheet = tex(kind === 'candles' ? candlesUrl : firesUrl);
  if (!sheet) return null;
  const list =
    kind === 'candles'
      ? [0, 1, 2, 3, 4, 5].map((r) => new Texture({ source: sheet.source, frame: new Rectangle(variant * 32, r * 32, 32, 32) }))
      : [0, 1, 2, 3, 4, 5].map((r) => new Texture({ source: sheet.source, frame: new Rectangle(FIRE_COL[kind] * 44, r * 48, 44, 48) }));
  frames.set(key, list);
  return list;
}

/* ------------------------------------------------------------ placing */

/** A light's pool on the floor, flickering (`flickerCastle`). */
export interface Flame {
  pool: Sprite;
  /** Where the flame burns (for its glow after dark, in the map's lights layer), and that glow once it's made. */
  at: { x: number; y: number };
  glow?: Sprite;
  base: number;
  size: number;
  seed: number;
}
export interface Clutter {
  things: Container[];
  pools: Container;
  flames: Flame[];
}

/** A little seeded stream (the room's id), so a room's things stay put. */
function stream(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
}
const any = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A region of the castle to dress: its px box, what it is, and which of its edges meet the outside. */
interface Region {
  box: Rect;
  kind: RoomKind;
  seed: number;
  /** How far down from the region's top the wall above reaches (the curtain wall is deeper than a partition). */
  topWall: number;
}

/** Dress the castle's rooms. `occupied` are the px boxes of the rooms' own pieces (left clear), `doors` the doorways
 *  (sim/castle.ts `doorsOf`: "x,y|h" a doorway in the top edge of cell x,y, "x,y|v" in its left edge), `carpet` the
 *  gate's carpet. */
export function castleClutter(
  core: Rect,
  rooms: Building[],
  footprint: (b: Building) => Rect,
  galleries: number[],
  landW: number,
  doors: string[],
  carpet: Rect,
  occupied: Rect[],
  mountain: boolean,
  outsideAbove: (x: number, y: number) => boolean,
): Clutter {
  preload();
  const things: Container[] = [];
  const pools = new Container();
  const flames: Flame[] = [];
  const taken: Rect[] = [...occupied, carpet];
  for (const d of doors) {
    const [xy, way] = d.split('|');
    const [x, y] = xy.split(',').map(Number);
    taken.push(way === 'h' ? { x: x * CELL + 2, y: y * CELL - 22, w: CELL - 4, h: 44 } : { x: x * CELL - 22, y: y * CELL + 2, w: 44, h: CELL - 4 });
  }
  const wallDepth = (outside: boolean) => (mountain ? 12 : outside ? 30 : 16);

  /** Put a picture with its feet at (fx, fy), if its foot fits clear of everything; true if it went. */
  const place = (url: string, fx: number, fy: number, region: Region, foot = 12): boolean => {
    const t = tex(url);
    if (!t) return false;
    const w = t.width;
    const h = t.height;
    const x = Math.round(fx - w / 2);
    const y = Math.round(fy - h);
    const b = region.box;
    if (x < b.x + 4 || x + w > b.x + b.w - 4 || fy > b.y + b.h - 8) return false;
    const footBox = { x: x + 1, y: fy - Math.min(foot, h), w: w - 2, h: Math.min(foot, h) };
    if (taken.some((r) => overlaps(r, footBox))) return false;
    // (a tall thing may reach up over the wall behind it; nothing else may cover the room's own piece)
    const body = { x: x + 1, y: Math.max(y, b.y + region.topWall), w: w - 2, h: fy - Math.max(y, b.y + region.topWall) };
    if (occupied.some((r) => overlaps(r, body))) return false;
    taken.push(footBox);
    const sp = new Sprite(t);
    sp.position.set(x, y);
    sp.zIndex = fy;
    things.push(sp);
    return true;
  };

  /** A light: a torch on the wall at (fx, wy), or a brazier or candles standing with their feet at (fx, fy). */
  const light = (kind: LightKind, fx: number, fy: number, seed: number, region: Region): boolean => {
    const list = flameFrames(kind, kind === 'candles' ? Math.floor(seed * 3) % 3 : 0);
    if (!list) return false;
    const fw = kind === 'candles' ? 32 : 44;
    // (the flame's own foot within its frame)
    const footIn = kind === 'candles' ? 26 : kind === 'brazier' ? 42 : 36;
    if (kind !== 'torch') {
      const footBox = { x: fx - 9, y: fy - 8, w: 18, h: 8 };
      if (taken.some((r) => overlaps(r, footBox))) return false;
      const b = region.box;
      if (fx - 10 < b.x + 4 || fx + 10 > b.x + b.w - 4) return false;
      taken.push(footBox);
    }
    const a = new AnimatedSprite(list);
    a.animationSpeed = 0.1 + seed * 0.06;
    a.gotoAndPlay(Math.floor(seed * list.length));
    a.position.set(Math.round(fx - fw / 2), Math.round(fy - footIn));
    // (a torch hangs on the wall's face: drawn over it)
    a.zIndex = kind === 'torch' ? fy + 4 : fy;
    things.push(a);
    const size = kind === 'brazier' ? 96 : kind === 'torch' ? 76 : 44;
    const base = kind === 'brazier' ? 0.34 : kind === 'torch' ? 0.26 : 0.2;
    const pool = new Sprite(glowTexture());
    pool.anchor.set(0.5);
    pool.blendMode = 'add';
    pool.tint = kind === 'candles' ? 0xffd890 : 0xffa848;
    pool.position.set(fx, (kind === 'torch' ? fy + 14 : fy - 6));
    pool.width = size;
    pool.height = size * 0.75;
    pool.alpha = base;
    pools.addChild(pool);
    flames.push({ pool, base, size, seed: seed * 100, at: { x: fx, y: fy - footIn + (kind === 'candles' ? 22 : kind === 'brazier' ? 24 : 16) } });
    return true;
  };

  const dress = (region: Region) => {
    const r = stream(region.seed);
    const set = SETS[region.kind];
    const b = region.box;
    const cellsW = Math.round(b.w / CELL);
    // the back wall: tall things in a row with gaps, a torch between every so often
    const backY = b.y + region.topWall + 4;
    let lit = 0;
    for (let x = b.x + 14; x < b.x + b.w - 14; ) {
      const roll = r();
      if (roll < 0.22 && lit < Math.max(1, Math.ceil(cellsW / 3))) {
        if (light('torch', x + 6, b.y + region.topWall - 2, r(), region)) {
          lit++;
          x += 26;
          continue;
        }
      }
      if (roll < 0.8) {
        const url = any(r, set.back);
        const t = tex(url);
        const w = t?.width ?? 24;
        const h = t?.height ?? 24;
        if (place(url, x + w / 2, backY + Math.min(h, 22), region)) {
          x += w + 2 + Math.floor(r() * 8);
          continue;
        }
        // (no room for a tall thing: a middling or a small one against the wall instead)
        const url2 = any(r, r() < 0.5 ? set.side : set.small);
        const t2 = tex(url2);
        if (t2 && place(url2, x + t2.width / 2, backY + Math.min(t2.height, 18), region, 8)) {
          x += t2.width + 3 + Math.floor(r() * 6);
          continue;
        }
      }
      x += 8;
    }
    // at least one light in every room: a torch on the back wall, else what the room favours on the floor
    if (!lit) {
      const k = any(r, set.lights);
      if (k === 'torch') light('torch', b.x + b.w / 2 + (r() < 0.5 ? -1 : 1) * Math.min(b.w / 2 - 14, 24), b.y + region.topWall - 2, r(), region);
    }
    // the side walls: middling things down each side
    for (const left of [true, false]) {
      for (let y = backY + 30; y < b.y + b.h - 14; y += 22 + Math.floor(r() * 10)) {
        if (r() < 0.45) continue;
        const url = any(r, set.side);
        const t = tex(url);
        const w = t?.width ?? 20;
        place(url, left ? b.x + 6 + w / 2 : b.x + b.w - 6 - w / 2, y, region);
      }
    }
    // the corners and odd spots: small things, and the room's floor lights
    const spots: [number, number][] = [
      [b.x + 12, b.y + b.h - 14],
      [b.x + b.w - 12, b.y + b.h - 14],
      [b.x + 12, backY + 24],
      [b.x + b.w - 12, backY + 24],
      [b.x + b.w / 2 + (r() - 0.5) * b.w * 0.6, b.y + b.h - 12],
    ];
    const floorLight = set.lights.find((k) => k !== 'torch');
    let floorLit = 0;
    for (const [sx, sy] of spots) {
      if (floorLight && floorLit < (region.kind === 'hall' ? 2 : 1) && r() < 0.6 && light(floorLight, sx, sy, r(), region)) {
        floorLit++;
        continue;
      }
      if (r() < 0.9) place(any(r, set.small), sx, sy, region, 8);
    }
    // the open floor: a group or two set out where there's room (a long table and stools in a hall, crates in a store)
    const tries = Math.max(1, Math.round((b.w * b.h) / (CELL * CELL) / 2));
    let groups = 0;
    for (let i = 0; i < tries * 4 && groups < tries; i++) {
      const gx = b.x + 28 + r() * (b.w - 56);
      const gy = backY + 44 + r() * Math.max(0, b.h - (backY - b.y) - 64);
      const g = any(r, GROUPS[region.kind]);
      if (!place(g[0][0], gx, gy, region)) continue;
      for (const [u, dx, dy] of g.slice(1)) place(u, gx + dx, gy + dy, region, 6);
      groups++;
    }
    // and along the front, here and there, the small things of a room in use
    for (let x = b.x + 16; x < b.x + b.w - 16; x += 18 + Math.floor(r() * 12)) if (r() < 0.45) place(any(r, set.small), x, b.y + b.h - 12 - Math.floor(r() * 10), region, 8);
  };

  // the hall and every room
  const regions: Region[] = [];
  const regionOf = (rect: Rect, kind: RoomKind, seed: number): Region => ({
    box: { x: rect.x * CELL, y: rect.y * CELL, w: rect.w * CELL, h: rect.h * CELL },
    kind,
    seed,
    topWall: wallDepth(outsideAbove(rect.x + Math.floor(rect.w / 2), rect.y)),
  });
  // (a hold's seat is a room built over its hall: the seat's room is dressed, not the hall again)
  const over = (a: Rect, b: Rect) => a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;
  if (!rooms.some((b) => over(footprint(b), core))) regions.push(regionOf(core, 'hall', 7919));
  for (const b of rooms) regions.push(regionOf(footprint(b), kindOf(BUILDING_BY_ID[b.def]), b.id * 31 + 17));
  for (const g of regions) dress(g);

  // a hold's galleries: a torch now and then on the rock, a crate, a jar or a heap of ore by the walls
  const roomCells = new Set<number>();
  for (const b of rooms) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) roomCells.add(y * landW + x);
  }
  for (let y = core.y; y < core.y + core.h; y++) for (let x = core.x; x < core.x + core.w; x++) roomCells.add(y * landW + x);
  for (const i of galleries) {
    if (roomCells.has(i)) continue;
    const x = i % landW;
    const y = Math.floor(i / landW);
    const r = stream(i * 7 + 3);
    const region: Region = { box: { x: x * CELL, y: y * CELL, w: CELL, h: CELL }, kind: 'mine', seed: i, topWall: 12 };
    const roll = r();
    if (roll < 0.16 && outsideAbove(x, y)) light('torch', x * CELL + CELL / 2, y * CELL + 10, r(), region);
    else if (roll < 0.36) place(any(r, SETS.mine.side.concat(SETS.mine.small)), x * CELL + 8 + r() * 16, y * CELL + CELL - 6, region, 8);
  }
  return { things, pools, flames };
}

/** The lights' pools breathe: each on its own beat, two waves and a little jitter (t in seconds). */
export function flickerCastle(flames: Flame[], t: number): void {
  for (const f of flames) {
    const k = 0.82 + 0.12 * Math.sin(t * 7.3 + f.seed) + 0.06 * Math.sin(t * 17.1 + f.seed * 1.7) + 0.04 * Math.sin(t * 31 + f.seed * 3.1);
    f.pool.alpha = f.base * k;
    f.pool.width = f.size * (0.96 + 0.04 * k);
    f.pool.height = f.size * 0.75 * (0.96 + 0.04 * k);
    if (f.glow) f.glow.alpha = 0.55 + 0.35 * (k - 0.82) / 0.22;
  }
}
