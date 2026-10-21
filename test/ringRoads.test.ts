import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { builtOn, layStreet } from '../src/shared/sim/buildings';
import { idx, isPlannedRoad, isRoad, planRoad, setRoad } from '../src/shared/sim/land';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { isGate, lineOf, missingPieces, ringWallCells, wallOnly } from '../src/shared/sim/ringWall';
import { streetsHourly } from '../src/shared/sim/streets';
import { campCell, newGame, type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { clearAround } from './helpers';

function walled(seed: string): GameState {
  const s = newGame(seed);
  s.townBuilds = true;
  s.research.done.push('palisades', 'basic_shelter');
  clearAround(s, 50);
  s.buildings[0].store = { wood: 3000, stone: 500, fiber: 300, berries: 400 };
  for (let i = 0; i < 6; i++) s.people.push({ ...s.people[0], id: s.nextId++, name: `Hand ${i}` });
  const finish = (b: Building) => Object.assign(b, { status: 'done', progress: 1, hp: BUILDING_BY_ID[b.def].hp });
  for (let n = 0; n < 400 && !s.ring?.done; n++) {
    s.tick += PLAN_TICKS;
    runPlanner(s);
    for (const b of s.buildings) if (b.status === 'blueprint' && !b.planned) finish(b);
  }
  assert.ok(s.ring?.done, 'the ring stands');
  return s;
}

test('no road over the ring wall but at a gate; old roads there are lifted so the wall is raised again', () => {
  const s = walled('ring-roads');
  const ring = s.ring!;
  const camp = campCell(s);
  // (a wall piece on the west side, away from the gates, is destroyed)
  const west = lineOf(ring).filter((l) => l.side === 'w' && ringWallCells(s).has(idx(s.land, l.x, l.y)));
  const p = west.find((l) => Math.abs(l.y - camp.y) > 3 && builtOn(s, l.x, l.y) && !isGate(builtOn(s, l.x, l.y)!.def))!;
  assert.ok(p, 'a wall piece to break');
  s.buildings = s.buildings.filter((b) => b !== builtOn(s, p.x, p.y));
  assert.ok(wallOnly(s, p.x, p.y), 'the broken piece is the wall\'s ground');

  // (a street wanted straight through the gap goes round by a gate, never over the gap)
  assert.ok(layStreet(s, { x: p.x + 1, y: p.y }, { x: p.x - 3, y: p.y }, 400));
  for (const i of ringWallCells(s)) {
    const x = i % s.land.w, y = Math.floor(i / s.land.w);
    if (!wallOnly(s, x, y)) continue;
    assert.ok(!isPlannedRoad(s.land, x, y) && !isRoad(s.land, x, y), `no street on the wall at ${x},${y}`);
  }

  // (an older save's road and planned street over the gap are lifted on the hour, and the wall wanted there again)
  setRoad(s.land, p.x, p.y);
  planRoad(s.land, p.x, p.y);
  s.tick = Math.ceil((s.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  streetsHourly(s);
  assert.ok(!isRoad(s.land, p.x, p.y) && !isPlannedRoad(s.land, p.x, p.y), 'the road is lifted');
  assert.ok(missingPieces(s, ring).some((m) => m.at.x === p.x && m.at.y === p.y), 'the wall is wanted there again');
});
