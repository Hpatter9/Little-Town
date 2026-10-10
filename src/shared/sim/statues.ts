// Statues of the town's heroes (the owner's ask). Once a day (`STATUE_HOUR`), with the autopilot on, the town raises a
// statue to the first of its honoured dead (sim/memorials.ts) who has none standing: a small blueprint (`STATUE`,
// data/memorials.ts) laid in its square, before the seat (`statueSpot`: the nearest open cell out from the seat's door
// that is clear of the other buildings' sides, statues beside statues), built like any other with a little stone, and
// remembering who it is for (`Building.statue`). One at a time, at most `STATUES_MOST`, only with the stone in store
// (`STATUE_STONE`) and never in a raid; so over the generations the square fills, the oldest dead first. A statue
// brought down by a quake is raised again. Never pulled down to make room (`mayClear` in sim/buildings.ts), never
// built by the planner's own loop (its `NEVER`). Finished, it's unveiled: a line in the Journal.

import { BUILDING_BY_ID } from '../data/buildings';
import { isSeat } from '../data/seats';
import { STATUE, STATUE_HOUR, STATUE_STONE, STATUES_MOST } from '../data/memorials';
import { canPlace, footprint, footprints, placeBlueprint, totalStock } from './buildings';
import { castleOn, holdOf } from './castle';
import { doorOf, overlaps, spiralSpot, type Pt, type Rect } from './land';
import { findSpot } from './planner';
import { nameHomes, type Honoured } from './memorials';
import { ruinsHourly } from './ruins';
import { campCell, notify, type GameState } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

/** How far out from the seat a statue may stand (cells) before it goes wherever the planner would put it. */
const SQUARE_REACH = 10;

/** Hourly: homes named, ruins cleared, and (autopilot on) a statue unveiled or laid out. */
export function memorialsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  nameHomes(s);
  ruinsHourly(s);
  if (s.autopilot === false || s.gameOver) return;
  unveil(s);
  if (calendar(s.tick).hour === STATUE_HOUR) raiseStatue(s);
}

/** Whom a statue stands for. */
export const honouredOf = (s: Pick<GameState, 'honoured'>, id: number | undefined): Honoured | undefined => (id === undefined ? undefined : s.honoured?.find((h) => h.id === id));

/** The next of the honoured dead with no statue standing (or being built), oldest first. */
export function nextToHonour(s: GameState): Honoured | undefined {
  const raised = new Set(s.buildings.filter((b) => b.def === STATUE).map((b) => b.statue));
  return s.honoured?.find((h) => !raised.has(h.id));
}

/** Lay out a statue to the next of the honoured, if the town may. Returns whether one was laid. */
export function raiseStatue(s: GameState): boolean {
  const statues = s.buildings.filter((b) => b.def === STATUE);
  if (statues.some((b) => b.status !== 'done') || statues.length >= STATUES_MOST) return false;
  if (s.raid && s.raid.phase === 'active') return false;
  const who = nextToHonour(s);
  if (!who) return false;
  const def = BUILDING_BY_ID[STATUE];
  if ((totalStock(s).stone ?? 0) < (def.cost.stone ?? 0) * STATUE_STONE) return false;
  const at = statueSpot(s);
  if (!at) return false;
  if (!placeBlueprint(s, STATUE, at.x, at.y, false, false, !!at.wild).ok) return false;
  const b = s.buildings.find((q) => q.def === STATUE && q.tile === at.x && q.row === at.y && q.statue === undefined);
  if (!b) return false;
  b.statue = who.id;
  notify(s, `The town lays out a statue to ${who.name} in the square, so they are not forgotten.`);
  return true;
}

/** A finished statue is unveiled once: the town's words for the one it stands for. */
function unveil(s: GameState): void {
  for (const b of s.buildings) {
    if (b.def !== STATUE || b.status !== 'done') continue;
    const h = honouredOf(s, b.statue);
    if (!h || h.unveiled !== undefined) continue;
    h.unveiled = s.tick;
    notify(s, `A statue of ${h.name} now stands in the square. The town remembers.`, true);
  }
}

const grow = (r: Rect, n: number): Rect => ({ x: r.x - n, y: r.y - n, w: r.w + n * 2, h: r.h + n * 2 });

/** Where the next statue stands: out from the seat's door (else the camp's fire), on open ground or the wild cleared
 *  first, never on a road nor against another building's side, beside the statues already there. A castle or a hold,
 *  or with no room near the seat, wherever the planner would put it. */
export function statueSpot(s: GameState): (Pt & { wild?: true }) | null {
  const def = BUILDING_BY_ID[STATUE];
  if (castleOn(s) || holdOf(s)) return findSpot(s, def);
  const seat = s.buildings.find((b) => isSeat(b.def) && b.status === 'done');
  const door = seat ? doorOf(footprint(seat)) : null;
  const from = door ? { x: door.x, y: door.y + 1 } : campCell(s);
  const others = s.buildings.filter((b) => b.def !== STATUE).map((b) => grow(footprint(b), 1));
  const statues = s.buildings.filter((b) => b.def === STATUE).map((b) => grow(footprint(b), 1));
  const wild = (r: Rect) => !canPlace(s, def, r.x, r.y).ok;
  const r = spiralSpot(s.land, 1, 1, footprints(s), from, {
    maxR: SQUARE_REACH,
    wild: true,
    ok: (rect) => !others.some((o) => overlaps(o, rect)) && (!door || rect.y >= door.y),
    prefer: (rect) => (wild(rect) ? 1.5 : 0) - (statues.some((o) => overlaps(o, rect)) ? 0.5 : 0),
  });
  if (!r) return findSpot(s, def);
  const overWild = wild(r);
  if (!canPlace(s, def, r.x, r.y, undefined, false, overWild).ok) return findSpot(s, def);
  return { x: r.x, y: r.y, ...(overWild ? { wild: true as const } : {}) };
}
