import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAGAS, SAGA_BY_ID, type Chapter, type Next } from '../src/shared/data/sagas';
import { SAGA_UNIQUES } from '../src/shared/data/uniques';
import { Rng } from '../src/shared/rng';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { beginSaga, sagaRaidOver, sagaTripHome, sagasHourly, sagasOpen, sagaDestinations } from '../src/shared/sim/sagas';
import { destinationOf, destinationUnlocked } from '../src/shared/sim/expeditions';
import { boardDestinations } from '../src/shared/sim/parties';
import { makePerson, campXY, type Expedition, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put, row } from './helpers';

function grownUp(s: GameState): Person {
  const p = makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name));
  s.people.push(p);
  return p;
}
function town(seed: string, people = 5): GameState {
  const s = plainGame(seed);
  s.tick = 5 * TICKS_PER_DAY;
  for (let i = 1; i < people; i++) grownUp(s);
  return s;
}
function hoursPass(s: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    s.tick += TICKS_PER_HOUR;
    sagasHourly(s);
  }
}
const sagaPrompt = (s: GameState) => s.prompts.find((q) => q.kind === 'saga');
const answer = (s: GameState, label: RegExp) => {
  const q = sagaPrompt(s)!;
  const i = q.options.findIndex((o) => label.test(o));
  assert.ok(i >= 0, `no option ${label} in ${q.options.join(' / ')}`);
  answerPrompt(s, q.id, i, new Rng(1));
};
/** A party home from the saga's place, the job done or not. */
function partyHome(s: GameState, cleared: boolean, leader: Person): void {
  const dest = sagaDestinations(s)[0];
  assert.ok(dest, 'a place on the board');
  sagaTripHome(s, { dest: dest.id, cleared, recalled: false, leader: leader.id, members: [leader.id] } as unknown as Expedition);
}

test('six sagas, every chapter they lead to written, every ending reachable, every saga unique a prize', () => {
  assert.equal(SAGAS.length, 6);
  // (two towns: one with a sharp ear among them, one without)
  const s = town('sagas-graph', 8);
  const sharp = town('sagas-graph-2', 8);
  for (const p of s.people) p.skills.social.level = 0;
  sharp.people[1].skills.social.level = 30;
  const flagSets: string[][] = [[], ['boy', 'brave'], ['wynn'], ['box'], ['cure'], ['silver'], ['bell'], ['trust'], ['kept'], ['return'], ['crowned'], ['for_a'], ['fair']];
  const targets = (n: Next) => (typeof n === 'string' ? [n] : flagSets.flatMap((f) => [n(f, s), n(f, sharp)]));
  const prizes = new Set<string>();
  for (const g of SAGAS) {
    assert.ok(g.chapters[g.first], `${g.id} begins somewhere`);
    const seen = new Set<string>([g.first]);
    const todo = [g.first];
    while (todo.length) {
      const c: Chapter = g.chapters[todo.pop()!];
      const nexts: Next[] =
        c.kind === 'choice' ? c.options.map((o) => o.next)
        : c.kind === 'trip' ? [c.win, c.lose, c.late ?? c.lose]
        : c.kind === 'task' ? [c.done, c.late]
        : c.kind === 'raid' ? [c.win, c.lose]
        : c.kind === 'wait' ? [c.next]
        : [];
      if (c.kind === 'end') for (const e of c.effects ?? []) if ('unique' in e) prizes.add(e.unique);
      for (const n of nexts)
        for (const t of targets(n)) {
          assert.ok(g.chapters[t], `${g.id}: no chapter ${t}`);
          if (!seen.has(t)) {
            seen.add(t);
            todo.push(t);
          }
        }
    }
    for (const id of Object.keys(g.chapters)) assert.ok(seen.has(id), `${g.id}: ${id} is never reached`);
    assert.ok(Object.values(g.chapters).some((c) => c.kind === 'end' && c.outcome === 'triumph'), `${g.id} can end well`);
    assert.ok(Object.values(g.chapters).some((c) => c.kind === 'end' && c.outcome !== 'triumph'), `${g.id} can end badly`);
  }
  for (const u of SAGA_UNIQUES) assert.ok(prizes.has(u), `${u} is some saga's prize`);
});

test('the Burnt Cart: a question, a trip on the board, a raid, and a triumph that leaves a title and a unique', () => {
  const s = town('sagas-cart');
  beginSaga(s, 'burnt_cart');
  assert.ok(sagaPrompt(s)?.picture, 'asked, full screen with a picture');
  answer(s, /go after them/);
  const d = sagaDestinations(s)[0];
  assert.ok(boardDestinations(s).some((x) => x.id === d.id), 'on the Expedition Board');
  assert.ok(destinationUnlocked(s, destinationOf(s, d.id)!));
  const hero = s.people[1];
  partyHome(s, true, hero);
  answer(s, /Free Wynn/);
  assert.equal(sagaDestinations(s).length, 0, 'the place is off the board');
  hoursPass(s, 31);
  assert.ok(s.raid && s.raid.saga !== undefined, 'Black Maud rides on the town');
  const maud = s.raid!.raiders.find((r) => r.kind === 'bandit_chief')!;
  assert.ok(maud, 'Maud leads it');
  maud.down = true;
  const people = s.people.length;
  sagaRaidOver(s, s.raid!);
  assert.equal(s.sagas!.length, 0);
  assert.equal(s.sagasDone![0].outcome, 'triumph');
  assert.ok(s.uniques!.includes('maudbane'));
  assert.ok(hero.titles?.includes("Maud's Bane"));
  assert.equal(s.people.length, people + 1, 'Wynn joins');
});

test('nobody goes in time: the story bends (Wynn is lost, the boy stays)', () => {
  const s = town('sagas-late');
  beginSaga(s, 'burnt_cart');
  answer(s, /go after them/);
  hoursPass(s, 4 * 24 + 1);
  assert.equal(s.sagasDone?.[0]?.outcome, 'bittersweet');
});

test('a beaten party, then the raid lost: ruin', () => {
  const s = town('sagas-ruin');
  s.coins = 400;
  beginSaga(s, 'burnt_cart');
  answer(s, /go after them/);
  partyHome(s, false, s.people[1]);
  hoursPass(s, 31);
  assert.ok(s.raid);
  sagaRaidOver(s, s.raid!);
  assert.equal(s.sagasDone![0].outcome, 'ruin');
});

test('a task chapter waits for the town to build what it needs', () => {
  const s = town('sagas-task');
  s.era = 'medieval';
  beginSaga(s, 'plague_doctor');
  answer(s, /Trust him/);
  partyHome(s, true, s.people[2]);
  assert.equal(s.sagas![0].ch, 'brewhouse');
  hoursPass(s, 5);
  assert.equal(s.sagas![0].ch, 'brewhouse', 'still waiting');
  put(s, 'healers_hut', 4, row(s));
  hoursPass(s, 1);
  assert.equal(s.sagasDone![0].outcome, 'triumph');
  assert.ok(s.uniques!.includes('corvins_lancet'));
});

test('the Feud is about two of the town, and the duel can kill', () => {
  const s = town('sagas-feud', 7);
  const run = beginSaga(s, 'feud')!;
  assert.ok(run.a && run.b && run.a !== run.b && run.a !== s.mainId && run.b !== s.mainId);
  const a = s.people.find((p) => p.id === run.a)!;
  assert.ok(sagaPrompt(s)!.text.includes(a.name), 'named in the question');
  answer(s, /share the field/);
  hoursPass(s, 31);
  answer(s, /settle it themselves/);
  answer(s, /Marry/);
  assert.equal(s.sagasDone![0].outcome, 'triumph');
  assert.ok(s.uniques!.includes('peacemaker'));
});

test('sagas begin by themselves, one the town has not had, two at most', () => {
  const s = town('sagas-begin', 7);
  s.era = 'medieval';
  s.nextEventTick = s.tick + 1;
  s.autopilot = true;
  assert.ok(sagasOpen(s).length >= 3);
  for (let d = 0; d < 12; d++) hoursPass(s, 24);
  assert.ok((s.sagas?.length ?? 0) + (s.sagasDone?.length ?? 0) >= 2, 'stories found the town');
  assert.ok((s.sagas?.length ?? 0) <= 2);
  const ids = [...(s.sagas ?? []).map((r) => r.id), ...(s.sagasDone ?? []).map((r) => r.id)];
  assert.equal(new Set(ids).size, ids.length, 'none twice');
  assert.ok(SAGA_BY_ID[ids[0]]);
});
