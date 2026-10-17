// The land's hills and mountains on the map (sim/relief.ts), painted into the ground's chunks (map/groundArt.ts) in a
// block of their own: the downs and the rocky hills shaded as they rise and fall (lit from the north-west, as the
// mountain is), the high ground lit along its brow, its cliffs the Undead pack's jagged rock face (art/under/cliff.png)
// hanging below its southern edge and a dark rim on the others, its ramps cut as steps; a tunnel's mouths the Rocky
// Area pack's cave entrance. The outcrops among the rocky hills are the Rocks pack's boulders, stood on the land as
// props (map/mapView.ts), their cells painted as rocky ground (`paintLand`). A land with no relief draws as it did.

import { biomeById } from '../../shared/data/biomes';
import { CELL, groundAt, isRoad, type LandMap } from '../../shared/sim/land';
import { DOWNS, HIGH, RAMP, RANGE, ROCKY, isHigh } from '../../shared/sim/relief';
import { loadImage } from '../art/loadImage';
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
/** A smoothed height (the cell and its eight about it), so a hill swells rather than steps. */
function swell(m: LandMap, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += rise(at(m, x + dx, y + dy)) * (dx || dy ? 1 : 2);
  return n / 10;
}

/** A cell's relief, painted over its ground (before the footpaths and roads). */
export function paintRelief(g: CanvasRenderingContext2D, m: LandMap, x: number, y: number, px: number, py: number, hash: (seed: number, x: number, y: number) => number): void {
  if (!m.relief) return;
  const c = at(m, x, y);
  const kind = groundAt(m, x, y);
  if (kind === 'water' || kind === 'shallows' || kind === 'mountain') return;
  // the hills' rise and fall: the slopes facing the north-west lit, those facing the south-east in shade, in 4px blocks
  // so the swell shades smoothly across the cell
  const s0 = swell(m, x, y);
  if (c !== '0' || s0 > 0) {
    const [sw, se, sn, ss] = [swell(m, x - 1, y), swell(m, x + 1, y), swell(m, x, y - 1), swell(m, x, y + 1)];
    for (let by = 0; by < CELL; by += 4)
      for (let bx = 0; bx < CELL; bx += 4) {
        const sx = bx < CELL / 2 ? s0 - sw : se - s0;
        const sy = by < CELL / 2 ? s0 - sn : ss - s0;
        // (light from the north-west: ground rising toward the south-east faces it)
        const lit = (sx + sy) * 0.5;
        if (Math.abs(lit) < 0.03) continue;
        g.fillStyle = lit > 0 ? `rgba(255, 246, 214, ${Math.min(0.26, lit * 0.36).toFixed(3)})` : `rgba(18, 22, 40, ${Math.min(0.34, -lit * 0.46).toFixed(3)})`;
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
    if (cliff)
      // (two of the pack's overhangs, one below the other, for a face a good half cell high)
      for (const [dy, salt] of [[6, 95], [-4, 91]])
        for (let half = 0; half < 2; half++) {
          const sx = Math.floor(hash(salt + half, x, y) * 30) * 16;
          g.drawImage(cliff, sx, 0, 16, 30, px + half * 16, py + dy, 16, 26);
        }
    else {
      g.fillStyle = '#3a3640';
      g.fillRect(px, py, CELL, 14);
    }
    g.fillStyle = 'rgba(10, 12, 24, 0.25)';
    g.fillRect(px, py + 20, CELL, 4);
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
  const open = (dx: number, dy: number) => {
    const k = groundAt(m, x + dx, y + dy);
    return k !== 'mountain' && k !== 'hall';
  };
  const mouth = images.get(mouthUrl);
  // (the rock round the dug cell darkened in, the way through black at its heart)
  g.fillStyle = 'rgba(6, 6, 12, 0.55)';
  g.fillRect(px + 6, py + 4, CELL - 12, CELL - 8);
  if (!mouth) return;
  // (the arch over the way out, on the cell itself, when it opens onto open ground on any side)
  if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => open(dx, dy))) g.drawImage(mouth, px, py - 2, CELL, CELL);
}
