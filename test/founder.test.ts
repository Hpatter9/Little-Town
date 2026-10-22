// Playing the founder: the five orders, the heir rule (named heir, then partner, then eldest grown child) and the game
// over when the founder dies with none of them to take up the town.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand } from '../src/shared/sim/commands';
import { GIVE_STEPS, REST_HOURS } from '../src/shared/sim/founder';
import { heirOf, killPerson } from '../src/shared/sim/health';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { buildingDoor } from '../src/shared/sim/buildings';
import { CELL } from '../src/shared/sim/land';
import { campPx, plainGame, put, row, camp } from './helpers';

function town(seed: string): GameState {
  const s = plainGame(seed);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  return s;
}
function add(s: GameState, name: string, extra: Partial<Person> = {}): Person {
  const p = makePerson(new Rng(s.nextId), s.nextId++, 'hunter', campPx(s), s.people.map((q) => q.name));
  p.name = name;
  Object.assign(p, extra);
  s.people.push(p);
  return p;
}

test('Go to: the founder walks to the building and the order ends when they arrive', () => {
  const s = town('founder-go');
  const sim = new Sim(s);
  const f = s.people[0];
  const b = put(s, 'lean_to', camp(s).x + 8, row(s));
  sim.command({ type: 'founderGo', building: b.id });
  sim.step();
  sim.step();
  assert.equal(s.founderOrder?.kind, 'go');
  for (let i = 0; i < 40 * 20 && s.founderOrder; i++) sim.step();
  assert.equal(s.founderOrder, undefined, 'arrived');
  const door = buildingDoor(b);
  assert.ok(Math.hypot(f.x - door.x, f.y - door.y) < CELL, 'they are at its door');
});

test('Work at: the founder works the chosen job for the day, then the order lapses', () => {
  const s = town('founder-work');
  const sim = new Sim(s);
  const f = s.people[0];
  f.priorities = { haul: 0, construct: 0, farm: 0, craft: 0, research: 0, gather: 1, defend: 0 };
  sim.command({ type: 'founderWork', job: 'gather' });
  sim.step();
  assert.equal(s.founderOrder?.kind, 'work');
  sim.command({ type: 'founderWork', job: null });
  sim.step();
  assert.equal(s.founderOrder, undefined, 'back to the town’s choice');
  sim.command({ type: 'founderWork', job: 'gather' });
  sim.step();
  s.tick += TICKS_PER_DAY + 1;
  sim.step();
  assert.equal(s.founderOrder, undefined, 'a day later it has lapsed');
});

test('Give to the town: coins move from the purse to the treasury, no more than the purse holds', () => {
  const s = town('founder-give');
  const sim = new Sim(s);
  const f = s.people[0];
  f.coins = 12;
  const before = s.coins ?? 0;
  sim.command({ type: 'founderGive', amount: GIVE_STEPS[0] });
  sim.step();
  assert.equal(f.coins, 7);
  assert.equal(s.coins, before + 5);
  sim.command({ type: 'founderGive', amount: 50 });
  sim.step();
  assert.equal(f.coins, 0);
  assert.equal(s.coins, before + 12);
  assert.equal(parseCommand({ type: 'founderGive', amount: -3 }), null);
  assert.equal(parseCommand({ type: 'founderGive', amount: 1.5 }), null);
});

test('Rest: the founder goes to bed, mends and lifts their spirits, and the rest ends', () => {
  const s = town('founder-rest');
  const sim = new Sim(s);
  const f = s.people[0];
  const home = put(s, 'lean_to', camp(s).x + 3, row(s));
  f.bed = home.id;
  f.hp = f.hp * 0.4;
  f.morale = 30;
  const hp = f.hp;
  sim.command({ type: 'founderRest' });
  sim.step();
  for (let i = 0; i < (REST_HOURS + 1) * TICKS_PER_HOUR; i++) sim.step();
  assert.equal(s.founderOrder, undefined, 'the rest is over');
  assert.ok(f.hp > hp, 'mended');
  assert.ok(f.morale > 30, 'cheered');
});

test('Name an heir: only a grown-up can be named', () => {
  const s = town('founder-name');
  const sim = new Sim(s);
  const a = add(s, 'Ada');
  const kid = add(s, 'Kit', { bornTick: 0 });
  sim.command({ type: 'founderHeir', person: kid.id });
  sim.step();
  assert.equal(s.heirId, undefined, 'a child cannot be named');
  sim.command({ type: 'founderHeir', person: a.id });
  sim.step();
  assert.equal(s.heirId, a.id);
  sim.command({ type: 'founderHeir', person: null });
  sim.step();
  assert.equal(s.heirId, undefined);
});

test('the heir order: the named heir, then the partner, then the eldest grown child', () => {
  const s = town('founder-heirs');
  const f = s.people[0];
  const stranger = add(s, 'Stranger', { skills: { ...s.people[0].skills } });
  const young = add(s, 'Young', { parents: [f.id] });
  const eldest = add(s, 'Elder', { parents: [f.id] });
  eldest.id = young.id - 1; // (born first)
  const partner = add(s, 'Partner');
  f.partner = partner.id;
  const named = add(s, 'Named');
  s.heirId = named.id;
  assert.equal(heirOf(s, f)?.id, named.id);
  s.people = s.people.filter((p) => p !== named);
  assert.equal(heirOf(s, f)?.id, partner.id, 'then the partner');
  s.people = s.people.filter((p) => p !== partner);
  assert.equal(heirOf(s, f)?.id, eldest.id, 'then the eldest grown child');
  young.bornTick = 0;
  eldest.bornTick = 0;
  assert.equal(heirOf(s, f), undefined, 'children are no heirs, and a stranger is not one');
  assert.ok(stranger);
});

test('the founder dies with no heir: the game is over, with their name, days and how they died', () => {
  const s = town('founder-over');
  add(s, 'Stranger');
  s.tick = 7 * TICKS_PER_DAY + 5;
  const f = s.people[0];
  killPerson(s, f, 'in a raid');
  assert.ok(s.gameOver, 'game over');
  assert.equal(s.gameOver?.founder, f.name);
  assert.equal(s.gameOver?.days, 7);
  assert.equal(s.gameOver?.cause, 'in a raid');
  assert.equal(s.gameOver?.won, undefined);
});

test('the founder dies with a grown child: the child leads and the game goes on', () => {
  const s = town('founder-child');
  const f = s.people[0];
  const kid = add(s, 'Heir', { parents: [f.id] });
  killPerson(s, f, 'of old age');
  assert.equal(s.gameOver, null);
  assert.equal(s.mainId, kid.id);
});
