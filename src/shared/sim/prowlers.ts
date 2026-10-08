// Night prowlers (the owner's ask: a wall that matters). While a town's ring wall isn't standing all round, or it has
// none, things slip in at night with no warning from the lookout: thieves after the stores, slavers after people,
// beasts after anyone out of doors. The chance each night hour grows with how much of the ring is missing (nothing
// standing: the whole of it) and falls to nothing once it stands all round. A prowl is a raid begun inside the town
// at the gap they came through (sim/raids.ts `startRaid` with `inside`), fought in the town itself, and counts as a
// raid for all that follows (the recap, the ring wanted sooner, the guards hired). A castle, a hold and a tribe on the
// move have walls or wagons of their own: no prowlers. Off with the autopilot, like the choice events (the tests'
// plainGame).

import { eraReached } from '../data/eras';
import { RAID_KIND_BY_ID, type RaidKind } from '../data/raids';
import type { Rng } from '../rng';
import { centreOf, groundAt, wet, type Pt } from './land';
import { raidBudget, startRaid, townEdgeX } from './raids';
import { isGate, lineOf, missingPieces, ringTown } from './ringWall';
import { campXY, notify, type GameState } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** The chance each night hour with no wall at all (scaled by the share of the ring that is missing). */
export const PROWL_PER_NIGHT_HOUR = 1 / 36;
/** Night: from this hour to that one (the small hours). */
export const PROWL_FROM = 22;
export const PROWL_UNTIL = 5;
/** Not before this day, nor before the town is this many grown-ups (a founder alone or with one companion has enough
 *  on their hands: the raids of old spare them too, `RAID_BITE_FROM`), and never within this many hours of the last. */
export const PROWL_FIRST_DAY = 2;
export const PROWL_PEOPLE = 3;
export const PROWL_GAP_HOURS = 36;
/** A prowl's strength against an ordinary raid's budget (a handful that sneaks in, not an army), and its least. */
export const PROWL_BUDGET_SHARE = 0.55;
export const PROWL_BUDGET_LEAST = 14;
/** The lands whose night beasts are wild dogs (the rest wolves). */
const DOG_LANDS = new Set(['desert', 'tundra', 'steppe', 'highlands', 'ashlands', 'taiga']);

/** How much of the ring is missing: 1 with no ring at all (or none begun), 0 once it stands all round (the cells
 *  nothing can stand on, the sea and the mountain, are the wall there and don't count). */
export function ringGap(s: GameState): number {
  if (!ringTown(s)) return 0;
  const ring = s.ring;
  if (!ring) return 1;
  const cells = lineOf(ring).length;
  const missing = missingPieces(s, ring).length + s.buildings.filter((b) => b.ring === ring.gen && b.status !== 'done').length;
  return Math.max(0, Math.min(1, missing / Math.max(1, cells)));
}

/** Who comes: in the Stone Age a rival tribe's sneak-thieves or the night's beasts; from the Medieval age thieves,
 *  slavers or beasts (wild dogs in the dry and cold lands, wolves elsewhere). */
export function prowlKind(s: GameState, rng: Rng): RaidKind {
  const beasts = DOG_LANDS.has(s.biome ?? 'forest') ? 'prowl_dogs' : 'prowl_wolves';
  if (!eraReached(s.era, 'medieval')) return RAID_KIND_BY_ID[rng.chance(0.6) ? 'prowl_scouts' : beasts];
  const id = rng.weighted({ prowl_thieves: 9, prowl_slavers: 4, [beasts]: 7 } as Record<string, number>);
  return RAID_KIND_BY_ID[id];
}

/** Where they slip in: a cell of the ring with nothing standing on it yet (picked at random), else the town's edge
 *  on one side of the camp's row; and how the news tells it. */
export function wayIn(s: GameState, rng: Rng): { at: Pt; where: string } {
  const ring = s.ring;
  if (ring) {
    const gaps: Pt[] = missingPieces(s, ring)
      .filter((p) => !isGate(p.def))
      .map((p) => p.at);
    for (const b of s.buildings) if (b.ring === ring.gen && b.status !== 'done') gaps.push({ x: b.tile, y: b.row });
    if (gaps.length) {
      const p = rng.pick(gaps);
      return { at: centreOf(p.x, p.y), where: wet(groundAt(s.land, p.x, p.y)) ? 'where the river runs under the wall' : 'through a gap in the wall' };
    }
  }
  const side: -1 | 1 = rng.chance(0.5) ? -1 : 1;
  return { at: { x: townEdgeX(s, side), y: campXY(s).y }, where: 'with no wall to stop them' };
}

/** Once an hour, at night: something may slip in where the wall has gaps (never during a raid). */
export function prowlers(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.raid || s.gameOver || s.autopilot === false || s.tick < PROWL_FIRST_DAY * TICKS_PER_DAY) return;
  if (!ringTown(s) || s.people.filter((p) => p.away === null && p.type !== 'child').length < PROWL_PEOPLE) return;
  const hour = calendar(s.tick).hour;
  if (hour < PROWL_FROM && hour >= PROWL_UNTIL) return;
  if (s.lastProwl !== undefined && s.tick - s.lastProwl < PROWL_GAP_HOURS * TICKS_PER_HOUR) return;
  const gap = ringGap(s);
  if (gap <= 0 || !rng.chance(PROWL_PER_NIGHT_HOUR * gap)) return;
  const kind = prowlKind(s, rng);
  const { at, where } = wayIn(s, rng);
  const budget = Math.max(PROWL_BUDGET_LEAST, Math.round(raidBudget(s) * PROWL_BUDGET_SHARE));
  startRaid(s, kind, budget, rng, at);
  s.lastProwl = s.tick;
  notify(s, `${kind.name} ${kind.plural ? 'have' : 'has'} slipped into the town in the night, ${where}!`, true);
}
