import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLACE_APART, PLACE_COUNT, PLACE_DEFS, PLACE_FAR, PLACE_NEAR, placeDestId } from '../src/shared/data/places';
import { Rng } from '../src/shared/rng';
import { destinationOf, destinationUnlocked, sendDelve } from '../src/shared/sim/expeditions';
import { groundAt } from '../src/shared/sim/land';
import { placeCleared, placesHourly, seedPlaces } from '../src/shared/sim/places';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { campPx, plainGame } from './helpers';

test('a land holds its places: scattered round the camp, apart, on dry land, the same every time', () => {
  const s = newGame('places');
  const a = seedPlaces(s.land, s.seed);
  const b = seedPlaces(s.land, s.seed);
  assert.deepEqual(a, b);
  assert.ok(a.length >= PLACE_COUNT - 3, `${a.length} places`);
  for (const p of a) {
    const d = Math.hypot(p.x - s.land.camp.x, p.y - s.land.camp.y);
    assert.ok(d >= PLACE_NEAR - 1 && d <= PLACE_FAR + 1, `${p.kind} at ${d}`);
    assert.notEqual(groundAt(s.land, p.x, p.y), 'water');
    assert.equal(p.found, null);
    for (const q of a) if (q !== p) assert.ok(Math.hypot(q.x - p.x, q.y - p.y) >= PLACE_APART);
  }
  assert.ok(new Set(a.map((p) => p.kind)).size >= 3, 'several kinds');
});

test('places are found as the known land reaches them; a peaceful one is looked over, a fight waits on the board', () => {
  const s = plainGame('found');
  const rng = new Rng(4);
  s.tick = TICKS_PER_HOUR;
  placesHourly(s, rng);
  assert.ok(s.places && s.places.length, 'seeded on first use');
  assert.ok(s.places!.every((p) => p.found === null || Math.hypot(p.x - s.land.camp.x, p.y - s.land.camp.y) <= s.land.open));
  // open the whole land: everything is found
  s.land.open = 60;
  s.tick += TICKS_PER_HOUR;
  placesHourly(s, rng);
  assert.ok(s.places!.every((p) => p.found !== null));
  const fights = s.places!.filter((p) => p.foes);
  const calm = s.places!.filter((p) => !p.foes);
  assert.ok(fights.length && calm.length, `${fights.length} fights, ${calm.length} peaceful`);
  for (const p of fights) {
    const d = destinationOf(s, placeDestId(p.id))!;
    assert.equal(d.type, 'clear');
    assert.ok(destinationUnlocked(s, d));
    assert.ok(d.encounters.arrival === 1 && Object.keys(d.encounters.groups[0].enemies).length);
  }
  assert.ok(snapshot(s).destinations.some((v) => v.id === placeDestId(fights[0].id) && v.candidates));
  assert.ok(snapshot(s).places.some((v) => v.dest));
  // a few hours on: the peaceful ones have been looked over (a vein's rock is rich now)
  s.tick += 4 * TICKS_PER_HOUR;
  s.tick -= s.tick % TICKS_PER_HOUR;
  placesHourly(s, rng);
  for (const p of calm) assert.equal(p.state, 'done', p.kind);
  const vein = calm.find((p) => p.kind === 'vein');
  if (vein) assert.ok((s.land.pools[vein.y * s.land.w + vein.x]?.iron_ore ?? 0) > 0, 'ore to dig');
  assert.ok(s.journal.some((j) => /found to the/.test(j.text)));
});

test('a party the player picks goes to a place, and clearing it brings its hoard home', () => {
  const sim = new Sim(plainGame('clear-place'));
  const s = sim.state;
  for (let i = 0; i < 3; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', campPx(s), s.people.map((q) => q.name));
    p.skills.melee.level = 12;
    s.people.push(p);
  }
  s.land.open = 60;
  s.tick = TICKS_PER_HOUR - 1;
  sim.step();
  const place = s.places!.find((p) => p.foes && p.kind !== 'beast')!;
  assert.ok(place, 'a fight place');
  const dest = placeDestId(place.id);
  const r = sendDelve(s, dest, s.people.slice(1, 4).map((p) => p.id), 'risky');
  assert.ok(r.ok, r.reason ?? '');
  const e = s.expeditions[0];
  assert.equal(e.dest, dest);
  // (the fight is won by hand: the hoard comes with the loot)
  placeCleared(s, dest, e.loot, new Rng(2));
  assert.equal(place.state, 'done');
  const hoard = PLACE_DEFS[place.kind].hoard;
  for (const [m, n] of Object.entries(hoard)) assert.ok((e.loot[m as keyof typeof e.loot] ?? 0) >= n!, m);
  assert.equal(destinationUnlocked(s, destinationOf(s, dest)!), false, 'off the board once cleared');
});
