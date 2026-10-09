import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { trail } from '../src/shared/sim/battle';
import { blueprintCount, footprint } from '../src/shared/sim/buildings';
import { groundAt, inRect, isRoad, setGround, wet, WILD } from '../src/shared/sim/land';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { gateAt, gateCells, gateTurned, isGate, isRingPiece, lineOf, PUSH_ALONG, RING_AT_ONCE, RING_GATHER_AHEAD, RING_SPARE, ringWants, RING_PAD, RING_STEP, ringCells, ringGate, riverCell, shapeRing, sideOn, wantRect, type LineCell } from '../src/shared/sim/ringWall';
import { campCell, newGame, type Building, type GameState } from '../src/shared/sim/state';
import { pathTo } from '../src/shared/sim/walk';
import { CELL, cellAt, isMarked, setMarked } from '../src/shared/sim/land';
import { bestGatherTile, clearCell } from '../src/shared/sim/people';
import { clearAround, makeWild } from './helpers';

/** A town ready to wall itself: palisades learned, the land about it clear, wood to spare, enough grown-ups. */
function walledTown(seed: string): GameState {
  const s = newGame(seed);
  s.research.done.push('palisades', 'basic_shelter');
  clearAround(s, 34);
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
  const line = shapeRing(s, r);
  const gates = gateCells(s, line);
  const sideAt = (g: { x: number; y: number }) => line.find((l) => l.x === g.x && l.y === g.y)?.side;
  for (const side of ['n', 's', 'w', 'e'] as const) assert.ok(gates.some((g) => sideAt(g) === side), `a gate on the ${side} side`);
  assert.ok(gates.some((g) => sideAt(g) === 'w' && Math.abs(g.y - c.y) <= 6), 'a gate west by the camp row');
  assert.ok(gates.some((g) => sideAt(g) === 'e' && Math.abs(g.y - c.y) <= 6), 'a gate east by the camp row');
});

test('the planner raises the ring all round, townsfolk get out through its gates, and raids come to the gate', () => {
  const s = walledTown('ring-build');
  const passes = raise(s);
  assert.ok(s.ring?.done, `ring after ${passes} passes: ${JSON.stringify(s.ring)}`);
  const r = s.ring!.rect;
  const pieces = s.buildings.filter((b) => b.ring === s.ring!.gen);
  const covered = (p: { x: number; y: number }) => pieces.some((b) => inRect(footprint(b), p.x, p.y));
  const open = lineOf(s.ring!).filter((p) => !covered(p) && !(wet(groundAt(s.land, p.x, p.y)) && !riverCell(s.land, p)));
  assert.equal(open.length, 0, `gaps at ${JSON.stringify(open)}`);
  assert.ok(pieces.filter((b) => isGate(b.def)).length >= 2, 'gates');
  // the west and east gates stand turned, down the column, covering two ring cells each
  for (const g of s.ring!.gates.filter((p) => gateTurned(s.ring!, p))) {
    const at = gateAt(s.ring!, g);
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
  const east = ringGate(s, 1)!;
  assert.deepEqual([Math.floor(end[0]), Math.floor(end[1])], [east.x, east.y]);
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
  s.buildings[0].store = { wood: 12 + Math.ceil(BUILDING_BY_ID.palisade_wall.cost.wood! * RING_SPARE) - 1, stone: 500 };
  s.tick += PLAN_TICKS;
  runPlanner(s);
  assert.equal(s.buildings.filter((b) => isRingPiece(b.def) && b.status === 'blueprint' && !b.planned).length, 0, 'no wall piece in work over the shop (the ring is laid out, planned)');
  s.buildings[0].store = { wood: 3000, stone: 500 };
  raise(s, 1, 30);
  assert.ok(s.buildings.some((b) => isRingPiece(b.def) && b.status === 'done'), 'with wood to spare, the wall goes up');
});

test("the wall is built beside the town's other work, and the town gathers wood for it (the owner: palisades never finished)", () => {
  const s = walledTown('ring-own-queue');
  // the build slots all full with the town's own sites
  for (let i = 0; i < 6; i++) s.buildings.push({ id: s.nextId++, def: 'lean_to', tile: campCell(s).x - 8 + i * 3, row: campCell(s).y + 4, status: 'blueprint', delivered: {}, progress: 0, store: {} } as Building);
  s.tick += PLAN_TICKS;
  runPlanner(s);
  const ring = s.buildings.filter((b) => b.ring === s.ring!.gen);
  assert.ok(ring.filter((b) => !b.planned).length >= 3, 'sections go into work whatever the build queue holds');
  // the planned sections' makings are wanted, so the town gathers for them
  const want = ringWants(s);
  const ahead = ring.filter((b) => b.planned).slice(0, RING_GATHER_AHEAD);
  assert.ok((want.wood ?? 0) > 0 && (want.wood ?? 0) <= ahead.reduce((k, b) => k + (BUILDING_BY_ID[b.def].cost.wood ?? 0), 0), `wood wanted: ${want.wood}`);
  // a palisade is quick and cheap: a ring of a hundred pieces is days of work, not weeks
  assert.ok(BUILDING_BY_ID.palisade_wall.cost.wood! <= 4 && BUILDING_BY_ID.palisade_wall.buildSeconds <= 20);
});

test('the whole ring is laid out as one blueprint, built a few sections at a time, and walked through meanwhile', () => {
  const s = walledTown('ring-planned');
  s.tick += PLAN_TICKS;
  runPlanner(s);
  const r = s.ring!.rect;
  const pieces = s.buildings.filter((b) => b.ring === s.ring!.gen);
  const covered = (p: { x: number; y: number }) => pieces.some((b) => inRect(footprint(b), p.x, p.y));
  // (a cell still wild waits to be cleared, the river and a road beside a gate take no wall; everything else is laid at once)
  const open = lineOf(s.ring!).filter((p) => !covered(p) && !WILD.includes(groundAt(s.land, p.x, p.y)) && !['water', 'shallows', 'mountain'].includes(groundAt(s.land, p.x, p.y)) && !isRoad(s.land, p.x, p.y));
  assert.equal(open.length, 0, `the first pass lays the whole ring: gaps at ${JSON.stringify(open)}`);
  const inWork = pieces.filter((b) => !b.planned);
  assert.ok(inWork.length > 0 && inWork.length <= RING_AT_ONCE, `${inWork.length} sections in work`);
  assert.ok(pieces.length > inWork.length * 5, 'the rest only planned');
  // the ring's sections, planned or in work, take no build slot (they have their own queue), and the gates come first
  assert.equal(blueprintCount(s), s.buildings.filter((b) => b.status === 'blueprint' && !b.planned && b.ring === undefined).length);
  const gates = pieces.filter((b) => isGate(b.def) && !b.overgrown);
  assert.ok(inWork.every((b) => isGate(b.def)) || gates.every((b) => !b.planned), 'the gates are the first sections');
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

test("the trees and rocks on the ring's line are marked to clear at once, taken first, and the wall follows them", () => {
  const s = walledTown('ring-wood');
  const r = wantRect(s);
  // a stand of trees and a rock across the top of the line (clear of the gates, which stand on the camp's row)
  const top = ringCells(r).filter((c) => c.y === r.y);
  const woods = top.slice(2, 6).map((c) => makeWild(s, c.x, c.y, 'forest', { wood: 6 }));
  const rock = makeWild(s, top[7].x, top[7].y, 'rock', { stone: 6 });
  s.tick += PLAN_TICKS;
  runPlanner(s);
  assert.ok(s.ring, 'the ring is planned');
  for (const i of [...woods, rock]) {
    assert.ok(isMarked(s.land, i), 'marked to clear');
    assert.ok(s.ring!.clearing?.includes(i), 'the ring knows its cells to clear');
    const c = cellAt(s.land, i);
    const over = s.buildings.find((b) => b.tile === c.x && b.row === c.y);
    // (a piece is laid over a tree all the same, so the whole wall shows, but only as a plan till it's cleared)
    assert.ok(!over || (over.planned && over.overgrown), 'a piece on a tree waits, planned, for it to come down');
  }
  // whoever gathers goes to the wall's line first, though a nearer tree is marked
  const camp = campCell(s);
  const near = makeWild(s, camp.x + 2, camp.y + 2, 'forest', { wood: 6 });
  setMarked(s.land, near, true);
  assert.ok([...woods, rock].includes(bestGatherTile(s, s.people[0])!), "the ring's cells first");
  // cleared (the pools worked out, as the gatherers leave them), the pieces are laid there on the next pass
  for (const i of [...woods, rock]) {
    delete s.land.pools[i];
    setMarked(s.land, i, false);
    clearCell(s, i);
  }
  const laid = (i: number) => {
    const c = cellAt(s.land, i);
    return s.buildings.some((b) => b.ring === 1 && b.tile === c.x && b.row === c.y);
  };
  // (another plan may take a pass first: the seat, the homes, the fields)
  for (let k = 0; k < 12 && ![...woods, rock].every(laid); k++) {
    s.tick += PLAN_TICKS;
    runPlanner(s);
  }
  for (const i of [...woods, rock]) assert.ok(laid(i), 'the wall follows');
});

test('where a river crosses the ring the wall is carried over it on grates; the gates stand on dry ground on all four sides', () => {
  const s = walledTown('ring-river');
  const r0 = wantRect(s);
  const c = campCell(s);
  // a stream two cells wide down the camp's column across the north side, and a lake twelve cells each way under the
  // south side (this seed's own river runs down the east side besides)
  for (let y = r0.y - 2; y <= r0.y + 2; y++) for (const x of [c.x, c.x + 1]) setGround(s.land, x, y, 'water');
  for (let x = r0.x + 2; x < r0.x + 14; x++) for (let y = r0.y + r0.h - 1; y < r0.y + r0.h + 11; y++) setGround(s.land, x, y, 'water');
  assert.ok(riverCell(s.land, { x: c.x, y: r0.y }) && !riverCell(s.land, { x: r0.x + 6, y: r0.y + r0.h - 1 }));
  raise(s);
  assert.ok(s.ring?.done, 'the ring stands all round');
  const r = s.ring!.rect;
  assert.deepEqual(r, r0);
  const grates = s.buildings.filter((b) => b.def === 'palisade_grate');
  for (const x of [c.x, c.x + 1]) assert.ok(grates.some((g) => g.tile === x && g.row === r.y && g.status === 'done' && g.ring === 1), `a grate over the stream at ${x}`);
  for (const g of grates) assert.ok(wet(groundAt(s.land, g.tile, g.row)) && riverCell(s.land, { x: g.tile, y: g.row }), 'every grate in a river');
  // (the lake is left open: no grates on its cells; this seed's own river crosses the south side at its east corner)
  assert.ok(!grates.some((g) => g.row === r.y + r.h - 1 && g.tile >= r.x + 2 && g.tile < r.x + 14), 'no grates over the lake');
  // four gates, one a side, none in the water, the north one moved aside from the stream
  const gates = s.buildings.filter((b) => isGate(b.def) && b.ring === 1);
  const side = (g: Building) => sideOn(s.ring!, { x: g.tile, y: g.row });
  assert.deepEqual(gates.map(side).sort(), ['e', 'n', 's', 'w']);
  for (const g of gates) {
    const f = footprint(g);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.ok(!wet(groundAt(s.land, x, y)), `${side(g)} gate on dry ground`);
  }
  const north = gates.find((g) => side(g) === 'n')!;
  assert.ok(north.tile + 1 < c.x || north.tile > c.x + 1, 'beside the stream');
  // the wall stands unbroken: every cell of the ring holds a piece of it, but the lake's
  const line = lineOf(s.ring!);
  for (const p of line) {
    const b = s.buildings.find((q) => isRingPiece(q.def) && q.status === 'done' && inRect(footprint(q), p.x, p.y));
    assert.ok(b || (wet(groundAt(s.land, p.x, p.y)) && !riverCell(s.land, p)), `a piece at ${p.x},${p.y}`);
  }
  // the wall never runs down a river (this seed's own river runs down the east side of the box): it stands past the far
  // bank, and only crosses rivers
  assert.ok(longestRiverRun(s, line) < PUSH_ALONG, `a run of ${longestRiverRun(s, line)} river cells on the line`);
  assert.ok(line.some((p) => p.x > r.x + r.w - 1), 'pushed out past the river on the east');
});

/** The longest run of river cells (8-connected) on a ring's line. */
function longestRiverRun(s: GameState, line: LineCell[]): number {
  const river = line.filter((p) => wet(groundAt(s.land, p.x, p.y)) && riverCell(s.land, p));
  const seen = new Set<LineCell>();
  let most = 0;
  for (const p0 of river) {
    if (seen.has(p0)) continue;
    const run = [p0];
    seen.add(p0);
    for (let i = 0; i < run.length; i++)
      for (const q of river) if (!seen.has(q) && Math.max(Math.abs(q.x - run[i].x), Math.abs(q.y - run[i].y)) === 1) {
        seen.add(q);
        run.push(q);
      }
    most = Math.max(most, run.length);
  }
  return most;
}
