import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPECIALS, SPECIAL_IDS, CURSE_PRICE, BOUNTY, type SpecialId } from '../src/shared/data/specials';
import { Rng } from '../src/shared/rng';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { makeSpecial, sabotaged, secretJoined, specialFor, specialsHourly, strangerTurn } from '../src/shared/sim/specials';
import { secretStranger, VISIT_GAP_HOURS } from '../src/shared/sim/townsfolk';
import { turretsDown } from '../src/shared/sim/rivals';
import { makePerson, campXY, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put, row } from './helpers';

/** A special newcomer taken into a town. */
function newcomer(s: GameState, id: SpecialId): Person {
  const p = makePerson(new Rng(7), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name));
  makeSpecial(s, p, id);
  s.people.push(p);
  secretJoined(s, p);
  return p;
}
/** Hours go by, the secrets' hours with them. */
function hoursPass(s: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    s.tick += TICKS_PER_HOUR;
    specialsHourly(s);
  }
}
/** Nobody in town can see through anyone. */
const blind = (s: GameState) => {
  for (const p of s.people) for (const k of Object.keys(p.skills) as (keyof Person['skills'])[]) p.skills[k].level = 0;
};
const secretPrompt = (s: GameState) => s.prompts.find((q) => q.kind === 'secret');

test('seven special newcomers, each with a cover, a truth, a way to be seen through and answers', () => {
  assert.equal(SPECIAL_IDS.length, 7);
  for (const id of SPECIAL_IDS) {
    const d = SPECIALS[id];
    assert.ok(d.cover && d.truth && d.coverStory && d.slipText && d.spot.how, id);
    assert.ok(d.options.length >= 2 && d.due[0] <= d.due[1], id);
  }
});

test('a secret stranger comes one event turn in a hundred, any day, each kind once, secrets overlapping; the gate sees only the cover', () => {
  const s = plainGame('specials-gate');
  // (about one turn in a hundred, by the seed and the hour)
  let turns = 0;
  for (let h = 0; h < 10000; h++) {
    s.tick = h * TICKS_PER_HOUR;
    if (strangerTurn(s)) turns++;
  }
  assert.ok(turns > 70 && turns < 130, `turns ${turns}`);
  s.tick = 0;
  // on the first day, at the gate: only the cover shows
  assert.ok(secretStranger(s, new Rng(5)));
  const v = s.visitor!.person;
  const kind = v.secret!.id;
  const ask = s.prompts.find((q) => q.kind === 'visitor')!;
  assert.ok(ask.text.includes(SPECIALS[kind].cover));
  assert.ok(!ask.text.includes(SPECIALS[kind].name));
  // taken in, another comes while the first secret is still hidden: a different kind
  answerPrompt(s, ask.id, 0, new Rng(1));
  assert.ok(s.people.includes(v) && !v.secret!.found);
  // (one asks to join a week at most, whoever they are)
  assert.equal(secretStranger(s, new Rng(6)), false, 'not within the week');
  s.tick += VISIT_GAP_HOURS * TICKS_PER_HOUR;
  assert.ok(secretStranger(s, new Rng(6)));
  assert.notEqual(s.visitor!.person.secret!.id, kind);
  // every kind once, then no more
  const q = makePerson(new Rng(4), 9000, 'wanderer', campXY(s), []);
  s.specialsSeen = [...SPECIAL_IDS];
  assert.equal(specialFor(s, q), null);
});

test('a skilled townsperson sees through a newcomer, and the town is asked what to do', () => {
  const s = plainGame('specials-spot');
  s.tick = 3 * TICKS_PER_DAY;
  blind(s);
  s.people[0].skills.medicine.level = 30; // (the healer)
  const p = newcomer(s, 'plague');
  hoursPass(s, 24 * 2);
  const q = secretPrompt(s);
  assert.ok(q, 'found out');
  assert.equal(q!.who, p.id);
  assert.ok(q!.story && q!.picture);
  assert.ok(q!.text.includes(s.people[0].name), 'the one who saw it is named');
});

test('a hidden pilgrim spreads the fever when it is due', () => {
  const s = plainGame('specials-plague');
  s.tick = 3 * TICKS_PER_DAY;
  for (let i = 0; i < 4; i++) newcomerPlain(s);
  blind(s);
  const p = newcomer(s, 'plague');
  p.secret!.due = s.tick + 2 * TICKS_PER_HOUR;
  // (no slipping up in this test)
  SPECIALS.plague.slip = 0;
  hoursPass(s, 3);
  SPECIALS.plague.slip = 0.22;
  assert.ok(s.people.filter((q) => q.sick).length >= 3, 'the fever spread');
  assert.ok(p.secret!.struck && secretPrompt(s));
});

/** An ordinary grown-up. */
function newcomerPlain(s: GameState): Person {
  const p = makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name));
  s.people.push(p);
  return p;
}

test('the saboteur, unseen, cuts the gate and springs the traps the night before the clan rides in', () => {
  const s = plainGame('specials-saboteur');
  s.tick = 3 * TICKS_PER_DAY;
  const gate = put(s, 'palisade_gate', 4, row(s));
  gate.hp = 100;
  blind(s);
  SPECIALS.saboteur.slip = 0;
  const p = newcomer(s, 'saboteur');
  p.secret!.due = s.tick;
  hoursPass(s, 30);
  SPECIALS.saboteur.slip = 0.1;
  assert.ok(!s.people.includes(p), 'he is gone');
  assert.equal(gate.hp, 0, 'the bar sawn through');
  assert.ok(sabotaged(s) && turretsDown(s), 'the towers and traps silent');
  assert.ok(s.raid, 'and his clan is at the gate');
  assert.ok(s.raid!.arrivesTick - s.tick < TICKS_PER_HOUR, 'with hardly any warning');
});

test('a guard on watch catches the saboteur at it; locked up, he is a prisoner and his clan comes as a plain raid', () => {
  const s = plainGame('specials-caught');
  s.tick = 3 * TICKS_PER_DAY;
  blind(s);
  const guard = newcomerPlain(s);
  guard.guard = true;
  guard.skills.melee.level = 40;
  SPECIALS.saboteur.slip = 0;
  const p = newcomer(s, 'saboteur');
  p.secret!.due = s.tick;
  hoursPass(s, 30);
  SPECIALS.saboteur.slip = 0.1;
  const q = secretPrompt(s);
  assert.ok(q && q.text.includes(guard.name), 'caught in the act');
  assert.ok(!sabotaged(s));
  answerPrompt(s, q!.id, 0, new Rng(1));
  assert.ok(!s.people.includes(p));
  assert.ok(s.prisoners.some((x) => x.name === p.name));
  assert.ok(s.nextRaidTick <= s.tick + 24 * TICKS_PER_HOUR);
});

test('the highwayman lifts coins while hidden; handed over, the bounty is paid and the coins found', () => {
  const s = plainGame('specials-outlaw');
  s.tick = 3 * TICKS_PER_DAY;
  s.coins = 500;
  blind(s);
  SPECIALS.outlaw.slip = 0;
  const p = newcomer(s, 'outlaw');
  hoursPass(s, 48);
  SPECIALS.outlaw.slip = 0.08;
  const stolen = p.secret!.stolen ?? 0;
  assert.ok(stolen > 0 && s.coins < 500);
  // someone sharp enough sees the poster
  s.people[0].skills.social.level = 40;
  for (let i = 0; i < 10 && !secretPrompt(s); i++) hoursPass(s, 24);
  const q = secretPrompt(s)!;
  const before = s.coins;
  answerPrompt(s, q.id, 0, new Rng(1));
  assert.equal(s.coins, before + BOUNTY + stolen);
  assert.ok(!s.people.includes(p));
});

test('the black oath broken for coins; the exile given a tower teaches the town a topic', () => {
  const s = plainGame('specials-curse');
  s.tick = 3 * TICKS_PER_DAY;
  s.coins = 200;
  blind(s);
  s.people[0].skills.research.level = 40;
  const knight = newcomer(s, 'cursed');
  for (let i = 0; i < 10 && !secretPrompt(s); i++) hoursPass(s, 24);
  const q = secretPrompt(s)!;
  const lvl = knight.level ?? 1;
  answerPrompt(s, q.id, 0, new Rng(1));
  assert.equal(s.coins, 200 - CURSE_PRICE);
  assert.equal(knight.level, lvl + 5);
  assert.ok(knight.secret!.settled);

  const mage = newcomer(s, 'archmage');
  for (let i = 0; i < 10 && !secretPrompt(s); i++) hoursPass(s, 24);
  const q2 = secretPrompt(s)!;
  assert.equal(q2.who, mage.id);
  const known = s.research.done.length;
  answerPrompt(s, q2.id, 0, new Rng(1));
  assert.equal(s.research.done.length, known + 1);
});

test("a newcomer's calling stays hidden in the town's view until the secret is out", async () => {
  const { snapshot } = await import('../src/shared/sim/snapshot');
  const s = plainGame('specials-view');
  s.tick = 3 * TICKS_PER_DAY;
  const p = newcomer(s, 'veiled');
  const view = () => snapshot(s).people.find((q) => q.id === p.id)!;
  assert.equal(view().clsName, null);
  assert.equal(view().secret, null);
  assert.ok(view().story.includes('says little'));
  p.secret!.found = true;
  assert.ok(view().clsName);
  assert.ok(view().secret!.name.includes('Champion'));
});

test('about one ordinary wanderer in ten is secretly a special too', async () => {
  const { secretWanderer } = await import('../src/shared/sim/specials');
  const s = plainGame('specials-wanderers');
  const p = makePerson(new Rng(9), 1, 'wanderer', campXY(s), []);
  let n = 0;
  for (let id = 1; id <= 2000; id++) {
    p.id = id;
    if (secretWanderer(s, p)) n++;
  }
  assert.ok(n > 140 && n < 260, `secret ${n} of 2000`);
});
