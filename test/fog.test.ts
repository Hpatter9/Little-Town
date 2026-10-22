import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SIGHT_BASE, SIGHT_BUILDING, SIGHT_LEAST } from '../src/shared/data/sight';
import { fogTick, isExplored, sightNow, sightOf, updateFog } from '../src/shared/sim/fog';
import { CELL } from '../src/shared/sim/land';
import { parseSave, serialize } from '../src/shared/sim/save';
import { snapshot } from '../src/shared/sim/snapshot';
import { campCell, newGame, type GameState } from '../src/shared/sim/state';
import { plainGame } from './helpers';

const count = (t: string | undefined) => (t ?? '').split('1').length - 1;
const cellOf = (s: GameState, x: number, y: number) => y * s.land.w + x;

test('sight: a base for anyone, more for rangers, less at night', () => {
  const s = plainGame('fog-sight');
  const p = s.people[0];
  const other = { ...p, id: p.id + 99, cls: null as never };
  s.tick = 12 * 600; // (noon)
  assert.ok(sightOf(s, other, false) === SIGHT_BASE);
  assert.ok(sightOf(s, { ...other, cls: 'ranger' } as never, false) > SIGHT_BASE);
  assert.ok(sightOf(s, other, true) < SIGHT_BASE);
  assert.ok(sightOf(s, { ...other, cls: null } as never, true) >= SIGHT_LEAST);
  assert.ok(sightOf(s, p, false) > SIGHT_BASE - 1, 'the founder sees as anyone or a little more');
});

test('a new town starts with its surroundings explored, and the far land dark', () => {
  const s = plainGame('fog-start');
  updateFog(s);
  const c = campCell(s);
  assert.ok(isExplored(s, cellOf(s, c.x, c.y)));
  assert.ok(isExplored(s, cellOf(s, c.x + 10, c.y)));
  assert.ok(!isExplored(s, cellOf(s, 2, 2)) || Math.hypot(c.x - 2, c.y - 2) < 20);
  assert.ok(count(s.explored) > 0 && count(s.explored) < s.land.w * s.land.h / 2);
  assert.ok(count(sightNow(s)) > 0 && count(sightNow(s)) <= count(s.explored));
});

test('explored grows as people walk and stays explored', () => {
  const s = plainGame('fog-walk');
  updateFog(s);
  const before = count(s.explored);
  const p = s.people[0];
  const c = campCell(s);
  p.x = (c.x + 30.5) * CELL;
  p.y = (c.y + 0.5) * CELL;
  updateFog(s);
  const cell = cellOf(s, c.x + 30, c.y);
  assert.ok(isExplored(s, cell));
  assert.ok(count(s.explored) > before + 100);
  assert.equal(sightNow(s)[cell], '1');
  p.x = (c.x + 0.5) * CELL;
  p.y = (c.y + 0.5) * CELL;
  updateFog(s);
  assert.ok(isExplored(s, cell), 'still explored after they leave');
  assert.equal(sightNow(s)[cell], '0', 'but out of sight');
});

test('buildings see a little', () => {
  const s = plainGame('fog-build');
  s.people = [];
  s.explored = undefined;
  updateFog(s);
  const b = s.buildings.find((x) => x.status === 'done')!;
  assert.equal(sightNow(s)[cellOf(s, b.tile + SIGHT_BUILDING - 1, b.row)], '1');
});

test('the fog is the same on every run and is stepped every few ticks', () => {
  const a = plainGame('fog-det');
  const b = plainGame('fog-det');
  for (let i = 0; i < 40; i++) {
    a.tick++;
    b.tick++;
    fogTick(a);
    fogTick(b);
  }
  assert.equal(a.explored, b.explored);
  assert.equal(sightNow(a), sightNow(b));
});

test('saves keep the explored land; an older save without it starts afresh', () => {
  const s = plainGame('fog-save');
  const p = s.people[0];
  const c = campCell(s);
  p.x = (c.x + 25.5) * CELL;
  updateFog(s);
  const got = parseSave(serialize(s, 1));
  assert.ok(got.ok);
  if (!got.ok) return;
  assert.equal(got.save.state.explored, s.explored);
  const old = JSON.parse(serialize(s, 1));
  delete old.state.packedExplored;
  delete old.state.explored;
  const loaded = parseSave(JSON.stringify(old));
  assert.ok(loaded.ok);
  if (!loaded.ok) return;
  assert.equal(loaded.save.state.explored, undefined);
  const snap = snapshot(loaded.save.state);
  assert.ok(count(snap.explored) > 0, 'the snapshot starts the fog');
  assert.ok(count(snap.sight) > 0);
});

test('a state with no fog record is not hidden from anyone', () => {
  const s = newGame('fog-none');
  assert.ok(isExplored(s, 5));
});
