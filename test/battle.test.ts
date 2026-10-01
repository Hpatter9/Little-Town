import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { autoPlace, fighters, layOut, placeFighter, ranged, startBattle } from '../src/shared/sim/battle';
import { castAt } from '../src/shared/sim/powers';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, newGame, type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);

function add(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}

/** A town of `n` fighters (half of them shooters), with battles on and no raid of its own coming. */
function town(seed: string, n = 4): GameState {
  const s = plainGame(seed);
  s.battles = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.people[0].priorities.defend = 1;
  for (let i = 0; i < n - 1; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0].x + i * 10, s.people.map((q) => q.name));
    p.priorities.defend = 1;
    if (i % 2) p.skills.ranged.level = Math.max(p.skills.ranged.level, p.skills.melee.level + 4);
    s.people.push(p);
  }
  return s;
}

/** Bandits at the gate now: the raid turns active on the next tick (and the battle begins). */
function raidNow(s: GameState, budget = 30, seed = 1) {
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, budget, new Rng(seed));
  s.prompts = [];
  r.arrivesTick = s.tick;
  return r;
}

test('the battle map is built from the town: bigger towns get longer trails, walls give wall spots, towers are towers', () => {
  const small = town('map-small');
  const big = town('map-big');
  for (let i = 0; i < 14; i++) add(big, 'lean_to', camp(big) + 3 + i * 2);
  for (let i = 0; i < 4; i++) add(big, 'palisade_wall', camp(big) - 10 - i);
  add(big, 'guard_tower', camp(big) - 6);
  const a = layOut(small, false);
  const b = layOut(big, false);
  assert.ok(b.len > a.len, `a bigger town, a longer trail (${a.len} -> ${b.len})`);
  assert.equal(a.spots.filter((q) => q.kind === 'wall').length, 0, 'no walls, no wall spots');
  assert.ok(b.spots.filter((q) => q.kind === 'wall').length >= 4, 'wall spots from the walls');
  assert.equal(b.spots.filter((q) => q.kind === 'tower').length, 1, 'the tower');
  assert.ok(b.decor.some((d) => d.def === 'lean_to'), 'the homes are on the map');
  assert.ok(a.spots.some((q) => q.kind === 'block') && a.spots.some((q) => q.kind === 'ground'));
  assert.ok(layOut(big, true).paths.length === 2, 'a second way in for a raid that splits');
});

test('a raid arrives: the placing phase, then the town places whoever the player has not, and they hold the trail', () => {
  const sim = new Sim(town('hold', 6));
  const s = sim.state;
  const r = raidNow(s, 40);
  sim.step();
  const b = r.battle!;
  assert.ok(b, 'a battle on the trail');
  assert.equal(b.phase, 'placing');
  assert.ok(r.raiders.every((rd) => rd.x < 0 || rd.x > s.tiles.length * 32), 'the raiders are on the map, not in the town');
  // the player places one archer on a wall-or-ground spot; a blocker can't go on a ground spot
  const archer = fighters(s).find(ranged)!;
  const fist = fighters(s).find((p) => !ranged(p))!;
  const ground = b.map.spots.find((q) => q.kind === 'ground')!;
  assert.ok(placeFighter(s, archer.id, ground.id));
  assert.ok(!placeFighter(s, fist.id, ground.id), 'not a fighter who has no reach');
  // the time runs out: everyone else is placed, and the raiders come on
  for (let i = 0; i < 400 && b.phase === 'placing'; i++) sim.step();
  assert.equal(b.phase, 'fighting');
  assert.equal(b.units.length, fighters(s).length, 'everyone placed');
  assert.ok(b.units.some((u) => u.person === archer.id && u.spot === ground.id), "the player's choice kept");
  for (let i = 0; i < 3 * TICKS_PER_HOUR && s.raid?.battle?.phase !== 'done'; i++) sim.step();
  assert.ok(b.phase === 'done', 'the battle ended');
  assert.ok(b.killed + b.through > 0 || r.raiders.some((rd) => rd.gone), 'raiders fell, ran or got through');
});

test('with nobody to stop them, raiders walk the trail and get through to the town', () => {
  const sim = new Sim(town('empty', 1));
  const s = sim.state;
  s.people[0].priorities.defend = 0;
  const r = raidNow(s, 14);
  for (let i = 0; i < 2 * TICKS_PER_HOUR && !(r.battle?.through ?? 0); i++) sim.step();
  assert.ok(r.battle!.through > 0, 'one got through');
  const rd = r.raiders.find((q) => q.bt?.out)!;
  assert.ok(rd.x >= 0 && rd.x <= s.tiles.length * 32, 'and is in the town now');
});

test('a big raid comes in waves; auto-watch places everyone at once', () => {
  const s = town('waves', 20);
  s.autoBattle = true;
  s.tick = 12 * 24 * TICKS_PER_HOUR;
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 400, new Rng(4));
  r.phase = 'active';
  startBattle(s, r);
  const b = r.battle!;
  assert.ok(b.waves >= 2, `${r.raiders.length} raiders in ${b.waves} waves`);
  const room = b.map.spots.filter((q) => q.kind !== 'tower' && q.kind !== 'trap').length;
  assert.ok(b.auto && b.units.length === Math.min(fighters(s).length, room), `placed by the town (${b.units.length} of ${fighters(s).length}, ${room} spots)`);
  assert.ok(new Set(r.raiders.filter((rd) => rd.bt).map((rd) => rd.bt!.wave)).size === b.waves);
});

test('a spell cast on the map strikes only the raiders where it is aimed', () => {
  const s = newGame('aim', { origin: 'lich' });
  s.battles = true;
  s.autopilot = false;
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 60, new Rng(2));
  r.phase = 'active';
  startBattle(s, r);
  const b = r.battle!;
  b.phase = 'fighting';
  const foes = r.raiders.filter((rd) => !rd.ally);
  foes.forEach((rd, i) => (rd.bt!.d = i === 0 ? 2 : 14)); // one near the start, the rest far along
  const near = foes[0];
  const before = foes.map((rd) => rd.hp);
  const path = b.map.paths[0];
  assert.ok(castAt(s, 'drain_life', new Rng(1), [path[0][0] + 2, path[0][1]]), 'cast');
  assert.ok(near.hp < before[0], 'the one where it was aimed is hurt');
  assert.ok(foes.slice(1).every((rd, i) => rd.hp === before[i + 1]), 'the others are not');
  assert.ok(b.casts?.length === 1, 'and the cast is shown on the map');
});

test('the same battle plays out the same every time (it is part of the sim)', () => {
  const run = () => {
    const sim = new Sim(town('same', 5));
    const r = raidNow(sim.state, 50, 3);
    for (let i = 0; i < 3 * TICKS_PER_HOUR && sim.state.raid; i++) sim.step();
    return JSON.stringify([r.battle?.killed, r.battle?.through, sim.state.people.map((p) => p.hp)]);
  };
  assert.equal(run(), run());
});

test('the town places its blockers on the trail and its shooters on the walls first', () => {
  const s = town('walls', 6);
  for (let i = 0; i < 6; i++) add(s, 'palisade_wall', camp(s) - 10 - i);
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(5));
  r.phase = 'active';
  s.autoBattle = false;
  startBattle(s, r);
  const b = r.battle!;
  autoPlace(s, b, r);
  const kindOf = (id: number) => b.map.spots.find((q) => q.id === id)!.kind;
  for (const u of b.units) {
    const p = s.people.find((q) => q.id === u.person)!;
    if (ranged(p)) assert.equal(kindOf(u.spot), 'wall', `${p.name} the shooter on the wall`);
    else assert.equal(kindOf(u.spot), 'block', `${p.name} on the trail`);
  }
  assert.ok(updateRaid);
});
