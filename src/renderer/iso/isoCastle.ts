// The Blood Court's castle and the dwarves' hold in the isometric view, from the pieces in art/iso/castles/ (see its
// README): the hall's ground is the keep, every room one of the hall, cellar, forge or brewery, a tower stands at each
// outer corner, wall runs along the outer edges and a gate in the south wall (and the side gates). Pure (no Pixi, no
// page): `planCastle` turns the snapshot's castle and its rooms into pieces on footprints, and iso/isoCastleView.ts draws
// them. Footprints are in cells; the depth of each is `footDepth`, so they sort among the buildings and the townsfolk.

import castlesJson from '../art/iso/castles/index.json';
import { footDepth, type Rect } from './isoMath';

export type Piece = 'keep' | 'tower' | 'wall' | 'gate' | 'hall' | 'cellar' | 'forge' | 'brewery';
/** The two peoples with a castle or hold. */
export type CastlePeople = 'bloodcourt' | 'dwarves';

/** Each piece's picture id in each people's folder. */
export const PIECE_ID: Record<CastlePeople, Record<Piece, string>> = {
  bloodcourt: { keep: 'castle_keep', tower: 'castle_tower', wall: 'castle_wall', gate: 'castle_gate', hall: 'castle_hall', cellar: 'blood_cellar', forge: 'castle_hall', brewery: 'blood_cellar' },
  dwarves: { keep: 'hold_hall', tower: 'hold_tower', wall: 'hold_wall', gate: 'hold_gate', hall: 'hold_hall', cellar: 'hold_hall', forge: 'hold_forge', brewery: 'hold_brewery' },
};

/** Which people a snapshot's castle is of (`castle.hold`: a castle on the land, or a hold in the mountain), or none. */
export const castlePeopleOf = (hold: 'castle' | 'mountain' | undefined): CastlePeople | null => (hold === 'castle' ? 'bloodcourt' : hold === 'mountain' ? 'dwarves' : null);

/** A room's piece from its building's id: a few kinds have their own, anything else is a hall. */
const ROOM_KINDS: [RegExp, Piece][] = [
  [/forge|smith|foundry|bloomery|armourer|anvil|kiln|smelt|workshop|bench/, 'forge'],
  [/brew|tavern|inn|grog|ale|winery|distill|alembic/, 'brewery'],
  [/cellar|store|stockpile|granary|larder|vault|crypt|coffin|blood|treasur|pantry|barrel|depot/, 'cellar'],
];
export function roomPiece(defId: string): Piece {
  for (const [re, p] of ROOM_KINDS) if (re.test(defId)) return p;
  return 'hall';
}

export interface Placed {
  piece: Piece;
  /** The footprint it stands on (cells), and which way it lies: the pieces' runs lie along x, flipped along y. */
  foot: Rect;
  flip: boolean;
  /** `footDepth` of the footprint: its draw order. */
  depth: number;
  /** The building it is for (a room), for tapping. */
  id?: number;
}

export interface CastleShape {
  core: Rect;
  gate: { x: number; y: number };
  gates?: { x: number; y: number; side: 'n' | 's' | 'w' | 'e' }[];
}
export interface RoomIn {
  id: number;
  def: string;
  foot: Rect;
}

/** A wall's thickness on the ground (cells), the length of one wall piece, and how wide a gate stands (cells). */
export const WALL_T = 0.4;
export const WALL_RUN = 2;
export const GATE_SPAN = 3;
/** A corner tower stands on this many cells square. */
export const TOWER_CELLS = 1.2;

const place = (piece: Piece, foot: Rect, flip = false, id?: number): Placed => ({ piece, foot, flip, depth: footDepth(foot), id });

/** Every piece of the castle, in no order (they sort by `depth`). `W` is the land's width, for the cells' indices. */
export function planCastle(c: CastleShape, rooms: readonly RoomIn[], W: number): Placed[] {
  const out: Placed[] = [];
  const region = new Set<number>();
  const add = (r: Rect) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) region.add(y * W + x);
  };
  add(c.core);
  for (const r of rooms) add(r.foot);
  const has = (x: number, y: number) => x >= 0 && y >= 0 && x < W && region.has(y * W + x);

  out.push(place('keep', c.core));
  for (const r of rooms) out.push(place(roomPiece(r.def), r.foot, false, r.id));

  // gates: the main one before the hall (the cell above it is the castle's last), the side ones in their walls
  const gateCells = new Set<string>();
  const gates: { x: number; y: number; side: 'n' | 's' | 'w' | 'e' }[] = [{ x: c.gate.x, y: c.gate.y - 1, side: 's' }, ...(c.gates ?? [])];
  for (const g of gates) {
    const along = g.side === 'n' || g.side === 's';
    const foot: Rect = along
      ? { x: g.x + 0.5 - GATE_SPAN / 2, y: g.side === 's' ? g.y + 1 - WALL_T / 2 : g.y - WALL_T / 2, w: GATE_SPAN, h: WALL_T }
      : { x: g.side === 'e' ? g.x + 1 - WALL_T / 2 : g.x - WALL_T / 2, y: g.y + 0.5 - GATE_SPAN / 2, w: WALL_T, h: GATE_SPAN };
    out.push(place('gate', foot, !along));
    for (let i = -1; i <= 1; i++) gateCells.add(along ? `${g.side}${g.x + i},${g.y}` : `${g.side}${g.x},${g.y + i}`);
  }

  // wall runs along the outer edges, a run of up to WALL_RUN cells at a time, the gates' cells left clear
  const edges: { side: 'n' | 's' | 'w' | 'e'; line: number; at: number }[] = [];
  for (const i of [...region].sort((a, b) => a - b)) {
    const x = i % W;
    const y = Math.floor(i / W);
    if (!has(x, y - 1)) edges.push({ side: 'n', line: y, at: x });
    if (!has(x, y + 1)) edges.push({ side: 's', line: y + 1, at: x });
    if (!has(x - 1, y)) edges.push({ side: 'w', line: x, at: y });
    if (!has(x + 1, y)) edges.push({ side: 'e', line: x + 1, at: y });
  }
  const lines = new Map<string, number[]>();
  for (const e of edges) {
    const k = `${e.side}${e.line}`;
    (lines.get(k) ?? lines.set(k, []).get(k)!).push(e.at);
  }
  for (const [k, ats] of lines) {
    const side = k[0] as 'n' | 's' | 'w' | 'e';
    const line = Number(k.slice(1));
    const along = side === 'n' || side === 's';
    ats.sort((a, b) => a - b);
    let start = -1;
    let len = 0;
    const flush = () => {
      if (len <= 0) return;
      const foot: Rect = along ? { x: start, y: line - WALL_T / 2, w: len, h: WALL_T } : { x: line - WALL_T / 2, y: start, w: WALL_T, h: len };
      out.push(place('wall', foot, !along));
      len = 0;
    };
    for (const a of ats) {
      // (the cell above or beside a gate's wall is the gate's: its cells are named by the cell inside the wall)
      const inside = along ? `${side}${a},${side === 's' ? line - 1 : line}` : `${side}${side === 'e' ? line - 1 : line},${a}`;
      const gated = gateCells.has(inside);
      if (gated || (len > 0 && (a !== start + len || len >= WALL_RUN))) flush();
      if (gated) continue;
      if (len === 0) start = a;
      len++;
    }
    flush();
  }

  // a tower at each outer corner: a vertex with the castle's outside on both sides of it, the same way the walls turn
  const seen = new Set<string>();
  for (const i of region) {
    const x = i % W;
    const y = Math.floor(i / W);
    for (const [cx, cy, a, b] of [
      [x, y, !has(x, y - 1), !has(x - 1, y)],
      [x + 1, y, !has(x, y - 1), !has(x + 1, y)],
      [x, y + 1, !has(x, y + 1), !has(x - 1, y)],
      [x + 1, y + 1, !has(x, y + 1), !has(x + 1, y)],
    ] as const) {
      const k = `${cx},${cy}`;
      if (!a || !b || seen.has(k)) continue;
      seen.add(k);
      out.push(place('tower', { x: cx - TOWER_CELLS / 2, y: cy - TOWER_CELLS / 2, w: TOWER_CELLS, h: TOWER_CELLS }));
    }
  }
  return out;
}

/** How big a piece is drawn (its scale on its picture of `w` by `h` px): fitted to its footprint's span (px, across) but
 *  no bigger than the kit's own scale `k0` allows, and no taller than `maxH`. Towers go by their height alone, so they
 *  all stand the same; walls and gates fit their span exactly, so a run is as long as its cells. */
export function pieceScale(piece: Piece, w: number, h: number, span: number, k0: number): number {
  if (piece === 'tower') return TOWER_PX / h;
  if (piece === 'wall') return span / w;
  if (piece === 'gate') return Math.min(span / w, GATE_PX / h);
  const cap = piece === 'keep' ? 1.1 : 1;
  return Math.min(k0 * cap, (span * 1.25) / w, (piece === 'keep' ? KEEP_PX : ROOM_PX) / h);
}
export const TOWER_PX = 100;
export const GATE_PX = 90;
export const KEEP_PX = 230;
export const ROOM_PX = 190;

/** The size of every piece, by people and picture id (for the view's scaling and the tests). */
export const SIZES = castlesJson as Record<CastlePeople, { id: string; w: number; h: number }[]>;

/** Where the pieces are served (beside the strip page: build.mjs copies the folder). */
export const castleUrl = (people: CastlePeople, id: string): string => `iso/castles/${people}/${id}.png`;
