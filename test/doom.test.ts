import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOOMS } from '../src/shared/data/doom';
import { doomGrowth, possibleDooms, updateDoom } from '../src/shared/sim/doom';
import { raidBudget } from '../src/shared/sim/raids';
import { hourlyItems } from '../src/shared/sim/crafting';
import { makePerson, maxHp, type Building, type GameState, campCell } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame, row, campPx } from './helpers';

const camp = (s: GameState) => campCell(s).x;
/** Run the doom clock hour by hour. */
function hours(s: GameState, n: number, rng: Rng): void {
  for (let i = 0; i < n; i++) {
    s.tick += TICKS_PER_HOUR;
    updateDoom(s, rng);
    hourlyItems(s, rng);
  }
}

test('a drought gives a day of warning, stops the fields (a well keeps them going), then ends', () => {
  const s = plainGame('drought');
  const rng = new Rng(1);
  const doom = () => s.doom; // (read fresh each time)
  s.nextDoomTick = s.tick + TICKS_PER_HOUR;
  s.doom = null;
  hours(s, 1, rng);
  assert.equal(doom()?.phase, 'signs');
  doom()!.kind = 'drought';
  hours(s, DOOMS.drought.warnHours, rng);
  assert.equal(doom()?.phase, 'active');
  assert.equal(doomGrowth(s), 0);
  s.buildings.push({ id: s.nextId++, def: 'well', tile: camp(s) + 3, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  assert.ok(doomGrowth(s) > 0, 'the well helps');
  hours(s, 100, rng);
  assert.equal(s.doom, null, 'over');
  assert.ok(s.notices.some((n) => n.text.includes('drought is over')));
});

test('plague spreads between people near each other, dressings shorten it, and it ends when nobody is sick', () => {
  const s = plainGame('plague');
  const rng = new Rng(2);
  for (let i = 0; i < 4; i++) {
    const p = makePerson(new Rng(i + 5), s.nextId++, 'wanderer', { x: (camp(s) + i) * 32, y: campPx(s).y }, s.people.map((q) => q.name));
    p.traits = [];
    p.hp = maxHp(p);
    s.people.push(p);
  }
  s.items.bandage = 1;
  s.doom = { kind: 'plague', phase: 'signs', untilTick: s.tick + TICKS_PER_HOUR };
  hours(s, 1, rng);
  assert.equal(s.people.filter((p) => p.sick).length, 1, 'one falls sick');
  assert.equal(s.items.bandage ?? 0, 0, 'a bandage went to them');
  let most = 0;
  for (let h = 0; h < 10 * 24 && s.doom; h++) {
    hours(s, 1, rng);
    most = Math.max(most, s.people.filter((p) => p.sick).length);
  }
  assert.equal(s.doom, null, 'passed');
  assert.ok(most >= 2, `it spread (${most} sick at once)`);
  assert.ok(s.people.every((p) => !p.sick));
});

test('later disasters come with the eras: ash winter, smog (only with smoky works), war', () => {
  const s = plainGame('eras-doom');
  assert.deepEqual(possibleDooms(s), ['drought', 'plague']);
  s.era = 'medieval';
  assert.ok(possibleDooms(s).includes('ash_winter'));
  s.era = 'industrial';
  assert.ok(!possibleDooms(s).includes('smog'), 'no smog without works');
  for (const [i, def] of ['coal_mine', 'steelworks', 'factory'].entries()) s.buildings.push({ id: s.nextId++, def, tile: camp(s) + 3 + i * 6, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  assert.ok(possibleDooms(s).includes('smog'));
  assert.ok(!possibleDooms(s).includes('war'));
  s.era = 'modern';
  assert.ok(possibleDooms(s).includes('war'));
});

test('ash winter stops every field (a well is no help); smog wears people down but never kills', () => {
  const s = plainGame('ash');
  const rng = new Rng(2);
  s.buildings.push({ id: s.nextId++, def: 'well', tile: camp(s) + 3, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  s.doom = { kind: 'ash_winter', phase: 'active', untilTick: s.tick + 10 * TICKS_PER_HOUR };
  assert.equal(doomGrowth(s), 0);
  s.doom = { kind: 'smog', phase: 'active', untilTick: s.tick + 400 * TICKS_PER_HOUR };
  const p = s.people[0];
  const before = p.hp;
  hours(s, 5, rng);
  assert.ok(p.hp < before);
  hours(s, 300, rng);
  assert.ok(p.hp >= 1 && s.people.includes(p));
});

test('in a war, raids come often and hit harder', () => {
  const s = plainGame('war');
  s.era = 'modern';
  const calm = raidBudget(s);
  s.nextRaidTick = s.tick + 100 * TICKS_PER_HOUR;
  s.doom = { kind: 'war', phase: 'active', untilTick: s.tick + 100 * TICKS_PER_HOUR };
  hours(s, 1, new Rng(3));
  // (10 hours, stretched by the square root of the Modern multiplier: far sooner than a normal Modern raid)
  assert.ok(s.nextRaidTick <= s.tick + 40 * TICKS_PER_HOUR);
  assert.ok(raidBudget(s) > calm);
});
test('a zombie outbreak sends waves of the dead, the fallen rise, and the Abomination leads the last wave', async () => {
  const { killPerson } = await import('../src/shared/sim/health');
  const { makePerson } = await import('../src/shared/sim/state');
  const s = plainGame('zombies');
  s.tick = 20 * 14400;
  assert.ok(possibleDooms(s).includes('outbreak'));
  s.doom = { kind: 'outbreak', phase: 'active', untilTick: s.tick + 100 * TICKS_PER_HOUR };
  s.nextRaidTick = s.tick + 1000 * TICKS_PER_HOUR;
  const rng = new Rng(9);
  hours(s, 1, rng);
  assert.ok(s.nextRaidTick <= s.tick + 10 * TICKS_PER_HOUR, 'a wave is coming soon');
  // someone dies among the dead: they rise
  const { startRaid } = await import('../src/shared/sim/raids');
  const { RAID_KIND_BY_ID } = await import('../src/shared/data/raids');
  const wave = startRaid(s, RAID_KIND_BY_ID.zombies, 30, rng);
  wave.phase = 'active';
  const victim = makePerson(new Rng(1), s.nextId++, 'hunter', campPx(s), []);
  s.people.push(victim);
  const before = wave.raiders.length;
  killPerson(s, victim, 'to the dead');
  assert.equal(wave.raiders.length, before + 1);
  assert.equal(wave.raiders.at(-1)!.risenFrom, victim.name);
  // near the end, with no wave on, the Abomination comes
  s.raid = null;
  s.doom.untilTick = s.tick + 2 * TICKS_PER_HOUR;
  hours(s, 1, rng);
  const last = s.raid as { raiders: { kind: string }[] } | null;
  assert.ok(last?.raiders.some((r) => r.kind === 'abomination'), 'the Abomination leads the last wave');
});