import assert from 'node:assert/strict';
import { test } from 'node:test';
import { possibleDooms, updateDoom } from '../src/shared/sim/doom';
import { storages } from '../src/shared/sim/buildings';
import { bossSlain } from '../src/shared/sim/bosses';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

function plagued(seed: string): GameState {
  const s = plainGame(seed);
  s.era = 'industrial';
  s.tick = 20 * TICKS_PER_DAY;
  s.doom = { kind: 'rat_plague', phase: 'active', untilTick: s.tick + 90 * TICKS_PER_HOUR };
  s.nextRaidTick = s.tick + 1000 * TICKS_PER_HOUR;
  for (let i = 0; i < 3; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', 3200 + i * 20, s.people.map((q) => q.name)));
  return s;
}
const hours = (s: GameState, n: number, rng: Rng) => {
  for (let i = 0; i < n; i++) {
    s.tick += TICKS_PER_HOUR;
    updateDoom(s, rng);
  }
};

test('the Rat Plague comes only from the Industrial era', () => {
  const s = plainGame('rats-era');
  s.tick = 20 * TICKS_PER_DAY;
  assert.ok(!possibleDooms(s).includes('rat_plague'));
  s.era = 'industrial';
  assert.ok(possibleDooms(s).includes('rat_plague'));
});

test('the rats eat the stores, and swarms come again and again', () => {
  const s = plagued('rats-eat');
  const rng = new Rng(2);
  storages(s)[0].store = { bread: 100 };
  hours(s, 5, rng);
  assert.ok((storages(s)[0].store.bread ?? 0) < 95, `bread ${storages(s)[0].store.bread}`);
  assert.ok(s.nextRaidTick <= s.tick + 8 * Math.sqrt(6) * TICKS_PER_HOUR + 1, 'a swarm is coming soon (every 8h, stretched for the era)');
});

test("a plague rat's bite can carry the sickness", () => {
  const s = plagued('rats-bite');
  const wave = startRaid(s, RAID_KIND_BY_ID.rats, 30, new Rng(1));
  wave.phase = 'active';
  const p = s.people[1];
  p.hp = 999;
  for (const rd of wave.raiders) {
    rd.kind = 'plague_rat';
    rd.x = p.x;
    rd.goal = 'harm';
  }
  for (let i = 0; i < 600 && !p.sick; i++) {
    s.tick++;
    p.hp = 999;
    for (const rd of wave.raiders) rd.x = p.x;
    updateRaid(s, new Rng(i));
  }
  assert.ok(p.sick, 'bitten and sick');
});

test('near the end the Rat King leads the swarm, and killing it ends the plague', () => {
  const s = plagued('rat-king');
  const rng = new Rng(5);
  s.doom!.untilTick = s.tick + 4 * TICKS_PER_HOUR;
  hours(s, 1, rng);
  const wave = s.raid as GameState['raid'];
  assert.equal(wave?.kind, 'rats');
  assert.ok(wave?.raiders.some((r) => r.kind === 'rat_king'));
  s.raid = null;
  s.doom!.untilTick = s.tick + 50 * TICKS_PER_HOUR;
  bossSlain(s, 'rat_king');
  assert.equal(s.items.rat_king_crown, 1);
  hours(s, 1, rng);
  assert.equal(s.doom, null);
  assert.ok(s.notices.some((n) => n.text.includes('Rat Plague is over')));
});
