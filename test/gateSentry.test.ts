import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gatePost, gateTop } from '../src/shared/sim/people';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { type Building, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { wantsSleep } from '../src/shared/sim/townsfolk';
import { campCell } from '../src/shared/sim/state';
import { clearAround, plainGame } from './helpers';

/** A town with a palisade standing all round and a gate on each side (laid by hand, as the ring would be). */
function walled(seed: string): { s: GameState; gates: Building[] } {
  const s = plainGame(seed);
  clearAround(s, 12);
  const c = campCell(s);
  const L = c.x - 6, R = c.x + 6, T = c.y - 5, B = c.y + 5;
  const add = (def: string, x: number, y: number, extra: Partial<Building> = {}) => {
    const b: Building = { id: s.nextId++, def, tile: x, row: y, status: 'done', delivered: {}, progress: 1, store: {}, hp: 150, ring: 1, ...extra };
    s.buildings.push(b);
    return b;
  };
  for (let x = L; x <= R; x++) for (const y of [T, B]) if (x !== c.x && x !== c.x + 1) add('palisade_wall', x, y);
  for (let y = T + 1; y < B; y++) for (const x of [L, R]) if (y !== c.y && y !== c.y + 1) add('palisade_wall', x, y);
  const gates = [add('palisade_gate', c.x, T), add('palisade_gate', c.x, B), add('palisade_gate', L, c.y, { turned: true }), add('palisade_gate', R, c.y, { turned: true })];
  s.ring = { gen: 1, rect: { x: L, y: T, w: R - L + 1, h: B - T + 1 }, wall: 'palisade_wall', gate: 'palisade_gate', gates: [], done: true, doneAt: 0 };
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  return { s, gates };
}

/** A hired guard on the night watch (an odd id keeps it: people.ts `onShift`). */
function guard(s: GameState, id: number): Person {
  const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id, name: `Guard ${id}`, guard: true, partner: null, task: null };
  for (const k of Object.keys(p.priorities) as (keyof Person['priorities'])[]) p.priorities[k] = 3;
  p.priorities.defend = 1;
  p.skills.melee.level = 8;
  p.needs = { food: 1, rest: 1 };
  s.people.push(p);
  return p;
}

/** The tick at an hour of the third day (the day starts at 7: sim/time.ts). */
const at = (hour: number) => 2 * TICKS_PER_DAY + (((hour - 7 + 24) % 24) * TICKS_PER_HOUR);

test('by night a guard climbs a gate and stands sentry on top of it; by day nobody does (the owner: steps up the gate)', () => {
  const { s, gates } = walled('gate-sentry');
  const a = guard(s, 1001);
  const b = guard(s, 1003);
  // (two on watch: the first stands on a gate, the second walks the wall)
  s.tick = at(22);
  assert.equal(gatePost(s, a)?.id, gates[0].id);
  assert.equal(gatePost(s, b), null);
  // up the steps and standing there, and the map lifts them onto the beam
  const sim = new Sim(s);
  for (let i = 0; i < TICKS_PER_HOUR && !(a.task?.type === 'patrol' && Math.hypot(a.x - gateTop(gates[0]).x, a.y - gateTop(gates[0]).y) < 6); i++) sim.step();
  assert.equal(a.task?.type, 'patrol');
  assert.ok(Math.hypot(a.x - gateTop(gates[0]).x, a.y - gateTop(gates[0]).y) < 6, 'standing over the gate');
  const view = snapshot(s).people.find((p) => p.id === a.id)!;
  assert.equal(view.onGate, 'h');
  // (a while on, still there: a sentry keeps to the gate)
  for (let i = 0; i < 200; i++) sim.step();
  assert.ok(Math.hypot(a.x - gateTop(gates[0]).x, a.y - gateTop(gates[0]).y) < 6);
  // by day the watch walks the streets
  s.tick = at(11);
  assert.equal(gatePost(s, a), null);
  // a lone guard climbs up every other hour, a different gate each time
  s.people = s.people.filter((p) => p !== b);
  const ups = [21, 22, 23, 0, 1, 2, 3, 4].map((h) => ((s.tick = at(h)), gatePost(s, a)?.id ?? null));
  assert.ok(ups.some((g) => g === null) && new Set(ups.filter((g) => g !== null)).size > 1, `on and off, and round the gates: ${ups}`);
});

test('a guard on the night watch sleeps by day once the wall stands, so they are up for it; never the founder', () => {
  const { s } = walled('night-watch-sleep');
  const g = guard(s, 1005);
  const other = s.people[0];
  g.needs.rest = other.needs.rest = 0.7;
  s.tick = at(23);
  assert.ok(wantsSleep(s, other), 'everyone else goes to bed at night');
  assert.ok(!wantsSleep(s, g), 'the night watch stays up');
  s.tick = at(11);
  assert.ok(wantsSleep(s, g), 'and sleeps by day');
  assert.ok(!wantsSleep(s, other));
  // (the founder taken on as a guard keeps the town's hours, and so does a guard with no wall to watch yet)
  other.guard = true;
  s.tick = at(23);
  assert.ok(wantsSleep(s, other), 'the founder sleeps at night');
  s.ring = undefined;
  assert.ok(wantsSleep(s, g), 'no wall: the guard sleeps at night like everyone');
});
