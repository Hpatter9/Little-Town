// The founder card's "Now" line (panel/founderNow.ts): what the founder is doing this moment, and the order they're
// set to when that's something else. Also the describer's words for the founder's own walks (sim/snapshot.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { founderNow } from '../src/renderer/panel/founderNow';
import { Sim } from '../src/shared/sim/sim';
import { snapshot, type FounderView, type PersonView } from '../src/shared/sim/snapshot';
import { camp, plainGame, put, row } from './helpers';

const person = (extra: Partial<PersonView>): PersonView => ({ id: 1, activity: 'idle', doing: 'Idling at camp', away: null, downed: null, bleedMinutes: null, ...extra }) as PersonView;
const view = (extra: Partial<FounderView> = {}): FounderView => ({ id: 1, order: null, ...extra }) as FounderView;

test('Now: working, with no order, says only what they do', () => {
  const n = founderNow(person({ activity: 'idle', doing: 'Felling trees (forest)' }), view());
  assert.equal(n.now, 'Felling trees (forest)');
  assert.equal(n.set, null);
});

test('Now: set to a job but walking home to eat, both lines show', () => {
  const n = founderNow(person({ activity: 'walk', doing: 'Eating' }), view({ order: 'Working at woodcutting for the day', orderKind: 'work' }));
  assert.equal(n.icon, '🚶');
  assert.equal(n.set, 'working at woodcutting for the day');
});

test('Now: walking where they were sent shows no second line', () => {
  const n = founderNow(person({ activity: 'walk', doing: 'Walking to the smithy' }), view({ order: 'Walking to the Smithy', orderKind: 'go' }));
  assert.equal(n.now, 'Walking to the smithy');
  assert.equal(n.set, null);
});

test('Now: asleep on a rest order, and asleep with no order', () => {
  const rest = founderNow(person({ activity: 'sleep', doing: 'Sleeping in the hut' }), view({ order: 'Resting at home', orderKind: 'rest' }));
  assert.equal(rest.icon, '💤');
  assert.equal(rest.set, null);
  assert.equal(founderNow(person({ activity: 'sleep', doing: 'Sleeping in the hut' }), view()).now, 'Sleeping in the hut');
});

test('Now: fighting off a raid', () => {
  const n = founderNow(person({ activity: 'fight', doing: 'Fighting off the raiders!' }), view({ order: 'Working at farming for the day', orderKind: 'work' }));
  assert.equal(n.icon, '⚔️');
  assert.equal(n.now, 'Fighting off the raiders!');
  assert.equal(n.set, 'working at farming for the day');
});

test('Now: downed, bleeding or mending', () => {
  assert.match(founderNow(person({ downed: 'bleeding' }), view()).now, /bleeding/);
  assert.equal(founderNow(person({ downed: 'recovering', doing: 'Badly hurt, resting in the hut' }), view()).now, 'Recovering from wounds: badly hurt, resting in the hut');
});

test('Now: on a trip, leading it or along, by days or hours', () => {
  const trip = { name: 'The Lost Shrine', phase: 'out' as const, leads: true, fighting: false, waiting: false, day: 2, days: 4, hoursLeft: 50 };
  assert.equal(founderNow(person({ away: 'The Lost Shrine' }), view({ trip })).now, 'Leading a party: The Lost Shrine (day 2 of 4, on the road)');
  assert.equal(founderNow(person({ away: 'The Lost Shrine' }), view({ trip: { ...trip, leads: false, days: 1, hoursLeft: 3, phase: 'work', waiting: true } })).now, 'With a party: The Lost Shrine (3 hours left, waiting on your answer)');
  const fight = founderNow(person({ away: 'The Lost Shrine' }), view({ trip: { ...trip, fighting: true } }));
  assert.equal(fight.icon, '⚔️');
  assert.match(fight.now, /fighting\)$/);
  assert.equal(founderNow(person({ away: 'the arena' }), view()).now, 'Away: the arena');
});

test('Now: raising a party is what they are set to', () => {
  const muster = { leader: 1, place: 'the wolf den', members: [] } as never;
  assert.equal(founderNow(person({ doing: 'Idling at camp' }), view(), muster).set, 'raising a party for the wolf den');
});

test('the describer says where the founder walks when sent to a building', () => {
  const s = plainGame('founder-now-go');
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  const sim = new Sim(s);
  const b = put(s, 'lean_to', camp(s).x + 8, row(s));
  sim.command({ type: 'founderGo', building: b.id });
  sim.step();
  sim.step();
  const snap = snapshot(s);
  const f = snap.people.find((p) => p.id === s.mainId)!;
  assert.match(f.doing, /^Walking to the /);
  assert.equal(snap.founder?.orderKind, 'go');
  const n = founderNow(f, snap.founder!, snap.muster);
  assert.equal(n.set, null, 'the order is what they are doing');
});
