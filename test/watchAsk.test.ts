import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeDestId } from '../src/shared/data/places';
import { Rng } from '../src/shared/rng';
import { sendDelve } from '../src/shared/sim/expeditions';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { Sim } from '../src/shared/sim/sim';
import { makePerson } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { runtime, WATCH_ASK_HOURS } from '../src/shared/sim/watchAsk';
import { campPx, plainGame } from './helpers';

function sent(seed: string) {
  const sim = new Sim(plainGame(seed));
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
  const r = sendDelve(s, placeDestId(place.id), s.people.slice(1, 4).map((p) => p.id), 'risky');
  assert.ok(r.ok, String(r.reason ?? ''));
  s.autopilot = true; // (the question is the player's: a town run by hand in the tests isn't asked)
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  return { sim, s, e: s.expeditions[0] };
}

const stepTill = (sim: Sim, done: () => boolean, most = 40000) => {
  for (let i = 0; i < most && !done(); i++) sim.step();
};

test('a big fight at the place the party set out for waits for the player: watch it, or let it play out', () => {
  const { sim, s, e } = sent('watch-ask');
  stepTill(sim, () => s.prompts.some((p) => p.kind === 'watch'));
  const q = s.prompts.find((p) => p.kind === 'watch')!;
  assert.ok(q, 'asked');
  assert.equal(q.expedition, e.id);
  assert.deepEqual(q.options, ['Watch the fight', 'Let it play out']);
  assert.ok(e.battle && e.prompt === q.id, 'the fight holds');
  // held: the fight doesn't move while the question is open
  const before = JSON.stringify(e.battle!.fighters.map((f) => f.hp));
  for (let i = 0; i < 200; i++) sim.step();
  assert.equal(JSON.stringify(e.battle!.fighters.map((f) => f.hp)), before);
  answerPrompt(s, q.id, 0, new Rng(1));
  assert.equal(s.watching, e.id, 'watching');
  assert.equal(e.prompt, null);
  stepTill(sim, () => !e.battle || !!e.battle.outcome, 4000);
  // asked once at the site: no more questions this trip about the same fight
  assert.ok(!s.prompts.some((p) => p.kind === 'watch' && p.id !== q.id));
});

test('unanswered, the fight plays out; nobody is asked while the town is caught up', () => {
  const { sim, s, e } = sent('watch-ask');
  stepTill(sim, () => s.prompts.some((p) => p.kind === 'watch'));
  const q = s.prompts.find((p) => p.kind === 'watch')!;
  for (let i = 0; i <= WATCH_ASK_HOURS * TICKS_PER_HOUR; i++) sim.step();
  assert.ok(!s.prompts.includes(q), 'answered by default');
  assert.equal(s.watching, undefined);
  assert.notEqual(e.prompt, q.id);
  // caught up after time away: the fight just goes on
  const b = sent('watch-ask');
  runtime.quiet = true;
  try {
    stepTill(b.sim, () => !!b.e.battle);
  } finally {
    runtime.quiet = false;
  }
  assert.ok(b.e.battle, 'fighting');
  assert.ok(!b.s.prompts.some((p) => p.kind === 'watch'));
});
