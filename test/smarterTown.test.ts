import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { startRaid } from '../src/shared/sim/raids';
import { RAID_MEAL_TICKS } from '../src/shared/sim/people';
import { Sim } from '../src/shared/sim/sim';
import { maxHp, type GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { HUNGRY, SUPPER } from '../src/shared/sim/townsfolk';
import { Rng } from '../src/shared/rng';
import { CELL, setGround } from '../src/shared/sim/land';
import { freeSpot, plainGame, priorities, put } from './helpers';

// The town's smarter rules (docs/notes/smarter-town.md): a supper before bed, a meal while the raid's warning runs, the
// badly hurt home to bed with no sickbed free, and makings fetched from the store on the way.

const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
/** The game's clock set to an hour of the first day. */
const atHour = (s: GameState, h: number) => (s.tick = TICKS_PER_DAY + ((h - START_HOUR + 24) % 24) * TICKS_PER_HOUR);

test('someone who would wake hungry eats a supper before bed; the well fed go straight to bed', () => {
  for (const food of [SUPPER - 0.05, SUPPER + 0.1]) {
    const s = plainGame('supper');
    campfire(s).store = { berries: 10 };
    const p = s.people[0];
    p.needs = { food, rest: 0.5 };
    atHour(s, 22);
    const sim = new Sim(s);
    let ate = false;
    for (let i = 0; i < TICKS_PER_HOUR && p.activity !== 'sleep'; i++) {
      sim.step();
      if (p.task?.type === 'eat') ate = true;
    }
    assert.equal(p.activity, 'sleep', 'in bed within the hour');
    assert.equal(ate, food < SUPPER, `food ${food.toFixed(2)}: ${food < SUPPER ? 'a supper first' : 'no supper'}`);
    assert.ok(food >= SUPPER || p.needs.food > SUPPER, `fed enough to wake unhungry (${p.needs.food.toFixed(2)})`);
  }
});

test('a supper is had only while the stores hold food', () => {
  const s = plainGame('no-supper');
  campfire(s).store = {};
  const p = s.people[0];
  p.needs = { food: HUNGRY + 0.05, rest: 0.5 };
  atHour(s, 22);
  const sim = new Sim(s);
  for (let i = 0; i < 200; i++) sim.step();
  assert.equal(p.task?.type, 'sleep');
});

/** A raid on its way, the warning answered with the alarm, arriving `ticks` from now. */
function raidComing(sim: Sim, ticks: number): void {
  const s = sim.state;
  startRaid(s, RAID_KIND_BY_ID.wolves, 8, new Rng(3));
  s.raid!.arrivesTick = s.tick + ticks;
  s.raid!.leavesTick = s.raid!.arrivesTick + 3 * TICKS_PER_HOUR;
  sim.command({ type: 'answerPrompt', prompt: s.raid!.prompt!, option: 0 });
  sim.step();
}

test('with the raiders a good while off, a hungry defender eats first, then takes up arms', () => {
  const s = plainGame('raid-meal');
  campfire(s).store = { berries: 10 };
  const p = s.people[0];
  p.priorities = priorities({ defend: 1 });
  p.needs = { food: HUNGRY - 0.1, rest: 1 };
  atHour(s, 10);
  const sim = new Sim(s);
  raidComing(sim, 2 * TICKS_PER_HOUR);
  let ate = false;
  for (let i = 0; i < 300 && s.raid?.phase === 'warning'; i++) {
    sim.step();
    if (p.task?.type === 'eat') ate = true;
    if (ate && p.task?.type === 'defend') break;
  }
  assert.ok(ate, 'went to eat');
  assert.ok(p.needs.food >= HUNGRY, 'fed');
  assert.equal(p.task?.type, 'defend', 'then to arms');
});

test('a defender already standing to arms goes to eat when hunger comes with the raiders still far off', () => {
  const s = plainGame('raid-meal-late');
  campfire(s).store = { berries: 10 };
  const p = s.people[0];
  p.priorities = priorities({ defend: 1 });
  p.needs = { food: 1, rest: 1 };
  atHour(s, 10);
  const sim = new Sim(s);
  raidComing(sim, 3 * TICKS_PER_HOUR);
  for (let i = 0; i < 20; i++) sim.step();
  assert.equal(p.task?.type, 'defend');
  p.needs.food = HUNGRY - 0.1;
  let ate = false;
  const doing = () => p.task?.type as string | undefined;
  for (let i = 0; i < 200 && !ate; i++) {
    sim.step();
    if (doing() === 'eat') ate = true;
  }
  assert.ok(ate, 'left the line to eat');
});

test('with the raiders nearly here, the hungry go straight to arms', () => {
  const s = plainGame('raid-no-meal');
  campfire(s).store = { berries: 10 };
  const p = s.people[0];
  p.priorities = priorities({ defend: 1 });
  p.needs = { food: HUNGRY - 0.1, rest: 1 };
  atHour(s, 10);
  const sim = new Sim(s);
  raidComing(sim, RAID_MEAL_TICKS - 10);
  for (let i = 0; i < 5; i++) sim.step();
  assert.equal(p.task?.type, 'defend');
});

test('the badly hurt with no sickbed go home to bed till they are mended, and heal faster for it', () => {
  const healed: number[] = [];
  for (const home of [true, false]) {
    const s = plainGame('hurt-home');
    campfire(s).store = { berries: 20 };
    const p = s.people[0];
    p.priorities = priorities({ gather: 1, haul: 1 });
    if (home) {
      const at = freeSpot(s, 'lean_to');
      p.bed = put(s, 'lean_to', at.x, at.y).id;
    }
    // (not the founder, whose own orders the player gives: a townsperson)
    s.mainId = -1;
    p.hp = Math.floor(maxHp(p) * 0.3);
    const from = p.hp;
    atHour(s, 9);
    const sim = new Sim(s);
    let rested = false;
    for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) {
      sim.step();
      if (p.task?.type === 'sleep' && p.task.sick && p.task.building === p.bed && p.activity === 'sleep') rested = true;
    }
    assert.equal(rested, home, home ? 'went home to bed' : 'no bed: carried on');
    healed.push(p.hp - from);
  }
  assert.ok(healed[0] > healed[1] * 2, `resting heals faster (${healed.map((h) => h.toFixed(1)).join(' vs ')})`);
});

test('makings are fetched from the store on the way to the site, not the one at the hauler\'s back', () => {
  const s = plainGame('on-the-way');
  campfire(s).store = {};
  const p = s.people[0];
  p.priorities = priorities({ haul: 1 });
  const c = s.buildings.find((b) => b.def === 'campfire')!;
  // a stockpile just behind the hauler, another a little further but on the way, and the site beyond it
  const behind = put(s, 'stockpile', c.tile - 8, c.row + 4, { store: { wood: 20 } });
  const ahead = put(s, 'stockpile', c.tile + 6, c.row + 4, { store: { wood: 20 } });
  const site = put(s, 'stockpile', c.tile + 14, c.row + 4, { status: 'blueprint', progress: 0, delivered: {} });
  p.x = (c.tile - 2) * CELL;
  p.y = (c.row + 5) * CELL;
  const sim = new Sim(s);
  for (let i = 0; i < 20 && p.task?.type !== 'fetch'; i++) sim.step();
  assert.equal(p.task?.type, 'fetch');
  assert.equal((p.task as { from: number }).from, ahead.id, 'the store on the way');
  assert.notEqual((p.task as { from: number }).from, behind.id);
  assert.equal((p.task as { building: number }).building, site.id);
});

test('someone boxed into their cell (built round, rock either side) scrambles out to eat rather than starve', () => {
  const s = plainGame('boxed-in');
  campfire(s).store = { berries: 10 };
  const p = s.people[0];
  const c = s.buildings.find((b) => b.def === 'campfire')!;
  const at = { x: c.tile + 8, y: c.row + 4 };
  setGround(s.land, at.x - 1, at.y, 'mountain');
  setGround(s.land, at.x + 1, at.y, 'mountain');
  setGround(s.land, at.x, at.y, 'grass');
  put(s, 'palisade_wall', at.x, at.y - 1);
  put(s, 'palisade_wall', at.x, at.y + 1);
  p.x = (at.x + 0.5) * CELL;
  p.y = (at.y + 0.5) * CELL;
  p.needs = { food: HUNGRY - 0.1, rest: 1 };
  atHour(s, 10);
  const sim = new Sim(s);
  for (let i = 0; i < 2 * TICKS_PER_HOUR && p.needs.food < HUNGRY; i++) sim.step();
  assert.ok(p.needs.food >= HUNGRY, 'got out and ate');
});

test('someone held to an event\'s work for a day still breaks off to eat when hungry', () => {
  const s = plainGame('toil-meal');
  campfire(s).store = { berries: 10 };
  const p = s.people[0];
  p.needs = { food: HUNGRY + 0.02, rest: 1 };
  atHour(s, 8);
  const c = s.buildings.find((b) => b.def === 'campfire')!;
  s.busy = { until: s.tick + 12 * TICKS_PER_HOUR, ids: [p.id], text: 'cutting a fireline', x: (c.tile + 4) * CELL, y: c.row * CELL, anim: 'chop' };
  const sim = new Sim(s);
  let toiled = false;
  let ate = false;
  for (let i = 0; i < 6 * TICKS_PER_HOUR; i++) {
    sim.step();
    const t = p.task?.type as string | undefined;
    if (t === 'toil') toiled = true;
    if (toiled && t === 'eat') ate = true;
  }
  assert.ok(toiled, 'set to the work');
  assert.ok(ate, 'broke off to eat');
  assert.ok(p.needs.food >= HUNGRY - 0.05, `fed (${p.needs.food.toFixed(2)})`);
});
