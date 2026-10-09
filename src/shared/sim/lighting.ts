// Light in the dark (the owner's ask; numbers in data/lighting.ts). The town keeps lights (`s.torches`): along its
// streets (a torch a few road cells apart, more as it grows: a torch in the Stone Age, a lantern, a gas lamp, then
// electric light on the grid), and in a castle's or a hold's every room and gallery a sconce. A light burns its fuel an
// hour at a time while it's dark where it stands (outdoors and in a castle by night; in the hold under the mountain
// always), and goes out when the fuel runs out: from mid-afternoon the town's lamplighters (anyone with nothing better
// to do: the `light` task in people.ts) go round feeding those below half from the stores. Electric light needs
// none. Where it's dark and unlit, work goes slower (`darkPace`, in `workFactor`): out in the night beyond the
// lights' reach and the fires', and in an unlit room of the castle or the hold. Only with the autopilot on.

import { CAVE_SLEEP, CAVE_WAKE, DARK_BELOW, DARK_PACE, FEED_BELOW, FEED_FROM, FEED_UNTIL, FUEL_MOST, FUEL_PER_UNIT, LIGHT_EVERY, LIGHT_KIND, STREET_LIGHTS_BASE, STREET_LIGHTS_MOST, STREET_LIGHTS_PER_PERSON } from '../data/lighting';
import { totalStock } from './buildings';
import { castleLayout, holdOf } from './castle';
import { takeFromStorage } from './expeditions';
import { CELL, idx, inMap, isRoad } from './land';
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

/** The lights the town wants: street lights for its size, a sconce for each room and gallery. */
export function placeLights(s: GameState): void {
  const ts = (s.torches ??= []);
  const grown = s.people.filter((p) => !isChild(p)).length;
  const want = Math.min(STREET_LIGHTS_MOST, STREET_LIGHTS_BASE + STREET_LIGHTS_PER_PERSON * grown);
  const cells = streetCells(s.land).slice(0, want);
  const keyOf = (x: number, y: number) => `${x},${y}`;
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
