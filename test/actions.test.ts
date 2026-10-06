import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABILITIES } from '../src/shared/data/abilities';
import { CLASSES } from '../src/shared/data/classes';
import { ENEMIES } from '../src/shared/data/enemies';
import { SPELLS } from '../src/shared/data/spells';
import { Rng } from '../src/shared/rng';
import { kitOf, readySpells } from '../src/shared/sim/actions';
import { startBattle, stepBattle } from '../src/shared/sim/combat';
import { makePerson, maxHp } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';

const hero = (cls: (typeof CLASSES)[number], level: number, id = 1) => {
  const p = makePerson(new Rng(id), id, 'hunter', { x: 0, y: 0 }, []);
  p.cls = cls;
  p.level = level;
  p.skills.melee.level = 8;
  p.skills.research.level = 8;
  p.hp = maxHp(p);
  return p;
};

test('the lists: 160 spells and 530 skills (ten for anyone, twenty a class), all well formed', () => {
  assert.equal(SPELLS.length, 160);
  assert.equal(ABILITIES.length, 530);
  assert.equal(new Set([...SPELLS, ...ABILITIES].map((x) => x.id)).size, 690, 'no id twice');
  assert.ok(SPELLS.filter((s) => s.cls === null).length < 10 && ABILITIES.filter((a) => a.cls === null).length < 15, 'only a few general');
  for (const cls of CLASSES) assert.ok(ABILITIES.some((a) => a.cls === cls), `${cls} has skills`);
  for (const x of [...SPELLS, ...ABILITIES.flatMap((a) => (a.active ? [a.active] : []))])
    for (const e of x.effects) if (e.kind === 'summon') assert.ok(ENEMIES[e.summon!], `summons ${e.summon}`);
});

test('three spells ready, the best of each kind, better ones as they level; the great ones wait long', () => {
  const low = readySpells('white_mage', 5).map((s) => s.id);
  const high = readySpells('white_mage', 40).map((s) => s.id);
  assert.equal(high.length, 3);
  assert.ok(low.includes('cure') && high.includes('curaga'), `${low} -> ${high}`);
  const mage = SPELLS.filter((s) => s.cls === 'mage');
  assert.ok(mage[mage.length - 1].cooldown > mage[0].cooldown * 5, 'the greatest cast sparingly');
  assert.ok(!kitOf({ cls: 'warrior', level: 10 })!.actions.some((a) => a.spell), 'a warrior casts nothing');
});

test('in a fight: a white mage mends the hurt, a sorcerer burns the pack, a summoner calls help, statuses take hold', () => {
  const rng = new Rng(9);
  const knight = hero('knight', 10, 1);
  knight.hp = Math.round(maxHp(knight) * 0.3);
  const healer = hero('white_mage', 12, 2);
  const mage = hero('mage', 26, 3);
  const caller = hero('summoner', 6, 4);
  const b = startBattle([knight, healer, mage, caller], {}, { wolf_alpha: 4, boar: 2 }, rng);
  // (turn-based fights: a hardier pack, so the fight lasts long enough for everyone to show what they do)
  for (const f of b.fighters) if (f.side === 'enemy') f.hp = f.maxHp = f.maxHp * 4;
  const k = b.fighters.find((f) => f.ref === knight.id)!;
  const start = k.hp;
  let mended = false;
  let burned = false;
  for (let i = 0; i < 60 * TICK_HZ && !b.outcome; i++) {
    stepBattle(b, rng, { retreatAt: 0, mainId: null });
    if (k.hp > start) mended = true;
    if (b.fighters.some((f) => f.side === 'enemy' && f.st?.burn)) burned = true;
  }
  const used = new Set((b.acts ?? []).map((a) => a.name));
  assert.ok(mended, 'the knight was mended: ' + JSON.stringify((b.acts ?? []).map((a) => [a.ref, a.name])) + ' ' + b.outcome + ' ' + k.hp + '/' + k.maxHp + ' ' + start);
  assert.ok(b.fighters.some((f) => f.conjured && f.side === 'party'), 'something answered the call: ' + JSON.stringify((b.acts ?? []).map((a) => [a.ref, a.name])));
  assert.ok(used.size >= 3, `spells and skills used: ${[...used]}`);
  assert.ok(burned || used.has('Fireball') || used.has('Flame Wave'), 'fire on the wolves');
  assert.equal(b.outcome, 'won');
});
