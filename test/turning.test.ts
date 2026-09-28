import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerLich, updateDoom } from '../src/shared/sim/doom';
import { drainNeeds, mood } from '../src/shared/sim/townsfolk';
import { startRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { canTurn, turnable, turnPerson, turnTown } from '../src/shared/sim/turning';
import { FX_TICKS, makePerson, type Building, type GameState } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

function town(seed: string, n = 3): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', 3200 + i * 20, s.people.map((p) => p.name)));
  return s;
}
const phylactery = (s: GameState) => s.buildings.push({ id: s.nextId++, def: 'phylactery', tile: 102, status: 'done', delivered: {}, progress: 1, store: {} } as Building);

test('turning is hidden until a lich, vampire or werewolf can pass it on', () => {
  const s = town('turn-hidden');
  assert.deepEqual(turnable(s), []);
  phylactery(s);
  assert.deepEqual(turnable(s), ['undead']);
  s.people[1].monster = 'vampire';
  assert.ok(turnable(s).includes('vampire'));
  assert.equal(canTurn(s, s.people[0], 'undead').ok, false, 'never the founder');
});

test('a lich turns one person, then the whole town; the undead never hunger, and zombies pass them by', () => {
  const s = town('undead-haven');
  phylactery(s);
  const [, a, b, c] = s.people;
  assert.equal(turnPerson(s, a.id, 'undead').ok, true);
  assert.equal(a.monster, 'undead');
  assert.ok(mood(s, b).reasons.some((r) => /Afraid of being turned|Living among the dead/.test(r.text)), 'the living are uneasy');
  assert.equal(turnTown(s, 'undead'), 2);
  assert.ok([b, c].every((p) => p.monster === 'undead'));
  a.needs = { food: 1, rest: 1 };
  for (let i = 0; i < 1000; i++) drainNeeds(a, false);
  assert.equal(a.needs.food, 1);
});

test('a lich can command the dead in an outbreak: most of each wave fights for the town', () => {
  const s = town('lich-outbreak');
  phylactery(s);
  s.tick = 20 * 14400;
  s.doom = { kind: 'outbreak', phase: 'signs', untilTick: s.tick + 1 };
  s.tick = Math.ceil((s.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateDoom(s, new Rng(1));
  const prompt = s.prompts.find((p) => p.kind === 'lich');
  assert.ok(prompt, 'the lich is asked');
  answerLich(s, 'Command the dead');
  const wave = startRaid(s, RAID_KIND_BY_ID.zombies, 60, new Rng(2));
  const allies = wave.raiders.filter((r) => r.ally).length;
  assert.ok(allies >= wave.raiders.length / 2, `${allies} of ${wave.raiders.length} answer the lich`);
});

test('a town of werewolves hunts on the full moon instead of mauling', async () => {
  const { updateMonsters } = await import('../src/shared/sim/monsters');
  const s = town('pack', 2);
  s.people[1].monster = 'werewolf';
  turnTown(s, 'werewolf');
  assert.ok(s.people.filter((p) => p.id !== s.mainId).every((p) => p.monster === 'werewolf'));
  s.people[0].monster = 'werewolf'; // (even the founder, for this test)
  // find a full-moon night at 23:00
  const rng = new Rng(3);
  for (let h = 0; h < 24 * 8; h++) {
    s.tick += TICKS_PER_HOUR;
    updateMonsters(s, rng, () => {});
  }
  assert.ok(s.notices.some((n) => /pack ran down game/.test(n.text)));
});

test('turning leaves a spell on each one turned, shown for a few seconds', () => {
  const s = town('turn-fx');
  phylactery(s);
  s.people[2].monster = 'vampire';
  turnPerson(s, s.people[1].id, 'vampire');
  assert.deepEqual(snapshot(s).fx.map((f) => [f.id, f.kind]), [[s.people[1].id, 'vampire']]);
  s.tick += FX_TICKS;
  turnTown(s, 'undead');
  assert.deepEqual(snapshot(s).fx.map((f) => f.kind), ['undead'], 'the old spell is over; the new one shows');
});
