import assert from 'node:assert/strict';
import { test } from 'node:test';
import { armsOf, bridgePiece, E, maskOf, N, PIECES, pieceOf, readWallJoin, S, W, wallJoinOf } from '../src/renderer/art/autotile';
import { GRATE_COL, grateTile, palisadeTile, stoneTile, type Part } from '../src/renderer/art/wallTiles';

const MASKS = [...Array(16).keys()];
/** A part's box on its canvas: [x0, y0, x1, y1]. */
const box = (p: Part): [number, number, number, number] => [p[1], p[2], p[1] + (p.length > 3 ? p[5]! : 32), p[2] + (p.length > 3 ? p[6]! : 32)];

test('every mask has its own piece, and the piece names its arms', () => {
  assert.equal(new Set(PIECES).size, 16);
  for (const m of MASKS) assert.equal(armsOf(pieceOf(m)), m, `mask ${m}`);
  assert.equal(pieceOf(0), 'post');
  assert.equal(pieceOf(E | W), 'ew');
  assert.equal(pieceOf(N | S), 'ns');
  assert.equal(pieceOf(E | S), 'es');
  assert.equal(pieceOf(N | E | S | W), 'nesw');
  assert.equal(maskOf((dx, dy) => dx === 1 || dy === -1), N | E);
});

test('a wall join carries the sides it stops against a grate, and the old names still read', () => {
  assert.equal(wallJoinOf(E | W), 'ew');
  assert.equal(wallJoinOf(E | W, E), 'ew/2');
  assert.equal(wallJoinOf(E, W), 'e'); // (a cap only on a side the wall goes on)
  assert.deepEqual(readWallJoin('ew/2'), { arms: E | W, capped: E });
  assert.deepEqual(readWallJoin('h'), { arms: E | W, capped: 0 });
  assert.deepEqual(readWallJoin('ve'), { arms: N | S, capped: 0 });
  assert.deepEqual(readWallJoin('end'), { arms: 0, capped: 0 });
  assert.equal(readWallJoin('gn'), null);
});

test('the palisade has a piece for every mask, each reaching the edges its arms go out to and no others', () => {
  for (const m of MASKS)
    for (const cap of [0, E, W, E | W]) {
      const t = palisadeTile(wallJoinOf(m, cap));
      assert.ok(t && t.parts.length, `mask ${m}`);
      const boxes = t.parts.map(box);
      for (const b of boxes) assert.ok(b[0] >= 0 && b[2] <= 32 && b[1] >= 0 && b[3] <= 64, `mask ${m}: a part off its canvas`);
      // (the feet on the cell: the run reaches the east and west edges where it goes on; the column the top and foot)
      // (a whole tile of the pack's, a run or a run's end, is drawn as it is; the crops are what reach an edge or not)
      const feet = boxes.filter((b) => b[3] > 32);
      const cut = t.parts.filter((p) => p.length > 3).map(box).filter((b) => b[3] > 32 && b[2] - b[0] !== 13);
      if (m & E) assert.ok(feet.some((b) => b[2] === 32), `mask ${m}: east edge`);
      if (m & W) assert.ok(feet.some((b) => b[0] === 0), `mask ${m}: west edge`);
      if (!(m & E)) assert.ok(!cut.some((b) => b[2] === 32), `mask ${m}: a run past the east edge`);
      if (!(m & W)) assert.ok(!cut.some((b) => b[0] === 0), `mask ${m}: a run past the west edge`);
      assert.equal(boxes.some((b) => b[1] === 0 && b[2] - b[0] === 13), !!(m & N), `mask ${m}: the column on north`);
      if (m & S) assert.ok(boxes.some((b) => b[3] === 64 && b[2] - b[0] === 13), `mask ${m}: the column on south`);
    }
});

test('the stone wall has a piece for every mask: faces to the edges it goes on to, the narrow top north and south', () => {
  for (const m of MASKS) {
    const t = stoneTile(wallJoinOf(m));
    assert.ok(t && t.parts.length, `mask ${m}`);
    const boxes = t.parts.map(box);
    for (const b of boxes) assert.ok(b[0] >= 0 && b[2] <= 32 && b[1] >= 0 && b[3] <= 80, `mask ${m}: a part off its canvas`);
    assert.equal(boxes.some((b) => b[2] === 32), !!(m & E), `mask ${m}: east edge`);
    assert.equal(boxes.some((b) => b[0] === 0), !!(m & W), `mask ${m}: west edge`);
    // (going on north, its narrow top runs up out of the raised cell; else at most its rounded end there)
    assert.equal(boxes.some((b) => b[1] === 0 && b[3] - b[1] > 5), !!(m & N), `mask ${m}: north`);
    // (going on south, the top reaches the foot of its raised cell, where the next cell's takes over)
    if (m & S) assert.ok(boxes.some((b) => b[3] === 32 && b[2] - b[0] === 13), `mask ${m}: south`);
    // (it stands on its cell: something down to the foot)
    if (!(m & S) || m & (E | W)) assert.ok(boxes.some((b) => b[3] === 80), `mask ${m}: no foot`);
  }
  // (a stretch capped against a grate stops short of the edge, its outline at the edge)
  const capped = stoneTile(wallJoinOf(E | W, E))!.parts.map(box);
  assert.ok(capped.some((b) => b[2] === 32) && !capped.some((b) => b[2] === 32 && b[2] - b[0] > 3));
});

test('the grates have the fence set\'s own piece for every mask', () => {
  for (const m of MASKS) {
    const t = grateTile(wallJoinOf(m), 1);
    assert.ok(t, `mask ${m}`);
    assert.equal(t.parts.length, 1);
    assert.equal(t.parts[0][3], GRATE_COL[pieceOf(m)] * 16);
    assert.ok(GRATE_COL[pieceOf(m)] >= 0 && GRATE_COL[pieceOf(m)] < 11);
  }
  // (the corners and joins are each their own; ends take the run they lie in)
  const cols = ['es', 'sw', 'ne', 'nw', 'esw', 'nes', 'nsw', 'new', 'nesw'].map((p) => GRATE_COL[p as keyof typeof GRATE_COL]);
  assert.equal(new Set(cols).size, cols.length);
  assert.equal(GRATE_COL.e, GRATE_COL.ew);
  assert.equal(GRATE_COL.n, GRATE_COL.ns);
});

test('a bridge has no rail across any way a road goes on, and a rail on every side none does', () => {
  for (const road of MASKS)
    for (const wet of MASKS) {
      if (wet & ~road) continue;
      for (const diag of MASKS) {
        const p = bridgePiece(road, wet, diag);
        assert.equal(p.rails & road, 0, `road ${road}`);
        assert.equal(p.rails | road, 15);
        assert.equal(p.banks, road & ~wet);
        assert.equal(p.along, road & (N | S) ? 'ns' : 'ew');
      }
    }
  // a straight bridge has no posts in its middle; a corner's rail stops at a post where the deck turns
  assert.equal(bridgePiece(N | S, N | S, 0).posts, 0);
  assert.equal(bridgePiece(E | W, E | W, 0).posts, 0);
  // (the bridge turns north and east in the cell south of this one: this cell's east rail stops at its south-east
  // corner, where the deck goes off east below it)
  assert.ok(bridgePiece(N | S, N | S, 2).posts & 2);
  assert.equal(bridgePiece(N | E, N | E, 1).posts, 0); // (the turn itself: its rails, south and west, run on)
  // (a way joining a bridge from the side: the rail breaks there, a post at each end of the break)
  const t = bridgePiece(N | S | E, N | S, 1 | 2);
  assert.equal(t.rails, W);
  assert.equal(t.banks, E);
  // (a lone cell of bridge: rails all round)
  assert.equal(bridgePiece(0, 0).rails, 15);
  // (onto a bank: the rails stop at the bank's end)
  assert.equal(bridgePiece(N | S, S, 0).posts, 1 | 8);
});

test('the roads have a quarter-tile for every way a corner of a cell can meet its neighbours', async () => {
  const tables = (await import('../src/renderer/art/roads/roadTiles.json')).default as unknown as Record<string, Record<string, [number, number]>>;
  for (const style of ['road1', 'road2', 'road4', 'road5'])
    for (const ground of ['grass', 'ground']) {
      const t = tables[`${style}_${ground}`];
      assert.ok(t, `${style}_${ground}`);
      for (const q of ['nw', 'ne', 'sw', 'se'])
        for (const key of ['000', '100', '010', '110', '111']) assert.ok(t[`${q}${key}`], `${style}_${ground} ${q}${key}`);
    }
});
