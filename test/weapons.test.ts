import { MAX_SKILL } from '../src/shared/data/skills';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS, ITEM_BY_ID, STATIONS } from '../src/shared/data/items';
import { MATERIALS } from '../src/shared/data/materials';
import { gradeOf, MAX_PLUS, piece, pieceLabel, plusMult, plusOf, rollPlus } from '../src/shared/data/quality';
import { TOPICS } from '../src/shared/data/research';
import { FAMILIES, tierDamage } from '../src/shared/data/weapons';
import { Rng } from '../src/shared/rng';
import { afterBlow, hitDamage, UNARMED_RANGE, weaponOf, weaponRange } from '../src/shared/sim/combat';
import { makePerson } from '../src/shared/sim/state';

const weapons = ITEMS.filter((i) => i.slot === 'weapon');

test('the armoury: ten times the weapons, in many families, each makeable', () => {
  assert.ok(weapons.length >= 160, `${weapons.length} weapons`);
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length, 'no id twice');
  const fams = new Set(weapons.map((w) => w.family).filter(Boolean));
  assert.ok(fams.size >= 20, `${fams.size} families`);
  const topics = new Set(TOPICS.map((t) => t.id));
  for (const w of weapons) {
    if (w.relic) continue;
    assert.ok(w.research.every((r) => topics.has(r)), `${w.id}: research ${w.research}`);
    assert.ok(STATIONS.includes(w.station), `${w.id}: station ${w.station}`);
    assert.ok(Object.keys(w.cost).every((m) => (MATERIALS as readonly string[]).includes(m)), `${w.id}: cost ${JSON.stringify(w.cost)}`);
    assert.ok((w.effects.damage ?? 0) >= 1, w.id);
  }
});

test('+N: rare, rarer for a novice; a basic weapon at +5 is about as good as one three tiers up', () => {
  const rng = new Rng(7);
  const count = (level: number) => {
    const n = Array(MAX_PLUS + 1).fill(0);
    for (let i = 0; i < 100000; i++) n[rollPlus(rng, level)]++;
    return n;
  };
  const novice = count(1);
  const master = count(MAX_SKILL);
  assert.ok(novice[0] > 90000 && novice[2] < 300, `novice ${novice}`);
  assert.ok(master[1] > 20000 && master[3] < 1600 && master[5] < 40, `master ${master}`);
  assert.ok(master[3] > novice[3]);
  // three tiers is about the worth of a +5
  const ratio = plusMult(piece(1, 5)) / (tierDamage(4) / tierDamage(1));
  assert.ok(ratio > 0.8 && ratio < 1.25, `+5 is ${ratio.toFixed(2)} of three tiers`);
  // the grade and the + live in one number, and older pieces are +0
  const q = piece(3, 2);
  assert.equal(gradeOf(q), 3);
  assert.equal(plusOf(q), 2);
  assert.equal(plusOf(5), 0);
  assert.equal(pieceLabel('Iron Sword', q), 'Rare Iron Sword +2');
});

test('weapons fight their own way: grade and + raise the damage; quirks strike true, pierce, stun and cleave', () => {
  const p = makePerson(new Rng(1), 1, 'hunter', { x: 0, y: 0 }, []);
  p.gear.weapon = 'iron_sword';
  p.gearQ = { weapon: piece(1, 0) };
  const plain = weaponOf(p).damage;
  p.gearQ = { weapon: piece(1, 3) };
  assert.ok(weaponOf(p).damage > plain * 1.4, '+3 hits harder');
  const rng = new Rng(3);
  const f = { damage: [10, 10] as [number, number], ammo: 0, ammoBonus: 0, ammoUsed: 0, beastDamage: 0, quirks: { crit: 1, pierce: 1, cleave: 0.5, stun: 1, undead: 5, machine: 0 } };
  assert.equal(hitDamage(f, { kind: 'zombie', armor: 0.5, block: 0, tough: false }, rng), 30, 'true strike on the dead, armour pierced');
  const foe = { cooldown: 0, interval: 10 };
  const other = { hp: 20, down: false };
  afterBlow(f.quirks, 10, foe, [other], rng);
  assert.equal(foe.cooldown, 10, 'stunned');
  assert.equal(other.hp, 15, 'cleft');
  assert.ok(FAMILIES.dg.fx?.speed! < 1 && FAMILIES.gs.fx?.speed! > 1, 'daggers quick, great weapons slow');
  assert.ok(ITEM_BY_ID.monoblade.effects.pierce! > 0.5);
});

test('armour in four weights, shields and trinkets, about a hundred pieces, each makeable', () => {
  const armour = ITEMS.filter((i) => i.weight);
  assert.ok(armour.length >= 100, `${armour.length} pieces`);
  for (const w of ['cloth', 'light', 'medium', 'heavy', 'shield', 'trinket']) assert.ok(armour.some((a) => a.weight === w), w);
  const topics = new Set(TOPICS.map((t) => t.id));
  for (const a of armour) {
    if (a.relic) continue;
    assert.ok(a.research.every((r) => topics.has(r)), `${a.id}: research`);
    assert.ok(STATIONS.includes(a.station), `${a.id}: station ${a.station}`);
    assert.ok(Object.keys(a.cost).every((m) => (MATERIALS as readonly string[]).includes(m)), `${a.id}: cost`);
  }
  // heavier turns more; cloth feeds spells; light dodges
  const tier = (w: string) => armour.find((a) => a.weight === w && a.slot === 'body' && a.tier === 6)!;
  assert.ok(tier('heavy').effects.armor! > tier('medium').effects.armor! && tier('medium').effects.armor! > tier('light').effects.armor! && tier('light').effects.armor! > tier('cloth').effects.armor!);
  assert.ok(tier('cloth').effects.power! > 0 && tier('light').effects.dodge! > 0);
});

test('every weapon has a range on the battle map: a spear or polearm reaches further than a sword, a bow far further', () => {
  for (const it of ITEMS.filter((i) => i.slot === 'weapon')) assert.ok((it.effects.range ?? 0) > 0, `${it.id} has a range`);
  const rangeOf = (fam: string) => FAMILIES[fam as keyof typeof FAMILIES].range;
  assert.ok(rangeOf('sp') > rangeOf('sw') && rangeOf('pl') > rangeOf('sw'), 'long hafts reach further for a melee weapon');
  assert.ok(rangeOf('dg') <= rangeOf('sw'), 'a dagger is at arm\'s length');
  assert.ok(rangeOf('lb') > rangeOf('bw') && rangeOf('bw') > rangeOf('sp'), 'a longbow outreaches a bow, a bow a spear');
  for (const [k, f] of Object.entries(FAMILIES)) if (f.ranged) assert.ok(f.range >= 2.5, `${k} shoots from range`);
  // what someone in hand reaches: a weapon's range; a shooter with nothing to shoot fights up close (an archer can't
  // shoot without a bow: data/armed.ts), a mage casts; bare hands, arm's length
  const p = makePerson(new Rng(5), 1, 'hunter', { x: 0, y: 0 }, []);
  p.gear = {};
  assert.equal(weaponRange(p), UNARMED_RANGE);
  assert.equal(weaponRange(p, true), UNARMED_RANGE);
  p.gear.weapon = 'spear';
  assert.equal(weaponRange(p), ITEM_BY_ID.spear.effects.range);
  p.gear.weapon = 'bow';
  assert.equal(weaponRange(p, true), ITEM_BY_ID.bow.effects.range);
});

test('an archer needs a bow: without one they fight up close and use no skills; casters need nothing in hand', async () => {
  const { personFighter, UNARMED_MULT } = await import('../src/shared/sim/combat');
  const { kitOf } = await import('../src/shared/sim/actions');
  const { armedForSkills } = await import('../src/shared/data/armed');
  const p = makePerson(new Rng(7), 1, 'hunter', { x: 0, y: 0 }, []);
  p.cls = 'archer';
  p.level = 20;
  p.gear = {};
  assert.equal(armedForSkills('archer', null), false);
  assert.equal(personFighter(p, 'fighter', 'back').ranged, false, 'no bow, no shooting');
  assert.ok(!kitOf(p)!.actions.some((a) => !a.spell), 'no bow, no skills');
  p.gear.weapon = 'bow';
  assert.ok(armedForSkills('archer', 'bow'));
  assert.equal(personFighter(p, 'fighter', 'back').ranged, true);
  assert.ok(kitOf(p)!.actions.some((a) => !a.spell), 'with the bow, the skills');
  // a mage casts with or without a staff
  p.cls = 'mage';
  p.gear = {};
  assert.ok(armedForSkills('mage', null));
  assert.equal(personFighter(p, 'fighter', 'back').ranged, true);
  // bare hands hit soft (but for a monk)
  assert.ok(UNARMED_MULT < 1);
  // and the first weapon needs no study: the throwing stick, made from the start
  assert.deepEqual(ITEM_BY_ID.throwing_stick.research, []);
});

test('the town makes a weapon for whoever has a calling and nothing to fight with', async () => {
  const { newGame } = await import('../src/shared/sim/state');
  const { Sim } = await import('../src/shared/sim/sim');
  const { TICKS_PER_DAY } = await import('../src/shared/sim/time');
  const s = newGame('arm-them');
  s.nextRaidTick = Infinity;
  const sim = new Sim(s);
  for (const p of s.people) p.cls = 'archer';
  let ordered = false;
  for (let t = 0; t < 3 * TICKS_PER_DAY && !ordered; t++) {
    sim.step();
    ordered = s.crafting.some((o) => ITEM_BY_ID[o.item]?.effects.ranged) || s.people.some((p) => !!p.gear.weapon && !!ITEM_BY_ID[p.gear.weapon]?.effects.ranged);
  }
  assert.ok(ordered, 'a ranged weapon was ordered or carried');
});
