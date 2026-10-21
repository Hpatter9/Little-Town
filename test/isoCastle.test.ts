import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { castlePeopleOf, castleUrl, pieceScale, PIECE_ID, planCastle, roomPiece, SIZES, TOWER_PX, type CastlePeople } from '../src/renderer/iso/isoCastle';

const W = 40;
const core = { x: 10, y: 10, w: 6, h: 4 };
const gate = { x: 13, y: 14 };

test('every piece of each people has a picture in the art and the index', () => {
  for (const people of ['bloodcourt', 'dwarves'] as CastlePeople[])
    for (const id of Object.values(PIECE_ID[people])) {
      assert.ok(existsSync(`src/renderer/art/${castleUrl(people, id).replace('iso/', 'iso/')}`), `${people}/${id}`);
      assert.ok(SIZES[people].some((p) => p.id === id), `index ${people}/${id}`);
    }
});

test('rooms map to their pieces, anything else to the hall', () => {
  assert.equal(roomPiece('smithy'), 'forge');
  assert.equal(roomPiece('brewery'), 'brewery');
  assert.equal(roomPiece('stockpile'), 'cellar');
  assert.equal(roomPiece('library'), 'hall');
  assert.equal(castlePeopleOf('castle'), 'bloodcourt');
  assert.equal(castlePeopleOf('mountain'), 'dwarves');
  assert.equal(castlePeopleOf(undefined), null);
});

test('a bare hall gets a keep, four towers, a gate and walls round the other three sides', () => {
  const plan = planCastle({ core, gate }, [], W);
  const of = (p: string) => plan.filter((q) => q.piece === p);
  assert.equal(of('keep').length, 1);
  assert.equal(of('tower').length, 4);
  assert.equal(of('gate').length, 1);
  assert.equal(of('gate')[0].flip, false);
  // (the 6-cell south wall has the gate's 3 cells cleared: 3 cells left, in two runs; north 6 cells: 3 runs; sides 4: 2 each)
  const cells = (side: (q: (typeof plan)[0]) => boolean) => of('wall').filter(side).reduce((n, q) => n + Math.max(q.foot.w, q.foot.h), 0);
  assert.equal(cells((q) => !q.flip && q.foot.y > 12), 3);
  assert.equal(cells((q) => !q.flip && q.foot.y < 12), 6);
  assert.equal(cells((q) => q.flip), 8);
  assert.ok(of('wall').every((q) => q.flip === (q.foot.h > q.foot.w)));
});

test('rooms add pieces on their footprints, and the walls go round the whole castle', () => {
  const rooms = [{ id: 7, def: 'smithy', foot: { x: 16, y: 10, w: 3, h: 3 } }];
  const plan = planCastle({ core, gate }, rooms, W);
  const forge = plan.find((q) => q.piece === 'forge')!;
  assert.equal(forge.id, 7);
  assert.deepEqual(forge.foot, rooms[0].foot);
  // (no wall between the hall and its room: nothing stands on the shared edge x = 16 across the room's rows)
  assert.ok(!plan.some((q) => q.piece === 'wall' && q.flip && q.foot.x + WALL_HALF === 16 && q.foot.y >= 10 && q.foot.y < 13));
  assert.equal(plan.filter((q) => q.piece === 'tower').length, 5); // (the hall's west two and its south-east, the room's east two)
  // (and the draw order is the footprint's front corner)
  assert.equal(forge.depth, 16 + 3 + 10 + 3);
});

test('side gates clear their wall and lie along it', () => {
  const plan = planCastle({ core, gate, gates: [{ x: 10, y: 11, side: 'w' }] }, [], W);
  const g = plan.filter((q) => q.piece === 'gate');
  assert.equal(g.length, 2);
  assert.ok(g.some((q) => q.flip && q.foot.h > q.foot.w));
});

test('sizes: towers one height, walls as long as their cells, the keep no taller than its cap', () => {
  assert.equal(pieceScale('tower', 147, 320, 99, 0.6) * 320, TOWER_PX);
  assert.equal(pieceScale('wall', 269, 316, 58, 0.6), 58 / 269);
  assert.ok(pieceScale('keep', 265, 384, 240, 0.594) * 384 <= 230 + 1e-9);
  assert.ok(pieceScale('hall', 364, 380, 60, 0.6) * 364 <= 60 * 1.25 + 1e-9);
});

const WALL_HALF = 0.2;
