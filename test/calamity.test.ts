import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT_BY_ID } from '../src/shared/data/events'; // (first: the event kit's own import order)
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { CALAMITIES, CALAMITY_HOUR, CALAMITY_KINDS, HEART_DREAD, NEST_CLEARED_DREAD, SIEGE_LOST_DREAD, WARD } from '../src/shared/data/calamity';
import { CALAMITY_EVENTS } from '../src/shared/data/calamityEvents';
import { EVENT_MORE } from '../src/shared/data/eventMore';
import { NEST_DEFS, NEST_KINDS, NEST_MAX_LEVEL, NEST_RAIDS } from '../src/shared/data/nests';
import { blighted, findNest, growNest, nestRaid, nestsOf, spawnNest } from '../src/shared/sim/nests';
import { calamityHourly, calamityKindOf, calamityRaidOver, calamityView, dreadToday, heartCleared, heartDestination, wakeCalamity } from '../src/shared/sim/calamity';
import { placeCleared, placeDestinations } from '../src/shared/sim/places';
import { placeDestId } from '../src/shared/data/places';
import { growCrops } from '../src/shared/sim/farming';
import { Rng } from '../src/shared/rng';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { camp, plainGame, put } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

test('every nest and every Calamity has its foes, raids, avatar and trophy', () => {
  for (const k of NEST_KINDS) {
    const d = NEST_DEFS[k];
    assert.equal(d.foes.length, NEST_MAX_LEVEL, k);
    for (const g of [...d.foes, ...d.roam]) for (const id of Object.keys(g)) assert.ok(ENEMIES[id], `${k}: ${id}`);
    assert.ok(RAID_KIND_BY_ID[d.raid], d.raid);
  }
  for (const r of NEST_RAIDS) for (const id of Object.keys(r.enemies)) assert.ok(ENEMIES[id], id);
  for (const k of CALAMITY_KINDS) {
    const c = CALAMITIES[k];
    const army = RAID_KIND_BY_ID[c.army];
    assert.ok(army, c.army);
    for (const id of Object.keys(army.enemies)) assert.ok(ENEMIES[id], id);
    const av = ENEMIES[c.avatar];
    assert.ok(av?.boss && av.kit?.trophy && ITEM_BY_ID[av.kit.trophy], c.avatar);
    for (const g of c.guard) for (const id of Object.keys(g)) assert.ok(ENEMIES[id], id);
    assert.equal(c.stages.length, 6);
  }
  assert.ok(BUILDING_BY_ID[WARD]);
  for (const e of CALAMITY_EVENTS) assert.ok(EVENT_MORE[e.id] && EVENT_BY_ID[e.id], e.id);
  assert.ok(CALAMITY_KINDS.includes(calamityKindOf('any seed')));
});

test('a nest comes up on the land, grows, goes on the board once found, and raids the town', () => {
  const s = plainGame('nests');
  const p = spawnNest(s, 'warren')!;
  assert.ok(p && p.nest?.level === 1);
  assert.equal(nestsOf(s).length, 1);
  assert.equal(placeDestinations(s).length, 0, 'not on the board till found');
  growNest(s, p);
  growNest(s, p);
  assert.equal(p.nest!.level, 3);
  assert.deepEqual(p.foes, NEST_DEFS.warren.foes[2]);
  findNest(s, p, '');
  const d = placeDestinations(s).find((x) => x.id === placeDestId(p.id));
  assert.ok(d && d.name.startsWith('Goblin Warren, grown 3'), d?.name ?? 'none');
  // (an unfound nest's raid leads the town back to it)
  const q = spawnNest(s, 'barrow')!;
  q.nest!.level = 4;
  assert.ok(nestRaid(s, q, new Rng(3)));
  assert.equal(s.raid?.kind, 'nest_barrow');
  assert.notEqual(q.found, null);
});

test('the land round a nest is blighted (crops wither, nothing regrows) unless a ward stone stands near', () => {
  const s = plainGame('blight');
  const c = camp(s);
  const p = spawnNest(s, 'den', { x: c.x + 4, y: c.y + 4 })!;
  assert.ok(blighted(s, p.x + 1, p.y));
  assert.ok(!blighted(s, p.x + 20, p.y));
  // (a field in it grows at half pace)
  const field = put(s, 'garden_plot', p.x - 1, p.y + 1, { status: 'done', crop: { stage: 'growing', growth: 0, work: 0 } } as never);
  const clean = plainGame('blight');
  const field2 = put(clean, 'garden_plot', p.x - 1, p.y + 1, { status: 'done', crop: { stage: 'growing', growth: 0, work: 0 } } as never);
  for (let i = 0; i < 600; i++) {
    growCrops(s);
    growCrops(clean);
  }
  assert.ok(field.crop!.growth < field2.crop!.growth * 0.7, `${field.crop!.growth} vs ${field2.crop!.growth}`);
  put(s, WARD, p.x - 3, p.y + 3, { status: 'done' });
  assert.ok(!blighted(s, p.x + 1, p.y), 'the ward keeps it off');
});

test('the Calamity wakes, its dread rises with the nests and falls with wards and cleared nests, through its stages', () => {
  const s = plainGame('calamity');
  s.autopilot = true; // (it only stirs in a town running itself)
  s.tick = at(7, CALAMITY_HOUR);
  calamityHourly(s);
  const c = s.calamity!;
  assert.ok(c && c.stage === 1 && c.dread === 0);
  assert.ok(s.prompts.some((q) => q.kind === 'debrief') || s.scenes?.some((r) => r.fallback?.kind === 'debrief'), 'its waking is told (or played, its telling waiting on the scene)');
  const alone = dreadToday(s);
  const p = spawnNest(s, 'den')!;
  p.nest!.level = 4;
  assert.ok(dreadToday(s) > alone, 'nests feed it');
  // (the morning: the dread rises, and at 20 the spreading begins, with the heart on the board)
  c.dread = 19.9;
  s.tick = at(8, CALAMITY_HOUR);
  calamityHourly(s);
  assert.equal(c.stage, 2);
  assert.ok(c.scar > 0);
  assert.ok(heartDestination(s), 'the heart can be struck at');
  assert.ok(s.buildings.some((b) => b.def === WARD), 'a ward stone is laid');
  // (a cleared nest, and the heart, push it back)
  const before = c.dread;
  findNest(s, p, '');
  placeCleared(s, placeDestId(p.id), {}, new Rng(1));
  assert.ok(c.dread <= before - NEST_CLEARED_DREAD);
  const mid = c.dread;
  heartCleared(s);
  assert.equal(c.dread, Math.max(0, mid - HEART_DREAD));
  assert.equal(heartDestination(s), undefined, 'the heart lies quiet a while');
  assert.ok(calamityView(s)!.next.length > 0);
});

test('the last siege: won, the game is won; lost, the town burns and it comes again', () => {
  const s = plainGame('siege');
  s.autopilot = true;
  s.tick = at(30, CALAMITY_HOUR - 1);
  const c = wakeCalamity(s, 'tyrant');
  c.dread = 99.9;
  c.stage = 4;
  s.tick = at(30, CALAMITY_HOUR);
  calamityHourly(s);
  assert.equal(c.stage, 5);
  assert.ok(c.siegeAt !== undefined, 'warned');
  s.tick = c.siegeAt!;
  calamityHourly(s);
  const r = s.raid!;
  assert.equal(r.calamity, 'siege');
  assert.ok(r.raiders.some((rd) => rd.kind === 'ashen_tyrant'), 'the avatar leads it');
  // lost: the avatar stands
  for (let i = 0; i < 4; i++) put(s, 'lean_to', camp(s).x - 8 + i * 3, camp(s).y + 4, { status: 'done' });
  calamityRaidOver(s, r);
  assert.equal(c.lost, 1);
  assert.equal(c.dread, SIEGE_LOST_DREAD);
  assert.ok(s.buildings.some((b) => b.fire !== undefined), 'the town burns');
  assert.equal(s.gameOver, null);
  // won: the avatar falls
  for (const rd of r.raiders) if (rd.kind === 'ashen_tyrant') rd.down = true;
  calamityRaidOver(s, r);
  assert.ok((s.gameOver as { won?: boolean } | null)?.won);
  assert.ok(c.beaten !== undefined);
});
