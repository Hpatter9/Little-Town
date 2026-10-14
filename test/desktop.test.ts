// The desktop app brought up to the phone: its legends kept in a file under its own folder, its game run in a thread
// of its own (the same host as the phone's worker) with the snapshots handed on as what changed, and the windows
// putting them back together.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mock, test } from 'node:test';
import { keepLegendFile, legendById, readLegendsFile, LEGENDS_MOST } from '../src/main/legends';
import { SimClient, type SimPort } from '../src/main/simClient';
import { startSimHost, type FromHost, type ToHost } from '../src/shared/simHost';
import { withDeltas } from '../src/renderer/deltaBridge';
import { parseSave, serialize } from '../src/shared/sim/save';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { SnapDiffer } from '../src/shared/snapDelta';
import { snapshot } from '../src/shared/sim/snapshot';
import { Sim } from '../src/shared/sim/sim';
import type { Legend } from '../src/shared/sim/legacy';
import type { Bridge, SnapMessage } from '../src/shared/ipc';
import type { Snapshot } from '../src/shared/sim/snapshot';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'legends-'));
const legend = (id: string): Legend => ({ id, founder: 'Hild', origin: 'settlers', era: 'neolithic', days: 9, people: 6, dead: 2, fate: 'retired', heroes: [], renown: 30, generation: 1, ended: 5 });

test('the desktop keeps its legends in a file of its own, the newest kept, and finds an heir by id', () => {
  const dir = tmp();
  assert.deepEqual(readLegendsFile(dir), [], 'none yet');
  keepLegendFile(dir, legend('a'));
  keepLegendFile(dir, legend('b'));
  keepLegendFile(dir, legend('a')); // (kept again: once, at the end)
  assert.deepEqual(readLegendsFile(dir).map((l) => l.id), ['b', 'a']);
  assert.equal(legendById(dir, 'b')?.id, 'b');
  assert.equal(legendById(dir, 42), undefined);
  for (let i = 0; i < LEGENDS_MOST + 5; i++) keepLegendFile(dir, legend(`x${i}`));
  assert.equal(readLegendsFile(dir).length, LEGENDS_MOST);
  fs.writeFileSync(path.join(dir, 'legends.json'), '{broken');
  assert.deepEqual(readLegendsFile(dir), [], 'a broken file reads as none');
});

/** The phone's host, run in this thread as the desktop's game thread would run it. */
const inProcess = (): SimPort => {
  const handlers: ((m: FromHost) => void)[] = [];
  const host = startSimHost((m) => handlers.forEach((f) => f(m)));
  return { post: (m: ToHost) => host(m), onMessage: (cb) => handlers.push(cb), terminate: () => {} };
};

test('the game thread: snapshots put back together, saves, a new town that remembers the old as a legend and inherits', async () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const saves: string[] = [];
    const deltas: number[] = [];
    let fresh: boolean | null = null;
    const client = new SimClient(inProcess, { snapshot: (d) => deltas.push(JSON.stringify(d).length), save: (t) => saves.push(t), started: (f) => (fresh = f), booked: () => {} });
    const town = newGame('desk-1');
    town.tick = 2 * TICKS_PER_DAY; // (old enough to be remembered)
    client.send({ t: 'init', save: serialize(town, Date.now()), now: Date.now(), hidden: false, alerts: { enabled: false } as never });
    assert.equal(fresh, false);
    mock.timers.tick(500);
    assert.equal(client.current?.seed, 'desk-1');
    const text = await client.saveText();
    assert.ok(text?.includes('"seed":"desk-1"'));
    client.send({ t: 'step', n: 3 });
    assert.ok(deltas.length >= 2);
    // a new town, of the old one's line
    const heir = legend('heir-1');
    const made = await client.newTown({ origin: 'settlers', biome: 'forest', difficulty: 'normal' }, heir);
    assert.ok(made, 'a new town');
    assert.equal(made!.legend?.founder, town.people[0].name, 'the old town is a legend');
    assert.ok(made!.keepOld);
    const r = parseSave(made!.text);
    assert.ok(r.ok);
    assert.equal(r.ok && r.save.state.lineage?.from, 'heir-1', 'the founder is of the chosen line');
    assert.ok(r.ok && r.save.state.ancestry, 'and carries its forebears');
    // started again on it, in a new thread
    client.restart(inProcess);
    client.send({ t: 'init', save: made!.text, now: Date.now(), hidden: false, alerts: { enabled: false } as never });
    mock.timers.tick(500);
    assert.equal(client.current?.seed, r.ok ? r.save.state.seed : '');
    // hiding saves at once; booking the alerts (off) answers at once too
    const hidden = client.hide(true);
    mock.timers.tick(10);
    const got = await hidden;
    assert.ok(got.text);
    assert.deepEqual(got.ids, []);
  } finally {
    mock.timers.reset();
  }
});

test('a window puts the deltas back together, and asks again when it has nothing to build on', async () => {
  let give: (m: SnapMessage) => void = () => {};
  let resyncs = 0;
  const raw = { onSnapDelta: (cb: (m: SnapMessage) => void) => ((give = cb), () => {}), snapResync: () => resyncs++, getSnapshot: () => new Promise<Snapshot>(() => {}), command: () => {} } as unknown as Bridge;
  const b = withDeltas(raw)!;
  const seen: Snapshot[] = [];
  b.onSnapshot((s) => seen.push(s));
  const s = newGame('desk-2');
  const sim = new Sim(s);
  const differ = new SnapDiffer();
  const first = snapshot(s);
  const d0 = differ.diff(first);
  give({ d: structuredClone(d0) }); // (a delta before the whole: nothing to build on)
  assert.equal(resyncs, 1);
  assert.equal(seen.length, 0);
  give({ full: structuredClone(first) });
  for (let i = 0; i < 20; i++) {
    sim.step();
    give({ d: structuredClone(differ.diff(snapshot(s))) });
  }
  assert.equal(seen.length, 21);
  const last = seen.at(-1)!;
  assert.equal(last.tick, s.tick);
  assert.equal(last.people.length, s.people.length);
  assert.equal((await b.getSnapshot()).tick, s.tick);
  // (any other bridge is used as it is)
  const plain = { onSnapshot: () => () => {} } as unknown as Bridge;
  assert.equal(withDeltas(plain), plain);
});
