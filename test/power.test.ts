import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startBattle, stepBattle, unitFighter, type Battle, type Fighter } from '../src/shared/sim/combat';
import { matchupOf, powerLine, powerOfEnemy, powerOfGroup, powerOfParty, powerOfPerson } from '../src/shared/sim/power';
import { makePerson, maxHp, type Person } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { plainGame, campPx } from './helpers';

/** Foe against foe in the real fight rules, `n` each side: how often side A wins out of `runs`. */
function winRate(a: string, b: string, n: number, runs: number): number {
  let wins = 0;
  for (let r = 0; r < runs; r++) {
    const fs: Fighter[] = [];
    for (let i = 0; i < n; i++) fs.push(unitFighter(a, 'party', i));
    for (let i = 0; i < n; i++) fs.push(unitFighter(b, 'enemy', i));
    const rng = new Rng(r + 1);
    for (const f of fs) f.cooldown = rng.int(1, f.interval);
    const bt: Battle = { fighters: fs, tick: 0, outcome: null, boss: false };
    for (let t = 0; t < 20000 && !bt.outcome; t++) stepBattle(bt, rng, { retreatAt: 0, mainId: null });
    if (bt.outcome === 'won') wins++;
  }
  return wins / runs;
}

const KINDS = ['rat', 'wolf', 'boar', 'bandit', 'cave_bear', 'wolf_alpha', 'skeleton', 'ogre'].filter((k) => powerOfEnemy(k) > 0);

test('the stronger of two foes wins most of the time', () => {
  let checked = 0;
  for (const a of KINDS)
    for (const b of KINDS) {
      const pa = powerOfEnemy(a);
      const pb = powerOfEnemy(b);
      if (pa < pb * 1.5) continue;
      checked++;
      const w = winRate(a, b, 1, 60);
      assert.ok(w >= 0.75, `${a} (${pa}) should beat ${b} (${pb}) most of the time, won ${w}`);
    }
  assert.ok(checked >= 3);
});

test('a side of many adds up: ten weak foes can rival a strong one', () => {
  assert.ok(powerOfGroup({ wolf: 3 }) > powerOfEnemy('wolf') * 2.9);
  assert.ok(powerOfEnemy('wolf', 2) > powerOfEnemy('wolf'));
});

function person(melee: number, hpFrac = 1): Person {
  const s = plainGame('power');
  const p = makePerson(new Rng(5), s.nextId++, 'hunter', campPx(s), []);
  p.traits = [];
  p.skills.melee.level = melee;
  p.hp = Math.max(1, Math.round(maxHp(p) * hpFrac));
  return p;
}

test('a trained person reads stronger than a novice, and a wounded one lower', () => {
  assert.ok(powerOfPerson(person(30)) > powerOfPerson(person(2)));
  assert.ok(powerOfPerson(person(10, 0.3)) < powerOfPerson(person(10)));
  assert.equal(powerOfParty([person(5), person(5)]), powerOfPerson(person(5)) * 2);
});

test('a person who reads stronger than a foe beats it most of the time', () => {
  let checked = 0;
  for (const m of [2, 8, 20, 40]) {
    for (const kind of KINDS) {
      const p = person(m);
      const mine = powerOfPerson(p);
      const theirs = powerOfEnemy(kind);
      if (mine < theirs * 1.5 || mine > theirs * 6) continue;
      checked++;
      let wins = 0;
      for (let r = 0; r < 40; r++) {
        const b = startBattle([{ ...p, skills: p.skills }], {}, { [kind]: 1 }, new Rng(r + 1));
        for (let t = 0; t < 20000 && !b.outcome; t++) stepBattle(b, new Rng(r * 7919 + t), { retreatAt: 0, mainId: null });
        if (b.outcome === 'won') wins++;
      }
      assert.ok(wins >= 28, `person ${mine} should beat ${kind} ${theirs}, won ${wins}/40`);
    }
  }
  assert.ok(checked >= 3, `checked ${checked}`);
});

test('the labels follow the ratio of the two sides', () => {
  assert.equal(matchupOf(300, 100), 'Easy');
  assert.equal(matchupOf(240, 240), 'Even');
  assert.equal(matchupOf(240, 310), 'Risky');
  assert.equal(matchupOf(100, 400), 'Deadly');
  assert.equal(powerLine(240, 310), 'Your party 240 vs about 310: Risky');
});
