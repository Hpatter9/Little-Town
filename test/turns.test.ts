import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABILITIES, ABILITY_BY_ID, abilitiesKnown } from '../src/shared/data/abilities';
import { ATTR_BASE, speedOfDex } from '../src/shared/data/attributes';
import { CLASSES } from '../src/shared/data/classes';
import { ENEMIES } from '../src/shared/data/enemies';
import { SPELL_BY_ID } from '../src/shared/data/spells';
import { canPay, kitOf } from '../src/shared/sim/actions';
import { attributesOf } from '../src/shared/sim/attributes';
import { personFighter, startBattle, stepBattle, TURN_BEAT } from '../src/shared/sim/combat';
import { Rng } from '../src/shared/rng';
import { makePerson, type Person } from '../src/shared/sim/state';

const person = (seed: number, cls: Person['cls'], level: number): Person => {
  const p = makePerson(new Rng(seed), 1000 + seed, 'hunter', { x: 0, y: 0 }, []);
  p.cls = cls;
  p.level = level;
  p.hp = 100;
  return p;
};

test('every class has twenty skills of its own, one of them an ultimate; ids are unique; summons exist', () => {
  const ids = new Set<string>();
  for (const a of ABILITIES) {
    assert.ok(!ids.has(a.id), `${a.id} twice`);
    ids.add(a.id);
    for (const e of a.active?.effects ?? []) if (e.kind === 'summon') assert.ok(ENEMIES[e.summon!], `${a.id} summons ${e.summon}`);
  }
  for (const cls of CLASSES) {
    const own = ABILITIES.filter((a) => a.cls === cls);
    assert.equal(own.length, 20, `${cls}: ${own.length} skills`);
    const ults = own.filter((a) => a.ultimate);
    assert.equal(ults.length, 1, `${cls}: ${ults.length} ultimates`);
    assert.ok(ults[0].active && ults[0].level <= 25, `${cls}: the ultimate comes by level 25`);
  }
  assert.equal(ABILITIES.filter((a) => a.cls === null).length, 10);
  assert.ok(abilitiesKnown('knight', 20).some((a) => a.ultimate));
});

test('attributes grow by class and level, and dexterity brings the turn round sooner', () => {
  const low = attributesOf(person(1, 'archer', 1));
  const high = attributesOf(person(1, 'archer', 30));
  assert.ok(high.dex > low.dex + 8, `dex ${low.dex} -> ${high.dex}`);
  assert.ok(high.int < high.dex, 'an archer is nimble, not learned');
  const sage = attributesOf(person(1, 'mage', 30));
  assert.ok(sage.int > sage.str + 10, 'a mage is learned, not strong');
  assert.ok(speedOfDex(ATTR_BASE) === 1 && speedOfDex(20) < 0.75 && speedOfDex(4) > 1.1);
  const quick = personFighter(person(2, 'archer', 30), 'fighter', 'back');
  const slow = personFighter(person(2, 'guardian', 30), 'fighter', 'front');
  assert.ok(quick.interval < slow.interval, `archer ${quick.interval} vs guardian ${slow.interval}`);
  assert.ok((quick.maxMp ?? 0) > 0 && (quick.maxSp ?? 0) > 0 && quick.limit === 0);
});

test('spells cost mana and skills stamina; an ultimate waits on the limit gauge', () => {
  const kit = kitOf(person(3, 'mage', 24))!;
  const spells = kit.actions.filter((a) => a.spell);
  const skills = kit.actions.filter((a) => !a.spell && a.pool === 'sp');
  const ult = kit.actions.find((a) => a.pool === 'limit')!;
  assert.ok(spells.length && spells.every((a) => a.pool === 'mp' && a.cost > 0));
  assert.ok(skills.length && skills.every((a) => a.cost > 0));
  assert.ok(ult && ABILITY_BY_ID[ult.id].ultimate);
  const f = personFighter(person(3, 'mage', 24), 'fighter', 'back');
  assert.ok(canPay(f, spells[0]));
  f.mp = 0;
  assert.equal(canPay(f, spells[0]), false, 'no mana, no spell');
  assert.equal(canPay(f, ult), false, 'the gauge is empty');
  f.limit = 1;
  assert.ok(canPay(f, ult));
  assert.ok(SPELL_BY_ID.fire_bolt, 'the spell list still stands');
});

test('a fight is turn-based: one action a tick, a beat between turns, and it still ends', () => {
  const rng = new Rng(7);
  const party = [person(10, 'knight', 12), person(11, 'mage', 12), person(12, 'archer', 12)];
  const b = startBattle(party, {}, { bandit: 3 }, rng);
  let acted = 0;
  let last = -99;
  for (let t = 0; t < 6000 && !b.outcome; t++) {
    const before = b.fighters.map((f) => f.lastAction);
    stepBattle(b, rng, { retreatAt: 0, mainId: null });
    const now = b.fighters.filter((f, i) => f.lastAction !== before[i]).length;
    assert.ok(now <= 1, `${now} acted on tick ${b.tick}`);
    if (now) {
      assert.ok(b.tick - last >= TURN_BEAT, `turns ${last} and ${b.tick} too close`);
      last = b.tick;
      acted++;
    }
  }
  assert.ok(b.outcome, 'the fight ended');
  assert.ok(acted >= 6, `${acted} turns`);
  const knight = b.fighters.find((f) => f.cls === 'knight')!;
  assert.ok((knight.limit ?? 0) >= 0 && (knight.sp ?? 0) <= (knight.maxSp ?? 0));
});

test('the limit gauge fills from hurt and the ultimate is loosed when full, with a fanfare', () => {
  const rng = new Rng(9);
  const hero = person(20, 'warrior', 24);
  const b = startBattle([hero], {}, { bandit: 4 }, rng);
  const me = b.fighters.find((f) => f.side === 'party')!;
  me.limit = 1;
  me.sp = 0; // (no stamina: the skills are out of reach, the ultimate isn't)
  for (let t = 0; t < 400 && !(b.acts ?? []).some((a) => a.meta?.ult); t++) stepBattle(b, rng, { retreatAt: 0, mainId: null });
  const ult = (b.acts ?? []).find((a) => a.meta?.ult);
  assert.ok(ult, 'the ultimate was used');
  assert.equal(ult!.name, "Titan's Wrath");
  assert.ok(b.shouts?.some((s) => /unleashes Titan's Wrath/.test(s)));
  assert.equal(me.limit, 0);
});
