import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { SHAFT } from '../src/shared/data/deep';
import { CAVE_PEOPLE_BY_ID, CAVE_PEOPLES, isUnderOpen, SITE_COUNTS, UD_H, UD_W, UNDERDARK_RAIDS } from '../src/shared/data/underdark';
import { caveIn, makeUnderdark, openEntry, reached, underdarkHourly, underdarkOf, underDestinations, underDug, udIndex, udXY, type Underdark } from '../src/shared/sim/underdark';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { foundVillage, villagesHourly } from '../src/shared/sim/villages';
import { CELL } from '../src/shared/sim/land';
import { totalStock } from '../src/shared/sim/buildings';
import { Rng, hashSeed } from '../src/shared/rng';
import { makePerson, newGame, type GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put } from './helpers';

/** The tick at a day's hour. */
const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

/** Open ground joined to a cell. */
function joined(u: Pick<Underdark, 'cells'>, from: number): Set<number> {
  const out = new Set([from]);
  const q = [from];
  for (let k = 0; k < q.length; k++) {
    const { x, y } = udXY(q[k]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= UD_W || ny >= UD_H) continue;
      const j = udIndex(nx, ny);
      if (!out.has(j) && isUnderOpen(u.cells[j])) {
        out.add(j);
        q.push(j);
      }
    }
  }
  return out;
}

/** A town with a shaft standing and the autopilot on (so the Underdark is made). */
function shaftTown(seed: string): { s: GameState; shaft: ReturnType<typeof put>; u: Underdark } {
  const s = plainGame(seed);
  s.autopilot = true;
  for (let k = 0; k < 8; k++) s.people.push(makePerson(new Rng(k + 7), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name)));
  const shaft = put(s, SHAFT, s.land.camp.x + 4);
  s.tick = at(3, 12);
  underdarkHourly(s);
  return { s, shaft, u: s.underdark! };
}

test('the Underdark is wired in: the cave peoples\' warriors and lords, and the raids that come up', () => {
  for (const k of UNDERDARK_RAIDS) {
    assert.ok(RAID_KIND_BY_ID[k.id], k.id);
    assert.ok(Object.keys(k.enemies).length > 0, `${k.id} has foes`);
    for (const id of Object.keys(k.enemies)) assert.ok(ENEMIES[id], `${k.id}: ${id}`);
    if (k.leader) assert.ok(ENEMIES[k.leader]?.boss, `${k.id}: its lord ${k.leader}`);
  }
  for (const p of CAVE_PEOPLES) {
    assert.ok(RAID_KIND_BY_ID[p.raid], p.raid);
    assert.ok(ENEMIES[p.lord], p.lord);
  }
});

test('the cave layer is made from the seed: every place joined by tunnels, the rock under the town left solid', () => {
  for (const seed of ['ud-a', 'ud-b', 'ud-c', 'ud-d']) {
    const mid = { x: 24, y: 24 };
    const a = makeUnderdark(seed, mid);
    assert.equal(a.cells, makeUnderdark(seed, mid).cells, 'the same seed, the same caves');
    assert.equal(a.cells.length, UD_W * UD_H);
    const towns = a.sites.filter((x) => x.kind === 'town');
    assert.ok(towns.length >= 2 && towns.length <= 3, `${seed}: two or three cave towns (${towns.length})`);
    for (const [k, n] of Object.entries(SITE_COUNTS)) assert.equal(a.sites.filter((x) => x.kind === k).length, n, `${seed}: ${k}`);
    assert.ok([...a.cells].includes('~'), 'water');
    assert.ok([...a.cells].includes('v'), 'magma');
    // (all the places on one network of open ground)
    const net = joined(a, a.sites[0].at);
    for (const x of a.sites) assert.ok(net.has(x.at), `${seed}: ${x.name} is joined to the rest`);
    // (the town's rock: solid round the middle)
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) assert.equal(a.cells[udIndex(mid.x + dx, mid.y + dy)], '#', 'solid under the town');
  }
});

test('a shaft opens a way down, and its miners cut through to the caves, which then join up with the shaft', () => {
  const { s, shaft, u } = shaftTown('ud-dig');
  assert.ok(u, 'the Underdark is made once a shaft stands');
  assert.equal(u.entries.length, 1);
  assert.equal(u.cells[u.entries[0]], 'e', 'the shaft\'s foot below');
  assert.equal(u.through, undefined, 'solid rock between the shaft and the caves at first');
  const before = totalStock(s).stone ?? 0;
  for (let i = 0; i < 400 && u.through === undefined; i++) {
    const p = s.people.find((q) => q.id !== s.mainId) ?? s.people[0];
    underDug(s, p, shaft);
  }
  assert.notEqual(u.through, undefined, 'broken through');
  assert.ok((totalStock(s).stone ?? 0) > before, 'the rock cut comes up as stone');
  const net = reached(u);
  const sitesReached = u.sites.filter((x) => net[x.at]);
  assert.equal(sitesReached.length, u.sites.length, 'every place below can be walked to from the shaft');
  // (the scouts find the places, and they're trips on the board)
  for (let h = 0; h < 80; h++) {
    s.tick = at(3, 12) + h * TICKS_PER_HOUR;
    underdarkHourly(s);
  }
  assert.ok(u.found.length > 0, 'places found');
  assert.ok(underDestinations(s).length > 0, 'trips below');
});

test('the town digs down only under the Growth or Knowledge direction', () => {
  const { s, shaft, u } = shaftTown('ud-dir');
  s.direction = 'defense';
  for (let i = 0; i < 40; i++) underDug(s, s.people[0], shaft);
  assert.equal(u.dug, 0, 'no digging under Defence');
  s.direction = 'knowledge';
  for (let i = 0; i < 40; i++) underDug(s, s.people[0], shaft);
  assert.ok(u.dug > 0, 'digging under Knowledge');
});

test('a friendly cave town trades its goods up the shaft for coins', () => {
  const { s, u } = shaftTown('ud-trade');
  const t = u.towns[0];
  const site = u.sites[t.site];
  // (the town's tunnels have reached it)
  u.entries.push(site.at);
  u.through = s.tick;
  u.found.push(site.id);
  Object.assign(t, { known: true, met: true, attitude: 60, stance: 'friend', envoyAt: 0 });
  s.coins = 500;
  const goods = CAVE_PEOPLE_BY_ID[t.people].goods;
  const m = Object.keys(goods)[0] as keyof typeof goods;
  const had = totalStock(s)[m] ?? 0;
  s.tick = at(5, 6);
  underdarkHourly(s);
  assert.equal(s.coins, 500 - CAVE_PEOPLE_BY_ID[t.people].price, 'paid for');
  assert.ok((totalStock(s)[m] ?? 0) > had, `${m} came up the shaft`);
  assert.ok(t.tradeAt !== undefined);
});

test('a cave town at war raids up the town\'s own shaft at night', () => {
  const { s, shaft, u } = shaftTown('ud-raid');
  const t = u.towns[0];
  u.through = s.tick;
  Object.assign(t, { known: true, met: true, attitude: -90, stance: 'war', envoyAt: 1e9 });
  for (let n = 0; n < 4000 && !s.raid; n++) {
    s.tick = at(10 + Math.floor(n / 8), (22 + (n % 8)) % 24);
    underdarkHourly(s);
  }
  assert.ok(s.raid, 'a raid came');
  assert.ok([CAVE_PEOPLE_BY_ID[t.people].raid, 'under_dark'].includes(s.raid!.kind), `from below (${s.raid!.kind})`);
  // (they come up out of the shaft: inside the town, not at the edge of the land)
  const c = { x: (shaft.tile + 1) * CELL, y: (shaft.row + 1) * CELL };
  const near = s.raid!.raiders.filter((r) => Math.hypot(r.x - c.x, r.y - c.y) < 400).length;
  assert.ok(near > 0, 'raiders start at the shaft');
});

test('a cave-in below can kill the digger', () => {
  const { s } = shaftTown('ud-cavein');
  const p = s.people.find((q) => q.id !== s.mainId)!;
  // (a roll that buries)
  let g: Rng | null = null;
  for (let k = 0; k < 100 && !g; k++) {
    const probe = new Rng(hashSeed(`probe:${k}`));
    if (probe.next() < 0.5) g = new Rng(hashSeed(`probe:${k}`));
  }
  caveIn(s, p, g!);
  assert.ok(!s.people.includes(p), 'the digger is dead');
  assert.ok((s.fallen ?? []).some((f) => f.cause.includes('cave-in')), 'buried in a cave-in');
});

test('a dwarf hold\'s hallways open straight into the Underdark, and the cave peoples know the dwarves', () => {
  const s = newGame('ud-dwarves', { origin: 'dwarves' });
  s.autopilot = true;
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  const hall = s.buildings.find((b) => b.def === 'hold_hallway') ?? put(s, 'hold_hallway', s.land.camp.x, s.land.camp.y - 3);
  hall.status = 'done';
  const u = underdarkOf(s)!;
  assert.ok(u, 'made');
  openEntry(s, u, hall);
  assert.notEqual(u.through, undefined, 'straight into the caves');
  assert.ok(u.towns.every((t) => t.known), 'the cave towns know the dwarves');
  assert.ok(u.towns.every((t) => t.attitude >= CAVE_PEOPLE_BY_ID[t.people].start), 'and are warmer to them');
});

test('a cave town\'s envoy is answered in the event box, and a gift warms them', () => {
  const { s, u } = shaftTown('ud-envoy');
  const t = u.towns[0];
  u.through = s.tick;
  Object.assign(t, { known: true, met: true, attitude: 0, stance: 'peace' });
  s.coins = 1000;
  s.tick = at(6, 6);
  underdarkHourly(s);
  const q = s.prompts.find((p) => p.ways?.system === 'underdark');
  assert.ok(q, 'an envoy came');
  const before = t.attitude;
  answerPrompt(s, q!.id, 0, new Rng(1));
  assert.ok(t.attitude > before, 'warmer for the gift');
  assert.ok(s.coins < 1000, 'the gift paid');
});

test('an under-village makes what the caves give, with no plots on the land', () => {
  const s = plainGame('ud-village');
  for (let k = 0; k < 4; k++) s.people.push(makePerson(new Rng(k + 7), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name)));
  const ids = s.people.slice(1, 3).map((p) => p.id);
  const v = foundVillage(s, { ids, leader: ids[0], x: s.land.camp.x, y: s.land.camp.y + 4, name: 'Lampdeep' }, 60)!;
  v.below = true;
  v.plots = [];
  s.tick = at(4, 7);
  s.autopilot = true;
  for (let h = 0; h < 30; h++) {
    s.tick += TICKS_PER_HOUR;
    villagesHourly(s);
  }
  assert.equal(v.plots.length, 0, 'no houses on the land');
  assert.ok(Object.keys(v.goods).every((m) => ['vegetables', 'fish', 'iron_ore'].includes(m)), `cave goods (${Object.keys(v.goods)})`);
});

/* ------------------------------------------------------------ the second pass (claude/underdark-2) */

import { DEEP_PEOPLE, DEPTH_BY_N, DESCEND_HOURS, HEARTVEIN, SEARCH_HOURS, UNDER_DEPTHS } from '../src/shared/data/underdark';
import { caveNetwork, depthMap, parseDeepDest, underFlooded, underHome, underSummary, underView, tallyOf } from '../src/shared/sim/underdark';
import { mineToWork } from '../src/shared/sim/farming';
import { parseCommand } from '../src/shared/sim/commands';

/** A shaft town broken through, every place of the upper caves seen and found. */
function throughTown(seed: string) {
  const t = shaftTown(seed);
  const { s, shaft, u } = t;
  for (let i = 0; i < 400 && u.through === undefined; i++) underDug(s, s.people[1] ?? s.people[0], shaft);
  // (whoever the cave-ins took on the way, made up again)
  while (s.people.length < 12) s.people.push(makePerson(new Rng(s.people.length + 50), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name)));
  u.seen = '1'.repeat(u.cells.length);
  s.tick = at(4, 12);
  underdarkHourly(s);
  return t;
}

test('a dwarf hold\'s hallway always opens onto the caves\' network, never a pocket walled off by water', () => {
  for (const seed of ['look-dwarves', 'ud-hall-a', 'ud-hall-b', 'ud-hall-c', 'ud-hall-d', 'ud-hall-e']) {
    const s = newGame(seed, { origin: 'dwarves' });
    s.autopilot = true;
    s.nextEventTick = Number.MAX_SAFE_INTEGER;
    const hall = s.buildings.find((b) => b.def === 'hold_hallway') ?? put(s, 'hold_hallway', s.land.camp.x, s.land.camp.y - 3);
    hall.status = 'done';
    const u = underdarkOf(s)!;
    openEntry(s, u, hall);
    const r = reached(u);
    assert.ok(u.sites.some((x) => r[x.at]), `${seed}: the hallway reaches the caves' places`);
  }
});

test('a town whose way down broke into a pocket (the first pass) gets its passage on into the caves', () => {
  const { s, u } = shaftTown('ud-pocket');
  // (a way down in a pocket of its own, off the network, "through")
  const net = caveNetwork(u);
  let pocket = -1;
  for (let i = 0; i < u.cells.length && pocket < 0; i++) {
    const { x, y } = udXY(i);
    if (x > 2 && y > 2 && x < UD_W - 3 && y < UD_H - 3 && u.cells[i] === '#' && !net[i] && [...Array(25).keys()].every((k) => !net[udIndex(x + (k % 5) - 2, y + Math.floor(k / 5) - 2)])) pocket = i;
  }
  u.entries = [pocket];
  u.cells = u.cells.slice(0, pocket) + 'e' + u.cells.slice(pocket + 1);
  u.through = s.tick;
  assert.ok(!u.sites.some((x) => reached(u)[x.at]), 'cut off at first');
  underdarkHourly(s);
  assert.ok(u.sites.some((x) => reached(u)[x.at]), 'joined up');
});

test('each deeper depth is made from the seed: its places joined to the stair\'s foot, a lair, and a stair down but at the bottom', () => {
  for (const d of UNDER_DEPTHS) {
    const a = depthMap('ud-depths', d.n);
    assert.equal(a.cells, depthMap('ud-depths', d.n).cells, 'the same seed, the same depth');
    const net = joined(a, a.arrive);
    for (const x of a.sites) assert.ok(net.has(x.at), `${d.name}: ${x.name} reached from the stair's foot`);
    assert.ok(a.sites.some((x) => x.kind === 'lair'), `${d.name}: a lair`);
    assert.equal(a.sites.some((x) => x.kind === 'stair'), d.n < UNDER_DEPTHS.length, `${d.name}: a stair down, but at the bottom`);
  }
  assert.ok(depthMap('ud-depths', 3).sites.some((x) => x.kind === 'hold'), 'the Lost Hold at the bottom');
});

test('the scouts find the stair under the ruins and open the Deep Roads, but not in a hamlet', () => {
  const { s, u } = throughTown('ud-descend');
  assert.ok(u.found.includes(u.sites.find((x) => x.kind === 'ruins')!.id), 'the ruins found');
  for (let h = 0; h < DESCEND_HOURS + 2; h++) {
    s.tick += TICKS_PER_HOUR;
    underdarkHourly(s);
  }
  assert.equal(u.depth, 1, 'the Deep Roads open');
  assert.ok(s.notices.some((n) => n.text.includes(DEPTH_BY_N[1].name.replace(/^the /, ''))), 'told');
  // (a hamlet never goes deeper)
  const small = throughTown('ud-descend-small');
  small.s.people.splice(DEEP_PEOPLE - 1);
  for (let h = 0; h < DESCEND_HOURS + 2; h++) {
    small.s.tick += TICKS_PER_HOUR;
    underdarkHourly(small.s);
  }
  assert.ok(!small.u.depth, 'not with fewer than DEEP_PEOPLE');
});

test('a depth\'s dweller guards the way on down: slain by a party, its hoard comes up and the next depth opens', () => {
  const { s, u } = throughTown('ud-dweller');
  u.descend = DESCEND_HOURS;
  underdarkHourly(s);
  assert.equal(u.depth, 1);
  // (the scouts have seen all of it)
  u.deeps![0].seen = '1'.repeat(u.cells.length);
  s.tick += TICKS_PER_HOUR;
  underdarkHourly(s);
  const m = depthMap(s.seed, 1);
  const lair = m.sites.find((x) => x.kind === 'lair')!;
  const dest = underDestinations(s).find((d) => parseDeepDest(d.id)?.site === lair.id);
  assert.ok(dest, 'the lair is a trip');
  assert.equal(dest!.type, 'clear');
  assert.ok(Object.keys(dest!.encounters!.groups[0].enemies).includes(DEPTH_BY_N[1].dweller), 'the dweller is there');
  assert.equal(u.depth, 1, 'no way on down while it lives');
  for (const b of s.buildings) b.store = {}; // (room in the stores)
  const gold = totalStock(s).gold ?? 0;
  underHome(s, dest!.id, true, { x: s.land.camp.x * CELL, y: s.land.camp.y * CELL });
  assert.notEqual(u.deeps![0].slain, undefined, 'slain');
  assert.ok((totalStock(s).gold ?? 0) > gold, 'its hoard came up');
  assert.ok(!underDestinations(s).some((d) => d.id === dest!.id), 'its lair is no longer a trip');
  s.tick += TICKS_PER_HOUR;
  underdarkHourly(s);
  assert.equal(u.depth, 2, 'the Sunless Sea opens');
});

test('the Heartvein gives each dawn once the Sleeping Wyrm is slain', () => {
  const { s, u } = throughTown('ud-heart');
  u.depth = 3;
  u.deeps = [1, 2, 3].map((n) => ({ seen: '0'.repeat(u.cells.length), found: [], opened: s.tick, ...(n === 3 ? { slain: s.tick } : {}) }));
  for (const b of s.buildings) b.store = {}; // (room in the stores)
  const had = totalStock(s).rare_minerals ?? 0;
  s.tick = at(6, 6);
  underdarkHourly(s);
  assert.ok((totalStock(s).rare_minerals ?? 0) >= had + (HEARTVEIN.rare_minerals ?? 0), 'the Heartvein\'s rare minerals');
});

test('someone taken below is dragged off where the view can show it, and a search party goes after them', () => {
  const { s, shaft, u } = throughTown('ud-taken');
  for (const t of u.towns) t.stance = 'peace';
  const lost = tallyOf(u).deaths;
  let n = 0;
  for (; n < 8000 && !u.marks?.some((m) => m.kind === 'taken'); n++) {
    // (someone always at work below; nothing else coming up meanwhile)
    if (!s.people.some((p) => p.task?.type === 'mine')) s.people[s.people.length - 1].task = { type: 'mine', building: shaft.id, work: 0 };
    s.tick = at(10 + Math.floor(n / 8), (22 + (n % 8)) % 24);
    u.rose = s.tick;
    u.floodUntil = s.tick + TICKS_PER_HOUR;
    s.raid = null;
    underdarkHourly(s);
  }
  const m = u.marks?.find((x) => x.kind === 'taken');
  assert.ok(m && m.who && m.foe && m.to !== undefined, 'seen being dragged off');
  assert.ok(!s.people.some((p) => p.name === m!.who), 'gone');
  assert.ok(u.search, 'a search party out');
  assert.equal(tallyOf(u).deaths, lost + 1, 'counted');
  s.tick = u.search!.at;
  underdarkHourly(s);
  assert.equal(u.search, undefined, 'the search party back');
  assert.ok(s.notices.some((n) => n.text.includes('search party comes back')), 'and what it found told');
  void SEARCH_HOURS;
});

test('a flood drives the miners out: nobody works a flooded way down until it drains', () => {
  const { s, shaft, u } = throughTown('ud-flood');
  u.floodUntil = s.tick + 10 * TICKS_PER_HOUR;
  assert.ok(underFlooded(s, shaft), 'flooded');
  assert.notEqual(mineToWork(s, s.people[1])?.id, shaft.id, 'not worked');
  s.tick += 11 * TICKS_PER_HOUR;
  assert.ok(!underFlooded(s, shaft), 'drained');
});

test('a fallen cave town is left as ruins a party can pick over', () => {
  const { s, u } = throughTown('ud-fallen');
  const t = u.towns[0];
  t.stance = 'fallen';
  t.known = true;
  const dest = underDestinations(s).find((d) => d.id === `under:${t.site}`);
  assert.ok(dest, 'its ruins are a trip');
  assert.equal(dest!.type, 'salvage');
});

test('a town made before the second pass (no depths, marks or tally) carries on, and the view and menus cope', () => {
  const { s, u } = throughTown('ud-old');
  delete u.depth;
  delete u.deeps;
  delete u.marks;
  delete u.tally;
  delete u.descend;
  s.watchingUnder = true;
  s.watchingUnderDepth = 2; // (a depth not open: the upper caves shown)
  assert.equal(underView(s)!.depth, 0);
  assert.ok(underSummary(s), 'summed up');
  for (let h = 0; h < 30; h++) {
    s.tick += TICKS_PER_HOUR;
    underdarkHourly(s);
  }
  assert.ok(underView(s)!.cells.length === UD_W * UD_H);
});

test('the view is asked for a depth by a checked command', () => {
  assert.deepEqual(parseCommand({ type: 'watchUnder', on: true, depth: 2 }), { type: 'watchUnder', on: true, depth: 2 });
  assert.deepEqual(parseCommand({ type: 'watchUnder', on: true, depth: 9 }), { type: 'watchUnder', on: true });
  assert.deepEqual(parseCommand({ type: 'watchUnder', on: false }), { type: 'watchUnder', on: false });
});
