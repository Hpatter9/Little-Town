import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { DESTINATIONS } from '../src/shared/data/expeditions';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { bossArrives, bossesInRaid, bossSlain } from '../src/shared/sim/bosses';
import { startBattle, stepBattle } from '../src/shared/sim/combat';
import { startRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { makePerson, maxHp } from '../src/shared/sim/state';
import { mood } from '../src/shared/sim/townsfolk';
import { TICK_HZ } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

test('every epic boss with a trophy has one that exists, and a lair to face it in', () => {
  // (a dungeon's bosses carry none: they guard its hoard)
  const kits = Object.values(ENEMIES).filter((e) => e.kit?.trophy);
  assert.ok(kits.length >= 9);
  for (const e of kits) assert.ok(ITEM_BY_ID[e.kit!.trophy!]?.relic, `${e.id} -> ${e.kit!.trophy}`);
  for (const id of ['dragon', 'iron_colossus', 'war_machine', 'star_mech', 'black_knight']) assert.ok(DESTINATIONS.some((d) => d.encounters.groups.some((g) => g.enemies[id])), id);
});

test('in battle a dragon breathes fire on several at once, and rages below half health', () => {
  const s = plainGame('dragon');
  const party = [0, 1, 2].map((i) => makePerson(new Rng(i + 5), 100 + i, 'hunter', { x: 0, y: 0 }, []));
  for (const p of party) {
    p.skills.melee.level = 15;
    p.gear = { weapon: 'iron_sword', body: 'chainmail' };
    p.hp = maxHp(p);
  }
  const rng = new Rng(7);
  const b = startBattle(party, {}, { dragon: 1 }, rng);
  const dragon = b.fighters.find((f) => f.kind === 'dragon')!;
  // (turn-based fights take longer: one action a beat)
  for (let i = 0; i < 180 * TICK_HZ && !b.outcome; i++) stepBattle(b, rng, { retreatAt: 0, mainId: null });
  assert.ok(b.shouts?.some((t) => /breathes fire/.test(t)), 'fire breath');
  assert.ok(dragon.enraged || dragon.down, 'it raged (or fell first)');
  void s;
});

test('the Black Knight calls his men at half health; a boss in town roars, and its death brings a trophy and triumph', () => {
  const s = plainGame('knight');
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  r.phase = 'active';
  const knight = { ...r.raiders[0], id: s.nextId++, kind: 'black_knight', hp: 100, maxHp: ENEMIES.black_knight.hp };
  r.raiders.push(knight);
  bossArrives(s, 'black_knight');
  assert.ok(mood(s, s.people[0]).reasons.some((x) => x.text === 'A monster at the gates'));
  const before = r.raiders.length;
  bossesInRaid(s, r);
  assert.ok(knight.enraged);
  assert.equal(r.raiders.length, before + 2, 'two sworn men');
  knight.down = true;
  bossesInRaid(s, r);
  assert.equal(s.items.black_blade, 1);
  assert.ok(mood(s, s.people[0]).reasons.some((x) => /Slew The Black Knight/.test(x.text)));
  bossSlain(s, 'not_a_boss'); // (harmless)
});

test('an epic boss fights to the death in a raid; ordinary raiders run when badly hurt', async () => {
  const { updateRaid } = await import('../src/shared/sim/raids');
  const s = plainGame('no-retreat');
  const wave = startRaid(s, RAID_KIND_BY_ID.bandits, 20, new Rng(2));
  wave.phase = 'active';
  const knight = { ...wave.raiders[0], id: s.nextId++, kind: 'black_knight', hp: 30, maxHp: ENEMIES.black_knight.hp, goal: 'harm' as const };
  wave.raiders.push(knight);
  const bandit = wave.raiders[0];
  bandit.hp = 2;
  for (let i = 0; i < 3; i++) {
    s.tick++;
    updateRaid(s, new Rng(i));
  }
  assert.equal(bandit.fleeing, true, 'the bandit runs');
  assert.equal(knight.fleeing, false, 'the Black Knight stands and fights');
});
