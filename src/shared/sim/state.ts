// The complete simulation state. Plain JSON data only: it is what gets saved, and replaying the same
// commands from the same state must always produce the same result.

import type { SpecialId } from '../data/specials';
import type { BoatKind } from '../data/boats';
import type { ShopLine } from '../data/stores';
import type { DecorId } from '../data/decor';
import type { TaxRate } from '../data/economy';
import type { AmbitionId } from '../data/ambitions';
import type { NatureId } from '../data/natures';
import { FOUNDER_CLASS } from '../data/founderClasses';
import { CELL, makeLand, MOUNTAIN_FOOT, setGround, type LandMap, type Pt } from './land';
import { SEAT_D, seatId } from '../data/seats';
import type { Delve } from './delves';
import type { PackState } from './pack';
import type { Quest } from './quests';
import type { Material, Stock } from '../data/materials';
import { JOB_SKILL, JOBS, NAMES, randomLook, RECRUIT_TYPES, TRAITS, type Job, type Look, type Priority } from '../data/people';
import { SKILLS, type Skill, type SkillLevel } from '../data/skills';
import { DESTINATIONS, type Role, type Stance } from '../data/expeditions';
import { ITEM_BY_ID, type FareKind, type Slot } from '../data/items';
import { RAID_GRACE_HOURS, type RaidGoal } from '../data/raids';
import type { WorkAnim } from '../data/terrain';
import type { EventEffect } from '../data/eventKit';
import type { MapPlace } from './places';
import { hashSeed, mixSeed, Rng } from '../rng';
import type { MidTerrain } from '../world';
import type { Biome, Difficulty } from '../data/biomes';
import type { ClassId } from '../data/classes';
import { hpMult } from '../data/levels';
import type { Battle } from './combat';
import type { Doom } from './doom';
import { MONSTER_HP, type MonsterKind, type StandingOrder } from '../data/monsters';
import { ORIGIN_DEFS, type OriginId } from '../data/origins';
import { modifiers, type ResearchState } from './research';
import { TICKS_PER_HOUR } from './time';

export type { Era } from '../data/eras';
import type { Era } from '../data/eras';
import type { Battle as TownBattle, RaiderBattle } from './battle';
import { BACKGROUND_BY_ID, founderSkills, SCENARIO_BY_ID, type FounderSpec } from '../data/founding';
import { FOUNDER_BY_ID } from '../data/founders';
import { BUILDING_BY_ID } from '../data/buildings';
import type { Direction, TownPlan } from './planner';
import type { Ring } from './ringWall';

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
  /** Its footprint's top-left cell on the land (sim/land.ts): `tile` the column, `row` the row; its size is its
   *  def's `width` by `depthOf(def)` (sim/buildings.ts). */
  tile: number;
  row: number;
  /** A room of a castle (sim/castle.ts: inside the keep). */
  room?: boolean;
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
  /** A piece of the town's ring wall (sim/ringWall.ts): which ring. */
  ring?: number;
  /** Turned a quarter: its footprint is its depth wide and its width deep (a gate in the ring wall's west or east
   *  run stands along the wall). */
  turned?: boolean;
  /** Fields: what's in the ground. `growth` runs 0..1 while growing; `work` is sowing or harvest progress. */
  /** A field's crop. `soil`: how good the ground is (1 when left out; see SOIL in data/crops.ts). `bearing`: an
   *  orchard's trees have come into fruit. */
  crop?: { stage: 'fallow' | 'growing' | 'ripe'; growth: number; work: number; soil?: number; bearing?: boolean };
  /** A pen's animals (sim/livestock.ts): how many, when they were last tended, progress to the next birth (0..1), hours
   *  gone hungry this winter, and the work done on the tending under way. */
  herd?: { head: number; tended: number; breed: number; hungry: number; work: number; owed?: number };
  /** On fire: how far it has burned (0..1; gone at 1). */
  fire?: number;
  /** Single-use buildings (the Resurrection Shrine): used up. */
  spent?: boolean;
  /** Reusable revivers (cryo pod, clone vat): ready again at this tick. */
  readyTick?: number;
  /** Who runs it (buildings with an operator role), and whether the player picked them. */
  operator?: number | null;
  /** Who owns it (sim/property.ts): a person, or the treasury when left out. */
  owner?: number;
  /** A pen widened for its herd: this many columns more than its def's width (sim/livestock.ts `growPen`). */
  wide?: number;
  operatorChosen?: boolean;
  /** Venues (a shop or a tavern): the furnishings set out on the floor, extensions bought with coins (each makes the
   *  floor bigger), its renown, what customers asked for and didn't find (fading day by day), the tiers of customer
   *  it has drawn, and what's happened there lately (newest last). */
  shop?: {
    pieces: ShopPiece[];
    extensions?: number;
    renown?: number;
    asked?: Record<string, number>;
    seen?: number[];
    log?: { tick: number; text: string }[];
    /** The basic furnishings have been set out (data/decor.ts STARTERS). */
    started?: boolean;
    /** The décor direction its keeper chose, and how far it has been taken (data/decor.ts). */
    decor?: { style: DecorId; level: number };
    /** What it took today and yesterday (sim/ambition.ts: a business's price). */
    takings?: { day: number; today: number; yesterday: number };
  };
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
  | { kind: 'dish'; item: string }
  /** Anything of a specialty shop's line (data/stores.ts): a piece of furniture, a medicine. */
  | { kind: 'line'; line: ShopLine; minQ?: number };

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
  /** A specialty shop's customer: the line they came for (its shop is where they go). */
  line?: ShopLine;
  want?: Want;
  temper?: string;
  req?: number;
  look: Look;
  /** Their people, when not the town's (sim/strangers.ts). */
  origin?: OriginId;
  x: number;
  y: number;
  dir: 1 | -1;
  /** Walking in to the shop, inside it, or on their way out of town (to `toX`, then gone). */
  phase: 'arriving' | 'shopping' | 'leaving';
  toX: number;
  toY: number;
  /** The way there (walk.ts). */
  path?: Pt[];
  goal?: Pt;
  /** When they're done shopping. */
  until: number;
  /** Coins they can spend. */
  purse: number;
  /** The tavern bed they've taken for the night (its spot on the floor). */
  bed?: { x: number; y: number };
  /** At a shop: looking round first, then at the counter with the keeper, then done (`stageUntil` ends each); what
   *  was said at the counter, for the window's speech bubbles (sim/shop.ts). Left out: served on arrival (older saves). */
  stage?: 'browse' | 'counter' | 'done';
  stageUntil?: number;
  talk?: ShopTalk;
}

/** What a customer asked at the counter, and the keeper's answer: sold, ordered from a crafter, or turned away. */
export interface ShopTalk {
  ask: string;
  answer: string;
  outcome: 'sold' | 'order' | 'no';
}

export type Task =
  | { type: 'wander'; targetX: number; targetY: number }
  | { type: 'idle'; untilTick: number }
  /** Work a marked cell (`tile` is its index on the land); or (scrounge) pick just the wild berries off any cell, to
   *  keep from starving. */
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
  | { type: 'patrol'; targetX: number; targetY: number }
  /** Raid: hide in your bed (safe), or huddle by the fire if you have none. */
  | { type: 'shelter' }
  /** Stop someone's bleeding (an attempt takes a while; it may fail). */
  | { type: 'tend'; patient: number; progress: number }
  /** Mend a damaged wall or gate. */
  | { type: 'repair'; building: number }
  /** Beat out a fire. */
  | { type: 'extinguish'; building: number }
  /** Held to the town's work by an event (cutting a fireline, the long night's watch: `s.busy`, sim/events.ts). */
  | { type: 'toil' }
  /** At a funeral or a feast (sim/ceremonies.ts). */
  | { type: 'attend' }
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
  /** A customer's order, taken by a shopkeeper when the shop had none (sim/shop.ts `commission`): who, what they paid
   *  up front, and the shop (a building id). Finished, the piece is theirs: it goes to them, not into the stores. */
  commission?: { name: string; paid: number; shop: number };
}

/** What a person is visibly doing (drives their animation). */
export type Activity = 'idle' | 'walk' | 'build' | 'research' | 'eat' | 'sleep' | 'fight' | 'reap' | 'till' | WorkAnim;

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
  y: number;
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
  /** How much harder it is than its kind (a big town draws hardened raiders: raids.ts), for its blows (its health
   *  is scaled when it's made). */
  might?: number;
  /** Its part in the battle on the trail (sim/battle.ts). */
  bt?: RaiderBattle;
  /** Its blood is on the ground already (marked once when it fell). */
  bled?: boolean;
  /** A defence piece's quirks on it (sim/defenses.ts): slowed by this share until a tick, burning, turned about. */
  slow?: number;
  slowUntil?: number;
  burn?: { until: number; dps: number };
  routed?: boolean;
  /** The side it came from and flees back to, when not the raid's own (a flanking party, raids.ts). */
  side?: -1 | 1;
  /** A townsperson being carried off (taken out of the town while carried). */
  captive?: Person | null;
  /** Fires this one has set. */
  fires?: number;
  /** A rival lord (sim/rivals.ts): when each of its spells is next ready, and when it last cast one. */
  spellAt?: Record<string, number>;
  lastCast?: number;
}

/** A hunt on the Monster Hunters' Guild's board (data/hunts.ts, sim/hunts.ts). */
export interface Hunt {
  id: number;
  quarry: string;
  posted: number;
  until: number;
}

/** A saga under way (data/sagas.ts, sim/sagas.ts). */
export interface SagaRun {
  /** The run's own id (a trip to it is the destination `saga:<run>`). */
  run: number;
  id: string;
  /** The chapter it's at, since when, and the flags its answers set. */
  ch: string;
  at: number;
  flags: string[];
  started: number;
  /** The hero (the leader of its last trip won, else the founder), and the two it's about. */
  hero?: number;
  a?: number;
  b?: number;
  /** What has happened so far, a line a chapter. */
  log: string[];
}

export interface Raid {
  id: number;
  /** A saga's raid: the run it belongs to (sim/sagas.ts). */
  saga?: number;
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
  /** A rival lord's hexes on the defenders and blessings on its army, until these ticks (sim/rivals.ts). */
  hex?: Partial<Record<'hold' | 'fog' | 'emp' | 'frenzy' | 'ward', { until: number; name: string }>>;
  /** Held at the gate for the player (sim/offline.ts): the real ms it has waited so far. Unset once it's under way,
   *  and `alone` once it has been left to play out without them. */
  waiting?: number;
  alone?: boolean;
  /** The tower-defence battle on the trail (sim/battle.ts), while it's on and after. */
  battle?: TownBattle;
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
  /** Titles won in the sagas ("Maud's Bane"): the latest is said after the name. */
  titles?: string[];
  /** RecruitType id. */
  type: string;
  look: Look;
  /** Where they stand on the land, in world px. */
  x: number;
  y: number;
  dir: 1 | -1;
  /** The way they're walking (cells still to pass, nearest first) and where to (px); dropped when the goal changes. */
  path?: Pt[];
  goal?: Pt;
  /** Rallied by the player in a fight until this tick (sim/rally.ts). */
  rallied?: number;
  /** The tick a blow last landed on them, and which side it came from (-1 the left): for the blood. */
  lastHit?: number;
  hitFrom?: 1 | -1;
  /** The tick they last struck at a foe, and last turned a blow (blocked or parried): for the fighting poses. */
  lastBlow?: number;
  lastBlock?: number;
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
  /** Their income (sim/economy.ts): today's and yesterday's coins, pay owed for work by the hour not yet a whole
   *  coin, and what the last hourly pay was for (the Townsfolk tab). */
  pay?: { day: number; today: number; yesterday: number };
  /** Rent they couldn't pay, and rent paid in all (sim/property.ts). */
  debt?: number;
  rentPaid?: number;
  taxPaid?: number;
  /** Their life's goal (data/ambitions.ts), decided once they're grown; trips made (sim/ambition.ts). */
  ambition?: AmbitionId;
  trips?: number;
  /** When their last trip came home (sim/parties.ts: rested before the next). */
  homeAt?: number;
  /** A guard hired by the treasury (sim/treasury.ts), and the days running it couldn't pay them. */
  guard?: boolean;
  guardUnpaid?: number;
  owed?: number;
  paidFor?: { line: string; n: number };
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
  /** When they came of age (sim/ageing.ts): elders and old age count from it. */
  grownAt?: number;
  /** Grieving someone close, until a tick. */
  grief?: { until: number; value: number; text: string } | null;
  /** Wounds on the body, lasting scars and lost parts, prosthetics fitted for them, and a surgery's rest (sim/injuries.ts). */
  wounds?: { part: import('../data/injuries').BodyPart; kind: import('../data/injuries').WoundKind; sev: number; peak: number }[];
  lasting?: { part: import('../data/injuries').BodyPart; kind: 'scar' | 'lost' }[];
  fitted?: Partial<Record<import('../data/injuries').BodyPart, string>>;
  surgeryUntil?: number;
  /** A brawl with an enemy smarting still (sim/social.ts). */
  sore?: { until: number; value: number; text: string } | null;
  /** A mental break in progress (see breaks.ts). */
  breakdown?: { kind: 'sulk' | 'binge' | 'brawl' | 'wander'; until: number; target?: number } | null;
  /** Game hours their morale has been at breaking point. */
  lowMoraleHours?: number;
  /** Their people, when not the town's (sim/strangers.ts): their lifespan and look are theirs. */
  origin?: OriginId;
  /** Their nature (data/natures.ts), when not the one their id decides. */
  nature?: NatureId | null;
  /** A monster (werewolf or vampire), its standing order for the Hunter's Guild, and when it last fed. */
  monster?: MonsterKind | null;
  /** A special newcomer's secret (data/specials.ts, sim/specials.ts): who they really are, and how it stands. */
  secret?: Secret;
  /** Their class (data/classes.ts): given once when they're grown, for life. */
  cls?: ClassId | null;
  /** A founder's own calling (data/founderClasses.ts: the founder's id), standing on `cls` as its base. */
  fcls?: string | null;
  /** Their level (levels.ts: from all they do, fighting most), and the XP toward the next. Left out: level 1. */
  level?: number;
  lvXp?: number;
  /** The class stage last announced (an evolution is told once). */
  stageSeen?: number;
  /** Has reached their class's last stage (classes.ts ascend): rare and late. */
  ascended?: boolean;
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
  /** A machine (the Machine Colony origin): never eats, sleeps or sickens, and its spirits hold steady. */
  machine?: boolean;
}

/** The raised dead and machines never eat, sleep or sicken. */
export const tireless = (p: Pick<Person, 'monster' | 'machine'>) => p.monster === 'undead' || !!p.machine;

/** Base health, and the extra a Tough person has. */
export const BASE_HP = 60;
export const TOUGH_HP = 20;
/** Health lost for each time someone was revived from a cryo pod (never below MIN_HP). */
export const FRAIL_HP = 12;
export const MIN_HP = 24;

export function maxHp(p: Pick<Person, 'traits'> & { monster?: MonsterKind | null; cls?: ClassId | null; fcls?: string | null; level?: number }): number {
  const frail = p.traits.filter((t) => t === 'frail').length * FRAIL_HP;
  const base = Math.max(MIN_HP, BASE_HP + (p.traits.includes('tough') ? TOUGH_HP : 0) + (p.monster ? MONSTER_HP : 0) - frail);
  // (a class and its stage, and every level, add to it: levels.ts)
  return Math.round(base * hpMult(p));
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
  /** Another people's caravan (data/trade.ts FACTION_GOODS), named for them. */
  faction?: OriginId;
}

/** A special newcomer's secret (sim/specials.ts). */
export interface Secret {
  id: SpecialId;
  /** Found out (the town has had its say, or the secret struck first). */
  found?: boolean;
  /** When they joined, and when the secret strikes if still hidden. */
  joined?: number;
  due?: number;
  /** The secret struck before anyone saw it. */
  struck?: boolean;
  /** It's over: nothing more comes of it. */
  settled?: boolean;
  /** What the town chose (the option's index), once it knew. */
  choice?: number;
  /** Coins the highwayman lifted from the treasury. */
  stolen?: number;
}

/** A question waiting for the player, answered by default when the timer runs out. */
export interface Prompt {
  id: number;
  kind: 'strangers' | 'raid' | 'rite' | 'lich' | 'gate' | 'event' | 'thirst' | 'visitor' | 'secret' | 'saga' | 'road' | 'debrief';
  /** A commanded party's question on the road (sim/muster.ts `CROSSROADS`): which one. */
  road?: string;
  /** A saga's question: the run it belongs to (sim/sagas.ts). */
  saga?: number;
  /** The expedition it's about (strangers), or null. */
  expedition: number | null;
  title: string;
  text: string;
  options: string[];
  defaultOption: number;
  expiresTick: number;
  /** A choice event's fuller telling (the scene, the event, more of it), its picture (a painted background, data/
   *  eventScenes.ts), and who it's about: for the full-screen event box. */
  story?: string;
  picture?: string;
  who?: number;
}

export type ExpeditionPhase = 'out' | 'work' | 'back';

/** How a fight ended, for the victory screen. */
export interface FightResult {
  tick: number;
  outcome: 'won' | 'retreated' | 'lost';
  members: { id: number; name: string; xp: number; levelFrom: number; levelTo: number; down: boolean }[];
  loot: Stock;
  coins: number;
  foes: string[];
  boss: string | null;
}

/** A boat of the town's fleet. */
export interface Boat {
  id: number;
  kind: BoatKind;
  name: string;
  /** What's left of her hull (data/boats.ts `hull` when new). */
  hull: number;
  /** The expedition she's away with, or null at home. */
  away: number | null;
}

export interface Expedition {
  id: number;
  /** Destination id. */
  dest: string;
  /** What the player staked on it as it left (sim/expeditions.ts STAKES): a safe or a risky trip. */
  stakes?: 'safe' | 'risky';
  /** Who gathered the party, when it formed itself (sim/parties.ts). */
  leader?: number;
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
  /** Their boat went down at sea (sim/boats.ts `wreck`): they come home with nothing. */
  wrecked?: boolean;
  /** The boat the party sails in (its id in `s.boats`): an island's trip, or a faster one along the water. */
  boat?: number;
  /** A dungeon delve's progress room by room (sim/delves.ts). */
  delve?: Delve;
  /** The Moon Pack's full-moon hunt (sim/pack.ts). */
  hunt?: boolean;
  /** Sent by the player (sim/muster.ts): it asks on the road, and is debriefed at home. How many road questions it has
   *  asked, the rations packed, and each member's level and wounds as they set out (for the debrief). */
  ordered?: boolean;
  crossroads?: number;
  rations?: 'lean' | 'normal' | 'plenty';
  start?: { level: Record<number, number>; wounds: Record<number, number>; names: Record<number, string>; tick: number };
  /** Spare torches packed beyond the town's reckoning (a delve). */
  extraTorches?: number;
  /** The last fight's outcome, for the watcher's victory screen (sim/expeditions.ts finishBattle): when, how it
   *  went, each member's experience and levels, and what was taken. */
  result?: FightResult;
}

/** Someone waiting at the edge of town to be let in. */
export interface Visitor {
  person: Person;
  /** Where they stop and wait. */
  waitX: number;
  waitY: number;
  /** They give up and leave at this tick. */
  leavesTick: number;
  /** Once turned away (or tired of waiting) they walk off to this point and vanish. */
  leavingTo: Pt | null;
}

/** A party the player is raising (sim/muster.ts): where to, who leads, who's asked, how boldly, what's packed, and who
 *  said no (why, and the coins that would bring them; null: only an order will). */
export interface Muster {
  dest: string;
  leader: number;
  members: number[];
  stakes: 'safe' | 'risky';
  rations: 'lean' | 'normal' | 'plenty';
  torches: number;
  horses: boolean;
  refused: Record<number, { why: string; price: number | null }>;
  /** Those the player overrode (talked round or ordered): they won't be asked again. */
  agreed: number[];
}

export interface GameState {
  version: 17;
  /** A party the player is raising (sim/muster.ts). */
  muster?: Muster;
  /** World seed (the land is made from it; changes live in `land`). */
  seed: string;
  /** Ticks simulated since the game began. */
  tick: number;
  /** State of the simulation RNG. All sim randomness draws from this, never Math.random(). */
  rngState: number;
  paused: boolean;
  era: Era;
  /** The land, seen from above (sim/land.ts): its cells, pools, roads, the open area and the camp. */
  land: LandMap;
  /** Every building and blueprint, in placement order (which is also construction priority). */
  buildings: Building[];
  people: Person[];
  /** The main character. Their death ends the game. */
  mainId: number;
  nextId: number;
  /** A would-be recruit waiting for an answer, if any. */
  visitor: Visitor | null;
  expeditions: Expedition[];
  /** When the Cave Bear comes down for its totem, if the town has learned the Elder's Council and nobody has fetched it
   *  (sim/caveBear.ts). */
  caveBearTick?: number;
  /** Destinations visited at least once (their loot is known). */
  scouted: string[];
  /** The regions of the world map the town's scouts have mapped (data/regions.ts; home is always known). */
  regions?: string[];
  /** How many times the town has cleared each dungeon (data/dungeons.ts). */
  delved?: Record<string, number>;
  /** A cleared dungeon lies quiet until this tick, then reawakens deeper (sim/delves.ts). */
  dungeonQuiet?: Record<string, number>;
  /** Quests open (sim/quests.ts). */
  quests?: Quest[];
  /** The places on the town's own land (sim/places.ts): seeded on first use, found as the land opens. */
  places?: MapPlace[];
  /** Blood on the ground where someone was struck down (`markBlood`). */
  blood?: BloodMark[];
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
  /** A hidden vampire's bites on townsfolk since the town last spoke of it, and whether the town keeps a blood tithe
   *  for its vampires (sim/monsters.ts: fed cleanly, no more bites). */
  bites?: number;
  /** The special newcomers who have come to this town (each comes once), and the defences undone by a saboteur until
   *  this tick (towers and traps silent: sim/specials.ts). */
  specialsSeen?: SpecialId[];
  sabotage?: number;
  /** The sagas under way (sim/sagas.ts), those finished (by id), and when the last began. */
  sagas?: SagaRun[];
  sagasDone?: { id: string; outcome: 'triumph' | 'bittersweet' | 'ruin'; tick: number; hero?: string }[];
  lastSaga?: number;
  /** The Monster Hunters' Guild (sim/hunts.ts): hunts on its board, when it last posted one, and hunts won by quarry. */
  hunts?: Hunt[];
  /** The kinds of foe the town has met, in raids or on the road (the Bestiary: `meet`). */
  met?: string[];
  lastHunt?: number;
  huntsWon?: Record<string, number>;
  tithe?: boolean;
  /** When the town last said someone dropped a load for want of storage (once an hour at most). */
  dropNoted?: number;
  /** A world-dooming event on its way or under way, and when the next is due (see doom.ts). */
  doom?: Doom | null;
  nextDoomTick?: number;
  research: ResearchState;
  /** Items not being worn, by item id (they take no storage room), and the quality of each piece, best first (kept in
   *  step with the counts by crafting.ts's qualitiesOf; Common when left out). */
  items: Record<string, number>;
  /** The unique weapons the town has found (data/uniques.ts), in the order found: each drops once in the world. */
  uniques?: string[];
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
  graves?: { x: number; y: number; name: string }[];
  /** The town's boats (data/boats.ts, sim/boats.ts): built at the boatyard, at home fishing or away with a party. */
  boats?: Boat[];
  /** Boats built so far (for their names, in turn). */
  boatsBuilt?: number;
  /** How many of its own the town has buried, ever (a Necromancer's calling needs some). */
  burials?: number;
  /** The last person brought back from death, and when (for the glow). */
  revivedAt?: { tick: number; id: number } | null;
  /** Spells cast on townsfolk lately (turned, healed), for the effects drawn round them. */
  fx?: { tick: number; id: number; kind: PersonFx }[];
  /** Where meteors struck lately (for the impact bursts). */
  impacts?: { tick: number; x: number }[];
  /** A castle town's keep (sim/castle.ts): how many wings it has grown beyond its era's size, as its rooms needed room. */
  keepGrown?: number;
  /** A nomad tribe's seasonal round (sim/nomads.ts): its home ground and summer pasture (tiles), where the camp is
   *  now, when it last moved and from where, whether it has settled for good, and where the tents stood at the camp it
   *  left (px: the marks they left on the ground). */
  nomad?: { home: Pt; pasture: Pt; camp: Pt; movedAt?: number; from?: Pt; settled?: boolean; left?: { x: number; y: number; w: number }[] };
  /** Spells cast lately (the town's powers and rival lords'), for the renderer to draw (see castSpellFx). */
  spellFx?: SpellFx[];
  /** The living are frightened (someone was turned) until this tick. */
  turningFearUntil?: number;
  /** Ironman: a single save with no backups, and no cheats. */
  ironman?: boolean;
  /** Threat level (normal when left out). */
  difficulty?: Difficulty;
  /** Where the self-running town puts its effort (growth when left out), and what it last decided. */
  direction?: Direction;
  plan?: TownPlan;
  /** The ring wall round the town (sim/ringWall.ts). */
  ring?: Ring;
  /** False turns the town's own planner off (tests of single mechanics). On when left out. */
  autopilot?: boolean;
  /** The player's veto on destinations, the treasury's bounties on them (coins set aside), and when the last party
   *  formed itself (sim/parties.ts). */
  vetoed?: string[];
  /** An event holds some of the town to one job for a while (a fireline cut, the bridge rebuilt): who, where, till when. */
  /** Life's ceremonies (sim/ceremonies.ts): the dead to bury at the next funeral (with who was close), a feast due, the
   *  gathering under way, and when the last feast was. */
  funeralsDue?: { name: string; close: number[]; tick: number }[];
  feastDue?: { kind: 'wedding' | 'feast'; text: string };
  gathering?: { kind: 'funeral' | 'great_funeral' | 'wedding' | 'feast'; ids: number[]; until: number; text: string; x: number; y: number };
  lastFeast?: number;
  /** An event to put to the player next, once the one open now is answered (`follow`). */
  eventNext?: string;
  busy?: { until: number; ids: number[]; text: string; x: number; y: number; anim: 'chop' | 'build' | 'mine' };
  bounties?: Record<string, number>;
  lastParty?: number;
  /** Raids fought as tower-defence battles (unset: on; the tests' plainGame turns them off), and auto-watch: the town
   *  places its fighters and fights by itself (sim/battle.ts). */
  battles?: boolean;
  /** The raid battles fight themselves (`autoBattle` in battle.ts): on unless the player turned it off. */
  autoBattle?: boolean;
  /** How fast a battle plays: 1, 2 or 3 times (kept for later battles; `battleSpeedNow` in battle.ts). */
  battleSpeed?: number;
  /** How fast the town runs between battles: 1, 2 or 3 times (the clock bar's button). */
  gameSpeed?: number;
  /** The last event answered and what came of it (sim/events.ts `tell`), for the feed's card. */
  eventOutcome?: { title: string; choice: string | null; text: string; tick: number };
  /** The town's purse (none when left out), strangers in town, and when the next is due at the shop. */
  coins?: number;
  travellers?: Traveller[];
  nextTravellerTick?: number;
  /** The founder's soul is to be bound into a phylactery (the town builds it); and, once it stands, the founder is a
   *  lich, and the town looks it from then on, whatever becomes of the phylactery. */
  lichChosen?: boolean;
  lich?: boolean;
  /** When the next guest is due at the tavern. */
  nextGuestTick?: number;
  /** When the next customer for each specialty shop is due. */
  nextStoreTick?: Partial<Record<ShopLine, number>>;
  /** Who founded the town (see data/origins.ts; Settlers when left out), when each of its powers is ready again, what
   *  it has cast lately (newest last), and the spells still in effect (by id, until a tick). */
  origin?: OriginId;
  powers?: Record<string, number>;
  powerLog?: { tick: number; text: string }[];
  buffs?: Record<string, number>;
  /** The Moon Pack's standing (sim/pack.ts). */
  pack?: PackState;
  /** Choice events (sim/events.ts): the one being asked now (its def, prompt and the townsperson it's about), when the
   *  next may come, the last few drawn (not drawn again soon), the marks answers left on the town (a lever or
   *  everyone's morale, until a tick), and effects still to come. */
  /** The choice event waiting for an answer; `held` once it has paused the town during time away (offline.ts). */
  event?: { def: string; prompt: number; who?: number; held?: boolean };
  /** The townsperson the player follows (the camera keeps them in view; their big moments send phone alerts). */
  hero?: number;
  /** The expedition (or delve) the player is watching, in place of the town (snapshot.watch). */
  watching?: number;
  /** The mine (a place id, sim/places.ts) the player has gone into, in place of the town (snapshot.mine). */
  watchingMine?: number;
  /** The origin power the player keeps back to cast themselves (sim/powers.ts castHeld). */
  heldPower?: string;
  /** When the player can rally a defender again (sim/rally.ts). */
  rallyReady?: number;
  nextEventTick?: number;
  /** When the last fateful event (data/fatefulEvents.ts) came. */
  lastFateful?: number;
  /** When a wanderer last came to the gate (arrivals are a question to the player, and come no oftener than
   *  VISIT_GAP_HOURS apart). */
  lastVisit?: number;
  /** How many people the player wants the town to hold (unset: as many as come). Nobody joins or is born past it. */
  popTarget?: number;
  /** The tax lever (data/economy.ts TAX; fair when left out), and since when it has been heavy. */
  tax?: TaxRate;
  taxHeavySince?: number;
  eventLog?: string[];
  marks?: { lever: string; value: number; until: number; text: string }[];
  /** Effects waiting their hour: a top-level `later` of an answer (by its place), or one met deeper (its effects kept). */
  eventLater?: { tick: number; event: string; option: number; index: number; who?: number; effects?: EventEffect[] }[];
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

/** Something a spell touched: a townsperson, a raider (by id: the renderer follows them), or a place. */
export interface SpellTarget {
  x: number;
  /** On the land (px): the renderer places the spell by it; older casts without one are drawn at the camp's row. */
  y?: number;
  id?: number;
  raider?: boolean;
}
/** A spell cast, as the renderer draws it: which spell (`town:<power>` or `rival:<spell>`), from where, onto what,
 *  and for how long its look lasts (seconds). */
export interface SpellFx {
  n: number;
  tick: number;
  spell: string;
  x: number;
  y?: number;
  /** The caster, when it's someone (their id; a raider for a rival lord). */
  by?: SpellTarget;
  targets: SpellTarget[];
  secs: number;
}
/** How long a spell's look is kept for the renderer, at most (ticks). */
export const SPELL_FX_TICKS = 300;

/** Record a spell for the renderer (old ones are dropped). */
/** Blood on the ground where someone was struck down (world px, their feet; `from` the side the blow came from). The
 *  renderer draws them fading; they're kept `BLOOD_LASTS` ticks, at most `BLOOD_MOST` at a time. */
export interface BloodMark {
  x: number;
  y: number;
  from: 1 | -1;
  tick: number;
}
export const BLOOD_LASTS = 3 * 600;
export const BLOOD_MOST = 40;

/** Someone (or something that bleeds) was struck down here. */
export function markBlood(s: GameState, x: number, y: number, from: 1 | -1): void {
  const list = (s.blood ??= []).filter((m) => s.tick - m.tick < BLOOD_LASTS);
  list.push({ x: Math.round(x), y: Math.round(y), from, tick: s.tick });
  while (list.length > BLOOD_MOST) list.shift();
  s.blood = list;
}

export function castSpellFx(s: GameState, spell: string, by: SpellTarget, targets: SpellTarget[], secs = 2): void {
  s.spellFx = (s.spellFx ?? []).filter((f) => s.tick - f.tick < SPELL_FX_TICKS);
  s.spellFx.push({ n: (s.spellFx.at(-1)?.n ?? 0) + 1, tick: s.tick, spell, x: by.x, y: by.y, by: by.id !== undefined ? by : undefined, targets: targets.slice(0, 10), secs });
  if (s.spellFx.length > 12) s.spellFx.splice(0, s.spellFx.length - 12);
}

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
  /** A "while you were away" report: `text` is its title, `lines` the summary, and the three biggest things that
   *  happened, as pictures (sim/highlights.ts). */
  lines?: string[];
  highlights?: { text: string; building?: string; person?: number }[];
}

const MAX_NOTICES = 20;
export const MAX_JOURNAL = 400;

/** A day's coins in and out: from travellers at the shop and the tavern, from the townsfolk (their gear and their
 *  evenings out), and out on wages, crafters' pay, the venues (rooms and improvements), and goods bought in. */
export type LedgerLine = 'shop' | 'tavern' | 'townsfolk' | 'wages' | 'crafters' | 'venues' | 'goods' | 'events' | 'rent' | 'tax' | 'guards' | 'bounties';
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

/** The town has met these kinds of foe (the Bestiary page lights them up). */
export function meet(s: GameState, kinds: Iterable<string>): void {
  const met = (s.met ??= []);
  for (const k of kinds) if (!met.includes(k)) met.push(k);
}

/** Tell the player something: a toast on the strip and a line in the Journal. `key` marks milestones. */
/** What came of an answer (an event's, a secret's, a saga's), kept a while for the event box and the feed's card. */
export function setOutcome(s: GameState, title: string, choice: string | null, text: string): void {
  s.eventOutcome = { title, choice, text, tick: s.tick };
}

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
  /** Who founds it (Settlers when left out). */
  origin?: OriginId;
}

/** Give the rolled founder the player's choices. */
function makeFounder(p: Person, spec: FounderSpec): void {
  const def = spec.pick ? FOUNDER_BY_ID[spec.pick] : undefined;
  const f: FounderSpec = def ? { background: def.background.id, traits: def.traits, look: def.look, name: spec.name || def.name } : spec;
  const bg = def?.background ?? BACKGROUND_BY_ID[f.background] ?? BACKGROUND_BY_ID.forager;
  const levels = founderSkills(bg);
  p.skills = Object.fromEntries(SKILLS.map((k) => [k, { level: levels[k], xp: 0 }])) as Record<Skill, SkillLevel>;
  p.passions = [...bg.passions];
  p.traits = [...f.traits];
  if (f.name) p.name = f.name;
  if (f.look) p.look = { ...f.look, ...(f.look.wear ? { wear: [...f.look.wear] } : {}) };
  p.priorities = autoPriorities(p.skills, true);
  // (a ready-made founder's calling is their own, on its base class)
  const calling = def ? FOUNDER_CLASS[def.id] : undefined;
  if (calling) {
    p.cls = calling.base;
    p.fcls = calling.id;
    p.level = 1;
    p.stageSeen = 0;
  }
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
  const rules = (ORIGIN_DEFS[opts.origin ?? 'settlers'] ?? ORIGIN_DEFS.settlers).rules;
  const hold = rules.hold;
  // (a shore town is always on the coast)
  const biome = rules.shape === 'sea' ? 'coast' : opts.biome;
  const land = makeLand(seed, biome, hold ?? rules.shape);
  const rng = new Rng(mixSeed(hashSeed(seed), 0x5eed));
  const camp = land.camp;
  const campPx = (dx: number, dy = 0): Pt => ({ x: (camp.x + 0.5 + dx) * CELL, y: (camp.y + 0.5 + dy) * CELL });
  /** Where the next person stands: about the fire. */
  const standing = (n: number): Pt => campPx((n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.9, 1.6 + (n % 3) * 0.3);

  const main = makePerson(rng, 1, 'founder', campPx(-1, 1.6), []);
  if (opts.founder) makeFounder(main, opts.founder);
  main.priorities = autoPriorities(main.skills, true); // (the founder turns their hand to anything)
  // The camp starts with its fire, which doubles as a small cache, and a little food (more, and company, in
  // some scenarios).
  const scenario = SCENARIO_BY_ID[opts.scenario ?? 'lone'] ?? SCENARIO_BY_ID.lone;
  // (the fire's footprint is 2 by 2, the camp's centre cell its front left)
  // (a mountain hold's camp lies at the mountain's foot, the fire and stores below the gate)
  const campRow = hold === 'mountain' ? camp.y + 1 : camp.y - 1;
  const campfire: Building = { id: 2, def: 'campfire', tile: camp.x, row: campRow, status: 'done', delivered: {}, progress: 1, store: {} };
  const buildings = [campfire];
  const people = [main];
  let nextId = 3;
  for (const type of scenario.companions) {
    const p = makePerson(rng, nextId++, type, standing(people.length), people.map((q) => q.name));
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
  // the origin: its own companions, stores, knowledge and buildings, and who the founder (and everyone) is
  const origin = ORIGIN_DEFS[opts.origin ?? 'settlers'] ?? ORIGIN_DEFS.settlers;
  // (and whoever a ready-made founder brings)
  const brings = opts.founder?.pick ? (FOUNDER_BY_ID[opts.founder.pick]?.brings ?? []) : [];
  for (const type of [...(origin.start.companions ?? []), ...brings]) {
    people.push(makePerson(rng, nextId++, type, standing(people.length), people.map((q) => q.name)));
  }
  for (const [m, n] of Object.entries(origin.start.stores ?? {}) as [Material, number][]) {
    const here = Math.min(n, room);
    if (here > 0) addStock(campfire.store, m, here);
    room -= here;
    if (n > here) addStock(extra, m, n - here);
  }
  const k = origin.rules.kin;
  for (const p of people) {
    if (k === 'machine') p.machine = true;
    else if (k === 'undead' && p !== main) turnMonster(p, 'undead', 0);
    else if (k === 'werewolf' && p !== main) turnMonster(p, 'werewolf', 0);
  }
  const f = origin.rules.founder;
  if (f === 'machine') main.machine = true;
  else if (f === 'vampire' || f === 'werewolf') turnMonster(main, f, 0);
  else if (f === 'lich' && !main.look.body) main.look = { ...main.look, skin: '#b9c4ae' }; // (the colour of old bone)
  // what the fire can't hold waits in a stockpile just past it
  if (Object.keys(extra).length) buildings.push({ id: nextId++, def: 'stockpile', tile: camp.x + 3, row: campRow, status: 'done', delivered: {}, progress: 1, store: extra });
  // (a nomad tribe has a summer pasture a day's ride across the land, the way the seed picks)
  const pastureSide = hashSeed(seed) % 4;
  const pasture: Pt = { x: Math.max(8, Math.min(land.w - 9, camp.x + (pastureSide === 0 ? NOMAD_PASTURE_TILES : pastureSide === 1 ? -NOMAD_PASTURE_TILES : 0))), y: Math.max(8, Math.min(land.h - 9, camp.y + (pastureSide === 2 ? NOMAD_PASTURE_TILES : pastureSide === 3 ? -NOMAD_PASTURE_TILES : 0))) };
  const nomad = origin.rules.nomadic ? { home: { ...camp }, pasture, camp: { ...camp } } : undefined;
  // (and anything the origin starts with standing, west of the fire in a row)
  let at = camp.x - 2;
  // (a mountain hold: the entrance hall is cut into the mountain's foot above the camp, and the first halls beside it)
  const core = hold === 'mountain' ? { x: camp.x - 3, y: camp.y - MOUNTAIN_FOOT - 4 + 1, w: 6, h: 4 } : null;
  if (core) for (let y = core.y; y < core.y + core.h; y++) for (let x = core.x; x < core.x + core.w; x++) setGround(land, x, y, 'hall');
  let hallAt = core ? core.x : 0;
  // the seat of the town (data/seats.ts): a hold's stands on its hall (the castle's over the camp, the mountain's cut
  // into its foot); everyone else's just beyond the fire
  const seatCore = core ?? (origin.rules.castle ? { x: camp.x - 3, y: camp.y - 2 } : null);
  buildings.push(
    seatCore
      ? { id: nextId++, def: seatId(origin.id, 1), tile: seatCore.x, row: seatCore.y, status: 'done', delivered: {}, progress: 1, store: {}, room: true }
      : { id: nextId++, def: seatId(origin.id, 1), tile: camp.x - 2, row: campRow - 1 - SEAT_D, status: 'done', delivered: {}, progress: 1, store: {} },
  );
  for (const def of origin.start.buildings ?? []) {
    const d = BUILDING_BY_ID[def];
    if (core && d.layer === 'mid') {
      hallAt -= d.width;
      for (let y = core.y; y < core.y + 2; y++) for (let x = hallAt; x < hallAt + d.width; x++) setGround(land, x, y, 'hall');
      buildings.push({ id: nextId++, def, tile: hallAt, row: core.y, status: 'done', delivered: {}, progress: 1, store: {}, room: true });
      continue;
    }
    at -= d.width;
    buildings.push({ id: nextId++, def, tile: at, row: campRow, status: 'done', delivered: {}, progress: 1, store: {}, ...(origin.rules.castle && d.layer === 'mid' ? { room: true } : {}) });
    at -= 1;
  }

  return {
    version: 17,
    seed,
    tick: 0,
    rngState: rng.state,
    paused: false,
    era: 'neolithic',
    land,
    buildings,
    ...(nomad ? { nomad } : {}),
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
    research: { done: [...new Set([...scenario.research, ...(origin.start.research ?? [])])], queue: [], progress: {} },
    items: { ...(origin.start.items ?? {}) },
    crafting: [],
    notices: [],
    journal: [],
    unreadAway: null,
    eraReady: false,
    cheats: { unlockAll: false },
    ...(biome && biome !== 'forest' ? { biome } : {}),
    ...(opts.ironman ? { ironman: true } : {}),
    ...(opts.difficulty && opts.difficulty !== 'normal' ? { difficulty: opts.difficulty } : {}),
    ...(origin.id !== 'settlers' ? { origin: origin.id } : {}),
    ...(f === 'lich' ? { lich: true } : {}),
  };
}

/** Make someone a monster (as monsters.ts becomeMonster does; here too so founding needs no sim module). */
function turnMonster(p: Person, kind: MonsterKind, tick: number): void {
  p.monster = kind;
  p.order = 'hide';
  p.lastFed = tick;
  p.hp = maxHp(p);
}

/** A new person of a recruit type: skills from its ranges, 1-3 passions, 1-2 traits, a name not in use. */
export function makePerson(rng: Rng, id: number, typeId: string, at: Pt, takenNames: readonly string[]): Person {
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
    x: at.x,
    y: at.y,
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
/** Priorities from skills: what someone is good at first, everything else after (never off, so nobody stands idle
 *  while there's work). The founder can turn their hand to anything: building and study never below normal. */
export function autoPriorities(skills: Record<Skill, SkillLevel>, founder = false): Record<Job, Priority> {
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
  // (the founder: building and study never below normal, whatever their skills; a lone founder still gathers and
  // carries first, or there would be nothing to build with)
  if (founder) {
    out.construct = Math.min(out.construct, 2) as Priority;
    out.research = Math.min(out.research, 2) as Priority;
  }
  return out;
}

/** World x of the camp centre (where idle people drift back to). */
/** The middle of the camp: the middle of the land (World.camp), unless a nomad tribe has moved it (nomads.ts). */
/** How far a nomad tribe's summer pasture is from its home ground (tiles). */
export const NOMAD_PASTURE_TILES = 42;

/** The camp's centre cell (a nomad tribe's wherever it's pitched), and the same in world px. */
export const campCell = (s: Pick<GameState, 'land' | 'nomad'>): Pt => s.nomad?.camp ?? s.land.camp;
export function campXY(s: Pick<GameState, 'land' | 'nomad'>): Pt {
  const c = campCell(s);
  return { x: (c.x + 0.5) * CELL, y: (c.y + 0.5) * CELL };
}
export function campX(s: Pick<GameState, 'land' | 'nomad'>): number {
  return campXY(s).x;
}
/** The land's edge on the camp's row, one cell out, on a side (where strangers come in and go out), in px. */
export function edgeXY(s: Pick<GameState, 'land' | 'nomad'>, side: -1 | 1): Pt {
  return { x: side < 0 ? -CELL / 2 : (s.land.w + 0.5) * CELL, y: campXY(s).y };
}
/** Which side of the camp a point lies. */
export const sideOf = (s: Pick<GameState, 'land' | 'nomad'>, p: Pt): -1 | 1 => (p.x < campX(s) ? -1 : 1);
/** The distance between two points on the land (px). */
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, b.y - a.y);

/** A cell index's centre on the land, in px. */
export function cellXY(s: Pick<GameState, 'land'>, i: number): Pt {
  return { x: ((i % s.land.w) + 0.5) * CELL, y: (Math.floor(i / s.land.w) + 0.5) * CELL };
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

/** The town is as big as the player wants it (`popTarget`): nobody more joins, by any door, and no child is born. */
export const townFull = (s: Pick<GameState, 'popTarget' | 'people'>) => s.popTarget !== undefined && s.people.length >= s.popTarget;
/** The sizes the player can pick for the town (the Plan tab); `undefined` is no limit. */
export const TOWN_SIZES = [5, 10, 20, 40] as const;
