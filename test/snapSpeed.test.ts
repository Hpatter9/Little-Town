// The snapshot's caches (the stores' total in one snapshot, the slow power figures) give what the plain work gives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainGame } from './helpers';
import { totalStock, withStockScope } from '../src/shared/sim/buildings';
import { powerOfParty } from '../src/shared/sim/power';
import { snapshot } from '../src/shared/sim/snapshot';
import { Sim } from '../src/shared/sim/sim';

test('the stores total inside a scope equals the plain total, and a copy is handed out', () => {
  const s = plainGame('speed-1');
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 7, stone: 3 };
  const plain = totalStock(s);
  withStockScope(s, () => {
    const a = totalStock(s);
    assert.deepEqual(a, plain);
    a.wood = 999; // (a caller changing its copy leaves the next one alone)
    assert.deepEqual(totalStock(s), plain);
  });
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 1 };
  assert.deepEqual(totalStock(s), { wood: 1 }); // (no scope kept past the call)
});

test('a snapshot gives the same party power as working it out', () => {
  const s = plainGame('speed-2');
  const sim = new Sim(s);
  for (let i = 0; i < 20; i++) sim.step();
  const snap = snapshot(s);
  for (const d of snap.destinations) {
    if (!d.party.length) continue;
    const members = s.people.filter((p) => d.party.some((n) => n.startsWith(`${p.name} (`)));
    assert.equal(d.partyPower, powerOfParty(members));
  }
});
