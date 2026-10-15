import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS } from '../src/shared/data/buildings';
import { parseCommand } from '../src/shared/sim/commands';
import { isUnlocked, unlockInfo } from '../src/shared/sim/buildings';
import { PIN_WAIT_HOURS, pinRefusal, setPin } from '../src/shared/sim/pins';
import { Sim } from '../src/shared/sim/sim';
import { addStock, newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

test('the pin command is checked', () => {
  assert.deepEqual(parseCommand({ type: 'pinBuilding', def: 'workbench', on: true }), { type: 'pinBuilding', def: 'workbench', on: true });
  assert.equal(parseCommand({ type: 'pinBuilding', def: 'nothing', on: true }), null);
  assert.equal(parseCommand({ type: 'pinBuilding', def: 'workbench' }), null);
});

test('a pinned building is laid next, gathered for, and the Journal says when it stands', () => {
  const s = newGame('pins');
  s.autopilot = true;
  const sim = new Sim(s);
  // (something the town can build now that it hasn't: a cheap one of wood and stone)
  const def = BUILDINGS.find((d) => !d.never && !d.housing && !d.hp && !d.storage && d.buildSeconds >= 60 && isUnlocked(unlockInfo(s), d) && !s.buildings.some((b) => b.def === d.id) && Object.keys(d.cost).every((m) => m === 'wood' || m === 'stone') && pinRefusal(s, d) === null)!;
  assert.ok(def, 'a building to wish for');
  const store = s.buildings.find((b) => b.def === 'campfire')!.store;
  for (const [m, n] of Object.entries(def.cost)) addStock(store, m as never, n as number);
  sim.command({ type: 'pinBuilding', def: def.id, on: true });
  for (let i = 0; i < 2 * TICKS_PER_HOUR && s.pins?.[0]?.building === undefined; i++) {
    sim.step();
    if (!s.pins?.length) break;
  }
  const pin = s.pins![0];
  assert.ok(pin.building !== undefined, 'laid as a blueprint');
  const b = s.buildings.find((q) => q.id === pin.building)!;
  assert.equal(b.def, def.id);
  // (finished: the wish goes, and the Journal says so)
  b.status = 'done';
  b.progress = 1;
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  assert.equal(s.pins!.length, 0);
  assert.ok(s.journal.some((e) => /wish is built/.test(e.text)));
});

test('refused when it can\'t be had; given up when it waits too long; unpinned on request', () => {
  const s = newGame('pins-no');
  const locked = BUILDINGS.find((d) => !d.never && d.research && !isUnlocked(unlockInfo(s), d))!;
  assert.match(setPin(s, locked.id, true)!, /learned/);
  const wall = BUILDINGS.find((d) => d.id === 'palisade');
  if (wall) assert.ok(setPin(s, wall.id, true));
  // (a wish that can't be started is set aside after PIN_WAIT_HOURS)
  const def = BUILDINGS.find((d) => pinRefusal(s, d) === null)!;
  assert.equal(setPin(s, def.id, true), null);
  assert.equal(setPin(s, def.id, true), 'Already wished for');
  s.pins![0].at = -(PIN_WAIT_HOURS + 1) * TICKS_PER_HOUR;
  s.pins![0].why = 'no room for it';
  s.autopilot = true;
  const sim = new Sim(s);
  for (let i = 0; i < TICKS_PER_HOUR && s.pins!.length; i++) sim.step();
  assert.equal(s.pins!.length, 0);
  assert.ok(s.journal.some((e) => /set aside/.test(e.text)));
  // (unpinned)
  setPin(s, def.id, true);
  setPin(s, def.id, false);
  assert.equal(s.pins!.length, 0);
});
