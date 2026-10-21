import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { addStock, MAX_JOURNAL, newGame, notify, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { row, nearestWild } from './helpers';

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
  const forest = nearestWild(s, 'forest');
  sim.command({ type: 'toggleGather', cell: forest });
  sim.command({ type: 'placeBuilding', def: 'stockpile', x: campfire.tile + 2, y: row(s) });
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

test('the journal keeps the most recent entries', () => {
  const s = newGame('journal');
  for (let i = 0; i < MAX_JOURNAL + 50; i++) notify(s, `event ${i}`);
  assert.equal(s.journal.length, MAX_JOURNAL);
  assert.equal(s.journal.at(-1)!.text, `event ${MAX_JOURNAL + 49}`);
  assert.equal(s.notices.length, 20);
});

test('the land\'s pools are packed in the save, and come back as they were', async () => {
  const { newGame: ng } = await import('../src/shared/sim/state');
  const { parseSave: ps, serialize: ser, packPools, unpackPools } = await import('../src/shared/sim/save');
  const s = ng('pack-pools');
  s.land.pools[5] = { wood: 2.5, stone: -1 } as never;
  assert.deepEqual(unpackPools(packPools(s.land.pools)), JSON.parse(JSON.stringify(s.land.pools)));
  const text = ser(s, 1);
  assert.ok(text.length < JSON.stringify(s).length * 0.75, 'smaller');
  const back = ps(text);
  assert.ok(back.ok);
  if (back.ok) assert.equal(JSON.stringify(back.save.state), JSON.stringify(s));
});
