import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FREEZE_FROM_DAY, FREEZE_HP_PER_HOUR } from '../src/shared/data/doom';
import { doomGrowth, possibleDooms, updateDoom } from '../src/shared/sim/doom';
import { storages } from '../src/shared/sim/buildings';
import { bossSlain } from '../src/shared/sim/bosses';
import { mood } from '../src/shared/sim/townsfolk';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

function frozen(seed: string): GameState {
  const s = plainGame(seed);
  s.tick = (FREEZE_FROM_DAY + 2) * TICKS_PER_DAY;
  s.doom = { kind: 'deep_freeze', phase: 'active', untilTick: s.tick + 90 * TICKS_PER_HOUR };
  s.nextRaidTick = s.tick + 1000 * TICKS_PER_HOUR;
  for (const st of storages(s)) st.store = {};
  // a town of four: one unit of heat an hour
  for (let i = 0; i < 3; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', 3200 + i * 20, s.people.map((q) => q.name)));
  return s;
}
const hours = (s: GameState, n: number, rng: Rng) => {
  for (let i = 0; i < n; i++) {
    s.tick += TICKS_PER_HOUR;
    updateDoom(s, rng);
  }
};

test('the Deep Freeze only comes once the town has lasted a while', () => {
  const s = plainGame('freeze-early');
  assert.ok(!possibleDooms(s).includes('deep_freeze'));
  s.tick = FREEZE_FROM_DAY * TICKS_PER_DAY;
  assert.ok(possibleDooms(s).includes('deep_freeze'));
});

test('in the freeze nothing grows outdoors, and the town burns wood to keep warm', () => {
  const s = frozen('freeze-wood');
  const rng = new Rng(3);
  assert.equal(doomGrowth(s), 0);
  storages(s)[0].store.wood = 5;
  hours(s, 3, rng);
  assert.equal(storages(s)[0].store.wood, 2, 'one unit an hour for a small town');
  assert.equal(s.doom?.cold, false);
  assert.ok(mood(s, s.people[0]).reasons.some((r) => r.text === 'The Deep Freeze'));
});

test('with nothing to burn the town freezes: health drains (never below 1) and spirits sink; a power station heats it', () => {
  const s = frozen('freeze-cold');
  const rng = new Rng(4);
  const p = s.people[0];
  const hp = p.hp;
  hours(s, 1, rng);
  assert.equal(s.doom?.cold, true);
  assert.equal(p.hp, hp - FREEZE_HP_PER_HOUR);
  assert.ok(s.notices.some((n) => n.text.includes('the town is freezing')));
  assert.ok(mood(s, p).reasons.some((r) => r.text.startsWith('Freezing')));
  assert.equal(snapshot(s).doom?.cold, true);
  hours(s, 200, rng);
  assert.ok(p.hp >= 1, 'the cold weakens but never kills');
  s.doom = { kind: 'deep_freeze', phase: 'active', untilTick: s.tick + 90 * TICKS_PER_HOUR };
  s.buildings.push({ id: s.nextId++, def: 'power_station', tile: 104, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  hours(s, 1, rng);
  assert.equal(s.doom?.cold, false, 'the power station keeps the town warm');
});

test('ice mages attack in waves, their Archmage comes before the end, and slaying it breaks the freeze', () => {
  const s = frozen('freeze-mages');
  storages(s)[0].store.wood = 500;
  const rng = new Rng(5);
  hours(s, 1, rng);
  assert.ok(s.nextRaidTick <= s.tick + 10 * TICKS_PER_HOUR, 'a wave is coming soon');
  s.doom!.untilTick = s.tick + 4 * TICKS_PER_HOUR;
  s.raid = null;
  hours(s, 1, rng);
  const wave = s.raid as GameState['raid'];
  assert.equal(wave?.kind, 'frost');
  assert.ok(wave?.raiders.some((r) => r.kind === 'frost_archmage'), 'the Archmage leads a wave');
  // driven off, it comes back with a later wave
  s.raid = null;
  hours(s, 1, rng);
  assert.equal(s.raid, null, 'not straight away');
  s.doom!.bossAgainTick = s.tick;
  hours(s, 1, rng);
  assert.ok((s.raid as GameState['raid'])?.raiders.some((r) => r.kind === 'frost_archmage'), 'the Archmage returns');
  assert.ok(s.notices.some((n) => n.text.includes('strides back')));
  s.raid = null;
  s.doom!.untilTick = s.tick + 50 * TICKS_PER_HOUR; // (so only the Archmage's death can end it now)
  bossSlain(s, 'frost_archmage');
  assert.equal(s.items.staff_of_rime, 1);
  hours(s, 1, rng);
  assert.equal(s.doom, null, 'the ice breaks');
  assert.ok(s.notices.some((n) => n.text.includes('Deep Freeze is over')));
});
