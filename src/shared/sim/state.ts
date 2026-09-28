// The complete simulation state. Plain JSON data only: it is what gets saved, and replaying the same
// commands from the same state must always produce the same result.

import { TILE } from '../constants';
import type { Material, Stock } from '../data/materials';
import { JOB_SKILL, JOBS, NAMES, randomLook, RECRUIT_TYPES, TRAITS, type Job, type Look, type Priority } from '../data/people';
import { SKILLS, type Skill, type SkillLevel } from '../data/skills';
import { DESTINATIONS, type Role, type Stance } from '../data/expeditions';
import { ITEM_BY_ID, type FareKind, type Slot } from '../data/items';
import { RAID_GRACE_HOURS, type RaidGoal } from '../data/raids';
import { TERRAIN, type WorkAnim } from '../data/terrain';
import { hashSeed, mixSeed, Rng } from '../rng';
import { generateWorld, type MidTerrain } from '../world';
import type { Biome, Difficulty } from '../data/biomes';
import type { ClassId } from '../data/classes';
import type { Battle } from './combat';
import type { Doom } from './doom';
import { MONSTER_HP, type MonsterKind, type StandingOrder } from '../data/monsters';
import { modifiers, type ResearchState } from './research';
import { TICKS_PER_HOUR } from './time';

export type { Era } from '../data/eras';
import type { Era } from '../data/eras';
import { BACKGROUND_BY_ID, founderSkills, SCENARIO_BY_ID, type FounderSpec } from '../data/founding';
import { BUILDING_BY_ID } from '../data/buildings';
import type { Direction, TownPlan } from './planner';

/** DESIGN §2: every timed action takes BaseTime x EraMultiplier / WorkerSpeed. */
export const ERA_MULTIPLIER: Record<Era, number> = { neolithic: 1, medieval: 2.5, industrial: 6, modern: 15, space: 40 };
/** Research stretches much further per era: later towns research many times faster (skill, workstations up
 *  to x8, several researchers), and topics should still take the DESIGN §2 times (Medieval 15-45 min, Modern
 *  3-6 hours, Space 6-12 hours for a well-run town). */
export const RESEARCH_MULTIPLIER: Record<Era, number> = { neolithic: 1, medieval: 15, industrial: 120, modern: 700, space: 2500 };
/** Construction too: crews grow, tools and bots speed them up, so buildings stretch more than the era multiplier. */
export const BUILD_MULTIPLIER: Record<Era, number> = { neolithic: 1, medieval: 5, industrial: 20, modern: 60, space: 200 };

/** Units a person can carry at once, before research bonuses (see carryCapacity). */
export const CARRY_CAPACITY = 10;

export interface TileState {
  terrain: MidTerrain;
  /** Materials left to gather here; the tile is cleared when this runs out. Empty for clear tiles. */
  pool: Stock;
  /** Marked by the player for gathering. */
  designated: boolean;
}

export interface Building {
  id: number;
  /** BuildingDef id. */
  def: string;
  /** Leftmost tile on its layer's grid. */
  tile: number;
  /** A blueprint is waiting for materials or being built; progress > 0 once work has started. */
  status: 'blueprint' | 'done';
  /** Materials hauled to the site so far. */
  delivered: Stock;
  /** Construction progress, 0..1. */
  progress: number;
  /** Stored materials, for buildings with storage once they are done. */
  store: Stock;
  /** Walls and gates: current health (set when finished). */
  hp?: number;
  /** Fields: what's in the ground. `growth` runs 0..1 while growing; `work` is sowing or harvest progress. */
  crop?: { stage: 'fallow' | 'growing' | 'ripe'; growth: number; work: number };
  /** On fire: how far it has burned (0..1; gone at 1). */
  fire?: number;
  /** Single-use buildings (the Resurrection Shrine): used up. */
  spent?: boolean;
  /** Reusable revivers (cryo pod, clone vat): ready again at this tick. */
  readyTick?: number;
  /** Who runs it (buildings with an operator role), and whether the player picked them. */
  operator?: number | null;
  operatorChosen?: boolean;
  /** Venues (a shop or a tavern): the furnishings set out on the floor, extensions bought with coins (each makes the
   *  floor bigger), its renown, what customers asked for and didn't find (fading day by day), the tiers of customer
   *  it has drawn, and what's happened there lately (newest last). */
  shop?: { pieces: ShopPiece[]; extensions?: number; renown?: number; asked?: Record<string, number>; seen?: number[]; log?: { tick: number; text: string }[] };
}

export interface ShopPiece {
  item: string;
  x: number;
  y: number;
  /** Improved with coins (a second tier of shelves, then a polished third): 1 when left out. */
  level?: number;
  /** How well it was made (Common when left out). */
  q?: number;
}

/** What a stranger comes for (see shop.ts): gear of a kind, a piece in particular (at some quality or better), the
 *  fine wares of their standing, a load of some material; or, at the tavern, a kind of fare or one dish. */
export type Want =
  | { kind: 'gear'; slots: Slot[]; label: string; minQ?: number }
  | { kind: 'item'; item: string; minQ?: number }
  | { kind: 'ware' }
  | { kind: 'material'; m: Material; n: number }
  | { kind: 'fare'; fare: FareKind }
  | { kind: 'dish'; item: string };

/** Someone passing through who stops at the town's shop or tavern (see shop.ts). */
export interface Traveller {
  id: number;
  name: string;
  /** What they are (a pedlar, a merchant, a noble...), and their tier of customer (1 when left out). */
  kind: string;
  tier?: number;
  /** Where they're going (the shop when left out), what they want, their temper (see data/shop.ts TEMPERS), and, at
   *  the tavern, the comfort they're used to. */
  venue?: 'shop' | 'tavern';
  want?: Want;
  temper?: string;
  req?: number;
  look: Look;
  x: number;
  dir: 1 | -1;
  /** Walking in to the shop, inside it, or on their way out of town (to `toX`, then gone). */
  phase: 'arriving' | 'shopping' | 'leaving';
  toX: number;
  /** When they're done shopping. */
  until: number;
  /** Coins they can spend. */
  purse: number;
}

export type Task =
  | { type: 'wander'; targetX: number }
  | { type: 'idle'; untilTick: number }
  /** Work a marked tile; or (scrounge) pick just the wild berries off any tile, to keep from starving. */
  | { type: 'gather'; tile: number; progress: number; scrounge?: boolean }
  /** Walk to a storage building and put down what you carry. */
  | { type: 'store'; building: number }
  /** Walk to a storage building and pick up materials for a construction site (reserving `amounts`). */
  | { type: 'fetch'; building: number; from: number; amounts: Stock }
  /** Carry fetched materials to a construction site. */
  | { type: 'deliver'; building: number }
  | { type: 'build'; building: number }
  /** Study at a research station (a building id; null: the camp, for a town with none). One person to a station; each
   *  works on a topic of their own from the queue where they can. (Older saves: neither set, and it's chosen afresh.) */
  | { type: 'research'; station?: number | null; topic?: string }
  /** Walk to a storage building with food and eat one unit (taking until `until`, once started). */
  | { type: 'eat'; building: number; until: number | null }
  /** Sleep in a bed (building id) or on the ground by the camp (null). */
  | { type: 'sleep'; building: number | null }
  /** Raid: go after a raider and fight (ticks until the next strike). */
  | { type: 'defend'; cooldown: number }
  /** Guard duty between raids (with a Barracks): walking the town from end to end. */
  | { type: 'patrol'; targetX: number }
  /** Raid: hide in your bed (safe), or huddle by the fire if you have none. */
  | { type: 'shelter' }
  /** Stop someone's bleeding (an attempt takes a while; it may fail). */
  | { type: 'tend'; patient: number; progress: number }
  /** Mend a damaged wall or gate. */
  | { type: 'repair'; building: number }
  /** Beat out a fire. */
  | { type: 'extinguish'; building: number }
  /** Sow a fallow field or harvest a ripe one. */
  | { type: 'farm'; building: number }
  /** Dig at a mine until your hands are full. */
  | { type: 'mine'; building: number; work: number }
  /** Work a craft order: fetch its materials from storage (`from`), carry them to the station, then make it. */
  | { type: 'craft'; order: number; phase: 'fetch' | 'deliver' | 'work'; from: number | null };

/** An item in the craft queue. `count` more to make; materials for the current one arrive in `delivered`. */
export interface CraftOrder {
  id: number;
  item: string;
  count: number;
  delivered: Stock;
  /** Item ingredients (rope, a spear...) come straight from the inventory when work starts. */
  itemsTaken: boolean;
  progress: number;
  /** Pieces finished so far (for the notice when the order is done). */
  made: number;
  /** A commission: made for the shop or tavern, asked for by its keeper (a person id), for so many coins a piece;
   *  and the crafters already told about it. */
  for?: { venue: 'shop' | 'tavern'; by: number | null; pay: number; told?: number[] };
}

/** What a person is visibly doing (drives their animation). */
export type Activity = 'idle' | 'walk' | 'build' | 'research' | 'eat' | 'sleep' | 'fight' | WorkAnim;

export interface Raider {
  id: number;
  /** Fighting for the town: summoned, raised by a necromancer, or tamed. */
  ally?: boolean;
  /** (a fallen raider a necromancer has already looked at) */
  raiseChecked?: boolean;
  /** Epic bosses: raging, called for help, blows struck, trophy handed over. */
  enraged?: boolean;
  summoned?: boolean;
  bossAttacks?: number;
  trophyGiven?: boolean;
  /** When its last sweeping attack went off (for the blast); when it was summoned, raised or tamed (for the spell). */
  lastArea?: number;
  conjuredAt?: number;
  /** A townsperson who rose again in a zombie outbreak (their name). */
  risenFrom?: string;
  /** Enemy def id. */
  kind: string;
  x: number;
  dir: 1 | -1;
  hp: number;
  maxHp: number;
  cooldown: number;
  down: boolean;
  fleeing: boolean;
  /** Gone off the map (escaped). */
  gone: boolean;
  carrying: Stock;
  /** Ticks of their last attack and the last time they were hit (for animation). */
  lastAction: number;
  lastHit: number;
  /** What the last hit was, when it wasn't an ordinary blow (a Blood Knight's, a laser's). */
  hitFx?: RaiderHitFx | null;
  /** What this one is after (older saves: the raid's main goal). */
  goal?: RaidGoal;
  /** A townsperson being carried off (taken out of the town while carried). */
  captive?: Person | null;
  /** Fires this one has set. */
  fires?: number;
}

export interface Raid {
  id: number;
  /** Fallen raiders raised by necromancers this raid, and when a Beast Tamer can tame again. */
  raised?: number;
  nextTame?: number;
  /** RaidKind id. */
  kind: string;
  /** The end of the world they come from. */
  side: -1 | 1;
  phase: 'warning' | 'active';
  /** Raiders appear at the world's edge at this tick. */
  arrivesTick: number;
  /** They give up after this tick. */
  leavesTick: number;
  raiders: Raider[];
  prompt: number | null;
}

export interface Needs {
  /** 1 = full, 0 = starving. */
  food: number;
  /** 1 = rested, 0 = exhausted. */
  rest: number;
}

export interface Person {
  id: number;
  name: string;
  /** RecruitType id. */
  type: string;
  look: Look;
  /** World x in pixels, along the walkway. */
  x: number;
  dir: 1 | -1;
  skills: Record<Skill, SkillLevel>;
  /** Skills they love: XP in these grows faster. */
  passions: Skill[];
  traits: string[];
  needs: Needs;
  /** 0..100; drifts toward the target set by their circumstances (see mood()). */
  morale: number;
  /** Where they slept last, which colours their mood until they sleep again. */
  lastSlept: 'bed' | 'bedroll' | 'ground' | null;
  /** Their bed: a housing building id, or null. */
  bed: number | null;
  priorities: Record<Job, Priority>;
  /** When on, priorities follow their skills; setting one by hand turns this off. */
  autoPriorities: boolean;
  task: Task | null;
  activity: Activity;
  carrying: Stock;
  /** Worn items (item ids) by slot, and their quality (Common when left out; see data/quality.ts). */
  gear: Partial<Record<Slot, string>>;
  gearQ?: Partial<Record<Slot, number>>;
  /** Set when the person can't put down what they carry because all storage is full. */
  blocked: boolean;
  /** Expedition id while they're away from town (not simulated or drawn in town meanwhile). */
  away: number | null;
  hp: number;
  /** Starving right now (so the warning comes once, not every tick). */
  starving?: boolean;
  /** Knocked down at 0 HP: bleeding out until `bleedUntil`, or stabilized (null) and recovering. */
  downed: { bleedUntil: number | null } | null;
  /** Their partner (a couple), and whether they're married. */
  partner?: number | null;
  married?: boolean;
  /** Children: when they were born (they grow up after CHILD_HOURS), and their parents. */
  bornTick?: number | null;
  parents?: number[];
  /** Grieving someone close, until a tick. */
  grief?: { until: number; value: number; text: string } | null;
  /** A mental break in progress (see breaks.ts). */
  breakdown?: { kind: 'sulk' | 'binge' | 'brawl' | 'wander'; until: number; target?: number } | null;
  /** Game hours their morale has been at breaking point. */
  lowMoraleHours?: number;
  /** A monster (werewolf or vampire), its standing order for the Hunter's Guild, and when it last fed. */
  monster?: MonsterKind | null;
  /** A special class they've trained in (or arrived with). */
  cls?: ClassId | null;
  /** Cut down and come back from it at least once (a Blood Knight's oath needs it). */
  scarred?: boolean;
  order?: StandingOrder;
  lastFed?: number;
  /** Their own coins: wages from the town, spent on their gear (see wages.ts). None when left out. */
  coins?: number;
  /** What they've done lately that's worth a line on their card (newest last). */
  recent?: { tick: number; text: string }[];
  /** Sick with the plague until a tick. */
  sick?: { until: number; treated?: boolean } | null;
}

/** Base health, and the extra a Tough person has. */
export const BASE_HP = 60;
export const TOUGH_HP = 20;
/** Health lost for each time someone was revived from a cryo pod (never below MIN_HP). */
export const FRAIL_HP = 12;
export const MIN_HP = 24;

export function maxHp(p: Pick<Person, 'traits'> & { monster?: MonsterKind | null }): number {
  const frail = p.traits.filter((t) => t === 'frail').length * FRAIL_HP;
  return Math.max(MIN_HP, BASE_HP + (p.traits.includes('tough') ? TOUGH_HP : 0) + (p.monster ? MONSTER_HP : 0) - frail);
}

/** A raider taken alive (see prisoners.ts). */
export interface Prisoner {
  id: number;
  /** Enemy def id (what they were). */
  enemy: string;
  name: string;
  /** 0..1: won over at 1. */
  conviction: number;
  since: number;
  hungry: boolean;
}

export interface Horse {
  id: number;
  name: string;
  hp: number;
  /** Which colour on the horse sheet. */
  coat: number;
}

/** One deal a caravan offers: they give `gives` (and maybe a horse) for `wants`. */
export interface Offer {
  id: number;
  gives: Stock;
  horse: boolean;
  wants: Stock;
  done: boolean;
}

export interface Caravan {
  /** Where they stand (at the market). */
  x: number;
  leavesTick: number;
  offers: Offer[];
}

/** A question waiting for the player, answered by default when the timer runs out. */
export interface Prompt {
  id: number;
  kind: 'strangers' | 'raid' | 'rite' | 'lich';
  /** The expedition it's about (strangers), or null. */
  expedition: number | null;
  title: string;
  text: string;
  options: string[];
  defaultOption: number;
  expiresTick: number;
}

export type ExpeditionPhase = 'out' | 'work' | 'back';

export interface Expedition {
  id: number;
  /** Destination id. */
  dest: string;
  /** Person ids, leader first. */
  members: number[];
  phase: ExpeditionPhase;
  /** Ticks spent in the current phase, and each phase's length. */
  elapsed: number;
  outTicks: number;
  workTicks: number;
  backTicks: number;
  /** Fractional loot progress (whole units go into `loot`). */
  work: number;
  loot: Stock;
  /** Food packed for the trip. */
  supplies: Stock;
  recalled: boolean;
  roles: Record<number, Role>;
  stance: Stance;
  /** A fight in progress (the trip waits for it). */
  battle: Battle | null;
  /** A question for the player about this party (the trip waits for it). */
  prompt: number | null;
  /** Road events already rolled for each leg, and whether the homeward ambush was rolled. */
  rolled: { outEvent: boolean; backEvent: boolean; ambush: boolean };
  /** Waterskins taken along (returned to the inventory at home). */
  waterskins: number;
  /** Clear-a-threat trips: the fight at the destination was won. */
  cleared?: boolean;
  /** Horses taken along. */
  horses?: Horse[];
  /** A truck taken along (Modern). */
  truck?: boolean;
}

/** Someone waiting at the edge of town to be let in. */
export interface Visitor {
  person: Person;
  /** Where they stop and wait. */
  waitX: number;
  /** They give up and leave at this tick. */
  leavesTick: number;
  /** Once turned away (or tired of waiting) they walk off to this x and vanish. */
  leavingTo: number | null;
}

export interface GameState {
  version: 15;
  /** World seed (initial terrain is regenerated from it; changes live in `tiles`). */
  seed: string;
  /** Ticks simulated since the game began. */
  tick: number;
  /** State of the simulation RNG. All sim randomness draws from this, never Math.random(). */
  rngState: number;
  paused: boolean;
  era: Era;
  /** Midground tiles, one per world column. */
  tiles: TileState[];
  /** Bumped whenever any tile changes, so renderers know to redraw terrain. */
  tileRev: number;
  /** Every building and blueprint, in placement order (which is also construction priority). */
  buildings: Building[];
  people: Person[];
  /** The main character. Their death ends the game. */
  mainId: number;
  nextId: number;
  /** A would-be recruit waiting for an answer, if any. */
  visitor: Visitor | null;
  expeditions: Expedition[];
  /** Destinations visited at least once (their loot is known). */
  scouted: string[];
  /** Which end of town each destination lies beyond (-1 left, 1 right). */
  destSides: Record<string, -1 | 1>;
  prompts: Prompt[];
  /** Goodwill from helping strangers; draws more wanderers. */
  reputation: number;
  /** Set when the main character dies. The sim stops. */
  gameOver: { tick: number; text: string; won?: boolean } | null;
  /** The ship is built: it lifts off at this tick (the game is won). */
  launchTick?: number | null;
  /** Everyone is saddened by a death until this tick. */
  mourningUntil: number;
  /** The raid under way or about to arrive, if any. */
  raid: Raid | null;
  /** When the next raid is due. */
  nextRaidTick: number;
  /** Townsfolk carried off by bandits, held at their camp until a party clears it. */
  captives: Person[];
  /** What people think of each other: "loId-hiId" -> -100..100. */
  relations: Record<string, number>;
  /** Raiders held after a raid. */
  prisoners: Prisoner[];
  /** Horses at home (those out on expeditions travel with the party). */
  horses: Horse[];
  /** A trade caravan at the market, and when the next is due. */
  caravan: Caravan | null;
  nextCaravanTick: number;
  /** Everyone's in good spirits (a wedding) until this tick. */
  celebrationUntil: number;
  /** Game hours the whole town has been in despair (see breaks.ts: colony collapse). */
  despairHours?: number;
  /** A vampire founder has already risen again on this game day. */
  vampireRevivedDay?: number;
  /** Camp advice already given (see advice.ts). */
  advice?: string[];
  /** A werewolf founder has already risen under the full moon on this game day. */
  werewolfRevivedDay?: number;
  /** The Hunter's Guild's hostility (0..100; see monsters.ts), and the monster its raid is after. */
  guild?: number;
  guildTarget?: number | null;
  /** A world-dooming event on its way or under way, and when the next is due (see doom.ts). */
  doom?: Doom | null;
  nextDoomTick?: number;
  research: ResearchState;
  /** Items not being worn, by item id (they take no storage room), and the quality of each piece, best first (kept in
   *  step with the counts by crafting.ts's qualitiesOf; Common when left out). */
  items: Record<string, number>;
  itemQ?: Record<string, number[]>;
  /** The craft queue, worked front to back. */
  crafting: CraftOrder[];
  /** Recent in-strip messages ("Research complete: ..."), newest last. */
  notices: Notice[];
  /** The Town Journal: every notice plus "while you were away" reports, newest last (the oldest drop off). */
  journal: JournalEntry[];
  /** The latest "while you were away" report, until the player dismisses it. */
  unreadAway: number | null;
  /** Set when the era capstone is researched (the next era arrives in Milestone 2). */
  eraReady: boolean;
  /** Testing aids toggled from the tray's Debug menu. */
  cheats: { unlockAll: boolean };
  /** Where the town was founded (forest when left out). */
  biome?: Biome;
  /** A boss's roar shakes the town until this tick; a boss slain cheers it (until, and who). The last big boss moment (for the screen shake). */
  dreadUntil?: number;
  triumph?: { until: number; name: string } | null;
  bossShake?: number;
  /** Where townsfolk fell and were buried (the latest few). */
  graves?: { x: number; name: string }[];
  /** How many of its own the town has buried, ever (a Necromancer's calling needs some). */
  burials?: number;
  /** The last person brought back from death, and when (for the glow). */
  revivedAt?: { tick: number; id: number } | null;
  /** Spells cast on townsfolk lately (turned, healed), for the effects drawn round them. */
  fx?: { tick: number; id: number; kind: PersonFx }[];
  /** Where meteors struck lately (for the impact bursts). */
  impacts?: { tick: number; x: number }[];
  /** The living are frightened (someone was turned) until this tick. */
  turningFearUntil?: number;
  /** Ironman: a single save with no backups, and no cheats. */
  ironman?: boolean;
  /** Threat level (normal when left out). */
  difficulty?: Difficulty;
  /** Where the self-running town puts its effort (growth when left out), and what it last decided. */
  direction?: Direction;
  plan?: TownPlan;
  /** False turns the town's own planner off (tests of single mechanics). On when left out. */
  autopilot?: boolean;
  /** The town's purse (none when left out), strangers in town, and when the next is due at the shop. */
  coins?: number;
  travellers?: Traveller[];
  nextTravellerTick?: number;
  /** When the next guest is due at the tavern. */
  nextGuestTick?: number;
  /** Where the town's coins came from and went, today and yesterday (see earn). */
  ledger?: { day: number; today: Ledger; yesterday: Ledger | null };
}

/** Effects drawn round a townsperson: turned undead, a vampire or a werewolf, healed by a medkit, or struck by an
 *  ice mage's frost. */
export type PersonFx = 'undead' | 'vampire' | 'werewolf' | 'heal' | 'frost';
/** Effects drawn on a raider as it's hit. */
export type RaiderHitFx = 'blood' | 'shock' | 'fire' | 'lightning';
/** How long a person effect lasts (ticks). */
export const FX_TICKS = 60;
/** How long each plays (a frost hit is quick). */
export const fxTicks = (kind: PersonFx) => (kind === 'frost' ? 12 : FX_TICKS);

/** Mark a spell on someone, for the renderer (old ones are dropped). */
export function personFx(s: GameState, id: number, kind: PersonFx): void {
  s.fx = (s.fx ?? []).filter((f) => s.tick - f.tick < FX_TICKS);
  s.fx.push({ tick: s.tick, id, kind });
}

export interface Notice {
  /** Increasing, so renderers can show each notice once. */
  id: number;
  tick: number;
  text: string;
}

export interface JournalEntry extends Notice {
  /** A milestone (finished research or building, a death, a raid's outcome...): "while you were away"
   *  reports list these and only count the rest. */
  key?: true;
  /** A "while you were away" report: `text` is its title, `lines` the summary. */
  lines?: string[];
}

const MAX_NOTICES = 20;
export const MAX_JOURNAL = 400;

/** A day's coins in and out: from travellers at the shop and the tavern, from the townsfolk (their gear and their
 *  evenings out), and out on wages, crafters' pay, the venues (rooms and improvements), and goods bought in. */
export type LedgerLine = 'shop' | 'tavern' | 'townsfolk' | 'wages' | 'crafters' | 'venues' | 'goods';
export type Ledger = Partial<Record<LedgerLine, number>>;

/** Book coins in (or out) against a line of the town's ledger. */
export function earn(s: GameState, line: LedgerLine, n: number): void {
  const day = Math.floor(s.tick / (TICKS_PER_HOUR * 24));
  const l = (s.ledger ??= { day, today: {}, yesterday: null });
  if (l.day !== day) {
    l.yesterday = l.day === day - 1 ? l.today : {};
    l.today = {};
    l.day = day;
  }
  l.today[line] = (l.today[line] ?? 0) + n;
}

/** Lines kept on a person's card of what they've done lately. */
const RECENT = 6;

/** Note something someone did, for their card. */
export function remember(s: GameState, p: Person, text: string): void {
  const r = (p.recent ??= []);
  r.push({ tick: s.tick, text });
  if (r.length > RECENT) r.splice(0, r.length - RECENT);
}

/** Tell the player something: a toast on the strip and a line in the Journal. `key` marks milestones. */
export function notify(s: GameState, text: string, key = false): void {
  const n = { id: s.nextId++, tick: s.tick, text };
  s.notices.push(n);
  if (s.notices.length > MAX_NOTICES) s.notices.splice(0, s.notices.length - MAX_NOTICES);
  addJournal(s, key ? { ...n, key } : { ...n });
}

export function addJournal(s: GameState, e: JournalEntry): void {
  s.journal.push(e);
  if (s.journal.length > MAX_JOURNAL) s.journal.splice(0, s.journal.length - MAX_JOURNAL);
}

/** Units a person can carry, including research bonuses and (for a given person) their pack. */
export function carryCapacity(s: GameState, p?: Person): number {
  const pack = p?.gear.pack ? (ITEM_BY_ID[p.gear.pack]?.effects.carry ?? 0) : 0;
  return CARRY_CAPACITY + modifiers(s.research).carryBonus + pack;
}

/** Choices made when founding a town. */
export interface NewGameOptions {
  biome?: Biome;
  /** One save only, no backups, no cheats. */
  ironman?: boolean;
  difficulty?: Difficulty;
  /** The founder as the player made them (rolled when left out). */
  founder?: FounderSpec;
  /** How the town starts (a lone founder when left out). */
  scenario?: string;
}

/** Give the rolled founder the player's choices. */
function makeFounder(p: Person, f: FounderSpec): void {
  const bg = BACKGROUND_BY_ID[f.background] ?? BACKGROUND_BY_ID.forager;
  const levels = founderSkills(bg);
  p.skills = Object.fromEntries(SKILLS.map((k) => [k, { level: levels[k], xp: 0 }])) as Record<Skill, SkillLevel>;
  p.passions = [...bg.passions];
  p.traits = [...f.traits];
  if (f.name) p.name = f.name;
  if (f.look) p.look = { ...f.look };
  p.priorities = autoPriorities(p.skills);
  p.hp = maxHp(p);
}

/** A child who came with the founding party: too young to work yet, grows up like one born in town. */
function makeChild(p: Person): void {
  p.skills = Object.fromEntries(SKILLS.map((k) => [k, { level: 1, xp: 0 }])) as Record<Skill, SkillLevel>;
  p.traits = [];
  p.look = { ...p.look, beard: false };
  p.priorities = { haul: 0, construct: 0, farm: 0, craft: 0, research: 0, gather: 0, defend: 0 };
  p.autoPriorities = false;
  p.bornTick = 0;
  p.hp = maxHp(p);
}

export function newGame(seed: string, opts: NewGameOptions = {}): GameState {
  const world = generateWorld(seed, opts.biome);
  const rng = new Rng(mixSeed(hashSeed(seed), 0x5eed));

  const tiles: TileState[] = world.mid.map((terrain) => {
    const pool: Stock = {};
    if (terrain !== 'clear') {
      for (const [m, [lo, hi]] of Object.entries(TERRAIN[terrain].pool) as [Material, [number, number]][]) {
        const n = rng.int(lo, hi);
        if (n > 0) pool[m] = n;
      }
    }
    return { terrain, pool, designated: false };
  });

  const main = makePerson(rng, 1, 'founder', (world.camp + 0.5) * TILE - TILE, []);
  if (opts.founder) makeFounder(main, opts.founder);
  // The camp starts with its fire, which doubles as a small cache, and a little food (more, and company, in
  // some scenarios).
  const scenario = SCENARIO_BY_ID[opts.scenario ?? 'lone'] ?? SCENARIO_BY_ID.lone;
  const campfire: Building = { id: 2, def: 'campfire', tile: world.camp, status: 'done', delivered: {}, progress: 1, store: {} };
  const buildings = [campfire];
  const people = [main];
  let nextId = 3;
  for (const type of scenario.companions) {
    const x = (world.camp + 0.5) * TILE + (people.length % 2 ? 1 : -1) * Math.ceil(people.length / 2) * TILE;
    const p = makePerson(rng, nextId++, type, x, people.map((q) => q.name));
    if (type === 'child') makeChild(p);
    people.push(p);
  }
  let room = BUILDING_BY_ID.campfire.storage ?? 0;
  const extra: Stock = {};
  for (const [m, n] of Object.entries(scenario.stores) as [Material, number][]) {
    const here = Math.min(n, room);
    if (here > 0) campfire.store[m] = here;
    room -= here;
    if (n > here) extra[m] = n - here;
  }
  // what the fire can't hold waits in a stockpile just past it
  if (Object.keys(extra).length) buildings.push({ id: nextId++, def: 'stockpile', tile: world.camp + BUILDING_BY_ID.campfire.width + 1, status: 'done', delivered: {}, progress: 1, store: extra });

  return {
    version: 15,
    seed,
    tick: 0,
    rngState: rng.state,
    paused: false,
    era: 'neolithic',
    tiles,
    tileRev: 0,
    buildings,
    people,
    mainId: main.id,
    nextId,
    visitor: null,
    expeditions: [],
    scouted: [],
    destSides: Object.fromEntries(DESTINATIONS.map((d) => [d.id, rng.chance(0.5) ? -1 : 1])),
    prompts: [],
    reputation: 0,
    gameOver: null,
    mourningUntil: 0,
    raid: null,
    nextRaidTick: RAID_GRACE_HOURS * TICKS_PER_HOUR,
    captives: [],
    relations: {},
    celebrationUntil: 0,
    prisoners: [],
    horses: [],
    caravan: null,
    nextCaravanTick: 0,
    research: { done: [...scenario.research], queue: [], progress: {} },
    items: {},
    crafting: [],
    notices: [],
    journal: [],
    unreadAway: null,
    eraReady: false,
    cheats: { unlockAll: false },
    ...(opts.biome && opts.biome !== 'forest' ? { biome: opts.biome } : {}),
    ...(opts.ironman ? { ironman: true } : {}),
    ...(opts.difficulty && opts.difficulty !== 'normal' ? { difficulty: opts.difficulty } : {}),
  };
}

/** A new person of a recruit type: skills from its ranges, 1-3 passions, 1-2 traits, a name not in use. */
export function makePerson(rng: Rng, id: number, typeId: string, x: number, takenNames: readonly string[]): Person {
  const type = RECRUIT_TYPES[typeId];
  const skills = Object.fromEntries(
    SKILLS.map((k) => {
      const [lo, hi] = type.skills[k] ?? [1, 3];
      return [k, { level: rng.int(lo, hi), xp: 0 }];
    }),
  ) as Record<Skill, SkillLevel>;

  const passions: Skill[] = [];
  for (let n = rng.int(1, typeId === 'founder' ? 2 : 3); passions.length < n; ) {
    const pick = type.passionFor.length && rng.chance(0.7) ? rng.pick(type.passionFor) : rng.pick(SKILLS);
    if (!passions.includes(pick)) passions.push(pick);
    else if (passions.length >= type.passionFor.length) n--; // avoid spinning on a short list
  }

  const traits: string[] = [];
  for (let tries = 0, n = rng.int(1, 2); traits.length < n && tries < 20; tries++) {
    const t = rng.pick(TRAITS);
    if (traits.includes(t.id) || traits.some((o) => t.excludes?.includes(o))) continue;
    traits.push(t.id);
  }

  const free = NAMES.filter((n) => !takenNames.includes(n));
  return {
    id,
    name: rng.pick(free.length ? free : NAMES),
    type: typeId,
    look: randomLook(rng, typeId === 'elder'),
    x,
    dir: 1,
    skills,
    passions,
    traits,
    needs: { food: 0.8, rest: 0.9 },
    morale: 55,
    lastSlept: null,
    bed: null,
    priorities: autoPriorities(skills),
    autoPriorities: true,
    task: null,
    activity: 'idle',
    carrying: {},
    gear: {},
    blocked: false,
    away: null,
    hp: maxHp({ traits }),
    downed: null,
  };
}

/**
 * Auto mode: good at it (6+) = high, some skill (3+) = normal, otherwise low. Hauling is normal for everyone.
 * Building is as high as the person's highest other job (and at least normal): it only comes up when a site has
 * all its materials, and with it ranked lower, such a site sat unbuilt while there was anything else to do (a
 * lone founder shuttled between hauling to it and gathering, and never built it).
 * Defending goes by the better of melee and ranged: 5+ high, 3+ normal, 2 low, and the unfit (1) shelter.
 */
export function autoPriorities(skills: Record<Skill, SkillLevel>): Record<Job, Priority> {
  const out = Object.fromEntries(
    JOBS.map((j) => {
      if (j === 'defend') {
        const fight = Math.max(skills.melee.level, skills.ranged.level);
        return [j, fight >= 5 ? 1 : fight >= 3 ? 2 : fight >= 2 ? 3 : 0];
      }
      const skill = JOB_SKILL[j];
      const level = skill ? skills[skill].level : 3;
      return [j, level >= 6 ? 1 : level >= 3 ? 2 : 3];
    }),
  ) as Record<Job, Priority>;
  const top = Math.min(...JOBS.filter((j) => j !== 'defend' && j !== 'construct').map((j) => out[j]));
  out.construct = Math.min(out.construct, top, 2) as Priority;
  return out;
}

/** World x of the camp centre (where idle people drift back to). */
export function campX(s: GameState): number {
  return tileCentreX(Math.floor(s.tiles.length / 2)); // same as World.camp
}

export function tileCentreX(tile: number): number {
  return (tile + 0.5) * TILE;
}

/** Total units in a stock. */
export function poolSize(pool: Stock): number {
  let n = 0;
  for (const v of Object.values(pool)) n += v ?? 0;
  return n;
}

export function addStock(to: Stock, m: Material, n: number): void {
  const v = (to[m] ?? 0) + n;
  if (v > 0) to[m] = v;
  else delete to[m];
}
