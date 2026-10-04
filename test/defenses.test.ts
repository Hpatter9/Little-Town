import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID, BUILDINGS } from '../src/shared/data/buildings';
import { DEFENSE_BUILDINGS, ORIGIN_DEFENSES, SLOW_SECONDS } from '../src/shared/data/defenses';
import { ORIGINS } from '../src/shared/data/origins';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { Rng } from '../src/shared/rng';
import { isUnlocked, unlockInfo } from '../src/shared/sim/buildings';
import { fireAt, speedOf, tickBurns } from '../src/shared/sim/defenses';
import { newGame, type Raider } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';

const raider = (id: number, x: number, hp = 100): Raider => ({ id, kind: 'bandit', x, y: 0, dir: 1, hp, maxHp: hp, cooldown: 0, down: false, fleeing: false, gone: false, carrying: {}, lastAction: 0, lastHit: 0 }) as Raider;

test('every era has its traps and engines, and every origin a piece of its own, all real buildings with research or an era', () => {
  assert.ok(DEFENSE_BUILDINGS.length >= 10);
  assert.equal(ORIGIN_DEFENSES.length, ORIGINS.length);
  for (const d of [...DEFENSE_BUILDINGS, ...ORIGIN_DEFENSES]) {
    assert.equal(BUILDING_BY_ID[d.id], d, `${d.id} is in the table`);
    assert.ok(d.defense, `${d.id} fires`);
    if (d.research) assert.ok(TOPIC_BY_ID[d.research], `${d.id}: ${d.research} is a topic`);
    else assert.ok(d.era && d.origin, `${d.id} is an origin's own`);
  }
  for (const o of ORIGINS) assert.equal(ORIGIN_DEFENSES.filter((d) => d.origin === o).length, 1, `${o} has one`);
  assert.ok(TOPIC_BY_ID.trapmaking && TOPIC_BY_ID.siege_engines);
  assert.ok(BUILDINGS.filter((b) => b.defense).length >= 17);
});

test('an origin\'s piece is its own: open to it from the Medieval age, never to another', () => {
  const s = newGame('pieces', { origin: 'knights' });
  const mine = BUILDING_BY_ID.crossbow_bastion;
  const theirs = BUILDING_BY_ID.bone_spire;
  assert.ok(!isUnlocked(unlockInfo(s), mine), 'not yet: the Stone Age');
  s.era = 'medieval';
  assert.ok(isUnlocked(unlockInfo(s), mine));
  assert.ok(!isUnlocked(unlockInfo(s), theirs), 'the liches\' spire is never the knights\'');
});

test('a splash hurts those beside the one struck, a chain leaps on, a slow and a burn linger, a glamour routs', () => {
  const s = newGame('volley');
  s.tick = 1000;
  const rng = new Rng(7);
  const a = raider(1, 0);
  const b = raider(2, 20);
  const c = raider(3, 200);
  const all = [a, b, c];
  const near = (rd: Raider, px: number) => all.filter((q) => q !== rd && Math.abs(q.x - rd.x) <= px);
  const dealt = new Map<Raider, number>();
  const hurt = (rd: Raider, dmg: number) => dealt.set(rd, (dealt.get(rd) ?? 0) + dmg);
  // a catapult stone: the one struck and the one beside it, not the one far off
  let v = fireAt(s, rng, { damage: [10, 10], range: 260, interval: 6, accuracy: 2, splash: 48 }, a, near, hurt);
  assert.ok(v.hit);
  assert.equal(v.struck.length, 2);
  assert.equal(dealt.get(a), 10);
  assert.equal(dealt.get(b), 5);
  assert.equal(dealt.get(c), undefined);
  // a bolt through two
  dealt.clear();
  v = fireAt(s, rng, { damage: [10, 10], range: 220, interval: 4, accuracy: 2, chain: 1 }, a, near, hurt);
  assert.equal(v.struck.length, 2);
  assert.ok((dealt.get(b) ?? 0) > 0 && (dealt.get(b) ?? 0) < 10, 'the second takes less');
  // a pit: slowed for a while, then free again
  fireAt(s, rng, { damage: [4, 8], range: 16, interval: 4, accuracy: 2, slow: 0.5 }, c, near, hurt);
  assert.equal(speedOf(c, s.tick), 0.5);
  assert.equal(speedOf(c, s.tick + SLOW_SECONDS * TICK_HZ + 1), 1);
  // oil: it burns on
  fireAt(s, rng, { damage: [8, 14], range: 70, interval: 8, accuracy: 2, burn: 3 }, c, near, hurt);
  assert.ok(c.burn);
  dealt.clear();
  for (let t = 0; t < TICK_HZ * 2; t++) {
    s.tick++;
    tickBurns(s, all, hurt);
  }
  assert.ok((dealt.get(c) ?? 0) >= 5, `burned for ${dealt.get(c)}`);
  // a glamour ring: some turn about
  let routed = 0;
  for (let i = 0; i < 40; i++) {
    const r = raider(10 + i, 0);
    fireAt(s, new Rng(i), { damage: [0, 2], range: 16, interval: 6, accuracy: 2, rout: 0.35 }, r, near, hurt);
    if (r.routed) routed++;
  }
  assert.ok(routed >= 6 && routed <= 24, `routed ${routed} of 40`);
  // a miss touches nobody
  dealt.clear();
  v = fireAt(s, rng, { damage: [10, 10], range: 100, interval: 1, accuracy: 0 }, a, near, hurt);
  assert.ok(!v.hit && !v.struck.length && !dealt.size);
});
