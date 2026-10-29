// The God creature comes sooner (docs/notes/creature-quest.md): a quest the founder leads, from the second morning of
// a new town, to a broken nest out in the wild; the pen open from the start; the research no longer its gate.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREATURE_PEN, CREATURE_SAGA, CREATURE_TOPIC, QUEST_DAY, QUEST_HOUR, TOPIC_GROW } from '../src/shared/data/creature';
import { HOLLOW_FOES } from '../src/shared/data/creatureSaga';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { Rng } from '../src/shared/rng';
import { adoptCreature, creatureArrives, creatureHourly, doDeed } from '../src/shared/sim/creature';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { pinRefusal } from '../src/shared/sim/pins';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { beginSaga, isSagaDest, sagaTripHome, sagasHourly } from '../src/shared/sim/sagas';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { campXY, makePerson, newGame, type GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put, row } from './helpers';

/** A town on the morning the quest is due (or `at` ticks from its start), with a few townsfolk. */
function town(seed: string, at = (QUEST_DAY * 24 + QUEST_HOUR - START_HOUR) * TICKS_PER_HOUR, people = 4): GameState {
  const s = plainGame(seed);
  s.tick = at;
  for (let i = 1; i < people; i++) s.people.push(makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name)));
  put(s, 'stockpile', campXY(s).x / 32 + 4, row(s), { store: { berries: 40, meat: 20, stone: 30 } });
  s.autopilot = true;
  return s;
}
const hour = (s: GameState) => (s.tick = (Math.floor(s.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR);
const founder = (s: GameState) => s.people.find((p) => p.id === s.mainId)!;
const sagaAsk = (s: GameState) => s.prompts.find((p) => p.kind === 'saga');
const run = (s: GameState) => (s.sagas ?? []).find((r) => r.id === CREATURE_SAGA);
const tripOut = (s: GameState) => s.expeditions.find((e) => isSagaDest(e.dest));
/** The party is home from the nest, having cleared it or not. */
function comeHome(s: GameState, cleared: boolean): void {
  const e = tripOut(s)!;
  s.expeditions = s.expeditions.filter((x) => x !== e);
  for (const p of s.people) if (e.members.includes(p.id)) p.away = null;
  if (cleared) e.cleared = true;
  sagaTripHome(s, e);
}

test('the quest is put on the second morning of a new town, with no research and no pen', () => {
  const early = town('cq-early', (QUEST_DAY * 24 + QUEST_HOUR - START_HOUR - 1) * TICKS_PER_HOUR);
  creatureArrives(early);
  assert.ok(!run(early), 'not before eight on the second morning');
  const s = town('cq-offer');
  s.autopilot = false;
  creatureArrives(s);
  assert.ok(!run(s), 'only with the autopilot on');
  s.autopilot = true;
  creatureArrives(s);
  assert.ok(run(s), 'the saga begins');
  assert.ok(!s.research.done.includes(CREATURE_TOPIC) && !s.buildings.some((b) => b.def === CREATURE_PEN), 'with no research and no pen');
  assert.ok(s.creatureQuest && HOLLOW_FOES[s.creatureQuest.region], 'the nest lies in one of the wild lands');
  const q = sagaAsk(s)!;
  assert.ok(q && q.options.length === 2, 'the quest is offered: go, or not yet');
  assert.ok(!q.waits && q.defaultOption === 1, 'the offer does not hold the game: left alone, it is "not yet"');
  assert.ok(!q.text.includes('{wild}') && /Westwood|Eastwood|Crags|Ridges/.test(q.text), 'it names the land');
  assert.ok(!waitingOnFounder(s), 'a town left to itself goes on');
  // (the same town picks the same land)
  const again = town('cq-offer');
  creatureArrives(again);
  assert.equal(again.creatureQuest!.region, s.creatureQuest.region);
  creatureArrives(s);
  assert.equal((s.sagas ?? []).length, 1, 'once');
});

test('setting out: the founder leads a party to the nest; "not yet" asks again the next day', () => {
  const s = town('cq-lead');
  creatureArrives(s);
  answerPrompt(s, sagaAsk(s)!.id, 0, new Rng(1));
  const e = tripOut(s)!;
  assert.ok(e, 'a party is out for the nest');
  assert.equal(e.leader, s.mainId, 'led by the founder');
  assert.notEqual(founder(s).away, null, 'the founder is away with it');
  assert.ok(!waitingOnFounder(s));

  const w = town('cq-wait');
  creatureArrives(w);
  answerPrompt(w, sagaAsk(w)!.id, 1, new Rng(1));
  assert.ok(!sagaAsk(w) && !tripOut(w), 'not yet: nobody goes');
  for (let i = 0; i < 21; i++) {
    hour(w);
    sagasHourly(w);
  }
  assert.ok(sagaAsk(w), 'asked again the next day');
});

test('a founder who cannot go at once leads the party as soon as they can', () => {
  const s = town('cq-later');
  creatureArrives(s);
  const f = founder(s);
  f.downed = { bleedUntil: null };
  answerPrompt(s, sagaAsk(s)!.id, 0, new Rng(1));
  assert.ok(!tripOut(s), 'down: nobody goes yet');
  f.downed = null;
  hour(s);
  sagasHourly(s);
  assert.equal(tripOut(s)?.leader, s.mainId, 'on their feet: they go');
});

test('finishing the quest: the lineup, the creature home and named, its first night, and somewhere to sleep with no pen', () => {
  const s = town('cq-home');
  creatureArrives(s);
  answerPrompt(s, sagaAsk(s)!.id, 0, new Rng(1));
  comeHome(s, true);
  const nest = sagaAsk(s)!;
  assert.ok(nest.beasts && nest.waits && nest.options.length === 5, 'the five in their lineup, holding the game');
  answerPrompt(s, nest.id, nest.options.findIndex((o) => /Wolf/.test(o)), new Rng(1));
  assert.equal(s.creature?.kind, 'wolf', 'the creature is the town\'s');
  assert.match(s.eventOutcome?.text ?? '', /young wolf is the town's now/, 'and the card says so (it said "Nothing more came of it")');
  assert.ok(s.prompts.some((p) => p.kind === 'name' && p.naming?.kind === 'creature'), 'and the town names it');
  assert.ok(snapshot(s).creature, 'seen, so the build menu shows its pen');
  const night = sagaAsk(s)!;
  assert.ok(night.waits && /first night/.test(night.text), 'its first night is a question');
  assert.ok(!/\.\./.test(night.text), `one full stop after the pick: ${night.text}`);
  const align = s.creature!.align;
  answerPrompt(s, night.id, 0, new Rng(1));
  assert.ok(s.creature!.align > align, 'sat up with: it is gentler for it');
  assert.match(s.eventOutcome?.text ?? '', /gentler.*takes to keeping at the founder's side/, s.eventOutcome?.text ?? '');
  assert.equal(run(s)?.ch, 'young', 'the saga goes on as it did');
  // (no pen yet: it beds down at the camp, near the founder, and Rest takes it there)
  doDeed(s, s.creature!, 'sleep', new Rng(2));
  const camp = campXY(s);
  assert.ok(Math.hypot(s.creature!.goal!.x - camp.x, s.creature!.goal!.y - camp.y) < 32 * 6, 'it sleeps by the camp');
  assert.equal(pinRefusal(s, BUILDING_BY_ID[CREATURE_PEN]), null, 'its pen can be ordered at once');
});

test('beaten at the nest, the town is asked again the next day', () => {
  const s = town('cq-beaten');
  creatureArrives(s);
  answerPrompt(s, sagaAsk(s)!.id, 0, new Rng(1));
  comeHome(s, false);
  assert.equal(run(s)?.ch, 'beaten');
  assert.ok(!s.creature);
  for (let i = 0; i < 25; i++) {
    hour(s);
    sagasHourly(s);
  }
  assert.equal(run(s)?.ch, 'call', 'the quest is put again');
  assert.ok(sagaAsk(s));
});

test('the research no longer brings it, but a creature grows faster and learns better once it is studied', () => {
  const a = town('cq-topic');
  const b = town('cq-topic');
  b.research.done.push(CREATURE_TOPIC);
  const ca = adoptCreature(a, 'bear');
  const cb = adoptCreature(b, 'bear');
  for (let i = 0; i < 10; i++) {
    for (const [s, c] of [[a, ca], [b, cb]] as const) {
      hour(s);
      c.hunger = 90;
      creatureHourly(s, c);
    }
  }
  const grewA = ca.size - 0.1;
  const grewB = cb.size - 0.1;
  assert.ok(Math.abs(grewB / grewA - TOPIC_GROW) < 0.05, 'half as fast again');
});

test('old saves: a creature come, a saga under way or done, are left as they were; an old saga still reaches the pick', () => {
  const had = town('cq-old-had');
  adoptCreature(had, 'ape');
  creatureArrives(had);
  assert.ok(!run(had), 'a town with its creature: no quest');

  const done = town('cq-old-done');
  (done.sagasDone ??= []).push({ id: CREATURE_SAGA, outcome: 'ruin', tick: 0, story: [] });
  creatureArrives(done);
  assert.ok(!run(done), 'its saga over: none again');

  // (an old saga begun by the research and the pen, at its signs: it carries on to the pick, and to its first deed)
  const old = town('cq-old-saga');
  old.research.done.push(CREATURE_TOPIC);
  put(old, CREATURE_PEN, campXY(old).x / 32 - 8, row(old));
  const r = beginSaga(old, CREATURE_SAGA)!;
  r.ch = 'signs';
  old.prompts = old.prompts.filter((p) => p.kind !== 'saga');
  delete old.creatureQuest;
  const back = parseSave(serialize(old, 0));
  assert.ok(back.ok);
  const s = back.save.state;
  for (let i = 0; i < 30 && !sagaAsk(s); i++) {
    hour(s);
    sagasHourly(s);
    creatureArrives(s);
  }
  const pick = sagaAsk(s)!;
  assert.ok(pick?.beasts, 'the old way still reaches the lineup');
  answerPrompt(s, pick.id, 0, new Rng(1));
  assert.ok(s.creature, 'adopted');
  assert.equal(run(s)?.ch, 'young', 'no first night for an old saga: straight on');
  assert.equal((s.sagas ?? []).filter((x) => x.id === CREATURE_SAGA).length, 1, 'and no second saga');
});

test('a new town played through: the creature is home within the first days', () => {
  const s = newGame('d4');
  const sim = new Sim(s);
  const seen = new Set<number>();
  let home: number | null = null;
  for (let i = 0; i < 3 * TICKS_PER_DAY && home === null; i++) {
    sim.step();
    for (const p of s.prompts) {
      if (!(p.waits || p.kind === 'saga') || seen.has(p.id)) continue;
      seen.add(p.id);
      answerPrompt(s, p.id, 0, new Rng(1));
    }
    if (s.creature) home = s.tick;
  }
  assert.ok(home !== null, 'it came');
  assert.ok(home! < 3 * TICKS_PER_DAY, `home by day ${(home! / TICKS_PER_DAY).toFixed(1)}`);
});
