// Paints the land's ground for the top-down town, a chunk of cells at a time: each kind of ground in its own
// colours (by season), roads as the battle map's cobbles (the Fields tileset, once loaded), water with lighter
// edges, and the land beyond what the town knows darkened (and black further out). A chunk is painted again only
// when something in it changes (the land's version, the open radius, the season).

import { Texture } from 'pixi.js';
import { CELL, groundAt, isRoad, type LandMap, FOG_BAND, wearAt, WEAR_FULL, WEAR_SHOW , wet } from '../../shared/sim/land';
import type { TdTiles } from '../art/tdTiles';
import type { Era } from '../../shared/data/eras';
import { drawRoadCell, drawWornPatch, ROAD_BY_ERA, roadTilesReady } from '../art/roadTiles';
import { drawPatch, drawRipple, drawTuft, groundDetailReady, groundUnder, type Patch } from '../art/groundDetail';
import { PROP_FINE, propFrames, propImage } from '../art/props';
import { paintMountain, paintMountainEdge } from './mountainArt';

/** How many of the shore's water cells show the bottom (the Seabed pack's corals, urchins, starfish and shells) through
 *  the water, on the coast. */
const SHALLOWS = 0.5;

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
  /** The shallows along a shore town's strand: clear water over pale sand, and its foam. */
  shallows: [string, string, string];
  road: [string, string, string];
  flowers: string[];
  /** The mountain's rock mass, its cracks, and its cliff face; the halls' bare floor. */
  mountain: [string, string, string];
  hall: [string, string];
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
  shallows: ['#5aa6c6', '#8fd0dc', '#e8f6f4'],
  road: ['#a58c66', '#8f7756', '#b89c76'],
  flowers: ['#f2e26a', '#e86e8a', '#f4f4f4', '#b983e0'],
  mountain: ['#5a5664', '#34303c', '#8a8694'],
  hall: ['#3c343c', '#463c44'],
};
const PALETTES: Record<string, Pal> = {
  spring: { ...SUMMER, grass: ['#67a548', '#5b9440', '#7ab754'], flowers: ['#f2e26a', '#f0a0c0', '#ffffff', '#b983e0', '#ffb060'] },
  summer: SUMMER,
  autumn: { ...SUMMER, grass: ['#8d9a44', '#7f8a3c', '#a4a650'], forest: ['#5f6a2c', '#515b26'], hill: ['#8c8a46', '#7a783c'], flowers: ['#e0b040', '#c87040'] },
  winter: { ...SUMMER, mountain: ['#8e919c', '#6e7280', '#b4b8c2'], grass: ['#dfe6ec', '#d2dbe3', '#f0f4f8'], fertile: ['#cfd6dc', '#bec6ce'], forest: ['#c8d4da', '#b8c6cf'], marsh: ['#c4ccd0', '#b6bfc4', '#6f8fa8'], hill: ['#d6dde3', '#c7cfd6'], rock: ['#9b9c98', '#7d7e7a'], sand: ['#e4e0cc', '#d6d2bf'], flowers: [] },
};

/** The pack's patch band for each kind of ground, by season (none in winter: snow). */
const PATCH_OF: Partial<Record<string, Partial<Record<string, Patch>>>> = {
  spring: { grass: 'meadow', forest: 'leaf', marsh: 'teal', hill: 'olive', fertile: 'loam', sand: 'sand', rock: 'peat' },
  summer: { grass: 'meadow', forest: 'leaf', marsh: 'teal', hill: 'olive', fertile: 'loam', sand: 'sand', rock: 'peat' },
  autumn: { grass: 'grass', forest: 'olive', marsh: 'teal', hill: 'grass', fertile: 'loam', sand: 'sand', rock: 'peat' },
};
/** The liches' and vampires' blighted land: olive and peat where the grass and woods would be. */
const BLIGHT_PATCH: Partial<Record<string, Patch>> = { grass: 'olive', forest: 'peat', marsh: 'teal', hill: 'olive', fertile: 'loam', sand: 'sand', rock: 'peat' };
const BLIGHT_FROM: Partial<Record<string, [Patch, number]>> = { grass: ['peat', 0.08], forest: ['peat', 0.34], hill: ['peat', 0.16], marsh: ['peat', 0.3] };
/** Kinds that keep their own base colour under the patches (the patch is a darker spot on them). */
const BASE_OWN: Partial<Record<string, boolean>> = { sand: true, rock: true };
/** Kinds whose plain ground is another band's, darkened: the marsh is dark green with teal pools on it. */
const BASE_FROM: Partial<Record<string, [Patch, number]>> = { marsh: ['leaf', 0.24] };
/** How likely each of a cell's two patch slots is filled. */
const PATCH_SHARE: Partial<Record<string, number>> = { grass: 0.22, forest: 0.4, marsh: 0.45, hill: 0.3, fertile: 0.35, sand: 0.18, rock: 0.25 };

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
export function chunkKey(m: LandMap, cx: number, cy: number, season: string, td: boolean, era: Era = 'neolithic', blight = false): string {
  let s = `${season}|${td ? 1 : 0}|${groundDetailReady() ? 1 : 0}|${blight ? 'b' : ''}|${roadTilesReady() ? ROAD_BY_ERA[era] : ''}|${m.open}|${propImage('sea') ? 's' : ''}|`;
  for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++) {
    const i0 = y * m.w + cx * CHUNK;
    s += m.cells.slice(i0, i0 + CHUNK) + m.roads.slice(i0, i0 + CHUNK);
    // (footpaths, by how worn: a step either side too, since a path reaches toward its neighbours)
    if (m.wear) for (let x = cx * CHUNK - 1; x <= (cx + 1) * CHUNK; x++) s += wornLevel(m, x, y) || wornLevel(m, x, y - 1) || wornLevel(m, x, y + 1);
    s += groundAt(m, cx * CHUNK - 1, y)[0] + groundAt(m, (cx + 1) * CHUNK, y)[0];
  }
  for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) s += groundAt(m, x, cy * CHUNK - 1)[0] + groundAt(m, x, (cy + 1) * CHUNK)[0];
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
export function paintChunk(m: LandMap, cx: number, cy: number, season: string, biome: string, td: TdTiles | null, era: Era = 'neolithic', blight = false): Texture {
  const pal = PALETTES[season] ?? SUMMER;
  const size = CHUNK * CELL;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const seed = (cx * 73 + cy * 151) | 0;
  const pack = groundDetailReady();
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
      } else if (pack && kind !== 'water' && kind !== 'shallows' && (blight && season !== 'winter' ? BLIGHT_PATCH : PATCH_OF[season])?.[kind]) {
        // the pack's ground: a plain colour with its patches, and on the grass its tufts, flowers and pebbles
        const blighted = blight && season !== 'winter';
        const patch = (blighted ? BLIGHT_PATCH : PATCH_OF[season]!)[kind]!;
        const from = blighted ? BLIGHT_FROM[kind] : BASE_FROM[kind];
        const base = BASE_OWN[kind] ? (pal[kind as 'sand' | 'rock'] as [string, string])[0] : from ? groundUnder(from[0], from[1]) : groundUnder(patch);
        rect(px, py, CELL, CELL, base);
        for (let k = 0; k < 2; k++)
          if (hash(seed ^ (71 + k), x, y) < (PATCH_SHARE[kind] ?? 0.3)) {
            const n = Math.floor(hash(seed ^ (81 + k), x, y) * 4);
            const ox = Math.floor(hash(seed ^ (91 + k), x, y) * 12) - 2;
            const oy = Math.floor(hash(seed ^ (101 + k), x, y) * 12) - 2;
            drawPatch(g, patch, n, px + Math.max(0, ox), py + Math.max(0, oy));
          }
        if (kind === 'grass' || kind === 'hill') {
          const r = hash(seed ^ 111, x, y);
          const tx = px + 4 + Math.floor(hash(seed ^ 113, x, y) * 24);
          const ty = py + 4 + Math.floor(hash(seed ^ 115, x, y) * 24);
          if (r < 0.3) drawTuft(g, 'tuft', Math.floor(r * 100), tx, ty);
          else if (r < 0.42 && season !== 'autumn' && !blighted) drawTuft(g, 'flower', Math.floor(r * 100), tx, ty);
          else if (r < 0.48) drawTuft(g, 'pebble', Math.floor(r * 100), tx, ty);
        } else if (kind === 'rock' && hash(seed ^ 117, x, y) < 0.35) drawTuft(g, 'pebble', Math.floor(hash(seed ^ 119, x, y) * 6), px + 6 + Math.floor(hash(seed ^ 121, x, y) * 20), py + 6 + Math.floor(hash(seed ^ 123, x, y) * 20));
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
          case 'mountain':
            // the mountain's mass in relief, snow on its heights, a cliff face at its foot (mountainArt.ts)
            paintMountain(g, m, x, y, px, py, pal.mountain, season === 'winter');
            break;
          case 'hall':
            cell(px, py, pal.hall[0], pal.hall[1], 0.18);
            break;
          case 'shallows': {
            // the shallows: clear water over the sand, the seabed's weed and shells showing through, foam at the strand
            cell(px, py, pal.shallows[0], pal.shallows[1], 0.08);
            const land = (ox: number, oy: number) => !wet(groundAt(m, x + ox, y + oy));
            const sea = propImage('sea');
            if (sea && hash(seed ^ 151, x, y) < 0.7) {
              const frames = propFrames('sea');
              const f = frames[2 + Math.floor(hash(seed ^ 152, x, y) * (frames.length - 2))];
              const k = 0.55 / PROP_FINE;
              const w = Math.round(f[2] * k);
              const h = Math.round(f[3] * k);
              g.globalAlpha = 0.6;
              g.drawImage(sea, f[0], f[1], f[2], f[3], px + 3 + Math.floor(hash(seed ^ 153, x, y) * Math.max(1, CELL - 6 - w)), py + 3 + Math.floor(hash(seed ^ 154, x, y) * Math.max(1, CELL - 6 - h)), w, h);
              g.globalAlpha = 1;
            }
            if (land(0, -1)) rect(px, py, CELL, 3, pal.shallows[2]);
            if (land(0, 1)) rect(px, py + CELL - 3, CELL, 3, pal.shallows[2]);
            if (land(-1, 0)) rect(px, py, 3, CELL, pal.shallows[2]);
            if (land(1, 0)) rect(px + CELL - 3, py, 3, CELL, pal.shallows[2]);
            if (pack && hash(seed ^ 131, x, y) < 0.5) {
              let room = CELL;
              for (let k = 1; k < 4 && groundAt(m, x + k, y) === 'shallows'; k++) room += CELL;
              drawRipple(g, Math.floor(hash(seed ^ 133, x, y) * 3), px + 2, py + 6 + Math.floor(hash(seed ^ 135, x, y) * 18), pal.shallows[2], room - 4);
            }
            break;
          }
          case 'water': {
            cell(px, py, pal.water[0], pal.water[1], 0.05);
            // (lighter where it meets the land, not the shallows)
            const edge = (ox: number, oy: number) => !wet(groundAt(m, x + ox, y + oy));
            if (edge(0, -1)) rect(px, py, CELL, 3, pal.water[1]);
            if (edge(0, 1)) rect(px, py + CELL - 3, CELL, 3, pal.water[1]);
            if (edge(-1, 0)) rect(px, py, 3, CELL, pal.water[1]);
            if (edge(1, 0)) rect(px + CELL - 3, py, 3, CELL, pal.water[1]);
            // the bottom seen through the shallows: weed, shells and stones faint under the water along the shore
            // (the sea's things, so on the coast only; the set's first two, the drowned statues, are left out)
            const sea = biome === 'coast' ? propImage('sea') : null;
            if (sea && hash(seed ^ 141, x, y) < SHALLOWS && (edge(0, -1) || edge(0, 1) || edge(-1, 0) || edge(1, 0))) {
              const frames = propFrames('sea');
              const f = frames[2 + Math.floor(hash(seed ^ 142, x, y) * (frames.length - 2))];
              const k = 0.55 / PROP_FINE;
              const w = Math.round(f[2] * k);
              const h = Math.round(f[3] * k);
              g.globalAlpha = 0.42;
              g.drawImage(sea, f[0], f[1], f[2], f[3], px + 3 + Math.floor(hash(seed ^ 143, x, y) * Math.max(1, CELL - 6 - w)), py + CELL - 4 - h - Math.floor(hash(seed ^ 144, x, y) * 6), w, h);
              g.globalAlpha = 1;
            }
            // (the pack's ripples, in the water's light, where there's open water to the right)
            if (pack && hash(seed ^ 131, x, y) < 0.45) {
              let room = CELL;
              for (let k = 1; k < 4 && !edge(k, 0); k++) room += CELL;
              drawRipple(g, Math.floor(hash(seed ^ 133, x, y) * 3), px + 2, py + 6 + Math.floor(hash(seed ^ 135, x, y) * 18), pal.water[1], room - 4);
            }
            break;
          }
        }
      // the mountain's jagged edge biting into the terrain beside it
      if (kind !== 'mountain' && kind !== 'hall') paintMountainEdge(g, m, x, y, px, py, pal.mountain);
      // a footpath worn by walking: patches of bare earth along it, toward each worn (or road) neighbour
      const worn = wornLevel(m, x, y);
      if (worn && !wet(kind) && roadTilesReady()) {
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
