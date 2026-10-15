// The ring wall as one building (the owner: "one large building they work on from anywhere and the whole thing goes up
// together as one"): one pool of materials, one progress, builders spread along the line, no piece standing before the
// whole is raised, the gates finishing with it. A breach mended after is a hole mended (a piece at a time).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { CELL } from '../src/shared/sim/land';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { finishRing, isGate, isRingPiece, ringBuilderOrder, ringDeliver, ringDeliveredShare, ringSite, ringStillNeeded, ringTotals, ringWork, ringWorkShare, syncRing } from '../src/shared/sim/ringWall';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type Building, type GameState } from '../src/shared/sim/state';
import { clearAround } from './helpers';

/** A town ready to wall itself, with its people at work (the autopilot on). */
function wallTown(seed: string): GameState {
  const s = newGame(seed);
  s.research.done.push('palisades', 'basic_shelter');
  clearAround(s, 50);
  s.buildings[0].store = { wood: 3000, stone: 500, fiber: 300, berries: 400 };
  for (let i = 0; i < 6; i++) s.people.push({ ...s.people[0], id: s.nextId++, name: `Hand ${i}` });
  s.autopilot = true;
  return s;
}
/** The pieces of the ring under way (blueprints in work). */
const live = (s: GameState) => s.buildings.filter((b) => b.ring === s.ring?.gen && b.status === 'blueprint' && !b.planned && isRingPiece(b.def));
const lay = (s: GameState) => {
  s.tick += PLAN_TICKS;
  runPlanner(s);
};

test('a ring of many pieces has one progress and one pool: work at any piece advances every piece', () => {
  const s = wallTown('wall-one-pool');
  lay(s);
  const ring = s.ring!;
  const pieces = live(s);
  assert.ok(pieces.length > 40, `${pieces.length} pieces`);
  assert.ok(pieces.every((b) => ringSite(s, b) === ring), 'every piece is the ring under way');
  const t = ringTotals(s, ring);
  // (the whole wall's makings, brought to the one pool)
  ringDeliver(s, ring, { wood: 1e6, stone: 1e6, fiber: 1e6, planks: 1e6, bricks: 1e6 } as never);
  assert.deepEqual(ringStillNeeded(s, ring), {}, 'the pool covers the whole wall');
  assert.equal(ringDeliveredShare(s, ring), 1);
  // work done "at" one piece is the wall's: no piece is ahead of the rest
  assert.equal(ringWork(s, ring, t.allSec * 0.3), false);
  syncRing(s);
  const share = ringWorkShare(s, ring);
  assert.ok(Math.abs(share - 0.3) < 1e-6, `${share}`);
  assert.ok(pieces.every((b) => Math.abs(b.progress - share) < 1e-9 && b.status === 'blueprint'), 'every piece shows the one progress');
  assert.ok(pieces.every((b) => Object.entries(BUILDING_BY_ID[b.def].cost).every(([m, n]) => Math.abs((b.delivered as Record<string, number>)[m] - (n as number)) < 1e-9)), 'each piece shows its share of the makings');
});

test('the work goes no further than the makings brought to the one pool', () => {
  const s = wallTown('wall-one-cap');
  lay(s);
  const ring = s.ring!;
  const t = ringTotals(s, ring);
  ringDeliver(s, ring, { wood: t.cost.wood! / 2 });
  const brought = ringDeliveredShare(s, ring);
  assert.ok(brought > 0 && brought < 1);
  assert.equal(ringWork(s, ring, t.allSec), false, 'not finished on half the wood');
  assert.ok(ringWorkShare(s, ring) <= brought + 1e-9, 'held back to what was brought');
});

test('no piece stands before the whole wall does, and the gates are raised with it', () => {
  const s = wallTown('wall-one-whole');
  const sim = new Sim(s);
  let gates = 0, sawWork = false, finishedAt = -1;
  for (let i = 0; i < 80000 && finishedAt < 0; i++) {
    sim.step();
    if (i % 200 === 0) Object.assign(s.buildings[0].store, { wood: 400, fiber: 50 }); // (wood to spare: the test is about how it goes up, not the gathering)
    if (!s.ring || s.ring.done) continue;
    const pieces = s.buildings.filter((b) => b.ring === s.ring!.gen && isRingPiece(b.def));
    if (pieces.some((b) => b.status === 'blueprint' && !b.planned && b.progress > 0)) sawWork = true;
    if (pieces.some((b) => b.status === 'done')) {
      // (the first tick any piece reads built, every piece in work reads built with it)
      finishedAt = s.tick;
      assert.deepEqual(pieces.filter((b) => b.status === 'blueprint' && !b.planned), [], 'the whole wall in work finished together');
      gates = pieces.filter((b) => isGate(b.def) && b.status === 'done').length;
    }
  }
  assert.ok(sawWork, 'the wall was under construction, every piece with the one progress');
  assert.ok(finishedAt > 0, 'the wall was raised');
  assert.ok(gates > 0, `the gates stood with it (${gates})`);
});

test('the builders spread along the wall and all work the one construction', () => {
  const s = wallTown('wall-one-spread');
  const sim = new Sim(s);
  const targets = new Set<number>();
  let best = 0, spreadSeen = 0;
  for (let i = 0; i < 60000 && !s.ring?.done && !s.buildings.some((b) => b.ring !== undefined && b.status === 'done'); i++) {
    sim.step();
    if (!s.ring || s.tick % 20) continue;
    const crew = s.people.filter((p) => p.task?.type === 'build' && s.buildings.find((b) => b.id === (p.task as { building: number }).building)?.ring === s.ring!.gen);
    for (const p of crew) targets.add((p.task as { building: number }).building);
    if (crew.length < 3) continue;
    best = Math.max(best, crew.length);
    let far = 0;
    for (const a of crew) for (const b of crew) far = Math.max(far, Math.hypot(a.x - b.x, a.y - b.y));
    spreadSeen = Math.max(spreadSeen, far / CELL);
  }
  assert.ok(best >= 3, `several builders at the wall at once (${best})`);
  assert.ok(targets.size >= 4, `they stood at ${targets.size} different pieces over the build`);
  assert.ok(spreadSeen >= 4, `and at points ${spreadSeen.toFixed(1)} cells apart`);
});

test('a builder looks along the line, nearest first, counting the crowded stretches further off', () => {
  const s = wallTown('wall-one-order');
  lay(s);
  const ring = s.ring!;
  const pieces = ringTotals(s, ring).live;
  const at = { x: (pieces[0].tile + 0.5) * CELL, y: (pieces[0].row + 0.5) * CELL };
  const plain = ringBuilderOrder(s, ring, at, []);
  assert.equal(plain[0], pieces[0], 'the nearest piece first');
  // the builders already standing about that piece push the next builder along the line
  const crowded = ringBuilderOrder(s, ring, at, [{ ...at }, { ...at }, { ...at }]);
  assert.notEqual(crowded[0], pieces[0], 'a crowded stretch is passed over');
  const d = (b: Building) => Math.hypot((b.tile + 0.5) * CELL - at.x, (b.row + 0.5) * CELL - at.y);
  assert.ok(d(crowded[0]) < 30 * CELL, 'but for a piece not far off');
});

test('an older save, each piece with its own progress and makings, is pooled into the one construction', () => {
  const s = wallTown('wall-one-old');
  lay(s);
  const pieces = live(s);
  for (const b of pieces.slice(0, 10)) {
    b.progress = 0.5;
    b.delivered = { ...BUILDING_BY_ID[b.def].cost };
  }
  delete s.ring!.sec;
  delete s.ring!.pool;
  const t = ringTotals(s, s.ring!);
  const sec = pieces.slice(0, 10).reduce((n, b) => n + 0.5 * BUILDING_BY_ID[b.def].buildSeconds, 0);
  assert.ok(Math.abs(s.ring!.sec! - sec) < 1e-9, 'the work pooled');
  assert.ok((s.ring!.pool!.wood ?? 0) > 0 && (s.ring!.pool!.wood ?? 0) < t.cost.wood!, 'the makings pooled');
});

test('a breach in the wall that stands is mended a piece at a time (a hole is a hole)', () => {
  const s = wallTown('wall-one-breach');
  lay(s);
  const ring = s.ring!;
  finishRing(s, ring);
  let passes = 0;
  while (!s.ring!.done && passes++ < 60) lay(s);
  assert.ok(s.ring!.done, 'the ring stands');
  const hole = s.buildings.find((b) => b.ring === ring.gen && b.def === ring.wall)!;
  hole.status = 'blueprint';
  hole.progress = 0;
  hole.delivered = {};
  assert.equal(ringSite(s, hole), null, 'a mended piece is no part of a construction: it is its own site');
});
