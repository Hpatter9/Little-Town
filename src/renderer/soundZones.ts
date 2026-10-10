// Sounds by place (the owner's ask): the town heard where it is, not the same wherever the view goes. Pure, so the
// tests can reach it; ambience.ts plays it. Two steps:
//
// - `zoneSources(town)`: what in the town is making a noise now, and where (world px), and how much (0 to 1): the
//   tavern's hubbub (all day, loud of an evening and while folk are drinking there) and a fiddle tune at night or with
//   drinkers in; the market's chatter (the shops open by day, the square on market day); hymns at the shrine or temple
//   (a rite, and of a morning); the forge's clang and the workshops' noise while an order is being made at them
//   (`workingAt`); the pens' herds lowing, bleating, grunting or clucking.
// - `zoneMix(sources, view)`: how loud each kind is heard and where across the screen: by how near the middle of the
//   view each source is (`HEAR`: a little past its edge is still heard, faintly) and by the zoom (`ZOOM_REF`: zoomed
//   out, the view is wider and everything a little quieter; zoomed in, louder), panned left and right by where it is.
//   ambience.ts eases every level and pan, so a zone fades in and out as the view moves.

import { BUILDING_BY_ID } from '../shared/data/buildings';
import { buildingCentre } from '../shared/sim/buildings';
import type { Building } from '../shared/sim/state';
import { stationCue } from './sfx';

export type ZoneKind = 'tavern' | 'fiddle' | 'market' | 'hymns' | 'forge' | 'workshop' | 'herd';
export const ZONE_KINDS: readonly ZoneKind[] = ['tavern', 'fiddle', 'market', 'hymns', 'forge', 'workshop', 'herd'];
/** Which herd is heard: each its own call. */
export type Animal = 'cattle' | 'sheep' | 'goat' | 'pig' | 'hen';

export interface ZoneSource {
  kind: ZoneKind;
  x: number;
  y: number;
  /** How much noise it's making, 0 to 1. */
  strength: number;
  animal?: Animal;
}
export interface ZoneLevel {
  /** 0 (silent) to 1. */
  level: number;
  /** -1 left to 1 right. */
  pan: number;
  animal?: Animal;
}
export type ZoneMix = Record<ZoneKind, ZoneLevel>;

/** What the zones read from a snapshot (the tests build it by hand). */
export interface ZoneTown {
  calendar: { hour: number; daylight: number };
  buildings: Pick<Building, 'id' | 'def' | 'tile' | 'row' | 'status' | 'herd' | 'wide' | 'turned'>[];
  workingAt: number[];
  market: { x: number; y: number } | null;
  gathering: { kind: string } | null;
  people: { activity: string; away: unknown }[];
  raid: { phase: string } | null;
}

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A source is heard out to this many half-views from the middle of the view (a little past the edge). */
export const HEAR = 1.15;
/** The view's long side (world px) at which the zones are at their own loudness; wider is quieter, narrower louder. */
export const ZOOM_REF = 1400;
/** The quietest the zoom makes them, and the loudest. */
export const ZOOM_LEAST = 0.35;
export const ZOOM_MOST = 1.3;
/** A second source of a kind adds this share of its own level (two forges are a little louder than one). */
export const MORE_SHARE = 0.25;

/** The pens and what's heard in each. */
const ANIMAL: Readonly<Record<string, Animal>> = { cattle_pasture: 'cattle', sheep_fold: 'sheep', goat_pen: 'goat', pig_sty: 'pig', chicken_coop: 'hen' };
/** Places of worship, and how loud their singing is. */
const HYMN_PLACES: Readonly<Record<string, number>> = { wayside_shrine: 0.45, temple: 0.8, cathedral: 1 };

const evening = (h: number) => h >= 18 || h < 2;
const shopHours = (h: number) => h >= 8 && h < 18;

/** What's making a noise in the town now, where and how much. */
export function zoneSources(t: ZoneTown): ZoneSource[] {
  // (a raid on: everyone's indoors or at the walls, and the town holds its breath)
  if (t.raid) return [];
  const out: ZoneSource[] = [];
  const h = t.calendar.hour;
  const drinkers = t.people.filter((p) => p.away === null && p.activity === 'drink').length;
  const working = new Set(t.workingAt);
  const rite = t.gathering?.kind === 'rite';
  for (const b of t.buildings) {
    if (b.status !== 'done') continue;
    const def = BUILDING_BY_ID[b.def];
    if (!def) continue;
    const at = buildingCentre(b);
    const venue = def.floor?.venue;
    if (venue === 'tavern') {
      // the hubbub: a few in by day, full of an evening, and fuller for every drinker in
      const night = evening(h);
      if (h >= 10 || h < 2) out.push({ kind: 'tavern', ...at, strength: Math.min(1, (night ? 0.6 : 0.22) + drinkers * 0.08) });
      if (night || drinkers > 0) out.push({ kind: 'fiddle', ...at, strength: drinkers > 0 ? 1 : 0.7 });
    } else if (venue === 'shop' && shopHours(h)) out.push({ kind: 'market', ...at, strength: 0.35 });
    const hymn = HYMN_PLACES[b.def];
    if (hymn) {
      // (a rite: the whole town singing; of a morning, the priests at their prayers)
      const s = rite ? 1 : h >= 6 && h < 10 ? 0.6 * hymn : 0;
      if (s > 0) out.push({ kind: 'hymns', ...at, strength: s });
    }
    if (working.has(b.id)) {
      const cue = stationCue(b.def);
      // (the study's pages are the work's own sound; the camp's cooking pot is the fire's)
      if (cue === 'anvil') out.push({ kind: 'forge', ...at, strength: 1 });
      else if (cue && cue !== 'page' && b.def !== 'campfire') out.push({ kind: 'workshop', ...at, strength: 0.7 });
    }
    const animal = ANIMAL[b.def];
    if (animal && (b.herd?.head ?? 0) > 0) {
      const day = t.calendar.daylight > 0.3 ? 1 : 0.3;
      out.push({ kind: 'herd', ...at, strength: Math.min(1, 0.3 + b.herd!.head / 8) * day, animal });
    }
  }
  // market day: the square full of stalls and cries
  if (t.market) out.push({ kind: 'market', x: t.market.x, y: t.market.y, strength: 1 });
  return out;
}

/** How near the middle of the view a point is, 0 (out of hearing) to 1 (the middle). */
export function nearness(v: View, x: number, y: number): number {
  const cx = v.x + v.w / 2;
  const cy = v.y + v.h / 2;
  const reach = (HEAR * Math.max(v.w, v.h)) / 2;
  const d = Math.hypot(x - cx, y - cy) / Math.max(1, reach);
  return d >= 1 ? 0 : (1 - d) * (1 - d);
}
/** How the zoom sways the zones: zoomed out (a wide view) quieter, zoomed in louder. */
export function zoomGain(v: View): number {
  return Math.max(ZOOM_LEAST, Math.min(ZOOM_MOST, ZOOM_REF / Math.max(1, Math.max(v.w, v.h))));
}
/** Where across the screen a point is heard, -1 left to 1 right (held a little in from the ears' edges). */
export function panAt(v: View, x: number): number {
  return Math.max(-0.85, Math.min(0.85, ((x - (v.x + v.w / 2)) / Math.max(1, v.w / 2)) * 0.85));
}

/** Each kind's loudness and pan from the view: the loudest source of a kind, a little more for each other one, panned
 *  toward where they are by how much each is heard. */
export function zoneMix(sources: ZoneSource[], v: View): ZoneMix {
  const zoom = zoomGain(v);
  const mix = Object.fromEntries(ZONE_KINDS.map((k) => [k, { level: 0, pan: 0 }])) as ZoneMix;
  const sum = Object.fromEntries(ZONE_KINDS.map((k) => [k, { most: 0, rest: 0, weight: 0, pan: 0, animal: undefined as Animal | undefined }]));
  for (const s of sources) {
    const heard = s.strength * nearness(v, s.x, s.y);
    if (heard <= 0) continue;
    const k = sum[s.kind];
    if (heard > k.most) {
      k.rest += k.most;
      k.most = heard;
      k.animal = s.animal;
    } else k.rest += heard;
    k.weight += heard;
    k.pan += heard * panAt(v, s.x);
  }
  for (const kind of ZONE_KINDS) {
    const k = sum[kind];
    if (k.weight <= 0) continue;
    mix[kind] = { level: Math.min(1, (k.most + k.rest * MORE_SHARE) * zoom), pan: k.pan / k.weight, ...(k.animal ? { animal: k.animal } : {}) };
  }
  return mix;
}

/** Silence, for when the sound is off or the map isn't shown. */
export function quietZones(): ZoneMix {
  return Object.fromEntries(ZONE_KINDS.map((k) => [k, { level: 0, pan: 0 }])) as ZoneMix;
}
