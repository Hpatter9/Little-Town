// What the renderers see of the sim: a read-only copy sent over IPC each tick.

import { DUNGEON_BY_ID } from '../data/dungeons';
import { FEED_SECONDS } from '../data/lighting';
import { lightsView } from './lighting';
import { CONQUEST } from '../data/conquest';
import { skirmishTrip } from './roamers';
import { marketOn, marketSquare } from './pastimes';
import { ROAMER_NAME } from '../data/roamers';
import { paveSeconds } from './streets';
import { branchesOf, PATH_BY_ID } from '../data/paths';
import { CLASS_DEFS, STAGE_LEVELS } from '../data/classes';
import { loreOf } from '../data/pathLore';
import { ROLE_ABOUT } from '../data/classAbout';
import { PATH_ABILITIES } from '../data/abilities';
import { freePoints } from './attributes';
import { tacticsView, type TacticsView } from './tactics';
import { faithView, type FaithView } from './faith';
import { disasterView, type DisasterView } from './disasters';
import { worldView, type WorldView } from './worldLife';
import { marketView, type MarketView } from './markets';
import { heritageView, type HeritageView } from './heritage';
import { cellsOf } from './prisoners';
import { patientsIn, sickbedsIn } from './sickbeds';
import type { Chronicle, Fallen } from './annals';
import { honouredView, type HonouredView } from './memorials';
import { ruinsView, type RuinView } from './ruins';
import { RECAP_HOURS, type RaidRecap } from './raidRecap';
import { gatheringRadius, processing, processionHead } from './ceremonies';
import { walkingHome } from './nightOut';
import { realmView, type RealmView } from './factions';
import { warView, type WarView } from './conquest/warView';
import { armyOfPerson } from './conquest/armies';
import { worldOf } from './conquest/conquest';
import { DESTINATION_BY_ID as DEST_BY_ID } from '../data/expeditions';
import { musterView, type MusterView } from './muster';
import { secretView, specialStory } from './specials';
import { BOAT_BY_KIND, type BoatKind } from '../data/boats';
import { boatLine, boatyardOf, fleet, mooring } from './boats';
import { peopleOf } from './strangers';
import { FOUNDER_BY_ID } from '../data/founders';
import { backstory } from '../data/backstories';
import { AMBITIONS } from '../data/ambitions';
import { TICKS_PER_DAY } from './time';
import { ambitionOf, businessPrice } from './ambition';
import type { Attrs } from '../data/attributes';
import { roadFavours } from '../data/pathAttrs';
import { RESEARCH_PACE } from '../data/pace';
import { swims } from './sea';
import { natureOf, type NatureId } from '../data/natures';
import { ageDays, ageLine, ageYears, isElder, lifeStage, type LifeStage } from './ageing';
import { ROOM_SECONDS, TWISTS } from '../data/dungeons';
import { bossName, delveRoomTicks, quietHours } from './delves';
import { HOME_REGION } from '../data/regions';
import type { Biome } from '../data/biomes';
import type { ClassId } from '../data/classes';
import { beastForm, levelOf, stageOf, type BeastForm } from '../data/levels';
import { callingName, callingText } from '../data/founderClasses';
import { personFighter, weaponRange } from './combat';
import { kitOf } from './actions';
import { levelProgress } from './classes';
import { turnable, undeadShare } from './turning';
import { FULL_MOON_PHASE, moonPhaseOf, nightDay } from './monsters';
import { weatherAt, type WeatherNow } from './weather';
import { directionOf, forSale, shoppingList, type Direction, type TownPlan } from './planner';
import { decorPrice, appeal, asleepHour, attractiveness, bedsOf, roomsOf, customerTiers, extensionPrice, extensionsOf, farePrice, itemPrice, levelPrice, renownOf, SALE_GEAR, shopLayout, wantText, type Rect, trophyRenown } from './shop';
import { moneyTown, wageBill } from './wages';
import { incomeOf } from './economy';
import { propertyOf } from './property';
import { guardsOf, guardsWanted, guardWage, taxRate } from './treasury';
import type { TaxRate } from '../data/economy';
import { COMMON, qualityOf, typicalQuality } from '../data/quality';
import { OPERATORS } from '../data/operators';
import { HERDS } from '../data/livestock';
import { ORIGIN_DEFS, originOf, type OriginId } from '../data/origins';
import { aimableSpells, POWERS, powersView } from './powers';
import { battleView, ranged, type BattleView } from './battle';

/** Today's and yesterday's pay in whole coins. */
const wholeIncome = (i: { today: number; yesterday: number }, last: string | null) => ({ today: Math.floor(i.today), yesterday: Math.floor(i.yesterday), last });

/** How the game looks: the classic town, or an origin's own (a lich founder makes any town a necropolis). */
export type ThemeId = 'town' | Exclude<OriginId, 'settlers'>;
const themeOf = (s: GameState): ThemeId => (s.lich ? 'lich' : !s.origin || s.origin === 'settlers' ? 'town' : s.origin);
import { itemUnlocked, qualitiesOf } from './crafting';
import { FARE, furnishes, LINE_ITEMS, lineOfDef, MAX_EXTENSIONS, temperOf, tierOf, venueOfDef, WARES } from '../data/shop';
import { LINES, SHOP_LINES, type ShopLine } from '../data/stores';
import { DECOR_LEVELS, DECOR_MAX, DECOR_STYLES, type DecorId } from '../data/decor';
import { FARE_NAMES, type FareKind, type FurnishKind, type ItemDef } from '../data/items';
import { BUILDING_BY_ID, UPGRADES } from '../data/buildings';
import { LEISURE } from '../data/recreation';
import type { BandKind } from '../data/bands';
import type { MonsterKind } from '../data/monsters';
import { ENEMIES } from '../data/enemies';
import { atPlace, DESTINATIONS, MAX_EXPEDITIONS, ROLES, the } from '../data/expeditions';
import { RAID_KIND_BY_ID } from '../data/raids';
import { alarmRaised, cavalry, onShift } from './people';
import type { Era } from '../data/eras';
import { ITEM_BY_ID, ITEMS, type Slot } from '../data/items';
import { MATERIAL_NAMES, type Material, type Stock } from '../data/materials';
import { CROPS } from '../data/crops';
import { craftNeeded, craftSlots, hasBedroll, missingItems, stationFor, stationName } from './crafting';
import { CHILD_HOURS } from '../data/social';
import { DOOMS, type DoomKind } from '../data/doom';
import { devotedOf, enemiesOf, friendsOf, isChild, opinion, rivalsOf } from './social';
import { capacities, woundText } from './injuries';
import { PARTS, PROSTHETIC_BY_ITEM, fitsOf, type BodyPart } from '../data/injuries';
import { bountyOn, bountyStep, mayGo, proposeParty, roomAway, vetoed } from './parties';
import { ENEMY } from '../data/social';
import { canTrade, stalls } from './trade';
import { RECRUIT_TYPES, TRAIT_BY_ID, type Job, type Look, type Priority } from '../data/people';
import { RESEARCH_STATIONS, TOPIC_BY_ID } from '../data/research';
import { SKILLS, skillSpeed, xpToNext, type Skill } from '../data/skills';
import { TERRAIN } from '../data/terrain';
import { buildingCentre, buildingCentreX, buildSlots, defOf, enclosure, footprint, totalCapacity, totalStock } from './buildings';
import { destinationHidden, destinationOf, destinationUnlocked, foodNeeded, partyCarry, planParty } from './expeditions';
import { modifiers, researchStation, researchStations } from './research';
import { tireless, carryCapacity, ERA_MULTIPLIER, FX_TICKS, maxHp, RESEARCH_MULTIPLIER, poolSize, type PersonFx, type RaiderHitFx, type SpellTarget, SPELL_FX_TICKS, type Activity, type Building, type CraftOrder, type Expedition, type ExpeditionPhase, type GameState, type JournalEntry, type Ledger, type Needs, type Notice, type Person, type TileState, campCell, campX, campXY, BLOOD_LASTS, DEBRIS_LASTS, type DebrisKind, type ShopTalk } from './state';
import { cellAt, groundAt, inMap, type LandMap, wet, CELL } from './land';
import { calendar, TICK_HZ, TICKS_PER_HOUR, type Calendar } from './time';
import { ABILITIES, abilitiesKnown } from '../data/abilities';
import { SPELLS } from '../data/spells';
import { describeAct, describePassive } from '../data/describe';
import { hexesNow } from './rivals';
import { castleBounds, castleCells, castleGate, castleLayout, castleOn, coreRect, galleryCells, holdOf, type Hold } from './castle';
import { TILE } from '../constants';

import { rallyState } from './rally';
import { daysToMove } from './nomads';
import { describeFoes, MINE_DEPTH, mineLeft, minersAt, placeById, placeDestination, placeDestinations, placeXY } from './places';
import { packDestinations, packView, type PackView } from './pack';
import { sagaDestinations, sagasView, type SagaView, type SagaDoneView } from './sagas';
import { huntDestinations, huntsView, type HuntView, type ForgeView } from './hunts';
import { dragonDestinations, dragonView, type DragonView } from './dragon';
import { villageBuildings, villageDestinations, villageViews, type VillageView } from './villages';
import { interiorView, type InteriorView } from './interiors';
import { familiesView, type FamilyLine } from './lineage';
import { portalDestinations, portalSummaries, portalView, type PortalSummary, type PortalView } from './portals';
import { politicsView, type PoliticsView } from './politics';
import { calamityView, heartDestinations, type CalamityView } from './calamity';
import { sceneView } from './cutscenes';
export type SceneView = NonNullable<ReturnType<typeof sceneView>>;
import { nestPlaceName } from './nests';
import { blightSources } from './blight';
import { NEST_DEFS, type NestKind } from '../data/nests';
import { directionName, isPlaceDest, PLACE_DEFS, type PlaceKind } from '../data/places';
import type { Destination } from '../data/expeditions';
import { RIVALS } from '../data/rivals';
import { DEEP_H, DEEP_LEVELS, DEEP_W, OPEN_AFTER, RISE_AT, SHAFT } from '../data/deep';
import { deepFarms, shaftOf } from './deep';

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
  y: number;
  dir: 1 | -1;
  activity: Activity;
  /** How far along the work in hand is (0 to 1), while they're at it: the bar over their head. */
  taskDone: number | null;
  /** The work in hand and where (a station's or building's def), for the sounds of it (renderer/sfx.ts): a crafter at
   *  the loom isn't a builder's hammer. Left out while walking or idle. */
  work?: { kind: string; at: string | null };
  /** Ticks since a blow last landed on them, and the side it came from (for the blood). */
  sinceHit: number;
  hitFrom: 1 | -1;
  /** Ticks since they last struck at a foe, and since they last turned a blow (the fighting poses). */
  sinceBlow: number;
  /** Under arms in a raid (the defend task): a fighting calling keeps its combat form the whole fight. */
  defending: boolean;
  /** A shapeshifter's fighting shape (data/levels.ts `beastForm`: wolf to wyvern by stage; a druid's bear), or null. */
  beast: BeastForm | null;
  sinceBlock: number;
  /** Their class (none yet: a child, or not given one yet), its name at their stage, their level and the way to the next. */
  cls: ClassId | null;
  clsName: string | null;
  /** The stages they've come through (names, oldest first), what their calling is about, and whether it's a founder's
   *  own (data/founderClasses.ts). What's to come isn't sent: it stays a mystery. */
  clsPast: string[];
  clsText: string;
  founderCalling: boolean;
  /** Their road (data/paths.ts): where they stand, the roads open at the next stage (names and what each is), the
   *  level that opens them, and the evolution question waiting on them, if one is. Founders have none. */
  roadId: string | null;
  road: { name: string; text: string; next: { id: string; name: string; text: string; lore: string }[]; at: number | null; promptId: number | null } | null;
  /** Stat points earned and not yet spent (data/attributes.ts). */
  freePts: number;
  /** They spend their own points as they come. */
  autoStats: boolean;
  /** The two attributes their road favours (what "Let them choose" would put points into). */
  favours: (keyof Attrs)[];
  /** Which of their class's five stages they're at (0 to 4), and whether they've ascended (the last needs it). */
  stage: number;
  ascended: boolean;
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
  /** Mourning someone (a skull over their head now and then on the map). */
  grieving: boolean;
  priorities: Record<Job, Priority>;
  autoPriorities: boolean;
  /** Name of the building they sleep in, or null (sleeps on the ground). */
  bed: string | null;
  /** The building they sleep in (its tap card lists who lives there). */
  bedId: number | null;
  /** Asleep inside a building (the renderer hides them). */
  indoors: boolean;
  /** Carrying a bucket of water home from the well (sim/pastimes.ts). */
  bucket: boolean;
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
  /** Their income (sim/economy.ts): today, yesterday, and what their last hourly pay was for. */
  income: { today: number; yesterday: number; last: string | null } | null;
  /** What they own (sim/property.ts), and rent owed. */
  owns: string[];
  debt: number;
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
  /** Their body (sim/injuries.ts): wounds in words, lasting scars and lost parts, prosthetics fitted, and what they can
   *  still do (1 sound). */
  body: { wounds: string[]; lasting: string[]; fitted: string[]; sight: number; handling: number; moving: number; pain: number; marks: BodyMark[] };
  /** Enemies (they won't go on a trip together, and may come to blows) and the devoted (who go where they go). */
  enemies: string[];
  devoted: string[];
  /** Children: game hours until they grow up. */
  growsUpIn: number | null;
  /** A mental break in progress, described. */
  breakdown: string | null;
  /** Age (sim/ageing.ts): days grown, years old by their people's reckoning (data/lifespans.ts), the stage of
   *  life, a line about it, and an elder (slower, and old age may take them). */
  /** In the sea (a merfolk swimming: drawn with a tail). */
  swimming: boolean;
  /** Of the merfolk (their people, a stranger's or the town's): fins and scales on land (map/bodyMarks.ts). */
  mer: boolean;
  /** Their nature (data/natures.ts): id, name and a line about it. */
  nature: NatureId;
  natureName: string;
  /** Their town job, if they hold one ("Smith", "Shopkeeper"), and where. */
  job: { title: string; at: string } | null;
  natureLine: string;
  /** Their own short story (data/backstories.ts; a ready-made founder's is the one written for them). */
  story: string;
  /** Titles won in the sagas (sim/sagas.ts), the latest last. */
  titles: string[];
  /** A special newcomer's secret, once the town knows it (sim/specials.ts). */
  secret: { name: string; text: string } | null;
  /** Their life's goal (data/ambitions.ts), and trips made. */
  ambition: { name: string; line: string } | null;
  trips: number;
  ageDays: number;
  ageYears: number;
  lifeStage: LifeStage;
  ageText: string;
  elder: boolean;
  /** The town being itself (map/townLife.ts): on the way home from the tavern a little the worse for drink
   *  (sim/nightOut.ts), on the way to bed (a yawn), a hired guard, and on watch now. */
  tipsy?: boolean;
  bedward?: boolean;
  guard?: boolean;
  onWatch?: boolean;
  /** Monsters: what they are and their standing order for the Hunter's Guild. */
  monster: string | null;
  /** Neither eats nor sleeps (the dead, the lich, machines). */
  tireless: boolean;
  order: string | null;
  sick: boolean;
  /** The healer going the rounds of the sick households in a plague (sim/pastimes.ts): drawn masked, the plague doctor. */
  rounds: boolean;
  /** How they'd fight now (as a fighter in the front rank), for the inspect page: a blow's damage, shares of hit
   *  chance, dodge, armour and block, and the chance to strike true. */
  battle: { damage: [number, number]; accuracy: number; dodge: number; armor: number; block: number; crit: number; ranged: boolean; attrs: Attrs; mp: number; sp: number; interval: number; range: number };
  /** The spells they keep ready and the skills they've learned (actives first), with what each costs. */
  kit: { name: string; spell: boolean; level: number; cost: number; pool: 'mp' | 'sp' | 'limit'; text: string }[];
  /** The passive skills they've learned (always on), with what each gives. */
  passives: { name: string; level: number; text: string }[];
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
  /** Pieces finished so far, and the station building it's made at (null with none): the map lifts a finished piece's
   *  picture from there (map/mapGains.ts). */
  made: number;
  station: number | null;
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
  /** Mana, stamina and the limit gauge (people only; data/attributes.ts). */
  mp: number | null;
  maxMp: number | null;
  sp: number | null;
  maxSp: number | null;
  limit: number | null;
  statuses: string[];
  clsName: string | null;
  cls: ClassId | null;
  level: number | null;
  pop: { age: number; amount: number; heal: boolean } | null;
  conjured: boolean;
  /** A delve's elite: its affix (drawn with a tint). */
  elite: string | null;
  /** A party member who is a werewolf (drawn in wolf form as they fight), or one of the raised dead (a skeleton). */
  wolf: boolean;
  /** A shapeshifter's fighting shape. */
  beast?: BeastForm | null;
  undead: boolean;
}

export interface RaiderView {
  id: number;
  /** In the water (a raid from the sea coming ashore): drawn from the waist up. */
  swimming: boolean;
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
  y: number;
  dir: 1 | -1;
  hp: number;
  maxHp: number;
  down: boolean;
  fleeing: boolean;
  gone: boolean;
  carrying: number;
  /** Name of the townsperson they're carrying off. */
  captive: string | null;
  /** Lamed by a leg wound (sim/raiderWounds.ts): its pace lost, 0 when sound; it limps. */
  lame: number;
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
  y: number | null;
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
  kind: string;
  /** A choice event's fuller telling, its picture (a backdrop id) and who it's about (the full-screen event box). */
  story: string | null;
  picture: string | null;
  who: number | null;
  /** Until the default is taken; null when it waits as long as it takes. */
  secondsLeft: number | null;
  /** An evolution's roads (data/paths.ts, data/pathLore.ts): each with its archetype's role, its telling and its
   *  signature skill, in the options' order. */
  roads?: RoadView[];
}
export interface RoadView {
  id: string;
  name: string;
  role: string;
  text: string;
  lore: string;
  skill: { name: string; text: string } | null;
}

/** How long the feed shows what came of the last event answered (game hours). */
export const OUTCOME_HOURS = 4;

/** How long a fight's victory screen stays up (ticks). */
export const RESULT_TICKS = 80;

export interface ExpeditionView {
  id: number;
  dest: string;
  destName: string;
  /** Who gathered the party (a party that formed itself), and the bounty it's after. */
  leader?: string;
  bounty?: number;
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
  /** The boat they sail in (sim/boats.ts), and whether she went down on the way. */
  boat?: { kind: BoatKind; name: string; hull: number; max: number };
  wrecked?: boolean;
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
  acts: { age: number; side: 'party' | 'enemy'; ref: number; name: string; targets: number[]; spell: boolean; ult: boolean; cost: number; pool: 'mp' | 'sp' | 'limit' | null; who: string; text: string }[];
  /** Waiting on a question for the player. */
  waiting: boolean;
  /** A delve: the room they're in (1 up; 0 at the door) of how many, what it is, torches left, what's happened lately. */
  /** An assault (sim/factions.ts): the wave on now (0 before the fight) and how many. */
  assault: { wave: number; total: number; target: string } | null;
  delve: { room: number; rooms: number; kind: string | null; torches: number; log: string[]; cleared: boolean; progress: number; twist: string | null; twistText: string; boss: string } | null;
  /** The Moon Pack's full-moon hunt. */
  hunt: boolean;
  /** The last fight's outcome, while fresh (the victory screen): how long ago it ended, in ticks. */
  result: { age: number; outcome: 'won' | 'retreated' | 'lost'; members: { id: number; name: string; xp: number; levelFrom: number; levelTo: number; down: boolean }[]; loot: Stock; coins: number; foes: string[]; boss: string | null } | null;
}

/** A place on the town's land. */
export interface PlaceView {
  id: number;
  kind: PlaceKind;
  name: string;
  text: string;
  /** Its middle, in px. */
  x: number;
  y: number;
  found: boolean;
  state: 'waiting' | 'done' | 'gone';
  /** A fight waiting: who, and the trip to send a party on (the board's destination), with the full destination. */
  foes: string | null;
  dest: Destination | null;
  /** A cleared cave dug as a mine: its level, what its walls still hold, and who is digging. */
  mine: { depth: number; last: boolean; left: Stock; diggers: number } | null;
  /** A monster nest (sim/nests.ts): its kind and how grown. */
  nest?: { kind: NestKind; level: number };
}

/** The Deep, in brief (the shaft's card, the Town overview). */
export interface DeepSummary {
  levels: { depth: number; name: string; dug: number; open: boolean }[];
  /** How roused what lives down there is, 0 to 1 (at 1 something climbs up). */
  stir: number;
  farms: number;
  lakes: number;
  miners: number;
  finds: string[];
}

/** A level of the Deep as the player sees it. */
export interface DeepView {
  depth: number;
  name: string;
  w: number;
  h: number;
  /** One character a cell (data/deep.ts DeepCell). */
  cells: string;
  /** Ore in each rock cell still holding some (index → its ore), for the flecks in the rock. */
  ores: Record<number, Material>;
  /** How many cells to the way down (0 once found), and the levels there are to look at. */
  toDown: number;
  levels: { depth: number; name: string }[];
  stir: number;
  finds: string[];
  /** The miners on this level: at their cell (digging) or on their way down the shaft. */
  miners: { id: number; name: string; look: Look; gear: Partial<Record<Slot, string>>; cell: number | null; digging: boolean; work: number }[];
}

function deepMiners(s: GameState): Person[] {
  return s.people.filter((p) => p.task?.type === 'mine' && s.buildings.some((b) => b.id === (p.task as { building: number }).building && b.def === SHAFT));
}

function deepSummary(s: GameState): DeepSummary | null {
  const d = s.deep;
  if (!d || !shaftOf(s)) return null;
  const { farms, lakes } = deepFarms(d);
  return {
    levels: d.levels.map((l) => ({ depth: l.depth, name: DEEP_LEVELS[l.depth - 1].name, dug: l.dug, open: l.down })),
    stir: Math.min(1, d.stir / RISE_AT),
    farms,
    lakes,
    miners: deepMiners(s).length,
    finds: d.finds.slice(-5),
  };
}

function deepView(s: GameState): DeepView | null {
  const d = s.deep;
  const shaft = shaftOf(s);
  if (!d || !shaft || s.watchingDeep === undefined) return null;
  const l = d.levels[s.watchingDeep - 1];
  if (!l) return null;
  const ores: Record<number, Material> = {};
  for (const [i, st] of Object.entries(l.pools)) {
    const ore = (Object.keys(st) as Material[]).find((m) => m !== 'stone' && (st[m] ?? 0) > 0);
    if (ore) ores[+i] = ore;
  }
  const c = buildingCentre(shaft);
  const at = (q: Person) => Math.hypot(q.x - c.x, q.y - c.y) < CELL * 2.2;
  return {
    depth: l.depth,
    name: DEEP_LEVELS[l.depth - 1].name,
    w: DEEP_W,
    h: DEEP_H,
    cells: l.cells,
    ores,
    toDown: l.down ? 0 : Math.max(0, OPEN_AFTER - l.dug),
    levels: d.levels.map((q) => ({ depth: q.depth, name: DEEP_LEVELS[q.depth - 1].name })),
    stir: Math.min(1, d.stir / RISE_AT),
    finds: d.finds.slice(-4),
    miners: deepMiners(s)
      .filter((q) => q.task?.type === 'mine' && (q.task.depth ?? 1) === l.depth)
      .map((q) => {
        const t = q.task as { cell?: number; work: number };
        return { id: q.id, name: q.name, look: q.look, gear: { ...q.gear }, cell: t.cell ?? null, digging: at(q) && q.activity === 'mine', work: t.work };
      }),
  };
}

/** The mine the player has gone into (sim/places.ts): what's there to watch. */
export interface MineView {
  id: number;
  name: string;
  depth: number;
  last: boolean;
  ores: Material[];
  left: Stock;
  /** The ore each wall cell holds (one wall a cell, in the mine's order), and who stands at it. */
  walls: { cell: number; left: Stock; digger: { id: number; name: string; look: Look; gear: Partial<Record<Slot, string>> } | null }[];
  /** Everyone working the mine (digging, or on their way to it). */
  miners: { id: number; name: string; look: Look; gear: Partial<Record<Slot, string>>; digging: boolean }[];
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
  /** The player forbids parties to go there; the treasury's bounty on it. */
  vetoed: boolean;
  bounty: number;
  /** Only a boat reaches it; and which boat a trip would take, or that it waits for one (sim/boats.ts boatLine). */
  byBoat?: boolean;
  boat?: string;
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
  /** A specialty shop's line (data/stores.ts), else null (the general store, the tavern). */
  line: ShopLine | null;
  /** What's on show inside, for the picture to set on its shelves, racks and tables: pieces of its line (or, at the
   *  general store, its wares and spare gear), each quality once, and (the general store) materials spare to sell. */
  stock: { item: string; q: number; n: number }[];
  stockMats: { m: Material; n: number }[];
  /** The keeper's décor direction (data/decor.ts): the style, how far it's taken, what the next step is and costs. */
  decor: { style: DecorId; name: string; line: string; level: number; max: number; next: { name: string; price: number } | null; by: string | null } | null;
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
  /** Who owns it (sim/ambition.ts; null: the town), what it's worth, and what it took yesterday. */
  ownerName: string | null;
  worth: number;
  takings: number;
  keeperLook: Look | null;
  /** The keeper's id (to dress them as the map does). */
  keeperId: number | null;
  /** Strangers inside now: who they are, what they came for, their temper, and (at the tavern) the comfort they need. */
  customers: { id: number; name: string; kind: string; look: Look; tier: number; wants: string; temper: string; req: number | null; bed: { x: number; y: number } | null; asleep: boolean; stage: 'browse' | 'counter' | 'done' | null; talk: ShopTalk | null; purse: number; people: string | null }[];
  /** Townsfolk in for the evening (sim/nightOut.ts), drawn in the room as the map dresses them. */
  locals: { id: number; name: string; look: Look }[];
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
  /** A specialty shop's customer: its line. */
  line: ShopLine | null;
  /** What they came for, in words, their temper, and the coins they have to spend. */
  wants: string;
  temper: string;
  purse: number;
  look: Look;
  x: number;
  y: number;
  dir: 1 | -1;
  phase: 'arriving' | 'shopping' | 'leaving';
  tier: number;
  /** One of a visiting band (sim/bands.ts): its kind and where it is in its visit. */
  band?: BandKind | null;
  bandPhase?: 'coming' | 'staying' | 'leaving';
}

export interface RoamerView {
  id: number;
  kind: 'beasts' | 'dead' | 'bandits' | 'nest';
  /** A nest's band: what it's called ("goblins"). */
  name?: string;
  x: number;
  y: number;
  dir: 1 | -1;
  /** Each foe in the band (enemy kind and name). */
  foes: { kind: string; name: string }[];
  fighting: boolean;
  /** The fight it's in (a skirmish id, to watch), and who it's after. */
  skirmish: number | null;
  chasing: string | null;
}
export interface SkirmishView {
  id: number;
  x: number;
  y: number;
  who: string[];
  foe: string;
  over: boolean;
  won: boolean | null;
}

export interface Snapshot {
  seed: string;
  /** The town's coins (from selling to travellers), its shop (once one's planned), and the travellers in town. */
  coins: number;
  shop: ShopView | null;
  /** The specialty shops built (data/stores.ts). */
  stores: ShopView[];
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
  /** The caravans' wagons on the land (sim/bands.ts). */
  wagons: { id: number; x: number; y: number; dir: 1 | -1 }[];
  tick: number;
  paused: boolean;
  /** How fast the town runs (1, 2 or 3 times). */
  speed: number;
  /** The last event answered and what came of it, for `OUTCOME_HOURS` (the feed's card). */
  eventOutcome: { title: string; choice: string | null; text: string; tick: number } | null;
  /** The last raid's recap while it's fresh (sim/raidRecap.ts), and how long ago it ended (game hours). */
  raidRecap: (RaidRecap & { hoursAgo: number }) | null;
  calendar: Calendar;
  /** Everything in storage, summed. */
  stock: Stock;
  storageUsed: number;
  storageCapacity: number;
  /** The land (sim/land.ts): the renderer reads it, never changes it. */
  land: LandMap;
  /** The old strip's tiles (empty now; the land replaces them). */
  tileRev: number;
  tiles: TileState[];
  buildings: Building[];
  /** The buildings someone is working at right now (a crafter at the bench, a scholar at the desk): their smoke,
   *  sparks and steam on the map (map/workFx.ts). */
  workingAt: number[];
  /** Market day's square while it's on (sim/pastimes.ts): the map puts up the stalls there. */
  market: { x: number; y: number } | null;
  people: PersonView[];
  visitor: VisitorView | null;
  housing: { beds: number; people: number };
  expeditions: ExpeditionView[];
  destinations: DestinationView[];
  /** Parties forming themselves: the next that would set out, who's fit to go, and the bounty step. */
  trips: TripsView;
  /** A party the player is raising (sim/muster.ts). */
  muster: MusterView | null;
  /** The powers of the realm (sim/factions.ts), and the town's might they weigh against. */
  realm: RealmView;
  /** The conquest: provinces, recruits, troops and squads (sim/conquest/warView.ts); null for a town without one. */
  war: WarView | null;
  /** An envoy's rider in town (sim/factions.ts): drawn mounted, riding in, waiting at the fire, riding out. */
  envoyRider: { id: number; name: string; look: Look; x: number; y: number; dir: 1 | -1; leaving: boolean } | null;
  /** The places on the town's land (sim/places.ts), found or not (the renderer draws only the found). */
  places: PlaceView[];
  /** The town's boats (sim/boats.ts): at home (away null) or the place they've sailed for; and the water cell by the
   *  boatyard where those at home lie moored. */
  fleet: { id: number; kind: BoatKind; name: string; hull: number; max: number; away: string | null }[];
  mooring: { x: number; y: number } | null;
  /** The Moon Pack's standing (sim/pack.ts), for a werewolf town. */
  pack: PackView | null;
  /** Blood on the ground where someone was struck down: where, the side the blow came from, and how old (ticks). */
  blood: { x: number; y: number; from: 1 | -1; age: number; key: string }[];
  /** What fights left lying about (state.ts `markDebris`), with their age (ticks). */
  debris: { x: number; y: number; kind: DebrisKind; age: number; key: string }[];
  /** The town gathered (a feast, a wedding, a funeral): where, and how many came (the map dresses the spot). */
  /** The gathering under way (sim/ceremonies.ts); `head`: where its procession's head is while it's on the way (the
   *  coffin carried, the couple, the faithful), `bearers` who walk there (the first two). */
  gathering: { kind: 'funeral' | 'great_funeral' | 'wedding' | 'feast' | 'rite'; x: number; y: number; ring: number; key: number; fire: boolean; head?: { x: number; y: number } | null; bearers?: number[] } | null;
  prompts: PromptView[];
  /** Seconds until the player can rally a defender again (0: now). */
  rallyIn: number;
  /** The townsperson the player follows (the camera keeps them in view), while they live. */
  hero: number | null;
  /** The expedition the player is watching, in place of the town. */
  watch: ExpeditionView | null;
  /** Hostile bands roaming the land, and the fights they're in (sim/roamers.ts). */
  roamers: RoamerView[];
  skirmishes: SkirmishView[];
  /** The mine the player has gone into, in place of the town (sim/places.ts). */
  mine: MineView | null;
  /** The Deep under the town (sim/deep.ts), once there's a shaft: its levels and how it stands. */
  deep: DeepSummary | null;
  /** The level of the Deep the player is looking at (`watchDeep`), drawn by renderer/deep/deepView.ts. */
  deepView: DeepView | null;
  /** Other worlds opened (sim/portals.ts), and the one looked into (`watchPortal`, renderer/portal/portalView.ts). */
  portals: PortalSummary[];
  portalView: PortalView | null;
  /** The building the player is looking into (sim/interiors.ts), drawn by renderer/interior/interiorView.ts. */
  interior: InteriorView | null;
  /** The town's families and their trees (sim/lineage.ts), for the People menu's Families tab. */
  families: FamilyLine[];
  /** The trade economy: prices, booms and shortages, the trade house and its routes (sim/markets.ts). */
  markets: MarketView | null;
  /** A raid being skipped to its recap, and whether every raid is (sim/raidSkip.ts). */
  raidSkipping: boolean;
  skipRaids: boolean;
  /** The town's people's own ways (sim/heritage.ts). */
  heritage: HeritageView | null;
  /** Quests open (sim/quests.ts): what, for which dungeon, and hours left to take it up. */
  /** The quest board (sim/questBoard.ts): offered or accepted; hours left of the offer or the time limit. */
  quests: { id: number; kind: string; dungeon: string; dungeonName: string; title: string; text: string; hoursLeft: number; from: string; reward: string; accepted: boolean; acceptedAgo: number | null }[];
  questLog: import('./questBoard').QuestLogEntry[];
  /** The sagas under way and those ended (sim/sagas.ts). */
  sagas: { open: SagaView[]; done: SagaDoneView[] };
  /** The kinds of foe the town has met (the Bestiary). */
  met: string[];
  /** The hall of heroes (sim/annals.ts): the fallen, newest first; the year's chronicles, newest first; and the famous
   *  among the living. */
  annals: AnnalsView;
  faith: FaithView;
  disaster: DisasterView | null;
  world: WorldView;
  /** The Monster Hunters' Guild (sim/hunts.ts): whether it stands, its hunts, its forge, and hunts won. */
  hunts: { guild: boolean; hunts: HuntView[]; forge: ForgeView[]; won: number };
  /** The dragon in the hills (sim/dragon.ts): its phase, health, tribute and flight. */
  dragon: DragonView | null;
  /** Daughter villages (sim/villages.ts), and their houses and fields for the map (ids below zero). */
  villages: VillageView[];
  /** The town's politics and law (sim/politics.ts): null until the town has three grown-ups. */
  politics: PoliticsView | null;
  villageBuildings: Building[];
  /** The Calamity (sim/calamity.ts), and where the land is blighted (cells: round each nest and its heart). */
  calamity: CalamityView | null;
  /** A cutscene waiting or playing (sim/cutscenes.ts), and those seen, to watch again. */
  scene: SceneView | null;
  scenesSeen: { key: number; id: string; title: string; tick: number }[];
  blight: { x: number; y: number; r: number }[];
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
  graves: { x: number; y: number; name: string }[];
  /** The famous dead honoured with statues in the square, and the ruins lying where buildings fell (sim/memorials.ts,
   *  sim/statues.ts, sim/ruins.ts). */
  honoured: HonouredView[];
  ruins: RuinView[];
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
  /** A castle town's castle (sim/castle.ts): every cell of it (land indices), the hall's ground, the cell before the
   *  gate, and the rectangle round the whole. */
  /** The town's lights (sim/lighting.ts): each burning or not, how far they reach; null when lighting is off. */
  lights: ReturnType<typeof lightsView>;
  castle: { hold: Hold; cells: number[]; core: { x: number; y: number; w: number; h: number }; gate: { x: number; y: number }; bounds: { x: number; y: number; w: number; h: number }; doors: string[]; galleries: number[]; /** The side gates a growing castle opens (sim/castle.ts `sideGates`): the cell inside each and its wall. */ gates?: { x: number; y: number; side: 'n' | 's' | 'w' | 'e' }[] } | null;
  /** The middle of the camp on the land (px). */
  camp: { x: number; y: number };
  /** The tower-defence battle on the trail, while it's on (sim/battle.ts). */
  battle: BattleView | null;
  /** A raid fought on a tactics board (sim/tactics.ts), while it's on; and how raids are fought. */
  tactics: TacticsView | null;
  battleStyle: 'trail' | 'tactics';
  /** Evolutions and stat points put to the player (the Town menu's settings). */
  evolveAsk: boolean;
  statsAsk: boolean;
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
  /** How many people the player wants the town to hold, or null for no limit. */
  townSize: number | null;
  /** The tax lever, and the treasury's guards (sim/treasury.ts). */
  tax: TaxRate;
  guards: { n: number; wanted: number; wage: number; names: string[] };
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
  caravan: { x: number; hoursLeft: number; /** Whose caravan ("the Deep Hold"), if another people's. */ faction: string | null; offers: { id: number; gives: Stock; horse: boolean; wants: Stock; done: boolean; ok: boolean; reason?: string }[] } | null;
  marketBuilt: boolean;
  nextCaravanHours: number | null;
  prisoners: { id: number; name: string; was: string; conviction: number; hungry: boolean }[];
  /** The town's cells for prisoners (data/prisons.ts), and who lies in each healing building's sickbeds. */
  cells: number;
  nursing: { building: number; beds: number; people: number[] }[];
  /** A disaster coming (signs) or under way, with game hours left. */
  /** A disaster coming or striking (`cold`: a Deep Freeze with nothing left to burn). */
  doom: { name: string; phase: 'signs' | 'active'; hoursLeft: number; sick: number; kind: DoomKind; cold: boolean } | null;
  /** Id of the newest journal entry (the Journal panel refetches when it changes). */
  journalHead: number;
  /** The latest big news (a journal milestone of the last few hours): the town crier calls it out on the map. */
  news: { id: number; text: string } | null;
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

/** Where a hero marching with an army is (sim/conquest/armies.ts). */
function awayWithArmy(s: GameState, p: Person): string {
  const c = s.conquest;
  const w = worldOf(s);
  const a = c && w ? armyOfPerson(c, p) : null;
  return a && w ? `${a.name}, ${a.going === null ? 'at' : 'marching on'} ${w.provinces[a.going ?? a.at].name}` : 'the war';
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
    stores: SHOP_LINES.map((l) => venueView(s, 'shop', l)).filter((v): v is ShopView => !!v),
    wageBill: moneyTown(s) ? wageBill(s) : 0,
    // (a lich founder turns any town into a necropolis; otherwise the origin's own look)
    theme: themeOf(s),
    origin: { id: originOf(s).id, name: originOf(s).name, town: s.lich ? ORIGIN_DEFS.lich.town : originOf(s).town },
    powers: powersView(s),
    battle: battleView(s, aimableSpells(s)),
    tactics: tacticsView(s),
    battleStyle: s.battleStyle ?? 'tactics',
    evolveAsk: s.evolveAsk !== false,
    statsAsk: s.statsAsk === true,
    powerLog: [...(s.powerLog ?? [])].reverse().map((l) => l.text),
    lichOffer: s.research.done.includes('lichcraft') && !s.lich && !s.lichChosen && !s.people.find((p) => p.id === s.mainId)?.monster,
    ledger: s.ledger?.yesterday ? { ...s.ledger.yesterday } : null,
    travellers: (s.travellers ?? []).map((t) => {
      const band = t.band === undefined ? undefined : (s.bands ?? []).find((b) => b.id === t.band);
      return { id: t.id, name: t.name, kind: t.kind, venue: t.venue ?? 'shop', line: t.line ?? null, wants: t.want ? wantText(t.want) : '', temper: temperOf(t.temper).name, purse: Math.floor(t.purse ?? 0), look: t.look, x: t.x, y: t.y, dir: t.dir, phase: t.phase, tier: t.tier ?? 1, band: band?.kind ?? null, bandPhase: band?.phase };
    }),
    wagons: (s.bands ?? []).flatMap((b) => {
      const lead = b.wagon && (s.travellers ?? []).find((t) => t.id === b.members[0]);
      return b.wagon ? [{ id: b.id, x: b.wagon.x, y: b.wagon.y, dir: lead?.dir ?? (b.side < 0 ? 1 : -1) }] : [];
    }),
    tick: s.tick,
    paused: s.paused,
    speed: s.gameSpeed ?? 1,
    raidRecap: s.raidRecap && s.tick - s.raidRecap.tick < RECAP_HOURS * TICKS_PER_HOUR ? { ...s.raidRecap, hoursAgo: (s.tick - s.raidRecap.tick) / TICKS_PER_HOUR } : null,
    eventOutcome: s.eventOutcome && s.tick - s.eventOutcome.tick < OUTCOME_HOURS * TICKS_PER_HOUR ? { title: s.eventOutcome.title, choice: s.eventOutcome.choice, text: s.eventOutcome.text, tick: s.eventOutcome.tick } : null,
    calendar: calendar(s.tick),
    stock,
    storageUsed: poolSize(stock),
    storageCapacity: totalCapacity(s),
    land: s.land,
    tileRev: s.land.version,
    tiles: [],
    workingAt: workingAt(s),
    lights: lightsView(s),
    market: marketOn(s) ? marketSquare(s) : null,
    // (a venue's takings copied too, so the map sees a sale between two snapshots: map/mapGains.ts)
    buildings: s.buildings.map((b) => ({ ...b, delivered: { ...b.delivered }, store: { ...b.store }, ...(b.herd ? { herd: { ...b.herd } } : {}), ...(b.shop?.takings ? { shop: { ...b.shop, takings: { ...b.shop.takings } } } : {}) })),
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
    destinations: [...DESTINATIONS, ...placeDestinations(s), ...packDestinations(s), ...sagaDestinations(s), ...huntDestinations(s), ...dragonDestinations(s), ...heartDestinations(s), ...villageDestinations(s), ...portalDestinations(s)].map((d) => ({
      id: d.id,
      unlocked: destinationUnlocked(s, d),
      scouted: s.scouted.includes(d.id),
      hidden: destinationHidden(s, d.id),
      ...(d.type === 'delve' || isPlaceDest(d.id)
        ? { candidates: s.people.filter((p) => p.away === null && !p.downed && !isChild(p) && p.hp >= maxHp(p) * 0.4).map((p) => p.id), cleared: s.delved?.[d.id] ?? 0, quietHours: quietHours(s, d.id) }
        : {}),
      tripSeconds: ((d.outSeconds * 2 + d.workSeconds) * ERA_MULTIPLIER[s.era]),
      foodPerMember: foodNeeded(s, d, 1),
      ...partyView(s, d.id),
      vetoed: vetoed(s, d.id),
      bounty: bountyOn(s, d.id),
      ...(d.byBoat ? { byBoat: true } : {}),
      ...((line) => (line ? { boat: line } : {}))(boatLine(s, d)),
    })),
    fleet: fleet(s).map((b) => ({ id: b.id, kind: b.kind, name: b.name, hull: Math.max(0, b.hull), max: BOAT_BY_KIND[b.kind].hull, away: b.away === null ? null : ((e) => (e ? destinationOf(s, e.dest)?.name ?? '' : ''))(s.expeditions.find((e) => e.id === b.away)) })),
    mooring: ((y) => (y ? mooring(s.land, footprint(y)) : null))(boatyardOf(s)),
    trips: tripsView(s),
    muster: musterView(s, (p) => callingName(p, stageOf(p))),
    envoyRider: s.envoyRider ? { ...s.envoyRider } : null,
    realm: realmView(s, (id) => !destinationHidden(s, id) && !!DEST_BY_ID[id] && destinationUnlocked(s, DEST_BY_ID[id])),
    places: placeViews(s),
    pack: packView(s),
    war: CONQUEST.on ? warView(s) : null,
    gathering: s.gathering && s.tick < s.gathering.until && !s.raid ? { kind: s.gathering.kind, x: s.gathering.x, y: s.gathering.y, ring: gatheringRadius(s.gathering), key: s.gathering.from ?? 0, fire: Math.hypot(s.gathering.x - campXY(s).x, s.gathering.y - campXY(s).y) > 40, head: processing(s.gathering, s.tick) ? processionHead(s.gathering, s.tick) : null, bearers: s.gathering.ids.slice(0, 2) } : null,
    debris: (s.debris ?? []).filter((m) => s.tick - m.tick < DEBRIS_LASTS).map((m) => ({ x: m.x, y: m.y, kind: m.kind, age: s.tick - m.tick, key: `${m.tick}:${m.x}:${m.y}:${m.kind}` })),
    blood: (s.blood ?? []).filter((m) => s.tick - m.tick < BLOOD_LASTS).map((m) => ({ x: m.x, y: m.y, from: m.from, age: s.tick - m.tick, key: `${m.tick}:${m.x}:${m.y}` })),
    rallyIn: Math.max(0, Math.ceil(((s.rallyReady ?? 0) - s.tick) / TICK_HZ)),
    regions: [HOME_REGION, ...(s.regions ?? [])],
    quests: (s.quests ?? []).map((q) => ({
      id: q.id,
      kind: q.kind,
      dungeon: q.dungeon,
      title: q.title,
      text: q.text,
      hoursLeft: Math.max(0, Math.ceil((q.until - s.tick) / TICKS_PER_HOUR)),
      from: q.from,
      accepted: q.accepted !== undefined,
      acceptedAgo: q.accepted === undefined ? null : Math.floor((s.tick - q.accepted) / TICKS_PER_HOUR),
      dungeonName: DUNGEON_BY_ID[q.dungeon]?.name ?? q.dungeon,
      // (what it pays, for the quest's details: tap it in the Expeditions tab)
      reward:
        q.kind === 'rescue' ? 'The captive comes home with the party, and stays in the town (if there is room).'
        : q.kind === 'bounty' ? `${q.coins ?? 0} coins, shared by the party that clears it.`
        : q.kind === 'relic' ? `${ITEM_BY_ID[q.unique ?? '']?.name ?? 'A unique weapon'}: ${ITEM_BY_ID[q.unique ?? '']?.description ?? ''}`
        : "The fallen delver's gear: a fine weapon of the dungeon's age, into the town's stores.",
    })),
    questLog: s.questLog ?? [],
    sagas: sagasView(s),
    met: s.met ?? [],
    annals: annalsView(s),
    faith: faithView(s),
    disaster: disasterView(s),
    world: worldView(s),
    hunts: huntsView(s),
    dragon: dragonView(s),
    villages: villageViews(s),
    politics: politicsView(s),
    villageBuildings: villageBuildings(s),
    calamity: calamityView(s),
    scene: sceneView(s),
    scenesSeen: (s.scenesSeen ?? []).map((r) => ({ key: r.key, id: r.id, title: r.title, tick: r.tick })),
    blight: blightSources(s),
    uniques: (s.uniques ?? []).map((id) => ({ id, holder: s.people.find((p) => p.gear.weapon === id)?.name ?? null })),
    roamers: (s.roamers ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      ...(r.name ? { name: r.name } : {}),
      x: r.x,
      y: r.y,
      dir: r.dir,
      foes: Object.entries(r.group).flatMap(([k, n]) => Array.from({ length: n }, () => ({ kind: k, name: ENEMIES[k]?.name ?? k }))),
      fighting: r.fighting !== undefined,
      skirmish: r.fighting ?? null,
      chasing: r.chasing !== null ? (s.people.find((p) => p.id === r.chasing)?.name ?? null) : null,
    })),
    skirmishes: (s.skirmishes ?? []).map((k) => ({
      id: k.id,
      x: k.x,
      y: k.y,
      who: k.e.members.map((id) => s.people.find((p) => p.id === id)?.name).filter((n): n is string => !!n),
      foe: ROAMER_NAME[(k.e.dest.slice(5) as keyof typeof ROAMER_NAME)] ?? 'a band',
      over: k.ended !== undefined,
      won: k.e.result ? k.e.result.outcome === 'won' : null,
    })),
    watch: ((e) => (e ? expeditionView(s, e) : null))(s.expeditions.find((e) => e.id === s.watching) ?? skirmishTrip(s, s.watching)),
    mine: mineView(s),
    deep: deepSummary(s),
    deepView: deepView(s),
    portals: portalSummaries(s),
    portalView: portalView(s),
    interior: interiorView(s, (p) => describe(s, p)),
    families: slow(s, 'families', () => familiesView(s)),
    markets: slow(s, 'markets', () => marketView(s)),
    raidSkipping: !!s.raidSkip && !!s.raid,
    skipRaids: !!s.skipRaids,
    heritage: slow(s, 'heritage', () => heritageView(s)),
    hero: s.hero !== undefined && s.people.some((p) => p.id === s.hero) ? s.hero : null,
    prompts: s.prompts.map((p) => ({
      id: p.id,
      title: p.title,
      text: p.text,
      options: [...p.options],
      defaultOption: p.defaultOption,
      kind: p.kind,
      story: p.story ?? null,
      picture: p.picture ?? null,
      who: p.who ?? null,
      // (none for a question that waits as long as it takes: raiders held at the gate)
      secondsLeft: p.expiresTick >= Number.MAX_SAFE_INTEGER ? null : Math.max(0, (p.expiresTick - s.tick) / TICK_HZ),
      ...(p.roads ? { roads: p.roads.map(roadOf).filter((r): r is RoadView => !!r) } : {}),
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
            floor: null,
            x: r.x,
            y: r.y,
            dir: r.dir,
            hp: r.hp,
            maxHp: r.maxHp,
            down: r.down,
            fleeing: r.fleeing,
            gone: r.gone,
            carrying: poolSize(r.carrying),
            captive: r.captive?.name ?? null,
            lame: r.lame ?? 0,
            sinceAction: s.tick - r.lastAction,
            sinceHit: s.tick - r.lastHit,
            ally: !!r.ally,
            sinceArea: r.lastArea != null ? s.tick - r.lastArea : 999,
            sinceConjured: r.conjuredAt != null ? s.tick - r.conjuredAt : 999,
            sinceCast: r.lastCast != null ? s.tick - r.lastCast : 999,
            hitFx: r.hitFx ?? null,
            swimming: wetAt(s, r.x, r.y),
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
    honoured: honouredView(s),
    ruins: ruinsView(s),
    undeadHaven: undeadShare(s) >= 0.5,
    revived: s.revivedAt && s.tick - s.revivedAt.tick < 60 ? { id: s.revivedAt.id, since: s.tick - s.revivedAt.tick } : null,
    fx: (s.fx ?? []).filter((f) => s.tick - f.tick < FX_TICKS).map((f) => ({ id: f.id, kind: f.kind, since: s.tick - f.tick })),
    launchSite: launchSiteView(s),
    impacts: (s.impacts ?? []).filter((m) => s.tick - m.tick < 30).map((m) => ({ x: m.x, since: s.tick - m.tick })),
    campX: campX(s),
    camp: campXY(s),
    nomad: s.nomad
      ? {
          site: s.nomad.camp === s.nomad.home ? 'home' : 'pasture',
          settled: !!s.nomad.settled,
          nextMoveDays: daysToMove(s),
          traces: s.nomad.settled ? [] : (s.nomad.left ?? []),
          move: s.nomad.movedAt != null && s.nomad.from != null ? { from: (s.nomad.from.x + 0.5) * TILE, to: (s.nomad.camp.x + 0.5) * TILE, since: s.tick - s.nomad.movedAt } : null,
        }
      : null,
    enclosure: enclosure(s),
    castle: castleOn(s) ? { hold: holdOf(s)!, cells: [...castleCells(s)], core: coreRect(s), gate: castleGate(s), bounds: castleBounds(s), doors: [...castleLayout(s)!.doors], galleries: galleryCells(s), gates: castleLayout(s)!.gates.slice(1).map((g) => ({ x: g.inside.x, y: g.inside.y, side: g.side })) } : null,
    spells: (s.spellFx ?? []).filter((f) => s.tick - f.tick < Math.min(SPELL_FX_TICKS, f.secs * TICK_HZ + 10)).map((f) => ({ n: f.n, spell: f.spell, name: spellName(f.spell), since: s.tick - f.tick, x: f.x, y: f.y ?? null, by: f.by ?? null, targets: f.targets, secs: f.secs })),
    moonNight: moonPhaseOf(nightDay(s.tick)) === FULL_MOON_PHASE && (calendar(s.tick).hour >= 20 || calendar(s.tick).hour < 5),
    moonPhase: moonPhaseOf(nightDay(s.tick)),
    weather: weatherAt(s.seed, s.tick, s.doom?.phase === 'active' ? s.doom.kind : null),
    direction: directionOf(s),
    townSize: s.popTarget ?? null,
    tax: taxRate(s),
    guards: { n: guardsOf(s).length, wanted: guardsWanted(s), wage: guardWage(s), names: guardsOf(s).map((g) => g.name) },
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
          faction: s.caravan.faction ? ORIGIN_DEFS[s.caravan.faction].name : null,
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
    cells: cellsOf(s),
    nursing: s.buildings.filter((b) => sickbedsIn(b) > 0).map((b) => ({ building: b.id, beds: sickbedsIn(b), people: patientsIn(s, b).map((p) => p.id) })),
    journalHead: s.journal.at(-1)?.id ?? 0,
    news: latestNews(s),
    away: awayView(s),
    eraReady: s.eraReady,
  };
}

/** What the town sells and buys changes slowly: worked out afresh every few seconds, not on every snapshot (it runs the
 *  planner's needs over the whole land: half a phone's snapshot time when it was every second). */
let dealsCache: { state: GameState; tick: number; forSale: Stock; wants: ShopView['wants'] } | null = null;
const DEALS_EVERY = 60;

/** Things the snapshot shows that change slowly and cost a lot (the planned parties, the next party forming): kept for
 *  `SLOW_EVERY` ticks a state and key, so the phone isn't working them out ten times a second. */
const SLOW_EVERY = 50;
const slowCache = new WeakMap<GameState, Map<string, { tick: number; v: unknown }>>();
function slow<T>(s: GameState, key: string, f: () => T): T {
  let m = slowCache.get(s);
  if (!m) slowCache.set(s, (m = new Map()));
  const c = m.get(key);
  if (c && s.tick >= c.tick && s.tick - c.tick < SLOW_EVERY) return c.v as T;
  const v = f();
  m.set(key, { tick: s.tick, v });
  return v;
}

function venueView(s: GameState, venue: 'shop' | 'tavern', line?: ShopLine): ShopView | null {
  const b = s.buildings.find((q) => venueOfDef(q.def) === venue && lineOfDef(q.def) === line);
  if (!b) return null;
  const inside = (s.travellers ?? []).filter((t) => (t.venue ?? 'shop') === venue && t.line === line);
  // (what this shop sells: its line; the general store its wares and the gear no specialty shop has taken)
  const elsewhere = new Set(SHOP_LINES.filter((l) => !line && s.buildings.some((q) => q.status === 'done' && lineOfDef(q.def) === l)));
  const sells = (i: ItemDef) => (line ? LINE_ITEMS[line].includes(i) : !!i.ware || (SALE_GEAR.includes(i) && ![...elsewhere].some((l) => LINE_ITEMS[l].includes(i))));
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
  const shown = venue === 'tavern' ? [] : ITEMS.filter((i) => (s.items[i.id] ?? 0) > 0 && sells(i));
  return {
    venue,
    line: line ?? null,
    stock: shown.flatMap((i) => [...new Set(qualitiesOf(s, i.id))].map((q) => ({ item: i.id, q, n: qualitiesOf(s, i.id).filter((x) => x === q).length }))).slice(0, 40),
    decor: b.shop?.decor
      ? {
          style: b.shop.decor.style,
          name: DECOR_STYLES[b.shop.decor.style].name,
          line: DECOR_STYLES[b.shop.decor.style].line,
          level: b.shop.decor.level,
          max: DECOR_MAX,
          next: decorPrice(s, b) !== null ? { name: DECOR_LEVELS[b.shop.decor.level].name, price: decorPrice(s, b)! } : null,
          by: keeper?.name ?? null,
        }
      : null,
    stockMats: venue === 'shop' && !line ? (Object.entries(dealsCache!.forSale) as [Material, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([m, n]) => ({ m, n })) : [],
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
    ownerName: b.owner === undefined ? null : (s.people.find((q) => q.id === b.owner)?.name ?? null),
    worth: businessPrice(s, b),
    takings: (() => { const t = b.shop?.takings; const day = Math.floor(s.tick / TICKS_PER_DAY); return !t ? 0 : t.day === day ? t.yesterday : t.day === day - 1 ? t.today : 0; })(),
    keeperLook: keeper?.look ?? null,
    keeperId: keeper?.id ?? null,
    customers: inside
      .filter((t) => t.phase === 'shopping' && s.tick < t.until)
      .map((t) => ({ id: t.id, name: t.name, kind: t.kind, look: t.look, tier: t.tier ?? 1, wants: t.want ? wantText(t.want) : '', temper: temperOf(t.temper).name, req: t.req ?? null, bed: t.bed ?? null, asleep: !!t.bed && asleepHour(calendar(s.tick).hour), stage: t.stage ?? null, talk: t.talk ?? null, purse: Math.round(t.purse ?? 0), people: t.origin ? (ORIGIN_DEFS[t.origin]?.name ?? null) : null })),
    locals: s.nightOut && s.nightOut.tavern === b.id ? s.people.filter((p) => p.task?.type === 'drink' && p.activity === 'drink').map((p) => ({ id: p.id, name: p.name, look: p.look })) : [],
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
        ? SALE_GEAR.filter(sells).flatMap((i) => [...new Set(qualitiesOf(s, i.id))].map((q) => ({ name: i.name, q, n: qualitiesOf(s, i.id).filter((x) => x === q).length, price: itemPrice(i, q) })))
        : [],
    forSale: venue === 'shop' && !line ? dealsCache.forSale : {},
    wants: venue === 'shop' && !line ? dealsCache.wants : [],
    log: (b.shop?.log ?? []).map((l) => ({ when: entryView({ id: 0, tick: l.tick, text: '' }).when, text: l.text })),
    nextHours: ((due) => (open && due !== undefined ? Math.max(0, (due - s.tick) / TICKS_PER_HOUR) : null))(line ? s.nextStoreTick?.[line] : venue === 'shop' ? s.nextTravellerTick : s.nextGuestTick),
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
    case 'line':
      return LINES[what as ShopLine]?.label ?? what;
    default:
      return key;
  }
}

/** The party the town would plan for a destination, for the Expedition Board. */
/** The places on the land, for the map and the feed. */
function placeViews(s: GameState): PlaceView[] {
  return (s.places ?? []).map((p) => ({
    id: p.id,
    kind: p.kind,
    name: p.nest ? nestPlaceName(p) : PLACE_DEFS[p.kind].name,
    text: p.nest ? NEST_DEFS[p.nest.kind].found : PLACE_DEFS[p.kind].found,
    ...(p.nest ? { nest: { kind: p.nest.kind, level: p.nest.level } } : {}),
    ...placeXY(p),
    found: p.found !== null,
    state: p.state,
    foes: p.foes ? describeFoes(p.foes) : null,
    dest: p.foes && p.state === 'waiting' && p.found !== null ? placeDestination(s, p) : null,
    mine: p.mine && p.state === 'done' ? { depth: p.mine.depth, last: p.mine.depth >= MINE_DEPTH, left: mineLeft(s, p), diggers: minersAt(s, p).length } : null,
  }));
}

function mineView(s: GameState): MineView | null {
  const p = s.watchingMine !== undefined ? placeById(s, s.watchingMine) : undefined;
  if (!p?.mine || p.state !== 'done') return null;
  const camp = campCell(s);
  const miners = minersAt(s, p);
  const person = (q: Person) => ({ id: q.id, name: q.name, look: q.look, gear: { ...q.gear } });
  const at = (q: Person) => Math.hypot(q.x - (p.x + 0.5) * CELL, q.y - (p.y + 0.5) * CELL) < CELL * 2.2;
  return {
    id: p.id,
    name: `The mine to the ${directionName(p.x - camp.x, p.y - camp.y)}`,
    depth: p.mine.depth,
    last: p.mine.depth >= MINE_DEPTH,
    ores: [...p.mine.ores],
    left: mineLeft(s, p),
    walls: p.mine.cells.map((cell) => {
      const q = miners.find((m) => m.task?.type === 'gather' && m.task.tile === cell && at(m));
      return { cell, left: { ...(s.land.pools[cell] ?? {}) }, digger: q ? person(q) : null };
    }),
    miners: miners.map((q) => ({ ...person(q), digging: at(q) })),
  };
}

/** Whether a point on the land is in the water (the sea or a river). */
function wetAt(s: GameState, x: number, y: number): boolean {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  return inMap(s.land, cx, cy) && wet(groundAt(s.land, cx, cy));
}

function bodyView(p: Person): PersonView['body'] {
  const c = capacities(p);
  return {
    wounds: (p.wounds ?? []).map(woundText),
    lasting: (p.lasting ?? []).map((l) => (l.kind === 'lost' ? `lost ${PARTS[l.part].name}` : `scarred ${PARTS[l.part].name}`)),
    fitted: Object.entries(p.fitted ?? {}).map(([part, item]) => `${ITEM_BY_ID[item!]?.name ?? item} (${PARTS[part as BodyPart].name})`),
    sight: c.sight,
    handling: c.handling,
    moving: c.moving,
    pain: c.pain,
    marks: bodyMarks(p),
  };
}

/** What shows of someone's harm in the town (map/bodyMarks.ts): a lost part bare or made good (a peg, a hook, a
 *  wooden or jointed limb, a bionic one; an eye patched, glass or bionic), and a bandage over a bad wound. */
export type BodyMarkLook = 'gone' | 'patch' | 'peg' | 'hook' | 'wood' | 'metal' | 'bionic' | 'glass' | 'bandage';
export interface BodyMark {
  part: BodyPart;
  look: BodyMarkLook;
}
/** A wound this bad or worse is bandaged. */
export const BANDAGE_AT = 0.25;

function bodyMarks(p: Person): BodyMark[] {
  const out: BodyMark[] = [];
  for (const l of p.lasting ?? []) {
    if (l.kind !== 'lost') continue;
    const item = p.fitted?.[l.part];
    const pro = item ? PROSTHETIC_BY_ITEM[item] : undefined;
    const fits = fitsOf(l.part);
    let look: BodyMarkLook;
    if (!pro) look = fits === 'eye' ? 'patch' : 'gone';
    else if (pro.rank >= 3) look = 'bionic';
    else if (fits === 'eye') look = 'glass';
    else if (pro.rank === 2) look = 'metal';
    else look = fits === 'leg' ? 'peg' : fits === 'hand' ? 'hook' : 'wood';
    out.push({ part: l.part, look });
  }
  for (const w of p.wounds ?? []) if (w.sev >= BANDAGE_AT && !out.some((m) => m.part === w.part)) out.push({ part: w.part, look: 'bandage' });
  return out;
}

export interface TripsView {
  /** The party that would form now ("Name and 2 others for the Berry Thicket"), or why none would. */
  forming: string;
  /** Grown-ups fit to go and free to (not guards, keepers or the founder), and how many more may be away. */
  fit: number;
  room: number;
  bountyStep: number;
  /** Adventurers in the town (who form parties of their own accord). */
  adventurers: number;
}

function tripsView(s: GameState): TripsView {
  const plan = slow(s, 'propose', () => proposeParty(s));
  const fit = s.people.filter((p) => mayGo(s, p)).length;
  const room = roomAway(s);
  const adventurers = s.people.filter((p) => !isChild(p) && ambitionOf(p) === 'adventurer').length;
  let forming: string;
  if (plan) {
    const lead = s.people.find((p) => p.id === plan.leader)!;
    const d = destinationOf(s, plan.dest)!;
    const others = plan.members.length - 1;
    forming = `${lead.name}${others ? ` and ${others} other${others > 1 ? 's' : ''}` : ''} would set out for ${the(d.name)}${plan.stakes === 'risky' ? ', boldly' : ''}.`;
  } else if (s.expeditions.length >= MAX_EXPEDITIONS) forming = 'As many parties are out as can be.';
  else if (!room) forming = s.people.filter((p) => !isChild(p)).length < 3 ? 'The town is too small to send anyone out.' : 'Half the town is away already: nobody else goes.';
  else if (!fit) forming = 'Nobody is fit to go: they rest and heal first.';
  else if (!adventurers) forming = 'No adventurers in town: nobody goes out until one comes.';
  else forming = 'No party is strong enough for anywhere they want to go yet.';
  return { forming, fit, room, bountyStep: bountyStep(s), adventurers };
}

function partyView(s: GameState, dest: string): { party: string[]; partyHorses: number; partyTruck: boolean } {
  const plan = slow(s, `party:${dest}`, () => planParty(s, dest));
  // (the plan is kept a while: someone in it may have died since)
  const party = plan.members.flatMap((id) => {
    const p = s.people.find((q) => q.id === id);
    return p ? [`${p.name} (${ROLES[plan.roles[id] ?? 'fighter'].name.toLowerCase()})`] : [];
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
    y: p.y,
    dir: p.dir,
    activity: p.activity,
    taskDone: taskDone(s, p),
    sinceHit: s.tick - (p.lastHit ?? -999),
    hitFrom: p.hitFrom ?? 1,
    sinceBlow: s.tick - (p.lastBlow ?? -999),
    sinceBlock: s.tick - (p.lastBlock ?? -999),
    defending: !!s.raid && p.task?.type === 'defend',
    beast: beastForm(p),
    mounted: null,
    cls: p.cls ?? null,
    // (a special newcomer's calling is part of their secret until it's out)
    clsName: p.secret && !p.secret.found ? null : callingName(p, stageOf(p)),
    clsPast: p.cls ? [0, 1, 2, 3].filter((i) => i < stageOf(p)).map((i) => callingName(p, i)!) : [],
    clsText: callingText(p),
    founderCalling: !!p.fcls,
    road: roadView(s, p),
    roadId: p.road ?? null,
    freePts: freePoints(p),
    autoStats: !!p.autoStats,
    favours: roadFavours(p.cls, p.road),
    stage: stageOf(p),
    ascended: !!p.ascended,
    level: levelOf(p),
    levelProgress: levelProgress(p),
    doing: describe(s, p),
    work: workOf(s, p),
    carrying: { ...p.carrying },
    skills: Object.fromEntries(
      SKILLS.map((k) => [k, { level: p.skills[k].level, progress: p.skills[k].xp / xpToNext(p.skills[k].level), passion: p.passions.includes(k) }]),
    ) as Record<Skill, SkillView>,
    traits: p.traits.map((t) => ({ name: TRAIT_BY_ID[t]?.name ?? t, description: TRAIT_BY_ID[t]?.description ?? '' })),
    needs: { ...p.needs },
    morale: p.morale,
    moodTarget: m.target,
    moodReasons: m.reasons,
    grieving: !!p.grief && p.grief.until > s.tick,
    priorities: { ...p.priorities },
    autoPriorities: p.autoPriorities,
    bed: bed ? defOf(bed).name : null,
    bedId: bed ? bed.id : null,
    floor: null,
    rally: rallyState(s, p),
    bucket: p.task?.type === 'wander' && p.task.pastime === 'carry',
    indoors: (p.activity === 'mine' && p.task?.type === 'mine' && p.task.depth !== undefined) || (p.activity === 'sleep' && ((p.task?.type === 'sleep' && p.task.building !== null) || (p.task?.type === 'shelter' && p.bed !== null))) || (p.activity === 'drink' && p.task?.type === 'drink') || (p.activity === 'watch' && p.task?.type === 'relax'),
    away: p.away === null ? null : p.away < 0 ? awayWithArmy(s, p) : (destinationOf(s, s.expeditions.find((e) => e.id === p.away)?.dest ?? '')?.name ?? 'expedition'),
    hp: p.hp,
    maxHp: maxHp(p),
    downed: !p.downed ? null : p.downed.bleedUntil === null ? 'recovering' : 'bleeding',
    bleedMinutes: p.downed?.bleedUntil != null ? Math.max(0, Math.ceil(((p.downed.bleedUntil - s.tick) / TICKS_PER_HOUR) * 60)) : null,
    gear: { ...p.gear },
    gearQ: { ...(p.gearQ ?? {}) },
    // (whole coins only: a purse may hold the odd fraction, from a share of a sale or a tax)
    coins: p.coins != null ? Math.floor(p.coins) : moneyTown(s) ? 0 : null,
    income: moneyTown(s) ? wholeIncome(incomeOf(s, p), p.paidFor?.line ?? null) : null,
    owns: propertyOf(s, p),
    debt: Math.ceil(p.debt ?? 0),
    detail: personDetail(s, p),
    recent: [...(p.recent ?? [])].reverse().map((r) => r.text),
    bedroll: hasBedroll(s, p),
    carryCapacity: carryCapacity(s, p),
    partner: p.partner == null ? null : (s.people.find((q) => q.id === p.partner)?.name ?? null),
    married: !!p.married,
    friends: friendsOf(s, p).filter((f) => f.id !== p.partner).map((f) => f.name),
    rivals: rivalsOf(s, p).filter((f) => opinion(s, p.id, f.id) > ENEMY).map((f) => f.name),
    enemies: enemiesOf(s, p).map((f) => f.name),
    body: bodyView(p),
    devoted: devotedOf(s, p).filter((f) => f.id !== p.partner).map((f) => f.name),
    growsUpIn: p.bornTick != null ? Math.max(0, CHILD_HOURS - (s.tick - p.bornTick) / TICKS_PER_HOUR) : null,
    breakdown: p.breakdown ? BREAK_TEXT[p.breakdown.kind] : null,
    nature: natureOf(p).id,
    natureName: natureOf(p).name,
    job: jobView(s, p),
    natureLine: natureOf(p).line,
    story: storyOf(s, p),
    titles: p.titles ?? [],
    secret: secretView(p),
    ambition: p.bornTick == null ? { name: AMBITIONS[ambitionOf(p)].name, line: AMBITIONS[ambitionOf(p)].line } : null,
    trips: p.trips ?? 0,
    swimming: swims(s, p) && p.away === null && wet(groundAt(s.land, Math.floor(p.x / CELL), Math.floor(p.y / CELL))),
    mer: peopleOf(s, p) === 'merfolk' && !p.monster,
    ageDays: Math.floor(ageDays(s, p)),
    ageYears: Math.floor(ageYears(s, p)),
    lifeStage: lifeStage(s, p),
    ageText: ageLine(s, p),
    elder: isElder(s, p),
    tipsy: walkingHome(s, p),
    bedward: p.task?.type === 'sleep' && p.activity === 'walk',
    guard: !!p.guard,
    onWatch: onShift(s, p),
    monster: p.monster ?? null,
    tireless: tireless(p),
    order: p.monster ? (p.order ?? 'hide') : null,
    sick: !!p.sick,
    rounds: (p.task?.type === 'wander' || p.task?.type === 'idle') && p.task.pastime === 'rounds',
    ...fightView(p),
  };
}

/** How far along the work in hand is, for the bar over someone's head: a site's building, a repair, a craft order,
 *  the topic studied, a field's sowing or reaping, a load being gathered or dug, a patient tended. Null while they walk
 *  to it, or do anything else. */
/** The newest milestone in the journal, while it's still news (`NEWS_HOURS`). */
const NEWS_HOURS = 4;
function latestNews(s: GameState): { id: number; text: string } | null {
  for (let i = s.journal.length - 1; i >= 0; i--) {
    const e = s.journal[i];
    if (s.tick - e.tick > NEWS_HOURS * TICKS_PER_HOUR) return null;
    if (e.key && !e.lines) return { id: e.id, text: e.text };
  }
  return null;
}

/** The buildings at work: a crafting order being made at its station, a topic studied at a station. */
function workingAt(s: GameState): number[] {
  const out = new Set<number>();
  for (const p of s.people) {
    const t = p.task;
    if (!t || p.away !== null || p.activity === 'walk') continue;
    if (t.type === 'craft' && t.phase === 'work') {
      const o = s.crafting.find((q) => q.id === t.order);
      const def = o && ITEM_BY_ID[o.item];
      const b = def && stationFor(s, def);
      if (b) out.add(b.id);
    } else if (t.type === 'research' && t.station != null) out.add(t.station);
  }
  return [...out];
}

function workOf(s: GameState, p: Person): { kind: string; at: string | null } | undefined {
  const t = p.task;
  if (!t || p.away !== null || p.activity === 'walk' || p.activity === 'idle') return undefined;
  if (t.type === 'craft') {
    const o = s.crafting.find((q) => q.id === t.order);
    const def = o && ITEM_BY_ID[o.item];
    return { kind: 'craft', at: (def && stationFor(s, def)?.def) ?? null };
  }
  const b = 'building' in t ? s.buildings.find((q) => q.id === t.building) : undefined;
  return { kind: t.type, at: b?.def ?? null };
}

function taskDone(s: GameState, p: Person): number | null {
  const t = p.task;
  if (!t || p.away !== null || p.activity === 'walk' || p.activity === 'idle') return null;
  const b = 'building' in t ? s.buildings.find((q) => q.id === t.building) : undefined;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  switch (t.type) {
    case 'build':
      return b ? clamp(b.progress) : null;
    case 'pave':
      return clamp(t.progress / paveSeconds(s, t.cell));
    case 'light':
      return clamp(t.progress / FEED_SECONDS);
    case 'repair': {
      const most = b ? (BUILDING_BY_ID[b.def]?.hp ?? 0) : 0;
      return b && most ? clamp((b.hp ?? most) / most) : null;
    }
    case 'craft': {
      const o = s.crafting.find((q) => q.id === t.order);
      return o && t.phase === 'work' ? clamp(o.progress) : null;
    }
    case 'research':
      return t.topic ? clamp(s.research.progress[t.topic] ?? 0) : null;
    case 'farm':
      return b?.crop ? clamp(b.crop.work ?? 0) : null;
    case 'gather':
    case 'tend':
      return clamp(t.progress);
    case 'mine':
      return clamp(t.work);
    default:
      return null;
  }
}

/** Someone's story: a ready-made founder's own, else put together for them (data/backstories.ts). */
function storyOf(s: GameState, p: Person): string {
  const special = specialStory(p);
  if (special) return special;
  const own = p.fcls ? FOUNDER_BY_ID[p.fcls]?.story : undefined;
  if (own) return own;
  const parents = (p.parents ?? []).map((id) => s.people.find((q) => q.id === id)?.name).filter((n): n is string => !!n);
  return backstory({
    id: p.id,
    name: p.name,
    type: p.type,
    people: peopleOf(s, p),
    ambition: p.bornTick == null ? (p.ambition ?? null) : null,
    born: p.bornTick != null || p.parents?.length ? { town: originOf(s).town, parents } : undefined,
  });
}

/** What a spell or fighting skill does, in a line, by its name (the fight banner's third line). */
let ACT_TEXT: Map<string, string> | null = null;
function actText(name: string): string {
  if (!ACT_TEXT) {
    ACT_TEXT = new Map();
    for (const sp of SPELLS) if (!ACT_TEXT.has(sp.name)) ACT_TEXT.set(sp.name, describeAct(sp.effects).split('. ')[0].replace(/\.$/, ''));
    for (const a of ABILITIES) if (a.active && !ACT_TEXT.has(a.name)) ACT_TEXT.set(a.name, describeAct(a.active.effects).split('. ')[0].replace(/\.$/, ''));
  }
  return ACT_TEXT.get(name) ?? '';
}

/** A road as the evolution card tells it: its role, its lore and its signature skill. */
export function roadOf(id: string): RoadView | null {
  const n = PATH_BY_ID[id];
  if (!n) return null;
  const a = PATH_ABILITIES.find((x) => x.path === id);
  const skill = a ? { name: a.name, text: a.active ? describeAct(a.active.effects, a.active.cooldown) : describePassive(a.passive!) } : null;
  return { id, name: n.name, role: ROLE_ABOUT[CLASS_DEFS[n.cls].role].name, text: n.text, lore: loreOf(id, n.name, n.from ? PATH_BY_ID[n.from]?.name : undefined), skill };
}

/** Where someone stands on their road, and what's open next (null for a founder or anyone without one). */
function roadView(s: GameState, p: Person): PersonView['road'] {
  const node = p.road ? PATH_BY_ID[p.road] : undefined;
  if (!node) return null;
  const next = node.stage >= 4 ? [] : branchesOf(node.id).map((n) => ({ id: n.id, name: n.name, text: n.text, lore: loreOf(n.id, n.name, node.name) }));
  const prompt = s.prompts.find((q) => q.kind === 'evolve' && q.who === p.id);
  return { name: node.name, text: node.text, next, at: node.stage >= 4 ? null : STAGE_LEVELS[node.stage + 1], promptId: prompt?.id ?? null };
}

/** Someone's fighting stats and kit, worked out again only when what they depend on changes. */
const fightCache = new Map<number, { key: string; view: Pick<PersonView, 'battle' | 'kit' | 'passives'> }>();
function fightView(p: Person): Pick<PersonView, 'battle' | 'kit' | 'passives'> {
  const key = JSON.stringify([p.cls, p.road, p.attrPts, levelOf(p), p.gear, p.gearQ, p.skills.melee.level, p.skills.ranged.level, p.skills.social.level, p.traits, p.monster, Math.round(p.hp)]);
  const hit = fightCache.get(p.id);
  if (hit?.key === key) return hit.view;
  if (fightCache.size > 500) fightCache.clear();
  const f = personFighter(p, 'fighter', 'front');
  const kit = kitOf(p);
  const view = {
    battle: { damage: f.damage, accuracy: f.accuracy, dodge: f.dodge, armor: f.armor, block: f.block, crit: f.quirks?.crit ?? 0, ranged: f.ranged, attrs: f.attrs!, mp: f.maxMp ?? 0, sp: f.maxSp ?? 0, interval: f.interval, range: weaponRange(p, ranged(p)) },
    kit: (kit?.actions ?? []).map((a) => ({ name: a.name, spell: a.spell, level: a.level, cost: a.cost, pool: a.pool, text: describeAct(a.effects, a.cooldown / TICK_HZ, a.pool === 'limit') })),
    passives: p.cls ? abilitiesKnown(p.cls, levelOf(p), p.road).filter((a) => a.passive).map((a) => ({ name: a.name, level: a.level, text: describePassive(a.passive!) })) : [],
  };
  fightCache.set(p.id, { key, view });
  return view;
}

/** The job someone holds: the role's title and the building's name. */
function jobView(s: GameState, p: Person): { title: string; at: string } | null {
  if (p.guard) return { title: 'Guard', at: 'the town' };
  const b = s.buildings.find((q) => q.operator === p.id && q.status === 'done' && !!OPERATORS[q.def]);
  return b ? { title: OPERATORS[b.def].title, at: BUILDING_BY_ID[b.def].name } : null;
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
  return { id: o.id, item: o.item, count: o.count, progress: o.progress, needed, waiting, crafter: crafter?.name ?? null, made: o.made, station: def ? (stationFor(s, def)?.id ?? null) : null };
}

function expeditionView(s: GameState, e: Expedition): ExpeditionView {
  const d = destinationOf(s, e.dest)!;
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
    ...(e.leader != null ? { leader: s.people.find((p) => p.id === e.leader)?.name } : {}),
    ...(bountyOn(s, e.dest) ? { bounty: bountyOn(s, e.dest) } : {}),
    scenery: d.scenery,
    phase: e.phase,
    phaseProgress: v && e.phase === 'work' ? Math.min(1, down) : Math.min(1, e.elapsed / Math.max(1, len)),
    secondsLeft: Math.max(0, left) / TICK_HZ,
    members: e.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p).map((p) => ({ id: p.id, name: p.name, look: p.look, gear: { ...p.gear } })),
    horses: (e.horses ?? []).map((h) => h.coat),
    truck: !!e.truck,
    ...((b) => (b ? { boat: { kind: b.kind, name: b.name, hull: Math.max(0, b.hull), max: BOAT_BY_KIND[b.kind].hull } } : {}))(fleet(s).find((b) => b.id === e.boat)),
    ...(e.wrecked ? { wrecked: true } : {}),
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
          mp: f.mp ?? null,
          maxMp: f.maxMp ?? null,
          sp: f.sp ?? null,
          maxSp: f.maxSp ?? null,
          limit: f.limit ?? null,
          statuses: Object.entries(f.st ?? {}).filter(([, v]) => v!.until > e.battle!.tick).map(([k]) => k),
          clsName: f.side === 'party' ? ((q) => (q ? callingName(q, stageOf(q)) : null))(s.people.find((p) => p.id === f.ref)) : null,
          cls: f.side === 'party' ? (s.people.find((p) => p.id === f.ref)?.cls ?? null) : null,
          wolf: f.side === 'party' && s.people.find((p) => p.id === f.ref)?.monster === 'werewolf',
          beast: f.side === 'party' ? ((q) => (q ? beastForm(q) : null))(s.people.find((p) => p.id === f.ref)) : null,
          undead: f.side === 'party' && s.people.find((p) => p.id === f.ref)?.monster === 'undead',
          level: f.side === 'party' ? (s.people.find((p) => p.id === f.ref)?.level ?? 1) : null,
          pop: f.pop ? { age: e.battle!.tick - f.pop.tick, amount: f.pop.amount, heal: f.pop.heal } : null,
          conjured: !!f.conjured,
          elite: f.elite ?? null,
        }))
      : null,
    acts: (e.battle?.acts ?? []).map((a) => ({
      age: e.battle!.tick - a.tick,
      side: a.side,
      ref: a.ref,
      name: a.name,
      targets: a.targets,
      spell: !!a.meta?.spell,
      ult: !!a.meta?.ult,
      cost: a.meta?.cost ?? 0,
      pool: a.meta?.pool ?? null,
      who: e.battle!.fighters.find((f) => f.side === a.side && f.ref === a.ref)?.name ?? '',
      text: a.meta?.pool ? actText(a.name) : '',
    })),
    waiting: e.prompt !== null,
    hunt: !!e.hunt,
    result: e.result && s.tick - e.result.tick < RESULT_TICKS ? { ...e.result, age: s.tick - e.result.tick } : null,
    assault: e.assault ? { wave: e.battle?.wave ?? e.assault.wave, total: e.assault.total, target: e.assault.target } : null,
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
    speed: ((main ? skillSpeed(main.skills.research.level) : 1) * station.mult * mods.researchSpeed) / (RESEARCH_MULTIPLIER[s.era] * RESEARCH_PACE[s.era]),
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
      if (p.morale < SULK_MORALE) return 'Sulking (morale too low to work)';
      if (task.pastime === 'rounds') return 'Going the rounds of the sick households';
      // (water from the well: sim/pastimes.ts)
      if (task.pastime === 'well') return task.type === 'idle' ? 'Drawing water at the well' : 'Off to the well for water';
      if (task.pastime === 'carry') return 'Carrying water home';
      return 'Idling at camp';
    case 'gather': {
      if (task.scrounge) return 'Hungry: picking wild berries (nothing in storage)';
      const c = cellAt(s.land, task.tile);
      const t = TERRAIN[groundAt(s.land, c.x, c.y) as keyof typeof TERRAIN];
      return t ? `${t.verb} (${t.name.toLowerCase()})` : 'Idle';
    }
    case 'store':
      return `Hauling to the ${name(task.building).toLowerCase()}`;
    case 'fetch':
      return `Fetching materials for the ${name(task.building)}`;
    case 'deliver':
      return `Carrying materials to the ${name(task.building)}`;
    case 'build':
      return `Building the ${name(task.building)}`;
    case 'light': {
      const t = s.torches?.find((q) => q.id === task.torch);
      return t?.room !== undefined ? 'Filling a sconce with fuel' : `Tending the ${lightsView(s)?.kind ?? 'lamp'}s`;
    }
    case 'pave':
      return wet(groundAt(s.land, task.cell % s.land.w, Math.floor(task.cell / s.land.w))) ? 'Building a bridge' : 'Laying a street';
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
    case 'toil':
      return s.busy?.text ?? 'Hard at work for the town';
    case 'protest':
      return 'On strike before the seat';
    case 'lesson':
      return task.building == null ? 'At lessons round the fire with the elders' : `At lessons at the ${name(task.building).toLowerCase()}`;
    case 'apprentice': {
      const m = s.people.find((q) => q.id === task.master);
      return `Learning ${p.trade ?? 'a trade'} at ${m?.name ?? 'their master'}'s side`;
    }
    case 'attend': {
      // (on the way there in its procession: sim/ceremonies.ts)
      const g = s.gathering;
      if (g && processing(g, s.tick)) return g.kind === 'rite' ? 'Walking to the temple with the faithful' : g.kind === 'wedding' ? 'In the wedding party, on the way to the feast' : g.ids.slice(0, 2).includes(p.id) ? 'Carrying the coffin to the graveyard' : 'Following the coffin to the graveyard';
      return g?.text ?? 'With the town';
    }
    case 'drink':
      return s.nightOut ? `Letting off steam at the ${name(s.nightOut.tavern).toLowerCase()}` : 'Out for a drink';
    case 'relax': {
      const b = s.buildings.find((x) => x.id === task.building);
      return (b && LEISURE[b.def]?.doing) ?? 'Taking a break';
    }
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
    if (f) return { name: f.name, hp: f.hp, maxHp: f.maxHp, enraged: !!f.enraged, where: atPlace(destinationOf(s, e.dest)?.name ?? 'expedition') };
  }
  return null;
}
/* ------------------------------------------------------------ the hall of heroes */

export interface FamousView {
  id: number;
  name: string;
  calling: string | null;
  level: number;
  felled: number;
  trips: number;
  titles: string[];
  founder: boolean;
}
export interface AnnalsView {
  fallen: Fallen[];
  chronicles: Chronicle[];
  famous: FamousView[];
}
/** Kept in the hall: the fallen and the chronicles shown, and the famous. */
const HALL_FALLEN = 100;
const HALL_CHRONICLES = 12;
const HALL_FAMOUS = 12;
let annalsCache: { key: string; fallen: Fallen[]; chronicles: Chronicle[] } | null = null;

function annalsView(s: GameState): AnnalsView {
  const key = `${s.seed}|${s.fallen?.length ?? 0}|${s.fallen?.at(-1)?.id ?? 0}|${s.chronicles?.length ?? 0}`;
  if (annalsCache?.key !== key) annalsCache = { key, fallen: (s.fallen ?? []).slice(-HALL_FALLEN).reverse(), chronicles: (s.chronicles ?? []).slice(-HALL_CHRONICLES).reverse() };
  // (the famous: deeds, titles and standing, the founder always among them)
  const worth = (p: Person) => (p.felled ?? 0) * 3 + (p.titles?.length ?? 0) * 15 + (p.trips ?? 0) * 2 + levelOf(p) + (p.id === s.mainId ? 1000 : 0);
  const famous = s.people
    .filter((p) => p.type !== 'child' && worth(p) > 4)
    .sort((a, b) => worth(b) - worth(a))
    .slice(0, HALL_FAMOUS)
    .map((p) => ({ id: p.id, name: p.name, calling: callingName(p, stageOf(p)), level: levelOf(p), felled: p.felled ?? 0, trips: p.trips ?? 0, titles: [...(p.titles ?? [])], founder: p.id === s.mainId }));
  return { fallen: annalsCache.fallen, chronicles: annalsCache.chronicles, famous };
}
