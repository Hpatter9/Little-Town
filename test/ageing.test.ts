import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIFESPANS } from '../src/shared/data/lifespans';
import { CHILD_DAYS } from '../src/shared/data/pace';
import { ORIGINS } from '../src/shared/data/origins';
import { Rng } from '../src/shared/rng';
import { ageDays, ageingHourly, ageLine, ageYears, isElder, lifespanOf, lifeStage } from '../src/shared/sim/ageing';
import { newGame, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';

const founder = (s: ReturnType<typeof newGame>) => s.people.find((p) => p.id === s.mainId)!;

test('every people has a span: coming of age before old age, elders before old age, the long-lived long', () => {
  for (const o of ORIGINS) {
    const l = LIFESPANS[o];
    assert.ok(l.grown < l.old && l.elderDays < l.oldDays, `${o}`);
    assert.ok(l.one && l.many);
  }
  assert.ok(LIFESPANS.dwarves.oldDays > LIFESPANS.settlers.oldDays * 1.5, 'dwarves live long');
  assert.ok(LIFESPANS.fae.old > LIFESPANS.dwarves.old, 'the fae longer');
  assert.ok(LIFESPANS.werewolf.oldDays < LIFESPANS.settlers.oldDays, 'the curse burns short');
});

test('a settler of 70 days is old, a dwarf of 70 days is barely grown; years follow each people\'s reckoning', () => {
  const human = newGame('age-h', { origin: 'settlers' });
  const dwarf = newGame('age-d', { origin: 'dwarves' });
  for (const s of [human, dwarf]) {
    const p = founder(s);
    p.grownAt = 0;
    s.tick = 70 * TICKS_PER_DAY;
    assert.equal(Math.round(ageDays(s, p)), 70);
  }
  assert.equal(lifeStage(human, founder(human)), 'old');
  assert.ok(isElder(human, founder(human)));
  assert.equal(lifeStage(dwarf, founder(dwarf)), 'prime');
  assert.ok(!isElder(dwarf, founder(dwarf)));
  const hy = ageYears(human, founder(human));
  const dy = ageYears(dwarf, founder(dwarf));
  assert.ok(hy > 70 && hy < 80, `a settler of ${hy}`);
  assert.ok(dy > 100 && dy < 160, `a dwarf of ${dy}`);
  assert.match(ageLine(dwarf, founder(dwarf)), /^A dwarf of \d+ years, in their prime\. Dwarves grow old at about 250\.$/);
  assert.match(ageLine(human, founder(human)), /very old/);
});

test('the curse sets a werewolf\'s span whatever the town, and the deathless have no age to speak of', () => {
  const s = newGame('age-w', { origin: 'knights' });
  const p = founder(s);
  assert.equal(lifespanOf(s, p), LIFESPANS.knights);
  p.monster = 'werewolf';
  assert.equal(lifespanOf(s, p), LIFESPANS.werewolf);
  const v = newGame('age-v', { origin: 'vampire' });
  assert.equal(lifeStage(v, founder(v)), 'deathless');
  assert.match(ageLine(v, founder(v)), /deathless/);
});

test('a child\'s years climb to their coming of age', () => {
  const s = newGame('age-c');
  const p = founder(s);
  const child: Person = { ...p, id: 99, name: 'Wee', bornTick: 0, grownAt: undefined };
  s.tick = Math.round(CHILD_DAYS * TICKS_PER_DAY * 0.5);
  const half = ageYears(s, child);
  assert.ok(half > 7 && half < 11, `half grown: ${half}`);
  assert.equal(lifeStage(s, child), 'child');
});

test('old age takes the old in the small hours, sooner for the short-lived, and never the dwarf in their prime', () => {
  const dies = (origin: 'settlers' | 'dwarves' | 'werewolf', days: number) => {
    const s = newGame(`age-${origin}-${days}`, { origin });
    const p: Person = { ...founder(s), id: 500, name: 'Old One', grownAt: 0 }; // (not the founder: they may be revived)
    s.people.push(p);
    const rng = new Rng(3);
    for (let d = 0; d < days; d++) {
      s.tick = d * TICKS_PER_DAY + (3 + 24 - START_HOUR) * TICKS_PER_HOUR; // hour 3
      ageingHourly(s, rng);
      if (!s.people.includes(p)) return d;
    }
    return null;
  };
  const human = dies('settlers', 120);
  assert.ok(human !== null && human >= LIFESPANS.settlers.oldDays && human < 100, `a settler dies at ${human}`);
  assert.equal(dies('dwarves', 90), null, 'a dwarf of 90 days lives');
  const wolf = dies('werewolf', 120);
  assert.ok(wolf !== null && wolf >= LIFESPANS.werewolf.oldDays && wolf < human!, `a werewolf dies at ${wolf}, before the settler`);
});
