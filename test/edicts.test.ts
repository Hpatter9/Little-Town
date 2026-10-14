import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { EDICT_COINS, EDICT_COOLDOWN_DAYS, EDICT_STANDING, EDICT_SWAY, LAW_BY_ID } from '../src/shared/data/politics';
import { Rng } from '../src/shared/rng';
import { parseCommand } from '../src/shared/sim/commands';
import { edictCheck, edictWait, issueEdict, lawOn, politicsOf } from '../src/shared/sim/politics';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { plainGame } from './helpers';

function town(seed: string): GameState {
  const s = plainGame(seed);
  const rng = new Rng(4);
  const c = s.people[0];
  const ambitions = ['crafter', 'farmer', 'guard', 'scholar', 'keeper', 'adventurer'] as const;
  while (s.people.length < 7) {
    const p = makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 6, y: c.y }, s.people.map((q) => q.name));
    p.ambition = ambitions[(s.people.length - 1) % ambitions.length];
    s.people.push(p);
  }
  s.coins = 100;
  politicsOf(s);
  return s;
}

test('an edict proclaims a law at once, paid in coins, and moves the blocs the law would', () => {
  const s = town('edict-coins');
  const pol = politicsOf(s);
  const before = { ...pol.sat };
  assert.deepEqual(issueEdict(s, 'proclaim', 'curfew', 'coins'), { ok: true });
  assert.ok(lawOn(s, 'curfew'));
  assert.equal(s.coins, 100 - EDICT_COINS);
  for (const [b, st] of Object.entries(LAW_BY_ID.curfew.stance)) assert.equal(pol.sat[b as keyof typeof pol.sat], before[b as keyof typeof before] + (st ?? 0) * EDICT_SWAY, b);
});

test('paid in standing, every bloc is less content; repealing undoes the law', () => {
  const s = town('edict-standing');
  const pol = politicsOf(s);
  pol.laws.push('harsh_law');
  const before = { ...pol.sat };
  assert.ok(issueEdict(s, 'repeal', 'harsh_law', 'standing').ok);
  assert.ok(!lawOn(s, 'harsh_law'));
  assert.equal(s.coins, 100);
  for (const [b, st] of Object.entries(LAW_BY_ID.harsh_law.stance)) assert.equal(pol.sat[b as keyof typeof pol.sat], before[b as keyof typeof before] - EDICT_STANDING - (st ?? 0) * EDICT_SWAY, b);
});

test('edicts wait out their cooldown, and are refused when they make no sense', () => {
  const s = town('edict-checks');
  assert.ok(!edictCheck(s, 'repeal', 'curfew', 'coins').ok, 'not in force');
  s.coins = 5;
  assert.ok(!edictCheck(s, 'proclaim', 'curfew', 'coins').ok, 'too poor');
  assert.ok(issueEdict(s, 'proclaim', 'curfew', 'standing').ok);
  assert.ok(!edictCheck(s, 'proclaim', 'rest_day', 'standing').ok, 'cooling down');
  assert.ok(edictWait(s) > 0);
  s.tick += EDICT_COOLDOWN_DAYS * TICKS_PER_DAY;
  assert.ok(edictCheck(s, 'proclaim', 'rest_day', 'standing').ok);
  assert.ok(!edictCheck(s, 'proclaim', 'curfew', 'standing').ok, 'already in force');
});

test('an edict may call a vote instead, and the command runs through the sim', () => {
  const s = town('edict-vote');
  assert.ok(issueEdict(s, 'vote', 'poor_relief', 'coins').ok);
  assert.ok(politicsOf(s).vote, 'the council votes');
  assert.ok(s.prompts.some((q) => q.politics === 'vote'));
  assert.equal(parseCommand({ type: 'edict', op: 'proclaim', law: 'nonsense', pay: 'coins' }), null);
  const c = parseCommand({ type: 'edict', op: 'proclaim', law: 'rest_day', pay: 'coins' });
  assert.ok(c);
  const t = town('edict-cmd');
  const sim = new Sim(t);
  sim.command(c!);
  sim.step();
  assert.ok(lawOn(t, 'rest_day'));
});
