import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOST_WARNING_HOURS } from '../src/shared/data/factions';
import { FOG_BAND } from '../src/shared/sim/land';
import {
  blinking,
  chimeRings,
  dawnHaze,
  dustWanted,
  eyeColour,
  eyesWanted,
  EYES_MOST,
  facingRow,
  geeseFly,
  geeseHeading,
  hasChime,
  hasVane,
  shaftSlant,
  shaftsStrength,
  vFormation,
  wispsWanted,
  WISPS_MOST,
} from '../src/renderer/map/airRules';
import {
  campfiresOf,
  fogEdge,
  FIRES_BY_TIER,
  GALLOP,
  hostTorches,
  newsBearing,
  newsBetween,
  riderAt,
  settlementsSeen,
  smokesOf,
  TORCHES_MOST,
  WAIT_AT_SEAT,
  type NewsShot,
} from '../src/renderer/map/horizonRules';
import { townBearing } from '../src/renderer/map/signRules';

const land = { camp: { x: 96, y: 96 }, open: 12 };
const dist = (p: { x: number; y: number }) => Math.hypot(p.x - 96.5, p.y - 96.5);
const bearingOf = (p: { x: number; y: number }) => Math.atan2(p.y - 96.5, p.x - 96.5);
const turn = (a: number, b: number) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

test('the far towns show past the fog, the way their strongholds lie, more of them the bigger the town', () => {
  const e = fogEdge(land, 0, 0);
  assert.equal(Math.round(dist(e)), land.open + FOG_BAND);
  const seen = settlementsSeen([
    { id: 'vampire', stance: 'war', tier: 2, folk: 60 },
    { id: 'knights', stance: 'destroyed', tier: 3, folk: 0 },
    { id: 'nowhere', stance: 'peace', tier: 1, folk: 10 },
  ]);
  // (a razed one shows nothing, nor one with no place on the world map)
  assert.deepEqual(
    seen.map((f) => f.id),
    ['vampire'],
  );
  const b = townBearing('vampire')!;
  for (let tier = 0; tier <= 4; tier++) {
    const fires = campfiresOf('vampire', tier, b, land);
    assert.equal(fires.length, FIRES_BY_TIER[tier]);
    for (const f of fires) {
      assert.ok(dist(f) > land.open + FOG_BAND, 'past the fog');
      assert.ok(turn(bearingOf(f), b) < 0.3, 'the way it lies');
    }
  }
  const small = campfiresOf('vampire', 0, b, land);
  const big = campfiresOf('vampire', 4, b, land);
  assert.ok(big.reduce((n, f) => n + f.strength, 0) / big.length > small.reduce((n, f) => n + f.strength, 0) / small.length, 'a city burns brighter');
  // (the same each time)
  assert.deepEqual(campfiresOf('vampire', 2, b, land), campfiresOf('vampire', 2, b, land));
  // smoke: more columns and taller as the town grows
  assert.ok(smokesOf('vampire', 4, 400, b, land).length > smokesOf('vampire', 0, 10, b, land).length);
  assert.ok(smokesOf('vampire', 2, 200, b, land)[0].height > smokesOf('vampire', 2, 10, b, land)[0].height);
});

test("a host's torches draw in to the fog's edge as it comes, more of them for a bigger host", () => {
  const b = Math.PI / 3;
  const far = hostTorches('orcs', b, HOST_WARNING_HOURS, 20, land);
  const near = hostTorches('orcs', b, 0, 20, land);
  const mid = (ps: { x: number; y: number }[]) => ps.reduce((n, p) => n + dist(p), 0) / ps.length;
  assert.ok(mid(far) > mid(near) + 8, 'starts far out');
  assert.ok(Math.abs(mid(near) - (land.open + FOG_BAND)) < 2, 'arrives at the edge');
  assert.ok(hostTorches('orcs', b, 10, 60, land).length > hostTorches('orcs', b, 10, 6, land).length);
  assert.ok(hostTorches('orcs', b, 10, 500, land).length <= TORCHES_MOST);
});

const shot = (o: Partial<NewsShot> = {}): NewsShot => ({ prompts: [], realm: { factions: [{ id: 'orcs', name: 'The Warband', known: true, stance: 'neutral', host: null }] }, quests: [], caravan: null, ...o });

test('couriers bring the news: a question, war, a host, a quest, a caravan; nothing on the first look', () => {
  assert.deepEqual(newsBetween(null, shot({ prompts: [{ id: 1, kind: 'event', title: 'A thief' }] })), []);
  const a = shot();
  const b = shot({
    prompts: [
      { id: 1, kind: 'event', title: 'A thief' },
      { id: 2, kind: 'envoy', title: 'An envoy' },
      { id: 3, kind: 'raid', title: 'Raiders!' },
    ],
    realm: { factions: [{ id: 'orcs', name: 'The Warband', known: true, stance: 'war', host: { hours: 30, size: 20 } }] },
    quests: [{ id: 9, title: 'The lost ring' }],
    caravan: { faction: null },
  });
  const news = newsBetween(a, b);
  assert.deepEqual(news.map((n) => n.kind).sort(), ['caravan', 'host', 'quest', 'question', 'raid', 'war']);
  // (the envoy rides in himself)
  assert.ok(!news.some((n) => n.key === 'q2'));
  // (word of a power comes from its side)
  const war = news.find((n) => n.kind === 'war')!;
  assert.equal(newsBearing(war), townBearing('orcs'));
  // and the same again is no news
  assert.deepEqual(newsBetween(b, b), []);
});

test('a courier gallops in along the way, waits at the seat, and rides back out', () => {
  const route = [
    { x: 0, y: 0 },
    { x: 140, y: 0 },
    { x: 140, y: 140 },
  ];
  const ride = 280 / GALLOP;
  assert.equal(riderAt(route, 0)!.phase, 'in');
  assert.equal(riderAt(route, 0)!.dir, 1);
  const half = riderAt(route, 1)!;
  assert.ok(Math.abs(half.x - 140) < 1e-6 && Math.abs(half.y) < 1e-6);
  const there = riderAt(route, ride + 1)!;
  assert.equal(there.phase, 'wait');
  assert.deepEqual([there.x, there.y], [140, 140]);
  const back = riderAt(route, ride + WAIT_AT_SEAT + ride - 0.5)!;
  assert.equal(back.phase, 'out');
  assert.equal(back.dir, -1);
  assert.equal(riderAt(route, ride * 2 + WAIT_AT_SEAT + 0.1), null);
});

const sky = (o: Partial<{ season: string; weather: string; daylight: number; hour: number }> = {}) => ({ season: 'summer', weather: 'clear', daylight: 1, hour: 12, ...o });

test('eyes in the dark: none by day, more in winter and on blighted land, and they blink', () => {
  assert.equal(eyesWanted(sky(), false), 0);
  const night = sky({ daylight: 0, hour: 23 });
  const n = eyesWanted(night, false);
  assert.ok(n > 0);
  assert.ok(eyesWanted({ ...night, season: 'winter' }, false) > n);
  assert.ok(eyesWanted(night, true) > n);
  assert.ok(eyesWanted({ ...night, season: 'winter' }, true) <= EYES_MOST);
  assert.equal(eyesWanted({ ...night, weather: 'storm' }, false), 0);
  assert.notEqual(eyeColour(true, 1), eyeColour(false, 1));
  let shut = 0;
  for (let t = 0; t < 37; t += 0.01) if (blinking(t, 0.3)) shut++;
  assert.ok(shut > 0 && shut < 3700 * 0.1, 'shut now and then, open mostly');
});

test('wisps over the graves at night, more in a town of the dead', () => {
  assert.equal(wispsWanted(1, 1, false), 0);
  assert.equal(wispsWanted(0, 0, true), 0);
  assert.ok(wispsWanted(0, 1, true) > wispsWanted(0, 1, false));
  assert.ok(wispsWanted(0, 9, true) <= WISPS_MOST);
});

test('geese fly over in spring and autumn by day, north then south, in a V', () => {
  assert.ok(geeseFly(sky({ season: 'spring' })));
  assert.ok(geeseFly(sky({ season: 'autumn', weather: 'cloudy' })));
  assert.ok(!geeseFly(sky()));
  assert.ok(!geeseFly(sky({ season: 'winter' })));
  assert.ok(!geeseFly(sky({ season: 'spring', daylight: 0.1 })));
  assert.ok(!geeseFly(sky({ season: 'autumn', weather: 'storm' })));
  for (let k = 0; k < 7; k++) {
    assert.ok(Math.sin(geeseHeading('spring', k)) < -0.8, 'north in spring');
    assert.ok(Math.sin(geeseHeading('autumn', k)) > 0.8, 'south in autumn');
  }
  assert.equal(facingRow(-Math.PI / 2), 3);
  assert.equal(facingRow(Math.PI / 2), 0);
  assert.equal(facingRow(0), 2);
  assert.equal(facingRow(Math.PI), 1);
  const v = vFormation(7);
  assert.deepEqual(v[0], { ahead: 0, aside: 0 });
  // (both arms trail behind the leader, one each side, each further back)
  assert.ok(v.slice(1).every((p) => p.ahead < 0));
  assert.equal(v.filter((p) => p.aside < 0).length, 3);
  assert.equal(v.filter((p) => p.aside > 0).length, 3);
});

test('tumbleweeds and dust devils on the dry lands by day, more weeds in more wind', () => {
  assert.deepEqual(dustWanted(false, false, sky(), 1), { weeds: 0, devils: 0 });
  assert.deepEqual(dustWanted(true, true, sky(), 1), { weeds: 0, devils: 0 });
  assert.deepEqual(dustWanted(true, false, sky({ daylight: 0.1 }), 1), { weeds: 0, devils: 0 });
  assert.deepEqual(dustWanted(true, false, sky({ weather: 'rain' }), 1), { weeds: 0, devils: 0 });
  assert.ok(dustWanted(true, false, sky(), 1.5).weeds > dustWanted(true, false, sky(), 0.2).weeds);
  assert.ok(dustWanted(true, false, sky({ hour: 14 }), 0.3).devils > 0);
});

test('weathervanes on some pitched roofs, chimes at some homes, and a chime rings on a gust', () => {
  const vanes = Array.from({ length: 200 }, (_, i) => hasVane(i, 'cottage')).filter(Boolean).length;
  assert.ok(vanes > 40 && vanes < 120);
  assert.ok(!hasVane(3, 'palisade_wall') && !hasVane(3, 'garden_plot'));
  assert.ok(Array.from({ length: 200 }, (_, i) => hasChime(i, 'cottage')).some(Boolean));
  assert.ok(!hasChime(3, 'smithy'));
  assert.ok(chimeRings(0.8, 0.7, 0.2));
  assert.ok(!chimeRings(0.8, 0.7, 0.6), 'once a gust, not all through it');
  assert.ok(!chimeRings(0.1, 0.9, 0), 'no wind, no ring');
});

test('sun shafts in the golden hours of fair days, slanting with the sun; a haze at dawn', () => {
  assert.equal(shaftsStrength(sky()), 0);
  assert.ok(shaftsStrength(sky({ hour: 7 })) > 0.9);
  assert.ok(shaftsStrength(sky({ hour: 18 })) > 0.9);
  assert.ok(shaftsStrength(sky({ hour: 7, weather: 'cloudy' })) < shaftsStrength(sky({ hour: 7 })));
  assert.equal(shaftsStrength(sky({ hour: 7, weather: 'rain' })), 0);
  assert.ok(Math.sign(shaftSlant(7)) !== Math.sign(shaftSlant(18)));
  assert.ok(dawnHaze(sky({ hour: 6, season: 'autumn' }), false) > 0.8);
  assert.equal(dawnHaze(sky({ hour: 12 }), false), 0);
  assert.equal(dawnHaze(sky({ hour: 6, weather: 'rain' }), false), 0);
  assert.ok(dawnHaze(sky({ hour: 6 }), true) > dawnHaze(sky({ hour: 6 }), false));
});
