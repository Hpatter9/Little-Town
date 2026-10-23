import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { EVENTS } from '../src/shared/data/events';
import { CREATURE_SAGA, CREATURE_TOPIC } from '../src/shared/data/creature';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { parseCommand } from '../src/shared/sim/commands';
import { DEV_CAUSE } from '../src/shared/sim/dev';
import type { DevOrder } from '../src/shared/sim/devOrders';
import { levelOf } from '../src/shared/data/levels';
import { startRaid } from '../src/shared/sim/raids';
import { keepOffer } from '../src/shared/sim/researchOffer';
import { Sim } from '../src/shared/sim/sim';
import { totalStock } from '../src/shared/sim/buildings';
import { campXY, makePerson, maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { freeSpot, plainGame, put } from './helpers';

/** A grown-up joins the town. */
function addFolk(s: GameState): Person {
  const id = s.nextId++;
  const p = makePerson(new Rng(id), id, 'hunter', campXY(s), s.people.map((q) => q.name));
  s.people.push(p);
  return p;
}

/** A plain town with developer mode turned on through its command, and a sim to send it orders. */
function devTown(seed: string): { s: GameState; sim: Sim; order: (o: DevOrder) => void } {
  const s = plainGame(seed);
  const sim = new Sim(s);
  sim.command({ type: 'devMode', on: true });
  sim.step();
  const order = (o: DevOrder) => {
    sim.command({ type: 'dev', order: o });
    sim.step();
  };
  return { s, sim, order };
}

test('dev orders are refused while the town has developer mode off', () => {
  const s = plainGame('dev-off');
  const sim = new Sim(s);
  const coins = s.coins ?? 0;
  sim.command({ type: 'dev', order: { op: 'fill', amount: 500 } });
  sim.step();
  assert.equal(s.coins ?? 0, coins, 'nothing given');
  assert.equal(s.dev, undefined);
  sim.command({ type: 'devMode', on: true });
  sim.command({ type: 'dev', order: { op: 'fill', amount: 500 } });
  sim.step();
  assert.equal(s.dev, true);
  assert.equal(s.devSave, true, 'tagged a dev save');
  assert.equal(s.coins, coins + 500, 'taken once it is on');
  sim.command({ type: 'devMode', on: false });
  sim.command({ type: 'dev', order: { op: 'fill', amount: 500 } });
  sim.step();
  assert.equal(s.coins, coins + 500, 'refused again once off');
  assert.equal(s.devSave, true, 'a dev save for good');
});

test('an ironman town never takes developer mode', () => {
  const s = plainGame('dev-iron');
  s.ironman = true;
  const sim = new Sim(s);
  sim.command({ type: 'devMode', on: true });
  sim.step();
  assert.ok(!s.dev);
  assert.ok(!s.devSave);
});

test('dev orders are checked as they come over IPC', () => {
  assert.deepEqual(parseCommand({ type: 'dev', order: { op: 'skip', hours: 6 } }), { type: 'dev', order: { op: 'skip', hours: 6 } });
  assert.equal(parseCommand({ type: 'dev', order: { op: 'skip', hours: 0 } }), null);
  assert.equal(parseCommand({ type: 'dev', order: { op: 'skip', hours: 100000 } }), null);
  assert.equal(parseCommand({ type: 'dev', order: { op: 'kill', target: 'ghost', id: 1 } }), null);
  assert.equal(parseCommand({ type: 'dev', order: { op: 'nope' } }), null);
  assert.equal(parseCommand({ type: 'dev' }), null);
  assert.deepEqual(parseCommand({ type: 'devMode', on: true }), { type: 'devMode', on: true });
});

test('finish builds: every blueprint is done at once', () => {
  const { s, order } = devTown('dev-build');
  const at = freeSpot(s, 'stockpile');
  const b = put(s, 'stockpile', at.x, at.y, { status: 'blueprint', progress: 0 });
  order({ op: 'finishBuilds' });
  assert.equal(b.status, 'done');
  assert.equal(b.progress, 1);
  assert.ok(b.builtAt !== undefined && b.builtAt <= s.tick);
});

test('instant building: a new order is built the moment it is placed', () => {
  const { s, sim, order } = devTown('dev-instant');
  order({ op: 'instantBuild', on: true });
  assert.equal(s.devBuild, true);
  const at = freeSpot(s, 'stockpile');
  const before = s.buildings.length;
  sim.command({ type: 'placeBuilding', def: 'stockpile', x: at.x, y: at.y });
  sim.step();
  const b = s.buildings.slice(before).find((q) => q.def === 'stockpile');
  assert.ok(b, 'placed');
  assert.equal(b.status, 'done', 'and built at once');
  order({ op: 'instantBuild', on: false });
  assert.equal(s.devBuild, undefined);
});

test('finish research: the topic on offer is learned, and a new offer drawn', () => {
  const { s, order } = devTown('dev-research');
  keepOffer(s);
  const first = s.research.offer?.[0];
  assert.ok(first, 'something on offer');
  order({ op: 'finishResearch' });
  assert.ok(s.research.done.includes(first));
  assert.ok(!s.research.queue.includes(first));
});

test('harvest: every field with a crop in is reaped into the stores', () => {
  const { s, order } = devTown('dev-harvest');
  const at = freeSpot(s, 'garden_plot');
  const field = put(s, 'garden_plot', at.x, at.y, { crop: { stage: 'growing', growth: 0.3, work: 0 } });
  const grain = totalStock(s).grain ?? 0;
  order({ op: 'harvest' });
  assert.equal(field.crop!.stage, 'fallow');
  assert.ok((totalStock(s).grain ?? 0) > grain, 'grain in store');
});

test('fill: food, wood, stone and coins by the amount asked', () => {
  const { s, order } = devTown('dev-fill');
  const was = totalStock(s);
  const coins = s.coins ?? 0;
  order({ op: 'fill', amount: 250 });
  const now = totalStock(s);
  for (const m of ['grain', 'wood', 'stone'] as const) assert.equal((now[m] ?? 0) - (was[m] ?? 0), 250, m);
  assert.equal(s.coins, coins + 250);
});

test('kill: a townsperson dies, through the town\'s own death', () => {
  const { s, order } = devTown('dev-kill');
  const p = addFolk(s);
  order({ op: 'kill', target: 'person', id: p.id });
  assert.ok(!s.people.includes(p));
  assert.ok(s.fallen?.some((f) => f.id === p.id && f.cause === DEV_CAUSE), 'among the fallen');
});

test('kill the founder: the heir takes the town over', () => {
  const { s, order } = devTown('dev-heir');
  const heir = addFolk(s);
  s.heirId = heir.id;
  const founder = s.mainId;
  order({ op: 'kill', target: 'person', id: founder });
  assert.equal(s.mainId, heir.id);
  assert.ok(!s.gameOver);
});

test('raiders: one struck down, then all; a raid spawned; the fight won', () => {
  const { s, order } = devTown('dev-raid');
  startRaid(s, RAID_KIND_BY_ID.wolves, 40, new Rng(1));
  const foes = s.raid!.raiders.filter((rd) => !rd.ally);
  assert.ok(foes.length >= 2);
  order({ op: 'kill', target: 'raider', id: foes[0].id });
  assert.ok(foes[0].down);
  assert.ok(!foes[1].down);
  order({ op: 'killRaiders' });
  assert.ok(foes.every((rd) => rd.down));
  s.raid = null;
  order({ op: 'raid', kind: null });
  const raid = s.raid as GameState['raid'];
  assert.ok(raid, 'a raid set out');
  order({ op: 'winFight' });
  assert.ok(raid.raiders.every((rd) => rd.ally || rd.down || rd.gone));
});

test('a named raid kind is the one that comes', () => {
  const { s, order } = devTown('dev-raid-kind');
  order({ op: 'raid', kind: 'boars' });
  assert.equal(s.raid?.kind, 'boars');
});

test('down and heal: knocked down, then whole again', () => {
  const { s, order } = devTown('dev-heal');
  const p = addFolk(s);
  order({ op: 'down', id: p.id });
  assert.ok(p.downed);
  order({ op: 'heal', id: null });
  assert.equal(p.downed, null);
  assert.equal(p.hp, maxHp(p));
  assert.ok(p.needs.food > 0.99, 'fed (less the tick since)');
});

test('skip: the fast-forward runs to its tick and stops', () => {
  const { s, sim, order } = devTown('dev-skip');
  order({ op: 'skip', hours: 1 });
  const to = s.devSkipTo!;
  assert.ok(to > s.tick);
  for (let i = 0; i < 2 * TICKS_PER_HOUR && s.devSkipTo !== undefined; i++) sim.step();
  assert.equal(s.devSkipTo, undefined);
  assert.ok(s.tick >= to);
  order({ op: 'skip', hours: 5 });
  order({ op: 'stopSkip' });
  assert.equal(s.devSkipTo, undefined);
});

test('an event is put to the town on demand', () => {
  const { s, order } = devTown('dev-event');
  const def = EVENTS[0];
  order({ op: 'event', id: def.id });
  assert.equal(s.event?.def, def.id);
  assert.ok(s.prompts.some((p) => p.id === s.event!.prompt));
});

test('level up: the founder by default, by as many levels as asked', () => {
  const { s, order } = devTown('dev-level');
  const f = s.people.find((p) => p.id === s.mainId)!;
  const from = levelOf(f);
  order({ op: 'levelUp', id: null, levels: 3 });
  assert.equal(levelOf(f), from + 3);
});

test('the God creature saga begins on demand, its study learned', () => {
  const { s, order } = devTown('dev-creature');
  order({ op: 'creatureSaga' });
  assert.ok(s.research.done.includes(CREATURE_TOPIC));
  assert.ok((s.sagas ?? []).some((r) => r.id === CREATURE_SAGA) || s.notices.some((n) => n.text.includes('cast')));
});

test('reveal: the whole land is seen', () => {
  const { s, order } = devTown('dev-reveal');
  order({ op: 'reveal' });
  assert.ok(s.explored && !s.explored.includes('0'));
});

test('a dev order draws nothing from the town\'s own stream', () => {
  const { s, order } = devTown('dev-rng');
  const rng = s.rngState;
  s.paused = true; // (only the order: no tick of the town's own)
  order({ op: 'raid', kind: null });
  assert.ok(s.raid);
  assert.equal(s.rngState, rng);
});

test('the game loop runs a fast-forward flat out, a frame at a time, and stops at its tick', async () => {
  const { GameLoop } = await import('../src/shared/gameLoop');
  const { s } = devTown('dev-loop');
  s.devSkipTo = s.tick + 2 * TICKS_PER_HOUR;
  const loop = new GameLoop(s, () => {});
  const pump = () => (loop as unknown as { pump(): void }).pump();
  for (let i = 0; i < 400 && loop.state.devSkipTo !== undefined; i++) pump();
  assert.equal(loop.state.devSkipTo, undefined, 'the run is over');
  assert.ok(loop.state.tick >= 2 * TICKS_PER_HOUR);
});
