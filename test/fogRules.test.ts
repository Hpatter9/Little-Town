import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JOBS } from '../src/shared/data/people';
import { BUILDINGS } from '../src/shared/data/buildings';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { canPlace, UNEXPLORED } from '../src/shared/sim/buildings';
import { fogEdge, scoutTask } from '../src/shared/sim/explore';
import { founderExplore } from '../src/shared/sim/founder';
import { rectExplored, updateFog } from '../src/shared/sim/fog';
import { CELL } from '../src/shared/sim/land';
import { findSpot } from '../src/shared/sim/planner';
import { startRaid } from '../src/shared/sim/raids';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { campCell, makePerson, type GameState } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { clearAround, plainGame, put } from './helpers';

const NOON = 12 * 600;
const house = () => BUILDINGS.find((b) => b.housing && b.width <= 3)!;
const count = (t: string | undefined) => (t ?? '').split('1').length - 1;

/** A town with the fog started and the land opened wide and cleared round the camp. */
function foggy(seed: string): GameState {
  const s = plainGame(seed);
  clearAround(s, 40);
  s.land.open = 60;
  s.tick = NOON;
  updateFog(s);
  return s;
}

test('a building is only placed on explored land', () => {
  const s = foggy('fogrules-place');
  const c = campCell(s);
  const def = house();
  assert.ok(!rectExplored(s, c.x + 30, c.y, 2, 2), 'far land is dark');
  assert.equal(canPlace(s, def, c.x + 30, c.y).reason, UNEXPLORED);
  // a spot half in the fog is refused too
  const edge = fogEdge(s)[0];
  assert.ok(edge);
  assert.equal(canPlace(s, def, edge.x, edge.y).reason, rectExplored(s, edge.x, edge.y, def.width, 2) ? canPlace(s, def, edge.x, edge.y).reason : UNEXPLORED);
  assert.equal(canPlace(s, def, edge.x + 1, edge.y - 1).ok && !rectExplored(s, edge.x + 1, edge.y - 1, def.width, 2), false, 'never ok in the fog');
});

test('findSpot only picks explored cells, and says nothing fits when the light is small', () => {
  const s = foggy('fogrules-spot');
  const def = house();
  for (let k = 0; k < 30; k++) {
    const at = findSpot(s, def);
    if (!at) break;
    assert.ok(rectExplored(s, at.x, at.y, def.width, 2), `spot ${at.x},${at.y} lies on explored land`);
    put(s, def.id, at.x, at.y);
  }
  // only a patch the size of a hut is lit: nothing wider can go anywhere
  const n = s.land.w * s.land.h;
  const c = campCell(s);
  const dark = new Uint8Array(n).fill(48);
  for (let y = c.y - 1; y <= c.y + 1; y++) for (let x = c.x - 1; x <= c.x + 1; x++) dark[y * s.land.w + x] = 49;
  s.explored = new TextDecoder('latin1').decode(dark);
  s.buildings = [];
  const big = BUILDINGS.find((b) => b.width >= 5 && !b.never)!;
  assert.equal(findSpot(s, big), null);
});

test('old saves and towns with no fog yet build as before', () => {
  const s = plainGame('fogrules-old');
  clearAround(s, 40);
  s.explored = undefined;
  const c = campCell(s);
  assert.equal(canPlace(s, house(), c.x + 20, c.y + 6).reason === UNEXPLORED, false);
});

test('scouts, hunters and rangers with nothing to do walk to the fog edge; others do not unless the town needs room', () => {
  const s = foggy('fogrules-scout');
  s.autopilot = true;
  const p = s.people[0];
  const scout = makePerson(new Rng(5), s.nextId++, 'hunter', { x: p.x, y: p.y }, []);
  scout.cls = 'ranger';
  scout.needs = { food: 1, rest: 1 };
  s.people.push(scout);
  const t = scoutTask(s, scout);
  assert.ok(t && t.explore, 'a ranger goes exploring');
  const cell = { x: Math.floor(t!.targetX / CELL), y: Math.floor(t!.targetY / CELL) };
  assert.ok(fogEdge(s).some((e) => e.x === cell.x && e.y === cell.y), 'to a cell at the fog edge');
  const farmer = makePerson(new Rng(6), s.nextId++, 'gatherer', { x: p.x, y: p.y }, []);
  farmer.needs = { food: 1, rest: 1 };
  s.people.push(farmer);
  assert.equal(scoutTask(s, farmer), null, 'not a scout, no need');
  s.fogNeed = s.tick;
  assert.ok(scoutTask(s, farmer), 'but with no room found, anyone idle goes to look');
  s.autopilot = false;
  assert.equal(scoutTask(s, scout), null, 'only with the autopilot on');
});

test('an idle ranger on his own pushes the fog back over the days', () => {
  const s = foggy('fogrules-ranger');
  s.autopilot = true;
  const p = s.people[0];
  const scout = makePerson(new Rng(5), s.nextId++, 'hunter', { x: p.x, y: p.y }, []);
  scout.cls = 'ranger';
  scout.needs = { food: 1, rest: 1 };
  scout.priorities = Object.fromEntries(JOBS.map((j) => [j, 0])) as never;
  p.priorities = scout.priorities;
  s.people = [p, scout];
  const sim = new Sim(s);
  const before = count(s.explored);
  for (let i = 0; i < 5400; i++) sim.step(); // (a day and a half of idling, from noon)
  assert.ok(count(s.explored) > before + 200, `${count(s.explored)} cells explored, from ${before}`);
});

test('exploring pushes the fog back', () => {
  const s = foggy('fogrules-walk');
  s.autopilot = true;
  s.people = [s.people[0]];
  const f = s.people[0];
  const sim = new Sim(s);
  const before = count(s.explored);
  founderExplore(s, 2); // east
  let furthest = 0;
  for (let i = 0; i < 1800; i++) {
    sim.step();
    furthest = Math.max(furthest, f.x);
  }
  assert.ok(count(s.explored) > before + 150, 'the founder explored a good stretch');
  assert.ok(furthest > (campCell(s).x + 14) * CELL, 'out to the east');
  assert.equal(s.founderOrder, undefined, 'and the order ends when that way is seen, within the town\'s reach');
});

function raidSetup(seed: string): GameState {
  const s = foggy(seed);
  s.autopilot = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  return s;
}
const revealTick = (s: GameState): number => {
  const sim = new Sim(s);
  const t0 = s.tick;
  for (let i = 0; i < 4000 && s.raid && s.raid.veil; i++) sim.step();
  return s.tick - t0;
};

test('a raid is announced only once it is seen', () => {
  const s = raidSetup('fogrules-raid');
  const raid = startRaid(s, RAID_KIND_BY_ID.bandits, 20, new Rng(3), undefined, undefined, true);
  assert.ok(raid.veil, 'sets out unseen');
  assert.equal(raid.prompt, null);
  assert.equal(s.prompts.length, 0, 'no prompt yet');
  assert.equal(snapshot(s).raid, null, 'no raid card yet');
  const waited = revealTick(s);
  assert.ok(!raid.veil, 'it was seen in the end');
  assert.ok((raid.prompt as number | null) !== null && (s.prompts as unknown[]).length === 1, 'the prompt is raised once it is seen');
  assert.ok(snapshot(s).raid, 'and the raid card shows');
  assert.ok(waited > 0);
});

test('a watchtower or a gate sees a raid sooner', () => {
  const plain = raidSetup('fogrules-tower');
  const a = startRaid(plain, RAID_KIND_BY_ID.bandits, 20, new Rng(3), undefined, undefined, true);
  const edge = campCell(plain).x + (a.side > 0 ? 24 : -24);
  const tall = raidSetup('fogrules-tower');
  const b = startRaid(tall, RAID_KIND_BY_ID.bandits, 20, new Rng(3), undefined, undefined, true);
  put(tall, 'watchtower', edge, campCell(tall).y);
  assert.equal(Number(a.side), Number(b.side));
  const slow = revealTick(plain);
  const fast = revealTick(tall);
  assert.ok(fast < slow, `a tower at the edge raises the alarm sooner (${fast} < ${slow})`);
});

test('a raid that nobody sees still arrives, and an old save with no veil warns as before', () => {
  const s = raidSetup('fogrules-arrive');
  s.people = [];
  s.buildings = [];
  const raid = startRaid(s, RAID_KIND_BY_ID.bandits, 20, new Rng(3), undefined, undefined, true);
  const sim = new Sim(s);
  for (let i = 0; i < 4000 && s.raid === raid && raid.phase === 'warning'; i++) sim.step();
  assert.equal(raid.phase, 'active', 'unseen, it is simply here');
  const old = plainGame('fogrules-oldraid');
  const r = startRaid(old, RAID_KIND_BY_ID.bandits, 20, new Rng(3));
  assert.ok(!r.veil && r.prompt !== null, 'no fog rules for a plain town: the warning stands');
});
