// Building rules shared by the sim and the renderer. Every building stands on a footprint of the land's cells
// (sim/land.ts): `tile` by `row` is its top-left cell, its def's `width` by `depthOf(def)` cells. Its door is the
// middle of its front (bottom) edge: that's where workers stand, and a road is laid from it to the nearest road (or
// the camp) when it's placed, so the town grows along its roads.

import { VILLAGE_KEEP } from '../data/villages';
import { isGate, riverCell } from './ringWall';
import { isSeat } from '../data/seats';
import { carve, castleCells, castleGate, castleOn, holdOf, joinsCastle, nearCastle, roomKind, solidCells } from './castle';
import { seaBuild, seaTown } from './sea';
import { BUILD_QUEUE_SLOTS, BUILDING_BY_ID, DEMOLISH_REFUND, UPGRADES, type BuildingDef } from '../data/buildings';
import { TOPIC_BY_ID } from '../data/research';
import { ERA_NAMES, eraReached, type Era } from '../data/eras';
import type { OriginId } from '../data/origins';
import { MAX_POTS, POT_STORAGE } from '../data/items';
import { MATERIALS, type Material, type Stock } from '../data/materials';
import { CROPS } from '../data/crops';
import { openGround } from '../data/biomes';
import { HERDS } from '../data/livestock';
import { buildable, carvable, clearable, isPlannedRoad, planRoad, setGround, setMarked, wildToClear, CELL, cellOf, doorOf, findPath, fits, groundAt, idx, inMap, inRect, isRoad, overlaps, setRoad, unsetRoad, type LandMap, type Pt, type Rect , wet, touchesWater } from './land';
import { modifiers } from './research';
import { clearRuinsUnder, leaveRuin } from './ruins';
import { STATUE, type RuinKind } from '../data/memorials';
import { addStock, campCell, campXY, dist, notify, poolSize, type Building, type GameState } from './state';

export const defOf = (b: { def: string }): BuildingDef => BUILDING_BY_ID[b.def];

/** How many cells deep a kind of building stands: walls, traps and turrets one; small ones two; the big halls four;
 *  fields and pens as wide as they are long, near enough. */
export function depthOf(def: BuildingDef): number {
  if (def.depth) return def.depth;
  if (def.hp && def.width <= 2 && !def.housing) return 1; // (walls and gates)
  if (def.defense && def.width === 1) return 1;
  if (CROPS[def.id] || HERDS[def.id]) return Math.max(2, Math.min(4, Math.round(def.width * 0.6)));
  return def.width <= 3 ? 2 : def.width <= 5 ? 3 : 4;
}

/** A building's footprint on the land, in cells. */
export const footprint = (b: Pick<Building, 'def' | 'tile' | 'row'> & { turned?: boolean; wide?: number }): Rect => ({ x: b.tile, y: b.row, w: b.turned ? depthOf(defOf(b)) : defOf(b).width + (b.wide ?? 0), h: b.turned ? defOf(b).width : depthOf(defOf(b)) });
/** Every building's footprint (but `except`'s). */
export const footprints = (s: Pick<GameState, 'buildings'>, except?: Building): Rect[] => s.buildings.filter((b) => b !== except).map(footprint);
/** Whether a cell is under a building. */
export const builtOn = (s: Pick<GameState, 'buildings'>, x: number, y: number): Building | undefined => s.buildings.find((b) => inRect(footprint(b), x, y));

/** The cell in front of a building's door, and the same in world px (where workers and callers stand). A castle's
 *  room has no door cell outside: people walk in, and stand in its middle. */
export function doorCell(b: Pick<Building, 'def' | 'tile' | 'row'> & { room?: boolean }): Pt {
  const r = footprint(b);
  return b.room ? { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) } : doorOf(r);
}
export function buildingDoor(b: Pick<Building, 'def' | 'tile' | 'row'> & { room?: boolean }): Pt {
  const d = doorCell(b);
  return { x: (d.x + 0.5) * CELL, y: (d.y + 0.5) * CELL };
}
/** The building's middle, in world px. */
export function buildingCentre(b: Pick<Building, 'def' | 'tile' | 'row'>): Pt {
  const r = footprint(b);
  return { x: (r.x + r.w / 2) * CELL, y: (r.y + r.h / 2) * CELL };
}
/** World x of a building's middle. */
export function buildingCentreX(b: Pick<Building, 'def' | 'tile' | 'row'>): number {
  return buildingCentre(b).x;
}
/** How far a point is from the nearest edge of a building (px; 0 inside). */
export function distToBuilding(b: Pick<Building, 'def' | 'tile' | 'row'>, p: Pt): number {
  const r = footprint(b);
  const dx = Math.max(r.x * CELL - p.x, 0, p.x - (r.x + r.w) * CELL);
  const dy = Math.max(r.y * CELL - p.y, 0, p.y - (r.y + r.h) * CELL);
  return Math.hypot(dx, dy);
}

/** Whether a building can be placed: its research is done (or the debug unlock is on). */
export function isUnlocked(u: { unlockAll: boolean; done: readonly string[]; era?: Era; origin?: OriginId }, def: BuildingDef): boolean {
  if (def.origin && def.origin !== (u.origin ?? 'settlers')) return false; // (a settlers' town has no `origin` set)
  if (u.unlockAll) return true;
  if (def.era && u.era && !eraReached(u.era, def.era)) return false;
  return !def.research || u.done.includes(def.research);
}

export const unlockInfo = (s: GameState) => ({ unlockAll: s.cheats.unlockAll, done: s.research.done, era: s.era, origin: s.origin });

/** The town's reach: the furthest any of its buildings (fields too) stands from the camp, in cells (chessboard), at
 *  least the camp's own ground. */
export function townRadius(s: Pick<GameState, 'buildings' | 'land' | 'nomad'>): number {
  const c = campCell(s);
  let r = 3;
  for (const b of s.buildings) {
    const f = footprint(b);
    r = Math.max(r, Math.abs(f.x - c.x), Math.abs(f.x + f.w - 1 - c.x), Math.abs(f.y - c.y), Math.abs(f.y + f.h - 1 - c.y));
  }
  return r;
}

/** A town walled all round: the walls' kind, or null. (Walls stand on a ring now; a full ring is a later phase.) */
export function enclosure(_s: GameState): { lo: number; hi: number; wall: string } | null {
  return null;
}

/* ------------------------------------------------------------ storage */

export function storageCapacity(s: GameState, b: Building): number {
  const base = b.status === 'done' ? (defOf(b).storage ?? 0) : 0;
  const pots = b.def === 'campfire' && b.status === 'done' ? potStorage(s) : 0;
  return Math.floor(base * modifiers(s.research).storage) + pots;
}

/** Extra campfire storage from clay pots. */
export const potStorage = (s: Pick<GameState, 'items'>) => Math.min(MAX_POTS, s.items.clay_pot ?? 0) * POT_STORAGE;

export function storageFree(s: GameState, b: Building): number {
  return storageCapacity(s, b) - poolSize(b.store);
}

export function storages(s: GameState): Building[] {
  return s.buildings.filter((b) => storageCapacity(s, b) > 0);
}

/** Everything held in storage, summed. */
export function totalStock(s: GameState): Stock {
  const out: Stock = {};
  for (const b of storages(s)) for (const m of MATERIALS) if (b.store[m]) addStock(out, m, b.store[m]!);
  return out;
}

export function totalCapacity(s: GameState): number {
  return storages(s).reduce((n, b) => n + storageCapacity(s, b), 0);
}

/** Put materials into storage, nearest to a point first (an x alone: on the camp's row). Returns what didn't fit. */
export function depositNear(s: GameState, at: Pt | number, stock: Stock): Stock {
  const p: Pt = typeof at === 'number' ? { x: at, y: campXY(s).y } : at;
  const left: Stock = { ...stock };
  const byDistance = storages(s).sort((a, b) => dist(buildingDoor(a), p) - dist(buildingDoor(b), p));
  for (const st of byDistance) {
    for (const m of MATERIALS) {
      const n = Math.min(left[m] ?? 0, storageFree(s, st));
      if (n <= 0) continue;
      addStock(st.store, m, n);
      addStock(left, m, -n);
    }
  }
  return left;
}

/** Throw out all of one material from a storage building. Returns how much was discarded. */
export function discardStock(s: GameState, id: number, m: Material): number {
  const b = s.buildings.find((q) => q.id === id);
  const n = b?.store[m] ?? 0;
  if (!b || n <= 0 || m === 'totem') return 0; // (the Bear Cave's totem can't be thrown out)
  delete b.store[m];
  return n;
}

/* ------------------------------------------------------------ construction */

/** Materials a blueprint still needs delivered. */
export function stillNeeded(b: Building): Stock {
  const out: Stock = {};
  for (const [m, n] of Object.entries(defOf(b).cost) as [Material, number][]) {
    const need = n - (b.delivered[m] ?? 0);
    if (need > 0) out[m] = need;
  }
  return out;
}

/** Blueprints allowed at once (research adds more). */
export const buildSlots = (s: Pick<GameState, 'research'>) => BUILD_QUEUE_SLOTS + modifiers(s.research).queueSlots;

/** Blueprints taking a build slot: the ring wall's sections in work have a queue of their own (`RING_AT_ONCE` in
 *  sim/ringWall.ts; the owner's complaint: the wall waited on the town's other building and was never finished). */
export function blueprintCount(s: Pick<GameState, 'buildings'>): number {
  return s.buildings.filter((b) => inWork(b) && b.ring === undefined).length;
}
/** A blueprint being worked (not one only planned, laid out ahead with the rest of its wall: `Building.planned`). */
export const inWork = (b: Building) => b.status === 'blueprint' && !b.planned;

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
}

/** Whether `def` fits with its top-left cell at (x, y): on open, buildable ground, over no road, clear of every other
 *  building (but `except`); a castle's rooms built on to the castle (over a road if need be: the floor covers it), and
 *  all else a cell clear of it. */
export function canPlace(s: Pick<GameState, 'land' | 'buildings' | 'origin' | 'era' | 'nomad'> & Partial<Pick<GameState, 'villages'>>, def: BuildingDef, x: number, y: number, except?: Building, turned = false, overWild = false): PlaceCheck {
  const r: Rect = { x, y, w: turned ? depthOf(def) : def.width, h: turned ? def.width : depthOf(def) };
  const m = s.land;
  const room = castleOn(s) && roomKind(s, def);
  const carved = room && holdOf(s) === 'mountain';
  for (let cy = r.y; cy < r.y + r.h; cy++)
    for (let cx = r.x; cx < r.x + r.w; cx++) {
      if (!inMap(m, cx, cy)) return { ok: false, reason: 'Off the map' };
      if (Math.hypot(cx - m.camp.x, cy - m.camp.y) > m.open) return { ok: false, reason: 'Beyond the known land' };
      const g = groundAt(m, cx, cy);
      if (wet(g)) {
        // (a shore town's homes, seat and defences stand in the sea: sim/sea.ts; the ring wall's grates stand in the
        // river: sim/ringWall.ts)
        if (!seaBuild(s, def) && !def.onWater) return { ok: false, reason: g === 'water' ? 'Water runs here' : 'The shallows run here' };
        continue;
      }
      if (def.onWater) return { ok: false, reason: 'A grate stands in the water' };
      if (carved) {
        if (!carvable(g)) return { ok: false, reason: 'A hall is cut into the mountain' };
      } else if (g === 'mountain') return { ok: false, reason: 'The mountain stands here' };
      else if (!buildable(g) && !(overWild && !room && wildToClear(m, cx, cy))) return { ok: false, reason: 'Clear the land first' };
      if (!room && (isRoad(m, cx, cy) || isPlannedRoad(m, cx, cy)) && !isGate(def.id)) return { ok: false, reason: 'A road runs here' }; // (a gate stands on the road)
    }
  for (const b of s.buildings) {
    if (b === except) continue;
    if (overlaps(footprint(b), r)) return { ok: false, reason: `Overlaps ${defOf(b).name}` };
  }
  // (a daughter village's ground is its own: sim/villages.ts)
  if (s.villages?.some((v) => Math.hypot(r.x + r.w / 2 - v.x, r.y + r.h / 2 - v.y) < VILLAGE_KEEP + (v.pop > 12 ? 2 : 0))) return { ok: false, reason: 'A daughter village stands here' };
  // (a boatyard stands at the water's edge)
  if (def.shore && !touchesWater(m, r)) return { ok: false, reason: `${def.name} stands at the water's edge` };
  if (castleOn(s)) {
    const cells = castleCells(s);
    if (room && !joinsCastle(cells, m, r, solidCells(s))) return { ok: false, reason: 'A room is built on to the castle' };
    // (never over the ground before the gate: a room built there once walled the castle shut)
    const g = castleGate(s);
    if (room && g.x >= r.x && g.x < r.x + r.w && g.y >= r.y && g.y < r.y + r.h + 1) return { ok: false, reason: 'The way to the gate' };
    if (!room && nearCastle(cells, m, r)) return { ok: false, reason: "The castle's ground" };
  }
  return { ok: true };
}

/** Whether `def` fits at (x, y) given the land and footprints alone (the renderer's placement ghost). */
export const fitsAt = (m: LandMap, taken: readonly Rect[], def: BuildingDef, x: number, y: number) => fits(m, { x, y, w: def.width, h: depthOf(def) }, taken);

/** Place a blueprint with its top-left cell at (x, y). Returns the reason on failure. A road is laid to its door. */
export function placeBlueprint(s: GameState, defId: string, x: number, y: number, turned = false, planned = false, overWild = false): PlaceCheck {
  const def = BUILDING_BY_ID[defId];
  if (!def || def.never) return { ok: false, reason: 'Unknown building' };
  if (!isUnlocked(unlockInfo(s), def)) return { ok: false, reason: 'Not researched yet' };
  // (a planned piece of the ring wall takes no slot: it is laid whatever the queue holds, and released into work later)
  if (!planned && blueprintCount(s) >= buildSlots(s)) return { ok: false, reason: 'Construction queue is full' };
  const check = canPlace(s, def, x, y, undefined, turned, overWild);
  if (!check.ok) return check;
  const b: Building = { id: s.nextId++, def: defId, tile: x, row: y, status: 'blueprint', delivered: {}, progress: 0, store: {}, ...(castleOn(s) && roomKind(s, def) ? { room: true } : {}), ...(turned ? { turned: true } : {}), ...(planned ? { planned: true } : {}) };
  s.buildings.push(b);
  if (overWild) {
    // (laid over a wood or rocks: a wild cell with nothing left on it is cleared at once; the rest wait for the axe
    // and the pick, `overgrown` until they're gone)
    const f = footprint(b);
    for (let cy = f.y; cy < f.y + f.h; cy++)
      for (let cx = f.x; cx < f.x + f.w; cx++) {
        const i = idx(s.land, cx, cy);
        if (!clearable(groundAt(s.land, cx, cy))) continue;
        if (!s.land.pools[i]) setGround(s.land, cx, cy, openGround(s.biome));
        else if (!planned) setMarked(s.land, i, true); // (a planned piece's are marked by its plan, a few at a time)
      }
    refreshOvergrown(s, b);
  }
  if (b.room) {
    // (no roads inside the castle: a road that ran where the room now stands is taken up; a mountain hold's room is
    // cut out of the rock)
    const f = footprint(b);
    for (let cy = f.y; cy < f.y + f.h; cy++) for (let cx = f.x; cx < f.x + f.w; cx++) unsetRoad(s.land, cx, cy);
    if (holdOf(s) === 'mountain') carve(s, f);
  } else connectRoad(s, b);
  if (!planned) clearRuinsUnder(s, footprint(b)); // (built over a ruin: it's cleared away, sim/ruins.ts)
  return { ok: true };
}

/** The wild cells (trees, rocks, marsh, scrub) under a blueprint, still to be cleared before it can be built. */
export function overgrownCells(s: Pick<GameState, 'land'>, b: Building): number[] {
  if (b.status !== 'blueprint' || b.room) return [];
  const out: number[] = [];
  const f = footprint(b);
  for (let cy = f.y; cy < f.y + f.h; cy++) for (let cx = f.x; cx < f.x + f.w; cx++) if (inMap(s.land, cx, cy) && clearable(groundAt(s.land, cx, cy))) out.push(idx(s.land, cx, cy));
  return out;
}
/** Keep `Building.overgrown` in step with the ground under it. */
export function refreshOvergrown(s: Pick<GameState, 'land'>, b: Building): void {
  if (overgrownCells(s, b).length) b.overgrown = true;
  else delete b.overgrown;
}
/** A cell was cleared: the blueprints over it may be clear now. */
export function cellCleared(s: Pick<GameState, 'land' | 'buildings'>, x: number, y: number): void {
  for (const b of s.buildings) if (b.overgrown && inRect(footprint(b), x, y)) refreshOvergrown(s, b);
}

/** Kinds that get no road of their own (the road runs past the fields, not into them). */
const NO_ROAD = (def: BuildingDef) => !!CROPS[def.id] || !!HERDS[def.id] || (!!def.hp && !def.housing) || !!def.defense || def.id === 'campfire';

/** Lay a road from a building's door to the nearest road, or to the camp (the first road of all runs to the fire):
 *  the cheapest way over open buildable ground, round every footprint. Up to `ROAD_REACH` cells. */
export const ROAD_REACH = 40;
export function connectRoad(s: GameState, b: Building): void {
  if (NO_ROAD(defOf(b))) return;
  const from = doorCell(b);
  const to = nearestStreet(s, from);
  layStreet(s, from, to);
}

/** The nearest road or planned street to a cell (or the ground before the fire, or the castle's gate, while there's
 *  none). */
export function nearestStreet(s: GameState, from: Pt): Pt {
  const m = s.land;
  let to: Pt | null = null;
  let best = Infinity;
  for (let i = 0; i < m.roads.length; i++) {
    if (m.roads[i] !== '#' && m.plannedRoads?.[i] !== '#') continue;
    const c = { x: i % m.w, y: Math.floor(i / m.w) };
    const d = Math.abs(c.x - from.x) + Math.abs(c.y - from.y);
    if (d < best) {
      best = d;
      to = c;
    }
  }
  if (to) return to;
  const camp = campCell(s);
  return castleOn(s) ? castleGate(s) : { x: camp.x, y: camp.y + 1 }; // (the ground in front of the fire, or the castle's gate)
}

/** Plan a street from one cell to another (sim/streets.ts: the town's builders lay it a stretch at a time): the
 *  cheapest way over open buildable ground, four ways (a road's tiles join along their edges), round every footprint,
 *  through the ring wall's gates, over a river as a bridge where it must, and out over the sea as a pier in a shore
 *  town. Up to `reach` cells; false if there's no such way. */
export function layStreet(s: GameState, from: Pt, to: Pt, reach = ROAD_REACH): boolean {
  const m = s.land;
  if (!inMap(m, from.x, from.y)) return false;
  const lay = (x: number, y: number) => {
    if (!isRoad(m, x, y)) planRoad(m, x, y);
  };
  if (to.x === from.x && to.y === from.y) {
    lay(from.x, from.y);
    return true;
  }
  const castle = castleOn(s) ? castleCells(s) : null;
  const pier = seaTown(s);
  // (a road goes over buildable ground; over a river or a stream as a bridge (the owner's ask); in a shore town out
  // over the sea as a pier)
  const water = (x: number, y: number) => wet(groundAt(m, x, y)) && (pier || riverCell(m, { x, y }));
  const ground = (x: number, y: number) => buildable(groundAt(m, x, y)) || water(x, y);
  const blocked = (x: number, y: number) => !ground(x, y) || !!builtOn(s, x, y) || !!castle?.has(idx(m, x, y));
  // (a road may run through the ring wall's gate; a gate cell is left a plain cell, the gate stands on it)
  const gate = (x: number, y: number) => isGate(builtOn(s, x, y)?.def ?? '');
  const path = findPath(m, from, to, (x, y) => blocked(x, y) && !isRoad(m, x, y) && !isPlannedRoad(m, x, y) && !gate(x, y), { maxNodes: 6000, four: true, swim: pier ? PIER_COST : BRIDGE_COST });
  if (!path || path.length > reach) return false;
  lay(from.x, from.y);
  for (const c of path) if ((!builtOn(s, c.x, c.y) || gate(c.x, c.y)) && ground(c.x, c.y)) lay(c.x, c.y);
  return true;
}
/** What a cell of bridge costs to lay against a road on land (so a street crosses a river only where it must). */
const BRIDGE_COST = 4;

/** What a cell of pier costs to lay, against a road on land (a shore town's roads run out over the water). */
const PIER_COST = 2.5;

/** Roads laid before they kept to four ways step diagonally here and there: each such step gets a cell beside it, so
 *  every road runs on edge to edge. */
export function squareRoads(s: GameState): void {
  const m = s.land;
  const free = (x: number, y: number) => inMap(m, x, y) && buildable(groundAt(m, x, y)) && !builtOn(s, x, y);
  for (let y = 0; y < m.h - 1; y++)
    for (let x = 0; x < m.w; x++) {
      if (!isRoad(m, x, y)) continue;
      for (const dx of [-1, 1]) {
        if (!inMap(m, x + dx, y + 1) || !isRoad(m, x + dx, y + 1) || isRoad(m, x + dx, y) || isRoad(m, x, y + 1)) continue;
        if (free(x, y + 1)) setRoad(m, x, y + 1);
        else if (free(x + dx, y)) setRoad(m, x + dx, y);
      }
    }
}

/** Whether a finished building can be upgraded in place now, and to what. A bigger upgrade keeps its top-left where
 *  it can, else shifts left or up to make room. */
export function canUpgrade(s: GameState, id: number, absorb?: number): PlaceCheck & { to?: string; tile?: number; row?: number; clear?: number[] } {
  const b = s.buildings.find((q) => q.id === id);
  const to = b && UPGRADES[b.def];
  if (!b || !to || b.status !== 'done') return { ok: false, reason: 'Nothing to upgrade to' };
  const def = BUILDING_BY_ID[to];
  if (!isUnlocked(unlockInfo(s), def)) return { ok: false, reason: def.era && !eraReached(s.era, def.era) ? `Opens in the ${ERA_NAMES[def.era]} era` : `Needs research: ${TOPIC_BY_ID[def.research!]?.name ?? def.research}`, to };
  if (blueprintCount(s) >= buildSlots(s)) return { ok: false, reason: 'Construction queue is full', to };
  if (b.fire !== undefined) return { ok: false, reason: 'It is on fire', to };
  // (absorbing a neighbour: it's pulled down to make room, so it doesn't count as in the way)
  const merged = absorb === undefined ? undefined : s.buildings.find((q) => q.id === absorb);
  const others = { ...s, buildings: s.buildings.filter((q) => q !== b && q !== merged) };
  const growW = def.width - defOf(b).width;
  const growH = depthOf(def) - depthOf(defOf(b));
  // (no bigger than what stands: it is rebuilt where it is, whatever stands about it: a hold's seat on its hall)
  if (growW <= 0 && growH <= 0 && !merged) return { ok: true, to, tile: b.tile, row: b.row };
  // (the road at its door is in the way of growing downward, so it grows up and left first)
  const spots: Pt[] = [];
  for (const dy of growH > 0 ? [-growH, 0] : [0]) for (const dx of growW > 0 ? [0, -growW, -Math.ceil(growW / 2)] : [0]) spots.push({ x: b.tile + dx, y: b.row + dy });
  // (and over the neighbour it swallows, whichever side it stands)
  if (merged) spots.push({ x: Math.min(b.tile, merged.tile), y: Math.min(b.row, merged.row) });
  for (const p of spots) {
    const ok = canPlace(others, def, p.x, p.y);
    if (ok.ok) return { ok: true, to, tile: p.x, row: p.y };
  }
  // (still no room: small, cheap things in the way may be pulled down to make it, and a road over the ground lifted;
  // the town builds them again elsewhere as it wants them)
  for (const p of spots) {
    const r: Rect = { x: p.x, y: p.y, w: def.width, h: depthOf(def) };
    const inWay = others.buildings.filter((q) => overlaps(footprint(q), r));
    // (a neighbour of its own kind is merged, not pulled down: the absorb above)
    if (inWay.length > CLEAR_MOST || !inWay.every((q) => mayClear(q) && q.def !== b.def)) continue;
    if (inWay.reduce((t, q) => t + worthOf(defOf(q)), 0) > worthOf(def) * CLEAR_WORTH) continue;
    if (!roomForSleepers(s, inWay, b, def)) continue;
    const m = s.land;
    let roads = m.roads;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (isRoad(m, x, y)) roads = roads.slice(0, idx(m, x, y)) + '.' + roads.slice(idx(m, x, y) + 1);
    const cleared = { ...others, land: { ...m, roads }, buildings: others.buildings.filter((q) => !inWay.includes(q)) };
    if (canPlace(cleared, def, p.x, p.y).ok) return { ok: true, to, tile: p.x, row: p.y, clear: inWay.map((q) => q.id) };
  }
  return { ok: false, reason: `No room for the ${def.name}`, to };
}

/** At most this many buildings are pulled down for one upgrade, worth together at most this share of what it costs. */
export const CLEAR_MOST = 2;
export const CLEAR_WORTH = 0.6;
/** What may be pulled down to make room: a finished building that isn't the seat, a wall of the ring, a gate, a
 *  castle's room, a venue (its furnishings and custom), a field or pen, a store with goods, a prison with prisoners, or alight. */
export function mayClear(q: Building): boolean {
  const d = defOf(q);
  if (q.status !== 'done' || q.fire !== undefined || q.ring !== undefined || q.room || q.def === 'campfire') return false;
  if (isSeat(q.def) || isGate(q.def) || d.floor || d.cells || d.hp) return false;
  // (the owner's complaint: a town pulled down its only crop for a house. Fields and pens are the food and never go;
  // nor a store with goods in it)
  if (CROPS[q.def] || HERDS[q.def]) return false;
  // (nor a statue to the town's dead: sim/memorials.ts)
  if (q.def === STATUE || q.statue !== undefined) return false;
  if (d.storage && poolSize(q.store) > 0) return false;
  return true;
}
const worthOf = (d: BuildingDef) => Object.values(d.cost).reduce((a, n) => a + (n ?? 0), 0);
/** Pulling down homes leaves everyone a bed (the upgrade's own beds count once it stands: until then, the rest). */
function roomForSleepers(s: GameState, inWay: Building[], b: Building, def: BuildingDef): boolean {
  const lost = inWay.reduce((t, q) => t + (defOf(q).housing ?? 0), 0);
  if (!lost) return true;
  const beds = s.buildings.filter((q) => q.status === 'done' && q !== b && !inWay.includes(q)).reduce((t, q) => t + (defOf(q).housing ?? 0), 0);
  return beds >= s.people.length || beds + (def.housing ?? 0) >= s.people.length + lost;
}

/**
 * Rebuild a finished building as its upgrade, where it stands: half the old building's materials go into
 * the new one, and it's a blueprint (not working) until finished.
 */
export function upgrade(s: GameState, id: number, absorb?: number): PlaceCheck {
  const check = canUpgrade(s, id, absorb);
  if (!check.ok) return check;
  const b = s.buildings.find((q) => q.id === id)!;
  const next = BUILDING_BY_ID[check.to!];
  // salvage: half the old cost (and of a neighbour pulled down with it), as far as the new building needs it; the
  // rest (and what they stored) goes to storage
  const salvage: Stock = {};
  const merged = absorb === undefined ? undefined : s.buildings.find((q) => q.id === absorb);
  for (const old of merged ? [b, merged] : [b]) {
    for (const [m, n] of Object.entries(defOf(old).cost) as [Material, number][]) addStock(salvage, m, Math.floor(n * DEMOLISH_REFUND));
    for (const m of MATERIALS) if (old.store[m]) addStock(salvage, m, old.store[m]!);
  }
  if (merged) s.buildings.splice(s.buildings.indexOf(merged), 1);
  // (what stood in the way is pulled down, half its makings back to the stores: the town builds it again elsewhere)
  const cleared = (check.clear ?? []).map((cid) => s.buildings.find((q) => q.id === cid)).filter((q): q is Building => !!q);
  for (const q of cleared) demolish(s, q.id);
  if (cleared.length) notify(s, `The ${cleared.map((q) => defOf(q).name.toLowerCase()).join(' and the ')} ${cleared.length > 1 ? 'are' : 'is'} pulled down to make room for the ${next.name}.`);
  const delivered: Stock = {};
  for (const [m, n] of Object.entries(next.cost) as [Material, number][]) {
    const k = Math.min(n, salvage[m] ?? 0);
    if (k > 0) {
      delivered[m] = k;
      addStock(salvage, m, -k);
    }
  }
  const at = buildingDoor(b);
  b.def = next.id;
  b.tile = check.tile!;
  b.row = check.row!;
  b.status = 'blueprint';
  b.progress = 0;
  b.delivered = delivered;
  b.store = {};
  delete b.hp;
  delete b.readyTick;
  // (a road over the new footprint is lifted; its door gets one again)
  const f = footprint(b);
  if (!isGate(b.def)) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (isRoad(s.land, x, y)) setRoad(s.land, x, y, false); // (the road runs on under a gate)
  if (b.room) {
    // (a hold's room grows into the rock, no road to it)
    if (holdOf(s) === 'mountain') carve(s, footprint(b));
  } else connectRoad(s, b);
  clearRuinsUnder(s, footprint(b));
  depositNear(s, at, salvage);
  notify(s, `Upgrading to a ${next.name}.`);
  return { ok: true };
}

/**
 * Cancel a blueprint (refunds everything delivered) or demolish a finished building (refunds part of
 * its cost). Refunds and stored contents go to the nearest storage with room; anything else is lost. A finished
 * building leaves its ruin a few days (`ruin`: how it fell, sim/ruins.ts; null for none).
 */
export function demolish(s: GameState, id: number, ruin: RuinKind | null = 'pulled'): void {
  const i = s.buildings.findIndex((b) => b.id === id);
  if (i < 0) return;
  const b = s.buildings[i];
  const refund: Stock = { ...b.delivered };
  if (b.status === 'done') {
    for (const [m, n] of Object.entries(defOf(b).cost) as [Material, number][]) refund[m] = Math.floor(n * DEMOLISH_REFUND);
    for (const m of MATERIALS) if (b.store[m]) addStock(refund, m, b.store[m]!);
  }
  s.buildings.splice(i, 1);
  if (ruin) leaveRuin(s, b, footprint(b), ruin);
  depositNear(s, buildingDoor(b), refund);
}

/** The building a world point (px) is over, if any. */
export function buildingAt(s: Pick<GameState, 'buildings'>, p: Pt): Building | undefined {
  const c = cellOf(p);
  return builtOn(s, c.x, c.y);
}
