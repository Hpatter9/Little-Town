// What the War tab sees of the conquest (sim/conquest/conquest.ts, squads.ts): the provinces and who holds them,
// the town's recruits, troops and training, its squads with their strength, and what it may raise.

import { FACTION_BY_ID } from '../../data/factions';
import { FORTS, LANDMARKS, TIERS } from '../../data/conquest';
import { GARRISON_HOLDS, REVOLT_GRACE_DAYS, TROOPS, type TroopDef } from '../../data/troops';
import type { GameState } from '../state';
import { worldOf, type Squad } from './conquest';
import { armiesOf, armyOfSquad, armyStrength, garrisonSize, homeProvince, isHome, squadFree, trainSize } from './armies';
import { canRaise, command, heroStrength, leadership, leads, mayLead, soldiersOf, squadSize, squadStrength, troopWorth } from './squads';
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
  realms: { id: string; name: string; provinces: number; capital: number }[];
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
      capitalOf: p.capitalOf === null ? null : w.realms[p.capitalOf].id, tier: TIERS[p.tier].name, fort: FORTS[p.fort].name,
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
  return {
    realms: w.realms.map((r) => ({ id: r.id, name: realmName(r.id, town), provinces: c.holder.filter((h) => h === r.id).length, capital: r.capital })),
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
    armies: armies.map((a): ArmyView => {
      const gen = c.squads.find((q) => q.id === a.general);
      const hero = gen ? s.people.find((p) => p.id === gen.hero) : undefined;
      let n = trainSize(a);
      for (const id of a.squads) n += squadSize(c.squads.find((q) => q.id === id) ?? { slots: [] } as unknown as Squad);
      return {
        id: a.id, name: a.name, general: a.general, generalName: hero?.name ?? '?', squads: [...a.squads], at: a.at, going: a.going,
        hours: a.arrive === null ? 0 : Math.max(0, Math.ceil((a.arrive - s.tick) / 600)), path: [...a.path], strength: armyStrength(s, c, a), soldiers: n,
        train: Object.entries(a.train).filter(([, k]) => k > 0).map(([troop, k]) => ({ troop, name: TROOPS.find((t) => t.id === troop)?.name ?? troop, n: k })), home: isHome(w, a),
      };
    }),
  };
}
const costLine = (t: TroopDef) => `${t.cost.coins} coins${t.cost.material ? ` + ${t.cost.amount} ${t.cost.material.replace(/_/g, ' ')}` : ''} a soldier`;
