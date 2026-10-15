import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENEMIES } from '../src/shared/data/enemies';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { CUTSCENES } from '../src/shared/data/cutscenes';
import { MAP_SPOTS } from '../src/shared/data/worldMap';
import { DANGER_PACE } from '../src/shared/data/pace';
import { ENEMY_HOUR, ENEMY_KINDS, GREAT_ENEMIES, LIEUTENANT_SETBACK, MONUMENT, OUTPOST_DEST, PLAN_AT, SEAT_DEST, SEAT_SETBACK, TRIBUTE_SETBACK } from '../src/shared/data/greatEnemy';
import { answerEnemy, chooseEnemy, enemyDestinations, enemyLegend, enemyPlaceCleared, forceEnemy, greatEnemyHourly, greatEnemyRaidOver, greatEnemyView, inheritEnemy, paceToday, slayLieutenant } from '../src/shared/sim/greatEnemy';
import { destinationOf } from '../src/shared/sim/expeditions';
import { blightSources } from '../src/shared/sim/blight';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import type { GameState } from '../src/shared/sim/state';
import { camp, plainGame, put } from './helpers';

const foeOf = (s: GameState) => s.greatEnemy;
const overOf = (s: GameState) => s.gameOver;
const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
const SCENES = ['enemy_omens', 'enemy_stirring', 'enemy_march', 'enemy_siege', 'enemy_lieutenant', 'enemy_victory', 'enemy_repelled', 'enemy_fallen'];

test('every Great Enemy has its boss, lieutenants, army, guards, relic, scenes and places on the world map', () => {
  for (const k of ENEMY_KINDS) {
    const d = GREAT_ENEMIES[k];
    const boss = ENEMIES[d.boss];
    assert.ok(boss?.boss && boss.kit?.trophy === d.trophy && ITEM_BY_ID[d.trophy], `${k}: boss and relic`);
    assert.equal(d.lieutenants.length, 3, k);
    for (const l of d.lieutenants) {
      assert.ok(ENEMIES[l.id]?.boss, `${k}: ${l.id}`);
      for (const id of Object.keys(l.guard)) assert.ok(ENEMIES[id], `${k}: ${id}`);
    }
    for (const id of Object.keys(d.seatGuard)) assert.ok(ENEMIES[id], `${k}: ${id}`);
    const army = RAID_KIND_BY_ID[d.army];
    assert.ok(army && army.weight === 0, `${k}: its army is never rolled`);
    for (const id of Object.keys(army.enemies)) assert.ok(ENEMIES[id], `${k}: ${id}`);
    for (const kit of [boss.kit, ...d.lieutenants.map((l) => ENEMIES[l.id].kit)]) if (kit?.summon) assert.ok(ENEMIES[kit.summon.kind], kit.summon.kind);
    assert.ok(MAP_SPOTS[SEAT_DEST(k)] && [0, 1, 2].every((i) => MAP_SPOTS[OUTPOST_DEST(k, i)]), `${k}: on the world map`);
    assert.ok(d.omens.length && d.dreams.length && d.missing.length && d.stages.omens && d.stages.siege, k);
  }
  for (const id of SCENES) assert.ok(CUTSCENES[id], id);
  assert.ok(BUILDING_BY_ID[MONUMENT]);
});

test('the Enemy is chosen on the second day to fit the land: the drowned king only by the sea', () => {
  const kinds: Record<string, number> = {};
  for (let i = 0; i < 24; i++) {
    const s = plainGame(`fit${i}`);
    s.autopilot = true;
    s.biome = 'coast';
    s.tick = at(2, ENEMY_HOUR - 1);
    greatEnemyHourly(s);
    assert.equal(foeOf(s), undefined, 'not before its hour');
    s.tick = at(2, ENEMY_HOUR);
    greatEnemyHourly(s);
    assert.ok(s.greatEnemy, 'chosen on day 2');
    assert.equal(s.greatEnemy!.stage, 'dormant');
    kinds[s.greatEnemy!.kind] = (kinds[s.greatEnemy!.kind] ?? 0) + 1;
    // the same town always draws the same one
    const again = plainGame(`fit${i}`);
    again.biome = 'coast';
    assert.equal(chooseEnemy(again).kind, s.greatEnemy!.kind);
  }
  assert.ok((kinds.drowned ?? 0) >= 6, `the coast mostly draws the drowned king: ${JSON.stringify(kinds)}`);
  for (let i = 0; i < 24; i++) {
    const s = plainGame(`inland${i}`);
    s.biome = 'swamp';
    const k = chooseEnemy(s).kind;
    assert.notEqual(k, 'drowned', 'never inland');
  }
  // without the autopilot it never comes
  const off = plainGame('off');
  off.tick = at(2, ENEMY_HOUR);
  greatEnemyHourly(off);
  assert.equal(foeOf(off), undefined);
});

test('its plan moves on by the paced day, and the stages come as it grows', () => {
  const s = plainGame('arc');
  s.autopilot = true;
  s.tick = at(2, ENEMY_HOUR);
  greatEnemyHourly(s);
  const e = s.greatEnemy!;
  const pace = paceToday(s);
  let day = 2;
  while (e.stage === 'dormant' && day < 60) {
    day++;
    s.tick = at(day, ENEMY_HOUR);
    greatEnemyHourly(s);
  }
  assert.equal(e.stage, 'omens');
  assert.ok(Math.abs(e.plan - ((day - 2) * pace) / DANGER_PACE) < 1e-6, `plan ${e.plan} after ${day - 2} days at ${pace}`);
  assert.ok(e.plan >= PLAN_AT.omens && e.plan < PLAN_AT.omens + 1);
  assert.ok(Math.abs(day - 2 - (PLAN_AT.omens * DANGER_PACE) / pace) <= 1, `omens on day ${day}`);
  // the stirring brings its outposts, its seat found, and its blight creeping onto the land
  while (e.stage === 'omens' && day < 120) {
    day++;
    s.tick = at(day, ENEMY_HOUR);
    greatEnemyHourly(s);
  }
  assert.equal(e.stage, 'stirring');
  assert.ok(e.seatFound !== undefined && e.outposts);
  assert.equal(enemyDestinations(s).length, 4, 'its seat and three outposts on the board');
  assert.ok(blightSources(s).some((b) => b.x === e.creep!.x + 0.5), 'its blight on the land');
  assert.ok(paceToday(s) > pace, 'outposts left standing hasten it');
  const v = greatEnemyView(s)!;
  assert.equal(v.stage, 'stirring');
  assert.ok(v.daysToNext! > 0 && v.lieutenants.every((l) => l.dest));
});

test('slaying its lieutenants and striking its seat sets it back; with them all dead its seat holds the Enemy itself', () => {
  const s = plainGame('lieutenants');
  s.autopilot = true;
  s.tick = at(40, ENEMY_HOUR);
  const e = forceEnemy(s, 'stirring', 'undying');
  e.plan = 20;
  const fast = paceToday(s);
  const out0 = OUTPOST_DEST('undying', 0);
  assert.ok(destinationOf(s, out0), 'an outpost on the board');
  enemyPlaceCleared(s, out0);
  assert.ok(e.slain[0] !== null);
  assert.equal(e.plan, 20 - LIEUTENANT_SETBACK);
  assert.ok(paceToday(s) < fast, 'one fewer outpost hastening it');
  assert.ok(!enemyDestinations(s).some((d) => d.id === out0), 'gone from the board');
  assert.ok(destinationOf(s, out0), 'a party out there still has somewhere to come home from');
  // a lieutenant who leads a host and falls in it is slain too
  const r = { enemy: 'host', enemyLt: 1, raiders: [{ kind: GREAT_ENEMIES.undying.lieutenants[1].id, down: true }] } as never;
  greatEnemyRaidOver(s, r);
  assert.ok(e.slain[1] !== null);
  // the seat struck while one still lives: set far back
  const seat = SEAT_DEST('undying');
  const before = e.plan;
  enemyPlaceCleared(s, seat);
  assert.equal(e.plan, Math.max(0, before - SEAT_SETBACK));
  assert.ok(!enemyDestinations(s).some((d) => d.id === seat), 'the seat lies quiet a while');
  // the last slain, the Enemy waits at its seat: a win there is the end of it
  slayLieutenant(s, 2, 'somewhere');
  s.tick += 20 * TICKS_PER_DAY;
  const d = enemyDestinations(s).find((x) => x.id === seat)!;
  assert.ok(d.encounters.groups[0].enemies[GREAT_ENEMIES.undying.boss] === 1, 'Kharzul himself');
  enemyPlaceCleared(s, seat);
  assert.equal(e.stage, 'peace');
  assert.ok(s.items[GREAT_ENEMIES.undying.trophy]);
});

test('it demands tribute in the march: paid, it slips back; refused, it hastens', () => {
  const s = plainGame('tribute');
  s.autopilot = true;
  s.coins = 1000;
  s.tick = at(80, ENEMY_HOUR);
  const e = forceEnemy(s, 'march', 'tower');
  e.plan = 40;
  e.lastHost = s.tick; // (no host today)
  s.tick += TICKS_PER_DAY;
  greatEnemyHourly(s);
  const p = s.prompts.find((q) => q.kind === 'enemy')!;
  assert.ok(p, 'a demand in the event box');
  assert.equal(p.defaultOption, 0, 'a rich town pays if left to itself');
  const plan = e.plan;
  answerEnemy(s, p, 0);
  assert.ok(s.coins < 1000);
  assert.ok(Math.abs(e.plan - (plan - TRIBUTE_SETBACK)) < 1e-9);
  answerEnemy(s, p, 1);
  assert.equal(e.refused, 1);
  assert.equal(e.lastHost, undefined, 'a host comes at once');
  s.tick += TICKS_PER_DAY;
  greatEnemyHourly(s);
  assert.equal(s.raid?.enemy, 'host');
  assert.ok(s.raid!.raiders.some((rd) => GREAT_ENEMIES.tower.lieutenants.some((l) => l.id === rd.kind)), 'a lieutenant leads it');
});

test('the last siege fires: lost once the town burns and it comes again, lost twice the town falls; won, a lasting peace', () => {
  const s = plainGame('siege');
  s.autopilot = true;
  s.tick = at(130, ENEMY_HOUR);
  const e = forceEnemy(s, 'siege', 'brood');
  assert.equal(e.stage, 'siege');
  greatEnemyHourly(s);
  const r = s.raid!;
  assert.equal(r.enemy, 'siege');
  const d = GREAT_ENEMIES.brood;
  assert.ok(r.raiders.some((rd) => rd.kind === d.boss), 'Sarnath leads it');
  assert.equal(d.lieutenants.filter((l) => r.raiders.some((rd) => rd.kind === l.id)).length, 3, 'its living lieutenants march with it');
  assert.ok(r.raiders.length >= 20, `a great host: ${r.raiders.length}`);
  for (let i = 0; i < 6; i++) put(s, 'lean_to', camp(s).x - 9 + i * 3, camp(s).y + 4, { status: 'done' });
  s.raid = null;
  const folk = s.people.length;
  greatEnemyRaidOver(s, r);
  assert.equal(e.lost, 1);
  assert.equal(e.stage, 'march');
  assert.ok(e.slain.every((x) => x === null), 'nobody fell');
  assert.ok(s.buildings.some((b) => b.fire !== undefined), 'the town burns');
  assert.ok(s.people.length < folk || folk < 3, 'the town is sacked');
  assert.equal(overOf(s), null);
  greatEnemyRaidOver(s, r);
  assert.equal(e.stage, 'fallen');
  assert.ok(s.gameOver && !s.gameOver.won, 'the second lost is the end');
  assert.deepEqual(enemyLegend(s), { kind: 'brood', name: d.name, fate: 'won' });
  // a descendant's town meets it again
  const heir = plainGame('heir');
  heir.autopilot = true;
  inheritEnemy(heir, enemyLegend(s), 'Maud');
  heir.tick = at(2, ENEMY_HOUR);
  greatEnemyHourly(heir);
  assert.equal(heir.greatEnemy!.kind, 'brood');
  assert.equal(heir.greatEnemy!.vengeance, 'Maud');

  // won: the Enemy struck down
  const t = plainGame('siege-won');
  t.autopilot = true;
  t.tick = at(130, ENEMY_HOUR);
  const f = forceEnemy(t, 'siege', 'engine');
  greatEnemyHourly(t);
  const w = t.raid!;
  for (const rd of w.raiders) if (rd.kind === GREAT_ENEMIES.engine.boss || rd.kind === GREAT_ENEMIES.engine.lieutenants[0].id) rd.down = true;
  greatEnemyRaidOver(t, w);
  assert.equal(f.stage, 'peace');
  assert.equal(t.gameOver, null, 'the town goes on');
  assert.ok(f.slain[0] !== null, 'a lieutenant cut down in the siege counts');
  assert.ok(f.title && f.slayer);
  assert.ok(t.items[GREAT_ENEMIES.engine.trophy]);
  assert.ok(t.buildings.some((b) => b.def === MONUMENT), 'a monument raised');
  assert.equal(enemyDestinations(t).length, 0);
  // and nothing more comes of it
  const plan = f.plan;
  t.tick += TICKS_PER_DAY;
  t.raid = null;
  greatEnemyHourly(t);
  assert.equal(f.plan, plan);
});
