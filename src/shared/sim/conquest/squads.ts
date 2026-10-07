// Squads (data/troops.ts): a hero of the town with up to nine nameless troops in formation round them, raised from
// the provinces' recruits, and what a squad is worth in a clash. The hero carries the squad (the owner's ask): their
// own strength comes from the same reckoning as any fight (personFighter: level, calling, attributes, gear grade and
// +N), weighed in troops' worth, and their command (level, stage, Charisma) makes every troop fight better. A
// seasoned hero in fine gear with three troops beats a green one with nine. Recruits come daily from the provinces
// held; a batch trains in TRAIN_HOURS (half with a barracks); every soldier costs upkeep from the treasury.

import { ATTR_BASE } from '../../data/attributes';
import { CLASS_DEFS } from '../../data/classes';
import { ERAS } from '../../data/eras';
import { levelOf, stageOf } from '../../data/levels';
import {
  DESERT_SHARE,
  COMMAND_PER_CHA, COMMAND_PER_LEVEL, COMMAND_PER_STAGE, HERO_CURVE, HERO_WEIGHT, LEAD_BASE, LEAD_PER_CHA, LEAD_PER_LEVELS, LEADS, LEADS_TOO, RECRUITS_HOME, RECRUITS_MOST,
  SQUAD_SLOTS, TRAIN_BATCH_MOST, TRAIN_HOURS, TROOP_ATTACK, TROOP_BY_ID, TROOP_HP, TROOPS, UPKEEP, type TroopDef,
} from '../../data/troops';
import { attributesOf } from '../attributes';
import { totalStock } from '../buildings';
import { personFighter } from '../combat';
import { takeFromStorage } from '../expeditions';
import { isChild } from '../social';
import { earn, notify, type GameState, type Person } from '../state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../time';
import { holdings, worldOf, type ConquestState, type Squad } from './conquest';
import { provinceYield } from './world';

/* ------------------------------------------------------------ the hero */

/** How many troops a hero may lead. */
export function leadership(p: Person): number {
  const cha = Math.max(0, attributesOf(p).cha - ATTR_BASE);
  return Math.min(SQUAD_SLOTS, LEAD_BASE + Math.floor(levelOf(p) / LEAD_PER_LEVELS) + stageOf(p) + Math.floor(cha / LEAD_PER_CHA));
}
/** How much better troops fight under them (a multiplier on their blows and guard). */
export function command(p: Person): number {
  const cha = Math.max(0, attributesOf(p).cha - ATTR_BASE);
  return 1 + levelOf(p) * COMMAND_PER_LEVEL + stageOf(p) * COMMAND_PER_STAGE + cha * COMMAND_PER_CHA;
}
/** The hero's own worth in a clash, in troops: by their health and blows against a plain soldier's, geometric so
 *  neither alone runs away with it, and weighted. */
export function heroStrength(p: Person): number {
  const f = personFighter(p, 'fighter', 'front');
  const hp = f.maxHp / TROOP_HP;
  const blow = ((f.damage[0] + f.damage[1]) / 2) * (0.5 + f.accuracy) / TROOP_ATTACK;
  return Math.round(Math.pow(Math.sqrt(Math.max(0.01, hp * blow)), HERO_CURVE) * HERO_WEIGHT * 10) / 10;
}
/** The troop kinds a hero may have in their squad: their role's, their calling's extras, and their people's own. */
export function leads(p: Person, origin: string): TroopDef[] {
  const cls = p.cls ? CLASS_DEFS[p.cls] : undefined;
  const kinds = new Set([...(cls ? LEADS[cls.role] : LEADS.bruiser), ...(p.cls ? LEADS_TOO[p.cls] ?? [] : [])]);
  return TROOPS.filter((t) => (!t.origin || t.origin === origin) && (kinds.has(t.kind) || (!!t.origin && !!p.fcls)));
}

/* ------------------------------------------------------------ troops */

/** A troop's worth in a clash, in plain soldiers. */
export const troopWorth = (t: TroopDef) => Math.round(((t.hp / TROOP_HP + t.attack / TROOP_ATTACK + t.defence / 3 + (t.heal ?? 0) / 4) / 2) * 100) / 100;

/** Whether the town may raise a kind: its age come, its study learned, its people's own or anyone's. */
export function canRaise(s: GameState, t: TroopDef): { ok: boolean; why?: string } {
  if (t.origin && t.origin !== (s.origin ?? 'settlers')) return { ok: false, why: 'another people\'s' };
  if (ERAS.indexOf(t.era) > ERAS.indexOf(s.era)) return { ok: false, why: `the ${t.era} age` };
  if (t.research && !s.research.done.includes(t.research)) return { ok: false, why: 'not yet studied' };
  return { ok: true };
}

/** Train a batch: `n` recruits of a kind, paid in coins and the kind's material; done in TRAIN_HOURS. */
export function train(s: GameState, troopId: string, n: number): { ok: boolean; reason?: string } {
  const c = s.conquest;
  const t = TROOP_BY_ID[troopId];
  if (!c || !t) return { ok: false, reason: 'No such troops' };
  const may = canRaise(s, t);
  if (!may.ok) return { ok: false, reason: `${t.name}: ${may.why}` };
  n = Math.max(1, Math.min(TRAIN_BATCH_MOST, Math.floor(n)));
  if (c.recruits < n) return { ok: false, reason: `Only ${Math.floor(c.recruits)} recruits` };
  const coins = t.cost.coins * n;
  if (c.chest + (s.coins ?? 0) < coins) return { ok: false, reason: `The war chest and treasury haven't ${coins} coins` };
  const need = (t.cost.amount ?? 0) * n;
  const m = t.cost.material;
  if (m && need > 0 && (c.goods[m] ?? 0) + (totalStock(s)[m] ?? 0) < need) return { ok: false, reason: `Not ${need} ${m.replace(/_/g, ' ')} in the war stores or the town's` };
  c.recruits -= n;
  // (the war chest and stores first, the town's after)
  const fromChest = Math.min(c.chest, coins);
  c.chest -= fromChest;
  if (coins > fromChest) {
    s.coins = (s.coins ?? 0) - (coins - fromChest);
    earn(s, 'realm', -(coins - fromChest));
  }
  if (m && need > 0) {
    const fromGoods = Math.min(c.goods[m] ?? 0, need);
    if (fromGoods > 0) c.goods[m] = (c.goods[m] ?? 0) - fromGoods;
    if (need > fromGoods) takeFromStorage(s, m, need - fromGoods);
  }
  const barracks = s.buildings.some((b) => b.def === 'barracks' && b.status === 'done');
  c.training.push({ troop: t.id, n, done: s.tick + Math.round(TRAIN_HOURS * TICKS_PER_HOUR * (barracks ? 0.5 : 1)) });
  return { ok: true };
}

/* ------------------------------------------------------------ squads */

/** Who may lead a squad: a grown townsperson not already leading one. */
export function mayLead(s: GameState, p: Person): boolean {
  return !isChild(p) && !s.conquest?.squads.some((q) => q.hero === p.id);
}
export function formSquad(s: GameState, heroId: number): { ok: boolean; reason?: string; squad?: Squad } {
  const c = s.conquest;
  const p = s.people.find((q) => q.id === heroId);
  if (!c || !p) return { ok: false, reason: 'No such person' };
  if (!mayLead(s, p)) return { ok: false, reason: `${p.name} can't lead a squad` };
  const squad: Squad = { id: c.nextSquad++, name: `${p.name}'s ${squadWord(p)}`, hero: p.id, slots: Array(SQUAD_SLOTS).fill(null), battles: 0 };
  c.squads.push(squad);
  return { ok: true, squad };
}
const squadWord = (p: Person) => {
  const role = p.cls ? CLASS_DEFS[p.cls].role : 'bruiser';
  return role === 'shooter' ? 'Bows' : role === 'caster' ? 'Circle' : role === 'healer' || role === 'support' ? 'Company' : role === 'tank' ? 'Wall' : 'Blades';
};
/** Put a troop kind in a place of the formation (from the trained troops), or clear it (back to them). */
export function setSlot(s: GameState, squadId: number, slot: number, troopId: string | null): { ok: boolean; reason?: string } {
  const c = s.conquest;
  const q = c?.squads.find((x) => x.id === squadId);
  if (!c || !q || slot < 0 || slot >= SQUAD_SLOTS) return { ok: false, reason: 'No such place' };
  const hero = s.people.find((p) => p.id === q.hero);
  if (!hero) return { ok: false, reason: 'The squad has no hero' };
  const was = q.slots[slot];
  if (was) {
    c.troops[was] = (c.troops[was] ?? 0) + 1;
    q.slots[slot] = null;
  }
  if (!troopId) return { ok: true };
  const t = TROOP_BY_ID[troopId];
  if (!t) return { ok: false, reason: 'No such troops' };
  if ((c.troops[troopId] ?? 0) < 1) return { ok: false, reason: `No ${t.name.toLowerCase()} trained` };
  if (!leads(hero, s.origin ?? 'settlers').some((x) => x.id === troopId)) return { ok: false, reason: `${hero.name} can't lead ${t.name.toLowerCase()}` };
  if (q.slots.filter((x) => x).length >= leadership(hero)) return { ok: false, reason: `${hero.name} leads ${leadership(hero)} at most` };
  c.troops[troopId]! -= 1;
  q.slots[slot] = troopId;
  return { ok: true };
}
export function disbandSquad(s: GameState, squadId: number): boolean {
  const c = s.conquest;
  const i = c?.squads.findIndex((x) => x.id === squadId) ?? -1;
  if (!c || i < 0) return false;
  for (const t of c.squads[i].slots) if (t) c.troops[t] = (c.troops[t] ?? 0) + 1;
  c.squads.splice(i, 1);
  return true;
}
/** A squad's worth in a clash: the hero's own strength and every troop's, the troops bettered by the command. */
export function squadStrength(s: GameState, q: Squad): number {
  const hero = s.people.find((p) => p.id === q.hero);
  if (!hero) return 0;
  const cmd = command(hero);
  let n = heroStrength(hero);
  for (const t of q.slots) if (t && TROOP_BY_ID[t]) n += troopWorth(TROOP_BY_ID[t]) * cmd;
  return Math.round(n * 10) / 10;
}
export const squadSize = (q: Squad) => q.slots.filter((x) => x).length;

/* ------------------------------------------------------------ the days */

/** Each hour: batches done join the troops; once a day the provinces held yield (coins to the war chest, their
 *  material to the war stores, recruits to the pool), the home town gives its recruits, and upkeep is paid from the
 *  chest (the town's treasury and stores are left alone: the conquest is beside the town, not over it). */
export function conquestHourly(s: GameState): void {
  const c = s.conquest;
  if (!c || s.tick % TICKS_PER_HOUR !== 0) return;
  for (let i = c.training.length - 1; i >= 0; i--) {
    const b = c.training[i];
    if (s.tick < b.done) continue;
    c.troops[b.troop] = (c.troops[b.troop] ?? 0) + b.n;
    c.training.splice(i, 1);
    notify(s, `${b.n} ${TROOP_BY_ID[b.troop]?.name.toLowerCase() ?? b.troop} are trained and ready.`);
  }
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  if (c.lastDay === day) return;
  if (c.lastDay === undefined) {
    c.lastDay = day;
    return;
  }
  c.lastDay = day;
  conquestDaily(s, c);
}
export function conquestDaily(s: GameState, c: ConquestState): void {
  const w = worldOf(s);
  if (!w) return;
  let coins = 0;
  let recruits = RECRUITS_HOME;
  for (const i of holdings(c, 'town')) {
    const y = provinceYield(w.provinces[i]);
    coins += y.coins;
    recruits += y.recruits;
    const got = Math.floor(y.amount);
    if (got > 0) c.goods[y.material] = (c.goods[y.material] ?? 0) + got;
  }
  // upkeep: every soldier trained, in a squad or waiting (unpaid, a tenth of the waiting troops drift home)
  let soldiers = 0;
  for (const n of Object.values(c.troops)) soldiers += n;
  for (const q of c.squads) soldiers += squadSize(q);
  const upkeep = Math.round(soldiers * UPKEEP);
  c.chest += coins;
  if (c.chest >= upkeep) c.chest -= upkeep;
  else {
    c.chest = 0;
    for (const k of Object.keys(c.troops)) {
      const gone = Math.floor((c.troops[k] ?? 0) * DESERT_SHARE);
      if (gone > 0) {
        c.troops[k]! -= gone;
        notify(s, `${gone} ${TROOP_BY_ID[k]?.name.toLowerCase() ?? k}, unpaid, have gone home.`);
      }
    }
  }
  c.recruits = Math.min(RECRUITS_MOST, c.recruits + recruits);
}
