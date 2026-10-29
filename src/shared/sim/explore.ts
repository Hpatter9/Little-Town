// Pushing back the fog (the owner's ask): scouts, hunters and rangers with nothing to do go out to the fog's edge near
// the town and look, anyone idle does when the town has found no room to build, and the founder can be sent out
// for the day. An explorer is only a walker (a `wander` task marked `explore`): the fog lifts where they go (sim/fog.ts)
// and the land's dangers apply to them as to anyone. Autopilot on (the idle ones); the founder's order is the player's.

import { EXPLORE_BEYOND, EXPLORE_DIRS, EXPLORE_PER_PEOPLE, EXPLORE_QUOTA, FOG_NEED_HOURS, SCOUT_CLASSES } from '../data/sight';
import { Rng, hashSeed } from '../rng';
import { townRadius } from './buildings';
import { CELL, inMap, stepCost, type Pt } from './land';
import { calendar, TICKS_PER_HOUR } from './time';
import { campCell, maxHp, type GameState, type Person } from './state';
import { isChild } from './social';
import { isNight } from './lighting';

/** How far from the camp the exploring goes (cells): past the open land too, which a new town has all in sight from
 *  the start (`START_EXPLORED` is wider than `OPEN_START`), so nothing was left to explore for weeks. */
export function exploreReach(s: GameState): number {
  return townRadius(s) + EXPLORE_BEYOND;
}

interface Edge {
  src: string | undefined;
  reach: number;
  cells: Pt[];
}
const edges = new WeakMap<GameState, Edge>();

/** The explored cells that border the unexplored, within reach of the camp and walkable (kept while the fog is as it was). */
export function fogEdge(s: GameState): Pt[] {
  const reach = exploreReach(s);
  const e = edges.get(s);
  if (e && e.src === s.explored && e.reach === reach) return e.cells;
  const m = s.land;
  const c = campCell(s);
  const cells: Pt[] = [];
  const text = s.explored;
  if (text !== undefined) {
    const seen = (x: number, y: number) => !inMap(m, x, y) || text.charCodeAt(y * m.w + x) === 49;
    for (let y = Math.max(0, c.y - reach); y <= Math.min(m.h - 1, c.y + reach); y++)
      for (let x = Math.max(0, c.x - reach); x <= Math.min(m.w - 1, c.x + reach); x++) {
        if (text.charCodeAt(y * m.w + x) !== 49 || Math.hypot(x - c.x, y - c.y) > reach) continue;
        if (seen(x + 1, y) && seen(x - 1, y) && seen(x, y + 1) && seen(x, y - 1)) continue;
        if (stepCost(m, x, y) === Infinity) continue;
        cells.push({ x, y });
      }
  }
  edges.set(s, { src: s.explored, reach, cells });
  return cells;
}

/** Whether there is fog left to push back within reach (the town's lack of room may be its lack of sight). */
export const fogRemains = (s: GameState): boolean => fogEdge(s).length > 0;

/** Where an explorer is walking now (the other explorers' marks, so they spread out). */
function marks(s: GameState, but: Person): Pt[] {
  const out: Pt[] = [];
  for (const q of s.people)
    if (q !== but && q.task?.type === 'wander' && q.task.explore) out.push({ x: Math.floor(q.task.targetX / CELL), y: Math.floor(q.task.targetY / CELL) });
  return out;
}

/** The edge cell to walk to: among the nearest to the person that no other explorer is bound for, one at random from a
 *  side stream (`dir`: the founder's order, only edge cells that way from the camp). Null when the fog is all pushed back. */
export function exploreTarget(s: GameState, p: Person, dir?: number): Pt | null {
  const c = campCell(s);
  const here = { x: Math.floor(p.x / CELL), y: Math.floor(p.y / CELL) };
  const taken = marks(s, p);
  let pool = fogEdge(s).filter((e) => !taken.some((t) => Math.hypot(t.x - e.x, t.y - e.y) < 8) && Math.hypot(e.x - here.x, e.y - here.y) > 3);
  if (dir !== undefined) {
    const a = (dir * Math.PI) / 4;
    const dx = Math.sin(a), dy = -Math.cos(a);
    pool = pool.filter((e) => {
      const d = Math.hypot(e.x - c.x, e.y - c.y) || 1;
      return ((e.x - c.x) * dx + (e.y - c.y) * dy) / d > 0.7;
    });
  }
  if (!pool.length) return null;
  pool.sort((a, b) => Math.hypot(a.x - here.x, a.y - here.y) - Math.hypot(b.x - here.x, b.y - here.y) || a.y - b.y || a.x - b.x);
  const rng = new Rng(hashSeed(`${s.seed}:explore:${s.tick}:${p.id}`));
  return pool[rng.int(0, Math.min(pool.length, 10) - 1)];
}

/** The planner has found no room: anyone idle may go and look for a while. */
export function fogNeeded(s: GameState): boolean {
  return s.fogNeed !== undefined && s.tick - s.fogNeed < FOG_NEED_HOURS * TICKS_PER_HOUR;
}

/** A person with nothing to do who goes to the fog's edge, or null. Autopilot, by day, grown-ups who are well; the
 *  scouting callings always, the rest only when the town needs room. */
export function scoutTask(s: GameState, p: Person): Extract<NonNullable<Person['task']>, { type: 'wander' }> | null {
  if (s.autopilot === false || s.raid || isChild(p) || p.away !== null || p.downed || p.id === s.mainId) return null;
  if (isNight(s) || calendar(s.tick).hour < 7 || p.needs.food < 0.5 || p.needs.rest < 0.4 || p.hp < maxHp(p) * 0.7) return null;
  const scout = !!p.cls && SCOUT_CLASSES.includes(p.cls);
  if (!scout && !fogNeeded(s)) return null;
  const grown = s.people.filter((q) => !isChild(q) && q.away === null).length;
  const out = s.people.filter((q) => q.task?.type === 'wander' && q.task.explore).length;
  if (out >= EXPLORE_QUOTA + Math.floor(grown / EXPLORE_PER_PEOPLE)) return null;
  const at = exploreTarget(s, p);
  return at ? { type: 'wander', targetX: (at.x + 0.5) * CELL, targetY: (at.y + 0.5) * CELL, explore: true } : null;
}

/** The founder's day of exploring toward a wind (founderOrder `explore`): where to walk now, or null when that way is
 *  all explored within reach. */
export function founderExploreTask(s: GameState, p: Person, dir: number): Extract<NonNullable<Person['task']>, { type: 'wander' }> | null {
  const at = exploreTarget(s, p, dir);
  return at ? { type: 'wander', targetX: (at.x + 0.5) * CELL, targetY: (at.y + 0.5) * CELL, explore: true } : null;
}

export const windName = (dir: number): string => EXPLORE_DIRS[((dir % 8) + 8) % 8];

/** Which winds still have fog to explore within reach (for the order menu). */
export function windsOpen(s: GameState): boolean[] {
  const c = campCell(s);
  const edge = fogEdge(s);
  return EXPLORE_DIRS.map((_, dir) => {
    const a = (dir * Math.PI) / 4;
    const dx = Math.sin(a), dy = -Math.cos(a);
    return edge.some((e) => {
      const d = Math.hypot(e.x - c.x, e.y - c.y) || 1;
      return ((e.x - c.x) * dx + (e.y - c.y) * dy) / d > 0.7;
    });
  });
}

