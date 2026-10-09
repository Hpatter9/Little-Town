// Townsfolk with more inner life: gossip about what really happened (sim/gossip.ts), today's diary (sim/diary.ts),
// the rain and the small scenes about town (sim/idleScenes.ts, sim/pastimes.ts, renderer/map/sceneMoments.ts).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NATURES } from '../src/shared/data/natures';
import { OPENERS, REPLIES, SAYINGS, TAKES } from '../src/shared/data/gossip';
import { DOINGS, VOICES } from '../src/shared/data/diary';
import { GOSSIP_HOURS, gossipLine, gossipReply, readNews, sayingOf, townGossip } from '../src/shared/sim/gossip';
import { diaryFacts, diaryTick, doingOf, firstPerson, writeDiary, DIARY_EVERY, type DiaryFacts } from '../src/shared/sim/diary';
import { benchSpot, eavesSpot, puddleSpot, RIVER_APART, RIVER_FROM, riverSpot, tagIt, tagTarget, TAG_RING, TAG_TURN } from '../src/shared/sim/idleScenes';
import { pastimeActivity, pastimeFor } from '../src/shared/sim/pastimes';
import { CELL, groundAt } from '../src/shared/sim/land';
import { campXY, maxHp, notify, type GameState, type Person } from '../src/shared/sim/state';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { weatherAt } from '../src/shared/sim/weather';
import { hooded, instrumentOf, sceneMoment, splashJump } from '../src/renderer/map/sceneMoments';
import { gossipNow, GOSSIP_SHARE } from '../src/renderer/map/speech';
import { plainGame, put, row } from './helpers';

function town(seed: string, n: number): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) {
    const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, partner: null };
    p.hp = maxHp(p);
    s.people.push(p);
  }
  return s;
}

/* ------------------------------------------------------------ gossip */

test('the journal is read into news: deaths, homecomings, the dragon, weddings, births, buildings', () => {
  assert.deepEqual(readNews('Hakon has died burned by Vermithrax the Red.'), { kind: 'death', who: 'Hakon', what: 'died burned by Vermithrax the Red' });
  assert.deepEqual(readNews('Nils has lost their right arm.'), { kind: 'maimed', who: 'Nils', what: 'their right arm' });
  assert.deepEqual(readNews('The Cave to the south-west party is back: empty-handed.'), { kind: 'back', what: 'the Cave to the south-west' });
  assert.equal(readNews('Vermithrax the Red sweeps low over the town breathing fire: the palisade wall burns.')?.kind, 'dragon');
  assert.deepEqual(readNews('Elka and Tam were married! The whole town celebrates.'), { kind: 'wedding', who: 'Elka and Tam' });
  assert.deepEqual(readNews('Elka and Tam welcomed a child, Pip.'), { kind: 'birth', who: 'Elka and Tam', what: 'Pip' });
  assert.deepEqual(readNews('Finished building: Monster Hunters\' Guild'), { kind: 'built', what: 'monster hunters\' guild' });
  assert.equal(readNews('Finished building: Palisade Wall'), null, 'a piece of wall is not news');
  assert.equal(readNews('🌊 The river is rising! The water is coming up over its banks.')?.kind, 'flood');
  assert.deepEqual(readNews('✨ Ceres, Mother of the Furrow, blessed the fields.'), { kind: 'blessing', what: 'fields' });
  assert.equal(readNews('Cave Bear is slain! The town takes Bearskin Cloak as a trophy.')?.what, 'the Cave Bear');
  assert.equal(readNews('The haggler: +8 coins.'), null);
});

test("the town's talk: the last day and a half's milestones, newest first, the party's leader named", () => {
  const s = plainGame('gossip-talk');
  notify(s, 'Doran gathers a party for the Barrow to the east.');
  s.tick += TICKS_PER_HOUR;
  notify(s, 'Finished building: Palisade Wall', true);
  notify(s, 'The Barrow to the east party is back: 6 cloth.', true);
  notify(s, 'Nils has died at the hands of a cave bear.', true);
  const g = townGossip(s.journal, s.tick);
  assert.equal(g[0].kind, 'death');
  assert.equal(g[1].kind, 'back');
  assert.equal(g[1].who, 'Doran', 'the homecoming names who led them out');
  assert.equal(g[1].what, 'the Barrow to the east');
  assert.equal(g.length, 2, 'the wall is no news, and the gathering of the party not a milestone');
  // stale news is forgotten
  assert.equal(townGossip(s.journal, s.tick + (GOSSIP_HOURS + 1) * TICKS_PER_HOUR).length, 0);
});

test('gossip told in each nature\'s voice, naming names, and answered to fit', () => {
  const death = { kind: 'death' as const, who: 'Tam', what: 'died at the hands of a wolf' };
  for (const n of NATURES) {
    assert.ok(OPENERS[n.id].length && TAKES[n.id].good.length && TAKES[n.id].bad.length, n.id);
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const line = gossipLine(death, n.id, r);
      assert.ok(OPENERS[n.id].some((o) => line.startsWith(o)), `${n.id} opens in their voice: ${line}`);
      assert.ok(line.includes('Tam'), `the news names who: ${line}`);
      assert.ok(!line.includes('{'), line);
      const reply = gossipReply(death, n.id, r);
      assert.ok(reply && !reply.includes('{'), reply);
    }
  }
  // the bad news is taken as bad, the good as good
  assert.ok(TAKES.gloomy.bad.includes(gossipReply(death, 'gloomy', 0.9)));
  assert.ok(TAKES.cheerful.good.includes(gossipReply({ kind: 'wedding', who: 'A and B' }, 'cheerful', 0.9)));
  // a saying that wants a name the news hasn't got is left out
  for (const r of [0, 0.5, 0.99]) assert.ok(!sayingOf({ kind: 'back', what: 'the Cave' }, r)!.includes('{'));
  for (const k of Object.keys(SAYINGS) as (keyof typeof SAYINGS)[]) assert.ok(SAYINGS[k].length && REPLIES[k].length, k);
});

test('gossip is told only with someone by, outside a raid, in about the share of slots meant', () => {
  const g = [{ id: 1, kind: 'death' as const, who: 'Tam' }];
  const c = { weather: 'clear', season: 'summer', hour: 12, raid: false, nearFriend: false, nearRival: false, nearChild: false, nearAnyone: true };
  let told = 0;
  for (let slot = 0; slot < 2000; slot++) if (gossipNow({ id: 7, activity: 'idle' }, slot, c, g)) told++;
  assert.ok(Math.abs(told / 2000 - GOSSIP_SHARE) < 0.06, `${told / 2000}`);
  assert.equal(gossipNow({ id: 7, activity: 'idle' }, 3, { ...c, nearAnyone: false }, g), null);
  for (let slot = 0; slot < 50; slot++) assert.equal(gossipNow({ id: 7, activity: 'idle' }, slot, { ...c, raid: true }, g), null);
  assert.equal(gossipNow({ id: 7, activity: 'idle' }, 3, c, []), null);
});

/* ------------------------------------------------------------ the diary */

const facts = (o: Partial<DiaryFacts> = {}): DiaryFacts => ({
  id: 4, name: 'Elka', nature: 'cheerful', day: 6, child: false, doing: [['chop', 5], ['haul', 1.5]], with: [{ name: 'Tam', tie: 'friend' }],
  done: ['Bought a spear at the shop for 12 coins'], morale: 72, up: 'A fine meal', down: null, wound: null, hungry: false, tired: false, sick: false,
  grief: null, partner: null, raid: null, talk: null, weather: 'clear', season: 'summer', roughNights: 0, ...o,
});

test('the diary is written from the day: the work, the company, what they did, how they feel', () => {
  const page = writeDiary(facts()).join(' ');
  assert.match(page, /felling trees/);
  assert.match(page, /Tam was beside me\. Good company\./);
  assert.match(page, /I bought a spear at the shop for 12 coins\./);
  assert.match(page, /What lifted me: a fine meal\./);
  assert.ok(VOICES.cheerful.close.some((c) => page.endsWith(c)), 'it ends in their voice');
  // a hard day reads hard
  const low = writeDiary(facts({ nature: 'gloomy', morale: 12, down: 'Slept on the ground (3 nights)', grief: 'Nils', wound: 'the cut on my left arm', hungry: true, roughNights: 3 })).join(' ');
  assert.match(low, /What weighs on me: slept on the ground \(3 nights\)\./);
  assert.match(low, /I keep thinking of Nils\./);
  assert.match(low, /The cut on my left arm still hurts\./);
  assert.match(low, /My belly is empty\./);
  assert.ok(VOICES.gloomy.low.some((l) => low.includes(l)));
  // a raid, a feast and the town's talk
  const big = writeDiary(facts({ raid: { fought: true, felled: 2, fell: false, outcome: 'victory' }, doing: [['build', 3], ['feast', 2]], talk: { id: 1, kind: 'death', who: 'Hakon', what: 'died burned by the dragon' } })).join(' ');
  assert.match(big, /Raiders came\. I fought and felled 2\. We drove them off\./);
  assert.match(big, /There was a feast/);
  assert.match(big, /Hakon/);
  assert.doesNotMatch(big, /hakon/, 'a name keeps its capital');
  // (over many days, the wedding is told with the names as they are)
  for (let day = 1; day < 30; day++) assert.doesNotMatch(writeDiary(facts({ day, talk: { id: 2, kind: 'wedding', who: 'Elka and Tam' } })).join(' '), /\belka\b/);
  // the same day reads the same all day; another nature reads differently
  assert.deepEqual(writeDiary(facts()), writeDiary(facts()));
  assert.notDeepEqual(writeDiary(facts()), writeDiary(facts({ nature: 'grumpy' })));
  for (const n of NATURES) for (const line of writeDiary(facts({ nature: n.id }))) assert.ok(line.length && !line.includes('{'), `${n.id}: ${line}`);
});

test("their notes in their own words: 'Bought...' becomes 'I bought...', 'Hired as...' 'I was hired as...'", () => {
  assert.equal(firstPerson('Bought a spear at the shop for 12 coins'), 'I bought a spear at the shop for 12 coins.');
  assert.equal(firstPerson('Hired as a guard (3 coins a day)'), 'I was hired as a guard (3 coins a day).');
  assert.equal(firstPerson('Took an order from Elka: a chair'), 'I took an order from Elka: a chair.');
  assert.equal(firstPerson('An evening at the Tavern: ale (3 coins)'), 'An evening at the Tavern: ale (3 coins).');
  assert.equal(firstPerson("Couldn't pay the rent (2 coins owed: 2 in all)"), "I couldn't pay the rent (2 coins owed: 2 in all).");
});

test('the day is counted a quarter-hour at a time, with who was beside them at the same thing', () => {
  const s = town('diary-count', 2);
  s.autopilot = undefined;
  const [a, b, c] = s.people;
  const tile = 0;
  a.task = { type: 'gather', tile, progress: 0 };
  a.activity = 'chop';
  b.task = { type: 'gather', tile, progress: 0 };
  b.activity = 'chop';
  [b.x, b.y] = [a.x + CELL, a.y];
  c.task = { type: 'research' };
  s.tick = DIARY_EVERY * 40;
  for (let i = 0; i < 8; i++) {
    diaryTick(s);
    s.tick += DIARY_EVERY;
  }
  assert.equal(doingOf(s, a), 'chop');
  assert.equal(a.diary?.hours.chop, 2);
  assert.equal(a.diary?.with[b.id], 2, 'b chopped beside them');
  assert.equal(a.diary?.with[c.id], undefined);
  assert.equal(c.diary?.hours.research, 2);
  const f = diaryFacts(s, a);
  assert.deepEqual(f.doing[0], ['chop', 2]);
  assert.equal(f.with[0].name, b.name);
  // the tests' plain town (no autopilot) counts nothing
  const p = plainGame('diary-off');
  p.tick = DIARY_EVERY;
  diaryTick(p);
  assert.equal(p.people[0].diary, undefined);
  for (const k of ['chop', 'eaves', 'tag', 'busk', 'pigeons', 'riverside', 'splash', 'feast']) assert.ok(DOINGS[k], k);
});

/* ------------------------------------------------------------ the rain and the small scenes */

/** A tick when it's raining (or not) at an hour, by the seed's weather. */
function weatherTick(s: GameState, wet: boolean, hour: number): number {
  for (let t = hour * TICKS_PER_HOUR; t < 6000 * TICKS_PER_HOUR; t += 24 * TICKS_PER_HOUR) {
    const k = weatherAt(s.seed, t, null).kind;
    if ((k === 'rain' || k === 'storm') === wet && (wet || k === 'clear' || k === 'cloudy')) return t - 6 * TICKS_PER_HOUR; // (START_HOUR)
  }
  throw new Error('no such day');
}

test('in the rain the grown-ups shelter under the eaves, the children splash in puddles', () => {
  const s = town('rainy-day', 3);
  const home = put(s, 'longhouse', campXY(s).x / CELL - 2, row(s));
  home.status = 'done';
  s.tick = weatherTick(s, true, 11);
  const [grown, kid] = s.people;
  kid.bornTick = s.tick - 10;
  const e = eavesSpot(s, grown)!;
  assert.ok(e, 'a roof near');
  const pt = pastimeFor(s, grown, 3)!;
  assert.equal(pt.pastime, 'eaves');
  assert.deepEqual({ x: pt.x, y: pt.y }, e);
  assert.equal(pastimeActivity('eaves'), 'idle');
  // a hamlet of two huddles where it is
  const rest = s.people.splice(2);
  assert.notEqual(pastimeFor(s, grown, 3)?.pastime, 'eaves');
  s.people.push(...rest);
  const k = pastimeFor(s, kid, 3)!;
  assert.equal(k.pastime, 'splash');
  assert.deepEqual({ x: k.x, y: k.y }, puddleSpot(s, kid, 3));
  assert.equal(pastimeActivity('splash'), 'play');
  // a hood up out in it, down under the eaves
  assert.equal(hooded('rain', false, undefined), true);
  assert.equal(hooded('storm', false, 'tag'), true);
  assert.equal(hooded('rain', false, 'eaves'), false);
  assert.equal(hooded('rain', true, undefined), false);
  assert.equal(hooded('clear', false, undefined), false);
});

test('tag: one is "it" and chases the nearest, the rest run away from them, and the roles go round', () => {
  const kids = [{ id: 3, x: 100, y: 100 }, { id: 5, x: 160, y: 100 }, { id: 9, x: 100, y: 300 }];
  const camp = { x: 120, y: 140 };
  assert.equal(tagIt(kids, 0), 3);
  assert.equal(tagIt(kids, TAG_TURN), 5);
  assert.equal(tagIt(kids, TAG_TURN * 2), 9);
  assert.equal(tagIt(kids.slice(0, 1), 0), null, 'no game alone');
  // "it" runs at the nearest
  const chase = tagTarget(kids[0], kids, 3, camp);
  assert.ok(chase.x > 160, 'past the nearest, to the right');
  // the others run from "it", within the ring about the camp
  const run = tagTarget(kids[1], kids, 3, camp);
  assert.ok(run.x > kids[1].x, 'away from "it"');
  for (let i = 0; i < 40; i++) {
    const me = { id: 5, x: camp.x + Math.cos(i) * TAG_RING * CELL, y: camp.y + Math.sin(i) * TAG_RING * CELL };
    const t = tagTarget(me, [kids[0], me], 3, camp);
    assert.ok(Math.hypot(t.x - camp.x, t.y - camp.y) < Math.hypot(me.x - camp.x, me.y - camp.y) + 3 * CELL, 'turned along the ring');
  }
  // two children at play on a dry day play tag (every other turn)
  const s = town('tag-day', 2);
  s.tick = weatherTick(s, false, 11);
  s.people[1].bornTick = s.tick - 10;
  s.people[2].bornTick = s.tick - 10;
  assert.equal(pastimeFor(s, s.people[1], 1)?.pastime, 'tag');
  assert.equal(pastimeActivity('tag'), 'play');
});

test('an elder feeds the pigeons on a bench, a busker plays in the square', () => {
  const s = town('scenes-day', 5);
  s.tick = weatherTick(s, false, 11);
  const elder = s.people[1];
  elder.grownAt = s.tick - 200 * 24 * TICKS_PER_HOUR; // (an elder by now)
  let fed = 0;
  for (let slot = 0; slot < 12; slot++) {
    const pt = pastimeFor(s, elder, slot);
    if (pt?.pastime === 'pigeons') {
      fed++;
      assert.deepEqual({ x: pt.x, y: pt.y }, benchSpot(s, elder));
    }
  }
  assert.ok(fed >= 3, `${fed}`);
  assert.equal(pastimeActivity('pigeons'), 'sit');
  // the busker: a jolly soul by day; one at a time
  const busker = s.people[2];
  busker.nature = 'jolly';
  let busked = 0;
  for (let slot = 0; slot < 12; slot++) if (pastimeFor(s, busker, slot)?.pastime === 'busk') busked++;
  assert.ok(busked >= 3, `${busked}`);
  // (no audience in a hamlet: no busker)
  const few = s.people.splice(3);
  for (let slot = 0; slot < 12; slot++) assert.notEqual(pastimeFor(s, busker, slot)?.pastime, 'busk', 'no busker in a hamlet');
  s.people.push(...few);
  busker.task = { type: 'idle', untilTick: s.tick + 100, pastime: 'busk' };
  const other = s.people[0];
  other.nature = 'jolly';
  for (let slot = 0; slot < 12; slot++) assert.notEqual(pastimeFor(s, other, slot)?.pastime, 'busk', 'one busker at a time');
  // the looks: the pigeons fed sat, a handful thrown now and then; the busker's instrument and notes; a jump in a puddle
  assert.equal(sceneMoment('pigeons', { id: 1, now: 2000, moving: false })?.step?.col, 7);
  assert.equal(sceneMoment('busk', { id: 2, now: 0, moving: false })?.prop, instrumentOf(2));
  assert.equal(sceneMoment('busk', { id: 2, now: 0, moving: true }), null, 'on the way, just walking');
  assert.equal(sceneMoment('riverside', { id: 2, now: 0, moving: false, water: 'left' })?.step?.facing, 'left', 'looking out over the water');
  let lifts = 0;
  for (let t = 0; t < 1100; t += 50) if (splashJump(4, t).lift > 0) lifts++;
  assert.ok(lifts > 3 && lifts < 20);
  // tag's calls: "it" calls out the chaser's lines
  const calls = new Set<string>();
  for (let t = 0; t < 60000; t += 300) {
    const m = sceneMoment('tag', { id: 3, now: t, moving: true, it: true });
    if (m?.line) calls.add(m.line);
  }
  assert.ok(calls.size >= 2);
});

test('a couple sits together by the water at dusk (not in winter), on a bank near the camp, side by side, each couple its own place', () => {
  let s: GameState | null = null;
  for (let i = 0; i < 30 && !s; i++) {
    const t = town(`riverside-${i}`, 1);
    if (riverSpot(t)) s = t;
  }
  assert.ok(s, 'a town with a bank near');
  const bank = riverSpot(s)!;
  const cx = Math.floor(bank.x / CELL);
  const cy = Math.floor(bank.y / CELL);
  const wet = (x: number, y: number) => ['water', 'shallows'].includes(groundAt(s!.land, x, y));
  assert.ok(!wet(cx, cy) && (wet(cx, cy - 1) || wet(cx - 1, cy) || wet(cx + 1, cy)), 'a dry cell with water beside it');
  // another couple sits elsewhere along the bank (or at the one place there is)
  const spots = [0, 1, 2, 3].map((k) => riverSpot(s!, k)!);
  for (const p of spots) for (const q of spots) if (p !== q && (p.x !== q.x || p.y !== q.y)) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= RIVER_APART * CELL - 1, 'couples spread along the bank');
  const [a, b] = s.people;
  a.partner = b.id;
  b.partner = a.id;
  // a fair dusk on an evening that's theirs
  let tick = weatherTick(s, false, RIVER_FROM);
  while ((calendar(tick).day + Math.min(a.id, b.id)) % 2 !== 0 || weatherAt(s.seed, tick, null).kind === 'rain' || weatherAt(s.seed, tick, null).kind === 'storm' || weatherAt(s.seed, tick, null).kind === 'snow' || calendar(tick).season === 'winter') tick += 24 * TICKS_PER_HOUR;
  s.tick = tick;
  const pa = pastimeFor(s, a, 1)!;
  const pb = pastimeFor(s, b, 1)!;
  assert.equal(pa.pastime, 'riverside');
  assert.equal(pb.pastime, 'riverside');
  assert.ok(Math.abs(pa.x - pb.x) > 10 && Math.abs(pa.y - pb.y) < 1, 'side by side');
  const at = riverSpot(s, Math.min(a.id, b.id))!;
  assert.ok(Math.abs((pa.x + pb.x) / 2 - at.x) < 1, 'at their own place on the bank');
  assert.equal(pastimeActivity('riverside'), 'sit');
  // the river is frozen in winter: no sitting by it
  while (calendar(s.tick).season !== 'winter') s.tick += 24 * TICKS_PER_HOUR;
  assert.notEqual(pastimeFor(s, a, 1)?.pastime, 'riverside');
});
