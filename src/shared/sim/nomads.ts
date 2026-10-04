// A nomad tribe (the Nomad Caravan: `nomadic` in data/origins.ts) follows the seasons. Winter and spring it camps on
// its home ground; at midsummer it breaks camp and moves a day's ride across the land to its summer pasture, and at
// midwinter it comes home. Its tents go with it (homes, workshops, storage, the shop, the tavern, the stable): pitched
// again at the new camp with all their materials, they need only a little work to stand. Everything else is rooted:
// fields, mines and the great works stay where they were built, and the great works are always built on the home
// ground, so nothing that takes years is lost to the road. While it wanders it builds no walls: when raiders come the
// wagons are drawn up at the camp's edges. In the Industrial age it comes home one last time and settles, and its
// home ground becomes a caravan city.

import { BUILDING_BY_ID } from '../data/buildings';
import { eraReached } from '../data/eras';
import { rulesOf } from '../data/origins';
import { buildingCentre, canPlace, depthOf, footprint, footprints } from './buildings';
import { CELL, cheb, groundAt, setGround, spiralSpot, type Pt } from './land';
import { notify, type Building, type GameState } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

/** What goes on the wagons. */
export const PORTABLE = new Set([
  'campfire', 'stockpile', 'lean_to', 'hide_tent', 'longhouse', 'cottage', 'rowhouse', 'workbench', 'drying_rack', 'tanning_rack',
  'hunters_lodge', 'storytellers_circle', 'healers_hut', 'loom', 'tannery', 'trading_post', 'general_store', 'emporium',
  'fireside_inn', 'tavern', 'stable', 'barracks', 'market', 'lookout', 'seat_nomads_1', 'seat_nomads_2',
]);
/** A pitched tent is this far along (the rest is the work of putting it up). */
export const PITCHED = 0.6;
/** The hours the tribe sets out in (from first light to the afternoon). */
const SET_OUT = [7, 16];
/** The camp's land cleared on arrival (cells round its middle). */
const CAMP_RADIUS = 6;
/** How far out from the camp's middle the wagons look for room for a tent (cells). */
const SPREAD = 14;

export const nomadic = (s: GameState) => !!s.nomad && !s.nomad.settled;
export const portable = (defId: string) => PORTABLE.has(defId);

/** Where the tribe should be at a tick: the summer pasture through summer and autumn, the home ground the rest of the
 *  year. */
const campAt = (s: GameState, tick: number): Pt => {
  const season = calendar(tick).season;
  return season === 'summer' || season === 'autumn' ? s.nomad!.pasture : s.nomad!.home;
};
export const wantedCamp = (s: GameState) => campAt(s, s.tick);
const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

/** Days until the next move (for the Plan tab), or null once settled. */
export function daysToMove(s: GameState): number | null {
  if (!nomadic(s)) return null;
  const want = wantedCamp(s);
  for (let h = 1; h <= 24 * 12; h++) if (!same(campAt(s, s.tick + h * TICKS_PER_HOUR), want)) return h / 24;
  return null;
}

/** Once an hour: break camp when the season turns (not while raiders are about), draw the wagons up while they are,
 *  and in the Industrial age come home and settle. */
export function updateNomads(s: GameState): void {
  if (!s.nomad || s.tick % TICKS_PER_HOUR !== 0) return;
  if (!s.raid) breakCircle(s);
  if (s.nomad.settled) return;
  const until = rulesOf(s).nomadic?.until;
  const settle = !!until && eraReached(s.era, until);
  const to = settle ? s.nomad.home : wantedCamp(s);
  // (they set out by day, so the tents are up again before dark)
  const hour = calendar(s.tick).hour;
  if (!same(to, s.nomad.camp) && !s.raid && (settle || (hour >= SET_OUT[0] && hour < SET_OUT[1]))) moveCamp(s, to);
  if (settle) {
    s.nomad.settled = true;
    notify(s, 'The tribe unloads the wagons for the last time. The home ground is a caravan city now, and here it stays.', true);
  }
}

/** Clear the forest and marsh round a camp's ground (rock and hills stay). */
function clearCamp(s: GameState, at: Pt): void {
  for (let y = at.y - CAMP_RADIUS; y <= at.y + CAMP_RADIUS; y++)
    for (let x = at.x - CAMP_RADIUS; x <= at.x + CAMP_RADIUS; x++) {
      const g = groundAt(s.land, x, y);
      if (g === 'forest' || g === 'marsh') setGround(s.land, x, y, 'grass');
    }
}

/** Break camp and pitch it again at `to` (a cell): every tent goes on the wagons, the land there is cleared for it,
 *  and everyone sets off. */
export function moveCamp(s: GameState, to: Pt): void {
  const n = s.nomad!;
  const from = n.camp;
  const delta = { x: to.x - from.x, y: to.y - from.y };
  clearCamp(s, to);
  // (the summer pasture may lie beyond the land the town knows: it's opened as far as the camp)
  s.land.open = Math.max(s.land.open, Math.ceil(Math.hypot(to.x - s.land.camp.x, to.y - s.land.camp.y)) + CAMP_RADIUS + 2);
  const tents = s.buildings.filter((b) => portable(b.def) && !b.room);
  // (where the tents stood, the ground remembers: fire rings and flattened grass, until the tribe comes back)
  n.left = tents.filter((b) => b.status === 'done' && BUILDING_BY_ID[b.def].layer === 'mid').map((b) => ({ ...buildingCentre(b), w: BUILDING_BY_ID[b.def].width * CELL }));
  const staying = s.buildings.filter((b) => !tents.includes(b));
  const placed: Building[] = [...staying];
  let lost = 0;
  // (the nearest the old camp first, so the new one keeps its shape)
  for (const b of tents.sort((a, c) => cheb({ x: a.tile, y: a.row }, from) - cheb({ x: c.tile, y: c.row }, from))) {
    const def = BUILDING_BY_ID[b.def];
    const want = { x: b.tile + delta.x, y: b.row + delta.y };
    const view = { ...s, buildings: placed, nomad: { ...n, camp: to } };
    let spot = canPlace(view, def, want.x, want.y).ok ? want : null;
    if (!spot) {
      const r = spiralSpot(s.land, def.width, depthOf(def), footprints(view), { x: want.x + Math.floor(def.width / 2), y: want.y + Math.floor(depthOf(def) / 2) }, { maxR: SPREAD });
      spot = r ? { x: r.x, y: r.y } : null;
    }
    if (!spot) {
      lost++;
      continue; // (no room: it's left standing where it was)
    }
    b.tile = spot.x;
    b.row = spot.y;
    // (the fire is lit again at once, and the stockpile is just unloaded; the rest must be put up)
    if (b.status === 'done' && b.def !== 'campfire' && b.def !== 'stockpile') {
      b.status = 'blueprint';
      b.delivered = { ...def.cost };
      b.progress = PITCHED;
      delete b.fire;
    }
    placed.push(b);
  }
  s.buildings = [...placed, ...tents.filter((b) => !placed.includes(b))];
  // everyone sets off for the new camp (and the strangers passing through go their way)
  for (const p of s.people) if (p.away === null) p.task = null;
  s.travellers = [];
  n.camp = { ...to };
  n.from = { ...from };
  n.movedAt = s.tick;
  const where = same(to, n.home) ? 'home ground' : 'summer pasture';
  notify(s, `The tribe breaks camp and moves to the ${where}.${lost ? ` (${lost} tent${lost === 1 ? '' : 's'} left behind for want of room.)` : ''}`, true);
}

/** Raiders are coming: the wagons are drawn up east and west of the camp (while the tribe wanders). */
export function circleWagons(s: GameState): void {
  if (!nomadic(s) || s.buildings.some((b) => b.def === 'wagon_circle')) return;
  const def = BUILDING_BY_ID.wagon_circle;
  const camp = s.nomad!.camp;
  const near = s.buildings.filter((b) => BUILDING_BY_ID[b.def].layer !== 'back' && cheb({ x: b.tile, y: b.row }, camp) <= SPREAD);
  const lo = Math.min(camp.x - 3, ...near.map((b) => b.tile)) - 1;
  const hi = Math.max(camp.x + 3, ...near.map((b) => b.tile + BUILDING_BY_ID[b.def].width));
  for (const want of [lo, hi]) {
    for (let d = 0; d <= 4; d++) {
      const x = want + (want === lo ? -d : d);
      if (!canPlace(s, def, x, camp.y).ok) continue;
      s.buildings.push({ id: s.nextId++, def: 'wagon_circle', tile: x, row: camp.y, status: 'done', delivered: {}, progress: 1, store: {}, hp: def.hp });
      break;
    }
  }
  notify(s, 'The wagons are drawn up at the edges of the camp.');
}

/** The raid is over: the wagons go back to carrying things. */
export function breakCircle(s: GameState): void {
  if (s.buildings.some((b) => b.def === 'wagon_circle')) s.buildings = s.buildings.filter((b) => b.def !== 'wagon_circle');
}

/** Where a rooted building goes: the great works on the home ground, always (while the tribe wanders). */
export const buildOrigin = (s: GameState, defId: string): Pt | null => (nomadic(s) && BUILDING_BY_ID[defId].layer === 'mid' && !portable(defId) ? s.nomad!.home : null);

export { footprint };
