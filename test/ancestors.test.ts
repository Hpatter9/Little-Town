// Legends across towns: a descendant's town carries its forebears as data from the founding: the old town comes back
// (ruins on the land, or the Old House as a power), the ancestors return as spirits, and the heirloom grows or is
// cursed. And the Hall of Legends threads the towns into lines of descent.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inherit, legendOf, linesOf, type Legend } from '../src/shared/sim/legacy';
import { ancestorAllies, ancestorsHourly, answerLegacy, foundAncestry } from '../src/shared/sim/ancestors';
import { placeCleared, placeDestination } from '../src/shared/sim/places';
import { realm } from '../src/shared/sim/factions';
import { pickRivals, FACTION_BY_ID } from '../src/shared/data/factions';
import { newGame, type Raid, type Raider } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendarOf } from '../src/shared/sim/time';
import { plusOf } from '../src/shared/data/quality';
import { UNIQUES } from '../src/shared/data/uniques';
import { groundAt } from '../src/shared/sim/land';
import { placeDestId } from '../src/shared/data/places';
import { hashSeed, Rng } from '../src/shared/rng';

const legend = (over: Partial<Legend> = {}): Legend => ({
  id: 'old-seed:9000',
  founder: 'Hild',
  origin: 'settlers',
  era: 'neolithic',
  days: 14,
  people: 12,
  dead: 9,
  fate: 'fell',
  heroes: [
    { name: 'Hild', calling: 'Warden', level: 12, felled: 20, fell: true, cause: 'at the hands of the bandits' },
    { name: 'Orm', calling: 'Archer', level: 9, felled: 11, fell: false },
  ],
  heirloom: UNIQUES[0].id,
  renown: 80,
  generation: 1,
  ended: 1000,
  ...over,
});

test('a town that fell comes back as ruins on the land, its dead restless; there is no Old House', () => {
  const s = newGame('anc-ruins');
  inherit(s, legend());
  const a = s.ancestry!;
  assert.equal(a.oldTown, 'ruins');
  const p = s.places!.find((q) => q.id === a.place)!;
  assert.ok(p?.old, 'the old place is laid');
  assert.ok(!['water', 'mountain', 'shallows', 'hall'].includes(groundAt(s.land, p.x, p.y)), 'on dry ground');
  assert.ok(p.foes!.restless_shade >= 2 && p.foes!.old_champion === 1);
  assert.match(placeDestination(s, p).name, /Ruins of Hild's Town/);
  assert.ok(!realm(s).some((f) => f.id === 'old_house'));
  assert.deepEqual(a.spirits.map((x) => x.name), ['Hild', 'Orm']);
});

test('a town that stood is the Old House, a power of the realm warm to its kin, and never anyone else\'s rival', () => {
  const s = newGame('anc-house');
  inherit(s, legend({ fate: 'retired' }));
  const f = realm(s).find((x) => x.id === 'old_house')!;
  assert.ok(f, 'the Old House stands');
  assert.ok(f.known && f.attitude > 30);
  assert.ok(FACTION_BY_ID.old_house.kin);
  for (let i = 0; i < 20; i++) assert.ok(!pickRivals(new Rng(i), 'knights', 4).some((d) => d.kin));
  const p = s.places!.find((q) => q.id === s.ancestry!.place)!;
  assert.match(placeDestination(s, p).name, /Hild's Barrow/);
});

test('the heirloom grows with each generation, and its curse is the legend\'s own', () => {
  const s = newGame('anc-heir');
  inherit(s, legend({ heirloomCarried: 2 }));
  const item = UNIQUES[0].id;
  assert.equal(s.items[item], 1);
  assert.equal(plusOf(s.itemQ![item][0]), 3, 'three generations, +3');
  assert.equal(s.ancestry!.heirloom!.carried, 3);
  // (the same fresh legend is cursed or not the same way every time)
  const cursedOf = (id: string) => {
    const t = newGame('anc-curse');
    foundAncestry(t, legend({ id }));
    return t.ancestry!.heirloom!.cursed;
  };
  const ids = Array.from({ length: 30 }, (_, i) => `legend-${i}`);
  const first = ids.map(cursedOf);
  assert.deepEqual(ids.map(cursedOf), first);
  assert.ok(first.some((c) => c) && first.some((c) => !c), 'some cursed, some not');
  // (and a cursed heirloom carried on stays cursed)
  const t = newGame('anc-carry');
  inherit(t, legend({ heirloomCarried: 1, cursed: true }));
  assert.ok(t.ancestry!.heirloom!.cursed);
});

test('the line goes on: the next legend keeps the heirloom count, the curse, its parent and the forebears', () => {
  const s = newGame('anc-next');
  const l = legend({ heirloomCarried: 1, cursed: true, forebears: ['Ada'] });
  inherit(s, l);
  s.people[0].gear.weapon = l.heirloom!;
  s.items[l.heirloom!] = 0;
  s.tick = 6 * TICKS_PER_DAY;
  const next = legendOf(s, 2000)!;
  assert.equal(next.heirloom, l.heirloom);
  assert.equal(next.heirloomCarried, 2);
  assert.equal(next.cursed, true);
  assert.equal(next.parent, l.id);
  assert.deepEqual(next.forebears, ['Ada', 'Hild']);
  assert.equal(next.generation, 2);
});

test('a spirit comes to the fire, asks to be remembered, and shows the way to the old place', () => {
  const s = newGame('anc-visit');
  inherit(s, legend());
  s.autopilot = true;
  const a = s.ancestry!;
  let asked = null;
  for (let d = 2; d < 60 && !asked; d++) {
    s.tick = d * TICKS_PER_DAY;
    while (calendarOf(s).hour !== 22) s.tick += TICKS_PER_HOUR;
    ancestorsHourly(s);
    asked = s.prompts.find((p) => p.kind === 'ways' && p.ways?.system === 'legacy') ?? null;
  }
  assert.ok(asked, 'a spirit came');
  const p = s.places!.find((q) => q.id === a.place)!;
  assert.notEqual(p.found, null, 'the old place is shown');
  answerLegacy(s, asked, 0);
  assert.equal(a.honoured, 'feast');
  // (and later visits bless)
  const before = a.visits;
  for (let d = 0; d < 80 && a.visits === before; d++) {
    s.tick += TICKS_PER_DAY;
    ancestorsHourly(s);
  }
  assert.ok(a.visits > before, 'the spirits come back');
});

test('the old place cleared lays its dead to rest: the curse lifts and the heirloom grows', () => {
  const s = newGame('anc-clear');
  inherit(s, legend({ heirloomCarried: 1, cursed: true }));
  const a = s.ancestry!;
  const item = a.heirloom!.item;
  const before = plusOf(s.itemQ![item][0]);
  const coins = s.coins ?? 0;
  placeCleared(s, placeDestId(a.place!), {}, new Rng(1));
  assert.ok(a.laid);
  assert.equal(a.heirloom!.cursed, false);
  assert.ok(a.heirloom!.lifted);
  assert.equal(plusOf(s.itemQ![item][0]), before + 1);
  assert.ok((s.coins ?? 0) > coins);
});

test('in a raid a spirit may stand with the town, and the Old House\'s riders come', () => {
  const s = newGame('anc-raid');
  inherit(s, legend({ fate: 'won' }));
  s.autopilot = true;
  realm(s).find((f) => f.id === 'old_house')!.stance = 'alliance';
  let spirits = 0;
  let riders = 0;
  for (let id = 1; id <= 40; id++) {
    const r = { id, raiders: [] as Raider[] } as unknown as Raid;
    ancestorAllies(s, r, false, (k) => ({ kind: k }) as Raider);
    spirits += r.raiders.filter((x) => x.kind === 'ancestor_shade').length;
    riders += r.raiders.filter((x) => x.kind === 'house_rider').length;
    const inside = { id, raiders: [] as Raider[] } as unknown as Raid;
    assert.equal(ancestorAllies(s, inside, true, (k) => ({ kind: k }) as Raider), 0, 'not for a raid begun inside');
  }
  assert.ok(spirits > 0 && riders > 0);
});

test('a descendant\'s town is founded the same way every time', () => {
  const a = newGame('anc-same');
  const b = newGame('anc-same');
  inherit(a, legend());
  inherit(b, legend());
  assert.equal(JSON.stringify(a.ancestry), JSON.stringify(b.ancestry));
  assert.equal(JSON.stringify(a.places), JSON.stringify(b.places));
  void hashSeed;
});

test('the Hall threads the towns into lines of descent', () => {
  const first = legend({ id: 'a', founder: 'Ada', ended: 1 });
  const second = legend({ id: 'b', founder: 'Bram', parent: 'a', of: "Ada's line", generation: 2, forebears: ['Ada'], ended: 2 });
  const third = legend({ id: 'c', founder: 'Cora', parent: 'b', of: "Ada's line", generation: 3, forebears: ['Ada', 'Bram'], ended: 3 });
  const lone = legend({ id: 'd', founder: 'Dag', ended: 4 });
  const lines = linesOf([third, lone, first, second]);
  const ada = lines.find((l) => l.name === "Ada's line")!;
  assert.deepEqual(ada.founders, ['Ada', 'Bram', 'Cora']);
  assert.deepEqual(ada.towns.map((t) => t.id), ['a', 'b', 'c']);
  assert.ok(lines.some((l) => l.founders.join() === 'Dag'));
  // (a town whose parent is no longer kept still names its founders)
  const orphan = linesOf([third]);
  assert.deepEqual(orphan[0].founders, ['Ada', 'Bram', 'Cora']);
});
