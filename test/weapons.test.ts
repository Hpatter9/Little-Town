import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS, ITEM_BY_ID, STATIONS } from '../src/shared/data/items';
import { MATERIALS } from '../src/shared/data/materials';
import { gradeOf, MAX_PLUS, piece, pieceLabel, plusMult, plusOf, rollPlus } from '../src/shared/data/quality';
import { TOPICS } from '../src/shared/data/research';
import { FAMILIES, tierDamage } from '../src/shared/data/weapons';
import { Rng } from '../src/shared/rng';
import { afterBlow, hitDamage, weaponOf } from '../src/shared/sim/combat';
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
  const master = count(20);
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
  const p = makePerson(new Rng(1), 1, 'hunter', 0, []);
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
