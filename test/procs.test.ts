import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hit, inflict } from '../src/shared/data/effects';
import { Rng } from '../src/shared/rng';
import { strike, useAction, type Arena, type Combatant, type Kit, type KitAction } from '../src/shared/sim/actions';
import { blowNote, hitDamage } from '../src/shared/sim/combat';

// Why a blow landed as it did is told to the watcher (`pop.why`: a "Crit!", "Block", "Reflect" over the one it touched),
// and the telling draws nothing from the dice.

const passive = (o: Partial<Kit['passive']> = {}): Kit['passive'] => ({ damage: 0, power: 0, healing: 0, crit: 0, critDamage: 0, counter: 0, lifesteal: 0, thorns: 0, guard: 0, resist: 0, regen: 0, lastStand: 0, firstStrike: false, ...o });
const fighter = (side: Combatant['side'], ref: number, o: Partial<Combatant> = {}): Combatant => ({ side, ref, kind: 'bandit', name: 'X', hp: 500, maxHp: 500, down: false, damage: [10, 10], accuracy: 2, dodge: 0, armor: 0, interval: 10, cooldown: 0, ranged: false, ...o });
const arena = (all: Combatant[], seed = 3): Arena => ({ tick: 50, all: () => all, rng: new Rng(seed), summon: () => null, log: () => {} });
const act = (effects: KitAction['effects'], spell = true): KitAction => ({ id: 'x', name: 'X', spell, level: 1, cooldown: 0, ready: 0, effects, use: 'attack', cost: 0, pool: 'mp' });

test('a true strike is told as a crit; a shield soaking a blow, as the shield', () => {
  const me = fighter('party', 1, { kit: { actions: [], passive: passive({ crit: 1 }) } });
  const foe = fighter('enemy', 2);
  assert.ok(useAction(arena([me, foe]), me, act([hit(1, 'fire')])));
  assert.equal(foe.pop?.why, 'crit');
  const plain = fighter('party', 3, { kit: { actions: [], passive: passive() } });
  const guarded = fighter('enemy', 4, { st: { shield: { until: 999, power: 999 } } });
  const a = arena([plain, guarded]);
  strike(a, plain, guarded, 30, true);
  assert.equal(guarded.pop?.why, 'shield');
  assert.equal(guarded.pop?.amount, 0);
});

test('a spell sent back is told over its caster; thorns over the striker; a hold shaken off as resisted', () => {
  const caster = fighter('party', 1);
  const mirror = fighter('enemy', 2, { st: { reflect: { until: 999, power: 1 } } });
  strike(arena([caster, mirror]), caster, mirror, 20, false);
  assert.equal(caster.pop?.why, 'reflect');
  const brute = fighter('party', 3);
  const thorny = fighter('enemy', 4, { kit: { actions: [], passive: passive({ thorns: 0.5 }) } });
  strike(arena([brute, thorny]), brute, thorny, 20, true);
  assert.equal(brute.pop?.why, 'thorns');
  // (a hardy foe shakes off the stun: resist 0.9 holds nine times in ten, so over several tries at least once)
  let resisted = false;
  for (let seed = 1; seed < 12 && !resisted; seed++) {
    const hexer = fighter('party', 5);
    const stout = fighter('enemy', 6, { kit: { actions: [], passive: passive({ resist: 1 }) } });
    useAction(arena([hexer, stout], seed), hexer, act([inflict('stun', 3)]));
    resisted = stout.pop?.why === 'resist' && !stout.st?.stun;
  }
  assert.ok(resisted);
});

test('a plain blow notes its crit and its block, and the dice fall the same with or without the note', () => {
  const f = { damage: [10, 10] as [number, number], ammo: 0, ammoBonus: 0, ammoUsed: 0, beastDamage: 0, quirks: { crit: 1, pierce: 0, cleave: 0, stun: 0, undead: 0, machine: 0 } };
  const target = { kind: 'bandit', armor: 0, block: 0, tough: false };
  assert.ok(hitDamage(f, target, new Rng(5)) >= 20);
  assert.equal(blowNote.why, 'crit');
  assert.equal(hitDamage({ ...f, quirks: undefined }, { ...target, block: 1 }, new Rng(5)), 0);
  assert.equal(blowNote.why, 'block');
  // (the same seed, the same draws: the note reads, it never rolls)
  const r1 = new Rng(8);
  const r2 = new Rng(8);
  hitDamage(f, target, r1);
  hitDamage(f, target, r2);
  assert.equal(r1.next(), r2.next());
});
