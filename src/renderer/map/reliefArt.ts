// The land's hills and mountains on the map (sim/relief.ts), painted into the ground's chunks (map/groundArt.ts) in a
// block of their own: the downs and the rocky hills shaded as they rise and fall (lit from the north-west, as the
// mountain is), the high ground lit along its brow, its cliffs the Undead pack's jagged rock face (art/under/cliff.png)
// hanging below its southern edge and a dark rim on the others, its ramps cut as steps; a tunnel's mouths the Rocky
// Area pack's cave entrance. The outcrops among the rocky hills are the Rocks pack's boulders, stood on the land as
// props (map/mapView.ts), their cells painted as rocky ground (`paintLand`). A land with no relief draws as it did.

import { biomeById } from '../../shared/data/biomes';
import { CELL, groundAt, isRoad, type LandMap } from '../../shared/sim/land';
import { DOWNS, HIGH, RAMP, RANGE, ROCKY, isHigh } from '../../shared/sim/relief';
import { armsOf, E, maskOf, pieceOf, W } from '../art/autotile';
import { loadImage } from '../art/loadImage';
import { faceColumn, faceHeight } from './mountainArt';
import cliffUrl from '../art/under/cliff.png';
import mouthUrl from '../art/relief/cave_mouth.png';
import moss3 from '../art/relief/rock_moss3.png';
import moss4 from '../art/relief/rock_moss4.png';
import moss5 from '../art/relief/rock_moss5.png';
import slate3 from '../art/relief/rock_slate3.png';
import slate4 from '../art/relief/rock_slate4.png';
import slate5 from '../art/relief/rock_slate5.png';
import desert3 from '../art/relief/rock_desert3.png';
import desert4 from '../art/relief/rock_desert4.png';
import desert5 from '../art/relief/rock_desert5.png';
import snow3 from '../art/relief/rock_snow3.png';
import snow4 from '../art/relief/rock_snow4.png';
import snow5 from '../art/relief/rock_snow5.png';
import grey3 from '../art/relief/rock_grey3.png';
import grey4 from '../art/relief/rock_grey4.png';
import grey5 from '../art/relief/rock_grey5.png';
import canyon3 from '../art/relief/rock_canyon3.png';
import canyon4 from '../art/relief/rock_canyon4.png';
import canyon5 from '../art/relief/rock_canyon5.png';

/** The Rocks pack's boulders for each land's look (big, middling, small), and the scale each is drawn at (the big
 *  and middling halved, the small as it is: whole pixels either way). */
export const OUTCROP_ROCKS: Readonly<Record<string, readonly string[]>> = {
  green: [moss3, moss4, moss5],
  fen: [moss3, moss4, moss5],
  jungle: [moss3, moss4, moss5],
  crag: [slate3, slate4, slate5],
  sand: [desert3, desert4, desert5],
  ash: [canyon3, canyon4, canyon5],
  steppe: [grey3, grey4, grey5],
  taiga: [snow3, snow4, snow5],
};
export const OUTCROP_SCALE = [0.5, 0.5, 1];
/** The snow's rocks in winter, and in the cold lands always. */
export const outcropSet = (biome: string, season: string) => (season === 'winter' || biomeById(biome).cold ? OUTCROP_ROCKS.taiga : (OUTCROP_ROCKS[biomeById(biome).look] ?? OUTCROP_ROCKS.green));

const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;
/** Load the cliff face and the cave mouth (the boulders load as the map's props, mapView.ts). */
export function loadReliefArt(): Promise<void> {
  if (!loading) loading = Promise.all([cliffUrl, mouthUrl].map((u) => loadImage(u).then((im) => images.set(u, im), () => undefined))).then(() => undefined);
  return loading;
}
export const reliefArtReady = () => images.size === 2;

/** Whether a cell is an outcrop: solid rock standing among the rocky hills. */
export const isOutcrop = (m: Pick<LandMap, 'relief' | 'cells' | 'w'>, i: number) => !!m.relief && m.relief[i] === ROCKY && m.cells[i] === 'M';

/** The land as the ground's chunks paint it: an outcrop's cell as rocky ground (its boulder stands on it as a prop),
 *  so the mountain's mass and its jagged edges are kept for the ranges. Kept while the land's cells are the same. */
const painted = new WeakMap<LandMap, { cells: string; land: LandMap }>();
export function paintLand(m: LandMap): LandMap {
  if (!m.relief) return m;
  const had = painted.get(m);
  if (had && had.cells === m.cells) return { ...had.land, roads: m.roads, wear: m.wear, open: m.open, version: m.version, marked: m.marked, plannedRoads: m.plannedRoads };
  let cells = '';
  for (let i = 0; i < m.cells.length; i += 4096) {
    let part = m.cells.slice(i, i + 4096);
    if (part.includes('M')) part = [...part].map((c, k) => (c === 'M' && m.relief![i + k] === ROCKY ? 'r' : c)).join('');
    cells += part;
  }
  const land = { ...m, cells };
  painted.set(m, { cells: m.cells, land });
  return land;
}

/** What of the relief a chunk shows, for its key: its cells' and the ring of cells round it. */
export function reliefKey(m: LandMap, x0: number, y0: number, size: number): string {
  if (!m.relief) return '';
  let s = `${reliefArtReady() ? 1 : 0}`;
  for (let y = y0 - 1; y <= y0 + size; y++) {
    if (y < 0 || y >= m.h) continue;
    const a = Math.max(0, x0 - 1);
    s += m.relief.slice(y * m.w + a, y * m.w + Math.min(m.w, x0 + size + 1));
  }
  return s;
}

const at = (m: LandMap, x: number, y: number) => (m.relief && x >= 0 && y >= 0 && x < m.w && y < m.h ? m.relief[y * m.w + x] : '0');
/** How high a cell lies, for the shading (the high ground highest; the rock of a range and an outcrop higher still). */
const rise = (c: string) => (c === DOWNS ? 1 : c === ROCKY ? 1.4 : c === HIGH || c === RAMP ? 2.2 : c === RANGE ? 3 : 0);
/** The lie of the land at a world point (px): the cells' rise blended between their middles, and in hill country a
 *  swell and dip of its own (a smooth noise), so the downs roll rather than sit flat between their edges. */
function heightAt(m: LandMap, wx: number, wy: number, hash: (seed: number, x: number, y: number) => number): number {
  const fx = wx / CELL - 0.5;
  const fy = wy / CELL - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const r = (x: number, y: number) => rise(at(m, x, y));
  const a = r(x0, y0) + (r(x0 + 1, y0) - r(x0, y0)) * tx;
  const b = r(x0, y0 + 1) + (r(x0 + 1, y0 + 1) - r(x0, y0 + 1)) * tx;
  const base = a + (b - a) * ty;
  if (base <= 0) return 0;
  // (the swell: a value noise a few cells across, only where the ground is hilly, and more so the hillier)
  const S = 2.5 * CELL;
  const nx = wx / S;
  const ny = wy / S;
  const ix = Math.floor(nx);
  const iy = Math.floor(ny);
  const sx = nx - ix;
  const sy = ny - iy;
  const ux = sx * sx * (3 - 2 * sx);
  const uy = sy * sy * (3 - 2 * sy);
  const p = hash(83, ix, iy) + (hash(83, ix + 1, iy) - hash(83, ix, iy)) * ux;
  const q = hash(83, ix, iy + 1) + (hash(83, ix + 1, iy + 1) - hash(83, ix, iy + 1)) * ux;
  return base + (p + (q - p) * uy) * Math.min(1, base) * 1.1;
}

/** A cell's relief, painted over its ground (before the footpaths and roads). */
export function paintRelief(g: CanvasRenderingContext2D, m: LandMap, x: number, y: number, px: number, py: number, hash: (seed: number, x: number, y: number) => number, rock: [string, string, string]): void {
  if (!m.relief) return;
  const c = at(m, x, y);
  const kind = groundAt(m, x, y);
  if (kind === 'water' || kind === 'shallows' || kind === 'mountain') return;
  // the hills' rise and fall: the slopes facing the north-west lit, those facing the south-east in shade, in 4px blocks
  // so the swell shades smoothly across the cell
  const hilly = c !== '0' || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(m, x + dx, y + dy) !== '0');
  if (hilly) {
    // (each form's own cast over its ground: the downs' sunlit grass, the rocky hills' grey, the high ground's light)
    const cast = c === DOWNS ? 'rgba(255, 238, 180, 0.08)' : c === ROCKY ? 'rgba(110, 104, 112, 0.12)' : isHigh(c) ? 'rgba(255, 244, 214, 0.1)' : '';
    if (cast) {
      g.fillStyle = cast;
      g.fillRect(px, py, CELL, CELL);
    }
    for (let by = 0; by < CELL; by += 4)
      for (let bx = 0; bx < CELL; bx += 4) {
        const wx = x * CELL + bx + 2;
        const wy = y * CELL + by + 2;
        const h0 = heightAt(m, wx, wy, hash);
        const sx = heightAt(m, wx + 4, wy, hash) - h0;
        const sy = heightAt(m, wx, wy + 4, hash) - h0;
        // (light from the north-west: ground rising toward the south-east faces it)
        const lit = (sx + sy) * 4;
        if (Math.abs(lit) < 0.05) continue;
        g.fillStyle = lit > 0 ? `rgba(255, 246, 214, ${Math.min(0.24, lit * 0.3).toFixed(3)})` : `rgba(18, 22, 40, ${Math.min(0.3, -lit * 0.38).toFixed(3)})`;
        g.fillRect(px + bx, py + by, 4, 4);
      }
    // (the rocky hills: grey stones in the grass)
    if (c === ROCKY)
      for (let k = 0; k < 3; k++) {
        if (hash(71 + k, x, y) > 0.55) continue;
        const sx = px + 3 + Math.floor(hash(73 + k, x, y) * (CELL - 8));
        const sy = py + 3 + Math.floor(hash(75 + k, x, y) * (CELL - 8));
        g.fillStyle = '#6e6a72';
        g.fillRect(sx, sy, 4, 3);
        g.fillStyle = '#9a96a0';
        g.fillRect(sx, sy, 3, 1);
        g.fillStyle = 'rgba(20, 18, 30, 0.35)';
        g.fillRect(sx, sy + 3, 4, 1);
      }
  }
  const high = isHigh(c);
  const road = isRoad(m, x, y);
  if (high) {
    // the high ground's brow: lit where it falls away to the north and the west
    g.fillStyle = 'rgba(255, 244, 210, 0.22)';
    if (!isHigh(at(m, x, y - 1))) g.fillRect(px, py, CELL, 2);
    if (!isHigh(at(m, x - 1, y))) g.fillRect(px, py, 2, CELL);
    // (a ramp: steps cut across it, down toward the lower side)
    if (c === RAMP && !road) {
      const down = !isHigh(at(m, x, y + 1)) || !isHigh(at(m, x, y - 1));
      for (let k = 4; k < CELL; k += 6) {
        g.fillStyle = 'rgba(30, 26, 22, 0.32)';
        if (down) g.fillRect(px + 4, py + k, CELL - 8, 2);
        else g.fillRect(px + k, py + 4, 2, CELL - 8);
        g.fillStyle = 'rgba(255, 240, 200, 0.25)';
        if (down) g.fillRect(px + 4, py + k - 1, CELL - 8, 1);
        else g.fillRect(px + k - 1, py + 4, 1, CELL - 8);
      }
    }
    return;
  }
  // below the high ground: the cliff's face hangs down from a shelf to the north (the pack's jagged rock), a dark rim
  // where it rises beside to the east or the west, and its shadow along the foot of a face to the south
  const cliff = images.get(cliffUrl);
  const above = at(m, x, y - 1);
  const faceAbove = above === HIGH && !isRoad(m, x, y - 1) && !road;
  if (faceAbove) {
    // (which way the cliff runs on: a neighbour beside is of the cliff if it is high ground, or has high ground above it
    // for a face of its own. The piece names the arms; 'n' alone is a face one cell wide, 'ne' one that ends on its west,
    // 'nw' on its east, 'new' a run: the faces and their overhang join at the cell's edge, the ends are capped)
    const runs = (dx: number) => at(m, x + dx, y) === HIGH || (at(m, x + dx, y - 1) === HIGH && at(m, x + dx, y) !== HIGH);
    const arms = armsOf(pieceOf(maskOf((dx, dy) => dy === -1 || (dy === 0 && runs(dx)))));
    // (the face in the mountain's own stone, 2 px columns lit at the brow, then the pack's jagged overhang along its
    // top and a shadow at its foot)
    for (let k = 0; k < CELL; k += 2) {
      const wx = x * CELL + k;
      faceColumn(g, rock, px + k, py, py + faceHeight(wx, y) + 2, hash(97, wx >> 1, y) < 0.08);
    }
    // (an end of the cliff turns away from the light as the rim above it does: the rim runs down the face, tapering)
    for (const [bit, left] of [[W, true], [E, false]] as const) {
      if (arms & bit || at(m, x + (left ? -1 : 1), y) === HIGH) continue;
      const edge = left ? 0 : CELL - 2;
      const h = faceHeight(x * CELL + edge, y) + 2;
      g.fillStyle = 'rgba(16, 14, 26, 0.45)';
      g.fillRect(left ? px : px + CELL - 4, py, 4, h);
      g.fillStyle = 'rgba(16, 14, 26, 0.2)';
      g.fillRect(left ? px + 4 : px + CELL - 7, py, 3, h - 2);
      g.fillStyle = 'rgba(16, 14, 26, 0.3)';
      g.fillRect(left ? px + 4 : px + CELL - 7, py + h - 2, 3, 2);
    }
    // (the overhang is the pack's strip taken in order along the cliff, so each cell carries on where its neighbour
    // stopped)
    if (cliff)
      for (let half = 0; half < 2; half++) {
        const sx = (((x * 2 + half) % 31) + 31) % 31 * 16;
        g.drawImage(cliff, sx, 0, 16, 14, px + half * 16, py - 4, 16, 12);
      }
    g.fillStyle = 'rgba(10, 12, 24, 0.22)';
    g.fillRect(px, py + 16, CELL, 4);
  }
  for (const side of [-1, 1]) {
    const n = at(m, x + side, y);
    if (n !== HIGH || isRoad(m, x + side, y)) continue;
    g.fillStyle = 'rgba(16, 14, 26, 0.45)';
    g.fillRect(side < 0 ? px : px + CELL - 4, py, 4, CELL);
    g.fillStyle = 'rgba(16, 14, 26, 0.2)';
    g.fillRect(side < 0 ? px + 4 : px + CELL - 7, py, 3, CELL);
  }
  if (at(m, x, y + 1) === HIGH && !isRoad(m, x, y + 1)) {
    g.fillStyle = 'rgba(16, 14, 26, 0.3)';
    g.fillRect(px, py + CELL - 3, CELL, 3);
  }
}

/** A tunnel's mouth (sim/tunnels.ts): a cell of dug ground under a street, in a land with relief, opening onto open
 *  ground. The pack's cave entrance stood over the ground before it, facing out. */
export function paintTunnelMouth(g: CanvasRenderingContext2D, m: LandMap, x: number, y: number, px: number, py: number): void {
  if (!m.relief || groundAt(m, x, y) !== 'hall' || !isRoad(m, x, y)) return;
  // (the street comes in from open ground on that side: a mouth; along the tunnel, none)
  const open = (dx: number, dy: number) => {
    const k = groundAt(m, x + dx, y + dy);
    return k !== 'mountain' && k !== 'hall' && isRoad(m, x + dx, y + dy);
  };
  const mouth = images.get(mouthUrl);
  // (the rock round the dug cell darkened in, the way through black at its heart)
  g.fillStyle = 'rgba(6, 6, 12, 0.55)';
  g.fillRect(px + 6, py + 4, CELL - 12, CELL - 8);
  if (!mouth) return;
  // (the arch over the way out, on the cell itself)
  if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => open(dx, dy))) g.drawImage(mouth, px, py - 2, CELL, CELL);
}

// The evening shadow of the high ground and the ranges: on the lower ground to the east of them (the sun low in the
// west), a soft band a few cells wide, painted once per chunk into a texture of its own (not into the ground's chunk,
// so the hour never repaints it): the map fades the whole layer in at dusk and out with the light (mapView.ts `setShade`).
const SHADE_RANGE = 4;
const SHADE_HIGH = 2.5;
const casterOf = (m: LandMap, x: number, y: number) => {
  if (!m.relief || x < 0 || y < 0 || x >= m.w || y >= m.h) return 0;
  const c = m.relief[y * m.w + x];
  return c === RANGE || groundAt(m, x, y) === 'mountain' ? SHADE_RANGE : c === HIGH ? SHADE_HIGH : 0;
};

/** What of the land a chunk's shade depends on (its cells and those a shadow can reach from the west); '' if it has none. */
export function shadeKey(m: LandMap, cx: number, cy: number, size: number): string {
  if (!m.relief) return '';
  const x0 = cx * size;
  const y0 = cy * size;
  let s = '';
  let any = false;
  for (let y = y0; y < Math.min(m.h, y0 + size); y++)
    for (let x = x0 - SHADE_RANGE - 1; x < Math.min(m.w, x0 + size); x++) {
      const k = casterOf(m, x, y);
      if (k) any = true;
      s += k ? (k === SHADE_RANGE ? 'r' : 'h') : '.';
    }
  return any ? s : '';
}

/** A chunk's shade: each run of lower ground to the east of a caster fading from dark to nothing over its reach. */
export function paintShade(m: LandMap, cx: number, cy: number, size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size * CELL;
  const g = cv.getContext('2d')!;
  const x0 = cx * size;
  const y0 = cy * size;
  for (let y = y0; y < Math.min(m.h, y0 + size); y++)
    for (let sx = x0 - SHADE_RANGE - 1; sx < x0 + size; sx++) {
      const reach = casterOf(m, sx - 1, y);
      if (!reach || casterOf(m, sx, y)) continue;
      let n = 0;
      while (n < Math.ceil(reach) && !casterOf(m, sx + n, y)) n++;
      const gx = (sx - x0) * CELL;
      const len = Math.min(n * CELL, reach * CELL);
      const grad = g.createLinearGradient(gx, 0, gx + len, 0);
      grad.addColorStop(0, 'rgba(14, 16, 42, 0.62)');
      grad.addColorStop(0.45, 'rgba(14, 16, 42, 0.3)');
      grad.addColorStop(1, 'rgba(14, 16, 42, 0)');
      g.fillStyle = grad;
      g.fillRect(gx, (y - y0) * CELL, len, CELL);
    }
  return cv;
}

/** How strong the evening shade is at an hour and daylight: none before the afternoon, full toward dusk, gone with the light. */
export const shadeAmount = (hour: number, daylight: number) => Math.max(0, Math.min(1, (hour - 14.5) / 3.5)) * Math.max(0, Math.min(1, (daylight - 0.15) / 0.5)) * (hour < 20 ? 1 : 0);
