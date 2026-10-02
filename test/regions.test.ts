import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATION_BY_ID, DESTINATIONS } from '../src/shared/data/expeditions';
import { HIDDEN_IN, REGIONS, scoutId } from '../src/shared/data/regions';
import { ROUTES } from '../src/shared/data/scenes';
import { MAP_SPOTS } from '../src/shared/data/worldMap';
import { canSend, destinationHidden } from '../src/shared/sim/expeditions';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { TICK_HZ } from '../src/shared/sim/time';
import { plainGame } from './helpers';

test('every region but home has a scouting trip, and every hidden place lies in a real region', () => {
  for (const r of REGIONS) {
    if (r.id === 'heartland') continue;
    const d = DESTINATION_BY_ID[scoutId(r.id)];
    assert.ok(d && d.type === 'scout', `${r.id} has a scouting trip`);
    assert.ok(MAP_SPOTS[d.id] && ROUTES[d.id], `${d.id} is on the map and has a scene`);
  }
  for (const [dest, region] of Object.entries(HIDDEN_IN)) {
    assert.ok(DESTINATION_BY_ID[dest], `${dest} is a destination`);
    assert.ok(REGIONS.some((r) => r.id === region), `${dest}'s region ${region} is real`);
  }
});

test('a lair stays hidden until its region is scouted; then the scouting trip is gone from the board', () => {
  const sim = new Sim(plainGame('regions'));
  const s = sim.state;
  s.cheats.unlockAll = true; // (so research and era don't stand in the way)
  assert.ok(destinationHidden(s, 'boar_wallow'), 'the Wallow is in the fog');
  assert.equal(canSend(s, 'boar_wallow', [s.people[0].id]).ok, false, "a party can't be sent where nobody knows the way");
  assert.ok(snapshot(s).destinations.find((d) => d.id === 'boar_wallow')!.hidden);
  // (old places in the open stay where they were)
  assert.ok(!destinationHidden(s, 'berry_thicket') && !destinationHidden(s, 'bear_cave'));

  // the scouts go, quietly (no fights for the test), and come home
  const trip = DESTINATION_BY_ID[scoutId('eastwood')];
  const enc = trip.encounters;
  (trip as { encounters: typeof enc }).encounters = { ...enc, arrival: 0, ambush: 0 };
  try {
    assert.ok(!destinationHidden(s, trip.id), 'the scouting trip is on the board');
    sim.command({ type: 'sendExpedition', dest: trip.id, members: [s.people[0].id] });
    sim.step();
    assert.equal(s.expeditions.length, 1, 'the scouts set off');
    let t = 0;
    while (s.expeditions.length && t < 7200 * TICK_HZ) {
      sim.step();
      t++;
    }
  } finally {
    (trip as { encounters: typeof enc }).encounters = enc;
  }
  assert.deepEqual(s.regions, ['eastwood']);
  for (const id of ['boar_wallow', 'thornwood', 'idol_grove']) assert.ok(!destinationHidden(s, id), `${id} is on the map now`);
  assert.ok(destinationHidden(s, trip.id), 'and the scouting trip is done with');
  assert.ok(destinationHidden(s, 'labyrinth'), 'other regions are still fogged');
  assert.ok(s.journal.some((j) => /mapped the Eastwood, and found/.test(j.text)), 'the town hears what they found');
  assert.ok(DESTINATIONS.filter((d) => d.type === 'scout').length >= 7);
});
