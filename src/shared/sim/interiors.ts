// Inside every building (the owner's pick of the content updates, the seventh): tap a home, a workshop, a study, a
// temple or a barracks and look in at a cutaway of it, as the shop and tavern already have (renderer/interior). This
// is what the sim says of it: who is inside a building and what they're about (`insideOf`: asleep in their bed, at a
// station working an order, at a desk reading, watching a play, eating at the stores, a child playing at home, a
// grown-up sitting at home of an evening), and the view of the one looked into (`lookInside`, the `lookInside`
// command; `interiorView` for the snapshot). It changes nothing in the town: looking is all.

import { BUILDING_BY_ID, type BuildingDef } from '../data/buildings';
import { CROPS } from '../data/crops';
import { ITEM_BY_ID } from '../data/items';
import { HERDS } from '../data/livestock';
import { TOPIC_BY_ID } from '../data/research';
import { buildingCentre, footprint } from './buildings';
import { stationFor } from './crafting';
import { isChild } from './social';
import { roomKind } from './castle';
import { CELL } from './land';
import type { Building, GameState, Person } from './state';
import { calendar } from './time';

/** Where someone stands inside: in bed, at the room's station or desk, by the hearth, at the table, or about the floor. */
export type InsideAt = 'bed' | 'station' | 'desk' | 'hearth' | 'table' | 'floor';

/** Buildings with no inside to look into: fields and pens, walls and gates, traps, the fire, roads and the like; the
 *  shop and tavern have their own windows. */
export function hasInside(def: BuildingDef | undefined): boolean {
  if (!def || def.never) return !!def?.seat;
  if (CROPS[def.id] || HERDS[def.id]) return false;
  if (def.hp || def.defense || def.floor) return false;
  if (/shaft|stockade|gaol|prison|stockpile|drying_rack|campfire|well|wall|gate|grate|palisade|trap|stake|caltrop|pit|mine$|quarry|derrick|pad|jetty|green|pitch|garden|yard|graveyard|shrine$|stone$|circle|totem|rift|arch$|statue$/.test(def.id)) return false;
  return true;
}

const near = (p: Person, b: Building, cells: number) => {
  const c = buildingCentre(b);
  return Math.hypot(p.x - c.x, p.y - c.y) <= cells * CELL;
};

/** The building someone is inside (or at work in), and where in it; null when they're out. */
export function insideOf(s: GameState, p: Person): { building: number; at: InsideAt } | null {
  if (p.away !== null && p.away !== undefined) return null;
  const t = p.task;
  const byId = (id: number | null | undefined) => (id == null ? undefined : s.buildings.find((b) => b.id === id && b.status === 'done'));
  if (t?.type === 'sleep' && p.activity === 'sleep') {
    const b = byId(t.building);
    if (b && near(p, b, 3)) return { building: b.id, at: 'bed' };
  }
  if (p.activity === 'walk') return null;
  if (t?.type === 'craft' && t.phase === 'work') {
    const o = s.crafting.find((q) => q.id === t.order);
    const def = o && ITEM_BY_ID[o.item];
    const b = def && stationFor(s, def);
    if (b && near(p, b, 3)) return { building: b.id, at: 'station' };
  }
  if (t?.type === 'research' && t.station != null) {
    const b = byId(t.station);
    if (b && near(p, b, 3)) return { building: b.id, at: 'desk' };
  }
  if (t?.type === 'lesson' && p.activity === 'research' && t.building != null) {
    const b = byId(t.building);
    if (b) return { building: b.id, at: 'desk' };
  }
  if (t?.type === 'relax' && p.activity === 'watch') {
    const b = byId(t.building);
    if (b) return { building: b.id, at: 'floor' };
  }
  if (t?.type === 'eat' && p.activity === 'eat') {
    const b = byId(t.building);
    if (b && near(p, b, 2.5) && hasInside(BUILDING_BY_ID[b.def])) return { building: b.id, at: 'table' };
  }
  // at home: a child playing, a grown-up sitting by the hearth or at the table, of an idle hour near the door
  const home = byId(p.bed);
  if (home && near(p, home, 2.5) && (p.activity === 'idle' || p.activity === 'sit' || p.activity === 'play')) {
    if (isChild(p)) return { building: home.id, at: 'floor' };
    const evening = calendar(s.tick).hour >= 17 || calendar(s.tick).hour < 7;
    return { building: home.id, at: evening ? 'hearth' : 'table' };
  }
  return null;
}

/** Look into a building (null to come out again): the shop's and tavern's own windows aside. */
export function lookInside(s: GameState, building: number | null): boolean {
  if (building === null) {
    s.lookingInside = undefined;
    return true;
  }
  const b = s.buildings.find((q) => q.id === building && q.status === 'done');
  // (a castle's or a hold's own rooms are seen into on the map already)
  if (!b || !hasInside(BUILDING_BY_ID[b.def]) || roomKind(s, BUILDING_BY_ID[b.def])) return false;
  s.lookingInside = b.id;
  return true;
}

export interface InsideView {
  id: number;
  name: string;
  /** Who's home: their place inside, what they're about, a child. */
  at: InsideAt;
  activity: string;
  doing: string;
  child: boolean;
}

export interface InteriorView {
  building: number;
  def: string;
  name: string;
  /** Its footprint (cells): the room is drawn to its shape. */
  w: number;
  d: number;
  /** Beds it holds (a home), and how many are taken. */
  beds: number;
  /** Who's inside now, and who lives or works here but is out (and what they're at). */
  inside: InsideView[];
  out: { name: string; doing: string }[];
  /** What's being made here (a workshop's orders) or studied (a station's topic). */
  making: { name: string; done: number }[];
  studying: string | null;
  owner: string | null;
  night: boolean;
  hour: number;
}

export function interiorView(s: GameState, doing: (p: Person) => string): InteriorView | null {
  if (s.lookingInside === undefined) return null;
  const b = s.buildings.find((q) => q.id === s.lookingInside && q.status === 'done');
  const def = b && BUILDING_BY_ID[b.def];
  if (!b || !def) return null;
  const f = footprint(b);
  const inside: InsideView[] = [];
  const out: { name: string; doing: string }[] = [];
  for (const p of s.people) {
    const where = insideOf(s, p);
    if (where?.building === b.id) inside.push({ id: p.id, name: p.name, at: where.at, activity: p.activity, doing: doing(p), child: isChild(p) });
    else if (p.bed === b.id || b.operator === p.id) out.push({ name: p.name, doing: p.away !== null && p.away !== undefined ? 'away' : doing(p) });
  }
  const making = s.crafting
    .filter((o) => {
      const it = ITEM_BY_ID[o.item];
      return it && stationFor(s, it)?.id === b.id;
    })
    .map((o) => ({ name: ITEM_BY_ID[o.item].name, done: Math.max(0, Math.min(1, (o.made + o.progress) / Math.max(1, o.count))) }));
  const studier = s.people.find((p) => p.task?.type === 'research' && p.task.station === b.id);
  const topic = studier?.task?.type === 'research' && studier.task.topic ? TOPIC_BY_ID[studier.task.topic]?.name ?? null : null;
  const owner = b.owner !== undefined ? s.people.find((p) => p.id === b.owner)?.name ?? null : null;
  const cal = calendar(s.tick);
  return {
    building: b.id,
    def: def.id,
    name: b.homeName ?? def.name,
    w: f.w,
    d: f.h,
    beds: def.housing ?? 0,
    inside,
    out,
    making,
    studying: topic,
    owner,
    night: cal.hour >= 20 || cal.hour < 6,
    hour: cal.hour,
  };
}
