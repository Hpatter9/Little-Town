import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHILD_HOURS, FRIEND, SCHOOL_BONUS } from '../src/shared/data/social';
import { DESPAIR_HOURS, updateBreaks } from '../src/shared/sim/breaks';
import { killPerson } from '../src/shared/sim/health';
import { sendExpedition } from '../src/shared/sim/expeditions';
import { mood } from '../src/shared/sim/townsfolk';
import { chemistry, isChild, opinion } from '../src/shared/sim/social';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, maxHp, type Building, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

const camp = (s: GameState) => Math.floor(s.tiles.length / 2);
function villager(s: GameState, seed: number): Person {
  const p = makePerson(new Rng(seed), s.nextId++, 'wanderer', (camp(s) + 0.5) * 32, s.people.map((q) => q.name));
  p.traits = [];
  p.hp = maxHp(p);
  p.needs = { food: 1, rest: 1 };
  s.people.push(p);
  return p;
}
function beds(s: GameState, n: number): void {
  for (let i = 0; i < n; i++) s.buildings.push({ id: s.nextId++, def: 'hide_tent', tile: camp(s) - 8 - i * 3, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
}
const key = (a: Person, b: Person) => (a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`);

/** A game where the founder and the next person to join get on well (chemistry is fixed per pair). */
function goodMatch(prefix: string): Sim {
  for (let i = 0; ; i++) {
    const s = plainGame(`${prefix}${i}`);
    if (chemistry(s, s.people[0].id, s.nextId) > 1.1) return new Sim(s);
  }
}

test('people who spend their days together become friends (or, with no chemistry, rivals)', () => {
  const sim = goodMatch('friends');
  const s = sim.state;
  const a = villager(s, 1);
  for (let i = 0; i < 4 * TICKS_PER_DAY; i++) sim.step();
  assert.ok(opinion(s, s.people[0].id, a.id) >= FRIEND, `opinion ${opinion(s, s.people[0].id, a.id)}`);
  assert.ok(mood(s, a).reasons.some((r) => r.text === 'Has friends' || r.text.startsWith('In love')));
});

test('a couple marries (with Family Life), has a child who grows up; a partner grieves a death', () => {
  const sim = new Sim(plainGame('family'));
  const s = sim.state;
  s.research.done.push('family_life');
  s.nextRaidTick = Number.MAX_SAFE_INTEGER; // (raids can be deadly now: keep the couple safe for this one)
  beds(s, 3);
  const a = villager(s, 2);
  const b = villager(s, 3);
  s.relations[key(a, b)] = 100;
  a.partner = b.id;
  b.partner = a.id;
  for (let i = 0; i < 20 * TICKS_PER_DAY && !s.people.some(isChild); i++) {
    s.relations[key(a, b)] = 100; // (keep them sweet on each other whatever their chemistry)
    sim.step();
  }
  assert.equal(a.partner, b.id);
  assert.ok(a.married && b.married, 'married');
  const child = s.people.find(isChild)!;
  assert.ok(child, 'a child arrived');
  assert.deepEqual([...child.parents!].sort((x, y) => x - y), [a.id, b.id].sort((x, y) => x - y));
  assert.equal(sendExpedition(s, 'berry_thicket', [child.id]).ok, false, 'too young to travel');
  assert.ok(Object.values(child.priorities).every((v) => v === 0), 'no work');

  child.bornTick = s.tick - CHILD_HOURS * TICKS_PER_HOUR;
  for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
  assert.equal(isChild(child), false, 'grown up');
  assert.ok(Object.values(child.priorities).some((v) => v > 0));

  killPerson(s, b, 'of old age');
  assert.equal(a.partner, null);
  assert.ok(mood(s, a).reasons.some((r) => r.text === `Lost ${b.name}` && r.value < -10));
});

test('a school sends children into the world more skilled', () => {
  const grow = (school: boolean) => {
    const sim = new Sim(plainGame('school'));
    const s = sim.state;
    if (school) s.buildings.push({ id: s.nextId++, def: 'school', tile: camp(s) + 4, status: 'done', delivered: {}, progress: 1, store: {} } as Building);
    const kid = villager(s, 7);
    kid.bornTick = s.tick - CHILD_HOURS * TICKS_PER_HOUR;
    kid.passions = ['crafting'];
    for (let i = 0; i < TICKS_PER_HOUR; i++) sim.step();
    return kid.skills.crafting.level + kid.skills.farming.level;
  };
  assert.equal(grow(true), grow(false) + 2 * SCHOOL_BONUS);
});

test('a whole town in despair for a day is abandoned (with a warning first)', () => {
  const sim = new Sim(plainGame('despair'));
  const s = sim.state;
  for (let h = 0; h < DESPAIR_HOURS + 1 && !s.gameOver; h++) {
    for (const p of s.people) p.morale = 2;
    for (let i = 0; i < TICKS_PER_HOUR; i++) {
      for (const p of s.people) p.morale = 2;
      sim.step();
    }
  }
  assert.ok(s.notices.some((n) => n.text.includes('in despair')));
  assert.match(s.gameOver?.text ?? '', /Hope ran out/);
});

test('at the breaking point people break: sulk, binge, brawl with a rival, or walk out for good', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 30; seed++) {
    const s = plainGame(`break${seed}`);
    const p = villager(s, seed + 10);
    const rival = villager(s, seed + 50);
    s.relations[key(p, rival)] = -80;
    s.buildings[0].store = { berries: 10 };
    p.morale = 3;
    p.lowMoraleHours = 5;
    const rng = new Rng(seed);
    s.tick = TICKS_PER_HOUR * 100;
    updateBreaks(s, rng);
    if (p.breakdown) seen.add(p.breakdown.kind);
    if (p.breakdown?.kind === 'brawl') assert.ok(rival.hp < maxHp(rival));
  }
  assert.ok(seen.size >= 3, [...seen].join(','));

  // walking out: they reach the edge and are gone
  const sim = new Sim(plainGame('leave'));
  const s = sim.state;
  const p = villager(s, 99);
  p.breakdown = { kind: 'wander', until: s.tick };
  for (let i = 0; i < TICKS_PER_DAY && s.people.includes(p); i++) sim.step();
  assert.ok(!s.people.includes(p), 'left town');
  assert.ok(s.notices.some((n) => n.text.includes('left town for good')));
});
