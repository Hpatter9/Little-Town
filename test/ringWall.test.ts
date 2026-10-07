import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { trail } from '../src/shared/sim/battle';
import { blueprintCount, footprint } from '../src/shared/sim/buildings';
import { groundAt, inRect, isRoad, WILD } from '../src/shared/sim/land';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { gateAt, gateCells, gateTurned, isGate, isRingPiece, RING_AT_ONCE, RING_PAD, RING_STEP, ringCells, wantRect } from '../src/shared/sim/ringWall';
import { campCell, newGame, type Building, type GameState } from '../src/shared/sim/state';
import { pathTo } from '../src/shared/sim/walk';
import { CELL } from '../src/shared/sim/land';
import { clearAround } from './helpers';

/** A town ready to wall itself: palisades learned, the land about it clear, wood to spare, enough grown-ups. */
function walledTown(seed: string): GameState {
  const s = newGame(seed);
  s.research.done.push('palisades', 'basic_shelter');
  clearAround(s, 24);
  s.buildings[0].store = { wood: 3000, stone: 500, fiber: 300, berries: 400 };
  for (let i = 0; i < 6; i++) s.people.push({ ...s.people[0], id: s.nextId++, name: `Hand ${i}` });
  return s;
}
/** Planner passes, the ring's blueprints finished between them (as if built), until the ring stands or `most` passes. */
function raise(s: GameState, gen = 1, most = 400): number {
  let passes = 0;
  while (passes < most && !(s.ring?.done && s.ring.gen >= gen)) {
    s.tick += PLAN_TICKS;
    runPlanner(s);
    for (const b of s.buildings) if (b.status === 'blueprint' && !b.planned) finish(b); // (everything in work is built between passes)
    passes++;
  }
  return passes;
}
const finish = (b: Building) => {
  b.status = 'done';
  b.progress = 1;
  b.hp = BUILDING_BY_ID[b.def].hp;
};

test('the ring is laid a few cells outside the town, stepped out from the camp, with gates on the camp row', () => {
  const s = walledTown('ring-rect');
  const r = wantRect(s);
  const c = campCell(s);
  for (const b of s.buildings) {
    const f = footprint(b);
    assert.ok(f.x >= r.x + RING_PAD && f.x + f.w - 1 <= r.x + r.w - 1 - RING_PAD, `${b.def} inside`);
    assert.ok(f.y >= r.y + RING_PAD && f.y + f.h - 1 <= r.y + r.h - 1 - RING_PAD, `${b.def} inside`);
  }
  assert.equal((c.x - r.x) % RING_STEP, 0);
  assert.equal((r.x + r.w - 1 - c.x) % RING_STEP, 0);
  const cells = ringCells(r);
  assert.equal(cells.length, 2 * (r.w + r.h) - 4);
  assert.equal(new Set(cells.map((p) => `${p.x},${p.y}`)).size, cells.length);
  const gates = gateCells(s, r);
  assert.ok(gates.some((g) => g.x === r.x && g.y === c.y), 'a gate west on the camp row');
  assert.ok(gates.some((g) => g.x === r.x + r.w - 1 && g.y === c.y), 'a gate east on the camp row');
});

test('the planner raises the ring all round, townsfolk get out through its gates, and raids come to the gate', () => {
  const s = walledTown('ring-build');
  const passes = raise(s);
  assert.ok(s.ring?.done, `ring after ${passes} passes: ${JSON.stringify(s.ring)}`);
  const r = s.ring!.rect;
  const pieces = s.buildings.filter((b) => b.ring === s.ring!.gen);
  const covered = (p: { x: number; y: number }) => pieces.some((b) => inRect(footprint(b), p.x, p.y));
  const open = ringCells(r).filter((p) => !covered(p));
  assert.equal(open.length, 0, `gaps at ${JSON.stringify(open)}`);
  assert.ok(pieces.filter((b) => isGate(b.def)).length >= 2, 'gates');
  // the west and east gates stand turned, down the column, covering two ring cells each
  for (const g of s.ring!.gates.filter((p) => gateTurned(r, p))) {
    const at = gateAt(r, g);
    const gate = pieces.find((b) => isGate(b.def) && b.tile === at.x && b.row === at.y);
    assert.ok(gate?.turned, `a turned gate at ${JSON.stringify(at)}`);
    const f = footprint(gate!);
    assert.deepEqual([f.w, f.h], [1, 2]);
    assert.ok(covered({ x: at.x, y: at.y + 1 }), 'the cell below is the gate too');
  }
  assert.ok(pieces.every((b) => b.status === 'done'));
  // out through a gate: a way from the camp to beyond the wall
  const c = campCell(s);
  const from = { x: (c.x + 0.5) * CELL, y: (c.y + 1.5) * CELL };
  const to = { x: (r.x + r.w + 2.5) * CELL, y: (c.y + 0.5) * CELL };
  const path = pathTo(s, from, to);
  assert.ok(path, 'a way out');
  assert.ok(path!.some((p) => isGate(s.buildings.find((b) => inRect(footprint(b), Math.floor(p.x / CELL), Math.floor(p.y / CELL)))?.def ?? '')), 'through a gate');
  // the raid's trail ends at the east gate
  const t = trail(s, 1);
  const end = t[t.length - 1];
  assert.deepEqual([Math.floor(end[0]), Math.floor(end[1])], [r.x + r.w - 1, c.y]);
});

test('when the town grows past its wall a wider ring goes up outside, and the old one comes down once it stands', () => {
  const s = walledTown('ring-grow');
  raise(s);
  const first = s.ring!;
  // a home beyond the east wall
  const c = campCell(s);
  s.buildings.push({ id: s.nextId++, def: 'lean_to', tile: first.rect.x + first.rect.w + 1, row: c.y - 1, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  raise(s, first.gen + 1);
  assert.equal(s.ring!.gen, first.gen + 1);
  assert.ok(s.ring!.done, 'the wider ring stands');
  assert.ok(s.ring!.rect.x + s.ring!.rect.w > first.rect.x + first.rect.w, 'wider to the east');
  assert.equal(s.buildings.filter((b) => isRingPiece(b.def) && b.ring !== s.ring!.gen).length, 0, 'the old ring is down');
});

test('the wall leaves the other sites the materials they still wait on', () => {
  const s = walledTown('ring-owed');
  // a shop's site waits on 12 wood; the store holds just enough for it and one wall piece
  s.buildings.push({ id: s.nextId++, def: 'trading_post', tile: campCell(s).x + 6, row: campCell(s).y + 3, status: 'blueprint', delivered: {}, progress: 0, store: {} } as Building);
  s.buildings[0].store = { wood: 12 + BUILDING_BY_ID.palisade_wall.cost.wood! * 3 - 1, stone: 500 };
  s.tick += PLAN_TICKS;
  runPlanner(s);
  assert.equal(s.buildings.filter((b) => isRingPiece(b.def) && b.status === 'blueprint' && !b.planned).length, 0, 'no wall piece in work over the shop (the ring is laid out, planned)');
  s.buildings[0].store = { wood: 3000, stone: 500 };
  raise(s, 1, 30);
  assert.ok(s.buildings.some((b) => isRingPiece(b.def) && b.status === 'done'), 'with wood to spare, the wall goes up');
});

test('the whole ring is laid out as one blueprint, built a few sections at a time, and walked through meanwhile', () => {
  const s = walledTown('ring-planned');
  s.tick += PLAN_TICKS;
  runPlanner(s);
  const r = s.ring!.rect;
  const pieces = s.buildings.filter((b) => b.ring === s.ring!.gen);
  const covered = (p: { x: number; y: number }) => pieces.some((b) => inRect(footprint(b), p.x, p.y));
  // (a cell still wild waits to be cleared, the river and a road beside a gate take no wall; everything else is laid at once)
  const open = ringCells(r).filter((p) => !covered(p) && !WILD.includes(groundAt(s.land, p.x, p.y)) && !['water', 'shallows', 'mountain'].includes(groundAt(s.land, p.x, p.y)) && !isRoad(s.land, p.x, p.y));
  assert.equal(open.length, 0, `the first pass lays the whole ring: gaps at ${JSON.stringify(open)}`);
  const inWork = pieces.filter((b) => !b.planned);
  assert.ok(inWork.length > 0 && inWork.length <= RING_AT_ONCE, `${inWork.length} sections in work`);
  assert.ok(pieces.length > inWork.length * 5, 'the rest only planned');
  // the planned pieces take no build slot, and the gates come first
  assert.equal(blueprintCount(s), s.buildings.filter((b) => b.status === 'blueprint' && !b.planned).length);
  assert.ok(inWork.every((b) => isGate(b.def)), 'the gates are the first sections');
  // the planned line is no wall yet: a way straight out over it
  const c = campCell(s);
  const path = pathTo(s, { x: (c.x + 0.5) * CELL, y: (c.y + 1.5) * CELL }, { x: (c.x + 0.5) * CELL, y: (r.y + r.h + 2.5) * CELL });
  assert.ok(path, 'a way out across the planned wall');
  // built section by section, the ring stands in the end
  const passes = raise(s);
  assert.ok(s.ring?.done, `ring after ${passes} passes`);
  assert.ok(passes > 5, `built over ${passes} passes, not all at once`);
  assert.ok(s.buildings.filter((b) => b.ring === s.ring!.gen).every((b) => b.status === 'done' && !b.planned));
});
