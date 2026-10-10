import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearness, panAt, quietZones, zoneMix, zoneSources, zoomGain, ZOOM_REF, type ZoneTown } from '../src/renderer/soundZones';
import { buildingCentre } from '../src/shared/sim/buildings';

// a little town: a tavern, a general store, a temple, a smithy at work, a cattle pasture
const B = (id: number, def: string, tile: number, extra: Partial<ZoneTown['buildings'][number]> = {}) => ({ id, def, tile, row: 50, status: 'done' as const, ...extra });
const town = (over: Partial<ZoneTown> = {}): ZoneTown => ({
  calendar: { hour: 21, daylight: 0 },
  buildings: [B(1, 'tavern', 10), B(2, 'general_store', 20), B(3, 'temple', 30), B(4, 'smithy', 40), B(5, 'cattle_pasture', 50, { herd: { head: 6, tended: 0, breed: 0, hungry: 0, work: 0 } })],
  workingAt: [4],
  market: null,
  gathering: null,
  people: [],
  raid: null,
  ...over,
});
const kinds = (t: ZoneTown) => zoneSources(t).map((z) => z.kind);

test('the tavern is loud of an evening with a fiddle playing, quiet by day, louder with drinkers in', () => {
  const night = zoneSources(town());
  const tav = night.find((z) => z.kind === 'tavern')!;
  assert.ok(tav && night.some((z) => z.kind === 'fiddle'));
  const day = zoneSources(town({ calendar: { hour: 14, daylight: 1 } }));
  assert.ok(day.find((z) => z.kind === 'tavern')!.strength < tav.strength);
  assert.ok(!day.some((z) => z.kind === 'fiddle'), 'no fiddle by day');
  const drinking = zoneSources(town({ calendar: { hour: 14, daylight: 1 }, people: [{ activity: 'drink', away: null }, { activity: 'drink', away: null }] }));
  assert.ok(drinking.some((z) => z.kind === 'fiddle'), 'a fiddle while folk drink');
  assert.ok(drinking.find((z) => z.kind === 'tavern')!.strength > day.find((z) => z.kind === 'tavern')!.strength);
});

test('the market chatters by day, the square on market day; hymns of a morning and at a rite', () => {
  assert.ok(!kinds(town()).includes('market'), 'shops shut at night');
  assert.ok(kinds(town({ calendar: { hour: 11, daylight: 1 } })).includes('market'));
  const fair = zoneSources(town({ calendar: { hour: 11, daylight: 1 }, market: { x: 999, y: 999 } })).filter((z) => z.kind === 'market');
  assert.ok(fair.some((z) => z.x === 999 && z.strength === 1), 'market day at the square, at full');
  assert.ok(kinds(town({ calendar: { hour: 7, daylight: 0.6 } })).includes('hymns'));
  assert.ok(!kinds(town({ calendar: { hour: 14, daylight: 1 } })).includes('hymns'));
  assert.equal(zoneSources(town({ calendar: { hour: 14, daylight: 1 }, gathering: { kind: 'rite' } })).find((z) => z.kind === 'hymns')?.strength, 1);
});

test('the forge rings and the workshops work only while an order is made; the herds call; a raid hushes it all', () => {
  assert.ok(kinds(town()).includes('forge'));
  assert.ok(!kinds(town({ workingAt: [] })).includes('forge'));
  const herd = zoneSources(town()).find((z) => z.kind === 'herd');
  assert.equal(herd?.animal, 'cattle');
  assert.ok(!kinds(town({ buildings: [B(5, 'cattle_pasture', 50, { herd: { head: 0, tended: 0, breed: 0, hungry: 0, work: 0 } })] })).includes('herd'), 'an empty pen is quiet');
  assert.ok(kinds(town({ buildings: [B(6, 'sawmill', 60)], workingAt: [6] })).includes('workshop'));
  assert.deepEqual(zoneSources(town({ raid: { phase: 'active' } })), []);
  assert.ok(!kinds(town({ buildings: [B(1, 'tavern', 10, { status: 'blueprint' })] })).includes('tavern'), 'nothing from a site');
});

test('a zone is loudest in the middle of the view, gone well past it, and panned to its side', () => {
  const v = { x: 0, y: 0, w: ZOOM_REF, h: ZOOM_REF / 2 };
  assert.equal(nearness(v, v.w / 2, v.h / 2), 1);
  assert.ok(nearness(v, v.w * 0.75, v.h / 2) < 1 && nearness(v, v.w * 0.75, v.h / 2) > 0);
  assert.equal(nearness(v, v.w * 3, v.h / 2), 0);
  assert.ok(panAt(v, 10) < -0.5 && panAt(v, v.w - 10) > 0.5 && Math.abs(panAt(v, v.w / 2)) < 0.01);
});

test('the mix follows the view: the tavern heard where it stands, faded as the view moves off it', () => {
  const t = town();
  const tav = buildingCentre(t.buildings[0]);
  const on = { x: tav.x - 700, y: tav.y - 350, w: 1400, h: 700 };
  const near = zoneMix(zoneSources(t), on);
  assert.ok(near.tavern.level > 0.4, `centred: ${near.tavern.level}`);
  assert.ok(Math.abs(near.tavern.pan) < 0.1);
  const right = zoneMix(zoneSources(t), { ...on, x: on.x - 500 });
  assert.ok(right.tavern.level < near.tavern.level && right.tavern.pan > 0.2, 'off to the right of the view');
  const far = zoneMix(zoneSources(t), { ...on, x: on.x + 20000 });
  assert.equal(far.tavern.level, 0);
  assert.deepEqual(quietZones().tavern, { level: 0, pan: 0 });
});

test('zoomed out the zones are quieter, zoomed in louder', () => {
  const t = town();
  const tav = buildingCentre(t.buildings[0]);
  const at = (w: number) => zoneMix(zoneSources(t), { x: tav.x - w / 2, y: tav.y - w / 4, w, h: w / 2 }).tavern.level;
  assert.ok(zoomGain({ x: 0, y: 0, w: ZOOM_REF * 3, h: 10 }) < zoomGain({ x: 0, y: 0, w: ZOOM_REF / 2, h: 10 }));
  assert.ok(at(ZOOM_REF * 2.5) < at(ZOOM_REF) && at(ZOOM_REF) <= at(ZOOM_REF * 0.6));
});
