import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hit as hitFx } from '../src/shared/data/effects';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { canPay, takeTurn, type Arena, type Combatant, type KitAction } from '../src/shared/sim/actions';
import { magicHourly } from '../src/shared/sim/magic';
import { hasMana, manaMax, manaNow, setMana } from '../src/shared/sim/mana';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type GameState, type Person } from '../src/shared/sim/state';
import { tacticsOrder, tacticsView, type Tactics } from '../src/shared/sim/tactics';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { personFighter } from '../src/shared/sim/combat';
import { plainGame } from './helpers';

const NO_PASSIVE = { damage: 0, power: 0, healing: 0, crit: 0, critDamage: 0, counter: 0, lifesteal: 0, thorns: 0, guard: 0, resist: 0, regen: 0, lastStand: 0, firstStrike: false };
const wave = (cost: number): KitAction => ({ id: 'test_wave', name: 'Test Wave', spell: true, level: 1, cooldown: 0, ready: 0, effects: [hitFx(1, 'fire', 'foes')], use: 'attack', cost, pool: 'mp' });

function town(seed: string, n = 5): GameState {
  const s = plainGame(seed);
  s.battles = true;
  s.battleStyle = 'tactics';
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.people[0].priorities.defend = 1;
  for (let i = 0; i < n - 1; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
    p.priorities.defend = 1;
    p.skills.melee.level = 8;
    p.cls = 'mage';
    s.people.push(p);
  }
  return s;
}

function boardNow(seed: string) {
  const s = town(seed, 4);
  s.autopilot = true;
  s.tacticsAuto = false;
  s.raidOdds = { streak: 3 };
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(5));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const rng = new Rng(11);
  updateRaid(s, rng);
  return { s, r, t: r.tactics as Tactics, rng };
}
const run = (s: GameState, rng: Rng, ticks: number, until?: () => boolean) => {
  for (let i = 0; i < ticks && s.raid && !until?.(); i++) {
    s.tick++;
    updateRaid(s, rng);
  }
};

test('a caster has a pool; a spell they can\'t pay for is not cast, and they strike instead', () => {
  const s = town('mana-pool', 2);
  const p = s.people[1];
  assert.ok(hasMana(p) && manaMax(p) > 0);
  assert.equal(manaNow(p), manaMax(p), 'full when never spent');
  assert.equal(hasMana(s.people[0]) || s.people[0].cls === null, s.people[0].cls === null ? false : hasMana(s.people[0]));
  const f = personFighter(p, 'fighter', 'back');
  f.kit = { actions: [wave(10)], passive: NO_PASSIVE };
  f.mp = 5;
  assert.equal(canPay(f, f.kit.actions[0]), false, 'five mana does not pay for ten');
  const foe = { ...personFighter(s.people[0], 'fighter', 'front'), side: 'enemy' as const, ref: 999, kind: 'bandit' };
  const arena: Arena = { tick: 1, all: () => [f, foe], rng: new Rng(1), summon: () => null, log: () => {} };
  const hp = foe.hp;
  assert.equal(takeTurn(arena, f as Combatant), false, 'no spell without the mana');
  assert.equal(foe.hp, hp);
  f.mp = 20;
  assert.equal(takeTurn(arena, f as Combatant), true, 'with it, cast');
  assert.equal(f.mp, 10, 'and paid for');
});

test('mana is charged on the raid board, from the caster\'s own pool, and a dry caster can\'t cast there', () => {
  const { s, r, t, rng } = boardNow('mana-board');
  run(s, rng, 3000, () => !!t.await);
  assert.ok(t.await, 'a turn waits on the player');
  const me = t.units.find((u) => u.key === t.await!.key)!;
  const p = s.people.find((q) => `p${q.id}` === me.key)!;
  assert.ok(hasMana(p));
  me.kit = { ...(me.kit ?? { actions: [], passive: NO_PASSIVE }), actions: [wave(12)] };
  const at: [number, number] = [Math.max(0, me.u - 3), me.v];
  const foes = t.units.filter((u) => u.foe);
  foes.forEach((f, i) => ([f.u, f.v] = i === 0 ? at : [0, (i * 2) % t.h]));
  delete t.tiles[at[1] * t.w + at[0]].block;
  // dry: no cast
  setMana(p, 3);
  assert.equal(tacticsOrder(s, { op: 'skill', skill: 'test_wave', at }), false, 'three mana does not pay for twelve');
  // with mana: cast, and charged
  setMana(p, 40);
  const before = manaNow(p);
  assert.ok(tacticsOrder(s, { op: 'skill', skill: 'test_wave', at }), 'cast');
  run(s, rng, 60, () => !!t.await?.acted);
  assert.ok(manaNow(p) <= before - 12 + 1e-9, `charged (${before} → ${manaNow(p)})`);
  // the board shows it
  const view = tacticsView(s)!;
  const u = view.units.find((x) => x.key === me.key)!;
  assert.equal(u.mpMax, manaMax(p));
  assert.ok(u.mp !== null && u.mp <= manaMax(p));
  void r;
});

test('spent mana comes back by the hour out of a fight, and the snapshot carries it for the bars', () => {
  const s = town('mana-rest', 2);
  const p: Person = s.people[1];
  setMana(p, 0);
  s.tick = TICKS_PER_HOUR * 10;
  magicHourly(s);
  assert.ok(manaNow(p) > 0, 'some back after an hour');
  for (let i = 0; i < 24; i++) {
    s.tick += TICKS_PER_HOUR;
    magicHourly(s);
  }
  assert.equal(manaNow(p), manaMax(p), 'full again in a day');
  assert.equal(p.mana, undefined, 'and left out of the save while full');
  setMana(p, 5);
  const v = snapshot(s).people.find((q) => q.id === p.id)!;
  assert.deepEqual(v.mana, [5, manaMax(p)]);
});

test('a focus widens the pool', () => {
  const s = town('mana-focus', 2);
  const p = s.people[1];
  const bare = manaMax(p);
  p.gear.charm = 'ley_crystal';
  assert.ok(manaMax(p) > bare);
});
