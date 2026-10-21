import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS } from '../src/shared/data/buildings';
import { BUILD_KINDS, kindOf } from '../src/renderer/panel/buildKinds';
import { isUnlocked, unlockInfo } from '../src/shared/sim/buildings';
import { Sim } from '../src/shared/sim/sim';
import { addStock, newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

test('every building falls in a menu group', () => {
  for (const b of BUILDINGS) assert.ok((BUILD_KINDS as readonly string[]).includes(kindOf(b)), b.id);
});

test('an ordered building is laid by the town, and cancelling clears the order and its site', () => {
  const s = newGame('build-menu');
  s.autopilot = true;
  const sim = new Sim(s);
  const def = BUILDINGS.find((d) => !d.never && !d.housing && !d.hp && !d.storage && !d.seat && d.buildSeconds >= 60 && isUnlocked(unlockInfo(s), d) && !s.buildings.some((b) => b.def === d.id) && Object.keys(d.cost).every((m) => m === 'wood' || m === 'stone'))!;
  const store = s.buildings.find((b) => b.def === 'campfire')!.store;
  for (const [m, n] of Object.entries(def.cost)) addStock(store, m as never, n as number);
  sim.command({ type: 'pinBuilding', def: def.id, on: true });
  for (let i = 0; i < 2 * TICKS_PER_HOUR && s.pins?.[0]?.building === undefined; i++) sim.step();
  const id = s.pins![0].building!;
  assert.ok(s.buildings.some((b) => b.id === id && b.status === 'blueprint'));
  sim.command({ type: 'pinBuilding', def: def.id, on: false });
  sim.command({ type: 'demolish', building: id });
  sim.step();
  assert.equal(s.pins!.length, 0);
  assert.ok(!s.buildings.some((b) => b.id === id && b.status === 'blueprint'));
});
