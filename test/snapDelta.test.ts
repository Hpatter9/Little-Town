import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { SnapAssembler, SnapDiffer, POOLS_EVERY } from '../src/shared/snapDelta';
import { startSimHost, type FromHost } from '../src/shared/simHost';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { serialize } from '../src/shared/sim/save';
import { newGame } from '../src/shared/sim/state';
import { findPath } from '../src/shared/sim/land';

/** JSON with every object's keys in order, so two snapshots built in different orders compare alike. */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));

test('a snapshot put back together from deltas is the snapshot itself', () => {
  const s = newGame('delta-1', { scenario: 'tribe' });
  const sim = new Sim(s);
  const differ = new SnapDiffer();
  const page = new SnapAssembler();
  let small = 0;
  for (let i = 1; i <= 800; i++) {
    sim.step();
    const snap = snapshot(s);
    const d = structuredClone(differ.diff(snap)); // (as postMessage copies it)
    if (i > 1 && JSON.stringify(d).length < JSON.stringify(snap).length / 10) small++;
    const got = page.apply(d);
    const { land: a, ...restA } = got;
    const { land: b, ...restB } = snap;
    assert.equal(canon(restA), canon(restB), `tick ${i}`);
    // (the land's pools and footpaths are looked over every POOLS_EVERY deltas)
    if (i % POOLS_EVERY === 0) assert.equal(canon(a), canon(b), `land, tick ${i}`);
  }
  assert.ok(small > 750, `most deltas are small (${small})`);
});

test('an unchanged part keeps the very same object on the page', () => {
  const s = newGame('delta-2');
  const sim = new Sim(s);
  const differ = new SnapDiffer();
  const page = new SnapAssembler();
  sim.step();
  const first = page.apply(structuredClone(differ.diff(snapshot(s))));
  sim.step();
  const second = page.apply(structuredClone(differ.diff(snapshot(s))));
  assert.equal(second.land, first.land);
  assert.equal(second.origin, first.origin);
  assert.equal(second.buildings.find((b) => b.def === 'campfire'), first.buildings.find((b) => b.def === 'campfire'));
});

test('the game host starts a town, answers, and saves', async () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const out: FromHost[] = [];
    const host = startSimHost((m) => out.push(m));
    const town = newGame('host-1');
    host({ t: 'init', save: serialize(town, Date.now()), now: Date.now(), hidden: false, alerts: { enabled: false } as never });
    const started = out.find((m) => m.t === 'started');
    assert.deepEqual(started, { t: 'started', fresh: false, unreadable: false });
    assert.ok(out.some((m) => m.t === 'snap'));
    mock.timers.tick(500); // (the moment away caught up)
    host({ t: 'save', id: 7 });
    const reply = out.find((m) => m.t === 'reply' && m.id === 7) as Extract<FromHost, { t: 'reply' }>;
    assert.equal(typeof reply.value, 'string');
    assert.ok((reply.value as string).includes('"seed":"host-1"'));
    // hidden, it saves at once and sends no snapshots
    const before = out.length;
    host({ t: 'hidden', on: true });
    assert.ok(out.slice(before).some((m) => m.t === 'save'));
    host({ t: 'step', n: 5 });
    assert.ok(!out.slice(before).some((m) => m.t === 'snap'));
    // an unreadable save starts afresh, and says so
    const out2: FromHost[] = [];
    startSimHost((m) => out2.push(m))({ t: 'init', save: '{nope', now: Date.now(), hidden: false, alerts: { enabled: false } as never });
    assert.deepEqual(out2.find((m) => m.t === 'started'), { t: 'started', fresh: true, unreadable: true });
  } finally {
    mock.timers.reset();
  }
});

test('the path search gives the same way again, and a nested search its own', () => {
  const s = newGame('paths-1');
  const m = s.land;
  const from = { x: m.camp.x - 20, y: m.camp.y - 15 };
  const to = { x: m.camp.x + 22, y: m.camp.y + 18 };
  const a = findPath(m, from, to);
  const b = findPath(m, from, to);
  assert.deepEqual(a, b);
  // (a search asked for from inside another's callback doesn't spoil the outer one)
  let inner: unknown = undefined;
  const c = findPath(m, from, to, (x, y) => {
    if (inner === undefined) inner = findPath(m, { x: m.camp.x, y: m.camp.y }, { x: m.camp.x + 3, y: m.camp.y + 3 });
    return x === -1 && y === -1;
  });
  assert.deepEqual(c, a);
  assert.ok(Array.isArray(inner));
});
