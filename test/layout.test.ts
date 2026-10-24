import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { CROPS } from '../src/shared/data/crops';
import { isSeat } from '../src/shared/data/seats';
import { doorCell, footprint, layoutOf as buildingsLayout, placeBlueprint } from '../src/shared/sim/buildings';
import { inRect, isPlannedRoad, isRoad, type Rect } from '../src/shared/sim/land';
import { BLOCK, coreRadius, CROSS, ensureLayout, layoutSpot, zoneOf } from '../src/shared/sim/layout';
import { findSpot, PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { gateCells, planRing, ringShapeOf, shapeRing, shapeTest, wantRect } from '../src/shared/sim/ringWall';
import { parseSave } from '../src/shared/sim/save';
import { newGame, type Building, type GameState } from '../src/shared/sim/state';
import { clearAround } from './helpers';

/** A new town with its plan laid down, everything learned, the land round it cleared, and the cheats' stores. */
function planned(seed: string, origin = 'settlers'): GameState {
  const s = newGame(seed, { origin: origin as 'settlers' });
  s.autopilot = true;
  s.cheats.unlockAll = true;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  clearAround(s, 40);
  ensureLayout(s);
  return s;
}

/** Build one of a kind where the town's plan puts it (finished at once). */
function build(s: GameState, id: string): Building {
  const def = BUILDING_BY_ID[id];
  const at = findSpot(s, def);
  assert.ok(at, `a spot for the ${def.name}`);
  const ok = placeBlueprint(s, id, at.x, at.y, false, false, !!at.wild);
  assert.ok(ok.ok, ok.reason ?? id);
  const b = s.buildings[s.buildings.length - 1];
  b.status = 'done';
  b.progress = 1;
  return b;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
const centre = (r: Rect) => ({ x: r.x + r.w / 2 - 0.5, y: r.y + r.h / 2 - 0.5 });

test('a new town is given a square before its seat, paved, and its streets grow with it', () => {
  const s = planned('layout-square');
  const L = layoutOf(s);
  const seat = s.buildings.find((b) => isSeat(b.def))!;
  const door = doorCell(seat);
  assert.equal(L.sq.y, door.y, "the square's top edge is before the seat's door");
  assert.equal(L.col, door.x, "the seat's door is at the square's middle");
  assert.ok(isRoad(s.land, L.col, L.row), 'the square paved (sim/townRoads.ts)');
  const homes = [0, 1, 2, 3].map(() => build(s, 'lean_to'));
  for (const h of homes) {
    const d = doorCell(h);
    assert.ok([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isRoad(s.land, d.x + dx, d.y + dy) || isPlannedRoad(s.land, d.x + dx, d.y + dy)), 'a street to each door');
  }
});

test("the ring wall's gates stand where the plan's main streets meet it", () => {
  const s = planned('layout-gates');
  const L = layoutOf(s);
  for (let k = 0; k < 6; k++) build(s, 'lean_to');
  const line = shapeRing(s, wantRect(s));
  const gates = gateCells(s, line);
  const west = gates.filter((g) => g.x < L.col - 5), east = gates.filter((g) => g.x > L.col + 5), south = gates.filter((g) => g.y > L.row + 3);
  assert.ok(west.some((g) => g.y === L.row) && east.some((g) => g.y === L.row), 'the west and east gates on the high street');
  assert.ok(south.some((g) => g.x === L.col), 'the south gate on the road south');
});

test('homes go up in rows along the side streets, their doors on the street, beside one another', () => {
  const s = planned('layout-homes');
  const L = layoutOf(s);
  const homes = Array.from({ length: 8 }, () => build(s, 'hide_tent'));
  for (const h of homes) assert.equal(mod(doorCell(h).y - L.row, BLOCK), 0, `${h.def}'s door is on a side street`);
  // (shoulder to shoulder, or across a lane or the road south from the next)
  const near = (a: Building, b: Building) => a.row === b.row && Math.max(a.tile - (b.tile + 3), b.tile - (a.tile + 3)) <= 1;
  const touching = homes.filter((h) => homes.some((o) => o !== h && near(o, h)));
  assert.ok(touching.length >= homes.length - 2, `in rows: ${touching.length} of ${homes.length} beside another`);
  // (off the craft quarter's side)
  for (const h of homes) assert.ok((centre(footprint(h)).x - L.col) * L.craft < 4, 'homes keep off the craft side');
});

test('the workshops go to the craft quarter, together, the stores by the square', () => {
  const s = planned('layout-craft');
  const L = layoutOf(s);
  for (const id of ['kiln', 'smithy', 'workbench', 'tanning_rack', 'loom', 'bloomery']) {
    const b = build(s, id);
    assert.equal(zoneOf(BUILDING_BY_ID[id]), 'craft');
    assert.ok((centre(footprint(b)).x - L.col) * L.craft > 0, `the ${id} on the craft side`);
  }
  const store = build(s, 'granary');
  const f = footprint(store);
  const gap = Math.max(0, L.sq.x - (f.x + f.w), f.x - (L.sq.x + L.sq.w), L.sq.y - (f.y + f.h), f.y - (L.sq.y + L.sq.h));
  assert.ok(gap <= 4, `the granary by the square (${gap} cells off)`);
});

test('fields go out in the belt beyond the homes', () => {
  const s = planned('layout-fields');
  const L = layoutOf(s);
  const homes = Array.from({ length: 6 }, () => footprint(build(s, 'hide_tent')));
  // (the box round the homes and the square)
  const box = { x0: Math.min(L.sq.x, ...homes.map((h) => h.x)), y0: Math.min(L.sq.y, ...homes.map((h) => h.y)), x1: Math.max(L.sq.x + L.sq.w, ...homes.map((h) => h.x + h.w)), y1: Math.max(L.sq.y + L.sq.h, ...homes.map((h) => h.y + h.h)) };
  for (const id of ['garden_plot', 'garden_plot', 'flax_field', 'goat_pen']) {
    const f = footprint(build(s, id));
    assert.ok(!!CROPS[id] || id === 'goat_pen');
    const amid = f.x < box.x1 && f.x + f.w > box.x0 && f.y < box.y1 && f.y + f.h > box.y0;
    assert.ok(!amid, `the ${id} out beyond the homes`);
    const d = Math.max(Math.abs(centre(f).x - L.col), Math.abs(centre(f).y - L.row));
    assert.ok(d <= coreRadius(s, L) + 10, `and not far out (${d.toFixed(1)} from the square)`);
  }
});

test('no building stands on a street, planned or laid, nor on the main streets to come', () => {
  const s = planned('layout-streets');
  const L = layoutOf(s);
  for (const id of ['lean_to', 'hide_tent', 'kiln', 'smithy', 'garden_plot', 'trading_post', 'fireside_inn', 'granary', 'library', 'barracks', 'graveyard', 'well', 'longhouse', 'cottage', 'goat_pen', 'sawmill'])
    build(s, id);
  for (const b of s.buildings) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++)
      for (let x = f.x; x < f.x + f.w; x++) {
        assert.ok(!isRoad(s.land, x, y) && !isPlannedRoad(s.land, x, y), `the ${b.def} stands clear of the streets`);
        if (b.def === 'campfire') continue;
        assert.ok(y !== L.row && !(x === L.col && y > L.row), `the ${b.def} keeps off the main streets' lines`);
      }
    // (in blocks: never across a lane)
    if (!CROPS[b.def] && b.def !== 'goat_pen' && b.def !== 'campfire' && !isSeat(b.def))
      for (let x = f.x; x < f.x + f.w; x++) assert.notEqual(mod(x - L.col, CROSS), 0, `the ${b.def} keeps off the lanes`);
  }
});

test('the ring wall still closes round the planned town', () => {
  const s = planned('layout-ring');
  for (const id of ['lean_to', 'hide_tent', 'hide_tent', 'kiln', 'smithy', 'trading_post', 'granary', 'library', 'longhouse', 'cottage']) build(s, id);
  planRing(s, true);
  assert.ok(s.ring, 'a ring is laid');
  const inside = shapeTest(ringShapeOf(s), s.ring!.rect);
  const line = new Set(s.ring!.line!.map((p) => `${p.x},${p.y}`));
  for (const b of s.buildings) {
    const def = BUILDING_BY_ID[b.def];
    if (b.ring !== undefined || def.layer === 'back') continue;
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.ok(inside(x, y) && !line.has(`${x},${y}`), `the ${b.def} inside the wall`);
  }
});

test('an older town is fitted with a plan round what stands, and only what is built after follows it', () => {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  assert.ok(r.ok);
  const s = r.save.state;
  s.layout = undefined;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  s.autopilot = true;
  const before = buildingsLayout(s.buildings);
  s.tick = Math.ceil(s.tick / PLAN_TICKS) * PLAN_TICKS;
  runPlanner(s);
  const L = s.layout!;
  assert.ok(L, 'a plan is laid');
  assert.equal(L.fitted, true, "it is fitted round the town's buildings");
  // (nothing that stood was moved)
  const after = buildingsLayout(s.buildings.slice(0, before.length / 6));
  assert.deepEqual(after, before);
  // (and the square is planned for its pavers: no building stood on)
  for (let y = L.sq.y; y < L.sq.y + L.sq.h; y++)
    for (let x = L.sq.x; x < L.sq.x + L.sq.w; x++) if (isPlannedRoad(s.land, x, y)) assert.ok(!s.buildings.some((b) => inRect(footprint(b), x, y)));
});

test('a town on the move has no plan; one with the autopilot off builds as before', () => {
  const s = newGame('layout-nomads', { origin: 'nomads' });
  s.autopilot = true;
  assert.equal(ensureLayout(s), null);
  const t = planned('layout-off');
  t.autopilot = false;
  assert.equal(layoutSpot(t, BUILDING_BY_ID.lean_to), null);
});

function layoutOf(s: GameState) {
  assert.ok(s.layout, 'the town has a plan');
  return s.layout!;
}
