import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace, footprint, overgrownCells, placeBlueprint } from '../src/shared/sim/buildings';
import { buildable, cellAt, groundAt, idx, isMarked, setMarked } from '../src/shared/sim/land';
import { bestGatherTile, clearCell } from '../src/shared/sim/people';
import { findSpot, PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { canWork } from '../src/shared/sim/property';
import { blockedBy } from '../src/shared/sim/walk';
import { camp, clearAround, makeWild, plainGame } from './helpers';

test("a blueprint laid over trees and rocks waits for them: they're marked and taken first, nobody builds till they're gone", () => {
  const s = plainGame('site-wild');
  clearAround(s, 20);
  s.research.done.push('basic_shelter');
  const c = camp(s);
  const def = BUILDING_BY_ID.lean_to;
  const x = c.x + 6, y = c.y + 4;
  const wild = [makeWild(s, x, y, 'forest', { wood: 5 }), makeWild(s, x + 1, y, 'rock', { stone: 5 })];
  assert.equal(canPlace(s, def, x, y).ok, false, 'not over the wild unless asked');
  assert.ok(placeBlueprint(s, def.id, x, y, false, false, true).ok);
  const b = s.buildings[s.buildings.length - 1];
  assert.equal(b.overgrown, true);
  assert.deepEqual(overgrownCells(s, b).sort(), [...wild].sort());
  assert.equal(canWork(s, s.people[0], b), false, 'nobody builds on it yet');
  assert.equal(blockedBy(s)(x, y), false, 'walked into, to fell the trees');
  // marked to clear at once (and kept marked by the planner), and whoever gathers takes them before a nearer tree
  for (const i of wild) assert.ok(isMarked(s.land, i), 'marked');
  s.autopilot = true;
  s.tick = Math.ceil(s.tick / PLAN_TICKS) * PLAN_TICKS;
  runPlanner(s);
  for (const i of wild) assert.ok(isMarked(s.land, i), 'still marked');
  const near = makeWild(s, c.x + 1, c.y + 2, 'forest', { wood: 5 });
  setMarked(s.land, near, true);
  assert.ok(wild.includes(bestGatherTile(s, s.people[0])!), "the site's cells first");
  // cleared, the site is free to build
  for (const i of wild) {
    delete s.land.pools[i];
    setMarked(s.land, i, false);
    clearCell(s, i);
  }
  assert.equal(b.overgrown, undefined);
  assert.ok(buildable(groundAt(s.land, x, y)));
  assert.equal(canWork(s, s.people[0], b), true);
  assert.equal(blockedBy(s)(x, y), true, 'a site in work is walked round');
});

test('the town builds near over a wood rather than far on open ground, and never over a vein', () => {
  const s = plainGame('site-spot');
  clearAround(s, 20);
  const c = camp(s);
  // a wood all round the camp out to 7 cells, the camp's own few cells open
  for (let y = c.y - 7; y <= c.y + 7; y++)
    for (let x = c.x - 7; x <= c.x + 7; x++) {
      if (Math.abs(x - c.x) <= 1 && Math.abs(y - c.y) <= 1) continue;
      if (s.buildings.some((b) => { const f = footprint(b); return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h; })) continue;
      makeWild(s, x, y, 'forest', { wood: 4 });
    }
  const def = BUILDING_BY_ID.lean_to;
  const at = findSpot(s, def);
  assert.ok(at, 'a spot');
  assert.ok(Math.max(Math.abs(at!.x - c.x), Math.abs(at!.y - c.y)) <= 7, 'in the wood, near the camp');
  assert.equal(at!.wild, true);
  // a vein (ore in the pool) is never built over
  for (let y = c.y - 7; y <= c.y + 7; y++) for (let x = c.x - 7; x <= c.x + 7; x++) if (groundAt(s.land, x, y) === 'forest') makeWild(s, x, y, 'rock', { iron_ore: 3 });
  const at2 = findSpot(s, def);
  if (at2) {
    const f = { x: at2.x, y: at2.y, w: def.width, h: 2 };
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.ok(!(s.land.pools[idx(s.land, x, y)] as Record<string, number> | undefined)?.iron_ore, `not over ore at ${x},${y}`);
  }
  void cellAt;
});
