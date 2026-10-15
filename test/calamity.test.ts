import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT_BY_ID } from '../src/shared/data/events'; // (first: the event kit's own import order)
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { CALAMITIES, CALAMITY_AT, CALAMITY_KINDS, ENEMY_CALAMITY, HEART_SETBACK, NEST_CLEARED_DREAD, WARD } from '../src/shared/data/calamity';
import { CALAMITY_EVENTS } from '../src/shared/data/calamityEvents';
import { EVENT_MORE } from '../src/shared/data/eventMore';
import { NEST_DEFS, NEST_KINDS, NEST_MAX_LEVEL, NEST_RAIDS } from '../src/shared/data/nests';
import { blighted, findNest, growNest, nestRaid, nestsOf, spawnNest } from '../src/shared/sim/nests';
import { destinationOf } from '../src/shared/sim/expeditions';
import { HEART_DEST, calamityPace, calamityView, heartCleared, heartDestination, stageOfEnemy } from '../src/shared/sim/calamity';
import { ENEMY_HOUR, ENEMY_KINDS, GREAT_ENEMIES, PLAN_AT, SIEGE_REGROUP } from '../src/shared/data/greatEnemy';
import { bindCalamity, chooseEnemy, forceEnemy, greatEnemyHourly, greatEnemyRaidOver, paceToday } from '../src/shared/sim/greatEnemy';
import { Sim } from '../src/shared/sim/sim';
import { placeCleared, placeDestinations } from '../src/shared/sim/places';
import { placeDestId } from '../src/shared/data/places';
import { growCrops } from '../src/shared/sim/farming';
import { Rng } from '../src/shared/rng';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { camp, plainGame, put } from './helpers';
import type { GameState } from '../src/shared/sim/state';

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
  for (const k of ENEMY_KINDS) assert.ok(CALAMITY_KINDS.includes(ENEMY_CALAMITY[k]), `${k} brings a Calamity`);
  assert.equal(new Set(ENEMY_KINDS.map((k) => ENEMY_CALAMITY[k])).size, CALAMITY_KINDS.length, 'each Calamity is some Enemy\'s');
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

/** A town with its Enemy chosen (of `kind`), the autopilot on, at the morning of `day`. */
function withEnemy(seed: string, kind: (typeof ENEMY_KINDS)[number] = 'tower'): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  chooseEnemy(s, kind);
  return s;
}
const morning = (s: GameState, day: number) => {
  s.tick = at(day, ENEMY_HOUR);
  greatEnemyHourly(s);
};

test('the Calamity is the Enemy\'s stirring: it wakes in the omens, spreads and breeds its cult as the plan grows', () => {
  const s = withEnemy('arc', 'plague');
  const e = s.greatEnemy!;
  assert.equal(s.calamity, undefined, 'asleep with the Enemy');
  e.plan = CALAMITY_AT.wakes;
  morning(s, 10);
  const c = s.calamity!;
  assert.equal(c.kind, 'rot', 'a plague brings the rot');
  assert.equal(c.stage, 1);
  assert.ok(c.driven);
  assert.ok(s.prompts.some((q) => q.kind === 'debrief') || s.scenes?.some((r) => r.id === 'calamity_wake_rot'), 'its waking is told');
  assert.ok(e.log.some((l) => l.text.includes('woke')), 'and in the Chronicle, as the Enemy\'s doing');
  assert.equal(heartDestination(s), undefined, 'its heart is not yet open');
  e.plan = CALAMITY_AT.spreading;
  morning(s, 11);
  assert.equal(c.stage, 2);
  assert.ok(c.scar > 0 && heartDestination(s), 'the spreading: the heart can be struck at');
  assert.ok(s.buildings.some((b) => b.def === WARD), 'a ward stone is laid');
  e.plan = CALAMITY_AT.cults;
  morning(s, 12);
  assert.equal(c.stage, 3);
  forceEnemy(s, 'march');
  assert.equal(c.stage, 4, 'the march is the Enemy\'s, and the Calamity follows it');
  forceEnemy(s, 'siege');
  assert.equal(c.stage, 5);
  assert.equal(stageOfEnemy({ plan: 0, stage: 'siege' }), 5);
  // (and one telling: the Calamity's dread is the plan's share)
  assert.equal(c.dread, Math.min(100, Math.round(((e.plan * 100) / PLAN_AT.siege) * 10) / 10));
});

test('nests quicken the plan and ward stones slow it; a cleared nest sets it back', () => {
  const s = withEnemy('nests-pace');
  forceEnemy(s, 'stirring');
  morning(s, 20);
  const c = s.calamity!;
  c.stage = 2;
  const calm = calamityPace(s);
  const p = spawnNest(s, 'den')!;
  p.nest!.level = 4;
  assert.ok(calamityPace(s) > calm, 'nests feed it');
  put(s, WARD, camp(s).x + 3, camp(s).y + 3, { status: 'done' });
  assert.ok(calamityPace(s) < calamityPace({ ...s, buildings: s.buildings.filter((b) => b.def !== WARD) } as never), 'a ward slows it');
  assert.ok(paceToday(s) >= 0.4);
  const before = s.greatEnemy!.plan;
  findNest(s, p, '');
  placeCleared(s, placeDestId(p.id), {}, new Rng(1));
  assert.ok(s.greatEnemy!.plan <= before - 0.9, `${s.greatEnemy!.plan} vs ${before}`);
  assert.ok(s.greatEnemy!.plan >= 0);
  assert.ok(NEST_CLEARED_DREAD > 0);
});

test('clearing the heart sets the plan back, and is not the end of the story', () => {
  const s = withEnemy('heart');
  forceEnemy(s, 'march');
  const e = s.greatEnemy!;
  const c = s.calamity!;
  assert.ok(c && heartDestination(s));
  const plan = e.plan;
  heartCleared(s);
  assert.ok(Math.abs(e.plan - (plan - HEART_SETBACK)) < 1e-9, 'the plan slips back');
  assert.equal(e.stage, 'march', 'the stage stands: the setback is not the end');
  assert.equal(s.gameOver, null);
  assert.equal(c.beaten, undefined, 'the Calamity is not beaten by it');
  assert.equal(heartDestination(s), undefined, 'the heart lies quiet a while');
  assert.ok(destinationOf(s, HEART_DEST), 'but the party that cleared it still has somewhere to be coming home from');
  assert.ok(e.log.some((l) => l.text.includes('broke')));
  assert.ok(calamityView(s)!.next.length > 0 && calamityView(s)!.enemy === GREAT_ENEMIES.tower.name.charAt(0).toUpperCase() + GREAT_ENEMIES.tower.name.slice(1));
});

test('no second Calamity scheduler runs: it never wakes, sieges or raids on a clock of its own', async () => {
  const mod = await import('../src/shared/sim/calamity');
  assert.ok(!('calamityHourly' in mod) && !('calamityRaidOver' in mod));
  const s = plainGame('no-clock');
  s.autopilot = true;
  const sim = new Sim(s);
  for (let i = 0; i < TICKS_PER_DAY * 14; i++) sim.step();
  assert.ok(s.greatEnemy, 'the Enemy is chosen');
  assert.equal(!!s.calamity, s.greatEnemy!.plan >= CALAMITY_AT.wakes, 'and no Calamity wakes but by the Enemy\'s plan');
  assert.ok(!s.raid || !s.raid.calamity);
});

test('the Enemy\'s siege is the finale: lost once it regroups, and the Calamity goes with its victory', () => {
  const s = withEnemy('finale');
  const e = forceEnemy(s, 'siege');
  const c = s.calamity!;
  greatEnemyHourly(s);
  s.tick = e.siegeAt ?? s.tick;
  s.tick -= s.tick % TICKS_PER_HOUR;
  e.siegeAt = s.tick;
  greatEnemyHourly(s);
  const r = s.raid!;
  assert.equal(r.enemy, 'siege');
  assert.equal(r.calamity, undefined, 'not a Calamity raid');
  for (let i = 0; i < 4; i++) put(s, 'lean_to', camp(s).x - 8 + i * 3, camp(s).y + 4, { status: 'done' });
  greatEnemyRaidOver(s, r);
  assert.equal(e.lost, 1);
  assert.equal(e.stage, 'march');
  assert.equal(e.plan, PLAN_AT.siege - SIEGE_REGROUP);
  assert.equal(c.beaten, undefined);
  for (const rd of r.raiders) if (rd.kind === GREAT_ENEMIES.tower.boss) rd.down = true;
  greatEnemyRaidOver(s, r);
  assert.equal(e.stage, 'peace');
  assert.ok(c.beaten !== undefined, 'the blight lifts with the Enemy\'s death');
  assert.equal(c.scar, 0);
});

test('an old save mid-Calamity loads and continues on the Enemy\'s plan', () => {
  // (a save from before the Calamity was the Enemy\'s stage: no `driven`, its own dread, stage, siege and lost count)
  const s = plainGame('old-save');
  s.autopilot = true;
  const e = chooseEnemy(s, 'plague');
  s.tick = at(40, ENEMY_HOUR);
  s.calamity = { kind: 'tyrant', dread: 50, stage: 3, woke: 1, heart: { x: 10, y: 10 }, scar: 8, lost: 1 } as never;
  assert.equal(e.stage, 'dormant');
  greatEnemyHourly(s);
  const c = s.calamity as NonNullable<GameState['calamity']>;
  assert.ok(c.driven);
  assert.equal(c.kind, 'rot', 'it is the Enemy\'s Calamity now');
  assert.ok(e.plan >= (50 * PLAN_AT.siege) / 100 - 1e-9, `the dread became plan: ${e.plan}`);
  assert.ok(['march', 'stirring'].includes(e.stage));
  assert.equal(e.lost, 1);
  assert.equal(c.stage >= 3, true);
  // (and it plays on from there: the stages come on, the siege is warned, nothing is told twice or crashes)
  const sim = new Sim(s);
  for (let i = 0; i < TICKS_PER_DAY * 3; i++) sim.step();
  assert.ok(s.greatEnemy!.plan > 0);
  // (a siege already on the land is the Enemy's)
  const t = plainGame('old-siege');
  t.autopilot = true;
  const f = chooseEnemy(t, 'tower');
  t.calamity = { kind: 'tyrant', dread: 100, stage: 5, woke: 1, heart: null, scar: 0, lost: 0, siegeAt: t.tick + 5 } as never;
  bindCalamity(t, f);
  assert.equal(f.stage, 'siege');
  assert.equal(f.siegeAt, t.tick + 5);
  assert.equal((t.calamity as NonNullable<GameState['calamity']>).siegeAt, undefined);
  // (an old save already won stays won)
  const w = plainGame('old-won');
  const g = chooseEnemy(w, 'tower');
  w.calamity = { kind: 'tyrant', dread: 0, stage: 5, woke: 1, heart: null, scar: 0, lost: 0, beaten: 5 } as never;
  bindCalamity(w, g);
  assert.equal(g.stage, 'dormant');
});

test('an old save\'s siege already under way is the Enemy\'s: its avatar falling wins it', () => {
  const s = plainGame('old-raid');
  s.autopilot = true;
  const e = chooseEnemy(s, 'tower');
  s.calamity = { kind: 'tyrant', dread: 100, stage: 5, woke: 1, heart: null, scar: 0, lost: 0 } as never;
  const r = { calamity: 'siege', raiders: [{ id: 99, kind: 'ashen_tyrant', down: true }] } as unknown as NonNullable<GameState['raid']>;
  s.raid = r;
  bindCalamity(s, e);
  assert.equal(r.enemy, 'siege');
  assert.equal(r.calamity, undefined);
  greatEnemyRaidOver(s, r);
  assert.equal(e.stage, 'peace', 'the old avatar\'s fall is the Enemy\'s defeat');
});
