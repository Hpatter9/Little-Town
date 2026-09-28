import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { RAID_GRACE_HOURS, RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { totalStock } from '../src/shared/sim/buildings';
import { startRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { addStock, makePerson, maxHp, poolSize, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { TICK_HZ, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

const runUntil = (sim: Sim, done: () => boolean, maxSeconds = 7200) => {
  let t = 0;
  while (!done() && t < maxSeconds * TICK_HZ) {
    sim.step();
    t++;
  }
  return t / TICK_HZ;
};
const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function addPerson(s: GameState, melee: number): Person {
  const p = makePerson(new Rng(s.nextId * 13), s.nextId++, 'hunter', (camp(s) + 0.5) * 32, s.people.map((q) => q.name));
  p.traits = ['tough'];
  p.hp = maxHp(p);
  p.needs = { food: 1, rest: 1 };
  p.skills.melee.level = melee;
  p.skills.ranged.level = 1;
  p.priorities.defend = 1;
  s.people.push(p);
  return p;
}
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, status: 'done', delivered: {}, progress: 1, store: {}, hp: BUILDING_BY_ID[def].hp };
  s.buildings.push(b);
  return b;
}
/** Start a raid right away, from the given side, and answer the warning. */
function raidNow(sim: Sim, kind: string, budget: number, side: -1 | 1, answer = 0) {
  const s = sim.state;
  let r;
  // pick a seed that sends them from the wanted side
  for (let seed = 1; ; seed++) {
    const copy = structuredClone(s);
    r = startRaid(copy, RAID_KIND_BY_ID[kind], budget, new Rng(seed));
    if (r.side === side) {
      startRaid(s, RAID_KIND_BY_ID[kind], budget, new Rng(seed));
      break;
    }
  }
  sim.command({ type: 'answerPrompt', prompt: s.raid!.prompt!, option: answer });
  sim.step();
  return s.raid;
}

test('no raids in the first two days; then one comes, with a warning that defaults to the alarm', () => {
  const sim = new Sim(plainGame('schedule'));
  const s = sim.state;
  const raid = () => s.raid; // (read fresh: the sim changes it between asserts)
  runUntil(sim, () => !!raid(), RAID_GRACE_HOURS * 60 - 10);
  assert.equal(raid(), null, 'grace period');
  runUntil(sim, () => !!raid(), 60 * 60);
  assert.ok(raid(), 'a raid came');
  assert.equal(raid()!.phase, 'warning');
  assert.equal(s.prompts.length, 1);
  runUntil(sim, () => s.prompts.length === 0, 20 * 60);
  assert.ok(!raid() || raid()!.prompt === null, 'default answer: the alarm');
});

test('strong defenders drive off a wolf pack; any kills end up in storage', () => {
  const sim = new Sim(plainGame('wolves'));
  const s = sim.state;
  const founder = s.people[0];
  founder.priorities.defend = 0; // shelters
  addBuilding(s, 'lean_to', camp(s) - 3); // ...in a bed
  addPerson(s, 12);
  addPerson(s, 12);
  const raid = raidNow(sim, 'wolves', 16, 1)!;
  const took = runUntil(sim, () => !s.raid, 2 * 3600);
  assert.equal(s.raid, null);
  assert.ok(took < 3600, `over in ${took}s, well before they give up`);
  assert.equal(founder.hp, maxHp(founder), 'the founder was safe in bed');
  const killed = raid.raiders.filter((r) => r.down).length;
  assert.equal(totalStock(s).hide ?? 0, killed, 'one hide per wolf killed');
  assert.match(s.notices.map((n) => n.text).join('\n'), /Raid by the wolf pack is over/);
});

test('with nobody defending, rival scouts steal food and escape', () => {
  const sim = new Sim(plainGame('thieves'));
  const s = sim.state;
  s.people[0].priorities.defend = 0;
  addStock(campfire(s).store, 'berries', 20);
  raidNow(sim, 'rivals', 12, -1);
  runUntil(sim, () => !s.raid, 3 * 3600);
  assert.ok((totalStock(s).berries ?? 0) < 20, 'food was taken');
  assert.match(s.notices.at(-1)!.text, /They took/);
});

test('a palisade stops raiders until broken; builders repair it afterwards', () => {
  const sim = new Sim(plainGame('wall'));
  const s = sim.state;
  const p = s.people[0];
  p.priorities.defend = 0;
  addStock(campfire(s).store, 'berries', 10);
  // walls on both sides of camp, raiders from the east
  const east = addBuilding(s, 'palisade_wall', camp(s) + 6);
  addBuilding(s, 'palisade_wall', camp(s) - 7);
  raidNow(sim, 'wolves', 8, 1);
  runUntil(sim, () => (east.hp ?? 0) < 150, 600);
  assert.ok((east.hp ?? 0) < 150, 'the wall took the damage');
  assert.equal(p.hp, maxHp(p), 'nobody inside was hurt while it stood');
  runUntil(sim, () => !s.raid, 4 * 3600);
  if (s.buildings.includes(east)) {
    runUntil(sim, () => east.hp === 150, 600);
    assert.equal(east.hp, 150, 'repaired');
  }
});

test('a lookout gives a much longer warning', () => {
  const warning = (lookout: boolean) => {
    const s = plainGame('look');
    if (lookout) addBuilding(s, 'lookout', camp(s) - 6);
    const r = startRaid(s, RAID_KIND_BY_ID.wolves, 8, new Rng(1));
    return r.arrivesTick - s.tick;
  };
  assert.ok(warning(true) >= warning(false) * 5);
  assert.equal(warning(true), TICKS_PER_HOUR);
});

test('rivals can be paid off with food', () => {
  const sim = new Sim(plainGame('bribe'));
  const s = sim.state;
  addStock(campfire(s).store, 'berries', 20);
  const r = raidNow(sim, 'rivals', 12, 1, 1);
  assert.equal(r, null, 'raid called off');
  assert.ok((totalStock(s).berries ?? 0) < 20);
});

test('people sheltering in bed are safe from a wolf pack', () => {
  const sim = new Sim(plainGame('hide'));
  const s = sim.state;
  const p = s.people[0];
  p.priorities.defend = 0;
  addBuilding(s, 'lean_to', camp(s) - 3);
  sim.step();
  assert.ok(p.bed !== null);
  raidNow(sim, 'wolves', 16, 1);
  runUntil(sim, () => !s.raid, 4 * 3600);
  assert.equal(p.hp, maxHp(p), 'untouched');
  assert.equal(poolSize(p.carrying), 0);
});
