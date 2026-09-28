import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canTrain, classAllies, train } from '../src/shared/sim/classes';
import { startBattle, stepBattle } from '../src/shared/sim/combat';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { maxHp, type Building, type GameState } from '../src/shared/sim/state';
import { TICK_HZ } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

const campfire = (s: GameState) => s.buildings.find((b) => b.def === 'campfire') as Building;

test('training a class needs its research, a master of the skill, and the materials (which it uses up)', () => {
  const s = plainGame('train');
  const p = s.people[0];
  assert.match(canTrain(s, p, 'beast_tamer').reason!, /research/i);
  s.research.done.push('beast_lore');
  p.skills.animals.level = 5;
  assert.match(canTrain(s, p, 'beast_tamer').reason!, /Animal Handling 6/);
  p.skills.animals.level = 6;
  assert.match(canTrain(s, p, 'beast_tamer').reason!, /meat/);
  campfire(s).store = { meat: 22, hide: 11 };
  assert.equal(train(s, p.id, 'beast_tamer').ok, true);
  assert.equal(p.cls, 'beast_tamer');
  assert.deepEqual(campfire(s).store, { meat: 2, hide: 1 });
  assert.equal(canTrain(s, p, 'summoner').ok, false, 'one class each');
});

test('callings are rare: one of each in a town, and each asks its deed first', () => {
  const s = plainGame('deeds');
  const [a] = s.people;
  const b = { ...structuredClone(a), id: s.nextId++, name: 'Other', cls: null };
  s.people.push(b);
  s.research.done.push('beast_lore', 'necromancy', 'summoning', 'blood_oath');
  for (const p of [a, b]) for (const k of ['animals', 'research', 'melee'] as const) p.skills[k].level = 8;
  campfire(s).store = { meat: 50, hide: 30 };
  s.buildings.push({ id: s.nextId++, def: 'stockpile', tile: campfire(s).tile + 4, status: 'done', delivered: {}, progress: 1, store: { bone: 30, herbs: 30, fiber: 20 } } as Building);

  // one of each
  assert.equal(train(s, a.id, 'beast_tamer').ok, true);
  assert.match(canTrain(s, b, 'beast_tamer').reason!, /already has a Beast Tamer: /);

  // the Necromancer: the town must have buried its dead
  assert.match(canTrain(s, b, 'necromancer').reason!, /buried 0/);
  s.burials = 3;
  assert.equal(canTrain(s, b, 'necromancer').ok, true);

  // the Summoner: gives up a Spirit Totem
  assert.match(canTrain(s, b, 'summoner').reason!, /Spirit Totem/);
  s.items.spirit_totem = 1;
  assert.equal(train(s, b.id, 'summoner').ok, true);
  assert.equal(s.items.spirit_totem ?? 0, 0, 'the totem is given up');

  // the Blood Knight: only the blooded
  const c = { ...structuredClone(a), id: s.nextId++, name: 'Third', cls: null, scarred: false };
  s.people.push(c);
  assert.match(canTrain(s, c, 'blood_knight').reason!, /never been cut down/);
  c.scarred = true;
  assert.equal(canTrain(s, c, 'blood_knight').ok, true);
});

test('in battle: a summoner brings a spirit, a necromancer raises the fallen, a blood knight heals as they hit', () => {
  const s = plainGame('battle-classes');
  const [p] = s.people;
  p.skills.melee.level = 12;
  p.hp = maxHp(p);
  p.cls = 'summoner';
  assert.equal(classAllies([p])[0].kind, 'spirit');

  p.cls = 'necromancer';
  p.gear = { weapon: 'iron_sword', body: 'chainmail' };
  const rng = new Rng(4);
  const b = startBattle([p], {}, { wolf: 2 }, rng);
  for (let i = 0; i < 90 * TICK_HZ && !b.outcome; i++) stepBattle(b, rng, { retreatAt: 0, mainId: null });
  assert.ok(b.fighters.some((f) => f.kind === 'wolf' && f.side === 'party'), 'a fallen wolf rose for us: ' + b.outcome + ' ' + JSON.stringify(b.fighters.map((f) => [f.kind, f.side, f.hp, f.down, f.cls])));

  p.cls = 'blood_knight';
  p.hp = maxHp(p) / 3;
  const b2 = startBattle([p], {}, { boar: 1 }, rng);
  const knight = b2.fighters.find((f) => f.kind === 'person')!;
  const hp0 = knight.hp;
  let healed = false;
  for (let i = 0; i < 60 * TICK_HZ && !b2.outcome; i++) {
    stepBattle(b2, rng, { retreatAt: 0, mainId: null });
    if (knight.hp > hp0) healed = true;
  }
  assert.ok(healed, 'the blood knight healed by hitting');
});

test('in a raid at home, a beast tamer turns a wolf against the pack', () => {
  const s = plainGame('tamer');
  const p = s.people[0];
  p.cls = 'beast_tamer';
  const rng = new Rng(2);
  const r = startRaid(s, RAID_KIND_BY_ID.wolves, 40, rng);
  r.phase = 'active';
  for (const w of r.raiders) w.x = p.x + 40;
  s.tick = 0;
  for (let i = 0; i < 25 * TICK_HZ && s.raid; i++) {
    s.tick++;
    updateRaid(s, rng);
  }
  assert.ok(r.raiders.some((w) => w.ally), 'one was tamed');
});
