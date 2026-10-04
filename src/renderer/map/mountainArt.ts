// The dwarves' mountain, painted like a mountain: a relief over the rock mass (smooth noise for the ridges and
// hollows, higher the further in, lit from the north-west, snow on the heights, cracks along the contours), and a
// jagged edge wherever it meets the terrain: a cliff face at its foot whose profile zigzags down into the cell below,
// and rock spurs biting in from the sides. groundArt.ts calls these per cell.
import { CELL, groundAt, type LandMap } from '../../shared/sim/land';
import { hash } from './groundArt';

type Ctx = CanvasRenderingContext2D;

/** Smooth value noise in 0..1 at a point in cell units (bilinear between hashed corners, two octaves). */
function smooth(seed: number, x: number, y: number): number {
  const one = (sx: number, sy: number, s: number) => {
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const fx = (sx - x0) * (sx - x0) * (3 - 2 * (sx - x0));
    const fy = (sy - y0) * (sy - y0) * (3 - 2 * (sy - y0));
    const a = hash(s, x0, y0) + (hash(s, x0 + 1, y0) - hash(s, x0, y0)) * fx;
    const b = hash(s, x0, y0 + 1) + (hash(s, x0 + 1, y0 + 1) - hash(s, x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
  return one(x / 5, y / 5, seed) * 0.6 + one(x / 2.2, y / 2.2, seed ^ 0x55) * 0.3 + one(x / 0.9, y / 0.9, seed ^ 0x99) * 0.1;
}

const SEED = 0x6d74;

/** The mountain's height (0..1) at a point in cell units: ridged noise (sharp crests, soft hollows), rising the further
 *  in from the camp. */
function height(m: LandMap, x: number, y: number): number {
  const rows = Math.max(0, m.camp.y - 3 - y);
  const n = smooth(SEED, x, y);
  const ridge = 1 - Math.abs(2 * n - 1); // (crests where the noise crosses its middle)
  return ridge * 0.55 + smooth(SEED ^ 0x77, x * 0.5, y * 0.5) * 0.15 + Math.min(1, rows / 16) * 0.3;
}

const mix = (a: [number, number, number], b: [number, number, number], t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const SNOW: [number, number, number] = [236, 240, 246];
const SNOW_SHADE: [number, number, number] = [176, 184, 200];

export const isMountain = (m: LandMap, x: number, y: number) => groundAt(m, x, y) === 'mountain';

/** How tall the cliff face at the mountain's foot stands within its cell (px), at a world x: 6 to 12. */
const faceHeight = (x: number, y: number) => 8 + Math.floor(smooth(SEED ^ 0x41, x / 5, y * 3) * 7);

/** How far a spur of the cliff reaches down into the cell below (px): nothing mostly, up to 11 at a buttress. */
function cliffDrop(x: number, y: number): number {
  const t = smooth(SEED ^ 0x31, x / 7, y * 3) * 0.75 + hash(SEED ^ 0x37, x >> 1, y) * 0.25;
  return Math.max(0, Math.floor((t - 0.45) * 20));
}

/** One 2px column of cliff face from `top` to `bottom` (px): lit at the brow, darkening to its foot, a fissure now
 *  and then, a dark line under it. */
function faceColumn(g: Ctx, pal: [string, string, string], px: number, top: number, bottom: number, fissure: boolean): void {
  const light = rgb(pal[2]);
  const base = rgb(pal[0]);
  const h = bottom - top;
  if (h <= 0) return;
  g.fillStyle = '#b4b0bc';
  g.fillRect(px, top, 2, 1);
  for (let yy = 1; yy < h; yy += 2) {
    g.fillStyle = mix(light, base, Math.min(1, (yy / Math.max(1, h)) * 0.55));
    g.fillRect(px, top + yy, 2, Math.min(2, h - yy));
  }
  if (fissure) {
    g.fillStyle = pal[1];
    g.fillRect(px, top + 2, 1, Math.max(1, h - 3));
  }
  g.fillStyle = pal[1];
  g.fillRect(px, bottom - 1, 2, 1);
}

/** Paint a mountain cell: the relief (posterised, lit from the north-west), the snow, the crests, and its cliff face
 *  where the terrain lies below. */
export function paintMountain(g: Ctx, m: LandMap, x: number, y: number, px: number, py: number, pal: [string, string, string], winter: boolean): void {
  const base = rgb(pal[0]);
  const dark = rgb(pal[1]);
  const light = rgb(pal[2]);
  const foot = !isMountain(m, x, y + 1) && groundAt(m, x, y + 1) !== 'hall';
  const B = 4;
  const snowAt = winter ? 0.66 : 0.88;
  const shades = [mix(base, dark, 1), mix(base, dark, 0.5), mix(base, dark, 0), mix(base, light, 0.5), mix(base, light, 1)];
  for (let by = 0; by < CELL; by += B)
    for (let bx = 0; bx < CELL; bx += B) {
      const cx = x + (bx + B / 2) / CELL;
      const cy = y + (by + B / 2) / CELL;
      const h = height(m, cx, cy);
      const slope = height(m, cx + 0.15, cy + 0.15) - h; // (falling to the south-east: shade; rising: lit)
      const lit = Math.max(-1, Math.min(1, -slope * 40));
      let c = shades[Math.max(0, Math.min(4, Math.round(2 + lit * 2)))];
      if (h > snowAt) c = lit >= -0.3 ? mix(SNOW, SNOW_SHADE, 0) : mix(SNOW_SHADE, SNOW, 0);
      else if (h > snowAt - 0.06) c = shades[4]; // (a crest's bare top, just under the snow)
      g.fillStyle = c;
      g.fillRect(px + bx, py + by, B, B);
      // (a crack where the slope breaks)
      if (h <= snowAt && Math.abs(slope) > 0.03 && hash(SEED ^ 0x21, px + bx, py + by) < 0.35) {
        g.fillStyle = pal[1];
        g.fillRect(px + bx, py + by + B - 1, B, 1);
      }
    }
  if (foot) {
    // the cliff face at the foot: each 2px column its own height, so the brow is jagged against the mass above
    for (let sx = 0; sx < CELL; sx += 2) {
      const h = faceHeight(px + sx, y);
      faceColumn(g, pal, px + sx, py + CELL - h, py + CELL, hash(SEED ^ 0x53, px + sx, y) < 0.18);
    }
  }
}

/** The mountain biting into a terrain cell: the cliff's foot zigzagging down from above, spurs from the sides. */
export function paintMountainEdge(g: Ctx, m: LandMap, x: number, y: number, px: number, py: number, pal: [string, string, string]): void {
  if (isMountain(m, x, y - 1)) {
    // the cliff's buttresses reach down past the cell's edge here and there, scree and a fallen boulder below
    for (let sx = 0; sx < CELL; sx += 2) {
      const d = cliffDrop(px + sx, y);
      if (d > 0) faceColumn(g, pal, px + sx, py, py + d, hash(SEED ^ 0x55, px + sx, y) < 0.18);
      else {
        g.fillStyle = pal[1];
        g.fillRect(px + sx, py, 2, 1);
      }
      if (hash(SEED ^ 0x61, px + sx, y) < 0.22) {
        g.fillStyle = pal[0];
        g.fillRect(px + sx, py + d + 1 + Math.floor(hash(SEED ^ 0x63, px + sx, y) * 5), 2, 1);
      }
    }
    if (hash(SEED ^ 0x65, x, y) < 0.3) {
      const bx = px + 4 + Math.floor(hash(SEED ^ 0x67, x, y) * 20);
      const by = py + 10 + Math.floor(hash(SEED ^ 0x69, x, y) * 10);
      g.fillStyle = pal[1];
      g.fillRect(bx, by + 1, 6, 3);
      g.fillStyle = pal[0];
      g.fillRect(bx + 1, by, 4, 3);
      g.fillStyle = pal[2];
      g.fillRect(bx + 1, by, 3, 1);
    }
  }
  for (const side of [-1, 1] as const) {
    if (!isMountain(m, x + side, y)) continue;
    // a spur of dark rock reaching in from the side, its edge jagged, lit along its top
    for (let sy = 0; sy < CELL; sy += 2) {
      const d = 2 + Math.floor((smooth(SEED ^ 0x71, x * 3 + side, (py + sy) / 5) * 0.7 + hash(SEED ^ 0x73, x, py + sy) * 0.3) * 11);
      const x0 = side < 0 ? px : px + CELL - d;
      g.fillStyle = side < 0 ? pal[0] : pal[1];
      g.fillRect(x0, py + sy, d, 2);
      g.fillStyle = pal[2];
      g.fillRect(side < 0 ? px + d - 1 : x0, py + sy, 1, 2);
    }
  }
  if (isMountain(m, x, y + 1)) {
    // (the mountain's back: a dark ragged rim)
    for (let sx = 0; sx < CELL; sx += 2) {
      const d = 2 + Math.floor(smooth(SEED ^ 0x81, (px + sx) / 5, y) * 7);
      g.fillStyle = pal[1];
      g.fillRect(px + sx, py + CELL - d, 2, d);
    }
  }
}
