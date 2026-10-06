// Natural disasters on the map (the owner's pick): now and then the land itself turns on the town, and it plays out
// where it can be watched. A flood rises out of the river and the sea a ring of cells an hour, spoiling fields, stores
// and pens and drowning the unlucky, while the town piles sandbags against it; a wildfire runs through the woods a
// cell at a time, leaving ash, setting alight what it reaches, while the town cuts a firebreak (rain slows it); a
// tornado crosses the land in an hour, tearing down what stands in its path and throwing people; an earthquake shakes
// everything at once and brings down what it will, aftershocks after. The town reacts by itself (the events' `busy`
// crews). The rolls are the seed's own, so the town's other chances are untouched; off with the autopilot.

import { hashSeed, mixSeed } from '../rng';
import { buildingCentre, defOf, demolish, footprint, townRadius } from './buildings';
import { CROPS } from '../data/crops';
import { setFire } from './fire';
import { killPerson } from './health';
import { cellAt, cellOf, centreOf, groundAt, idx, inMap, setGround, wet, CELL } from './land';
import { noteCleared } from './regrow';
import { campCell, castSpellFx, maxHp, notify, tireless, type GameState, type Person } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';
import { swims } from './sea';
import type { Material } from '../data/materials';

export type DisasterKind = 'flood' | 'wildfire' | 'tornado' | 'quake';

export interface Disaster {
  kind: DisasterKind;
  start: number;
  until: number;
  /** A flood's cells under water; a wildfire's cells alight (index → the tick it caught). */
  cells: number[];
  burning?: Record<number, number>;
  /** Cells the fire has passed over (index, tick), for the ash. */
  burnt?: [number, number][];
  /** A tornado's path (px) and how far along it is (0..1). */
  path?: { from: { x: number; y: number }; to: { x: number; y: number } };
  /** Who and what it has hit already (ids), and how many it has killed. */
  hit: number[];
  dead: number;
  /** The town's crew is at it (sandbags, a firebreak). */
  crew?: boolean;
}

/** The first comes on this day; then one every so many days. */
export const DISASTER_FIRST_DAY = 5;
export const DISASTER_EVERY: [number, number] = [6, 10];
/** A flood rises this many rings of cells (one fewer with sandbags), over these hours, and lies this long in all. */
export const FLOOD_RINGS = 3;
export const FLOOD_RISE_HOURS = 4;
export const FLOOD_HOURS = 14;
/** Someone the flood rises over drowns this often (never one who swims, nor the dead). */
export const FLOOD_DROWNS = 0.12;
/** A wildfire spreads to each wood beside a burning one this often an hour (less in rain, less with a firebreak). */
export const FIRE_SPREAD = 0.55;
export const FIRE_HOURS = 16;
/** A tornado crosses in this many ticks; what it passes within this many px is struck. */
export const TORNADO_TICKS = TICKS_PER_HOUR;
export const TORNADO_REACH = 44;
/** A building in its path comes down this often; someone it throws dies this often (and loses half their health). */
export const TORNADO_FELLS = 0.45;
export const TORNADO_KILLS = 0.25;
/** An earthquake brings down each building this often (half with Masonry), and kills someone at home this often. */
export const QUAKE_FELLS = 0.12;
export const QUAKE_KILLS = 0.04;
export const QUAKE_HOURS = 3;

const roll = (s: GameState, ...salts: number[]) => (mixSeed(hashSeed(s.seed), 0xd15a, ...salts) >>> 0) / 4294967296;
const fellable = (b: GameState['buildings'][number]) => b.status === 'done' && !b.room && !defOf(b).seat && b.def !== 'campfire';
const raining = (s: GameState) => ['rain', 'storm', 'snow'].includes(weatherAt(s.seed, s.tick, s.doom?.kind ?? null).kind);

/** Each tick from sim.ts. */
export function disastersTick(s: GameState): void {
  if (s.autopilot === false) return;
  const d = s.disaster;
  if (d) {
    if (d.kind === 'tornado') tornadoTick(s, d);
    if (s.tick % TICKS_PER_HOUR === 0) hourly(s, d);
    if (s.tick >= d.until) end(s, d);
    return;
  }
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  s.nextDisaster ??= DISASTER_FIRST_DAY * TICKS_PER_DAY + Math.floor(roll(s, 1) * TICKS_PER_DAY);
  if (s.tick < s.nextDisaster || s.raid) return;
  const kinds = possible(s);
  s.nextDisaster = s.tick + (DISASTER_EVERY[0] + Math.floor(roll(s, s.tick, 2) * (DISASTER_EVERY[1] - DISASTER_EVERY[0] + 1))) * TICKS_PER_DAY;
  if (kinds.length) startDisaster(s, kinds[Math.floor(roll(s, s.tick, 3) * kinds.length)]);
}

/** What the land and the season allow now. */
function possible(s: GameState): DisasterKind[] {
  const season = calendar(s.tick).season;
  const out: DisasterKind[] = ['quake'];
  if (waterNear(s).length) out.push('flood');
  if (season !== 'winter' && !raining(s) && woodsNear(s).length) out.push('wildfire');
  if (season !== 'winter') out.push('tornado');
  return out;
}

const reach = (s: GameState) => townRadius(s) + 8;
function near(s: GameState, ok: (i: number) => boolean): number[] {
  const c = campCell(s);
  const r = reach(s);
  const out: number[] = [];
  for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) if (inMap(s.land, x, y) && ok(idx(s.land, x, y))) out.push(idx(s.land, x, y));
  return out;
}
const waterNear = (s: GameState) => near(s, (i) => { const { x, y } = cellAt(s.land, i); return groundAt(s.land, x, y) === 'water'; });
const woodsNear = (s: GameState) => near(s, (i) => { const { x, y } = cellAt(s.land, i); return groundAt(s.land, x, y) === 'forest'; });

export function startDisaster(s: GameState, kind: DisasterKind): Disaster {
  const d: Disaster = { kind, start: s.tick, until: s.tick, cells: [], hit: [], dead: 0 };
  s.disaster = d;
  const c = campCell(s);
  if (kind === 'flood') {
    d.until = s.tick + FLOOD_HOURS * TICKS_PER_HOUR;
    d.crew = true;
    const shore = waterNear(s).sort((a, b) => far(s, a) - far(s, b))[0];
    crew(s, FLOOD_RISE_HOURS + 2, 0.5, 'Piling sandbags against the rising water', 'build', shore);
    notify(s, '🌊 The river is rising! The water is coming up over its banks: the town piles sandbags.', true);
  } else if (kind === 'wildfire') {
    d.until = s.tick + FIRE_HOURS * TICKS_PER_HOUR;
    const woods = woodsNear(s).sort((a, b) => far(s, b) - far(s, a));
    const lit = woods[Math.floor(roll(s, s.tick, 4) * Math.min(woods.length, 12))];
    d.burning = { [lit]: s.tick };
    d.burnt = [];
    d.crew = true;
    crew(s, 6, 0.4, 'Cutting a firebreak through the woods', 'chop', lit);
    const at = cellAt(s.land, lit);
    notify(s, `🔥 Wildfire! The woods to the ${dirOf(c, at)} are burning: the town runs to cut a firebreak.`, true);
  } else if (kind === 'tornado') {
    d.until = s.tick + TORNADO_TICKS + 1;
    const r = (townRadius(s) + 6) * CELL;
    const west = roll(s, s.tick, 5) < 0.5;
    const off = (k: number) => (roll(s, s.tick, k) - 0.5) * townRadius(s) * CELL * 1.2;
    const mid = centreOf(c.x, c.y);
    d.path = { from: { x: mid.x + (west ? -r : r), y: mid.y + off(6) }, to: { x: mid.x + (west ? r : -r), y: mid.y + off(7) } };
    notify(s, `🌪 A tornado! It is coming in from the ${west ? 'west' : 'east'}: everyone runs for cover.`, true);
  } else {
    d.until = s.tick + QUAKE_HOURS * TICKS_PER_HOUR;
    notify(s, '⛰ An earthquake! The ground heaves under the town.', true);
    shake(s, d, 1);
  }
  return d;
}

/** The town's crew goes to it (the events' `busy`: held to the one job, at the place, a while): a share of the grown-ups,
 *  the guards aside, standing a couple of cells on the town's side of the cell. */
function crew(s: GameState, hours: number, share: number, text: string, anim: 'chop' | 'build', cell: number | undefined): void {
  if (cell === undefined || s.busy) return;
  const pool = s.people.filter((p) => p.bornTick == null && p.away === null && !p.guard).sort((a, b) => a.id - b.id);
  const ids = pool.slice(0, Math.max(1, Math.round(pool.length * share))).map((p) => p.id);
  const c = campCell(s);
  const at = cellAt(s.land, cell);
  const k = Math.min(1, 2 / Math.max(1, Math.hypot(at.x - c.x, at.y - c.y)));
  const spot = centreOf(Math.round(at.x + (c.x - at.x) * k), Math.round(at.y + (c.y - at.y) * k));
  s.busy = { until: s.tick + hours * TICKS_PER_HOUR, ids, text, x: spot.x, y: spot.y, anim };
}

const far = (s: GameState, i: number) => { const c = campCell(s); const a = cellAt(s.land, i); return Math.hypot(a.x - c.x, a.y - c.y); };
function dirOf(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
}

function hourly(s: GameState, d: Disaster): void {
  const h = Math.round((s.tick - d.start) / TICKS_PER_HOUR);
  if (d.kind === 'flood' && h <= FLOOD_RISE_HOURS) floodRise(s, d, h);
  if (d.kind === 'wildfire') fireSpread(s, d);
  if (d.kind === 'quake' && h > 0) shake(s, d, 0.3);
}

/** The water climbs a ring (up to FLOOD_RINGS, one fewer once the sandbags are up). */
function floodRise(s: GameState, d: Disaster, h: number): void {
  const rings = Math.min(h, FLOOD_RINGS - (h >= 2 && d.crew ? 1 : 0));
  if (rings < 1 || h > FLOOD_RINGS) return;
  const m = s.land;
  const under = new Set(d.cells);
  const front = d.cells.length ? d.cells : waterNear(s);
  const add: number[] = [];
  for (const i of front) {
    const { x, y } = cellAt(m, i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inMap(m, nx, ny)) continue;
      const g = groundAt(m, nx, ny);
      const j = idx(m, nx, ny);
      if (wet(g) || g === 'mountain' || g === 'hall' || g === 'rock' || under.has(j)) continue;
      under.add(j);
      add.push(j);
    }
  }
  if (rings < h && d.cells.length) return; // (the sandbags hold this ring back)
  d.cells.push(...add);
  const cells = new Set(add);
  let spoilt = 0;
  for (const b of s.buildings) {
    if (b.status !== 'done' || d.hit.includes(b.id)) continue;
    const f = footprint(b);
    let wetFoot = false;
    for (let y = f.y; y < f.y + f.h && !wetFoot; y++) for (let x = f.x; x < f.x + f.w; x++) if (cells.has(idx(m, x, y))) { wetFoot = true; break; }
    if (!wetFoot) continue;
    d.hit.push(b.id);
    if (CROPS[b.def] && b.crop) b.crop.growth = 0;
    if (b.herd && b.herd.head > 0) b.herd.head = Math.max(0, b.herd.head - 2);
    for (const k of Object.keys(b.store) as Material[]) b.store[k] = Math.floor((b.store[k] ?? 0) * 0.7);
    spoilt++;
  }
  const drowned: string[] = [];
  for (const p of [...s.people]) {
    if (p.away !== null || d.hit.includes(-p.id) || !cells.has(idx(m, cellOf(p).x, cellOf(p).y))) continue;
    d.hit.push(-p.id);
    if (tireless(p) || swims(s, p)) continue;
    if (roll(s, s.tick, p.id, 8) < FLOOD_DROWNS) {
      drowned.push(p.name);
      d.dead++;
      killPerson(s, p, 'drowned in the flood');
      if (s.gameOver) return;
    }
  }
  if (spoilt || drowned.length) notify(s, `🌊 The flood rises${spoilt ? `: ${spoilt} building${spoilt > 1 ? 's' : ''} under water` : ''}${drowned.length ? `; ${drowned.join(' and ')} drowned` : ''}.`);
}

/** The fire takes the woods beside it, burns out where it has been, and catches what it reaches. */
function fireSpread(s: GameState, d: Disaster): void {
  const m = s.land;
  const burning = d.burning!;
  const chance = FIRE_SPREAD * (raining(s) ? 0.3 : 1) * (d.crew && s.tick - d.start >= 2 * TICKS_PER_HOUR ? 0.6 : 1);
  const next: Record<number, number> = {};
  for (const [key, since] of Object.entries(burning)) {
    const i = Number(key);
    const { x, y } = cellAt(m, i);
    // (what stands beside a burning wood may catch, every hour it burns)
    for (const b of s.buildings) {
      if (d.hit.includes(b.id) || b.status !== 'done') continue;
      const f = footprint(b);
      if (x < f.x - 1 || x > f.x + f.w || y < f.y - 1 || y > f.y + f.h) continue;
      if (roll(s, s.tick, b.id, 9) < Math.min(0.9, chance * 1.4)) {
        d.hit.push(b.id);
        setFire(s, b);
      }
    }
    if (s.tick - since < TICKS_PER_HOUR) {
      next[i] = since;
      continue;
    }
    // burnt out: ash, and the wood grows back in time (sim/regrow.ts)
    if (groundAt(m, x, y) === 'forest') {
      setGround(m, x, y, 'grass');
      noteCleared(s, i, 'forest');
    }
    d.burnt!.push([i, s.tick]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inMap(m, nx, ny)) continue;
      const j = idx(m, nx, ny);
      if (burning[j] !== undefined || next[j] !== undefined || d.burnt!.some(([k]) => k === j)) continue;
      if (groundAt(m, nx, ny) === 'forest' && roll(s, s.tick, j, 10) < chance) next[j] = s.tick;
    }
  }
  d.burning = next;
  // those caught in it
  for (const p of [...s.people]) {
    if (p.away !== null || tireless(p)) continue;
    const at = idx(m, cellOf(p).x, cellOf(p).y);
    if (next[at] === undefined || d.hit.includes(-p.id)) continue;
    d.hit.push(-p.id);
    p.hp = Math.max(1, p.hp - maxHp(p) * 0.3);
    if (roll(s, s.tick, p.id, 11) < 0.1) {
      d.dead++;
      killPerson(s, p, 'caught in the wildfire');
      if (s.gameOver) return;
    }
  }
  d.burnt = d.burnt!.filter(([, t]) => s.tick - t < 2 * TICKS_PER_DAY);
  if (!Object.keys(next).length) d.until = s.tick;
}

/** The funnel moves along its path, and strikes what it passes. */
function tornadoTick(s: GameState, d: Disaster): void {
  const k = Math.min(1, (s.tick - d.start) / TORNADO_TICKS);
  const { from, to } = d.path!;
  const at = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
  if (s.tick % 6 === 0) castSpellFx(s, 'disaster:tornado', at, [], 1);
  for (const b of s.buildings) {
    if (d.hit.includes(b.id) || !fellable(b)) continue;
    const c = buildingCentre(b);
    const f = footprint(b);
    if (Math.abs(c.x - at.x) > (f.w * CELL) / 2 + TORNADO_REACH || Math.abs(c.y - at.y) > (f.h * CELL) / 2 + TORNADO_REACH) continue;
    d.hit.push(b.id);
    if (roll(s, b.id, d.start, 12) < TORNADO_FELLS) {
      const name = defOf(b).name.toLowerCase();
      castSpellFx(s, 'disaster:dust', c, [], 2);
      demolish(s, b.id);
      notify(s, `🌪 The tornado tears the ${name} apart.`);
    }
  }
  for (const p of [...s.people]) {
    if (p.away !== null || d.hit.includes(-p.id) || Math.hypot(p.x - at.x, p.y - at.y) > TORNADO_REACH) continue;
    d.hit.push(-p.id);
    throwPerson(s, d, p, at);
    if (s.gameOver) return;
  }
}

function throwPerson(s: GameState, d: Disaster, p: Person, at: { x: number; y: number }): void {
  p.x += (p.x - at.x || 1) * 1.5;
  p.y += (p.y - at.y || 1) * 1.5;
  p.hp -= maxHp(p) * 0.5;
  if (p.hp <= 0 || roll(s, p.id, d.start, 13) < TORNADO_KILLS) {
    d.dead++;
    killPerson(s, p, 'swept up by the tornado');
    return;
  }
  p.hp = Math.max(1, p.hp);
  notify(s, `🌪 ${p.name} is thrown through the air, and lives.`);
}

/** The ground shakes: some buildings fall, the shaken are hurt. */
function shake(s: GameState, d: Disaster, strength: number): void {
  s.bossShake = s.tick;
  const masonry = s.research.done.includes('masonry') ? 0.5 : 1;
  const fell: string[] = [];
  for (const b of [...s.buildings]) {
    if (!fellable(b) || roll(s, b.id, s.tick, 14) >= QUAKE_FELLS * masonry * strength) continue;
    castSpellFx(s, 'disaster:dust', buildingCentre(b), [], 2);
    fell.push(defOf(b).name.toLowerCase());
    demolish(s, b.id);
  }
  const dead: string[] = [];
  for (const p of [...s.people]) {
    if (p.away !== null || tireless(p)) continue;
    if (roll(s, p.id, s.tick, 15) < QUAKE_KILLS * strength) {
      dead.push(p.name);
      d.dead++;
      killPerson(s, p, 'crushed in the earthquake');
      if (s.gameOver) return;
    } else p.hp = Math.max(1, p.hp - maxHp(p) * 0.1 * strength);
  }
  if (fell.length || dead.length || strength >= 1)
    notify(s, `⛰ ${strength >= 1 ? 'The earthquake' : 'An aftershock'}${fell.length ? ` brings down the ${fell.join(', the ')}` : ' passes'}${dead.length ? `; ${dead.join(' and ')} ${dead.length > 1 ? 'are' : 'is'} crushed` : ''}.`, fell.length > 0 || dead.length > 0);
}

function end(s: GameState, d: Disaster): void {
  const what = d.kind === 'flood' ? 'The flood waters go down' : d.kind === 'wildfire' ? 'The wildfire burns itself out' : d.kind === 'tornado' ? 'The tornado has passed' : 'The ground is still again';
  notify(s, `${what}${d.dead ? `, and the town counts its dead: ${d.dead}` : ', and everyone is counted'}.`, true);
  // (the ash lies a while after a fire: kept on for the drawing, nothing else)
  s.lastDisaster = { kind: d.kind, tick: s.tick, burnt: d.burnt };
  s.disaster = undefined;
}

/** What the map draws. */
export interface DisasterView {
  kind: DisasterKind;
  /** Flooded cells, cells alight, ash (with its age in hours). */
  flood: number[];
  fire: number[];
  ash: [number, number][];
  /** A tornado's place now (px). */
  at: { x: number; y: number } | null;
}

export function disasterView(s: GameState): DisasterView | null {
  const d = s.disaster;
  const ashOf = (b?: [number, number][]) => (b ?? []).filter(([, t]) => s.tick - t < 2 * TICKS_PER_DAY).map(([i, t]): [number, number] => [i, (s.tick - t) / TICKS_PER_HOUR]);
  if (!d) {
    const last = s.lastDisaster;
    return last?.burnt?.length && s.tick - last.tick < 2 * TICKS_PER_DAY ? { kind: last.kind, flood: [], fire: [], ash: ashOf(last.burnt), at: null } : null;
  }
  let at: { x: number; y: number } | null = null;
  if (d.kind === 'tornado' && d.path) {
    const k = Math.min(1, (s.tick - d.start) / TORNADO_TICKS);
    at = { x: d.path.from.x + (d.path.to.x - d.path.from.x) * k, y: d.path.from.y + (d.path.to.y - d.path.from.y) * k };
  }
  return { kind: d.kind, flood: d.kind === 'flood' ? d.cells : [], fire: Object.keys(d.burning ?? {}).map(Number), ash: ashOf(d.burnt), at };
}
