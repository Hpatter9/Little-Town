// Ruins that linger (the owner's ask: memory written into the town). A building burnt down (sim/fire.ts), felled by a
// disaster or an event (sim/disasters.ts, sim/events.ts) or pulled down (`demolish` in sim/buildings.ts) leaves its
// footprint as a ruin for a few days (`RUIN_HOURS` by how it fell): a blackened shell where it burned, a foundation and
// its rubble where it was pulled or knocked down. A ruin stops nothing: it is cleared at once when something is built
// over it (`clearRuinsUnder`, from `placeBlueprint` and `upgrade`, and hourly for anything else that covers it), and
// cleared away when its time is up (`ruinsHourly`). Nothing here touches the town's stores or rolls its dice, so a town
// turns out as it did; the map draws them (renderer/map/mapRuins.ts) and their tap card tells what stood there.

import { BUILDING_BY_ID } from '../data/buildings';
import { CROPS } from '../data/crops';
import { HERDS } from '../data/livestock';
import { LOW_BUILDINGS } from '../data/lighting';
import { RUIN_HOURS, RUINS_MOST, type RuinKind } from '../data/memorials';
import { footprint } from './buildings';
import type { Rect } from './land';
import { TICKS_PER_HOUR } from './time';
import type { Building, GameState } from './state';

export interface Ruin {
  /** The fallen building's id, and what it was. */
  id: number;
  def: string;
  /** Its footprint (cells). */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: RuinKind;
  /** When it fell. */
  tick: number;
  /** Whose it was, and its name if it was a home (data/homeNames.ts), as they were when it fell. */
  owner?: string;
  home?: string;
}

/** Does a building leave a ruin when it falls? Not the plots and pens, the yards lying flat, a trap in the ground, a
 *  wall or gate (its own rubble is the breach), a castle's room, the campfire, nor one never finished. */
export function leavesRuin(b: Pick<Building, 'def' | 'status' | 'room' | 'ring'>): boolean {
  const def = BUILDING_BY_ID[b.def];
  if (!def || b.status !== 'done' || b.room || b.ring !== undefined || def.never || def.hp) return false;
  if (LOW_BUILDINGS.has(b.def) || CROPS[b.def] || HERDS[b.def]) return false;
  if (def.defense && def.defense.range <= 16 && !def.defense.splash) return false;
  return true;
}

/** A building has fallen (its footprint `f`): leave its ruin. */
export function leaveRuin(s: GameState, b: Building, f: Rect, kind: RuinKind): void {
  if (!leavesRuin(b)) return;
  const owner = b.owner !== undefined ? s.people.find((p) => p.id === b.owner)?.name : undefined;
  const list = (s.ruins ??= []).filter((r) => r.id !== b.id);
  list.push({ id: b.id, def: b.def, x: f.x, y: f.y, w: f.w, h: f.h, kind, tick: s.tick, ...(owner ? { owner } : {}), ...(b.homeName ? { home: b.homeName } : {}) });
  s.ruins = list.slice(-RUINS_MOST);
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Something is built over this ground: whatever ruin lay there is cleared away. */
export function clearRuinsUnder(s: GameState, r: Rect): void {
  if (!s.ruins?.length) return;
  s.ruins = s.ruins.filter((q) => !overlaps(q, r));
}

/** Hourly: ruins whose time is up are cleared, and any something now stands on. */
export function ruinsHourly(s: GameState): void {
  if (!s.ruins?.length || s.tick % TICKS_PER_HOUR !== 0) return;
  const standing = s.buildings.filter((b) => !b.planned).map(footprint); // (a planned piece of the wall isn't built yet)
  s.ruins = s.ruins.filter((r) => s.tick - r.tick < RUIN_HOURS[r.kind] * TICKS_PER_HOUR && !standing.some((f) => overlaps(f, r)));
}

/** What stood there, for the tap card: "Elka's cottage", "Bramble End, Elka's cottage", "the smithy". */
export function ruinOf(r: Pick<Ruin, 'def' | 'owner' | 'home'>): string {
  const name = (BUILDING_BY_ID[r.def]?.name ?? r.def).toLowerCase();
  const whose = r.owner ? `${r.owner}'${r.owner.endsWith('s') ? '' : 's'} ${name}` : `the ${name}`;
  return r.home ? `${r.home}, ${whose}` : whose;
}

/** The tap card's line: "The ruins of Elka's cottage, burnt two days ago". */
export function ruinLine(r: Pick<Ruin, 'def' | 'owner' | 'home' | 'kind'>, hours: number): string {
  const how = r.kind === 'burnt' ? 'burnt' : r.kind === 'felled' ? 'brought down' : 'pulled down';
  return `The ruins of ${ruinOf(r)}, ${how} ${agoText(hours)}`;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
/** "an hour ago", "five hours ago", "a day ago", "two days ago". */
export function agoText(hours: number): string {
  const h = Math.max(0, Math.floor(hours));
  if (h < 1) return 'just now';
  if (h < 24) return h === 1 ? 'an hour ago' : `${WORDS[h] ?? h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'a day ago' : `${WORDS[d] ?? d} days ago`;
}

/** The ruins as the renderers see them: how long ago they fell, and the tap card's line. */
export interface RuinView extends Ruin {
  hours: number;
  line: string;
}

export function ruinsView(s: GameState): RuinView[] {
  return (s.ruins ?? []).map((r) => {
    const hours = (s.tick - r.tick) / TICKS_PER_HOUR;
    return { ...r, hours, line: ruinLine(r, hours) };
  });
}
