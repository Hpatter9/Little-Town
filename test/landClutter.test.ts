import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clutterOf, landmarksOf, landmarkStands } from '../src/shared/sim/landClutter';
import { groundAt, isMarked, setGround } from '../src/shared/sim/land';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type GameState } from '../src/shared/sim/state';
import { camp, clearAround, plainGame } from './helpers';

// Stumps and ruins, taken away with the Clear tool (sim/landClutter.ts; the owner's asks).

/** A felled wood's stump on a cell near the camp: open ground, its regrowth due in a while. */
function stump(s: GameState, dx: number, dy: number): number {
  const c = camp(s);
  const i = (c.y + dy) * s.land.w + c.x + dx;
  setGround(s.land, c.x + dx, c.y + dy, 'grass');
  (s.land.regrow ??= {})[i] = ['forest', s.tick + 10 * 6000];
  return i;
}

/** Steps until the cell is no longer marked (cleared), or the time is up. */
const work = (sim: Sim, i: number, ticks = 600 * 40) => {
  for (let k = 0; k < ticks && isMarked(sim.state.land, i); k++) sim.step();
};

test('a stump can be marked, is grubbed out for a little wood, and the wood does not grow back there', () => {
  const sim = new Sim(plainGame('clutter-stump'));
  const s = sim.state;
  clearAround(s, 20);
  const i = stump(s, 6, 5);
  const bare = (camp(s).y + 8) * s.land.w + camp(s).x + 6;
  assert.equal(clutterOf(s, i), 'stump');
  assert.equal(clutterOf(s, bare), null, 'plain grass is no clutter');
  sim.command({ type: 'markClear', cells: [i, bare], on: true });
  sim.step();
  assert.ok(isMarked(s.land, i), 'the stump is marked');
  assert.ok(!isMarked(s.land, bare), 'bare ground still is not');
  assert.ok((s.land.pools[i]?.wood ?? 0) > 0, 'it has wood to work out');
  work(sim, i);
  assert.ok(!isMarked(s.land, i), 'worked out');
  assert.equal(s.land.regrow?.[i], undefined, 'no regrowth left: the stump is gone for good');
  assert.equal(s.land.pools[i], undefined);
  assert.equal(groundAt(s.land, i % s.land.w, Math.floor(i / s.land.w)), 'grass');
});

test('unmarking a stump before it is worked takes its pool away again', () => {
  const sim = new Sim(plainGame('clutter-unmark'));
  const s = sim.state;
  clearAround(s, 20);
  const i = stump(s, 7, 6);
  for (const p of s.people) p.priorities = { ...p.priorities, gather: 0 };
  sim.command({ type: 'markClear', cells: [i], on: true });
  sim.step();
  assert.ok(s.land.pools[i]);
  sim.command({ type: 'markClear', cells: [i], on: false });
  sim.step();
  assert.ok(!isMarked(s.land, i));
  assert.equal(s.land.pools[i], undefined);
  assert.equal(clutterOf(s, i), 'stump', 'still a stump');
});

test("the Old Ruin's walls can be cleared like any clearing: worked for their stones, then gone", () => {
  const s = newGame('clutter-ruin', { valley: 'Old_Ruin', biome: 'forest' });
  s.autopilot = false;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  assert.equal(s.valley, 'Old_Ruin');
  const marks = landmarksOf(s.valley, s.land);
  const walls = [...marks].filter(([i, m]) => m.kind === 'wall' && clutterOf(s, i) === 'ruin').map(([i]) => i);
  assert.ok(walls.length > 4, `old walls to clear (${walls.length})`);
  const flowers = [...marks].find(([, m]) => m.kind === 'flowers');
  if (flowers) assert.equal(clutterOf(s, flowers[0]), null, 'flowers are left alone');
  // (the nearest wall to the camp)
  const c = camp(s);
  const d = (i: number) => Math.hypot((i % s.land.w) - c.x, Math.floor(i / s.land.w) - c.y);
  const wall = walls.sort((a, b) => d(a) - d(b))[0];
  const sim = new Sim(s);
  sim.command({ type: 'markClear', cells: [wall], on: true });
  sim.step();
  assert.ok(isMarked(s.land, wall));
  assert.ok((s.land.pools[wall]?.stone ?? 0) > 0, 'its stones to work out');
  const stone = s.buildings.reduce((n, b) => n + (b.store?.stone ?? 0), 0);
  work(sim, wall);
  assert.ok(!isMarked(s.land, wall), 'cleared');
  assert.ok(s.land.cleared?.includes(wall), 'remembered as cleared');
  assert.ok(!landmarkStands(s.land, wall, marks.get(wall)), 'no longer stands (the map stops drawing it)');
  assert.equal(clutterOf(s, wall), null);
  const carried = s.people.reduce((n, p) => n + (p.carrying.stone ?? 0), 0);
  assert.ok(s.buildings.reduce((n, b) => n + (b.store?.stone ?? 0), 0) + carried > stone, 'its stones were gathered');
});
