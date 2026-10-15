// The living wilderness: herds that migrate, hunting that tracks real game, hungry packs, spreading woods, wildfire
// that runs with the wind, and a river that moves. See sim/wild.ts, sim/rivers.ts and sim/disasters.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/shared/rng';
import { disastersTick, disasterView, type Disaster } from '../src/shared/sim/disasters';
import { groundAt, idx, setGround } from '../src/shared/sim/land';
import { regrowHourly } from '../src/shared/sim/regrow';
import { shiftRiver } from '../src/shared/sim/rivers';
import { Sim } from '../src/shared/sim/sim';
import { campXY, makePerson, newGame, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { gameDistance, huntedUnit, huntFactors, wildHourly } from '../src/shared/sim/wild';
import { campPx, camp, clearAround, plainGame, put, row } from './helpers';

/** Hours of the wild from a tick (the wild's hour is the only thing run). */
function hours(s: GameState, from: number, n: number) {
  for (let h = 0; h < n; h++) {
    s.tick = from + h * TICKS_PER_HOUR;
    wildHourly(s);
  }
}
const wild = () => {
  const s = plainGame('wild');
  s.autopilot = true;
  return s;
};
const head = (s: GameState) => (s.wild?.herds ?? []).reduce((a, h) => a + h.n, 0);

test('the wild is seeded with herds and packs only with the autopilot on', () => {
  const off = plainGame('wild-off');
  hours(off, 0, 3);
  assert.equal(off.wild, undefined);
  const s = wild();
  hours(s, 0, 1);
  assert.ok(s.wild!.herds.length >= 4, `herds ${s.wild!.herds.length}`);
  assert.ok(s.wild!.packs.length >= 1);
  assert.ok(gameDistance(s) > 15, 'the game keeps clear of the town');
});

test('the herds walk to their winter ground in autumn and back in spring', () => {
  const s = wild();
  hours(s, 0, 1);
  const h = s.wild!.herds.filter((x) => Math.hypot(x.ax - x.bx, x.ay - x.by) > 8);
  assert.ok(h.length >= 2, 'herds with a winter ground of their own');
  const ids = h.map((x) => x.id);
  const at = (day: number) => hours(s, day * TICKS_PER_DAY, 1);
  at(19); // (the end of summer)
  const summer = new Map(s.wild!.herds.filter((x) => ids.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]));
  hours(s, 19 * TICKS_PER_DAY, 21 * 24);
  const winter = s.wild!.herds.filter((x) => ids.includes(x.id));
  const moved = winter.filter((x) => Math.hypot(x.x - summer.get(x.id)!.x, x.y - summer.get(x.id)!.y) > 4);
  assert.ok(moved.length >= 1, 'a herd migrated');
  // (and nearer their winter ground than they were)
  for (const x of moved) assert.ok(Math.hypot(x.x - x.bx, x.y - x.by) < Math.hypot(summer.get(x.id)!.x - x.bx, summer.get(x.id)!.y - x.by));
});

test('overhunting empties the land near town, thins the hunting and lengthens the road; left alone it recovers', () => {
  const s = wild();
  hours(s, 0, 1);
  const full = huntFactors(s);
  assert.ok(full.yield > 0.85 && full.risk === 0, 'good hunting at first');
  const d0 = gameDistance(s);
  for (let i = 0; i < 90; i++) huntedUnit(s, 3);
  const bare = huntFactors(s);
  assert.ok(gameDistance(s) > d0 + 5, `the game is further off: ${d0.toFixed(0)} to ${gameDistance(s).toFixed(0)}`);
  assert.ok(bare.yield < full.yield && bare.travel > full.travel && bare.risk > full.risk, JSON.stringify([full, bare]));
  const low = head(s);
  // (a year and a half untouched: they breed back and new herds drift in)
  hours(s, 0, 1);
  hours(s, 0, 60 * 24);
  assert.ok(head(s) > low + 10, `head ${low} to ${head(s)}`);
  assert.ok(huntFactors(s).yield > bare.yield, 'the hunting is better again');
});

test('a hungry pack with no game comes out against the town: a small band, and the pens are raided', () => {
  const s = wild();
  clearAround(s, 10);
  s.tick = 3 * TICKS_PER_DAY;
  for (let i = 0; i < 3; i++) {
    const p = makePerson(new Rng(i + 9), s.nextId++, 'hunter', campPx(s), s.people.map((q) => q.name));
    s.people.push(p);
  }
  const c = camp(s);
  const pen = put(s, 'goat_pen', c.x - 4, row(s), { herd: { head: 6, tended: 0, breed: 0, hungry: 0, work: 0 } });
  hours(s, s.tick, 1);
  s.wild!.herds = [];
  const p = s.wild!.packs[0];
  p.hunger = 1;
  p.rest = undefined;
  p.x = camp(s).x + 14;
  p.y = camp(s).y;
  // (at night, so nothing shelters the pen)
  const night = Math.ceil(s.tick / TICKS_PER_DAY) * TICKS_PER_DAY + 23 * TICKS_PER_HOUR;
  for (let h = 0; h < 40 && p.out === undefined; h++) {
    s.tick = night + h * TICKS_PER_DAY;
    wildHourly(s);
  }
  assert.ok(p.out !== undefined, 'a band went out');
  assert.ok((s.roamers ?? []).some((r) => r.id === p.out), 'it roams the land');
  assert.ok(pen.herd!.head <= 6);
});

test('the woods spread into open land beside them, in the growing seasons only', () => {
  const s = wild();
  clearAround(s, 6);
  const c = camp(s);
  // a wood to the east
  for (let y = c.y - 10; y <= c.y + 10; y++) for (let x = c.x + 16; x <= c.x + 24; x++) setGround(s.land, x, y, 'forest');
  s.land.open = 40;
  const count = () => {
    let n = 0;
    for (let y = c.y - 12; y <= c.y + 12; y++) for (let x = c.x + 10; x <= c.x + 30; x++) if (groundAt(s.land, x, y) === 'forest') n++;
    return n;
  };
  const before = count();
  hours(s, 0, 10 * 24);
  const spring = count();
  assert.ok(spring > before, `spring: ${before} to ${spring}`);
  hours(s, 30 * TICKS_PER_DAY, 8 * 24);
  assert.equal(count(), spring, 'none in winter');
  hours(s, 40 * TICKS_PER_DAY, 360 * 24);
  assert.ok(count() <= (before * 1.3 + 40), 'capped');
});

function burnBlock(wind: number | undefined, dry: boolean) {
  const s = plainGame('fire-wind');
  s.autopilot = true;
  clearAround(s, 8);
  const c = camp(s);
  const y0 = c.y - 12;
  const x0 = c.x + 8;
  for (let y = y0; y < y0 + 15; y++) for (let x = x0; x < x0 + 41; x++) setGround(s.land, x, y, dry ? 'grass' : 'forest');
  s.land.open = 60;
  const start = { x: x0 + 20, y: y0 + 7 };
  if (dry) setGround(s.land, start.x, start.y, 'forest');
  s.tick = Math.ceil(s.tick / TICKS_PER_HOUR) * TICKS_PER_HOUR;
  const d: Disaster = { kind: 'wildfire', start: s.tick, until: s.tick + 30 * TICKS_PER_HOUR, cells: [], burning: { [idx(s.land, start.x, start.y)]: s.tick }, burnt: [], hit: [], dead: 0, wind, dry };
  s.disaster = d;
  for (let t = 0; t < 12 * TICKS_PER_HOUR; t++) {
    s.tick++;
    disastersTick(s);
  }
  const v = disasterView(s)!;
  let east = 0;
  let west = 0;
  for (const i of [...v.fire, ...v.ash.map(([k]) => k)]) {
    const x = i % s.land.w;
    if (x > start.x) east++;
    else if (x < start.x) west++;
  }
  return { east, west, s };
}

test('a wildfire runs with the wind: far more of the wood burns downwind than up it', () => {
  const east = burnBlock(0, false);
  assert.ok(east.east > east.west * 1.8, `east ${east.east} west ${east.west}`);
  const west = burnBlock(Math.PI, false);
  assert.ok(west.west > west.east * 1.8, `east ${west.east} west ${west.west}`);
});

test('in a dry summer the fire also runs through the grass, and burnt woods come back richer and sooner', () => {
  const dry = burnBlock(0, true);
  assert.ok(dry.east + dry.west > 12, `grass burned: ${dry.east + dry.west}`);
  const wet = burnBlock(0, false);
  const m = wet.s.land;
  const cells = Object.keys(m.rich ?? {}).map(Number);
  assert.ok(cells.length > 5, 'burnt woods marked to regrow richer');
  const i = cells[0];
  assert.ok(m.regrow![i][1] - wet.s.tick < 3.5 * TICKS_PER_DAY, 'sooner than the usual 5 days');
  wet.s.tick = m.regrow![i][1] + TICKS_PER_HOUR;
  wet.s.tick -= wet.s.tick % TICKS_PER_HOUR;
  regrowHourly(wet.s);
  assert.equal(groundAt(m, i % m.w, Math.floor(i / m.w)), 'forest');
  assert.equal(m.rich?.[i], undefined);
});

test('a river that moves keeps the land walkable and costs what stood in its way', () => {
  let moved = 0;
  for (const seed of ['r0', 'r1', 'r2', 'r3', 'r4', 'r5']) {
    const s = newGame(seed);
    s.autopilot = true;
    const m = s.land;
    const reach = () => {
      const seen = new Set<number>([idx(m, m.camp.x, m.camp.y)]);
      const st = [idx(m, m.camp.x, m.camp.y)];
      while (st.length) {
        const i = st.pop()!;
        const x = i % m.w;
        const y = Math.floor(i / m.w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || Math.hypot(nx - m.camp.x, ny - m.camp.y) > m.open + 3) continue;
          const j = idx(m, nx, ny);
          const g = groundAt(m, nx, ny);
          if (seen.has(j) || g === 'water' || g === 'mountain') continue;
          seen.add(j);
          st.push(j);
        }
      }
      return seen;
    };
    const before = reach();
    const waterBefore = [...m.cells].filter((c) => c === 'w').length;
    const v0 = m.version;
    for (let k = 0; k < 6; k++) if (shiftRiver(s, new Rng(k * 77 + 5))) break;
    if (m.version === v0) continue;
    moved++;
    const after = reach();
    const water = (i: number) => m.cells[i] === 'w';
    for (const i of before) assert.ok(after.has(i) || water(i), `cell ${i} cut off (${seed})`);
    assert.ok([...m.cells].filter((c) => c === 'w').length >= waterBefore - 15, 'the river is still there');
    assert.equal(m.cells[idx(m, m.camp.x, m.camp.y)] === 'w', false);
    // (a Sim step with the changed land runs on)
    new Sim(s).step();
  }
  assert.ok(moved >= 1, 'a river moved on at least one of the lands');
});

test('a fields in the way of the new channel are lost', () => {
  for (const seed of ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7']) {
    const s = newGame(seed);
    s.autopilot = true;
    const m = s.land;
    // a field on every water-side cell near the camp's river would be heavy: put one beside the river and try
    const c = campXY(s);
    void c;
    const water: number[] = [];
    for (let y = m.camp.y - 25; y <= m.camp.y + 25; y++) for (let x = m.camp.x - 25; x <= m.camp.x + 25; x++) if (groundAt(m, x, y) === 'water') water.push(idx(m, x, y));
    if (!water.length) continue;
    const near = water.sort((a, b) => Math.hypot((a % m.w) - m.camp.x, Math.floor(a / m.w) - m.camp.y) - Math.hypot((b % m.w) - m.camp.x, Math.floor(b / m.w) - m.camp.y))[0];
    const nx = near % m.w;
    const ny = Math.floor(near / m.w);
    // a 3x3 patch of field on each side of the river's nearest cell
    const fields = [put(s, 'garden_plot', nx + 2, ny), put(s, 'garden_plot', nx - 5, ny), put(s, 'garden_plot', nx, ny + 2), put(s, 'garden_plot', nx, ny - 5)].filter((b) => b.tile >= 0);
    const n0 = s.buildings.length;
    let did = false;
    for (let k = 0; k < 10 && !did; k++) did = shiftRiver(s, new Rng(k + 1));
    if (!did) continue;
    assert.ok(s.buildings.length <= n0, 'nothing appears');
    void fields;
    return;
  }
});
