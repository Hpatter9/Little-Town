import assert from 'node:assert/strict';
import { test } from 'node:test';
import { killPerson, knockDown } from '../src/shared/sim/health';
import { startRaid, townEdgeX, updateRaid } from '../src/shared/sim/raids';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, type Building, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';
import { caveBear, caveBearBeaten } from '../src/shared/sim/caveBear';
import { totalStock } from '../src/shared/sim/buildings';

function town(seed: string): GameState {
  const s = plainGame(seed);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < 3; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', 3200 + i * 20, s.people.map((p) => p.name)));
  return s;
}

test('someone downed in town bleeds out if nobody tends them; the founder is carried to safety', () => {
  const s = town('bleed');
  const sim = new Sim(s);
  const [founder, a, b, c] = s.people;
  knockDown(s, founder);
  assert.equal(founder.downed?.bleedUntil, null, 'the founder never bleeds out in town');
  founder.hp = -1e6; // (so they stay down for this test, instead of getting up to tend the others)
  knockDown(s, a);
  knockDown(s, b);
  s.people = s.people.filter((p) => p !== c); // (nobody left standing to tend them)
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) sim.step();
  const alive = new Set(s.people.map((p) => p.id));
  assert.ok(alive.has(founder.id));
  assert.ok(!alive.has(a.id) && !alive.has(b.id), 'both bled out');
  assert.ok(s.notices.some((n) => n.text.includes('died of their wounds')));
});

test('a poultice in storage gets someone back up, and then they tend the others', () => {
  const s = town('poultice');
  const sim = new Sim(s);
  const [founder, a, b, c] = s.people;
  knockDown(s, founder);
  founder.hp = -1e6;
  knockDown(s, a);
  knockDown(s, b);
  s.people = s.people.filter((p) => p !== c);
  s.items.poultice = 1;
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) sim.step();
  assert.equal(s.items.poultice ?? 0, 0);
  assert.ok(s.people.includes(a) || s.people.includes(b), 'the poultice saved at least one');
});

test('someone free goes to tend the bleeding: skill decides it, a failed try costs the patient time, a dressing always works', () => {
  const s = town('tend');
  const sim = new Sim(s);
  const [founder, nurse, hurt] = s.people;
  s.people = s.people.slice(0, 3);
  founder.x = 200; // (far off: the nurse gets there first)
  nurse.skills.medicine.level = 9;
  nurse.x = hurt.x + 60;
  knockDown(s, hurt);
  for (let i = 0; i < TICKS_PER_HOUR && hurt.downed?.bleedUntil != null; i++) sim.step();
  assert.equal(hurt.downed?.bleedUntil, null, 'a skilled nurse stops the bleeding');
  assert.ok(s.notices.some((n) => n.text.includes(`${nurse.name} stopped ${hurt.name}'s bleeding`)));
  assert.ok(nurse.skills.medicine.xp > 0 || nurse.skills.medicine.level > 9, 'and learns from it');

  // a clumsy one with a bandage in storage: it works first time
  const t = town('tend-bandage');
  const sim2 = new Sim(t);
  const [founder2, clumsy, hurt2] = t.people;
  t.people = t.people.slice(0, 3);
  founder2.x = 200;
  clumsy.skills.medicine.level = 0;
  t.items.bandage = 1;
  knockDown(t, hurt2);
  for (let i = 0; i < TICKS_PER_HOUR && hurt2.downed?.bleedUntil != null; i++) sim2.step();
  assert.equal(hurt2.downed?.bleedUntil, null);
  assert.equal(t.items.bandage ?? 0, 0);
});

test('a killer finishes off the fallen at its feet when nobody else is in reach', () => {
  const s = town('finish');
  const wave = startRaid(s, RAID_KIND_BY_ID.wolves, 8, new Rng(3));
  wave.phase = 'active';
  const victim = s.people[1];
  const wolf = wave.raiders[0];
  wave.raiders.splice(1);
  s.people = [s.people[0], victim];
  s.people[0].x = 100; // (the founder is far away)
  victim.x = 3000;
  wolf.x = 3005;
  knockDown(s, victim);
  for (let i = 0; i < 400 && s.people.includes(victim); i++) {
    s.tick++;
    wolf.x = 3005;
    updateRaid(s, new Rng(i));
  }
  assert.ok(!s.people.includes(victim), 'killed where they lay');
  assert.ok(s.notices.some((n) => n.text.includes('at the hands of the Wolf')));
});

test('after a raid an infirmary gets every one of the fallen to safety; without one some are left bleeding', () => {
  const run = (infirmary: boolean) => {
    let left = 0;
    for (let k = 0; k < 8; k++) {
      const s = town(`tend-${k}`);
      if (infirmary) s.buildings.push({ id: s.nextId++, def: 'infirmary', tile: 90, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
      const wave = startRaid(s, RAID_KIND_BY_ID.wolves, 8, new Rng(k));
      wave.phase = 'active';
      for (const p of s.people.slice(1)) knockDown(s, p);
      for (const rd of wave.raiders) rd.gone = true; // (they've all gone: the raid ends)
      s.tick++;
      updateRaid(s, new Rng(k));
      left += s.people.filter((p) => p.downed?.bleedUntil != null).length;
    }
    return left;
  };
  assert.equal(run(true), 0);
  assert.ok(run(false) > 0);
});

test('once every raider is running off empty-handed the alarm drops (so the wounded can be tended); thieves are still chased', async () => {
  const { alarmRaised } = await import('../src/shared/sim/people');
  const s = town('alarm');
  const wave = startRaid(s, RAID_KIND_BY_ID.wolves, 8, new Rng(4));
  wave.phase = 'active';
  assert.equal(alarmRaised(s), true);
  for (const rd of wave.raiders) rd.fleeing = true;
  assert.equal(alarmRaised(s), false);
  wave.raiders[0].carrying = { meat: 3 };
  assert.equal(alarmRaised(s), true, 'after the thief!');
});

test('after the game is over, the "while you were away" report can still be put away', () => {
  const s = town('over-away');
  const sim = new Sim(s);
  s.unreadAway = 1;
  s.gameOver = { tick: s.tick, text: 'The end.' };
  sim.command({ type: 'dismissAway' });
  sim.command({ type: 'setPaused', paused: true });
  sim.step();
  assert.equal(s.unreadAway, null);
  assert.ok(!s.paused, '(other commands do nothing once it is over)');
});

test('the starving waste away and die of hunger; a meal stops it', async () => {
  const { heal } = await import('../src/shared/sim/health');
  const s = town('hunger');
  const [, a, b] = s.people;
  a.needs.food = 0;
  b.needs.food = 0;
  const hp = a.hp;
  for (let i = 0; i < TICKS_PER_HOUR; i++) heal(s, a);
  assert.ok(a.hp < hp - 1 && a.hp > hp - 2, 'lost a little over 1 an hour');
  assert.ok(s.notices.some((n) => n.text.includes(`${a.name} is starving`)), 'and the town is warned');
  b.hp = 1;
  for (let i = 0; i < TICKS_PER_HOUR; i++) heal(s, b);
  assert.ok(!s.people.includes(b), 'died');
  assert.ok(s.notices.some((n) => n.text.includes('died of hunger')));
  a.needs.food = 1;
  const mid = a.hp;
  for (let i = 0; i < TICKS_PER_HOUR; i++) heal(s, a);
  assert.ok(a.hp > mid, 'fed, they heal again');
});

test('hungry with nothing in storage, people pick wild berries to eat (and leave the trees standing)', () => {
  const s = town('scrounge');
  const sim = new Sim(s);
  s.people = s.people.slice(0, 1);
  const p = s.people[0];
  for (const b of s.buildings) b.store = {};
  const i = s.tiles.findIndex((_, k) => Math.abs(k - Math.floor(s.tiles.length / 2)) < 8);
  s.tiles[i].terrain = 'forest';
  s.tiles[i].pool = { wood: 10, berries: 3 };
  p.needs.food = 0.1;
  for (let t = 0; t < TICKS_PER_HOUR && p.needs.food < 0.5; t++) sim.step();
  assert.ok(p.needs.food >= 0.5, `ate (food ${p.needs.food})`);
  assert.equal(s.tiles[i].terrain, 'forest', 'the tree still stands');
  assert.equal(s.tiles[i].pool.wood, 10);
});

test("the Bear Cave's totem is never dropped or thrown out, even with storage full", async () => {
  const { discardStock, storages } = await import('../src/shared/sim/buildings');
  const s = town('totem');
  const sim = new Sim(s);
  s.people = s.people.slice(0, 2);
  const st = storages(s)[0];
  st.store = { stone: 5000 };
  s.buildings.push({ id: s.nextId++, def: 'lean_to', tile: 90, status: 'blueprint', delivered: {}, progress: 0, store: {} } as Building);
  const p = s.people[1];
  p.carrying = { totem: 1, hide: 5 };
  for (let i = 0; i < 50; i++) sim.step();
  assert.equal(p.carrying.totem, 1, 'still holding the totem');
  st.store.totem = 1;
  assert.equal(discardStock(s, st.id, 'totem'), 0);
  assert.equal(st.store.totem, 1);
});

test("the Hunter's Guild finishes off only monsters, never the ordinary folk they knock down", () => {
  const run = (monster: boolean) => {
    const s = town(`guild-${monster}`);
    const wave = startRaid(s, RAID_KIND_BY_ID.hunters, 20, new Rng(3));
    wave.phase = 'active';
    wave.raiders.splice(1);
    const hunter = wave.raiders[0];
    const victim = s.people[1];
    s.people = [s.people[0], victim];
    s.people[0].x = 100;
    if (monster) victim.monster = 'vampire';
    victim.x = 3000;
    knockDown(s, victim);
    for (let i = 0; i < 400 && s.people.includes(victim); i++) {
      s.tick++;
      hunter.x = 3005;
      hunter.fleeing = false;
      updateRaid(s, new Rng(i));
    }
    return s.people.includes(victim);
  };
  assert.equal(run(false), true, 'an ordinary townsperson is left lying');
  assert.equal(run(true), false, 'a vampire is not');
});

test("a Healer's Hut (Neolithic) slows the bleeding, but only an infirmary brings everyone in after a raid", () => {
  const s = town('hut');
  s.buildings.push({ id: s.nextId++, def: 'healers_hut', tile: 90, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
  const p = s.people[1];
  knockDown(s, p);
  assert.equal(p.downed?.bleedUntil, s.tick + 3 * TICKS_PER_HOUR, 'three hours instead of two');
  const wave = startRaid(s, RAID_KIND_BY_ID.wolves, 8, new Rng(1));
  wave.phase = 'active';
  for (const rd of wave.raiders) rd.gone = true;
  s.tick++;
  updateRaid(s, new Rng(2));
  assert.notEqual(p.downed?.bleedUntil, null, 'still needs tending');
});

test('picking the last berries off a tile with nothing else on it clears it (so gathering there never breaks)', () => {
  const s = town('bare');
  const sim = new Sim(s);
  s.people = s.people.slice(0, 2);
  for (const b of s.buildings) b.store = {};
  const i = s.tiles.findIndex((_, k) => Math.abs(k - Math.floor(s.tiles.length / 2)) < 8);
  s.tiles[i].terrain = 'forest';
  s.tiles[i].pool = { berries: 2 };
  s.tiles[i].designated = true;
  s.people[0].needs.food = 0.1;
  for (let t = 0; t < TICKS_PER_HOUR; t++) sim.step();
  assert.equal(s.tiles[i].terrain, 'clear');
  assert.equal(s.tiles[i].designated, false);
});

test('a skilled healer a little further off goes to the wounded, rather than a clumsy neighbour', () => {
  const s = town('who-tends');
  const sim = new Sim(s);
  const [founder, clumsy, healer, hurt] = s.people;
  founder.x = 200;
  hurt.x = 3000;
  clumsy.x = 3030;
  clumsy.skills.medicine.level = 0;
  healer.x = 3150;
  healer.skills.medicine.level = 8;
  knockDown(s, hurt);
  for (let i = 0; i < 30; i++) sim.step();
  assert.equal(healer.task?.type, 'tend');
  assert.notEqual(clumsy.task?.type, 'tend');
});

test('the "while you were away" report names everyone lost, first', async () => {
  const { catchUp } = await import('../src/shared/sim/offline');
  const s = town('away-dead');
  const sim = new Sim(s);
  const [, a] = s.people;
  s.people = s.people.slice(0, 2);
  s.people[0].x = 100;
  a.hp = 0;
  a.downed = { bleedUntil: s.tick + 10 };
  catchUp(sim, 3 * 3600 * 1000);
  const report = s.journal.find((e) => e.lines);
  assert.ok(report, 'a report');
  assert.equal(report!.lines![0], `Lost while you were away: ${a.name} (of their wounds).`);
});

test("the founder's death passes the town to an heir (their partner first); only with no grown-up left is it over", () => {
  const s = plainGame('succession');
  const founder = s.people[0];
  const rng = new Rng(3);
  const a = makePerson(rng, s.nextId++, 'wanderer', founder.x, [founder.name]);
  const b = makePerson(rng, s.nextId++, 'wanderer', founder.x, [founder.name, a.name]);
  const kid = makePerson(rng, s.nextId++, 'wanderer', founder.x, [founder.name, a.name, b.name]);
  kid.bornTick = s.tick;
  s.people.push(a, b, kid);
  founder.partner = b.id;
  killPerson(s, founder, 'of a fever');
  assert.equal(s.gameOver, null);
  assert.equal(s.mainId, b.id, 'the partner leads');
  assert.ok(s.marks?.some((m) => m.lever === 'morale' && m.value < 0), 'the town mourns');
  killPerson(s, b, 'in a raid');
  assert.equal(s.mainId, a.id);
  killPerson(s, a, 'of hunger');
  assert.ok(s.gameOver, 'a child alone cannot keep the town');
});

test('with the Elder\'s Council learned and no totem fetched, the Cave Bear comes down for it; killed, it gives it up', () => {
  const s = plainGame('cave-bear');
  const rng = new Rng(5);
  s.research.done.push('elders_council');
  s.tick = TICKS_PER_HOUR * 10;
  caveBear(s, rng);
  assert.ok(s.caveBearTick, 'its clock starts');
  s.tick = s.caveBearTick!;
  caveBear(s, rng);
  assert.equal(s.raid?.kind, 'cave_bear');
  for (const rd of s.raid!.raiders) rd.down = true;
  caveBearBeaten(s, s.raid!);
  assert.equal(totalStock(s).totem, 1);
  s.raid = null;
  caveBear(s, rng);
  assert.equal(s.caveBearTick, undefined, 'with the totem in hand it stays in its cave');
  // (nor does it come while a party is on its way to the cave)
  const t = plainGame('cave-bear-party');
  t.research.done.push('elders_council');
  t.expeditions.push({ dest: 'bear_cave' } as never);
  t.tick = TICKS_PER_HOUR * 10;
  caveBear(t, rng);
  assert.equal(t.caveBearTick, undefined);
});

test('defenders hold the edge of the town: they go no further out after the raiders', () => {
  const sim = new Sim(plainGame('hold-the-edge'));
  const s = sim.state;
  const p = s.people[0];
  p.priorities.defend = 1;
  const wave = startRaid(s, RAID_KIND_BY_ID.wolves, 8, new Rng(3));
  wave.phase = 'active';
  wave.raiders.splice(1);
  const wolf = wave.raiders[0];
  const edge = townEdgeX(s, 1);
  // (a wolf prowling well outside the town, never coming nearer)
  let furthest = -Infinity;
  for (let i = 0; i < 600; i++) {
    wolf.x = edge + 400;
    wolf.dir = -1;
    sim.step();
    if (!s.raid) break;
    furthest = Math.max(furthest, p.x);
  }
  assert.ok(furthest <= edge + 1, `went out to ${Math.round(furthest)} past the edge at ${Math.round(edge)}`);
  assert.ok(furthest > edge - 3 * 32, 'but went to the edge to meet it');
});

test('a bigger town draws a bigger raid, and a big raid may split and come round the other side', () => {
  const s = plainGame('big-raid');
  for (let i = 0; i < 28; i++) s.people.push(makePerson(new Rng(i), s.nextId++, 'gatherer', s.people[0].x, s.people.map((p) => p.name)));
  s.tick = 15 * 24 * TICKS_PER_HOUR;
  const raid = startRaid(s, RAID_KIND_BY_ID.bandits, 999, new Rng(1));
  assert.ok(raid.raiders.length > 6 && raid.raiders.length <= 16, `${raid.raiders.length} raiders for a town of 29`);
  // (over a few raids, one splits: a party from the other end, which flees back that way)
  let split = false;
  for (let seed = 0; seed < 12 && !split; seed++) {
    s.raid = null;
    const r = startRaid(s, RAID_KIND_BY_ID.bandits, 999, new Rng(seed));
    const flank = r.raiders.filter((rd) => rd.side === -r.side);
    if (!flank.length) continue;
    split = true;
    assert.ok(flank.every((rd) => (r.side < 0 ? rd.x > 0 : rd.x < 0)), 'they start at the other end');
    assert.ok(s.prompts.find((p) => p.id === r.prompt)!.text.includes('more from the'), 'the warning says so');
  }
  assert.ok(split, 'some raid came round the other side');
});
