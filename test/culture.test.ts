import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CULTURE_ITEMS, CULTURE_TRAITS, CUSTOM_DAY, CUSTOM_HOUR, TRAIT_BY_ID, dishId } from '../src/shared/data/culture';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { cultureDaily, cultureHourly, cultureOf, cultureView, fashionName } from '../src/shared/sim/culture';
import { recordFallen } from '../src/shared/sim/annals';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { storages } from '../src/shared/sim/buildings';
import { addStock } from '../src/shared/sim/state';
import { plainGame } from './helpers';

const town = (seed: string) => {
  const s = plainGame(seed);
  s.autopilot = true;
  return s;
};
const starve = (s: ReturnType<typeof town>, n: number) => { for (let i = 0; i < n; i++) recordFallen(s, { ...s.people[0], id: 900 + i, name: `Lost${i}` }, 'of hunger'); };

test('every trait has a dish item, a custom and a unique id', () => {
  assert.equal(new Set(CULTURE_TRAITS.map((t) => t.id)).size, CULTURE_TRAITS.length);
  for (const t of CULTURE_TRAITS) assert.ok(ITEM_BY_ID[dishId(t)], t.id);
  assert.equal(CULTURE_ITEMS.length, CULTURE_TRAITS.length);
});

test('a famine wins the hoarding traits, and they fade when it is not repeated', () => {
  const s = town('culture-famine');
  addStock(storages(s)[0].store, 'berries', 300); // (a full larder: no hunger of its own)
  cultureDaily(s); // (a first reading sets the baseline)
  starve(s, 4);
  cultureDaily(s);
  assert.ok(cultureOf(s).held.includes('hoarders'), 'won by the famine');
  assert.ok(cultureView(s).held.some((t) => t.id === 'hoarders'));
  for (let i = 0; i < 80; i++) { s.tick += TICKS_PER_DAY; cultureDaily(s); }
  assert.ok(!cultureOf(s).held.includes('hoarders'), 'faded without a new famine');
});

test('a town holds only a handful of traits at once', () => {
  const s = town('culture-many');
  cultureDaily(s);
  for (const t of CULTURE_TRAITS) cultureOf(s).strength[t.id] = 30;
  cultureDaily(s);
  assert.equal(cultureOf(s).held.length, 5);
});

test('a held trait orders its dish and keeps its custom', () => {
  const s = town('culture-custom');
  const t = TRAIT_BY_ID.hoarders;
  const c = cultureOf(s);
  c.held = [t.id];
  c.strength[t.id] = 30;
  addStock(storages(s)[0].store, 'berries', 300);
  s.tick = 25 * TICKS_PER_DAY;
  let sawOrder = false, kept = false;
  const seasonStart = () => calendar(s.tick).season === t.custom.season && calendar(s.tick).dayOfSeason === 1 && calendar(s.tick).hour === 5;
  while (!seasonStart()) s.tick += TICKS_PER_HOUR;
  while (!(calendar(s.tick).dayOfSeason === CUSTOM_DAY && calendar(s.tick).hour === CUSTOM_HOUR)) {
    s.tick += TICKS_PER_HOUR;
    cultureHourly(s);
    if (s.crafting.some((o) => o.item === dishId(t))) { sawOrder = true; s.items[dishId(t)] = 2; }
  }
  assert.ok(sawOrder, 'the dish was ordered at the fire');
  cultureHourly(s);
  kept = s.journal.some((j) => j.text.includes(t.custom.name));
  assert.ok(kept, 'the custom was kept');
  assert.equal(s.items[dishId(t)] ?? 0, 0, 'the dish was eaten');
});

test('the culture does nothing without the autopilot, and fashion leans names', () => {
  const s = plainGame('culture-plain');
  s.autopilot = false;
  starve(s, 5);
  s.tick = 5 * TICKS_PER_HOUR;
  cultureHourly(s);
  assert.equal(s.culture, undefined);
  s.autopilot = true;
  cultureOf(s).fashion = 'fallen';
  const got = new Set<string>();
  for (let i = 0; i < 40; i++) { s.tick += 7; got.add(fashionName(s, 'Base', [])); }
  assert.ok([...got].some((n) => n.startsWith('Lost')), 'a fallen name was given');
});
