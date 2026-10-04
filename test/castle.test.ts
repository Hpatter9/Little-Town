import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { canPlace, doorCell, footprint, placeBlueprint } from '../src/shared/sim/buildings';
import { castleBounds, castleCells, castleGate, castleLayout, castleStep, coreRect, joinsCastle, roomKind, rooms, sharedEdges } from '../src/shared/sim/castle';
import { delvePool, GEM_DEPTH, GOLD_DEPTH, groundAt, idx, inMap, isRoad, MOUNTAIN_FOOT } from '../src/shared/sim/land';
import { Rng } from '../src/shared/rng';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { pathTo } from '../src/shared/sim/walk';
import { clearAround, put } from './helpers';

/** The castle's cells without one room's own (a mountain hold's galleries under it too). */
function cellsWithout(s: ReturnType<typeof newGame>, id: number): Set<number> {
  const others = { ...s, buildings: s.buildings.filter((b) => b.id !== id) };
  const cells = castleCells(others);
  const b = s.buildings.find((q) => q.id === id)!;
  const f = footprint(b);
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) cells.delete(idx(s.land, x, y));
  return cells;
}

test('a Blood Court builds one castle: rooms built on to the hall and each other, everything else kept clear of it', () => {
  const sim = new Sim(newGame('castle-grows', { origin: 'vampire' }));
  const s = sim.state;
  for (let t = 0; t < 10 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const built = rooms(s);
  assert.ok(built.length >= 6, `rooms: ${built.length}`);
  for (const b of built) assert.ok(joinsCastle(cellsWithout(s, b.id), s.land, footprint(b)), `${b.def} is built on to the castle`);
  // the castle has grown beyond the hall
  const core = coreRect(s);
  const bounds = castleBounds(s);
  assert.ok(bounds.w * bounds.h > core.w * core.h, 'grown');
  // fields, pens, mines, walls, the shop and tavern never stand on it (the fire and the first stores at the camp aside)
  const cells = castleCells(s);
  for (const b of s.buildings.filter((q) => !q.room && q.def !== 'campfire' && q.def !== 'stockpile')) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.ok(!cells.has(idx(s.land, x, y)), `${b.def} off the castle`);
  }
  // no road runs through the castle (the first roads ran to the gate)
  for (const i of cells) {
    const x = i % s.land.w;
    const y = Math.floor(i / s.land.w);
    assert.ok(!isRoad(s.land, x, y) || !inMap(s.land, x, y), `no road at ${x},${y}`);
  }
  const snap = snapshot(s).castle!;
  assert.equal(snap.cells.length, cells.size);
  assert.deepEqual(snap.gate, castleGate(s));
});

test('other towns spread out as before, with no castle', () => {
  const sim = new Sim(newGame('no-castle', { origin: 'settlers' }));
  for (let t = 0; t < 4 * TICKS_PER_DAY; t++) sim.step();
  assert.ok(!sim.state.buildings.some((b) => b.room));
  assert.equal(snapshot(sim.state).castle, null);
});

test('a room must share a wall with the castle; nothing else may come within a cell of it', () => {
  const s = newGame('attach', { origin: 'vampire' });
  const core = coreRect(s);
  clearAround(s, 12); // (open ground all round the hall)
  const cottage = BUILDING_BY_ID.cottage;
  assert.ok(roomKind(s, cottage));
  assert.ok(!roomKind(s, BUILDING_BY_ID.garden_plot));
  assert.ok(!roomKind(s, BUILDING_BY_ID.trading_post), 'the shop keeps its own building');
  assert.ok(!roomKind(s, BUILDING_BY_ID.fireside_inn), 'so does the tavern');
  // against the hall's west wall: on; a cell away from it: not
  const west = { x: core.x - cottage.width, y: core.y };
  assert.equal(canPlace(s, cottage, west.x, west.y).ok, true, 'against the hall');
  assert.equal(canPlace(s, cottage, west.x - 1, west.y).ok, false, 'a cell short of it');
  assert.equal(canPlace(s, cottage, core.x, core.y).ok, false, 'over the hall');
  assert.equal(canPlace(s, BUILDING_BY_ID.garden_plot, west.x, west.y).ok, false, 'a field against it');
  assert.equal(canPlace(s, BUILDING_BY_ID.garden_plot, west.x - 1, west.y).ok, false, 'a field a cell from it');
  const clear = canPlace(s, BUILDING_BY_ID.garden_plot, west.x - 3, west.y);
  assert.equal(clear.ok, true, `a field two cells clear: ${clear.reason}`);
  const first = put(s, 'cottage', west.x, west.y, { room: true });
  assert.equal(canPlace(s, cottage, west.x, west.y).ok, false, 'rooms never overlap');
  // the castle grows outward: a room on to the new room, further from the hall
  const next = { x: west.x - cottage.width, y: west.y };
  assert.equal(canPlace(s, cottage, next.x, next.y).ok, true, 'on to the new room');
  const before = castleBounds(s);
  put(s, 'cottage', next.x, next.y, { room: true });
  assert.ok(castleBounds(s).w > before.w, 'wider');
  // its door is its own middle, inside
  const d = doorCell(first);
  assert.deepEqual(d, { x: west.x + Math.floor(cottage.width / 2), y: west.y + Math.floor(footprint(first).h / 2) });
  // snugness: a spot sharing more walls scores higher
  const cells = castleCells(s);
  assert.ok(sharedEdges(cells, s.land, { x: west.x, y: west.y + footprint(first).h, w: cottage.width, h: 2 }) > 0);
  assert.equal(sharedEdges(cells, s.land, { x: west.x, y: west.y, w: 1, h: 1 }), -1, 'overlapping');
});

test('inside the walls people go room to room by the doorways, and in and out by the gate', () => {
  const s = newGame('through', { origin: 'vampire' });
  const core = coreRect(s);
  // a room built on to the hall's east side
  const room = put(s, 'longhouse', core.x + core.w, core.y, { room: true });
  const f = footprint(room);
  const layout = castleLayout(s)!;
  const ok = castleStep(s, layout);
  const cellOfPt = (p: { x: number; y: number }) => ({ x: Math.floor(p.x / 32), y: Math.floor(p.y / 32) });
  const walkFrom = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const path = pathTo(s, from, to);
    assert.ok(path, 'a way');
    // every step keeps to the walls: no crossing a wall but at a doorway or the gate
    let prev = cellOfPt(from);
    for (const p of path!) {
      const c = cellOfPt(p);
      if (c.x !== prev.x && c.y !== prev.y) assert.ok(ok(prev.x, prev.y, c.x, prev.y) && ok(c.x, prev.y, c.x, c.y), `diagonal ${prev.x},${prev.y} to ${c.x},${c.y}`);
      else if (c.x !== prev.x || c.y !== prev.y) assert.ok(ok(prev.x, prev.y, c.x, c.y), `step ${prev.x},${prev.y} to ${c.x},${c.y}`);
      prev = c;
    }
    return path!;
  };
  // from the hall into the room: through the one doorway between them
  const doorV = [...layout.doors].find((k) => k.endsWith('|v') && Number(k.split(',')[0]) === f.x);
  assert.ok(doorV, 'a doorway in the wall the hall and the room share');
  walkFrom({ x: (core.x + 1.5) * 32, y: (core.y + 1.5) * 32 }, { x: (f.x + f.w - 1.5) * 32, y: (f.y + 1.5) * 32 });
  // from the room out to the land below: back through the hall and out of the gate
  const gate = castleGate(s);
  const out = walkFrom({ x: (f.x + f.w - 1.5) * 32, y: (f.y + 1.5) * 32 }, { x: (f.x + f.w - 1.5) * 32, y: (f.y + f.h + 4.5) * 32 });
  assert.ok(out.some((p) => cellOfPt(p).x === gate.x && cellOfPt(p).y === gate.y), 'out by the gate');
  // and the walls really are shut: no step out of the room's south side
  assert.equal(ok(f.x + 1, f.y + f.h - 1, f.x + 1, f.y + f.h), false);
});

test('a Deep Hold is cut into the mountain: half the land is rock, the halls carved into it behind one gate', () => {
  const s = newGame('hold', { origin: 'dwarves' });
  const m = s.land;
  const c = m.camp;
  assert.equal(groundAt(m, c.x + 12, c.y - 10), 'mountain', 'the mountain north of the camp');
  assert.equal(groundAt(m, c.x, 2), 'mountain', 'to the land\'s edge');
  assert.notEqual(groundAt(m, c.x, c.y + 2), 'mountain', 'terrain south of it');
  const core = coreRect(s);
  assert.equal(groundAt(m, core.x, core.y), 'hall', 'the entrance hall cut out');
  assert.equal(groundAt(m, c.x, c.y - MOUNTAIN_FOOT), 'hall', 'down to the mountain\'s foot');
  assert.deepEqual(castleGate(s), { x: core.x + Math.floor(core.w / 2), y: core.y + core.h }, 'the gate on the terrain below');
  for (const b of rooms(s)) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.equal(groundAt(m, x, y), 'hall', `${b.def} cut into the rock`);
  }
  // a hall goes into the rock beside the entrance hall, never onto the terrain below the gate
  const bench = BUILDING_BY_ID.workbench;
  const east = { x: core.x + core.w, y: core.y };
  assert.equal(canPlace(s, bench, east.x, east.y).ok, true, 'cut into the rock east of the hall');
  assert.equal(canPlace(s, bench, core.x, core.y + core.h).ok, false, 'not on the terrain');
  clearAround(s, 12);
  const field = canPlace(s, BUILDING_BY_ID.garden_plot, core.x - 6, core.y + core.h + 1);
  assert.equal(field.ok, true, `a field on the terrain, clear of the hold: ${field.reason}`);
  assert.ok(placeBlueprint(s, 'workbench', east.x, east.y).ok, 'placed');
  assert.equal(groundAt(m, east.x, east.y), 'hall', 'its ground cut out as work begins');
  // the mountain is solid: no way through the rock, only in by the hall
  const from = { x: (c.x + 0.5) * 32, y: (c.y + 0.5) * 32 };
  assert.equal(pathTo(s, from, { x: (c.x + 20.5) * 32, y: (c.y - 12.5) * 32 }), null, 'no way through the rock');
  assert.ok(pathTo(s, from, { x: (east.x + 0.5) * 32, y: (east.y + 0.5) * 32 }), 'a way into the new hall');
});

test('a Deep Hold grows its halls into the mountain over the days', () => {
  const sim = new Sim(newGame('hold-grows', { origin: 'dwarves' }));
  const s = sim.state;
  for (let t = 0; t < 10 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const built = rooms(s);
  assert.ok(built.length >= 5, `rooms: ${built.length}`);
  for (const b of built) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.equal(groundAt(s.land, x, y), 'hall', `${b.def} in the mountain`);
    assert.ok(joinsCastle(cellsWithout(s, b.id), s.land, f), `${b.def} built on to the hold`);
  }
  for (const b of s.buildings.filter((q) => !q.room)) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.notEqual(groundAt(s.land, x, y), 'mountain', `${b.def} outside the rock`);
  }
});

test('the mountain holds richer veins the deeper in: stone at the face, gold and gems far in', () => {
  const rolls = (depth: number) => Array.from({ length: 60 }, (_, k) => delvePool(depth, Rng.from(1234, k)));
  for (const p of rolls(1)) {
    assert.ok((p.stone ?? 0) > 0, 'stone at the face');
    assert.ok(!p.gold && !p.gems, 'no gold or gems at the face');
  }
  assert.ok(rolls(GOLD_DEPTH + 2).some((p) => (p.gold ?? 0) > 0), 'gold once in a while a few rows in');
  assert.ok(rolls(GEM_DEPTH + 3).some((p) => (p.gems ?? 0) > 0), 'gems deeper still');
  assert.ok(rolls(14).filter((p) => (p.gold ?? 0) > 0).length > rolls(GOLD_DEPTH).filter((p) => (p.gold ?? 0) > 0).length, 'richer the deeper');
});

test('a Deep Hold digs on into the mountain: faces beside its halls open, dug out they become galleries', () => {
  const sim = new Sim(newGame('hold-digs', { origin: 'dwarves' }));
  const s = sim.state;
  for (let t = 0; t < 12 * TICKS_PER_DAY && !s.gameOver; t++) sim.step();
  const m = s.land;
  let faces = 0;
  let galleries = 0;
  const roomCells = new Set<number>();
  for (const b of rooms(s)) {
    const f = footprint(b);
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) roomCells.add(idx(m, x, y));
  }
  const core = coreRect(s);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const g = groundAt(m, x, y);
      if (g === 'mountain' && m.pools[idx(m, x, y)]) faces++;
      if (g === 'hall' && !roomCells.has(idx(m, x, y)) && !(x >= core.x && x < core.x + core.w && y >= core.y && y < core.y + core.h)) galleries++;
    }
  assert.ok(faces > 0, 'faces of rock with their veins');
  assert.ok(galleries > 0, `galleries dug: ${galleries}`);
  for (const i of Object.keys(m.pools).map(Number)) {
    const c = { x: i % m.w, y: Math.floor(i / m.w) };
    if (groundAt(m, c.x, c.y) === 'mountain') assert.ok(m.pools[i].stone !== undefined || Object.keys(m.pools[i]).length > 0, 'a face holds something');
  }
});

test('a dwarf town is always founded at the foot of its mountain, whatever the land', () => {
  for (const biome of ['forest', 'desert', 'tundra', 'coast'] as const)
    for (const seed of ['m1', 'm2']) {
      const s = newGame(`hold-${seed}`, { origin: 'dwarves', biome } as never);
      const cells = s.land.cells;
      const mountain = [...cells].filter((c) => c === 'M').length;
      assert.ok(mountain > s.land.w * s.land.h * 0.3, `${biome}: a mountain to carve (${mountain} cells)`);
      assert.ok([...cells].some((c) => c === 'H'), `${biome}: the hall cut into it`);
    }
});

test('into a Deep Hold only by its gate: the rock and the hall\'s walls are never walked through', () => {
  const s = newGame('hold-gate', { origin: 'dwarves' });
  const core = coreRect(s);
  const gate = castleGate(s);
  const layout = castleLayout(s)!;
  const ok = castleStep(s, layout);
  // from the land to the far corner of the hall
  const from = { x: (core.x - 3.5) * 32, y: (gate.y + 2.5) * 32 };
  const to = { x: (core.x + 0.5) * 32, y: (core.y + 0.5) * 32 };
  const path = pathTo(s, from, to);
  assert.ok(path, 'a way in');
  const cells = path!.map((p) => ({ x: Math.floor(p.x / 32), y: Math.floor(p.y / 32) }));
  assert.ok(cells.some((c) => c.x === gate.x && c.y === gate.y), 'by the gate');
  // nobody steps through the hall's front wall beside the gate
  assert.equal(ok(gate.x - 1, gate.y, gate.x - 1, gate.y - 1), false);
  assert.equal(ok(gate.x, gate.y, gate.x, gate.y - 1), true);
});
