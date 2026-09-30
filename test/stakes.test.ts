import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATIONS } from '../src/shared/data/expeditions';
import { Rng } from '../src/shared/rng';
import { partyCarry, planParty, sendParty } from '../src/shared/sim/expeditions';
import { makePerson } from '../src/shared/sim/state';
import { plainGame } from './helpers';

function town(n: number) {
  const s = plainGame('stakes');
  s.buildings[0].store = { berries: 60 };
  const rng = new Rng(2);
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'hunter', s.people[0].x, s.people.map((p) => p.name)));
  return s;
}
const first = DESTINATIONS.find((d) => !d.research)!;

test('the town plans the party: the fittest go, the founder stays, half the town stays home', () => {
  const s = town(6);
  const plan = planParty(s, first.id);
  assert.ok(plan.members.length >= 1 && plan.members.length <= 3);
  assert.ok(!plan.members.includes(s.mainId), 'the founder stays home');
  assert.ok(s.people.length - plan.members.length >= Math.ceil(s.people.length / 2));
  s.people[1].downed = { bleedUntil: null } as never;
  assert.ok(!planParty(s, first.id).members.includes(s.people[1].id), 'nobody too hurt to go');
});

test('the player picks the stakes: a risky party carries more (and meets more trouble) than a safe one', () => {
  const safe = town(6);
  assert.ok(sendParty(safe, first.id, 'safe').ok);
  const risky = town(6);
  assert.ok(sendParty(risky, first.id, 'risky').ok);
  const a = safe.expeditions[0];
  const b = risky.expeditions[0];
  assert.equal(a.stakes, 'safe');
  assert.equal(a.stance, 'cautious');
  assert.equal(b.stance, 'bold');
  assert.ok(partyCarry(risky, b) > partyCarry(safe, a) * 1.5, 'loads up');
});

test('a town of one can still send its founder: the choice is the player\'s', () => {
  const s = town(1);
  assert.equal(sendParty(s, first.id, 'safe').ok, true, 'a town of one sends its founder (there is nobody else)');
});
