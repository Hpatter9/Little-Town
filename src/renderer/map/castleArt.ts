// The vampire castle on the map (sim/castle.ts): one body of rooms round the hall at the camp, seen from above like
// the rest of the top-down town. Every finished cell of it is floored with the dungeon pack's flagstones; walls stand
// along each cell edge where the castle ends (the curtain wall: a walk with battlements and a stone face) or where two
// rooms meet (a thinner partition), each edge drawn once and sorted among the things so people walk behind and before
// them; a doorway is cut in the middle of the wall two rooms share, the gate (the pack's arched door) stands in the
// hall's south wall where the carpet begins, and a round tower at each outer corner. The rooms' furnishings are their
// own sprites (`roomFurniture`): a pack picture where one suits the room, else beds, or a table, chairs and a chest.

import { seatInterior } from '../art/seatArt';
import { SEAT_STAGE } from '../../shared/data/seats';
import { Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { BuildingDef } from '../../shared/data/buildings';
import { CELL, type Rect } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { loadImage } from '../art/loadImage';
import { mixHex, paint, type PixelArt, type Tone } from '../art/pixelArt';
import { snowCapped } from '../art/snowCap';
import floorUrl from '../art/castle/floor.png';
import gateUrl from '../art/castle/gate.png';
import doorsUrl from '../art/delve/doors.png';
import dpTable2 from '../art/packs/dp_table2.png';
import dpChair1 from '../art/packs/dp_chair1.png';
import dpChair2 from '../art/packs/dp_chair2.png';
import doChest from '../art/packs/do_chest.png';
import doBarrel from '../art/packs/do_barrel.png';
import doCrates from '../art/packs/do_crates.png';
import { blocks, cornerTower, merlons, TOWER_H, TOWER_W, walk } from './keepArt';
import { packArtIndoors, pickArt, type Pick } from './packBuildings';

/** What the renderer gets of the castle (snapshot.castle). */
export interface CastleView {
  /** A castle standing on the land, or a hold cut into the mountain (the rock is its outer wall, a carved gate its door). */
  hold: 'castle' | 'mountain';
  cells: number[];
  core: Rect;
  gate: { x: number; y: number };
  /** The side gates (sim/castle.ts `sideGates`). */
  gates?: { x: number; y: number; side: 'n' | 's' | 'w' | 'e' }[];
  bounds: Rect;
  /** The doorways between regions the sim walks through (sim/castle.ts `doorsOf`), and a hold's dug galleries. */
  doors: string[];
  galleries: number[];
}

/** The walls' measures (px): a partition's walk and face, the curtain wall's battlements, walk and face. */
const PART_T = 6;
const PART_FACE = 22;
const MERLON = 6;
const WALL_T = 8;
const WALL_FACE = 16;
/** The curtain wall's face seen from inside (its north run), and a hold's hewn rock face: tall, so they read as walls. */
const INNER_FACE = 26;
const ROCK_FACE = 24;
const SIDE_T = 10;
const OUTER_SIDE_T = 10;
/** A doorway's opening (px) in a partition. */
const DOOR = 20;
const CARPET_W = 22;
const STONE_DARK = '#2e222e';

const cache = new Map<string, PixelArt>();
const piece = (key: string, make: () => PixelArt) => {
  let a = cache.get(key);
  if (!a) cache.set(key, (a = make()));
  return a;
};

/** The wall pieces, one cell long, in a look. */
function pieces(tone: Tone, toneKey: string, winter: boolean) {
  const cap = (a: PixelArt) => (winter ? snowCapped(a) : a);
  const k = `${toneKey}|${winter ? 'w' : ''}`;
  return {
    // a partition between two rooms: its walk and the face looking south, at the top of the lower room
    partH: piece(`partH|${k}`, () => cap(paint(CELL, PART_T + PART_FACE, tone, (p) => {
      walk(p, 0, 0, CELL, PART_T, 'x');
      blocks(p, 0, PART_T, CELL, PART_FACE);
      foot(p, 0, PART_T + PART_FACE, CELL);
    }, 0.5))),
    // the same with a doorway cut through its middle
    doorH: piece(`doorH|${k}`, () => cap(paint(CELL, PART_T + PART_FACE, tone, (p) => {
      const j = (CELL - DOOR) / 2;
      // (the walk runs on over the doorway as its lintel; the jambs either side; the opening's top in shadow)
      walk(p, 0, 0, CELL, PART_T, 'x');
      for (const x of [0, CELL - j]) {
        blocks(p, x, PART_T, j, PART_FACE);
        foot(p, x, PART_T + PART_FACE, j);
      }
      blocks(p, j, PART_T, DOOR, 4);
      p.rect(j, PART_T + 4, DOOR, 3, STONE_DARK);
      p.frect(j, PART_T + 7, DOOR, 1, mixHex(STONE_DARK, '#000000', 0.3));
      p.frect(j - 0.5, PART_T + 4, 0.5, PART_FACE - 4, STONE_DARK);
      p.frect(CELL - j, PART_T + 4, 0.5, PART_FACE - 4, STONE_DARK);
    }, 0.5))),
    // (a run down a column: its top, with the stone of its east face showing as a shaded edge, so it stands up too)
    partV: piece(`partV|${k}`, () => cap(paint(SIDE_T, CELL, tone, (p) => sideRun(p, 0, CELL), 0.5))),
    doorV: piece(`doorV|${k}`, () => cap(paint(SIDE_T, CELL, tone, (p) => {
      const j = (CELL - DOOR) / 2;
      sideRun(p, 0, j);
      sideRun(p, CELL - j, j);
      // (the jambs' ends, their faces turned to the doorway)
      blocks(p, 0, j - 3, SIDE_T, 3);
      blocks(p, 0, CELL - 3, SIDE_T, 3);
    }, 0.5))),
    // the curtain wall's north run (its face looks into the castle), at the top of the cell
    outerN: piece(`outerN|${k}`, () => cap(paint(CELL, MERLON + WALL_T + INNER_FACE, tone, (p) => {
      merlons(p, 0, 0, CELL);
      walk(p, 0, MERLON, CELL, WALL_T, 'x');
      blocks(p, 0, MERLON + WALL_T, CELL, INNER_FACE);
      foot(p, 0, MERLON + WALL_T + INNER_FACE, CELL);
    }, 0.6))),
    // its south run: the walk at the cell's foot, the face hanging below it over the ground outside
    outerS: piece(`outerS|${k}`, () => cap(paint(CELL, MERLON + WALL_T + WALL_FACE, tone, (p) => {
      merlons(p, 0, 0, CELL);
      walk(p, 0, MERLON, CELL, WALL_T, 'x');
      blocks(p, 0, MERLON + WALL_T, CELL, WALL_FACE);
      p.frect(0, MERLON + WALL_T + WALL_FACE - 1, CELL, 1, STONE_DARK);
    }, 0.6))),
    // its west and east runs: a walk with the battlements' nubs along the outer side
    outerW: piece(`outerW|${k}`, () => cap(paint(OUTER_SIDE_T, CELL, tone, (p) => {
      walk(p, 2, 0, OUTER_SIDE_T - 2, CELL, 'y');
      for (let y = 1; y < CELL; y += 8) p.rect(0, y, 2, 4, mixHex('#564658', '#000000', 0.25));
    }, 0.6))),
    outerE: piece(`outerE|${k}`, () => cap(paint(OUTER_SIDE_T, CELL, tone, (p) => {
      walk(p, 0, 0, OUTER_SIDE_T - 2, CELL, 'y');
      for (let y = 1; y < CELL; y += 8) p.rect(OUTER_SIDE_T - 2, y, 2, 4, mixHex('#564658', '#000000', 0.25));
    }, 0.6))),
    tower: cap(cornerTower(tone, toneKey)),
    // a mountain hold's outer walls are the living rock: rough, dark, seamed
    // (seen from inside: the rough rock above, and the face hewn down to the floor below it)
    rockN: piece(`rockN|${k}`, () => cap(paint(CELL, ROCK_T + ROCK_FACE, tone, (p) => {
      rock(p, CELL, ROCK_T, 1);
      hewn(p, 0, ROCK_T, CELL, ROCK_FACE, 1);
    }, 0.7))),
    rockS: piece(`rockS|${k}`, () => cap(paint(CELL, ROCK_T + WALL_FACE, tone, (p) => {
      rock(p, CELL, ROCK_T, 2);
      // (the face below: the cliff the gate is cut into)
      p.rect(0, ROCK_T, CELL, WALL_FACE, '#565260');
      for (let x = 2; x < CELL; x += 8) p.rect(x, ROCK_T + 1, 1, WALL_FACE - 2, '#3a3642');
      p.frect(0, ROCK_T, CELL, 0.5, '#7a7684');
      p.rect(0, ROCK_T + WALL_FACE - 1, CELL, 1, '#2a2630');
    }, 0.7))),
    rockV: piece(`rockV|${k}`, () => cap(paint(ROCK_T, CELL, tone, (p) => rock(p, ROCK_T, CELL, 3), 0.7))),
  };
}

const ROCK_T = 12;
/** A wall's run down a column, `h` px from `y`: the walk on top and a shaded strip of its face along the east side. */
function sideRun(p: Parameters<typeof paint>[3] extends (q: infer Q) => void ? Q : never, y: number, h: number): void {
  walk(p, 0, y, SIDE_T - 3, h, 'y');
  p.rect(SIDE_T - 3, y, 3, h, mixHex('#564658', '#000000', 0.2));
  for (let k = y + 2; k < y + h; k += 5) p.frect(SIDE_T - 3, k, 3, 0.5, STONE_DARK);
  p.frect(SIDE_T - 0.5, y, 0.5, h, STONE_DARK);
}
/** A wall's foot: a dark line and a soft shadow on the floor before it, so the face stands up off the floor. */
function foot(p: Parameters<typeof paint>[3] extends (q: infer Q) => void ? Q : never, x: number, y: number, w: number): void {
  p.frect(x, y - 2, w, 1, mixHex(STONE_DARK, '#564658', 0.4));
  p.frect(x, y - 1, w, 1, STONE_DARK);
}
/** A face hewn in the living rock: chisel-dressed courses, lit at the top, darker toward the floor. */
function hewn(p: Parameters<typeof paint>[3] extends (q: infer Q) => void ? Q : never, x0: number, y0: number, w: number, h: number, seed: number): void {
  const rows = ['#625e6c', '#5a5664', '#54505e', '#4c4856', '#46424f', '#403c48'];
  for (let y = 0; y < h; y++) p.rect(x0, y0 + y, w, 1, rows[Math.min(rows.length - 1, Math.floor((y / h) * rows.length))]);
  p.frect(x0, y0, w, 1, '#7a7684');
  for (let y = y0 + 6; y < y0 + h - 2; y += 7) {
    p.frect(x0, y, w, 0.5, '#34303c');
    p.frect(x0, y + 0.5, w, 0.5, '#6a6674');
    for (let x = x0 + ((y + seed * 3) % 11); x < x0 + w; x += 11) p.frect(x, y - 6, 0.5, 6, '#3a3642');
  }
  for (let i = 0; i < (w * h) / 40; i++) p.frect(x0 + ((i * 29 + seed * 13) % w), y0 + 2 + ((i * 17 + seed) % (h - 4)), 1, 0.5, i % 2 ? '#34303c' : '#6e6a78');
  p.rect(x0, y0 + h - 2, w, 1, '#2e2a36');
  p.rect(x0, y0 + h - 1, w, 1, '#24202a');
}
/** Rough rock: a dark mass with lighter knobs and darker seams. */
function rock(p: Parameters<typeof paint>[3] extends (q: infer Q) => void ? Q : never, w: number, h: number, seed: number): void {
  p.rect(0, 0, w, h, '#3a3642');
  for (let i = 0; i < (w * h) / 18; i++) {
    const x = ((i * 37 + seed * 11) % (w - 2)) + 1;
    const y = ((i * 53 + seed * 7) % (h - 2)) + 1;
    p.rect(x, y, 2 + (i % 3), 1 + (i % 2), i % 3 === 0 ? '#2a2630' : '#4e4a58');
  }
  p.frect(0, 0, w, 0.5, '#5a5664');
}

const images = new Map<string, HTMLImageElement | null>();
const textures = new Map<string, Texture>();
let onLoad: (() => void) | null = null;
/** A pack picture as a texture (loaded once; null until it comes, then `onCastleArt` is called). */
function packTexture(url: string): Texture | null {
  const t = textures.get(url);
  if (t) return t;
  if (!images.has(url)) {
    images.set(url, null);
    loadImage(url).then(
      (im) => {
        images.set(url, im);
        textures.set(url, Texture.from(im));
        onLoad?.();
      },
      () => undefined,
    );
  }
  return null;
}
export function onCastleArt(cb: () => void): void {
  onLoad = cb;
}
/** Whether the pack's floor and gate have loaded (the castle is drawn again when they do). */
export const castleArtReady = () => !!textures.get(floorUrl) && !!textures.get(gateUrl) && !!textures.get(doorsUrl);
/** A mountain hold's gate: the dungeon pack's stone archway with its wooden doors swung open (the door sheet's second
 *  row, fourth frame), drawn half again a cell's size in the cliff. */
const HOLD_GATE = new Rectangle(96, 32, 32, 32);
const HOLD_GATE_SIZE = 48;
let holdGate: Texture | null = null;
function holdGateTexture(): Texture | null {
  if (holdGate) return holdGate;
  const sheet = packTexture(doorsUrl);
  if (sheet) holdGate = new Texture({ source: sheet.source, frame: HOLD_GATE });
  return holdGate;
}

/** How far down into a room the wall along its top reaches (px): the curtain wall's or the rock's face where the castle
 *  ends, else a partition's (map/castleClutter.ts sets things before it). */
export const wallDepth = (mountain: boolean, outside: boolean): number => (outside ? (mountain ? ROCK_T + ROCK_FACE : MERLON + WALL_T + INNER_FACE) : PART_T + PART_FACE);

/** The castle's drawing: what goes under everything (floors, the carpet) and the walls and towers among the things. */
export interface CastleDrawing {
  under: Container;
  things: Container[];
}

/** Draw the castle: `cells` are the land indices of the hall and of every finished room (`rooms`), `landW` the land's
 *  width. Walls go along the cells' outer edges and between the regions (the hall and each room). */
export function buildCastle(castle: CastleView, rooms: Building[], footprint: (b: Building) => Rect, landW: number, tone: Tone, toneKey: string, winter: boolean): CastleDrawing {
  const P = pieces(tone, toneKey, winter);
  // which region each finished cell belongs to (-1: the hall)
  const region = new Map<number, number>();
  const add = (r: Rect, id: number) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) region.set(y * landW + x, id);
  };
  add(castle.core, -1);
  for (const b of rooms) add(footprint(b), b.id);
  // a hold's galleries, dug for ore, are walled and doored like rooms (their floor is the ground's own)
  for (const i of castle.galleries) if (!region.has(i)) region.set(i, -2);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= landW ? undefined : region.get(y * landW + x));

  const under = new Container();
  const things: Container[] = [];
  // the floors: the pack's flagstones over each region (painted dark stone until they load)
  const floorTex = packTexture(floorUrl);
  const floorOf = (r: Rect) => {
    if (floorTex) {
      const t = new TilingSprite({ texture: floorTex, width: r.w * CELL, height: r.h * CELL });
      t.position.set(r.x * CELL, r.y * CELL);
      under.addChild(t);
    } else under.addChild(new Graphics().rect(r.x * CELL, r.y * CELL, r.w * CELL, r.h * CELL).fill(parseInt(tone('#4e3e50').slice(1), 16)));
  };
  floorOf(castle.core);
  for (const b of rooms) floorOf(footprint(b));
  // the carpet from the gate to the middle of the hall
  const gx = (castle.gate.x + 0.5) * CELL;
  const top = (castle.core.y + castle.core.h / 2) * CELL;
  const bottom = castle.gate.y * CELL;
  under.addChild(new Graphics().rect(gx - CARPET_W / 2, top, CARPET_W, bottom - top).fill(parseInt(tone('#a01828').slice(1), 16)).rect(gx - CARPET_W / 2 + 2, top + 2, CARPET_W - 4, bottom - top - 2).fill(parseInt(tone('#8a1424').slice(1), 16)).rect(gx - CARPET_W / 2 + 2, top, CARPET_W - 4, 2).fill(parseInt(tone('#d8b050').slice(1), 16)));

  // the doorways the sim walks through (sim/castle.ts `doorsOf`), so the doors people use are the ones drawn
  const doors = new Set(castle.doors);

  const put = (tex: Texture, x: number, y: number, z: number) => {
    const sp = new Sprite(tex);
    sp.position.set(x, y);
    sp.zIndex = z;
    things.push(sp);
    return sp;
  };
  const mountain = castle.hold === 'mountain';
  const gateTex = mountain ? holdGateTexture() : packTexture(gateUrl);
  const towers = new Set<string>();
  for (const [i, id] of region) {
    const x = i % landW;
    const y = Math.floor(i / landW);
    const px = x * CELL;
    const py = y * CELL;
    const n = at(x, y - 1);
    const s = at(x, y + 1);
    const w = at(x - 1, y);
    const e = at(x + 1, y);
    // north: the curtain wall's inside face, or a partition with the room above (drawn by the lower cell)
    if (n === undefined) {
      if (mountain) put(P.rockN.texture, px, py, py + ROCK_T + ROCK_FACE);
      else put(P.outerN.texture, px, py, py + MERLON + WALL_T + INNER_FACE);
    } else if (n !== id) put((doors.has(`${x},${y}|h`) ? P.doorH : P.partH).texture, px, py, py + PART_T + PART_FACE);
    // south: the curtain wall's outer face hanging below the cell, the gate in it before the hall (a mountain hold's
    // carved gate in the cliff)
    if (s === undefined) {
      if (mountain) put(P.rockS.texture, px, py + CELL - ROCK_T, py + CELL + WALL_FACE);
      else put(P.outerS.texture, px, py + CELL - (MERLON + WALL_T), py + CELL + WALL_FACE);
      if (x === castle.gate.x && y === castle.gate.y - 1 && gateTex) {
        if (mountain) {
          const g = put(gateTex, px + CELL / 2 - HOLD_GATE_SIZE / 2, py + CELL + WALL_FACE - HOLD_GATE_SIZE, py + CELL + WALL_FACE + 1);
          g.width = g.height = HOLD_GATE_SIZE;
        } else {
          const g = put(gateTex, px, py + CELL + WALL_FACE - 32, py + CELL + WALL_FACE + 1);
          g.width = g.height = 32;
        }
      }
    }
    // a side gate in the outer wall (sim/castle.ts sideGates): the arched door in the south or north wall, a doorway west
    // or east
    const side = castle.gates?.find((q) => q.x === x && q.y === y);
    if (side && gateTex) {
      if (side.side === 's' && s === undefined) {
        const g = put(gateTex, px, py + CELL + WALL_FACE - 32, py + CELL + WALL_FACE + 1);
        g.width = g.height = 32;
      } else if (side.side === 'n' && n === undefined) {
        const g = put(gateTex, px, py + MERLON + WALL_T + INNER_FACE - 32, py + MERLON + WALL_T + INNER_FACE + 1);
        g.width = g.height = 32;
      }
    }
    // west: the curtain wall, or a partition with the room to the left (drawn by the right cell)
    if (w === undefined && side?.side === 'w') put(P.doorV.texture, px, py, py + CELL);
    else if (w === undefined) put((mountain ? P.rockV : P.outerW).texture, px, py, py + CELL);
    else if (w !== id) put((doors.has(`${x},${y}|v`) ? P.doorV : P.partV).texture, px, py, py + CELL);
    if (e === undefined && side?.side === 'e') put(P.doorV.texture, px + CELL - OUTER_SIDE_T, py, py + CELL);
    else if (e === undefined) put((mountain ? P.rockV : P.outerE).texture, px + CELL - (mountain ? ROCK_T : OUTER_SIDE_T), py, py + CELL);
    // a round tower at each outer corner (where two outer edges meet; the mountain needs none)
    if (!mountain) for (const [cx, cy, a, b] of [
      [px, py, n, w],
      [px + CELL, py, n, e],
      [px, py + CELL, s, w],
      [px + CELL, py + CELL, s, e],
    ] as const) {
      const k = `${cx},${cy}`;
      if (a === undefined && b === undefined && !towers.has(k)) {
        towers.add(k);
        put(P.tower.texture, cx - TOWER_W / 2, cy - TOWER_H + 4 + (cy > py ? WALL_FACE : 0), cy + (cy > py ? WALL_FACE + 2 : 6));
      }
    }
  }
  return { under, things };
}

// ------------------------------------------------------------------------------------------------ the furnishings

const HALL: Pick = { parts: [[dpTable2, 10, 4], [dpChair1, 0, 6], [dpChair2, 74, 6], [doChest, 30, 36]], size: [96, 60], overhang: 0 };
const STORE: Pick = { parts: [[doCrates, 0, 0], [doBarrel, 34, 4], [doBarrel, 52, 0], [doChest, 20, 30]], size: [72, 52], overhang: 0 };
const furniture = new Map<string, PixelArt>();

/** A room's furnishings, to stand in the middle of its floor: the pack picture that suits the kind of building where
 *  there is one (shelves, benches, racks, a well, a fire pit...), else beds for a home (one a sleeper, as many as fit),
 *  crates and barrels for a store, and a table with chairs and a chest for the rest. */
export function roomFurniture(def: BuildingDef, w: number, id: number, tone: Tone, toneKey: string, style: string): PixelArt | null {
  // (the seat of the hold: the throne room's furnishings, art/seatArt.ts)
  const seat = SEAT_STAGE[def.id];
  if (seat) return seatInterior(seat.origin, seat.stage, w, tone, toneKey);
  const inner = Math.max(1, w - 1);
  // (a home in a castle or a hold is beds, never a tent)
  const pack = def.housing ? null : packArtIndoors(def.id, inner, style, id);
  if (pack) return pack;
  if (def.housing) {
    const bw = 18;
    const bh = 26;
    const gap = 6;
    const beds = Math.max(1, Math.min(def.housing, Math.floor((w * CELL - 20 + gap) / (bw + gap))));
    const key = `beds|${beds}|${toneKey}`;
    let a = furniture.get(key);
    if (!a) {
      const W = beds * (bw + gap) - gap;
      a = paint(W + 8, bh + 8, tone, (p) => {
        // (a rug under them, then each bed: a dark wooden frame with a headboard, the mattress, a pillow at the head,
        // a red blanket turned down at the foot)
        p.rect(0, 4, W + 8, bh + 4, '#4a2030');
        p.frect(1, 5, W + 6, bh + 2, '#5a2838');
        p.frect(2, 6, W + 4, bh, '#4a2030');
        for (let i = 0; i < beds; i++) {
          const x = 4 + i * (bw + gap);
          p.rect(x, 0, bw, bh, '#3a2616');
          p.rect(x, 0, bw, 3, '#2a1a0e');
          p.frect(x, 0.5, bw, 0.5, '#5a4030');
          p.rect(x + 2, 3, bw - 4, bh - 4, '#e8e0cc');
          p.rect(x + 3, 4, bw - 6, 6, '#f8f4ea');
          p.frect(x + 3, 9.5, bw - 6, 0.5, '#c8c0b0');
          p.rect(x + 2, 13, bw - 4, bh - 15, '#8a1424');
          p.frect(x + 2, 13, bw - 4, 1, '#b02838');
          p.frect(x + 2, 14, bw - 4, 0.5, '#d8b050');
          p.frect(x + 2, bh - 2.5, bw - 4, 0.5, '#5a0c18');
        }
      }, 0.5);
      furniture.set(key, a);
    }
    return a;
  }
  return pickArt(def.storage && !def.housing ? STORE : HALL, inner, `castle|${def.storage ? 'store' : 'hall'}`);
}
