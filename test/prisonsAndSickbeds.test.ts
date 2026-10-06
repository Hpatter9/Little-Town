import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { MENDED } from '../src/shared/data/prisons';
import { Rng } from '../src/shared/rng';
import { heal, knockDown } from '../src/shared/sim/health';
import { cellsOf, takePrisoners } from '../src/shared/sim/prisoners';
import { startRaid } from '../src/shared/sim/raids';
import { patientsIn, sickbedHealing } from '../src/shared/sim/sickbeds';
import { Sim } from '../src/shared/sim/sim';
import { maxHp, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { freeSpot, plainGame, put } from './helpers';

/** Raiders of people, all struck down and marked to be taken alive. */
function fallen(s: GameState, n: number) {
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 200, new Rng(1));
  s.raid = null;
  const out = r.raiders.filter((rd) => !rd.ally && !ENEMIES[rd.kind].kit).slice(0, n);
  for (const rd of out) {
    rd.down = true;
    rd.taken = true;
  }
  return out;
}

test('a raider is taken alive only with a cell free: none without a stockade, as many as it has cells with one', () => {
  const s = plainGame('cells-1');
  assert.equal(cellsOf(s), 0);
  assert.equal(takePrisoners(s, fallen(s, 3), new Rng(1)), 0, 'no stockade, no prisoners');
  assert.ok(s.journal.some((j) => /no cell to hold/.test(j.text)));
  const at = freeSpot(s, 'stockade');
  put(s, 'stockade', at.x, at.y);
  assert.equal(cellsOf(s), 3);
  const raiders = fallen(s, 5);
  assert.ok(raiders.length >= 4, `${raiders.length} bandits`);
  assert.equal(takePrisoners(s, raiders, new Rng(1)), 3, 'three cells, three prisoners');
  assert.equal(s.prisoners.length, 3);
});

test('the struck-down and the badly hurt are nursed in a sickbed, heal faster there, and get up once mended', () => {
  const s = plainGame('sickbed-1');
  const at = freeSpot(s, 'infirmary');
  const ward = put(s, 'infirmary', at.x, at.y);
  const p = s.people[0];
  p.lastHit = undefined;
  knockDown(s, p);
  p.downed!.bleedUntil = null; // (tended: recovering)
  const sim = new Sim(s);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  // they're taken to a sickbed and lie in it
  for (let t = 0; t < 2 * TICKS_PER_HOUR && sickbedHealing(s, p) === null; t++) sim.step();
  assert.ok(patientsIn(s, ward).includes(p), 'in the infirmary\'s sickbed');
  assert.ok(sickbedHealing(s, p)! >= 2, 'at its pace');
  // nursed, they heal faster than on the ground at home
  const other = { ...p, id: 999, task: null, activity: 'idle' as const, hp: 10 };
  const before = [p.hp, other.hp];
  heal(s, p);
  heal(s, other as never);
  assert.ok(p.hp - before[0] > other.hp - before[1], `nursed ${(p.hp - before[0]).toFixed(3)} vs ${(other.hp - before[1]).toFixed(3)}`);
  // and up again once mended
  for (let t = 0; t < 72 * TICKS_PER_HOUR && (p.downed || p.hp < maxHp(p) * MENDED || p.task?.type === 'sleep'); t++) sim.step();
  assert.ok(!p.downed && !patientsIn(s, ward).includes(p), 'up and about');
});
