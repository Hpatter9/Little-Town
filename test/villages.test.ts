import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { BESET_OPTIONS, CART_LOAD, GIFT_COINS, HELP_HOURS, REBEL_AT, TITHE_AT, VILLAGE_HOUR } from '../src/shared/data/villages';
import { Rng } from '../src/shared/rng';
import { bandsTick } from '../src/shared/sim/bands';
import { canPlace, totalStock } from '../src/shared/sim/buildings';
import { isPlannedRoad } from '../src/shared/sim/land';
import { boardDestinations } from '../src/shared/sim/parties';
import { startRaid } from '../src/shared/sim/raids';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, type GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { answerBeset, answerParting, foundVillage, giftVillage, villageBuildings, villageHome, villagesHourly, villageSpot, type Village } from '../src/shared/sim/villages';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;
const lucky = (seed: number, yes: boolean) => Object.assign(new Rng(seed), { chance: () => yes }) as Rng;

/** A town of `n` grown-ups, run by itself (the villages only come to a self-running town). */
function bigTown(seed: string, n = 18): GameState {
  const s = plainGame(seed);
  const rng = new Rng(9);
  const c = s.people[0];
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 4, y: c.y }, s.people.map((p) => p.name)));
  s.autopilot = true;
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 40, stone: 20, berries: 30 };
  return s;
}

function aVillage(s: GameState, loyalty = 70): Village {
  const at = villageSpot(s, new Rng(4))!;
  const ids = s.people.slice(1, 6).map((p) => p.id);
  return foundVillage(s, { ids, leader: ids[0], x: at.x, y: at.y, name: 'Testford' }, loyalty)!;
}

test('a big town is asked to let some go; blessed, they found a village out on the land', () => {
  const s = bigTown('villages-found');
  s.tick = at(11, VILLAGE_HOUR);
  const before = s.people.length;
  const wood = totalStock(s).wood ?? 0;
  villagesHourly(s);
  const q = s.prompts.find((p) => p.kind === 'village');
  assert.ok(q && s.villagePlan, 'the question is put');
  assert.equal(q.village?.about, 'parting');
  const going = s.villagePlan!.ids.length;
  assert.ok(going >= 3 && !s.villagePlan!.ids.includes(s.mainId), 'a few go, never the founder');
  answerParting(s, 0, new Rng(1));
  const v = s.villages![0];
  assert.ok(v, 'founded');
  assert.equal(s.people.length, before - going, 'they left the town');
  assert.equal(v.folk.length, going);
  assert.ok((totalStock(s).wood ?? 0) < wood, 'the blessing took wood from the stores');
  assert.ok(v.loyalty >= 75, 'blessed, they think well of the town');
  assert.ok(Math.hypot(v.x - s.land.camp.x, v.y - s.land.camp.y) <= s.land.open, 'the land out there is known');
  assert.ok(v.plots.some((p) => p.def === 'campfire') && v.plots.some((p) => p.field) && v.plots.some((p) => BUILDING_BY_ID[p.def].housing), 'a fire, a home and a field');
  let planned = 0;
  for (let y = 0; y < s.land.h; y++) for (let x = 0; x < s.land.w; x++) if (isPlannedRoad(s.land, x, y)) planned++;
  assert.ok(planned > 5, 'a road is planned out to it');
  // the map draws its plots, never as the town's; nothing of the town's may go there
  const bs = villageBuildings(s);
  assert.ok(bs.length >= 3 && bs.every((b) => b.id < 0));
  assert.equal(canPlace(s, BUILDING_BY_ID.lean_to, v.x + 1, v.y + 1).ok, false);
  const view = snapshot(s);
  assert.equal(view.villages[0].name, v.name);
  assert.ok(view.villageBuildings.length >= 3);
});

test('forbidden, they stay sore, or go anyway thinking ill of the town', () => {
  const s = bigTown('villages-forbid');
  s.tick = at(11, VILLAGE_HOUR);
  villagesHourly(s);
  const n = s.people.length;
  answerParting(s, 2, lucky(1, false));
  assert.equal(s.people.length, n, 'they stay');
  assert.ok(s.people.some((p) => p.sore?.text.includes('Forbidden')));
  const t = bigTown('villages-forbid2');
  t.tick = at(11, VILLAGE_HOUR);
  villagesHourly(t);
  answerParting(t, 2, lucky(1, true));
  assert.ok(t.villages![0].loyalty < 40, 'gone anyway, they remember it');
});

test('each morning it grows and works its land; a full cart comes down the road to the town', () => {
  const s = bigTown('villages-cart');
  const v = aVillage(s, 80);
  s.tick = at(12, VILLAGE_HOUR);
  for (let d = 0; d < 6; d++) {
    villagesHourly(s);
    s.tick += TICKS_PER_DAY;
  }
  assert.ok(v.pop >= 5, 'it holds its people or grows');
  v.goods = { wood: CART_LOAD + 2 };
  s.buildings.find((b) => b.def === 'campfire')!.store = {};
  s.tick = at(20, 10);
  villagesHourly(s);
  assert.ok(v.cart !== undefined, 'a cart sets out');
  const band = s.bands!.find((b) => b.id === v.cart)!;
  assert.equal(band.kind, 'village');
  assert.ok(band.wagon, 'with its wagon');
  const wood = totalStock(s).wood ?? 0;
  for (let i = 0; i < 12 * TICKS_PER_HOUR && band.phase === 'coming'; i++) {
    s.tick++;
    bandsTick(s);
  }
  assert.equal(band.phase, 'staying', 'it reaches the town');
  assert.ok(v.loyalty >= TITHE_AT);
  assert.ok((totalStock(s).wood ?? 0) >= wood + CART_LOAD, 'its tithe is in the stores');
});

test('neglected and taxed hard it breaks away and raids; brought to heel it is the town\'s again', () => {
  const s = bigTown('villages-rebel');
  const v = aVillage(s, REBEL_AT + 6);
  s.tax = 'heavy';
  v.folk.find((p) => p.id === v.leader)!.nature = 'proud';
  s.tick = at(12, VILLAGE_HOUR);
  for (let d = 0; d < 40 && !v.rebel; d++) {
    villagesHourly(s);
    s.tick += TICKS_PER_DAY;
  }
  assert.ok(v.rebel, 'it breaks away');
  const dest = boardDestinations(s).find((d) => d.id === `village:${v.id}`);
  assert.ok(dest, 'a party may be sent to bring it to heel');
  assert.ok(RAID_KIND_BY_ID.village_rebels, 'its rebels have a raid');
  // no help from a rebel village
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 40, new Rng(2));
  assert.ok(!r.raiders.some((rd) => rd.ally), 'a rebel village sends nobody');
  s.raid = null;
  const coins = s.coins ?? 0;
  villageHome(s, `village:${v.id}`, true);
  assert.ok(!v.rebel && (s.coins ?? 0) > coins, 'brought to heel, with a tribute');
  assert.ok(!boardDestinations(s).some((d) => d.id === `village:${v.id}`));
});

test('a loyal village sends fighters to a raid on the town; a gift warms it', () => {
  const s = bigTown('villages-help');
  const v = aVillage(s, 80);
  v.pop = 10;
  const rng = lucky(3, true);
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 40, rng);
  assert.ok(r.raiders.some((rd) => rd.ally), 'its fighters stand with the town');
  s.raid = null;
  s.coins = GIFT_COINS + 5;
  v.loyalty = 40;
  assert.ok(giftVillage(s, v.id));
  assert.ok(v.loyalty > 40 && (s.coins ?? 0) === 5);
});

test('beset: fighters sent go away and come back; left alone it loses people and loyalty', () => {
  const s = bigTown('villages-beset');
  const v = aVillage(s, 70);
  v.pop = 12;
  v.beset = { foe: 'wolves', prompt: -1, until: s.tick + TICKS_PER_HOUR };
  answerBeset(s, v, 0, new Rng(2));
  assert.ok(v.helpers && v.helpers.ids.length > 0, 'fighters go');
  assert.ok(v.helpers.ids.every((id) => s.people.find((p) => p.id === id)?.away != null), 'away from town');
  s.tick += HELP_HOURS * TICKS_PER_HOUR + 1;
  s.tick = Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  villagesHourly(s);
  assert.ok(!v.helpers, 'home again');
  assert.ok(s.people.every((p) => p.away === null || p.away >= 0), 'none still away');
  const pop = v.pop;
  const loyal = v.loyalty;
  v.beset = { foe: 'goblins', prompt: -1, until: s.tick + TICKS_PER_HOUR };
  answerBeset(s, v, BESET_OPTIONS.length - 1, new Rng(2));
  assert.ok(v.pop < pop && v.loyalty < loyal, 'left to it');
});
