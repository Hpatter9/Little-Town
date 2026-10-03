import { cellAt, groundAt, setGround } from '../src/shared/sim/land';
import { row } from './helpers';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORIGIN_DEFS, ORIGINS } from '../src/shared/data/origins';
import { cleanNewGameOptions } from '../src/shared/data/founding';
import { totalStock } from '../src/shared/sim/buildings';
import { castPowers, POWERS } from '../src/shared/sim/powers';
import { ally } from '../src/shared/sim/classes';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame, type GameState, campCell } from '../src/shared/sim/state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { drainNeeds, joinOrigin, workFactor } from '../src/shared/sim/townsfolk';
import { Rng } from '../src/shared/rng';

/** On the hour (powers are called on hourly, outside a raid). */
const onTheHour = (s: GameState) => (s.tick = Math.ceil((s.tick + 1) / TICKS_PER_HOUR) * TICKS_PER_HOUR);

test('every origin founds a town: its look, its powers (all real), its start', () => {
  for (const id of ORIGINS) {
    const s = newGame(`origin-${id}`, { origin: id });
    const snap = snapshot(s);
    assert.equal(snap.theme, id === 'settlers' ? 'town' : id, id);
    assert.equal(snap.powers.length, ORIGIN_DEFS[id].powers.length, id);
    for (const p of ORIGIN_DEFS[id].powers) assert.ok(POWERS[p], `${id}: ${p}`);
    assert.equal(snap.origin.town, ORIGIN_DEFS[id].town);
    assert.ok(s.people.length >= 1 + (ORIGIN_DEFS[id].start.companions?.length ?? 0), id);
  }
  // (and the New town screen's choice is checked)
  assert.equal(cleanNewGameOptions({ biome: 'forest', difficulty: 'normal', origin: 'druid' })?.origin, 'druid');
  assert.equal(cleanNewGameOptions({ biome: 'forest', difficulty: 'normal', origin: 'dragon' }), null);
  assert.equal(cleanNewGameOptions({ biome: 'forest', difficulty: 'normal' })?.origin, 'settlers');
});

test('lich: a lich founder with a phylactery, and the raised dead, who never hunger or tire', () => {
  const s = newGame('lich-town', { origin: 'lich' });
  assert.ok(s.lich);
  assert.ok(s.buildings.some((b) => b.def === 'phylactery' && b.status === 'done'));
  const dead = s.people.filter((p) => p.id !== s.mainId);
  assert.ok(dead.length >= 2 && dead.every((p) => p.monster === 'undead'));
  const p = dead[0];
  p.needs = { food: 0.5, rest: 0.5 };
  drainNeeds(p, false);
  assert.deepEqual(p.needs, { food: 0.5, rest: 0.5 });
  // Raise Dead: bone into a new worker
  const before = s.people.length;
  onTheHour(s);
  castPowers(s, new Rng(1));
  assert.equal(s.people.length, before + 1);
  assert.equal(s.people.at(-1)!.monster, 'undead');
  assert.ok((totalStock(s).bone ?? 0) < 24, 'paid in bone');
  assert.ok(s.powerLog?.length);
});

test('machines: they never eat or tire, nobody wanders in, and new units are assembled from salvage', () => {
  const sim = new Sim(newGame('robot-town', { origin: 'robot' }));
  const s = sim.state;
  assert.ok(s.people.every((p) => p.machine));
  for (let t = 0; t < 3 * TICKS_PER_DAY; t++) sim.step();
  assert.equal(s.visitor, null, 'no wanderers');
  assert.ok(s.people.length > 2, `assembled: ${s.people.length}`);
  assert.ok(s.people.every((p) => p.machine && p.morale === 60));
  assert.equal(s.gameOver, null);
});

test('druid: fields grow faster, and cleared forest grows back', () => {
  const sim = new Sim(newGame('druid-town', { origin: 'druid' }));
  const s = sim.state;
  // clear every forest cell, then wait
  for (const k of Object.keys(s.land.pools)) {
    const c = cellAt(s.land, Number(k));
    if (groundAt(s.land, c.x, c.y) === 'forest') setGround(s.land, c.x, c.y, 'grass');
  }
  s.autopilot = false;
  for (let t = 0; t < TICKS_PER_DAY; t++) sim.step();
  assert.ok(s.land.cells.includes('f'), 'the forest came back');
});

test('vampire: a vampire founder, and the town works harder by night than by day', () => {
  const s = newGame('vampire-town', { origin: 'vampire' });
  assert.equal(s.people.find((p) => p.id === s.mainId)?.monster, 'vampire');
  const thrall = s.people.find((p) => p.id !== s.mainId)!;
  thrall.traits = [];
  thrall.morale = 50;
  const at = (hour: number) => {
    for (let h = 0; h < 48; h++) if (calendar(h * TICKS_PER_HOUR).hour === hour) return h * TICKS_PER_HOUR;
    return 0;
  };
  s.tick = at(23);
  const night = workFactor(s, thrall);
  s.tick = at(12);
  assert.ok(night > workFactor(s, thrall), `night ${night}, noon ${workFactor(s, thrall)}`);
});

test('raid powers strike: a werewolf town howls up wolves, alchemists throw flasks', () => {
  const wolf = newGame('howl', { origin: 'werewolf' });
  wolf.raid = { id: 1, kind: 'bandits', side: 1, phase: 'active', arrivesTick: 0, leavesTick: 99999, raiders: [{ ...ally(wolf, 'bandit', 100, 1), ally: false }], prompt: null };
  wolf.tick = 10;
  castPowers(wolf, new Rng(2));
  assert.ok(wolf.raid.raiders.filter((r) => r.ally && r.kind === 'wolf').length >= 3, 'the pack came');

  const alch = newGame('flask', { origin: 'alchemists' });
  const bandit = { ...ally(alch, 'bandit', 100, 1), ally: false };
  alch.raid = { id: 1, kind: 'bandits', side: 1, phase: 'active', arrivesTick: 0, leavesTick: 99999, raiders: [bandit], prompt: null };
  alch.tick = 10;
  const hp = bandit.hp;
  castPowers(alch, new Rng(3));
  assert.ok(bandit.hp < hp, 'the flask hurt');
  // (and not again until it's ready)
  const after = bandit.hp;
  alch.tick += 10;
  castPowers(alch, new Rng(3));
  assert.equal(bandit.hp, after);
});

test("powers wait for their moment: a druid won't call rain with nothing growing", () => {
  const s = newGame('no-rain', { origin: 'druid' });
  onTheHour(s);
  castPowers(s, new Rng(4));
  assert.ok(!s.powers?.call_rain, 'not cast');
});

test('dwarves make finer things than druids', () => {
  const avg = (origin: 'dwarves' | 'druid') => {
    const sim = new Sim(newGame('quality-origin', { origin }));
    const s = sim.state;
    s.autopilot = false;
    s.buildings.push({ id: s.nextId++, def: 'stockpile', tile: campCell(s).x + 6, row: row(s), status: 'done', delivered: {}, progress: 1, store: { wood: 200 } });
    for (const p of s.people) p.priorities.craft = 1;
    s.crafting.push({ id: s.nextId++, item: 'wooden_club', count: 12, delivered: {}, itemsTaken: false, progress: 0, made: 0 });
    for (let t = 0; t < 3 * TICKS_PER_DAY && s.crafting.length; t++) sim.step();
    const q = [...(s.itemQ?.wooden_club ?? []), ...s.people.filter((p) => p.gear.weapon === 'wooden_club').map((p) => p.gearQ?.weapon ?? 1)];
    return q.reduce((a, b) => a + b, 0) / Math.max(1, q.length);
  };
  assert.ok(avg('dwarves') > avg('druid') + 1);
});

test('alchemists: a newcomer comes out of the crucible with an extra trait', () => {
  const s = newGame('crucible', { origin: 'alchemists' });
  const p = s.people[1];
  const n = p.traits.length;
  joinOrigin(s, p, new Rng(5));
  assert.equal(p.traits.length, n + 1);
});

test('knights start armed, with palisades known', () => {
  const s = newGame('order', { origin: 'knights' });
  assert.ok(s.research.done.includes('palisades'));
  assert.ok((s.items.spear ?? 0) + s.people.filter((p) => p.gear.weapon === 'spear').length >= 3);
});
