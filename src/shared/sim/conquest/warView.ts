// What the War tab sees of the conquest (sim/conquest/conquest.ts, squads.ts): the provinces and who holds them,
// the town's recruits, troops and training, its squads with their strength, and what it may raise.

import { FACTION_BY_ID } from '../../data/factions';
import { FORTS, LANDMARKS, TIERS } from '../../data/conquest';
import { TROOPS, type TroopDef } from '../../data/troops';
import type { GameState } from '../state';
import { worldOf } from './conquest';
import { canRaise, command, heroStrength, leadership, leads, mayLead, squadSize, squadStrength, troopWorth } from './squads';
import { provinceYield } from './world';

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
}
export interface WarView {
  realms: { id: string; name: string; provinces: number; capital: number }[];
  side: number;
  cells: string;
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
}

const realmName = (id: string, town: string) => (id === 'town' ? town : FACTION_BY_ID[id]?.name ?? id);

export function warView(s: GameState): WarView | null {
  const c = s.conquest;
  const w = worldOf(s);
  if (!c || !w) return null;
  const town = s.origin ? FACTION_BY_ID[s.origin]?.name ?? 'The town' : 'The town';
  const provinces: ProvinceView[] = w.provinces.map((p) => {
    const holder = c.holder[p.id] ?? null;
    return {
      id: p.id, name: p.name, land: p.land, x: p.x, y: p.y, neighbours: p.neighbours, holder, holderName: holder ? realmName(holder, town) : 'Free',
      capitalOf: p.capitalOf === null ? null : w.realms[p.capitalOf].id, tier: TIERS[p.tier].name, fort: FORTS[p.fort].name,
      landmark: p.landmark ? LANDMARKS[p.landmark].name : null, yields: provinceYield(p), coast: p.coast,
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
    };
  });
  let soldiers = 0;
  for (const n of Object.values(c.troops)) soldiers += n;
  for (const q of c.squads) soldiers += squadSize(q);
  return {
    realms: w.realms.map((r) => ({ id: r.id, name: realmName(r.id, town), provinces: c.holder.filter((h) => h === r.id).length, capital: r.capital })),
    side: w.side,
    cells: w.cells,
    provinces,
    recruits: Math.floor(c.recruits),
    chest: Math.floor(c.chest),
    goods: Object.entries(c.goods).filter(([, n]) => n > 0).map(([material, n]) => ({ material, n })),
    troops,
    training: c.training.map((b) => ({ troop: b.troop, name: TROOPS.find((t) => t.id === b.troop)?.name ?? b.troop, n: b.n, hoursLeft: Math.max(0, Math.ceil((b.done - s.tick) / 600)) })),
    squads,
    heroes: s.people.filter((p) => mayLead(s, p)).map((p) => ({ id: p.id, name: p.name, strength: heroStrength(p), lead: leadership(p) })),
    upkeep: Math.round(soldiers * 0.2),
  };
}
const costLine = (t: TroopDef) => `${t.cost.coins} coins${t.cost.material ? ` + ${t.cost.amount} ${t.cost.material.replace(/_/g, ' ')}` : ''} a soldier`;
