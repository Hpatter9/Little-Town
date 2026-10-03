// Paints the land's ground for the top-down town, a chunk of cells at a time: each kind of ground in its own
// colours (by season), roads as the battle map's cobbles (the Fields tileset, once loaded), water with lighter
// edges, and the land beyond what the town knows darkened (and black further out). A chunk is painted again only
// when something in it changes (the land's version, the open radius, the season).

import { Texture } from 'pixi.js';
import { CELL, groundAt, isRoad, type LandMap, FOG_BAND, wearAt, WEAR_FULL, WEAR_SHOW } from '../../shared/sim/land';
import type { TdTiles } from '../art/tdTiles';
import type { Era } from '../../shared/data/eras';
import { drawRoadCell, drawWornPatch, ROAD_BY_ERA, roadTilesReady } from '../art/roadTiles';

/** Cells to a chunk's side. */
export const CHUNK = 8;
export { FOG_BAND };

interface Pal {
  grass: [string, string, string];
  fertile: [string, string];
  sand: [string, string];
  forest: [string, string];
  marsh: [string, string, string];
  hill: [string, string];
  rock: [string, string];
  water: [string, string];
  road: [string, string, string];
  flowers: string[];
}
const SUMMER: Pal = {
  grass: ['#5f9b3e', '#55893a', '#6fab48'],
  fertile: ['#7d5f36', '#6c5130'],
  sand: ['#d9c58c', '#cbb67c'],
  forest: ['#3f6d2f', '#36602a'],
  marsh: ['#4e6f44', '#44633c', '#587f98'],
  hill: ['#7f8f4b', '#6f7f40'],
  rock: ['#8d8c84', '#73726b'],
  water: ['#4382b8', '#86b9e0'],
  road: ['#a58c66', '#8f7756', '#b89c76'],
  flowers: ['#f2e26a', '#e86e8a', '#f4f4f4', '#b983e0'],
};
const PALETTES: Record<string, Pal> = {
  spring: { ...SUMMER, grass: ['#67a548', '#5b9440', '#7ab754'], flowers: ['#f2e26a', '#f0a0c0', '#ffffff', '#b983e0', '#ffb060'] },
  summer: SUMMER,
  autumn: { ...SUMMER, grass: ['#8d9a44', '#7f8a3c', '#a4a650'], forest: ['#5f6a2c', '#515b26'], hill: ['#8c8a46', '#7a783c'], flowers: ['#e0b040', '#c87040'] },
  winter: { ...SUMMER, grass: ['#dfe6ec', '#d2dbe3', '#f0f4f8'], fertile: ['#cfd6dc', '#bec6ce'], forest: ['#c8d4da', '#b8c6cf'], marsh: ['#c4ccd0', '#b6bfc4', '#6f8fa8'], hill: ['#d6dde3', '#c7cfd6'], rock: ['#9b9c98', '#7d7e7a'], sand: ['#e4e0cc', '#d6d2bf'], flowers: [] },
};

/** A quick deterministic hash of a point (0..1). */
export function hash(seed: number, x: number, y: number): number {
  let h = (seed * 374761393 + x * 668265263 + y * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** How a cell is seen: 2 known, 1 dim (just beyond the open land), 0 unseen. */
export function visibility(m: LandMap, x: number, y: number): 0 | 1 | 2 {
  const d = Math.hypot(x - m.camp.x, y - m.camp.y);
  return d <= m.open ? 2 : d <= m.open + FOG_BAND ? 1 : 0;
}

/** A key for what a chunk shows (painted again when it changes). */
export function chunkKey(m: LandMap, cx: number, cy: number, season: string, td: boolean, era: Era = 'neolithic'): string {
  let s = `${season}|${td ? 1 : 0}|${roadTilesReady() ? ROAD_BY_ERA[era] : ''}|${m.open}|`;
  for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++) {
    const i0 = y * m.w + cx * CHUNK;
    s += m.cells.slice(i0, i0 + CHUNK) + m.roads.slice(i0, i0 + CHUNK);
    // (footpaths, by how worn: a step either side too, since a path reaches toward its neighbours)
    if (m.wear) for (let x = cx * CHUNK - 1; x <= (cx + 1) * CHUNK; x++) s += wornLevel(m, x, y) || wornLevel(m, x, y - 1) || wornLevel(m, x, y + 1);
  }
  return s;
}

/** How worn a cell shows: 0 not at all, 1 faintly, 2 plainly, 3 a bare path. */
function wornLevel(m: LandMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h || isRoad(m, x, y)) return 0;
  const v = wearAt(m, y * m.w + x);
  if (v < WEAR_SHOW) return 0;
  return v >= WEAR_FULL ? 3 : v >= (WEAR_SHOW + WEAR_FULL) / 2 ? 2 : 1;
}
const WORN_ALPHA = [0, 0.4, 0.7, 1];

/** Paint one chunk (a 2D canvas, one canvas pixel per world pixel). */
export function paintChunk(m: LandMap, cx: number, cy: number, season: string, biome: string, td: TdTiles | null, era: Era = 'neolithic'): Texture {
  const pal = PALETTES[season] ?? SUMMER;
  const size = CHUNK * CELL;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const seed = (cx * 73 + cy * 151) | 0;
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  for (let dy = 0; dy < CHUNK; dy++)
    for (let dx = 0; dx < CHUNK; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      const px = dx * CELL;
      const py = dy * CELL;
      const vis = visibility(m, x, y);
      if (vis === 0) {
        rect(px, py, CELL, CELL, '#0b0d14');
        continue;
      }
      const kind = groundAt(m, x, y);
      const road = isRoad(m, x, y);
      // the pack's road tiles (art/roadTiles.ts) over the ground, once loaded: the ground is painted first below
      const packRoad = road && roadTilesReady();
      if (road && !packRoad) {
        // a beaten earth path, worn pale down the middle, with the odd pebble (until the pack's tiles load)
        cell(px, py, pal.road[0], pal.road[1], 0.12, pal.road[2], 0.1);
        const across = isRoad(m, x - 1, y) || isRoad(m, x + 1, y);
        const down = isRoad(m, x, y - 1) || isRoad(m, x, y + 1);
        if (across || !down) rect(px, py + 12, CELL, 8, pal.road[2]);
        if (down || !across) rect(px + 12, py, 8, CELL, pal.road[2]);
        for (let k = 0; k < 3; k++) if (hash(seed ^ (41 + k), x, y) < 0.5) rect(px + Math.floor(hash(seed ^ (51 + k), x, y) * 30), py + Math.floor(hash(seed ^ (61 + k), x, y) * 30), 2, 2, pal.rock[1]);
        void td;
      } else
        switch (kind) {
          case 'grass':
            cell(px, py, pal.grass[0], pal.grass[1], 0.08, pal.grass[2], 0.06);
            if (pal.flowers.length && hash(seed ^ 9, x, y) < 0.2) rect(px + Math.floor(hash(seed ^ 11, x, y) * 28) + 1, py + Math.floor(hash(seed ^ 13, x, y) * 28) + 1, 2, 2, pal.flowers[Math.floor(hash(seed ^ 15, x, y) * pal.flowers.length)]);
            break;
          case 'fertile':
            cell(px, py, pal.fertile[0], pal.fertile[1], 0.18);
            // (furrows)
            for (let r = 4; r < CELL; r += 8) rect(px, py + r, CELL, 1, pal.fertile[1]);
            break;
          case 'sand':
            cell(px, py, pal.sand[0], pal.sand[1], 0.1);
            break;
          case 'forest':
            cell(px, py, pal.forest[0], pal.forest[1], 0.14);
            break;
          case 'marsh':
            cell(px, py, pal.marsh[0], pal.marsh[1], 0.12);
            // (pools of standing water)
            if (hash(seed ^ 21, x, y) < 0.6) {
              const w = 8 + Math.floor(hash(seed ^ 23, x, y) * 14);
              const h = 5 + Math.floor(hash(seed ^ 25, x, y) * 8);
              rect(px + Math.floor(hash(seed ^ 27, x, y) * (CELL - w)), py + Math.floor(hash(seed ^ 29, x, y) * (CELL - h)), w, h, pal.marsh[2]);
            }
            break;
          case 'hill':
            cell(px, py, pal.hill[0], pal.hill[1], 0.14);
            break;
          case 'rock':
            cell(px, py, pal.rock[0], pal.rock[1], 0.16);
            // (cracks)
            rect(px + Math.floor(hash(seed ^ 31, x, y) * 20), py + Math.floor(hash(seed ^ 33, x, y) * 28), 10, 1, pal.rock[1]);
            break;
          case 'water': {
            cell(px, py, pal.water[0], pal.water[1], 0.05);
            // (lighter where it meets the land)
            const edge = (ox: number, oy: number) => groundAt(m, x + ox, y + oy) !== 'water';
            if (edge(0, -1)) rect(px, py, CELL, 3, pal.water[1]);
            if (edge(0, 1)) rect(px, py + CELL - 3, CELL, 3, pal.water[1]);
            if (edge(-1, 0)) rect(px, py, 3, CELL, pal.water[1]);
            if (edge(1, 0)) rect(px + CELL - 3, py, 3, CELL, pal.water[1]);
            break;
          }
        }
      // a footpath worn by walking: patches of bare earth along it, toward each worn (or road) neighbour
      const worn = wornLevel(m, x, y);
      if (worn && kind !== 'water' && roadTilesReady()) {
        const a = WORN_ALPHA[worn];
        drawWornPatch(g, px + CELL / 2, py + CELL / 2, 22, a);
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          const other = isRoad(m, nx, ny) ? 3 : wornLevel(m, nx, ny);
          if (other) drawWornPatch(g, px + CELL / 2 + (dx * CELL) / 2, py + CELL / 2 + (dy * CELL) / 2, 18, Math.min(a, WORN_ALPHA[other]));
        }
      }
      if (packRoad) {
        const grassy = kind === 'grass' || kind === 'forest' || kind === 'marsh' || kind === 'hill';
        drawRoadCell(g, px, py, ROAD_BY_ERA[era], grassy && season !== 'winter', (dx, dy) => isRoad(m, x + dx, y + dy));
      }
      // beyond the open land the ground fades into the dark, further out the darker
      if (vis === 1) {
        const d = Math.hypot(x - m.camp.x, y - m.camp.y) - m.open;
        rect(px, py, CELL, CELL, `rgba(8, 10, 18, ${(0.3 + 0.55 * Math.min(1, d / FOG_BAND)).toFixed(2)})`);
      }
    }
  // (the desert's sand under everything: the dunes' own grain)
  void biome;
  return Texture.from(canvas);

  /** A cell of one colour with a speckle of another (and a third, if given), in 2px grains. */
  function cell(px: number, py: number, base: string, dark: string, share: number, light?: string, lightShare = 0): void {
    rect(px, py, CELL, CELL, base);
    for (let yy = 0; yy < CELL; yy += 2)
      for (let xx = 0; xx < CELL; xx += 2) {
        const r = hash(seed, px + xx, py + yy);
        if (r < share) rect(px + xx, py + yy, 2, 2, dark);
        else if (light && r > 1 - lightShare) rect(px + xx, py + yy, 2, 2, light);
      }
  }
}
