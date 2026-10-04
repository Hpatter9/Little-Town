import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GREAT_BEAST, HUNT_DEST, packDestId, RIVAL_PACKS } from '../src/shared/data/pack';
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { destinationOf, destinationUnlocked } from '../src/shared/sim/expeditions';
import { fullMoon } from '../src/shared/sim/monsters';
import { breakPack, challenge, checkGreatHunt, packBossSlain, packHome, packRaidBeaten, packState, packView } from '../src/shared/sim/pack';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type Expedition, type Raid } from '../src/shared/sim/state';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';

const pack = (seed = 'pack') => newGame(seed, { origin: 'werewolf' });

test('the Moon Pack is all werewolves, with the rival packs\' lairs on its board and a hunt of its own', () => {
  const s = pack();
  assert.ok(s.people.length >= 3);
  for (const p of s.people) assert.equal(p.monster, 'werewolf', `${p.name} runs with the pack`);
  for (const r of RIVAL_PACKS) {
    const d = destinationOf(s, packDestId(r.id))!;
    assert.ok(d, r.id);
    assert.equal(d.type, 'clear');
    assert.ok(destinationUnlocked(s, d), `${r.name} stands`);
    assert.ok(ENEMIES[r.alphaId]?.boss, `${r.alpha} is a boss`);
    assert.ok(RAID_KIND_BY_ID[`pack_${r.id}`], 'and raids');
    assert.equal(RAID_KIND_BY_ID[`pack_${r.id}`].weight, 0, 'never rolled on its own');
  }
  assert.equal(destinationOf(s, HUNT_DEST)?.type, 'hunt');
  assert.ok(ENEMIES[GREAT_BEAST]?.boss);
  // (no other town has any of it)
  const other = newGame('settlers');
  assert.equal(destinationOf(other, packDestId('ash')), undefined);
  assert.equal(packView(other), null);
});

test('under the full moon the pack runs out to hunt, a guard left at the den', () => {
  const sim = new Sim(pack('hunt'));
  const s = sim.state;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  // (a few more of the pack, so a guard can stay)
  for (let i = 0; i < 4; i++) {
    const q = { ...s.people[1], id: s.nextId++, name: `Wolf ${i}`, carrying: {}, task: null, recent: [] };
    s.people.push(q);
  }
  // the first full-moon night, at the hunt's hour
  let t = 0;
  while (!(calendar(t).hour === 21 && (() => { s.tick = t; return fullMoon(s); })())) t += TICKS_PER_HOUR;
  s.tick = t;
  s.autopilot = false;
  for (let i = 0; i < TICKS_PER_HOUR + 2; i++) sim.step();
  const hunt = s.expeditions.find((e) => e.hunt);
  assert.ok(hunt, 'the hunt is out');
  assert.equal(hunt.dest, HUNT_DEST);
  assert.ok(hunt.members.length >= 2 && hunt.members.length < s.people.length, 'some stay home');
  assert.equal(hunt.members[0], s.mainId, 'the Alpha leads');
  // home again: renown
  packHome(s, hunt, new Rng(1));
  assert.equal(packState(s).hunts, 1);
  assert.equal(packState(s).renown, 1);
});

test('a rival pack broken at its lair joins the town; one broken at the gate does not; both are hunting grounds', () => {
  const s = pack('broken');
  const rng = new Rng(3);
  const before = s.people.length;
  const e = { dest: packDestId('ash'), cleared: true, recalled: false, loot: {}, members: [] } as unknown as Expedition;
  packHome(s, e, rng);
  const p = packState(s);
  assert.deepEqual(p.broken, ['ash']);
  assert.equal(p.grounds, 1);
  assert.ok(s.people.length > before, 'survivors came over');
  assert.ok(s.people.slice(before).every((q) => q.monster === 'werewolf'));
  assert.equal(p.renown, 6);
  assert.ok(!destinationUnlocked(s, destinationOf(s, packDestId('ash'))!), 'off the board now');
  const raid = { kind: 'pack_redfang', raiders: [{ down: true }, { down: true }] } as unknown as Raid;
  packRaidBeaten(s, raid, rng);
  assert.deepEqual(p.broken, ['ash', 'redfang']);
  assert.equal(p.grounds, 2);
  // (beaten once is beaten)
  breakPack(s, 'redfang', rng, true);
  assert.equal(p.grounds, 2);
});

test('the Great Hunt: every pack broken and the Pale Behemoth slain wins the game', () => {
  const s = pack('hunted');
  const rng = new Rng(5);
  for (const r of RIVAL_PACKS) breakPack(s, r.id, rng, false);
  assert.equal(s.gameOver, null, 'the beast still runs');
  packBossSlain(s, GREAT_BEAST);
  const over = (s as { gameOver: { won?: boolean; text: string } | null }).gameOver;
  assert.ok(over?.won, 'won');
  assert.match(over!.text, /Great Hunt/);
  checkGreatHunt(s);
});

test('one who outgrows the Alpha may challenge them the morning after the moon; the winner leads', () => {
  const s = pack('alpha');
  const alpha = s.people.find((p) => p.id === s.mainId)!;
  const rival = s.people.find((p) => p !== alpha)!;
  rival.level = (alpha.level ?? 1) + 10;
  rival.skills.melee.level = 8;
  let changed = 0;
  let fought = 0;
  for (let i = 0; i < 12; i++) {
    const t = pack(`alpha${i}`);
    const a = t.people.find((p) => p.id === t.mainId)!;
    const r = t.people.find((p) => p !== a)!;
    r.level = (a.level ?? 1) + 10;
    r.skills.melee.level = 8;
    challenge(t, new Rng(i));
    if (packState(t).lastChallenge !== undefined) {
      fought++;
      if (t.mainId === r.id) changed++;
      assert.ok(a.hp <= a.hp && (t.mainId === r.id ? a.hp < 40 : r.hp < 40), 'the loser is bloodied');
    }
  }
  assert.ok(fought >= 4, `challenges are made (${fought})`);
  assert.ok(changed >= 1, `and sometimes won (${changed})`);
  // (never twice in quick succession)
  challenge(s, new Rng(1));
  const first = packState(s).lastChallenge;
  const main = s.mainId;
  challenge(s, new Rng(2));
  assert.equal(packState(s).lastChallenge, first);
  assert.equal(s.mainId, main);
});
