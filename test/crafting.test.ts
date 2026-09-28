import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_BY_ID, POT_STORAGE } from '../src/shared/data/items';
import { hitDamage, personFighter } from '../src/shared/sim/combat';
import { equipAll, hasBedroll } from '../src/shared/sim/crafting';
import { storageCapacity, totalStock } from '../src/shared/sim/buildings';
import { parseSave, SAVE_VERSION, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { addStock, carryCapacity, makePerson, maxHp, newGame, type Building, type GameState } from '../src/shared/sim/state';
import { TICK_HZ, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame, priorities } from './helpers';

const run = (sim: Sim, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ; i++) sim.step();
};
const runUntil = (sim: Sim, done: () => boolean, maxSeconds = 3600) => {
  let t = 0;
  while (!done() && t < maxSeconds * TICK_HZ) {
    sim.step();
    t++;
  }
  return t / TICK_HZ;
};
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
/** A crafting-ready town: everything researched, the founder crafting first. */
function craftTown(seed: string): Sim {
  const sim = new Sim(plainGame(seed));
  const s = sim.state;
  s.cheats.unlockAll = true;
  s.people[0].priorities = priorities({ craft: 1 });
  s.people[0].autoPriorities = false;
  return sim;
}
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}

test('a flint knife is made at the campfire from stored materials, then worn', () => {
  const sim = craftTown('knife');
  const s = sim.state;
  campfire(s).store = { flint: 2, wood: 1, stone: 5 };
  sim.command({ type: 'queueCraft', item: 'flint_knife' });
  run(sim, 1);
  assert.equal(s.crafting.length, 1);
  const t = runUntil(sim, () => !!s.people[0].gear.tool);
  assert.equal(s.people[0].gear.tool, 'flint_knife');
  assert.ok(t > ITEM_BY_ID.flint_knife.seconds / 2, `took ${t}s`);
  assert.deepEqual(totalStock(s), { stone: 5 }, 'flint and wood used up, the rest untouched');
  assert.equal(s.crafting.length, 0);
  assert.ok(s.notices.some((n) => n.text === 'Crafted: Flint Knife'));
});

test('orders wait for their station, their ingredients and their materials, and say why', () => {
  const sim = craftTown('waits');
  const s = sim.state;
  sim.command({ type: 'queueCraft', item: 'stone_axe' });
  sim.command({ type: 'queueCraft', item: 'snare' });
  sim.command({ type: 'queueCraft', item: 'wooden_club' });
  run(sim, 2);
  const view = snapshot(s).crafting;
  assert.equal(view[0].waiting, 'Needs a Workbench');
  assert.equal(view[1].waiting, 'Needs Rope');
  assert.equal(view[2].waiting, 'Short of wood');
  // the queue is full now, but more of the same item still fits the order
  sim.command({ type: 'queueCraft', item: 'rope' });
  sim.command({ type: 'queueCraft', item: 'wooden_club' });
  run(sim, 1);
  assert.equal(s.crafting.length, 3);
  assert.equal(s.crafting[2].count, 2);
});

test('item ingredients come out of the inventory: rope, then a snare from it', () => {
  const sim = craftTown('snare');
  const s = sim.state;
  campfire(s).store = { fiber: 3, wood: 1 };
  sim.command({ type: 'queueCraft', item: 'rope' });
  sim.command({ type: 'queueCraft', item: 'snare' });
  runUntil(sim, () => (s.items.snare ?? 0) > 0);
  assert.equal(s.items.snare, 1);
  assert.equal(s.items.rope ?? 0, 0, 'the rope went into the snare');
});

test('food and ammo are made into storage; cancelling an order returns what was brought', () => {
  const sim = craftTown('stones');
  const s = sim.state;
  campfire(s).store = { stone: 4 };
  sim.command({ type: 'queueCraft', item: 'sling_stones' });
  runUntil(sim, () => (totalStock(s).sling_stones ?? 0) > 0);
  assert.equal(totalStock(s).sling_stones, 6);

  addBuilding(s, 'workbench', campfire(s).tile + 3);
  campfire(s).store = { flint: 2, wood: 1 }; // not enough for an axe (needs 2 wood, 1 fiber)
  sim.command({ type: 'queueCraft', item: 'stone_axe' });
  runUntil(sim, () => (s.crafting[0]?.delivered.flint ?? 0) > 0, 120);
  run(sim, 5);
  sim.command({ type: 'reduceCraft', order: s.crafting[0].id, all: true });
  run(sim, 30);
  const back = { ...totalStock(s) };
  for (const m of Object.keys(s.people[0].carrying) as (keyof typeof back)[]) addStock(back, m, s.people[0].carrying[m]!);
  assert.equal(back.flint, 2);
  assert.equal(back.wood, 1);
});

test('tools: the right one is picked up for the job and speeds it', () => {
  const chop = (withAxe: boolean) => {
    const sim = new Sim(plainGame('axe'));
    const s = sim.state;
    s.cheats.unlockAll = true;
    s.items = withAxe ? { stone_axe: 1 } : {};
    if (withAxe) s.people[0].gear.tool = 'flint_knife';
    const forest = s.tiles.findIndex((t, i) => i > campfire(s).tile && t.terrain === 'forest');
    sim.command({ type: 'toggleGather', tile: forest });
    const t = runUntil(sim, () => s.tiles[forest].terrain === 'clear', 7200);
    return { t, tool: s.people[0].gear.tool, spare: s.items };
  };
  const bare = chop(false);
  const axe = chop(true);
  assert.equal(axe.tool, 'stone_axe');
  assert.deepEqual(axe.spare, { flint_knife: 1 }, 'the knife went back to the inventory');
  assert.ok(axe.t < bare.t * 0.85, `with axe ${axe.t}s vs ${bare.t}s`);
});

test('gear is handed out: weapons to the best fighter, a pack adds carry, pots add storage', () => {
  const s = plainGame('gear');
  const hunter = makePerson(new Rng(9), s.nextId++, 'hunter', 0, []);
  hunter.skills.melee.level = 8;
  s.people.push(hunter);
  s.items = { spear: 1, wooden_club: 1, backpack: 1, hide_armor: 1 };
  equipAll(s);
  assert.equal(hunter.gear.weapon, 'spear', 'the better weapon to the better fighter');
  assert.equal(s.people[0].gear.weapon, 'wooden_club');
  assert.equal(hunter.gear.body, 'hide_armor');
  assert.equal(carryCapacity(s, s.people[0]), carryCapacity(s) + 5, 'the founder got the pack (lowest id)');

  const base = storageCapacity(s, campfire(s));
  s.items.clay_pot = 3;
  assert.equal(storageCapacity(s, campfire(s)), base + 3 * POT_STORAGE);
});

test('combat gear: armour and weapons change the numbers; slings spend stones', () => {
  const s = plainGame('fight');
  const p = s.people[0];
  const bare = personFighter(p, 'fighter', 'front');
  p.gear = { weapon: 'spear', body: 'hide_armor', head: 'hide_cap' };
  const armed = personFighter(p, 'fighter', 'front');
  assert.equal(armed.damage[0], bare.damage[0] + 4);
  assert.ok(armed.accuracy > bare.accuracy);
  assert.ok(Math.abs(armed.armor - 0.3) < 1e-9);

  const rng = new Rng(1);
  const wolfBite = { damage: [10, 10] as [number, number], ammo: 0, ammoBonus: 0, ammoUsed: 0, beastDamage: 0 };
  assert.equal(hitDamage(wolfBite, { kind: 'person', armor: armed.armor, block: 0, tough: false }, rng), 7);

  p.gear = { weapon: 'sling', offhand: 'torch' };
  const slinger = personFighter(p, 'fighter', 'front', 1);
  assert.ok(slinger.ranged);
  const first = hitDamage(slinger, { kind: 'wolf', armor: 0, block: 0, tough: false }, rng);
  const second = hitDamage(slinger, { kind: 'wolf', armor: 0, block: 0, tough: false }, rng);
  assert.equal(slinger.ammo, 0);
  assert.equal(slinger.ammoUsed, 1);
  assert.ok(first - second >= 3 - (slinger.damage[1] - slinger.damage[0]), 'the stone added damage');
  assert.equal(hitDamage({ ...wolfBite }, { kind: 'wolf', armor: 0, block: 1, tough: false }, rng), 0, 'blocked');
});

test('inventory items at work: snares catch meat, poultices stop bleeding, bedrolls help the bedless', () => {
  const sim = new Sim(plainGame('snares'));
  const s = sim.state;
  s.items = { snare: 5, poultice: 1, bedroll: 1 };
  const p = s.people[0];
  p.hp = 0;
  p.downed = { bleedUntil: s.tick + 10 * TICKS_PER_HOUR };
  run(sim, 60 * 5); // five game hours
  assert.equal(p.downed?.bleedUntil ?? null, null, 'stabilized');
  assert.ok(p.hp >= 20);
  assert.equal(s.items.poultice ?? 0, 0);
  assert.ok((totalStock(s).meat ?? 0) > 0, 'the snares caught something');
  assert.ok(hasBedroll(s, p));
});

test('an expedition takes waterskins and sling stones, and brings the skins back', () => {
  const sim = new Sim(plainGame('trip'));
  const s = sim.state;
  const p = s.people[0];
  p.gear.weapon = 'sling';
  s.items.waterskin = 1;
  campfire(s).store = { sling_stones: 12, berries: 10 };
  sim.command({ type: 'sendExpedition', dest: 'berry_thicket', members: [p.id] });
  sim.step();
  const e = s.expeditions[0];
  assert.equal(e.waterskins, 1);
  assert.equal(e.supplies.sling_stones, 10);
  assert.equal(s.items.waterskin ?? 0, 0);
  runUntil(sim, () => !s.expeditions.length, 7200);
  assert.equal(s.items.waterskin, 1, 'back home');
});

test('a version 9 save is brought up to date', () => {
  const s = newGame('old') as unknown as Record<string, any>;
  s.version = 9;
  delete s.items;
  delete s.crafting;
  for (const p of s.people) {
    delete p.gear;
    delete p.priorities.craft;
    delete p.priorities.farm;
  }
  const r = parseSave(serialize(s as unknown as GameState, 1));
  assert.ok(r.ok);
  const st = r.save.state;
  assert.equal(st.version, SAVE_VERSION);
  assert.ok([1, 2, 3].includes(st.people[0].priorities.farm));
  assert.deepEqual(st.items, {});
  assert.deepEqual(st.people[0].gear, {});
  assert.ok([1, 2, 3].includes(st.people[0].priorities.craft));
  assert.equal(maxHp(st.people[0]) > 0, true);
});
