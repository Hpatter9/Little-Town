import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOME_DEFS, BIOMES, openGround } from '../src/shared/data/biomes';
import { RAID_KINDS } from '../src/shared/data/raids';
import { ENEMIES } from '../src/shared/data/enemies';
import { BIOME_BEASTS } from '../src/shared/data/places';
import { beastsOf, placeHabitats, RAID_TIERS, type Habitat } from '../src/shared/data/menagerie';
import { groundAt } from '../src/shared/sim/land';
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
    assert.ok(s.land.cells.includes('.') || s.land.cells.includes('s'), 'some open ground');
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
/** The share of a land's cells of a kind, over the home vale. */
function shareOf(s: ReturnType<typeof newGame>, kind: string): number {
  const m = s.land;
  let n = 0;
  let all = 0;
  for (let y = m.camp.y - 40; y < m.camp.y + 40; y++)
    for (let x = m.camp.x - 40; x < m.camp.x + 40; x++) {
      all++;
      if (groundAt(m, x, y) === kind) n++;
    }
  return n / all;
}

test('ten lands, each shaped its own way: the fens marshy, the jungle wooded, the highlands stony, the ashlands cinders, the steppe open, the taiga pine', () => {
  assert.equal(BIOMES.length, 10);
  const lands = Object.fromEntries(BIOMES.map((b) => [b, newGame(`land-${b}`, { biome: b })]));
  assert.ok(shareOf(lands.swamp, 'marsh') > shareOf(lands.forest, 'marsh') * 2.5, 'the fens are marsh');
  assert.ok(shareOf(lands.jungle, 'forest') > shareOf(lands.forest, 'forest') * 1.2, 'the jungle is wooded');
  assert.ok(shareOf(lands.highlands, 'rock') + shareOf(lands.highlands, 'hill') > shareOf(lands.forest, 'rock') + shareOf(lands.forest, 'hill'), 'the highlands are stony');
  assert.ok(shareOf(lands.ashlands, 'sand') > 0.3 && openGround('ashlands') === 'sand', 'the ashlands are cinders');
  assert.ok(shareOf(lands.steppe, 'grass') + shareOf(lands.steppe, 'fertile') > shareOf(lands.forest, 'grass') + shareOf(lands.forest, 'fertile'), 'the steppe is open');
  assert.ok(shareOf(lands.taiga, 'forest') > shareOf(lands.forest, 'forest'), 'the taiga is pine');
  // (the forest, desert, tundra and coast are the lands they were)
  assert.deepEqual(newGame('same', { biome: 'desert' }).land.cells, newGame('same', { biome: 'desert' }).land.cells);
});

test('every land has raids, lairs and creatures of its own, and every creature named exists', () => {
  for (const b of BIOMES) {
    const def = BIOME_DEFS[b];
    const own = RAID_KINDS.filter((k) => k.biomes?.includes(b));
    assert.ok(own.length >= 2, `${b}: raids of its own (${own.length})`);
    for (const k of own) for (const id of Object.keys(k.enemies)) assert.ok(ENEMIES[id], `${b}: ${k.id} brings ${id}`);
    for (const g of BIOME_BEASTS[b] ?? []) for (const id of Object.keys(g)) assert.ok(ENEMIES[id], `${b}: a lair of ${id}`);
    const wild = beastsOf(placeHabitats('beast', b), RAID_TIERS.neolithic);
    assert.ok(wild.length >= 3, `${b}: Stone Age beasts of the wild (${wild.length})`);
    for (const h of def.habitats) assert.ok(beastsOf([h as Habitat], [1, 10]).length > 0, `${b}: habitat ${h} has creatures`);
    for (const id of Object.keys(def.raids ?? {})) assert.ok(RAID_KINDS.some((k) => k.id === id) || ['rivals', 'pirates', 'slimes', 'boars', 'wolves', 'bandits'].includes(id), `${b}: weights raid ${id}`);
  }
});
