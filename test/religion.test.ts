// Religion and the gods made real: creeds and zeal, the gods' favour moved by followers, feast days and their own
// natures, omens and the greater wraths, the priests' work, miracles, the rival cult and its heresy trials, and the
// pilgrimage.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { FAITH_HOUR } from '../src/shared/data/gods';
import { CULT_ALTAR, FEAST_DAYS, GOD_IDOL, MIRACLE_AT, OMEN_AT, WRATH_GAP_DAYS } from '../src/shared/data/religion';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { faithOf } from '../src/shared/sim/faith';
import { killPerson } from '../src/shared/sim/health';
import { readNews } from '../src/shared/sim/gossip';
import { politicsOf } from '../src/shared/sim/politics';
import { startRaid } from '../src/shared/sim/raids';
import {
  actsInNature, answerReligion, creedOf, creedLine, faithDiaryLine, greatWrath, isPilgrimDest, pickCreed, pilgrimHome, priestDuty, religionHourly, religionOf,
  religionTick, religionView, standingOf,
} from '../src/shared/sim/religion';
import { totalStock } from '../src/shared/sim/buildings';
import { makePerson, type GameState, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR, calendarOf } from '../src/shared/sim/time';
import { plainGame, put, row, camp } from './helpers';

/** The tick of an hour on a day (day 1 first). */
const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

/** A self-running town of `n` grown-ups (pious unless told otherwise). */
function town(seed: string, n = 8, nature: Person['nature'] = 'pious'): GameState {
  const s = plainGame(seed);
  const rng = new Rng(7);
  const c = s.people[0];
  while (s.people.length < n) {
    const p = makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 6, y: c.y }, s.people.map((q) => q.name));
    p.nature = nature;
    s.people.push(p);
  }
  s.autopilot = true;
  s.coins = 200;
  return s;
}

/** A temple, its priest the second townsperson. */
function temple(s: GameState): Person {
  const b = put(s, 'temple', camp(s).x + 4, row(s));
  b.operator = s.people[1].id;
  return s.people[1];
}

/** The town's dawn on a day. */
function dawn(s: GameState, day: number): void {
  s.tick = at(day, FAITH_HOUR);
  religionHourly(s);
}

test('everyone comes to a creed of their own, the same every time, and a child takes a parent\'s', () => {
  const a = town('rel-creed');
  const b = town('rel-creed');
  dawn(a, 2);
  dawn(b, 2);
  for (const p of a.people) assert.ok(p.creed, `${p.name} has a creed`);
  assert.deepEqual(a.people.map((p) => [p.creed, p.zeal]), b.people.map((p) => [p.creed, p.zeal]));
  // (the pious come zealous)
  // (the pious come zealous: a godless one who has just found a god starts lower)
  const pious = a.people.filter((p) => p.nature === 'pious').map((p) => pickCreed(a, p)).filter((c) => c.creed !== 'none');
  assert.ok(pious.length && pious.every((c) => c.zeal >= 50), 'the pious are zealous');
  const child = makePerson(new Rng(3), a.nextId++, 'gatherer', { x: 0, y: 0 }, []);
  const parent = a.people.find((p) => p.creed !== 'none' && p.creed !== 'cult')!;
  child.parents = [parent.id];
  assert.equal(pickCreed(a, child).creed, parent.creed);
  // (the menus' view never changes the town)
  const fresh = town('rel-creed-view');
  const before = fresh.people.map((p) => p.creed);
  religionView(fresh);
  creedLine(fresh, fresh.people[2]);
  assert.deepEqual(fresh.people.map((p) => p.creed), before);
});

test('a god nobody follows loses favour; one with zealous followers gains it', () => {
  const s = town('rel-follow');
  put(s, 'wayside_shrine', camp(s).x + 4, row(s)); // (the gods ask nothing of a camp with no altar)
  for (const p of s.people) {
    p.creed = 'harvest';
    p.zeal = 90;
  }
  const f = faithOf(s);
  f.favour = { harvest: 0, hearth: 0, war: 0, sky: 0 };
  dawn(s, 2);
  assert.ok(f.favour.harvest > 0, `followed: ${f.favour.harvest}`);
  assert.ok(f.favour.war < 0, `unfollowed: ${f.favour.war}`);
  assert.ok(f.favour.harvest - f.favour.war >= 10, 'the zealously followed god is far better pleased');
});

test('a feast day kept with a priest pleases the god and lifts the town; let pass, the god is slighted', () => {
  const kept = town('rel-feast');
  temple(kept);
  const missed = town('rel-feast');
  put(missed, 'wayside_shrine', camp(missed).x + 4, row(missed)); // (an altar, but nobody to keep the feast)
  const day = FEAST_DAYS[0]; // (the harvest god's, in the first season)
  for (const s of [kept, missed]) {
    for (const p of s.people) (p.creed = 'harvest'), (p.zeal = 50);
    faithOf(s).favour = { harvest: 0, hearth: 0, war: 0, sky: 0 };
    s.tick = at(day, FAITH_HOUR);
    assert.equal(calendarOf(s).dayOfSeason, day);
    religionHourly(s);
  }
  assert.ok(faithOf(kept).favour.harvest - faithOf(missed).favour.harvest >= 20, `${faithOf(kept).favour.harvest} vs ${faithOf(missed).favour.harvest}`);
  assert.ok((kept.marks ?? []).some((m) => /feast day/.test(m.text)), 'the town keeps the feast');
  assert.ok(religionOf(missed).log.some((e) => /unkept/.test(e.text)));
});

test('each god acts in its nature: hungry mouths anger the harvest god, a lost raid the war god', () => {
  const s = town('rel-nature');
  for (const p of s.people) p.starving = true;
  s.raidRecap = { tick: 5, outcome: 'pillaged' } as GameState['raidRecap'];
  const acts = actsInNature(s);
  assert.ok(acts.harvest < 0);
  assert.ok(acts.war < 0);
  assert.equal(actsInNature(s).war, 0, 'a raid counts once');
});

test('a wrathful god sends an omen first, and only then its greater wrath', () => {
  const s = town('rel-omen');
  temple(s);
  const f = faithOf(s);
  f.favour = { harvest: 0, hearth: 0, war: 0, sky: -90 };
  dawn(s, 2);
  const rel = religionOf(s);
  assert.ok(rel.omens.sky !== undefined, 'an omen came');
  assert.ok(rel.log.some((e) => e.kind === 'omen'));
  assert.ok(!rel.log.some((e) => e.kind === 'wrath'), 'no wrath before the omen');
  // (after the omen, the greater wrath comes within some days)
  let day = 3;
  while (!rel.log.some((e) => e.kind === 'wrath') && day < 40) {
    f.favour.sky = -90;
    dawn(s, day++);
  }
  assert.ok(rel.log.some((e) => e.kind === 'wrath'), 'the storm came');
  assert.ok(OMEN_AT > -90);
});

test('greater wraths never chain: all gods furious, no two wraths within WRATH_GAP_DAYS', () => {
  const s = town('rel-gap', 12);
  temple(s);
  const f = faithOf(s);
  const rel = religionOf(s);
  const falls: number[] = [];
  for (let day = 2; day < 80; day++) {
    f.favour = { harvest: -90, hearth: -90, war: -90, sky: -90 };
    const before = rel.log.filter((e) => e.kind === 'wrath').length;
    dawn(s, day);
    for (const p of s.people) { p.hp = 1000; p.sick = null; }
    s.raid = null;
    if (rel.log.filter((e) => e.kind === 'wrath').length > before || rel.lastWrath === s.tick) falls.push(day);
  }
  assert.ok(falls.length >= 3, `wraths fell ${falls.length} times`);
  for (let i = 1; i < falls.length; i++) assert.ok(falls[i] - falls[i - 1] >= WRATH_GAP_DAYS, `days ${falls[i - 1]} and ${falls[i]} too close`);
});

test('the greater wraths bite: a cursed harvest rots the stores, a plague kills, the war god sends wolves', () => {
  const s = town('rel-wrath', 10);
  const camp0 = s.buildings.find((b) => b.def === 'campfire')!;
  camp0.store = { grain: 1000 };
  greatWrath(s, 'harvest', new Rng(1));
  assert.ok((totalStock(s).grain ?? 0) <= 700, `rotted: ${totalStock(s).grain}`);
  // (a thin store is left alone: the curse takes the plenty, not the last crust)
  camp0.store = { grain: 20 };
  greatWrath(s, 'harvest', new Rng(1));
  assert.equal(totalStock(s).grain, 20);
  const before = s.people.length;
  greatWrath(s, 'hearth', new Rng(2));
  assert.equal(s.people.length, before - 1, 'the plague took someone');
  assert.ok(s.people.filter((p) => p.sick).length >= 2, 'and others are ill');
  assert.equal(s.raid, null);
  greatWrath(s, 'war', new Rng(3));
  const raid = s.raid as GameState['raid'];
  assert.equal(raid?.kind, 'wolves', 'wolves are sent');
});

test('a hearth god well pleased may spare the dying (a miracle), and an idol is raised; never from old age or the rope', () => {
  let spared = 0;
  for (let k = 0; k < 30 && !spared; k++) {
    const s = town(`rel-spare-${k}`);
    faithOf(s).favour.hearth = 100;
    s.tick = at(3, 12);
    const p = s.people[3];
    killPerson(s, p, 'at the hands of the bandits');
    if (s.people.includes(p)) {
      spared++;
      assert.ok(p.hp > 0 && !p.downed);
      assert.ok(religionOf(s).miracles.some((m) => m.kind === 'spared'));
      assert.ok(s.buildings.some((b) => b.def === GOD_IDOL), 'an idol raised');
      // (one miracle at a time: the next to fall dies)
      const q = s.people[4];
      killPerson(s, q, 'at the hands of the bandits');
      assert.ok(!s.people.includes(q));
    }
  }
  assert.ok(spared, 'someone was spared');
  const s = town('rel-spare-never');
  faithOf(s).favour.hearth = 100;
  const p = s.people[3];
  killPerson(s, p, 'of old age, full of days');
  assert.ok(!s.people.includes(p));
  const h = faithOf(s).favour.hearth;
  killPerson(s, s.people[3], 'hanged by the town');
  assert.ok(faithOf(s).favour.hearth < h, 'the rope angers the hearth god');
  // (and with the autopilot off, nothing)
  const off = town('rel-spare-off');
  off.autopilot = false;
  faithOf(off).favour.hearth = 100;
  for (const q of off.people.slice(2, 8)) killPerson(off, q, 'in a fall');
  assert.equal(off.people.length, 2);
});

test('the priest blesses the defenders when raiders are sighted, and a sky god may scatter them with a storm', () => {
  const s = town('rel-raid');
  temple(s);
  faithOf(s).favour.war = 20;
  startRaid(s, RAID_KIND_BY_ID.wolves, 40, new Rng(5));
  religionTick(s);
  assert.ok((s.marks ?? []).some((m) => m.lever === 'fight' && /Blessed/.test(m.text)), 'the defenders are blessed');
  let scattered = false;
  for (let k = 0; k < 30 && !scattered; k++) {
    const t = town(`rel-storm-${k}`);
    faithOf(t).favour.sky = 100;
    startRaid(t, RAID_KIND_BY_ID.wolves, 60, new Rng(k));
    const came = t.raid!.raiders.length;
    religionTick(t);
    if (t.raid!.raiders.length < came) {
      scattered = true;
      assert.ok(religionOf(t).miracles.some((m) => m.kind === 'storm'));
      assert.ok(religionOf(t).recapNote, 'the recap will tell of it');
    }
  }
  assert.ok(scattered, 'a storm scattered a raid');
  assert.ok(MIRACLE_AT <= 100);
});

test('a starving town may be fed by a harvest god not ill-disposed', () => {
  let fed = false;
  for (let day = 2; day < 30 && !fed; day++) {
    const s = town('rel-famine');
    for (const p of s.people) p.starving = true;
    faithOf(s).favour.harvest = 40;
    dawn(s, day);
    if ((totalStock(s).grain ?? 0) > 0) {
      fed = true;
      assert.ok(religionOf(s).miracles.some((m) => m.kind === 'famine'));
    }
  }
  assert.ok(fed);
});

test('a priest keeps the dawn rite at the altar', () => {
  const s = town('rel-priest');
  const pr = temple(s);
  s.tick = at(2, FAITH_HOUR);
  assert.equal(priestDuty(s, pr)?.type, 'officiate');
  assert.equal(priestDuty(s, s.people[2]), null, 'only the priest');
  s.tick = at(2, 13);
  assert.equal(priestDuty(s, pr), null, 'only at dawn');
});

test('a rival cult rises among the doubting, is put to the town, and its leader may be tried for heresy', () => {
  let s: GameState | null = null;
  for (let k = 0; k < 40 && !s; k++) {
    const t = town(`rel-cult-${k}`, 10, 'gloomy');
    for (const p of t.people) {
      p.morale = 20;
      p.zeal = 10;
    }
    faithOf(t).favour = { harvest: -20, hearth: -20, war: -20, sky: -20 };
    for (let day = 2; day < 60 && !religionOf(t).cult; day++) {
      for (const p of t.people) p.morale = 20;
      dawn(t, day);
    }
    if (religionOf(t).cult) s = t;
  }
  assert.ok(s, 'a cult rose');
  const rel = religionOf(s);
  assert.ok(s.people.some((p) => p.creed === 'cult'));
  assert.ok(s.buildings.some((b) => b.def === CULT_ALTAR), 'its altar stands');
  const ask = s.prompts.find((q) => q.ways?.system === 'religion');
  assert.ok(ask, 'the town is asked');
  answerReligion(s, ask, 0);
  const pol = politicsOf(s);
  assert.equal(pol.trial?.crime, 'heresy', 'a heresy trial');
  assert.ok(s.prompts.some((q) => q.politics === 'trial' && /heresy/.test(q.story ?? '')));
  // the cult gone, its altar comes down
  for (const p of s.people) if (p.creed === 'cult') p.creed = 'none';
  dawn(s, 70);
  assert.equal(rel.cult, undefined);
  assert.ok(!s.buildings.some((b) => b.def === CULT_ALTAR));
});

test('once a temple stands the priest leads a pilgrimage, and the pilgrims home please every god', () => {
  const s = town('rel-pilgrim');
  const pr = temple(s);
  for (const p of s.people) p.creed = 'sky';
  s.tick = at(2, 9);
  religionHourly(s);
  const e = s.expeditions.find((x) => isPilgrimDest(x.dest));
  assert.ok(e, 'the pilgrims set out');
  assert.equal(e.members[0], pr.id);
  const f = faithOf(s);
  f.favour = { harvest: 0, hearth: 0, war: 0, sky: 0 };
  pilgrimHome(s, e, e.members.map((id) => s.people.find((p) => p.id === id)!));
  assert.ok(Object.values(f.favour).every((v) => v > 10));
});

test('faith shows in the diary, the gossip and the people\'s pages', () => {
  const s = town('rel-words');
  dawn(s, 2);
  const p = s.people.find((q) => q.creed !== 'none' && q.creed !== 'cult')!;
  assert.match(faithDiaryLine(s, p, 0.1) ?? '', /\w/);
  assert.equal(faithDiaryLine(s, p, 0.9), null);
  assert.match(creedLine(s, p), /^Follows /);
  assert.ok(['zealot', 'devout', 'follower', 'doubter'].includes(standingOf(s, p)));
  assert.equal(readNews('✨ A miracle: Ada lay dying at the hands of the bandits, and Hestia gave them back their breath.')?.kind, 'miracle');
  assert.equal(readNews('An omen: crows settle on every furrow. Ceres is angry with the town.')?.kind, 'omen');
  assert.equal(readNews('Ada has founded the cult of the Pale Eye.')?.kind, 'cult');
});

test('religion draws only from its own side stream, and sleeps with the autopilot off', () => {
  const s = town('rel-stream');
  temple(s);
  const rng0 = s.rngState;
  for (let d = 2; d < 12; d++) dawn(s, d);
  assert.equal(s.rngState, rng0);
  const off = town('rel-stream-off');
  off.autopilot = false;
  dawn(off, 2);
  assert.equal(off.religion, undefined);
  assert.ok(off.people.every((p) => p.creed === undefined));
  void creedOf;
});
