import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORLD_WIDTH } from '../src/shared/constants';
import { ENEMIES } from '../src/shared/data/enemies';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { ORIGINS } from '../src/shared/data/origins';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { RIVALS } from '../src/shared/data/rivals';
import { bossesInRaid } from '../src/shared/sim/bosses';
import { defenderAttack, maybeStartRaid, startRaid } from '../src/shared/sim/raids';
import { heldBack, hexOn, rivalsInRaid } from '../src/shared/sim/rivals';
import { newGame, type GameState, type Raid } from '../src/shared/sim/state';
import { snapshot } from '../src/shared/sim/snapshot';
import { TICK_HZ, TICKS_PER_DAY } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

/** A rival raid in town: the army and its lord on the map, near the first townsperson. */
function rivalRaid(s: GameState, kind: string, seed = 1): Raid {
  const r = startRaid(s, RAID_KIND_BY_ID[kind], 40, new Rng(seed));
  r.phase = 'active';
  s.raid = r;
  const x = s.people[0].x;
  r.raiders.forEach((q, i) => (q.x = Math.max(0, Math.min(WORLD_WIDTH, x + 30 + i * 6))));
  return r;
}

/** Run the lord's spells for so many seconds. */
function castFor(s: GameState, r: Raid, seconds: number, seed = 1): void {
  const rng = new Rng(seed);
  for (let i = 0; i < seconds * TICK_HZ; i++) {
    s.tick++;
    rivalsInRaid(s, r, rng);
  }
}

test('every origin but the settlers is a rival: an army, a lord with a trophy, spells that exist', () => {
  for (const id of ORIGINS) {
    if (id === 'settlers') continue;
    const rv = RIVALS[id];
    const kind = RAID_KIND_BY_ID[rv.raid];
    assert.ok(kind, id);
    assert.equal(kind.origin, id);
    assert.equal(kind.leader, rv.leader);
    for (const e of Object.keys(kind.enemies)) assert.ok(ENEMIES[e], `${id}: ${e}`);
    const lord = ENEMIES[rv.leader];
    assert.ok(lord?.kit, id);
    assert.ok(ITEM_BY_ID[lord.kit!.trophy]?.relic, `${id} trophy`);
    assert.ok(rv.spells.length >= 2, id);
    for (const sp of rv.spells) if (sp.summons) assert.ok(ENEMIES[sp.summons], sp.id);
  }
});

test('a rival army always marches behind its lord, and the lord grows stronger with the days', () => {
  const s = plainGame('lich-army');
  const r = startRaid(s, RAID_KIND_BY_ID.rival_lich, 40, new Rng(1));
  const lord = r.raiders.find((q) => q.kind === 'lich_lord');
  assert.ok(lord);
  assert.ok(r.raiders.length > 1, 'and an army');
  const later = plainGame('lich-army-later');
  later.tick = 20 * TICKS_PER_DAY;
  const r2 = startRaid(later, RAID_KIND_BY_ID.rival_lich, 40, new Rng(1));
  assert.ok(r2.raiders.find((q) => q.kind === 'lich_lord')!.maxHp > lord!.maxHp);
});

test('a rival never raids a town founded its own way', () => {
  const s = newGame('own-kind', { origin: 'lich' });
  s.tick = 12 * TICKS_PER_DAY;
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    s.raid = null;
    s.prompts = [];
    s.nextRaidTick = 0;
    maybeStartRaid(s, new Rng(i));
    seen.add(s.raid!.kind);
  }
  assert.ok(!seen.has('rival_lich'), 'no lich raid on a lich town');
  assert.ok([...seen].some((k) => k.startsWith('rival_')), `other rivals come: ${[...seen].join(', ')}`);
});

test('the Lich Lord drains the living, and raises its fallen dead', () => {
  const s = plainGame('drain');
  const r = rivalRaid(s, 'rival_lich');
  const lord = r.raiders.find((q) => q.kind === 'lich_lord')!;
  lord.hp = 100;
  const hp = s.people.map((p) => p.hp);
  const troop = r.raiders.find((q) => q.kind !== 'lich_lord')!;
  troop.down = true;
  troop.hp = 0;
  castFor(s, r, 30);
  assert.ok(s.people.some((p, i) => p.hp < hp[i]), 'someone was drained');
  assert.ok(lord.hp > 100, 'and the lord fed on it');
  assert.equal(troop.down, false, 'the fallen rose');
  assert.ok(lord.lastCast! > 0);
});

test('the Archdruid roots the defenders: held, they often lose their strike', () => {
  const s = plainGame('entangle');
  const r = rivalRaid(s, 'rival_druid');
  const p = s.people[0];
  p.task = { type: 'defend', cooldown: 0 } as never;
  castFor(s, r, 8);
  assert.ok(hexOn(s, 'hold'), 'Entangle is on');
  const rng = new Rng(3);
  let lost = 0;
  for (let i = 0; i < 200; i++) if (heldBack(s, p, rng)) lost++;
  assert.ok(lost > 80 && lost < 160, `lost ${lost} of 200`);
  // and it wears off
  s.tick += 60 * TICK_HZ;
  assert.ok(!hexOn(s, 'hold'));
});

test("the Overmind's EMP stops machines dead, and a ward turns the defenders' blows", () => {
  const s = newGame('emp', { origin: 'robot' });
  const r = rivalRaid(s, 'rival_robot');
  const p = s.people[0];
  p.task = { type: 'defend', cooldown: 0 } as never;
  r.hex = { emp: { until: s.tick + 100, name: 'EMP' } };
  const rng = new Rng(4);
  for (let i = 0; i < 20; i++) assert.ok(heldBack(s, p, rng), 'a machine never strikes in an EMP');
  // a warded raider takes less
  const k = plainGame('ward');
  const r2 = rivalRaid(k, 'rival_knights');
  const foe = r2.raiders[0];
  const fighter = k.people[0];
  fighter.skills.melee.level = 20;
  const hit = (warded: boolean) => {
    r2.hex = warded ? { ward: { until: k.tick + 1000, name: 'Shield Wall' } } : {};
    let total = 0;
    for (let i = 0; i < 400; i++) {
      foe.hp = foe.maxHp = 10_000;
      defenderAttack(k, fighter, foe, new Rng(i));
      total += 10_000 - foe.hp;
    }
    return total;
  };
  assert.ok(hit(true) < hit(false) * 0.75);
});

test('a rival lord slain leaves its trophy', () => {
  const s = plainGame('slain');
  const r = rivalRaid(s, 'rival_dwarves');
  const lord = r.raiders.find((q) => q.kind === 'thane')!;
  lord.down = true;
  bossesInRaid(s, r);
  assert.equal(s.items.thane_hammer, 1);
});

test('every spell has a look, and casting one leaves it for the renderer: from the caster, onto what it touched', async () => {
  const { LOOKS } = await import('../src/renderer/town/spellLooks');
  const { POWERS, castPowers } = await import('../src/shared/sim/powers');
  for (const id of Object.keys(POWERS)) assert.ok(LOOKS[`town:${id}`], `town:${id}`);
  for (const rv of Object.values(RIVALS)) for (const sp of rv.spells) assert.ok(LOOKS[`rival:${sp.id}`], `rival:${sp.id}`);
  // a rival lord's drain: from the lord, onto the townsfolk it drained
  const s = plainGame('spell-fx');
  const r = rivalRaid(s, 'rival_lich');
  castFor(s, r, 10);
  const fx = s.spellFx!.find((f) => f.spell === 'rival:drain_life')!;
  assert.ok(fx, 'the drain was recorded');
  assert.equal(fx.by?.id, r.raiders.find((q) => q.kind === 'lich_lord')!.id);
  assert.ok(fx.targets.length && fx.targets.every((t) => s.people.some((p) => p.id === t.id)));
  // the town's own: an alchemist's flask, thrown at the raiders
  const a = newGame('flask-fx', { origin: 'alchemists' });
  const ra = rivalRaid(a, 'rival_knights');
  a.tick = 10;
  castPowers(a, new Rng(3));
  const flask = a.spellFx!.find((f) => f.spell === 'town:volatile_flask')!;
  assert.ok(flask.targets.length > 0 && flask.targets.every((t) => t.raider && ra.raiders.some((q) => q.id === t.id)));
  assert.ok(snapshot(a).spells.some((v) => v.spell === 'town:volatile_flask' && v.name === 'Volatile Flask'));
});
