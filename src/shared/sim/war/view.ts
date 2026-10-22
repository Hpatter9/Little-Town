// What the War tab sees of the seasons of war: the map of provinces (who holds each, the armies marching over it),
// the season, the wars between the powers, the campaigns and the town's part in them, the council's word on each
// power, a siege coming, the occupation, the recap, the war dead and those they left, and the war's news.

import { FORTS, LANDMARKS, TIERS } from '../../data/conquest';
import { FACTION_BY_ID, STANCE_NAME } from '../../data/factions';
import { SEASON_LINE, type WarSeason } from '../../data/war';
import { holdings, worldOf } from '../conquest/conquest';
import { powersOnMap } from '../conquest/rivals';
import { provinceYield, type ConquestWorld } from '../conquest/world';
import { realm } from '../factions';
import type { GameState } from '../state';
import { calendar, DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_HOUR, calendarOf } from '../time';
import { campaignDest } from './campaigns';
import { councilLine, waysOf } from './council';
import { warLossLine } from './memory';
import { warSeason } from './state';

export interface ProvinceView {
  id: number;
  name: string;
  land: string;
  x: number;
  y: number;
  neighbours: number[];
  /** The holder's realm id ('town', a faction id), or null. */
  holder: string | null;
  holderName: string;
  capitalOf: string | null;
  tier: string;
  fort: string;
  /** The settlement tier and fort as numbers (0 up), for the map's pictures. */
  tierN: number;
  fortN: number;
  landmark: string | null;
  yields: { coins: number; recruits: number; material: string; amount: number };
  coast: boolean;
  /** An occupier's garrison standing in it (the town's capital, while the town is occupied). */
  garrison: number;
}
export interface MarchView {
  realm: string;
  from: number;
  to: number;
  hours: number;
  strength: number;
  /** How far along (0 to 1), and what it is: a power's border march, a war's strike (a harvest raid in autumn), or the
   *  town's own party (with an ally's host, or its own). */
  t: number;
  kind: 'border' | 'strike' | 'harvest' | 'town';
}
export interface CampaignView {
  id: number;
  title: string;
  by: string;
  against: string;
  where: string;
  harvest: boolean;
  /** Called and waiting for the answer; marching (the town's party on the road); fighting; won or lost; the town
   *  stayed out or sent coin; the ally marched alone. */
  state: 'called' | 'open' | 'marching' | 'won' | 'lost' | 'refused' | 'coin' | 'alone';
  /** The Board's destination while a party may still set out. */
  dest: string | null;
  party: string[];
}
export interface WarView {
  realms: { id: string; name: string; provinces: number; capital: number; stance: string }[];
  rivalArmies: MarchView[];
  side: number;
  cells: string;
  /** Each cell's province, one character a cell (its id + 33; the sea one less): see `ownerAt`. */
  owners: string;
  provinces: ProvinceView[];
  /** The town's capital province. */
  home: number;
  season: { war: WarSeason; name: string; line: string; days: number };
  wars: { a: string; b: string; days: number }[];
  campaigns: CampaignView[];
  council: { id: string; name: string; stance: string; line: string }[];
  ways: string;
  siege: { by: string; hours: number; size: number } | null;
  sieges: { lost: number; held: number };
  occupation: { by: string; days: number; garrison: number; resistance: number; taxed: number } | null;
  recap: { tick: number; title: string; lines: string[]; won: boolean } | null;
  dead: { name: string; war: string; where: string; day: number }[];
  bereaved: { name: string; line: string }[];
  memorials: string[];
  fallen: { name: string; by: string; day: number }[];
  news: { day: number; text: string }[];
  tally: { joined: number; won: number; lost: number; spoils: number };
}

/** The owner grid as a string (made once a world): a cell's province id + 33 as a character, the sea one less. */
const OWNER_BASE = 33;
const ownerStrings = new WeakMap<ConquestWorld, string>();
function ownersOf(w: ConquestWorld): string {
  let s = ownerStrings.get(w);
  if (!s) {
    s = String.fromCharCode(...Array.from(w.owner, (o) => (o < 0 ? OWNER_BASE - 1 : OWNER_BASE + o)));
    ownerStrings.set(w, s);
  }
  return s;
}
export const ownerAt = (v: Pick<WarView, 'owners'>, i: number): number => v.owners.charCodeAt(i) - OWNER_BASE;

const nameOf = (id: string, town: string) => (id === 'town' ? town : FACTION_BY_ID[id]?.name ?? id);
const day = (tick: number) => calendar(tick).day;

export function warView(s: GameState): WarView | null {
  const c = s.conquest;
  const w = worldOf(s);
  if (!c || !w) return null;
  const town = s.townName ?? 'The town';
  const fs = realm(s);
  const war = s.war;
  const occ = war?.occupation ?? null;
  const home = w.realms[0]?.capital ?? 0;
  const provinces: ProvinceView[] = w.provinces.map((p) => {
    const holder = c.holder[p.id] ?? null;
    return {
      id: p.id, name: p.name, land: p.land, x: p.x, y: p.y, neighbours: p.neighbours, holder, holderName: holder ? nameOf(holder, town) : 'Free',
      capitalOf: p.capitalOf === null ? null : w.realms[p.capitalOf].id, tier: TIERS[p.tier].name, fort: FORTS[p.fort].name, tierN: p.tier, fortN: p.fort,
      landmark: p.landmark ? LANDMARKS[p.landmark].name : null, yields: provinceYield(p), coast: p.coast, garrison: occ && p.id === home ? occ.garrison : 0,
    };
  });
  // the armies on the map: the powers' border marches, the wars' strikes, the town's own parties
  const marches: MarchView[] = (c.rivalArmies ?? []).map((a) => ({ realm: a.realm, from: a.from, to: a.to, hours: Math.max(0, Math.ceil((a.arrive - s.tick) / TICKS_PER_HOUR)), strength: Math.round(a.strength), t: share(s.tick, a.start ?? a.arrive - 12 * TICKS_PER_HOUR, a.arrive), kind: 'border' }));
  for (const m of s.marches ?? []) {
    const camp = m.camp !== undefined ? war?.campaigns.find((x) => x.id === m.camp) : undefined;
    if (!camp || camp.province === null || camp.done) continue;
    const from = nearestOf(c.holder, w, camp.by, camp.province);
    if (from === null) continue;
    marches.push({ realm: camp.by, from, to: camp.province, hours: Math.max(0, Math.ceil((m.end - s.tick) / TICKS_PER_HOUR)), strength: m.size, t: share(s.tick, m.start, m.end), kind: camp.harvest ? 'harvest' : 'strike' });
  }
  for (const camp of war?.campaigns ?? []) {
    if (camp.done || camp.call?.party === undefined || camp.province === null) continue;
    const e = s.expeditions.find((x) => x.id === camp.call!.party);
    if (!e) continue;
    const t = e.phase === 'out' ? 0.15 + 0.7 * (e.elapsed / Math.max(1, e.outTicks)) : 0.9;
    marches.push({ realm: 'town', from: home, to: camp.province, hours: 0, strength: e.members.length, t, kind: 'town' });
  }
  const cal = calendarOf(s);
  const season = warSeason(s);
  const campaigns: CampaignView[] = (war?.campaigns ?? []).filter((x) => x.call || x.by === 'town').map((x) => {
    const where = x.province !== null ? w.provinces[x.province]?.name ?? '?' : FACTION_BY_ID[x.against]?.stronghold ?? 'their land';
    const call = x.call;
    const out = call?.party !== undefined && s.expeditions.some((e) => e.id === call.party);
    const state: CampaignView['state'] = x.done ? (call?.party !== undefined ? x.done : 'alone') : out ? 'marching' : !call || call.answer === null ? 'called' : call.answer === 'coin' ? 'coin' : call.answer === 'refuse' ? (s.tick < call.until ? 'refused' : 'alone') : 'open';
    const party = (call?.members ?? []).map((id) => s.people.find((p) => p.id === id)?.name).filter((n): n is string => !!n);
    const open = !x.done && call && call.answer !== 'coin' && call.party === undefined && s.tick < call.until;
    return {
      id: x.id, title: x.harvest ? `A harvest raid on ${nameOf(x.against, town)}` : x.by === 'town' ? `The town's war on ${where}` : `${nameOf(x.by, town)} on ${where}`,
      by: nameOf(x.by, town), against: nameOf(x.against, town), where, harvest: x.harvest, state, dest: open ? campaignDest(x.id) : null, party,
    };
  });
  const siege = war?.siege ? fs.find((f) => f.id === war.siege!.by) : undefined;
  return {
    realms: [...w.realms.map((r) => r.id), ...powersOnMap(c).filter((id) => !w.realms.some((r) => r.id === id))].map((id) => {
      const f = fs.find((x) => x.id === id);
      const cap = w.realms.find((r) => r.id === id)?.capital ?? holdings(c, id)[0] ?? 0;
      return { id, name: nameOf(id, town), provinces: c.holder.filter((h) => h === id).length, capital: cap, stance: id === 'town' ? 'the town' : f?.stance ?? 'neutral' };
    }),
    rivalArmies: marches,
    side: w.side,
    cells: w.cells,
    owners: ownersOf(w),
    provinces,
    home,
    season: { war: season, name: cal.season[0].toUpperCase() + cal.season.slice(1), line: SEASON_LINE[season], days: DAYS_PER_SEASON - cal.dayOfSeason + 1 },
    wars: (s.feuds ?? []).filter((x) => fs.find((f) => f.id === x.a)?.known && fs.find((f) => f.id === x.b)?.known).map((x) => ({ a: nameOf(x.a, town), b: nameOf(x.b, town), days: Math.max(0, Math.floor((s.tick - x.since) / TICKS_PER_DAY)) })),
    campaigns,
    council: fs.filter((f) => f.known).map((f) => ({ id: f.id, name: nameOf(f.id, town), stance: STANCE_NAME[f.stance], line: councilLine(s, f) })),
    ways: waysOf(s).line,
    siege: siege?.host ? { by: nameOf(siege.id, town), hours: Math.max(0, Math.round((siege.host.at - s.tick) / TICKS_PER_HOUR)), size: siege.host.size } : null,
    sieges: { lost: war?.sieges?.lost ?? 0, held: war?.sieges?.held ?? 0 },
    occupation: occ ? { by: nameOf(occ.by, town), days: Math.floor((s.tick - occ.since) / TICKS_PER_DAY), garrison: occ.garrison, resistance: Math.min(100, Math.round(occ.resistance)), taxed: occ.taxed } : null,
    recap: war?.recap ? { ...war.recap, lines: [...war.recap.lines] } : null,
    dead: (war?.dead ?? []).slice(-20).reverse().map((d) => ({ name: d.name, war: d.war, where: d.where, day: day(d.tick) })),
    bereaved: s.people.filter((p) => p.warLoss).map((p) => ({ name: p.name, line: warLossLine(p)! })),
    memorials: war?.memorials ?? [],
    fallen: (war?.fallen ?? []).map((x) => ({ name: nameOf(x.id, town), by: nameOf(x.by, town), day: day(x.tick) })),
    news: (war?.news ?? []).slice(-12).reverse().map((n) => ({ day: day(n.tick), text: n.text })),
    tally: { joined: war?.joined ?? 0, won: war?.won ?? 0, lost: war?.lost ?? 0, spoils: war?.spoils ?? 0 },
  };
}

const share = (now: number, from: number, to: number) => Math.max(0, Math.min(1, (now - from) / Math.max(1, to - from)));

/** The attacker's province nearest a target (where its host sets out from on the map), or null. */
function nearestOf(holder: (string | null)[], w: ConquestWorld, id: string, to: number): number | null {
  let best: number | null = null;
  let far = Infinity;
  for (let i = 0; i < holder.length; i++) {
    if (holder[i] !== id) continue;
    const d = Math.hypot(w.provinces[i].x - w.provinces[to].x, w.provinces[i].y - w.provinces[to].y);
    if (d < far) {
      far = d;
      best = i;
    }
  }
  return best;
}
