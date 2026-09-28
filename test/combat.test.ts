import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startBattle, stepBattle, type Battle } from '../src/shared/sim/combat';
import { BLEED_TICKS } from '../src/shared/sim/health';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { TICK_HZ, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

function addPerson(s: GameState, type = 'hunter', melee = 5): Person {
  const p = makePerson(new Rng(s.nextId * 97), s.nextId++, type, (Math.floor(s.tiles.length / 2) + 0.5) * 32, s.people.map((q) => q.name));
  p.traits = [];
  p.hp = maxHp(p);
  p.needs = { food: 1, rest: 1 };
  p.skills.melee.level = melee;
  s.people.push(p);
  return p;
}
const fight = (b: Battle, retreatAt = 0.4, mainId: number | null = null, rng = new Rng(3)) => {
  for (let i = 0; i < 5000 && !b.outcome; i++) stepBattle(b, rng, { retreatAt, mainId });
  return b.outcome;
};
const runUntil = (sim: Sim, done: () => boolean, maxSeconds = 7200) => {
  let t = 0;
  while (!done() && t < maxSeconds * TICK_HZ) {
    sim.step();
    t++;
  }
};

test('a capable pair beats a boar; a lone novice against a bear falls back', () => {
  const s = plainGame('fight');
  const a = addPerson(s, 'hunter', 8);
  const b = addPerson(s, 'hunter', 8);
  assert.equal(fight(startBattle([a, b], {}, { boar: 1 }, new Rng(1))), 'won');
  const c = addPerson(s, 'wanderer', 2);
  assert.equal(fight(startBattle([c], {}, { cave_bear: 1 }, new Rng(1)), 0.4), 'retreated');
});

test('melee can only reach the front row while it stands', () => {
  const s = plainGame('rows');
  const front = addPerson(s, 'hunter', 10);
  const back = addPerson(s, 'elder', 1);
  const b = startBattle([front, back], { [front.id]: 'fighter', [back.id]: 'medic' }, { wolf: 2 }, new Rng(2));
  const medic = b.fighters.find((f) => f.ref === back.id)!;
  for (let i = 0; i < 400 && !b.outcome; i++) {
    stepBattle(b, new Rng(i), { retreatAt: 0, mainId: null });
    const fighter = b.fighters.find((f) => f.ref === front.id)!;
    if (!fighter.down) assert.equal(medic.hp, medic.maxHp, 'wolves could not reach the back row');
  }
});

test('the party falls back when the main character is badly hurt', () => {
  const s = plainGame('protect');
  const main = s.people[0];
  main.skills.melee.level = 3;
  const b = startBattle([main], {}, { wolf_alpha: 1, wolf: 2 }, new Rng(5));
  assert.equal(fight(b, 0, main.id), 'retreated');
  const f = b.fighters.find((x) => x.ref === main.id)!;
  assert.ok(f.hp < f.maxHp * 0.5 || f.down);
});

test('downed members bleed out without a medic; a medic stabilizes them', () => {
  const run = (withMedic: boolean) => {
    const sim = new Sim(plainGame(withMedic ? 'medic' : 'nomedic'));
    const s = sim.state;
    const hurt = addPerson(s);
    const other = addPerson(s, withMedic ? 'elder' : 'hunter');
    s.research.done.push('scouting');
    // send them far, then knock one down on the road
    sim.command({ type: 'sendExpedition', dest: 'bear_cave', members: [hurt.id, other.id], roles: withMedic ? { [other.id]: 'medic' } : {} });
    sim.step();
    hurt.hp = 0;
    hurt.downed = { bleedUntil: s.tick + 50 };
    runUntil(sim, () => false, 100 / TICK_HZ + 1);
    return s.people.some((p) => p.id === hurt.id);
  };
  assert.equal(run(false), false, 'bled out');
  assert.equal(run(true), true, 'medic saved them');
  assert.ok(BLEED_TICKS >= TICKS_PER_HOUR);
});

test("the main character's death ends the game and stops the sim", () => {
  const sim = new Sim(plainGame('over'));
  const s = sim.state;
  const main = s.people[0];
  sim.command({ type: 'sendExpedition', dest: 'riverbank', members: [main.id] });
  sim.step();
  main.hp = 0;
  main.downed = { bleedUntil: s.tick + 5 };
  runUntil(sim, () => !!s.gameOver, 10);
  assert.ok(s.gameOver);
  const t = s.tick;
  sim.step();
  assert.equal(s.tick, t, 'time has stopped');
});

test('injured people rest in bed until they are back on their feet', () => {
  const sim = new Sim(plainGame('heal'));
  const s = sim.state;
  const p = s.people[0];
  p.hp = 1;
  p.downed = { bleedUntil: null };
  sim.command({ type: 'queueResearch', topic: 'fire_keeping' });
  runUntil(sim, () => false, 60);
  assert.equal(p.task?.type, 'sleep', 'resting, not researching');
  runUntil(sim, () => p.downed === null, 12 * 3600);
  assert.equal(p.downed, null);
  assert.ok(p.hp >= maxHp(p) * 0.3);
});

test('a question from the road times out to its default; helping raises reputation', () => {
  const sim = new Sim(plainGame('prompt'));
  const s = sim.state;
  sim.command({ type: 'sendExpedition', dest: 'riverbank', members: [s.people[0].id], stance: 'balanced' });
  sim.step();
  const e = s.expeditions[0];
  s.prompts.push({ id: 999, kind: 'strangers', expedition: e.id, title: 't', text: 't', options: ['Help', 'Ignore', 'Rob'], defaultOption: 0, expiresTick: s.tick + 20 });
  e.prompt = 999;
  const at = e.elapsed;
  runUntil(sim, () => false, 1);
  assert.equal(e.elapsed, at, 'the trip waits for an answer');
  runUntil(sim, () => s.prompts.length === 0, 5);
  assert.equal(s.reputation, 1, 'default (help) applied');
  assert.equal(e.prompt, null);
});
