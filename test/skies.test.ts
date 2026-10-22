import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIRSHIP_BY_KIND, AIRSHIP_ITEMS, SKY_HUNTERS, SKY_PLACES, SKY_RAIDS, SKY_SPOTS, SKY_TOPICS } from '../src/shared/data/skies';
import { ENEMIES } from '../src/shared/data/enemies';
import { DESTINATION_BY_ID } from '../src/shared/data/expeditions';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { MAP_SPOTS } from '../src/shared/data/worldMap';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { Rng } from '../src/shared/rng';
import { finishPiece } from '../src/shared/sim/crafting';
import { canSend, sendExpedition, updateExpeditions } from '../src/shared/sim/expeditions';
import { roamersTick } from '../src/shared/sim/roamers';
import { airfleet, airworthy, crash, freeAirship, launchAirship, planAirships, piratesMayCome, seePirates, skiesTick, skyHour, skyVolley, spawnSkyHunter } from '../src/shared/sim/skies';
import { snapshot as buildSnapshot } from '../src/shared/sim/snapshot';
import type { GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put } from './helpers';

/** A town of the Industrial age that has learned to fly. */
function skyTown(seed = 'skies'): GameState {
  const s = plainGame(seed);
  s.townBuilds = true;
  s.era = 'industrial';
  s.research.done.push('steam_power', 'cartography', 'steelmaking', 'aeronautics', 'rigid_airships');
  s.land.open = 30;
  return s;
}

test('the skies are in the game: topics, the mast, airships to build, enemies, raids and places that exist', () => {
  for (const t of SKY_TOPICS) {
    assert.ok(TOPIC_BY_ID[t.id], t.id);
    for (const p of t.prereqs) assert.ok(TOPIC_BY_ID[p], `${t.id} needs ${p}`);
  }
  for (const i of AIRSHIP_ITEMS) assert.equal(ITEM_BY_ID[i.id]?.station, 'airship_mast');
  for (const k of SKY_RAIDS) {
    assert.ok(RAID_KIND_BY_ID[k.id], k.id);
    assert.equal(k.weight, 0, 'never rolled: sent by sim/skies.ts');
    for (const id of Object.keys(k.enemies)) assert.ok(ENEMIES[id], `${k.id}: ${id}`);
  }
  for (const d of SKY_PLACES) {
    assert.ok(DESTINATION_BY_ID[d.id] && DESTINATION_BY_ID[d.id].bySky, d.id);
    assert.ok(MAP_SPOTS[d.id] && SKY_SPOTS[d.id], `${d.id} on the map`);
    for (const g of d.encounters.groups) for (const id of Object.keys(g.enemies)) assert.ok(ENEMIES[id], `${d.id}: ${id}`);
  }
  for (const era of Object.values(SKY_HUNTERS)) for (const g of [...era.day, ...era.night]) for (const id of Object.keys(g)) assert.ok(ENEMIES[id], `sky hunter ${id}`);
});

test('the town raises a mast, then builds an airship there, which joins the fleet, not the stores', () => {
  const s = skyTown();
  s.autopilot = true;
  for (let i = 0; i < 4; i++) s.people.push({ ...s.people[0], id: s.nextId++, name: `Flier ${i}` });
  planAirships(s);
  assert.ok(s.buildings.some((b) => b.def === 'airship_mast'), 'a mast laid');
  const mast = s.buildings.find((b) => b.def === 'airship_mast')!;
  mast.status = 'done';
  mast.progress = 1;
  const order = { id: s.nextId++, item: 'airship_zeppelin', count: 1, delivered: {}, itemsTaken: false, progress: 1, made: 0 };
  s.crafting.push(order);
  finishPiece(s, order, s.people[0]);
  assert.equal(airfleet(s).length, 1);
  assert.equal(airfleet(s)[0].kind, 'zeppelin');
  assert.ok(!s.items.airship_zeppelin, 'not in the stores');
  assert.ok(airworthy(airfleet(s)[0]));
});

test('a place in the sky needs an airship; with one any trip flies, faster, and she comes home', () => {
  const s = skyTown();
  const id = s.people[0].id;
  assert.equal(canSend(s, 'cloud_isles', [id]).reason, 'Needs an airworthy airship');
  // on foot first, for the walking time
  assert.ok(sendExpedition(s, 'riverbank', [id]).ok);
  const walk = s.expeditions[0].outTicks;
  s.expeditions = [];
  s.people[0].away = null;
  const ship = launchAirship(s, 'dirigible');
  assert.ok(sendExpedition(s, 'riverbank', [id]).ok);
  const e = s.expeditions[0];
  assert.equal(e.airship, ship.id);
  assert.equal(ship.away, e.id);
  assert.ok(e.outTicks < walk * 0.6, `flying (${e.outTicks}) beats walking (${walk})`);
  assert.equal(freeAirship(s), undefined, 'none left at the mast');
  // (quick legs: no hour aloft)
  e.outTicks = e.workTicks = e.backTicks = 1;
  const rng = new Rng(5);
  for (let t = 0; t < TICKS_PER_DAY && s.expeditions.length; t++) updateExpeditions(s, rng);
  assert.equal(s.expeditions.length, 0);
  assert.equal(ship.away, null, 'home at the mast');
  assert.ok(canSend(s, 'cloud_isles', [id]).ok);
});

test('shot down or torn apart, she falls: lost from the fleet, the loot with her, the party walking home', () => {
  const s = skyTown('crash');
  const ship = launchAirship(s, 'dirigible');
  const ids = [s.people[0].id];
  assert.ok(sendExpedition(s, 'riverbank', ids).ok);
  const e = s.expeditions[0];
  e.loot = { wood: 5 };
  crash(s, e, ship, s.people.filter((p) => ids.includes(p.id)), new Rng(1), 'shot down');
  assert.equal(airfleet(s).length, 0);
  assert.ok(e.crashed);
  assert.deepEqual(e.loot, {});
  assert.equal(e.airship, undefined);
  assert.equal(s.skies?.lost, 1);
});

test('aloft, the sky turns on her now and then: over many hours, storms batter her and fights start', () => {
  const s = skyTown('aloft');
  const ship = launchAirship(s, 'zeppelin');
  const id = s.people[0].id;
  assert.ok(sendExpedition(s, 'riverbank', [id]).ok);
  const e = s.expeditions[0];
  let fights = 0;
  for (let h = 0; h < 400 && ship.hull > 0 && !e.crashed; h++) {
    s.tick += TICKS_PER_HOUR;
    skyHour(s, e, s.people.filter((p) => p.id === id), () => fights++);
  }
  assert.ok(fights > 0 || ship.hull < AIRSHIP_BY_KIND.zeppelin.hull || e.crashed, 'something happened in 400 hours aloft');
});

test('sky pirates come to a town that flies (or any town from the Modern age), and drop into the middle of it', () => {
  const s = skyTown('pirates');
  assert.ok(!piratesMayCome(s), 'no airships, the Industrial age: none');
  s.era = 'modern';
  assert.ok(piratesMayCome(s));
  s.era = 'industrial';
  launchAirship(s, 'dirigible');
  assert.ok(piratesMayCome(s));
  seePirates(s);
  assert.ok(s.skies?.pirates, 'their ship is seen');
  const snap = buildSnapshot(s);
  assert.equal(snap.skyPirates?.phase, 'coming');
  s.tick = s.skies!.pirates!.at - (s.skies!.pirates!.at % 10) + 10;
  skiesTick(s);
  assert.ok(s.raid, 'a raid begins');
  assert.ok(s.raid!.kind.startsWith('sky_pirates'));
  assert.equal(s.raid!.phase, 'active', 'already in the town');
  assert.equal(buildSnapshot(s).skyPirates?.phase, 'over');
  // Gale's Roost cleared keeps them away
  s.raid = null;
  s.skies!.quietUntil = s.tick + TICKS_PER_DAY;
  assert.ok(!piratesMayCome(s));
});

test('a hunter from the sky flies over walls, swoops on someone in the open, and the town shoots it down', () => {
  const s = skyTown('hunter');
  const p = s.people[0];
  const r = spawnSkyHunter(s, new Rng(2), { harpy: 1 })!;
  assert.ok(r.flying);
  // put it right over them: it dives and they fight it on the FF screen
  r.x = p.x + 40;
  r.y = (p.y ?? 0) + 10;
  r.homeX = r.x;
  r.homeY = r.y;
  r.chasing = p.id;
  for (let t = 0; t < 60 && !s.skirmishes?.length; t++) {
    s.tick++;
    roamersTick(s);
  }
  assert.ok(s.skirmishes?.length, 'caught: a fight');
  assert.equal(p.skirmish, s.skirmishes![0].id);
  // another, over a crossbow town: shot down
  const s2 = skyTown('volley');
  for (let i = 0; i < 6; i++) s2.people.push({ ...s2.people[0], id: s2.nextId++, name: `Archer ${i}`, gear: { weapon: 'crossbow' } });
  const r2 = spawnSkyHunter(s2, new Rng(4), { carrion_crow: 1 })!;
  r2.x = s2.people[0].x;
  r2.y = s2.people[0].y ?? 0;
  for (let t = 0; t < 4000 && s2.roamers?.includes(r2) && r2.until > s2.tick; t++) {
    s2.tick++;
    skyVolley(s2);
  }
  assert.ok(!s2.roamers?.includes(r2) || (r2.hurt ?? 0) >= 0.7, 'brought down or driven off');
});

test('the mast stands on the map and the fleet is in the snapshot', () => {
  const s = skyTown('snap');
  put(s, 'airship_mast', s.land.camp.x + 4, s.land.camp.y + 3);
  launchAirship(s, 'dirigible');
  const snap = buildSnapshot(s);
  assert.ok(snap.mast);
  assert.equal(snap.airships.length, 1);
  assert.equal(snap.airships[0].away, null);
});
