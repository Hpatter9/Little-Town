import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BROWNOUT, DIRECTIVES, DISSENT_MOST, FOUNDRY_HOUR, MEND_AT, UNIT_DAYS } from '../src/shared/data/foundry';
import { Rng } from '../src/shared/rng';
import { storages, totalStock } from '../src/shared/sim/buildings';
import { answerFoundry, fitModule, foundryOf, line, power, wear } from '../src/shared/sim/foundry';
import { makePerson, type GameState, type Prompt } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function colony(seed: string): GameState {
  const s = plainGame(seed);
  s.origin = 'robot';
  s.autopilot = true;
  s.tick = at(5, FOUNDRY_HOUR);
  return s;
}

test('the production line builds a unit from parts', () => {
  const s = colony('fd-line');
  const f = foundryOf(s)!;
  storages(s)[0].store = { alloys: 20, circuits: 10 };
  const n = s.people.length;
  assert.equal(line(s, f), null);
  assert.ok(f.building !== undefined, 'on the line');
  assert.equal(totalStock(s).alloys, 14);
  s.tick += UNIT_DAYS * TICKS_PER_DAY;
  const p = line(s, f);
  assert.ok(p);
  assert.equal(s.people.length, n + 1);
});

test('power runs down with no sun or fuel, then brown-out and blackout slow the colony', () => {
  const s = colony('fd-power');
  const f = foundryOf(s)!;
  f.power = 5;
  for (const st of storages(s)) st.store = {};
  const rng = new Rng(7);
  const c = s.people[0];
  while (s.people.length < 10) s.people.push(makePerson(rng, s.nextId++, 'crafter', { x: c.x, y: c.y }, s.people.map((q) => q.name)));
  for (let i = 0; i < 3; i++) power(s, f, new Rng(i));
  assert.ok(f.power < BROWNOUT, `power ${f.power}`);
  assert.ok((s.marks ?? []).some((m) => m.lever === 'work' && m.value < 1));
  // cells burned to recharge
  storages(s)[0].store.power_cells = 10;
  power(s, f, new Rng(9));
  assert.ok(f.power >= 50, `recharged: ${f.power}`);
});

test('wear is mended with parts; worn through without them, a fault', () => {
  const s = colony('fd-wear');
  const f = foundryOf(s)!;
  const p = s.people[0];
  f.wear[p.id] = MEND_AT + 5;
  storages(s)[0].store = { alloys: 5 };
  wear(s, f, new Rng(1));
  assert.equal(f.wear[p.id], 0, 'mended');
  for (const st of storages(s)) st.store = {};
  f.wear[p.id] = 99;
  wear(s, f, new Rng(2));
  assert.equal(f.faults, 1);
});

test('spare circuits become modules; an overruled Mind stops asking', () => {
  const s = colony('fd-mind');
  const f = foundryOf(s)!;
  storages(s)[0].store = { circuits: 20, alloys: 20 };
  const p = s.people[0];
  assert.ok(fitModule(s, f, new Rng(3)));
  assert.equal(f.modules[p.id].length, 1);
  const q = { ways: { system: 'foundry', about: DIRECTIVES[0].id } } as Prompt;
  for (let i = 0; i < DISSENT_MOST; i++) answerFoundry(s, q, 1, new Rng(i));
  assert.equal(f.dissent, DISSENT_MOST);
  assert.ok(snapshot(s).heritage?.foundry);
});
