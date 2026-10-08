import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { LEISURE } from '../src/shared/data/recreation';
import { Rng } from '../src/shared/rng';
import { canPlace, totalStock } from '../src/shared/sim/buildings';
import { touchesWater } from '../src/shared/sim/land';
import { finishRelax, RELAX_SHARE, wantsRelax } from '../src/shared/sim/leisure';
import { findSpot, PLAN_TICKS, runPlanner, spiritsOf } from '../src/shared/sim/planner';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { mood } from '../src/shared/sim/townsfolk';
import { camp, clearAround, plainGame, put, row } from './helpers';

/** The tick of an hour on a day (the clock starts at 7). */
const at = (day: number, hour: number) => day * TICKS_PER_DAY + ((hour - 7 + 24) % 24) * TICKS_PER_HOUR;
const lucky = (seed: number) => Object.assign(new Rng(seed), { chance: () => true }) as Rng;
const another = (s: GameState, name: string, extra: Partial<Person> = {}): Person => {
  const p: Person = { ...s.people[0], id: s.nextId++, name, task: null, needs: { food: 1, rest: 1 }, ...extra };
  s.people.push(p);
  return p;
};

test('spirits low, someone takes a break on the village green before their work, and comes away lighter', () => {
  const sim = new Sim(plainGame('green'));
  const s = sim.state;
  const g = put(s, 'village_green', camp(s).x + 4, row(s));
  const p = s.people[0];
  s.tick = at(1, 10);
  p.morale = 30;
  p.needs = { food: 1, rest: 1 };
  let t = 0;
  while (p.task?.type !== 'relax' && t++ < 2 * TICKS_PER_HOUR) sim.step();
  assert.equal(p.task?.type, 'relax');
  while (p.activity !== 'dance' && t++ < 4 * TICKS_PER_HOUR) sim.step();
  assert.equal(p.activity, 'dance');
  assert.ok(Math.abs(p.x - (g.tile + 1.5) * 32) < 64 && Math.abs(p.y - (g.row + 1) * 32) < 64, `on the green: ${p.x}, ${p.y}`);
  let last = p.morale;
  while (p.task?.type === 'relax' && t++ < 6 * TICKS_PER_HOUR) {
    last = p.morale;
    sim.step();
  }
  assert.ok(p.morale >= last + LEISURE.village_green.fun - 1, `spirits lifted: ${last} -> ${p.morale}`);
  assert.ok(p.fun && p.fun.text === 'Games on the green');
  assert.ok(mood(s, p).reasons.some((r) => r.text === 'Games on the green'));
  assert.ok(p.relaxedAt !== undefined);
  assert.equal(wantsRelax(s, p, false), null, 'not again straight away');
  assert.ok(p.recent?.some((r) => /Games on the green/.test(r.text)));
});

test('never more than a share of the grown-ups at play at once; children play on the green, never in the yard', () => {
  const s = plainGame('share');
  put(s, 'village_green', camp(s).x + 4, row(s));
  put(s, 'sparring_yard', camp(s).x - 6, row(s));
  s.tick = at(2, 12);
  for (let i = 0; i < 5; i++) another(s, `Hand ${i}`, { morale: 20 });
  s.people[0].morale = 20;
  s.people[0].needs = { food: 1, rest: 1 };
  const grown = s.people.length;
  let placed = 0;
  for (const p of s.people) {
    const b = wantsRelax(s, p, false);
    if (b) {
      p.task = { type: 'relax', building: b.id, until: s.tick + 600 };
      placed++;
    }
  }
  assert.equal(placed, Math.ceil(grown * RELAX_SHARE));
  // (a child goes to the green, never the yard, and doesn't count against the grown-ups' share)
  const kid = another(s, 'Kid', { type: 'child', bornTick: s.tick - TICKS_PER_DAY, morale: 20, x: (camp(s).x - 6) * 32, y: row(s) * 32 });
  assert.equal(wantsRelax(s, kid, true)?.def, 'village_green');
  // (not by night, nor hungry)
  const late = another(s, 'Late', { morale: 20 });
  s.tick = at(2, 23);
  assert.equal(wantsRelax(s, late, true), null);
  s.tick = at(2, 12);
  late.needs.food = 0.1;
  assert.equal(wantsRelax(s, late, true), null);
});

test('the yard teaches a little of the blade, and the jetty may bring a fish home; the jetty stands at the water', () => {
  const s = plainGame('jetty');
  const p = s.people[0];
  const yard = put(s, 'sparring_yard', camp(s).x + 4, row(s));
  const xp = p.skills.melee.xp + p.skills.melee.level * 1000;
  finishRelax(s, p, yard, LEISURE.sparring_yard, new Rng(1));
  assert.ok(p.skills.melee.xp + p.skills.melee.level * 1000 > xp, 'melee learned');
  const jetty = put(s, 'fishing_jetty', camp(s).x - 6, row(s));
  const fish = totalStock(s).fish ?? 0;
  finishRelax(s, p, jetty, LEISURE.fishing_jetty, lucky(2));
  assert.equal(totalStock(s).fish ?? 0, fish + 1);
  // the planner puts a jetty at the water's edge (a coast town has water near)
  const c = newGame('jetty-coast', { biome: 'coast' });
  c.land.open = 40;
  c.research.done.push('fish_traps');
  const def = BUILDING_BY_ID.fishing_jetty;
  const spot = findSpot(c, def);
  assert.ok(spot, 'a spot by the water');
  assert.ok(touchesWater(c.land, { x: spot!.x, y: spot!.y, w: def.width, h: def.depth ?? 1 }));
  assert.ok(canPlace(c, def, spot!.x, spot!.y).ok);
});

test('nights on the ground weigh heavier each night; someone sleeping rough makes the town want a roof first; low spirits, a comfort', () => {
  const s = plainGame('rough');
  const p = s.people[0];
  p.lastSlept = 'ground';
  p.roughNights = 1;
  const one = mood(s, p).reasons.find((r) => r.text.startsWith('Slept on the ground'))!;
  p.roughNights = 4;
  const four = mood(s, p).reasons.find((r) => r.text.startsWith('Slept on the ground'))!;
  assert.ok(four.value < one.value && four.text.includes('4 nights'), `${one.value} then ${four.value}: ${four.text}`);
  // a town with a bed to spare, but whose founder slept out: a home comes first
  const t = newGame('roof');
  t.research.done.push('basic_shelter', 'woodcutting');
  clearAround(t, 20);
  t.buildings[0].store = { wood: 300, fiber: 60, stone: 60, berries: 100 };
  put(t, 'lean_to', camp(t).x - 5, row(t));
  for (const q of t.people) q.lastSlept = 'ground';
  t.tick = PLAN_TICKS * 8;
  runPlanner(t);
  assert.ok(t.buildings.some((b) => b.status === 'blueprint' && BUILDING_BY_ID[b.def].housing), `a home: ${t.buildings.filter((b) => b.status === 'blueprint').map((b) => b.def)}`);
  // the same town, slept in beds but glum: a place of leisure is wished for
  const u = newGame('glum');
  u.research.done.push('basic_shelter', 'woodcutting');
  clearAround(u, 20);
  u.buildings[0].store = { wood: 300, fiber: 60, stone: 60, berries: 100 };
  put(u, 'lean_to', camp(u).x - 5, row(u));
  another(u, 'Hand 1');
  another(u, 'Hand 2'); // (a town of three: a hamlet raises a roof before a green, LEISURE_PEOPLE)
  for (const q of u.people) {
    q.lastSlept = 'bed';
    q.morale = 20;
  }
  assert.ok(spiritsOf(u) < 30);
  // (a few passes, what is laid built between them: the home and the field come first, then the comfort)
  const laid: string[] = [];
  for (let pass = 0; pass < 8 && !laid.some((d) => LEISURE[d]); pass++) {
    u.tick += PLAN_TICKS;
    runPlanner(u);
    for (const b of u.buildings) {
      if (b.status !== 'blueprint') continue;
      laid.push(b.def);
      b.status = 'done';
      b.progress = 1;
    }
  }
  assert.ok(laid.some((d) => LEISURE[d]), `a comfort among ${laid}`);
});
