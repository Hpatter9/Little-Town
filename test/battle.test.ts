import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { autoPlace, battleSpeedNow, battleView, cumulative, fighters, foeAt, layOut, placeFighter, pointAt, ranged, startBattle } from '../src/shared/sim/battle';
import { castAt } from '../src/shared/sim/powers';
import { defenderAttack } from '../src/shared/sim/raids';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { parseCommand } from '../src/shared/sim/commands';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, newGame, type GameState, campCell } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put } from './helpers';
import { groundAt, setGround } from '../src/shared/sim/land';

const camp = (s: GameState) => campCell(s).x;

/** A town of `n` fighters (half of them shooters), with battles on and no raid of its own coming. */
function town(seed: string, n = 4): GameState {
  const s = plainGame(seed);
  s.battles = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.people[0].priorities.defend = 1;
  for (let i = 0; i < n - 1; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
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

test('the battle is laid out on the land: the trail runs from its edge to the gate, walls overlooking it give wall spots, a tower in reach is a tower', () => {
  const plain = town('map-small');
  const walled = town('map-big');
  const c = camp(walled);
  const y = campCell(walled).y;
  // a wall across the west, a tower behind it, homes further in
  for (let i = 0; i < 4; i++) put(walled, 'palisade_wall', c - 8 - i, y + 1);
  put(walled, 'guard_tower', c - 7, y);
  for (let i = 0; i < 6; i++) put(walled, 'lean_to', c + 3 + i * 2, y + 3);
  const a = layOut(plain, -1, false);
  const b = layOut(walled, -1, false);
  for (const map of [a, b]) {
    const path = map.paths[0];
    assert.ok(path[0][0] < c - plain.land.open && Math.hypot(path[0][0] - 0.5 - c, path[0][1] - 0.5 - y) >= plain.land.open, 'in from the fog to the west');
    assert.ok(map.len > 6, `a trail of ${map.len} cells`);
    const [gx, gy] = map.gate;
    assert.equal(gy, y + 0.5, 'to the gate on the camp row');
    assert.ok(gx < c, 'at the town\'s west edge');
    assert.ok(path.every(([px, py]) => !walled.buildings.some((q) => q.status === 'done' && px >= q.tile && px < q.tile + 1 && py >= (q.row ?? 0) && py < (q.row ?? 0) + 1)), 'round the buildings');
  }
  assert.ok(b.gate[0] < a.gate[0], 'the walled town\'s gate is further out');
  assert.equal(a.spots.filter((q) => q.kind === 'wall').length, 0, 'no walls, no wall spots');
  assert.equal(b.spots.filter((q) => q.kind === 'wall').length, 4, 'a wall spot on each wall');
  assert.equal(b.spots.filter((q) => q.kind === 'tower').length, 1, 'the tower');
  assert.ok(a.spots.some((q) => q.kind === 'block') && a.spots.some((q) => q.kind === 'ground'));
  assert.ok(layOut(walled, -1, true).paths.length === 2, 'a second way in for a raid that splits');
  assert.ok(layOut(walled, -1, true).paths[1][0][0] > c + walled.land.open, 'from the east');
});

test('a raid arrives: the placing phase, then the town places whoever the player has not, and they hold the trail', () => {
  const sim = new Sim(town('hold', 6));
  const s = sim.state;
  const r = raidNow(s, 40);
  sim.step();
  const b = r.battle!;
  assert.ok(b, 'a battle on the trail');
  assert.equal(b.phase, 'placing');
  assert.ok(r.raiders.every((rd) => rd.x < 0 || rd.x > s.land.w * 32), 'the raiders are on the map, not in the town');
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
  assert.ok(rd.x >= 0 && rd.x <= s.land.w * 32, 'and is in the town now');
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
  assert.ok(castAt(s, 'drain_life', new Rng(1), foeAt(b.map, near)), 'cast');
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
  for (let i = 0; i < 3; i++) put(s, 'palisade_wall', camp(s) - 8 - i, campCell(s).y + 1);
  for (let i = 0; i < 3; i++) put(s, 'palisade_wall', camp(s) + 8 + i, campCell(s).y + 1);
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

test('the trail fords a river where it must, and never crosses water otherwise', () => {
  const s = town('ford');
  const m = s.land;
  // a river right across the land, west of the camp
  const rx = camp(s) - 6;
  for (let y = 0; y < m.h; y++) setGround(m, rx, y, 'water');
  const map = layOut(s, -1, false);
  const path = map.paths[0];
  let wet = 0;
  for (let d = 0; d < map.len; d += 0.5) {
    const [px, py] = pointAt(path, cumulative(path), d);
    if (groundAt(m, Math.floor(px), Math.floor(py)) === 'water') wet++;
  }
  assert.ok(wet > 0 && wet <= 4, `wades the river once (${wet} wet steps)`);
  assert.ok(map.spots.every((q) => groundAt(m, Math.floor(q.x), Math.floor(q.y)) !== 'water'), 'no spot stands in the water');
});

test('the raiders walk the trail over the land, and the fighters walk out to their spots before they fight', () => {
  const sim = new Sim(town('walk', 4));
  const s = sim.state;
  const r = raidNow(s, 30);
  sim.step();
  const b = r.battle!;
  const far = b.map.spots.filter((q) => q.kind === 'block').sort((p, q) => p.x - q.x)[r.side < 0 ? 0 : b.map.spots.filter((q) => q.kind === 'block').length - 1];
  const fist = fighters(s).find((p) => !ranged(p))!;
  assert.ok(placeFighter(s, fist.id, far.id));
  const before = { x: fist.x, y: fist.y };
  for (let i = 0; i < 50; i++) sim.step();
  assert.ok(Math.hypot(fist.x - before.x, fist.y - before.y) > 32, 'on their way');
  for (let i = 0; i < 1500 && Math.hypot(fist.x / 32 - far.x, fist.y / 32 - far.y) > 1.2; i++) sim.step();
  assert.ok(Math.hypot(fist.x / 32 - far.x, fist.y / 32 - far.y) <= 1.2, 'at the spot');
  for (let i = 0; i < 400 && b.phase === 'placing'; i++) sim.step();
  for (let i = 0; i < 200 && !r.raiders.some((rd) => rd.bt!.d > 1); i++) sim.step();
  const rd = r.raiders.find((q) => q.bt!.d > 1)!;
  const [cx, cy] = foeAt(b.map, rd);
  assert.ok(Math.abs(rd.x - cx * 32) < 1 && Math.abs(rd.y - cy * 32) < 1, 'a raider stands on the land where it is on the trail');
});

test('mages: their fire bursts over the raiders round the one hit', () => {
  const s = town('mages', 10);
  const mages = s.people.slice(1, 3);
  for (const p of mages) p.cls = 'mage';
  assert.ok(mages.every(ranged), 'they fight from range');
  // three raiders bunched on the trail: one bolt hurts all of them
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 120, new Rng(5));
  r.phase = 'active';
  startBattle(s, r);
  const foes = r.raiders.filter((rd) => !rd.ally).slice(0, 3);
  assert.equal(foes.length, 3);
  for (const rd of r.raiders) rd.bt!.d = 4;
  const before = foes.map((rd) => rd.hp);
  let hurt = 0;
  for (let i = 0; i < 20 && !hurt; i++) {
    defenderAttack(s, mages[0], foes[0], new Rng(i), 0, 1, foes.slice(1));
    hurt = foes.filter((rd, k) => rd.hp < before[k]).length;
  }
  assert.equal(hurt, 3, 'all three burnt');
});

test('a battle can be played at 2 or 3 times, only while it is on, and the choice is kept', () => {
  const sim = new Sim(town('speed', 4));
  const s = sim.state;
  assert.equal(battleSpeedNow(s), 1);
  assert.equal(parseCommand({ type: 'battleSpeed', speed: 5 }), null, 'only 1, 2 or 3');
  sim.command(parseCommand({ type: 'battleSpeed', speed: 3 })!);
  assert.equal(battleSpeedNow(s), 1, 'no battle on: the town runs at its own pace');
  const r = raidNow(s, 40);
  sim.step();
  assert.ok(r.battle);
  assert.equal(battleSpeedNow(s), 3);
  assert.equal(battleView(s, [])!.speed, 3);
  sim.command({ type: 'battleSpeed', speed: 2 });
  sim.step();
  assert.equal(battleSpeedNow(s), 2);
  r.battle!.phase = 'done';
  assert.equal(battleSpeedNow(s), 1, 'over: back to the town pace');
  assert.equal(s.battleSpeed, 2, 'kept for the next battle');
});
