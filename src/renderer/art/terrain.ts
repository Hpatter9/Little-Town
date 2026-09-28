// The ground itself, painted a tile at a time onto small canvases (one texture per tile): the walkway along the front
// (a rutted dirt road through the town, a worn footpath through the wilds), the midground's strip of land (meadow,
// forest floor, stony ground, marsh), and the grass blades along their edges. Shapes that run from tile to tile (the
// road's edges, its ruts, the path) come from smooth noise along the world's x, so neighbouring tiles meet up.

import { FORE_TOP_Y, STRIP_HEIGHT, TILE } from '../../shared/constants';
import type { MidTerrain } from '../../shared/world';
import { PAL } from './palette';
import { mixHex, noTone, paint, type Painter, type PixelArt } from './pixelArt';

export const FORE_DEPTH = STRIP_HEIGHT - FORE_TOP_Y;
/** Rows above a tile's ground line for grass blades to poke up into. */
export const LIP = 5;
/** The midground band: its top (local y) and how far its art reaches up (blades) and down. */
export const MID_TOP = -8;
const MID_ART_TOP = -14;
const MID_ART_BOTTOM = 2;

/* ------------------------------------------------------------ randomness that repeats */

/** A repeatable pseudo-random number in [0, 1) for integer inputs. */
export function hash(a: number, b = 0, c = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth noise along x in [0, 1) (features about `scale` px apart), continuous from tile to tile. */
export function noise(seed: number, x: number, scale: number): number {
  const t = x / scale;
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return hash(seed, i) * (1 - u) + hash(seed, i + 1) * u;
}

const shadeCache = new Map<string, string>();
/** A colour made darker (k < 0) or lighter (k > 0). */
export function shade(c: string, k: number): string {
  const key = `${c}${k}`;
  let out = shadeCache.get(key);
  if (!out) {
    out = k < 0 ? mixHex(c, '#10141c', -k) : mixHex(c, '#fffbe8', k);
    shadeCache.set(key, out);
  }
  return out;
}

/** Scatter single pixels of two tones over a rectangle (a texture over a flat fill already there). */
function speckle(p: Painter, x0: number, y0: number, w: number, h: number, seed: number, wx: number, dark: string, light: string, density: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const r = hash(seed, wx + x, y);
      if (r < density / 2) p.px(x, y, dark);
      else if (r < density) p.px(x, y, light);
    }
  }
}

/** A row of grass blades standing on `ground` (1px wide, 1 to `tall` high), with light tips. */
function blades(p: Painter, x0: number, w: number, ground: number, seed: number, wx: number, tall: number, thick = 0.7): void {
  for (let x = x0; x < x0 + w; x++) {
    const r = hash(seed, wx + x, 7);
    if (r > thick) continue;
    const h = 1 + Math.floor(hash(seed, wx + x, 8) * tall);
    const col = r < thick * 0.35 ? PAL.grassDark : r < thick * 0.75 ? PAL.grass : PAL.grassLight;
    p.rect(x, ground - h, 1, h, col);
    if (h >= 3) p.px(x, ground - h, PAL.grassTip);
  }
}

/** A pebble: a lit top edge and a shadow. */
function pebble(p: Painter, x: number, y: number, big: boolean): void {
  const w = big ? 3 : 2;
  p.rect(x, y + 1, w, 1, PAL.rockDark);
  p.rect(x, y, w, 1, PAL.rock);
  p.px(x, y, PAL.rockLight);
  if (big) p.px(x + 1, y - 1, PAL.rockTip);
}

/* ------------------------------------------------------------ the walkway */

/**
 * One tile of the walkway (TILE wide, its ground line LIP rows down). Through the town it's a dirt road, worn into ruts,
 * with stones, puddles and a grassy verge; where the land beside it is still wild the grass creeps in. Through the
 * wilds it's a meadow with a footpath trodden across it.
 */
export function foreTileArt(seed: number, c: number, cleared: boolean, leftOpen: boolean, rightOpen: boolean): PixelArt {
  const wx = c * TILE;
  const D = FORE_DEPTH;
  return paint(TILE, D + LIP, noTone, (p) => {
    p.ctx.translate(0, LIP);
    const R = (x: number, y: number, k = 0) => hash(seed ^ 0x5f1 ^ k, wx + x, y);
    // meadow everywhere to begin with: grass, darker lower down, with a speckle of light and dark
    p.rect(0, 0, TILE, D, PAL.grass);
    p.rect(0, D - 6, TILE, 6, shade(PAL.grass, -0.08));
    p.rect(0, D - 2, TILE, 2, PAL.grassDark);
    speckle(p, 0, 0, TILE, D, seed ^ 0x11, wx, PAL.grassDark, PAL.grassLight, 0.2);

    if (cleared) {
      // the road, its edges wavering; the grass creeps in beside wild land
      for (let x = 0; x < TILE; x++) {
        const X = wx + x;
        const creep = Math.max(leftOpen ? 0 : Math.max(0, 6 - x), rightOpen ? 0 : Math.max(0, x - (TILE - 7)));
        const top = 3 + Math.round(noise(seed ^ 0x71, X, 9) * 2) + creep;
        const bot = D - 5 - Math.round(noise(seed ^ 0x72, X, 12) * 2) - creep;
        if (bot <= top) continue;
        p.rect(x, top, 1, bot - top + 1, PAL.dirt);
        p.px(x, top, PAL.dirtDark); // the lip of the verge casts a shadow
        p.px(x, bot + 1, shade(PAL.dirtDark, -0.1));
        // wheel ruts
        for (const ry of [9, 15]) {
          if (ry <= top + 1 || ry >= bot - 1 || noise(seed ^ (ry * 97), X, 6) < 0.3) continue;
          p.px(x, ry, shade(PAL.dirtDark, -0.15));
          p.px(x, ry + 1, PAL.dirtLight);
        }
        // grass tufts hanging over the road's edges
        if (R(x, 0, 3) < 0.45) p.px(x, top, PAL.grassDark);
        if (R(x, 0, 4) < 0.22) p.px(x, top + 1, PAL.grass);
        if (R(x, 1, 5) < 0.35) p.px(x, bot, PAL.grassDark);
        // the texture of packed earth
        for (let y = top + 1; y < bot; y++) {
          const r = R(x, y, 6);
          if (r < 0.07) p.px(x, y, PAL.dirtLight);
          else if (r < 0.15) p.px(x, y, PAL.dirtDark);
          else if (r < 0.17) p.px(x, y, PAL.pebble);
        }
      }
      // stones pressed into the road, and now and then a puddle
      for (let k = 0; k < 4; k++) if (R(k, 99, 7) < 0.7) pebble(p, 3 + Math.floor(R(k, 98, 8) * (TILE - 7)), 6 + Math.floor(R(k, 97, 9) * (D - 14)), R(k, 96, 10) < 0.3);
      if (R(0, 95, 11) < 0.12) {
        const px = 6 + Math.floor(R(0, 94, 12) * 16);
        const py = 11 + Math.floor(R(0, 93, 13) * 5);
        p.ellipse(px, py, 5, 1.6, PAL.waterDark);
        p.ellipse(px, py, 4, 1, PAL.water);
        p.rect(px - 2, py - 1, 2, 1, PAL.waterLight);
      }
      // footprints
      for (let k = 0; k < 3; k++) {
        const fx = Math.floor(R(k, 90, 14) * (TILE - 3));
        const fy = 12 + Math.floor(R(k, 89, 15) * 6);
        p.px(fx, fy, PAL.dirtDark);
        p.px(fx + 2, fy + 1, PAL.dirtDark);
      }
    } else {
      // a footpath trodden through the grass
      for (let x = 0; x < TILE; x++) {
        const X = wx + x;
        const top = 11 + Math.round(noise(seed ^ 0x81, X, 7) * 3);
        const bot = 16 + Math.round(noise(seed ^ 0x82, X, 8) * 3);
        p.rect(x, top, 1, bot - top + 1, PAL.dirt);
        p.px(x, top, PAL.dirtDark);
        if (R(x, 2, 16) < 0.4) p.px(x, top + Math.floor(R(x, 3, 17) * (bot - top)), PAL.grass);
        if (R(x, 4, 18) < 0.15) p.px(x, bot, PAL.dirtLight);
      }
      // the meadow's own detail: taller blades, clover, a flower or two, a stone
      for (let k = 0; k < 14; k++) {
        const x = Math.floor(R(k, 80, 19) * TILE);
        const y = [3, 6, 21, 24][k % 4] + Math.floor(R(k, 79, 20) * 3);
        const h = 2 + Math.floor(R(k, 78, 21) * 3);
        p.rect(x, y - h, 1, h, R(k, 77, 22) < 0.5 ? PAL.grassDark : PAL.grassLight);
      }
      for (let k = 0; k < 3; k++) {
        const x = Math.floor(R(k, 70, 23) * (TILE - 2));
        const y = R(k, 69, 24) < 0.5 ? 4 + Math.floor(R(k, 68, 25) * 4) : 20 + Math.floor(R(k, 67, 26) * 4);
        p.px(x, y, PAL.flowers[k % PAL.flowers.length]);
        p.px(x, y + 1, PAL.grassDark);
      }
      if (R(0, 60, 27) < 0.35) pebble(p, Math.floor(R(0, 59, 28) * (TILE - 4)), 22 + Math.floor(R(0, 58, 29) * 3), true);
    }
    // the ragged top edge: blades along the ground line
    blades(p, 0, TILE, 1, seed ^ 0x33, wx, LIP - 1, cleared ? 0.55 : 0.8);
    p.ctx.setTransform(1, 0, 0, 1, 0, 0);
  });
}

/* ------------------------------------------------------------ the midground's strip of land */

/** One tile of the midground band (scenery on top of it is placed separately). `wasForest`: cleared forest, stumps. */
export function midTileArt(seed: number, c: number, kind: MidTerrain): PixelArt {
  const wx = c * TILE;
  const top = MID_TOP - MID_ART_TOP; // the band's top row in the art
  const h = MID_ART_BOTTOM - MID_ART_TOP;
  return paint(TILE, h, noTone, (p) => {
    const R = (x: number, y: number, k = 0) => hash(seed ^ 0x3c7 ^ k, wx + x, y);
    const band = (body: string, edge: string) => {
      p.rect(0, top, TILE, h - top, body);
      p.rect(0, top, TILE, 2, edge);
      p.rect(0, h - 3, TILE, 3, shade(body, -0.18)); // shadow where the walkway's verge meets it
    };
    switch (kind) {
      case 'clear':
      case 'hill':
        band(PAL.grass, PAL.grassLight);
        speckle(p, 0, top + 2, TILE, h - top - 2, seed ^ 0x21, wx, PAL.grassDark, PAL.grassLight, 0.22);
        blades(p, 0, TILE, top + 1, seed ^ 0x41, wx, 4, 0.6);
        break;
      case 'forest': {
        band(shade(PAL.grassDark, -0.05), PAL.grass);
        // leaf litter, twigs and roots on the forest floor
        speckle(p, 0, top + 2, TILE, h - top - 2, seed ^ 0x22, wx, PAL.trunkDark, PAL.leafLight, 0.2);
        for (let k = 0; k < 4; k++) {
          const x = Math.floor(R(k, 50, 1) * (TILE - 6));
          const y = top + 3 + Math.floor(R(k, 51, 2) * 4);
          p.rect(x, y, 3 + Math.floor(R(k, 52, 3) * 4), 1, PAL.trunk);
        }
        blades(p, 0, TILE, top + 1, seed ^ 0x42, wx, 3, 0.45);
        break;
      }
      case 'rock': {
        band(PAL.rock, PAL.rockLight);
        // cobbles and gravel, lit from the top left
        for (let k = 0; k < 7; k++) {
          const x = Math.floor(R(k, 30, 1) * (TILE - 4));
          const y = top + 2 + Math.floor(R(k, 31, 2) * (h - top - 5));
          const w = 3 + Math.floor(R(k, 32, 3) * 4);
          p.ellipse(x + w / 2, y + 1, w / 2, 1.5, PAL.rockDark);
          p.rect(x + 1, y, w - 2, 1, PAL.rockLight);
        }
        speckle(p, 0, top + 2, TILE, h - top - 2, seed ^ 0x23, wx, PAL.rockDark, PAL.rockTip, 0.14);
        for (let x = 0; x < TILE; x++) if (R(x, 3, 4) < 0.25) p.px(x, top - 1, PAL.moss);
        break;
      }
      case 'marsh': {
        band(PAL.mud, PAL.marsh);
        speckle(p, 0, top + 2, TILE, h - top - 2, seed ^ 0x24, wx, shade(PAL.mud, -0.2), PAL.marsh, 0.18);
        // pools of standing water, with the sky in them
        for (let k = 0; k < 2; k++) {
          if (R(k, 20, 5) < 0.3) continue;
          const x = 3 + Math.floor(R(k, 21, 6) * 18);
          const y = top + 3 + Math.floor(R(k, 22, 7) * 3);
          const w = 6 + Math.floor(R(k, 23, 8) * 8);
          p.rect(x, y, w, 2, PAL.waterDark);
          p.rect(x + 1, y, w - 2, 1, PAL.water);
          p.rect(x + 2, y, 2, 1, PAL.waterLight);
        }
        blades(p, 0, TILE, top + 1, seed ^ 0x43, wx, 3, 0.5);
        break;
      }
    }
  });
}

/** Where a midground tile's art goes: its bottom row sits at this local y. */
export const MID_ART_BASE = MID_ART_BOTTOM;
