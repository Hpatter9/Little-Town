// The grid's rules (docs/notes/grid-audit.md, approved by the owner): every piece the iso view draws on the land stands on
// whole cells. Pure (no Pixi, no page), so the tests check them; iso/isoView.ts draws what these say.
//
// A piece cut to the grid (tools/grid-recut.py) has a copy in its kit's `grid/` folder and a record in that folder's
// `grid.json`: its anchor (px in the copy: the front corner of its footprint, at the top of the grass) and its footprint
// in whole cells. It is drawn at its kit's own scale (never fitted to a footprint), its anchor on its footprint's front
// corner. A building bigger than its picture keeps its footprint: the picture stands on the middle of it and the rest is
// its yard (bare ground and props). Walls and fences are one-cell pieces, joined arm by arm.

import settlersGrid from '../art/iso/kits/settlers/grid/grid.json';
import sharedGrid from '../art/iso/buildings/grid/grid.json';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { HERDS } from '../../shared/data/livestock';
import { depthOf } from '../../shared/sim/buildings';
import { kitOf, pieceFor, roleOf, SHARED_PIECES, sharedPiece } from './isoKits';
import { gateFlip, wallPieceFor, type WallMask } from './isoTown';
import type { Rect } from './isoMath';

export interface GridRec {
  /** Px in the grid copy: the front corner of its footprint, at the top of the grass. */
  anchor: [number, number];
  /** Whole cells along x and along y, as drawn (mirrored it is [h, w]). */
  foot: [number, number];
  /** 'building'; 'loose' (a tree, a rock, a prop: one cell, its foot on the middle); 'seg' (one cell of a wall or fence,
   *  lying along x); 'gate' (a gate's middle, lying along x). */
  kind: 'building' | 'loose' | 'seg' | 'gate';
  /** How much the copy was scaled from the original. */
  bake: number;
  /** A seg's or a gate's: the kit's piece it was cut from. */
  from?: string;
}

/** The kits cut to the grid so far: the settlers' (the one people playable), and the shared pieces drawn at the settlers'
 *  scale. The other peoples keep the old drawing until theirs are cut. */
const GRID: Record<string, Record<string, GridRec>> = { settlers: settlersGrid as unknown as Record<string, GridRec> };
const SHARED_GRID = sharedGrid as unknown as Record<string, GridRec>;
/** The kit the shared pieces were cut at the scale of. */
export const SHARED_KIT = 'settlers';

/** A piece's grid record, if it has been cut (a shared piece's when the kit has none of that name). */
export function gridRec(kit: string, piece: string): { rec: GridRec; shared: boolean } | null {
  if (sharedPiece(kit, piece)) {
    const rec = SHARED_GRID[piece];
    return rec && GRID[kit] ? { rec, shared: true } : null;
  }
  const rec = GRID[kit]?.[piece];
  return rec ? { rec, shared: false } : null;
}

/** Where a grid copy is served (build.mjs copies the folders beside the strip). */
export const gridUrl = (kit: string, piece: string, shared: boolean): string => (shared ? `iso/buildings/grid/${piece}.png` : `iso/kits/${kit}/grid/${piece}.png`);

/** A kit's one-cell wall or fence piece cut from its run (or its gate's middle), by the run's name. */
export function segOf(kit: string, from: string): string | undefined {
  const g = GRID[kit];
  if (!g) return undefined;
  return Object.keys(g).find((k) => g[k].from === from);
}

/** Where a picture with footprint `pf` stands on a building's footprint `f`: the cells it covers (`sub`) and whether it
 *  is mirrored to fit, or null if it fits neither way. Of two ways that fit, the one leaving the less yard; the picture
 *  stands on the middle (an odd cell over goes to the back). */
export function fitIn(pf: readonly [number, number], f: Rect, preferFlip = false): { sub: Rect; flip: boolean } | null {
  const ways = (preferFlip ? [true, false] : [false, true])
    .map((flip) => ({ flip, w: flip ? pf[1] : pf[0], h: flip ? pf[0] : pf[1] }))
    .filter((o) => o.w <= f.w && o.h <= f.h)
    .sort((a, b) => f.w * f.h - a.w * a.h - (f.w * f.h - b.w * b.h));
  const o = ways[0];
  if (!o) return null;
  return { flip: o.flip, sub: { x: f.x + Math.ceil((f.w - o.w) / 2), y: f.y + Math.ceil((f.h - o.h) / 2), w: o.w, h: o.h } };
}

/** The cells of a footprint its picture doesn't stand on: its yard. */
export function yardCells(f: Rect, sub: Rect): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (x < sub.x || y < sub.y || x >= sub.x + sub.w || y >= sub.y + sub.h) out.push({ x, y });
  return out;
}

/** How a building is drawn on the grid: its piece, its record, where it stands, and `shrink`: 1 when its picture fits
 *  its footprint; less while it waits for a picture of its own (`AWAITING_ART`): the picture it borrows, too big for
 *  its footprint, is drawn smaller by this much, its plinth's middle on the footprint's middle, still on the ground and
 *  cut at the footprint's front edges. Null when its kit isn't cut to the grid. Walls, gates, the stockade, pens and
 *  fields are drawn by their own rules, not here. */
export interface GridPlan {
  piece: string;
  rec: GridRec;
  shared: boolean;
  sub: Rect;
  flip: boolean;
  shrink: number;
}
export function gridPlan(kit: string, defId: string, foot: Rect): GridPlan | null {
  const role = roleOf(defId);
  if (!('role' in role) || role.role === 'wall_run' || role.role === 'wall_corner' || role.role === 'gate' || role.role === 'stockade' || role.role === 'pen') return null;
  const piece = pieceFor(kitOf(kit), defId);
  const got = gridRec(kit, piece);
  if (!got || (got.rec.kind !== 'building' && got.rec.kind !== 'loose')) return null;
  const along = got.shared && SHARED_PIECES.get(piece)?.along_y;
  const fit = fitIn(got.rec.foot, foot, !!along && foot.w > foot.h);
  if (fit) return { piece, rec: got.rec, shared: got.shared, ...fit, shrink: 1 };
  // (too big: the way round that needs the least shrinking)
  const [pw, ph] = got.rec.foot;
  const a = Math.min(foot.w / pw, foot.h / ph);
  const b = Math.min(foot.w / ph, foot.h / pw);
  return { piece, rec: got.rec, shared: got.shared, sub: foot, flip: b > a, shrink: Math.max(a, b) };
}

/** The settlers' buildings with no picture that fits their footprint yet, drawn with a borrowed one made smaller
 *  (`gridPlan`'s `shrink`), the most built first: the list for PixelLab (docs/notes/grid-audit.md). By the age they
 *  open in, earliest first, homes and work before the rest. The test checks it is exactly the ones that shrink. */
export const AWAITING_ART: readonly string[] = [
  // (from the start and the first age)
  'lean_to', 'healers_hut', 'workbench', 'tanning_rack', 'drying_rack', 'smokehouse', 'kiln', 'basketry', 'bone_carver',
  'fireside_inn', 'trading_post', 'graveyard', 'wayside_shrine', 'quarry', 'monster_guild', 'militia_post',
  // (the Medieval age)
  'smithy', 'sawmill', 'bakery', 'windmill', 'mine', 'tannery', 'brewery', 'bloomery', 'cooper', 'loom', 'tailor', 'dyeworks', 'chandlery', 'jeweller', 'apothecary',
  'market', 'weapon_store', 'armour_store', 'furniture_store', 'apothecary_shop', 'deep_shaft', 'arcane_library', 'arcane_academy', 'resurrection_shrine',
  'phylactery', 'guard_tower', 'ballista', 'catapult', 'siege_workshop',
  // (the Industrial age)
  'coal_mine', 'glassworks', 'gunsmith', 'cannery', 'print_shop', 'bathhouse', 'clockmaker', 'cannon', 'gun_nest', 'land_mine',
  // (the Modern age)
  'cement_works', 'oil_derrick', 'radio_tower', 'gun_turret', 'flame_turret', 'mortar_pit',
  // (the Space age)
  'bio_lab', 'deep_mine', 'nanoforge', 'battery_plant', 'laser_turret', 'tesla_coil', 'launch_site',
];

/** Pens drawn as a fence round bare ground: the herds' pens, and the buildings for beasts with no picture of their own
 *  (the God creature's pen, the stable, the kennels, the beast ranch). */
export function isFencedPen(defId: string): boolean {
  const r = roleOf(defId);
  return !!HERDS[defId] || ('role' in r && r.role === 'pen');
}

/** One cell of a wall or fence: its middle (cells, fractions allowed) and the way it lies. */
export interface Seg {
  x: number;
  y: number;
  alongY: boolean;
}

/** A fence (or the stockade's stakes) round a footprint's edges, a seg to each cell of each edge, the back edges first;
 *  `gap` cells left open on the front-left edge's middle (the way in), or a gate of that many cells there (`gate`). */
export function penEdges(f: Rect, gap: number): { segs: Seg[]; way: { x: number; y: number; cells: number } | null } {
  const segs: Seg[] = [];
  for (let i = 0; i < f.w; i++) segs.push({ x: f.x + i + 0.5, y: f.y, alongY: false });
  for (let j = 0; j < f.h; j++) segs.push({ x: f.x, y: f.y + j + 0.5, alongY: true });
  for (let j = 0; j < f.h; j++) segs.push({ x: f.x + f.w, y: f.y + j + 0.5, alongY: true });
  const n = Math.min(gap, f.w);
  const from = Math.floor((f.w - n) / 2);
  for (let i = 0; i < f.w; i++) if (i < from || i >= from + n) segs.push({ x: f.x + i + 0.5, y: f.y + f.h, alongY: false });
  return { segs, way: n > 0 ? { x: f.x + from + n / 2, y: f.y + f.h, cells: n } : null };
}

/** A wall cell's arms: the half-cells it reaches out with toward the walls beside it, back ones first. A run along one
 *  way (or an end, or a lone cell) is one whole seg; a corner, a tee or a cross is its arms. */
export function wallArms(m: WallMask): { whole: { alongY: boolean } } | { arms: ('w' | 'n' | 'e' | 's')[] } {
  const x = m.e || m.w;
  const y = m.n || m.s;
  if (!(x && y)) return { whole: { alongY: y } };
  return { arms: (['w', 'n', 'e', 's'] as const).filter((a) => m[a]) };
}

/** Spots for loose pieces (a store's heaps, a building's props) on the middles of cells: its yard first, then the free
 *  cells along its front faces (`free` says which may take one), at most one to a cell, in order. */
export function snapSpots(n: number, f: Rect, yard: readonly { x: number; y: number }[], free: (x: number, y: number) => boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const c of yard) if (out.length < n) out.push({ x: c.x + 0.5, y: c.y + 0.5 });
  const front: { x: number; y: number }[] = [];
  for (let j = 0; j < f.h; j++) front.push({ x: f.x + f.w, y: f.y + f.h - 1 - j });
  for (let i = 0; i < f.w; i++) front.push({ x: f.x + f.w - 1 - i, y: f.y + f.h });
  for (const c of front) if (out.length < n && free(c.x, c.y)) out.push({ x: c.x + 0.5, y: c.y + 0.5 });
  return out;
}

/** Every settlers' building the build menu (or the town) can put up, with how it is drawn on the grid. */
export function settlerGridPlans(isUnlocked: (defId: string) => boolean): { defId: string; foot: Rect; plan: GridPlan | null; own: boolean }[] {
  const out: { defId: string; foot: Rect; plan: GridPlan | null; own: boolean }[] = [];
  for (const id of Object.keys(BUILDING_BY_ID)) {
    const d = BUILDING_BY_ID[id];
    if (d.never || !isUnlocked(id)) continue;
    const role = roleOf(id);
    if (!('role' in role)) continue;
    const foot = { x: 0, y: 0, w: d.width, h: depthOf(d) };
    const plan = gridPlan('settlers', id, foot);
    out.push({ defId: id, foot, plan, own: !!plan && (plan.piece === id) });
  }
  return out;
}

/** Of the gate pieces, the grid's for a gate of this kind (a stone gate's stone, a palisade's wood), and which way it lies. */
export function gatePlan(kit: string, defId: string, foot: Rect): { piece: string; rec: GridRec; flip: boolean } | null {
  const run = wallPieceFor([...kitOf(kit).pieces.keys()], 'gate', defId);
  const seg = run && segOf(kit, run);
  const rec = seg ? GRID[kit][seg] : undefined;
  if (!seg || !rec) return null;
  return { piece: seg, rec, flip: gateFlip(foot) };
}

/** A wall's one-cell seg (stone for a stone wall, the palisade's for a palisade), or none if its kit isn't cut yet. */
export function wallSeg(kit: string, defId: string): { piece: string; rec: GridRec } | null {
  const run = wallPieceFor([...kitOf(kit).pieces.keys()], 'run', defId);
  const seg = run && segOf(kit, run);
  return seg ? { piece: seg, rec: GRID[kit][seg] } : null;
}

/** A kit's one-cell fence seg (for pens), if cut. */
export const fenceSeg = (kit: string): { piece: string; rec: GridRec } | null => {
  const seg = segOf(kit, 'fence');
  return seg ? { piece: seg, rec: GRID[kit][seg] } : null;
};

/** A loose piece's record (a tree, a rock, a prop), if cut. */
export function looseRec(kit: string, piece: string): GridRec | null {
  const r = GRID[kit]?.[piece];
  return r && r.kind === 'loose' ? r : null;
}
