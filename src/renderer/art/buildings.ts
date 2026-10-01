// Placeholder art for buildings, drawn in code like the terrain. Each is as wide as its tiles; the
// bottom row sits on the layer's ground line. Replaced by LPC building tiles later.

import { TILE } from '../../shared/constants';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { PAL } from './palette';
import { stillImage } from './stills';
import { DECO_HEAD, styled } from './originStyles';
import { mixHex as mix, paint, type Painter, type PixelArt, type Tone } from './pixelArt';

const HIDE = '#a88258';
const HIDE_DARK = '#7c5c3c';
const HIDE_LIGHT = '#c8a276';
const THATCH = '#b89a58';
const THATCH_DARK = '#8a7040';
const CLAY = '#b0704a';
const CLAY_DARK = '#80502f';
const MEAT = '#a8423a';
const GRAIN = '#d8c060';
const BRICK = '#a4543a';
const BRICK_DARK = '#6a3424';
const BRICK_LIGHT = '#bc6a48';

/** How far along a field's crop is (other buildings ignore it). */
export type CropLook = 'fallow' | 'sprout' | 'tall' | 'ripe';

type Draw = (p: Painter, w: number, h: number, stage?: CropLook) => void;

/** Vertical log with a lit edge, and bark on the fine grid: furrows down it, and the odd knot. */
function log(p: Painter, x: number, y: number, w: number, h: number): void {
  p.rect(x, y, w, h, PAL.trunk);
  p.rect(x, y, 1, h, PAL.trunkLight);
  p.rect(x + w - 1, y, 1, h, PAL.trunkDark);
  if (w >= 3) {
    const s = (x * 7 + y * 3) % 5;
    for (let fx = x + 1; fx < x + w - 1; fx += 1.5) {
      // a furrow, broken now and then
      for (let fy = y + ((fx * 3 + s) % 3); fy < y + h - 1; fy += 4.5) p.frect(fx, fy, 0.5, 2.5, PAL.trunkDark);
    }
    p.frect(x + 0.5, y, 0.5, h, mix(PAL.trunkLight, '#ffffff', 0.15)); // (the lit edge's own highlight)
    if (h > 10 && s < 2) p.frect(x + w / 2 - 0.5, y + h * 0.4 + s * 3, 1, 1, PAL.trunkDark);
  }
}

/** Horizontal log: grain along it on the fine grid, and its cut end showing rings. */
function beam(p: Painter, x: number, y: number, w: number, h = 3): void {
  p.rect(x, y, w, h, PAL.trunk);
  p.rect(x, y, w, 1, PAL.trunkLight);
  p.rect(x, y + h - 1, w, 1, PAL.trunkDark);
  if (h >= 3) {
    const s = (x * 5 + y * 11) % 7;
    for (let gx = x + 1 + (s % 3); gx < x + w - 2; gx += 5 + (s % 2)) p.frect(gx, y + h / 2 - 0.25, 2.5, 0.5, PAL.trunkDark);
    p.frect(x, y + 0.5, w, 0.5, mix(PAL.trunkLight, '#ffffff', 0.12));
    // the end grain: a paler disc with a ring
    p.frect(x + w - 1, y + 0.5, 1, h - 1, mix(PAL.trunkLight, '#d8b080', 0.5));
    p.fpx(x + w - 0.5, y + h / 2 - 0.5, PAL.trunkDark);
  }
}

function stones(p: Painter, x0: number, x1: number, y: number): void {
  for (let x = x0; x < x1; x += 5) {
    p.ellipse(x + 2, y, 3, 2.5, PAL.rockDark);
    p.rect(x + 1, y - 2, 2, 1, PAL.rockLight);
    p.frect(x + 0.5, y - 2.5, 1.5, 0.5, PAL.rockTip); // (the glint along the top)
    p.frect(x + 3, y + 1, 1.5, 0.5, mix(PAL.rockDark, '#000000', 0.3));
  }
}

/** A field on the rising ground behind the town: a bank of earth climbing back from the front edge, in `rows` rows
 *  (each drawn by `row` at its baseline y and span, back row first so the nearer rows overlap it). */
function slope(p: Painter, w: number, h: number, rows: number, row: (y: number, x0: number, x1: number, i: number) => void, soil: string = PAL.soil, furrow: string = PAL.soilLight): void {
  const step = 6;
  const top = h - 2 - rows * step;
  // the bank: a little narrower at the top, as it climbs away
  for (let y = top; y < h; y++) {
    const inset = Math.round(((h - y) / (h - top)) * 3);
    p.rect(1 + inset, y, w - 2 - inset * 2, 1, soil);
  }
  for (let i = rows - 1; i >= 0; i--) {
    const y = h - 2 - i * step;
    const inset = Math.round(((h - y) / (h - top)) * 3);
    p.rect(1 + inset, y, w - 2 - inset * 2, 1, furrow);
    row(y, 1 + inset, w - 1 - inset, i);
  }
}

/** A row of grain: shoots, green stalks, or ripe ears. */
function grainRow(p: Painter, x0: number, x1: number, y: number, stage: CropLook): void {
  if (stage === 'fallow') return;
  for (let x = x0 + 2; x < x1 - 1; x += 3) {
    if (stage === 'sprout') p.rect(x, y - 2, 1, 2, PAL.leafLight);
    else if (stage === 'tall') p.rect(x, y - 7, 1, 7, x % 2 ? PAL.leaf : PAL.leafLight);
    else {
      p.rect(x, y - 8, 1, 8, PAL.reed);
      p.rect(x - 1, y - 10, 2, 3, GRAIN);
    }
  }
}

/** A stook: sheaves leaned together to dry. */
function stook(p: Painter, x: number, base: number): void {
  for (let i = 0; i < 7; i++) p.rect(x - 3 + Math.floor(i / 2), base - 1 - i, 7 - i, 1, i % 2 ? GRAIN : '#b8a048');
  p.rect(x, base - 9, 1, 3, THATCH_DARK);
}

/** A fenced paddock (rails on posts) over a floor of grass, mud or straw. */
function paddock(p: Painter, w: number, h: number, floor: 'grass' | 'mud' | 'straw'): void {
  const [base, fleck] = floor === 'mud' ? [PAL.mud, PAL.dirtDark] : floor === 'straw' ? [PAL.dirt, '#d8c070'] : [PAL.grass, PAL.grassLight];
  p.rect(1, h - 5, w - 2, 5, base);
  for (let x = 2; x < w - 2; x += 3) p.rect(x, h - 4 + (x % 2), 2, 1, fleck);
  if (floor === 'mud') for (let x = 6; x < w - 8; x += 13) p.ellipse(x, h - 2, 3, 1, PAL.waterDark);
  // the fence: posts and two rails, along the front
  for (let x = 1; x < w; x += 7) {
    p.rect(x, h - 12, 2, 12, PAL.trunkDark);
    p.px(x, h - 12, PAL.trunkLight);
  }
  for (const y of [h - 10, h - 6]) {
    p.rect(1, y, w - 2, 1, PAL.trunkLight);
    p.rect(1, y + 1, w - 2, 1, PAL.trunk);
  }
}

/** A wooden feed trough. */
function trough(p: Painter, x: number, y: number, w: number): void {
  p.rect(x, y - 3, w, 3, PAL.trunk);
  p.rect(x, y - 3, w, 1, PAL.trunkLight);
  p.rect(x + 1, y - 2, w - 2, 1, GRAIN);
  p.rect(x + 1, y, 1, 2, PAL.trunkDark);
  p.rect(x + w - 2, y, 1, 2, PAL.trunkDark);
}

/** A thatched or hide roof as a triangle from (x0..x1) at base y up to a peak. */
function roof(p: Painter, x0: number, x1: number, base: number, peak: number, color: string, dark: string): void {
  const mid = (x0 + x1) / 2;
  for (let y = peak; y <= base; y++) {
    const half = ((y - peak) / (base - peak)) * (x1 - x0) / 2;
    p.rect(mid - half, y, half, 1, color);
    p.rect(mid, y, half, 1, dark);
    if ((y - peak) % 4 === 0) {
      p.rect(mid - half, y, half * 2, 1, dark);
      // (the course above it catches the light: a fine bright line, and straw ends poking out)
      p.frect(mid - half, y + 1, half * 2, 0.5, mix(color, '#ffffff', 0.18));
      for (let sx = mid - half + 1; sx < mid + half - 1; sx += 2.5) p.frect(sx, y - 0.5, 0.5, 1, (sx * 2) % 3 < 1 ? dark : mix(color, '#ffffff', 0.25));
    }
  }
  // the eaves: a ragged fringe of straw on the fine grid
  for (let sx = x0 + 0.5; sx < x1; sx += 1) p.frect(sx, base + 1, 0.5, ((sx * 7) % 3) / 2 + 0.5, (sx * 3) % 2 < 1 ? dark : color);
}

const ART: Record<string, { h: number; draw: Draw }> = {
  campfire: { h: 30, draw: () => {} }, // animated; see campfireFrames
  stockpile: {
    h: 30,
    draw: (p, w, h) => {
      beam(p, 2, h - 4, w - 4, 4);
      for (let i = 0; i < 4; i++) beam(p, 6, h - 8 - i * 4, 30 - i * 4, 4); // log pile
      p.ellipse(52, h - 9, 12, 6, PAL.rockDark); // stone heap
      p.ellipse(51, h - 10, 10, 5, PAL.rock);
      p.ellipse(48, h - 12, 4, 2, PAL.rockLight);
      for (let i = 0; i < 3; i++) p.rect(70 + i * 6, h - 20, 4, 16, i % 2 ? PAL.reedLight : PAL.reed); // fiber bundles
      p.rect(69, h - 14, 20, 2, PAL.trunkDark);
    },
  },
  lean_to: {
    h: 46,
    draw: (p, w, h) => {
      // A roof of poles and leafy branches leaning from the ground (left) onto a forked post (right).
      const slope = (x: number) => h - 2 - ((x - 4) / (w - 16)) * 38;
      for (let x = 4; x < w - 12; x++) p.rect(x, slope(x), 1, h - slope(x), '#2e2216'); // shade underneath
      log(p, w - 14, h - 44, 3, 44);
      p.rect(w - 16, h - 46, 2, 3, PAL.trunkDark);
      p.rect(w - 11, h - 46, 2, 3, PAL.trunkDark);
      for (let x = 2; x < w - 10; x++) {
        const y = slope(x);
        p.rect(x, y - 2, 1, 3, PAL.trunk); // the poles
        p.rect(x, y - 7 + ((x * 5) % 3), 1, 5, (x >> 2) % 3 ? PAL.leaf : PAL.leafDark); // branches on top
        if (x % 4 === 0) p.rect(x, y - 8, 1, 1, PAL.leafLight);
      }
    },
  },
  hide_tent: {
    h: 58,
    draw: (p, w, h) => {
      roof(p, 8, w - 8, h - 1, 10, HIDE, HIDE_DARK);
      for (const dx of [-8, -3, 3, 8]) p.rect(w / 2 + dx, 2 + Math.abs(dx) / 2, 1, 10, PAL.trunkDark); // poles
      p.rect(w / 2 - 6, h - 20, 12, 20, '#3a2a1c'); // doorway
      p.rect(w / 2 - 7, h - 21, 3, 21, HIDE_LIGHT); // flap
      for (let y = 18; y < h - 4; y += 9) p.rect(w / 2 - 20 + y / 3, y, 6, 1, HIDE_LIGHT);
    },
  },
  longhouse: {
    h: 54,
    draw: (p, w, h) => {
      // A long, low timber hall: log walls under a deep thatched roof that comes down nearly to the ground.
      p.rect(4, h - 20, w - 8, 20, PAL.trunkDark);
      for (let y = h - 19; y < h; y += 4) beam(p, 5, y, w - 10, 3); // stacked log walls
      roof(p, 0, w, h - 16, 6, THATCH, THATCH_DARK);
      for (let x = 3; x < w - 3; x += 5) p.rect(x, h - 17, 2, 2, THATCH_DARK); // ragged eaves
      p.rect(w / 2 - 1, 2, 2, 5, PAL.trunkDark); // ridge pole ends
      p.rect(w / 2 - 6, 3, 1, 4, PAL.trunkDark);
      p.rect(w / 2 + 5, 3, 1, 4, PAL.trunkDark);
      p.rect(w / 2 - 7, h - 14, 14, 14, '#3a2a1c'); // doorway, and a warm glow inside
      p.rect(w / 2 - 4, h - 8, 8, 8, '#6a3a1c');
      p.rect(w / 2 - 8, h - 15, 16, 2, PAL.trunk); // lintel
      p.rect(12, h - 12, 6, 4, '#f0d890'); // smoke-hole windows
      p.rect(w - 18, h - 12, 6, 4, '#f0d890');
      for (const x of [w / 2 - 12, w / 2 + 10]) p.rect(x, h - 22, 2, 22, PAL.trunkLight); // carved door posts
    },
  },
  workbench: {
    h: 32,
    draw: (p, w, h) => {
      beam(p, 4, h - 18, w - 8, 4);
      log(p, 8, h - 14, 3, 14);
      log(p, w - 11, h - 14, 3, 14);
      p.rect(14, h - 22, 8, 4, PAL.rock); // stone hammer head
      p.rect(22, h - 21, 12, 2, PAL.trunkLight);
      p.rect(40, h - 21, 10, 3, PAL.rockDark); // flint cores
      p.rect(44, h - 23, 5, 2, PAL.rockTip);
      p.rect(w - 22, h - 7, 10, 7, PAL.trunk); // stool
    },
  },
  drying_rack: {
    h: 38,
    draw: (p, w, h) => {
      log(p, 3, 4, 3, h - 4);
      log(p, w - 6, 4, 3, h - 4);
      beam(p, 2, 6, w - 4, 3);
      for (let x = 8; x < w - 7; x += 4) p.rect(x, 9, 2, 12 + ((x * 3) % 5), MEAT);
    },
  },
  tanning_rack: {
    h: 42,
    draw: (p, w, h) => {
      log(p, 6, 2, 3, h - 2);
      log(p, w - 9, 2, 3, h - 2);
      beam(p, 4, 4, w - 8, 3);
      beam(p, 4, h - 12, w - 8, 3);
      p.rect(12, 9, w - 24, h - 23, HIDE);
      p.rect(14, 11, w - 28, h - 27, HIDE_LIGHT);
      for (let y = 9; y < h - 14; y += 5) {
        p.px(10, y, PAL.reedLight);
        p.px(w - 11, y, PAL.reedLight);
      }
    },
  },
  kiln: {
    h: 42,
    draw: (p, w, h) => {
      p.ellipse(w / 2, h - 14, w / 2 - 6, 16, CLAY_DARK);
      p.ellipse(w / 2 - 2, h - 16, w / 2 - 10, 13, CLAY);
      p.rect(8, h - 14, w - 16, 14, CLAY);
      p.rect(8, h - 14, w - 16, 2, CLAY_DARK);
      p.ellipse(w / 2, h - 7, 7, 6, '#2a1a12');
      p.ellipse(w / 2, h - 5, 4, 3, PAL.flameOrange);
      p.rect(w / 2 - 3, 4, 6, 10, CLAY_DARK);
      stones(p, 6, w - 6, h - 2);
    },
  },
  hunters_lodge: {
    h: 56,
    draw: (p, w, h) => {
      for (let x = 8; x < w - 8; x += 4) log(p, x, h - 26, 4, 26);
      roof(p, 2, w - 2, h - 24, 6, THATCH, THATCH_DARK);
      p.rect(w / 2 - 7, h - 18, 14, 18, '#3a2a1c');
      for (const s of [-1, 1]) {
        // antlers over the door
        p.rect(w / 2 + s * 3, h - 30, 1, 5, '#e8dcc0');
        p.rect(w / 2 + s * 4, h - 33, 1, 4, '#e8dcc0');
        p.rect(w / 2 + s * 6, h - 32, 1, 3, '#e8dcc0');
      }
      p.rect(14, h - 16, 10, 8, HIDE); // hide hanging on the wall
    },
  },
  storytellers_circle: {
    h: 26,
    draw: (p, w, h) => {
      for (const x of [6, w - 14]) p.rect(x, h - 22, 8, 22, PAL.rock); // standing stones
      for (const x of [6, w - 14]) p.rect(x + 1, h - 22, 3, 22, PAL.rockLight);
      beam(p, 18, h - 6, 22, 4); // log seats
      beam(p, w - 40, h - 6, 22, 4);
      p.ellipse(w / 2, h - 3, 8, 3, PAL.rockDark);
      p.rect(w / 2 - 3, h - 9, 6, 6, PAL.flameOrange);
      p.rect(w / 2 - 1, h - 12, 2, 4, PAL.flameYellow);
    },
  },
  // fields lie on the rising ground behind the town: rows of crops climbing away up the slope, so they show over the
  // roofs in front (see slope())
  herb_garden: {
    h: 40,
    draw: (p, w, h, stage = 'ripe') => {
      slope(p, w, h, 3, (y, x0, x1) => {
        for (let x = x0 + 3; x < x1 - 2; x += 5) {
          if (stage === 'fallow') continue;
          if (stage === 'sprout') {
            p.rect(x, y - 2, 1, 2, PAL.leafLight);
            continue;
          }
          p.disc(x, y - 3, stage === 'tall' ? 2 : 3, PAL.leafLight);
          p.px(x - 1, y - 3, PAL.leaf);
          if (stage === 'ripe') p.px(x, y - 6, x % 2 ? '#c77dc9' : '#e0e0e8');
        }
      });
      for (let x = 2; x < w; x += 8) p.rect(x, h - 10, 2, 10, PAL.trunk); // the fence along the front
      beam(p, 2, h - 8, w - 4, 2);
    },
  },
  garden_plot: {
    h: 40,
    draw: (p, w, h, stage = 'ripe') => {
      slope(p, w, h, 4, (y, x0, x1) => grainRow(p, x0, x1, y, stage));
    },
  },
  open_field: {
    h: 44,
    draw: (p, w, h, stage = 'ripe') => {
      slope(p, w, h, 5, (y, x0, x1) => grainRow(p, x0, x1, y, stage));
      // stooks of sheaves at harvest, a boundary stone at the corner
      if (stage === 'ripe') for (let x = 12; x < w - 8; x += 22) stook(p, x, h - 4);
      p.ellipse(3, h - 3, 3, 2, PAL.rockDark);
      p.px(2, h - 5, PAL.rockLight);
    },
  },
  estate_farm: {
    h: 48,
    draw: (p, w, h, stage = 'ripe') => {
      slope(p, w - 26, h, 5, (y, x0, x1) => grainRow(p, x0, x1, y, stage));
      if (stage === 'ripe') for (let x = 12; x < w - 34; x += 20) stook(p, x, h - 4);
      // the barn at the end, with its hay loft
      const x0 = w - 26;
      p.rect(x0 + 2, h - 22, 22, 22, BRICK);
      for (let y = h - 20; y < h; y += 4) p.rect(x0 + 2, y, 22, 1, BRICK_DARK);
      p.rect(x0 + 2, h - 22, 1, 22, BRICK_LIGHT);
      roof(p, x0, x0 + 26, h - 21, h - 34, THATCH, THATCH_DARK);
      p.rect(x0 + 9, h - 12, 8, 12, PAL.trunkDark); // the doors
      p.rect(x0 + 12, h - 12, 1, 12, PAL.trunk);
      p.rect(x0 + 10, h - 19, 6, 4, '#2a1a10'); // the loft, with hay
      p.rect(x0 + 10, h - 16, 6, 1, GRAIN);
    },
  },
  flax_field: {
    h: 42,
    draw: (p, w, h, stage = 'ripe') => {
      slope(p, w, h, 4, (y, x0, x1) => {
        if (stage === 'fallow') return;
        const tall = stage === 'sprout' ? 2 : stage === 'tall' ? 7 : 9;
        for (let x = x0 + 1; x < x1 - 1; x += 2) {
          const lean = x % 4 === 0 ? 0 : 1;
          p.rect(x, y - tall, 1, tall, stage === 'ripe' ? '#a8a060' : PAL.leafLight);
          // (blue flowers while it grows; golden seed heads when it's ready)
          if (stage === 'tall' && x % 3 === 0) p.rect(x - lean, y - tall - 1, 2, 2, '#6a8ee0');
          if (stage === 'ripe') p.rect(x - lean, y - tall - 1, 2, 2, '#c8a848');
        }
      });
    },
  },
  vegetable_patch: {
    h: 40,
    draw: (p, w, h, stage = 'ripe') => {
      slope(p, w, h, 3, (y, x0, x1, row) => {
        p.rect(x0, y, x1 - x0, 1, PAL.trunk); // (raised beds, edged with boards)
        if (stage === 'fallow') return;
        for (let x = x0 + 4; x < x1 - 3; x += 6) {
          if (stage === 'sprout') {
            p.rect(x, y - 2, 1, 2, PAL.leafLight);
            p.px(x + 1, y - 3, PAL.leafLight);
            continue;
          }
          const big = stage === 'ripe' ? 1 : 0;
          if (row === 0) {
            // cabbages
            p.disc(x, y - 3, 3 + big, PAL.leaf);
            p.disc(x, y - 4, 2 + big, PAL.leafLight);
          } else if (row === 1) {
            // carrots: feathery tops, orange shoulders once ready
            for (const dx of [-1, 0, 1]) p.rect(x + dx, y - 6 + Math.abs(dx), 1, 5, PAL.leafLight);
            if (big) p.rect(x - 1, y - 1, 3, 1, '#e07a2a');
          } else {
            // beans up canes
            p.rect(x, y - 11, 1, 11, PAL.trunkLight);
            for (let k = y - 10; k < y - 1; k += 3) p.rect(x - 1 + ((k / 3) % 2), k, 2, 2, PAL.leaf);
            if (big) p.rect(x + 1, y - 7, 1, 3, '#8ab44a');
          }
        }
      });
    },
  },
  orchard: {
    h: 48,
    draw: (p, w, h, stage = 'ripe') => {
      slope(p, w, h, 2, () => undefined, PAL.grassDark, PAL.grass);
      const trees = Math.max(2, Math.floor(w / 30));
      for (const back of [true, false]) {
        for (let i = 0; i < trees; i++) {
          // (two staggered rows up the slope)
          const x = Math.round(((i + (back ? 0.9 : 0.4)) * w) / (trees + 0.4));
          const base = back ? h - 12 : h - 3;
          if (stage === 'fallow') {
            p.rect(x, base - 7, 1, 7, PAL.trunkLight); // staked out, waiting to be planted
            continue;
          }
          if (stage === 'sprout') {
            // saplings tied to their stakes
            p.rect(x + 2, base - 13, 1, 13, PAL.trunkLight);
            p.rect(x, base - 11, 2, 11, PAL.trunk);
            p.disc(x + 1, base - 13, 4, PAL.leaf);
            p.disc(x, base - 14, 2, PAL.leafLight);
            continue;
          }
          p.rect(x - 1, base - 17, 4, 17, PAL.trunk);
          p.rect(x - 1, base - 17, 1, 17, PAL.trunkLight);
          p.rect(x - 4, base - 19, 3, 2, PAL.trunk); // limbs
          p.rect(x + 3, base - 20, 3, 2, PAL.trunk);
          p.disc(x + 1, base - 25, 10, PAL.leafDark);
          p.disc(x - 1, base - 27, 8, PAL.leaf);
          p.disc(x + 3, base - 28, 5, PAL.leafLight);
          p.px(x - 3, base - 31, PAL.leafTip);
          if (stage === 'ripe')
            for (const [dx, dy] of [[-6, -23], [-2, -28], [4, -24], [7, -27], [0, -20], [-5, -30], [6, -19]]) {
              p.rect(x + dx, base + dy, 2, 2, '#d0402a');
              p.px(x + dx, base + dy, '#f07a5a');
            }
        }
      }
      // a basket of picked fruit
      p.rect(w - 6, h - 5, 5, 4, THATCH_DARK);
      p.rect(w - 6, h - 5, 5, 1, THATCH);
      if (stage === 'ripe') p.rect(w - 5, h - 6, 3, 1, '#d0402a');
    },
  },
  // livestock pens (the animals themselves wander inside: see town/animalsView.ts)
  chicken_coop: {
    h: 30,
    draw: (p, w, h) => {
      paddock(p, w, h, 'straw');
      // a little hen house on legs, with a ramp
      const x0 = w - 30;
      for (const x of [x0 + 2, x0 + 20]) p.rect(x, h - 12, 2, 8, PAL.trunkDark);
      p.rect(x0, h - 22, 24, 11, PAL.trunk);
      for (let y = h - 21; y < h - 11; y += 3) p.rect(x0, y, 24, 1, PAL.trunkDark);
      p.rect(x0 + 1, h - 22, 1, 11, PAL.trunkLight);
      roof(p, x0 - 2, x0 + 26, h - 21, h - 30, THATCH, THATCH_DARK);
      p.rect(x0 + 9, h - 17, 6, 6, '#2a1a10'); // the pop-hole
      for (let i = 0; i < 6; i++) p.rect(x0 + 9 - i * 2, h - 11 + i, 3, 1, PAL.trunkLight); // the ramp
      p.rect(4, h - 4, 6, 2, '#e8e0c8'); // a nest of straw and an egg
      p.rect(6, h - 5, 2, 1, '#f4f0e4');
    },
  },
  goat_pen: {
    h: 26,
    draw: (p, w, h) => {
      paddock(p, w, h, 'grass');
      // a lean-to shelter at the back and a feed rack
      p.rect(w - 26, h - 20, 22, 16, PAL.trunkDark);
      for (let x = w - 26; x < w - 4; x += 4) p.rect(x, h - 20, 3, 16, PAL.trunk);
      beam(p, w - 28, h - 22, 26, 3);
      trough(p, 6, h - 4, 14);
      stones(p, 26, 38, h - 2);
    },
  },
  pig_sty: {
    h: 24,
    draw: (p, w, h) => {
      paddock(p, w, h, 'mud');
      p.rect(w - 30, h - 18, 26, 14, CLAY_DARK);
      for (let x = w - 30; x < w - 4; x += 5) p.rect(x, h - 18, 1, 14, CLAY);
      roof(p, w - 32, w - 2, h - 17, h - 24, THATCH, THATCH_DARK);
      p.rect(w - 21, h - 12, 7, 8, '#2a1a10');
      trough(p, 8, h - 4, 18);
    },
  },
  sheep_fold: {
    h: 26,
    draw: (p, w, h) => {
      // a drystone fold, with a shepherd's hut
      p.rect(2, h - 5, w - 4, 5, PAL.grass);
      for (let x = 3; x < w - 3; x += 2) p.px(x, h - 5 - ((x * 7) % 3 === 0 ? 1 : 0), PAL.grassLight);
      for (let x = 0; x < w; x += 6) {
        p.ellipse(x + 3, h - 3, 3.5, 2.5, PAL.rockDark);
        p.ellipse(x + 3, h - 7, 3, 2.2, PAL.rock);
        p.rect(x + 2, h - 9, 2, 1, PAL.rockLight);
      }
      const x0 = w - 34;
      p.rect(x0, h - 22, 22, 14, PAL.rock);
      for (let y = h - 21; y < h - 8; y += 3) for (let x = x0 + ((y / 3) % 2 ? 0 : 3); x < x0 + 22; x += 6) p.rect(x, y, 5, 2, PAL.rockLight);
      roof(p, x0 - 2, x0 + 24, h - 21, h - 30 + 4, THATCH, THATCH_DARK);
      p.rect(x0 + 8, h - 15, 6, 7, '#2a1a10');
    },
  },
  cattle_pasture: {
    h: 30,
    draw: (p, w, h) => {
      paddock(p, w, h, 'grass');
      // a byre: a long low barn with a hay loft
      const x0 = w - 50;
      p.rect(x0, h - 22, 44, 18, PAL.trunk);
      for (let x = x0; x < x0 + 44; x += 4) p.rect(x, h - 22, 1, 18, PAL.trunkDark);
      p.rect(x0 + 16, h - 16, 12, 12, '#2a1a10');
      p.rect(x0 + 16, h - 16, 12, 1, PAL.trunkLight);
      roof(p, x0 - 3, x0 + 47, h - 21, h - 32 + 4, '#9a3a2a', '#6a2418');
      p.rect(x0 + 19, h - 26, 6, 4, GRAIN); // hay in the loft door
      trough(p, 10, h - 4, 20);
    },
  },
  // a nomad tribe's wagon, drawn up across the camp (and on the road, when the camp moves)
  wagon_circle: {
    h: 34,
    draw: (p, w, h) => {
      p.rect(1, h - 16, w - 2, 7, PAL.trunk); // the bed
      p.rect(1, h - 16, w - 2, 1, PAL.trunkLight);
      p.rect(1, h - 10, w - 2, 1, PAL.trunkDark);
      for (let x = 3; x < w - 3; x += 5) p.rect(x, h - 15, 1, 5, PAL.trunkDark);
      // the canvas hood on its hoops
      p.ellipse(w / 2, h - 16, w / 2 - 2, 14, HIDE_DARK);
      p.ellipse(w / 2, h - 16, w / 2 - 3, 13, HIDE_LIGHT);
      p.rect(2, h - 17, w - 4, 2, HIDE_LIGHT);
      for (const x of [8, 16, 24]) p.rect(x, h - 29, 1, 13, HIDE);
      p.rect(3, h - 20, w - 6, 1, '#b83a2a'); // a painted band
      // wheels
      for (const cx of [7, w - 8]) {
        p.disc(cx, h - 5, 5, PAL.trunkDark);
        p.disc(cx, h - 5, 3, PAL.trunk);
        p.rect(cx - 5, h - 5, 10, 1, PAL.trunkDark);
        p.rect(cx, h - 10, 1, 10, PAL.trunkDark);
        p.disc(cx, h - 5, 1, PAL.trunkLight);
      }
    },
  },
  palisade_wall: {
    h: 62,
    draw: (p, w, h) => {
      for (let x = 1; x < w - 1; x += 6) {
        log(p, x, 6, 6, h - 6);
        for (let i = 0; i < 3; i++) p.rect(x + i, 6 - (3 - i) * 2, 6 - i * 2, 2, PAL.trunkLight); // sharpened tip
      }
      beam(p, 0, 20, w, 3);
      beam(p, 0, h - 16, w, 3);
    },
  },
  palisade_gate: {
    h: 66,
    draw: (p, w, h) => {
      log(p, 1, 2, 8, h - 2);
      log(p, w - 9, 2, 8, h - 2);
      beam(p, 0, 8, w, 5);
      for (let x = 11; x < w - 11; x += 5) log(p, x, 16, 5, h - 16);
      beam(p, 10, 26, w - 20, 3);
      beam(p, 10, h - 14, w - 20, 3);
    },
  },
  lookout: {
    h: 92,
    draw: (p, w, h) => {
      log(p, 8, 30, 4, h - 30);
      log(p, w - 12, 30, 4, h - 30);
      for (let y = 40; y < h; y += 14) p.rect(12, y, w - 24, 2, PAL.trunkDark); // bracing
      for (let y = 34; y < h; y += 6) p.rect(w / 2 - 4, y, 8, 1, PAL.trunkLight); // ladder rungs
      p.rect(w / 2 - 5, 30, 1, h - 30, PAL.trunk);
      p.rect(w / 2 + 4, 30, 1, h - 30, PAL.trunk);
      beam(p, 2, 26, w - 4, 5);
      for (let x = 4; x < w - 4; x += 5) p.rect(x, 16, 2, 10, PAL.trunk); // railing
      roof(p, 2, w - 2, 16, 2, THATCH, THATCH_DARK);
    },
  },
  elder_lodge: {
    h: 66,
    draw: (p, w, h) => {
      for (let x = 10; x < w - 10; x += 5) log(p, x, h - 30, 5, 30);
      roof(p, 0, w, h - 28, 4, THATCH, THATCH_DARK);
      p.rect(w / 2 - 9, h - 22, 18, 22, '#3a2a1c');
      for (const x of [w / 2 - 13, w / 2 + 10]) {
        log(p, x, h - 30, 4, 30); // carved door posts
        for (let y = h - 28; y < h; y += 6) p.rect(x + 1, y, 2, 2, '#c8a060');
      }
      p.rect(w / 2 - 2, 6, 4, 6, '#e8dcc0'); // skull totem at the ridge
    },
  },

  /* ---------------------------------------------------------- Medieval */

  mine: {
    h: 48,
    draw: (p, w, h) => {
      p.ellipse(w / 2, h, w / 2 - 2, 40, PAL.rockDark); // the hillside
      p.ellipse(w / 2 - 4, h - 4, w / 2 - 10, 34, PAL.rock);
      for (let i = 0; i < 12; i++) p.rect(8 + ((i * 29) % (w - 16)), h - 8 - ((i * 13) % 26), 3, 2, i % 3 ? PAL.rockLight : '#9a5a3a'); // ore flecks
      p.rect(w / 2 - 9, h - 22, 18, 22, '#1a1410'); // tunnel
      log(p, w / 2 - 12, h - 24, 3, 24);
      log(p, w / 2 + 9, h - 24, 3, 24);
      beam(p, w / 2 - 13, h - 26, 26, 4);
      for (let x = 4; x < w / 2 - 14; x += 6) p.rect(x, h - 2, 4, 1, PAL.trunkDark); // rail sleepers
      p.rect(8, h - 9, 12, 6, PAL.trunk); // ore cart
      p.rect(9, h - 11, 10, 2, '#8a4a30');
    },
  },
  bloomery: {
    h: 46,
    draw: (p, w, h) => {
      p.ellipse(w / 2, h - 12, 18, 14, CLAY_DARK);
      p.rect(w / 2 - 14, h - 14, 28, 14, CLAY);
      p.rect(w / 2 - 6, 4, 12, h - 20, CLAY_DARK); // stack
      p.rect(w / 2 - 4, 4, 3, h - 20, CLAY);
      p.ellipse(w / 2, h - 6, 5, 5, '#2a1a12');
      p.ellipse(w / 2, h - 5, 3, 3, PAL.flameOrange);
      p.rect(w / 2 - 1, 1, 2, 3, PAL.ash); // smoke
      stones(p, 4, w - 4, h - 2);
    },
  },
  smithy: {
    h: 56,
    draw: (p, w, h) => {
      log(p, 6, h - 34, 4, 34);
      log(p, w - 10, h - 34, 4, 34);
      roof(p, 0, w, h - 32, 8, THATCH, THATCH_DARK);
      p.rect(12, h - 18, 22, 18, PAL.rockDark); // forge
      p.rect(14, h - 20, 18, 3, PAL.rock);
      p.rect(18, h - 14, 10, 6, PAL.flameOrange);
      p.rect(20, h - 12, 6, 3, PAL.flameYellow);
      p.rect(w - 36, h - 10, 14, 4, '#5a5a64'); // anvil
      p.rect(w - 32, h - 6, 6, 6, '#44444c');
      p.rect(w - 34, h - 12, 2, 2, '#9a9aa4');
    },
  },
  sawmill: {
    h: 44,
    draw: (p, w, h) => {
      log(p, 8, h - 30, 4, 30);
      log(p, w - 12, h - 30, 4, 30);
      beam(p, 6, h - 32, w - 12, 4);
      beam(p, 10, h - 16, w - 20, 5); // the log on the bench
      p.disc(w / 2, h - 22, 9, '#8a8a94'); // saw blade
      p.disc(w / 2, h - 22, 3, '#5a5a64');
      for (let i = 0; i < 4; i++) p.rect(w - 30, h - 4 - i * 3, 22, 2, i % 2 ? '#c89a5a' : '#b0844a'); // planks
    },
  },
  tannery: {
    h: 44,
    draw: (p, w, h) => {
      for (const x of [10, 30]) {
        p.ellipse(x, h - 6, 8, 6, PAL.trunkDark); // vats
        p.ellipse(x, h - 9, 7, 2, '#6a5030');
      }
      log(p, w - 42, 6, 3, h - 6);
      log(p, w - 8, 6, 3, h - 6);
      beam(p, w - 44, 8, 40, 3);
      p.rect(w - 38, 12, 12, 20, HIDE);
      p.rect(w - 22, 12, 12, 24, HIDE_DARK);
    },
  },
  loom: {
    h: 40,
    draw: (p, w, h) => {
      log(p, 6, 4, 3, h - 4);
      log(p, w - 9, 4, 3, h - 4);
      beam(p, 4, 6, w - 8, 3);
      beam(p, 4, h - 14, w - 8, 3);
      p.rect(10, 9, w - 20, h - 23, '#c8b8a0'); // cloth on the frame
      for (let x = 12; x < w - 12; x += 3) p.rect(x, 9, 1, h - 23, '#a89878');
      p.rect(10, h - 8, w - 20, 3, PAL.trunk);
    },
  },
  windmill: {
    h: 86,
    draw: (p, w, h) => {
      p.rect(w / 2 - 10, 30, 20, h - 30, '#d8c8a8'); // tower
      p.rect(w / 2 - 10, 30, 3, h - 30, '#b8a888');
      roof(p, w / 2 - 13, w / 2 + 13, 32, 20, THATCH, THATCH_DARK);
      p.rect(w / 2 - 4, h - 14, 8, 14, '#3a2a1c');
      // sails: an X of lattice arms
      for (let i = -24; i <= 24; i++) {
        p.rect(w / 2 + i, 26 + i, 2, 2, PAL.trunkLight);
        p.rect(w / 2 + i, 26 - i, 2, 2, PAL.trunkLight);
        if (i % 3 === 0 && Math.abs(i) > 6) {
          p.rect(w / 2 + i - 2, 26 + i, 4, 1, '#e8dcc0');
          p.rect(w / 2 + i - 2, 26 - i, 4, 1, '#e8dcc0');
        }
      }
      p.disc(w / 2, 26, 3, PAL.trunkDark);
    },
  },
  bakery: {
    h: 56,
    draw: (p, w, h) => {
      bricks(p, 6, h - 32, w - 12, 32);
      roof(p, 2, w - 2, h - 30, 8, '#8a4a34', '#6a3424');
      p.rect(w - 24, 4, 8, 16, '#7a3a2a'); // oven chimney
      p.rect(w / 2 - 12, h - 18, 10, 18, '#3a2a1c');
      p.ellipse(w - 26, h - 10, 8, 7, '#2a1a12'); // oven mouth
      p.ellipse(w - 26, h - 9, 5, 4, PAL.flameOrange);
      for (const x of [14, 22]) p.ellipse(x, h - 22, 3, 2, '#d8a050'); // loaves on the sill
    },
  },
  cottage: {
    h: 58,
    draw: (p, w, h) => {
      p.rect(6, h - 30, w - 12, 30, '#d8c8a8'); // plaster
      for (const x of [6, w / 2 - 1, w - 9]) p.rect(x, h - 30, 3, 30, PAL.trunkDark); // timber frame
      p.rect(6, h - 30, w - 12, 2, PAL.trunkDark);
      p.rect(6, h - 16, w - 12, 2, PAL.trunkDark);
      roof(p, 0, w, h - 28, 6, THATCH, THATCH_DARK);
      p.rect(w / 2 + 6, h - 18, 10, 18, '#3a2a1c');
      p.rect(14, h - 26, 10, 8, '#f0d890'); // lit window
      p.rect(18, h - 26, 1, 8, PAL.trunkDark);
    },
  },
  stone_wall: {
    h: 70,
    draw: (p, w, h) => {
      for (let y = 10; y < h; y += 6) for (let x = (y / 6) % 2 ? 0 : -4; x < w; x += 8) p.rect(x + 1, y, 7, 5, (x + y) % 3 ? PAL.rock : PAL.rockLight);
      for (let x = 0; x < w; x += 10) p.rect(x, 2, 6, 8, PAL.rock); // crenellations
      p.rect(0, h - 3, w, 3, PAL.rockDark);
    },
  },
  stone_gate: {
    h: 76,
    draw: (p, w, h) => {
      // DungeonItemsLite's stone archway, with a timber gate in the opening
      const arch = stillImage('arch');
      if (arch) {
        for (let x = Math.round(w * 0.3); x < w * 0.7; x += 5) log(p, x, Math.round(h * 0.28), 5, h - Math.round(h * 0.28) - 4);
        p.ctx.imageSmoothingEnabled = false;
        p.ctx.drawImage(arch, 160, 200, 704, 640, 0, 0, w, h);
        return;
      }
      for (const x0 of [0, w - 14]) {
        for (let y = 8; y < h; y += 6) p.rect(x0 + 1, y, 12, 5, (y / 6) % 2 ? PAL.rock : PAL.rockLight);
        for (let x = x0; x < x0 + 14; x += 7) p.rect(x, 0, 5, 8, PAL.rock);
      }
      p.rect(14, 16, w - 28, 8, PAL.rockDark); // lintel
      for (let x = 16; x < w - 16; x += 5) log(p, x, 24, 5, h - 24);
      for (let y = 30; y < h; y += 14) p.rect(16, y, w - 32, 2, '#5a5a64'); // iron bands
    },
  },
  watchtower: {
    h: 100,
    draw: (p, w, h) => {
      for (let y = 20; y < h; y += 6) for (let x = (y / 6) % 2 ? 4 : 0; x < w - 8; x += 8) p.rect(x + 5, y, 7, 5, (x + y) % 3 ? PAL.rock : PAL.rockLight);
      p.rect(2, 14, w - 4, 6, PAL.rockDark);
      for (let x = 2; x < w - 2; x += 8) p.rect(x, 4, 5, 10, PAL.rock);
      p.rect(w / 2 - 2, 40, 4, 8, '#1a1410'); // arrow slits
      p.rect(w / 2 - 2, 64, 4, 8, '#1a1410');
      p.rect(w / 2 - 6, h - 16, 12, 16, '#3a2a1c');
    },
  },
  scriptorium: {
    h: 64,
    draw: (p, w, h) => {
      for (let y = h - 36; y < h; y += 6) for (let x = (y / 6) % 2 ? 4 : 0; x < w - 8; x += 8) p.rect(x + 5, y, 7, 5, (x + y) % 3 ? '#8b8680' : '#9d978f');
      roof(p, 0, w, h - 34, 10, '#4a5058', '#383c44'); // slate
      for (const x of [18, 42, 66, 90].filter((x) => x < w - 16)) {
        p.ellipse(x, h - 24, 4, 4, '#f0d890'); // arched windows
        p.rect(x - 4, h - 24, 8, 8, '#f0d890');
      }
      p.rect(w / 2 - 6, h - 14, 12, 14, '#3a2a1c');
    },
  },
  tavern: {
    h: 70,
    draw: (p, w, h) => {
      bricks(p, 6, h - 22, w - 12, 22);
      p.rect(4, h - 44, w - 8, 22, '#d8c8a8'); // upper floor
      for (let x = 4; x < w - 4; x += 16) p.rect(x, h - 44, 3, 22, PAL.trunkDark);
      p.rect(4, h - 44, w - 8, 2, PAL.trunkDark);
      roof(p, 0, w, h - 42, 8, THATCH, THATCH_DARK);
      for (const x of [16, 48, w - 40].filter((x) => x > 10)) p.rect(x, h - 38, 10, 8, '#f0d890');
      p.rect(w / 2 - 7, h - 18, 14, 18, '#3a2a1c');
      beam(p, w - 22, h - 30, 16, 2); // sign
      p.rect(w - 18, h - 28, 10, 8, '#8a5a2a');
      p.ellipse(w - 13, h - 24, 3, 3, '#d8a050'); // a tankard
    },
  },
  infirmary: {
    h: 58,
    draw: (p, w, h) => {
      p.rect(6, h - 30, w - 12, 30, '#e0d8c8');
      for (const x of [6, w / 2 - 1, w - 9]) p.rect(x, h - 30, 3, 30, PAL.trunkDark);
      roof(p, 0, w, h - 28, 8, '#8a4a34', '#6a3424');
      p.rect(w / 2 + 6, h - 18, 12, 18, '#3a2a1c');
      p.rect(16, h - 24, 12, 10, '#f0d890');
      p.disc(w / 2 - 12, h - 34, 4, PAL.leafLight); // herb sign
      p.rect(w / 2 - 13, h - 38, 2, 8, PAL.leaf);
    },
  },
  /* ---------------------------------------------------------- Industrial */

  coal_mine: {
    h: 70,
    draw: (p, w, h) => {
      p.ellipse(w / 2, h, w / 2 - 2, 26, PAL.rockDark);
      p.rect(w / 2 - 8, h - 18, 16, 18, '#141010'); // shaft
      for (const x of [w / 2 - 14, w / 2 + 12]) p.rect(x, 8, 3, h - 16, '#3a3a40'); // headframe
      beam(p, w / 2 - 16, 8, 32, 3);
      p.disc(w / 2, 12, 6, '#5a5a64'); // wheel
      p.disc(w / 2, 12, 2, '#2a2a30');
      p.ellipse(18, h - 6, 12, 6, '#1a1a1a'); // coal heap
    },
  },
  steelworks: {
    h: 84,
    draw: (p, w, h) => {
      bricks(p, 4, h - 40, w - 8, 40);
      p.rect(0, h - 44, w, 4, '#3a3a40');
      for (const x of [16, w - 30]) {
        p.rect(x, 4, 12, h - 44, '#6a3424'); // chimneys
        p.rect(x, 4, 12, 3, '#3a3a40');
      }
      p.ellipse(w / 2, h - 16, 10, 8, '#2a1a12');
      p.ellipse(w / 2, h - 14, 7, 5, PAL.flameOrange); // furnace glow
    },
  },
  glassworks: {
    h: 60,
    draw: (p, w, h) => {
      bricks(p, 6, h - 34, w - 12, 34);
      p.ellipse(w / 2, h - 34, w / 2 - 8, 16, '#6a3424'); // cone kiln
      p.rect(w / 2 - 5, 4, 10, h - 40, '#6a3424');
      for (const x of [14, w - 22]) p.rect(x, h - 24, 8, 10, '#9ad8e8'); // glass panes
    },
  },
  factory: {
    h: 90,
    draw: (p, w, h) => {
      bricks(p, 4, h - 44, w - 8, 44);
      for (let x = 4; x < w - 4; x += 24) roof(p, x, x + 24, h - 44, h - 56, '#4a5058', '#383c44'); // sawtooth roof
      for (let x = 12; x < w - 12; x += 16) p.rect(x, h - 34, 10, 12, '#9ad8e8');
      for (const x of [w - 34, w - 20]) p.rect(x, 2, 10, h - 56, '#6a3424'); // stacks
      p.rect(w / 2 - 8, h - 18, 16, 18, '#2a2a30');
    },
  },
  gunsmith: {
    h: 58,
    draw: (p, w, h) => {
      bricks(p, 6, h - 32, w - 12, 32);
      roof(p, 2, w - 2, h - 30, 8, '#4a5058', '#383c44');
      p.rect(w / 2 - 6, h - 18, 12, 18, '#3a2a1c');
      p.rect(14, h - 26, 20, 3, PAL.trunkDark); // a musket on the wall sign
      p.rect(30, h - 27, 10, 2, '#5a5a64');
    },
  },
  rowhouse: {
    h: 80,
    draw: (p, w, h) => {
      bricks(p, 2, h - 60, w - 4, 60);
      roof(p, 0, w, h - 60, h - 72, '#4a5058', '#383c44');
      for (let x = 8; x < w - 12; x += 16) {
        p.rect(x, h - 50, 8, 10, '#f0d890');
        p.rect(x, h - 30, 8, 10, '#9ad8e8');
      }
      for (let x = 16; x < w - 10; x += 32) p.rect(x, h - 16, 8, 16, '#2a1e14'); // doors
      for (const x of [10, w - 16]) p.rect(x, h - 80, 6, 10, '#6a3424'); // chimneys
    },
  },
  hospital: {
    h: 72,
    draw: (p, w, h) => {
      p.rect(4, h - 50, w - 8, 50, '#e8e0d0');
      roof(p, 0, w, h - 50, h - 64, '#4a5058', '#383c44');
      for (let x = 12; x < w - 12; x += 18) {
        p.rect(x, h - 42, 10, 10, '#9ad8e8');
        p.rect(x, h - 24, 10, 10, '#9ad8e8');
      }
      p.rect(w / 2 - 8, h - 18, 16, 18, '#3a2a1c');
      p.disc(w / 2, h - 56, 4, PAL.leafLight); // (a green herb sign)
    },
  },
  library: {
    h: 72,
    draw: (p, w, h) => {
      for (let y = h - 44; y < h; y += 6) for (let x = (y / 6) % 2 ? 4 : 0; x < w - 8; x += 8) p.rect(x + 5, y, 7, 5, (x + y) % 3 ? '#b8b0a0' : '#c8c0b0');
      roof(p, 0, w, h - 44, h - 64, '#4a5058', '#383c44');
      for (const x of [14, w / 2 - 4, w - 22]) p.rect(x, h - 40, 6, 30, '#d8d0c0'); // columns
      p.rect(w / 2 - 12, h - 16, 24, 16, '#3a2a1c');
    },
  },
  brick_wall: {
    h: 76,
    draw: (p, w, h) => {
      bricks(p, 0, 10, w, h - 10);
      for (let x = 0; x < w; x += 10) p.rect(x, 2, 6, 8, BRICK_DARK);
      p.rect(0, h - 3, w, 3, PAL.rockDark);
    },
  },
  phylactery: {
    h: 36,
    draw: (p, w, h) => {
      p.rect(4, h - 8, w - 8, 8, PAL.rockDark); // pedestal
      p.rect(6, h - 10, w - 12, 2, PAL.rock);
      p.rect(w / 2 - 5, h - 26, 10, 16, '#e8dcc0'); // a bone reliquary
      p.rect(w / 2 - 5, h - 26, 10, 2, '#c8bca0');
      p.disc(w / 2, h - 18, 3, '#6a2a8a'); // the soul within
      p.px(w / 2, h - 18, '#c88ae8');
      p.rect(w / 2 - 1, h - 32, 2, 6, '#e8dcc0');
    },
  },
  resurrection_shrine: {
    h: 60,
    draw: (p, w, h) => {
      p.rect(4, h - 10, w - 8, 10, PAL.rockDark); // plinth
      p.rect(6, h - 12, w - 12, 2, PAL.rock);
      p.rect(w / 2 - 6, 8, 12, h - 20, '#8b8680'); // standing stone
      p.rect(w / 2 - 6, 8, 3, h - 20, '#9d978f');
      p.ellipse(w / 2, 6, 6, 4, '#8b8680');
      p.disc(w / 2, 26, 3, '#8ad8e8'); // a pale glow
      p.px(w / 2, 26, '#e8fcff');
      for (const y of [36, 44]) p.rect(w / 2 - 3, y, 6, 1, '#6a8a98'); // carved runes
    },
  },
  healers_hut: {
    h: 46,
    draw: (p, w, h) => {
      // a low hide hut with a smoke hole, bundles of herbs hung to dry by the door, and a pot on a small fire
      roof(p, 2, w - 10, h - 4, h - 40, HIDE, HIDE_DARK);
      p.rect(w / 2 - 12, h - 16, 9, 12, '#2e2216'); // doorway
      log(p, w / 2 - 14, h - 20, 2, 16);
      beam(p, w / 2 - 16, h - 22, 16, 2);
      for (let i = 0; i < 3; i++) {
        p.rect(w / 2 - 14 + i * 5, h - 20, 1, 3, PAL.trunkDark);
        p.rect(w / 2 - 15 + i * 5, h - 17, 3, 4, i === 1 ? '#8aa65a' : '#6f8c46');
      }
      p.rect(w / 2 + 2, h - 41, 4, 3, '#3a2c20'); // smoke hole
      // the fire and its pot, off to the right
      stones(p, w - 18, w - 4, h - 3);
      p.rect(w - 14, h - 9, 6, 5, '#3a3030');
      p.rect(w - 13, h - 10, 4, 1, '#5a5048');
      p.rect(w - 12, h - 5, 2, 2, '#f29434');
    },
  },
  graveyard: {
    h: 44,
    draw: (p, w, h) => {
      // a bare old tree at the back left
      log(p, 10, h - 40, 4, 34);
      for (const [x, y, len, dir] of [[12, h - 36, 10, -1], [13, h - 30, 12, 1], [12, h - 24, 7, -1]] as const) for (let i = 0; i < len; i++) p.rect(x + dir * i, y - Math.floor(i / 2), 1, 1, PAL.trunkDark);
      // a weathered stone cross at the back right
      p.rect(w - 22, h - 30, 4, 24, PAL.rockDark);
      p.rect(w - 27, h - 25, 14, 4, PAL.rockDark);
      p.rect(w - 22, h - 30, 1, 24, PAL.rockLight);
      p.rect(w - 27, h - 25, 14, 1, PAL.rockLight);
      // mounds of earth, and a low picket fence along the front with a gate in the middle
      for (let x = 20; x < w - 30; x += 16) p.ellipse(x + 6, h - 7, 6, 2, '#5a4430');
      beam(p, 1, h - 12, w / 2 - 10, 2);
      beam(p, w / 2 + 9, h - 12, w / 2 - 10, 2);
      for (let x = 2; x < w - 1; x += 5) {
        if (Math.abs(x - w / 2) < 8) continue;
        p.rect(x, h - 16, 2, 14, '#c8b48a');
        p.rect(x, h - 17, 1, 1, '#e8d8b0');
        p.rect(x + 1, h - 16, 1, 14, '#8a7654');
      }
      log(p, w / 2 - 9, h - 22, 3, 20);
      log(p, w / 2 + 6, h - 22, 3, 20);
      beam(p, w / 2 - 10, h - 24, 20, 3);
    },
  },
  well: {
    h: 40,
    draw: (p, w, h) => {
      p.ellipse(w / 2, h - 6, w / 2 - 2, 6, PAL.rockDark); // stone ring
      p.rect(3, h - 12, w - 6, 8, PAL.rock);
      p.rect(3, h - 12, w - 6, 2, PAL.rockLight);
      log(p, 4, h - 34, 2, 22);
      log(p, w - 6, h - 34, 2, 22);
      beam(p, 2, h - 36, w - 4, 3);
      p.rect(w / 2 - 1, h - 33, 1, 12, '#8a7048'); // rope
      p.rect(w / 2 - 3, h - 22, 6, 5, PAL.trunk); // bucket
    },
  },
  school: {
    h: 56,
    draw: (p, w, h) => {
      p.rect(6, h - 30, w - 12, 30, '#d8c8a8');
      for (const x of [6, w / 3, (2 * w) / 3, w - 9]) p.rect(x, h - 30, 3, 30, PAL.trunkDark);
      roof(p, 0, w, h - 28, 8, '#8a4a34', '#6a3424');
      p.rect(w / 2 - 3, 2, 6, 10, PAL.trunkDark); // bell post
      p.ellipse(w / 2, 10, 3, 3, '#d8a050');
      for (const x of [16, w - 30]) p.rect(x, h - 24, 12, 10, '#f0d890');
      p.rect(w / 2 - 6, h - 18, 12, 18, '#3a2a1c');
    },
  },
  stable: {
    h: 54,
    draw: (p, w, h) => {
      for (let x = 6; x < w - 6; x += 4) log(p, x, h - 28, 4, 28);
      roof(p, 0, w, h - 26, 8, THATCH, THATCH_DARK);
      for (let x = 12; x < w - 20; x += 28) {
        p.rect(x, h - 22, 20, 22, '#2a1e14'); // open stalls
        beam(p, x, h - 12, 20, 2);
      }
      p.rect(w - 18, h - 8, 12, 8, '#c8a860'); // hay
      p.rect(w - 16, h - 10, 8, 2, '#d8c070');
    },
  },
  market: {
    h: 46,
    draw: (p, w, h) => {
      log(p, 4, h - 34, 3, 34);
      log(p, w - 7, h - 34, 3, 34);
      for (let x = 0; x < w; x += 8) p.rect(x, h - 40, 8, 8, (x / 8) % 2 ? '#c84a3a' : '#e8dcc0'); // striped awning
      beam(p, 4, h - 14, w - 8, 4); // counter
      const goods = ['#d8a050', '#8a4a30', '#c8b8a0', '#5a5a64', PAL.leafLight];
      for (let i = 0; i < 7; i++) p.rect(8 + i * 12, h - 20, 8, 6, goods[i % goods.length]);
    },
  },
  trading_post: {
    h: 50,
    draw: (p, w, h) => {
      for (let x = 6; x < w - 6; x += 4) log(p, x, h - 28, 4, 28); // log walls
      roof(p, 2, w - 2, h - 26, 6, THATCH, THATCH_DARK);
      p.rect(w / 2 - 6, h - 20, 12, 20, '#3a2a1c'); // door
      // a striped awning over a trestle of goods, left of the door
      for (let x = 4; x < w / 2 - 8; x += 6) p.rect(x, h - 24, 6, 5, (x / 6) % 2 ? '#c84a3a' : '#e8dcc0');
      beam(p, 6, h - 10, w / 2 - 16, 3);
      const goods = ['#d8a050', '#8a4a30', '#c8b8a0', PAL.leafLight];
      for (let i = 0; i * 7 + 8 < w / 2 - 12; i++) p.rect(8 + i * 7, h - 14, 5, 4, goods[i % goods.length]);
      // a hanging sign with a coin on it
      beam(p, w - 26, h - 30, 18, 2);
      p.rect(w - 22, h - 28, 12, 9, '#8a5a2a');
      p.ellipse(w - 16, h - 24, 3, 3, '#e8c040');
    },
  },
  fireside_inn: {
    h: 52,
    draw: (p, w, h) => {
      stones(p, 4, w - 4, h - 3); // footing
      for (let x = 6; x < w - 6; x += 4) log(p, x, h - 28, 4, 26); // log walls
      roof(p, 0, w, h - 26, 6, THATCH, THATCH_DARK);
      // a stone chimney with smoke, a lit window, the door, and a hanging tankard
      p.rect(w - 20, 4, 8, h - 30, PAL.rockDark);
      p.rect(w - 19, 4, 6, h - 30, PAL.rock);
      p.rect(w - 18, 0, 3, 3, '#b8b0a8');
      p.rect(12, h - 22, 10, 8, '#f0c870');
      p.rect(16, h - 22, 1, 8, PAL.trunkDark);
      p.rect(w / 2 - 5, h - 20, 10, 20, '#3a2a1c');
      beam(p, w / 2 + 8, h - 28, 14, 2);
      p.rect(w / 2 + 12, h - 26, 7, 8, '#c8a050');
      p.rect(w / 2 + 12, h - 26, 7, 2, '#f0f0e0');
    },
  },
  general_store: {
    h: 62,
    draw: (p, w, h) => {
      p.rect(6, h - 36, w - 12, 36, '#d8c8a8'); // plaster
      for (const x of [6, w - 9]) p.rect(x, h - 36, 3, 36, PAL.trunkDark);
      p.rect(6, h - 36, w - 12, 2, PAL.trunkDark);
      roof(p, 0, w, h - 34, 6, THATCH, THATCH_DARK);
      // a long shop window full of goods, and the door
      p.rect(12, h - 26, w / 2 - 6, 14, PAL.trunkDark);
      p.rect(14, h - 24, w / 2 - 10, 10, '#f0d890');
      const goods = ['#8a4a30', '#5a5a64', '#d8a050', '#a4543a', PAL.leafLight, '#c8b8a0'];
      for (let i = 0; i * 7 + 16 < w / 2 + 2; i++) p.rect(16 + i * 7, h - 20, 5, 6, goods[i % goods.length]);
      p.rect(w - 30, h - 20, 12, 20, '#3a2a1c');
      // the sign board over it all
      p.rect(w / 2 - 22, h - 34, 44, 7, '#5a3a22');
      p.rect(w / 2 - 20, h - 33, 40, 5, '#8a5a2a');
      for (let x = w / 2 - 16; x < w / 2 + 16; x += 5) p.rect(x, h - 31, 3, 1, '#e8dcc0');
    },
  },
  emporium: {
    h: 74,
    draw: (p, w, h) => {
      bricks(p, 4, h - 48, w - 8, 48);
      p.rect(2, h - 50, w - 4, 4, BRICK_DARK); // cornice
      p.rect(2, h - 52, w - 4, 2, BRICK_LIGHT);
      // two big glass windows either side of the door, under a striped awning
      for (const x of [10, w / 2 + 12]) {
        p.rect(x, h - 30, w / 2 - 22, 22, '#3a3a40');
        p.rect(x + 2, h - 28, w / 2 - 26, 18, '#a8d8e8');
        p.rect(x + 2, h - 28, w / 2 - 26, 2, '#e0f4fa');
        const goods = ['#d0a020', '#e05a8a', '#9aa0a8', '#d0903a', '#3a8a4a'];
        for (let i = 0; i * 8 + 6 < w / 2 - 26; i++) p.rect(x + 4 + i * 8, h - 16, 6, 6, goods[i % goods.length]);
      }
      for (let x = 6; x < w - 6; x += 8) p.rect(x, h - 38, 8, 6, (x / 8) % 2 ? '#2a6a4a' : '#e8dcc0');
      p.rect(w / 2 - 8, h - 26, 16, 26, '#3a2a1c');
      p.rect(w / 2 - 6, h - 24, 12, 8, '#f0d890');
      // the name across the top, in gold
      p.rect(w / 2 - 30, h - 47, 60, 7, '#2a1a10');
      for (let x = w / 2 - 26; x < w / 2 + 26; x += 5) p.rect(x, h - 45, 3, 3, '#e8c040');
    },
  },
  town_hall: {
    h: 100,
    draw: (p, w, h) => {
      for (let y = h - 46; y < h; y += 6) for (let x = (y / 6) % 2 ? 4 : 0; x < w - 8; x += 8) p.rect(x + 5, y, 7, 5, (x + y) % 3 ? '#8b8680' : '#9d978f');
      roof(p, 0, w, h - 44, 24, '#4a5058', '#383c44');
      // bell tower
      p.rect(w / 2 - 10, 6, 20, 30, '#9d978f');
      roof(p, w / 2 - 13, w / 2 + 13, 8, 0, '#4a5058', '#383c44');
      p.rect(w / 2 - 5, 14, 10, 10, '#1a1410');
      p.ellipse(w / 2, 20, 3, 3, '#d8a050'); // bell
      for (let x = 20; x < w - 20; x += 24) {
        p.ellipse(x, h - 32, 4, 4, '#f0d890');
        p.rect(x - 4, h - 32, 8, 10, '#f0d890');
      }
      p.rect(w / 2 - 9, h - 22, 18, 22, '#3a2a1c');
      p.rect(w / 2 + 14, h - 42, 8, 16, '#3a5ab8'); // banner
      p.rect(w / 2 + 14, h - 30, 8, 4, '#d8a050');
    },
  },
  power_station: {
    h: 104,
    draw: (p, w, h) => {
      bricks(p, 4, h - 50, w - 8, 50);
      roof(p, 0, w * 0.6, h - 50, h - 62, '#4a5058', '#383c44');
      for (const x of [w - 70, w - 44]) {
        // cooling towers: waisted cones
        for (let y = 6; y < h - 50; y++) {
          const t = (y - 6) / (h - 56);
          const half = 11 - 5 * Math.sin(t * Math.PI * 0.9);
          p.rect(x + 12 - half, y, half * 2, 1, (y % 7) ? '#b4b4ae' : '#9a9a94');
        }
      }
      for (let x = 12; x < w * 0.6 - 8; x += 14) p.rect(x, h - 40, 8, 12, '#f8e8a0'); // lit windows
      p.rect(w / 2 - 10, h - 20, 20, 20, '#2a2a30');
      // power lines
      p.rect(w - 14, h - 90, 3, 90, '#3a3a40');
      p.rect(w - 22, h - 88, 19, 2, '#3a3a40');
    },
  },

  /* ---------------------------------------------------------- Modern */

  oil_derrick: {
    h: 84,
    draw: (p, w, h) => {
      // lattice tower
      for (let y = 4; y < h - 6; y += 6) {
        const half = 4 + ((y - 4) / (h - 10)) * (w / 2 - 8);
        p.rect(w / 2 - half, y, half * 2, 1, '#4a4a52');
        p.rect(w / 2 - half, y, 2, 6, '#3a3a40');
        p.rect(w / 2 + half - 2, y, 2, 6, '#3a3a40');
      }
      p.rect(w / 2 - 1, 4, 2, h - 10, '#5a5a64');
      concrete(p, 2, h - 6, w - 4, 6);
      p.ellipse(w - 10, h - 8, 6, 3, '#141010'); // a slick of oil
    },
  },
  refinery: {
    h: 80,
    draw: (p, w, h) => {
      concrete(p, 2, h - 8, w - 4, 8);
      for (const [x, r] of [[20, 14], [52, 12]] as const) {
        p.rect(x - r, h - 36, r * 2, 28, '#c8c8c0'); // tanks
        p.ellipse(x, h - 36, r, 4, '#dcdcd4');
        p.rect(x - r, h - 24, r * 2, 2, '#a8a8a0');
      }
      for (const x of [w - 34, w - 20]) {
        p.rect(x, 6, 6, h - 14, '#8a8a90'); // columns
        p.rect(x - 1, 6, 8, 3, '#6a6a70');
      }
      p.rect(w - 34, 30, 20, 2, '#6a6a70');
      p.disc(w - 17, 3, 3, PAL.flameOrange); // flare
    },
  },
  cement_works: {
    h: 70,
    draw: (p, w, h) => {
      concrete(p, 4, h - 30, w - 8, 30);
      p.rect(8, h - 58, 18, 28, '#b4b4ae'); // silo
      p.ellipse(17, h - 58, 9, 4, '#c8c8c0');
      p.rect(w - 30, 6, 10, h - 36, '#8a8a90'); // stack
      for (let x = w / 2 - 10; x < w / 2 + 14; x += 6) p.rect(x, h - 24, 4, 6, '#3a3a40');
      p.ellipse(w - 14, h - 4, 10, 4, '#b4b4ae'); // a heap of cement
    },
  },
  electronics_plant: {
    h: 64,
    draw: (p, w, h) => {
      concrete(p, 2, h - 44, w - 4, 44);
      p.rect(0, h - 46, w, 3, '#5a5a64');
      for (let x = 8; x < w - 8; x += 12) p.rect(x, h - 36, 9, 14, '#6ab0d8'); // glass band
      p.rect(w / 2 - 10, h - 16, 20, 16, '#2a2a30');
      for (const x of [16, w - 24]) p.rect(x, h - 58, 8, 12, '#8a8a90'); // vents
      p.rect(w / 2 - 8, h - 54, 16, 6, '#3a5ab8'); // sign
      p.px(w / 2 - 3, h - 52, '#8ad8f8');
      p.px(w / 2 + 3, h - 52, '#8ad8f8');
    },
  },
  garage: {
    h: 56,
    draw: (p, w, h) => {
      concrete(p, 2, h - 40, w - 4, 40);
      p.rect(0, h - 42, w, 3, '#5a5a64');
      for (const x of [10, w / 2 + 4]) {
        p.rect(x, h - 30, w / 2 - 14, 30, '#6a6a70'); // roller doors
        for (let y = h - 28; y < h; y += 4) p.rect(x, y, w / 2 - 14, 1, '#5a5a60');
      }
      p.rect(w / 2 - 12, h - 52, 24, 8, '#c84a3a'); // sign
      p.rect(w / 2 - 8, h - 49, 16, 2, '#f0e0c0');
    },
  },
  apartments: {
    h: 110,
    draw: (p, w, h) => {
      concrete(p, 4, 8, w - 8, h - 8);
      p.rect(2, 4, w - 4, 5, '#6a6a70');
      for (let y = 16; y < h - 18; y += 16) for (let x = 12; x < w - 14; x += 14) p.rect(x, y, 8, 10, (x * 7 + y) % 3 ? '#f0d890' : '#6ab0d8');
      p.rect(w / 2 - 8, h - 16, 16, 16, '#2a2a30');
    },
  },
  trauma_center: {
    h: 78,
    draw: (p, w, h) => {
      p.rect(4, h - 60, w - 8, 60, '#e8e8e4');
      p.rect(2, h - 62, w - 4, 3, '#8a8a90');
      for (let y = h - 52; y < h - 20; y += 16) for (let x = 12; x < w - 12; x += 16) p.rect(x, y, 10, 10, '#6ab0d8');
      p.rect(w / 2 - 12, h - 18, 24, 18, '#9ad8e8'); // glass doors
      p.rect(w / 2 - 12, h - 18, 24, 2, '#8a8a90');
      p.rect(w - 26, h - 74, 12, 4, '#d83a3a'); // a red cross
      p.rect(w - 22, h - 78, 4, 12, '#d83a3a');
    },
  },
  radio_tower: {
    h: 120,
    draw: (p, w, h) => {
      for (let y = 6; y < h - 4; y += 8) {
        const half = 2 + ((y - 6) / (h - 10)) * (w / 2 - 4);
        p.rect(w / 2 - half, y, half * 2, 1, '#c84a3a');
        p.rect(w / 2 - half, y, 1, 8, '#8a8a90');
        p.rect(w / 2 + half - 1, y, 1, 8, '#8a8a90');
      }
      p.rect(w / 2 - 1, 0, 2, 6, '#8a8a90');
      p.disc(w / 2, 1, 2, '#ff4a3a'); // warning light
      concrete(p, 2, h - 4, w - 4, 4);
    },
  },
  cinema: {
    h: 70,
    draw: (p, w, h) => {
      concrete(p, 4, h - 50, w - 8, 50);
      p.rect(8, h - 64, w - 16, 16, '#2a2a30'); // marquee
      for (let x = 10; x < w - 10; x += 4) {
        p.px(x, h - 63, '#f8e8a0');
        p.px(x, h - 50, '#f8e8a0');
      }
      p.rect(16, h - 59, w - 32, 5, '#c84a3a');
      for (const x of [12, w - 28]) p.rect(x, h - 40, 16, 22, '#e8d8b0'); // posters
      p.rect(w / 2 - 12, h - 20, 24, 20, '#6a2a3a');
    },
  },
  university: {
    h: 96,
    draw: (p, w, h) => {
      concrete(p, 2, h - 50, w - 4, 50);
      roof(p, w / 2 - 36, w / 2 + 36, h - 50, h - 68, '#b4b4ae', '#9a9a94'); // pediment
      for (let x = w / 2 - 30; x <= w / 2 + 24; x += 12) p.rect(x, h - 48, 6, 40, '#e8e8e4'); // columns
      for (let x = 10; x < w / 2 - 40; x += 14) p.rect(x, h - 40, 8, 12, '#6ab0d8');
      for (let x = w / 2 + 42; x < w - 10; x += 14) p.rect(x, h - 40, 8, 12, '#6ab0d8');
      p.rect(w / 2 - 8, h - 18, 16, 18, '#3a2a1c');
      // clock tower
      p.rect(w - 28, 6, 18, h - 56, '#9a9a94');
      p.disc(w - 19, 18, 5, '#f0f0e8');
      p.rect(w - 19, 14, 1, 4, '#2a2a30');
    },
  },
  concrete_wall: {
    h: 80,
    draw: (p, w, h) => {
      concrete(p, 0, 6, w, h - 6);
      for (let y = 20; y < h; y += 20) p.rect(0, y, w, 1, '#74746e');
      p.rect(0, 2, w, 4, '#5a5a64');
      p.rect(2, 0, 2, 2, '#8a8a90'); // wire
      p.rect(w - 4, 0, 2, 2, '#8a8a90');
    },
  },
  barracks: {
    h: 56,
    draw: (p, w, h) => {
      for (let y = h - 30; y < h; y += 6) for (let x = (y / 6) % 2 ? 4 : 0; x < w - 8; x += 8) p.rect(x + 5, y, 7, 5, (x + y) % 3 ? '#8b8680' : '#9d978f');
      roof(p, 0, w, h - 28, h - 44, '#6a3424', '#4a2418');
      p.rect(w / 2 - 7, h - 18, 14, 18, '#3a2a1c');
      for (const x of [14, w - 22]) p.rect(x, h - 24, 8, 6, '#1a1410'); // barred windows
      // a practice dummy and a weapon rack out front
      p.rect(w - 10, h - 20, 2, 20, PAL.trunk);
      p.rect(w - 14, h - 16, 10, 2, PAL.trunk);
      p.ellipse(w - 9, h - 22, 3, 3, '#c8b890');
      p.rect(4, h - 14, 2, 14, '#8a8a90');
      p.rect(8, h - 14, 2, 14, '#8a8a90');
    },
  },
  spike_trap: {
    h: 14,
    draw: (p, w, h) => {
      p.rect(2, h - 4, w - 4, 4, '#3a2a1c'); // the pit
      for (let x = 4; x < w - 4; x += 5) {
        p.rect(x, h - 12, 2, 9, PAL.trunk);
        p.px(x, h - 13, PAL.trunkLight);
      }
    },
  },
  guard_tower: {
    h: 76,
    draw: (p, w, h) => {
      for (let y = 20; y < h; y += 6) for (let x = (y / 6) % 2 ? 2 : 0; x < w - 4; x += 8) p.rect(x + 3, y, 7, 5, (x + y) % 3 ? '#8b8680' : '#9d978f');
      p.rect(0, 12, w, 8, '#8b8680');
      for (let x = 0; x < w; x += 8) p.rect(x, 6, 5, 6, '#8b8680'); // crenellations
      p.rect(w / 2 - 1, 26, 2, 8, '#1a1410'); // arrow slit
    },
  },
  gun_nest: {
    h: 26,
    draw: (p, w, h) => {
      for (let y = h - 14; y < h; y += 5) for (let x = (y % 2) * 3; x < w; x += 7) p.ellipse(x + 3, y + 2, 4, 2.5, '#b8a070'); // sandbags
      p.rect(w / 2 - 2, h - 20, 4, 6, '#454c56');
      p.rect(w / 2, h - 19, 12, 2, '#2a2a30'); // the barrel
    },
  },
  gun_turret: {
    h: 40,
    draw: (p, w, h) => {
      concrete(p, 2, h - 14, w - 4, 14);
      p.rect(w / 2 - 7, h - 24, 14, 10, '#5a5a64');
      p.rect(w / 2 - 7, h - 24, 14, 2, '#8a8a90');
      p.rect(w / 2 + 6, h - 21, 12, 3, '#2a2a30');
      p.px(w / 2 - 3, h - 20, '#ff4a3a');
    },
  },
  laser_turret: {
    h: 46,
    draw: (p, w, h) => {
      p.rect(w / 2 - 3, h - 20, 6, 20, '#6a7480');
      p.rect(4, h - 4, w - 8, 4, '#454c56');
      p.ellipse(w / 2, h - 26, 8, 7, '#9aa4b0');
      p.rect(w / 2 + 4, h - 28, 12, 3, '#454c56');
      p.rect(w / 2 + 14, h - 28, 2, 3, '#8ad8f8');
      p.ellipse(w / 2 - 1, h - 27, 3, 2, '#8ad8f8');
    },
  },
  cryo_pod: {
    h: 44,
    draw: (p, w, h) => {
      concrete(p, 2, h - 6, w - 4, 6);
      p.rect(w / 2 - 9, h - 40, 18, 34, '#8a94a0');
      p.rect(w / 2 - 7, h - 36, 14, 26, '#bfe8f8'); // frosted window
      p.rect(w / 2 - 7, h - 36, 14, 3, '#e8f8ff');
      p.rect(w / 2 - 3, h - 30, 6, 16, '#8ab8d0'); // the sleeper
      p.px(w / 2 + 6, h - 8, '#4ae080');
    },
  },
  mission_control: {
    h: 96,
    draw: (p, w, h) => {
      concrete(p, 4, h - 46, w - 8, 46);
      for (let x = 12; x < w - 12; x += 12) p.rect(x, h - 38, 8, 10, '#6ab0d8');
      p.rect(w / 2 - 10, h - 20, 20, 20, '#2a2a30');
      // a radar dish on the roof
      p.rect(w - 44, h - 70, 3, 24, '#8a8a90');
      p.ellipse(w - 42, h - 76, 16, 6, '#e8e8e4');
      p.ellipse(w - 42, h - 74, 13, 4, '#b4b4ae');
      p.rect(w - 43, h - 88, 2, 12, '#5a5a64');
      // a scale model rocket
      p.rect(24, h - 80, 8, 34, '#e8e8e4');
      roof(p, 24, 32, h - 80, h - 90, '#c84a3a', '#a83a2a');
    },
  },

  /* ---------------------------------------------------------- Robotic & Space */

  deep_mine: {
    h: 80,
    draw: (p, w, h) => {
      concrete(p, 2, h - 20, w - 4, 20);
      p.rect(w / 2 - 10, h - 18, 20, 18, '#141418');
      for (const x of [w / 2 - 16, w / 2 + 14]) p.rect(x, 4, 3, h - 24, '#6a7480');
      beam(p, w / 2 - 18, 4, 36, 3);
      p.rect(w / 2 - 2, 7, 4, h - 30, '#9aa4b0'); // lift cable
      p.ellipse(16, h - 4, 10, 4, '#7a5aa8'); // heap of glittering ore
      p.px(14, h - 6, '#e0c8ff');
      p.px(19, h - 5, '#e0c8ff');
    },
  },
  alloy_foundry: {
    h: 80,
    draw: (p, w, h) => {
      concrete(p, 2, h - 42, w - 4, 42);
      p.rect(0, h - 44, w, 3, '#454c56');
      for (const x of [14, 30]) p.rect(x, 6, 10, h - 48, '#6a7480');
      p.ellipse(w - 30, h - 20, 14, 10, '#2a1a12');
      p.ellipse(w - 30, h - 18, 10, 6, '#ffd87a'); // white-hot pour
      p.rect(w - 60, h - 30, 12, 4, '#9aa4b0');
    },
  },
  chip_fab: {
    h: 62,
    draw: (p, w, h) => {
      p.rect(2, h - 44, w - 4, 44, '#e8ecf0');
      p.rect(2, h - 44, w - 4, 3, '#9aa4b0');
      for (let x = 10; x < w - 10; x += 14) p.rect(x, h - 34, 10, 8, '#a8d8f0');
      p.rect(w / 2 - 12, h - 20, 24, 20, '#6a7480');
      p.rect(w / 2 - 10, h - 58, 20, 12, '#2a6a4a'); // a giant chip sign
      for (let x = w / 2 - 8; x <= w / 2 + 6; x += 4) p.px(x, h - 47, '#d8c060');
    },
  },
  battery_plant: {
    h: 58,
    draw: (p, w, h) => {
      concrete(p, 2, h - 36, w - 4, 36);
      for (let x = 10; x < w - 10; x += 14) {
        p.rect(x, h - 50, 8, 14, '#4ae080'); // cells charging
        p.rect(x + 2, h - 53, 4, 3, '#9aa4b0');
      }
      p.rect(w / 2 - 8, h - 18, 16, 18, '#2a2a30');
    },
  },
  robot_workshop: {
    h: 64,
    draw: (p, w, h) => {
      concrete(p, 2, h - 44, w - 4, 44);
      p.rect(10, h - 34, w / 2 - 14, 34, '#454c56'); // open bay
      p.rect(22, h - 28, 12, 12, '#6a7480'); // a robot on the bench
      p.rect(25, h - 34, 6, 6, '#9aa4b0');
      p.px(29, h - 32, '#ff4a3a');
      p.rect(w / 2 + 6, h - 40, w / 2 - 18, 3, '#9aa4b0'); // crane arm
      p.rect(w - 16, h - 40, 3, 20, '#9aa4b0');
    },
  },
  drone_hub: {
    h: 70,
    draw: (p, w, h) => {
      p.rect(w / 2 - 3, 16, 6, h - 16, '#6a7480');
      p.rect(4, 14, w - 8, 4, '#9aa4b0'); // landing pad
      p.ellipse(w / 2, 8, 8, 3, '#454c56'); // a drone parked on top
      p.rect(w / 2 - 12, 4, 24, 1, '#9aa4b0');
      p.px(w / 2 + 3, 8, '#8ad8f8');
    },
  },
  habitat_dome: {
    h: 76,
    draw: (p, w, h) => {
      p.ellipse(w / 2, h, w / 2 - 2, 70, '#bfe0ee');
      p.ellipse(w / 2, h, w / 2 - 6, 64, '#d8f0f8');
      for (let x = 20; x < w - 20; x += 22) p.rect(x, h - 28, 14, 28, '#9aa4b0'); // homes inside
      for (let x = 22; x < w - 20; x += 22) p.rect(x + 3, h - 22, 8, 6, '#f0d890');
      p.rect(0, h - 3, w, 3, '#6a7480');
    },
  },
  hydroponics_bay: {
    h: 44,
    draw: (p, w, h, stage) => {
      p.rect(2, h - 30, w - 4, 30, '#bfe0ee'); // glass house
      p.rect(2, h - 30, w - 4, 2, '#9aa4b0');
      for (let x = 2; x < w; x += 16) p.rect(x, h - 30, 2, 30, '#9aa4b0');
      p.rect(4, h - 26, w - 8, 2, '#ff8ad8'); // grow lamps
      const tall = stage === 'ripe' ? 14 : stage === 'tall' ? 10 : stage === 'sprout' ? 4 : 0;
      for (let x = 6; x < w - 6; x += 4) if (tall) p.rect(x, h - 6 - tall, 2, tall, stage === 'ripe' ? GRAIN : PAL.leaf);
      p.rect(4, h - 6, w - 8, 6, '#6a7480'); // trays
    },
  },
  fusion_reactor: {
    h: 84,
    draw: (p, w, h) => {
      concrete(p, 4, h - 40, w - 8, 40);
      p.ellipse(w / 2, h - 40, 30, 30, '#6a7480'); // the torus housing
      p.ellipse(w / 2, h - 40, 24, 24, '#454c56');
      p.ellipse(w / 2, h - 40, 12, 12, '#8ad8f8');
      p.ellipse(w / 2, h - 40, 6, 6, '#e8fcff');
      for (const x of [14, w - 22]) p.rect(x, h - 60, 8, 20, '#9aa4b0');
    },
  },
  shield_generator: {
    h: 64,
    draw: (p, w, h) => {
      concrete(p, 2, h - 8, w - 4, 8);
      p.rect(w / 2 - 4, 16, 8, h - 24, '#6a7480');
      p.ellipse(w / 2, 14, 10, 10, '#8ad8f8');
      p.ellipse(w / 2, 14, 5, 5, '#e8fcff');
      for (const y of [30, 40]) p.rect(w / 2 - 7, y, 14, 2, '#9aa4b0');
    },
  },
  clone_vat: {
    h: 52,
    draw: (p, w, h) => {
      concrete(p, 2, h - 6, w - 4, 6);
      p.rect(8, h - 48, w - 16, 42, '#6a7480');
      p.rect(11, h - 44, w - 22, 36, '#6ae0a0'); // green fluid
      p.rect(w / 2 - 4, h - 38, 8, 22, '#3aa070'); // a shape inside
      p.ellipse(w / 2, h - 40, 4, 4, '#3aa070');
      for (const y of [h - 34, h - 22]) p.px(14, y, '#e8fff0'); // bubbles
    },
  },
  ai_core: {
    h: 64,
    draw: (p, w, h) => {
      concrete(p, 4, h - 44, w - 8, 44);
      for (let x = 10; x < w - 10; x += 8) for (let y = h - 38; y < h - 8; y += 6) p.px(x, y, (x + y) % 3 ? '#4ae080' : '#8ad8f8'); // blinking racks
      p.ellipse(w / 2, h - 52, 10, 10, '#454c56');
      p.ellipse(w / 2, h - 52, 5, 5, '#ff4a3a');
    },
  },
  force_wall: {
    h: 80,
    draw: (p, w, h) => {
      p.rect(0, h - 10, w, 10, '#6a7480');
      p.rect(0, h - 10, w, 2, '#9aa4b0');
      p.rect(2, 6, w - 4, h - 16, '#8ad8f8');
      p.rect(4, 8, w - 8, h - 20, '#bfeefc');
      p.rect(0, 2, w, 4, '#6a7480');
    },
  },
  launch_site: {
    h: 130,
    draw: (p, w, h) => {
      concrete(p, 0, h - 12, w, 12);
      // the gantry
      p.rect(24, 10, 6, h - 22, '#c84a3a');
      for (let y = 16; y < h - 16; y += 12) p.rect(24, y, 26, 2, '#a83a2a');
      // the ship
      const cx = w / 2 + 10;
      p.rect(cx - 12, 30, 24, h - 44, '#e8e8e4');
      p.rect(cx + 8, 30, 4, h - 44, '#b4b4ae');
      roof(p, cx - 12, cx + 12, 30, 4, '#c84a3a', '#a83a2a');
      p.ellipse(cx, 52, 5, 5, '#6ab0d8');
      for (const x of [cx - 20, cx + 12]) p.rect(x, h - 40, 8, 28, '#9aa4b0'); // fins
      p.rect(cx - 8, h - 14, 16, 2, '#454c56');
      // fuel tanks
      for (const x of [w - 40, w - 22]) {
        p.rect(x, h - 44, 14, 32, '#d8d8d0');
        p.ellipse(x + 7, h - 44, 7, 3, '#e8e8e4');
      }
    },
  },
};

/** A poured concrete face with a lit top edge. */
function concrete(p: Painter, x0: number, y0: number, w: number, h: number): void {
  p.rect(x0, y0, w, h, '#9a9a94');
  p.rect(x0, y0, w, 1, '#b4b4ae');
  p.rect(x0 + w - 1, y0, 1, h, '#74746e');
  // (the lines of the forms it was poured in, and a few weather streaks)
  for (let y = y0 + 4; y < y0 + h - 1; y += 5) p.frect(x0, y, w - 1, 0.5, '#8a8a84');
  for (let x = x0 + 3; x < x0 + w - 2; x += 7) p.frect(x, y0 + 1, 0.5, Math.min(h - 2, 3 + (x % 4)), '#86867f');
}

/** A brick wall face. */
function bricks(p: Painter, x0: number, y0: number, w: number, h: number): void {
  p.rect(x0, y0, w, h, BRICK_DARK);
  // (on the fine grid the mortar is a thin line, and each brick has a lit top and a shaded foot)
  for (let y = y0; y < y0 + h; y += 4)
    for (let x = x0 + (((y - y0) / 4) % 2 ? -3 : 0); x < x0 + w; x += 7) {
      const bx = Math.max(x0, x + 0.5);
      const bw = Math.min(6.5, x0 + w - bx);
      if (bw <= 0) continue;
      const c = (x + y) % 5 ? BRICK : BRICK_LIGHT;
      p.frect(bx, y + 0.5, bw, 3.5, c);
      p.frect(bx, y + 0.5, bw, 0.5, mix(c, '#ffffff', 0.18));
      p.frect(bx, y + 3.5, bw, 0.5, mix(c, '#000000', 0.18));
    }
}

/** For a building with no art yet: a plain timber shed. */
const FALLBACK: { h: number; draw: Draw } = {
  h: 40,
  draw: (p, w, h) => {
    for (let x = 4; x < w - 4; x += 4) log(p, x, h - 24, 4, 24);
    roof(p, 0, w, h - 22, 4, THATCH, THATCH_DARK);
  },
};

const cache = new Map<string, PixelArt>();

/** Art for a building (cached per tone, per crop stage for fields, and per origin style: see originStyles.ts). */
export function buildingArt(defId: string, tone: Tone, toneKey: string, stage?: CropLook, style = 'town'): PixelArt {
  const key = `${defId}|${toneKey}|${stage ?? ''}|${style}`;
  let art = cache.get(key);
  if (!art) {
    const def = BUILDING_BY_ID[defId];
    const own = styled(style, defId);
    const spec = own?.draw ? { h: own.h!, draw: own.draw as Draw } : (ART[defId] ?? FALLBACK);
    const w = def.width * TILE;
    // (a dressed building gets headroom for what goes on its roof)
    const head = own?.dress ? DECO_HEAD : 0;
    art = paint(w, spec.h + head, tone, (p) => {
      p.ctx.translate(0, head);
      spec.draw(p, w, spec.h, stage);
      p.reset();
      own?.dress?.(p, w, spec.h + head);
    });
    cache.set(key, art);
  }
  return art;
}
