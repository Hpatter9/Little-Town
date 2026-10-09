import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { ANGRY_AT, BLESSED_AT, GROVE_HOUR, GUARDIAN_DAYS, RITES, RITE_HOUR } from '../src/shared/data/grove';
import { ENEMIES } from '../src/shared/data/enemies';
import { storages, totalStock } from '../src/shared/sim/buildings';
import { groveAllies, groveHourly, groveMorning, groveOf, groveRaidOver, groveView, keepRite, noteFelled, noteRegrown } from '../src/shared/sim/grove';
import { markMult } from '../src/shared/sim/origin';
import { ally } from '../src/shared/sim/classes';
import { snapshot } from '../src/shared/sim/snapshot';
import type { GameState, Raid } from '../src/shared/sim/state';
import { calendar, DAYS_PER_SEASON, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function grove(seed: string): GameState {
  const s = plainGame(seed);
  s.origin = 'druid';
  s.autopilot = true;
  s.tick = at(5, GROVE_HOUR);
  return s;
}

test('felling angers the grove, regrowth pleases it, and only a druid town has one', () => {
  const plain = plainGame('grove-none');
  assert.equal(groveOf(plain), null);
  const s = grove('grove-favour');
  const g = groveOf(s)!;
  g.favour = 0;
  for (let i = 0; i < 20; i++) noteFelled(s);
  groveMorning(s, g);
  assert.ok(g.favour <= -8, `felled: ${g.favour}`);
  for (let i = 0; i < 40; i++) noteRegrown(s);
  groveMorning(s, g);
  assert.ok(g.favour > 30, `regrown: ${g.favour}`);
});

test('a pleased grove blesses the fields and sends a guardian, who fights in raids and may fall', () => {
  const s = grove('grove-guard');
  const g = groveOf(s)!;
  g.favour = BLESSED_AT + 20;
  g.lastGuardian = -GUARDIAN_DAYS * TICKS_PER_DAY;
  groveMorning(s, g);
  assert.ok(markMult(s, 'crops') > 1, 'blessed fields');
  assert.equal(g.guardians.length, 1);
  assert.ok(ENEMIES[g.guardians[0].kind]);
  const r = { raiders: [] } as unknown as Raid;
  assert.equal(groveAllies(s, r, (k) => ally(s, k, 0, 1)), 1);
  assert.ok(r.raiders[0].ally && r.raiders[0].guardian === g.guardians[0].id);
  r.raiders[0].hp = 0;
  r.raiders[0].down = true;
  groveRaidOver(s, r);
  assert.equal(g.guardians.length, 0, 'struck down, lost');
});

test('an angry grove curses the fields', () => {
  const s = grove('grove-angry');
  const g = groveOf(s)!;
  g.favour = ANGRY_AT - 20;
  groveMorning(s, g);
  assert.ok(markMult(s, 'crops') < 1);
  assert.equal(groveView(s)!.angry, true);
});

test('the rites are kept at the turn of each season: an offering for a gift, poorer without one', () => {
  const s = grove('grove-rite');
  const g = groveOf(s)!;
  // the turn of autumn: the Reaping, offered fruit, gives berries and herbs
  let d = 1;
  while (calendar(at(d, RITE_HOUR)).season !== 'autumn' || calendar(at(d, RITE_HOUR)).dayOfSeason !== 1) d++;
  s.tick = at(d, RITE_HOUR);
  storages(s)[0].store.fruit = 10;
  const berries = totalStock(s).berries ?? 0;
  const before = g.favour;
  groveHourly(s);
  assert.equal(totalStock(s).fruit, 10 - RITES.autumn.offering.fruit!);
  assert.ok((totalStock(s).berries ?? 0) > berries, 'the grove gave back');
  assert.ok(g.favour > before);
  assert.ok(s.prompts.some((p) => p.title === RITES.autumn.name));
  // kept once a season
  const n = s.prompts.length;
  keepRite(s, g);
  assert.equal(s.prompts.length, n);
  // the next, with nothing to offer: poor, and the grove sulks
  s.tick += DAYS_PER_SEASON * TICKS_PER_DAY;
  for (const st of storages(s)) st.store = {};
  const f = g.favour;
  groveHourly(s);
  assert.ok(g.favour < f, 'a thin offering');
  assert.ok(snapshot(s).heritage?.grove, 'seen');
});
