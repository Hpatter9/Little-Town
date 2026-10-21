// Duels, judging disputes and naming things (sim/duel.ts, sim/disputes.ts, sim/naming.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DISPUTE_HOUR } from '../src/shared/data/disputes';
import { CHALLENGE_HOUR } from '../src/shared/data/duels';
import { ENEMY } from '../src/shared/data/social';
import { answerDispute, disputesHourly } from '../src/shared/sim/disputes';
import { challenge, duelChoices, duelHourly, duelTick } from '../src/shared/sim/duel';
import { askChildName, cleanName } from '../src/shared/sim/naming';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { parseCommand } from '../src/shared/sim/commands';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { adjust } from '../src/shared/sim/social';
import { maxHp, type GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame, put } from './helpers';

function town(seed: string, n = 6): GameState {
  const s = plainGame(seed);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < n; i++) {
    const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, ambition: 'farmer', partner: null, guard: false };
    p.x += (i + 1) * 4;
    s.people.push(p);
  }
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs = { food: 1, rest: 1 };
  }
  s.coins = 500;
  return s;
}
const atHour = (s: GameState, hour: number) => {
  s.tick = (Math.floor(s.tick / TICKS_PER_DAY) + 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
};

test('duel: a rival can be challenged, the power line is shown, and the fight ends', () => {
  const s = town('duel1');
  const f = s.people.find((p) => p.id === s.mainId)!;
  const rival = s.people.find((p) => p.id !== s.mainId)!;
  assert.deepEqual(duelChoices(s), []);
  adjust(s, f.id, rival.id, -100);
  const [c] = duelChoices(s);
  assert.equal(c.id, rival.id);
  assert.match(c.line, /^You \d+ vs about \d+: (Easy|Even|Risky|Deadly)$/);
  assert.ok(challenge(s, rival.id, 'yield').ok);
  assert.equal(challenge(s, rival.id, 'yield').ok, false); // (one at a time)
  for (let i = 0; i < 20000 && s.duel && s.duel.ended === undefined; i++) {
    s.tick++;
    duelTick(s);
  }
  assert.ok(s.duel?.outcome);
  assert.equal(f.away, null);
  assert.equal(rival.away, null);
});

test('duel: to the death, the loser dies', () => {
  const s = town('duel2');
  const f = s.people.find((p) => p.id === s.mainId)!;
  const rival = s.people.find((p) => p.id !== s.mainId)!;
  f.partner = rival.id; // (an heir, so a lost duel is not the end)
  rival.partner = f.id;
  rival.hp = 1000;
  adjust(s, f.id, rival.id, -100);
  rival.coins = 0;
  assert.ok(challenge(s, rival.id, 'death').ok);
  for (let i = 0; i < 40000 && s.duel && s.duel.ended === undefined; i++) {
    s.tick++;
    duelTick(s);
  }
  assert.ok(s.duel?.outcome);
  assert.ok(s.duel!.text);
  const dead = [f, rival].filter((p) => !s.people.includes(p));
  assert.equal(dead.length, 1);
});

test('duel: a rival challenges the founder with a prompt that holds the game', () => {
  const s = town('duel3');
  s.autopilot = true;
  const f = s.people.find((p) => p.id === s.mainId)!;
  const rival = s.people.find((p) => p.id !== s.mainId)!;
  adjust(s, f.id, rival.id, ENEMY - 10);
  let got = false;
  for (let d = 0; d < 400 && !got; d++) {
    atHour(s, CHALLENGE_HOUR);
    duelHourly(s);
    got = s.prompts.some((q) => q.kind === 'duel');
  }
  assert.ok(got);
  assert.ok(waitingOnFounder(s));
  const sim = new Sim(s);
  const before = s.tick;
  sim.step();
  assert.equal(s.tick, before);
  const q = s.prompts.find((p) => p.kind === 'duel')!;
  answerPrompt(s, q.id, 1, new Rng(1));
  assert.equal(waitingOnFounder(s), false);
  assert.equal(s.duel, undefined);
});

test('disputes: a quarrel is put to the founder and a judgement changes things', () => {
  const s = town('disp1', 8);
  s.autopilot = true;
  const folk = s.people.filter((p) => p.id !== s.mainId);
  adjust(s, folk[0].id, folk[1].id, -80);
  let q;
  for (let d = 0; d < 400 && !q; d++) {
    atHour(s, DISPUTE_HOUR);
    s.disputes = undefined;
    disputesHourly(s);
    q = s.prompts.find((p) => p.kind === 'dispute');
  }
  assert.ok(q);
  assert.ok(q.waits);
  assert.ok(q.options.length >= 2 && q.options.length <= 3);
  const a = s.people.find((p) => p.id === q!.dispute!.a)!;
  const moraleBefore = a.morale;
  s.prompts = s.prompts.filter((p) => p !== q);
  answerDispute(s, q, q.dispute!.kind === 'quarrel' ? 0 : 2);
  assert.notEqual(a.morale, moraleBefore);
  assert.ok(s.politics);
});

test('disputes: the rate is occasional', () => {
  const s = town('disp2', 8);
  s.autopilot = true;
  const folk = s.people.filter((p) => p.id !== s.mainId);
  adjust(s, folk[0].id, folk[1].id, -80);
  let n = 0;
  for (let d = 0; d < 100; d++) {
    atHour(s, DISPUTE_HOUR);
    s.prompts = [];
    disputesHourly(s);
    if (s.prompts.length) n++;
  }
  assert.ok(n > 0 && n < 40, `${n} in 100 days`);
});

test('naming: names are checked', () => {
  assert.equal(cleanName('  Ash   Hall '), 'Ash Hall');
  assert.equal(cleanName('A'), null);
  assert.equal(cleanName('x'.repeat(25)), null);
  assert.equal(cleanName('<b>hi</b>'), null);
  assert.equal(cleanName('9lives'), null);
  assert.equal(cleanName(7), null);
  assert.equal(parseCommand({ type: 'name', kind: 'building', id: 3, name: '' }), null);
  assert.ok(parseCommand({ type: 'name', kind: 'unique', id: 'x', name: "Widow's Wail" }));
});

test('naming: a building, a newborn and a unique', () => {
  const s = town('name1');
  s.autopilot = true;
  const sim = new Sim(s);
  const b = put(s, 'lean_to', 10);
  b.status = 'done';
  sim.command({ type: 'name', kind: 'building', id: b.id, name: 'Hearth House' });
  sim.step();
  assert.equal(b.homeName, 'Hearth House');
  assert.ok(b.named);
  // a child of the founder
  const f = s.people.find((p) => p.id === s.mainId)!;
  const child = { ...JSON.parse(JSON.stringify(f)), id: s.nextId++, name: 'Baby', bornTick: s.tick, parents: [f.id] };
  s.people.push(child);
  askChildName(s, child);
  const q = s.prompts.find((p) => p.kind === 'name')!;
  assert.equal(q.options.length, 4);
  answerPrompt(s, q.id, 0, new Rng(1));
  assert.equal(child.name, q.options[0]);
  sim.command({ type: 'name', kind: 'person', id: child.id, name: 'Wren' });
  sim.step();
  assert.equal(child.name, 'Wren');
  // not a stranger's child, nor a duplicate
  sim.command({ type: 'name', kind: 'person', id: s.people[1].id, name: 'Nope' });
  sim.step();
  assert.notEqual(s.people[1].name, 'Nope');
  // a unique
  s.uniques = ['sword_of_dawn'];
  sim.command({ type: 'name', kind: 'unique', id: 'sword_of_dawn', name: 'Mercy' });
  sim.step();
  assert.equal(s.uniqueNames?.sword_of_dawn, 'Mercy');
  assert.equal(snapshot(s).founder?.uniqueNames.sword_of_dawn, 'Mercy');
});
