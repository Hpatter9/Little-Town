import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageOf, PART_IDS, PARTS, partsOf, RARE_SET } from '../src/shared/data/chains';
import { ITEM_BY_ID, ITEMS, STATIONS } from '../src/shared/data/items';
import { MATERIALS } from '../src/shared/data/materials';
import { chainCost, chainMakeable, fellHeartwood, HEARTWOOD_CHANCE, nextStep, rareFind } from '../src/shared/sim/chains';
import { TRADE_DESTINATIONS } from '../src/shared/data/minerals';
import { FACTION_GOODS } from '../src/shared/data/trade';
import { pulledGrade, TOOL_HOURS, wearTools } from '../src/shared/sim/crafting';
import { totalStock } from '../src/shared/sim/buildings';
import { runPlanner } from '../src/shared/sim/planner';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { type Building, type CraftOrder, type Expedition, type GameState } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { plainGame, priorities, row } from './helpers';

const runUntil = (sim: Sim, done: () => boolean, maxSeconds = 3600) => {
  for (let t = 0; !done() && t < maxSeconds * TICK_HZ; t++) sim.step();
  return done();
};
function addBuilding(s: GameState, def: string, tile: number): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  return b;
}
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function craftTown(seed: string): Sim {
  const sim = new Sim(plainGame(seed));
  sim.state.cheats.unlockAll = true;
  sim.state.people[0].priorities = priorities({ craft: 1 });
  sim.state.people[0].autoPriorities = false;
  return sim;
}

test('every chain resolves: parts and rare inputs are real, each part made at a real station from a material', () => {
  for (const i of ITEMS) for (const id of Object.keys(i.items ?? {})) assert.ok(ITEM_BY_ID[id], `${i.id} takes ${id}`);
  for (const p of PARTS) {
    assert.ok(STATIONS.includes(p.station), `${p.id} at ${p.station}`);
    assert.ok(Object.keys(p.cost).every((m) => (MATERIALS as readonly string[]).includes(m)));
    assert.ok(!p.items, 'a part is made from materials alone');
  }
  for (const m of RARE_SET) assert.ok((MATERIALS as readonly string[]).includes(m), m);
});

test('the first age stays simple; depth grows with the age and the grade', () => {
  // (the Stone Age's things take no parts)
  for (const i of ITEMS) if (partsOf(i).length) assert.notEqual(ageOf({ ...i.cost, ...Object.assign({}, ...partsOf(i).map(([id]) => ITEM_BY_ID[id].cost)) }), 'neolithic', `${i.id} is a first-age thing`);
  for (const id of ['flint_knife', 'stone_axe', 'spear', 'hide_armor', 'bow_stave'].filter((x) => !PART_IDS.has(x))) assert.equal(partsOf(ITEM_BY_ID[id]).length, 0, id);
  // a plain Medieval piece: one part; a fine one: two; the age's best: a rare input as well
  assert.deepEqual(Object.keys(ITEM_BY_ID.iron_axe.items ?? {}), ['iron_blade']);
  assert.equal(partsOf(ITEM_BY_ID.short_sword).length, 1, 'a tier-5 sword');
  assert.equal(partsOf(ITEM_BY_ID.arming_sword).length, 2, 'a tier-6 sword');
  assert.ok(ITEM_BY_ID.longsword.cost.silver, 'a tier-7 sword takes silver');
  assert.ok(!ITEM_BY_ID.arming_sword.cost.silver);
  // Industrial things: two parts
  assert.equal(partsOf(ITEM_BY_ID.musket).length, 2);
  // the raw total stays about the same: a sword's iron is in its blade now
  assert.equal(chainCost({ items: {} } as unknown as GameState, ITEM_BY_ID.short_sword).iron ?? 0, (ITEM_BY_ID.short_sword.cost.iron ?? 0) + 2);
});

test('a chain is made from the ore up: smelted, forged into a blade, then the axe', () => {
  const sim = craftTown('chain');
  const s = sim.state;
  addBuilding(s, 'bloomery', 4);
  addBuilding(s, 'smithy', 8);
  addBuilding(s, 'workbench', 12);
  campfire(s).store = { iron_ore: 4, wood: 4, lumber: 2 };
  // (the planner's next step toward the axe: the blade's iron first isn't a part, so nothing yet)
  assert.equal(nextStep(s, ITEM_BY_ID.iron_axe, totalStock(s)), null, 'no iron yet: nothing to queue');
  sim.command({ type: 'queueCraft', item: 'smelt_iron' });
  sim.command({ type: 'queueCraft', item: 'smelt_iron' });
  assert.ok(runUntil(sim, () => (totalStock(s).iron ?? 0) >= 2), 'iron smelted');
  assert.equal(nextStep(s, ITEM_BY_ID.iron_axe, totalStock(s))?.id, 'iron_blade', 'the blade comes first');
  sim.command({ type: 'queueCraft', item: 'iron_blade' });
  assert.ok(runUntil(sim, () => (s.items.iron_blade ?? 0) >= 1), 'blade forged');
  assert.equal(nextStep(s, ITEM_BY_ID.iron_axe, totalStock(s))?.id, 'iron_axe', 'then the axe');
  sim.command({ type: 'queueCraft', item: 'iron_axe' });
  assert.ok(runUntil(sim, () => s.people[0].gear.tool === 'iron_axe' || (s.items.iron_axe ?? 0) > 0), 'axe made');
  assert.equal(s.items.iron_blade ?? 0, 0, 'the blade went into it');
});

test("the town's best pieces wait for their rare input; without it the next best is made", () => {
  const s = craftTown('rare').state;
  addBuilding(s, 'smithy', 8);
  addBuilding(s, 'tannery', 12);
  addBuilding(s, 'workbench', 16);
  const stock = { iron: 20, lumber: 10, leather: 10 };
  assert.equal(chainMakeable(s, ITEM_BY_ID.longsword, stock), false, 'no silver');
  assert.equal(chainMakeable(s, ITEM_BY_ID.longsword, { ...stock, silver: 1 }), true);
  assert.equal(chainMakeable(s, ITEM_BY_ID.short_sword, stock), true);
});

test('fine parts make a finer piece, poor ones a poorer', () => {
  const s = plainGame('quality');
  const o = { id: 7 } as CraftOrder;
  assert.equal(pulledGrade(s, o, 1), 1, 'no parts: as rolled');
  assert.equal(pulledGrade(s, { ...o, inputQ: 3 }, 1), 2, 'Rare parts lift a Common roll a step');
  assert.equal(pulledGrade(s, { ...o, inputQ: 5 }, 2), 4, 'Legendary parts two steps');
  assert.equal(pulledGrade(s, { ...o, inputQ: 1 }, 2), 2, 'Common parts leave it be');
  let lower = 0;
  for (let t = 0; t < 40; t++) lower += pulledGrade({ ...s, tick: t }, { ...o, inputQ: 0 }, 2) < 2 ? 1 : 0;
  assert.ok(lower > 5 && lower < 35, `Poor parts drag it down half the time (${lower} of 40)`);
});

test('tools wear with work and break; a finer one lasts longer', () => {
  const s = plainGame('wear');
  const p = s.people[0];
  p.gear.tool = 'stone_axe';
  p.gearQ = { tool: 1 };
  p.activity = 'chop';
  let hours = 0;
  while (p.gear.tool && hours < 1000) {
    wearTools(s);
    hours++;
  }
  assert.equal(hours, TOOL_HOURS, 'a Common axe lasts its hours');
  assert.ok(s.notices.some((n) => n.text.includes('stone axe wore out')));
  p.gear.tool = 'stone_axe';
  p.gearQ = { tool: 3 };
  hours = 0;
  while (p.gear.tool && hours < 1000) {
    wearTools(s);
    hours++;
  }
  assert.ok(hours > TOOL_HOURS * 1.4, `a Rare axe lasts longer (${hours})`);
  // (resting, or at work it doesn't help with, it doesn't wear)
  p.gear.tool = 'stone_axe';
  p.activity = 'idle';
  for (let k = 0; k < 500; k++) wearTools(s);
  assert.equal(p.gear.tool, 'stone_axe');
});

test('the town makes the parts it needs: a tool for a worker comes through its blade', () => {
  const sim = craftTown('planner');
  const s = sim.state;
  s.autopilot = true;
  s.cheats.unlockAll = false;
  s.research.done.push('woodcutting', 'stoneworking', 'iron_working', 'carpentry');
  addBuilding(s, 'smithy', 8);
  addBuilding(s, 'workbench', 12);
  campfire(s).store = { iron: 10, lumber: 6, wood: 10, stone: 10, fiber: 6, berries: 40 };
  runPlanner(s);
  assert.ok(s.crafting.some((o) => o.item === 'iron_blade'), `a blade is queued first (${s.crafting.map((o) => o.item)})`);
  assert.ok(!s.crafting.some((o) => ITEM_BY_ID[o.item].slot === 'tool'), 'not the tool before its blade');
  assert.ok(runUntil(sim, () => s.people.some((p) => partsOf(ITEM_BY_ID[p.gear.tool ?? ''] ?? { items: {} } as never).length > 0) || Object.keys(s.items).some((id) => ITEM_BY_ID[id].slot === 'tool' && partsOf(ITEM_BY_ID[id]).length > 0), 1800), 'an iron tool is made');
});

test('an old save with an order whose recipe gained parts still loads and plays on', () => {
  const sim = craftTown('oldsave');
  const s = sim.state;
  addBuilding(s, 'smithy', 8);
  s.crafting.push({ id: s.nextId++, item: 'iron_axe', count: 1, delivered: { iron: 2, lumber: 1 }, itemsTaken: false, progress: 0, made: 0 });
  delete s.people[0].toolWear;
  const back = parseSave(serialize(s, 1));
  assert.ok(back.ok);
  const again = new Sim(back.save.state);
  for (let t = 0; t < 30 * TICK_HZ; t++) again.step();
  assert.equal(again.state.crafting[0]?.item, 'iron_axe', 'the order waits for its blade');
});

test('rare inputs come from the land, from quests and from trade', () => {
  // the land: felling old trees now and then gives heartwood (from the Medieval age, with the town running itself)
  const s = plainGame('rarefinds');
  const p = s.people[0];
  fellHeartwood(s, p);
  s.autopilot = true;
  s.era = 'medieval';
  let felled = 0;
  for (let t = 0; t < 4000; t++) {
    s.tick = t;
    p.carrying = {};
    fellHeartwood(s, p);
    felled += p.carrying.heartwood ?? 0;
  }
  assert.ok(felled > 4000 * HEARTWOOD_CHANCE * 0.5 && felled < 4000 * HEARTWOOD_CHANCE * 2, `heartwood felled ${felled} times in 4000`);
  // quests: a party home from a legendary trip often brings a rare input; a recalled one never does
  const e = { id: 1, loot: {}, recalled: false } as unknown as Expedition;
  let found = 0;
  for (let t = 0; t < 200; t++) {
    s.tick = t;
    e.loot = {};
    rareFind(s, e, 'legendary');
    if (Object.keys(e.loot).some((m) => RARE_SET.has(m as never))) found++;
  }
  assert.ok(found > 120, `legendary trips found something ${found} times in 200`);
  e.recalled = true;
  e.loot = {};
  rareFind(s, e, 'legendary');
  assert.deepEqual(e.loot, {});
  // trade: the woods' markets sell heartwood, the werewolves' caravans thick pelts
  assert.ok(TRADE_DESTINATIONS.some((d) => d.loot.heartwood));
  assert.ok(FACTION_GOODS.werewolf?.includes('thick_pelt'));
});
