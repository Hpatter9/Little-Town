import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BARGAINS, BARGAIN_BY_ID, COURT_HOUR, IRON_HARM } from '../src/shared/data/bargains';
import { Rng } from '../src/shared/rng';
import { storages } from '../src/shared/sim/buildings';
import { answerBargain, coldIron, courtHourly, courtOf, offerBargain } from '../src/shared/sim/bargains';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function fae(seed: string): GameState {
  const s = plainGame(seed);
  s.origin = 'fae';
  s.autopilot = true;
  s.tick = at(5, COURT_HOUR);
  const rng = new Rng(4);
  const c = s.people[0];
  while (s.people.length < 4) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: c.x, y: c.y }, s.people.map((q) => q.name)));
  return s;
}

test('the Court comes at moonrise with a bargain, put to the town as a question', () => {
  const s = fae('fae-offer');
  const c = courtOf(s)!;
  c.next = s.tick;
  courtHourly(s);
  const q = s.prompts.find((p) => p.kind === 'ways' && p.ways?.system === 'court');
  assert.ok(q, 'a bargain offered');
  assert.ok(BARGAIN_BY_ID[q.ways!.about]);
  assert.equal(q.options.length, 2);
  assert.ok(snapshot(s).heritage?.court);
  for (const b of BARGAINS) assert.ok(b.boon.length && b.price.length && b.due > 0, b.id);
});

test('struck, the boon comes now and the price falls due; the fair folk always collect', () => {
  const s = fae('fae-strike');
  const c = courtOf(s)!;
  const q = offerBargain(s, c, 'gold')!;
  const coins = s.coins ?? 0;
  answerPrompt(s, q.id, 0, new Rng(1));
  assert.equal(s.coins, coins + 120, 'gold from leaves');
  assert.equal(c.debts.length, 1);
  const best = [...s.people].sort((a, b) => b.skills.crafting.level - a.skills.crafting.level)[0];
  best.skills.crafting.level = 8;
  s.tick = c.debts[0].due;
  courtHourly(s);
  assert.equal(c.debts.length, 0);
  assert.equal(best.skills.crafting.level, 5, 'the crafter\'s cunning taken');
  assert.ok(s.prompts.some((p) => p.title === 'The price of Gold from Leaves'));
});

test('a price that can\'t be paid is forfeit: someone is taken', () => {
  const s = fae('fae-forfeit');
  const c = courtOf(s)!;
  const q = offerBargain(s, c, 'gold')!;
  answerBargain(s, q, 0, new Rng(2));
  for (const p of s.people) p.skills.crafting.level = 0; // nobody to forget anything
  const n = s.people.length;
  s.tick = c.debts[0].due;
  courtHourly(s);
  assert.equal(s.people.length, n - 1, 'taken by the fair folk');
  assert.equal(c.taken.length, 1);
  assert.ok(c.favour < 10);
});

test('refused, the Court cools; cold iron in the stores hurts the fair folk', () => {
  const s = fae('fae-iron');
  const c = courtOf(s)!;
  const q = offerBargain(s, c, 'plenty')!;
  const f = c.favour;
  answerBargain(s, q, 1, new Rng(3));
  assert.ok(c.favour < f);
  storages(s)[0].store.iron = IRON_HARM + 10;
  const before = c.favour;
  coldIron(s, c);
  assert.ok(c.favour < before);
  assert.ok((s.marks ?? []).some((m) => m.text === 'Cold iron in the stores'));
});
