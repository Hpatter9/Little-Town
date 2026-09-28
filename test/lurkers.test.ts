import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { castPowers } from '../src/shared/sim/powers';
import { lurkers, lurkersBeaten, MIMIC_HOARD } from '../src/shared/sim/lurkers';
import { maybeStartRaid, updateRaid } from '../src/shared/sim/raids';
import { campX, newGame, type GameState } from '../src/shared/sim/state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

/** A rng whose every chance comes true (the rest as usual). */
const lucky = (seed: number) => Object.assign(new Rng(seed), { chance: () => true }) as Rng;

const raidsIn = (biome: 'forest' | 'desert' | 'coast', day: number, n = 250) => {
  const seen = new Map<string, number>();
  const s = newGame(`beasts-${biome}`, { biome });
  s.tick = day * TICKS_PER_DAY;
  for (let i = 0; i < n; i++) {
    s.raid = null;
    s.prompts = [];
    s.nextRaidTick = 0;
    maybeStartRaid(s, new Rng(i));
    seen.set(s.raid!.kind, (seen.get(s.raid!.kind) ?? 0) + 1);
    if (s.raid!.raiders.some((r) => r.kind === 'behemoth')) seen.set('behemoth', (seen.get('behemoth') ?? 0) + 1);
  }
  return seen;
};

test("the land's own beasts come only in their own lands; the Behemoth now and then drives them", () => {
  const desert = raidsIn('desert', 10);
  assert.ok(desert.get('lions'), 'lions in the desert');
  assert.ok(desert.get('wild_dogs'), 'wild dogs in the desert');
  assert.ok(!desert.get('crocodiles'));
  assert.ok(raidsIn('coast', 10).get('crocodiles'), 'crocodiles on the coast');
  const forest = raidsIn('forest', 10);
  assert.ok(!forest.get('lions') && !forest.get('crocodiles') && !forest.get('wild_dogs'));
  assert.ok((forest.get('behemoth') ?? 0) + (desert.get('behemoth') ?? 0) > 0, 'the Behemoth came');
  assert.ok(!raidsIn('forest', 2, 150).get('behemoth'), 'not in the first days');
  assert.ok(ITEM_BY_ID[ENEMIES.behemoth.kit!.trophy]?.relic);
});

function withShop(s: GameState): GameState {
  const tile = Math.floor(campX(s) / 32) + 4;
  s.buildings.push({ id: s.nextId++, def: 'trading_post', tile, status: 'done', delivered: {}, progress: 1, store: {} });
  return s;
}
const atHour = (s: GameState, hour: number) => {
  for (let h = 48; h < 120; h++) if (calendar(h * TICKS_PER_HOUR).hour === hour) return (s.tick = h * TICKS_PER_HOUR);
  throw new Error('no such hour');
};

test('a chest left at the shop comes alive at night: a mimic inside the town, with no warning; killed, its hoard is the town\'s', () => {
  const s = withShop(plainGame('mimic'));
  atHour(s, 12);
  lurkers(s, lucky(1));
  assert.equal(s.raid, null, 'never by day');
  atHour(s, 23);
  lurkers(s, lucky(1));
  const r = s.raid!;
  assert.equal(r.kind, 'mimic');
  assert.equal(r.phase, 'active', 'already in town');
  assert.equal(r.raiders.length, 1);
  assert.ok(Math.abs(r.raiders[0].x - (s.buildings.at(-1)!.tile * 32 + 48)) < 20, 'at the shop');
  assert.ok(!s.prompts.length, 'no warning');
  const coins = s.coins ?? 0;
  r.raiders[0].down = true;
  updateRaid(s, new Rng(2));
  assert.equal(s.raid, null);
  assert.equal(s.coins, coins + MIMIC_HOARD);
});

test("a library's tomes wake and fly at the scholars; beaten, they give up their secrets", () => {
  const s = plainGame('tomes');
  const lib = { id: s.nextId++, def: 'library', tile: Math.floor(campX(s) / 32) + 5, status: 'done' as const, delivered: {}, progress: 1, store: {} };
  s.buildings.push(lib);
  const p = s.people[0];
  p.task = { type: 'research', station: lib.id, topic: 'pottery' };
  s.research.progress.pottery = 0.4;
  atHour(s, 10);
  lurkers(s, lucky(3));
  assert.equal(s.raid?.kind, 'tomes');
  assert.ok(s.raid!.raiders.length >= 2);
  for (const r of s.raid!.raiders) r.down = true;
  lurkersBeaten(s, s.raid!);
  assert.ok(Math.abs(s.research.progress.pottery - 0.7) < 1e-9);
});

test("a druid grove's Entangle wakes walking mushrooms to fight for it", () => {
  const s = newGame('shrooms', { origin: 'druid' });
  s.raid = { id: 1, kind: 'bandits', side: 1, phase: 'active', arrivesTick: 0, leavesTick: 99999, prompt: null, raiders: [{ id: 99, kind: 'bandit', x: campX(s) + 100, dir: -1, hp: 50, maxHp: 50, cooldown: 5, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: 'harm' }] };
  s.tick = 10;
  castPowers(s, new Rng(4));
  assert.equal(s.raid.raiders.filter((r) => r.ally && r.kind === 'shroom_folk').length, 2);
});
