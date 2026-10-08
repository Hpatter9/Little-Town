// A level of the Deep painted onto one canvas (renderer/deep/deepView.ts lays it under the miners and the cave
// pack's things): the rock in relief like the dwarves' mountain (smooth noise lit from the north-west, in the level's
// own colours), a lit rock face wherever the rock stands over a tunnel, the tunnels' earthen floor with pebbles and
// grit, still water with ripples, the fungus farms' floor glowing faintly, and ore glinting in the rock beside the
// tunnels. Rock nobody has dug next to yet is lost in the dark: only what the tunnels reach is seen. No Pixi here.
import type { Material } from '../../shared/data/materials';
import { DEEP_LEVELS, type DeepCell } from '../../shared/data/deep';

/** A cell's size on the canvas (art px). */
export const TILE = 32;

const hash = (seed: number, x: number, y: number): number => {
  let h = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
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
  return one(x / 4, y / 4, seed) * 0.6 + one(x / 1.6, y / 1.6, seed ^ 0x55) * 0.3 + one(x / 0.7, y / 0.7, seed ^ 0x99) * 0.1;
}
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mix = (a: [number, number, number], b: [number, number, number], t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

/** Each ore's glint in the rock. */
export const ORE_GLINT: Partial<Record<Material, string>> = {
  coal: '#1a1a20',
  copper_ore: '#d07a3a',
  tin_ore: '#c4ccd4',
  clay: '#b07050',
  iron_ore: '#a8705c',
  silver_ore: '#eef2fa',
  sulphur: '#e8d850',
  gold: '#f4c828',
  gems: '#68e0d0',
  rare_minerals: '#c080ff',
};

export const openCell = (c: string) => c === '.' || c === '^' || c === '>' || c === 'f';

export interface LevelPicture {
  depth: number;
  w: number;
  h: number;
  cells: string;
  ores: Record<number, Material>;
}

/** Whether a cell is seen: open, or touching open ground (eight ways). */
export function seenCells(v: LevelPicture): boolean[] {
  const seen = new Array<boolean>(v.cells.length).fill(false);
  for (let i = 0; i < v.cells.length; i++) {
    if (!openCell(v.cells[i])) continue;
    const x = i % v.w;
    const y = Math.floor(i / v.w);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < v.w && ny < v.h) seen[ny * v.w + nx] = true;
      }
  }
  // (a lake is seen whole once any of it is: it is open water)
  let grew = true;
  while (grew) {
    grew = false;
    for (let i = 0; i < v.cells.length; i++) {
      if (seen[i] || v.cells[i] !== '~') continue;
      const x = i % v.w;
      const y = Math.floor(i / v.w);
      if (
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const j = (y + dy) * v.w + (x + dx);
          return x + dx >= 0 && x + dx < v.w && y + dy >= 0 && y + dy < v.h && seen[j] && v.cells[j] === '~';
        })
      ) {
        seen[i] = true;
        grew = true;
      }
    }
  }
  return seen;
}

/** Paint a level (the rock, the tunnels, the water, the ore) onto a canvas `TILE` px a cell. */
export function paintLevel(v: LevelPicture, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = v.w * TILE;
  c.height = v.h * TILE;
  const g = c.getContext('2d')!;
  const look = DEEP_LEVELS[v.depth - 1].look;
  const base = rgb(look.rock[0]);
  const dark = rgb(look.rock[1]);
  const light = rgb(look.rock[2]);
  const floor = rgb(look.floor[0]);
  const speck = rgb(look.floor[1]);
  const seed = 0x3e3 + v.depth * 131;
  const seen = seenCells(v);
  const at = (x: number, y: number): string => (x < 0 || y < 0 || x >= v.w || y >= v.h ? '#' : v.cells[y * v.w + x]);
  const shades = [mix(base, dark, 1), mix(base, dark, 0.55), mix(base, dark, 0.1), mix(base, light, 0.45), mix(base, light, 0.9)];
  const B = 4;
  for (let y = 0; y < v.h; y++)
    for (let x = 0; x < v.w; x++) {
      const i = y * v.w + x;
      const cell = v.cells[i] as DeepCell;
      const px = x * TILE;
      const py = y * TILE;
      if (!seen[i]) {
        // (the dark: rock not yet reached, a faint grain in it)
        g.fillStyle = '#07060a';
        g.fillRect(px, py, TILE, TILE);
        for (let k = 0; k < 6; k++) {
          g.fillStyle = mix([7, 6, 10], dark, 0.35);
          g.fillRect(px + Math.floor(hash(seed ^ 7, i, k) * TILE), py + Math.floor(hash(seed ^ 9, i, k) * TILE), 2, 2);
        }
        continue;
      }
      if (openCell(cell) || cell === '~') {
        // the floor: packed earth in 4px blocks, grit and pebbles
        for (let by = 0; by < TILE; by += B)
          for (let bx = 0; bx < TILE; bx += B) {
            const n = smooth(seed ^ 0x21, x + bx / TILE, y + by / TILE);
            g.fillStyle = mix(floor, speck, n > 0.55 ? 0.7 : n * 0.6);
            g.fillRect(px + bx, py + by, B, B);
          }
        for (let k = 0; k < 7; k++) {
          const qx = px + 2 + Math.floor(hash(seed ^ 0x31, i, k) * (TILE - 5));
          const qy = py + 2 + Math.floor(hash(seed ^ 0x33, i, k) * (TILE - 5));
          g.fillStyle = mix(speck, light, 0.3);
          g.fillRect(qx, qy, 2, 1);
          g.fillStyle = mix(floor, dark, 0.6);
          g.fillRect(qx, qy + 1, 2, 1);
        }
        if (cell === 'f') {
          // (the farmed grotto: spores glowing on the floor)
          const gl = look.glow;
          const col = `rgba(${(gl >> 16) & 255},${(gl >> 8) & 255},${gl & 255},`;
          for (let k = 0; k < 10; k++) {
            g.fillStyle = `${col}${0.35 + hash(seed ^ 0x41, i, k) * 0.4})`;
            g.fillRect(px + Math.floor(hash(seed ^ 0x43, i, k) * TILE), py + Math.floor(hash(seed ^ 0x45, i, k) * TILE), 2, 2);
          }
        }
        if (cell === '~') paintWater(g, v, x, y, px, py, look.glow, seed);
        // (a rock face standing over the floor from the cell above: lit at its brow, darkening down)
        if (!openCell(at(x, y - 1)) && at(x, y - 1) !== '~' && seenCell(seen, v, x, y - 1)) {
          for (let sx = 0; sx < TILE; sx += 2) {
            const h = 6 + Math.floor(smooth(seed ^ 0x51, (px + sx) / 6, y * 3) * 6);
            for (let yy = 0; yy < h; yy += 2) {
              g.fillStyle = mix(light, base, Math.min(1, (yy / h) * 0.8));
              g.fillRect(px + sx, py + yy, 2, 2);
            }
            g.fillStyle = mix(dark, [0, 0, 0], 0.4);
            g.fillRect(px + sx, py + h, 2, 1);
          }
        }
        // (shade along a rock wall on either side)
        for (const side of [-1, 1] as const)
          if (!openCell(at(x + side, y)) && at(x + side, y) !== '~') {
            g.fillStyle = 'rgba(0,0,0,0.28)';
            g.fillRect(side < 0 ? px : px + TILE - 4, py, 4, TILE);
          }
        continue;
      }
      // the rock: relief lit from the north-west
      for (let by = 0; by < TILE; by += B)
        for (let bx = 0; bx < TILE; bx += B) {
          const cx = x + (bx + B / 2) / TILE;
          const cy = y + (by + B / 2) / TILE;
          const hgt = 1 - Math.abs(2 * smooth(seed, cx, cy) - 1);
          const slope = 1 - Math.abs(2 * smooth(seed, cx + 0.15, cy + 0.15) - 1) - hgt;
          const lit = Math.max(-1, Math.min(1, -slope * 30));
          g.fillStyle = shades[Math.max(0, Math.min(4, Math.round(2 + lit * 2)))];
          g.fillRect(px + bx, py + by, B, B);
          if (Math.abs(slope) > 0.04 && hash(seed ^ 0x61, px + bx, py + by) < 0.3) {
            g.fillStyle = look.rock[1];
            g.fillRect(px + bx, py + by + B - 1, B, 1);
          }
        }
      // ore glinting in the rock
      const ore = v.ores[i];
      if (ore) {
        const col = ORE_GLINT[ore] ?? '#ffffff';
        for (let k = 0; k < 7; k++) {
          const qx = px + 3 + Math.floor(hash(seed ^ 0x71, i, k) * (TILE - 7));
          const qy = py + 3 + Math.floor(hash(seed ^ 0x73, i, k) * (TILE - 9));
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(qx + 1, qy + 1, 2, 2);
          g.fillStyle = col;
          g.fillRect(qx, qy, 2, 2);
          if (k % 3 === 0) {
            g.fillStyle = 'rgba(255,255,255,0.7)';
            g.fillRect(qx, qy, 1, 1);
          }
        }
      }
      // (the edge of the seen: fading into the dark beside an unseen cell)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        if (!seenCell(seen, v, x + dx, y + dy)) {
          const grad = g.createLinearGradient(px + (dx > 0 ? TILE : 0), py + (dy > 0 ? TILE : 0), px + (dx > 0 ? TILE - 12 : dx < 0 ? 12 : 0), py + (dy > 0 ? TILE - 12 : dy < 0 ? 12 : 0));
          grad.addColorStop(0, 'rgba(7,6,10,0.9)');
          grad.addColorStop(1, 'rgba(7,6,10,0)');
          g.fillStyle = grad;
          g.fillRect(px, py, TILE, TILE);
        }
    }
  return c;
}

const seenCell = (seen: boolean[], v: LevelPicture, x: number, y: number) => x >= 0 && y >= 0 && x < v.w && y < v.h && seen[y * v.w + x];

/** Still black water: darker at its middle, a lit rim against the floor, a few ripples, the glow of the level in it. */
function paintWater(g: CanvasRenderingContext2D, v: LevelPicture, x: number, y: number, px: number, py: number, glow: number, seed: number): void {
  const water = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < v.w && cy < v.h && v.cells[cy * v.w + cx] === '~';
  // (deep in the middle, a little lighter in slow swells: no seams between the cells)
  for (let by = 0; by < TILE; by += 4)
    for (let bx = 0; bx < TILE; bx += 4) {
      const n = smooth(seed ^ 0x91, x + bx / TILE, y + by / TILE);
      g.fillStyle = n > 0.6 ? '#16303c' : n > 0.4 ? '#10242e' : '#0b1a22';
      g.fillRect(px + bx, py + by, 4, 4);
    }
  const rim = 'rgba(150,200,210,0.55)';
  if (!water(x, y - 1)) {
    g.fillStyle = rim;
    g.fillRect(px, py, TILE, 2);
  }
  if (!water(x - 1, y)) {
    g.fillStyle = rim;
    g.fillRect(px, py, 2, TILE);
  }
  if (!water(x + 1, y)) {
    g.fillStyle = rim;
    g.fillRect(px + TILE - 2, py, 2, TILE);
  }
  if (!water(x, y + 1)) {
    g.fillStyle = 'rgba(150,200,210,0.4)';
    g.fillRect(px, py + TILE - 2, TILE, 2);
  }
  for (let k = 0; k < 3; k++) {
    const rx = px + 4 + Math.floor(hash(seed ^ 0x81, x * 7 + k, y) * (TILE - 14));
    const ry = py + 6 + Math.floor(hash(seed ^ 0x83, x, y * 7 + k) * (TILE - 12));
    g.fillStyle = 'rgba(160,210,220,0.35)';
    g.fillRect(rx, ry, 6, 1);
  }
  const gl = `rgba(${(glow >> 16) & 255},${(glow >> 8) & 255},${glow & 255},0.18)`;
  g.fillStyle = gl;
  g.fillRect(px + 6 + Math.floor(hash(seed ^ 0x85, x, y) * 14), py + 8 + Math.floor(hash(seed ^ 0x87, x, y) * 12), 4, 2);
}
