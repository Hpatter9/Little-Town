import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { trail } from '../src/shared/sim/battle';
import { blueprintCount, footprint } from '../src/shared/sim/buildings';
import { groundAt, inRect, isRoad, setGround, wet, WILD } from '../src/shared/sim/land';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { gateAt, gateCells, gateTurned, isGate, isRingPiece, lineOf, PUSH_ALONG, RING_WIDEN, ringProgress, RING_PAD, RING_STEP, ringCells, ringGate, riverCell, shapeRing, sideOn, wantRect, type LineCell } from '../src/shared/sim/ringWall';
import { campCell, newGame, type Building, type GameState } from '../src/shared/sim/state';
import { pathTo } from '../src/shared/sim/walk';
import { CELL, cellAt, isMarked, setMarked } from '../src/shared/sim/land';
import { bestGatherTile, clearCell, haulOrder } from '../src/shared/sim/people';
import { RING_SHAPE_OF } from '../src/shared/data/ringShapes';
import { ringShapeOf } from '../src/shared/sim/ringWall';
import { clearAround, makeWild } from './helpers';

/** A town ready to wall itself: palisades learned, the land about it clear, wood to spare, enough grown-ups. */
function walledTown(seed: string): GameState {
  const s = newGame(seed);
  s.townBuilds = true;
  s.research.done.push('palisades', 'basic_shelter');
  clearAround(s, 50);
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
  // (pushed well out, with room to grow: RING_WIDEN more each side than the town needs yet, never inside the old one)
  const want = wantRect(s);
  const r = s.ring!.rect;
  assert.ok(r.x + RING_WIDEN <= want.x && r.y + RING_WIDEN <= want.y && r.x + r.w >= want.x + want.w + RING_WIDEN && r.y + r.h >= want.y + want.h + RING_WIDEN, `ring ${JSON.stringify(r)} wants ${JSON.stringify(want)}`);
  assert.ok(r.x < first.rect.x && r.y < first.rect.y && r.x + r.w > first.rect.x + first.rect.w && r.y + r.h > first.rect.y + first.rect.h, 'outside the old ring all round');
  assert.equal(s.buildings.filter((b) => isRingPiece(b.def) && b.ring !== s.ring!.gen).length, 0, 'the old ring is down');
});

test('the wall leaves the other sites the materials they still wait on: they are carried to first', () => {
  const s = walledTown('ring-owed');
  const shop = { id: s.nextId++, def: 'trading_post', tile: campCell(s).x + 6, row: campCell(s).y + 3, status: 'blueprint', delivered: {}, progress: 0, store: {} } as Building;
  s.buildings.push(shop);
  s.tick += PLAN_TICKS;
  runPlanner(s);
  const order = haulOrder(s);
  const wall = order.filter((b) => b.ring !== undefined);
  assert.ok(wall.length > 0, 'the wall is in work');
  assert.ok(order.indexOf(shop) < order.indexOf(wall[0]), "the shop's site is served before any of the wall");
});

test("the wall is built beside the town's other work (the owner: palisades never finished)", () => {
  const s = walledTown('ring-own-queue');
  // the build slots all full with the town's own sites
  for (let i = 0; i < 6; i++) s.buildings.push({ id: s.nextId++, def: 'lean_to', tile: campCell(s).x - 8 + i * 3, row: campCell(s).y + 4, status: 'blueprint', delivered: {}, progress: 0, store: {} } as Building);
  s.tick += PLAN_TICKS;
  runPlanner(s);
  const ring = s.buildings.filter((b) => b.ring === s.ring!.gen);
  assert.ok(ring.filter((b) => !b.planned).length >= 3, 'sections go into work whatever the build queue holds');
  // a palisade is quick and cheap: a ring of a hundred pieces is days of work, not weeks
  assert.ok(BUILDING_BY_ID.palisade_wall.cost.wood! <= 4 && BUILDING_BY_ID.palisade_wall.buildSeconds <= 20);
});

test('the whole ring is one construction: laid out at once, every section in work together, walked through meanwhile (the owner: a single construction)', () => {
  const s = walledTown('ring-planned');
  s.tick += PLAN_TICKS;
  runPlanner(s);
  const r = s.ring!.rect;
  const pieces = s.buildings.filter((b) => b.ring === s.ring!.gen);
  const covered = (p: { x: number; y: number }) => pieces.some((b) => inRect(footprint(b), p.x, p.y));
  // (a cell still wild waits to be cleared, the river and a road beside a gate take no wall; everything else is laid at once)
  const open = lineOf(s.ring!).filter((p) => !covered(p) && !WILD.includes(groundAt(s.land, p.x, p.y)) && !['water', 'shallows', 'mountain'].includes(groundAt(s.land, p.x, p.y)) && !isRoad(s.land, p.x, p.y));
  assert.equal(open.length, 0, `the first pass lays the whole ring: gaps at ${JSON.stringify(open)}`);
  // every section clear of trees and rocks is in work at once; only the overgrown still wait
  assert.ok(pieces.length > 40, `${pieces.length} sections`);
  assert.deepEqual(pieces.filter((b) => b.planned && !b.overgrown), [], 'no section held back');
  // the ring's sections take no build slot: the wall is a job of its own
  assert.equal(blueprintCount(s), s.buildings.filter((b) => b.status === 'blueprint' && !b.planned && b.ring === undefined).length);
  // one figure for the whole wall
  const before = ringProgress(s)!;
  assert.equal(before.of, pieces.length);
  assert.equal(before.done, 0);
  // the wall going up is no wall yet: a way straight out over it
  const c = campCell(s);
  const path = pathTo(s, { x: (c.x + 0.5) * CELL, y: (c.y + 1.5) * CELL }, { x: (c.x + 0.5) * CELL, y: (r.y + r.h + 2.5) * CELL });
  assert.ok(path, 'a way out across the wall going up');
  const half = pieces.slice(0, Math.floor(pieces.length / 2));
  for (const b of half) finish(b);
  const mid = ringProgress(s)!;
  assert.equal(mid.done, half.length);
  assert.ok(mid.share > 0.4 && mid.share < 0.6, `about half the work: ${mid.share}`);
  const passes = raise(s);
  assert.ok(s.ring?.done, `ring after ${passes} passes`);
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

test("each people's ring takes its own shape, closes round the whole town, and keeps a gate on every side (the owner's ask)", () => {
  const lines = new Map<string, string>();
  for (const origin of ['settlers', 'knights', 'nomads', 'alchemists', 'robot', 'lich', 'druid', 'merfolk', 'fae', 'orcs'] as const) {
    const s = walledTown(`ring-shape-${origin}`);
    s.origin = origin;
    assert.equal(ringShapeOf(s), RING_SHAPE_OF[origin]);
    const r = wantRect(s);
    const line = shapeRing(s, r);
    const on = new Set(line.map((p) => `${p.x},${p.y}`));
    // (unbroken: every piece joins two others, across, down or corner to corner)
    for (const p of line) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && on.has(`${p.x + dx},${p.y + dy}`)) n++;
      assert.ok(n >= 2, `${origin}: the line joins at ${p.x},${p.y}`);
    }
    // (closed round the town: from the camp nobody gets past it without crossing it)
    const c = campCell(s);
    const seen = new Set([`${c.x},${c.y}`]);
    const q = [c];
    for (let i = 0; i < q.length; i++)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = q[i].x + dx, y = q[i].y + dy, k = `${x},${y}`;
        if (seen.has(k) || on.has(k)) continue;
        assert.ok(Math.abs(x - c.x) < 60 && Math.abs(y - c.y) < 60, `${origin}: closed round the camp`);
        seen.add(k);
        q.push({ x, y });
      }
    for (const b of s.buildings) assert.ok(seen.has(`${b.tile},${b.row}`), `${origin}: ${b.def} inside`);
    const gates = gateCells(s, line);
    const sideAt = (g: { x: number; y: number }) => line.find((l) => l.x === g.x && l.y === g.y)?.side;
    for (const side of ['n', 's', 'w', 'e'] as const) assert.ok(gates.some((g) => sideAt(g) === side), `${origin}: a gate on the ${side} side`);
    lines.set(origin, line.map((p) => `${p.x - c.x},${p.y - c.y}`).sort().join(' '));
  }
  assert.equal(new Set([...lines.values()]).size, lines.size, 'every shape its own');
});

test('a star fort is raised all round like any ring', () => {
  const s = walledTown('ring-star');
  s.origin = 'knights';
  raise(s);
  assert.ok(s.ring?.done, 'the ring stands');
  assert.ok(lineOf(s.ring!).length > ringCells(s.ring!.rect).length, 'the bastions reach past the box');
});

import { JOBS, type Job, type Priority } from '../src/shared/data/people';
import { firewoodWanted } from '../src/shared/sim/hardship';
import { newTickContext, updatePerson } from '../src/shared/sim/people';
import { Rng } from '../src/shared/rng';
import { TICKS_PER_DAY } from '../src/shared/sim/time';

test("from autumn the wall leaves the winter's firewood on the pile (docs/notes/winter-plague-delves.md)", () => {
  const carries = (day: number) => {
    const s = walledTown(`ring-firewood-${day}`);
    s.autopilot = true;
    s.tick += PLAN_TICKS;
    runPlanner(s);
    // (only the wall in work)
    s.buildings = s.buildings.filter((b) => b.status === 'done' || b.ring !== undefined);
    s.tick = day * TICKS_PER_DAY + (s.tick % TICKS_PER_DAY);
    s.buildings[0].store = { wood: Math.floor(firewoodWanted({ ...s, tick: 22 * TICKS_PER_DAY } as GameState) / 2), stone: 500, fiber: 300, berries: 400 };
    const p = s.people[1];
    p.priorities = Object.fromEntries(JOBS.map((j) => [j, j === 'haul' ? 1 : 0])) as Record<Job, Priority>;
    p.task = null;
    p.needs = { food: 1, rest: 1 };
    updatePerson(s, p, new Rng(3), newTickContext());
    return p.task?.type === 'fetch' ? (p.task.amounts.wood ?? 0) : 0;
  };
  assert.ok(carries(12) > 0, 'in summer the wood goes to the wall');
  assert.equal(carries(22), 0, 'in autumn the firewood stays on the pile');
});
