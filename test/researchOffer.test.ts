import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawOffer, OFFER_SIZE, OFFER_WAIT_TICKS } from '../src/shared/sim/researchOffer';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';

const fresh = (seed: string, autopilot = false) => {
  const s = newGame(seed);
  s.autopilot = autopilot;
  const sim = new Sim(s);
  sim.step();
  return { s, sim };
};

test('three distinct topics are on offer, all studyable now, and the same for the same seed', () => {
  const a = fresh('offer-a');
  const offer = a.s.research.offer!;
  assert.equal(offer.length, OFFER_SIZE);
  assert.equal(new Set(offer).size, OFFER_SIZE);
  for (const id of offer) assert.ok(!a.s.research.done.includes(id));
  assert.deepEqual(fresh('offer-a').s.research.offer, offer);
  assert.ok(Array.from({ length: 6 }, (_, i) => fresh(`offer-${i}`).s.research.offer!.join()).some((o) => o !== offer.join()), 'other seeds differ');
  a.s.research.offers! -= 1;
  assert.deepEqual(drawOffer(a.s), offer, 'a draw is pure for the same count of offers');
});

test('choosing studies it; a second tap does nothing; finishing draws three new ones', () => {
  const { s, sim } = fresh('offer-b');
  const [pick] = s.research.offer!;
  sim.command({ type: 'studyOffer', topic: pick });
  sim.command({ type: 'studyOffer', topic: pick });
  sim.step();
  assert.deepEqual(s.research.queue, [pick], 'studied once, however many taps');
  assert.ok(!s.research.offer!.includes(pick));
  s.research.done.push(pick);
  s.research.queue = [];
  sim.step();
  assert.equal(s.research.offer!.length, OFFER_SIZE);
  assert.ok(!s.research.offer!.includes(pick));
});

test('a topic not on offer cannot be chosen', () => {
  const { s, sim } = fresh('offer-c');
  sim.command({ type: 'studyOffer', topic: 'flint_knapping' === s.research.offer![0] ? 'foraging' : 'flint_knapping' });
  sim.step();
  assert.ok(s.research.queue.every((q) => s.research.offer!.includes(q) || s.research.queue.length === 0));
  assert.equal(s.research.queue.length, s.research.offer!.includes(s.research.queue[0] ?? '') ? 1 : 0);
});

test('an unchosen offer is chosen by a hands-off town after the wait, and not before', () => {
  const { s, sim } = fresh('offer-d', true);
  s.townResearches = true; // (the old hands-off town: a player's town waits, below)
  for (let i = 0; i < 200; i++) sim.step();
  assert.deepEqual(s.research.queue, [], 'still waiting for the player');
  // (the town may swap its own suggestion into the offer while it stands: the pick is from the offer standing then)
  let offer = [...s.research.offer!];
  for (let i = 0; i < OFFER_WAIT_TICKS + 100 && !s.research.queue.length; i++) {
    offer = [...(s.research.offer ?? [])];
    sim.step();
  }
  assert.equal(s.research.queue.length, 1);
  assert.ok(offer.includes(s.research.queue[0]), 'one of the three standing when it chose');
});

test('a town with the autopilot off never chooses for itself', () => {
  const { s, sim } = fresh('offer-e');
  for (let i = 0; i < OFFER_WAIT_TICKS + 100; i++) sim.step();
  assert.deepEqual(s.research.queue, []);
});

test("a player's town never chooses for itself: research waits for the pick, and the player is told", () => {
  const { s, sim } = fresh('offer-f', true);
  // (the first offer was drawn on the first step: a notice says a choice waits)
  assert.ok(s.notices.some((n) => /Choose what to study next/.test(n.text)), 'told a choice waits');
  for (let i = 0; i < OFFER_WAIT_TICKS * 3; i++) sim.step();
  assert.deepEqual(s.research.queue, [], 'nothing chosen without the player');
  assert.equal(s.research.offer!.length, OFFER_SIZE, 'the offer still stands');
  const told = s.notices.filter((n) => /Choose what to study next/.test(n.text)).length;
  assert.equal(told, 1, 'told once, not every tick');
  // (picked and learned: the next offer is announced too)
  const [pick] = s.research.offer!;
  sim.command({ type: 'studyOffer', topic: pick });
  sim.step();
  assert.deepEqual(s.research.queue, [pick]);
  s.research.done.push(pick);
  s.research.queue = [];
  sim.step();
  assert.equal(s.notices.filter((n) => /Choose what to study next/.test(n.text)).length, 2);
});
