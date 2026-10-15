// The war on the War tab's map (sim/conquest/conquest.ts holds the world and who holds each province): the province
// a strike is aimed at, a province changing hands, a power falling when its last province (its capital) is taken, and
// a rising power raising its banners over free land or the ruins of a fallen power. An older town without a world is
// given one, from the same draws its realm was made with.

import { FACTION_BY_ID } from '../../data/factions';
import { foundConquest, holdings, worldOf, type ConquestState } from '../conquest/conquest';
import type { ConquestWorld } from '../conquest/world';
import { realm } from '../factions';
import type { Faction, GameState } from '../state';
import { warNews, warOf } from './state';

const nameOf = (id: string) => FACTION_BY_ID[id]?.name ?? id;

/** The town's world of provinces and who holds them (founded for an older town that has none). */
export function warMap(s: GameState): { c: ConquestState; w: ConquestWorld } | null {
  if (!s.conquest) {
    const ids = realm(s).filter((f) => !FACTION_BY_ID[f.id]?.rising && !FACTION_BY_ID[f.id]?.kin).map((f) => f.id);
    s.conquest = foundConquest(s.seed, ['town', ...ids]);
  }
  const w = worldOf(s);
  return w ? { c: s.conquest, w } : null;
}

/** The province of the defender's a strike by the attacker is aimed at: one beside the attacker's land first, never
 *  the capital while the defender has another; the capital when it is all that's left. Null when the defender holds
 *  nothing on the map. */
export function strikeTarget(s: GameState, atk: string, def: string): number | null {
  const m = warMap(s);
  if (!m) return null;
  const { c, w } = m;
  const theirs = holdings(c, def);
  if (!theirs.length) return null;
  const mine = new Set(holdings(c, atk));
  const cap = theirs.find((i) => w.provinces[i].capitalOf !== null);
  const others = theirs.filter((i) => i !== cap);
  const pool = others.length ? others : theirs;
  const beside = pool.filter((i) => w.provinces[i].neighbours.some((n) => mine.has(n)));
  // (else the one nearest the attacker's own land, by its middle)
  const near = (i: number) => Math.min(1e9, ...[...mine].map((j) => Math.hypot(w.provinces[i].x - w.provinces[j].x, w.provinces[i].y - w.provinces[j].y)));
  const pick = (beside.length ? beside : pool).slice().sort((a, b) => near(a) - near(b) || a - b)[0];
  return pick ?? null;
}

/** Whether a province is its holder's capital (the province whose fall is the holder's). */
export function isCapital(s: GameState, province: number): boolean {
  const m = warMap(s);
  return !!m && m.w.provinces[province]?.capitalOf !== null;
}

/** The attacker takes a province. Its holder's last province taken, the holder falls. */
export function takeProvince(s: GameState, by: string, province: number): void {
  const m = warMap(s);
  if (!m) return;
  const { c, w } = m;
  const was = c.holder[province];
  if (was === by) return;
  c.holder[province] = by;
  const p = w.provinces[province];
  if (was && was !== 'town' && holdings(c, was).length === 0) {
    const f = realm(s).find((x) => x.id === was);
    if (f) powerFalls(s, f, by, p.name);
  } else if (was && (realm(s).find((x) => x.id === was)?.known || was === 'town') && (by === 'town' || realm(s).find((x) => x.id === by)?.known)) {
    warNews(s, `Realm news: ${by === 'town' ? 'the town' : nameOf(by)} took ${p.name} from ${was === 'town' ? 'the town' : nameOf(was)}.`, was === 'town' || by === 'town');
  }
}

/** A power has fallen: its last province taken, its lord fled or dead, its folk scattered (the victor takes some of
 *  them in). A rising power with no land of its own takes up the fallen capital: it rises in the other's place. */
export function powerFalls(s: GameState, f: Faction, by: string, where: string): void {
  if (f.stance === 'destroyed') return;
  const victor = realm(s).find((x) => x.id === by);
  if (victor && f.folk) victor.folk = Math.round((victor.folk ?? 0) + f.folk * 0.3);
  f.stance = 'destroyed';
  f.since = s.tick;
  f.host = undefined;
  f.troops = 0;
  f.folk = 0;
  const w = warOf(s);
  (w.fallen ??= []).push({ id: f.id, by, tick: s.tick });
  warNews(s, `${nameOf(f.id)} have fallen: ${where} was taken by ${by === 'town' ? 'the town' : nameOf(by)}, and their banners are torn down.`);
  // (the feuds it was in are over: sim/worldLife.ts drops a feud with a power gone)
  const m = warMap(s);
  if (!m) return;
  const heir = realm(s).find((x) => x.known && x.stance !== 'destroyed' && (FACTION_BY_ID[x.id]?.rising || FACTION_BY_ID[x.id]?.kin) && !holdings(m.c, x.id).length);
  const cap = m.c.holder.findIndex((h, i) => h === by && m.w.provinces[i].name === where);
  if (heir && cap >= 0 && by !== 'town') {
    m.c.holder[cap] = heir.id;
    warNews(s, `From the ruins of ${nameOf(f.id)}, ${nameOf(heir.id)} rise: they take ${where} for their own seat.`);
  }
}

/** A power met that holds nothing on the map raises its banners over free land: the free province farthest from the
 *  town's capital, and a free one beside it. Returns whether it found any. */
export function claimSeat(s: GameState, f: Faction): boolean {
  const m = warMap(s);
  if (!m) return false;
  const { c, w } = m;
  if (holdings(c, f.id).length) return true;
  const home = w.realms[0]?.capital ?? 0;
  const dist = (i: number) => Math.hypot(w.provinces[i].x - w.provinces[home].x, w.provinces[i].y - w.provinces[home].y);
  const free = c.holder.map((h, i) => (h === null && w.provinces[i].landmark !== 'lair' ? i : -1)).filter((i) => i >= 0).sort((a, b) => dist(b) - dist(a) || a - b);
  if (!free.length) return false;
  const seat = free[0];
  c.holder[seat] = f.id;
  const next = w.provinces[seat].neighbours.find((n) => c.holder[n] === null && w.provinces[n].landmark !== 'lair');
  if (next !== undefined) c.holder[next] = f.id;
  if (f.known) warNews(s, `Realm news: ${nameOf(f.id)} have raised their banners over ${w.provinces[seat].name}.`, false);
  return true;
}
