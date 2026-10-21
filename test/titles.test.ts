import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEED_STEPS, DEED_TITLES } from '../src/shared/data/deeds';
import { TITLE_MOST, TITLE_RULES } from '../src/shared/data/titles';
import { credit } from '../src/shared/sim/raidRecap';
import { addDeed, awardDeedTitles, tally } from '../src/shared/sim/deeds';
import { awardCharacterTitles, earnedTitles } from '../src/shared/sim/titles';
import { snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';

test('every title is unique, and the ladders ask for more than they once did', () => {
  const titles = TITLE_RULES.map((r) => r.title);
  assert.equal(new Set(titles).size, titles.length);
  assert.ok(titles.length >= 80, 'many kinds of title');
  for (const k of Object.keys(DEED_STEPS) as (keyof typeof DEED_STEPS)[]) {
    const steps = DEED_STEPS[k];
    assert.deepEqual(DEED_TITLES[k].steps.map(([n]) => n), [...steps]);
    assert.ok(steps[0] >= 2, 'a first title is never a single deed');
    assert.ok(steps.every((n, i) => i === 0 || n > steps[i - 1]));
  }
});

test('a title is built from what they did, and says how', () => {
  const s = plainGame('titles-wolf');
  s.autopilot = true;
  const p = s.people[0];
  tally(p, 'slain:wolf', 11);
  awardCharacterTitles(s);
  assert.ok(!(p.titles ?? []).includes('Wolfbane'), 'eleven wolves is not enough');
  tally(p, 'slain:wolf_alpha');
  awardCharacterTitles(s);
  awardCharacterTitles(s);
  assert.deepEqual(p.titles!.filter((t) => t === 'Wolfbane'), ['Wolfbane']);
  assert.match(p.titleWhy!.Wolfbane, /12 of wolves/);
  assert.ok(snapshot(s).people.find((q) => q.id === p.id)!.titleWhy.Wolfbane);
  assert.ok(s.journal.some((j) => j.text.includes('Wolfbane')));
});

test('a last blow on a raider counts toward its kind', () => {
  const s = plainGame('titles-credit');
  const p = s.people[0];
  const rd = { id: 99, kind: 'wolf', x: 0, y: 0, dir: -1 as const, hp: 0, maxHp: 28, cooldown: 5, down: true, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: 'harm' as const };
  s.raid = { id: 1, kind: 'bandits', side: 1, phase: 'active', arrivesTick: 0, leavesTick: 99999, raiders: [rd], prompt: null } as unknown as typeof s.raid;
  credit(s, p.id, [[rd, 28, false]]);
  assert.equal(p.tally?.['slain:wolf'], 1);
  assert.equal(p.felled, 1);
});

test('the unlucky, the twice-wed, and a hand of iron', () => {
  const s = plainGame('titles-body');
  s.autopilot = true;
  const p = s.people[0];
  tally(p, 'wounds', 15);
  tally(p, 'wed', 2);
  p.lasting = [{ part: 'hand_r', kind: 'lost' }];
  p.fitted = { hand_r: 'iron_hand' };
  const got = earnedTitles(s, p).map((e) => e.title);
  for (const t of ['the Unlucky', 'the Twice-Wed', 'Ironhand']) assert.ok(got.includes(t), t);
  assert.ok(!got.includes('the Battered'));
});

test('unflattering titles come from failings, and the young are forgiven', () => {
  const s = plainGame('titles-bad');
  s.autopilot = true;
  const p = s.people[0];
  tally(p, 'crime:theft', 2);
  tally(p, 'break:brawl', 3);
  const got = earnedTitles(s, p).map((e) => e.title);
  assert.ok(got.includes('Sticky-Fingers') && got.includes('the Hothead'));
  p.traits = ['lazy'];
  p.level = 1;
  assert.ok(!earnedTitles(s, p).some((e) => e.title === 'the Idler'));
});

test('each people has its own', () => {
  const s = plainGame('titles-knight');
  s.autopilot = true;
  s.origin = 'knights';
  const p = s.people[0];
  tally(p, 'vows', 3);
  tally(p, 'vowsBroken');
  const got = earnedTitles(s, p).map((e) => e.title);
  assert.ok(got.includes('Truesworn') && got.includes('Oathbreaker'));
  s.origin = 'settlers';
  assert.ok(!earnedTitles(s, p).some((e) => e.title === 'Truesworn'));
});

test('titles are kept, capped, and only with the autopilot on', () => {
  const s = plainGame('titles-cap');
  const p = s.people[0];
  p.titles = ['Wolfsbane'];
  tally(p, 'slain:wolf', 100);
  awardCharacterTitles(s);
  assert.deepEqual(p.titles, ['Wolfsbane'], 'autopilot off: nothing');
  s.autopilot = true;
  tally(p, 'wounds', 100);
  tally(p, 'downed', 100);
  tally(p, 'wed', 3);
  p.felled = 500;
  p.trips = 100;
  awardCharacterTitles(s);
  assert.ok(p.titles.includes('Wolfsbane'));
  assert.equal(Object.keys(p.titleWhy!).length, TITLE_MOST);
});

test('a ladder title notes its deed, and the same record earns the same titles', () => {
  const s = plainGame('titles-ladder');
  const p = s.people[0];
  addDeed(p, 'built', DEED_STEPS.built[0]);
  awardDeedTitles(s);
  assert.equal(p.titleWhy!['the Builder'], `Buildings raised: ${DEED_STEPS.built[0]}.`);
  const a = earnedTitles(plainGame('same'), plainGame('same').people[0]);
  assert.deepEqual(a, earnedTitles(plainGame('same'), plainGame('same').people[0]));
});
