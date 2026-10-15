// Dynasties and legacy (the owner's pick): a town that falls, or that the player sets aside for a new one, becomes a
// legend (`legendOf`): its founder, how long it lasted, how many it held and lost, its heroes and an heirloom. The
// legends are kept on the device across towns (the phone page: renderer/legends.ts), the Chronicle's Hall of Legends
// lists them, and a new town may be founded by a descendant of one (`inherit`): the heirloom comes down to them, with a
// little of the old house's coin and renown, and the town remembers the line (`s.lineage`).

import { ITEM_BY_ID } from '../data/items';
import { levelOf, stageOf } from '../data/levels';
import { callingName } from '../data/founderClasses';
import type { Era } from '../data/eras';
import type { OriginId } from '../data/origins';
import { gradeOf } from '../data/quality';
import { foundAncestry } from './ancestors';
import { notify, type GameState } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export interface Legend {
  id: string;
  founder: string;
  origin: OriginId;
  era: Era;
  days: number;
  people: number;
  dead: number;
  fate: 'fell' | 'won' | 'retired';
  heroes: { name: string; calling: string | null; level: number; felled: number; fell: boolean; cause?: string }[];
  /** An item that comes down to a descendant (a unique held in the town, else the founder's weapon). */
  heirloom?: string;
  /** How many generations had carried the heirloom before this town ended (its +N), its grade, and whether it was
   *  cursed (sim/ancestors.ts). Older legends have none: a first heirloom. */
  heirloomCarried?: number;
  heirloomGrade?: number;
  cursed?: boolean;
  /** The legend this town's founder came of (its id), and the line's founders before this one, oldest first. */
  parent?: string;
  forebears?: string[];
  /** The town's name, if it voted one. */
  town?: string;
  /** The founder's calling and level when the town ended (they may not be among its heroes). */
  founderCalling?: string | null;
  founderLevel?: number;
  renown: number;
  /** How many towns the line has founded before this one (1 for a first). */
  generation: number;
  /** The line it came of, if any. */
  of?: string;
  /** When it ended (ms since 1970: set by whoever keeps it). */
  ended: number;
}

/** A town too young to be remembered. */
export const LEGEND_LEAST_HOURS = 24;
/** What a descendant brings: coins a generation, and a share of the old house's renown as the venues' fame. */
export const INHERIT_COINS = 40;
export const INHERIT_RENOWN = 0.1;

export function legendOf(s: GameState, ended: number): Legend | null {
  if (s.tick < LEGEND_LEAST_HOURS * TICKS_PER_HOUR) return null;
  const founder = s.people.find((p) => p.id === s.mainId) ?? s.people[0];
  const living = s.people.filter((p) => p.bornTick == null).map((p) => ({ name: p.name, calling: callingName(p, stageOf(p)), level: levelOf(p), felled: p.felled ?? 0, fell: false }));
  const fallen = (s.fallen ?? []).map((f) => ({ name: f.name, calling: f.calling, level: f.level, felled: f.felled, fell: true, cause: f.cause }));
  const heroes = [...living, ...fallen].sort((a, b) => b.level * 3 + b.felled - (a.level * 3 + a.felled)).slice(0, 3);
  const held = s.people.flatMap((p) => Object.values(p.gear)).filter((id): id is string => !!id && !!ITEM_BY_ID[id]);
  // (the line's own heirloom first, while the town still has it)
  const kept = s.ancestry?.heirloom?.item;
  const heirloom = (kept && (held.includes(kept) || (s.items[kept] ?? 0) > 0) ? kept : undefined) ?? held.find((id) => ITEM_BY_ID[id].unique) ?? Object.keys(s.items).find((id) => s.items[id] > 0 && ITEM_BY_ID[id]?.unique) ?? (founder?.gear.weapon && ITEM_BY_ID[founder.gear.weapon] ? founder.gear.weapon : undefined);
  const days = Math.floor(s.tick / TICKS_PER_DAY);
  // (an heirloom already carried keeps its count and its curse, unless the curse was lifted)
  const anc = s.ancestry;
  const same = heirloom && anc?.heirloom?.item === heirloom ? anc.heirloom : undefined;
  const holder = heirloom ? s.people.find((p) => Object.values(p.gear).includes(heirloom)) : undefined;
  const slot = holder ? Object.entries(holder.gear).find(([, id]) => id === heirloom)?.[0] : undefined;
  const q = holder && slot ? (holder.gearQ as Record<string, number> | undefined)?.[slot] : heirloom ? s.itemQ?.[heirloom]?.[0] : undefined;
  const dead = s.fallen?.length ?? 0;
  return {
    id: `${s.seed}:${s.tick}`,
    founder: founder?.name ?? 'A founder',
    origin: s.origin ?? 'settlers',
    era: s.era,
    days,
    people: s.people.length,
    dead,
    fate: s.gameOver ? (s.gameOver.won ? 'won' : 'fell') : 'retired',
    heroes,
    ...(heirloom ? { heirloom, heirloomCarried: same?.carried ?? 0, heirloomGrade: gradeOf(q), ...(same?.cursed ? { cursed: true } : {}) } : {}),
    ...(s.lineage ? { parent: s.lineage.from } : {}),
    ...(anc ? { forebears: anc.forebears } : {}),
    ...(s.townName ? { town: s.townName } : {}),
    ...(founder ? { founderCalling: callingName(founder, stageOf(founder)), founderLevel: levelOf(founder) } : {}),
    renown: Math.round(days * 2 + s.people.length * 3 + (s.uniques?.length ?? 0) * 10 + (s.delved ? Object.keys(s.delved).length * 8 : 0)),
    generation: (s.lineage?.generation ?? 0) + 1,
    ...(s.lineage ? { of: s.lineage.of } : {}),
    ended,
  };
}

/** A town founded by a descendant of a legend: the heirloom, coin and renown come down, and the line is remembered. */
export function inherit(s: GameState, l: Legend): void {
  const founder = s.people.find((p) => p.id === s.mainId) ?? s.people[0];
  s.lineage = { of: l.of ?? `${l.founder}'s line`, founder: l.founder, generation: l.generation, from: l.id };
  s.coins = (s.coins ?? 0) + INHERIT_COINS * l.generation;
  if (l.heirloom && ITEM_BY_ID[l.heirloom]) s.items[l.heirloom] = (s.items[l.heirloom] ?? 0) + 1;
  for (const b of s.buildings) if (b.shop) b.shop.renown = (b.shop.renown ?? 0) + Math.round(l.renown * INHERIT_RENOWN);
  s.inherited = Math.round(l.renown * INHERIT_RENOWN);
  const a = foundAncestry(s, l); // (the forebears, the heirloom's strength and curse, the old town: sim/ancestors.ts)
  (s.marks ??= []).push({ lever: 'morale', value: 4, until: s.tick + 3 * TICKS_PER_DAY, text: `Proud of ${l.founder}'s line` });
  const fate = l.fate === 'fell' ? `whose town fell after ${l.days} days` : l.fate === 'won' ? 'who triumphed' : `whose town stood ${l.days} days`;
  notify(
    s,
    `${founder?.name ?? 'The founder'} is of ${l.founder}'s line (the ${ordinal(l.generation + 1)} generation), ${fate}.${l.heirloom && ITEM_BY_ID[l.heirloom] ? ` The ${ITEM_BY_ID[l.heirloom].name} has come down to them${a.heirloom && a.heirloom.carried > 1 ? `, stronger for the ${a.heirloom.carried} generations that have carried it` : ''}${a.heirloom?.cursed ? ', and something dark clings to it' : ''}.` : ''}${a.oldTown === 'power' ? ' The old town still stands: the Old House, kin to this one.' : ''}`,
    true,
  );
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

/** How a legend reads in a line. */
export function legendLine(l: Legend): string {
  const fate = l.fate === 'fell' ? `fell after ${l.days} day${l.days === 1 ? '' : 's'}` : l.fate === 'won' ? `triumphed on day ${l.days}` : `stood ${l.days} day${l.days === 1 ? '' : 's'}`;
  return `${l.founder}'s town ${fate}: ${l.people} living at the end, ${l.dead} dead.`;
}

/** A line of descent through the legends: its name and its towns, first founder to last (`legends` in any order).
 *  A legend whose parent isn't kept starts a line of its own under the line's name. */
export interface LegendLine {
  name: string;
  towns: Legend[];
  /** The founders, oldest first, including those whose towns are no longer kept. */
  founders: string[];
}

export function linesOf(legends: readonly Legend[]): LegendLine[] {
  const byId = new Map(legends.map((l) => [l.id, l]));
  const kids = new Map<string, Legend[]>();
  const roots: Legend[] = [];
  for (const l of legends) {
    if (l.parent && byId.has(l.parent)) {
      const list = kids.get(l.parent) ?? [];
      list.push(l);
      kids.set(l.parent, list);
    } else roots.push(l);
  }
  const lines: LegendLine[] = [];
  const walk = (l: Legend, chain: Legend[]) => {
    const next = [...chain, l];
    const under = (kids.get(l.id) ?? []).sort((a, b) => a.ended - b.ended);
    if (!under.length) {
      const first = next[0];
      lines.push({ name: first.of ?? `${first.founder}'s line`, towns: next, founders: [...(first.forebears ?? []), ...next.map((x) => x.founder)] });
    } else for (const k of under) walk(k, next);
  };
  for (const r of roots.sort((a, b) => a.ended - b.ended)) walk(r, []);
  return lines.sort((a, b) => b.towns.at(-1)!.ended - a.towns.at(-1)!.ended);
}
