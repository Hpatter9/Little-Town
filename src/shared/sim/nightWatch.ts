// The night watch (the owner's ask: "to combat the parties coming in at night, I'd like to have guards patrol or post up
// at gates at night"). The hired guards already keep shifts, walk the wall with torches and stand sentry on the gates
// (sim/people.ts `onShift`, `gatePost`); this is what makes the watch matter and sets it by the danger.
//
// - The roster (`nightWatchHourly`, once an hour, noon to noon): the hired guards on the night shift, and besides them
//   townsfolk who take the watch by turns (`WATCH_STINT` nights running) so a town with no guard hired is covered too: the
//   better fighters first. The town sets how many by the danger (`danger`: a prowl, a probe, a raid or a bandit seen
//   lately, a wall with gaps, the Defence direction). Roster members patrol from `WATCH_FROM` to `WATCH_UNTIL` (people.ts
//   `onShift`) and sleep by day (townsfolk.ts).
// - The watch bites: a prowl (sim/prowlers.ts), a probe (sim/raidOdds.ts) or disguised bandits (sim/bands.ts) that come
//   in with a watchman near (`WATCH_SPOT_RANGE`) may be spotted (`spotChance`: the watchmen's skill, a sentry on a gate,
//   the moon, a lamp at the gate). Spotted sneaks meet the watch at the gate: the raid is begun there (an inside raid, as
//   the prowls are) smaller than it would have been, with the watchmen the first on the spot. A watchman who is there
//   when it is won earns a deed and some experience (`watchWon`).
// All of it off with the autopilot (the tests' plainGame), on its own side stream.

import { RAID_KIND_BY_ID } from '../data/raids';
import { Rng, hashSeed } from '../rng';
import { addDeed } from './deeds';
import { footprint } from './buildings';
import { CELL, type Pt } from './land';
import { isLit } from './lighting';
import { moonPhaseOf, nightDay } from './monsters';
import { startRaid, townEdgeX } from './raids';
import { isGate, missingPieces, ringTown } from './ringWall';
import type { RaidRecap } from './raidRecap';
import { isChild } from './social';
import { campXY, dist, notify, type GameState, type Person, type Raid } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { gainSkill } from './townsfolk';

/** The watch hours: from this one to that one (the wall walk and the gate posts in people.ts keep the same). */
export const WATCH_FROM = 19;
export const WATCH_UNTIL = 6;
export const watchHour = (h: number) => h >= WATCH_FROM || h < WATCH_UNTIL;
/** Townsfolk on the watch keep it this many nights running, then others take it. Fewer than this many grown-ups: none. */
export const WATCH_STINT = 3;
export const WATCH_LEAST_PEOPLE = 4;
/** How lately (days) a prowl, probe, raid or bandit seen counts as danger. */
export const WATCH_DANGER_DAYS = 4;
/** How far a watchman sees a way in, in cells. */
export const WATCH_SPOT_RANGE = 10;
/** A watchman's chance to spot sneaks, and more for each fighting level, and a sentry up on a gate (the least of the three). */
export const WATCH_SPOT_BASE = 0.3;
export const WATCH_SPOT_PER_LEVEL = 0.008;
export const WATCH_SPOT_SENTRY = 0.15;
export const WATCH_SPOT_MOST = 0.95;
/** The dark of a moonless night, the light of a full moon, a lamp at the gate: what the chance is multiplied by. */
export const WATCH_DARK = 0.7;
export const WATCH_BRIGHT = 1.15;
export const WATCH_LAMP = 1.25;
/** A lamp this close (cells) lights a way in. */
const LAMP_RANGE = 5;
/** Sneaks the watch meets at the gate are this share of what they would have been inside the town. */
export const WATCH_CAUGHT_SHARE = 0.5;
/** Experience for a watchman who is there when sneaks are caught. */
export const WATCH_XP = 5;

const dayTicks = (days: number) => days * TICKS_PER_DAY;
/** Which night it is: it turns over at noon, so the small hours belong to the evening before. */
export const nightIndex = (tick: number) => Math.floor((tick - 12 * TICKS_PER_HOUR) / TICKS_PER_DAY);

/** The watch's own stream (never the town's). */
export const watchRng = (s: GameState, tag: string) => new Rng(hashSeed(`${s.seed}:watch:${s.tick}:${tag}`));

const fighting = (p: Person) => Math.max(p.skills.melee.level, p.skills.ranged.level);
/** A hired guard on the night shift (people.ts `onShift`: the odd ids keep it). */
const hiredNight = (s: GameState, p: Person) => !!p.guard && p.id % 2 !== 0 && p.id !== s.mainId;

/** How dangerous the nights are: one for each of a prowl, a probe, a raid and a seen-through band lately, a wall with
 *  gaps, and two on the Defence direction. */
export function danger(s: GameState): number {
  const lately = (t: number | undefined) => t !== undefined && s.tick - t < dayTicks(WATCH_DANGER_DAYS);
  let d = 0;
  if (lately(s.lastProwl)) d++;
  if (s.raidOdds?.probe || lately(s.watch?.alert)) d++;
  if (s.journal.some((j) => j.text.startsWith('Raid by') && s.tick - j.tick < dayTicks(WATCH_DANGER_DAYS))) d++;
  if (ringTown(s) && !s.ring?.done) d++;
  if ((s.direction ?? 'growth') === 'defense') d += 2;
  return d;
}

/** Who is free to take the watch besides the hired guards: grown-ups at home on their feet, not the founder, not running a
 *  station, not set against defending; the better fighters first. */
function candidates(s: GameState): Person[] {
  const busy = new Set<number>();
  for (const b of s.buildings) if (b.operator != null) busy.add(b.operator);
  return s.people
    .filter((p) => p.away === null && !p.downed && !isChild(p) && !p.guard && p.id !== s.mainId && p.priorities.defend !== 0 && !busy.has(p.id))
    .sort((a, b) => fighting(b) - fighting(a) || b.hp - a.hp || a.id - b.id);
}

/** How many besides the hired night guards the town wants on the watch tonight. */
export function watchWanted(s: GameState): number {
  const grown = s.people.filter((p) => p.away === null && !isChild(p)).length;
  if (grown < WATCH_LEAST_PEOPLE || !ringTown(s)) return 0;
  const hired = s.people.filter((p) => hiredNight(s, p)).length;
  const total = Math.min(Math.floor(grown / 3), Math.max(1, hired) + danger(s));
  return Math.max(0, total - hired);
}

/** Once an hour (autopilot only): at noon the watch for the coming night is set. Those on it keep it `WATCH_STINT` nights. */
export function nightWatchHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false) return;
  const night = nightIndex(s.tick);
  if (s.watch?.night === night) return;
  const w = (s.watch ??= { night, ids: [] });
  const want = watchWanted(s);
  const pool = candidates(s);
  const fresh = night % WATCH_STINT === 0;
  let ids = fresh ? [] : w.ids.filter((id) => pool.some((p) => p.id === id));
  if (ids.length > want) ids = ids.slice(0, want);
  if (ids.length < want) {
    // (the better half of the town's fighters, taking it in turn)
    const better = pool.filter((p) => !ids.includes(p.id)).slice(0, Math.max(want, Math.ceil(pool.length / 2)));
    const turn = Math.floor(night / WATCH_STINT);
    for (let i = 0; ids.length < want && i < better.length; i++) ids.push(better[(turn * want + i) % better.length].id);
    ids = [...new Set(ids)];
  }
  w.night = night;
  w.ids = ids;
}

/** Whether someone is on the roster (a townsperson taking the watch; the hired guards keep it by their own shift). */
export const onRoster = (s: GameState, p: Person) => !!s.watch?.ids.includes(p.id);
/** Whether someone on the roster is on watch now: in the watch hours, at home and on their feet. */
export const onNightWatch = (s: GameState, p: Person) => onRoster(s, p) && p.away === null && !p.downed && watchHour(calendar(s.tick).hour);

/* ------------------------------------------------------------ spotting */

/** The watchmen near a point, on patrol in the watch hours. */
export function watchNear(s: GameState, at: Pt): Person[] {
  if (!watchHour(calendar(s.tick).hour)) return [];
  return s.people.filter((p) => p.away === null && !p.downed && p.task?.type === 'patrol' && dist(p, at) <= WATCH_SPOT_RANGE * CELL);
}

/** The compass side of the camp a point lies on. */
export function sideOf(s: GameState, at: Pt): 'north' | 'south' | 'east' | 'west' {
  const c = campXY(s);
  const dx = at.x - c.x;
  const dy = at.y - c.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : dy < 0 ? 'north' : 'south';
}

/** Whether a lit lamp stands by a point (a light at a gate: sim/lighting.ts). */
function lampNear(s: GameState, at: Pt): boolean {
  return (s.torches ?? []).some((t) => isLit(s, t) && Math.hypot((t.x + 0.5) * CELL - at.x, (t.y + 0.5) * CELL - at.y) <= LAMP_RANGE * CELL);
}

/** The moon tonight: dark when it is new (the sneaks have the night), bright when full. */
export function moonLight(s: GameState): number {
  const phase = moonPhaseOf(nightDay(s.tick));
  return phase <= 1 ? WATCH_DARK : phase === 5 ? WATCH_BRIGHT : 1;
}

/** The chance that these watchmen spot sneaks coming in at a point. */
export function spotChance(s: GameState, near: Person[], at: Pt): number {
  let miss = 1;
  for (const p of near) {
    const sentry = p.task?.type === 'patrol' && p.task.post !== undefined;
    miss *= 1 - Math.min(0.7, WATCH_SPOT_BASE + WATCH_SPOT_PER_LEVEL * fighting(p) + (sentry ? WATCH_SPOT_SENTRY : 0));
  }
  return Math.min(WATCH_SPOT_MOST, (1 - miss) * moonLight(s) * (lampNear(s, at) ? WATCH_LAMP : 1));
}

/** The watchmen who spot sneaks coming in at a point, or none (with the tallies). */
export function spotAt(s: GameState, at: Pt, rng: Rng): Person[] {
  const near = watchNear(s, at);
  const w = (s.watch ??= { night: nightIndex(s.tick), ids: [] });
  if (near.length && rng.chance(spotChance(s, near, at))) {
    w.spotted = (w.spotted ?? 0) + 1;
    w.alert = s.tick;
    return near;
  }
  w.missed = (w.missed ?? 0) + 1;
  w.alert = s.tick;
  return [];
}

/** Where the watch puts a way in, told: "at the east gate", "through the north wall", "at the west edge of the town". */
export const placeName = (s: GameState, at: Pt, how: 'gate' | 'gap' | 'edge') =>
  how === 'gate' ? `at the ${sideOf(s, at)} gate` : how === 'gap' ? `through the ${sideOf(s, at)} wall` : `at the ${sideOf(s, at)} edge of the town`;

/** A raid begun at a way in is the watch's to meet: noted on it (the recap tells it, and `watchWon` rewards it). */
export function markWatched(raid: Raid, near: Person[], where: string): void {
  raid.watched = where;
  raid.watchers = near.map((p) => p.id);
}

/** Prowlers spotted at a gap: how many of the budget are left to meet (the rest are held at the wall). */
export const caughtBudget = (budget: number) => Math.max(1, Math.round(budget * WATCH_CAUGHT_SHARE));

/* ------------------------------------------------------------ the probe at the gate */

/** Where a probe tries: a gate of the ring wall; else a gap in it; else the town's edge. */
function probeEntry(s: GameState, rng: Rng): { at: Pt; how: 'gate' | 'gap' | 'edge' } {
  const ring = s.ring;
  if (ring) {
    const gates = s.buildings.filter((b) => b.ring === ring.gen && b.status === 'done' && isGate(b.def));
    if (gates.length) {
      const r = footprint(rng.pick(gates));
      return { at: { x: (r.x + r.w / 2) * CELL, y: (r.y + r.h / 2) * CELL }, how: 'gate' };
    }
    const gaps = missingPieces(s, ring)
      .filter((p) => !isGate(p.def))
      .map((p) => p.at);
    if (gaps.length) {
      const p = rng.pick(gaps);
      return { at: { x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }, how: 'gap' };
    }
  }
  const side: -1 | 1 = rng.chance(0.5) ? -1 : 1;
  return { at: { x: townEdgeX(s, side), y: campXY(s).y }, how: 'edge' };
}

/** A probe (sim/raidOdds.ts) goes in at a way in. If a watchman is near and spots it, the few sneaks meet the watch there
 *  (a small raid begun at the gate) and the probe is over. True when it was met. */
export function watchMeetsProbe(s: GameState, kindId: string, n: number): boolean {
  if (s.autopilot === false || s.raid || !watchHour(calendar(s.tick).hour)) return false;
  const rng = watchRng(s, 'probe');
  const { at, how } = probeEntry(s, rng);
  const near = spotAt(s, at, rng);
  if (!near.length) return false;
  const kind = RAID_KIND_BY_ID[kindId];
  if (!kind) return false;
  const cheapest = Math.min(...Object.values(kind.enemies));
  const raid = startRaid(s, kind, cheapest * n, rng, at);
  const where = placeName(s, at, how);
  markWatched(raid, near, where);
  const first = near.sort((a, b) => fighting(b) - fighting(a))[0];
  notify(s, `${first.name} of the night watch spotted ${n} of the ${kind.name.toLowerCase()} creeping in ${where}: the alarm is raised!`, true);
  return true;
}

/** A band of "travellers" seen through in the night by a watchman: the raid begun where they stand is the watch's to meet. */
export function watchSawBandits(s: GameState, raid: Raid, guard: Person, at: Pt): void {
  const near = watchNear(s, at);
  if (!near.includes(guard)) near.push(guard);
  markWatched(raid, near, 'in the town');
  const w = (s.watch ??= { night: nightIndex(s.tick), ids: [] });
  w.spotted = (w.spotted ?? 0) + 1;
  w.alert = s.tick;
}

/* ------------------------------------------------------------ the reward */

/** A raid the watch spotted is over (`raidRecap`): sneaks caught are told, counted for the year, and the watchmen who were
 *  in the fight earn a deed and some experience. */
export function watchWon(s: GameState, r: Raid, recap: RaidRecap): void {
  const w = (s.watch ??= { night: nightIndex(s.tick), ids: [] });
  if (recap.outcome === 'pillaged') return;
  w.caught = (w.caught ?? 0) + 1;
  const y = (s.yearRaids ??= { came: 0, won: 0, pillaged: 0 });
  y.watched = (y.watched ?? 0) + 1;
  const who = recap.name.toLowerCase();
  notify(s, `The night watch caught the ${who.replace(/^the /, '')} ${r.watched ?? 'in the town'}.`, true);
  for (const id of r.watchers ?? []) {
    const p = s.people.find((q) => q.id === id);
    const row = recap.rows.find((x) => x.id === id);
    if (!p || !row || row.dealt + row.kills <= 0) continue;
    addDeed(p, 'watched');
    gainSkill(p, p.skills.ranged.level > p.skills.melee.level ? 'ranged' : 'melee', WATCH_XP);
  }
}

/** For the Plan tab: the watch tonight, in a line. */
export function watchLine(s: GameState): string {
  const hired = s.people.filter((p) => hiredNight(s, p)).length;
  const extra = s.watch?.ids.length ?? 0;
  const n = hired + extra;
  const caught = s.watch?.caught ?? 0;
  const tail = caught ? ` It has caught sneaks ${caught === 1 ? 'once' : `${caught} times`}.` : '';
  if (!n) return `No one is posted on the night watch yet.${tail}`;
  return `${n} on the night watch, at the gates and along the wall from dusk to dawn${danger(s) ? ' (more of them while the nights are dangerous)' : ''}.${tail}`;
}
