// The choice events' kit: the effect and event types, the shorthands the event files are written with, and the
// `when` helpers (the events themselves are in events.ts and moreEvents*.ts).
import type { GameState } from '../sim/state';
import { calendar, type Season } from '../sim/time';
import { ageDays, lifespanOf } from '../sim/ageing';
import { seaTown } from '../sim/sea';
import type { Biome } from './biomes';
import { ERAS, type Era } from './eras';
import type { Stock } from './materials';
import type { Skill } from './skills';
import type { OriginId } from './origins';

/** What an event's mark can push: the same levers origins and research use (sim/origin.ts). */
export type Lever = 'work' | 'build' | 'crops' | 'forage' | 'research' | 'craft' | 'travellers' | 'prices' | 'fight' | 'guard';

export type EventEffect =
  | { note: string }
  /** Everyone's morale, this much, for so many game hours. */
  | { mood: number; hours: number; text: string }
  /** A lever multiplied, for so many game hours. */
  | { mod: Lever; mult: number; hours: number; text: string }
  | { gain: Stock }
  /** A share of the town's food, of everything in store, or of its coins, lost. */
  | { take: 'food' | 'stores' | 'coins'; share: number }
  | { coins: number }
  | { renown: number }
  | { reputation: number }
  /** Newcomers (a type from data/people.ts, or a wanderer of any sort). */
  | { join: number; type?: string }
  /** The event's person, or someone at random, leaves; dies (with a chance); is hurt (or everyone is). The founder is
   *  never picked at random to leave or die. */
  | { leave: 'who' | 'random' }
  | { kill: 'who' | 'random'; chance?: number; cause: string }
  | { wound: 'who' | 'random' | 'all'; hp: number }
  /** So many fall sick (the plague's sickness). */
  | { sick: number }
  /** The next raid comes within so many game hours; or none comes for so many. */
  | { raid: number }
  | { calm: number }
  /** Seconds of work on the topic being researched. */
  | { research: number }
  /** The Occult is revealed. */
  | { occult: string }
  | { chance: number; then: EventEffect[]; else?: EventEffect[] }
  /** Effects that come after so many game hours (only at the top of an answer). */
  | { later: number; effects: EventEffect[] }
  /* ---- the fateful events' (fatefulEvents.ts) */
  /** So many buildings set alight; so many pulled down. */
  | { burn: number }
  | { ruin: number }
  /** A share of the grown-ups leave the town (never the founder). */
  | { exodus: number }
  /** A share of the grown-ups fall sick. */
  | { sickShare: number }
  /** So many topics learned outright (the one being studied first, then whatever is open). */
  | { learn: number }
  /** Everyone mended. */
  | { heal: number }
  /** Every pen emptied (the herds slaughtered: the food is in the event's `gain`). */
  | { herdLoss: number }
  /* ---- events with weight (PLAN.md step 6) */
  /** A share of the grown-ups held to one job for so many game hours (they eat, and otherwise toil on: a fireline cut,
   *  the town's goods hauled to safety), at the town's edge or by the fire. */
  | { busy: number; share: number; text: string; anim?: 'chop' | 'build' | 'mine'; at?: 'edge' | 'camp' }
  /** Another event follows: put to the player as soon as this one is done (a fire that spreads). */
  | { follow: string }
  /* ---- events with purpose (each answer does something you can point to) */
  /** Levels of a skill learned: by the event's person (else someone at random), the founder, or every grown-up. */
  | { skill: Skill; levels: number; on?: 'who' | 'random' | 'founder' | 'all' }
  /** What the event's person (else someone at random) and the founder (or another at random) think of each other. */
  | { bond: number; with?: 'founder' | 'random' }
  /** A trait taken on by the event's person (else someone at random). */
  | { trait: string }
  /** Items into the stores (gear, wares, furnishings), handed out as the town hands out gear. */
  | { item: string; count: number }
  /** Horses for the town's stable. */
  | { horse: number }
  /** A building's blueprint laid down with its makings delivered: it only wants building (else the makings). */
  | { build: string };

export interface EventOption {
  label: string;
  default?: boolean;
  effects: EventEffect[];
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  /** A townsperson is picked for it ({who}). */
  who?: boolean;
  weight?: number;
  /** One of the fateful events: rare, and it turns the town's course (fatefulEvents.ts). */
  fateful?: boolean;
  /** When it can happen (always, if left out). */
  when?: (s: GameState) => boolean;
  options: EventOption[];
}

/* ------------------------------------------------------------ shorthands */

export const note = (note: string): EventEffect => ({ note });
export const mood = (mood: number, hours: number, text: string): EventEffect => ({ mood, hours, text });
export const mod = (lever: Lever, mult: number, hours: number, text: string): EventEffect => ({ mod: lever, mult, hours, text });
export const gain = (stock: Stock): EventEffect => ({ gain: stock });
export const chance = (p: number, then: EventEffect[], otherwise: EventEffect[] = []): EventEffect => ({ chance: p, then, else: otherwise });
export const later = (hours: number, ...effects: EventEffect[]): EventEffect => ({ later: hours, effects });
export const busy = (hours: number, share: number, text: string, anim: 'chop' | 'build' | 'mine' = 'chop', at: 'edge' | 'camp' = 'edge'): EventEffect => ({ busy: hours, share, text, anim, at });
export const follow = (event: string): EventEffect => ({ follow: event });
export const teach = (skill: Skill, levels: number, on: 'who' | 'random' | 'founder' | 'all' = 'who'): EventEffect => ({ skill, levels, on });
export const bond = (by: number, withWho: 'founder' | 'random' = 'founder'): EventEffect => ({ bond: by, with: withWho });
export const trait = (id: string): EventEffect => ({ trait: id });
export const item = (id: string, count = 1): EventEffect => ({ item: id, count });
export const horse = (n = 1): EventEffect => ({ horse: n });
export const build = (def: string): EventEffect => ({ build: def });
export const coin = (n: number): EventEffect => ({ coins: n });
export const rep = (n: number): EventEffect => ({ reputation: n });
export const calm = (h: number): EventEffect => ({ calm: h });
export const raidIn = (h: number): EventEffect => ({ raid: h });
export const study = (seconds: number): EventEffect => ({ research: seconds });
export const opt = (label: string, ...effects: EventEffect[]): EventOption => ({ label, effects });
export const dflt = (label: string, ...effects: EventEffect[]): EventOption => ({ label, default: true, effects });

export const has = (s: GameState, ...ids: string[]) => s.buildings.some((b) => ids.includes(b.def) && b.status === 'done');
export const eraAt = (s: GameState, e: Era) => ERAS.indexOf(s.era) >= ERAS.indexOf(e);
export const eraIs = (s: GameState, e: Era) => s.era === e;
export const origin = (s: GameState, ...ids: OriginId[]) => ids.includes(s.origin ?? 'settlers');
export const people = (s: GameState, n: number) => s.people.length >= n;
export const coins = (s: GameState, n: number) => (s.coins ?? 0) >= n;
export const shop = (s: GameState) => s.buildings.some((b) => !!b.shop);
export const pens = (s: GameState) => has(s, 'chicken_coop', 'goat_pen', 'pig_sty', 'sheep_fold', 'cattle_pasture');
export const fields = (s: GameState) => has(s, 'garden_plot', 'hydroponics_bay');
export const take = (what: 'food' | 'stores' | 'coins', share: number): EventEffect => ({ take: what, share });
export const season = (s: GameState, ...which: Season[]) => which.includes(calendar(s.tick).season);
export const biome = (s: GameState, ...which: Biome[]) => which.includes(s.biome ?? 'forest');
export const children = (s: GameState) => s.people.some((p) => p.bornTick != null);
export const elders = (s: GameState) => s.people.some((p) => p.bornTick == null && !p.monster && ageDays(s, p) >= lifespanOf(s, p).elderDays);
export const tavern = (s: GameState) => s.buildings.some((b) => !!b.shop && (b.def === 'fireside_inn' || b.def === 'tavern'));
export const sea = (s: GameState) => seaTown(s);
export const library = (s: GameState) => has(s, 'library', 'scriptorium', 'school', 'university');
export const walls = (s: GameState) => has(s, 'palisade_wall', 'stone_wall');
export const mines = (s: GameState) => s.buildings.some((b) => b.status === 'done' && /mine|quarry/.test(b.def));
export const graveyard = (s: GameState) => has(s, 'graveyard');
export const hero = (s: GameState) => s.hero != null && s.people.some((p) => p.id === s.hero);
export const pack = (s: GameState) => !!s.pack;
export const monsters = (s: GameState) => s.people.some((p) => p.monster === 'vampire' || p.monster === 'werewolf');
export const strangers = (s: GameState) => s.people.some((p) => p.origin && p.origin !== (s.origin ?? 'settlers'));
export const prisoners = (s: GameState) => s.prisoners.length > 0;
export const horses = (s: GameState) => s.horses.length > 0;
export const grown = (s: GameState, n: number) => s.people.filter((p) => p.bornTick == null).length >= n;
