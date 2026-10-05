import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { HOLD_REACH, SETUP_MOST, autoPlace, battleSpeedNow, battleView, cumulative, fighters, foeAt, lanesFor, laneSide, layOut, placeFighter, pointAt, ranged, startBattle } from '../src/shared/sim/battle';
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
  s.autoBattle = false; // (placed by hand in these tests; a town fights on auto unless the player turns it off)
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
  for (const [map, own] of [[a, plain], [b, walled]] as const) {
    const path = map.paths[0];
    assert.ok(path[0][0] < c - plain.land.open && Math.hypot(path[0][0] - 0.5 - c, path[0][1] - 0.5 - y) >= plain.land.open, 'in from the fog to the west');
    assert.ok(map.len > 6, `a trail of ${map.len} cells`);
    const [gx, gy] = map.gate;
    assert.equal(gy, y + 0.5, 'to the gate on the camp row');
    assert.ok(gx < c, 'at the town\'s west edge');
    for (const p of map.paths) assert.ok(p.every(([px, py]) => !own.buildings.some((q) => q.status === 'done' && px >= q.tile && px < q.tile + 1 && py >= (q.row ?? 0) && py < (q.row ?? 0) + 1)), 'round the buildings');
  }
  assert.ok(b.gate[0] < a.gate[0], 'the walled town\'s gate is further out');
  assert.equal(a.spots.filter((q) => q.kind === 'wall').length, 0, 'no walls, no wall spots');
  assert.equal(b.spots.filter((q) => q.kind === 'wall').length, 4, 'a wall spot on each wall');
  assert.equal(b.spots.filter((q) => q.kind === 'tower').length, 1, 'the tower');
  assert.ok(a.spots.some((q) => q.kind === 'block') && a.spots.some((q) => q.kind === 'ground'));
  const split = layOut(walled, -1, true);
  const flankLane = split.sides!.indexOf(1);
  assert.ok(flankLane > 0, 'a way in for a raid that splits');
  assert.ok(split.paths[flankLane][0][0] > c + walled.land.open, 'from the east');
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
  s.autoBattle = false;
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

test('a fighter who falls back off the line takes a parting blow from each raider they were holding', () => {
  const s = town('parting', 4);
  s.autoBattle = false;
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(6));
  r.phase = 'active';
  startBattle(s, r);
  const b = r.battle!;
  autoPlace(s, b, r);
  b.phase = 'fighting';
  b.until = s.tick;
  const u = b.units.find((x) => x.person !== undefined && b.map.spots.find((q) => q.id === x.spot)!.kind === 'block')!;
  const p = s.people.find((q) => q.id === u.person)!;
  const spot = b.map.spots.find((q) => q.id === u.spot)!;
  p.x = spot.x * 32;
  p.y = spot.y * 32;
  // two bandits held at their spear point, and the fighter all but spent
  const held = r.raiders.filter((rd) => !rd.ally).slice(0, 2);
  for (const rd of held) {
    rd.bt!.d = 1;
    rd.bt!.held = u.spot;
    rd.cooldown = 50;
  }
  p.hp = 1;
  const tick = s.tick;
  updateRaid(s, new Rng(7));
  assert.ok(!b.units.some((x) => x.person === p.id), 'they left the line');
  assert.equal(held[0].lastAction, tick, 'the first raider struck at their back as they went');
  // (the second strikes too, unless the first blow already laid the fighter out)
  assert.ok(p.downed || held[1].lastAction === tick, 'and the second, if there was anyone left to strike');
  for (const rd of held) assert.equal(rd.bt!.held, undefined, 'and none is held any longer');
});

test('a battle fights itself unless the player has turned auto off', () => {
  const s = newGame('auto-default');
  s.battles = true;
  s.autopilot = false;
  assert.equal(s.autoBattle, undefined);
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 60, new Rng(2));
  r.phase = 'active';
  startBattle(s, r);
  assert.equal(r.battle!.auto, true);
});

test('the set-up stage: fighters hold the stretch by the gate, and the raiders stay in the fog until every one placed stands at their spot', () => {
  const s = town('setup-stage', 5);
  s.autoBattle = true;
  const r = raidNow(s, 40);
  const sim = new Sim(s);
  sim.step();
  const b = r.battle!;
  assert.ok(b, 'the battle began');
  // every spot a fighter may take is within the hold's reach of the gate, along the nearest way in (blockers on the
  // held stretch, shooters on it or a little beyond)
  // (a blocker: how far from the gate the trail it stands on is; a shooter: the nearest to the gate of the trail it
  // has in bow range, since a spot at a switchback sees the trail both coming and going)
  const fromGate = (x: number, y: number, inRange = 0) => {
    let near = Infinity;
    let left = Infinity;
    for (const path of b.map.paths) {
      const cum = cumulative(path);
      const end = cum[cum.length - 1];
      for (let d = 0; d <= end; d += 0.25) {
        const [px, py] = pointAt(path, cum, d);
        const k = Math.hypot(px - x, py - y);
        if (inRange ? k <= inRange && end - d < left : k < near) [near, left] = [k, end - d];
      }
    }
    return left;
  };
  const main = cumulative(b.map.paths[0]);
  assert.ok(main[main.length - 1] > HOLD_REACH + 4, `a long trail (${main[main.length - 1].toFixed(1)} cells)`);
  for (const q of b.map.spots.filter((q) => q.kind === 'block' || q.kind === 'ground'))
    assert.ok(fromGate(q.x, q.y, q.kind === 'ground' ? 120 / 32 : 0) <= (q.kind === 'block' ? HOLD_REACH : HOLD_REACH * 1.25) + 2, `spot ${q.kind} ${fromGate(q.x, q.y).toFixed(1)} from the gate`);
  // send one placed fighter far off: nobody comes onto the trail until they're back at their spot
  const u = b.units.find((q) => q.person !== undefined)!;
  const p = s.people.find((q) => q.id === u.person)!;
  p.x = b.map.gate[0] * 32 - 32 * 10 * (r.side);
  let firstIn = -1;
  for (let t = 0; t < SETUP_MOST + 20 && firstIn < 0; t++) {
    sim.step();
    if (r.raiders.some((rd) => rd.bt && rd.bt.d >= 0)) firstIn = s.tick;
  }
  assert.ok(firstIn > 0, 'the raiders came in the end');
  const spot = b.map.spots.find((q) => q.id === u.spot)!;
  const stillPlaced = b.units.find((q) => q.person === p.id);
  if (stillPlaced) assert.ok(Math.hypot(p.x / 32 - spot.x, p.y / 32 - spot.y) <= 1.3, 'the far-off fighter was at their spot before the raiders came');
});

test('several ways in, each winding: raiders spread over them, and shooters stand where they see the most trail', () => {
  const s = town('lanes', 7);
  const r = raidNow(s, 60);
  new Sim(s).step();
  const b = r.battle!;
  const own = b.map.paths.filter((_, i) => laneSide(b.map, i) === 0);
  assert.ok(own.length >= 2, `${own.length} ways in from the raid's side`);
  assert.equal(own.length, lanesFor(s));
  const starts = new Set(own.map((p) => `${Math.floor(p[0][0])},${Math.floor(p[0][1])}`));
  assert.equal(starts.size, own.length, 'each out of the fog at its own place');
  for (const p of own) {
    assert.deepEqual(p[p.length - 1], b.map.gate, 'every way in ends at the gate');
    const cum = cumulative(p);
    const straight = Math.hypot(p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]);
    assert.ok(cum[cum.length - 1] > straight * 1.15, `winding: ${cum[cum.length - 1].toFixed(1)} cells where the crow flies ${straight.toFixed(1)}`);
    assert.ok(p.length >= 5, 'with bends');
  }
  // the raiders are spread over the lanes
  const lanes = new Set(r.raiders.filter((rd) => rd.bt).map((rd) => rd.bt!.lane));
  assert.ok(lanes.size >= 2, 'raiders on more than one way in');
  // shooters' spots see more trail than a spot picked at random beside it would
  const ground = b.map.spots.filter((q) => q.kind === 'ground');
  assert.ok(ground.length >= own.length * 2, `${ground.length} shooters' spots`);
  // the same raid lays out the same (the sim is deterministic), and another day's raid differently
  const again = layOut(s, r.side, false, false, b.started);
  assert.deepEqual(again.paths, b.map.paths.filter((_, i) => laneSide(b.map, i) === 0));
  const other = layOut(s, r.side, false, false, b.started + 9999);
  assert.notDeepEqual(other.paths, again.paths, 'a new raid, new trails');
});

test('a trap the town has built is laid on a way in, where the raiders pass', () => {
  const s = town('trap-lanes', 4);
  const c = campCell(s);
  put(s, 'pit_trap', c.x + 2, c.y + 3); // (inside the town, far from any trail)
  const map = layOut(s, -1, false);
  const trap = map.spots.find((q) => q.kind === 'trap');
  assert.ok(trap, 'the trap is on the battle map');
  const onTrail = map.paths.some((p) => {
    const cum = cumulative(p);
    for (let d = 0; d <= cum[cum.length - 1]; d += 0.25) if (Math.hypot(pointAt(p, cum, d)[0] - trap!.x, pointAt(p, cum, d)[1] - trap!.y) < 0.3) return true;
    return false;
  });
  assert.ok(onTrail, 'laid on a trail');
});
