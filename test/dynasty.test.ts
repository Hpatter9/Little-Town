// Generations and dynasties (sim/dynasty.ts): upbringing leans, inherited feuds and bonds, the ruling house's rise,
// crisis and fall, and heirlooms handed down.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { UNIQUES } from '../src/shared/data/uniques';
import { LEAN_DEFS, RISE_DAYS } from '../src/shared/data/dynasty';
import { Rng } from '../src/shared/rng';
import { applyUpbringing, dynastyDeath, dynastyHourly, dynastyOf, dynastyView, feudFrom, housesOf, leansOf, rootOf } from '../src/shared/sim/dynasty';
import { killPerson } from '../src/shared/sim/health';
import { recordBirth } from '../src/shared/sim/lineage';
import { opinion } from '../src/shared/sim/social';
import { makePerson, type GameState, type Person } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
const dawn = (s: GameState, day: number) => {
  s.tick = at(day, 5);
  dynastyHourly(s);
};

function adult(s: GameState, rng: Rng, cls?: Person['cls']): Person {
  const p = makePerson(rng, s.nextId++, 'gatherer', { x: s.people[0].x + 10, y: s.people[0].y }, s.people.map((q) => q.name));
  if (cls) p.cls = cls;
  s.people.push(p);
  return p;
}
function child(s: GameState, rng: Rng, a: Person, b: Person): Person {
  const k = adult(s, rng);
  k.bornTick = s.tick;
  k.parents = [a.id, b.id];
  recordBirth(s, k, a, b);
  return k;
}
/** A couple with `kids` children, a family line in the record. */
function house(s: GameState, rng: Rng, kids = 1, cls?: Person['cls']): { a: Person; b: Person; kids: Person[] } {
  const a = adult(s, rng, cls);
  const b = adult(s, rng, cls);
  a.partner = b.id;
  b.partner = a.id;
  return { a, b, kids: Array.from({ length: kids }, () => child(s, rng, a, b)) };
}
function grow(s: GameState, k: Person): void {
  k.bornTick = null;
  for (const sk of Object.values(k.skills)) sk.level = 2;
  k.passions = [];
  applyUpbringing(s, k);
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('a child raised through raids leans to fighting; natures stay varied', () => {
  const s = plainGame('dyn-fight');
  s.autopilot = true;
  const rng = new Rng(3);
  const raised: Person[] = [];
  const plain: Person[] = [];
  const { a, b } = house(s, rng, 0);
  for (let i = 0; i < 30; i++) {
    raised.push(child(s, rng, a, b));
    plain.push(child(s, rng, a, b));
  }
  const d = dynastyOf(s);
  for (const k of raised) d.rearing[k.id] = { raids: 3, hunger: 0, trade: 0, days: 18 };
  for (const k of plain) d.rearing[k.id] = { raids: 0, hunger: 0, trade: 0, days: 18 };
  assert.equal(leansOf(s, raised[0])[0].lean, 'fight');
  assert.ok(leansOf(s, plain[0]).every((l) => l.lean !== 'fight'));
  raised.forEach((k) => grow(s, k));
  plain.forEach((k) => grow(s, k));
  assert.ok(mean(raised.map((k) => k.skills.melee.level)) >= mean(plain.map((k) => k.skills.melee.level)) + 2, 'the raid-raised hit harder');
  const natures = new Set(raised.map((k) => k.nature ?? 'own'));
  assert.ok(natures.size >= 3, 'a lean, not a rule: natures stay varied');
  assert.ok(raised.some((k) => k.nature === undefined || k.nature === null) || natures.size > 3);
  assert.ok(raised.filter((k) => k.nature && LEAN_DEFS.fight.natures.includes(k.nature)).length < raised.length, 'not every nature was turned');
});

test('famine leans to the plough, trade to trade, and two mages to the arcane', () => {
  const s = plainGame('dyn-leans');
  s.autopilot = true;
  const rng = new Rng(4);
  const { a, b } = house(s, rng, 0);
  const hungry = child(s, rng, a, b);
  const rich = child(s, rng, a, b);
  dynastyOf(s).rearing[hungry.id] = { raids: 0, hunger: 4, trade: 0, days: 18 };
  dynastyOf(s).rearing[rich.id] = { raids: 0, hunger: 0, trade: 16, days: 18 };
  assert.equal(leansOf(s, hungry)[0].lean, 'farm');
  assert.equal(leansOf(s, rich)[0].lean, 'trade');
  const far = plainGame('dyn-mages');
  far.autopilot = true;
  const m = house(far, rng, 2, 'mage');
  const kid = m.kids[0];
  assert.equal(leansOf(far, kid)[0].lean, 'magic');
  const was = kid.skills.research.level;
  kid.bornTick = null;
  for (const sk of Object.values(kid.skills)) sk.level = 2;
  applyUpbringing(far, kid);
  assert.ok(kid.skills.research.level > 2 && was >= 0, 'the mages\' child studies');
});

test('with the autopilot off, nothing leans', () => {
  const s = plainGame('dyn-off');
  const rng = new Rng(5);
  const { kids } = house(s, rng, 1, 'mage');
  kids[0].bornTick = null;
  assert.deepEqual(applyUpbringing(s, kids[0]), []);
  assert.equal(s.dynasty, undefined);
});

test('a killing between families starts a feud the children inherit, and a marriage ends it', () => {
  const s = plainGame('dyn-feud');
  s.autopilot = true;
  const rng = new Rng(6);
  const A = house(s, rng, 1);
  const B = house(s, rng, 1);
  s.tick = at(5, 5);
  feudFrom(s, A.a, B.b, 'murder');
  const d = dynastyOf(s);
  assert.equal(d.feuds.length, 1);
  assert.equal(d.feuds[0].why.includes('killed'), true);
  // the houses' people fall out day by day, and so do the children's
  const h = housesOf(s);
  assert.notEqual(rootOf(h, A.kids[0].id), rootOf(h, B.kids[0].id));
  for (let day = 6; day < 16; day++) dawn(s, day);
  assert.ok(opinion(s, A.a.id, B.a.id) < -30, 'the parents sank');
  // a child born into it comes of age with the grudge
  const heir = child(s, rng, A.a, A.b);
  grow(s, heir);
  assert.ok(opinion(s, heir.id, B.a.id) <= -30, 'the grudge is inherited');
  // a marriage across it ends it
  A.kids[0].bornTick = null;
  B.kids[0].bornTick = null;
  A.kids[0].partner = B.kids[0].id;
  B.kids[0].partner = A.kids[0].id;
  A.kids[0].married = B.kids[0].married = true;
  dawn(s, 20);
  assert.ok(d.feuds[0].ended?.how.includes('marriage'), 'ended by the marriage');
  assert.ok(d.bonds.length >= 1, 'and peace leaves a thread of friendship');
});

test('a feud ends by a council\'s ruling', () => {
  const s = plainGame('dyn-council');
  s.autopilot = true;
  const rng = new Rng(7);
  const A = house(s, rng, 1);
  const B = house(s, rng, 1);
  s.tick = at(5, 5);
  feudFrom(s, A.a, B.a, 'assault');
  let ended = false;
  for (let day = 6; day < 80 && !ended; day++) {
    s.politics = { sat: {} as never, laws: [], lastCouncil: s.tick } as never; // (a council meets each day)
    dawn(s, day);
    ended = !!dynastyOf(s).feuds[0].ended;
  }
  assert.ok(ended, 'the council settled it in the end');
});

test('houses that fight a raid side by side become friends', () => {
  const s = plainGame('dyn-bond');
  s.autopilot = true;
  const rng = new Rng(8);
  const A = house(s, rng, 1);
  const B = house(s, rng, 1);
  for (let i = 0; i < 4; i++) {
    const row = (p: Person) => ({ id: p.id, name: p.name, dealt: 10, kills: 1, taken: 0, levelFrom: 1, levelTo: 1, xp: 0, fell: false, died: false });
    s.raidRecap = { tick: at(6 + i, 12), name: 'the raid', outcome: 'victory', rows: [row(A.a), row(B.a)] } as never;
    dawn(s, 7 + i);
  }
  const bond = dynastyOf(s).bonds[0];
  assert.ok(bond?.declared, 'declared after a few raids');
  assert.ok(opinion(s, A.a.id, B.a.id) > 0);
  assert.ok(dynastyView(s)!.bonds.length >= 1);
});

test('the founder\'s house rules; losing its heir is a crisis the town feels', () => {
  const s = plainGame('dyn-heir');
  s.autopilot = true;
  const rng = new Rng(9);
  const lead = s.people[0];
  const spouse = adult(s, rng);
  lead.partner = spouse.id;
  spouse.partner = lead.id;
  const heir = child(s, rng, lead, spouse);
  heir.bornTick = null;
  heir.level = 3;
  dawn(s, 3);
  const r = dynastyOf(s).ruling!;
  assert.ok(r, 'a ruling house begins');
  const root = rootOf(housesOf(s), lead.id);
  assert.equal(rootOf(housesOf(s), r.anchor), root);
  assert.equal(r.heir, heir.id, 'the child is the heir');
  const marks = (s.marks ?? []).length;
  killPerson(s, heir, 'in the raid');
  assert.ok(r.crisisUntil && r.crisisUntil > s.tick, 'a crisis');
  assert.ok((s.marks ?? []).length > marks, 'the town mourns the heir');
  assert.ok(dynastyView(s)!.ruling!.crisis);
});

test('a stronger house takes the seat in the end, and a house that dies out gives it up', () => {
  const s = plainGame('dyn-fall');
  s.autopilot = true;
  const rng = new Rng(10);
  const lead = s.people[0];
  const spouse = adult(s, rng);
  lead.partner = spouse.id;
  spouse.partner = lead.id;
  child(s, rng, lead, spouse).bornTick = null;
  const B = house(s, rng, 1);
  for (const p of [B.a, B.b]) {
    p.level = 30;
    p.coins = 600;
    p.titles = ['Homestead Hero'];
  }
  dawn(s, 3);
  const d = dynastyOf(s);
  assert.equal(rootOf(housesOf(s), d.ruling!.anchor), rootOf(housesOf(s), lead.id), 'the founder rules first');
  for (let day = 4; day < 4 + RISE_DAYS + 2; day++) dawn(s, day);
  const root = rootOf(housesOf(s), B.a.id);
  assert.equal(rootOf(housesOf(s), d.ruling!.anchor), root, 'the stronger house rules');
  assert.equal(d.past.length, 1);
  assert.match(d.past[0].fate, /overthrown/);
  // the new house dies out: the seat goes on
  s.mainId = lead.id;
  for (const p of [B.a, B.b, ...B.kids]) s.people = s.people.filter((q) => q !== p);
  dawn(s, 30);
  assert.equal(d.past.length, 2);
  assert.equal(d.past[1].fate, 'died out');
  assert.equal(rootOf(housesOf(s), d.ruling!.anchor), rootOf(housesOf(s), lead.id));
});

test('an heirloom passes to the heir, tells its story, and its loss is a blow', () => {
  const s = plainGame('dyn-loom');
  s.autopilot = true;
  const rng = new Rng(11);
  const A = house(s, rng, 1);
  const heir = A.kids[0];
  heir.bornTick = null;
  heir.level = 2;
  const blade = UNIQUES[0].id;
  A.a.gear.weapon = blade;
  dawn(s, 3);
  const d = dynastyOf(s);
  assert.equal(d.heirlooms.length, 1, 'a unique worn by a family becomes its heirloom');
  assert.equal(d.heirlooms[0].holder, A.a.id);
  // the holder dies at home: the heir has it
  killPerson(s, A.a, 'of old age, full of days');
  assert.equal(heir.gear.weapon, blade);
  assert.equal(d.heirlooms[0].holder, heir.id);
  assert.equal(d.heirlooms[0].carried, 1);
  assert.match(d.heirlooms[0].story.join(' '), /Passed to/);
  // it's sold off: a couple of days gone and the family grieves
  delete heir.gear.weapon;
  dawn(s, 4);
  dawn(s, 5);
  assert.ok(d.heirlooms[0].lost, 'lost');
  assert.ok(heir.sore && heir.sore.value < 0, 'the family takes it hard');
  assert.equal(dynastyView(s)!.heirlooms[0].lost !== null, true);
});

test('a holder who dies on the road loses the heirloom with them', () => {
  const s = plainGame('dyn-road');
  s.autopilot = true;
  const rng = new Rng(12);
  const A = house(s, rng, 1);
  A.a.gear.weapon = UNIQUES[0].id;
  dawn(s, 3);
  A.a.away = 'x' as never;
  dynastyDeath(s, A.a, 'on the road');
  assert.ok(dynastyOf(s).heirlooms[0].lost);
});
