import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEED_TITLES } from '../src/shared/data/deeds';
import { ENEMIES } from '../src/shared/data/enemies';
import { bossSlain } from '../src/shared/sim/bosses';
import { addDeed, awardDeedTitles, TOP_DEED_TITLES } from '../src/shared/sim/deeds';
import { rareView } from '../src/shared/sim/rare';
import { noteSeen } from '../src/shared/sim/seen';
import { snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';

test('a boss slain is kept for the legends shelf, once, and only with the autopilot on', () => {
  const s = plainGame('seen-boss');
  const boss = Object.values(ENEMIES).find((e) => e.boss && e.kit)!.id;
  bossSlain(s, boss);
  assert.equal(s.seen?.bosses, undefined, 'a plain game keeps nothing');
  s.autopilot = true;
  bossSlain(s, boss);
  bossSlain(s, boss);
  assert.deepEqual(s.seen?.bosses, [boss]);
  assert.deepEqual(rareView(s).bosses, [boss]);
});

test('only a deed ladder\'s top title is kept as a legendary deed', () => {
  const s = plainGame('seen-deeds');
  s.autopilot = true;
  const p = s.people[0];
  const steps = DEED_TITLES.bosses.steps;
  addDeed(p, 'bosses', steps[0][0]);
  awardDeedTitles(s);
  assert.equal(s.seen?.deeds, undefined, 'the first step is no legend');
  addDeed(p, 'bosses', steps[steps.length - 1][0]);
  awardDeedTitles(s);
  assert.deepEqual(s.seen?.deeds, [steps[steps.length - 1][1]]);
  assert.ok(TOP_DEED_TITLES.has(steps[steps.length - 1][1]));
});

test('the rare view reads what the town already keeps, and an old save without any of it', () => {
  const s = plainGame('seen-rare');
  const empty = rareView(s);
  assert.deepEqual(empty, { mythics: [], uniques: [], specials: [], sagas: [], dwellers: [], dragon: null, bosses: [], deeds: [] });
  s.autopilot = true;
  s.uniques = ['brood_stinger'];
  s.mythics = [{ id: s.people[0].id, road: 'my_pact_born', line: '', tick: 5 }];
  s.sagasDone = [{ id: 'x', outcome: 'triumph', tick: 9 }];
  noteSeen(s, 'specials', 'archmage');
  const r = snapshot(s).rare!;
  assert.deepEqual(r.uniques, ['brood_stinger']);
  assert.equal(r.mythics[0].who, s.people[0].name);
  assert.equal(r.sagas[0].hero, null);
  assert.deepEqual(r.specials, [{ id: 'archmage', who: null }]);
});
