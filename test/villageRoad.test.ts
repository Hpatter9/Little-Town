import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { Rng } from '../src/shared/rng';
import { footprint } from '../src/shared/sim/buildings';
import { buildable, inRect, CELL, cellAt, groundAt, isPlannedRoad, isRoad, planRoad, wet } from '../src/shared/sim/land';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { thinRock } from '../src/shared/sim/tunnels';
import { streetWork } from '../src/shared/sim/streets';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { roadShare, villageRoadHourly } from '../src/shared/sim/villageRoad';
import { foundVillage, villageSpot, type Village } from '../src/shared/sim/villages';
import { VILLAGE_ROAD_HOUR } from '../src/shared/data/villages';
import { snapshot } from '../src/shared/sim/snapshot';
import { walk } from '../src/shared/sim/walk';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { PLAN_TICKS, runPlanner } from '../src/shared/sim/planner';
import { ringWallCells } from '../src/shared/sim/ringWall';
import { newGame, type Building } from '../src/shared/sim/state';
import { planVillageRoad } from '../src/shared/sim/villageRoad';
import { clearAround, plainGame } from './helpers';

const dayAt = (day: number) => (day - 1) * TICKS_PER_DAY + ((VILLAGE_ROAD_HOUR - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function townWithVillage(seed: string): { s: GameState; v: Village } {
  const s = plainGame(seed);
  const rng = new Rng(9);
  const c = s.people[0];
  while (s.people.length < 11) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 4, y: c.y }, s.people.map((p) => p.name)));
  s.autopilot = true;
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 60, stone: 20, berries: 30 };
  const at = villageSpot(s, new Rng(4))!;
  const ids = s.people.slice(1, 6).map((p) => p.id);
  const v = foundVillage(s, { ids, leader: ids[0], x: at.x, y: at.y, name: 'Testford' }, 70)!;
  return { s, v };
}

/** Days of the village's laying (and, with `town`, the town's pavers beside them) until the road is open. */
function build(s: GameState, v: Village, town: boolean, days = 60): number {
  for (let d = 1; d <= days; d++) {
    s.tick = dayAt(d);
    if (town) streetWork(s, 60);
    villageRoadHourly(s);
    if (v.road?.done !== undefined) return d;
  }
  return -1;
}

/** Ticks a walker takes to go from the village to the town's fire. */
function trip(s: GameState, v: Village): number {
  const w = { x: (v.x + 0.5) * CELL, y: (v.y + 2.5) * CELL, dir: 1 as const };
  const camp = s.land.camp;
  for (let t = 1; t < 6000; t++) if (walk(s, w, { x: (camp.x + 0.5) * CELL, y: (camp.y + 1.5) * CELL }, 4.8, undefined, t)) return t;
  return 6000;
}

test('a village is founded with a road planned to the town', () => {
  const { s, v } = townWithVillage('vroad-plan');
  assert.ok(v.road && v.road.cells.length > 10, 'the road is planned');
  assert.equal(v.road!.cells[0], v.y + 2 === 0 ? 0 : (v.y + 2) * s.land.w + v.x, 'from the village');
  const share = roadShare(s, v)!;
  assert.ok(share >= 0 && share < 1);
  assert.ok(s.journal.some((j) => j.text.includes('road to the town')), 'the journal tells it');
  assert.equal(snapshot(s).villages[0].road, Math.round(share * 100), 'the view tells how far it is');
});

test('the road keeps off rock and water but for bridges', () => {
  const { s, v } = townWithVillage('vroad-ground');
  const thin = thinRock(s);
  for (const i of v.road!.cells) {
    const c = cellAt(s.land, i);
    const g = groundAt(s.land, c.x, c.y);
    assert.ok(buildable(g) || wet(g) || g === 'mountain', `cell ${c.x},${c.y} on ${g}`);
    if (g === 'mountain') assert.ok(thin?.(c.x, c.y), `rock at ${c.x},${c.y} is no tunnel`);
  }
});

test('it is built from both ends and open when they meet', () => {
  const a = townWithVillage('vroad-both');
  const days = build(a.s, a.v, true);
  assert.ok(days > 0, 'finished');
  assert.ok(a.v.road!.cells.every((i) => isRoad(a.s.land, i % a.s.land.w, Math.floor(i / a.s.land.w))));
  assert.equal(roadShare(a.s, a.v), 1);
  assert.ok(a.s.journal.some((j) => j.text === 'The road to Testford is open.'));
  // the village alone lays its own end, and the town's hands make it quicker
  const b = townWithVillage('vroad-both');
  const alone = build(b.s, b.v, false);
  assert.ok(alone > 0, 'the village alone gets there');
  assert.ok(days <= alone, `${days} days with the town, ${alone} alone`);
});

test('a walker takes the road and gets there sooner', () => {
  const { s, v } = townWithVillage('vroad-walk');
  const before = trip(s, v);
  assert.ok(build(s, v, true) > 0);
  const after = trip(s, v);
  assert.ok(after < before, `${after} ticks after, ${before} before`);
});

test('a village from an older save gets a road planned on load', () => {
  const { s, v } = townWithVillage('vroad-old');
  for (const i of v.road!.cells) {
    const c = cellAt(s.land, i);
    if (isPlannedRoad(s.land, c.x, c.y)) planRoad(s.land, c.x, c.y, false);
  }
  delete v.road;
  s.tick = dayAt(5);
  villageRoadHourly(s);
  assert.ok((v as Village).road && (v as Village).road!.cells.length > 10, 'planned again');
  assert.ok(s.notices.some((n) => n.text.includes('sets about a road')));
});

/** Take a village's road away again, planned cells and all, as if it had never been planned. */
function unplan(s: GameState, v: Village): void {
  for (const i of v.road!.cells) {
    const c = cellAt(s.land, i);
    if (isPlannedRoad(s.land, c.x, c.y)) planRoad(s.land, c.x, c.y, false);
  }
  delete v.road;
}

/** The ground between a village and the town, wood all across the map (cleared ground has no way). */
function woodAround(s: GameState, v: Village): void {
  const m = s.land;
  const c = m.camp;
  const lo = Math.min(c.y, v.y);
  const hi = Math.max(c.y, v.y);
  const wild = (x: number, y: number) => {
    const d = Math.hypot(x - c.x, y - c.y);
    return d > 12 && Math.hypot(x - v.x, y - v.y) > 5;
  };
  for (let y = Math.max(0, lo - 30); y < Math.min(m.h, hi + 30); y++) for (let x = Math.max(0, Math.min(c.x, v.x) - 30); x < Math.min(m.w, Math.max(c.x, v.x) + 30); x++) if (wild(x, y) && buildable(groundAt(m, x, y)) && !s.buildings.some((b) => b.tile === x && b.row === y)) m.cells = m.cells.slice(0, y * m.w + x) + 'f' + m.cells.slice(y * m.w + x + 1);
  m.version++;
}

test('a village walled off by wild ground gets a road cut through it, cleared as it is laid', () => {
  const { s, v } = townWithVillage('vroad-wild');
  unplan(s, v);
  woodAround(s, v);
  const wood = (i: number) => groundAt(s.land, i % s.land.w, Math.floor(i / s.land.w)) === 'forest';
  const before = s.land.cells.split('').filter((c) => c === 'f').length;
  assert.ok(planVillageRoad(s, v), 'a way is found');
  assert.ok(s.land.cells.split('').filter((c) => c === 'f').length < before, 'it runs through the wood, which is cleared');
  assert.ok(v.road!.cells.every((i) => !wood(i)), 'no wood is left under the road');
  assert.ok(build(s, v, true) > 0, 'and it is laid');
});

test('a village behind a row of buildings gets a road round it to the town', () => {
  const { s, v } = townWithVillage('vroad-row');
  unplan(s, v);
  woodAround(s, v);
  const c = s.land.camp;
  // (a solid row of houses across the village's side of the town)
  const row = c.y + (v.y < c.y ? -8 : 8);
  for (let x = c.x - 14; x <= c.x + 14; x += 2) s.buildings.push({ ...s.buildings.find((b) => b.def === 'campfire')!, id: s.nextId++, def: 'lean_to', tile: x, row, status: 'done' } as Building);
  assert.ok(planVillageRoad(s, v), 'a way round is found');
  assert.ok(v.road!.cells.length > 10);
  const on = (x: number, y: number) => s.buildings.some((b) => b.def === 'lean_to' && inRect(footprint(b), x, y));
  assert.ok(v.road!.cells.every((i) => !on(i % s.land.w, Math.floor(i / s.land.w))), 'none of the road is over a house');
});

test('a village outside the ring wall gets a road that ends at a gate', () => {
  const s = newGame('vroad-ring');
  s.research.done.push('palisades', 'basic_shelter');
  clearAround(s, 50);
  s.buildings[0].store = { wood: 3000, stone: 500, fiber: 300, berries: 400 };
  const rng = new Rng(9);
  while (s.people.length < 12) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: s.people[0].x + s.people.length, y: s.people[0].y }, s.people.map((p) => p.name)));
  for (let n = 0; n < 400 && !s.ring?.done; n++) {
    s.tick += PLAN_TICKS;
    runPlanner(s);
    for (const b of s.buildings) if (b.status === 'blueprint' && !b.planned) { b.status = 'done'; b.progress = 1; b.hp = BUILDING_BY_ID[b.def].hp; }
  }
  assert.ok(s.ring?.done, 'the ring stands');
  const at = villageSpot(s, new Rng(4))!;
  const ids = s.people.slice(1, 6).map((p) => p.id);
  const v = foundVillage(s, { ids, leader: ids[0], x: at.x, y: at.y, name: 'Outford' }, 70)!;
  unplan(s, v);
  s.autopilot = true;
  assert.ok(planVillageRoad(s, v), 'a way is found');
  const wall = ringWallCells(s);
  assert.ok(v.road!.cells.every((i) => !wall.has(i)), 'the road never runs over the wall');
  const r = s.ring!.rect;
  const inside = (i: number) => { const x = i % s.land.w; const y = Math.floor(i / s.land.w); return x > r.x && x < r.x + r.w - 1 && y > r.y && y < r.y + r.h - 1; };
  assert.ok(v.road!.cells.some(inside), 'it goes in, by a gate');
});

test('a village with no way to the town says so once and does not try again until the land changes', () => {
  const { s, v } = townWithVillage('vroad-none');
  unplan(s, v);
  // (the village shut in by a wall of rock all about)
  const m = s.land;
  for (let y = v.y - 20; y <= v.y + 24; y++) for (let x = v.x - 22; x <= v.x + 22; x++) {
    const edge = Math.max(Math.abs(x - v.x), Math.abs(y - (v.y + 2))) === 20;
    if (edge && x >= 0 && y >= 0 && x < m.w && y < m.h) m.cells = m.cells.slice(0, y * m.w + x) + 'M' + m.cells.slice(y * m.w + x + 1);
  }
  m.version++;
  s.tick = dayAt(1);
  villageRoadHourly(s);
  assert.ok(v.road?.failed !== undefined, 'no way');
  const lines = () => s.notices.filter((n) => n.text.includes('No way could be found')).length;
  assert.equal(lines(), 1, 'told once');
  const sig = v.road!.sig;
  for (let d = 2; d < 40; d++) {
    s.tick = dayAt(d);
    villageRoadHourly(s);
  }
  assert.equal(lines(), 1, 'still told once');
  assert.equal(v.road!.failed, dayAt(1), 'not tried again');
  assert.equal(v.road!.sig, sig);
  // (a building pulled down: the land has changed, and it tries again)
  s.buildings.pop();
  s.tick = dayAt(41);
  villageRoadHourly(s);
  assert.equal(v.road!.failed, dayAt(41), 'tried again');
  assert.equal(lines(), 1, 'and not told again');
});
