import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { homeName } from '../src/shared/data/homeNames';
import { isSeat } from '../src/shared/data/seats';
import { FAMOUS_FELLED, FAMOUS_LEVEL, RUIN_HOURS, STATUE, STATUE_HOUR, STATUES_MOST } from '../src/shared/data/memorials';
import { canPlace, demolish, footprint, mayClear, placeBlueprint } from '../src/shared/sim/buildings';
import { updateFires } from '../src/shared/sim/fire';
import { killPerson } from '../src/shared/sim/health';
import { deedsOf, famous, nameHomes } from '../src/shared/sim/memorials';
import { agoText, leavesRuin, ruinLine, ruinsHourly } from '../src/shared/sim/ruins';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { memorialsHourly, nextToHonour, raiseStatue } from '../src/shared/sim/statues';
import { calendar, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { clearAround, freeSpot, plainGame, put } from './helpers';

const someone = (s: GameState, seed = 7) => {
  const p = makePerson(new Rng(seed), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
  s.people.push(p);
  return p;
};
/** The first tick at the statue's hour at or after `from`. */
function statueHour(from: number): number {
  let t = from - (from % TICKS_PER_HOUR) + TICKS_PER_HOUR;
  while (calendar(t).hour !== STATUE_HOUR) t += TICKS_PER_HOUR;
  return t;
}
const stone = (s: GameState, n: number) => (s.buildings.find((b) => b.def === 'campfire')!.store = { stone: n });

/* ------------------------------------------------------------ the famous */

test('who is famous: the founder always, a title, many raiders felled, a high level or many journeys; not the rest', () => {
  const plain = { founder: false, titles: [] as string[], felled: 0, level: 3, trips: 0 };
  assert.equal(famous(plain), false);
  assert.ok(famous({ ...plain, founder: true }));
  assert.ok(famous({ ...plain, titles: ['Dragonslayer'] }));
  assert.ok(famous({ ...plain, felled: FAMOUS_FELLED }));
  assert.ok(famous({ ...plain, level: FAMOUS_LEVEL }));
  assert.equal(famous({ ...plain, felled: FAMOUS_FELLED - 1 }), false);
});

test('a famous death is honoured with their look and gear; an ordinary one is not', () => {
  const s = plainGame('memorial-honour');
  const hero = someone(s);
  hero.titles = ['Wolfsbane'];
  hero.felled = 15;
  hero.gear = { weapon: 'stone_spear' };
  const nobody = someone(s, 8);
  killPerson(s, nobody, 'of the fever');
  killPerson(s, hero, 'at the hands of the bandits');
  assert.equal(s.honoured?.length, 1);
  const h = s.honoured![0];
  assert.equal(h.name, hero.name);
  assert.deepEqual(h.gear, { weapon: 'stone_spear' });
  assert.deepEqual(h.look, hero.look);
  const deeds = deedsOf(h).join(' ');
  assert.match(deeds, /Wolfsbane/);
  assert.match(deeds, /Felled 15 raiders/);
});

/* ------------------------------------------------------------ the statues */

test('the town raises a statue to the honoured before its seat, one at a time, the oldest dead first', () => {
  const s = plainGame('memorial-statue');
  clearAround(s, 14);
  s.autopilot = true;
  const first = someone(s);
  first.titles = ['the Brave'];
  const second = someone(s, 9);
  second.felled = 20;
  killPerson(s, first, 'at the hands of the wolves');
  killPerson(s, second, 'of old age, full of days');
  stone(s, 40);
  s.tick = statueHour(s.tick);
  memorialsHourly(s);
  const statues = s.buildings.filter((b) => b.def === STATUE);
  assert.equal(statues.length, 1, 'one statue laid out');
  assert.equal(statues[0].statue, first.id, 'for the first to fall');
  assert.equal(statues[0].status, 'blueprint');
  // (in the square: in front of the seat, a few cells from its door)
  const seat = s.buildings.find((b) => isSeat(b.def))!;
  const f = footprint(seat);
  const at = footprint(statues[0]);
  assert.ok(at.y >= f.y + f.h && Math.abs(at.x - (f.x + f.w / 2)) <= 10, `the statue stands before the seat (${at.x},${at.y} by ${f.x},${f.y})`);
  // (not a second while the first is being built)
  assert.equal(raiseStatue(s), false);
  statues[0].status = 'done';
  s.tick += TICKS_PER_HOUR; // (past the statue's hour: only the unveiling)
  memorialsHourly(s);
  assert.ok(s.honoured![0].unveiled !== undefined, 'the finished statue is unveiled');
  assert.ok(s.journal.some((j) => j.text.includes(`statue of ${first.name}`)), 'and the town says so');
  assert.equal(nextToHonour(s)?.id, second.id);
  assert.ok(raiseStatue(s), 'then the next');
  assert.equal(s.buildings.filter((b) => b.def === STATUE).at(-1)!.statue, second.id);
});

test('no statue without the stone, nor past the most, nor with the autopilot off', () => {
  const s = plainGame('memorial-limits');
  clearAround(s, 14);
  const hero = someone(s);
  hero.titles = ['the Bold'];
  killPerson(s, hero, 'in the fire');
  s.tick = statueHour(s.tick);
  stone(s, 40);
  memorialsHourly(s); // (autopilot off)
  assert.equal(s.buildings.filter((b) => b.def === STATUE).length, 0);
  s.autopilot = true;
  stone(s, 2);
  assert.equal(raiseStatue(s), false, 'not without the stone');
  stone(s, 40);
  for (let i = 0; i < STATUES_MOST; i++) put(s, STATUE, 0, 0, { statue: -1 - i });
  assert.equal(raiseStatue(s), false, 'not past the most');
});

test('a statue is never pulled down to make room', () => {
  const s = plainGame('memorial-clear');
  const at = freeSpot(s, STATUE);
  const b = put(s, STATUE, at.x, at.y, { statue: 1 });
  assert.equal(mayClear(b), false);
  const hut = put(s, 'workbench', at.x + 4, at.y);
  assert.equal(mayClear(hut), true);
});

/* ------------------------------------------------------------ the ruins */

test('a home pulled down leaves its foundation, named for who lived there, cleared in its time', () => {
  const s = plainGame('memorial-ruin');
  const at = freeSpot(s, 'lean_to');
  const home = put(s, 'lean_to', at.x, at.y, { owner: s.people[0].id, homeName: 'Bramble End' });
  demolish(s, home.id);
  assert.equal(s.ruins?.length, 1);
  const r = s.ruins![0];
  assert.equal(r.kind, 'pulled');
  assert.equal(r.home, 'Bramble End');
  assert.equal(r.owner, s.people[0].name);
  assert.match(ruinLine(r, 49), new RegExp(`^The ruins of Bramble End, ${s.people[0].name}'s? lean-to, pulled down two days ago$`));
  s.tick += (RUIN_HOURS.pulled - 1) * TICKS_PER_HOUR;
  s.tick -= s.tick % TICKS_PER_HOUR;
  ruinsHourly(s);
  assert.equal(s.ruins!.length, 1, 'still there before its time');
  s.tick += 2 * TICKS_PER_HOUR;
  ruinsHourly(s);
  assert.equal(s.ruins!.length, 0, 'cleared away after');
});

test('building over a ruin is allowed, and clears it at once', () => {
  const s = plainGame('memorial-over');
  const at = freeSpot(s, 'lean_to');
  const home = put(s, 'lean_to', at.x, at.y);
  demolish(s, home.id);
  assert.equal(s.ruins?.length, 1);
  assert.ok(canPlace(s, BUILDING_BY_ID.lean_to, at.x, at.y).ok, 'the ground is free to build on');
  s.research.done.push('basic_shelter');
  assert.ok(placeBlueprint(s, 'lean_to', at.x, at.y).ok);
  assert.equal(s.ruins!.length, 0, 'the ruin is cleared');
});

test('a building that burns down leaves a blackened shell; blueprints, walls and fields leave nothing', () => {
  const s = plainGame('memorial-burn');
  const at = freeSpot(s, 'workbench');
  const bench = put(s, 'workbench', at.x, at.y, { fire: 1 });
  updateFires(s, new Rng(1));
  assert.ok(!s.buildings.includes(bench));
  assert.equal(s.ruins?.at(-1)?.kind, 'burnt');
  assert.equal(leavesRuin({ def: 'palisade', status: 'done' }), false);
  assert.equal(leavesRuin({ def: 'garden_plot', status: 'done' }), false);
  assert.equal(leavesRuin({ def: 'lean_to', status: 'blueprint' }), false);
  assert.equal(leavesRuin({ def: 'lean_to', status: 'done', room: true }), false);
  assert.equal(leavesRuin({ def: 'lean_to', status: 'done' }), true);
  assert.equal(agoText(0.5), 'just now');
  assert.equal(agoText(5), 'five hours ago');
  assert.equal(agoText(26), 'a day ago');
});

/* ------------------------------------------------------------ the homes' names */

test('a home name is decided by its id and its person, the same every time; each people its own words', () => {
  assert.equal(homeName(12, 'Elka Thorn', 'settlers'), homeName(12, 'Elka Thorn', 'settlers'));
  const names = new Set<string>();
  for (let id = 1; id <= 60; id++) names.add(homeName(id, 'Elka Thorn', 'settlers'));
  assert.ok(names.size > 30, `varied (${names.size} of 60)`);
  assert.ok([...names].some((n) => n.startsWith("Elka's ")), 'some after the person, by their first name');
  assert.ok([...names].some((n) => n.startsWith('The ')), 'some by their look');
  for (let id = 1; id <= 30; id++) assert.ok(!homeName(id, null, 'settlers').includes("'s "), 'nobody to name it for: never a possessive');
  // (each people's words: a lich town's crypts, a dwarves' delvings, a machine town's berths)
  const words = (origin: 'lich' | 'dwarves' | 'robot') => [...Array(40)].map((_, i) => homeName(i + 1, 'Morra', origin)).join(' ');
  assert.match(words('lich'), /Crypt|Barrow|Vault|Ossuary|bone/);
  assert.match(words('dwarves'), /Delving|Hall|hearth|delve/);
  assert.match(words('robot'), /Berth|Bay|Unit|Node/);
});

test('homes are named for their owner, else their eldest resident, and keep the name after', () => {
  const s = plainGame('memorial-names');
  const at = freeSpot(s, 'lean_to');
  const owned = put(s, 'lean_to', at.x, at.y, { owner: s.people[0].id });
  const empty = put(s, 'lean_to', at.x + 4, at.y);
  s.tick = TICKS_PER_HOUR * 3;
  nameHomes(s);
  assert.equal(owned.homeName, homeName(owned.id, s.people[0].name, s.origin));
  assert.equal(empty.homeName, undefined, 'a home with nobody waits for its name');
  const lodger = someone(s);
  lodger.bed = empty.id;
  nameHomes(s);
  assert.equal(empty.homeName, homeName(empty.id, lodger.name, s.origin));
  const was = empty.homeName;
  killPerson(s, lodger, 'of the fever');
  nameHomes(s);
  assert.equal(empty.homeName, was, 'the name stays with the house');
});
