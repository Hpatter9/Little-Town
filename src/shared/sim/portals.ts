// Portals to other worlds (data/portals.ts). A finished Portal Arch opens a realm the town hasn't reached (the seed
// picks which); from day `RIFT_FROM_DAY` a rift may tear open by itself on a morning and open another. Each open realm
// (`s.portals`) is a small map of `SITES` sites made from the seed (`makeSites`: names, places on the map, the
// creatures by `SITE_TIERS`, the last the heart with the realm's boss). The next site unexplored is a place on the
// Expedition Board (`portal:<realm>`, a `clear` trip the parties choose for themselves); a party that wins there
// explores it (`portalHome`, from `comeHome`): its loot (doubled in the Underworld) and coins, the realm's rule on
// whoever went (the Feywild's years gone or given back, a blessing, or one who stays; the Underworld's drain; the
// Elemental Planes' burns and frostbite), and the realm stirred. Past `RISE_AT` (never within `RISE_GAP_DAYS`),
// things come out of the portal into the town (a raid begun at it). Breaking the heart calms it: it stirs no more and
// stays open for its riches. Only with the autopilot on; the rolls are the seed's own.

import {
  ELEM_HURT,
  FAE_AGE,
  FAE_BLESS,
  FAE_STAYS,
  PORTAL_ARCH,
  PORTAL_RIFT,
  REALM_DEFS,
  REALMS,
  RIFT_DAILY,
  RIFT_FROM_DAY,
  RIFT_HOUR,
  RIFT_STIR,
  RISE_AT,
  RISE_GAP_DAYS,
  RISE_SHARE,
  SITE_TIERS,
  SITES,
  STIR_PER_TRIP,
  STIR_SETTLES,
  UNDER_DRAIN,
  UNDER_KEEPS,
  type RealmId,
} from '../data/portals';
import type { Destination } from '../data/expeditions';
import type { Stock } from '../data/materials';
import { beastsOf, groupOf } from '../data/menagerie';
import { RAID_KIND_BY_ID } from '../data/raids';
import { SKILLS } from '../data/skills';
import { hashSeed, Rng } from '../rng';
import { grownAt } from './ageing';
import { buildingCentre, depositNear } from './buildings';
import { killPerson } from './health';
import { woundPerson } from './injuries';
import { findSpot } from './planner';
import { raidBudget, startRaid } from './raids';
import { addStock, earn, maxHp, notify, type Building, type GameState, type Person, type Prompt } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds, gainSkill } from './townsfolk';

export interface PortalSite {
  name: string;
  /** Where it lies on the realm's map, as shares of its width and height. */
  x: number;
  y: number;
  /** Who guards it (enemy id to count). */
  foes: Record<string, number>;
  explored: boolean;
}

export interface Portal {
  realm: RealmId;
  /** The arch or rift it opens from. */
  building: number;
  rift: boolean;
  opened: number;
  sites: PortalSite[];
  stir: number;
  rose?: number;
  /** The heart broken: it stirs no more. */
  calm: boolean;
  /** What's been found or befallen, newest last. */
  log: string[];
  /** Trips that came home. */
  trips: number;
}

export const PORTAL_DEST = 'portal:';
export const isPortalDest = (id: string) => id.startsWith(PORTAL_DEST);
const shuffle = <T>(g: Rng, a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = g.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/** The realm's name mid-sentence ("into the Feywild"), and a sentence's first letter raised. */
const inName = (realm: RealmId) => REALM_DEFS[realm].name.replace(/^The /, 'the ');
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const roll = (s: GameState, ...salt: (number | string)[]) => new Rng(hashSeed(`${s.seed}:portal:${salt.join(':')}`));
const note = (pt: Portal, line: string) => {
  pt.log.push(line);
  if (pt.log.length > 10) pt.log.splice(0, pt.log.length - 10);
};
export const portalOf = (s: GameState, realm: RealmId) => (s.portals ?? []).find((p) => p.realm === realm);
export const nextSite = (pt: Portal) => pt.sites.find((x) => !x.explored);
const portalBuilding = (s: GameState, pt: Portal) => s.buildings.find((b) => b.id === pt.building && b.status === 'done');

/** A realm's sites, from the seed: a winding way across its map, the heart at its far end. */
export function makeSites(seed: string | number, realm: RealmId): PortalSite[] {
  const def = REALM_DEFS[realm];
  const g = new Rng(hashSeed(`${seed}:portal-sites:${realm}`));
  const names = [...def.sites.slice(0, def.sites.length - 1)];
  shuffle(g, names);
  return Array.from({ length: SITES }, (_, i) => {
    const heart = i === SITES - 1;
    const pool = beastsOf(def.habitats, SITE_TIERS[i] as [number, number]);
    const beast = pool.length ? g.pick(pool) : null;
    const foes: Record<string, number> = beast ? { ...groupOf(beast) } : {};
    if (i >= 3 && pool.length > 1) {
      const more = g.pick(pool);
      foes[more.id] = (foes[more.id] ?? 0) + 1;
    }
    if (heart) foes[def.boss] = 1;
    const t = i / (SITES - 1);
    return {
      name: heart ? def.sites[def.sites.length - 1] : names[i % names.length],
      x: 0.1 + 0.8 * t,
      y: 0.5 + (i % 2 ? -1 : 1) * (0.12 + g.next() * 0.2) * (heart ? 0 : 1),
      foes,
      explored: false,
    };
  });
}

/** Open a realm through a building (an arch, or a rift). */
export function openPortal(s: GameState, realm: RealmId, b: Building, rift: boolean): Portal {
  const def = REALM_DEFS[realm];
  const pt: Portal = { realm, building: b.id, rift, opened: s.tick, sites: makeSites(s.seed, realm), stir: 0, calm: false, log: [], trips: 0 };
  (s.portals ??= []).push(pt);
  note(pt, rift ? `A rift tore open into ${inName(realm)}.` : `The arch opened onto ${inName(realm)}.`);
  const title = rift ? `A rift into ${inName(realm)}` : `The arch opens onto ${inName(realm)}`;
  const story = `${rift ? 'Without warning the air over the ground tears like cloth, and will not close. ' : ''}${def.opens} ${def.rule} Parties may go through to explore it, one place at a time, down to its heart; but every trip stirs what lives there, and in time things will come back out.`;
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title,
    text: def.opens,
    story,
    picture: def.backdrop,
    who: s.mainId,
    options: ['Let them explore it'],
    defaultOption: 0,
    expiresTick: s.tick + 8 * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  notify(s, `${title}!`, true);
  return pt;
}

/** The realms not yet open, the seed's order. */
function unopened(s: GameState): RealmId[] {
  const open = new Set((s.portals ?? []).map((p) => p.realm));
  const order = [...REALMS];
  shuffle(roll(s, 'order'), order);
  return order.filter((r) => !open.has(r));
}

/** A rift tears open: a building of its own on open ground. */
export function tearRift(s: GameState, realm: RealmId): Portal | null {
  const spot = findSpot(s, { id: PORTAL_RIFT, name: 'Planar Rift', layer: 'mid', width: 2, cost: {}, buildSeconds: 1, purpose: '' });
  if (!spot || spot.wild) return null;
  const b: Building = { id: s.nextId++, def: PORTAL_RIFT, tile: spot.x, row: spot.y, status: 'done', delivered: {}, progress: 1, store: {}, builtAt: s.tick };
  s.buildings.push(b);
  return openPortal(s, realm, b, true);
}

/** Each hour: arches open their realms; a rift may tear; the stir settles, and past `RISE_AT` things come out. */
export function portalsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false) return;
  const hour = calendar(s.tick).hour;
  const day = Math.floor(s.tick / TICKS_PER_DAY) + 1;
  // an arch finished with no realm on it opens one
  for (const b of s.buildings) {
    if (b.def !== PORTAL_ARCH || b.status !== 'done' || (s.portals ?? []).some((p) => p.building === b.id)) continue;
    const realm = unopened(s)[0];
    if (realm) openPortal(s, realm, b, false);
  }
  // a rift, now and then, while none stands
  if (hour === RIFT_HOUR && day >= RIFT_FROM_DAY && !(s.portals ?? []).some((p) => p.rift)) {
    const realm = unopened(s)[0];
    if (realm && roll(s, 'rift', day).chance(RIFT_DAILY)) tearRift(s, realm);
  }
  for (const pt of s.portals ?? []) {
    const b = portalBuilding(s, pt);
    if (!b) continue;
    if (hour === RIFT_HOUR) pt.stir = Math.max(0, pt.stir - STIR_SETTLES);
    if (pt.rift && !pt.calm) pt.stir += (RIFT_STIR * STIR_SETTLES) / 24;
    if (!pt.calm && pt.stir >= RISE_AT && !s.raid && (pt.rose === undefined || s.tick - pt.rose >= RISE_GAP_DAYS * TICKS_PER_DAY)) risePortal(s, pt, b);
  }
}

/** Things come out of the portal into the town. */
export function risePortal(s: GameState, pt: Portal, b: Building): boolean {
  const def = REALM_DEFS[pt.realm];
  const kind = RAID_KIND_BY_ID[def.raid];
  if (!kind || !Object.keys(kind.enemies).length) return false;
  startRaid(s, kind, Math.max(6, raidBudget(s) * RISE_SHARE), roll(s, 'rise', s.tick), buildingCentre(b));
  pt.stir = Math.max(0, pt.stir - RISE_AT);
  pt.rose = s.tick;
  note(pt, `Things came out of ${inName(pt.realm)} into the town.`);
  notify(s, `The portal flares: things out of ${inName(pt.realm)} pour into the town!`, true);
  return true;
}

/* ------------------------------------------------------------ the trips */

export function portalDestination(s: GameState, id: string): Destination | undefined {
  if (!isPortalDest(id)) return undefined;
  const pt = portalOf(s, id.slice(PORTAL_DEST.length) as RealmId);
  if (!pt || !portalBuilding(s, pt)) return undefined;
  const site = nextSite(pt);
  if (!site) return undefined;
  const def = REALM_DEFS[pt.realm];
  const n = pt.sites.indexOf(site);
  const heart = n === SITES - 1;
  return {
    id,
    name: `${cap(site.name)}, in ${inName(pt.realm)}`,
    type: 'clear',
    outSeconds: 45,
    workSeconds: 30,
    secondsPerUnit: 6,
    loot: {},
    threats: Object.keys(site.foes).join(', '),
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: site.foes, weight: 1 }] },
    recommendedParty: 3 + Math.floor(n / 2),
    scenery: 'cave',
    description: `${heart ? `The heart of ${inName(pt.realm)}, where its master waits. Broken, the realm will stir no more.` : `Through the portal, ${site.name} (${n + 1} of ${SITES}).`} ${def.rule}`,
  };
}
export const portalDestinations = (s: GameState): Destination[] =>
  (s.portals ?? []).map((p) => portalDestination(s, `${PORTAL_DEST}${p.realm}`)).filter((d): d is Destination => !!d);

const between = (g: Rng, [lo, hi]: [number, number]) => g.int(lo, hi);

/** A party home from a realm: won, the site is explored and its riches come home; the realm's rule falls on them. */
export function portalHome(s: GameState, dest: string, party: Person[], cleared: boolean, at: { x: number; y: number }): void {
  if (!isPortalDest(dest)) return;
  const pt = portalOf(s, dest.slice(PORTAL_DEST.length) as RealmId);
  if (!pt) return;
  const def = REALM_DEFS[pt.realm];
  const g = roll(s, 'home', pt.realm, s.tick);
  pt.trips++;
  if (!pt.calm) pt.stir += STIR_PER_TRIP;
  const lines: string[] = [];
  const site = nextSite(pt);
  if (cleared && site) {
    site.explored = true;
    const heart = !nextSite(pt);
    const twice = pt.realm === 'underworld' ? 2 : 1;
    const loot: Stock = {};
    for (const [m, r] of Object.entries(def.loot)) addStock(loot, m as keyof Stock, between(g, r!) * twice);
    if (heart) for (const [m, n] of Object.entries(def.heart)) addStock(loot, m as keyof Stock, n! * twice);
    depositNear(s, at, loot);
    const coins = between(g, def.coins) * twice * (heart ? 3 : 1);
    s.coins = (s.coins ?? 0) + coins;
    earn(s, 'events', coins);
    const got = Object.entries(loot)
      .filter(([, n]) => n)
      .map(([m, n]) => `${n} ${m.replace(/_/g, ' ')}`)
      .join(', ');
    lines.push(`${cap(site.name)} explored: ${got || 'nothing'}, ${coins} coins.`);
    if (heart) {
      pt.calm = true;
      pt.stir = 0;
      lines.push(`The heart of ${inName(pt.realm)} is broken; it will stir no more.`);
      notify(s, `The heart of ${inName(pt.realm)} is broken! The realm lies quiet, its riches the town's.`, true);
    }
  } else lines.push(`The party came back from ${inName(pt.realm)} beaten.`);
  // the realm's rule on whoever went
  for (const p of party) {
    if (!s.people.includes(p)) continue;
    if (pt.realm === 'fae') {
      if (g.chance(FAE_STAYS) && p.id !== s.mainId) {
        s.people = s.people.filter((q) => q !== p);
        assignBeds(s);
        lines.push(`${p.name} stayed behind in the Feywild, and did not come home.`);
        continue;
      }
      const days = between(g, FAE_AGE);
      if (days) {
        p.grownAt = grownAt(s, p) - days * TICKS_PER_DAY;
        lines.push(days > 0 ? `${p.name} came home ${days} days older than they left.` : `${p.name} came home ${-days} days younger.`);
      }
      if (g.chance(FAE_BLESS)) {
        const sk = g.pick(SKILLS);
        gainSkill(p, sk, 400);
        lines.push(`${p.name} was blessed by the fae (${sk}).`);
      }
    } else if (pt.realm === 'underworld') {
      if (p.undying) continue;
      if (g.chance(UNDER_KEEPS) && p.id !== s.mainId) {
        killPerson(s, p, 'kept by the Underworld');
        lines.push(`${p.name} was kept by the Underworld.`);
        continue;
      }
      p.hp = Math.max(1, p.hp - maxHp(p) * UNDER_DRAIN);
    } else if (g.chance(ELEM_HURT)) {
      const burned = g.chance(0.5);
      woundPerson(s, p, maxHp(p) * 0.25, burned ? 'burn' : 'bruise', g);
      lines.push(`${p.name} came home ${burned ? 'burned' : 'frostbitten'}.`);
    }
  }
  for (const l of lines) note(pt, l);
  if (lines.length > 1) notify(s, `${def.name}: ${lines.slice(1).join(' ')}`, true);
}

/* ------------------------------------------------------------ seen */

export interface PortalSummary {
  realm: RealmId;
  name: string;
  rule: string;
  building: number;
  rift: boolean;
  explored: number;
  sites: number;
  stir: number;
  calm: boolean;
  next: string | null;
}

export interface PortalView extends PortalSummary {
  backdrop: string;
  glow: number;
  map: { name: string; x: number; y: number; explored: boolean; next: boolean; heart: boolean; foes: string[] }[];
  log: string[];
  /** A party there now. */
  away: string[];
}

export const portalSummaries = (s: GameState): PortalSummary[] =>
  (s.portals ?? []).map((pt) => {
    const def = REALM_DEFS[pt.realm];
    return {
      realm: pt.realm,
      name: def.name,
      rule: def.rule,
      building: pt.building,
      rift: pt.rift,
      explored: pt.sites.filter((x) => x.explored).length,
      sites: pt.sites.length,
      stir: pt.calm ? 0 : Math.min(1, pt.stir / RISE_AT),
      calm: pt.calm,
      next: nextSite(pt)?.name ?? null,
    };
  });

export function portalView(s: GameState): PortalView | null {
  if (!s.watchingPortal) return null;
  const pt = portalOf(s, s.watchingPortal);
  if (!pt) return null;
  const def = REALM_DEFS[pt.realm];
  const sum = portalSummaries(s).find((x) => x.realm === pt.realm)!;
  const next = nextSite(pt);
  const dest = `${PORTAL_DEST}${pt.realm}`;
  const away = (s.expeditions ?? []).filter((e) => e.dest === dest).flatMap((e) => e.members.map((id) => s.people.find((p) => p.id === id)?.name ?? '')).filter(Boolean);
  return {
    ...sum,
    backdrop: def.backdrop,
    glow: def.glow,
    map: pt.sites.map((x, i) => ({ name: x.name, x: x.x, y: x.y, explored: x.explored, next: x === next, heart: i === SITES - 1, foes: Object.keys(x.foes) })),
    log: pt.log.slice(-5),
    away,
  };
}
