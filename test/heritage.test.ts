import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORIGINS } from '../src/shared/data/origins';
import { describeEffects, TOPIC_BY_ID, TOPICS } from '../src/shared/data/research';
import { buildSpeed, craftSpeed, fightRate, guardRate, qualityBonus, travellerRate } from '../src/shared/sim/origin';
import { castPowers } from '../src/shared/sim/powers';
import { canQueue, foreignHeritage, modifiers, researchMods } from '../src/shared/sim/research';
import { Rng } from '../src/shared/rng';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

test('data: every origin has six heritage topics, one line from the Stone Age to the stars', () => {
  for (const o of ORIGINS) {
    const line = TOPICS.filter((t) => t.origin === o);
    assert.equal(line.length, 6, `${o} heritage`);
    assert.ok(line.every((t) => t.branch === 'heritage' && t.unlocks && t.effects.length), `${o}: each says what it does`);
    assert.equal(line.at(-1)!.era, 'space');
  }
  assert.ok(TOPICS.every((t) => t.branch !== 'heritage' || t.origin), 'heritage always belongs to someone');
  assert.equal(new Set(TOPICS.map((t) => t.id)).size, TOPICS.length, 'ids are unique');
  assert.ok(TOPICS.length >= 188, `about twice the 94 topics there were (${TOPICS.length})`);
});

test('heritage: only the town of that origin can study it', () => {
  const druid = newGame('grove', { origin: 'druid' });
  assert.equal(canQueue(druid.research, 'seed_lore', druid.era, druid.origin).ok, true);
  assert.match(canQueue(druid.research, 'night_eyes', druid.era, druid.origin).reason ?? '', /heritage/);
  assert.equal(foreignHeritage('night_eyes', 'vampire'), false);
  assert.equal(foreignHeritage('homesteading', undefined), false, 'settlers are the default');
  assert.equal(foreignHeritage('fire_keeping', 'druid'), false, 'common topics are everyone\'s');
  assert.match(canQueue(druid.research, 'sacred_groves', druid.era, druid.origin).reason ?? '', /Seed Lore|Wild Speech|era/);
});

test('research bends the origin levers: building, crafting, fighting, harm, strangers, quality', () => {
  const s = newGame('levers', { origin: 'knights' });
  const before = { build: buildSpeed(s), craft: craftSpeed(s), fight: fightRate(s), guard: guardRate(s), trav: travellerRate(s), q: qualityBonus(s) };
  s.research.done.push('drill_yard', 'heraldry', 'military_engineering', 'combined_arms', 'nanofabrication');
  assert.ok(Math.abs(buildSpeed(s) / before.build - 1.1) < 1e-9);
  assert.ok(Math.abs(craftSpeed(s) / before.craft - 1.1 * 1.2) < 1e-9);
  assert.ok(Math.abs(fightRate(s) / before.fight - 1.1) < 1e-9);
  assert.ok(Math.abs(guardRate(s) / before.guard - 0.9) < 1e-9);
  assert.ok(Math.abs(travellerRate(s) / before.trav - 1.1) < 1e-9);
  assert.equal(qualityBonus(s), before.q + 0.5);
});

test('the remembered modifiers follow newly finished topics', () => {
  const s = newGame('memo');
  assert.equal(researchMods(s.research).rules.build, 1);
  s.research.done.push('homesteading');
  assert.equal(researchMods(s.research).rules.build, 1.1);
  assert.deepEqual(researchMods(s.research), modifiers(s.research));
});

test('heritage makes powers come back sooner', () => {
  const wait = (done: string[]) => {
    const s = newGame('eternal', { origin: 'lich' });
    s.research.done.push(...done);
    s.tick = TICKS_PER_HOUR * 10;
    castPowers(s, new Rng(1));
    assert.ok(s.powers?.raise_dead, 'Raise Dead was cast');
    return (s.powers!.raise_dead - s.tick) / TICKS_PER_HOUR;
  };
  const plain = wait([]);
  const learned = wait(['bone_carving', 'death_whispers', 'ossuary_rites', 'embalming', 'galvanic_reanimation', 'eternal_engine']);
  assert.ok(Math.abs(learned - plain * 0.75 * 0.75) < 0.01, `recharge ${learned}h vs ${plain}h`);
});

test('effects read as words', () => {
  assert.equal(describeEffects(TOPIC_BY_ID.embalming.effects), '−12% harm taken in raids');
  assert.equal(describeEffects(TOPIC_BY_ID.eternal_engine.effects), 'Powers return 25% sooner and last 50% longer');
  assert.equal(describeEffects(TOPIC_BY_ID.fish_traps.effects), '+15% foraging');
  const m = modifiers({ done: ['eternal_engine', 'ossuary_rites'] });
  assert.equal(m.powerRecharge, 0.75 * 0.75);
  assert.equal(m.powerLasts, 1.5);
});
