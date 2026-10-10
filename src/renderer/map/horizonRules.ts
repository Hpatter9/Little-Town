// The wider world felt from home (the owner's ask), as pure rules: where the other powers' settlements show past the
// fog (map/mapHorizon.ts draws them: campfires glowing at night, smoke rising by day, more and taller the bigger the
// rival town), where a war host coming for the town shows as a line of torches drawing nearer, and when a courier
// gallops in with news (map/mapCourier.ts), by which way and along what timeline. Renderer only: nothing of it is in
// the sim, and it is tested.

import { HOST_WARNING_HOURS } from '../../shared/data/factions';
import { hashSeed } from '../../shared/rng';
import { FOG_BAND, type LandMap } from '../../shared/sim/land';
import { townBearing } from './signRules';

/** How far past the fog's end (cells) a rival town's fires and smoke sit, and how far a host starts out. */
export const HEARTH_BEYOND = 2;
export const HOST_FAR = 14;
/** A rival town's fires by its size (camp, village, town, city, capital: `townTier` in sim/factions.ts), and its smoke
 *  columns. */
export const FIRES_BY_TIER = [2, 3, 5, 7, 9];
export const SMOKES_BY_TIER = [1, 1, 2, 3, 4];
/** How tall a column climbs (px): at the least, and more for every head of the rival town, up to the most. */
export const SMOKE_LEAST = 70;
export const SMOKE_PER_FOLK = 1.6;
export const SMOKE_MOST = 300;
/** A host's torches: the least, one more for every few in it, up to the most; and how far apart along its line (cells). */
export const TORCHES_LEAST = 4;
export const TORCH_PER = 3;
export const TORCHES_MOST = 26;
export const TORCH_APART = 0.85;

/** A point on the land (cells, fractions allowed). */
export interface Pt {
  x: number;
  y: number;
}

/** The point on a bearing (radians, 0 east, y down) from the camp, `beyond` cells past where the fog's band ends. */
export function fogEdge(land: Pick<LandMap, 'camp' | 'open'>, bearing: number, beyond: number): Pt {
  const r = land.open + FOG_BAND + beyond;
  return { x: land.camp.x + 0.5 + Math.cos(bearing) * r, y: land.camp.y + 0.5 + Math.sin(bearing) * r };
}

/** A settlement past the fog: a power of the realm with a stronghold on the world map, not razed. */
export interface SettlementIn {
  id: string;
  stance: string;
  tier: number;
  folk: number;
}
export function settlementsSeen<T extends SettlementIn>(factions: readonly T[]): (T & { bearing: number })[] {
  const out: (T & { bearing: number })[] = [];
  for (const f of factions) {
    if (f.stance === 'destroyed') continue;
    const bearing = townBearing(f.id);
    if (bearing !== null) out.push({ ...f, bearing });
  }
  return out;
}

/** A small number of 0..1 from a word and a number (the same each time). */
const frac = (key: string, i: number) => (hashSeed(`${key}:${i}`) % 10007) / 10007;

/** A rival town's campfires at the fog's edge: more and brighter by its size, spread over a wider arc, each a little
 *  further or nearer, with its own flicker's phase. */
export function campfiresOf(id: string, tier: number, bearing: number, land: Pick<LandMap, 'camp' | 'open'>): (Pt & { strength: number; phase: number })[] {
  const t = Math.max(0, Math.min(4, tier));
  const n = FIRES_BY_TIER[t];
  const arc = 0.07 + 0.035 * t;
  const out: (Pt & { strength: number; phase: number })[] = [];
  for (let i = 0; i < n; i++) {
    const p = fogEdge(land, bearing + (frac(id, i) - 0.5) * 2 * arc, HEARTH_BEYOND + frac(id, i + 50) * (2 + t));
    out.push({ ...p, strength: 0.45 + 0.13 * t + 0.15 * frac(id, i + 100), phase: frac(id, i + 200) * 6.28 });
  }
  return out;
}

/** A rival town's smoke columns on the horizon by day: more by its size, taller as its folk grow. */
export function smokesOf(id: string, tier: number, folk: number, bearing: number, land: Pick<LandMap, 'camp' | 'open'>): (Pt & { height: number })[] {
  const t = Math.max(0, Math.min(4, tier));
  const out: (Pt & { height: number })[] = [];
  const height = Math.min(SMOKE_MOST, SMOKE_LEAST + Math.max(0, folk) * SMOKE_PER_FOLK);
  for (let i = 0; i < SMOKES_BY_TIER[t]; i++) {
    const p = fogEdge(land, bearing + (frac(id, i + 300) - 0.5) * (0.08 + 0.03 * t), HEARTH_BEYOND + 1 + frac(id, i + 400) * 3);
    out.push({ ...p, height: Math.round(height * (0.75 + 0.25 * frac(id, i + 500))) });
  }
  return out;
}

/** A war host on its way: its torches in a line across its way, `hours` from the town (of `HOST_WARNING_HOURS`), so the
 *  line starts far out past the fog and draws in to its edge as the host comes. Each torch is a little off the line. */
export function hostTorches(id: string, bearing: number, hours: number, size: number, land: Pick<LandMap, 'camp' | 'open'>): Pt[] {
  const share = Math.max(0, Math.min(1, hours / HOST_WARNING_HOURS));
  const mid = fogEdge(land, bearing, share * HOST_FAR);
  const n = Math.max(TORCHES_LEAST, Math.min(TORCHES_MOST, TORCHES_LEAST + Math.floor(size / TORCH_PER)));
  // (across the way it comes: at right angles to the bearing)
  const ax = -Math.sin(bearing);
  const ay = Math.cos(bearing);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const along = (i - (n - 1) / 2) * TORCH_APART;
    const back = (frac(id, i + 600) - 0.5) * 1.4;
    out.push({ x: mid.x + ax * along + Math.cos(bearing) * back, y: mid.y + ay * along + Math.sin(bearing) * back });
  }
  return out;
}

/* ------------------------------------------------------------ couriers */

/** What news a courier brings. */
export type NewsKind = 'question' | 'raid' | 'war' | 'host' | 'quest' | 'caravan';
export interface News {
  key: string;
  kind: NewsKind;
  /** The power it comes from (its bearing), or null to come any way (by the key). */
  from: string | null;
  /** What the rider brings, for the tap card. */
  line: string;
}
/** The questions a rider brings word of (the rest ask at the gate, or are the town's own: an envoy rides in himself). */
export const NEWS_PROMPTS = new Set(['event', 'raid', 'saga', 'village', 'strangers', 'dragon']);
/** What of the snapshot the news is read from. */
export interface NewsShot {
  prompts: readonly { id: number; kind: string; title: string }[];
  realm: { factions: readonly { id: string; name: string; known: boolean; stance: string; host: { hours: number; size: number } | null }[] };
  quests: readonly { id: number; title: string }[];
  caravan: { faction: string | null } | null;
}
/** The news between two snapshots: a question come up, a power gone to war, a host mustered against the town, a quest
 *  offered, a caravan come to market. Nothing on the first snapshot (that's the town as it was, not news). */
export function newsBetween(prev: NewsShot | null, next: NewsShot): News[] {
  if (!prev) return [];
  const out: News[] = [];
  const had = new Set(prev.prompts.map((p) => p.id));
  for (const p of next.prompts) if (NEWS_PROMPTS.has(p.kind) && !had.has(p.id)) out.push({ key: `q${p.id}`, kind: p.kind === 'raid' ? 'raid' : 'question', from: null, line: p.kind === 'raid' ? 'Riding in with warning of raiders' : `Bringing word: ${p.title}` });
  const before = new Map(prev.realm.factions.map((f) => [f.id, f]));
  for (const f of next.realm.factions) {
    const b = before.get(f.id);
    if (!b || !f.known) continue;
    if (f.stance === 'war' && b.stance !== 'war') out.push({ key: `w${f.id}`, kind: 'war', from: f.id, line: `Bringing word: ${f.name} has gone to war` });
    if (f.host && !b.host) out.push({ key: `h${f.id}`, kind: 'host', from: f.id, line: `Riding hard: a host of ${f.name} is on the march` });
  }
  const quests = new Set(prev.quests.map((q) => q.id));
  for (const q of next.quests) if (!quests.has(q.id)) out.push({ key: `k${q.id}`, kind: 'quest', from: null, line: `Bringing word of a quest: ${q.title}` });
  if (next.caravan && !prev.caravan) out.push({ key: `c${next.caravan.faction ?? ''}`, kind: 'caravan', from: null, line: next.caravan.faction ? `Riding ahead of ${next.caravan.faction}'s caravan` : 'Riding ahead of a trade caravan' });
  return out;
}
/** The way a courier comes from (radians): the power's stronghold's bearing, else one by the news's key. */
export function newsBearing(n: News): number {
  const b = n.from ? townBearing(n.from) : null;
  return b ?? frac(n.key, 1) * Math.PI * 2;
}

/** A courier's pace (world px a second at a gallop), how long they wait at the seat, and the most on the roads at once. */
export const GALLOP = 140;
export const WAIT_AT_SEAT = 5;
export const COURIERS_MOST = 2;
/** The least time between two couriers setting out (seconds), and the most news held waiting. */
export const COURIER_GAP = 4;
export const NEWS_WAITING = 4;

/** Where a courier is `t` seconds after setting out along `route` (world px, from the land's edge to the seat): riding
 *  in, waiting at the seat, riding back out the way they came; null once gone. */
export function riderAt(route: readonly Pt[], t: number): (Pt & { dir: 1 | -1; phase: 'in' | 'wait' | 'out' }) | null {
  if (route.length < 2 || t < 0) return null;
  const legs: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const d = Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
    legs.push(d);
    total += d;
  }
  const ride = total / GALLOP;
  const at = (dist: number): Pt & { dir: 1 | -1 } => {
    let left = Math.max(0, Math.min(total, dist));
    for (let i = 0; i < legs.length; i++) {
      if (left <= legs[i] || i === legs.length - 1) {
        const k = legs[i] ? Math.min(1, left / legs[i]) : 1;
        const a = route[i];
        const b = route[i + 1];
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dir: b.x < a.x ? -1 : 1 };
      }
      left -= legs[i];
    }
    return { ...route[route.length - 1], dir: 1 };
  };
  if (t < ride) return { ...at(t * GALLOP), phase: 'in' };
  if (t < ride + WAIT_AT_SEAT) {
    const p = at(total);
    // (at the seat they face the way they came in)
    return { x: p.x, y: p.y, dir: p.dir, phase: 'wait' };
  }
  const back = t - ride - WAIT_AT_SEAT;
  if (back > ride) return null;
  const p = at(total - back * GALLOP);
  return { x: p.x, y: p.y, dir: (p.dir * -1) as 1 | -1, phase: 'out' };
}
