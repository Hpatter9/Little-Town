import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS } from '../src/shared/data/buildings';
import { parseCommand } from '../src/shared/sim/commands';
import { buildSlots, isUnlocked, unlockInfo } from '../src/shared/sim/buildings';
import { PIN_WAIT_HOURS, PINS_MOST, pinRefusal, setPin, SLOT_WAIT } from '../src/shared/sim/pins';
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
  // (the same building may be ordered again; one order of several is cancelled by its id)
  assert.equal(setPin(s, def.id, true), null);
  assert.equal(s.pins!.length, 2);
  assert.notEqual(s.pins![0].id, s.pins![1].id);
  setPin(s, def.id, false, s.pins![1].id);
  assert.equal(s.pins!.length, 1);
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

test('the queue holds PINS_MOST orders, repeats allowed; one waiting its turn for a building slot is never given up', () => {
  const s = newGame('pins-queue');
  const def = BUILDINGS.find((d) => pinRefusal(s, d) === null && !d.housing)!;
  for (let i = 0; i < PINS_MOST; i++) assert.equal(setPin(s, def.id, true), null, `order ${i + 1}`);
  assert.match(setPin(s, def.id, true)!, /at most/i);
  assert.equal(parseCommand({ type: 'pinBuilding', def: def.id, on: false, id: 1.5 }), null);
  assert.deepEqual(parseCommand({ type: 'pinBuilding', def: def.id, on: false, id: 7 }), { type: 'pinBuilding', def: def.id, on: false, id: 7 });
  // (every slot busy: the orders wait their turn, long past PIN_WAIT_HOURS, and none is given up)
  s.autopilot = true;
  for (const p of s.pins!) {
    p.at = -(PIN_WAIT_HOURS + 1) * TICKS_PER_HOUR;
    p.why = SLOT_WAIT;
  }
  const sim = new Sim(s);
  const slots = buildSlots(s);
  // (sites taking every slot, that nobody works on)
  for (const p of s.people) p.priorities = { ...p.priorities, construct: 0, haul: 0 };
  for (let i = 0; i < slots; i++) s.buildings.push({ ...structuredClone(s.buildings[0]), id: s.nextId++, def: def.id, status: 'blueprint', progress: 0, delivered: {}, store: {} });
  for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) sim.step();
  assert.equal(s.pins!.filter((p) => p.building === undefined).length, PINS_MOST, 'all still queued');
  assert.ok(s.pins!.every((p) => p.why === SLOT_WAIT));
});
