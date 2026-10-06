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
  heroes: { name: string; calling: string | null; level: number; felled: number; fell: boolean }[];
  /** An item that comes down to a descendant (a unique held in the town, else the founder's weapon). */
  heirloom?: string;
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
  const fallen = (s.fallen ?? []).map((f) => ({ name: f.name, calling: f.calling, level: f.level, felled: f.felled, fell: true }));
  const heroes = [...living, ...fallen].sort((a, b) => b.level * 3 + b.felled - (a.level * 3 + a.felled)).slice(0, 3);
  const held = s.people.flatMap((p) => Object.values(p.gear)).filter((id): id is string => !!id && !!ITEM_BY_ID[id]);
  const heirloom = held.find((id) => ITEM_BY_ID[id].unique) ?? Object.keys(s.items).find((id) => s.items[id] > 0 && ITEM_BY_ID[id]?.unique) ?? (founder?.gear.weapon && ITEM_BY_ID[founder.gear.weapon] ? founder.gear.weapon : undefined);
  const days = Math.floor(s.tick / TICKS_PER_DAY);
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
    ...(heirloom ? { heirloom } : {}),
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
  (s.marks ??= []).push({ lever: 'morale', value: 4, until: s.tick + 3 * TICKS_PER_DAY, text: `Proud of ${l.founder}'s line` });
  const fate = l.fate === 'fell' ? `whose town fell after ${l.days} days` : l.fate === 'won' ? 'who triumphed' : `whose town stood ${l.days} days`;
  notify(
    s,
    `${founder?.name ?? 'The founder'} is of ${l.founder}'s line (the ${ordinal(l.generation + 1)} generation), ${fate}.${l.heirloom && ITEM_BY_ID[l.heirloom] ? ` The ${ITEM_BY_ID[l.heirloom].name} has come down to them.` : ''}`,
    true,
  );
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

/** How a legend reads in a line. */
export function legendLine(l: Legend): string {
  const fate = l.fate === 'fell' ? `fell after ${l.days} day${l.days === 1 ? '' : 's'}` : l.fate === 'won' ? `triumphed on day ${l.days}` : `stood ${l.days} day${l.days === 1 ? '' : 's'}`;
  return `${l.founder}'s town ${fate}: ${l.people} living at the end, ${l.dead} dead.`;
}
