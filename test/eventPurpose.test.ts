import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS, EVENT_BY_ID, type EventDef, type EventEffect } from '../src/shared/data/events';
import { bond, build, coin, horse, item, opt, dflt, teach, trait } from '../src/shared/data/eventKit';
import { Rng } from '../src/shared/rng';
import { answerEvent, startEvent } from '../src/shared/sim/events';
import { opinion } from '../src/shared/sim/social';
import { plainGame } from './helpers';

/** Only a note, or a little morale: an answer that does nothing you could point to. */
const empty = (effects: readonly EventEffect[]) => effects.every((e) => 'note' in e || ('mood' in e && Math.abs(e.mood) <= 4));

test('every answer to every event does something you can point to (not just a note or a little morale)', () => {
  const idle = EVENTS.flatMap((e) => e.options.filter((o) => empty(o.effects)).map((o) => `${e.id}: ${o.label}`));
  assert.deepEqual(idle, []);
});

/** Put a made-up event to a town and answer it. */
function answer(def: EventDef, option = 0, seed = 'purpose') {
  (EVENT_BY_ID as Record<string, EventDef>)[def.id] = def;
  const s = plainGame(seed);
  startEvent(s, def, new Rng(1));
  const before = s.journal.length;
  answerEvent(s, option, new Rng(2));
  return { s, said: s.journal.slice(before).map((j) => j.text) };
}

test('what came of an answer is said in one line under its title', () => {
  const def: EventDef = { id: 'test_gift', title: 'A gift', text: 'A gift at the gate.', options: [dflt('Take it', coin(7), { gain: { wood: 5 } }), opt('Leave it', coin(1))] };
  const { s, said } = answer(def);
  assert.ok(said.some((t) => t.startsWith('A gift:') && t.includes('+7 coins') && t.includes('+5 wood')), said.join(' | '));
  assert.ok((s.coins ?? 0) >= 7);
});

test('the new effects: a skill learned, a bond, a trait, gear, a horse, a building ready to raise', () => {
  const s0 = plainGame('purpose');
  const who = s0.people[0];
  const level = who.skills.crafting.level;
  const def: EventDef = {
    id: 'test_new', title: 'Something new', text: '...', who: true,
    options: [dflt('Yes', teach('crafting', 2), trait('tough'), item('spear', 2), horse(), build('drying_rack')), opt('No', bond(30))],
  };
  const { s, said } = answer(def);
  const p = s.people.find((q) => q.id === who.id)!;
  assert.ok(p.skills.crafting.level >= level + 2, `crafting ${level} -> ${p.skills.crafting.level}`);
  assert.ok(p.traits.includes('tough'));
  assert.ok(said.join().includes('2 spear'), said.join(' | '));
  assert.equal(s.horses.length, 1);
  assert.ok(said.join().includes('drying rack'), said.join(' | '));
  // a bond needs two people: the founder and someone else
  const t = plainGame('purpose-bond');
  t.people.push({ ...structuredClone(t.people[0]), id: t.nextId++, name: 'Other' });
  const other = t.people[1];
  startEvent(t, def, new Rng(1));
  t.event!.who = other.id;
  answerEvent(t, 1, new Rng(2));
  assert.equal(opinion(t, other.id, t.mainId), 30);
});
