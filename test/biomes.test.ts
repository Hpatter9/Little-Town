import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOMES } from '../src/shared/data/biomes';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { raidBudget } from '../src/shared/sim/raids';
import { generateWorld } from '../src/shared/world';

const share = (mid: string[], kind: string) => mid.filter((t) => t === kind).length / mid.length;

test('biomes shape the land: deserts are rocky and bare, forests wooded', () => {
  let rockDesert = 0;
  let rockForest = 0;
  let woodDesert = 0;
  let woodForest = 0;
  for (const seed of ['a', 'b', 'c', 'd']) {
    const d = generateWorld(seed, 'desert').mid;
    const f = generateWorld(seed, 'forest').mid;
    rockDesert += share(d, 'rock');
    rockForest += share(f, 'rock');
    woodDesert += share(d, 'forest');
    woodForest += share(f, 'forest');
  }
  assert.ok(rockDesert > rockForest);
  assert.ok(woodForest > woodDesert);
  // the forest is the classic world, unchanged
  assert.deepEqual(generateWorld('a'), generateWorld('a', 'forest'));
});

test('every biome makes a playable start, and the biome is saved', () => {
  for (const biome of BIOMES) {
    const s = newGame(`b-${biome}`, { biome });
    assert.equal(s.biome ?? 'forest', biome);
    assert.ok(s.tiles.some((t) => t.terrain === 'clear'));
    const back = parseSave(serialize(s, 1));
    assert.ok(back.ok && (back.save.state.biome ?? 'forest') === biome);
    const sim = new Sim(s);
    for (let i = 0; i < 200; i++) sim.step();
  }
});

test('ironman towns cannot cheat', () => {
  const sim = new Sim(newGame('iron', { ironman: true }));
  sim.command({ type: 'cheatUnlockAll', on: true });
  sim.step();
  assert.equal(sim.state.cheats.unlockAll, false);
  assert.equal(sim.state.ironman, true);
});

test('difficulty scales raid strength', () => {
  const easy = newGame('diff', { difficulty: 'easy' });
  const normal = newGame('diff');
  const hard = newGame('diff', { difficulty: 'hard' });
  for (const s of [easy, normal, hard]) s.tick = 10 * 14400;
  assert.ok(raidBudget(easy) < raidBudget(normal) && raidBudget(normal) < raidBudget(hard));
});