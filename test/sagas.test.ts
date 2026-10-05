import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAGAS, type Chapter, type Next } from '../src/shared/data/sagas';
import { SAGA_UNIQUES } from '../src/shared/data/uniques';
import { Rng } from '../src/shared/rng';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { beginSaga, sagaRaidOver, sagaTripHome, sagasHourly, sagaDestinations } from '../src/shared/sim/sagas';
import { destinationOf, destinationUnlocked } from '../src/shared/sim/expeditions';
import { boardDestinations } from '../src/shared/sim/parties';
import { makePerson, campXY, type Expedition, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put, row } from './helpers';
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { ITEM_BY_ID } from '../src/shared/data/items';

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

test('thirty-one sagas, every chapter they lead to written, every ending reachable, every saga unique a prize', () => {
  assert.equal(SAGAS.length, 31);
  assert.equal(new Set(SAGAS.map((g) => g.id)).size, SAGAS.length, 'each its own id');
  // (two towns: a plain one, and one with sharp minds, learning and the buildings the stories ask about)
  const s = town('sagas-graph', 8);
  const sharp = town('sagas-graph-2', 8);
  for (const p of s.people) for (const k of ['social', 'research'] as const) p.skills[k].level = 0;
  sharp.people[1].skills.social.level = 30;
  sharp.people[1].skills.research.level = 30;
  sharp.research.done.push('writing', 'electronics');
  for (const [i, b] of ['library', 'storytellers_circle', 'graveyard', 'resurrection_shrine', 'tavern'].entries()) put(sharp, b, 2 + i * 4, row(sharp) + 4);
  const flagSets: string[][] = [[], ['boy', 'brave'], ['wynn'], ['box'], ['cure'], ['silver'], ['bell'], ['trust'], ['kept'], ['return'], ['crowned'], ['for_a'], ['fair']];
  const eras = ['neolithic', 'medieval', 'industrial', 'modern', 'space'] as const;
  const targets = (n: Next) => (typeof n === 'string' ? [n] : flagSets.flatMap((f) => [n(f, s), n(f, sharp)]));
  const prizes = new Set<string>();
  for (const g of SAGAS) {
    assert.ok(g.chapters[g.first], `${g.id} begins somewhere`);
    const seen = new Set<string>([g.first]);
    const todo = [g.first];
    while (todo.length) {
      const c: Chapter = g.chapters[todo.pop()!];
      if (c.kind === 'trip')
        for (const era of eras) {
          const foes: Partial<Record<string, number>> = typeof c.foes === 'function' ? c.foes({ ...s, era } as typeof s) : c.foes;
          for (const id of Object.keys(foes)) assert.ok(ENEMIES[id], `${g.id}: no foe ${id}`);
        }
      if (c.kind === 'raid') {
        assert.ok(c.raid === 'people' || RAID_KIND_BY_ID[c.raid], `${g.id}: no raid ${c.raid}`);
        if (c.boss) assert.ok(ENEMIES[c.boss], `${g.id}: no boss ${c.boss}`);
      }
      const nexts: Next[] =
        c.kind === 'choice' ? c.options.map((o) => o.next)
        : c.kind === 'trip' ? [c.win, c.lose, c.late ?? c.lose]
        : c.kind === 'task' ? [c.done, c.late]
        : c.kind === 'raid' ? [c.win, c.lose]
        : c.kind === 'wait' ? [c.next]
        : [];
      if (c.kind === 'end') for (const e of c.effects ?? []) if ('unique' in e) {
        assert.ok(ITEM_BY_ID[e.unique]?.unique, `${g.id}: ${e.unique} is a unique`);
        prizes.add(e.unique);
      }
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
  hoursPass(s, 5 * 24 + 1);
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

test('sagas come rarely: one at a time, never within ten days of the last one ending, each once', () => {
  const s = town('sagas-begin', 7);
  s.era = 'medieval';
  s.tick = 0;
  s.nextEventTick = 1;
  s.autopilot = true;
  hoursPass(s, 24 * 4 - 1);
  assert.equal(s.sagas?.length ?? 0, 0, 'none in the first days');
  const begun: number[] = [];
  const ended: number[] = [];
  for (let h = 0; h < 24 * 120; h++) {
    hoursPass(s, 1);
    assert.ok((s.sagas?.length ?? 0) <= 1, 'one at a time');
    const r = s.sagas?.[0];
    if (r && !begun.includes(r.started)) begun.push(r.started);
    // (each saga is wound up a day after it begins, as if it had run its course)
    if (r && s.tick - r.started >= TICKS_PER_DAY) {
      s.sagas = [];
      s.prompts = s.prompts.filter((q) => q.kind !== 'saga');
      (s.sagasDone ??= []).push({ id: r.id, outcome: 'bittersweet', tick: s.tick });
      ended.push(s.tick);
    }
  }
  assert.ok(begun.length >= 3, `${begun.length} sagas in 120 days`);
  assert.ok(begun.length <= 9, `${begun.length} sagas in 120 days is too many`);
  for (let i = 1; i < begun.length; i++) assert.ok(begun[i] - ended[i - 1] >= 10 * TICKS_PER_DAY, 'a ten-day break between');
  const ids = (s.sagasDone ?? []).map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'none twice');
});
