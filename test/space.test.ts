import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LAUNCH_COUNTDOWN_HOURS, onBuilt } from '../src/shared/sim/era';
import { killPerson } from '../src/shared/sim/health';
import { possibleDooms, updateDoom } from '../src/shared/sim/doom';
import { canQueue } from '../src/shared/sim/research';
import { Sim } from '../src/shared/sim/sim';
import { maxHp, type Building, type GameState, campCell } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, DAYS_PER_SEASON } from '../src/shared/sim/time';
import { workFactor } from '../src/shared/sim/townsfolk';
import { Rng } from '../src/shared/rng';
import { plainGame, priorities, row } from './helpers';

const camp = (s: GameState) => campCell(s).x;
function addBuilding(s: GameState, def: string, tile = camp(s) + 3): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}

test('Mission Control opens the Robotic & Space era', () => {
  const s = plainGame('space');
  s.era = 'modern';
  assert.equal(canQueue(s.research, 'deep_mining', s.era).ok, false);
  onBuilt(s, addBuilding(s, 'mission_control'));
  assert.equal(s.era, 'space');
  assert.equal(canQueue(s.research, 'deep_mining', s.era).ok, true);
});

test('the finished ship lifts off after the countdown, and the game is won', () => {
  const sim = new Sim(plainGame('launch'));
  const s = sim.state;
  s.era = 'space';
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  onBuilt(s, addBuilding(s, 'launch_site'));
  assert.ok(s.launchTick);
  for (let t = 0; t < (LAUNCH_COUNTDOWN_HOURS + 1) * TICKS_PER_HOUR && !s.gameOver; t++) sim.step();
  assert.ok(s.gameOver?.won, 'won');
  assert.match(s.gameOver!.text, /stars/);
});

test('losing the launch site stops the countdown', () => {
  const sim = new Sim(plainGame('launch2'));
  const s = sim.state;
  const site = addBuilding(s, 'launch_site');
  onBuilt(s, site);
  s.buildings = s.buildings.filter((b) => b !== site);
  sim.step();
  assert.equal(s.launchTick, null);
});

test('a clone vat brings the founder back with less skill; a cryo pod leaves them frail; both need time to recharge', () => {
  const s = plainGame('revive');
  const main = s.people.find((p) => p.id === s.mainId)!;
  main.skills.melee.level = 12;
  addBuilding(s, 'clone_vat');
  killPerson(s, main, 'in a crash');
  assert.ok(!s.gameOver);
  assert.equal(main.skills.melee.level, 9);
  addBuilding(s, 'cryo_pod', camp(s) + 8);
  const hp = maxHp(main);
  killPerson(s, main, 'again');
  assert.ok(!s.gameOver);
  assert.ok(maxHp(main) < hp, 'frail');
  killPerson(s, main, 'a third time');
  assert.ok(s.gameOver, 'nothing left ready');
});

test('meteors set buildings alight unless a shield is up; the machine uprising idles the bots and brings drone raids', () => {
  const s = plainGame('meteor');
  s.era = 'space';
  for (let i = 0; i < 4; i++) addBuilding(s, 'apartments', camp(s) + 3 + i * 5);
  const rng = new Rng(4);
  s.doom = { kind: 'meteors', phase: 'signs', untilTick: s.tick + 1 };
  s.tick = Math.ceil((s.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateDoom(s, rng);
  assert.ok(s.buildings.some((b) => b.fire !== undefined), 'something burns');

  const t = plainGame('shield');
  t.era = 'space';
  addBuilding(t, 'shield_generator');
  const a = addBuilding(t, 'apartments', camp(t) + 8);
  t.doom = { kind: 'meteors', phase: 'signs', untilTick: t.tick + 1 };
  t.tick = Math.ceil((t.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  updateDoom(t, rng);
  assert.equal(a.fire, undefined);

  // the uprising only comes once there are robots to rise
  assert.ok(!possibleDooms(t).includes('rogue_ai'));
  t.research.done.push('robotics');
  assert.ok(possibleDooms(t).includes('rogue_ai'));
  t.items.worker_bot = 4;
  const p = t.people[0];
  const helped = workFactor(t, p);
  t.doom = { kind: 'rogue_ai', phase: 'active', untilTick: t.tick + 50 * TICKS_PER_HOUR };
  assert.ok(workFactor(t, p) < helped);
});

test('a hydroponics bay grows grain in winter', () => {
  const sim = new Sim(plainGame('hydro'));
  const s = sim.state;
  s.tick = 3 * DAYS_PER_SEASON * TICKS_PER_DAY; // winter
  addBuilding(s, 'hydroponics_bay', camp(s) + 2);
  addBuilding(s, 'stockpile', camp(s) + 7);
  s.people[0].priorities = priorities({ farm: 1 });
  s.people[0].autoPriorities = false;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  const bay = s.buildings.find((b) => b.def === 'hydroponics_bay')!;
  for (let t = 0; t < TICKS_PER_DAY && bay.crop?.stage !== 'ripe'; t++) sim.step();
  assert.equal(bay.crop?.stage, 'ripe');
});
