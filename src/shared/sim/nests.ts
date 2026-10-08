// Monster nests on the town's land (data/nests.ts): each a place (sim/places.ts, kind `nest`) that comes up out on
// the land, grows a level every few days, blights the land round it, sends its creatures out to roam (sim/roamers.ts)
// and, grown, raids the town. Found when the known land reaches it (or when its raiders are tracked home), it waits on
// the Expedition Board for a party; cleared, its hoard comes home and the Calamity's dread falls (sim/calamity.ts).
// Only in a town running itself (the tests' plain towns meet only the nests they put there). Rolls are the seed's own,
// so the town's stream is untouched.

import {
  NEST_APART,
  NEST_DAILY,
  NEST_DEFS,
  NEST_FAR,
  NEST_FIRST_DAY,
  NEST_GROW_DAYS,
  NEST_HOUR,
  NEST_KINDS,
  NEST_MAX_LEVEL,
  NEST_NEAR,
  NEST_RAID_DAILY,
  NEST_RAID_DUE,
  NEST_RAID_LEVEL,
  NEST_RAID_PER_LEVEL,
  NEST_RAID_SHARE,
  NEST_ROAM_HOURLY,
  NESTS_MOST,
  nestName,
  type NestKind,
} from '../data/nests';
import { CALAMITIES, NEST_CLEARED_DREAD, NEST_CLEARED_PER_LEVEL } from '../data/calamity';
import { RAID_KIND_BY_ID } from '../data/raids';
import { ROAM_FIRST_DAY, ROAM_PEOPLE, SPAWN_BEYOND } from '../data/roamers';
import { directionName } from '../data/places';
import { hashSeed, Rng } from '../rng';
import { CELL, groundAt, inMap, isOpen, regionOfCell, wet } from './land';
import { inRegion } from './landRegions';
import { campCell, campXY, notify, type GameState } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { raidBudget, scheduleNextRaid, startRaid } from './raids';
import { spawnRoamerAt, townReachCells } from './roamers';
import type { MapPlace } from './places';
import { isChild } from './social';
import { queueScene } from './cutscenes';

const roll = (s: GameState, ...salt: (number | string)[]) => new Rng(hashSeed(`${s.seed}:nest:${salt.join(':')}`));

/** A nest's own state on its place. */
export interface NestState {
  kind: NestKind;
  level: number;
  /** When it came up, when it last grew, and when it last raided. */
  born: number;
  grew: number;
  raided?: number;
}

/** The nests still festering on the land (found or not). */
export const nestsOf = (s: GameState): MapPlace[] => (s.places ?? []).filter((p) => p.nest && p.state === 'waiting');
/** The nests the town knows of. */
export const knownNests = (s: GameState): MapPlace[] => nestsOf(s).filter((p) => p.found !== null);

/** How many nests the land may hold at once: more as the Calamity rises. */
export const nestsMost = (s: GameState) => NESTS_MOST + Math.max(0, (s.calamity?.stage ?? 0) - 1);

/** A nest grows a level every so many days (sooner as the Calamity rises). */
export const growDays = (s: GameState) => NEST_GROW_DAYS / (1 + 0.25 * (s.calamity?.stage ?? 0));

/** The kind a nest is likeliest to be on this ground and land: barrows on the dead's land, dens in the woods, warrens
 *  in the hills. */
function kindFor(s: GameState, ground: string, rng: Rng): NestKind {
  const weights = Object.fromEntries(NEST_KINDS.map((k) => [k, NEST_DEFS[k].ground.includes(ground) ? 3 : 1])) as Record<NestKind, number>;
  if (s.origin === 'lich' || s.origin === 'vampire') weights.barrow += 3;
  if (s.calamity?.kind === 'tyrant') weights.barrow += 2;
  if (s.calamity?.kind === 'rot') weights.den += 2;
  if (s.calamity?.kind === 'sleeper') weights.warren += 2;
  return rng.weighted(weights);
}

/** A nest comes up on the land, somewhere dry `NEST_NEAR`..`NEST_FAR` cells out and apart from the other places
 *  (null when no spot will do). `kind` and `at` (a cell) for the tests and previews. */
export function spawnNest(s: GameState, kind?: NestKind, at?: { x: number; y: number }, rng: Rng = roll(s, 'spawn', s.tick)): MapPlace | null {
  const camp = campCell(s);
  const places = (s.places ??= []);
  let cell = at ?? null;
  for (let tries = 0; !cell && tries < 60; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(NEST_NEAR, NEST_FAR);
    const x = Math.round(camp.x + Math.cos(a) * r);
    const y = Math.round(camp.y + Math.sin(a) * r);
    if (!inMap(s.land, x, y) || x < 2 || y < 2 || x >= s.land.w - 2 || y >= s.land.h - 2) continue;
    const g = groundAt(s.land, x, y);
    if (wet(g) || g === 'mountain' || g === 'hall') continue;
    if (places.some((p) => p.state !== 'gone' && Math.hypot(p.x - x, p.y - y) < NEST_APART)) continue;
    cell = { x, y };
  }
  if (!cell) return null;
  const k = kind ?? kindFor(s, groundAt(s.land, cell.x, cell.y), rng);
  const p: MapPlace = {
    id: places.reduce((n, q) => Math.max(n, q.id), 0) + 1,
    kind: 'nest',
    x: cell.x,
    y: cell.y,
    found: null,
    state: 'waiting',
    nest: { kind: k, level: 1, born: s.tick, grew: s.tick },
    foes: { ...NEST_DEFS[k].foes[0] },
  };
  places.push(p);
  return p;
}

/** The nest grows a level: more of them, a wider blight. */
export function growNest(s: GameState, p: MapPlace): void {
  const n = p.nest!;
  if (n.level >= NEST_MAX_LEVEL) return;
  n.level++;
  n.grew = s.tick;
  p.foes = { ...NEST_DEFS[n.kind].foes[n.level - 1] };
  if (p.found !== null) notify(s, `${NEST_DEFS[n.kind].grows} (${where(s, p)}: grown ${n.level} of ${NEST_MAX_LEVEL}.)`, n.level >= NEST_RAID_LEVEL);
}

const where = (s: GameState, p: MapPlace) => {
  const camp = campCell(s);
  return `to the ${directionName(p.x - camp.x, p.y - camp.y)}`;
};

/** The nest is found: the town knows where it is, and it goes on the board. */
export function findNest(s: GameState, p: MapPlace, how: string): void {
  if (p.found !== null) return;
  p.found = s.tick;
  const def = NEST_DEFS[p.nest!.kind];
  // (the first the town finds is played out: sim/cutscenes.ts)
  if ((s.places ?? []).filter((q) => q.nest && q.found !== null).length === 1) queueScene(s, 'nest_found', nestScene(p));
  notify(s, `${how}${nestName(p.nest!.kind, p.nest!.level)} found${inRegion(regionOfCell(s.land, p.x, p.y))} ${where(s, p)}. ${def.found} A party may go to clear it, or post a bounty under Trips.`, true);
}

/** Every hour: nests are found as the known land reaches them, their creatures come out; each morning new ones come
 *  up, the old grow, and the grown raid. */
export function nestsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver || s.autopilot === false) return;
  const cal = calendar(s.tick);
  for (const p of nestsOf(s)) if (p.found === null && isOpen(s.land, p.x, p.y)) findNest(s, p, '');
  nestRoamers(s);
  if (cal.hour !== NEST_HOUR) return;
  const g = roll(s, 'day', cal.day);
  // (new nests)
  if (cal.day - 1 >= NEST_FIRST_DAY && nestsOf(s).length < nestsMost(s) && g.chance(NEST_DAILY * (1 + 0.3 * (s.calamity?.stage ?? 0)))) {
    const p = spawnNest(s, undefined, undefined, g);
    if (p && isOpen(s.land, p.x, p.y)) findNest(s, p, 'Something has come to nest on the land: ');
  }
  // (the old grow)
  for (const p of nestsOf(s)) if (s.tick - p.nest!.grew >= growDays(s) * TICKS_PER_DAY) growNest(s, p);
  // (the grown raid, in place of a raid that's due)
  if (s.raid || s.tick < s.nextRaidTick - NEST_RAID_DUE * TICKS_PER_HOUR) return;
  for (const p of nestsOf(s)) {
    const n = p.nest!;
    if (n.level < NEST_RAID_LEVEL || (n.raided !== undefined && s.tick - n.raided < 2 * TICKS_PER_DAY)) continue;
    if (!g.chance(NEST_RAID_DAILY * (n.level - NEST_RAID_LEVEL + 1))) continue;
    nestRaid(s, p, g);
    break;
  }
}

/** A grown nest raids the town; if the town didn't know where it was, the raiders' tracks lead back to it. */
export function nestRaid(s: GameState, p: MapPlace, g: Rng = roll(s, 'raid', s.tick)): boolean {
  const n = p.nest!;
  const kind = RAID_KIND_BY_ID[NEST_DEFS[n.kind].raid];
  if (!kind || s.raid) return false;
  n.raided = s.tick;
  const budget = Math.max(8, raidBudget(s) * (NEST_RAID_SHARE + NEST_RAID_PER_LEVEL * n.level));
  startRaid(s, kind, budget, g);
  scheduleNextRaid(s, g);
  if (p.found === null) findNest(s, p, `${kind.name} come against the town, and their tracks lead back to where they came from: `);
  return true;
}

/** Each hour a nest's creatures may come out, to prowl the land between it and the town (sim/roamers.ts). */
function nestRoamers(s: GameState): void {
  if (calendar(s.tick).day - 1 < ROAM_FIRST_DAY) return;
  const grown = s.people.filter((p) => p.away === null && !isChild(p)).length;
  if (grown < ROAM_PEOPLE) return;
  const c = campXY(s);
  const reach = townReachCells(s);
  for (const p of nestsOf(s)) {
    const n = p.nest!;
    if ((s.roamers ?? []).some((r) => r.nest === p.id)) continue;
    const g = roll(s, 'roam', p.id, s.tick);
    if (!g.chance(NEST_ROAM_HOURLY * n.level)) continue;
    const def = NEST_DEFS[n.kind];
    const nx = (p.x + 0.5) * CELL;
    const ny = (p.y + 0.5) * CELL;
    const d = Math.hypot(nx - c.x, ny - c.y) / CELL;
    // (they come to prowl between the nest and the town: past the town's edge, toward their nest)
    const out = Math.min(d, reach + SPAWN_BEYOND + g.range(0, 6));
    const home = { x: c.x + ((nx - c.x) / Math.max(1, d)) * out, y: c.y + ((ny - c.y) / Math.max(1, d)) * out };
    spawnRoamerAt(s, def.roam[n.level - 1], home, home, { nest: p.id, name: def.folk }, 30);
  }
}

/** A nest a party cleared (from sim/places.ts `placeCleared`): the blight lifts and the Calamity's dread falls. */
export function nestCleared(s: GameState, p: MapPlace): void {
  const n = p.nest!;
  const c = s.calamity;
  if (c && c.stage > 0) {
    const off = NEST_CLEARED_DREAD + NEST_CLEARED_PER_LEVEL * n.level;
    c.dread = Math.max(0, c.dread - off);
    notify(s, `With the ${NEST_DEFS[n.kind].name.toLowerCase()} burned out, ${CALAMITIES[c.kind].name} loses its hold a little (dread −${off}).`, true);
  }
  s.roamers = (s.roamers ?? []).filter((r) => r.nest !== p.id || r.fighting !== undefined);
  (s.nestsCleared ??= 0);
  s.nestsCleared++;
  if (s.nestsCleared === 1) queueScene(s, 'nest_cleared', nestScene(p));
}

/** The words and the foe a nest's scenes take. */
function nestScene(p: MapPlace) {
  const def = NEST_DEFS[p.nest!.kind];
  return { vars: { nest: def.name.toLowerCase(), folk: def.folk }, foes: { nestfoe: Object.keys(def.foes[Math.max(0, p.nest!.level - 1)])[0] } };
}

/** A nest as a place's name ("Spider Den, grown 3"). */
export const nestPlaceName = (p: MapPlace) => nestName(p.nest!.kind, p.nest!.level);

export { blightSources, blighted, BLIGHT_CROPS, WARD_REACH } from './blight';
