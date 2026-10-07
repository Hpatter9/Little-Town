// The town runs itself (the "ant farm"): every quarter of a game hour it looks at what it needs and decides what
// to research, what to craft, what to build (and where), and which land to gather from. The player doesn't place
// buildings or pick research any more; they set the town's direction and send out expeditions. What it decided,
// and why, is kept in `s.plan` for the panels to show.

import { PRISON_BUILDINGS, SICKBEDS } from '../data/prisons';
import { needsSickbed, sickbedsOf } from './sickbeds';
import { cellsOf } from './prisoners';
import { bloodTown } from './vampires';
import { BOAT_TOPICS } from '../data/boats';
import { COMPONENTS, FORGED_IDS } from '../data/hunts';
import { prostheticsWanted } from './injuries';
import { PROSTHETIC_BY_ITEM } from '../data/injuries';
import { venuePurse } from './ambition';
import { LINES, LINE_STOCK, SHOP_LINES, STORE_PEOPLE } from '../data/stores';
import { eraOfResearch } from '../data/research';
import { ERAS } from '../data/eras';
import { hashSeed, Rng } from '../rng';
import { treasuresHeld } from './shop';
import { rulesOf } from '../data/origins';
import { canWear } from './classes';
import { isChild } from './social';
import { buildOrigin } from './nomads';
import { isRingPiece, planRing, RING_PEOPLE } from './ringWall';
import { inSea, seaBuild, seaTown } from './sea';
import { castleCells, castleOn, holdOf, joinsCastle, nearCastle, roomKind, sharedEdges, solidCells } from './castle';
import { BUILDINGS, BUILDING_BY_ID, UPGRADES, type BuildingDef } from '../data/buildings';
import { isSeat, seatOf } from '../data/seats';
import { CROPS, WORKPLACES } from '../data/crops';
import { ORES } from '../data/minerals';
import { mines } from './places';
import { HERDS } from '../data/livestock';
import { growPen, herdOf, stockPen } from './livestock';
import { WORTH } from '../data/trade';
import { ITEMS, ITEM_BY_ID, MAX_POTS, type ItemDef } from '../data/items';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock , SEA_MATERIALS } from '../data/materials';
import { FOOD_VALUE } from '../data/people';
import { RESEARCH_STATIONS, TOPICS, type Topic } from '../data/research';
import { TERRAIN } from '../data/terrain';
import { blueprintCount, buildSlots, canPlace, canUpgrade, demolish, depthOf, footprints, isUnlocked, placeBlueprint, stillNeeded, storages, totalCapacity, totalStock, townRadius, unlockInfo, upgrade, inWork } from './buildings';
import { type Pt, cellAt, delveDepth, delvePool, doorOf, groundAt, idx, inMap, isMarked, isOpen, roadDistance, setMarked, spiralSpot } from './land';
import { craftNeeded, craftSlots, itemUnlocked, queueCraft, reduceCraft, stationFor } from './crafting';
import { canQueue, modifiers, queueResearch } from './research';
import { acceptVisitor, housingCapacity } from './townsfolk';
import { eatersOf, foodDaysFor, addStock, campCell, poolSize, type Building, type GameState } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { LINE_ITEMS, lineOfDef, COIN_RESERVE, FARE, PIECE_RATE, saleValue, FARE_STOCK, furnishes, isShop, isTavern, PURSE_SCALE, tiersDrawn, travellerGoods, VENUE_CHAIN, venueOfDef, WARE_STOCK, WARES } from '../data/shop';
import { WAGE_SHARE, wageBill } from './wages';
import { attractiveness, decorPrice, redecorate, extend, extensionPrice, furnishValue, improve, levelPrice, SALE_GEAR, shopOf, spotFor, storeOf, tavernOf, venueKind, wouldFurnish } from './shop';
import { gearScore } from './crafting';

/* ------------------------------------------------------------ the town's direction */

export type Direction = 'growth' | 'defense' | 'trade' | 'knowledge';
export const DIRECTIONS: readonly Direction[] = ['growth', 'defense', 'trade', 'knowledge'];
export const DIRECTION_DEFS: Record<Direction, { name: string; description: string; branches: readonly string[] }> = {
  growth: { name: 'Growth', description: 'More people: homes, food and building come first.', branches: ['construction', 'agriculture', 'society'] },
  defense: { name: 'Defence', description: 'Walls, towers and weapons before anything else.', branches: ['military', 'medicine'] },
  trade: { name: 'Trade', description: 'Workshops, crafts and the market: make things and sell them.', branches: ['crafting', 'logistics'] },
  knowledge: { name: 'Knowledge', description: 'Research first: stations, schools and books.', branches: ['society', 'medicine', 'logistics'] },
};
export const directionOf = (s: GameState): Direction => s.direction ?? 'growth';

/** How often the town takes stock and decides (game ticks). */
export const PLAN_TICKS = TICKS_PER_HOUR / 4;
/** New homes at most this often (game ticks), once there are a few people. */
const HOME_EVERY = 12 * TICKS_PER_HOUR;
/** Most wild tiles marked for gathering at once: this many plus one per person. */
const BASE_MARKED = 2;

export interface TownPlan {
  /** What it last decided to build, and why. */
  build: { def: string; why: string } | null;
  /** What it's researching next, and why. */
  research: { id: string; why: string } | null;
  /** What it's gathering for (material names). */
  gathering: string[];
  /** What it can't do yet, for the panels (e.g. "No room to build: clearing land"). */
  waiting: string[];
  /** When it last started a home (the town grows a home at a time). */
  lastHome?: number;
  /** Beds the last new home added (the next waits longer after a big one). */
  lastHomeBeds?: number;
  /** Blueprints shelved for want of what nobody could get (see shelveStalled): the kind, and when; not tried again
   *  for a while. And the last time each blueprint moved (its deliveries or building), by id. */
  shelved?: Record<string, number>;
  moved?: Record<number, { tick: number; sig: string }>;
}

/** A blueprint that hasn't moved for this long, waiting on something the town has none of, is shelved (its slot is
 *  wanted for something that can be built), and its kind isn't tried again for SHELF_HOURS. */
export const STALL_HOURS = 12;
export /** One defence piece for every this many grown-ups, besides what a raid or the Defence direction asks. */
const DEFENSE_PER_PEOPLE = 8;
const SHELF_HOURS = 24;

/* ------------------------------------------------------------ what the town needs */

interface Needs {
  people: number;
  /** A shore town (the sea its doorstep): boats come first there. */
  shore: boolean;
  /** Someone is missing a part (a prosthetic wanted), or someone is wounded. */
  limbless: boolean;
  wounded: boolean;
  freeBeds: number;
  /** How many eat (the dead and machines don't). */
  eaters: number;
  /** Days the food in store lasts those who eat (plenty, `NO_EATERS_DAYS`, when nobody does). */
  foodDays: number;
  storageFill: number;
  stock: Stock;
  /** Materials wanted: what blueprints and craft orders still need, plus a small reserve. */
  demand: Stock;
  raided: boolean;
  direction: Direction;
  /** Materials the town wants but can't gather, grow or make: only travellers can sell it them. */
  unsourced: Material[];
  /** Customer tiers the shop draws that the town can't make a single ware for yet (their research is wanted). */
  wareGaps: number[];
}

/** A small stock the town likes to keep of each basic material it can get (so building never waits long). */
const RESERVE: Partial<Record<Material, number>> = { wood: 20, stone: 12, fiber: 8, lumber: 12, bricks: 10, cloth: 4, iron: 4, gold: 0, gems: 0, pearls: 0, copper_ore: 6, tin_ore: 3, silver_ore: 0, sulphur: 0, copper: 6, bronze: 6, silver: 3 };

function needs(s: GameState): Needs {
  const stock = totalStock(s);
  const food = (Object.entries(FOOD_VALUE) as [Material, number][]).reduce((n, [m, v]) => n + (stock[m] ?? 0) * v, 0);
  const demand: Stock = {};
  const want = (m: Material, n: number) => (demand[m] = (demand[m] ?? 0) + n);
  for (const b of s.buildings) if (inWork(b)) for (const [m, n] of Object.entries(stillNeeded(b)) as [Material, number][]) want(m, n);
  for (const o of s.crafting) for (const [m, n] of Object.entries(craftNeeded(o)) as [Material, number][]) want(m, n * o.count);
  for (const [m, n] of Object.entries(RESERVE) as [Material, number][]) if (sourceable(s, m)) want(m, n);
  const used = MATERIALS.reduce((n, m) => n + (stock[m] ?? 0), 0);
  // (homes already started count: they're beds on the way)
  const coming = s.buildings.filter((b) => b.status === 'blueprint').reduce((k, b) => k + (BUILDING_BY_ID[b.def]?.housing ?? 0), 0);
  // (the basics every town builds with, and whatever a blueprint is waiting on)
  const wanted = new Set<Material>(['wood', 'stone', 'fiber']);
  for (const b of s.buildings) if (inWork(b)) for (const m of Object.keys(stillNeeded(b)) as Material[]) wanted.add(m);
  const shop = shopOf(s);
  const drawn = shop ? tiersDrawn(attractiveness(s, shop)).map((c) => c.tier) : [];
  return {
    wareGaps: drawn.filter((t) => t > 1 && !WARES.some((w) => w.ware!.tier === t && itemUnlocked(s, w))),
    unsourced: [...wanted].filter((m) => m !== 'totem' && !sourceable(s, m, 0, false)),
    people: s.people.length,
    freeBeds: housingCapacity(s) + coming - s.people.length,
    eaters: eatersOf(s),
    foodDays: foodDaysFor(s, food),
    storageFill: used / Math.max(1, totalCapacity(s)),
    stock,
    demand,
    raided: s.journal.some((j) => j.text.startsWith('Raid by')),
    limbless: prostheticsWanted(s).length > 0,
    shore: seaTown(s),
    wounded: s.people.some((p) => (p.wounds?.length ?? 0) > 0),
    direction: directionOf(s),
  };
}

/* ------------------------------------------------------------ where materials come from */

const GATHERABLE = new Set<Material>([...Object.values(TERRAIN).flatMap((t) => Object.keys(t.pool) as Material[]), ...SEA_MATERIALS, ...ORES]);
/** How much a shore town would rather build in the sea than on the land (a ring's spots are scored by this). */
const SEA_PREFER = 20;
/** A shore town fishes when food is short, and keeps this many pearls coming (the shop sells them). */
const PEARLS_WANT = 6;
const RECIPES_FOR = (m: Material) => ITEMS.filter((i) => i.makes && (i.makes as Stock)[m]);

const unlocked = (s: GameState, id: string) => !!BUILDING_BY_ID[id] && isUnlocked(unlockInfo(s), BUILDING_BY_ID[id]);
/** A kind and everything it can be rebuilt into (garden plot, open field, estate farm). */
const chainOf = (id: string): string[] => {
  const out = [id];
  for (let c = id; UPGRADES[c] && !out.includes(UPGRADES[c]); c = UPGRADES[c]) out.push(UPGRADES[c]);
  return out;
};
/** Whether the town has one (or what one was rebuilt into). */
const planned = (s: GameState, id: string) => s.buildings.some((b) => chainOf(id).includes(b.def));

/** Whether the town has a way to get a material: from the land, a field, a mine, or a recipe it can make (its
 *  station built or at least unlocked, and the recipe's own inputs obtainable), or (unless `buy` is off) from the
 *  travellers who stop at its shop. */
function sourceable(s: GameState, m: Material, depth = 0, buy = true): boolean {
  if (depth > 3) return false;
  if (buy && buyable(s, m)) return true;
  if (GATHERABLE.has(m) && wildHolds(s, m)) return true;
  for (const [id, c] of Object.entries(CROPS)) if (c.material === m && unlocked(s, id)) return true;
  for (const [id, w] of Object.entries(WORKPLACES)) if ((w.outputs as Stock)[m] && unlocked(s, id)) return true;
  for (const [id, h] of Object.entries(HERDS)) if ((h.yields[m] || (h.forMeat && h.cull[m])) && unlocked(s, id)) return true;
  return RECIPES_FOR(m).some((r) => itemUnlocked(s, r) && unlocked(s, r.station) && (Object.keys(r.cost) as Material[]).every((i) => sourceable(s, i, depth + 1, buy)));
}

/** Travellers sell it, and the town has a shop for them to stop at. */
const buyable = (s: GameState, m: Material) => !!shopOf(s) && travellerGoods(s.era).includes(m);

/** Whether every material a building costs can be had (the totem only if it's already in store). */
function affordable(s: GameState, def: BuildingDef, stock: Stock): boolean {
  // (a home is wanted now: not one waiting on what a passing trader might sell, while another the town can make from
  // its own land would do)
  const buy = !def.housing || !BUILDINGS.some((h) => h.housing && h !== def && unlocked(s, h.id) && gettable(s, h, stock, false));
  return gettable(s, def, stock, buy);
}

/** Whether every material a building costs is in store or can be had (bought from travellers too, with `buy`). */
function gettable(s: GameState, def: BuildingDef, stock: Stock, buy: boolean): boolean {
  return (Object.entries(def.cost) as [Material, number][]).every(([m, n]) => (stock[m] ?? 0) >= n || (m !== 'totem' && sourceable(s, m, 0, buy)));
}

/* ------------------------------------------------------------ research */

const BRANCH_OF = (t: Topic) => t.branch as string;

/** Whether the town could build it from what it can get (nothing it has no source for). */
const canMake = (d: BuildingDef, n: Needs) => !(Object.keys(d.cost) as Material[]).some((m) => n.unsourced.includes(m));

function topicScore(t: Topic, n: Needs): number {
  let score = 60 / Math.sqrt(t.seconds); // quicker topics first, all else equal
  for (const b of BUILDINGS.filter((d) => d.research === t.id)) {
    score += 4;
    if (b.housing && n.freeBeds <= 1 && canMake(b, n)) score += 30;
    if (CROPS[b.id] && CROPS[b.id].material !== 'fiber' && n.foodDays < 5) score += 25;
    // (a new kind of crop is worth having anyway: a mix of fields shrugs off blight)
    if (CROPS[b.id] && FOOD_VALUE[CROPS[b.id].material]) score += 12;
    if (b.storage && n.storageFill > 0.6) score += 15;
    if (RESEARCH_STATIONS[b.id]) score += 15;
    if (WORKPLACES[b.id]) score += 10;
    if (b.healing) score += 8;
    if (b.hp || b.defense) score += n.raided || n.direction === 'defense' ? 14 : 2;
    // (a wall round the town once it is big enough to wall: sim/ringWall.ts; a shop to sell its surplus once it has
    // hands to spare: the two come about together, the shop first)
    if (b.hp && !b.defense && n.people >= RING_PEOPLE) score += 8;
    if (isShop(b.id) && n.people >= 8) score += 15;
    if (b.stalls || b.id === 'tavern') score += n.direction === 'trade' ? 12 : 3;
    // (a shop is the only way to get what the land doesn't give: without it the town can't build at all)
    if (isShop(b.id)) score += (n.unsourced.length ? 60 : 0) + (n.direction === 'trade' ? 12 : 3);
    if (isTavern(b.id)) score += n.direction === 'trade' ? 12 : 3;
  }
  // (wares for the grand customers the shop draws, which it has nothing to sell yet)
  if (ITEMS.some((i) => i.ware && n.wareGaps.includes(i.ware.tier) && i.research.includes(t.id))) score += n.direction === 'trade' ? 30 : 15;
  // (the armoury's weapons count for little: nearly every topic opens one, and they'd drown out the rest)
  const items = ITEMS.filter((i) => i.research.includes(t.id) && !i.family).length;
  const arms = ITEMS.filter((i) => i.research.includes(t.id) && i.family).length;
  score += Math.min(12, items * 3) + Math.min(3, arms) * (n.raided || n.direction === 'defense' ? 2 : 0);
  for (const e of t.effects) {
    if (e.type === 'eraCapstone') score += 30;
    else if (e.type === 'researchSpeed' || e.type === 'researchSlots') score += n.direction === 'knowledge' ? 18 : 8;
    else if (e.type === 'storage') score += n.storageFill > 0.6 ? 15 : 4;
    else if (e.type === 'rule' && (e.rule === 'fight' || e.rule === 'guard')) score += n.raided || n.direction === 'defense' ? 14 : 4;
    else if (e.type === 'rule' && (e.rule === 'travellers' || e.rule === 'prices')) score += n.direction === 'trade' ? 14 : 4;
    else if (e.type === 'rule' || e.type === 'quality' || e.type === 'powers') score += 8;
    else score += 6;
  }
  // (children are how a town grows now that newcomers are few: it learns family life once there are a few of it)
  if (t.id === 'family_life') score += n.people >= 4 ? 40 : 10;
  // (boats: fishing when food runs short, islands and the sea's markets once the town is a few strong: data/boats.ts)
  if (t.id === 'monster_lore') score += n.people >= 5 ? 20 : 4; // (the Monster Hunters' Guild: hunts for a purse, and gear from the parts)
  if (BOAT_TOPICS.some((b) => b.id === t.id)) score += (n.people >= 4 ? 24 : 6) + (t.id === 'boatbuilding' && n.shore ? 16 : 0) + (n.foodDays < 5 && t.id === 'boatbuilding' ? 12 : 0) + (n.direction === 'trade' && (t.id === 'navigation' || t.id === 'steamships') ? 10 : 0);
  // (someone has lost a limb or an eye: learn to make them good)
  if ((t.id === 'peg_and_hook' || t.id === 'prosthetics' || t.id === 'bionics') && n.limbless) score += 30;
  // (the town has been bleeding: learn to tend the hurt)
  if (t.effects.some((e) => e.type === 'care') && n.wounded) score += 6;
  if (DIRECTION_DEFS[n.direction].branches.includes(BRANCH_OF(t))) score *= 1.6;
  if (t.branch === 'heritage') score *= 1.25; // (what the town's people are good at, they like to study)
  if (t.branch === 'occult') score *= 0.35; // (the town dabbles, but it's not what it's for)
  return score;
}

function whyTopic(t: Topic, n: Needs): string {
  const unlocks = BUILDINGS.filter((d) => d.research === t.id);
  if (unlocks.some((b) => b.housing && canMake(b, n)) && n.freeBeds <= 1) return 'the town needs more beds';
  if (unlocks.some((b) => CROPS[b.id] && CROPS[b.id].material !== 'fiber') && n.foodDays < 5) return 'food is running short';
  if (unlocks.some((b) => isShop(b.id)) && n.unsourced.length) return `it can't get ${names(n.unsourced)} any other way`;
  if (ITEMS.some((i) => i.ware && n.wareGaps.includes(i.ware.tier) && i.research.includes(t.id))) return 'the shop\'s grander customers want finer wares';
  if (t.effects.some((e) => e.type === 'eraCapstone')) return 'it leads to the next era';
  if (DIRECTION_DEFS[n.direction].branches.includes(BRANCH_OF(t))) return `the town is set on ${DIRECTION_DEFS[n.direction].name.toLowerCase()}`;
  return 'it opens new things to build and make';
}

/** People a town needs before it studies refinements (topics that only make it better at what it does). */
const REFINE_AT = 4;
/** How much of a wanted topic's worth the one topic it still waits on inherits. */
const LEADS_SHARE = 0.85;

function planResearch(s: GameState, n: Needs, plan: TownPlan): void {
  const slots = modifiers(s.research).researchSlots;
  while (s.research.queue.length < slots) {
    let best: Topic | null = null;
    let bestScore = -Infinity;
    // (a topic that stands in the way of a wanted one counts most of that one's worth: Fire Keeping opens nothing
    // itself, but Barter and the shop wait on it, and a desert town once studied round it for weeks)
    const done = new Set(s.research.done);
    const leads = new Map<string, number>();
    for (const t of TOPICS) {
      if (done.has(t.id) || (t.origin && t.origin !== s.origin) || ERAS.indexOf(eraOfResearch(t.id)) > ERAS.indexOf(s.era)) continue;
      const open = t.prereqs.filter((q) => !done.has(q));
      if (open.length !== 1) continue;
      leads.set(open[0], Math.max(leads.get(open[0]) ?? 0, topicScore(t, n) * LEADS_SHARE));
    }
    for (const t of TOPICS) {
      // (refinements wait until the town is a few people strong: its first days go on shelter and food)
      if (t.refinement && n.people < REFINE_AT) continue;
      if (!canQueue(s.research, t.id, s.era, s.origin).ok) continue;
      const sc = Math.max(topicScore(t, n), leads.get(t.id) ?? 0);
      if (sc > bestScore) {
        best = t;
        bestScore = sc;
      }
    }
    if (!best) break;
    queueResearch(s.research, best.id, s.era, s.origin);
  }
  const head = s.research.queue[0];
  const t = head ? TOPICS.find((q) => q.id === head) : undefined;
  plan.research = t ? { id: t.id, why: whyTopic(t, n) } : null;
}

/* ------------------------------------------------------------ crafting */

const toolPower = (i: ItemDef) => Math.max(0, ...Object.values(i.effects.gather ?? {}), i.effects.construct ?? 0);
const kept = (s: GameState, pred: (i: ItemDef) => boolean) =>
  ITEMS.filter(pred).reduce((n, i) => n + (s.items[i.id] ?? 0), 0) + s.people.reduce((n, p) => n + Object.values(p.gear).filter((id) => id && pred(ITEM_BY_ID[id])).length, 0);
const ordered = (s: GameState, pred: (i: ItemDef) => boolean) => s.crafting.filter((o) => pred(ITEM_BY_ID[o.item])).reduce((n, o) => n + o.count, 0);

/** Whether the town has the makings of one piece right now: its materials in store, and any items it's made from. */
function inputsReady(s: GameState, i: ItemDef, stock: Stock): boolean {
  return (Object.entries(i.cost) as [Material, number][]).every(([m, k]) => (stock[m] ?? 0) >= k) && Object.entries(i.items ?? {}).every(([id, k]) => (s.items[id] ?? 0) >= k);
}

/** The best thing of a kind the town can make at all (unlocked, its station built, anything it's made from in hand). */
function bestMakeable(s: GameState, pred: (i: ItemDef) => boolean, power: (i: ItemDef) => number): ItemDef | undefined {
  return ITEMS.filter((i) => pred(i) && !i.research.includes('__relic') && !i.unique && itemUnlocked(s, i) && stationFor(s, i) && Object.entries(i.items ?? {}).every(([id, k]) => (s.items[id] ?? 0) >= k))
    .sort((a, b) => power(b) - power(a))[0];
}

/** The share of the town's grown-ups whose class lets them use a piece (none: it isn't worth making). */
function wielders(s: GameState, i: ItemDef): number {
  const grown = s.people.filter((p) => !isChild(p));
  return grown.length ? grown.filter((p) => canWear(p, i)).length / grown.length : 1;
}

/** How much the town wants a weapon: what it does (damage, aim, quickness, its quirks), less for each one of its family
 *  the town already has, so its fighters carry a mix (axes and spears, bows and crossbows) rather than all one kind. */
function weaponWorth(s: GameState, i: ItemDef): number {
  const e = i.effects;
  const quirks = (e.crit ?? 0) * 8 + (e.pierce ?? 0) * 3 + (e.cleave ?? 0) * 4 + (e.stun ?? 0) * 6 + (e.reach ? 1 : 0) + ((e.beastDamage ?? 0) + (e.undeadDamage ?? 0) + (e.machineDamage ?? 0)) * 0.2;
  const owned = [...Object.keys(s.items), ...s.people.map((p) => p.gear.weapon ?? '')].filter((id) => id && ITEM_BY_ID[id]?.family === i.family).length;
  return ((e.damage ?? 0) / (e.speed ?? 1) + (e.accuracy ?? 0) * 20 + quirks) * (i.family ? 0.85 ** owned : 1);
}

/** Decide what to make. Returns the materials it wanted but lacked (so they can be gathered). Nothing is queued
 *  until its makings are in store, so an order never sits blocking the queue. */
function planCrafting(s: GameState, n: Needs): Stock {
  const want: Stock = {};
  const lack = (i: ItemDef) => {
    for (const [m, k] of Object.entries(i.cost) as [Material, number][]) if ((n.stock[m] ?? 0) < k) want[m] = Math.max(want[m] ?? 0, k);
  };
  const tryMake = (i: ItemDef | undefined) => {
    if (!i) return;
    if (inputsReady(s, i, n.stock)) queueCraft(s, i.id);
    else lack(i);
  };
  // orders that can't go on (their makings are gone and can't be got) are dropped
  for (const o of [...s.crafting]) {
    const def = ITEM_BY_ID[o.item];
    const stuck = (!o.itemsTaken && Object.entries(def.items ?? {}).some(([id, k]) => (s.items[id] ?? 0) < k)) || (Object.keys(craftNeeded(o)) as Material[]).some((m) => (n.stock[m] ?? 0) === 0 && !sourceable(s, m));
    if (stuck) reduceCraft(s, o.id, true);
  }
  const room = () => s.crafting.length < craftSlots(s);
  const adults = s.people.filter((p) => p.bornTick == null).length;

  // 1. materials the town is short of, which a workshop can make (lumber for a cottage, bricks for a bakery...)
  for (const m of MATERIALS) {
    const short = (n.demand[m] ?? 0) - (n.stock[m] ?? 0);
    if (short <= 0) continue;
    // (of the ways to make it, one it has the makings for now: cloth from fiber while there's no wool)
    const ways = RECIPES_FOR(m).filter((i) => itemUnlocked(s, i) && stationFor(s, i));
    const r = ways.find((i) => inputsReady(s, i, n.stock)) ?? ways[0];
    if (!r) continue;
    const per = (r.makes as Stock)[m] ?? 1;
    const have = s.crafting.find((o) => o.item === r.id)?.count ?? 0;
    if (!inputsReady(s, r, n.stock)) lack(r);
    else for (let k = have; k * per < short && k < 2; k++) if (!queueCraft(s, r.id).ok) break;
  }
  if (!room()) return want;

  // 2. a tool for everyone who works
  const isTool = (i: ItemDef) => i.slot === 'tool';
  if (!ordered(s, isTool) && kept(s, isTool) < adults) tryMake(bestMakeable(s, isTool, toolPower));
  // 3. arms and armour once raiders have come (or when the town is set on defence)
  if (n.raided || n.direction === 'defense') {
    for (const slot of ['weapon', 'body', 'head', 'offhand'] as const) {
      if (!room()) return want;
      const is = (i: ItemDef) => i.slot === slot;
      if (ordered(s, is) || kept(s, is) >= adults) continue;
      // (made for the classes the town has: plate for its knights, robes for its mages)
      const worth = slot === 'weapon' ? (i: ItemDef) => weaponWorth(s, i) : (i: ItemDef) => (i.effects.armor ?? 0) * 10 + (i.effects.block ?? 0) * 10 + (i.effects.dodge ?? 0) * 10 + (i.effects.power ?? 0) * 5;
      tryMake(bestMakeable(s, is, (i) => worth(i) * wielders(s, i)));
    }
  }
  // 4. a few bandages or poultices, and pots when the stores are filling up
  const isMedicine = (i: ItemDef) => i.id === 'poultice' || i.id === 'bandage';
  if (room() && !ordered(s, isMedicine) && kept(s, isMedicine) < 3) tryMake(bestMakeable(s, isMedicine, (i) => (i.id === 'bandage' ? 2 : 1)));
  // 4b. a prosthetic for each lost part waiting on one: the best the town can make (the healer fits it: sim/injuries.ts)
  for (const fits of new Set(prostheticsWanted(s))) {
    if (!room()) break;
    const is = (i: ItemDef) => PROSTHETIC_BY_ITEM[i.id]?.fits === fits;
    const best = bestMakeable(s, is, (i) => PROSTHETIC_BY_ITEM[i.id].rank);
    if (best && !ordered(s, (i) => i.id === best.id) && (s.items[best.id] ?? 0) === 0) tryMake(best);
  }
  // (one pot on order at a time: the crafters have other work)
  // Everything made to sell or to dress a venue is made only from what the town has spare (beyond what it needs, a
  // reserve, and several days' food), never from what it can only buy (like a desert's fiber); nothing is gathered for
  // it but what the land gives.
  const spareStock = forSale(s);
  const fromSpare = (w: ItemDef) => (Object.entries(w.cost) as [Material, number][]).every(([m, k]) => (spareStock[m] ?? 0) >= k && !n.unsourced.includes(m)) && inputsReady(s, w, n.stock);
  const gatherFor = (w: ItemDef) => {
    if ((Object.keys(w.cost) as Material[]).every((m) => !n.unsourced.includes(m) && GATHERABLE.has(m))) lack(w);
  };
  /** Of some things worth making, the first that can be made from what's spare (the rest are gathered for). */
  const makeFirst = (options: ItemDef[]) => {
    const ready = options.find(fromSpare);
    for (const w of options) {
      if (w === ready) break;
      gatherFor(w);
    }
    if (ready) queueCraft(s, ready.id);
  };
  const makeable = (i: ItemDef) => itemUnlocked(s, i) && !!stationFor(s, i);
  const settled = n.foodDays >= 2;

  // (whatever's queued below for a venue is a commission: its keeper asks, and the crafter is paid)
  const commission = (venue: Building | undefined, before: Set<number>) => {
    if (!venue) return;
    for (const o of s.crafting) {
      if (before.has(o.id) || o.for) continue;
      const def = ITEM_BY_ID[o.item];
      const worth = saleValue(def, undefined) * (def.fare ? PURSE_SCALE[s.era] : 1);
      o.for = { venue: venueKind(venue), by: venue.operator ?? null, pay: Math.round(def.furnish ? worth : worth * PIECE_RATE) };
    }
  };
  const queued = () => new Set(s.crafting.map((o) => o.id));

  // 5. a furnishing for each venue, one at a time (they start bare): the one that adds the most that would improve it
  // (room for it, or it beats a piece already out), and not yet another of a kind it has plenty of
  const isFurnishing = (i: ItemDef) => !!i.furnish;
  for (const venue of [shopOf(s), tavernOf(s), ...SHOP_LINES.map((l) => storeOf(s, l))]) {
    if (!venue || !room() || !settled) continue;
    const mine = (i: ItemDef) => furnishes(i, venueKind(venue));
    if (ordered(s, (i) => isFurnishing(i) && mine(i)) || kept(s, (i) => isFurnishing(i) && mine(i))) continue;
    // (every piece is bought: only what the town can pay for, keeping back what payday will take, which is never more
    // than a share of the purse, however many there are to pay)
    const purse = (s.coins ?? 0) - Math.min(wageBill(s), (s.coins ?? 0) * WAGE_SHARE);
    const before = queued();
    tryMake(bestMakeable(s, (i) => mine(i) && wouldFurnish(venue, i) && furnishValue(venue, i) >= 1 && saleValue(i, undefined) <= purse, (i) => furnishValue(venue, i)));
    commission(venue, before);
  }
  const shop = shopOf(s);
  // 6. wares to sell, one order at a time: for the grandest customers the shop draws first, whichever of their wares it
  // has least of (a few of each kept in stock)
  const isWare = (i: ItemDef) => !!i.ware;
  if (shop && room() && settled && !ordered(s, isWare)) {
    const before = queued();
    const tiers = tiersDrawn(attractiveness(s, shop)).map((c) => c.tier).reverse();
    makeFirst(tiers.flatMap((tier) => WARES.filter((i) => i.ware!.tier === tier && makeable(i) && (s.items[i.id] ?? 0) < WARE_STOCK).sort((a, b) => (s.items[a.id] ?? 0) - (s.items[b.id] ?? 0))));
    commission(shop, before);
  }
  // 7. gear customers came for and didn't find (the most asked-for first), a couple of each kind kept in stock
  for (const seller of [shop, storeOf(s, 'weapons'), storeOf(s, 'armour')]) {
  if (!seller || !room() || !settled || ordered(s, (i) => SALE_GEAR.includes(i))) continue;
  {
    const before = queued();
    const options: ItemDef[] = [];
    for (const [key] of Object.entries(seller.shop?.asked ?? {}).sort((a, b) => b[1] - a[1])) {
      const [kind, what] = key.split(':');
      const slots = kind === 'gear' ? what.split(',') : kind === 'item' ? [ITEM_BY_ID[what]?.slot] : [];
      if (!slots.length) continue;
      const inStock = SALE_GEAR.filter((i) => slots.includes(i.slot!)).reduce((k, i) => k + (s.items[i.id] ?? 0), 0);
      if (inStock >= 2) continue;
      if (kind === 'item' && ITEM_BY_ID[what] && makeable(ITEM_BY_ID[what])) options.push(ITEM_BY_ID[what]);
      else options.push(...SALE_GEAR.filter((i) => slots.includes(i.slot!) && makeable(i) && !i.items).sort((a, b) => gearScore(b, undefined) - gearScore(a, undefined)));
    }
    makeFirst(options);
    commission(seller, before);
  }
  }
  // 7b. a specialty shop's line kept in stock (a few pieces of it on its shelves: furniture, weapons, armour, medicine),
  // made from what's spare, the finest the town can make first
  for (const line of SHOP_LINES) {
    const store = storeOf(s, line);
    const isLine = (i: ItemDef) => LINE_ITEMS[line].includes(i);
    if (!store || !room() || !settled || ordered(s, isLine)) continue;
    if (LINE_ITEMS[line].reduce((k, i) => k + (s.items[i.id] ?? 0), 0) >= LINE_STOCK) continue;
    const before = queued();
    makeFirst(LINE_ITEMS[line].filter((i) => makeable(i) && !i.items && (s.items[i.id] ?? 0) < 2).sort((a, b) => saleValue(b, undefined) - saleValue(a, undefined)));
    commission(store, before);
  }
  // 8. fare for the tavern, one order at a time: the kind guests asked for most (or have least of), a few of each
  const tavern = tavernOf(s);
  if (tavern && room() && settled && !ordered(s, (i) => !!i.fare)) {
    const before = queued();
    const asked = tavern.shop?.asked ?? {};
    const wanted = (i: ItemDef) => (asked[`dish:${i.id}`] ?? 0) + (asked[`fare:${i.fare!.kind}`] ?? 0);
    const stockOf = (kind: string) => FARE.filter((i) => i.fare!.kind === kind).reduce((k, i) => k + (s.items[i.id] ?? 0), 0);
    makeFirst(
      FARE.filter((i) => makeable(i) && stockOf(i.fare!.kind) < FARE_STOCK)
        .sort((a, b) => wanted(b) - wanted(a) || stockOf(a.fare!.kind) - stockOf(b.fare!.kind) || b.fare!.price - a.fare!.price),
    );
    commission(tavern, before);
  }
  if (room() && n.storageFill > 0.7 && !ordered(s, (i) => i.id === 'clay_pot') && (s.items.clay_pot ?? 0) < MAX_POTS && stationFor(s, ITEM_BY_ID.clay_pot) && itemUnlocked(s, ITEM_BY_ID.clay_pot)) tryMake(ITEM_BY_ID.clay_pot);
  return want;
}

/* ------------------------------------------------------------ building */

/** The era capstones, and the launch at the end: built when the town can. */
/** No ring wall at all under this many grown-ups (the first days go on shelter, food and the shop). */
const RING_MIN_PEOPLE = 4;
const CAPSTONES = ['elder_lodge', 'town_hall', 'power_station', 'mission_control', 'launch_site'];
/** Never built by the planner: tied to hidden choices, or one-off rescue machines the player earns. */
const NEVER = new Set(['wayside_shrine', 'temple', 'cathedral', 'phylactery', 'resurrection_shrine', 'cryo_pod', 'clone_vat', 'palisade_gate', 'stone_gate']);

/** How far beyond the town's reach the land is known (cells), and the furthest it opens on its own (the rest is for the
 *  map's own events to open, later). */
const OPEN_BEYOND = 6;
/** How far the known land may spread from the camp (cells): most of the wide land. */
const OPEN_MAX = 86;

/** The known land grows with the town, and reaches further when what the town needs has run out within it. */
/** How far a town ranges for something it can't find nearer: the old land's reach, and further as it grows (on the
 *  wide land a lone founder once opened it all the way, and walked a day for a log). */
const OPEN_FAR_BASE = 40;
const OPEN_FAR_PER_PERSON = 3;
function openLand(s: GameState, further = false): boolean {
  const grown = s.people.filter((p) => !isChild(p) && p.away === null).length;
  const far = Math.min(OPEN_MAX, OPEN_FAR_BASE + grown * OPEN_FAR_PER_PERSON);
  const want = Math.min(OPEN_MAX, Math.max(s.land.open, townRadius(s) + OPEN_BEYOND, further ? Math.min(Math.max(s.land.open, far), s.land.open + 2) : 0));
  if (want <= s.land.open) return false;
  s.land.open = want;
  s.land.version++;
  return true;
}

/** The wild cells of the open land, with what they hold, nearest the camp first. */
/** The wild cells in the open land, nearest the camp first; kept for the tick (a planning pass asks hundreds of times,
 *  through `sourceable`, and each scan of the whole land's pools was most of a phone's hitch every fifteen seconds).
 *  Callers mustn't change the list. */
let wildCache: { s: GameState; tick: number; version: number; open: number; out: { i: number; pool: Stock; d: number }[] } | null = null;
function wildCells(s: GameState): { i: number; pool: Stock; d: number }[] {
  const w = wildCache;
  if (w && w.s === s && w.tick === s.tick && w.version === s.land.version && w.open === s.land.open) return w.out;
  const out = scanWild(s);
  wildCache = { s, tick: s.tick, version: s.land.version, open: s.land.open, out };
  return out;
}
/** Which gatherable materials the open land holds, for the tick (`sourceable`). */
let wildHas: { list: unknown; has: Set<Material> } | null = null;
function wildHolds(s: GameState, m: Material): boolean {
  const list = wildCells(s);
  if (wildHas?.list !== list) {
    const has = new Set<Material>();
    for (const { pool } of list) for (const [k, n] of Object.entries(pool)) if ((n ?? 0) > 0) has.add(k as Material);
    wildHas = { list, has };
  }
  return wildHas.has.has(m);
}
function scanWild(s: GameState): { i: number; pool: Stock; d: number }[] {
  const m = s.land;
  const c = campCell(s);
  const out: { i: number; pool: Stock; d: number }[] = [];
  for (const [k, pool] of Object.entries(m.pools)) {
    const i = Number(k);
    const at = cellAt(m, i);
    if (!isOpen(m, at.x, at.y)) continue;
    out.push({ i, pool, d: Math.hypot(at.x - c.x, at.y - c.y) });
  }
  return out.sort((a, b) => a.d - b.d || a.i - b.i);
}

/** The nearest free spot for a building, out from the camp in rings, each ring's spots nearest a road first, so the
 *  town grows along its roads (null if there's no room). In a castle town the keep's ground is the castle's:
 *  everything else goes outside it. Fields and pens keep a little further out than the houses. */
export function findSpot(s: GameState, def: BuildingDef): Pt | null {
  // (a wandering tribe builds its great works on its home ground)
  const from = buildOrigin(s, def.id) ?? campCell(s);
  const taken = footprints(s);
  const castle = castleOn(s) ? castleCells(s) : null;
  const farm = !!CROPS[def.id] || !!HERDS[def.id];
  // (a shore town puts what may stand in the sea there first: its homes in the shallows, the yards on the strand)
  const sea = seaBuild(s, def);
  const r = spiralSpot(s.land, def.width, depthOf(def), taken, from, {
    ok: castle ? (rect) => !nearCastle(castle, s.land, rect) : undefined,
    water: sea,
    prefer: (rect) => (sea ? (inSea(s.land, rect) ? 0 : SEA_PREFER) : roadDistance(s.land, doorOf(rect))) + (farm ? Math.max(0, 5 - Math.hypot(rect.x + rect.w / 2 - from.x, rect.y + rect.h / 2 - from.y)) * 2 : 0),
  });
  if (!r) return null;
  return canPlace(s, def, r.x, r.y).ok ? { x: r.x, y: r.y } : null;
}

/** Where a castle's next room goes: built on to the castle, as near the hall as may be, the snuggest spot of a ring
 *  first (the more of its walls it shares, the more compact the castle stays). */
function roomSpot(s: GameState, def: BuildingDef): Pt | null {
  const cells = castleCells(s);
  const solid = solidCells(s);
  const r = spiralSpot(s.land, def.width, depthOf(def), footprints(s), campCell(s), {
    maxR: 40,
    roads: true,
    door: false,
    carve: holdOf(s) === 'mountain',
    ok: (rect) => joinsCastle(cells, s.land, rect, solid),
    prefer: (rect) => -sharedEdges(cells, s.land, rect, solid),
  });
  if (!r) return null;
  return canPlace(s, def, r.x, r.y).ok ? { x: r.x, y: r.y } : null;
}

const isWall = (d: BuildingDef | undefined) => !!d && !!d.hp && d.width === 1 && !d.defense;


/** What the town would like built next, most wanted first, each with its reason. */
/** What the town would like to build next, in order (exported for the tests: `townWishes`). */
function wishes(s: GameState, n: Needs): { def: string; why: string }[] {
  const out: { def: string; why: string }[] = [];
  const add = (def: string | undefined, why: string) => def && !out.some((w) => w.def === def) && out.push({ def, why });
  // (the phylactery only once the founder's soul is to be bound)
  const shelved = (id: string) => s.tick - (s.plan?.shelved?.[id] ?? -Infinity) < SHELF_HOURS * TICKS_PER_HOUR;
  const can = (d: BuildingDef) => !d.never && !shelved(d.id) && unlocked(s, d.id) && (!NEVER.has(d.id) || (d.id === 'phylactery' && !!s.lichChosen));
  const count = (id: string) => s.buildings.filter((b) => b.def === id).length;
  const grown = s.people.filter((p) => p.bornTick == null).length;
  /** Defence pieces (data/defenses.ts): about one for every DEFENSE_PER_PEOPLE grown-ups (plus `extra`), the best kinds the
   *  town can build first (its own origin's, then the latest era's), one of each kind before a second of any. */
  function planDefenses(extra: number): void {
    const have = s.buildings.filter((b) => BUILDING_BY_ID[b.def]?.defense).length;
    const want = extra + Math.floor(grown / DEFENSE_PER_PEOPLE);
    if (have >= want) return;
    const kinds = BUILDINGS.filter((d) => d.defense && can(d)).sort((a, b) => Number(!!b.origin) - Number(!!a.origin) || ERAS.indexOf(eraOfResearch(b.research)) - ERAS.indexOf(eraOfResearch(a.research)) || (b.defense!.damage[1] - a.defense!.damage[1]));
    for (let round = 1; round <= 2; round++) {
      const d = kinds.find((k) => count(k.id) < round);
      if (d) {
        add(d.id, 'raiders have to be kept out');
        return;
      }
    }
  }

  // (every kind that would do, best first: if the best can't be had, the next is tried)
  const options = (pred: (d: BuildingDef) => boolean, power: (d: BuildingDef) => number, why: string) => {
    for (const d of BUILDINGS.filter((q) => pred(q) && can(q)).sort((a, b) => power(b) - power(a))) add(d.id, why);
  };
  // homes: a bed ahead of the people, but only as fast as the town can feed them: food holding up, fields for
  // everyone, and one new home at a time (half a day apart, once past the first few)
  const foodField = (id: string) => !!CROPS[id] && !!FOOD_VALUE[CROPS[id].material];
  // (counted in garden plots' worth of food, so one big field counts for more than one small one)
  const fieldsNow = s.buildings.filter((b) => foodField(b.def)).reduce((n, b) => n + plotsWorth(b.def), 0);
  // (fields are for those who eat: a town of the dead or of machines farms only for its tavern's guests)
  const fed = n.eaters < 4 || (n.foodDays >= 2 && fieldsNow >= Math.ceil(n.eaters / 2) - 1);
  const paced = n.people < 4 || s.tick - (s.plan?.lastHome ?? -Infinity) >= HOME_EVERY * Math.max(1, s.plan?.lastHomeBeds ?? 1);
  // (people build their own homes too (sim/property.ts); the treasury keeps a bed spare to rent, since a newcomer
  // only comes to a town with a bed free)
  if (n.freeBeds < 1 && fed && paced) options((d) => !!d.housing, (d) => d.housing!, `${n.people} people and ${n.people + n.freeBeds} beds`);
  // food: a field for every two people (one or two more when stores are low; never a field per person)
  const fields = fieldsNow;
  // (poor soil, like the desert's, feeds fewer per field: while food is short it keeps adding fields)
  const guests = s.buildings.some((b) => b.status === 'done' && venueOfDef(b.def) === 'tavern') ? 1 : 0;
  const fieldsWanted = n.eaters ? Math.ceil(n.eaters / 2) + (n.foodDays < 3 ? Math.ceil(n.eaters / 3) : 0) : guests;
  // (a mix of crops, so one blight can't take them all; and no slow orchard while food is short)
  const cropPower = (d: BuildingDef) => {
    const c = CROPS[d.id];
    const perDay = (c.yield * FOOD_VALUE[c.material]!) / c.growHours;
    return (c.establishHours && n.foodDays < 3 ? perDay / 4 : perDay) / (1 + count(d.id));
  };
  if (fields < Math.min(fieldsWanted, n.eaters + 1 + guests)) options((d) => foodField(d.id), cropPower, n.foodDays < 3 ? 'food is running low' : 'more fields for more people');
  // the phylactery, first of all, once it's decided
  if (s.lichChosen && !planned(s, 'phylactery')) add('phylactery', `to bind ${s.people.find((p) => p.id === s.mainId)?.name ?? 'the founder'}'s soul`);
  // a shop, first thing, when the land can't give what the town needs (a desert's fiber, once it's gathered out)
  const shopPlanned = s.buildings.some((b) => isShop(b.def));
  const firstShop = BUILDING_BY_ID.trading_post;
  // (a tavern starts as a Fireside Inn, or straight away as a Tavern for a town that learned brewing first)
  const tavernPlanned = s.buildings.some((b) => isTavern(b.def));
  const firstTavern = VENUE_CHAIN.tavern.map((id) => BUILDING_BY_ID[id]).find((d) => can(d));
  if (!shopPlanned && can(firstShop) && n.unsourced.length) add(firstShop.id, `to buy the ${names(n.unsourced)} it can't gather`);
  // storage when it's filling up (a few stores, not a field of them: the rest is what the shop is for)
  const stores = s.buildings.filter((b) => BUILDING_BY_ID[b.def]?.storage && b.def !== 'campfire').length;
  if (n.storageFill > 0.8 && stores < 2 + Math.floor(n.people / 4)) options((d) => !!d.storage && d.id !== 'campfire', (d) => d.storage!, 'the stores are nearly full');
  // defence first, if that's the aim or raiders keep coming
  if (n.direction === 'defense' || n.raided) {
    planDefenses(n.direction === 'defense' ? 2 : 1);
    for (const d of BUILDINGS) if (can(d) && d.warningMinutes && !planned(s, d.id)) add(d.id, 'to see raiders coming');
  }
  // (in quieter times too, a piece or two as the town grows)
  planDefenses(0);
  // a place to hold raiders taken alive, once the town has been raided or holds prisoners (data/prisons.ts); it grows
  // by being rebuilt (`planPrison`). (The Court keeps its prisoners in the blood farm's cells.)
  if (wantPrison(s, n) && !s.buildings.some((b) => BUILDING_BY_ID[b.def]?.cells)) {
    const jail = PRISON_BUILDINGS.find((d) => can(d));
    if (jail) add(jail.id, 'a place to hold the raiders taken alive');
  }
  // more sickbeds when the hurt outnumber them (sim/sickbeds.ts): the best healing building it can build, one at a time
  if (s.people.filter(needsSickbed).length > sickbedsOf(s) && !s.buildings.some((b) => SICKBEDS[b.def] && b.status !== 'done')) {
    const ward = BUILDINGS.filter((d) => SICKBEDS[d.id] && can(d)).sort((a, b) => (b.healing ?? 1) - (a.healing ?? 1))[0];
    if (ward) out.push({ def: ward.id, why: 'more sickbeds for the hurt' });
  }
  // a shop to sell to travellers (sooner when the town is set on trade)
  if (!shopPlanned && can(firstShop) && n.direction === 'trade') add(firstShop.id, 'to sell to travellers for coins');
  // a better place to research, and more of them as the town grows (one person studies at each: about one station for
  // every four grown-ups, up to one per topic it can study at once)
  const station = Object.entries(RESEARCH_STATIONS).filter(([id]) => BUILDING_BY_ID[id] && can(BUILDING_BY_ID[id])).sort((a, b) => b[1].mult - a[1].mult)[0];
  if (station && !planned(s, station[0])) add(station[0], 'somewhere better to study');
  const stations = s.buildings.filter((b) => RESEARCH_STATIONS[b.def]).length;
  const wantStations = Math.min(modifiers(s.research).researchSlots, 1 + Math.floor(grown / 4));
  // (never a second campfire: another desk waits for a real place of study)
  if (station && station[0] !== 'campfire' && stations < wantStations) add(station[0], `a desk for another researcher (${stations} for ${grown} people)`);
  // the next era, once the town can manage it
  for (const id of CAPSTONES) if (BUILDING_BY_ID[id] && can(BUILDING_BY_ID[id]) && !planned(s, id)) add(id, 'the way to the next era');
  if (!shopPlanned && can(firstShop)) add(firstShop.id, 'to sell to travellers for coins');
  if (!tavernPlanned && firstTavern) add(firstTavern.id, 'to feed travellers for coins');
  // one of every workshop, mine, farm building and comfort it has learned to build
  const order = n.direction === 'trade' ? (d: BuildingDef) => (d.stalls || d.id === 'tavern' || ITEMS.some((i) => i.station === d.id) ? 0 : 1) : () => 0;
  for (const d of [...BUILDINGS].sort((a, b) => order(a) - order(b))) {
    if (!can(d) || planned(s, d.id) || d.housing || d.storage || d.hp || d.defense || d.cells || CAPSTONES.includes(d.id)) continue;
    if (CROPS[d.id] && FOOD_VALUE[CROPS[d.id].material]) continue; // (food fields come of wanting food, above)
    if (d.id === 'graveyard' && !(s.graves?.length)) continue; // (only once someone has died)
    if (d.id === 'trophy_hall' && treasuresHeld(s) < 2) continue; // (only once there's something to show)
    // (a specialty shop once the general store stands and the town is big enough to keep one)
    if (lineOfDef(d.id)) {
      if (shopOf(s) && grown >= STORE_PEOPLE) add(d.id, `to sell ${LINES[lineOfDef(d.id)!].banner.toLowerCase()} to travellers`);
      continue;
    }
    if (venueOfDef(d.id)) continue; // (one shop and one tavern, which grow by being rebuilt bigger)
    add(d.id, HERDS[d.id] ? `to keep ${HERDS[d.id].plural}` : WORKPLACES[d.id] ? 'to dig what the town needs' : ITEMS.some((i) => i.station === d.id) ? 'a new workshop' : d.morale ? 'to lift spirits' : 'the town has learned to build it');
  }
  return out;
}

/** A field's food as garden plots' worth (a garden plot is 1). */
const PLOT_FOOD = CROPS.garden_plot.yield * FOOD_VALUE.grain!;
const plotsWorth = (id: string) => (CROPS[id].yield * (FOOD_VALUE[CROPS[id].material] ?? 0)) / PLOT_FOOD;

/** Wanted: a prison, once the town has been raided or holds prisoners and has a few grown-ups (not the Court, whose
 *  prisoners are kept in the blood farm). */
const wantPrison = (s: GameState, n: Needs) => !bloodTown(s) && n.people >= 3 && (n.raided || !!s.raidRecap || s.prisoners.length > 0);

/** The prison is rebuilt as the next of its line (stockade, gaol, prison) once its cells are nearly full and the town
 *  has learned how and has the makings. */
function planPrison(s: GameState, n: Needs, plan: TownPlan): boolean {
  const jail = s.buildings.find((b) => b.status === 'done' && BUILDING_BY_ID[b.def]?.cells);
  const to = jail ? UPGRADES[jail.def] : undefined;
  const def = to ? BUILDING_BY_ID[to] : undefined;
  if (!jail || !def || s.prisoners.length < cellsOf(s) - 1) return false;
  if (!isUnlocked(unlockInfo(s), def) || !affordable(s, def, n.stock)) return false;
  if (!upgrade(s, jail.id).ok) return false;
  plan.build = { def: def.id, why: 'more cells for the prisoners' };
  return true;
}

/** The seat of the town (data/seats.ts) is rebuilt grander as soon as a new era opens its next stage and the town can
 *  find the materials: it is never built new, only rebuilt where it stands. */
function planSeat(s: GameState, n: Needs, plan: TownPlan): boolean {
  const seat = seatOf(s.buildings);
  if (!seat || seat.status !== 'done') return false;
  const to = UPGRADES[seat.def];
  const def = to ? BUILDING_BY_ID[to] : undefined;
  if (!def || !isUnlocked(unlockInfo(s), def) || !affordable(s, def, n.stock)) return false;
  if (!upgrade(s, seat.id).ok) return false;
  plan.build = { def: def.id, why: 'the seat of the town, rebuilt grander for the new age' };
  return true;
}

/** Fewer, bigger fields: two garden plots side by side, both lying fallow, are ploughed into one open field (and an
 *  open field grows into an estate farm where it stands, if there's room). In winter, when nothing's in the ground
 *  anyway, or whenever more food is wanted. */
function consolidateFields(s: GameState, n: Needs, plan: TownPlan, needFood = false): boolean {
  if (!needFood && calendar(s.tick).season !== 'winter' && n.foodDays < 4) return false;
  const fallow = (b: Building) => b.status === 'done' && (b.crop?.stage ?? 'fallow') === 'fallow';
  for (const b of s.buildings) {
    const to = UPGRADES[b.def] && CROPS[b.def] ? BUILDING_BY_ID[UPGRADES[b.def]] : undefined;
    if (!to || !CROPS[to.id] || !fallow(b) || !affordable(s, to, n.stock)) continue;
    const from = BUILDING_BY_ID[b.def];
    let absorb: Building | undefined;
    if (to.width > from.width) {
      // (a garden plot's width doubles: it takes its neighbour in)
      absorb = s.buildings.find((q) => q !== b && q.def === b.def && fallow(q) && q.tile === b.tile + from.width && q.row === b.row);
      if (!absorb || !canUpgrade(s, b.id, absorb.id).ok) continue;
    } else if (!canUpgrade(s, b.id).ok) continue;
    const was = absorb ? `two ${from.name.toLowerCase()}s` : `the ${from.name.toLowerCase()}`;
    const crop = b.crop;
    if (upgrade(s, b.id, absorb?.id).ok) {
      // (the ground keeps its soil)
      if (crop) b.crop = { stage: 'fallow', growth: 0, work: 0, soil: Math.min(crop.soil ?? 1, absorb?.crop?.soil ?? 1) };
      plan.build = { def: to.id, why: `${was} made into one ${to.name.toLowerCase()}` };
      return true;
    }
  }
  return false;
}

/** Blueprints stuck waiting on what the town has none of (no progress, no deliveries, for STALL_HOURS) are taken down,
 *  their materials back in store, so the build slots go to what can be built. Never an era's capstone. */
function shelveStalled(s: GameState, n: Needs, plan: TownPlan): void {
  const moved = (plan.moved ??= {});
  const shelved = (plan.shelved ??= {});
  for (const id of Object.keys(moved)) if (!s.buildings.some((b) => b.id === Number(id) && b.status === 'blueprint')) delete moved[Number(id)];
  for (const k of Object.keys(shelved)) if (s.tick - shelved[k] > SHELF_HOURS * TICKS_PER_HOUR) delete shelved[k];
  for (const b of [...s.buildings]) {
    if (!inWork(b)) continue; // (a planned piece of the wall waits its turn: that's not a stall)
    const sig = `${Math.round(b.progress * 100)}|${poolSize(b.delivered)}`;
    const m = moved[b.id];
    if (!m || m.sig !== sig) {
      moved[b.id] = { tick: s.tick, sig };
      continue;
    }
    if (s.tick - m.tick < STALL_HOURS * TICKS_PER_HOUR || CAPSTONES.includes(b.def) || isSeat(b.def) || b.progress > 0) continue;
    const missing = (Object.keys(stillNeeded(b)) as Material[]).filter((k) => (n.stock[k] ?? 0) === 0);
    if (!missing.length) continue;
    demolish(s, b.id);
    delete moved[b.id];
    shelved[b.def] = s.tick;
    plan.waiting.push(`Set aside the ${BUILDING_BY_ID[b.def].name}: no ${names(missing)} to be had`);
  }
}

/** Whether rebuilding a home would leave people without a bed while it's built (the beds elsewhere can't take them). */
const displaces = (s: GameState, b: { def: string }, allow = 0) => {
  const beds = BUILDING_BY_ID[b.def]?.housing ?? 0;
  return beds > 0 && housingCapacity(s) - beds + allow < s.people.length;
};

/** Up to this many people may sleep rough for the short while a small home is rebuilt. */
const SLEEP_ROUGH = 2;

/** Keeps the town from sprawling into small houses: with beds to spare, the smallest home is rebuilt as the next
 *  kind up, where it stands (its people sleep in the spare beds meanwhile). One at a time, once fed. */
function consolidateHomes(s: GameState, n: Needs, plan: TownPlan, needBeds = false): boolean {
  // (for more beds, any time a new home would do; otherwise only in a quiet spell, with nothing else being built)
  if (!needBeds && (n.people < 4 || n.foodDays < 3 || blueprintCount(s) > 0)) return false;
  const homes = s.buildings
    .filter((b) => b.status === 'done' && BUILDING_BY_ID[b.def]?.housing && UPGRADES[b.def])
    .sort((a, b) => BUILDING_BY_ID[a.def].housing! - BUILDING_BY_ID[b.def].housing!);
  for (const b of homes) {
    const from = BUILDING_BY_ID[b.def];
    const to = BUILDING_BY_ID[UPGRADES[b.def]];
    if (!to?.housing || to.housing <= from.housing! || !affordable(s, to, n.stock)) continue;
    // where it stands if there's room; else pulled down with the same kind of home next door, the two made one
    let absorb: Building | undefined;
    if (!canUpgrade(s, b.id).ok) {
      absorb = s.buildings.find((q) => q !== b && q.def === b.def && q.status === 'done' && q.row === b.row && (q.tile === b.tile + from.width || q.tile + from.width === b.tile));
      // (more beds are wanted: only if the one home has more than the two)
      if (!absorb || (needBeds && to.housing <= 2 * from.housing!) || !canUpgrade(s, b.id, absorb.id).ok) continue;
    }
    if (displaces(s, b, SLEEP_ROUGH - (absorb ? from.housing! : 0))) continue;
    const was = absorb ? `two ${from.name}s` : `the ${from.name}`;
    if (upgrade(s, b.id, absorb?.id).ok) {
      plan.build = { def: to.id, why: needBeds ? `more beds: ${was} rebuilt bigger` : `a better home than ${was}` };
      plan.lastHome = s.tick;
      plan.lastHomeBeds = to.housing - from.housing! * (absorb ? 2 : 1);
      return true;
    }
  }
  return false;
}

/** Place the next building the town wants (one at a time), or upgrade one. Returns wild tiles to clear for a
 *  building it wanted but had no room for (or for a wall's spot at the end of town). */
function planBuilding(s: GameState, n: Needs, plan: TownPlan): number[] {
  if (blueprintCount(s) >= buildSlots(s)) return [];
  const clear: number[] = [];
  if (planSeat(s, n, plan)) return clear;
  if (planPrison(s, n, plan)) return clear;
  if (consolidateHomes(s, n, plan)) return clear;
  if (consolidateFields(s, n, plan)) return clear;
  // the ring wall round the town (sim/ringWall.ts): started once the town is a few people strong (sooner when raided or
  // set on defence), widened as it grows, a slot always left for the rest
  const grownUps = s.people.filter((p) => !isChild(p)).length;
  // (a town that can't gather what it builds with waits for its shop before it walls itself: the shop comes first)
  const shopFirst = n.unsourced.length > 0 && !s.buildings.some((b) => isShop(b.def));
  // (a handful of people can't wall a town and build it too: the ring waits for RING_MIN_PEOPLE, raided or not)
  if (!shopFirst && grownUps >= RING_MIN_PEOPLE) clear.push(...planRing(s, n.raided || n.direction === 'defense' || grownUps >= RING_PEOPLE, n.stock, n.raided));
  if (n.foodDays < 2 && clear.length) clear.length = 0; // (food first: no clearing for the wall while hungry)
  if (blueprintCount(s) >= buildSlots(s)) return clear;
  let blocked: BuildingDef | null = null;
  let triedUpgrade = false;
  let triedFields = false;
  for (const w of wishes(s, n)) {
    const def = BUILDING_BY_ID[w.def];
    // (beds wanted: a bigger home where a small one stands comes before another home beside it)
    if (def.housing && !triedUpgrade) {
      triedUpgrade = true;
      if (consolidateHomes(s, n, plan, true)) return clear;
    }
    // (more food wanted: a bigger field where two small ones lie comes first)
    if (CROPS[def.id] && FOOD_VALUE[CROPS[def.id].material] && !triedFields) {
      triedFields = true;
      if (consolidateFields(s, n, plan, true)) return clear;
    }
    if (!affordable(s, def, n.stock)) continue;
    let at: Pt | null;
    if (roomKind(s, def)) {
      // (a castle town builds it on to the castle, or clears the land beside the castle for it)
      at = roomSpot(s, def);
      if (!at) {
        blocked ??= def;
        continue;
      }
    } else if (isWall(def) || isRingPiece(def.id)) continue; // (walls and gates are the ring's: planRing)
    else at = findSpot(s, def);
    if (at === null) {
      blocked ??= def;
      continue;
    }
    if (placeBlueprint(s, def.id, at.x, at.y).ok) {
      plan.build = w;
      if (def.housing) {
        plan.lastHome = s.tick;
        plan.lastHomeBeds = def.housing;
      }
      return clear;
    }
  }
  // nothing new to build: improve what's there (fields only through consolidateFields: when fallow, and wanted)
  for (const b of s.buildings) {
    if (b.status !== 'done' || !UPGRADES[b.def] || CROPS[b.def]) continue;
    const to = BUILDING_BY_ID[UPGRADES[b.def]];
    if (!to || !affordable(s, to, n.stock) || displaces(s, b) || !canUpgrade(s, b.id).ok) continue;
    const was = BUILDING_BY_ID[b.def].name;
    if (upgrade(s, b.id).ok) {
      plan.build = { def: to.id, why: `a better ${was}` };
      return clear;
    }
  }
  if (blocked) {
    plan.waiting.push(`No room for a ${blocked.name}: clearing land`);
    // the nearest wild land, out from the camp
    for (const { i } of wildCells(s).slice(0, blocked.width * depthOf(blocked) + 2)) clear.push(i);
  }
  return clear;
}

/* ------------------------------------------------------------ gathering */

/** Mark wild land for what the town is short of (nearest first: for building, for crafting, food when it's low), and
 *  to clear room for a building it wants. */
/** A mountain hold digs on: every face of rock beside its halls and galleries, within the known land, is given what
 *  it holds (sim/land.ts `delvePool`: stone, coal and iron, gold and gems the deeper in), so the gathering below can
 *  mark it like any wild cell; a face dug out becomes a gallery, and the faces beyond it open. */
function openFaces(s: GameState): void {
  if (holdOf(s) !== 'mountain') return;
  const m = s.land;
  const seed = hashSeed(s.seed);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (groundAt(m, x, y) !== 'hall') continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inMap(m, nx, ny) || groundAt(m, nx, ny) !== 'mountain' || !isOpen(m, nx, ny)) continue;
        const i = idx(m, nx, ny);
        if (m.pools[i]) continue;
        m.pools[i] = delvePool(delveDepth(m, ny), Rng.from(seed, 0x4d1 + i));
        m.version++;
      }
    }
}

/** A mountain hold keeps this much gold and gems coming: it digs for them whenever it holds less (the shop sells them). */
const DELVE_WANT = 10;
/** A town with a mine keeps this much of each ore coming. */
const MINE_WANT = 8;

function planGathering(s: GameState, n: Needs, plan: TownPlan, clear: number[], craftWants: Stock): void {
  openFaces(s);
  let byDistance = wildCells(s);
  let marked = s.land.marked.length;
  const cap = BASE_MARKED + s.people.filter((p) => p.bornTick == null).length;
  const mark = (i: number) => {
    if (isMarked(s.land, i) || marked >= cap || !s.land.pools[i]) return false;
    setMarked(s.land, i, true);
    marked++;
    return true;
  };
  for (const m of MATERIALS) {
    if (!GATHERABLE.has(m)) continue;
    let short = Math.max((n.demand[m] ?? 0) - (n.stock[m] ?? 0), craftWants[m] ?? 0);
    if (m === 'berries' && n.foodDays < 3) short = Math.max(short, n.eaters * 3);
    if (seaTown(s)) {
      if (m === 'fish' && n.foodDays < 4) short = Math.max(short, n.eaters * 3);
      if (m === 'pearls') short = Math.min(1, Math.max(short, PEARLS_WANT - (n.stock[m] ?? 0))); // (one pearl cell at a time: never a cap's worth)
    } else if (SEA_MATERIALS.includes(m)) continue;
    if ((m === 'gold' || m === 'gems') && holdOf(s) === 'mountain') short = Math.max(short, DELVE_WANT - (n.stock[m] ?? 0));
    // (a mine on the land is worked for what it holds: the shop sells what the crafts don't take)
    if (ORES.includes(m) && mines(s).length) short = Math.max(short, MINE_WANT - (n.stock[m] ?? 0));
    // (the reserve isn't worth gathering into full stores; what building, crafting or hunger needs still is, and so is
    // a basic the town has run right out of: a store full of the harvest once left a town with no wood to build more)
    if (n.storageFill > 0.95 && (n.stock[m] ?? 0) >= (RESERVE[m] ?? 0) / 2 && !(craftWants[m] ?? 0) && !s.buildings.some((b) => inWork(b) && (stillNeeded(b)[m] ?? 0) > 0) && m !== 'berries') continue;
    if (short <= 0) continue;
    // what's already marked counts toward it
    short -= s.land.marked.reduce((k, i) => k + (s.land.pools[i]?.[m] ?? 0), 0);
    if (!plan.gathering.includes(MATERIAL_NAMES[m])) plan.gathering.push(MATERIAL_NAMES[m]);
    // (none left within the known land: the town looks further afield)
    while (!byDistance.some(({ pool, i }) => (pool[m] ?? 0) > 0 && !isMarked(s.land, i)) && openLand(s, true)) byDistance = wildCells(s);
    for (const { pool, i } of byDistance) {
      if (short <= 0) break;
      if ((pool[m] ?? 0) <= 0 || isMarked(s.land, i)) continue;
      if (mark(i)) short -= pool[m] ?? 0;
    }
  }
  for (const i of clear) mark(i);
}

/* ------------------------------------------------------------ the shop: selling and buying */

/** Days of food the town holds back before it sells any. */
const FOOD_KEEP_DAYS = 5;
/** With this many times its coin reserve in the purse, the town also buys toward its usual stock of materials. */
const RICH = 3;
/** Ammunition kept for the town's slings, bows and guns. */
const AMMO: readonly Material[] = ['sling_stones', 'arrows', 'shot', 'cartridges'];
const AMMO_KEEP = 30;

/** What the town will sell to travellers: what it has beyond what building and crafting need and a healthy reserve
 *  (twice its usual one), food beyond several days' worth, and never the totem. */
export function forSale(s: GameState): Stock {
  const n = needs(s);
  // (a town where nobody eats sells all the food it comes by)
  let spareFood = n.eaters ? Math.max(0, (n.foodDays - FOOD_KEEP_DAYS) * n.eaters) : Infinity;
  const out: Stock = {};
  for (const m of MATERIALS) {
    const have = n.stock[m] ?? 0;
    if (m === 'totem' || have <= 0) continue;
    // (monster parts are kept while the guild's forge still wants them for something not yet made)
    if ((COMPONENTS as readonly string[]).includes(m) && FORGED_IDS.some((id) => !(s.uniques ?? []).includes(id) && (ITEM_BY_ID[id]?.cost[m] ?? 0) > 0)) continue;
    let spare: number;
    const value = FOOD_VALUE[m];
    if (value) {
      spare = Math.min(have, Math.floor(spareFood / value));
      spareFood -= spare * value;
    } else spare = have - Math.max(n.demand[m] ?? 0, (RESERVE[m] ?? 6) * 2, AMMO.includes(m) ? AMMO_KEEP : 0);
    if (spare > 0) out[m] = spare;
  }
  return out;
}

/** What the town would buy from a traveller, most needed first. What it can't get any other way it buys whatever
 *  it costs (`essential`); what it could gather or make it buys only for a building it's waiting on, and only with
 *  coins to spare; and food when it's running out. */
export function shoppingList(s: GameState): { m: Material; n: number; essential: boolean }[] {
  const n = needs(s);
  const out: { m: Material; n: number; essential: boolean }[] = [];
  if (n.foodDays < 2) {
    const eaters = n.eaters || 1;
    const food = travellerGoods(s.era).filter((m) => FOOD_VALUE[m]).sort((a, b) => FOOD_VALUE[b]! - FOOD_VALUE[a]!)[0];
    if (food) out.push({ m: food, n: Math.ceil(((3 - n.foodDays) * eaters) / FOOD_VALUE[food]!), essential: true });
  }
  const rich = (s.coins ?? 0) >= RICH * COIN_RESERVE * PURSE_SCALE[s.era];
  const building: Stock = {};
  for (const b of s.buildings) if (inWork(b)) for (const [m, k] of Object.entries(stillNeeded(b)) as [Material, number][]) addStock(building, m, k);
  for (const m of MATERIALS) {
    const short = (n.demand[m] ?? 0) - (n.stock[m] ?? 0);
    if (short <= 0 || m === 'totem') continue;
    const essential = !sourceable(s, m, 0, false);
    const k = essential || rich ? short : Math.min(short, building[m] ?? 0);
    if (k > 0) out.push({ m, n: k, essential });
  }
  return out.sort((a, b) => Number(b.essential) - Number(a.essential));
}

const names = (ms: readonly Material[]) => ms.map((m) => MATERIAL_NAMES[m].toLowerCase()).join(' and ');

/** Once an hour, what's left in the purse after a good reserve goes into the shop: an extension when its floor is
 *  crowded (no room for another shelf or table), else a level on the piece that's cheapest to improve. */
function planShop(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  for (const venue of [shopOf(s), tavernOf(s), ...SHOP_LINES.map((l) => storeOf(s, l))]) {
    if (!venue) continue;
    // (a good reserve, and tomorrow's wages, are kept back)
    // (the owner's purse for a business someone owns: sim/ambition.ts)
    const spare = venuePurse(s, venue, (s.coins ?? 0) - 2 * COIN_RESERVE * PURSE_SCALE[s.era] - wageBill(s));
    const ext = extensionPrice(s, venue);
    const table = venueKind(venue) === 'tavern' ? ITEM_BY_ID.log_table : ITEM_BY_ID.trestle_table;
    const crowded = !spotFor(venue, ITEM_BY_ID.clay_urns) && !spotFor(venue, table);
    if (crowded && ext !== null) {
      if (spare >= ext) extend(s, venue);
      continue; // (saving up for it)
    }
    // (the keeper's décor comes before polishing single pieces, while it's the cheaper of the two)
    const cheapest = (venue.shop?.pieces ?? []).filter((p) => levelPrice(p) !== null).sort((a, b) => levelPrice(a)! - levelPrice(b)!)[0];
    const decor = decorPrice(s, venue);
    if (decor !== null && (!cheapest || decor <= levelPrice(cheapest)! * 1.5)) {
      if (spare >= decor) redecorate(s, venue);
      continue; // (saving up for it)
    }
    if (cheapest && spare >= levelPrice(cheapest)!) improve(s, venue, cheapest);
  }
}

/* ------------------------------------------------------------ making room */

/** Bulk materials the town clears out when its stores are full (clearing land piles up far more wood and stone
 *  than it can use). Never food: a full store with no room for the harvest starved a whole town. */
const BULK: readonly Material[] = ['wood', 'stone', 'fiber', 'flint', 'clay', 'bone'];

function makeRoom(s: GameState, n: Needs): void {
  if (n.storageFill < 0.9) return;
  for (const m of BULK) {
    const keep = Math.max((RESERVE[m] ?? 10) * 3, n.demand[m] ?? 0);
    let extra = (n.stock[m] ?? 0) - keep;
    for (const b of storages(s)) {
      if (extra <= 0) break;
      const k = Math.min(extra, b.store[m] ?? 0);
      if (k > 0) addStock(b.store, m, -k);
      extra -= k;
    }
  }
}

/* ------------------------------------------------------------ newcomers */

/** A wanderer at the edge of town is let in when there's a bed for them (or they bring a rare calling). */
function planVisitor(s: GameState): void {
  const v = s.visitor;
  if (!v || v.leavingTo) return;
  // (most towns: the player decides, by the question at the gate; the horde's gates are free)
  if (!rulesOf(s).freeJoin) return;
  if (housingCapacity(s) > s.people.length || v.person.cls) acceptVisitor(s);
}

/* ------------------------------------------------------------ the pens */

/** Goods paid for animals cost this much over their worth (a drover's price for barter). */
const BARTER_MARKUP = 1.3;

/** An empty pen is stocked from a drover (a breeding pair or so: coins while the town has them, else spare goods), and
 *  a pen its herd has filled is fenced wider (sim/livestock.ts). */
function planPens(s: GameState): void {
  for (const b of s.buildings) {
    if (b.status !== 'done' || !HERDS[b.def]) continue;
    const h = herdOf(s, b);
    if (h.head < 2) stockPen(s, b, (coins) => payFor(s, coins));
    else growPen(s, b);
  }
}

/** Pay a price: in coins if the town can spare them, else in what it has spare to sell (at a markup). */
function payFor(s: GameState, coins: number): boolean {
  if ((s.coins ?? 0) >= coins + COIN_RESERVE) {
    s.coins! -= coins;
    return true;
  }
  const spare = forSale(s);
  let owed = coins * BARTER_MARKUP;
  const take: Stock = {};
  for (const m of (Object.keys(spare) as Material[]).sort((a, b) => (spare[b] ?? 0) * WORTH[b] - (spare[a] ?? 0) * WORTH[a])) {
    if (owed <= 0) break;
    const n = Math.min(spare[m] ?? 0, Math.ceil(owed / WORTH[m]));
    if (n <= 0) continue;
    take[m] = n;
    owed -= n * WORTH[m];
  }
  if (owed > 0) return false;
  for (const [m, n] of Object.entries(take) as [Material, number][]) {
    let left = n;
    for (const st of storages(s)) {
      const k = Math.min(left, st.store[m] ?? 0);
      st.store[m] = (st.store[m] ?? 0) - k;
      left -= k;
      if (!left) break;
    }
  }
  return true;
}

/* ------------------------------------------------------------ the whole plan */

export function runPlanner(s: GameState): void {
  if (s.gameOver || s.autopilot === false || s.tick % PLAN_TICKS !== 0) return;
  openLand(s);
  const n = needs(s);
  makeRoom(s, n);
  const plan: TownPlan = { build: s.plan?.build ?? null, research: null, gathering: [], waiting: [], lastHome: s.plan?.lastHome, lastHomeBeds: s.plan?.lastHomeBeds, shelved: s.plan?.shelved, moved: s.plan?.moved };
  shelveStalled(s, n, plan);
  planResearch(s, n, plan);
  const craftWants = planCrafting(s, n);
  const clear = planBuilding(s, n, plan);
  planGathering(s, needs(s), plan, clear, craftWants);
  planVisitor(s);
  planShop(s);
  planPens(s);
  s.plan = plan;
}

/** The town's building wishes as it stands (for the tests). */
export const townWishes = (s: GameState) => wishes(s, needs(s));
