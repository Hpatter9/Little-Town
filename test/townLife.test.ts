import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GATHER_HOUR, PROCESSION_PACE } from '../src/shared/data/ceremonies';
import { habitOfNature } from '../src/shared/data/natures';
import { ceremoniesHourly, gatheringPlace, holdRite, processing, processionHead, weddingFeast } from '../src/shared/sim/ceremonies';
import { killPerson } from '../src/shared/sim/health';
import { TIPSY_HOURS, walkingHome } from '../src/shared/sim/nightOut';
import { newTickContext, updatePerson } from '../src/shared/sim/people';
import { Rng } from '../src/shared/rng';
import { CELL } from '../src/shared/sim/land';
import { maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import {
  changingWatch, darkHomes, fallenNow, FALL_FOR, habitNow, HABIT_AFTER, snowballNow, snowballPairs, snowmanHomes, snowmanLeft,
  songNow, torchHours, yawningNow,
} from '../src/renderer/map/townLife';
import { plainGame, put } from './helpers';

function town(seed: string, n: number): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) {
    const p: Person = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, partner: null };
    p.hp = maxHp(p);
    s.people.push(p);
  }
  s.autopilot = undefined;
  return s;
}
const scene = { hour: 12, weather: 'clear', season: 'summer', raid: false, nearBuilding: true };
const who = (o: Partial<Parameters<typeof habitNow>[0]> = {}) => ({ id: 3, nature: 'jolly' as const, elder: false, activity: 'idle', child: false, tireless: false, ...o });

test('habits by nature: the jolly juggle, the grumpy kick a stone, the curious peer, the dreamy watch the clouds, elders smoke', () => {
  assert.equal(habitOfNature('jolly', false), 'juggle');
  assert.equal(habitOfNature('grumpy', false), 'kick');
  assert.equal(habitOfNature('curious', false), 'peer');
  assert.equal(habitOfNature('dreamy', false), 'cloudgaze');
  assert.equal(habitOfNature('grumpy', true), 'pipe', 'an elder smokes a pipe, whatever their nature');
  assert.equal(habitOfNature('kind', false), null);
  // only in an idle moment, standing still a while
  const at = (now: number, o = {}, sc = scene, still = HABIT_AFTER + 1) => habitNow(who(o), still, now, sc);
  const on = Array.from({ length: 40 }, (_, i) => i * 1000).find((t) => at(t) === 'juggle');
  assert.ok(on !== undefined, 'the jolly juggle in their bout of each cycle');
  assert.equal(at(on!, { activity: 'build' }), null, 'not at work');
  assert.equal(habitNow(who(), 100, on!, scene), null, 'not the moment they stop');
  assert.equal(at(on!, {}, { ...scene, raid: true }), null, 'not in a raid');
  assert.equal(at(on!, { child: true }), null, 'not the children (they have their games)');
  // the dreamy only lie in the grass on a fair day; the curious need a window
  const dreamy = Array.from({ length: 40 }, (_, i) => i * 1000).find((t) => at(t, { nature: 'dreamy' }) === 'cloudgaze');
  assert.ok(dreamy !== undefined);
  assert.equal(at(dreamy!, { nature: 'dreamy' }, { ...scene, weather: 'rain' }), null);
  assert.equal(at(dreamy!, { nature: 'dreamy' }, { ...scene, hour: 22 }), null);
  assert.equal(at(0, { nature: 'curious' }, { ...scene, nearBuilding: false }), null);
  // an elder's pipe the whole while, sat by the fire too
  for (let t = 0; t < 30000; t += 2500) assert.equal(at(t, { elder: true, nature: 'kind', activity: 'sit' }), 'pipe');
});

test('the walk home from the tavern: only those served, only after closing, for a while', () => {
  const s = town('tipsy', 2);
  const [a, b] = s.people;
  s.nightOut = { tavern: 1, ids: [a.id, b.id], until: s.tick + 10, served: [a.id] };
  assert.equal(walkingHome(s, a), false, 'still drinking');
  s.tick += 10;
  assert.equal(walkingHome(s, a), true, 'out at closing');
  assert.equal(walkingHome(s, b), false, 'only those who had a drink');
  s.tick += TIPSY_HOURS * TICKS_PER_HOUR;
  assert.equal(walkingHome(s, a), false, 'sober by then');
  // now and then a song, now and then a fall, on clocks of their own
  const songs = Array.from({ length: 200 }, (_, i) => songNow(5, i * 500)).filter(Boolean);
  assert.ok(songs.length > 10 && songs.length < 150, 'sings now and then');
  const falls = Array.from({ length: 400 }, (_, i) => fallenNow(5, i * 200)).filter(Boolean).length;
  assert.ok(falls > 0 && falls < 100, 'falls now and then');
  assert.ok(FALL_FOR < 3000);
  assert.ok(Array.from({ length: 50 }, (_, i) => yawningNow(2, i * 400)).some(Boolean), 'a yawn on the way to bed');
});

test('the windows go dark house by house: a home is dark once everyone in it is asleep', () => {
  const people = [
    { bedId: 10, activity: 'sleep', indoors: true },
    { bedId: 10, activity: 'eat', indoors: false },
    { bedId: 11, activity: 'sleep', indoors: true },
    { bedId: 12, activity: 'idle', indoors: false, away: 'the Barrow' },
    { bedId: null, activity: 'sleep', indoors: false },
  ];
  const dark = darkHomes(people);
  assert.ok(!dark.has(10), 'one still up: the lights are on');
  assert.ok(dark.has(11), 'all asleep: dark');
  assert.ok(dark.has(12), 'nobody home: dark');
  people[1].activity = 'sleep';
  people[1].indoors = true;
  assert.ok(darkHomes(people).has(10), 'and out once the last goes to bed');
});

test("the children's winter: snowmen by the doors melt in spring, snowball fights pair the children off", () => {
  assert.equal(snowmanLeft('winter', 2, 12), 1);
  assert.ok(snowmanLeft('spring', 1, 10) > 0 && snowmanLeft('spring', 1, 10) < 1, 'melting on spring\'s first day');
  assert.equal(snowmanLeft('spring', 2, 0), 0, 'gone after');
  assert.equal(snowmanLeft('summer', 1, 0), 0);
  const homes = snowmanHomes([{ bedId: 7, child: true }, { bedId: 8, child: false }, { bedId: 9, child: false }]);
  assert.ok(homes.includes(7), 'a child\'s home has one');
  assert.ok(homes.includes(9) && !homes.includes(8), 'and a third of the rest');
  const pairs = snowballPairs([
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 60, y: 0 },
    { id: 3, x: 70, y: 10 },
    { id: 4, x: 900, y: 0 },
  ]);
  assert.deepEqual(pairs, [[2, 3]], 'the nearest pair first, each child once, none too far');
  const throws = Array.from({ length: 30 }, (_, i) => snowballNow(i * 100, 1)).filter((b) => b);
  assert.ok(throws.some((b) => b!.from === 0) && throws.some((b) => b!.from === 1), 'each side throws in turn');
});

test('the watch: the guard changes at six and eighteen, and carries a torch by night', () => {
  assert.ok(changingWatch(6, 5) && changingWatch(18, 0));
  assert.ok(!changingWatch(6, 40) && !changingWatch(12, 0));
  assert.ok(torchHours(22) && torchHours(3) && !torchHours(12));
});

test('a funeral carries the coffin from the home of the dead to the graveyard before gathering', () => {
  const s = town('proc1', 4);
  const grave = put(s, 'graveyard', s.land.camp.x + 8, s.land.camp.y + 2);
  const home = put(s, 'lean_to', s.land.camp.x - 6, s.land.camp.y + 2);
  const dead = s.people[1];
  dead.bed = home.id;
  killPerson(s, dead, 'of a fall');
  do {
    s.tick += TICKS_PER_HOUR;
    ceremoniesHourly(s);
  } while (calendar(s.tick).hour !== GATHER_HOUR);
  const g = s.gathering!;
  assert.ok(g && g.walk, 'it begins as a procession');
  assert.ok(processing(g, s.tick));
  const start = processionHead(g, s.tick);
  assert.ok(Math.abs(start.x - g.walk!.x) < 1, 'from the home');
  // the bearers walk at its head, the mourners behind it
  const bear = gatheringPlace(g, 0, s.tick);
  const back = gatheringPlace(g, 4, s.tick);
  const toward = Math.sign(g.x - g.walk!.x);
  assert.ok((back.x - bear.x) * toward < 0, 'the column follows the coffin');
  // it reaches the graveyard, then stands in its ring
  const len = Math.hypot(g.x - g.walk!.x, g.y - g.walk!.y);
  s.tick += Math.ceil(len / PROCESSION_PACE) + 1;
  assert.ok(!processing(g, s.tick), 'there');
  const ring = gatheringPlace(g, 0, s.tick);
  assert.ok(Math.hypot(ring.x - g.x, ring.y - g.y) < 100, 'in the ring round the grave');
  void grave;
  // those at it walk in the procession (the attend task)
  const s2 = town('proc1', 4);
  put(s2, 'graveyard', s2.land.camp.x + 8, s2.land.camp.y + 2);
  const h2 = put(s2, 'lean_to', s2.land.camp.x - 6, s2.land.camp.y + 2);
  s2.people[1].bed = h2.id;
  killPerson(s2, s2.people[1], 'of a fall');
  do {
    s2.tick += TICKS_PER_HOUR;
    ceremoniesHourly(s2);
  } while (calendar(s2.tick).hour !== GATHER_HOUR);
  const mourner = s2.people.find((p) => s2.gathering!.ids.includes(p.id))!;
  const rng = new Rng(1);
  for (let i = 0; i < 5; i++) {
    updatePerson(s2, mourner, rng, newTickContext());
    s2.tick++;
  }
  assert.equal(mourner.activity, 'walk', 'walking in the procession');
});

test('a wedding party walks from the couple\'s door to the feast, the couple at its head', () => {
  const s = town('proc2', 4);
  const home = put(s, 'lean_to', s.land.camp.x - 8, s.land.camp.y + 3);
  const [a, b] = [s.people[2], s.people[3]];
  a.bed = home.id;
  weddingFeast(s, a, b);
  do {
    s.tick += TICKS_PER_HOUR;
    ceremoniesHourly(s);
  } while (calendar(s.tick).hour !== GATHER_HOUR);
  const g = s.gathering!;
  assert.equal(g.kind, 'wedding');
  assert.deepEqual(g.ids.slice(0, 2).sort(), [a.id, b.id].sort(), 'the couple lead');
  assert.ok(g.walk, 'a procession');
});

test('on a rite day the faithful walk to the temple and kneel there', () => {
  const s = town('rite', 6);
  const temple = { x: s.land.camp.x * CELL + 260, y: s.land.camp.y * CELL + 120 };
  holdRite(s, temple, 3);
  const g = s.gathering!;
  assert.equal(g.kind, 'rite');
  assert.ok(g.ids.length > 0 && g.ids.length <= s.people.length);
  assert.ok(g.walk, 'from the fire');
  s.tick = g.walk!.until + 1;
  const p = s.people.find((q) => g.ids.includes(q.id))!;
  const at = gatheringPlace(g, g.ids.indexOf(p.id), s.tick);
  p.x = at.x;
  p.y = at.y;
  updatePerson(s, p, new Rng(2), newTickContext());
  assert.equal(p.activity, 'pray');
  // none while another gathering is on
  const s2 = town('rite2', 3);
  s2.gathering = { kind: 'feast', ids: [], until: s2.tick + 100, text: '', x: 0, y: 0 };
  holdRite(s2, temple, 3);
  assert.equal(s2.gathering.kind, 'feast');
});

test('by night a guard on watch walks the inside of the ring wall', () => {
  const s = town('wallwatch', 2);
  const c = s.land.camp;
  const line: { x: number; y: number; side: 'n' | 's' | 'w' | 'e' }[] = [];
  for (let x = c.x - 8; x <= c.x + 8; x++) line.push({ x, y: c.y - 8, side: 'n' }, { x, y: c.y + 8, side: 's' });
  for (let y = c.y - 7; y <= c.y + 7; y++) line.push({ x: c.x - 8, y, side: 'w' }, { x: c.x + 8, y, side: 'e' });
  s.ring = { gen: 1, rect: { x: c.x - 8, y: c.y - 8, w: 17, h: 17 }, line, wall: 'palisade_wall', gate: 'palisade_gate', gates: [], done: true };
  const g = s.people.find((p) => p.id % 2 === 1)!;
  g.guard = true;
  g.priorities = Object.fromEntries(Object.keys(g.priorities).map((k) => [k, 4])) as unknown as Person['priorities'];
  g.priorities.defend = 1;
  g.needs = { food: 1, rest: 1 };
  while (calendar(s.tick).hour !== 22) s.tick += TICKS_PER_HOUR;
  g.task = null;
  updatePerson(s, g, new Rng(3), newTickContext());
  assert.equal((g.task as { type?: string } | null)?.type, 'patrol');
  const t = g.task as unknown as { targetX: number; targetY: number };
  const cell = { x: Math.floor(t.targetX / CELL), y: Math.floor(t.targetY / CELL) };
  assert.ok(line.some((l) => Math.abs(l.x - cell.x) + Math.abs(l.y - cell.y) === 1), 'a step inside the wall');
});
