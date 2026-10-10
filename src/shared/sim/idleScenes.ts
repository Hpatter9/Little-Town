// Small scenes about town, and the rain (the owner's ask: townsfolk with more inner life). Like the other pastimes
// (sim/pastimes.ts) these only change where an idle wander goes and how the wait there is spent, so the town's work
// and growth are as they were:
// - in rain or a storm the grown-ups shelter under the eaves of the nearest building's front (`eavesSpot`), and the
//   children run from puddle to puddle splashing (`puddleSpot`);
// - on a dry day the children play tag (`tagTarget`: one is "it" and chases the nearest, the rest run from them, and
//   the roles go round every `TAG_TURN` turns);
// - an elder sits on a bench feeding the pigeons (`benchSpot`: by the green, the garden, the bandstand or the square;
//   the map's birds come down round them);
// - a couple sits by the water at dusk (`riverSpot`: the nearest bank to the camp);
// - a busker plays in the square by day (`buskSpot`: one at a time, of a merry or dreamy sort, or a bard).
// All by the seed, the person's id and the turn (`slot`): nothing is drawn from the town's stream.

import { CELL, groundAt, isRoad, type Ground } from './land';
import { calendar } from './time';
import { campXY, type GameState, type Person } from './state';
import { isChild } from './social';
import { buildingDoor, footprint } from './buildings';
import { flat } from './lightField';
import { weatherAt } from './weather';
import { natureOf, type NatureId } from '../data/natures';

/** Rain or a storm: the grown-ups shelter, the children splash. */
export function wetNow(s: GameState): boolean {
  const w = weatherAt(s.seed, s.tick, s.doom?.phase === 'active' ? s.doom.kind : null).kind;
  return w === 'rain' || w === 'storm';
}
/** A fair enough day to sit out of doors (no rain, storm or snow). */
export function fairNow(s: GameState): boolean {
  const w = weatherAt(s.seed, s.tick, s.doom?.phase === 'active' ? s.doom.kind : null).kind;
  return w === 'clear' || w === 'cloudy' || w === 'fog';
}

/** How far (cells) someone goes to get under the eaves. */
export const EAVES_REACH = 14;
/** What isn't a roof to shelter under: walls and gates, the fields, pens and yards, a castle's own rooms. */
const NO_EAVES = /wall|gate|grate|palisade|stockade|trap|caltrop|mine|well|shaft|portal|rift|graveyard|totem|ward/;

/** Where someone shelters from the rain: before the front of the nearest roofed building, a place along it by their
 *  id, a little out from the wall; null with none near. */
/** A hamlet smaller than this huddles where it is in the rain (it would only walk off to a roof and lose the day). */
export const EAVES_PEOPLE = 3;
export function eavesSpot(s: GameState, p: Person): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = EAVES_REACH * CELL;
  for (const b of s.buildings) {
    if (b.status !== 'done' || b.ring || b.room || flat(b) || NO_EAVES.test(b.def)) continue;
    const r = footprint(b);
    if (r.w < 2) continue;
    // (a place along the front by their id, never the door's own cell)
    const door = buildingDoor(b);
    const places = r.w - 1;
    const k = (p.id * 7) % places;
    const cx = r.x + (k >= Math.floor(r.w / 2) ? k + 1 : k);
    const x = (cx + 0.5) * CELL + (p.id % 3 - 1) * 4;
    const y = (r.y + r.h) * CELL + 0.25 * CELL + (p.id % 2) * 5;
    const d = Math.hypot(door.x - p.x, door.y - p.y);
    if (d < bestD) [best, bestD] = [{ x, y }, d];
  }
  return best;
}

/** The open ground puddles stand on (the roads, grass and fields about the camp). */
const PUDDLE_ON = new Set<Ground>(['grass', 'fertile', 'sand', 'hill']);
/** A puddle near the camp for a child to jump in, a new one each turn. */
export function puddleSpot(s: GameState, p: Person, slot: number): { x: number; y: number } {
  const c = campXY(s);
  const cx = Math.floor(c.x / CELL);
  const cy = Math.floor(c.y / CELL);
  for (let i = 0; i < 12; i++) {
    const a = ((slot + i) * 2.399 + p.id * 1.13) % (Math.PI * 2);
    const r = 2 + ((p.id + slot + i) % 3);
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + 1 + Math.sin(a) * r * 0.7);
    if (isRoad(s.land, x, y) || PUDDLE_ON.has(groundAt(s.land, x, y))) return { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL };
  }
  return { x: c.x + CELL, y: c.y + 2 * CELL };
}

/** Tag: the roles go round every this many turns (of 8 s); the runners keep within this of the camp (cells), and run
 *  this far each dash (cells). */
export const TAG_TURN = 2;
export const TAG_RING = 6;
const TAG_DASH = 2.6;

/** Who's "it" this turn among the children playing (by id), or null with under two of them. */
export function tagIt(kids: readonly { id: number }[], slot: number): number | null {
  if (kids.length < 2) return null;
  const ids = kids.map((k) => k.id).sort((a, b) => a - b);
  return ids[Math.floor(slot / TAG_TURN) % ids.length];
}

/** Where a child playing tag runs next: "it" runs at the nearest other child (a step past them), the rest away from
 *  "it", swinging round when they'd leave the ring about the camp. Pure. */
export function tagTarget(me: { id: number; x: number; y: number }, kids: readonly { id: number; x: number; y: number }[], it: number, camp: { x: number; y: number }): { x: number; y: number } {
  if (me.id === it) {
    let near: { x: number; y: number } | null = null;
    let d = Infinity;
    for (const k of kids) {
      if (k.id === me.id) continue;
      const kd = Math.hypot(k.x - me.x, k.y - me.y);
      if (kd < d) [near, d] = [k, kd];
    }
    if (!near) return { x: me.x, y: me.y };
    const ux = (near.x - me.x) / Math.max(1, d);
    const uy = (near.y - me.y) / Math.max(1, d);
    return { x: near.x + ux * 0.6 * CELL, y: near.y + uy * 0.6 * CELL };
  }
  const chaser = kids.find((k) => k.id === it) ?? camp;
  let ax = me.x - chaser.x;
  let ay = me.y - chaser.y;
  const len = Math.hypot(ax, ay) || 1;
  [ax, ay] = [ax / len, ay / len];
  let tx = me.x + ax * TAG_DASH * CELL;
  let ty = me.y + ay * TAG_DASH * CELL * 0.7;
  // (out past the ring: turn along it instead, the way that keeps away from "it")
  if (Math.hypot(tx - camp.x, ty - camp.y) > TAG_RING * CELL) {
    const ox = me.x - camp.x;
    const oy = me.y - camp.y;
    const ol = Math.hypot(ox, oy) || 1;
    const side = ax * -oy + ay * ox >= 0 ? 1 : -1;
    tx = me.x + (-oy / ol) * side * TAG_DASH * CELL - (ox / ol) * CELL;
    ty = me.y + (ox / ol) * side * TAG_DASH * CELL * 0.7 - (oy / ol) * CELL;
  }
  return { x: tx, y: ty };
}

/** A tag player's way is worked out afresh this often (ticks) while they run. */
export const TAG_RETARGET = 12;
/** A turn of the pastimes (sim/people.ts: 8 seconds). */
const TAG_SLOT = 80;

/** The children playing now: in town, not asleep, at lessons or eating. */
export function playingKids(s: GameState): Person[] {
  return s.people.filter((q) => q.away === null && isChild(q) && !/^(sleep|lesson|apprentice|eat|shelter)$/.test(q.task?.type ?? ''));
}

/** Where a tag player runs next, by the turn now (null: under two playing, or a raid). */
export function tagStep(s: GameState, p: Person): { x: number; y: number } | null {
  if (s.raid) return null;
  const kids = playingKids(s);
  const it = tagIt(kids, Math.floor(s.tick / TAG_SLOT));
  return it === null || !kids.includes(p) ? null : tagTarget(p, kids, it, campXY(s));
}

/** The elders feed the pigeons by day (hours), now and then (one turn in `PIGEON_EVERY`). */
export const PIGEON_FROM = 10;
export const PIGEON_UNTIL = 17;
export const PIGEON_EVERY = 3;
const BENCHES = ['village_green', 'pleasure_garden', 'bandstand', 'market', 'trading_post', 'general_store'];

/** Where an elder sits feeding the pigeons: by the green, the garden, the bandstand or the square; else a little way
 *  from the fire. Each elder a place of their own. */
export function benchSpot(s: GameState, p: Person): { x: number; y: number } {
  const off = ((p.id % 4) - 1.5) * 0.9 * CELL;
  for (const def of BENCHES) {
    const b = s.buildings.find((q) => q.def === def && q.status === 'done');
    if (b) {
      const d = buildingDoor(b);
      return { x: d.x + off, y: d.y + 0.6 * CELL };
    }
  }
  const c = campXY(s);
  return { x: c.x + 2.6 * CELL + off, y: c.y + 2.2 * CELL };
}

/** A couple sits by the water at dusk (hours), on every other evening, where a bank is this near the camp (cells). */
export const RIVER_FROM = 18;
export const RIVER_UNTIL = 21;
export const RIVER_REACH = 18;
const WET = new Set<Ground>(['water', 'shallows']);

/** Couples sit at one of the nearest `RIVER_PLACES` places on the bank, `RIVER_APART` cells apart. */
export const RIVER_PLACES = 4;
export const RIVER_APART = 3;
/** A place on the bank near the camp for a couple at dusk, by `key` (the couple's lower id): a dry cell with water
 *  beside it (one below the water first, so they sit looking out over it), in world px; null with none within
 *  `RIVER_REACH`. */
export function riverSpot(s: GameState, key = 0): { x: number; y: number } | null {
  const c = campXY(s);
  const cx = Math.floor(c.x / CELL);
  const cy = Math.floor(c.y / CELL);
  const banks: { x: number; y: number; d: number }[] = [];
  for (let dy = -RIVER_REACH; dy <= RIVER_REACH; dy++)
    for (let dx = -RIVER_REACH; dx <= RIVER_REACH; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const g = groundAt(s.land, x, y);
      if (WET.has(g) || g === 'mountain' || g === 'hall' || isRoad(s.land, x, y)) continue;
      const above = WET.has(groundAt(s.land, x, y - 1));
      if (!above && !WET.has(groundAt(s.land, x - 1, y)) && !WET.has(groundAt(s.land, x + 1, y))) continue;
      if (!s.buildings.every((b) => { const r = footprint(b); return x < r.x || x >= r.x + r.w || y < r.y || y >= r.y + r.h; })) continue;
      banks.push({ x: (x + 0.5) * CELL, y: (y + 0.3) * CELL, d: Math.hypot(dx, dy) + (above ? 0 : 1.5) });
    }
  if (!banks.length) return null;
  banks.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  // (each couple its own place on the bank, among the nearest few, a few cells apart)
  const apart: typeof banks = [];
  for (const b of banks) {
    if (apart.every((o) => Math.hypot(o.x - b.x, o.y - b.y) >= RIVER_APART * CELL)) apart.push(b);
    if (apart.length >= RIVER_PLACES) break;
  }
  const b = apart[key % apart.length];
  return { x: b.x, y: b.y };
}

/** A busker plays in the square by day (hours), one turn in `BUSK_EVERY`, one at a time, of these natures (or a bard). */
export const BUSK_FROM = 10;
export const BUSK_UNTIL = 18;
export const BUSK_EVERY = 3;
/** A busker wants an audience: a town of this many grown-ups at home. */
export const BUSK_PEOPLE = 6;
export const BUSKERS: ReadonlySet<NatureId> = new Set(['jolly', 'cheerful', 'dreamy', 'bold', 'proud', 'restless']);

/** Whether someone would busk (their nature, or a bard). */
export const busks = (p: Person) => !isChild(p) && (BUSKERS.has(natureOf(p).id) || p.cls === 'bard');

/** The busker's pitch: a little to the side of the square (or the fire). */
export function buskSpot(s: GameState, square: { x: number; y: number }): { x: number; y: number } {
  void s;
  return { x: square.x + 1.6 * CELL, y: square.y + 0.4 * CELL };
}

/** Whether someone else is out busking now (one at a time). */
export function someoneBusking(s: GameState, p: Person): boolean {
  return s.people.some((q) => q !== p && q.away === null && (q.task?.type === 'wander' || q.task?.type === 'idle') && q.task.pastime === 'busk');
}

/** The hour now. */
export const hourNow = (s: GameState) => calendar(s.tick).hour;
