// Which piece a tile of a line takes (the ring wall, its water grates, the bridges), by which of its four neighbours
// are of the line too: the owner's ask, that the walls, grates and bridges meet seamlessly round their many corners.
// A cell's mask has a bit for each side the line goes on past (`N`, `E`, `S`, `W`); its piece is named by those arms
// in that order ('ew' a run along a row, 'ns' one down a column, 'es' a corner turning south and east, 'nesw' a
// crossing, 'n' an end with the line going on north, 'post' a cell alone). Every set (map/packBuildings.ts for the
// walls and grates, art/bridgeTiles.ts for the bridges) draws each of the sixteen from the pieces of its pack, so
// every pair of neighbours meets at the cell's edge. Pure: no Pixi, no DOM (the tests import it).

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

/** The sides as (bit, dx, dy), in mask order. */
export const SIDES: readonly (readonly [number, number, number])[] = [
  [N, 0, -1],
  [E, 1, 0],
  [S, 0, 1],
  [W, -1, 0],
];

export type Piece = 'post' | 'n' | 'e' | 's' | 'w' | 'ns' | 'ew' | 'ne' | 'es' | 'sw' | 'nw' | 'nes' | 'esw' | 'nsw' | 'new' | 'nesw';

/** Every piece, by mask (0..15). */
const BY_MASK: readonly Piece[] = ['post', 'n', 'e', 'ne', 's', 'ns', 'es', 'nes', 'w', 'nw', 'ew', 'new', 'sw', 'nsw', 'esw', 'nesw'];
export const PIECES: readonly Piece[] = BY_MASK;

/** The mask of a cell: `has(dx, dy)` says whether the neighbour that way is of the line. */
export function maskOf(has: (dx: number, dy: number) => boolean): number {
  let m = 0;
  for (const [bit, dx, dy] of SIDES) if (has(dx, dy)) m |= bit;
  return m;
}

/** The piece a mask takes. */
export const pieceOf = (mask: number): Piece => BY_MASK[mask & 15];

/** The mask a piece stands for (the arms it reaches out with). */
export function armsOf(piece: string): number {
  if (piece === 'post') return 0;
  let m = 0;
  for (const c of piece) m |= c === 'n' ? N : c === 'e' ? E : c === 's' ? S : c === 'w' ? W : 0;
  return m;
}

/** Whether a string names one of the sixteen pieces. */
export const isPiece = (j: string): j is Piece => (BY_MASK as readonly string[]).includes(j);

/** A wall's join (map/mapView.ts `wallJoin`): its piece, and the sides where it stops against a grate (`capped`, a
 *  mask): there the wall goes to the cell's edge and finishes with an end post, so the lower grate meets a proper end
 *  of the wall on each bank, not a cut face. */
export function wallJoinOf(mask: number, capped = 0): string {
  const cap = capped & mask;
  return cap ? `${pieceOf(mask)}/${cap}` : pieceOf(mask);
}

/** A wall's join taken apart: its arms, and the capped ones. The old names (`h` along a row, `v`/`ve` down a column,
 *  `end` alone) still read as their pieces. */
export function readWallJoin(join: string): { arms: number; capped: number } | null {
  const [p, c] = join.split('/');
  const piece = p === 'h' ? 'ew' : p === 'v' || p === 've' ? 'ns' : p === 'end' ? 'post' : p;
  if (!isPiece(piece)) return null;
  const arms = armsOf(piece);
  return { arms, capped: c ? Number(c) & arms : 0 };
}

/** How a bridge cell is drawn (art/bridgeTiles.ts): which way its planks run (`along` 'ns' for a bridge with a way on
 *  north or south, the boards across it; 'ew' else), the sides it has a rail on (no road goes on that way), the sides
 *  where it steps off onto a bank (the road goes on over land: the pack's end boards), and the corners where a rail
 *  stops at a post because a deck joins beside it (`posts`: 1 NE, 2 SE, 4 SW, 8 NW). */
export interface BridgePiece {
  along: 'ns' | 'ew';
  rails: number;
  banks: number;
  posts: number;
}

/** A bridge cell's piece: `road` the sides with road (over water or land), `wet` the sides whose road is over water
 *  too (a bridge going on), `diag` the corners whose diagonal neighbour is road (1 NE, 2 SE, 4 SW, 8 NW). A rail stops
 *  at a post on a corner where the way it would run on along is taken by a deck coming in beside it (the bridge goes
 *  on round the corner, so the next cell has no rail on that side), or where the bridge steps off onto a bank. */
export function bridgePiece(road: number, wet: number, diag = 0): BridgePiece {
  road &= 15;
  wet &= road;
  const along = road & (N | S) ? 'ns' : 'ew';
  const rails = 15 & ~road;
  const banks = road & ~wet;
  let posts = 0;
  // (corner `bit` between sides a and b: a rail on side a runs on into the cell beyond b, unless that cell has road
  // on our a side too (the diagonal), or is a bank)
  const corner = (bit: number, a: number, b: number) => {
    const stops = (rail: number, on: number) => rails & rail && road & on && (diag & bit || banks & on);
    if (stops(a, b) || stops(b, a)) posts |= bit;
  };
  corner(1, N, E);
  corner(2, S, E);
  corner(4, S, W);
  corner(8, N, W);
  return { along, rails, banks, posts };
}
