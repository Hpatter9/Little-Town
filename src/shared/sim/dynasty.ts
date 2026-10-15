// Generations and dynasties (data/dynasty.ts; the owner's ask: a long game should read as a family saga). `s.dynasty`
// (`DynastyState`) holds it all, and `dynastyHourly` (from sim.ts; off with the autopilot, and on a side stream of its
// own, `${seed}:dynasty:${tick}`, so it never draws from the town's) does the work once a day at dawn.
//  - Upbringing: each day a child lives, the town's weather is noted (`Rearing`: raids lived through, hungry days, the
//    days of good trade); at coming of age (`applyUpbringing`, from lineage.ts `comeOfAge`) that and their parents'
//    callings lean their skills and nature (`leansOf`): raids toward the fighting callings, famine toward the plough
//    and thrift, a trading town toward trade, casters' children toward the arcane. A lean, never a rule.
//  - Houses are the family lines of lineage.ts (`lineGroups`), named for their founder (`houseName`).
//  - Feuds: a killing, theft, assault or a jilting between two houses starts one (`feudFrom`); the children inherit it
//    because it belongs to the house. Its people's opinion of each other sinks daily (so they brawl, and refuse to go
//    on trips together as enemies do), and now and then a brawl, a sabotage or a refusal to work is told. A marriage
//    across it, a shared ordeal (a raid, a famine) or a council's ruling ends it. Houses that fight a raid side by side
//    grow bonds (`Bond`): their people warm to each other, the young of each begin well-liked by the other.
//  - The ruling house (`RulingHouse`): the founder's line to begin with. Its strength (`strengthOf`: levels, titles,
//    foes felled, coin, land, less scandal and debt) sets its stage (rising, peak, declining); a house that stays
//    much stronger for long enough takes the seat; one without a living member dies out. The heir (`heirOfHouse`) is
//    watched: losing them in a raid or in the dark is a crisis (`dynastyDeath`) the whole town feels.
//  - Heirlooms: a unique or Epic piece worn by someone of a family is the family's (`Heirloom`): it passes to the heir
//    at a death, carries its story, and losing it is a blow to the house.
// The Families tab (renderer/panel/familyPanel.ts) shows it (`dynastyView`), and the year's chronicle tells it.

import { ITEM_BY_ID } from '../data/items';
import { CLASS_DEFS } from '../data/classes';
import { COUPLE } from '../data/social';
import { gradeOf } from '../data/quality';
import {
  BOND_DECLARED, BOND_KEPT, BOND_MAX, BOND_NEWCOMER, BOND_RAID, BOND_WARM, COUNCIL_END, CRISIS_DAYS, CRISIS_SHARE, DECLINE_BELOW, DYNASTY_LOG_MOST, FALL_DAYS, FALL_SORE, FEUD_FLOOR, FEUD_HEAT,
  FEUD_HEAT_MAX, FEUD_INCIDENT_DIV, FEUD_INCIDENT_HEAT, FEUD_KEPT, FEUD_MOST, FEUD_PRESSURE, FEUD_START, HEIR_MORALE, HEIR_MORALE_DAYS, HEIRLOOM_GRADE, HEIRLOOM_LOST_DAYS, HEIRLOOM_LOST_SORE, HEIRLOOM_MISSING_DAYS,
  HEIRLOOM_STORY_MOST, HEIRLOOMS_MOST, HUNGER_DAYS_FULL, HUNGRY_BELLY, HUNGRY_SHARE, JILT_CHANCE, LEAN_DEFS, LEAN_LEAST, LEANS, LEANS_MOST, type LeanId, NATURE_LEAN, ORDEAL_END, PARENT_LEAN, RAIDS_FULL,
  RISE_DAYS, RISE_LEAST, RISE_MARGIN, SCANDAL_DAYS, SCANDAL_STRENGTH, STAGE_TEXT, TRADE_AVG_FULL, TRADE_DAY_COINS, YOUNG_DAYS,
} from '../data/dynasty';
import { natureOf } from '../data/natures';
import { hashSeed, Rng } from '../rng';
import { heirOfEstate, lineGroups, lineRenown, type KinRecord } from './lineage';
import { adjust, brawl, isChild, opinion } from './social';
import { notify, tireless, type GameState, type Person } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { politicsOf } from './politics';

/** What a child has lived through so far. */
export interface Rearing {
  raids: number;
  hunger: number;
  trade: number;
  days: number;
}

export interface Feud {
  /** The two houses (their roots), a the aggrieved or first. */
  a: number;
  b: number;
  since: number;
  heat: number;
  why: string;
  incidents: number;
  ended?: { day: number; how: string };
}

export interface Bond {
  a: number;
  b: number;
  since: number;
  strength: number;
  why: string;
  declared?: boolean;
}

export interface Heirloom {
  item: string;
  /** The house it belongs to (its root). */
  house: number;
  since: number;
  /** Generations that have carried it (this town's, plus any it came with). */
  carried: number;
  /** Who has it now: a person's id, or null when it lies in the town's store. */
  holder: number | null;
  story: string[];
  /** Days it has been out of the family's hands. */
  missing?: number;
  lost?: { day: number; why: string };
}

export interface RulingHouse {
  /** A person of the house (its root, or the founder before they have a line): the house is whatever line they are in. */
  anchor: number;
  since: number;
  peak: number;
  peakDay: number;
  stage: 'rising' | 'peak' | 'declining';
  stageDay: number;
  strength: number;
  heir?: number | null;
  challenger?: { house: number; days: number };
  crisisUntil?: number;
  crisis?: string;
  scandalUntil?: number;
}

export interface Reign {
  name: string;
  from: number;
  to: number;
  fate: string;
}

export interface DynastyState {
  rearing: Record<number, Rearing>;
  feuds: Feud[];
  bonds: Bond[];
  heirlooms: Heirloom[];
  ruling?: RulingHouse;
  past: Reign[];
  log: { tick: number; day: number; text: string }[];
  seenRaid?: number;
  seenCouncil?: number;
}

export const dynastyOf = (s: GameState): DynastyState => (s.dynasty ??= { rearing: {}, feuds: [], bonds: [], heirlooms: [], past: [], log: [] });

const day = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY) + 1;
const off = (s: GameState) => s.autopilot === false;

function note(s: GameState, text: string, key = true): void {
  const d = dynastyOf(s);
  d.log.push({ tick: s.tick, day: day(s), text });
  if (d.log.length > DYNASTY_LOG_MOST) d.log.splice(0, d.log.length - DYNASTY_LOG_MOST);
  notify(s, text, key);
}

/* ------------------------------------------------------------ the houses */

export interface Houses {
  /** Everyone in a family line, to their line's root. */
  of: Map<number, number>;
  roots: number[];
}

export function housesOf(s: GameState): Houses {
  const of = new Map<number, number>();
  const roots: number[] = [];
  for (const { root, gen } of lineGroups(s)) {
    roots.push(root);
    for (const id of gen.keys()) if (!of.has(id)) of.set(id, root);
  }
  return { of, roots };
}

/** A person's house root: their line's, else (a lone founder) themselves. */
export const rootOf = (h: Houses, id: number) => h.of.get(id) ?? id;

export function houseName(s: GameState, root: number): string {
  const name = s.kin?.[root]?.name ?? s.people.find((p) => p.id === root)?.name ?? s.fallen?.find((f) => f.id === root)?.name ?? 'the founder';
  return `House of ${name}`;
}

const livingOf = (s: GameState, h: Houses, root: number) => s.people.filter((p) => rootOf(h, p.id) === root);
const adultsOf = (s: GameState, h: Houses, root: number) => livingOf(s, h, root).filter((p) => !isChild(p));

/** Whether a house is a family (more than a lone person). */
const isFamily = (h: Houses, id: number) => h.of.has(id);

/* ------------------------------------------------------------ upbringing */

const MARTIAL = new Set(['tank', 'bruiser', 'striker', 'shooter']);
const ARCANE = new Set(['caster', 'healer']);

/** What a parent's calling (and skills) lean a child to. */
function parentLeans(s: GameState, id: number): LeanId[] {
  const q = s.people.find((x) => x.id === id);
  const cls = q ? q.cls : (s.kin?.[id]?.calling as Person['cls']);
  const out: LeanId[] = [];
  if (cls && CLASS_DEFS[cls]) {
    const role = CLASS_DEFS[cls].role;
    if (MARTIAL.has(role)) out.push('fight');
    if (ARCANE.has(role)) out.push('magic');
    if (cls === 'bard' || cls === 'dancer') out.push('trade');
    if (cls === 'druid') out.push('farm');
  }
  if (q) {
    if ((q.skills.social?.level ?? 0) >= 8 || s.buildings.some((b) => b.owner === q.id && b.shop)) out.push('trade');
    if ((q.skills.farming?.level ?? 0) >= 6) out.push('farm');
  }
  return out;
}

export interface Lean {
  lean: LeanId;
  strength: number;
}

/** How strongly each lean pulls on a child (0..1): what the town put them through while they grew up, and their
 *  parents' callings. Only the strongest few that clear LEAN_LEAST show. */
export function leansOf(s: GameState, p: Person): Lean[] {
  const r = s.dynasty?.rearing[p.id];
  const rear: Record<LeanId, number> = {
    fight: r ? Math.min(1, r.raids / RAIDS_FULL) : 0,
    farm: r ? Math.min(1, r.hunger / HUNGER_DAYS_FULL) : 0,
    trade: r && r.days >= 4 ? Math.min(1, r.trade / r.days / TRADE_AVG_FULL) : 0,
    magic: 0,
  };
  const from: Record<LeanId, number> = { fight: 0, farm: 0, trade: 0, magic: 0 };
  for (const id of p.parents ?? []) for (const l of parentLeans(s, id)) from[l] += PARENT_LEAN;
  return LEANS.map((lean) => ({ lean, strength: Math.min(1, rear[lean] + from[lean] * 0.6) }))
    .filter((l) => l.strength >= LEAN_LEAST)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, LEANS_MOST);
}

/** Coming of age: the lean of their upbringing, the family's feuds and friendships. Returns the lines to tell. */
export function applyUpbringing(s: GameState, p: Person): string[] {
  if (off(s)) return [];
  const out: string[] = [];
  const g = new Rng(hashSeed(`${s.seed}:dynasty:up:${p.id}`));
  const leans = leansOf(s, p);
  leans.forEach((l, i) => {
    const def = LEAN_DEFS[l.lean];
    for (const [k, n] of Object.entries(def.skills)) p.skills[k as keyof Person['skills']].level += Math.round((n ?? 0) * l.strength);
    if (l.strength >= 0.5 && !p.passions.includes(def.passion) && p.passions.length < 3) p.passions.push(def.passion);
    if (i === 0 && g.chance(l.strength * NATURE_LEAN) && !def.natures.includes(natureOf(p).id)) p.nature = g.pick(def.natures);
    out.push(`a lean toward ${def.name}, ${def.raised}`);
  });
  delete s.dynasty?.rearing[p.id];
  // the house's feuds and friendships are theirs from the first
  const d = s.dynasty;
  if (d && (d.feuds.length || d.bonds.length)) {
    const h = housesOf(s);
    const mine = rootOf(h, p.id);
    for (const f of d.feuds) {
      if (f.ended || (f.a !== mine && f.b !== mine)) continue;
      const other = f.a === mine ? f.b : f.a;
      for (const q of livingOf(s, h, other)) if (!isChild(q)) adjust(s, p.id, q.id, -30);
      out.push(`the feud with the ${houseName(s, other)}`);
    }
    for (const b of d.bonds) {
      if (!b.declared || (b.a !== mine && b.b !== mine)) continue;
      const other = b.a === mine ? b.b : b.a;
      for (const q of livingOf(s, h, other)) if (!isChild(q)) adjust(s, p.id, q.id, BOND_NEWCOMER);
      out.push(`the favour of the ${houseName(s, other)}`);
    }
  }
  return out;
}

/** Each day a child lives, what the town is going through is noted for them. */
function rearChildren(s: GameState, hungry: boolean, trade: number): void {
  const d = dynastyOf(s);
  const kids = new Set<number>();
  for (const c of s.people) {
    if (!isChild(c)) continue;
    kids.add(c.id);
    const r = (d.rearing[c.id] ??= { raids: 0, hunger: 0, trade: 0, days: 0 });
    r.days++;
    if (hungry) r.hunger++;
    r.trade += trade;
  }
  for (const k of Object.keys(d.rearing)) if (!kids.has(Number(k))) delete d.rearing[Number(k)];
}

/* ------------------------------------------------------------ feuds */

const feudOf = (d: DynastyState, a: number, b: number) => d.feuds.find((f) => !f.ended && ((f.a === a && f.b === b) || (f.a === b && f.b === a)));
const bondOf = (d: DynastyState, a: number, b: number) => d.bonds.find((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a));

/** Start a feud between two houses (or stoke one that burns). */
export function startFeud(s: GameState, a: number, b: number, why: string, heat: number): void {
  const d = dynastyOf(s);
  if (a === b) return;
  const had = feudOf(d, a, b);
  if (had) {
    had.heat = Math.min(FEUD_HEAT_MAX, had.heat + heat / 2);
    return;
  }
  if (d.feuds.filter((f) => !f.ended).length >= FEUD_MOST) return;
  d.feuds.push({ a, b, since: day(s), heat, why, incidents: 0 });
  // (the two houses' grown-ups sour on each other at once)
  const h = housesOf(s);
  for (const x of adultsOf(s, h, a)) for (const y of adultsOf(s, h, b)) if (x.partner !== y.id) adjust(s, x.id, y.id, FEUD_START);
  const bond = bondOf(d, a, b);
  if (bond) bond.strength = Math.max(0, bond.strength - 40);
  note(s, `A feud begins between the ${houseName(s, a)} and the ${houseName(s, b)}: ${why}.`);
  trimFeuds(d);
}

function trimFeuds(d: DynastyState): void {
  const ended = d.feuds.filter((f) => f.ended);
  if (ended.length > FEUD_KEPT) for (const f of ended.slice(0, ended.length - FEUD_KEPT)) d.feuds.splice(d.feuds.indexOf(f), 1);
}

function endFeud(s: GameState, f: Feud, how: string): void {
  f.ended = { day: day(s), how };
  const d = dynastyOf(s);
  note(s, `The feud between the ${houseName(s, f.a)} and the ${houseName(s, f.b)} is ended by ${how}.`);
  if (!bondOf(d, f.a, f.b)) d.bonds.push({ a: f.a, b: f.b, since: day(s), strength: 12, why: 'made peace' });
}

/** A wrong done by one person to another (from politics.ts `crime`): between two families it starts a feud. */
export function feudFrom(s: GameState, culprit: Person, victim: Person, kind: keyof typeof FEUD_HEAT): void {
  if (off(s)) return;
  const h = housesOf(s);
  if (!isFamily(h, culprit.id) || !isFamily(h, victim.id)) return;
  const a = rootOf(h, victim.id);
  const b = rootOf(h, culprit.id);
  if (a === b) return;
  const what: Record<string, string> = { murder: `${culprit.name} killed ${victim.name}`, assault: `${culprit.name} beat ${victim.name}`, theft: `${culprit.name} robbed ${victim.name}`, jilted: `${culprit.name} left ${victim.name} for another`, vandalism: `${culprit.name} wrecked ${victim.name}'s property`, sentence: `${culprit.name} went free` };
  startFeud(s, a, b, what[kind] ?? `${culprit.name} wronged ${victim.name}`, FEUD_HEAT[kind]);
}

function feudDay(s: GameState, h: Houses, f: Feud, rng: Rng, ordeal: { fought: Set<number>; hungryShare: number; died: number } | null, councilMet: boolean): void {
  const A = livingOf(s, h, f.a);
  const B = livingOf(s, h, f.b);
  if (!A.length || !B.length) {
    f.ended = { day: day(s), how: 'one house dying out' };
    return;
  }
  // a marriage across it ends it
  for (const a of A) {
    const b = B.find((q) => q.id === a.partner && a.married);
    if (b) return endFeud(s, f, `the marriage of ${a.name} and ${b.name}`);
  }
  // a council's ruling, a shared ordeal
  if (councilMet && rng.chance(COUNCIL_END)) return endFeud(s, f, 'the council\'s ruling');
  if (ordeal && A.some((p) => ordeal.fought.has(p.id)) && B.some((p) => ordeal.fought.has(p.id)) && rng.chance(ORDEAL_END * (ordeal.died ? 1.5 : 1))) return endFeud(s, f, 'what they went through together');
  if (ordeal && ordeal.hungryShare >= 0.4 && rng.chance(ORDEAL_END / 2)) return endFeud(s, f, 'the hungry year they shared');
  // bad blood: opinions sink
  for (const a of A) {
    if (a.away !== null) continue;
    for (const b of B) {
      if (b.away !== null || a.partner === b.id || (isChild(a) && isChild(b))) continue;
      if (opinion(s, a.id, b.id) > FEUD_FLOOR) adjust(s, a.id, b.id, FEUD_PRESSURE);
    }
  }
  if (!rng.chance(f.heat / FEUD_INCIDENT_DIV)) return;
  const here = (x: Person) => x.away === null && !x.downed && !isChild(x);
  const as = A.filter(here);
  const bs = B.filter(here);
  if (!as.length || !bs.length) return;
  const a = as[rng.int(0, as.length - 1)];
  const b = bs[rng.int(0, bs.length - 1)];
  f.incidents++;
  f.heat = Math.min(FEUD_HEAT_MAX, f.heat + FEUD_INCIDENT_HEAT);
  const kind = rng.weighted({ brawl: 3, sabotage: 2, refuse: 3 });
  if (kind === 'brawl') {
    brawl(s, a, b);
  } else if (kind === 'sabotage') {
    const prop = s.buildings.find((bd) => bd.owner === b.id && bd.status === 'done');
    if (prop) {
      if (prop.hp !== undefined) prop.hp = Math.max(1, prop.hp * 0.8);
      note(s, `Someone of the ${houseName(s, f.a)} has been at ${b.name}'s property in the night: the feud with the ${houseName(s, f.b)} runs on.`, false);
    } else {
      const n = Math.min(b.coins ?? 0, rng.int(5, 15));
      if (n <= 0) return;
      b.coins = (b.coins ?? 0) - n;
      a.coins = (a.coins ?? 0) + n;
      note(s, `${b.name} finds ${n} coins gone from their purse. Nobody asks whose fault it is; everybody knows.`, false);
    }
  } else if (!a.breakdown) {
    a.breakdown = { kind: 'sulk', until: s.tick + 4 * TICKS_PER_HOUR };
    a.task = null;
    note(s, `${a.name} will not work beside ${b.name}, and stalks off. The feud between their houses is the town's business now.`, false);
  }
}

/** A jilting: an unmarried partner leaves for someone they warm to more. */
function jilt(s: GameState, h: Houses, rng: Rng): void {
  for (const a of s.people) {
    const b = a.partner == null ? undefined : s.people.find((q) => q.id === a.partner);
    if (!b || a.id > b.id || a.married || a.away !== null || b.away !== null) continue;
    if (!rng.chance(JILT_CHANCE)) continue;
    const leaver = rng.chance(0.5) ? a : b;
    const left = leaver === a ? b : a;
    const c = s.people.filter((q) => q !== leaver && q !== left && !isChild(q) && q.partner == null && !tireless(q) && q.away === null).sort((x, y) => opinion(s, leaver.id, y.id) - opinion(s, leaver.id, x.id))[0];
    if (!c || opinion(s, leaver.id, c.id) < COUPLE - 20 || opinion(s, leaver.id, c.id) <= opinion(s, leaver.id, left.id)) continue;
    leaver.partner = c.id;
    c.partner = leaver.id;
    left.partner = null;
    adjust(s, left.id, leaver.id, -50);
    left.sore = { until: s.tick + 3 * TICKS_PER_DAY, value: -10, text: `Left by ${leaver.name}` };
    notify(s, `${leaver.name} has left ${left.name} for ${c.name}.`, true);
    feudFrom(s, leaver, left, 'jilted');
    void h;
  }
}

/* ------------------------------------------------------------ the ruling house */

/** A house's strength: its people's worth (levels, titles, foes felled, coin, land), less its scandal and debt. */
export function strengthOf(s: GameState, h: Houses, root: number): number {
  let t = 0;
  for (const m of livingOf(s, h, root)) {
    if (isChild(m)) {
      t += 2;
      continue;
    }
    const owned = s.buildings.filter((b) => b.owner === m.id).length;
    t += (m.level ?? 1) + (m.titles?.length ?? 0) * 5 + (m.felled ?? 0) * 0.5 + Math.min(30, (m.coins ?? 0) / 20) + owned * 3 + (m.guard ? 2 : 0) + (m.id === s.mainId ? 12 : 0);
    t -= Math.min(15, (m.debt ?? 0) / 10);
    if (s.kin?.[m.id]?.black) t -= 12;
  }
  // (what the dead earned, remembered a little)
  const dead = Object.values(s.kin ?? {}).filter((r) => rootOf(h, r.id) === root && !s.people.some((p) => p.id === r.id)) as KinRecord[];
  return Math.max(0, t + lineRenown(dead) * 0.1);
}

const effective = (s: GameState, r: RulingHouse, base: number) => base * (r.crisisUntil && s.tick < r.crisisUntil ? 1 - CRISIS_SHARE : 1) - (r.scandalUntil && s.tick < r.scandalUntil ? SCANDAL_STRENGTH : 0);

/** The house's head: the leader if they're of it, else the most levelled grown-up. */
export function headOfHouse(s: GameState, h: Houses, root: number): Person | undefined {
  const a = adultsOf(s, h, root);
  return a.find((p) => p.id === s.mainId) ?? [...a].sort((x, y) => (y.level ?? 1) - (x.level ?? 1) || x.id - y.id)[0];
}

/** The head's heir: their eldest grown child at home, else partner, else a child (lineage.ts), else the house's best other. */
export function heirOfHouse(s: GameState, h: Houses, root: number): Person | undefined {
  const head = headOfHouse(s, h, root);
  if (!head) return undefined;
  const e = heirOfEstate(s, head);
  if (e && rootOf(h, e.id) === root) return e;
  return livingOf(s, h, root).filter((p) => p !== head).sort((x, y) => Number(isChild(x)) - Number(isChild(y)) || (y.level ?? 1) - (x.level ?? 1) || x.id - y.id)[0];
}

function beginRule(s: GameState, anchor: number, why: string | null): RulingHouse {
  const d = dynastyOf(s);
  d.ruling = { anchor, since: day(s), peak: 0, peakDay: day(s), stage: 'rising', stageDay: day(s), strength: 0 };
  if (why) note(s, why);
  return d.ruling;
}

function fallSore(s: GameState, h: Houses, root: number, text: string): void {
  for (const p of livingOf(s, h, root)) if (!isChild(p)) p.sore = { until: s.tick + FALL_DAYS * TICKS_PER_DAY, value: FALL_SORE, text };
}

function rulingDay(s: GameState, h: Houses): void {
  const d = dynastyOf(s);
  const leader = s.people.find((p) => p.id === s.mainId);
  if (!d.ruling) {
    if (!leader) return;
    beginRule(s, leader.id, null);
    d.log.push({ tick: s.tick, day: day(s), text: `The House of ${leader.name} begins its rule.` });
  }
  const r = d.ruling!;
  let root = rootOf(h, r.anchor);
  const members = livingOf(s, h, root);
  if (!members.length) {
    // the house has died out: the seat goes to the leader's line, else the strongest
    const strongest = h.roots.map((x) => ({ x, v: strengthOf(s, h, x) })).filter((x) => livingOf(s, h, x.x).length).sort((a, b) => b.v - a.v || a.x - b.x)[0];
    const next = leader ? rootOf(h, leader.id) : strongest?.x;
    d.past.push({ name: houseName(s, root), from: r.since, to: day(s), fate: 'died out' });
    if (next === undefined) {
      d.ruling = undefined;
      return;
    }
    beginRule(s, next, `The ${houseName(s, root)} has died out. The ${houseName(s, next)} takes its place at the head of the town.`);
    return;
  }
  r.anchor = root;
  const str = strengthOf(s, h, root);
  const eff = effective(s, r, str);
  r.strength = Math.round(eff);
  if (eff > r.peak) {
    r.peak = eff;
    r.peakDay = day(s);
  }
  // the stage (it changes at most every few days)
  const young = day(s) - r.since < YOUNG_DAYS || day(s) - r.peakDay < YOUNG_DAYS;
  const stage: RulingHouse['stage'] = young ? 'rising' : eff < r.peak * DECLINE_BELOW ? 'declining' : 'peak';
  if (stage !== r.stage && day(s) - r.stageDay >= 4) {
    r.stage = stage;
    r.stageDay = day(s);
    if (stage === 'peak') note(s, `The ${houseName(s, root)} is at the height of its power.`);
    else if (stage === 'declining') note(s, `The ${houseName(s, root)} is in decline: ${decline(s, h, root)}.`);
    else note(s, `The ${houseName(s, root)} is rising again.`);
  }
  r.heir = heirOfHouse(s, h, root)?.id ?? null;
  // a rival house, stronger by far for long enough, takes the seat
  let best: { x: number; v: number } | undefined;
  for (const x of h.roots) {
    if (x === root || adultsOf(s, h, x).length < 2) continue;
    const v = strengthOf(s, h, x);
    if (!best || v > best.v) best = { x, v };
  }
  if (best && best.v >= RISE_LEAST && best.v > eff * RISE_MARGIN) {
    r.challenger = r.challenger?.house === best.x ? { house: best.x, days: r.challenger.days + 1 } : { house: best.x, days: 1 };
    if (r.challenger.days >= RISE_DAYS) {
      const how = bestWay(s, h, best.x);
      d.past.push({ name: houseName(s, root), from: r.since, to: day(s), fate: `overthrown by the ${houseName(s, best.x)}` });
      fallSore(s, h, root, 'Their house has lost the seat');
      beginRule(s, best.x, `The ${houseName(s, best.x)} has come to rule, ${how}. The ${houseName(s, root)} is cast down.`);
      (s.marks ??= []).push({ lever: 'morale', value: -3, until: s.tick + 2 * TICKS_PER_DAY, text: 'The seat has changed hands' });
      root = best.x;
    }
  } else r.challenger = undefined;
}

/** What is wrong with a house in decline, in words. */
function decline(s: GameState, h: Houses, root: number): string {
  const m = livingOf(s, h, root);
  const adults = m.filter((p) => !isChild(p));
  const why: string[] = [];
  if (adults.length < 2) why.push('too few grown hands');
  if (adults.some((p) => s.kin?.[p.id]?.black)) why.push('scandal');
  if (adults.some((p) => (p.debt ?? 0) > 50)) why.push('debt');
  if (adults.length && adults.reduce((n, p) => n + (p.level ?? 1), 0) / adults.length < 6) why.push('weak heirs');
  return why.length ? why.join(', ') : 'its great days are behind it';
}

/** How a challenger came to the seat, by what it has most of. */
function bestWay(s: GameState, h: Houses, root: number): string {
  const a = adultsOf(s, h, root);
  const wealth = a.reduce((n, p) => n + (p.coins ?? 0) / 20 + s.buildings.filter((b) => b.owner === p.id).length * 3, 0);
  const arms = a.reduce((n, p) => n + (p.felled ?? 0) * 0.5 + (p.level ?? 1), 0);
  const standing = a.reduce((n, p) => n + (p.titles?.length ?? 0) * 5 + (p.skills.social?.level ?? 0), 0);
  const top = Math.max(wealth, arms, standing);
  return top === wealth ? 'by its wealth' : top === arms ? 'by force of arms' : 'by the weight of its name in council';
}

/* ------------------------------------------------------------ deaths, scandals */

/** Someone dies (from killPerson, before their gear leaves them): their heirloom passes, and the heir's fall is felt. */
export function dynastyDeath(s: GameState, p: Person, cause: string): void {
  if (off(s)) return;
  const d = s.dynasty;
  if (!d) return;
  const h = housesOf(s);
  // heirlooms
  for (const l of d.heirlooms) {
    if (l.holder !== p.id) continue;
    const slot = Object.entries(p.gear).find(([, id]) => id === l.item)?.[0] as keyof Person['gear'] | undefined;
    const heir = p.away === null ? heirOfEstate(s, p) : undefined;
    if (p.away !== null || !slot) {
      loseHeirloom(s, h, l, `lost with ${p.name} on the road`);
      continue;
    }
    l.carried++;
    if (heir && !isChild(heir)) {
      const was = heir.gear[slot];
      if (was) s.items[was] = (s.items[was] ?? 0) + 1;
      heir.gear[slot] = l.item;
      const q = (p.gearQ as Record<string, number> | undefined)?.[slot];
      if (q !== undefined) ((heir.gearQ ??= {}) as Record<string, number>)[slot] = q;
      delete p.gear[slot];
      l.holder = heir.id;
      addStory(l, s, `Passed to ${heir.name} when ${p.name} died ${cause}.`);
      note(s, `The ${ITEM_BY_ID[l.item]?.name ?? 'heirloom'} of the ${houseName(s, l.house)} passes to ${heir.name}.`);
    } else {
      s.items[l.item] = (s.items[l.item] ?? 0) + 1; // (kept in the family's chest)
      delete p.gear[slot];
      l.holder = null;
      addStory(l, s, `Laid by in the family chest when ${p.name} died ${cause}.`);
    }
  }
  // the ruling house's heir
  const r = d.ruling;
  if (!r) return;
  const root = rootOf(h, r.anchor);
  if (rootOf(h, p.id) !== root) return;
  if (p.id === r.heir) {
    r.crisisUntil = s.tick + CRISIS_DAYS * TICKS_PER_DAY;
    r.crisis = `${p.name}, the heir, died ${cause}`;
    (s.marks ??= []).push({ lever: 'morale', value: HEIR_MORALE, until: s.tick + HEIR_MORALE_DAYS * TICKS_PER_DAY, text: `${p.name}, heir of the ${houseName(s, root)}, is dead` });
    const next = livingOf(s, h, root).filter((q) => q !== p && !isChild(q)).length;
    note(s, `The heir of the ${houseName(s, root)} is dead: ${p.name} died ${cause}. ${next ? 'The line holds, but shaken.' : 'The line hangs by a thread.'}`);
  } else if (headOfHouse(s, h, root) === p) {
    const next = heirOfHouse(s, h, root);
    const after = livingOf(s, h, root).filter((q) => q !== p);
    if (next && next !== p) note(s, `${next.name} takes up the headship of the ${houseName(s, root)} after ${p.name}.`);
    else if (!after.length) note(s, `${p.name} was the last of the ${houseName(s, root)}.`);
  }
}

/** A black sheep named in the ruling house is a scandal. */
export function dynastyScandal(s: GameState, p: Person, why: string): void {
  if (off(s)) return;
  const r = s.dynasty?.ruling;
  if (!r) return;
  const h = housesOf(s);
  if (rootOf(h, p.id) !== rootOf(h, r.anchor)) return;
  r.scandalUntil = s.tick + SCANDAL_DAYS * TICKS_PER_DAY;
  note(s, `Scandal in the ${houseName(s, rootOf(h, r.anchor))}: ${p.name} ${why}.`);
}

/* ------------------------------------------------------------ heirlooms */

function addStory(l: Heirloom, s: GameState, text: string): void {
  l.story.push(`Day ${day(s)}: ${text}`);
  if (l.story.length > HEIRLOOM_STORY_MOST) l.story.splice(1, l.story.length - HEIRLOOM_STORY_MOST);
}

function loseHeirloom(s: GameState, h: Houses, l: Heirloom, why: string): void {
  if (l.lost) return;
  l.lost = { day: day(s), why };
  l.holder = null;
  addStory(l, s, `Lost: ${why}.`);
  for (const p of livingOf(s, h, l.house)) if (!isChild(p)) p.sore = { until: s.tick + HEIRLOOM_LOST_DAYS * TICKS_PER_DAY, value: HEIRLOOM_LOST_SORE, text: `The ${ITEM_BY_ID[l.item]?.name ?? 'heirloom'} is gone` };
  note(s, `The ${ITEM_BY_ID[l.item]?.name ?? 'heirloom'} of the ${houseName(s, l.house)} is lost (${why}). The family takes it hard.`);
}

function heirloomsDay(s: GameState, h: Houses): void {
  const d = dynastyOf(s);
  // new ones: a unique or an Epic piece worn by someone of a family
  for (const p of s.people) {
    if (isChild(p) || !isFamily(h, p.id)) continue;
    for (const [slot, id] of Object.entries(p.gear)) {
      if (!id || !ITEM_BY_ID[id] || d.heirlooms.some((l) => l.item === id) || d.heirlooms.length >= HEIRLOOMS_MOST) continue;
      if (!ITEM_BY_ID[id].unique && gradeOf((p.gearQ as Record<string, number> | undefined)?.[slot]) < HEIRLOOM_GRADE) continue;
      const anc = s.ancestry?.heirloom?.item === id ? s.ancestry.heirloom : undefined;
      const l: Heirloom = { item: id, house: rootOf(h, p.id), since: day(s), carried: anc?.carried ?? 0, holder: p.id, story: [] };
      addStory(l, s, `First carried by ${p.name} of the ${houseName(s, l.house)}${anc ? `, having come down through ${anc.carried} generation${anc.carried === 1 ? '' : 's'} before this town${anc.cursed ? ', and something dark clings to it' : ''}` : ''}.`);
      d.heirlooms.push(l);
      note(s, `The ${ITEM_BY_ID[id].name} is becoming the ${houseName(s, l.house)}'s heirloom.`, false);
    }
  }
  for (const l of d.heirlooms) {
    const wearer = s.people.find((p) => Object.values(p.gear).includes(l.item));
    const inStore = (s.items[l.item] ?? 0) > 0;
    const family = wearer ? rootOf(h, wearer.id) === l.house : false;
    if (family || (!wearer && inStore)) {
      if (l.lost) {
        addStory(l, s, 'Found again.');
        l.lost = undefined;
      }
      l.missing = 0;
      const to = wearer?.id ?? null;
      if (to !== l.holder) {
        if (wearer && l.holder !== null) addStory(l, s, `Now carried by ${wearer.name}.`);
        l.holder = to;
      }
    } else if (!l.lost) {
      // (in other hands, or gone altogether)
      l.missing = (l.missing ?? 0) + 1;
      if (l.missing >= HEIRLOOM_MISSING_DAYS) loseHeirloom(s, h, l, wearer ? `now in the hands of ${wearer.name}` : 'sold or taken, and gone from the town');
    }
  }
}

/* ------------------------------------------------------------ the day */

/** Once a day at dawn: the town's weather noted for the children, then feuds, bonds, the ruling house and heirlooms. */
export function dynastyHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || off(s) || s.gameOver || calendar(s.tick).hour !== 5) return;
  if (!s.people.length) return;
  const d = dynastyOf(s);
  const rng = new Rng(hashSeed(`${s.seed}:dynasty:${s.tick}`));
  const h = housesOf(s);
  // the day's weather
  const hungry = s.people.filter((p) => p.needs.food < HUNGRY_BELLY).length / s.people.length;
  const led = s.ledger?.yesterday;
  const trade = Math.min(1, ((led?.trade ?? 0) + (led?.shop ?? 0) + (led?.goods ?? 0) + (led?.realm ?? 0)) / TRADE_DAY_COINS);
  rearChildren(s, hungry >= HUNGRY_SHARE, trade);
  // a raid since the last dawn: who fought, and what they went through together
  let ordeal: { fought: Set<number>; hungryShare: number; died: number } | null = null;
  const recap = s.raidRecap;
  if (recap && recap.tick !== d.seenRaid) {
    if (d.seenRaid !== undefined || s.tick - recap.tick < 2 * TICKS_PER_DAY) {
      const fought = new Set(recap.rows.filter((r) => r.dealt > 0 || r.kills > 0 || r.fell).map((r) => r.id));
      ordeal = { fought, hungryShare: hungry, died: recap.rows.filter((r) => r.died).length };
      for (const id of Object.keys(d.rearing)) d.rearing[Number(id)].raids++;
      raidBonds(s, h, recap.rows.filter((r) => fought.has(r.id)).map((r) => r.id), recap.name);
      for (const l of d.heirlooms) {
        const row = recap.rows.find((r) => r.id === l.holder);
        if (row && (row.kills > 0 || row.fell)) addStory(l, s, `Carried by ${s.people.find((p) => p.id === row.id)?.name ?? 'its holder'} through ${recap.name}${row.kills ? `, and ${row.kills} raider${row.kills === 1 ? '' : 's'} fell to it` : ''}.`);
      }
    }
    d.seenRaid = recap.tick;
  } else if (hungry >= 0.4) ordeal = { fought: new Set(), hungryShare: hungry, died: 0 };
  const lastCouncil = s.politics ? politicsOf(s).lastCouncil : undefined;
  const councilMet = lastCouncil !== undefined && lastCouncil !== d.seenCouncil;
  d.seenCouncil = lastCouncil;
  // feuds
  for (const f of d.feuds) if (!f.ended) feudDay(s, h, f, rng, ordeal, councilMet);
  jilt(s, h, rng);
  // bonds: the favour of allied houses
  for (const b of d.bonds) {
    if (!b.declared) {
      if (b.strength >= BOND_DECLARED) {
        b.declared = true;
        note(s, `The ${houseName(s, b.a)} and the ${houseName(s, b.b)} stand together now, ${b.why}.`);
      }
      continue;
    }
    for (const x of livingOf(s, h, b.a)) for (const y of livingOf(s, h, b.b)) if (x.away === null && y.away === null && opinion(s, x.id, y.id) < 70) adjust(s, x.id, y.id, BOND_WARM);
  }
  if (d.bonds.length > BOND_KEPT) d.bonds = d.bonds.filter((b) => b.declared || b.strength > 0).slice(-BOND_KEPT);
  rulingDay(s, h);
  heirloomsDay(s, h);
}

/** Houses that fought a raid side by side grow a bond. */
function raidBonds(s: GameState, h: Houses, fighters: number[], name: string): void {
  const d = dynastyOf(s);
  const count = new Map<number, number>();
  for (const id of fighters) if (isFamily(h, id)) count.set(rootOf(h, id), (count.get(rootOf(h, id)) ?? 0) + 1);
  const houses = [...count.keys()].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || a - b).slice(0, 4);
  for (let i = 0; i < houses.length; i++)
    for (let j = i + 1; j < houses.length; j++) {
      const a = houses[i];
      const b = houses[j];
      if (feudOf(d, a, b)) continue;
      const bond = bondOf(d, a, b) ?? (d.bonds[d.bonds.push({ a, b, since: day(s), strength: 0, why: `since they fought ${name} side by side` }) - 1]);
      bond.strength = Math.min(BOND_MAX, bond.strength + BOND_RAID);
    }
}

/* ------------------------------------------------------------ the views */

export interface DynastyView {
  ruling: null | {
    root: number;
    name: string;
    since: number;
    stage: RulingHouse['stage'];
    stageText: string;
    strength: number;
    peak: number;
    head: string | null;
    heir: string | null;
    living: number;
    crisis: string | null;
    scandal: boolean;
    challenger: string | null;
  };
  past: Reign[];
  feuds: { a: string; b: string; aRoot: number; bRoot: number; why: string; since: number; heat: number; incidents: number; ended: { day: number; how: string } | null }[];
  bonds: { a: string; b: string; aRoot: number; bRoot: number; why: string; strength: number; declared: boolean }[];
  heirlooms: { item: string; house: string; houseRoot: number; holder: string | null; carried: number; story: string[]; lost: string | null }[];
  log: { day: number; text: string }[];
}

export function dynastyView(s: GameState): DynastyView | null {
  const d = s.dynasty;
  if (!d || off(s)) return null;
  const h = housesOf(s);
  const r = d.ruling;
  const root = r ? rootOf(h, r.anchor) : 0;
  const head = r ? headOfHouse(s, h, root) : undefined;
  const heir = r?.heir != null ? s.people.find((p) => p.id === r.heir) : undefined;
  const ch = r?.challenger;
  return {
    ruling: r
      ? {
          root,
          name: houseName(s, root),
          since: r.since,
          stage: r.stage,
          stageText: STAGE_TEXT[r.stage],
          strength: r.strength,
          peak: Math.round(r.peak),
          head: head?.name ?? null,
          heir: heir?.name ?? null,
          living: livingOf(s, h, root).length,
          crisis: r.crisisUntil && s.tick < r.crisisUntil ? (r.crisis ?? null) : null,
          scandal: !!r.scandalUntil && s.tick < r.scandalUntil,
          challenger: ch && ch.days > 0 ? houseName(s, ch.house) : null,
        }
      : null,
    past: d.past.slice(-6),
    feuds: d.feuds.map((f) => ({ a: houseName(s, f.a), b: houseName(s, f.b), aRoot: f.a, bRoot: f.b, why: f.why, since: f.since, heat: Math.round(f.heat), incidents: f.incidents, ended: f.ended ?? null })),
    bonds: d.bonds.filter((b) => b.declared).map((b) => ({ a: houseName(s, b.a), b: houseName(s, b.b), aRoot: b.a, bRoot: b.b, why: b.why, strength: Math.round(b.strength), declared: true })),
    heirlooms: d.heirlooms.map((l) => ({ item: ITEM_BY_ID[l.item]?.name ?? l.item, house: houseName(s, l.house), houseRoot: l.house, holder: l.holder == null ? null : (s.people.find((p) => p.id === l.holder)?.name ?? null), carried: l.carried, story: l.story, lost: l.lost ? l.lost.why : null })),
    log: d.log.slice(-12).map((e) => ({ day: e.day, text: e.text })),
  };
}

/** The dynasty's year, for the chronicle: what befell the houses since `since` (a tick). */
export function dynastyYearLines(s: GameState, since: number): string[] {
  const d = s.dynasty;
  if (!d || off(s)) return [];
  const lines = d.log.filter((e) => e.tick >= since && !/begins its rule/.test(e.text)).map((e) => e.text);
  const r = d.ruling;
  const out = lines.length > 4 ? [...lines.slice(0, 2), ...lines.slice(-2)] : lines;
  if (r && s.kin && Object.keys(s.kin).length > 0 && !out.length) {
    const h = housesOf(s);
    out.push(`The ${houseName(s, rootOf(h, r.anchor))} holds the town, ${STAGE_TEXT[r.stage]}.`);
  }
  return out;
}
