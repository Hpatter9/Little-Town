// What the War tab sees of the conquest (sim/conquest/conquest.ts, squads.ts): the provinces and who holds them,
// the town's recruits, troops and training, its squads with their strength, and what it may raise.

import { FACTION_BY_ID } from '../../data/factions';
import { realm } from '../factions';
import { FORTS, LANDMARKS, TIERS } from '../../data/conquest';
import { GARRISON_HOLDS, REVOLT_GRACE_DAYS, TROOPS, type TroopDef } from '../../data/troops';
import type { GameState } from '../state';
import { worldOf, type Squad } from './conquest';
import { armiesOf, armyOfSquad, armyStrength, garrisonSize, homeProvince, isHome, squadFree, trainSize } from './armies';
import { captivesOf, type BattleRecap, type ProvinceBattle } from './battles';
import { canRaise, command, heroStrength, leadership, leads, mayLead, soldiersOf, squadSize, squadStrength, troopWorth } from './squads';
import { marchesOf, type MarchRecap } from './marches';
import { provinceYield, type ConquestWorld } from './world';

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
  /** The town's garrison here, and its armies standing here or marching on it. */
  garrison: number;
  armies: number[];
  /** A province of the town's that may revolt: no garrison or army, past its grace. */
  bare: boolean;
}
export interface ArmyView {
  id: number;
  name: string;
  general: number;
  generalName: string;
  squads: number[];
  at: number;
  going: number | null;
  /** Hours to the next province, and the provinces beyond it on the way ordered. */
  hours: number;
  path: number[];
  strength: number;
  soldiers: number;
  train: { troop: string; name: string; n: number }[];
  home: boolean;
  /** The march under way: battles given and won, provinces taken so far, and its latest line. */
  march: { fought: number; won: number; taken: number; last: string } | null;
}
export interface TroopView {
  id: string;
  name: string;
  kind: string;
  n: number;
  worth: number;
  cost: string;
  text: string;
  can: boolean;
  why: string | null;
  hp: number;
  attack: number;
  defence: number;
  ranged: boolean;
}
export interface SquadView {
  id: number;
  name: string;
  hero: number;
  heroName: string;
  heroStrength: number;
  command: number;
  lead: number;
  size: number;
  strength: number;
  slots: (string | null)[];
  /** The troop kinds this hero may lead. */
  leads: string[];
  /** The army it's in, and whether it could join one now (else why not). */
  army: number | null;
  free: boolean;
  why: string | null;
}
export interface WarView {
  realms: { id: string; name: string; provinces: number; capital: number; stance: string }[];
  /** The rival realms' armies on the march. */
  rivalArmies: { realm: string; from: number; to: number; hours: number; strength: number }[];
  side: number;
  cells: string;
  /** Each cell's province, one character a cell (its id + 32), a space-ish '!' less one... see `ownerAt`. */
  owners: string;
  provinces: ProvinceView[];
  recruits: number;
  chest: number;
  goods: { material: string; n: number }[];
  troops: TroopView[];
  training: { troop: string; name: string; n: number; hoursLeft: number }[];
  squads: SquadView[];
  /** Townsfolk who could lead a new squad. */
  heroes: { id: number; name: string; strength: number; lead: number }[];
  upkeep: number;
  /** The town's home province (its capital), and its armies. */
  home: number;
  armies: ArmyView[];
  /** A battle on the board (the latest; kept a few seconds after it ends), the last recap, the heroes held captive. */
  battle: BattleView | null;
  recap: BattleRecap | null;
  captives: { hero: number; name: string; province: string; by: string; ransom: number }[];
  /** The marches ended, the latest first (sim/conquest/marches.ts). */
  marches: MarchRecap[];
}
export interface BattleView {
  id: number;
  province: string;
  land: string;
  /** Who held the province as the battle began (null: a lair), its settlement tier and fort. */
  holder: string | null;
  /** A lair's beasts (else free ground's folk, outlaws or beasts, or a realm's garrison). */
  lair: boolean;
  tier: number;
  fort: number;
  army: number;
  turn: number;
  side: 'town' | 'foe';
  walls: number;
  wallsMax: number;
  squads: {
    id: number;
    side: 'town' | 'foe';
    name: string;
    hero: string | null;
    /** The hero's townsperson, for the town's squads. */
    person: number | null;
    heroShare: number;
    troops: ({ troop: string; share: number } | null)[];
    x: number;
    y: number;
    out: 'routed' | 'fallen' | null;
  }[];
  events: ProvinceBattle['events'];
  done: 'won' | 'lost' | null;
  tick: number;
}

/** The owner grid as a string (made once a world): a cell's province id + 33 as a character, '!' - 1 = ' ' for the sea. */
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

const realmName = (id: string, town: string) => (id === 'town' ? town : FACTION_BY_ID[id]?.name ?? id);

export function warView(s: GameState): WarView | null {
  const c = s.conquest;
  const w = worldOf(s);
  if (!c || !w) return null;
  const town = s.origin ? FACTION_BY_ID[s.origin]?.name ?? 'The town' : 'The town';
  const armies = armiesOf(c);
  const day = Math.floor(s.tick / 6000);
  const provinces: ProvinceView[] = w.provinces.map((p) => {
    const holder = c.holder[p.id] ?? null;
    const here = armies.filter((a) => a.at === p.id || a.going === p.id).map((a) => a.id);
    const g = garrisonSize(c, p.id);
    return {
      id: p.id, name: p.name, land: p.land, x: p.x, y: p.y, neighbours: p.neighbours, holder, holderName: holder ? realmName(holder, town) : 'Free',
      capitalOf: p.capitalOf === null ? null : w.realms[p.capitalOf].id, tier: TIERS[p.tier].name, fort: FORTS[p.fort].name, tierN: p.tier, fortN: p.fort,
      landmark: p.landmark ? LANDMARKS[p.landmark].name : null, yields: provinceYield(p), coast: p.coast,
      garrison: g, armies: here,
      bare: holder === 'town' && p.id !== homeProvince(w) && g < GARRISON_HOLDS && !armies.some((a) => a.going === null && a.at === p.id) && day - (c.taken?.[p.id] ?? 0) >= REVOLT_GRACE_DAYS,
    };
  });
  const origin = s.origin ?? 'settlers';
  const troops: TroopView[] = TROOPS.filter((t) => !t.origin || t.origin === origin).map((t): TroopView => {
    const may = canRaise(s, t);
    return {
      id: t.id, name: t.name, kind: t.kind, n: c.troops[t.id] ?? 0, worth: troopWorth(t), cost: costLine(t), text: t.text, can: may.ok, why: may.why ?? null,
      hp: t.hp, attack: t.attack, defence: t.defence, ranged: !!t.ranged,
    };
  });
  const squads: SquadView[] = c.squads.map((q) => {
    const hero = s.people.find((p) => p.id === q.hero);
    return {
      id: q.id, name: q.name, hero: q.hero, heroName: hero?.name ?? '?', heroStrength: hero ? heroStrength(hero) : 0, command: hero ? Math.round(command(hero) * 100) / 100 : 1,
      lead: hero ? leadership(hero) : 0, size: squadSize(q), strength: squadStrength(s, q), slots: [...q.slots], leads: hero ? leads(hero, origin).map((t) => t.id) : [],
      army: armyOfSquad(c, q.id)?.id ?? null, free: squadFree(s, c, q).ok, why: squadFree(s, c, q).why ?? null,
    };
  });
  const soldiers = soldiersOf(c);
  const b = (c.battles ?? []).slice(-1)[0] ?? null;
  const battle: BattleView | null = b
    ? {
        id: b.id, province: w.provinces[b.province].name, land: w.provinces[b.province].land, holder: b.holder === undefined ? (c.holder[b.province] === 'town' ? null : c.holder[b.province]) : b.holder, tier: w.provinces[b.province].tier, fort: w.provinces[b.province].fort, lair: w.provinces[b.province].landmark === 'lair' && (b.holder ?? null) === null, army: b.army, turn: b.turn, side: b.side, walls: b.walls, wallsMax: b.wallsMax,
        squads: b.squads.map((q) => ({
          id: q.id, side: q.side, name: q.name, hero: q.hero?.name ?? null, person: q.hero?.person ?? null, heroShare: q.hero ? Math.max(0, q.hero.hp / q.hero.max) : 0,
          troops: q.troops.map((t) => (t ? { troop: t.troop, share: Math.max(0, t.hp / t.max) } : null)), x: q.x, y: q.y, out: q.out,
        })),
        events: b.events, done: b.done, tick: s.tick,
      }
    : null;
  return {
    realms: w.realms.map((r) => ({ id: r.id, name: realmName(r.id, town), provinces: c.holder.filter((h) => h === r.id).length, capital: r.capital, stance: r.id === 'town' ? 'the town' : realm(s).find((f) => f.id === r.id)?.stance ?? 'neutral' })),
    rivalArmies: (c.rivalArmies ?? []).map((a) => ({ realm: a.realm, from: a.from, to: a.to, hours: Math.max(0, Math.ceil((a.arrive - s.tick) / 600)), strength: Math.round(a.strength) })),
    side: w.side,
    cells: w.cells,
    owners: ownersOf(w),
    provinces,
    recruits: Math.floor(c.recruits),
    chest: Math.floor(c.chest),
    goods: Object.entries(c.goods).filter(([, n]) => n > 0).map(([material, n]) => ({ material, n })),
    troops,
    training: c.training.map((b) => ({ troop: b.troop, name: TROOPS.find((t) => t.id === b.troop)?.name ?? b.troop, n: b.n, hoursLeft: Math.max(0, Math.ceil((b.done - s.tick) / 600)) })),
    squads,
    heroes: s.people.filter((p) => mayLead(s, p)).map((p) => ({ id: p.id, name: p.name, strength: heroStrength(p), lead: leadership(p) })),
    upkeep: Math.round(soldiers * 0.2),
    home: homeProvince(w),
    battle,
    recap: c.lastBattle ?? null,
    marches: marchesOf(c),
    captives: captivesOf(c).map((x) => ({ hero: x.hero, name: s.people.find((p) => p.id === x.hero)?.name ?? '?', province: w.provinces[x.province].name, by: x.by ? realmName(x.by, town) : 'beasts', ransom: x.ransom })),
    armies: armies.map((a): ArmyView => {
      const gen = c.squads.find((q) => q.id === a.general);
      const hero = gen ? s.people.find((p) => p.id === gen.hero) : undefined;
      let n = trainSize(a);
      for (const id of a.squads) n += squadSize(c.squads.find((q) => q.id === id) ?? { slots: [] } as unknown as Squad);
      return {
        id: a.id, name: a.name, general: a.general, generalName: hero?.name ?? '?', squads: [...a.squads], at: a.at, going: a.going,
        hours: a.arrive === null ? 0 : Math.max(0, Math.ceil((a.arrive - s.tick) / 600)), path: [...a.path], strength: armyStrength(s, c, a), soldiers: n,
        train: Object.entries(a.train).filter(([, k]) => k > 0).map(([troop, k]) => ({ troop, name: TROOPS.find((t) => t.id === troop)?.name ?? troop, n: k })), home: isHome(w, a),
        march: a.march ? { fought: a.march.fought, won: a.march.won, taken: a.march.taken.length, last: a.march.lines[a.march.lines.length - 1] ?? '' } : null,
      };
    }),
  };
}
const costLine = (t: TroopDef) => `${t.cost.coins} coins${t.cost.material ? ` + ${t.cost.amount} ${t.cost.material.replace(/_/g, ' ')}` : ''} a soldier`;
