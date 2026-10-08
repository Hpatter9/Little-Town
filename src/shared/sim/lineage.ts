// Schools, apprenticeships and family trees (data/lineage.ts; the owner's pick of the content updates, the eighth).
// Children learn: of a morning they go to lessons (`lessonTask`: at the school, else a study (the elder lodge, a
// library), else by the fire with the elders), and from some way through childhood they're apprenticed to a master of
// a parent's trade (`apprentice`: the best grown-up in town at it) and follow them at their work of an afternoon. The
// hours count (`Person.schooled`, `Person.apprenticed`, credited hourly by `lineageHourly`), and at coming of age
// (`comeOfAge`, from growUp in social.ts) they're made good: levels of learning, levels of the trade up to a share of
// the master's, a parent's traits and nature now and then, and the family's grudges (a parent's enemies). Everyone
// with kin is kept in a record (`s.kin`: names, parents, born, died, why they're the black sheep), so the family trees
// reach back past the dead; a line's renown (`lineRenown`: its members' titles, foes felled, levels, less its black
// sheep) makes it famous. When someone dies their land and purse go to their heir (`inherit`, from killPerson: the
// eldest grown child at home, else the partner, else a child). The People menu's Families tab draws the trees
// (`familiesView`, `snapshot.families`).

import {
  APPRENTICE_FROM,
  APPRENTICE_FROM_SHARE,
  APPRENTICE_HOURS_PER_LEVEL,
  APPRENTICE_SHARE,
  APPRENTICE_UNTIL,
  FAMOUS_AT,
  INHERIT_NATURE,
  INHERIT_TRAIT,
  INHERIT_TRAITS_MOST,
  INHERITED_GRUDGE,
  KIN_MOST,
  LESSON_FROM,
  LESSON_HOURS_PER_LEVEL,
  LESSON_LEVELS_MOST,
  LESSON_UNTIL,
  RENOWN_BLACK,
  RENOWN_FELLED,
  RENOWN_LEVEL,
  RENOWN_TITLE,
  SCHOOL_PACE,
} from '../data/lineage';
import { BUILDING_BY_ID } from '../data/buildings';
import { SKILLS, type Skill } from '../data/skills';
import { CHILD_HOURS } from '../data/social';
import { hashSeed, Rng } from '../rng';
import { buildingDoor } from './buildings';
import { adjust, enemiesOf, isChild } from './social';
import type { Pt } from './land';
import { campXY, notify, type Building, type GameState, type Person } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export interface KinRecord {
  id: number;
  name: string;
  parents: number[];
  /** The day they were born in town (or came, for those who came grown), and the day they died and how. */
  born: number;
  died?: { day: number; cause: string };
  female: boolean;
  /** Why they're the family's black sheep (a crime, an exile). */
  black?: string;
  /** Their calling and level, titles and foes felled, last seen (for the dead). */
  calling?: string | null;
  level?: number;
  titles?: string[];
  felled?: number;
}

const day = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY) + 1;
const levelOf = (p: Person, k: Skill) => p.skills[k]?.level ?? 0;
export const bestSkill = (p: Person): Skill => [...SKILLS].sort((a, b) => levelOf(p, b) - levelOf(p, a))[0];

/** Someone's record, made when first needed and kept up to date while they live. */
export function kinOf(s: GameState, p: Person): KinRecord {
  const kin = (s.kin ??= {});
  const r = (kin[p.id] ??= { id: p.id, name: p.name, parents: [...(p.parents ?? [])], born: isChild(p) ? day(s) : day(s), female: p.look.gender === 'f' });
  r.name = p.name;
  r.calling = p.cls ?? null;
  r.level = p.level ?? 1;
  if (p.titles?.length) r.titles = [...p.titles];
  if (p.felled) r.felled = p.felled;
  return r;
}

/** A child born: them and both parents into the record. */
export function recordBirth(s: GameState, child: Person, a: Person, b: Person): void {
  kinOf(s, a);
  kinOf(s, b);
  kinOf(s, child).born = day(s);
}

/** A death: marked in the record (if they had kin), and their land and purse to their heir. */
export function recordDeath(s: GameState, p: Person, cause: string): void {
  const kin = s.kin ?? {};
  const hasKin = !!kin[p.id] || s.people.some((q) => q.parents?.includes(p.id)) || (p.parents?.length ?? 0) > 0;
  if (hasKin) kinOf(s, p).died = { day: day(s), cause };
  inherit(s, p);
  trimKin(s);
}

/** Marked the family's black sheep (a crime caught, an exile). */
export function blackSheep(s: GameState, p: Person, why: string): void {
  kinOf(s, p).black = why;
}

/** Who inherits from someone: the eldest grown child at home, else their partner, else any child of theirs. */
export function heirOfEstate(s: GameState, p: Person): Person | undefined {
  const kids = s.people.filter((q) => q !== p && q.parents?.includes(p.id)).sort((a, b) => a.id - b.id);
  return kids.find((q) => !isChild(q) && q.away === null) ?? s.people.find((q) => q.id === p.partner && q !== p) ?? kids[0];
}

/** Their buildings and coins go to their heir; with no heir, the buildings to the town. */
export function inherit(s: GameState, p: Person): { heir: Person | null; buildings: Building[]; coins: number } {
  const owned = s.buildings.filter((b) => b.owner === p.id);
  const coins = Math.floor(p.coins ?? 0);
  const heir = heirOfEstate(s, p) ?? null;
  if (heir) {
    for (const b of owned) b.owner = heir.id;
    if (coins > 0) heir.coins = (heir.coins ?? 0) + coins;
    if (owned.length || coins > 0) {
      const what = [owned.length ? owned.map((b) => `the ${BUILDING_BY_ID[b.def]?.name.toLowerCase() ?? 'land'}`).join(', ') : '', coins > 0 ? `${coins} coins` : ''].filter(Boolean).join(' and ');
      notify(s, `${heir.name} inherits ${what} from ${p.name}.`, true);
    }
  } else for (const b of owned) b.owner = undefined;
  p.coins = 0;
  return { heir, buildings: owned, coins };
}

function trimKin(s: GameState): void {
  const kin = s.kin ?? {};
  const ids = Object.keys(kin).map(Number);
  if (ids.length <= KIN_MOST) return;
  // (forget the oldest dead whose children are all gone from the record too)
  const living = new Set(s.people.map((p) => p.id));
  const needed = new Set<number>();
  for (const r of Object.values(kin)) for (const q of r.parents) needed.add(q);
  for (const id of ids.sort((a, b) => a - b)) {
    if (Object.keys(kin).length <= KIN_MOST) break;
    if (!living.has(id) && !needed.has(id)) delete kin[id];
  }
}

/* ------------------------------------------------------------ learning */

/** Where lessons are held: the school, else a study (the elder lodge, a library, a college), else the fire. */
export function lessonPlace(s: GameState): Building | null {
  const done = s.buildings.filter((b) => b.status === 'done');
  return done.find((b) => b.def === 'school') ?? done.find((b) => /librar|elder|college|universit|scriptor|academy/.test(b.def)) ?? null;
}

const childShare = (s: GameState, p: Person) => (p.bornTick == null ? 1 : (s.tick - p.bornTick) / (CHILD_HOURS * TICKS_PER_HOUR));

/** Their master: the best grown-up in town at their trade (kept while they're at home and able). */
export function masterOf(s: GameState, p: Person): Person | null {
  if (!isChild(p) || childShare(s, p) < APPRENTICE_FROM_SHARE) return null;
  const now = p.master != null ? s.people.find((q) => q.id === p.master) : undefined;
  if (now && now.away === null && !now.downed && !isChild(now)) return now;
  return null;
}

/** A child is apprenticed: their trade a parent's best skill (else their passion), their master the best at it. */
export function apprentice(s: GameState, p: Person): Person | null {
  if (!isChild(p) || childShare(s, p) < APPRENTICE_FROM_SHARE) return null;
  const have = masterOf(s, p);
  if (have) return have;
  const parents = s.people.filter((q) => p.parents?.includes(q.id) && !isChild(q));
  const trade: Skill = (p.trade as Skill | undefined) ?? (parents.length ? bestSkill(parents.sort((a, b) => levelOf(b, bestSkill(b)) - levelOf(a, bestSkill(a)))[0]) : (p.passions[0] ?? 'crafting'));
  const master = s.people.filter((q) => !isChild(q) && q.away === null && !q.downed && q.id !== p.id && levelOf(q, trade) >= 2).sort((a, b) => levelOf(b, trade) - levelOf(a, trade))[0];
  if (!master) return null;
  const first = p.master == null;
  p.trade = trade;
  p.master = master.id;
  if (first) notify(s, `${p.name} is apprenticed to ${master.name} to learn ${trade}.`);
  return master;
}

/** What a child should be doing now: lessons of a morning, at their master's side of an afternoon. */
export function childTask(s: GameState, p: Person): { type: 'lesson'; building: number | null } | { type: 'apprentice'; master: number } | null {
  if (!isChild(p) || p.away !== null || s.raid) return null;
  const h = calendar(s.tick).hour;
  if (h >= LESSON_FROM && h < LESSON_UNTIL) return { type: 'lesson', building: lessonPlace(s)?.id ?? null };
  if (h >= APPRENTICE_FROM && h < APPRENTICE_UNTIL) {
    const m = apprentice(s, p);
    if (m) return { type: 'apprentice', master: m.id };
  }
  return null;
}

/** Where a child sits at lessons: a spot before the door (or round the fire), their own by their id. */
export function lessonSpot(s: GameState, p: Person, building: number | null): Pt {
  const b = building == null ? undefined : s.buildings.find((q) => q.id === building);
  const at = b ? buildingDoor(b) : campXY(s);
  const a = (p.id * 2.399) % (Math.PI * 2);
  return { x: at.x + Math.cos(a) * 26, y: at.y + 14 + Math.abs(Math.sin(a)) * 18 };
}

/** Each hour: lessons and apprenticeships counted. */
export function lineageHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  for (const p of s.people) {
    if (!isChild(p) || p.away !== null) continue;
    const t = p.task;
    if (t?.type === 'lesson' && p.activity === 'research') {
      const b = t.building == null ? undefined : s.buildings.find((q) => q.id === t.building);
      p.schooled = (p.schooled ?? 0) + (b?.def === 'school' ? SCHOOL_PACE : 1);
    } else if (t?.type === 'apprentice' && p.activity !== 'walk') p.apprenticed = (p.apprenticed ?? 0) + 1;
  }
}

/** Coming of age: what their schooling, their master and their parents gave them. Returns the lines to tell. */
export function comeOfAge(s: GameState, p: Person): string[] {
  const out: string[] = [];
  const g = new Rng(hashSeed(`${s.seed}:age:${p.id}`));
  const learned = Math.min(LESSON_LEVELS_MOST, Math.floor((p.schooled ?? 0) / LESSON_HOURS_PER_LEVEL));
  if (learned) {
    const into: Skill[] = ['research', 'social', p.passions[0] ?? 'crafting'];
    for (let i = 0; i < learned; i++) p.skills[into[i % into.length]].level += 1;
    out.push(`${learned} level${learned > 1 ? 's' : ''} of learning`);
  }
  const master = p.master == null ? undefined : s.people.find((q) => q.id === p.master);
  const trade = p.trade as Skill | undefined;
  if (trade && p.apprenticed) {
    const cap = Math.max(1, Math.floor((master ? levelOf(master, trade) : 4) * APPRENTICE_SHARE));
    const gain = Math.min(cap, Math.floor(p.apprenticed / APPRENTICE_HOURS_PER_LEVEL));
    if (gain > 0) {
      p.skills[trade].level = Math.max(p.skills[trade].level, p.skills[trade].level + gain);
      if (!p.passions.includes(trade)) p.passions.push(trade);
      out.push(`${trade} from ${master?.name ?? 'their late master'}`);
    }
  }
  const parents = s.people.filter((q) => p.parents?.includes(q.id));
  const recs = (p.parents ?? []).map((id) => s.kin?.[id]).filter(Boolean) as KinRecord[];
  // a parent's traits now and then, and a parent's nature
  let took = 0;
  for (const q of parents)
    for (const t of q.traits)
      if (took < INHERIT_TRAITS_MOST && !p.traits.includes(t) && g.chance(INHERIT_TRAIT)) {
        p.traits.push(t);
        took++;
      }
  if (took) out.push(`${took === 1 ? 'a trait' : 'traits'} from their parents`);
  const natured = parents.filter((q) => q.nature);
  if (natured.length && g.chance(INHERIT_NATURE)) {
    p.nature = g.pick(natured).nature!;
    out.push(`their ${natured.length > 1 ? 'parent' : natured[0].look.gender === 'f' ? "mother" : 'father'}'s nature`);
  }
  // the family's grudges: a parent's enemies (and their children) are theirs
  const grudges = new Set<number>();
  for (const q of parents) for (const e of enemiesOf(s, q)) if (e.id !== p.id && !p.parents?.includes(e.id)) grudges.add(e.id);
  for (const id of grudges) {
    adjust(s, p.id, id, INHERITED_GRUDGE);
    for (const k of s.people) if (k.parents?.includes(id) && k.id !== p.id) adjust(s, p.id, k.id, INHERITED_GRUDGE / 2);
  }
  if (grudges.size) out.push(`the family's grudge against ${[...grudges].map((id) => s.people.find((q) => q.id === id)?.name).filter(Boolean).join(' and ')}`);
  if (!recs.length && !parents.length) return out;
  kinOf(s, p);
  return out;
}

/* ------------------------------------------------------------ the lines */

/** A line's renown: its members' titles, foes felled and levels, less its black sheep. */
export function lineRenown(members: KinRecord[]): number {
  return members.reduce((t, r) => t + (r.titles?.length ?? 0) * RENOWN_TITLE + (r.felled ?? 0) * RENOWN_FELLED + (r.level ?? 1) * RENOWN_LEVEL + (r.black ? RENOWN_BLACK : 0), 0);
}

export interface KinNode {
  id: number;
  name: string;
  parents: number[];
  alive: boolean;
  child: boolean;
  female: boolean;
  died: string | null;
  black: string | null;
  calling: string | null;
  level: number;
  titles: string[];
  /** The generation (0 the line's founders). */
  gen: number;
  partner: number | null;
  master: string | null;
  trade: string | null;
}

export interface FamilyLine {
  /** Named for its eldest founder. */
  name: string;
  root: number;
  renown: number;
  famous: boolean;
  living: number;
  generations: number;
  members: KinNode[];
  blackSheep: string[];
}

/** Every family with children: the descendants of each founding couple, by generation. */
export function familiesView(s: GameState): FamilyLine[] {
  const kin = s.kin ?? {};
  for (const p of s.people) if (kin[p.id]) kinOf(s, p);
  const recs = Object.values(kin);
  const byId = new Map(recs.map((r) => [r.id, r]));
  const childrenOf = new Map<number, number[]>();
  for (const r of recs) for (const q of r.parents) childrenOf.set(q, [...(childrenOf.get(q) ?? []), r.id]);
  const living = new Map(s.people.map((p) => [p.id, p]));
  // the founders: those with no parents in the record who have children; a couple is one line (named for the elder)
  const hasParents = (id: number) => !!byId.get(id)?.parents.some((x) => byId.has(x));
  // (someone who married into a line isn't a line's founder: every child of theirs has a parent of the line)
  const marriedIn = (r: KinRecord) => (childrenOf.get(r.id) ?? []).every((c) => byId.get(c)!.parents.some((q) => q !== r.id && hasParents(q)));
  const roots = recs.filter((r) => !hasParents(r.id) && childrenOf.has(r.id) && !marriedIn(r));
  const seen = new Set<number>();
  const lines: FamilyLine[] = [];
  for (const root of roots.sort((a, b) => a.id - b.id)) {
    if (seen.has(root.id)) continue;
    const gen = new Map<number, number>();
    const partners = new Set<number>([root.id]);
    for (const c of childrenOf.get(root.id) ?? []) for (const q of byId.get(c)?.parents ?? []) if (!byId.get(q)?.parents.some((x) => byId.has(x))) partners.add(q);
    for (const q of partners) {
      gen.set(q, 0);
      seen.add(q);
    }
    const queue = [...partners];
    while (queue.length) {
      const id = queue.shift()!;
      for (const c of childrenOf.get(id) ?? []) {
        if (gen.has(c)) continue;
        gen.set(c, (gen.get(id) ?? 0) + 1);
        queue.push(c);
        // (a child's other parent, married in, stands in the child's parents' generation)
        for (const q of byId.get(c)?.parents ?? []) if (!gen.has(q)) gen.set(q, gen.get(id) ?? 0);
      }
    }
    const members = [...gen.keys()].map((id) => byId.get(id)).filter((r): r is KinRecord => !!r);
    const nodes: KinNode[] = members.map((r) => {
      const p = living.get(r.id);
      return {
        id: r.id,
        name: r.name,
        parents: r.parents.filter((q) => gen.has(q)),
        alive: !!p,
        child: !!p && isChild(p),
        female: r.female,
        died: r.died ? `died day ${r.died.day}, ${r.died.cause}` : null,
        black: r.black ?? null,
        calling: r.calling ?? null,
        level: r.level ?? 1,
        titles: r.titles ?? [],
        gen: gen.get(r.id) ?? 0,
        partner: p?.partner ?? null,
        master: p?.master != null ? living.get(p.master)?.name ?? null : null,
        trade: p?.trade ?? null,
      };
    });
    const renown = lineRenown(members);
    lines.push({
      name: `the line of ${root.name}`,
      root: root.id,
      renown,
      famous: renown >= FAMOUS_AT,
      living: nodes.filter((n) => n.alive).length,
      generations: Math.max(...nodes.map((n) => n.gen)) + 1,
      members: nodes,
      blackSheep: nodes.filter((n) => n.black).map((n) => n.name),
    });
  }
  return lines.sort((a, b) => b.renown - a.renown);
}
