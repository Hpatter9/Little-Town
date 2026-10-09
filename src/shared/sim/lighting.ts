// Light in the dark (the owner's ask; numbers in data/lighting.ts). The town keeps lights (`s.torches`): wherever it's
// dark out of doors, its buildings' doors first, then its streets (`outdoorCells`; more as it grows: a torch in the Stone Age, a lantern, a gas lamp, then
// electric light on the grid), and in a castle's or a hold's every room and gallery a sconce. A light burns its fuel an
// hour at a time while it's dark where it stands (outdoors and in a castle by night; in the hold under the mountain
// always), and goes out when the fuel runs out: from mid-afternoon the town's lamplighters (anyone with nothing better
// to do: the `light` task in people.ts) go round feeding those below half from the stores. Electric light needs
// none. Where it's dark and unlit, work goes slower (`darkPace`, in `workFactor`): out in the night beyond the
// lights' reach and the fires', and in an unlit room of the castle or the hold. Only with the autopilot on.

import { CAVE_SLEEP, CAVE_WAKE, DARK_BELOW, DARK_PACE, FEED_BELOW, FEED_FROM, FEED_UNTIL, FUEL_MOST, FUEL_PER_UNIT, LIGHT_EVERY, LIGHT_KIND, STREET_LIGHTS_BASE, STREET_LIGHTS_MOST, STREET_LIGHTS_PER_PERSON } from '../data/lighting';
import { doorCell, footprint, totalStock } from './buildings';
import { BUILDING_BY_ID } from '../data/buildings';
import { CROPS } from '../data/crops';
import { HERDS } from '../data/livestock';
import { isGate, isGrate } from './ringWall';
import { castleLayout, holdOf } from './castle';
import { takeFromStorage } from './expeditions';
import { CELL, groundAt, idx, inMap, isRoad, wet, type Rect } from './land';
import { clearLine, lightSources, occluders } from './lightField';
import { isChild } from './social';
import { tireless, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

export interface Torch {
  id: number;
  /** Its cell on the land. */
  x: number;
  y: number;
  /** Hours of burning left. */
  fuel: number;
  /** A castle's or hold's sconce: the region it lights (the hall -1, a room's id, a gallery -2, -3...). */
  room?: number;
}

/** Is lighting at work (the autopilot's towns; the tests run without it). */
export const lightingOn = (s: GameState) => s.autopilot !== false && s.lighting !== false;

const kindOf = (s: GameState) => LIGHT_KIND[s.era] ?? LIGHT_KIND.neolithic;
/** Does the age's light need feeding? */
export const needsFuel = (s: GameState) => kindOf(s).fuel !== null;
/** Is it burning (fed, or on the grid)? */
export const isLit = (s: GameState, t: Torch) => !needsFuel(s) || t.fuel > 0;

const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/** The road cells a street light stands by, nearest the camp first. Pure. */
export function streetCells(land: GameState['land']): { x: number; y: number }[] {
  const out: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < land.h; y++)
    for (let x = 0; x < land.w; x++) if (hash(x, y) % LIGHT_EVERY === 0 && isRoad(land, x, y)) out.push({ x, y, d: Math.hypot(x - land.camp.x, y - land.camp.y) });
  return out.sort((a, b) => a.d - b.d);
}

/** Is it night (or dusk) now? */
export const isNight = (s: GameState) => calendar(s.tick).daylight < DARK_BELOW;

/** The cell's castle region, if it's in a castle or hold. */
function regionAt(s: GameState, x: number, y: number): number | undefined {
  const lay = castleLayout(s);
  return lay?.region.get(idx(s.land, x, y));
}

/** Is it dark where a light stands (so it burns)? */
function darkThere(s: GameState, t: Torch): boolean {
  if (t.room !== undefined) {
    // (a room's sconce is lit only while someone is in the room; under the mountain at any hour but while the hold
    // sleeps, in a castle by night)
    const dark = holdOf(s) === 'mountain' ? calendar(s.tick).hour >= CAVE_WAKE && calendar(s.tick).hour < CAVE_SLEEP : isNight(s);
    return dark && someoneIn(s, t.room);
  }
  return isNight(s);
}

/** Is anyone of the town in a castle region now? */
function someoneIn(s: GameState, room: number): boolean {
  const lay = castleLayout(s);
  if (!lay) return false;
  return s.people.some((p) => p.away === null && lay.region.get(idx(s.land, Math.floor(p.x / CELL), Math.floor((p.y ?? 0) / CELL))) === room);
}

/** Hourly from sim.ts: the lights placed for the streets and rooms, and burned. */
export function lightingHourly(s: GameState): void {
  if (!lightingOn(s) || s.tick % TICKS_PER_HOUR !== 0) return;
  placeLights(s);
  if (!needsFuel(s)) return;
  for (const t of s.torches ?? []) if (t.fuel > 0 && darkThere(s, t)) t.fuel = Math.max(0, t.fuel - 1);
}

/** The lights the town wants: lights out of doors where the town is dark (`outdoorCells`), as many as it can keep for
 *  its size, and a sconce for each room of a castle or a hold. */
export function placeLights(s: GameState): void {
  const ts = (s.torches ??= []);
  const grown = s.people.filter((p) => !isChild(p)).length;
  const want = grown < SMALL_LIGHTS ? grown : Math.min(STREET_LIGHTS_MOST, STREET_LIGHTS_BASE + STREET_LIGHTS_PER_PERSON * grown);
  const keyOf = (x: number, y: number) => `${x},${y}`;
  const cells = outdoorCells(s, ts.filter((t) => t.room === undefined), want);
  const wanted = new Set(cells.map((c) => keyOf(c.x, c.y)));
  // the rooms
  const lay = castleLayout(s);
  const roomAt = new Map<number, { x: number; y: number }>();
  if (lay) {
    const sum = new Map<number, { x: number; y: number; n: number; top: number }>();
    for (const [i, r] of lay.region) {
      const x = i % s.land.w;
      const y = Math.floor(i / s.land.w);
      const a = sum.get(r) ?? { x: 0, y: 0, n: 0, top: y };
      a.x += x;
      a.y += y;
      a.n++;
      a.top = Math.min(a.top, y);
      sum.set(r, a);
    }
    // (the sconce on the room's back wall, over its middle)
    // (the hall and the rooms; the dug galleries are worked by the miners' own lamps)
    for (const [r, a] of sum) if (r >= -1) roomAt.set(r, { x: Math.round(a.x / a.n), y: a.top });
  }
  const kept = ts.filter((t) => (t.room !== undefined ? roomAt.has(t.room) : wanted.has(keyOf(t.x, t.y))));
  const have = new Set(kept.filter((t) => t.room === undefined).map((t) => keyOf(t.x, t.y)));
  const haveRoom = new Set(kept.filter((t) => t.room !== undefined).map((t) => t.room!));
  let next = ts.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  for (const c of cells) if (!have.has(keyOf(c.x, c.y))) kept.push({ id: next++, x: c.x, y: c.y, fuel: 0 });
  for (const [r, at] of roomAt) if (!haveRoom.has(r)) kept.push({ id: next++, x: at.x, y: at.y, fuel: 0, room: r });
  // (the lamps on a room keep up with its middle as it's rebuilt)
  for (const t of kept) if (t.room !== undefined) Object.assign(t, roomAt.get(t.room));
  s.torches = kept;
}

/** A camp of fewer grown-ups keeps only a light a head (the fire lights the rest): a lone founder has the day's
 *  work to do before rounds of lamps. */
const SMALL_LIGHTS = 3;
/** How much a door that should be lit counts, and a stretch of road. */
const DOOR_WORTH = 1;
const ROAD_WORTH = 0.3;
const FIELD_WORTH = 0.5;
/** How far out from the fire the camp's own ground reaches (cells), lit even before anything stands there. */
const CAMP_GROUND = 8;
/** A light goes up only where it lights at least this much that was dark. */
const LIGHT_LEAST = 0.6;

/** Where the town's lights out of doors stand (the owner's ask: the town covers itself in light as it needs): what
 *  should be lit is every finished building's door (but the walls), the fields and pens, and the roads among them; the
 *  camp's fire and the fires at the buildings light some already, and so do the lights standing (kept while their
 *  cell is still clear). Each new light goes on the road or the open ground by a building where it lights the most of
 *  what's still dark (sim/lightField.ts: buildings, trees and rocks in the way), until all is lit or the town has as
 *  many as it can keep (`want`). */
export function outdoorCells(s: GameState, standing: { x: number; y: number }[], want: number): { x: number; y: number }[] {
  const m = s.land;
  const kind = kindOf(s);
  const reach = kind.radius * 0.85;
  const lay = castleLayout(s);
  const occ = occluders(m, s.buildings, lay ? lay.region.keys() : undefined);
  const solid = new Set<number>();
  const near = new Set<number>();
  const targets: { x: number; y: number; w: number }[] = [];
  const doors = new Set<number>();
  let far = 0;
  for (const b of s.buildings) {
    if (b.room) continue;
    const r = footprint(b);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) solid.add(idx(m, x, y));
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (inMap(m, x, y)) near.add(idx(m, x, y));
    if (b.status !== 'done' || b.ring !== undefined || isGate(b.def) || isGrate(b.def) || BUILDING_BY_ID[b.def]?.hp) continue;
    // (a field or a pen is worked all over: every other cell of it)
    if (CROPS[b.def] || HERDS[b.def]) {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if ((x + y) % 2 === 0) targets.push({ x: x + 0.5, y: y + 0.5, w: FIELD_WORTH });
      far = Math.max(far, Math.hypot(r.x + r.w / 2 - m.camp.x, r.y + r.h / 2 - m.camp.y));
      continue;
    }
    const d = doorCell(b);
    if (!inMap(m, d.x, d.y) || doors.has(idx(m, d.x, d.y))) continue;
    doors.add(idx(m, d.x, d.y));
    targets.push({ x: d.x + 0.5, y: d.y + 0.5, w: DOOR_WORTH });
    far = Math.max(far, Math.hypot(d.x - m.camp.x, d.y - m.camp.y));
  }
  // (the roads among the buildings, every other cell; and the camp's own ground about the fire)
  far = Math.max(far + 2, CAMP_GROUND);
  const roads: number[] = [];
  for (let y = Math.max(0, Math.floor(m.camp.y - far)); y <= Math.min(m.h - 1, Math.ceil(m.camp.y + far)); y++)
    for (let x = Math.max(0, Math.floor(m.camp.x - far)); x <= Math.min(m.w - 1, Math.ceil(m.camp.x + far)); x++) {
      if (!isRoad(m, x, y) || Math.hypot(x - m.camp.x, y - m.camp.y) > far) continue;
      roads.push(idx(m, x, y));
      if ((x + y) % 2 === 0 && !doors.has(idx(m, x, y))) targets.push({ x: x + 0.5, y: y + 0.5, w: ROAD_WORTH });
    }
  // where a light may stand: a road, or open ground beside a building (never in one, in water, rock or the mountain)
  const ok = (i: number) => {
    if (solid.has(i) || lay?.region.has(i)) return false;
    const g = groundAt(m, i % m.w, Math.floor(i / m.w));
    return !wet(g) && g !== 'mountain' && g !== 'rock' && g !== 'hall';
  };
  const spots = new Set<number>();
  for (const i of roads) if (ok(i)) spots.add(i);
  for (const i of near) if (ok(i) && Math.hypot((i % m.w) - m.camp.x, Math.floor(i / m.w) - m.camp.y) <= far) spots.add(i);
  // what each light lights (a light's own cell's middle out to its reach)
  const sees = (sx: number, sy: number, r: number, own: Rect | null = null) => {
    const out: number[] = [];
    targets.forEach((tg, j) => {
      if (Math.hypot(tg.x - sx, tg.y - sy) <= r && clearLine(occ, m.w, m.h, sx, sy, tg.x, tg.y, own)) out.push(j);
    });
    return out;
  };
  const lit = new Uint8Array(targets.length);
  for (const src of lightSources(s.era, [], s.buildings, m.camp)) for (const j of sees(src.x, src.y, src.r * 0.85, src.own)) lit[j] = 1;
  const out: { x: number; y: number }[] = [];
  // (the lights standing are kept while their cell is clear, the nearest the camp first)
  const keep = standing.filter((t) => inMap(m, t.x, t.y) && ok(idx(m, t.x, t.y))).sort((a, b) => Math.hypot(a.x - m.camp.x, a.y - m.camp.y) - Math.hypot(b.x - m.camp.x, b.y - m.camp.y));
  for (const t of keep.slice(0, want)) {
    out.push({ x: t.x, y: t.y });
    spots.delete(idx(m, t.x, t.y));
    for (const j of sees(t.x + 0.5, t.y + 0.5, reach)) lit[j] = 1;
  }
  // (then where each new one lights the most still dark; roads a little before open ground, nearer the camp first)
  const cover = [...spots].map((i) => ({ i, sees: sees((i % m.w) + 0.5, Math.floor(i / m.w) + 0.5, reach), road: isRoad(m, i % m.w, Math.floor(i / m.w)), d: Math.hypot((i % m.w) - m.camp.x, Math.floor(i / m.w) - m.camp.y) }));
  while (out.length < want) {
    let best: (typeof cover)[number] | null = null;
    let bestGain = LIGHT_LEAST - 1e-9;
    for (const c of cover) {
      let gain = c.road ? 0.05 : 0;
      for (const j of c.sees) if (!lit[j]) gain += targets[j].w;
      gain -= c.d * 0.001;
      if (gain > bestGain) {
        bestGain = gain;
        best = c;
      }
    }
    if (!best) break;
    out.push({ x: best.i % m.w, y: Math.floor(best.i / m.w) });
    for (const j of best.sees) lit[j] = 1;
    cover.splice(cover.indexOf(best), 1);
  }
  return out;
}

/** The light the town should feed next for this person: the emptiest below half, nearest first; null if none or
 *  there's nothing to feed it with, or it isn't the lamplighters' hours. */
export function lightToFeed(s: GameState, p: Person): Torch | null {
  if (!lightingOn(s) || !needsFuel(s) || isChild(p)) return null;
  const h = calendar(s.tick).hour;
  const cave = holdOf(s) === 'mountain';
  if (!cave && (h < FEED_FROM || h >= FEED_UNTIL)) return null;
  const fuel = kindOf(s).fuel!;
  if ((totalStock(s)[fuel] ?? 0) < 1) return null;
  const taken = new Set(s.people.filter((q) => q !== p && q.task?.type === 'light').map((q) => (q.task as { torch: number }).torch));
  let best: Torch | null = null;
  let bestScore = Infinity;
  for (const t of s.torches ?? []) {
    if (taken.has(t.id) || t.fuel >= FUEL_MOST * FEED_BELOW) continue;
    // a cave's sconces are fed at any hour; the streets' in the lamplighters' hours
    if (t.room === undefined && (h < FEED_FROM || h >= FEED_UNTIL)) continue;
    const d = Math.abs((t.x + 0.5) * CELL - p.x) + Math.abs((t.y + 0.5) * CELL - (p.y ?? 0));
    const score = t.fuel * 400 + d;
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** A light fed: its fuel from the stores, filled. */
export function feedLight(s: GameState, t: Torch): boolean {
  const fuel = kindOf(s).fuel;
  if (!fuel) return true;
  const units = Math.max(1, Math.ceil((FUEL_MOST - t.fuel) / FUEL_PER_UNIT));
  const got = takeFromStorage(s, fuel, units);
  if (got <= 0) return false;
  t.fuel = Math.min(FUEL_MOST, t.fuel + got * FUEL_PER_UNIT);
  return true;
}

/* ------------------------------------------------------------ darkness */

interface LitCache {
  key: string;
  grid: Uint8Array;
}
const caches = new WeakMap<GameState, LitCache>();

/** Which cells are lit now (1): each light burning out of doors lights the cells within its reach that it can see
 *  (sim/lightField.ts: buildings, walls, trees and rocks stand in the way), and a burning sconce its room. Kept until
 *  the hour, the lights, the buildings or the land change. */
function litGrid(s: GameState): Uint8Array {
  const hour = Math.floor(s.tick / TICKS_PER_HOUR);
  const ts = s.torches ?? [];
  const key = `${hour}|${ts.length}|${ts.reduce((n, t) => n + (isLit(s, t) ? t.id : 0), 0)}|${s.buildings.length}|${s.buildings.reduce((n, b) => n + (b.status === 'done' ? b.id : 0), 0)}|${s.land.version}`;
  const hit = caches.get(s);
  if (hit && hit.key === key) return hit.grid;
  const m = s.land;
  const grid = new Uint8Array(m.w * m.h);
  const lay = castleLayout(s);
  const occ = occluders(m, s.buildings, lay ? lay.region.keys() : undefined);
  const streets = ts.filter((t) => t.room === undefined && isLit(s, t));
  for (const src of lightSources(s.era, streets, s.buildings, m.camp)) {
    for (let y = Math.floor(src.y - src.r); y <= Math.ceil(src.y + src.r); y++)
      for (let x = Math.floor(src.x - src.r); x <= Math.ceil(src.x + src.r); x++) {
        if (!inMap(m, x, y) || Math.hypot(x + 0.5 - src.x, y + 0.5 - src.y) > src.r) continue;
        // (outdoor light doesn't reach into the castle's rooms)
        if (lay?.region.has(idx(m, x, y))) continue;
        if (grid[idx(m, x, y)] || !clearLine(occ, m.w, m.h, src.x, src.y, x + 0.5, y + 0.5, src.own)) continue;
        grid[idx(m, x, y)] = 1;
      }
  }
  if (lay) for (const t of ts) if (t.room !== undefined && isLit(s, t)) for (const [i, r] of lay.region) if (r === t.room) grid[i] = 1;
  caches.set(s, { key, grid });
  return grid;
}

/** Is it dark where someone stands: in the night beyond the lights, or in an unlit room (a hold's at any hour)? */
export function inDark(s: GameState, px: number, py: number): boolean {
  if (!lightingOn(s)) return false;
  const x = Math.floor(px / CELL);
  const y = Math.floor(py / CELL);
  if (!inMap(s.land, x, y)) return isNight(s);
  const room = regionAt(s, x, y);
  const dark = room !== undefined && holdOf(s) === 'mountain' ? true : isNight(s);
  if (!dark) return false;
  return litGrid(s)[idx(s.land, x, y)] !== 1;
}

/** The pace of work for someone where they stand (in `workFactor`). The dead and machines see in the dark. */
export function darkPace(s: GameState, p: Person): number {
  if (!lightingOn(s) || p.away !== null || tireless(p) || p.monster === 'vampire') return 1;
  return inDark(s, p.x, p.y ?? 0) ? DARK_PACE : 1;
}

/** What the renderer is told: each light, burning or not, and how far it reaches (cells). */
export interface LightView {
  id: number;
  x: number;
  y: number;
  lit: boolean;
  fuel: number;
  room: number | null;
}
export function lightsView(s: GameState): { kind: string; radius: number; fuelled: boolean; lights: LightView[]; cave: boolean } | null {
  if (!lightingOn(s) || !s.torches?.length) return null;
  return {
    kind: kindOf(s).name,
    radius: kindOf(s).radius,
    fuelled: needsFuel(s),
    cave: holdOf(s) === 'mountain',
    lights: s.torches.map((t) => ({ id: t.id, x: t.x, y: t.y, lit: isLit(s, t), fuel: t.fuel, room: t.room ?? null })),
  };
}
