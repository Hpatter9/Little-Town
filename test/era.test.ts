import assert from 'node:assert/strict';
import { test } from 'node:test';
import { raidKindsFor } from '../src/shared/sim/raids';
import type { Era } from '../src/shared/data/eras';
import { eraOfResearch, TOPICS } from '../src/shared/data/research';
import { ITEMS } from '../src/shared/data/items';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { craftSeconds } from '../src/shared/sim/crafting';
import { totalStock } from '../src/shared/sim/buildings';
import { startBattle, stepBattle } from '../src/shared/sim/combat';
import { canQueue, prereqsMet } from '../src/shared/sim/research';
import { onBuilt } from '../src/shared/sim/era';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, maxHp, type Building, type GameState, type Person, campCell } from '../src/shared/sim/state';
import { TICK_HZ, TICKS_PER_DAY } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame, priorities, row, campPx } from './helpers';

const runUntil = (sim: Sim, done: () => boolean, maxTicks: number) => {
  let t = 0;
  while (!done() && t < maxTicks) {
    sim.step();
    t++;
  }
  return t;
};
const camp = (s: GameState) => campCell(s).x;
const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire')!;
function addBuilding(s: GameState, def: string, tile: number, status: Building['status'] = 'done'): Building {
  const b: Building = { id: s.nextId++, def, tile, row: row(s), status, delivered: {}, progress: status === 'done' ? 1 : 0, store: {} };
  s.buildings.push(b);
  return b;
}
function veteran(s: GameState, gear: Person['gear']): Person {
  const p = makePerson(new Rng(s.nextId * 7), s.nextId++, 'hunter', campPx(s), s.people.map((q) => q.name));
  p.traits = ['tough'];
  p.hp = maxHp(p);
  p.needs = { food: 1, rest: 1 };
  p.skills.melee.level = 12;
  p.skills.ranged.level = 12;
  p.gear = gear;
  s.people.push(p);
  return p;
}

test('Medieval research stays closed until the Elder Lodge is finished, then the era turns', () => {
  const sim = new Sim(plainGame('era'));
  const s = sim.state;
  const r = s.research;
  assert.equal(canQueue(r, 'mining', s.era).ok, false);
  assert.match(canQueue(r, 'mining', s.era).reason!, /Medieval/);

  // a finished-but-for-the-work Elder Lodge
  const lodge = addBuilding(s, 'elder_lodge', camp(s) + 3, 'blueprint');
  lodge.delivered = { wood: 40, stone: 30, hide: 10, totem: 1 };
  s.people[0].priorities = priorities({ construct: 1 });
  runUntil(sim, () => lodge.status === 'done', 2 * TICKS_PER_DAY);
  assert.equal(s.era, 'medieval');
  assert.ok(s.notices.some((n) => n.text.includes('Medieval era')));
  assert.equal(canQueue(r, 'mining', s.era).ok, true);
  sim.command({ type: 'queueResearch', topic: 'mining' });
  sim.step();
  assert.deepEqual(r.queue, ['mining']);
});

test('finishing the Town Hall opens the Industrial era and its research', () => {
  const s = plainGame('industry');
  s.era = 'medieval';
  const hall = addBuilding(s, 'town_hall', camp(s) + 3);
  onBuilt(s, hall);
  assert.equal(s.era, 'industrial');
  assert.equal(canQueue(s.research, 'coal_mining', s.era).ok, true);
});

test("a capstone's topic count only counts its own era", () => {
  const s = plainGame('charter');
  s.era = 'medieval';
  s.research.done = TOPICS.filter((t) => !t.era).map((t) => t.id).concat(['writing', 'guilds']);
  const check = prereqsMet(s.research, 'town_charter', s.era);
  assert.equal(check.ok, false);
  assert.match(check.reason!, /\(0 so far\)/);
});

test('a gatherer with no marked land digs iron ore at the mine; the sawmill turns wood into lumber', () => {
  const sim = new Sim(plainGame('mine'));
  const s = sim.state;
  s.era = 'medieval';
  addBuilding(s, 'mine', camp(s) + 3);
  addBuilding(s, 'sawmill', camp(s) - 6);
  addBuilding(s, 'stockpile', camp(s) + 7);
  s.people[0].priorities = priorities({ gather: 1, craft: 2 });
  s.cheats.unlockAll = true;
  campfire(s).store = { wood: 6 };
  sim.command({ type: 'queueCraft', item: 'saw_lumber' });
  sim.command({ type: 'queueCraft', item: 'saw_lumber' });
  runUntil(sim, () => (totalStock(s).iron_ore ?? 0) >= 6, TICKS_PER_DAY);
  assert.ok((totalStock(s).iron_ore ?? 0) >= 6, 'ore dug and stored');
  // now let them craft
  s.people[0].priorities = priorities({ craft: 1 });
  runUntil(sim, () => (totalStock(s).lumber ?? 0) >= 4, TICKS_PER_DAY);
  assert.equal(totalStock(s).lumber, 4);
});

test('bows share out arrows and spend them', () => {
  const s = plainGame('bows');
  const a = veteran(s, { weapon: 'bow' });
  const b = veteran(s, { weapon: 'bow' });
  const rng = new Rng(3);
  const battle = startBattle([a, b], {}, { bandit: 2 }, rng, { arrows: 5 });
  const shooters = battle.fighters.filter((f) => f.side === 'party');
  assert.deepEqual(shooters.map((f) => f.ammo), [3, 2]);
  assert.ok(shooters.every((f) => f.ranged && f.ammoType === 'arrows'));
  for (let i = 0; i < 60 * TICK_HZ && !battle.outcome; i++) stepBattle(battle, rng, { retreatAt: 0.2, mainId: null });
  assert.ok(shooters.reduce((n, f) => n + f.ammoUsed, 0) > 0);
});

test('Medieval destinations: hidden before the era; a rescue brings people home; clearing the bandit camp stops raids', () => {
  const sim = new Sim(plainGame('rescue'));
  const s = sim.state;
  assert.equal(snapshotDest(s, 'lost_village'), false);
  s.era = 'medieval';
  assert.equal(snapshotDest(s, 'lost_village'), true);
  const hero = veteran(s, { weapon: 'iron_sword', body: 'chainmail', head: 'iron_helm', offhand: 'iron_shield' });
  campfire(s).store = { bread: 20 };
  const before = s.people.length;
  sim.command({ type: 'sendExpedition', dest: 'lost_village', members: [hero.id] });
  sim.step();
  runUntil(sim, () => sim.state.expeditions.length === 0 && s.tick > 10, 3 * TICKS_PER_DAY);
  assert.ok(s.people.length > before, `${s.people.length} people now`);

  // the bandit camp, with a strong party
  const party = [hero, veteran(s, { weapon: 'iron_sword', body: 'chainmail' }), veteran(s, { weapon: 'bow', body: 'leather_armor' })];
  for (const p of party) p.hp = maxHp(p);
  campfire(s).store = { bread: 30, arrows: 20 };
  s.nextRaidTick = s.tick + 1000;
  sim.command({ type: 'sendExpedition', dest: 'bandit_camp', members: party.map((p) => p.id), stance: 'bold' });
  sim.step();
  assert.equal(s.expeditions.length, 1, 'set out');
  runUntil(sim, () => sim.state.expeditions.length === 0 && s.tick > 10, 3 * TICKS_PER_DAY);
  const cleared = s.notices.some((n) => n.text.includes('roads are quiet'));
  if (cleared) assert.ok(s.nextRaidTick >= s.tick + 2 * TICKS_PER_DAY);
  else assert.ok(s.notices.some((n) => /fell back|overrun/.test(n.text)), `either cleared or driven off:\n${s.journal.slice(-12).map((n) => n.text).join('\n')}`);
});

test('raid kinds follow the era: rival scouts, then bandits, then gangs and armies, then mechanized forces', () => {
  const kinds = (era: Era) => raidKindsFor(era, 20).map((k) => k.id);
  assert.ok(!kinds('medieval').includes('rivals'));
  assert.ok(kinds('medieval').includes('bandits'));
  assert.ok(!kinds('neolithic').includes('bandits'));
  assert.ok(kinds('industrial').includes('gang') && kinds('industrial').includes('bandits'));
  assert.ok(!kinds('modern').includes('bandits') && !kinds('modern').includes('warband'));
  assert.ok(kinds('modern').includes('mechanized') && kinds('modern').includes('marauders'));
  assert.ok(!kinds('medieval').includes('mechanized'));
});

import { snapshot } from '../src/shared/sim/snapshot';
import { DESTINATION_BY_ID } from '../src/shared/data/expeditions';
import { eraReached } from '../src/shared/data/eras';
function snapshotDest(s: GameState, id: string): boolean {
  return snapshot(s).destinations.some((d) => d.id === id) && eraReached(s.era, DESTINATION_BY_ID[id].era);
}

test('work is stretched by the era of what is made, not the era the town is in', () => {
  const old = ITEMS.find((i) => !i.fare && !i.makes && eraOfResearch(i.research) === 'neolithic')!;
  const newer = ITEMS.find((i) => !i.fare && !i.makes && eraOfResearch(i.research) === 'medieval')!;
  assert.equal(craftSeconds(old, 'medieval'), craftSeconds(old, 'neolithic'), `${old.id} takes no longer in the Medieval era`);
  assert.ok(craftSeconds(newer, 'medieval') > newer.seconds, `${newer.id} is Medieval work`);
  assert.equal(eraOfResearch(BUILDING_BY_ID.lean_to.research), 'neolithic');
  assert.equal(eraOfResearch(BUILDING_BY_ID.town_hall.research), 'medieval');
});
