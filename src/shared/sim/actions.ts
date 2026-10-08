// Spells and skills in a fight (data/spells.ts, data/abilities.ts): what each fighter has ready (their kit), what
// they choose when their turn comes (a heal when a friend is low, a burst of fire when the foes bunch up, a curse on
// one that isn't cursed yet...), what it does, and the statuses that linger (poison, haste, a shield...). Written
// against `Combatant`, which an expedition's fighters are (combat.ts) and a raid map's fighters and raiders are made
// to look like (battle.ts), so both fight the same way.

import { armedForSkills } from '../data/armed';
import { abilitiesKnown, type Passive } from '../data/abilities';
import { LIMIT_FROM_DEALT, LIMIT_FROM_HURT, skillCost, spellCost, WIS_HEALING, ATTR_BASE, type Attrs } from '../data/attributes';
import { CLASS_DEFS, type ClassId } from '../data/classes';
import { BAD_STATUS, type Effect, type Element, type Status, type Target, type Use } from '../data/effects';
import { ENEMIES, natureOf } from '../data/enemies';
import { levelOf } from '../data/levels';
import { spellsKnown, type SpellDef } from '../data/spells';
import type { Rng } from '../rng';
import type { Person } from './state';
import { TICK_HZ } from './time';

/** Statuses on a fighter: until which tick, and how strong (a poison's bite each second, a shield's strength). */
export type Statuses = Partial<Record<Status, { until: number; power: number }>>;

export interface KitAction {
  id: string;
  name: string;
  spell: boolean;
  level: number;
  /** Ticks between uses, and the tick it's next ready. */
  cooldown: number;
  ready: number;
  effects: readonly Effect[];
  use: Use;
  /** What it costs: mana (a spell), stamina (a skill), or the limit gauge (an ultimate). */
  cost: number;
  pool: 'mp' | 'sp' | 'limit';
}

export interface Kit {
  actions: KitAction[];
  passive: Required<Pick<Passive, 'damage' | 'power' | 'healing' | 'crit' | 'critDamage' | 'counter' | 'lifesteal' | 'thorns' | 'guard' | 'resist' | 'regen' | 'lastStand'>> & { firstStrike: boolean };
}

/** Anyone in a fight, as far as spells and skills are concerned. */
export interface Combatant {
  side: 'party' | 'enemy';
  ref: number;
  kind: string;
  name: string;
  hp: number;
  maxHp: number;
  down: boolean;
  damage: [number, number];
  accuracy: number;
  dodge: number;
  armor: number;
  interval: number;
  cooldown: number;
  ranged: boolean;
  st?: Statuses;
  kit?: Kit;
  lastHit?: number;
  lastAction?: number;
  /** Called up by a spell (a summoned beast or spirit). */
  conjured?: boolean;
  /** The last number to pop up over them (damage, or healing): for the watcher. */
  pop?: { tick: number; amount: number; heal: boolean };
  /** Their attributes (data/attributes.ts), and the pools their spells and skills draw on: mana, stamina and the
   *  limit gauge (0 to 1). A fighter without them (a raider on the map) pays nothing. */
  attrs?: Attrs;
  /** A person's strength as a caller and their charm (combat.ts personFighter: by level and Charisma). */
  power?: number;
  charm?: number;
  mp?: number;
  maxMp?: number;
  sp?: number;
  maxSp?: number;
  limit?: number;
}

/** What was done, for the watcher: the box naming it, the banner for a skill, the fanfare for an ultimate. */
export interface ActMeta {
  spell: boolean;
  ult: boolean;
  cost: number;
  pool: 'mp' | 'sp' | 'limit';
}

/** What a fight gives the engine: everyone in it, the tick, a way to call up a summoned ally, and a log of what was
 *  used (for the watcher: the box naming the action). */
export interface Arena {
  tick: number;
  all: () => Combatant[];
  rng: Rng;
  summon: (user: Combatant, kind: string) => Combatant | null;
  log: (user: Combatant, name: string, targets: Combatant[], meta?: ActMeta) => void;
}

const secs = (n: number) => Math.round(n * TICK_HZ);

/* ------------------------------------------------------------ the kit */

/** The three spells a caster keeps ready: the best they know for what their class does most, then the next most
 *  useful kinds (a healer keeps two mends and a strike; a sorcerer two strikes and a hindrance), each the highest
 *  learned of its kind. */
export function readySpells(cls: ClassId, level: number): SpellDef[] {
  const known = spellsKnown(cls, level).sort((a, b) => b.level - a.level);
  if (!known.length) return [];
  const role = CLASS_DEFS[cls].role;
  // (callers keep a summons ready first of all)
  const order: Use[] = CALLERS[cls] ?? (role === 'healer' ? ['heal', 'heal', 'attack'] : role === 'support' ? ['support', 'heal', 'attack'] : role === 'caster' ? ['attack', 'attack', 'control'] : ['attack', 'support', 'heal']);
  const picked: SpellDef[] = [];
  for (const use of order) {
    const s = known.find((k) => k.use === use && !picked.includes(k));
    if (s) picked.push(s);
  }
  for (const s of known) if (picked.length < 3 && !picked.includes(s)) picked.push(s);
  return picked.slice(0, 3);
}

const CALLERS: Partial<Record<ClassId, Use[]>> = { summoner: ['summon', 'attack', 'support'], necromancer: ['attack', 'summon', 'control'], beast_tamer: ['summon', 'control', 'attack'] };

const NO_PASSIVE = (): Kit['passive'] => ({ damage: 0, power: 0, healing: 0, crit: 0, critDamage: 0, counter: 0, lifesteal: 0, thorns: 0, guard: 0, resist: 0, regen: 0, lastStand: 0, firstStrike: false });

/** Someone's kit: their ready spells, their active skills, and their passive skills added up. */
export function kitOf(p: Pick<Person, 'cls' | 'level' | 'road'> & { gear?: { weapon?: string | null } }): Kit | undefined {
  if (!p.cls) return undefined;
  const lv = levelOf(p);
  // (a calling's skills come only with its weapon in hand: no bow, no volley; spells need nothing: data/armed.ts)
  const armed = !p.gear || armedForSkills(p.cls, p.gear.weapon);
  const actions: KitAction[] = [];
  for (const s of readySpells(p.cls, lv)) actions.push({ id: s.id, name: s.name, spell: true, level: s.level, cooldown: secs(s.cooldown), ready: 0, effects: s.effects, use: s.use, cost: spellCost(s.level), pool: 'mp' });
  const passive = NO_PASSIVE();
  for (const a of abilitiesKnown(p.cls, lv, p.road)) {
    if (a.active && armed) actions.push({ id: a.id, name: a.name, spell: false, level: a.level, cooldown: secs(a.active.cooldown), ready: 0, effects: a.active.effects, use: a.use as Use, cost: a.ultimate ? 1 : skillCost(a.level), pool: a.ultimate ? 'limit' : 'sp' });
    if (a.passive) {
      const q = a.passive;
      for (const k of ['damage', 'power', 'healing', 'crit', 'critDamage', 'counter', 'lifesteal', 'thorns', 'guard', 'resist', 'regen', 'lastStand'] as const) passive[k] += q[k] ?? 0;
      if (q.firstStrike) passive.firstStrike = true;
    }
  }
  return { actions, passive };
}

/** The extra a kit's passives add to a fighter's plain numbers (applied once, as the fight begins). */
export function passiveStats(p: Pick<Person, 'cls' | 'level' | 'road'>): Passive {
  const out: Passive = {};
  if (!p.cls) return out;
  for (const a of abilitiesKnown(p.cls, levelOf(p), p.road)) {
    for (const [k, v] of Object.entries(a.passive ?? {})) if (typeof v === 'number') (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 0) + v;
  }
  return out;
}

/* ------------------------------------------------------------ statuses */

const has = (f: Combatant, s: Status, tick: number) => (f.st?.[s]?.until ?? -1) > tick;

/** Can't act at all (stunned, asleep, frozen, stopped). */
export function held(f: Combatant, tick: number): boolean {
  return has(f, 'stun', tick) || has(f, 'sleep', tick) || has(f, 'freeze', tick) || has(f, 'stop', tick) || has(f, 'charm', tick);
}
/** Too afraid to strike (they may still cast a ward or a mend). */
export const afraid = (f: Combatant, tick: number) => has(f, 'fear', tick);
/** The time between their actions, hastened or slowed. */
export function pace(f: Combatant, tick: number): number {
  return Math.round(f.interval * (has(f, 'haste', tick) ? 0.65 : 1) * (has(f, 'slow', tick) ? 1.5 : 1));
}
/** Aim, lowered by blindness. */
export const aim = (f: Combatant, tick: number) => f.accuracy - (has(f, 'blind', tick) ? 0.35 : 0);
/** Can be picked as a target (the invisible can't, while anyone else can). */
const seen = (f: Combatant, tick: number) => !has(f, 'invisible', tick);

function setStatus(a: Arena, user: Combatant, f: Combatant, s: Status, seconds: number, power: number): void {
  if (f.down) return;
  if (BAD_STATUS.has(s)) {
    const resist = (f.kit?.passive.resist ?? 0) + (isBoss(f) ? 0.4 : 0);
    if (a.rng.chance(Math.min(0.9, resist))) return;
  }
  // (a boss shakes off holds quickly)
  const hold = s === 'stun' || s === 'sleep' || s === 'freeze' || s === 'stop' || s === 'charm' || s === 'fear';
  const len = secs(seconds * (hold && isBoss(f) ? 0.35 : 1));
  const st = (f.st ??= {});
  const was = st[s];
  st[s] = { until: Math.max(was?.until ?? 0, a.tick + len), power: Math.max(was?.power ?? 0, power) };
  if (s === 'doom') st[s]!.power = Math.max(1, power);
  void user;
}

const isBoss = (f: Combatant) => !!ENEMIES[f.kind]?.boss;

/** Each tick: lingering harm and healing, a shield that's run out, doom falling due. Returns damage dealt. */
export function tickStatuses(a: Arena, f: Combatant): void {
  const st = f.st;
  if (!st || f.down) return;
  const each = a.tick % TICK_HZ === 0;
  for (const s of Object.keys(st) as Status[]) {
    const e = st[s]!;
    if (e.until <= a.tick) {
      // doom falls due: the life goes out of them (a boss loses a third)
      if (s === 'doom') wound(a, f, isBoss(f) ? Math.round(f.maxHp / 3) : f.hp);
      delete st[s];
      continue;
    }
    if (!each) continue;
    if (s === 'poison' || s === 'burn' || s === 'bleed') wound(a, f, Math.max(1, Math.round(e.power)));
    if (s === 'regen') f.hp = Math.min(f.maxHp, f.hp + Math.max(1, Math.round(e.power)));
  }
  // a skill's steady mending
  if (each && f.kit?.passive.regen) f.hp = Math.min(f.maxHp, f.hp + Math.max(1, Math.round(f.maxHp * f.kit.passive.regen)));
}

function wound(a: Arena, f: Combatant, dmg: number): void {
  f.pop = { tick: a.tick, amount: dmg, heal: false };
  f.hp = Math.max(0, f.hp - dmg);
  f.lastHit = a.tick;
  if (f.hp === 0) f.down = true;
}

/* ------------------------------------------------------------ choosing */

const foesOf = (a: Arena, f: Combatant) => a.all().filter((o) => o.side !== f.side && !o.down);
const friendsOf = (a: Arena, f: Combatant) => a.all().filter((o) => o.side === f.side && !o.down);
const fallenOf = (a: Arena, f: Combatant) => a.all().filter((o) => o.side === f.side && o.down && !o.conjured);

/** How worth it an action is right now (0: not at all). */
function worth(a: Arena, f: Combatant, act: KitAction): number {
  const foes = foesOf(a, f);
  const friends = friendsOf(a, f);
  let w = 0;
  for (const e of act.effects) {
    switch (e.kind) {
      case 'heal': {
        const low = (e.target === 'self' ? [f] : friends).filter((o) => o.hp < o.maxHp * 0.6);
        if (low.length) w = Math.max(w, 3 + (e.target === 'allies' ? low.length * 0.5 : 0));
        break;
      }
      case 'revive':
        if (fallenOf(a, f).length) w = Math.max(w, 5);
        break;
      case 'cleanse':
        if (friends.some((o) => Object.keys(o.st ?? {}).some((s) => BAD_STATUS.has(s as Status) && has(o, s as Status, a.tick)))) w = Math.max(w, 2.5);
        break;
      case 'damage':
      case 'drain':
        if (foes.length) w = Math.max(w, (e.target === 'foes' || e.target === 'random_foes' ? (foes.length >= 2 ? 2.6 : 1.4) : 2) * (e.power ?? 1) ** 0.3);
        break;
      case 'summon':
        if (a.all().filter((o) => o.side === f.side && o.conjured && !o.down).length < 3) w = Math.max(w, 2.2);
        break;
      case 'status': {
        const bad = BAD_STATUS.has(e.status!);
        const pool = bad ? foes : e.target === 'self' ? [f] : friends;
        if (pool.some((o) => !has(o, e.status!, a.tick))) w = Math.max(w, bad ? 1.8 : e.status === 'taunt' ? (friends.some((o) => o.hp < o.maxHp * 0.5) ? 2.4 : 0.8) : 1.5);
        break;
      }
      case 'dispel':
        if (foes.some((o) => Object.keys(o.st ?? {}).some((s) => !BAD_STATUS.has(s as Status)))) w = Math.max(w, 1.2);
        break;
    }
  }
  // (the greater the art, the more it's worth reaching for while it's ready)
  return w * (1 + act.level / 60);
}

/** Their turn: the most useful ready spell or skill, if any is worth it (otherwise the caller strikes as usual).
 *  Returns whether they used one. */
export function takeTurn(a: Arena, f: Combatant): boolean {
  const kit = f.kit;
  if (!kit || held(f, a.tick)) return false;
  const silenced = has(f, 'silence', a.tick);
  let best: KitAction | null = null;
  let bestW = 0;
  for (const act of kit.actions) {
    if (act.ready > a.tick || (act.spell && silenced)) continue;
    if (afraid(f, a.tick) && act.use === 'attack') continue;
    if (!canPay(f, act)) continue;
    let w = worth(a, f, act);
    // (an ultimate, once the gauge is full, is the thing to do)
    if (act.pool === 'limit' && w > 0) w += 100;
    if (w > bestW) {
      best = act;
      bestW = w;
    }
  }
  if (!best) return false;
  best.ready = a.tick + best.cooldown;
  pay(f, best);
  f.lastAction = a.tick;
  const struck = new Set<Combatant>();
  for (const e of best.effects) for (const t of apply(a, f, best, e)) struck.add(t);
  if (best.pool === 'limit') f.limit = 0; // (the ultimate's own blows don't refill the gauge)
  a.log(f, best.name, [...struck], { spell: best.spell, ult: best.pool === 'limit', cost: best.cost, pool: best.pool });
  return true;
}

/** Use one chosen spell or skill (the tactics board: the player picks it, and the arena holds only whom it's aimed at).
 *  False when it isn't ready or can't be paid for. */
export function useAction(a: Arena, f: Combatant, act: KitAction): boolean {
  if (act.ready > a.tick || !canPay(f, act) || held(f, a.tick)) return false;
  act.ready = a.tick + act.cooldown;
  pay(f, act);
  f.lastAction = a.tick;
  const struck = new Set<Combatant>();
  for (const e of act.effects) for (const t of apply(a, f, act, e)) struck.add(t);
  if (act.pool === 'limit') f.limit = 0;
  a.log(f, act.name, [...struck], { spell: act.spell, ult: act.pool === 'limit', cost: act.cost, pool: act.pool });
  return true;
}

/** What an action is for, as the board aims it: at foes, at friends, or at the one using it. */
export function aimOf(act: KitAction): 'foe' | 'friend' | 'self' {
  const t = act.effects.map((e) => e.target);
  if (t.some((x) => x === 'foe' || x === 'foes' || x === 'random_foes')) return 'foe';
  if (t.every((x) => x === 'self')) return 'self';
  return 'friend';
}

/** Whether they can afford it: the pool it draws on (none: free, as a raider's or a boss's are). */
export function canPay(f: Combatant, act: KitAction): boolean {
  if (act.pool === 'limit') return (f.limit ?? 0) >= 1;
  if (act.pool === 'mp') return f.mp === undefined || f.mp >= act.cost;
  return f.sp === undefined || f.sp >= act.cost;
}
function pay(f: Combatant, act: KitAction): void {
  if (act.pool === 'limit') f.limit = 0;
  else if (act.pool === 'mp' && f.mp !== undefined) f.mp = Math.max(0, f.mp - act.cost);
  else if (act.pool === 'sp' && f.sp !== undefined) f.sp = Math.max(0, f.sp - act.cost);
}

/** The limit gauge fills from hurt taken, and less from hurt dealt (what the blow took, not the overkill, and no more
 *  than a tenth a blow). */
export function fillLimit(to: Combatant, from: Combatant, dmg: number, before: number): void {
  const share = Math.min(dmg, before) / Math.max(1, to.maxHp);
  if (to.limit !== undefined) to.limit = Math.min(1, to.limit + share * LIMIT_FROM_HURT);
  if (from !== to && from.limit !== undefined) from.limit = Math.min(1, from.limit + Math.min(0.1, share * LIMIT_FROM_DEALT));
}

/* ------------------------------------------------------------ doing */

/** The strength behind what someone does: the middle of their blow, with their spell power for spells. */
function strength(f: Combatant, spell: boolean): number {
  const base = (f.damage[0] + f.damage[1]) / 2;
  const p = f.kit?.passive;
  return base * (1 + (spell ? (p?.power ?? 0) : (p?.damage ?? 0)));
}

function pick(a: Arena, f: Combatant, t: Target, hits = 3): Combatant[] {
  const foes = foesOf(a, f);
  const visible = foes.filter((o) => seen(o, a.tick));
  const pool = visible.length ? visible : foes;
  const friends = friendsOf(a, f);
  switch (t) {
    case 'self':
      return [f];
    case 'foes':
      return pool;
    case 'random_foes':
      return pool.length ? Array.from({ length: hits }, () => pool[a.rng.int(0, pool.length - 1)]) : [];
    case 'foe': {
      // (a foe taunting draws it; else the weakest in reach)
      const taunt = pool.find((o) => has(o, 'taunt', a.tick));
      return taunt ? [taunt] : pool.length ? [pool.reduce((x, y) => (y.hp < x.hp ? y : x))] : [];
    }
    case 'allies':
      return friends;
    case 'ally':
    case 'weakest':
      return friends.length ? [friends.reduce((x, y) => (y.hp / y.maxHp < x.hp / x.maxHp ? y : x))] : [];
    case 'fallen': {
      const fallen = fallenOf(a, f);
      return fallen.length ? [fallen[0]] : [];
    }
  }
}

/** What an element does to what a foe is: the dead fear holy light and shrug off poison and the dark; machines short
 *  out on lightning and don't sicken; beasts fear fire. */
export function elementMult(element: Element, kind: string): number {
  const n = natureOf(kind);
  if (n === 'undead') return element === 'holy' ? 1.75 : element === 'dark' || element === 'poison' ? 0.4 : element === 'fire' ? 1.2 : 1;
  if (n === 'machine') return element === 'lightning' || element === 'water' ? 1.5 : element === 'poison' || element === 'blood' ? 0.2 : 1;
  if (n === 'beast') return element === 'fire' ? 1.25 : 1;
  return 1;
}

/** One effect of an action: who it lands on, and what it does. Returns who was touched. */
function apply(a: Arena, f: Combatant, act: KitAction, e: Effect): Combatant[] {
  const p = f.kit?.passive;
  const power = strength(f, act.spell);
  switch (e.kind) {
    case 'damage':
    case 'drain': {
      const targets = pick(a, f, e.target, e.hits);
      const reps = e.target === 'random_foes' ? 1 : (e.hits ?? 1);
      for (const t of targets) {
        for (let k = 0; k < reps && !t.down; k++) {
          // (a skill's blow can miss; a spell finds its mark)
          if (!act.spell && !a.rng.chance(Math.max(0.1, aim(f, a.tick) - t.dodge))) continue;
          let dmg = power * (e.power ?? 1) * elementMult(e.element ?? 'physical', t.kind);
          if (a.rng.chance(p?.crit ?? 0)) dmg *= 2 + (p?.critDamage ?? 0);
          if (has(f, 'focus', a.tick) && act.spell) dmg *= 1.25;
          const dealt = strike(a, f, t, dmg, !act.spell && (e.element ?? 'physical') === 'physical');
          if (e.kind === 'drain') f.hp = Math.min(f.maxHp, f.hp + dealt);
        }
      }
      return targets;
    }
    case 'heal': {
      const targets = pick(a, f, e.target);
      const amount = power * (e.power ?? 1) * 1.6 * (1 + (p?.healing ?? 0) + Math.max(0, (f.attrs?.wis ?? ATTR_BASE) - ATTR_BASE) * WIS_HEALING);
      for (const t of targets) {
        t.pop = { tick: a.tick, amount: Math.min(t.maxHp - t.hp, Math.round(amount)), heal: true };
        t.hp = Math.min(t.maxHp, t.hp + Math.round(amount));
      }
      return targets;
    }
    case 'revive': {
      const targets = pick(a, f, 'fallen');
      for (const t of targets) {
        t.down = false;
        t.hp = Math.max(1, Math.round(t.maxHp * Math.min(1, e.power ?? 0.3)));
        t.st = {};
      }
      return targets;
    }
    case 'status': {
      const targets = pick(a, f, e.target);
      for (const t of targets) {
        if (e.chance !== undefined && !a.rng.chance(Math.min(1, e.chance * (1 + (f.charm ?? 0))))) continue;
        // (how strong: a poison bites for a share of the caster's strength each second; a shield turns some of it)
        const strengthOf = e.status === 'shield' ? power * (e.power ?? 1) * 3 : e.status === 'regen' ? power * (e.power ?? 1) * 0.3 : e.status === 'thorns' ? (e.power ?? 0.3) : power * (e.power ?? 1) * 0.25;
        setStatus(a, f, t, e.status!, (e.secs ?? 6) * (BAD_STATUS.has(e.status!) ? 1 : 1 + (f.charm ?? 0)), strengthOf);
      }
      return targets;
    }
    case 'cleanse': {
      const targets = pick(a, f, e.target);
      for (const t of targets) for (const s of Object.keys(t.st ?? {}) as Status[]) if (BAD_STATUS.has(s)) delete t.st![s];
      return targets;
    }
    case 'dispel': {
      const targets = pick(a, f, e.target);
      for (const t of targets) for (const s of Object.keys(t.st ?? {}) as Status[]) if (!BAD_STATUS.has(s)) delete t.st![s];
      return targets;
    }
    case 'summon': {
      const s = e.summon ? a.summon(f, e.summon) : null;
      return s ? [s] : [];
    }
  }
}

/** A blow (or a spell) lands: what a shield soaks up, protection, weakness and vulnerability, armour for a blow,
 *  reflection, thorns, the life drawn back. Returns the damage done. */
export function strike(a: Arena, from: Combatant, to: Combatant, raw: number, physical: boolean, armourDone = false): number {
  let dmg = raw;
  if (has(from, 'weak', a.tick)) dmg *= 0.7;
  if (has(from, 'inspired', a.tick)) dmg *= 1.2;
  if (has(from, 'berserk', a.tick)) dmg *= 1.3;
  const ls = from.kit?.passive.lastStand ?? 0;
  if (ls && from.hp < from.maxHp * 0.25) dmg *= 1 + ls;
  if (has(to, 'vulnerable', a.tick)) dmg *= 1.3;
  if (has(to, 'protect', a.tick)) dmg *= 0.7;
  if (physical && !armourDone) dmg *= 1 - Math.min(0.8, to.armor);
  // a spell turned back on its caster
  if (!physical && has(to, 'reflect', a.tick) && from !== to) return strike(a, to, from, dmg, false);
  dmg = Math.max(1, Math.round(dmg));
  const shield = to.st?.shield;
  if (shield && shield.until > a.tick) {
    const soak = Math.min(shield.power, dmg);
    shield.power -= soak;
    dmg -= soak;
    if (shield.power <= 0) delete to.st!.shield;
  }
  to.pop = { tick: a.tick, amount: dmg, heal: false };
  if (dmg > 0) {
    const before = to.hp;
    to.hp = Math.max(0, to.hp - dmg);
    to.lastHit = a.tick;
    fillLimit(to, from, dmg, before);
    if (to.hp === 0) to.down = true;
    // a hit sleeper wakes
    if (to.st?.sleep) delete to.st.sleep;
  }
  // thorns, a skill's or a spell's, hurt the striker back
  const thorns = (to.kit?.passive.thorns ?? 0) + (has(to, 'thorns', a.tick) ? (to.st!.thorns!.power ?? 0.3) : 0);
  if (thorns && physical && !from.down) wound(a, from, Math.max(1, Math.round(dmg * thorns)));
  // the life drawn back with a blow
  const steal = (from.kit?.passive.lifesteal ?? 0) + (has(from, 'lifelink', a.tick) ? 0.3 : 0);
  if (steal) from.hp = Math.min(from.maxHp, from.hp + Math.round(dmg * steal));
  return dmg;
}
