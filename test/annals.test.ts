import assert from 'node:assert/strict';
import { test } from 'node:test';
import { annalsHourly, CHRONICLE_DAY, CHRONICLE_HOUR, tallyRaid } from '../src/shared/sim/annals';
import { killPerson } from '../src/shared/sim/health';
import { makePerson } from '../src/shared/sim/state';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

/** The first tick of the chronicle's hour at or after `from`. */
function midwinter(from: number): number {
  let t = from - (from % TICKS_PER_HOUR);
  for (;;) {
    const c = calendar(t);
    if (c.season === 'winter' && c.dayOfSeason === CHRONICLE_DAY && c.hour === CHRONICLE_HOUR) return t;
    t += TICKS_PER_HOUR;
  }
}

test('the fallen are remembered: their name, how they died, their calling, level and deeds', () => {
  const s = plainGame('annals-fallen');
  const p = makePerson(new Rng(3), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
  p.felled = 4;
  p.titles = ['Wolfsbane'];
  s.people.push(p);
  killPerson(s, p, 'at the hands of the bandits');
  const f = s.fallen!.at(-1)!;
  assert.equal(f.name, p.name);
  assert.equal(f.cause, 'at the hands of the bandits');
  assert.equal(f.felled, 4);
  assert.deepEqual(f.titles, ['Wolfsbane']);
  assert.ok(f.level >= 1);
});

test('at midwinter the chronicle of the year is written once: who was born and lost, the raids, the champion', () => {
  const s = plainGame('annals-year');
  s.tick = TICKS_PER_HOUR;
  annalsHourly(s); // (the reckoning starts)
  assert.ok(s.yearStart);
  // a year happens: a child born, a newcomer, a death, two raids, a champion
  const child = makePerson(new Rng(4), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
  child.parents = [s.people[0].id];
  const newcomer = makePerson(new Rng(5), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
  const doomed = makePerson(new Rng(6), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
  s.people.push(child, newcomer, doomed);
  killPerson(s, doomed, 'of the fever');
  tallyRaid(s, 'victory');
  tallyRaid(s, 'pillaged');
  s.people[0].felled = (s.people[0].felled ?? 0) + 3;
  s.tick = midwinter(s.tick);
  const before = s.prompts.length;
  annalsHourly(s);
  const c = s.chronicles!.at(-1)!;
  const text = c.lines.join(' ');
  assert.match(c.title, /chronicle of Year/);
  assert.ok(text.includes(child.name) && /born/.test(text), text);
  assert.ok(text.includes(newcomer.name), text);
  assert.ok(text.includes(doomed.name) && text.includes('of the fever'), text);
  assert.ok(/2 raids came: 1 driven off, 1 got away/.test(text), text);
  assert.ok(text.includes(`champion was ${s.people[0].name}`), text);
  assert.equal(s.prompts.length, before + 1, 'put to the player as a card');
  assert.equal(s.prompts.at(-1)!.kind, 'debrief');
  // once a year
  annalsHourly(s);
  assert.equal(s.chronicles!.length, 1);
  assert.equal(s.yearRaids!.came, 0, 'and the next year is reckoned afresh');
});
