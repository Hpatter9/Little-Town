// The living world map (the owner's pick): the realm goes on beyond the town. The powers fall out with each other and
// make peace (`s.feuds`), and a power at feud sends its host marching on the other's stronghold, which the map shows
// moving and which bleeds the loser's troops and town; a power that trades with the town sends a caravan down the road
// each day, which bandits may rob unless the town keeps guards; a war host coming for the town is seen marching for
// the day before it arrives, and an envoy riding in. The rolls are the seed's own; off with the autopilot.

import { hashSeed, mixSeed } from '../rng';
import { FACTION_BY_ID, STRONGHOLD_SPOTS } from '../data/factions';
import { MAP_HOME } from '../data/worldMap';
import { HOST_WARNING_HOURS } from '../data/factions';
import { realm } from './factions';
import { routesOnMap, wagonsOnMap } from './markets';
import { guardsOf } from './treasury';
import { notify, type GameState } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

export interface Feud {
  a: string;
  b: string;
  since: number;
}
export interface March {
  kind: 'feud' | 'trade';
  from: string;
  to: string;
  start: number;
  end: number;
  size: number;
}

/** A feud begins on this many mornings in a hundred (two at most at once), and ends on that many. */
export const FEUD_START = 12;
export const FEUD_END = 10;
export const FEUDS_MOST = 2;
/** A host marching between powers takes this long; its strike costs the loser this share of its troops and folk. */
export const MARCH_HOURS = 12;
export const STRIKE_LOSS = 0.15;
/** A trade caravan takes this long on the road; bandits rob one this often (half as often with two guards or more). */
export const TRADE_HOURS = 10;
export const ROAD_ROBBED = 0.15;
/** The hour each day the realm moves. */
export const WORLD_HOUR = 10;

const roll = (s: GameState, ...salts: number[]) => (mixSeed(hashSeed(s.seed), 0x30e1d, s.tick, ...salts) >>> 0) / 4294967296;
const nameOf = (id: string) => FACTION_BY_ID[id]?.name ?? id;

/** Hourly from sim.ts. */
export function worldHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0 || !s.factions?.length) return;
  arrive(s);
  if (calendar(s.tick).hour !== WORLD_HOUR) return;
  const fs = realm(s).filter((f) => f.stance !== 'destroyed');
  const feuds = (s.feuds ??= []);
  // feuds end, and begin
  for (const f of [...feuds]) {
    const gone = !fs.some((x) => x.id === f.a) || !fs.some((x) => x.id === f.b);
    if (gone || roll(s, hashSeed(f.a + f.b), 1) * 100 < FEUD_END) {
      feuds.splice(feuds.indexOf(f), 1);
      if (!gone && known(s, f.a, f.b)) notify(s, `Realm news: ${nameOf(f.a)} and ${nameOf(f.b)} have made peace.`);
    }
  }
  if (feuds.length < FEUDS_MOST && fs.length >= 2 && roll(s, 2) * 100 < FEUD_START) {
    const i = Math.floor(roll(s, 3) * fs.length);
    const j = (i + 1 + Math.floor(roll(s, 4) * (fs.length - 1))) % fs.length;
    const [a, b] = [fs[i].id, fs[j].id];
    if (a !== b && !feuds.some((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a))) {
      feuds.push({ a, b, since: s.tick });
      if (known(s, a, b)) notify(s, `Realm news: ${nameOf(a)} and ${nameOf(b)} have fallen out. There will be war between them.`);
    }
  }
  // each feud sends a host one way or the other
  const marches = (s.marches ??= []);
  for (const f of feuds) {
    const [from, to] = roll(s, hashSeed(f.a + f.b), 5) < 0.5 ? [f.a, f.b] : [f.b, f.a];
    const host = fs.find((x) => x.id === from);
    if (!host || host.troops < 4) continue;
    marches.push({ kind: 'feud', from, to, start: s.tick, end: s.tick + MARCH_HOURS * TICKS_PER_HOUR, size: Math.round(host.troops * 0.4) });
  }
  // the day's trade comes down the road from each power that trades with the town
  for (const f of fs) if (f.stance === 'trade' || f.stance === 'alliance') marches.push({ kind: 'trade', from: f.id, to: 'home', start: s.tick, end: s.tick + TRADE_HOURS * TICKS_PER_HOUR, size: 1 });
}

const known = (s: GameState, ...ids: string[]) => ids.every((id) => s.factions?.find((f) => f.id === id)?.known);

/** Marches that reach where they were going. */
function arrive(s: GameState): void {
  const marches = s.marches ?? [];
  const fs = realm(s);
  for (const m of [...marches]) {
    if (s.tick < m.end) continue;
    marches.splice(marches.indexOf(m), 1);
    if (m.kind === 'feud') {
      const atk = fs.find((f) => f.id === m.from);
      const def = fs.find((f) => f.id === m.to);
      if (!atk || !def || def.stance === 'destroyed') continue;
      const won = roll(s, hashSeed(m.from), 6) < atk.troops / Math.max(1, atk.troops + def.troops);
      const loser = won ? def : atk;
      loser.troops = Math.max(0, Math.round(loser.troops * (1 - STRIKE_LOSS)));
      if (loser.folk) loser.folk = Math.max(1, Math.round(loser.folk * (1 - STRIKE_LOSS / 2)));
      if (known(s, m.from, m.to)) notify(s, `Realm news: the host of ${nameOf(m.from)} ${won ? `broke the walls of ${nameOf(m.to)}'s stronghold` : `was thrown back from ${nameOf(m.to)}'s stronghold`}.`);
    } else {
      const bandits = fs.find((f) => f.id === 'brotherhood' && f.stance !== 'destroyed' && f.id !== m.from);
      const guarded = guardsOf(s).length >= 2;
      if (bandits && roll(s, hashSeed(m.from), 7) < ROAD_ROBBED * (guarded ? 0.5 : 1)) {
        const lost = Math.min(s.coins ?? 0, 10);
        s.coins = (s.coins ?? 0) - lost;
        notify(s, `Bandits of the Red Brotherhood robbed the trade caravan from ${nameOf(m.from)} on the road: ${lost} coins of the day's trade lost.${guarded ? '' : ' (Guards on the roads would help.)'}`);
      }
    }
  }
}

/** What the world map shows moving: the marches, a host coming for the town, an envoy riding in; and the feuds. */
export interface WorldView {
  marches: { kind: 'feud' | 'trade' | 'host' | 'envoy' | 'wagon'; from: { x: number; y: number }; to: { x: number; y: number }; t: number; label: string; size: number }[];
  feuds: { a: string; b: string; at: { x: number; y: number } }[];
  /** The trade house's open routes (sim/markets.ts), drawn faintly from home. */
  routes: { to: { x: number; y: number }; name: string }[];
}

export function worldView(s: GameState): WorldView {
  const spot = (id: string) => (id === 'home' ? MAP_HOME : STRONGHOLD_SPOTS[id]);
  const out: WorldView = { marches: [], feuds: [], routes: routesOnMap(s) };
  for (const w of wagonsOnMap(s)) out.marches.push({ kind: 'wagon', from: w.from, to: w.to, t: w.t, label: w.label, size: 1 });
  for (const m of s.marches ?? []) {
    if (!known(s, m.from) || (m.to !== 'home' && !known(s, m.to))) continue;
    const from = spot(m.from);
    const to = spot(m.to);
    if (!from || !to) continue;
    const t = Math.max(0, Math.min(1, (s.tick - m.start) / (m.end - m.start)));
    out.marches.push({ kind: m.kind, from, to, t, label: m.kind === 'feud' ? `A host of ${nameOf(m.from)} marching on ${nameOf(m.to)} (${m.size})` : `A trade caravan from ${nameOf(m.from)}`, size: m.size });
  }
  for (const f of s.factions ?? []) {
    if (!f.host || !f.known) continue;
    const from = spot(f.id);
    if (!from) continue;
    const span = HOST_WARNING_HOURS * TICKS_PER_HOUR;
    const t = Math.max(0, Math.min(1, 1 - (f.host.at - s.tick) / span));
    out.marches.push({ kind: 'host', from, to: MAP_HOME, t, label: `${nameOf(f.id)}'s war host (${f.host.size}), marching on the town`, size: f.host.size });
  }
  const r = s.envoyRider;
  if (r && !r.leaving && spot(r.faction)) out.marches.push({ kind: 'envoy', from: spot(r.faction)!, to: MAP_HOME, t: 0.92, label: `${r.name}, envoy of ${nameOf(r.faction)}`, size: 1 });
  for (const f of s.feuds ?? []) {
    if (!known(s, f.a, f.b)) continue;
    const a = spot(f.a);
    const b = spot(f.b);
    if (a && b) out.feuds.push({ a: nameOf(f.a), b: nameOf(f.b), at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
  }
  return out;
}
