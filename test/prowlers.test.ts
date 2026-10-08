import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { PROWL_FIRST_DAY, PROWL_GAP_HOURS, PROWL_PEOPLE, prowlers, prowlKind, ringGap, wayIn } from '../src/shared/sim/prowlers';
import { gateCells, missingPieces, wantRect, type Ring } from '../src/shared/sim/ringWall';
import { campXY, newGame, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { CELL } from '../src/shared/sim/land';
import { clearAround, put } from './helpers';

/** A rng whose every chance comes true (the rest as usual), and one whose none does. */
const lucky = (seed: number) => Object.assign(new Rng(seed), { chance: () => true }) as Rng;
/** The tick of an hour on a day (the clock starts at 7). */
const at = (day: number, hour: number) => day * TICKS_PER_DAY + ((hour - 7 + 24) % 24) * TICKS_PER_HOUR;

/** A town with no wall yet, the land about it clear. */
function openTown(seed: string): GameState {
  const s = newGame(seed);
  clearAround(s, 24);
  s.research.done.push('palisades');
  s.autopilot = true;
  for (let i = 0; i < 2; i++) s.people.push({ ...s.people[0], id: s.nextId++, name: `Hand ${i}` }); // (three grown-ups: PROWL_PEOPLE)
  return s;
}
/** The ring begun (nothing standing), and every piece of it stood up. */
function beginRing(s: GameState): Ring {
  const rect = wantRect(s);
  s.ring = { gen: 1, rect, wall: 'palisade_wall', gate: 'palisade_gate', gates: gateCells(s, rect) };
  return s.ring;
}
function standRing(s: GameState, ring: Ring, keep: (x: number) => boolean = () => true): void {
  for (const p of missingPieces(s, ring)) if (!p.clear && keep(p.at.x)) put(s, p.def, p.at.x, p.at.y, { ring: ring.gen, ...(p.turned ? { turned: true } : {}) });
}

test('with no wall the gap is whole, a ring begun closes it as it goes up, and a castle town has none', () => {
  const s = openTown('gap');
  assert.equal(ringGap(s), 1);
  const ring = beginRing(s);
  assert.ok(ringGap(s) > 0.9);
  const r = ring.rect;
  standRing(s, ring, (x) => x < r.x + Math.floor(r.w / 2));
  const half = ringGap(s);
  assert.ok(half > 0.3 && half < 0.7, `half built: ${half}`);
  standRing(s, ring);
  assert.equal(ringGap(s), 0);
  assert.equal(ringGap(newGame('castle', { origin: 'vampire' })), 0);
});

test('prowlers slip in at night where there is no wall: never by day, in the first days, twice within the gap, or with the wall up', () => {
  const s = openTown('prowl');
  s.tick = at(PROWL_FIRST_DAY + 1, 23);
  prowlers(s, lucky(1));
  assert.ok(s.raid, 'they came');
  assert.equal(s.raid!.phase, 'active');
  assert.ok(s.raid!.kind.startsWith('prowl_'), s.raid!.kind);
  const c = campXY(s);
  for (const q of s.raid!.raiders) assert.ok(Math.abs(q.y - c.y) < 2 * CELL && Math.abs(q.x - c.x) < 20 * CELL, `inside the town: ${q.x}, ${q.y}`);
  assert.ok(s.journal.some((j) => /slipped into the town in the night, with no wall to stop them/.test(j.text)));
  assert.equal(s.lastProwl, s.tick);
  // (not again within the gap)
  s.raid = null;
  s.tick += TICKS_PER_HOUR;
  prowlers(s, lucky(2));
  assert.equal(s.raid, null);
  s.tick = at(PROWL_FIRST_DAY + 3, 1);
  assert.ok(s.tick - s.lastProwl! >= PROWL_GAP_HOURS * TICKS_PER_HOUR);
  prowlers(s, lucky(3));
  assert.ok(s.raid, 'and again once the gap has passed');
  // by day, nothing
  const d = openTown('day');
  d.tick = at(PROWL_FIRST_DAY + 1, 12);
  prowlers(d, lucky(4));
  assert.equal(d.raid, null);
  // a founder alone, nothing
  const l = openTown('lone');
  l.people.length = 1;
  assert.ok(PROWL_PEOPLE > 1);
  l.tick = at(PROWL_FIRST_DAY + 1, 23);
  prowlers(l, lucky(8));
  assert.equal(l.raid, null);
  // the first days, nothing
  const e = openTown('early');
  e.tick = at(0, 23);
  prowlers(e, lucky(5));
  assert.equal(e.raid, null);
  // the wall up all round, nothing
  const w = openTown('walled');
  standRing(w, beginRing(w));
  w.tick = at(PROWL_FIRST_DAY + 1, 23);
  prowlers(w, lucky(6));
  assert.equal(w.raid, null);
  // a wall half up: they come in at the open half
  const g = openTown('gapway');
  const ring = beginRing(g);
  const r = ring.rect;
  const mid = r.x + Math.floor(r.w / 2);
  standRing(g, ring, (x) => x < mid);
  for (let i = 0; i < 20; i++) {
    const way = wayIn(g, new Rng(i));
    assert.ok(way.at.x >= (mid - 1) * CELL, `in the open half: ${way.at.x} (mid ${mid * CELL})`);
    assert.equal(way.where, 'through a gap in the wall');
  }
  g.tick = at(PROWL_FIRST_DAY + 1, 2);
  prowlers(g, lucky(7));
  assert.ok(g.raid && g.raid.raiders.every((q) => q.x >= (mid - 2) * CELL));
});

test('who comes: sneak-thieves or beasts in the Stone Age, thieves, slavers or beasts after; wild dogs in dry lands', () => {
  const s = openTown('kinds');
  const early = new Set<string>();
  for (let i = 0; i < 40; i++) early.add(prowlKind(s, new Rng(i)).id);
  assert.deepEqual([...early].sort(), ['prowl_scouts', 'prowl_wolves']);
  s.era = 'medieval';
  const later = new Set<string>();
  for (let i = 0; i < 80; i++) later.add(prowlKind(s, new Rng(i)).id);
  assert.deepEqual([...later].sort(), ['prowl_slavers', 'prowl_thieves', 'prowl_wolves']);
  const d = newGame('dunes', { biome: 'desert' });
  d.era = 'medieval';
  const dry = new Set<string>();
  for (let i = 0; i < 80; i++) dry.add(prowlKind(d, new Rng(i)).id);
  assert.ok(dry.has('prowl_dogs') && !dry.has('prowl_wolves'));
});
