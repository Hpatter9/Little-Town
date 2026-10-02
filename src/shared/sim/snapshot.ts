// What the renderers see of the sim: a read-only copy sent over IPC each tick.

import { ROOM_SECONDS, TWISTS } from '../data/dungeons';
import { bossName, delveRoomTicks, quietHours } from './delves';
import { HOME_REGION } from '../data/regions';
import type { Biome } from '../data/biomes';
import { className, type ClassId } from '../data/classes';
import { levelOf, stageOf } from '../data/levels';
import { levelProgress } from './classes';
import { turnable, undeadShare } from './turning';
import { FULL_MOON_PHASE, moonPhaseOf, nightDay } from './monsters';
import { weatherAt, type WeatherNow } from './weather';
import { directionOf, forSale, shoppingList, type Direction, type TownPlan } from './planner';
import { appeal, asleepHour, attractiveness, bedsOf, roomsOf, customerTiers, extensionPrice, extensionsOf, farePrice, itemPrice, levelPrice, renownOf, SALE_GEAR, shopLayout, wantText, type Rect, trophyRenown } from './shop';
import { moneyTown, wageBill } from './wages';
import { COMMON, qualityOf, typicalQuality } from '../data/quality';
import { OPERATORS } from '../data/operators';
import { HERDS } from '../data/livestock';
import { ORIGIN_DEFS, originOf, type OriginId } from '../data/origins';
import { aimableSpells, POWERS, powersView } from './powers';
import { battleView, type BattleView } from './battle';

/** How the game looks: the classic town, or an origin's own (a lich founder makes any town a necropolis). */
export type ThemeId = 'town' | Exclude<OriginId, 'settlers'>;
const themeOf = (s: GameState): ThemeId => (s.lich ? 'lich' : !s.origin || s.origin === 'settlers' ? 'town' : s.origin);
import { itemUnlocked, qualitiesOf } from './crafting';
import { FARE, furnishes, MAX_EXTENSIONS, temperOf, tierOf, venueOfDef, WARES } from '../data/shop';
import { FARE_NAMES, type FareKind, type FurnishKind, type ItemDef } from '../data/items';
import { BUILDING_BY_ID, UPGRADES } from '../data/buildings';
import type { MonsterKind } from '../data/monsters';
import { ENEMIES } from '../data/enemies';
import { atPlace, DESTINATION_BY_ID, DESTINATIONS, ROLES } from '../data/expeditions';
import { RAID_KIND_BY_ID } from '../data/raids';
import { alarmRaised, cavalry } from './people';
import type { Era } from '../data/eras';
import { ITEM_BY_ID, type Slot } from '../data/items';
import { MATERIAL_NAMES, type Material, type Stock } from '../data/materials';
import { CROPS } from '../data/crops';
import { craftNeeded, craftSlots, hasBedroll, missingItems, stationFor, stationName } from './crafting';
import { CHILD_HOURS } from '../data/social';
import { DOOMS, type DoomKind } from '../data/doom';
import { friendsOf, isChild, rivalsOf } from './social';
import { canTrade, stalls } from './trade';
import { RECRUIT_TYPES, TRAIT_BY_ID, type Job, type Look, type Priority } from '../data/people';
import { RESEARCH_STATIONS, TOPIC_BY_ID } from '../data/research';
import { SKILLS, skillSpeed, xpToNext, type Skill } from '../data/skills';
import { TERRAIN } from '../data/terrain';
import { buildingCentreX, buildSlots, defOf, enclosure, totalCapacity, totalStock } from './buildings';
import { destinationHidden, destinationUnlocked, foodNeeded, partyCarry, planParty } from './expeditions';
import { modifiers, researchStation, researchStations } from './research';
import { carryCapacity, ERA_MULTIPLIER, FX_TICKS, maxHp, RESEARCH_MULTIPLIER, poolSize, type PersonFx, type RaiderHitFx, type SpellTarget, SPELL_FX_TICKS, type Activity, type Building, type CraftOrder, type Expedition, type ExpeditionPhase, type GameState, type JournalEntry, type Ledger, type Needs, type Notice, type Person, type TileState, campX, tileCentreX } from './state';
import { calendar, TICK_HZ, TICKS_PER_HOUR, type Calendar } from './time';
import { hexesNow } from './rivals';
import { castleFloors, castleOn, castleSpan, heightOf, keepFlare, roomOf } from './castle';
import { TILE } from '../constants';

/** Whether x is within the keep's ground floor. */
const inKeepX = (s: GameState, x: number) => {
  const [lo, hi] = castleSpan(s);
  return x >= lo * TILE && x <= hi * TILE;
};
import { rallyState } from './rally';
import { daysToMove } from './nomads';
import { RIVALS } from '../data/rivals';

const spellName = (spell: string): string => {
  const [side, id] = spell.split(':');
  if (side === 'town') return POWERS[id]?.name ?? id;
  for (const r of Object.values(RIVALS)) for (const sp of r.spells) if (sp.id === id) return sp.name;
  return id;
};
import { housingCapacity, mood, SULK_MORALE, type MoodReason } from './townsfolk';

export interface SkillView {
  level: number;
  /** 0..1 toward the next level. */
  progress: number;
  passion: boolean;
}

export interface PersonView {
  id: number;
  name: string;
  typeName: string;
  look: Look;
  x: number;
  dir: 1 | -1;
  activity: Activity;
  /** Their class (none yet: a child, or not given one yet), its name at their stage, their level and the way to the next. */
  cls: ClassId | null;
  clsName: string | null;
  level: number;
  levelProgress: number;
  /** Riding into a fight (cavalry): the horse's coat. */
  mounted: number | null;
  /** Short description of what they're doing, for tooltips. */
  doing: string;
  carrying: Stock;
  skills: Record<Skill, SkillView>;
  traits: { name: string; description: string }[];
  needs: Needs;
  morale: number;
  moodTarget: number;
  moodReasons: MoodReason[];
  priorities: Record<Job, Priority>;
  autoPriorities: boolean;
  /** Name of the building they sleep in, or null (sleeps on the ground). */
  bed: string | null;
  /** Asleep inside a building (the renderer hides them). */
  indoors: boolean;
  /** In a raid: the player can rally them ('ready'), they're rallied ('on'), or the rally is cooling down ('wait'). */
  rally: 'ready' | 'on' | 'wait' | null;
  /** How high up a castle's keep they are, in floors (fractional on the stairs); null on the walkway. */
  floor: number | null;
  /** Destination name while away on an expedition (not in town). */
  away: string | null;
  hp: number;
  maxHp: number;
  /** 'bleeding' (dying unless tended), 'recovering' (stabilized, in bed), or null. */
  downed: 'bleeding' | 'recovering' | null;
  /** Bleeding: game minutes until they bleed out. */
  bleedMinutes: number | null;
  /** Worn items by slot (item ids), and their quality. */
  gear: Partial<Record<Slot, string>>;
  gearQ: Partial<Record<Slot, number>>;
  /** Their own coins (wages, for their gear), once the town has money. */
  coins: number | null;
  /** A little more about them: the role they fill, how their work is going, what their crafting is like. */
  detail: string[];
  /** What they've done lately, newest first. */
  recent: string[];
  /** Sleeps on a bedroll (no bed). */
  bedroll: boolean;
  carryCapacity: number;
  /** Their partner's name (and whether they're married), friends and rivals. */
  partner: string | null;
  married: boolean;
  friends: string[];
  rivals: string[];
  /** Children: game hours until they grow up. */
  growsUpIn: number | null;
  /** A mental break in progress, described. */
  breakdown: string | null;
  /** Monsters: what they are and their standing order for the Hunter's Guild. */
  monster: string | null;
  order: string | null;
  sick: boolean;
}

export interface CraftOrderView {
  id: number;
  item: string;
  count: number;
  progress: number;
  /** Materials still to bring for the piece being made. */
  needed: Stock;
  /** Why nobody is working on it, if nobody is. */
  waiting: string | null;
  crafter: string | null;
}

export interface FighterView {
  /** Ticks since its last sweeping attack (bosses). */
  sinceArea: number;
  side: 'party' | 'enemy';
  ref: number;
  kind: string;
  name: string;
  hp: number;
  maxHp: number;
  row: 'front' | 'back';
  down: boolean;
  role: string;
  /** Person look and gear (party members only). */
  look: Look | null;
  gear: Partial<Record<Slot, string>>;
  /** Fights from range (thrown stones, a sling). */
  ranged: boolean;
  /** Battle ticks since their last action / since they were last hit. */
  sinceAction: number;
  sinceHit: number;
  /** What the last hit was, if special (a Blood Knight's, a gunshot's, a laser's). */
  hitFx: 'blood' | 'fire' | 'lightning' | null;
  /** How near their next turn is (0 to 1: the old games' time gauge), their statuses, their class (party), and the
   *  last number to pop up over them (ticks ago). */
  atb: number;
  statuses: string[];
  clsName: string | null;
  level: number | null;
  pop: { age: number; amount: number; heal: boolean } | null;
  conjured: boolean;
  /** A delve's elite: its affix (drawn with a tint). */
  elite: string | null;
}

export interface RaiderView {
  id: number;
  /** Fighting for the town (summoned, raised or tamed). */
  ally: boolean;
  /** Ticks since its last sweeping attack (bosses), and since it was summoned, raised or tamed. */
  sinceArea: number;
  sinceConjured: number;
  /** Ticks since a rival lord last cast a spell. */
  sinceCast: number;
  /** What the last hit was, if special. */
  hitFx: RaiderHitFx | null;
  kind: string;
  name: string;
  /** How high up a castle's keep it has climbed, in floors; null on the ground. */
  floor: number | null;
  x: number;
  dir: 1 | -1;
  hp: number;
  maxHp: number;
  down: boolean;
  fleeing: boolean;
  gone: boolean;
  carrying: number;
  /** Name of the townsperson they're carrying off. */
  captive: string | null;
  sinceAction: number;
  sinceHit: number;
}

export interface SpellView {
  /** Increasing: each cast once. */
  n: number;
  /** `town:<power>` or `rival:<spell>`. */
  spell: string;
  name: string;
  since: number;
  x: number;
  by: SpellTarget | null;
  targets: SpellTarget[];
  secs: number;
}

export interface RaidView {
  name: string;
  phase: 'warning' | 'active';
  /** Game seconds until they reach the edge of the world (warning phase). */
  secondsToArrival: number;
  side: -1 | 1;
  alarm: boolean;
  /** A rival lord's hexes and blessings on the fight ("Entangle 6s"). */
  hexes: string[];
  raiders: RaiderView[];
}

export interface PromptView {
  id: number;
  title: string;
  text: string;
  options: string[];
  defaultOption: number;
  /** Until the default is taken; null when it waits as long as it takes. */
  secondsLeft: number | null;
}

export interface ExpeditionView {
  id: number;
  dest: string;
  destName: string;
  scenery: string;
  phase: ExpeditionPhase;
  /** 0..1 through the current phase. */
  phaseProgress: number;
  /** Game seconds until they're home (at the current plan). */
  secondsLeft: number;
  members: { id: number; name: string; look: Look; gear: Partial<Record<Slot, string>> }[];
  /** Coats of the horses along. */
  horses: number[];
  truck: boolean;
  loot: Stock;
  lootSize: number;
  carry: number;
  supplies: Stock;
  recalled: boolean;
  /** Which end of town they left from. */
  side: -1 | 1;
  stance: string;
  /** What the player staked on it: a safe or a risky trip (older ones: none). */
  stakes: 'safe' | 'risky' | null;
  roles: Record<number, string>;
  /** A fight in progress, if any, and the spells and skills used in it lately (ticks ago). */
  battle: FighterView[] | null;
  acts: { age: number; side: 'party' | 'enemy'; ref: number; name: string; targets: number[] }[];
  /** Waiting on a question for the player. */
  waiting: boolean;
  /** A delve: the room they're in (1 up; 0 at the door) of how many, what it is, torches left, what's happened lately. */
  delve: { room: number; rooms: number; kind: string | null; torches: number; log: string[]; cleared: boolean; progress: number; twist: string | null; twistText: string; boss: string } | null;
}

export interface DestinationView {
  id: string;
  unlocked: boolean;
  scouted: boolean;
  /** Off the board and the map: in a region not yet mapped, or a region's scouting trip once it's mapped. */
  hidden: boolean;
  /** A dungeon: who the player may pick to delve it (grown, at home, on their feet), and how many times it's been cleared. */
  candidates?: number[];
  cleared?: number;
  /** A cleared dungeon lying quiet: hours until it wakes again. */
  quietHours?: number;
  /** Round trip in game seconds (unloaded). */
  tripSeconds: number;
  /** Food (need units) one member eats on the trip. */
  foodPerMember: number;
  /** The party the town would send now ("Name (role)"), and whether it'd take horses and a truck. */
  party: string[];
  partyHorses: number;
  partyTruck: boolean;
}

export interface VisitorView extends PersonView {
  /** Game hours before they give up (0 once leaving). */
  hoursLeft: number;
  leaving: boolean;
}

/** The town's shop, as its bird's-eye window shows it. */
/** A venue (the shop or the tavern), as its bird's-eye window shows it. A tavern's `appeal` is its comfort. */
export interface ShopView {
  venue: 'shop' | 'tavern';
  building: number;
  def: string;
  name: string;
  /** Being built (or rebuilt bigger): 0..1. */
  progress: number | null;
  cols: number;
  rows: number;
  counter: Rect;
  keeper: Rect;
  door: number;
  pieces: { item: string; name: string; kind: FurnishKind; x: number; y: number; w: number; h: number; appeal: number; level: number; nextLevel: number | null; q: number }[];
  /** The floor's appeal, the shop's renown, and the two together (which decides who comes). */
  appeal: number;
  renown: number;
  /** What the Trophy Hall's treasures add. */
  trophies: number;
  attractiveness: number;
  /** Extensions bought, most there can be, and what the next costs. */
  extensions: number;
  maxExtensions: number;
  nextExtension: number | null;
  /** The ladder of customers: who it draws (from what attractiveness), and the wares each wants (how many are in
   *  stock, and what the town still needs to make them). */
  tiers: { tier: number; name: string; plural: string; from: number; drawn: boolean; wares: { name: string; price: number; have: number; needs: string | null }[] }[];
  keeperName: string | null;
  keeperLook: Look | null;
  /** Strangers inside now: who they are, what they came for, their temper, and (at the tavern) the comfort they need. */
  customers: { id: number; name: string; kind: string; look: Look; tier: number; wants: string; temper: string; req: number | null; bed: { x: number; y: number } | null; asleep: boolean }[];
  /** The tavern's guest rooms upstairs (a bed is a piece at y -1, x the room), its beds, and how many are taken tonight. */
  rooms: number;
  /** Dark out (the windows show the night sky). */
  night: boolean;
  beds: number;
  lodgers: number;
  /** What customers came for lately and didn't find (the town makes it), most asked first. */
  asked: { what: string; times: number }[];
  /** The tavern's menu: every dish, how many are ready (by quality), its price, and what's still needed to make it. */
  menu: { name: string; kind: string; have: number; best: number; price: number; needs: string | null }[];
  /** Spare gear in stock (for customers, and for the townsfolk to buy). */
  gear: { name: string; q: number; n: number; price: number }[];
  /** Coming (walking in) or going (walking out). */
  passing: number;
  forSale: Stock;
  wants: { m: Material; n: number; essential: boolean }[];
  log: { when: string; text: string }[];
  /** Game hours until the next traveller is due, if the shop's open. */
  nextHours: number | null;
  /** A furnishing being made for it, and ones made and waiting to be set out. */
  making: string | null;
  waiting: string[];
  /** What would make it bigger next, once learned. */
  grows: { name: string; research: string | null } | null;
}

export interface TravellerView {
  id: number;
  name: string;
  kind: string;
  venue: 'shop' | 'tavern';
  /** What they came for, in words, their temper, and the coins they have to spend. */
  wants: string;
  temper: string;
  purse: number;
  look: Look;
  x: number;
  dir: 1 | -1;
  phase: 'arriving' | 'shopping' | 'leaving';
  tier: number;
}

export interface Snapshot {
  seed: string;
  /** The town's coins (from selling to travellers), its shop (once one's planned), and the travellers in town. */
  coins: number;
  shop: ShopView | null;
  tavern: ShopView | null;
  /** How the game looks: the town, or (once the founder is a lich) the necropolis; and whether the founder can
   *  choose to become a lich now (Lichcraft learned, not yet chosen). */
  theme: ThemeId;
  lichOffer: boolean;
  /** Who founded the town, its powers (when each is ready, and whether it's in effect), and what they did lately. */
  origin: { id: OriginId; name: string; town: string };
  powers: ReturnType<typeof powersView>;
  powerLog: string[];
  /** What a day's wages come to (once the town has money), and yesterday's coins in and out by where from. */
  wageBill: number;
  ledger: Ledger | null;
  travellers: TravellerView[];
  tick: number;
  paused: boolean;
  calendar: Calendar;
  /** Everything in storage, summed. */
  stock: Stock;
  storageUsed: number;
  storageCapacity: number;
  tileRev: number;
  tiles: TileState[];
  buildings: Building[];
  people: PersonView[];
  visitor: VisitorView | null;
  housing: { beds: number; people: number };
  expeditions: ExpeditionView[];
  destinations: DestinationView[];
  prompts: PromptView[];
  /** Seconds until the player can rally a defender again (0: now). */
  rallyIn: number;
  /** The townsperson the player follows (the camera keeps them in view), while they live. */
  hero: number | null;
  /** The expedition the player is watching, in place of the town. */
  watch: ExpeditionView | null;
  /** Quests open (sim/quests.ts): what, for which dungeon, and hours left to take it up. */
  quests: { id: number; kind: string; dungeon: string; title: string; text: string; hoursLeft: number }[];
  /** The regions of the world map the town knows (data/regions.ts): home, and those its scouts have mapped. */
  regions: string[];
  /** The unique weapons found (data/uniques.ts), in the order found, and who has each now (null: in storage). */
  uniques: { id: string; holder: string | null }[];
  raid: RaidView | null;
  reputation: number;
  gameOver: { text: string; won: boolean } | null;
  /** An epic boss in a fight right now (in town first, else on an expedition): its health bar. */
  bossBar: { name: string; hp: number; maxHp: number; enraged: boolean; where: string } | null;
  /** The dead outnumber the living: ghosts walk at night. */
  undeadHaven: boolean;
  /** Graves of townsfolk who fell in town. */
  graves: { x: number; name: string }[];
  /** Someone just brought back from death: who, and ticks since (for the glow). */
  revived: { id: number; since: number } | null;
  /** Spells cast on townsfolk lately: who, what, and ticks since. */
  fx: { id: number; kind: PersonFx; since: number }[];
  /** The Launch Site's centre, while the ship is about to leave (its last hour) or has left. */
  launchSite: number | null;
  /** Meteors that just struck: where, and ticks since. */
  impacts: { x: number; since: number }[];
  /** Spells cast lately (the town's powers and rival lords'): drawn by renderer/town/spellsView.ts. */
  spells: SpellView[];
  /** The middle of the camp (a nomad tribe's moves with it). */
  campX: number;
  /** A nomad tribe's seasonal round (sim/nomads.ts): where it's camped, when it moves next, whether it has settled,
   *  and its last move (x from and to, and ticks since), for the caravan on the road. */
  nomad: { site: 'home' | 'pasture'; settled: boolean; nextMoveDays: number | null; move: { from: number; to: number; since: number } | null; traces: { x: number; w: number }[] } | null;
  /** A castle town's keep (sim/castle.ts): its tiles and how many floors it stands. */
  castle: { lo: number; hi: number; floors: number; flare: number } | null;
  /** The tower-defence battle on the trail, while it's on (sim/battle.ts). */
  battle: BattleView | null;
  /** A town walled at both ends: the tiles its walls span, and what they're built of (drawn as a far wall round it). */
  enclosure: { lo: number; hi: number; wall: string } | null;
  /** A full-moon night: werewolves show what they are. */
  moonNight: boolean;
  /** Tonight's moon, 0..FULL_MOON_PHASE through its cycle (full at FULL_MOON_PHASE), for the sky. */
  moonPhase: number;
  /** The weather (just for looks). */
  weather: WeatherNow;
  /** The self-running town: where it's putting its effort, and what it last decided (and why). */
  direction: Direction;
  plan: TownPlan | null;
  /** The tick of the last big boss moment (a roar, a sweeping attack): the strip shakes. */
  bossShake: number;
  /** Curses the town can pass on (hidden: a lich founder, a vampire or werewolf in town). */
  turnable: MonsterKind[];
  /** Game hours until lift-off, once the ship is built. */
  launchHours: number | null;
  /** Time away being simulated: how far along (0..1). Set by the main process while it catches up. */
  catchingUp?: number;
  biome: Biome;
  ironman: boolean;
  mainId: number;
  unlockAll: boolean;
  research: ResearchView;
  notices: Notice[];
  /** Spare items (not worn), and the craft queue. */
  items: Record<string, number>;
  crafting: CraftOrderView[];
  craftSlots: number;
  buildSlots: number;
  era: Era;
  /** Horses at home and away, and stable room. */
  horses: { id: number; name: string; hp: number; coat: number; away: boolean }[];
  stalls: number;
  /** A trade caravan at the market (and its deals), or when the next is due. */
  caravan: { x: number; hoursLeft: number; offers: { id: number; gives: Stock; horse: boolean; wants: Stock; done: boolean; ok: boolean; reason?: string }[] } | null;
  marketBuilt: boolean;
  nextCaravanHours: number | null;
  prisoners: { id: number; name: string; was: string; conviction: number; hungry: boolean }[];
  /** A disaster coming (signs) or under way, with game hours left. */
  /** A disaster coming or striking (`cold`: a Deep Freeze with nothing left to burn). */
  doom: { name: string; phase: 'signs' | 'active'; hoursLeft: number; sick: number; kind: DoomKind; cold: boolean } | null;
  /** Id of the newest journal entry (the Journal panel refetches when it changes). */
  journalHead: number;
  /** An unread "while you were away" report. */
  away: JournalEntryView | null;
  eraReady: boolean;
}

export interface JournalEntryView {
  id: number;
  /** "Day 3 · Spring · 14:05" */
  when: string;
  day: number;
  text: string;
  key: boolean;
  lines?: string[];
  highlights?: { text: string; building?: string; person?: number }[];
}

export function journalView(s: GameState): JournalEntryView[] {
  return s.journal.map(entryView);
}

function entryView(e: JournalEntry): JournalEntryView {
  const c = calendar(e.tick);
  const season = c.season[0].toUpperCase() + c.season.slice(1);
  const when = `Day ${c.day} · ${season} · ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
  return { id: e.id, when, day: c.day, text: e.text, key: !!e.key, lines: e.lines && [...e.lines], highlights: e.highlights?.map((h) => ({ ...h })) };
}

export interface ResearchView {
  done: string[];
  /** Hidden topics discovered so far. */
  revealed: string[];
  queue: string[];
  progress: Record<string, number>;
  slots: number;
  /** Where research happens now, and its speed multiplier. */
  station: string;
  stationMult: number;
  /** Every research station (one person to each): where, how fast, and who's studying there and on what. */
  stations: { label: string; mult: number; who: string | null; topic: string | null }[];
  /** Research speed of the main character there (skill x station x bonuses), for time estimates. */
  speed: number;
}

export function snapshot(s: GameState): Snapshot {
  const stock = totalStock(s);
  const v = s.visitor;
  return {
    seed: s.seed,
    coins: Math.floor(s.coins ?? 0),
    shop: venueView(s, 'shop'),
    tavern: venueView(s, 'tavern'),
    wageBill: moneyTown(s) ? wageBill(s) : 0,
    // (a lich founder turns any town into a necropolis; otherwise the origin's own look)
    theme: themeOf(s),
    origin: { id: originOf(s).id, name: originOf(s).name, town: s.lich ? ORIGIN_DEFS.lich.town : originOf(s).town },
    powers: powersView(s),
    battle: battleView(s, aimableSpells(s)),
    powerLog: [...(s.powerLog ?? [])].reverse().map((l) => l.text),
    lichOffer: s.research.done.includes('lichcraft') && !s.lich && !s.lichChosen && !s.people.find((p) => p.id === s.mainId)?.monster,
    ledger: s.ledger?.yesterday ? { ...s.ledger.yesterday } : null,
    travellers: (s.travellers ?? []).map((t) => ({ id: t.id, name: t.name, kind: t.kind, venue: t.venue ?? 'shop', wants: t.want ? wantText(t.want) : '', temper: temperOf(t.temper).name, purse: t.purse, look: t.look, x: t.x, dir: t.dir, phase: t.phase, tier: t.tier ?? 1 })),
    tick: s.tick,
    paused: s.paused,
    calendar: calendar(s.tick),
    stock,
    storageUsed: poolSize(stock),
    storageCapacity: totalCapacity(s),
    tileRev: s.tileRev,
    tiles: s.tiles.map((t) => ({ terrain: t.terrain, pool: { ...t.pool }, designated: t.designated })),
    buildings: s.buildings.map((b) => ({ ...b, delivered: { ...b.delivered }, store: { ...b.store }, ...(b.herd ? { herd: { ...b.herd } } : {}) })),
    people: ((riders) => s.people.map((p) => ({ ...personView(s, p, stock), mounted: riders.get(p.id) ?? null })))(cavalry(s)),
    visitor: v
      ? {
          ...personView(s, v.person),
          doing: v.leavingTo !== null ? 'Leaving' : 'Waiting to be let in',
          hoursLeft: v.leavingTo !== null ? 0 : Math.max(0, (v.leavesTick - s.tick) / TICKS_PER_HOUR),
          leaving: v.leavingTo !== null,
        }
      : null,
    housing: { beds: housingCapacity(s), people: s.people.length },
    expeditions: s.expeditions.map((e) => expeditionView(s, e)),
    destinations: DESTINATIONS.map((d) => ({
      id: d.id,
      unlocked: destinationUnlocked(s, d),
      scouted: s.scouted.includes(d.id),
      hidden: destinationHidden(s, d.id),
      ...(d.type === 'delve'
        ? { candidates: s.people.filter((p) => p.away === null && !p.downed && !isChild(p) && p.hp >= maxHp(p) * 0.4).map((p) => p.id), cleared: s.delved?.[d.id] ?? 0, quietHours: quietHours(s, d.id) }
        : {}),
      tripSeconds: ((d.outSeconds * 2 + d.workSeconds) * ERA_MULTIPLIER[s.era]),
      foodPerMember: foodNeeded(s, d, 1),
      ...partyView(s, d.id),
    })),
    rallyIn: Math.max(0, Math.ceil(((s.rallyReady ?? 0) - s.tick) / TICK_HZ)),
    regions: [HOME_REGION, ...(s.regions ?? [])],
    quests: (s.quests ?? []).map((q) => ({ id: q.id, kind: q.kind, dungeon: q.dungeon, title: q.title, text: q.text, hoursLeft: Math.max(0, Math.ceil((q.until - s.tick) / TICKS_PER_HOUR)) })),
    uniques: (s.uniques ?? []).map((id) => ({ id, holder: s.people.find((p) => p.gear.weapon === id)?.name ?? null })),
    watch: ((e) => (e ? expeditionView(s, e) : null))(s.expeditions.find((e) => e.id === s.watching)),
    hero: s.hero !== undefined && s.people.some((p) => p.id === s.hero) ? s.hero : null,
    prompts: s.prompts.map((p) => ({
      id: p.id,
      title: p.title,
      text: p.text,
      options: [...p.options],
      defaultOption: p.defaultOption,
      // (none for a question that waits as long as it takes: raiders held at the gate)
      secondsLeft: p.expiresTick >= Number.MAX_SAFE_INTEGER ? null : Math.max(0, (p.expiresTick - s.tick) / TICK_HZ),
    })),
    raid: s.raid
      ? {
          name: RAID_KIND_BY_ID[s.raid.kind].name,
          phase: s.raid.phase,
          secondsToArrival: Math.max(0, (s.raid.arrivesTick - s.tick) / TICK_HZ),
          side: s.raid.side,
          alarm: alarmRaised(s),
          hexes: hexesNow(s).map((h) => `${h.name} ${h.seconds}s`),
          raiders: s.raid.raiders.map((r) => ({
            id: r.id,
            kind: r.kind,
            name: ENEMIES[r.kind].name,
            // (inside the keep, even on its ground floor: drawn in the castle, at its scale)
            floor: castleOn(s) && (heightOf(r) > 0 || inKeepX(s, r.x)) ? heightOf(r) : null,
            x: r.x,
            dir: r.dir,
            hp: r.hp,
            maxHp: r.maxHp,
            down: r.down,
            fleeing: r.fleeing,
            gone: r.gone,
            carrying: poolSize(r.carrying),
            captive: r.captive?.name ?? null,
            sinceAction: s.tick - r.lastAction,
            sinceHit: s.tick - r.lastHit,
            ally: !!r.ally,
            sinceArea: r.lastArea != null ? s.tick - r.lastArea : 999,
            sinceConjured: r.conjuredAt != null ? s.tick - r.conjuredAt : 999,
            sinceCast: r.lastCast != null ? s.tick - r.lastCast : 999,
            hitFx: r.hitFx ?? null,
          })),
        }
      : null,
    reputation: s.reputation,
    gameOver: s.gameOver ? { text: s.gameOver.text, won: !!s.gameOver.won } : null,
    biome: s.biome ?? 'forest',
    turnable: turnable(s),
    bossBar: bossBar(s),
    bossShake: s.bossShake ?? -1,
    graves: s.graves ?? [],
    undeadHaven: undeadShare(s) >= 0.5,
    revived: s.revivedAt && s.tick - s.revivedAt.tick < 60 ? { id: s.revivedAt.id, since: s.tick - s.revivedAt.tick } : null,
    fx: (s.fx ?? []).filter((f) => s.tick - f.tick < FX_TICKS).map((f) => ({ id: f.id, kind: f.kind, since: s.tick - f.tick })),
    launchSite: launchSiteView(s),
    impacts: (s.impacts ?? []).filter((m) => s.tick - m.tick < 30).map((m) => ({ x: m.x, since: s.tick - m.tick })),
    campX: campX(s),
    nomad: s.nomad
      ? {
          site: s.nomad.camp === s.nomad.home ? 'home' : 'pasture',
          settled: !!s.nomad.settled,
          nextMoveDays: daysToMove(s),
          traces: s.nomad.settled ? [] : (s.nomad.left ?? []),
          move: s.nomad.movedAt != null && s.nomad.from != null ? { from: tileCentreX(s.nomad.from), to: tileCentreX(s.nomad.camp), since: s.tick - s.nomad.movedAt } : null,
        }
      : null,
    enclosure: enclosure(s),
    castle: castleOn(s) && castleFloors(s) ? { lo: castleSpan(s)[0], hi: castleSpan(s)[1], floors: castleFloors(s), flare: keepFlare(s) } : null,
    spells: (s.spellFx ?? []).filter((f) => s.tick - f.tick < Math.min(SPELL_FX_TICKS, f.secs * TICK_HZ + 10)).map((f) => ({ n: f.n, spell: f.spell, name: spellName(f.spell), since: s.tick - f.tick, x: f.x, by: f.by ?? null, targets: f.targets, secs: f.secs })),
    moonNight: moonPhaseOf(nightDay(s.tick)) === FULL_MOON_PHASE && (calendar(s.tick).hour >= 20 || calendar(s.tick).hour < 5),
    moonPhase: moonPhaseOf(nightDay(s.tick)),
    weather: weatherAt(s.seed, s.tick, s.doom?.phase === 'active' ? s.doom.kind : null),
    direction: directionOf(s),
    plan: s.plan ?? null,
    ironman: !!s.ironman,
    launchHours: s.launchTick != null ? Math.max(0, (s.launchTick - s.tick) / TICKS_PER_HOUR) : null,
    mainId: s.mainId,
    unlockAll: s.cheats.unlockAll,
    research: researchView(s),
    notices: [...s.notices],
    items: { ...s.items },
    crafting: s.crafting.map((o) => craftView(s, o)),
    craftSlots: craftSlots(s),
    buildSlots: buildSlots(s),
    era: s.era,
    horses: [
      ...s.horses.map((h) => ({ ...h, away: false })),
      ...s.expeditions.flatMap((e) => (e.horses ?? []).map((h) => ({ ...h, away: true }))),
    ],
    stalls: stalls(s),
    caravan: s.caravan
      ? {
          x: s.caravan.x,
          hoursLeft: Math.max(0, (s.caravan.leavesTick - s.tick) / TICKS_PER_HOUR),
          offers: s.caravan.offers.map((o) => ({ ...o, gives: { ...o.gives }, wants: { ...o.wants }, ...canTrade(s, o.id) })),
        }
      : null,
    marketBuilt: s.buildings.some((b) => b.def === 'market' && b.status === 'done'),
    nextCaravanHours: s.nextCaravanTick > s.tick ? (s.nextCaravanTick - s.tick) / TICKS_PER_HOUR : null,
    doom: s.doom
      ? {
          name: DOOMS[s.doom.kind].name,
          phase: s.doom.phase,
          hoursLeft: Math.max(0, (s.doom.untilTick - s.tick) / TICKS_PER_HOUR),
          sick: s.people.filter((p) => p.sick).length,
          kind: s.doom.kind,
          cold: !!s.doom.cold,
        }
      : null,
    prisoners: s.prisoners.map((p) => ({ id: p.id, name: p.name, was: ENEMIES[p.enemy]?.name ?? p.enemy, conviction: p.conviction, hungry: p.hungry })),
    journalHead: s.journal.at(-1)?.id ?? 0,
    away: awayView(s),
    eraReady: s.eraReady,
  };
}

/** What the town sells and buys changes slowly: worked out afresh every few ticks, not on every snapshot. */
let dealsCache: { state: GameState; tick: number; forSale: Stock; wants: ShopView['wants'] } | null = null;
const DEALS_EVERY = 10;

function venueView(s: GameState, venue: 'shop' | 'tavern'): ShopView | null {
  const b = s.buildings.find((q) => venueOfDef(q.def) === venue);
  if (!b) return null;
  const inside = (s.travellers ?? []).filter((t) => (t.venue ?? 'shop') === venue);
  const needs = (w: ItemDef) => {
    const missing = w.research.filter((r) => !s.research.done.includes(r)).map((r) => TOPIC_BY_ID[r]?.name ?? r);
    return missing.length ? `needs ${missing.join(' and ')}` : !itemUnlocked(s, w) ? 'not yet' : !stationFor(s, w) ? `needs a ${BUILDING_BY_ID[w.station]?.name ?? w.station}` : null;
  };
  const def = BUILDING_BY_ID[b.def];
  const layout = shopLayout(b);
  if (!dealsCache || dealsCache.state !== s || Math.abs(s.tick - dealsCache.tick) >= DEALS_EVERY) dealsCache = { state: s, tick: s.tick, forSale: forSale(s), wants: shoppingList(s) };
  const keeper = b.operator != null ? s.people.find((p) => p.id === b.operator && p.away === null && !p.downed) : undefined;
  const open = b.status === 'done' && !!keeper;
  const next = UPGRADES[b.def] ? BUILDING_BY_ID[UPGRADES[b.def]] : undefined;
  const mine = (id: string) => !!ITEM_BY_ID[id] && furnishes(ITEM_BY_ID[id], venue);
  const making = s.crafting.find((o) => mine(o.item));
  return {
    venue,
    building: b.id,
    def: b.def,
    name: def.name,
    progress: b.status === 'blueprint' ? b.progress : null,
    ...layout,
    pieces: (b.shop?.pieces ?? []).map((p) => {
      const item = ITEM_BY_ID[p.item];
      const f = item.furnish!;
      return { item: p.item, name: item.name, kind: f.kind, x: p.x, y: p.y, w: f.w, h: f.h, appeal: f.appeal, level: p.level ?? 1, nextLevel: levelPrice(p), q: p.q ?? COMMON };
    }),
    appeal: appeal(b),
    renown: Math.floor(renownOf(b)),
    trophies: trophyRenown(s),
    attractiveness: attractiveness(s, b),
    extensions: extensionsOf(b),
    maxExtensions: MAX_EXTENSIONS,
    nextExtension: extensionPrice(s, b),
    tiers: venue === 'tavern' ? [] : customerTiers(s, b).map((c) => ({
      tier: c.tier,
      name: c.name,
      plural: c.plural,
      from: c.from,
      drawn: c.drawn,
      wares: WARES.filter((w) => w.ware!.tier === c.tier).map((w) => ({ name: w.name, price: w.ware!.price, have: s.items[w.id] ?? 0, needs: needs(w) })),
    })),
    keeperName: keeper?.name ?? null,
    keeperLook: keeper?.look ?? null,
    customers: inside
      .filter((t) => t.phase === 'shopping' && s.tick < t.until)
      .map((t) => ({ id: t.id, name: t.name, kind: t.kind, look: t.look, tier: t.tier ?? 1, wants: t.want ? wantText(t.want) : '', temper: temperOf(t.temper).name, req: t.req ?? null, bed: t.bed ?? null, asleep: !!t.bed && asleepHour(calendar(s.tick).hour) })),
    rooms: roomsOf(b),
    night: calendar(s.tick).daylight < 0.35,
    beds: bedsOf(b).length,
    lodgers: inside.filter((t) => t.bed && t.phase === 'shopping').length,
    passing: inside.filter((t) => t.phase !== 'shopping').length,
    asked: Object.entries(b.shop?.asked ?? {})
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([k, n]) => ({ what: askedText(k), times: Math.round(n) })),
    menu:
      venue === 'tavern'
        ? FARE.map((i) => ({ name: i.name, kind: i.fare!.kind, have: s.items[i.id] ?? 0, best: qualitiesOf(s, i.id)[0] ?? COMMON, price: farePrice(s, i, COMMON), needs: needs(i) }))
        : [],
    gear:
      venue === 'shop'
        ? SALE_GEAR.flatMap((i) => [...new Set(qualitiesOf(s, i.id))].map((q) => ({ name: i.name, q, n: qualitiesOf(s, i.id).filter((x) => x === q).length, price: itemPrice(i, q) })))
        : [],
    forSale: venue === 'shop' ? dealsCache.forSale : {},
    wants: venue === 'shop' ? dealsCache.wants : [],
    log: (b.shop?.log ?? []).map((l) => ({ when: entryView({ id: 0, tick: l.tick, text: '' }).when, text: l.text })),
    nextHours: ((due) => (open && due !== undefined ? Math.max(0, (due - s.tick) / TICKS_PER_HOUR) : null))(venue === 'shop' ? s.nextTravellerTick : s.nextGuestTick),
    making: making ? ITEM_BY_ID[making.item].name : null,
    waiting: Object.entries(s.items).filter(([id, n]) => n > 0 && mine(id)).map(([id, n]) => (n > 1 ? `${ITEM_BY_ID[id].name} ×${n}` : ITEM_BY_ID[id].name)),
    grows: next ? { name: next.name, research: next.research && !s.research.done.includes(next.research) ? (TOPIC_BY_ID[next.research]?.name ?? next.research) : null } : null,
  };
}

/** An unmet want, from the key it's remembered by, in words. */
function askedText(key: string): string {
  const [kind, what] = key.split(':');
  switch (kind) {
    case 'gear':
      return what === 'tool' ? 'tools' : what === 'weapon' ? 'weapons' : 'armour';
    case 'item':
    case 'dish':
      return ITEM_BY_ID[what]?.name ?? what;
    case 'ware':
      return `fine goods for ${tierOf(Number(what)).plural.toLowerCase()}`;
    case 'mat':
      return MATERIAL_NAMES[what as Material]?.toLowerCase() ?? what;
    case 'fare':
      return FARE_NAMES[what as FareKind] ?? what;
    case 'comfort':
      return 'more comfort';
    case 'bed':
      return 'a bed for the night';
    default:
      return key;
  }
}

/** The party the town would plan for a destination, for the Expedition Board. */
function partyView(s: GameState, dest: string): { party: string[]; partyHorses: number; partyTruck: boolean } {
  const plan = planParty(s, dest);
  const party = plan.members.map((id) => {
    const p = s.people.find((q) => q.id === id)!;
    return `${p.name} (${ROLES[plan.roles[id] ?? 'fighter'].name.toLowerCase()})`;
  });
  return { party, partyHorses: plan.horses, partyTruck: plan.truck };
}

function awayView(s: GameState): JournalEntryView | null {
  const e = s.unreadAway === null ? undefined : s.journal.find((q) => q.id === s.unreadAway);
  return e ? entryView(e) : null;
}

function personView(s: GameState, p: Person, _stock?: Stock): PersonView {
  const m = mood(s, p);
  const bed = p.bed === null ? undefined : s.buildings.find((b) => b.id === p.bed);
  return {
    id: p.id,
    name: p.name,
    typeName: RECRUIT_TYPES[p.type]?.name ?? p.type,
    look: p.look,
    x: p.x,
    dir: p.dir,
    activity: p.activity,
    mounted: null,
    cls: p.cls ?? null,
    clsName: p.cls ? className(p.cls, stageOf(p)) : null,
    level: levelOf(p),
    levelProgress: levelProgress(p),
    doing: describe(s, p),
    carrying: { ...p.carrying },
    skills: Object.fromEntries(
      SKILLS.map((k) => [k, { level: p.skills[k].level, progress: p.skills[k].xp / xpToNext(p.skills[k].level), passion: p.passions.includes(k) }]),
    ) as Record<Skill, SkillView>,
    traits: p.traits.map((t) => ({ name: TRAIT_BY_ID[t]?.name ?? t, description: TRAIT_BY_ID[t]?.description ?? '' })),
    needs: { ...p.needs },
    morale: p.morale,
    moodTarget: m.target,
    moodReasons: m.reasons,
    priorities: { ...p.priorities },
    autoPriorities: p.autoPriorities,
    bed: bed ? defOf(bed).name : null,
    floor: castleOn(s) && (heightOf(p) > 0 || roomOf(s, p)) ? heightOf(p) : null,
    // (asleep in a castle's room, they're seen there, in their coffin)
    rally: rallyState(s, p),
    indoors: !(castleOn(s) && roomOf(s, p)) && p.activity === 'sleep' && ((p.task?.type === 'sleep' && p.task.building !== null) || (p.task?.type === 'shelter' && p.bed !== null)),
    away: p.away === null ? null : (DESTINATION_BY_ID[s.expeditions.find((e) => e.id === p.away)?.dest ?? '']?.name ?? 'expedition'),
    hp: p.hp,
    maxHp: maxHp(p),
    downed: !p.downed ? null : p.downed.bleedUntil === null ? 'recovering' : 'bleeding',
    bleedMinutes: p.downed?.bleedUntil != null ? Math.max(0, Math.ceil(((p.downed.bleedUntil - s.tick) / TICKS_PER_HOUR) * 60)) : null,
    gear: { ...p.gear },
    gearQ: { ...(p.gearQ ?? {}) },
    coins: p.coins ?? (moneyTown(s) ? 0 : null),
    detail: personDetail(s, p),
    recent: [...(p.recent ?? [])].reverse().map((r) => r.text),
    bedroll: hasBedroll(s, p),
    carryCapacity: carryCapacity(s, p),
    partner: p.partner == null ? null : (s.people.find((q) => q.id === p.partner)?.name ?? null),
    married: !!p.married,
    friends: friendsOf(s, p).filter((f) => f.id !== p.partner).map((f) => f.name),
    rivals: rivalsOf(s, p).map((f) => f.name),
    growsUpIn: p.bornTick != null ? Math.max(0, CHILD_HOURS - (s.tick - p.bornTick) / TICKS_PER_HOUR) : null,
    breakdown: p.breakdown ? BREAK_TEXT[p.breakdown.kind] : null,
    monster: p.monster ?? null,
    order: p.monster ? (p.order ?? 'hide') : null,
    sick: !!p.sick,
  };
}

/** A line or two more about someone: the building they run, how their work is getting on, and (for a crafter) what
 *  their pieces usually come out like. */
function personDetail(s: GameState, p: Person): string[] {
  const out: string[] = [];
  for (const b of s.buildings) {
    if (b.operator !== p.id || b.status !== 'done') continue;
    const role = OPERATORS[b.def];
    if (!role) continue;
    const def = BUILDING_BY_ID[b.def];
    const inside = def.floor ? (s.travellers ?? []).filter((t) => t.phase === 'shopping' && (t.venue ?? 'shop') === def.floor!.venue).length : 0;
    out.push(`${role.title} of the ${def.name}` + (def.floor ? (inside ? ` (${inside} ${def.floor.venue === 'tavern' ? 'guest' : 'customer'}${inside > 1 ? 's' : ''} in)` : ' (nobody in)') : ''));
  }
  const task = p.task;
  if (task?.type === 'build') {
    const b = s.buildings.find((q) => q.id === task.building);
    if (b) out.push(`The ${defOf(b).name} is ${Math.floor(b.progress * 100)}% built`);
  } else if (task?.type === 'research') {
    const t = TOPIC_BY_ID[s.research.queue[0]];
    if (t) out.push(`${t.name}: ${Math.floor(((s.research.progress[t.id] ?? 0) as number) * 100)}% learned`);
  } else if (task?.type === 'craft' || (p.priorities.craft && p.priorities.craft <= 2)) {
    out.push(`Crafting ${p.skills.crafting.level}: their pieces usually come out ${qualityOf(Math.round(typicalQuality(p.skills.crafting.level))).name}`);
  } else if (task?.type === 'gather' && !task.scrounge && s.plan?.gathering.length) {
    out.push(`The town is gathering for ${s.plan.gathering.join(', ').toLowerCase()}`);
  }
  return out;
}

const BREAK_TEXT = { sulk: 'Sulking in a corner', binge: 'Stress-eating everything in sight', brawl: 'Picking a fight', wander: 'Wandering off to be alone' } as const;

function craftView(s: GameState, o: CraftOrder): CraftOrderView {
  const def = ITEM_BY_ID[o.item];
  const crafter = s.people.find((p) => p.task?.type === 'craft' && p.task.order === o.id);
  const needed = craftNeeded(o);
  let waiting: string | null = null;
  if (!crafter) {
    const missing = missingItems(s, o);
    const stock = totalStock(s);
    const short = (Object.entries(needed) as [Material, number][]).filter(([m, n]) => (stock[m] ?? 0) < n).map(([m]) => MATERIAL_NAMES[m].toLowerCase());
    if (!stationFor(s, def)) waiting = `Needs a ${stationName(def)}`;
    else if (missing.length) waiting = `Needs ${missing.join(', ')}`;
    else if (short.length) waiting = `Short of ${short.join(', ')}`;
    else if (!s.people.some((p) => p.priorities.craft !== 0 && p.away === null)) waiting = 'Nobody has the Craft job';
    else waiting = 'Waiting for a crafter';
  }
  return { id: o.id, item: o.item, count: o.count, progress: o.progress, needed, waiting, crafter: crafter?.name ?? null };
}

function expeditionView(s: GameState, e: Expedition): ExpeditionView {
  const d = DESTINATION_BY_ID[e.dest];
  const len = e.phase === 'out' ? e.outTicks : e.phase === 'work' ? e.workTicks : e.backTicks;
  let left = e.phase === 'out' ? e.outTicks - e.elapsed + e.workTicks + e.outTicks : e.phase === 'work' ? e.workTicks - e.elapsed + e.outTicks : e.backTicks - e.elapsed;
  // (a delve's time inside goes by the rooms: how far down they are, out of how many)
  const v = e.delve;
  const roomTicks = ROOM_SECONDS * TICK_HZ * ERA_MULTIPLIER[s.era];
  const down = v ? (Math.max(0, v.at) + Math.min(1, v.ticks / roomTicks)) / v.rooms.length : 0;
  if (v && e.phase === 'work') left = (v.rooms.length - Math.max(0, v.at)) * roomTicks + e.outTicks;
  return {
    id: e.id,
    dest: e.dest,
    destName: d.name,
    scenery: d.scenery,
    phase: e.phase,
    phaseProgress: v && e.phase === 'work' ? Math.min(1, down) : Math.min(1, e.elapsed / Math.max(1, len)),
    secondsLeft: Math.max(0, left) / TICK_HZ,
    members: e.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p).map((p) => ({ id: p.id, name: p.name, look: p.look, gear: { ...p.gear } })),
    horses: (e.horses ?? []).map((h) => h.coat),
    truck: !!e.truck,
    loot: { ...e.loot },
    lootSize: poolSize(e.loot),
    carry: partyCarry(s, e),
    supplies: { ...e.supplies },
    recalled: e.recalled,
    side: s.destSides[e.dest] ?? 1,
    stance: e.stance,
    stakes: e.stakes ?? null,
    roles: { ...e.roles },
    battle: e.battle
      ? e.battle.fighters.map((f) => ({
          side: f.side,
          ref: f.ref,
          kind: f.kind,
          name: f.name,
          hp: f.hp,
          maxHp: f.maxHp,
          row: f.row,
          down: f.down,
          role: f.role,
          look: f.side === 'party' ? (s.people.find((p) => p.id === f.ref)?.look ?? null) : null,
          gear: f.side === 'party' ? { ...(s.people.find((p) => p.id === f.ref)?.gear ?? {}) } : {},
          ranged: f.ranged,
          sinceAction: e.battle!.tick - f.lastAction,
          sinceHit: e.battle!.tick - f.lastHit,
          sinceArea: f.lastArea != null ? e.battle!.tick - f.lastArea : 999,
          hitFx: f.hitFx ?? null,
          atb: f.down ? 0 : Math.max(0, Math.min(1, 1 - f.cooldown / Math.max(1, f.interval))),
          statuses: Object.entries(f.st ?? {}).filter(([, v]) => v!.until > e.battle!.tick).map(([k]) => k),
          clsName: f.side === 'party' ? ((q) => (q?.cls ? className(q.cls, stageOf(q)) : null))(s.people.find((p) => p.id === f.ref)) : null,
          level: f.side === 'party' ? (s.people.find((p) => p.id === f.ref)?.level ?? 1) : null,
          pop: f.pop ? { age: e.battle!.tick - f.pop.tick, amount: f.pop.amount, heal: f.pop.heal } : null,
          conjured: !!f.conjured,
          elite: f.elite ?? null,
        }))
      : null,
    acts: (e.battle?.acts ?? []).map((a) => ({ age: e.battle!.tick - a.tick, side: a.side, ref: a.ref, name: a.name, targets: a.targets })),
    waiting: e.prompt !== null,
    delve: v ? { room: v.at + 1, rooms: v.rooms.length, kind: v.at >= 0 ? v.rooms[v.at] : null, torches: v.torches, log: [...v.log], cleared: !!v.cleared, progress: Math.min(1, v.ticks / delveRoomTicks(s, v)), twist: v.twist && v.twist !== 'none' ? TWISTS[v.twist].name : null, twistText: v.twist ? TWISTS[v.twist].text : '', boss: bossName(v) } : null,
  };
}

function researchView(s: GameState): ResearchView {
  const r = s.research;
  const mods = modifiers(r);
  const station = researchStation(s);
  const main = s.people.find((p) => p.id === s.mainId);
  return {
    done: [...r.done],
    revealed: [...(r.revealed ?? [])],
    queue: [...r.queue],
    progress: { ...r.progress },
    slots: mods.researchSlots,
    station: station.label,
    stationMult: station.mult,
    stations: researchStations(s).map((st) => {
      const who = s.people.find((q) => q.away === null && q.task?.type === 'research' && q.task.station === st.buildingId);
      const topic = who?.task?.type === 'research' && who.task.topic ? (TOPIC_BY_ID[who.task.topic]?.name ?? null) : null;
      return { label: st.label, mult: st.mult, who: who?.name ?? null, topic };
    }),
    speed: ((main ? skillSpeed(main.skills.research.level) : 1) * station.mult * mods.researchSpeed) / RESEARCH_MULTIPLIER[s.era],
  };
}

function describe(s: GameState, p: Person): string {
  const name = (id: number) => {
    const b = s.buildings.find((q) => q.id === id);
    return b ? defOf(b).name : 'building';
  };
  const task = p.task;
  if (p.breakdown) return BREAK_TEXT[p.breakdown.kind];
  if (p.blocked && (!task || task.type === 'wander' || task.type === 'idle')) return 'Storage is full — click a storage building to throw something out, or build a stockpile';
  if (!task) return 'Idle';
  switch (task.type) {
    case 'wander':
    case 'idle':
      return p.morale < SULK_MORALE ? 'Sulking (morale too low to work)' : 'Idling at camp';
    case 'gather': {
      if (task.scrounge) return 'Hungry: picking wild berries (nothing in storage)';
      const t = s.tiles[task.tile].terrain;
      return t === 'clear' ? 'Idle' : `${TERRAIN[t].verb} (${TERRAIN[t].name.toLowerCase()})`;
    }
    case 'store':
      return `Hauling to the ${name(task.building).toLowerCase()}`;
    case 'fetch':
      return `Fetching materials for the ${name(task.building)}`;
    case 'deliver':
      return `Carrying materials to the ${name(task.building)}`;
    case 'build':
      return `Building the ${name(task.building)}`;
    case 'research': {
      const t = TOPIC_BY_ID[task.topic ?? s.research.queue[0]];
      const at = task.station != null ? s.buildings.find((b) => b.id === task.station) : undefined;
      const where = at ? ` at ${RESEARCH_STATIONS[at.def]?.label ?? defOf(at).name}` : '';
      return t ? `Researching ${t.name}${where}` : 'Researching';
    }
    case 'eat':
      return 'Eating';
    case 'sleep':
      if (p.downed) return task.building === null ? 'Badly hurt, resting on the ground' : `Badly hurt, resting in the ${name(task.building).toLowerCase()}`;
      return task.building === null ? 'Sleeping on the ground' : `Sleeping in the ${name(task.building).toLowerCase()}`;
    case 'defend':
      return p.activity === 'fight' ? 'Fighting off the raiders!' : 'Defending the town';
    case 'patrol':
      return 'On patrol';
    case 'shelter':
      return p.bed !== null ? 'Sheltering from the raid' : 'Huddled by the fire (no bed to hide in)';
    case 'repair':
      return `Repairing the ${name(task.building).toLowerCase()}`;
    case 'mine':
      return 'Digging in the mine';
    case 'extinguish':
      return `Fighting the fire at the ${name(task.building).toLowerCase()}!`;
    case 'tend': {
      const q = s.people.find((x) => x.id === task.patient);
      return `Tending ${q?.name ?? 'the wounded'}'s wounds!`;
    }
    case 'farm': {
      const b = s.buildings.find((q) => q.id === task.building);
      const herd = b && HERDS[b.def];
      if (herd) return `Tending the ${herd.plural}`;
      const crop = b && CROPS[b.def];
      if (crop?.establishHours) return b?.crop?.stage === 'ripe' ? 'Picking fruit in the orchard' : 'Planting fruit trees';
      const what = crop ? (crop.material === 'grain' ? 'grain' : crop.material === 'fiber' ? 'flax' : MATERIAL_NAMES[crop.material].toLowerCase()) : 'grain';
      return b?.crop?.stage === 'ripe' ? `Harvesting ${what}` : `Sowing ${what}`;
    }
    case 'craft': {
      const o = s.crafting.find((q) => q.id === task.order);
      const item = o ? ITEM_BY_ID[o.item].name : 'something';
      // (a commission says who it's for, who asked, and for how much)
      const f = o?.for;
      const keeper = f ? s.people.find((q) => q.id === f.by) : undefined;
      const place = f ? s.buildings.find((b) => BUILDING_BY_ID[b.def]?.floor?.venue === f.venue) : undefined;
      const forWhom = f ? ` for the ${place ? BUILDING_BY_ID[place.def].name : f.venue}${keeper && keeper !== p ? `, ordered by ${keeper.name}` : ''}, ${f.pay} coins` : '';
      return task.phase === 'work' ? `Crafting: ${item} (${Math.floor((o?.progress ?? 0) * 100)}%)${forWhom}` : `Fetching materials to craft: ${item}${forWhom}`;
    }
  }
}

/** The boss to show a health bar for: one raiding the town, else one fighting an expedition. */
/** The Launch Site's centre in the last hour before lift-off, and once the ship has gone (for the effect). */
function launchSiteView(s: GameState): number | null {
  const soon = s.launchTick != null && s.launchTick - s.tick <= TICKS_PER_HOUR;
  if (!soon && !s.gameOver?.won) return null;
  const site = s.buildings.find((b) => b.def === 'launch_site' && b.status === 'done');
  return site ? buildingCentreX(site) : null;
}

function bossBar(s: GameState): Snapshot['bossBar'] {
  const r = s.raid;
  const raider = r?.phase === 'active' ? r.raiders.find((q) => ENEMIES[q.kind]?.kit && !q.ally && !q.down && !q.gone) : undefined;
  if (raider) return { name: ENEMIES[raider.kind].name, hp: raider.hp, maxHp: raider.maxHp, enraged: !!raider.enraged, where: 'in town' };
  for (const e of s.expeditions) {
    const f = e.battle?.fighters.find((q) => q.side === 'enemy' && ENEMIES[q.kind]?.kit && !q.down);
    if (f) return { name: f.name, hp: f.hp, maxHp: f.maxHp, enraged: !!f.enraged, where: atPlace(DESTINATION_BY_ID[e.dest]?.name ?? 'expedition') };
  }
  return null;
}