import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catchUp, MAX_OFFLINE_MS, OFFLINE_REPORT_MS, startCatchUp } from '../src/shared/sim/offline';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { addStock, MAX_JOURNAL, newGame, notify, type GameState } from '../src/shared/sim/state';
import { TICK_MS, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const HOUR_MS = 3_600_000;
const run = (sim: Sim, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.step();
};
const reload = (s: GameState): GameState => {
  const r = parseSave(serialize(s, 0));
  assert.ok(r.ok);
  return r.save.state;
};

/** A town with a bit of everything going on: gathering, a blueprint, research, an expedition, a raid due. */
function busyTown(seed: string): Sim {
  const sim = new Sim(newGame(seed));
  const s = sim.state;
  s.cheats.unlockAll = true;
  const campfire = s.buildings[0];
  addStock(campfire.store, 'berries', 20);
  const forest = s.tiles.findIndex((t, i) => i > campfire.tile && t.terrain === 'forest');
  sim.command({ type: 'toggleGather', tile: forest });
  sim.command({ type: 'placeBuilding', def: 'stockpile', tile: campfire.tile + 2 });
  sim.command({ type: 'queueResearch', topic: 'basic_shelter' });
  run(sim, 2 * TICKS_PER_HOUR);
  sim.command({ type: 'sendExpedition', dest: 'berry_thicket', members: [s.mainId] });
  s.nextRaidTick = s.tick + TICKS_PER_HOUR; // a raid on the way too
  return sim;
}

test('a saved game carries on exactly as if it had never stopped', () => {
  const a = busyTown('roundtrip');
  run(a, TICKS_PER_HOUR); // mid-expedition, raid warning out
  const b = new Sim(reload(a.state));
  for (const sim of [a, b]) run(sim, 6 * TICKS_PER_HOUR);
  assert.ok(a.state.journal.length > 3, 'things happened');
  assert.deepEqual(JSON.parse(JSON.stringify(b.state)), JSON.parse(JSON.stringify(a.state)));
});

test('corrupt saves and saves from another version are refused', () => {
  assert.deepEqual(parseSave('{"format":"little-town-save"'), { ok: false, reason: 'corrupt' });
  assert.deepEqual(parseSave('{}'), { ok: false, reason: 'corrupt' });
  const old = JSON.parse(serialize(newGame('v'), 5));
  old.state.version = 7;
  assert.deepEqual(parseSave(JSON.stringify(old)), { ok: false, reason: 'old-version', version: 7 });
  const r = parseSave(serialize(newGame('v'), 5));
  assert.ok(r.ok && r.save.savedAt === 5);
});

test('offline: the town works through its research queue, then a report goes in the journal', () => {
  const sim = new Sim(plainGame('offline'));
  const s = sim.state;
  s.people[0].priorities.research = 1;
  sim.command({ type: 'queueResearch', topic: 'basic_shelter' });
  sim.step();
  const r = catchUp(sim, 2 * HOUR_MS);
  // (the first half hour away passes as in play, the rest at a quarter of the pace)
  assert.equal(r.ticks, (30 * 60_000 + 90 * 60_000 * 0.25) / TICK_MS);
  assert.ok(s.research.done.includes('basic_shelter'));
  const report = s.journal.at(-1)!;
  assert.equal(report.id, r.reportId);
  assert.match(report.text, /While you were away \(2h 0m, 2\.2 game days\)/);
  assert.ok(report.lines!.some((l) => l.includes('Research complete: Basic Shelter')));
  assert.ok(report.lines!.some((l) => l.includes('queues ran dry')));
  assert.equal(snapshot(s).away?.id, report.id);

  sim.command({ type: 'dismissAway' });
  sim.step();
  assert.equal(snapshot(s).away, null);
  assert.ok(s.journal.some((e) => e.id === report.id), 'still in the journal');
});

test('offline: short gaps are caught up without a report; paused games stay put; long ones are capped', () => {
  const sim = new Sim(plainGame('gaps'));
  const s = sim.state;
  assert.equal(catchUp(sim, OFFLINE_REPORT_MS - 1000).reportId, null);
  assert.equal(s.unreadAway, null);

  s.paused = true;
  const tick = s.tick;
  assert.equal(catchUp(sim, HOUR_MS).ticks, 0);
  assert.equal(s.tick, tick);
  s.paused = false;

  const capped = new Sim(plainGame('cap'));
  capped.state.people[0].needs = { food: 1, rest: 1 };
  // a night away is a few days in the town, not weeks
  const r = catchUp(capped, 9 * HOUR_MS);
  assert.ok(r.ticks <= MAX_OFFLINE_MS / TICK_MS);
  assert.ok(r.ticks / TICKS_PER_DAY <= 3, `${r.ticks / TICKS_PER_DAY} game days`);
  assert.ok(capped.state.journal.at(-1)!.lines!.some((l) => l.includes('at most 3 game days')));
});

test('offline: a busy town simulates a real hour quickly', () => {
  const sim = busyTown('perf');
  const t0 = performance.now();
  catchUp(sim, HOUR_MS);
  const ms = performance.now() - t0;
  console.log(`one real hour (${HOUR_MS / TICK_MS} ticks) in ${Math.round(ms)}ms`);
  assert.ok(ms < 5000);
});

test('the journal keeps the most recent entries', () => {
  const s = newGame('journal');
  for (let i = 0; i < MAX_JOURNAL + 50; i++) notify(s, `event ${i}`);
  assert.equal(s.journal.length, MAX_JOURNAL);
  assert.equal(s.journal.at(-1)!.text, `event ${MAX_JOURNAL + 49}`);
  assert.equal(s.notices.length, 20);
});

test('catching up a slice at a time ends exactly where catching up in one go does', () => {
  const whole = new Sim(newGame('slices'));
  const sliced = new Sim(newGame('slices'));
  catchUp(whole, 30 * 60_000);
  const job = startCatchUp(sliced, 30 * 60_000);
  let slices = 0;
  while (!job.run(777)) slices++;
  job.finish();
  assert.ok(slices > 5);
  assert.equal(job.progress, 1);
  assert.equal(JSON.stringify(sliced.state), JSON.stringify(whole.state));
});