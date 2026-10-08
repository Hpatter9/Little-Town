import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { APPRENTICE_FROM, APPRENTICE_HOURS_PER_LEVEL, LESSON_FROM, LESSON_HOURS_PER_LEVEL } from '../src/shared/data/lineage';
import { CHILD_HOURS } from '../src/shared/data/social';
import { Rng } from '../src/shared/rng';
import { apprentice, childTask, comeOfAge, familiesView, inherit, kinOf, lineageHourly, recordBirth, recordDeath } from '../src/shared/sim/lineage';
import { trial } from '../src/shared/sim/politics';
import { adjust, opinion } from '../src/shared/sim/social';
import { makePerson, type GameState, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { freeSpot, plainGame, put } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function family(seed: string): { s: GameState; mum: Person; dad: Person; kid: Person } {
  const s = plainGame(seed);
  const rng = new Rng(5);
  const mum = s.people[0];
  const dad = makePerson(rng, s.nextId++, 'gatherer', { x: mum.x + 10, y: mum.y }, s.people.map((q) => q.name));
  s.people.push(dad);
  mum.partner = dad.id;
  dad.partner = mum.id;
  const kid = makePerson(rng, s.nextId++, 'gatherer', { x: mum.x, y: mum.y }, s.people.map((q) => q.name));
  kid.parents = [mum.id, dad.id];
  s.tick = at(10, 8);
  kid.bornTick = s.tick - Math.floor(CHILD_HOURS * 0.6) * TICKS_PER_HOUR;
  s.people.push(kid);
  recordBirth(s, kid, mum, dad);
  return { s, mum, dad, kid };
}

test('a child goes to lessons of a morning and to their master of an afternoon, and it counts', () => {
  const { s, dad, kid } = family('lin-learn');
  dad.skills.crafting.level = 12;
  s.tick = at(10, LESSON_FROM);
  assert.equal(childTask(s, kid)?.type, 'lesson');
  kid.task = { type: 'lesson', building: null };
  kid.activity = 'research';
  lineageHourly(s);
  assert.equal(kid.schooled, 1);
  s.tick = at(10, APPRENTICE_FROM);
  const t = childTask(s, kid);
  assert.equal(t?.type, 'apprentice');
  assert.equal(kid.master, dad.id, 'apprenticed to the best at a parent\'s trade');
  assert.equal(kid.trade, 'crafting');
  kid.task = t;
  kid.activity = 'idle';
  lineageHourly(s);
  assert.equal(kid.apprenticed, 1);
});

test('coming of age makes the learning good: levels of schooling, the trade, and the family grudge', () => {
  const { s, dad, kid } = family('lin-age');
  dad.skills.crafting.level = 15;
  s.tick = at(10, APPRENTICE_FROM);
  apprentice(s, kid);
  kid.schooled = LESSON_HOURS_PER_LEVEL * 3;
  kid.apprenticed = APPRENTICE_HOURS_PER_LEVEL * 5;
  const research = kid.skills.research.level;
  const crafting = kid.skills.crafting.level;
  // the father's enemy
  const foe = makePerson(new Rng(9), s.nextId++, 'gatherer', { x: 0, y: 0 }, s.people.map((q) => q.name));
  s.people.push(foe);
  adjust(s, dad.id, foe.id, -90);
  const told = comeOfAge(s, kid);
  assert.ok(kid.skills.research.level > research, 'schooled');
  assert.equal(kid.skills.crafting.level, crafting + 5, 'the trade');
  assert.ok(opinion(s, kid.id, foe.id) < 0, 'the grudge');
  assert.ok(told.some((x) => x.includes('grudge')));
});

test('a death passes the land and purse to the eldest grown child; the record keeps them', () => {
  const { s, mum, kid } = family('lin-heir');
  kid.bornTick = null; // (grown)
  const spot = freeSpot(s, 'lean_to');
  const home = put(s, 'lean_to', spot.x, spot.y, { owner: mum.id });
  mum.coins = 40;
  const r = inherit(s, mum);
  assert.equal(r.heir, kid);
  assert.equal(home.owner, kid.id);
  assert.equal(kid.coins, 40);
  recordDeath(s, mum, 'of old age');
  assert.ok(s.kin![mum.id].died);
});

test('the family tree: three generations under one line, its black sheep, and renown making it famous', () => {
  const { s, mum, dad, kid } = family('lin-tree');
  kid.bornTick = null;
  const rng = new Rng(11);
  const spouse = makePerson(rng, s.nextId++, 'gatherer', { x: 0, y: 0 }, s.people.map((q) => q.name));
  s.people.push(spouse);
  const grandkid = makePerson(rng, s.nextId++, 'gatherer', { x: 0, y: 0 }, s.people.map((q) => q.name));
  grandkid.parents = [kid.id, spouse.id];
  grandkid.bornTick = s.tick;
  s.people.push(grandkid);
  recordBirth(s, grandkid, kid, spouse);
  trial(s, kid, 'theft', 'stole 10 coins from the treasury');
  const lines = familiesView(s);
  assert.equal(lines.length, 1);
  const line = lines[0];
  assert.equal(line.generations, 3);
  assert.ok(line.members.some((m) => m.id === mum.id) && line.members.some((m) => m.id === dad.id) && line.members.some((m) => m.id === grandkid.id));
  assert.deepEqual(line.blackSheep, [kid.name]);
  assert.equal(line.famous, false);
  kinOf(s, mum).titles = ['Dragonslayer', 'the Bold', 'Saviour of the Town', 'Wolfbane', 'the Wise', 'Lightbringer', 'the Great'];
  s.people[0].titles = kinOf(s, mum).titles;
  assert.ok(familiesView(s)[0].famous, 'a famous line');
});
