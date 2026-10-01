// The battle map's ground (renderer/battle/battleView.ts): one painting of the whole map, in the land's colours for the
// season (PAL), seen from above at a slant: grass with its speckle, the trail worn into it, the town's wall lines across
// it in what they're built of, the gate where the trail goes through, the sea along a shore town's map and rock along a
// hold's. Each cell is CELL art pixels; the map is painted along the screen's width (sideways) or down it (upright).

import type { BattleMap } from '../../shared/sim/battle';
import { PAL } from './palette';
import { mixHex, noTone, paint, type Painter, type PixelArt } from './pixelArt';
import { hash, shade } from './terrain';

export const CELL = 16;

/** Map cell (along, across) to the painting's pixels, upright (the trail running down) or sideways (across). */
export const toArt = (vertical: boolean, x: number, y: number): [number, number] => (vertical ? [y * CELL, x * CELL] : [x * CELL, y * CELL]);

/** The cells a trail runs through. */
export function trailCells(map: BattleMap): Set<string> {
  const out = new Set<string>();
  for (const path of map.paths)
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2) + 1;
      for (let k = 0; k <= n; k++) out.add(`${Math.floor(ax + ((bx - ax) * k) / n)},${Math.floor(ay + ((by - ay) * k) / n)}`);
    }
  return out;
}

/** What each kind of wall is made of: its face, its light and dark, and how it's laid. */
const WALLS: Record<string, { face: string; light: string; dark: string; laid: 'logs' | 'blocks' | 'bricks' | 'slab' | 'glow' | 'wagon' }> = {
  palisade_wall: { face: '#6a4a2a', light: '#8a6a3a', dark: '#3b2616', laid: 'logs' },
  stone_wall: { face: '#8a8680', light: '#aaa49b', dark: '#55514c', laid: 'blocks' },
  brick_wall: { face: '#a4543a', light: '#bc6a48', dark: '#6a3424', laid: 'bricks' },
  concrete_wall: { face: '#9a9a94', light: '#b4b4ae', dark: '#74746e', laid: 'slab' },
  force_wall: { face: '#3a8aa8', light: '#9ae8ff', dark: '#1a4a68', laid: 'glow' },
  wagon_circle: { face: '#7a5230', light: '#9a7040', dark: '#4a3018', laid: 'wagon' },
};

export function battleGround(map: BattleMap, vertical: boolean, seed: number): PixelArt {
  const W = (vertical ? map.wid : map.len) * CELL;
  const H = (vertical ? map.len : map.wid) * CELL;
  const trail = trailCells(map);
  const walls = new Set(map.walls.map(([x, y]) => `${x},${y}`));
  const water = map.water ?? 0;
  return paint(
    W,
    H,
    noTone,
    (p) => {
      // grass, with a mottle of light and dark and the odd flower
      p.rect(0, 0, W, H, PAL.grass);
      for (let y = 0; y < H; y += 2)
        for (let x = 0; x < W; x += 2) {
          const r = hash(seed, x, y);
          if (r < 0.08) p.rect(x, y, 2, 2, PAL.grassDark);
          else if (r < 0.14) p.rect(x, y, 2, 2, PAL.grassLight);
          else if (r < 0.145) p.px(x, y, PAL.flowers[Math.floor(hash(seed ^ 3, x, y) * PAL.flowers.length)]);
        }
      // each cell: sea, rock, trail, wall
      for (let cx = 0; cx < map.len; cx++)
        for (let cy = 0; cy < map.wid; cy++) {
          const [ax, ay] = toArt(vertical, cx, cy);
          const key = `${cx},${cy}`;
          if (cy < water) seaCell(p, ax, ay, cx, cy, cy === water - 1, vertical, seed);
          else if (map.rock && (cy === 0 || cy === map.wid - 1) && !trail.has(key)) rockCell(p, ax, ay, seed ^ (cx * 31 + cy));
          else if (trail.has(key)) trailCell(p, ax, ay, cx, cy, trail, vertical, seed);
        }
      // the walls over it all (the gate where the trail runs through a wall line)
      const lines = new Set(map.walls.map(([x]) => x));
      for (const wx of lines)
        for (let cy = water; cy < map.wid; cy++) {
          const [ax, ay] = toArt(vertical, wx, cy);
          if (trail.has(`${wx},${cy}`)) gateCell(p, ax, ay, vertical, map.wall);
          else if (walls.has(`${wx},${cy}`)) wallCell(p, ax, ay, vertical, map.wall, cx_seed(wx, cy));
        }
    },
    1,
    { tile: true, stuff: false },
  );
}

const cx_seed = (x: number, y: number) => x * 73 + y * 19;

function seaCell(p: Painter, x: number, y: number, cx: number, cy: number, shore: boolean, vertical: boolean, seed: number): void {
  p.rect(x, y, CELL, CELL, cy === 0 ? PAL.waterDark : PAL.water);
  for (let k = 0; k < 3; k++) {
    const yy = 3 + k * 5 + Math.floor(hash(seed ^ k, cx, cy) * 3);
    if (vertical) p.rect(x + yy, y + 2 + k * 4, 1, 5, PAL.waterLight);
    else p.rect(x + 2 + k * 4, y + yy, 5, 1, PAL.waterLight);
  }
  if (shore) {
    // sand and foam where the sea meets the land
    if (vertical) {
      p.rect(x + CELL - 4, y, 4, CELL, '#d8c894');
      p.rect(x + CELL - 5, y, 1, CELL, '#eef6fa');
    } else {
      p.rect(x, y + CELL - 4, CELL, 4, '#d8c894');
      p.rect(x, y + CELL - 5, CELL, 1, '#eef6fa');
    }
  }
}

function rockCell(p: Painter, x: number, y: number, seed: number): void {
  p.rect(x, y, CELL, CELL, PAL.rock);
  for (let k = 0; k < 5; k++) {
    const rx = x + Math.floor(hash(seed, k, 1) * 12);
    const ry = y + Math.floor(hash(seed, k, 2) * 12);
    p.ellipse(rx + 2, ry + 2, 3, 2, k % 2 ? PAL.rockDark : PAL.rockLight);
  }
  p.rect(x, y, CELL, 1, PAL.rockTip);
}

function trailCell(p: Painter, x: number, y: number, cx: number, cy: number, trail: Set<string>, vertical: boolean, seed: number): void {
  p.rect(x, y, CELL, CELL, PAL.dirt);
  // ruts and stones along it, and a worn edge where it meets the grass
  for (let k = 0; k < 4; k++) {
    const r = hash(seed, cx * 7 + k, cy);
    const sx = x + Math.floor(r * 13);
    const sy = y + Math.floor(hash(seed, cx, cy * 5 + k) * 13);
    p.rect(sx, sy, 2, 1, k % 2 ? PAL.dirtDark : PAL.dirtLight);
  }
  if (hash(seed ^ 9, cx, cy) < 0.3) {
    p.rect(x + 6, y + 7, 3, 2, PAL.rockDark);
    p.px(x + 6, y + 7, PAL.pebble);
  }
  const edge = (dx: number, dy: number) => !trail.has(`${cx + dx},${cy + dy}`);
  // (the neighbours in screen terms: upright, along is down and across is right)
  const [up, down, left, right] = vertical ? [edge(-1, 0), edge(1, 0), edge(0, -1), edge(0, 1)] : [edge(0, -1), edge(0, 1), edge(-1, 0), edge(1, 0)];
  const lip = shade(PAL.dirt, -0.18);
  if (up) p.rect(x, y, CELL, 2, PAL.grassDark), p.rect(x, y + 2, CELL, 1, lip);
  if (down) p.rect(x, y + CELL - 2, CELL, 2, PAL.grassDark);
  if (left) p.rect(x, y, 2, CELL, PAL.grassDark), p.rect(x + 2, y, 1, CELL, lip);
  if (right) p.rect(x + CELL - 2, y, 2, CELL, PAL.grassDark);
}

function wallCell(p: Painter, x: number, y: number, vertical: boolean, kind: string | undefined, seed: number): void {
  const w = WALLS[kind ?? 'palisade_wall'] ?? WALLS.palisade_wall;
  // the wall is seen from above at a slant: its top, then its face toward the trail's start
  p.rect(x, y, CELL, CELL, w.face);
  switch (w.laid) {
    case 'logs':
      for (let k = 0; k < CELL; k += 4) {
        if (vertical) p.rect(x, y + k, CELL, 3, w.face), p.rect(x, y + k, CELL, 1, w.light), p.rect(x + CELL - 1, y + k, 1, 3, w.dark);
        else p.rect(x + k, y, 3, CELL, w.face), p.rect(x + k, y, 1, CELL, w.light), p.ellipse(x + k + 1.5, y + 1, 1.5, 1, w.dark);
      }
      break;
    case 'blocks':
    case 'bricks': {
      const bw = w.laid === 'blocks' ? 6 : 4;
      for (let yy = 0; yy < CELL; yy += 4)
        for (let xx = (yy / 4) % 2 ? -bw / 2 : 0; xx < CELL; xx += bw) {
          p.rect(x + Math.max(0, xx), y + yy, Math.min(bw - 1, CELL - xx), 3, (xx + yy + seed) % 3 ? w.face : w.light);
          p.frect(x + Math.max(0, xx), y + yy + 3, Math.min(bw - 1, CELL - xx), 0.5, w.dark);
        }
      break;
    }
    case 'slab':
      p.rect(x, y, CELL, 1, w.light);
      p.rect(x, y + CELL / 2, CELL, 0.5, w.dark);
      break;
    case 'glow':
      p.rect(x + 2, y + 2, CELL - 4, CELL - 4, mixHex(w.face, w.light, 0.5));
      p.rect(x + 5, y + 5, CELL - 10, CELL - 10, w.light);
      break;
    case 'wagon':
      p.rect(x + 1, y + 3, CELL - 2, CELL - 6, w.face);
      p.rect(x + 1, y + 3, CELL - 2, 1, w.light);
      p.disc(x + 4, y + CELL - 3, 2.5, w.dark);
      p.disc(x + CELL - 4, y + CELL - 3, 2.5, w.dark);
      break;
  }
  // its shadow on the ground beside it
  if (vertical) p.rect(x, y + CELL - 1, CELL, 1, w.dark);
  else p.rect(x + CELL - 1, y, 1, CELL, w.dark);
}

function gateCell(p: Painter, x: number, y: number, vertical: boolean, kind: string | undefined): void {
  const w = WALLS[kind ?? 'palisade_wall'] ?? WALLS.palisade_wall;
  // two posts, the trail running between them, and the gate swung open
  if (vertical) {
    p.rect(x, y, 3, CELL, w.dark);
    p.rect(x + CELL - 3, y, 3, CELL, w.dark);
    p.rect(x + 3, y + 1, 2, CELL - 2, w.light);
  } else {
    p.rect(x, y, CELL, 3, w.dark);
    p.rect(x, y + CELL - 3, CELL, 3, w.dark);
    p.rect(x + 1, y + 3, CELL - 2, 2, w.light);
  }
}
