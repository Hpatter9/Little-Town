import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { ENEMIES } from '../src/shared/data/enemies';
import { PORTAL_ARCH, PORTAL_RAIDS, REALM_DEFS, REALMS, RIFT_FROM_DAY, RIFT_HOUR, RISE_AT, SITES, UNDER_DRAIN } from '../src/shared/data/portals';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { boardDestinations } from '../src/shared/sim/parties';
import { makeSites, nextSite, portalDestination, portalHome, portalOf, portalsHourly, portalView, tearRift } from '../src/shared/sim/portals';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, maxHp, type GameState } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { grownAt } from '../src/shared/sim/ageing';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { freeSpot, plainGame, put } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function town(seed: string, n = 6): GameState {
  const s = plainGame(seed);
  const rng = new Rng(3);
  const c = s.people[0];
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 6, y: c.y }, s.people.map((q) => q.name)));
  s.autopilot = true;
  return s;
}

test('portals are wired in: a topic, the arch, three realms whose creatures and bosses are real', () => {
  assert.ok(TOPIC_BY_ID.planar_lore);
  assert.equal(BUILDING_BY_ID[PORTAL_ARCH].research, 'planar_lore');
  for (const r of REALMS) {
    const def = REALM_DEFS[r];
    assert.ok(ENEMIES[def.boss], def.boss);
    assert.ok(RAID_KIND_BY_ID[def.raid], def.raid);
    const sites = makeSites('portal-seed', r);
    assert.deepEqual(sites, makeSites('portal-seed', r), 'the same seed, the same sites');
    assert.equal(sites.length, SITES);
    for (const x of sites) {
      assert.ok(Object.keys(x.foes).length > 0, `${def.name}: ${x.name} is guarded`);
      for (const id of Object.keys(x.foes)) assert.ok(ENEMIES[id], id);
    }
    assert.ok(sites[SITES - 1].foes[def.boss], 'its master waits at the heart');
  }
  for (const k of PORTAL_RAIDS) assert.ok(Object.keys(k.enemies).length > 0, k.id);
});

test('a finished arch opens a realm: a telling, and its next site on the board', () => {
  const s = town('portal-arch');
  const spot = freeSpot(s, PORTAL_ARCH);
  const b = put(s, PORTAL_ARCH, spot.x, spot.y);
  s.tick = at(3, 10);
  portalsHourly(s);
  assert.equal(s.portals?.length, 1);
  const pt = s.portals![0];
  assert.equal(pt.building, b.id);
  assert.ok(s.prompts.some((p) => p.kind === 'debrief' && p.title.includes(REALM_DEFS[pt.realm].name)));
  const id = `portal:${pt.realm}`;
  assert.ok(boardDestinations(s).some((d) => d.id === id), 'on the board');
  assert.ok(snapshot(s).destinations.some((d) => d.id === id));
  assert.equal(snapshot(s).portals.length, 1);
  // looking in
  s.watchingPortal = pt.realm;
  assert.equal(portalView(s)?.map.length, SITES);
  // one arch, one realm: an hour later nothing more opens
  s.tick += TICKS_PER_HOUR;
  portalsHourly(s);
  assert.equal(s.portals.length, 1);
});

test('a party that wins explores the site and brings its riches; the realm stirs, and past the brim things come out', () => {
  const s = town('portal-trip');
  const spot = freeSpot(s, PORTAL_ARCH);
  const b = put(s, PORTAL_ARCH, spot.x, spot.y);
  s.tick = at(3, 10);
  portalsHourly(s);
  const pt = s.portals![0];
  const coins = s.coins ?? 0;
  const first = nextSite(pt)!;
  portalHome(s, `portal:${pt.realm}`, s.people.slice(1, 3), true, { x: s.people[0].x, y: s.people[0].y });
  assert.ok(first.explored, 'explored');
  assert.notEqual(nextSite(pt), first, 'the next site is next');
  assert.ok((s.coins ?? 0) > coins, 'coins');
  assert.ok(pt.stir > 0, 'stirred');
  // stirred past the brim: a raid out of the portal
  pt.stir = RISE_AT + 1;
  s.tick += TICKS_PER_HOUR;
  portalsHourly(s);
  assert.ok(s.raid, 'things come out');
  assert.equal(s.raid!.kind, REALM_DEFS[pt.realm].raid);
  assert.ok(b);
});

test('each realm has its rule: the Feywild turns years, the Underworld drains; the heart broken calms it', () => {
  const s = town('portal-rules', 8);
  const arch = put(s, PORTAL_ARCH, freeSpot(s, PORTAL_ARCH).x, freeSpot(s, PORTAL_ARCH).y);
  // the Underworld drains the living
  s.portals = [];
  s.portals.push({ realm: 'underworld', building: arch.id, rift: false, opened: 0, sites: makeSites(s.seed, 'underworld'), stir: 0, calm: false, log: [], trips: 0 });
  const party = s.people.slice(1, 5);
  for (const p of party) p.hp = maxHp(p);
  portalHome(s, 'portal:underworld', party, true, { x: s.people[0].x, y: s.people[0].y });
  const left = party.filter((p) => s.people.includes(p));
  assert.ok(left.length >= 1);
  for (const p of left) assert.ok(p.hp <= maxHp(p) * (1 - UNDER_DRAIN) + 0.01, `${p.name} drained`);
  // the Feywild: years gone or given back
  const f = town('portal-fae', 10);
  const farch = put(f, PORTAL_ARCH, freeSpot(f, PORTAL_ARCH).x, freeSpot(f, PORTAL_ARCH).y);
  f.portals = [{ realm: 'fae', building: farch.id, rift: false, opened: 0, sites: makeSites(f.seed, 'fae'), stir: 0, calm: false, log: [], trips: 0 }];
  const fparty = f.people.slice(1, 9);
  const before = fparty.map((p) => grownAt(f, p));
  portalHome(f, 'portal:fae', fparty, true, { x: f.people[0].x, y: f.people[0].y });
  assert.ok(fparty.some((p, i) => !f.people.includes(p) || grownAt(f, p) !== before[i]), 'time ran strangely for someone');
  // the heart broken: calm for good
  const pt = f.portals[0];
  for (const x of pt.sites.slice(0, -1)) x.explored = true;
  assert.ok(portalDestination(f, 'portal:fae')!.description.includes('heart'));
  portalHome(f, 'portal:fae', f.people.slice(1, 3), true, { x: f.people[0].x, y: f.people[0].y });
  assert.ok(pt.calm && pt.stir === 0, 'calm');
  assert.equal(portalDestination(f, 'portal:fae'), undefined, 'nothing left to explore');
  assert.ok(!portalOf(f, 'fae')!.sites.some((x) => !x.explored));
});

test('a rift may tear open by itself, from its day, onto a realm not yet reached', () => {
  const s = town('portal-rift');
  s.tick = at(RIFT_FROM_DAY - 1, RIFT_HOUR);
  portalsHourly(s);
  assert.equal(s.portals?.length ?? 0, 0, 'not before its day');
  let day = RIFT_FROM_DAY;
  while (!s.portals?.length && day < RIFT_FROM_DAY + 400) {
    s.tick = at(day++, RIFT_HOUR);
    portalsHourly(s);
  }
  assert.equal(s.portals?.length, 1, 'a rift came');
  assert.ok(s.portals![0].rift);
  assert.ok(s.buildings.some((b) => b.id === s.portals![0].building && b.def === 'portal_rift'));
  // tearing another opens a different realm
  const other = REALMS.find((r) => r !== s.portals![0].realm)!;
  tearRift(s, other);
  assert.notEqual(s.portals![1].realm, s.portals![0].realm);
});
