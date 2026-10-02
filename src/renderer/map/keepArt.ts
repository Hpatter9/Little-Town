// The vampire keep on the top-down map (sim/castle.ts `keepRect`: one level of rooms inside a walled ground). The
// renderer dresses that ground: a flagstone floor with a carpet from the gate to the hall, a curtain wall round it
// seen the way the buildings are (its walk from above, its face below, battlements over), round towers at the
// corners, and a gatehouse in the south wall where the carpet begins. The rooms themselves are the town's own
// building pictures, standing on the floor.

import { mixHex, paint, type Painter, type PixelArt, type Tone } from '../art/pixelArt';

/** The wall-walk's footprint along the ground's edge (px), the face seen below it, and the battlements above. */
export const WALL_T = 8;
export const WALL_FACE = 22;
export const MERLON = 6;
/** A corner tower's picture. */
export const TOWER_W = 30;
export const TOWER_H = 58;
/** The gate's opening and the carpet's width (px). */
export const GATE_W = 36;
export const CARPET_W = 22;
/** A flagstone tile (px square). */
export const FLOOR_TILE = 64;

const STONE = '#4a3a4a';
const STONE_LIGHT = '#5e4c5e';
const STONE_DARK = '#2e222e';
const WALK = '#564658';
const WALK_LIGHT = '#6a586c';
const FLAG = '#4e3e50';
const FLAG_LIGHT = '#5c4a5e';
const FLAG_DARK = '#3a2c3c';
const MORTAR = '#2a2030';
const SLATE = '#2a2232';
const SLATE_DARK = '#1a1420';
const GOLD = '#d8b050';
const IRON = '#6a6a74';
const GLOOM = '#140e18';
const BLOOD = '#a01828';
const BLOOD_LIGHT = '#d03040';
const CANDLE = '#f0d080';

const cache = new Map<string, PixelArt>();
function cached(key: string, make: () => PixelArt): PixelArt {
  let a = cache.get(key);
  if (!a) cache.set(key, (a = make()));
  return a;
}

type P = Painter;

/** Dressed stone: thin mortar, each block lit along its top and left, a few chipped. */
function blocks(p: P, x0: number, y0: number, w: number, h: number): void {
  p.rect(x0, y0, w, h, STONE);
  for (let y = y0; y < y0 + h; y += 5) {
    p.frect(x0, y, w, 0.5, STONE_DARK);
    p.frect(x0, y + 0.5, w, 0.5, STONE_LIGHT);
    p.frect(x0, y + 4.5, w, 0.5, mixHex(STONE, STONE_DARK, 0.5));
    for (let x = x0 + (((y - y0) / 5) % 2) * 4; x < x0 + w; x += 9) {
      p.frect(x, y + 0.5, 0.5, 4.5, STONE_DARK);
      p.frect(x + 0.5, y + 1, 0.5, 3.5, mixHex(STONE, STONE_LIGHT, 0.5));
      if ((x * 3 + y) % 7 === 0) p.rect(x + 1, y + 1, 7, 1, STONE_LIGHT);
      if ((x * 5 + y * 3) % 11 === 0) p.frect(x + 3, y + 2, 1, 0.5, STONE_DARK);
    }
  }
}

/** The wall-walk seen from above: paving between two parapets. */
function walk(p: P, x0: number, y0: number, w: number, h: number, along: 'x' | 'y'): void {
  p.rect(x0, y0, w, h, WALK);
  if (along === 'x') {
    p.frect(x0, y0, w, 1, WALK_LIGHT);
    p.frect(x0, y0 + h - 1, w, 1, STONE_DARK);
    for (let x = x0 + 3; x < x0 + w; x += 7) p.frect(x, y0 + 1, 0.5, h - 2, STONE_DARK);
  } else {
    p.frect(x0, y0, 1, h, WALK_LIGHT);
    p.frect(x0 + w - 1, y0, 1, h, STONE_DARK);
    for (let y = y0 + 3; y < y0 + h; y += 7) p.frect(x0 + 1, y, w - 2, 0.5, STONE_DARK);
  }
}

/** Battlements along a wall's top: merlons with the embrasures between showing what's behind (nothing). */
function merlons(p: P, x0: number, y0: number, w: number): void {
  for (let x = x0; x < x0 + w; x += 10) {
    const mw = Math.min(6, x0 + w - x);
    p.rect(x, y0, mw, MERLON, STONE);
    p.frect(x, y0, mw, 0.5, STONE_LIGHT);
    p.frect(x, y0, 0.5, MERLON, STONE_LIGHT);
    p.frect(x + mw - 0.5, y0, 0.5, MERLON, STONE_DARK);
  }
}

/** A flagstone floor tile: big slabs, dark mortar, a crack or two. Tiled over the keep's ground. */
export function floorTile(tone: Tone, toneKey: string): PixelArt {
  return cached(`floor|${toneKey}`, () =>
    paint(FLOOR_TILE, FLOOR_TILE, tone, (p) => {
      p.rect(0, 0, FLOOR_TILE, FLOOR_TILE, MORTAR);
      // (two rows of slabs, offset like brickwork)
      const rows = [
        [0, 22, 0],
        [22, 20, 11],
        [42, 22, 0],
      ];
      for (const [y, h, off] of rows) {
        for (let x = -off; x < FLOOR_TILE; x += 22) {
          const w = 21;
          const shade = ((x + y) * 7) % 3;
          p.rect(x + 1, y + 1, w - 1, h - 1, shade === 0 ? FLAG : shade === 1 ? FLAG_LIGHT : mixHex(FLAG, FLAG_DARK, 0.5));
          p.frect(x + 1, y + 1, w - 1, 0.5, mixHex(FLAG_LIGHT, '#ffffff', 0.08));
          p.frect(x + 1, y + h - 0.5, w - 1, 0.5, FLAG_DARK);
          if ((x * 13 + y * 7) % 5 === 0) p.fline(x + 4, y + 3, x + 9, y + h - 4, FLAG_DARK);
        }
      }
    }, 0.6, { tile: true }),
  );
}

/** A side wall's walk (west and east), tiled down the keep's flanks. */
export function sideWalkTile(tone: Tone, toneKey: string): PixelArt {
  return cached(`sidewalk|${toneKey}`, () =>
    paint(WALL_T, 32, tone, (p) => walk(p, 0, 0, WALL_T, 32, 'y'), 0.5, { tile: true }),
  );
}

/** The north wall: battlements, the walk, and its face looking into the keep (lit by sconces). */
export function northWall(w: number, tone: Tone, toneKey: string): PixelArt {
  const h = MERLON + WALL_T + WALL_FACE;
  return cached(`north|${w}|${toneKey}`, () =>
    paint(w, h, tone, (p) => {
      merlons(p, 0, 0, w);
      walk(p, 0, MERLON, w, WALL_T, 'x');
      blocks(p, 0, MERLON + WALL_T, w, WALL_FACE);
      // sconces along the face, and the odd gothic window slit
      for (let x = 24; x < w - 12; x += 48) {
        p.rect(x, MERLON + WALL_T + 6, 1, 5, IRON);
        p.rect(x - 1, MERLON + WALL_T + 4, 3, 2, CANDLE);
        p.px(x, MERLON + WALL_T + 3, '#fff0b0');
      }
      for (let x = 48; x < w - 16; x += 96) {
        p.rect(x, MERLON + WALL_T + 5, 3, 11, GLOOM);
        p.px(x + 1, MERLON + WALL_T + 4, GLOOM);
        p.rect(x + 1, MERLON + WALL_T + 9, 1, 4, BLOOD);
      }
      // the foot of the wall, in shadow
      p.frect(0, h - 1, w, 1, STONE_DARK);
    }, 0.6),
  );
}

/** The south wall, with the gatehouse: two square turrets either side of an arched gate, its portcullis raised. */
export function southWall(w: number, tone: Tone, toneKey: string): PixelArt {
  const turret = 14;
  const rise = 10; // (the gatehouse turrets stand this much higher than the wall)
  const h = rise + MERLON + WALL_T + WALL_FACE;
  return cached(`south|${w}|${toneKey}`, () =>
    paint(w, h, tone, (p) => {
      const y0 = rise;
      merlons(p, 0, y0, w);
      walk(p, 0, y0 + MERLON, w, WALL_T, 'x');
      blocks(p, 0, y0 + MERLON + WALL_T, w, WALL_FACE);
      const gx = Math.round(w / 2 - GATE_W / 2);
      // the gate: an arch cut through the face, the carpet showing through, the portcullis raised into it
      const fy = y0 + MERLON + WALL_T;
      p.rect(gx, fy + 6, GATE_W, WALL_FACE - 6, GLOOM);
      for (let i = 0; i < 6; i++) p.rect(gx + i, fy + 6 - i, GATE_W - i * 2, 1, GLOOM);
      p.rect(gx + 4, fy + WALL_FACE - 10, GATE_W - 8, 10, BLOOD);
      p.frect(gx + 4, fy + WALL_FACE - 10, GATE_W - 8, 0.5, BLOOD_LIGHT);
      for (let x = gx + 3; x < gx + GATE_W - 2; x += 5) p.rect(x, fy + 3, 1, 7, IRON);
      p.rect(gx + 2, fy + 8, GATE_W - 4, 1, IRON);
      // the turrets either side, rising above the wall, each with its own battlements and a slit
      for (const tx of [gx - turret, gx + GATE_W]) {
        p.rect(tx, 0, turret, h, STONE);
        blocks(p, tx, MERLON, turret, h - MERLON);
        merlons(p, tx, 0, turret);
        p.frect(tx, 0, 0.5, h, STONE_LIGHT);
        p.frect(tx + turret - 0.5, 0, 0.5, h, STONE_DARK);
        p.rect(tx + turret / 2 - 1, fy - 2, 2, 8, GLOOM);
        p.rect(tx + turret / 2 - 1, fy + 1, 1, 3, BLOOD);
      }
      // a pennon over the gate
      p.rect(Math.round(w / 2), 0, 1, rise, IRON);
      for (let i = 0; i < 6; i++) p.rect(Math.round(w / 2) + 1, 1 + i * 0.5, 6 - i, 1, i % 3 === 2 ? BLOOD_LIGHT : BLOOD);
      p.frect(0, h - 1, w, 1, STONE_DARK);
    }, 0.6),
  );
}

/** A round corner tower with a steep slate cone and a gilt finial, standing on the wall's corner. */
export function cornerTower(tone: Tone, toneKey: string): PixelArt {
  const w = TOWER_W;
  const h = TOWER_H;
  const cone = 22;
  return cached(`tower|${toneKey}`, () =>
    paint(w, h, tone, (p) => {
      const drumTop = cone + 2;
      // the drum: blocks, rounded by shading at the sides
      blocks(p, 2, drumTop, w - 4, h - drumTop - 2);
      for (let y = drumTop; y < h - 2; y++) {
        p.frect(2, y, 1.5, 1, STONE_LIGHT);
        p.frect(w - 3.5, y, 1.5, 1, STONE_DARK);
        p.frect(w - 5, y, 1.5, 1, mixHex(STONE, STONE_DARK, 0.5));
      }
      // the foot, an ellipse of shadow
      p.ellipse(w / 2, h - 2, w / 2 - 2, 2, STONE_DARK);
      // battlements round the top of the drum, the cone over them
      for (let x = 2; x < w - 2; x += 6) p.rect(x, drumTop - 3, 4, 3, STONE);
      for (let y = 0; y <= cone; y++) {
        const hw = Math.max(0.5, ((w / 2 + 1) * y) / cone);
        p.rect(w / 2 - hw, y, hw, 1, SLATE);
        p.rect(w / 2, y, hw, 1, SLATE_DARK);
      }
      p.rect(w / 2 - 0.5, 0, 1, 3, GOLD);
      // a window slit lit red
      p.rect(w / 2 - 1, drumTop + 8, 3, 9, GLOOM);
      p.rect(w / 2, drumTop + 11, 1, 4, BLOOD);
    }, 0.6),
  );
}
