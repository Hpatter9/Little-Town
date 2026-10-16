// The War tab's map as one island in the sea (the owner's ask: "an island surrounded by water so the whole thing is
// on the map to be viewed"), and where its names go. Pure (no DOM), so the tests can read it.
//
// The realm's world (sim/conquest/world.ts) is made from the seed every time a save is opened, and its land reaches
// the grid's edges and stands in a few pieces joined by harbours. Rather than reshape it in the sim (every older
// realm would change under its save), the map draws it through a projection: a ring of open sea round the grid, the
// land at the old edge grown out a cell or three into it by noise (so the coast is ragged, never the grid's straight
// edge), and each piece apart from the main one joined to it by a strip of shore across the narrowest strait. Every
// province keeps its place (shifted by the ring) and its cells; the sim never sees any of it.

import { CELL_CODE } from '../../shared/data/conquest';
import type { MarchView, ProvinceView, WarView } from '../../shared/sim/war/view';

const CODES = '0123456789ab';
const WATER = CODES[CELL_CODE.water];
const SHORE = CODES[CELL_CODE.coast];
const OWNER_BASE = 33;

/** The sea's ring round the grid, in cells. */
export const islandMargin = (side: number) => Math.max(6, Math.round(side * 0.1));

/** A hash of a cell to 0..1, and smooth noise over cells. */
function hashCell(seed: number, x: number, y: number): number {
  let h = (seed * 374761393 + x * 668265263 + y * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(seed: number, x: number, y: number, scale: number): number {
  const gx = x / scale;
  const gy = y / scale;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hashCell(seed, ix, iy);
  const b = hashCell(seed, ix + 1, iy);
  const c = hashCell(seed, ix, iy + 1);
  const d = hashCell(seed, ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

interface Shape {
  key: string;
  side: number;
  margin: number;
  cells: string;
  owners: string;
}
let shape: Shape | null = null;

/** The island's grid for a world: its side, its land and each cell's province (`ownerAt` reads it as the sim's). */
function shapeOf(w: Pick<WarView, 'side' | 'cells' | 'owners'>): Shape {
  const key = `${w.side}|${w.cells}|${w.owners}`;
  if (shape && shape.key === key) return shape;
  const m = islandMargin(w.side);
  const S = w.side + 2 * m;
  const code = new Array<string>(S * S).fill(WATER);
  const own = new Int16Array(S * S).fill(-1);
  for (let y = 0; y < w.side; y++)
    for (let x = 0; x < w.side; x++) {
      const i = y * w.side + x;
      const j = (y + m) * S + (x + m);
      code[j] = w.cells[i];
      own[j] = w.owners.charCodeAt(i) - OWNER_BASE;
    }
  let seed = 0;
  for (let i = 0; i < Math.min(64, w.cells.length); i++) seed = (seed * 31 + w.cells.charCodeAt(i)) | 0;
  // ---- the ragged coast: land at the grid's edge reaches out into the ring by noise (a cell to three), its corners
  // rounded by the distance; mountains meet the sea as shore
  const reachMost = Math.min(3.2, m - 2.5);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const ix = Math.max(m, Math.min(m + w.side - 1, x));
      const iy = Math.max(m, Math.min(m + w.side - 1, y));
      if (ix === x && iy === y) continue;
      const src = iy * S + ix;
      if (code[src] === WATER) continue;
      const reach = 0.4 + reachMost * (smooth(seed, x, y, 4.5) * 0.75 + hashCell(seed + 1, x, y) * 0.25);
      if (Math.hypot(x - ix, y - iy) > reach) continue;
      code[y * S + x] = code[src] === CODES[CELL_CODE.mountain] ? SHORE : code[src];
      own[y * S + x] = own[src];
    }
  // ---- one landmass: each piece apart joined to the main one across the narrowest water
  joinPieces(code, own, S);
  return (shape = { key, side: S, margin: m, cells: code.join(''), owners: String.fromCharCode(...Array.from(own, (o) => (o < 0 ? OWNER_BASE - 1 : OWNER_BASE + o))) });
}

/** The land's pieces (4-connected), each cell's piece or -1 for the sea. */
export function piecesOf(cells: string, side: number): { piece: Int32Array; count: number } {
  const piece = new Int32Array(side * side).fill(-1);
  let count = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === WATER || piece[i] >= 0) continue;
    const stack = [i];
    piece[i] = count;
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % side;
      const y = (c - x) / side;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= side || ny >= side) continue;
        const j = ny * side + nx;
        if (cells[j] === WATER || piece[j] >= 0) continue;
        piece[j] = count;
        stack.push(j);
      }
    }
    count++;
  }
  return { piece, count };
}

/** While the land stands in pieces, the nearest shore cells of the main piece and another are joined by a strip of
 *  shore two cells wide, each half the province's at its end. */
function joinPieces(code: string[], own: Int16Array, S: number): void {
  for (let guard = 0; guard < 64; guard++) {
    const { piece, count } = piecesOf(code.join(''), S);
    if (count <= 1) return;
    const sizes = new Array<number>(count).fill(0);
    for (let i = 0; i < piece.length; i++) if (piece[i] >= 0) sizes[piece[i]]++;
    const main = sizes.indexOf(Math.max(...sizes));
    // (the shore cells of each side: land beside the sea)
    const shoreOf = (inMain: boolean): number[] => {
      const out: number[] = [];
      for (let i = 0; i < piece.length; i++) {
        if (piece[i] < 0 || (piece[i] === main) !== inMain) continue;
        const x = i % S;
        const y = (i - x) / S;
        if ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < S && ny < S && piece[ny * S + nx] < 0)) out.push(i);
      }
      return out;
    };
    const a = shoreOf(true);
    const b = shoreOf(false);
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const i of a)
      for (const j of b) {
        const d = (i % S - (j % S)) ** 2 + (Math.floor(i / S) - Math.floor(j / S)) ** 2;
        if (d < bestD) (bestD = d), (best = [i, j]);
      }
    if (!best) return;
    const [i, j] = best;
    const [x0, y0, x1, y1] = [i % S, Math.floor(i / S), j % S, Math.floor(j / S)];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / steps);
      const y = Math.round(y0 + ((y1 - y0) * k) / steps);
      const owner = k <= steps / 2 ? own[i] : own[j];
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const c = ny * S + nx;
        if (code[c] !== WATER) continue;
        code[c] = SHORE;
        own[c] = owner;
      }
    }
  }
}

/** The world as the island the map draws: the same view with the ring of sea round it, its land made one, and every
 *  province's place shifted into it. Holdings, marches and the rest are the view's own. */
export function islandOf(w: WarView): WarView & { margin: number } {
  const sh = shapeOf(w);
  return { ...w, side: sh.side, cells: sh.cells, owners: sh.owners, margin: sh.margin, provinces: w.provinces.map((p) => ({ ...p, x: p.x + sh.margin, y: p.y + sh.margin })) };
}

/* ------------------------------------------------------------ the names, placed so none overlaps another */

export interface LabelAsk {
  /** What it names (a province's id, or an army's key), the text, and where its mark stands (px). */
  id: string;
  text: string;
  x: number;
  y: number;
  /** The mark's radius (px): a label keeps clear of every mark. */
  r: number;
  /** Who wins a place: the higher first. */
  rank: number;
  /** Its text's size (px). */
  size: number;
}
export interface LabelBox {
  id: string;
  text: string;
  /** The box's top-left corner and size (px); the text is centred in it. */
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
}
/** A label of this rank or more (the town's, the place picked) may lie over another place's mark when nothing else fits. */
const MUST_RANK = 100;
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Place the labels, the most important first: each tries below its mark, then above, right and left; one that fits
 *  nowhere clear of the labels placed and the other marks (and inside `bounds`) is left out, but for the town's,
 *  which may lie over a mark. */
export function placeLabels(asks: LabelAsk[], measure: (text: string, size: number) => number, bounds: { x: number; y: number; w: number; h: number }): LabelBox[] {
  const marks = asks.map((a) => ({ id: a.id, x: a.x - a.r, y: a.y - a.r, w: a.r * 2, h: a.r * 2 }));
  const placed: LabelBox[] = [];
  for (const a of [...asks].sort((p, q) => q.rank - p.rank || p.y - q.y || p.x - q.x)) {
    const w = Math.ceil(measure(a.text, a.size)) + 4;
    const h = Math.ceil(a.size * 1.25);
    const gap = 2;
    const spots = [
      { x: a.x - w / 2, y: a.y + a.r + gap },
      { x: a.x - w / 2, y: a.y - a.r - gap - h },
      { x: a.x + a.r + gap, y: a.y - h / 2 },
      { x: a.x - a.r - gap - w, y: a.y - h / 2 },
    ];
    // (the town's name is never left out for a mark in its way: a second try lets it lie over one)
    for (const clearOfMarks of a.rank >= MUST_RANK ? [true, false] : [true]) {
      const box = spots
        .map((s) => ({ id: a.id, text: a.text, x: s.x, y: s.y, w, h, size: a.size }))
        .find((box) => box.x >= bounds.x && box.y >= bounds.y && box.x + w <= bounds.x + bounds.w && box.y + h <= bounds.y + bounds.h && !placed.some((p) => overlaps(p, box)) && (!clearOfMarks || !marks.some((m) => m.id !== a.id && overlaps(m, box))));
      if (!box) continue;
      placed.push(box);
      break;
    }
  }
  return placed;
}

/* ------------------------------------------------------------ the places and hosts on the map */

/** What kind of place a province is on the map: the town, a power's seat, a hold of a realm, or free ground. */
export type PlaceKind = 'town' | 'seat' | 'hold' | 'free';
export const placeKind = (w: WarView, p: ProvinceView): PlaceKind => (p.id === w.home ? 'town' : p.capitalOf && p.holder ? 'seat' : p.holder ? 'hold' : 'free');
/** A place's mark: its disc's radius and its building's height, in CSS px. */
export const MARK: Record<PlaceKind, { r: number; h: number }> = { town: { r: 8, h: 22 }, seat: { r: 7, h: 19 }, hold: { r: 5.5, h: 15 }, free: { r: 4, h: 11 } };
/** Whose labels win a place: the town, then the seats, the places under attack, the realms' holds, the free land. */
const RANK: Record<PlaceKind, number> = { town: 100, seat: 80, hold: 40, free: 10 };

/** Where a march's mark stands now, and which way it heads (radians). */
export function marchAt(w: WarView, ra: MarchView, cell: number): { x: number; y: number; a: number } {
  const f = w.provinces[ra.from];
  const t = w.provinces[ra.to];
  const fx = (f.x + 0.5) * cell;
  const fy = (f.y + 0.5) * cell;
  const tx = (t.x + 0.5) * cell;
  const ty = (t.y + 0.5) * cell;
  const k = Math.max(0.12, Math.min(0.88, ra.t));
  return { x: fx + (tx - fx) * k, y: fy + (ty - fy) * k, a: Math.atan2(ty - fy, tx - fx) };
}
/** The labels the map would show at a cell size (px) and a view: the places' names and the hosts' strengths, placed
 *  so none overlaps another (`placeLabels`). */
export function mapLabels(w: WarView, cell: number, ctx: { selected: number | null; dpr: number; view: { x: number; y: number; w: number; h: number } }, measure: (text: string, size: number) => number): LabelBox[] {
  const u = ctx.dpr;
  const attacked = new Set(w.rivalArmies.map((a) => a.to));
  const asks: LabelAsk[] = w.provinces.map((p) => {
    const kind = placeKind(w, p);
    const m = MARK[kind];
    const big = kind === 'town' || kind === 'seat' || p.id === ctx.selected;
    return {
      id: `p${p.id}`,
      text: p.name,
      x: (p.x + 0.5) * cell,
      y: (p.y + 0.5) * cell - m.h * u * 0.3,
      r: Math.max(m.r, m.h * 0.55) * u,
      rank: RANK[kind] + (p.id === ctx.selected ? 200 : 0) + (attacked.has(p.id) ? 30 : 0) + p.tierN,
      size: (big ? 12.5 : 11) * u,
    };
  });
  w.rivalArmies.forEach((ra, i) => {
    const at = marchAt(w, ra, cell);
    asks.push({ id: `a${i}`, text: String(ra.strength), x: at.x, y: at.y, r: 5 * u, rank: 60, size: 11 * u });
  });
  return placeLabels(asks, measure, ctx.view);
}

