import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATIONS } from '../src/shared/data/expeditions';
import { ENEMIES } from '../src/shared/data/enemies';
import { MATERIAL_NAMES, MATERIALS, type Stock } from '../src/shared/data/materials';
import { Rng } from '../src/shared/rng';
import { RARE_FINDS } from '../src/shared/sim/chains';
import { destinationOf, sendExpedition, updateExpeditions } from '../src/shared/sim/expeditions';
import { postHunt } from '../src/shared/sim/hunts';
import { parseSave, serialize } from '../src/shared/sim/save';
import { campXY, makePerson } from '../src/shared/sim/state';
import { TICKS_PER_DAY } from '../src/shared/sim/time';
import { haulOrder } from '../src/renderer/mobile/reveals';
import { amount } from '../src/shared/format';
import { plainGame, put, row } from './helpers';

const named = (m: string) => !!MATERIAL_NAMES[m as keyof typeof MATERIAL_NAMES];

test('every kind a haul can hold has a name: the materials, and every table a party or a fight draws its loot from', () => {
  for (const m of MATERIALS) assert.ok(MATERIAL_NAMES[m], m);
  for (const d of DESTINATIONS) for (const m of [...Object.keys(d.loot), ...Object.keys(d.guaranteed ?? {})]) assert.ok(named(m), `${d.id}: ${m}`);
  for (const e of Object.values(ENEMIES)) for (const m of Object.keys(e.loot)) assert.ok(named(m), `${e.id}: ${m}`);
  for (const [type, f] of Object.entries(RARE_FINDS)) for (const m of Object.keys(f![1])) assert.ok(named(m), `${type}: ${m}`);
  // (the homecoming chest names every line, and leaves out a kind it has no name for)
  const all: Stock = Object.fromEntries(MATERIALS.map((m) => [m, 19]));
  const lines = haulOrder({ ...all, ['undefined' as never]: 19 });
  assert.equal(lines.length, MATERIALS.length);
  for (const l of lines) assert.ok(l.name && l.name !== 'undefined' && !/undefined/.test(`${l.n} ${l.name}`), l.id);
});

test('a trip with nothing to gather (a guild hunt) brings home no kind without a name', () => {
  const s = plainGame('haul-names');
  s.tick = 4 * TICKS_PER_DAY;
  for (let i = 1; i < 6; i++) s.people.push(makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name)));
  s.research.done.push('monster_lore', 'iron_working');
  put(s, 'monster_guild', 4, row(s));
  put(s, 'stockpile', 10, row(s));
  const h = postHunt(s, new Rng(1), 'boar_king')!;
  const [a, b, c] = s.people.slice(1, 4);
  const r = sendExpedition(s, `mhunt:${h.id}`, [a.id, b.id, c.id]);
  assert.ok(r.ok, String(r.reason ?? ''));
  const e = s.expeditions.at(-1)!;
  assert.equal(Object.values(destinationOf(s, e.dest)!.loot).filter((w) => (w ?? 0) > 0).length, 0, 'its table is empty');
  e.rolled.outEvent = true;
  e.rolled.ambush = true;
  // (there, past the fight on arrival: the work it does on the spot)
  e.phase = 'work';
  e.elapsed = 0;
  const rng = new Rng(7);
  let worked = 0;
  for (let t = 0; t < 3 * TICKS_PER_DAY && s.expeditions.includes(e); t++) {
    s.tick++;
    updateExpeditions(s, rng);
    if (e.phase === 'work') worked++;
    for (const m of Object.keys(e.loot)) assert.ok(named(m), `brought ${e.loot[m as never]} of "${m}"`);
  }
  assert.ok(worked > 0, 'it did its work');
  for (const bd of s.buildings) for (const m of Object.keys(bd.store)) assert.ok(named(m), `stored "${m}"`);
});

test('an older save carrying a kind with no name loads without it', () => {
  const s = plainGame('haul-old-save');
  const store = s.buildings.find((b) => b.store)!.store as Record<string, number>;
  store.undefined = 19;
  const back = parseSave(serialize(s, 0));
  assert.ok(back.ok);
  if (back.ok) for (const b of back.save.state.buildings) assert.ok(!('undefined' in b.store));
});

test('store amounts are shown whole, or to a tenth under ten: the drift of adding fractions never shows', () => {
  assert.equal(amount(490.00000000000114), '490');
  assert.equal(amount(489.99999999999994), '490');
  assert.equal(amount(0.1 + 0.2), '0.3');
  assert.equal(amount(2.5), '2.5');
  assert.equal(amount(3), '3');
  assert.equal(amount(12.6), '13');
  assert.equal(amount(0.04), '0');
  assert.equal(amount(-0), '0');
  assert.equal(amount(NaN), '0');
});
