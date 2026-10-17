// The monster ranch (data/ranch.ts has the numbers). `s.ranch` (`RanchState`) holds the town's beasts. They come from
// the raids: a beast a Beast Tamer has won over and still standing when the raid ends is brought home
// (`ranchRaidOver`, from raids.ts endRaid), and with a ranch and a Beastmaster or Tamer at home, a beast left on the field
// may be caught. Each morning at `RANCH_HOUR` (`ranchHourly`, autopilot on; its own side stream) the beasts are fed from
// the stores, age and sicken, pairs breed (traits passed on), the Beastmaster (the ranch's job: data/operators.ts) trains
// them and tends the sick, the town sets each to its work (guard, haul, hunt, ride) and the work's haul comes in, and the
// town sells what it can't keep (never a beast the player has forbidden it to sell). Guards fight beside the town in
// raids (`ranchAllies`, from startRaid); a rider strikes harder in a raid (`mountFight`, read by raids.ts). The town
// raises its own ranch (`buildRanch`). The player names a beast or forbids its sale (the `ranch` command).

import { BUILDING_BY_ID } from '../data/buildings';
import { ENEMIES, natureOf } from '../data/enemies';
import { PACK_SHEETS } from '../data/packSheets';
import { FOOD_VALUE } from '../data/people';
import {
  BEAST_LEVEL_MOST, BEAST_NAMES, BEAST_TRAITS, BREED_DAILY, CATCH_DOWNED, feedOf, GRAZER_FOOD, GRAZERS, GROWN_DAYS, haulOf, HUNGRY_FLEE, HUNT_HIDE, HUNT_HURT, huntOf, INHERIT,
  JOB_NAMES, LEVEL_XP, lifespanOf, LOOSE_ROOM, MEAT_FOOD, MUTATE, OLD_DEATH, OLD_SHARE, PER_LEVEL, priceOf, RANCH_HOUR, RANCH_PEOPLE, RANCH_PEOPLE_UNASKED, RANCH_ROOM, RANCHES_MOST, rideFight, RIDEABLE,
  SELL_FOOD_DAYS, SICK_CROWDED, SICK_DAILY, SICK_DAYS, SICK_DEATH, SICK_DEATH_TENDED, SICK_HUNGRY, TEND_CURE, TEND_PER_LEVEL, TRAIN_PER_LEVEL, TRAIN_XP, TRAIT_IDS, TRAITS_MOST,
  type BeastJob, type TraitId,
} from '../data/ranch';
import type { Material } from '../data/materials';
import { tierOf } from '../data/taming';
import { levelOf } from '../data/levels';
import { hashSeed, Rng } from '../rng';
import { buildingCentre, depositNear, footprint, isUnlocked, placeBlueprint, totalStock, unlockInfo } from './buildings';
import { addDeed } from './deeds';
import { takeFromStorage } from './expeditions';
import { operatorOf } from './operators';
import { findSpot } from './planner';
import { isChild } from './social';
import { campXY, earn, foodDaysFor, notify, type GameState, type Person, type Raid, type Raider } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export interface RanchBeast {
  id: number;
  /** Its kind (an enemy id: its sheet, health and blows). */
  kind: string;
  name: string;
  /** Named by the player (the ranch won't rename it). */
  named?: boolean;
  sex: 'm' | 'f';
  /** The tick it was born (or, for one brought in grown, that many days before it came). */
  born: number;
  traits: TraitId[];
  level: number;
  xp: number;
  job: BeastJob;
  /** Who rides it (a person id), when its job is riding. */
  rider?: number;
  /** Its health, a share of full (0 to 1). */
  hp: number;
  /** Sick until this tick. */
  sick?: number;
  /** Days gone unfed in a row. */
  hunger: number;
  /** The player has forbidden its sale. */
  keep?: boolean;
  /** Where it came from: tamed in a raid (and by whom), caught on the field, or born at the ranch (and to whom). */
  from: 'tamed' | 'caught' | 'bred';
  by?: string;
  parents?: [number, number];
  gen: number;
  /** Bouts in the arena (sim/arena.ts), and the season crowns it has won. */
  wins: number;
  losses: number;
  crowns?: number;
}

export interface RanchState {
  beasts: RanchBeast[];
  next: number;
  log: string[];
  bred: number;
  sold: number;
  died: number;
  /** Beasts that ran off or were let go. */
  lost: number;
}

const LOG_KEPT = 10;
const day = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY) + 1;
const roll = (s: GameState, what: string) => new Rng(hashSeed(`${s.seed}:ranch:${what}:${s.tick}`));

export const ranchOf = (s: GameState): RanchState => (s.ranch ??= { beasts: [], next: 1, log: [], bred: 0, sold: 0, died: 0, lost: 0 });

function note(s: GameState, text: string, key = false): void {
  const r = ranchOf(s);
  r.log.unshift(`Day ${day(s)}: ${text}`);
  if (r.log.length > LOG_KEPT) r.log.length = LOG_KEPT;
  notify(s, text, key);
}

export const ranches = (s: GameState) => s.buildings.filter((b) => b.def === 'beast_ranch' && b.status === 'done');
/** How many beasts the town can keep: a ranch's room each, or a couple tethered by the fire without one. */
export const ranchRoom = (s: GameState) => {
  const n = ranches(s).length;
  return n ? n * RANCH_ROOM : LOOSE_ROOM;
};

export const beastTier = (b: Pick<RanchBeast, 'kind'>) => tierOf(ENEMIES[b.kind]?.hp ?? 25);
export const ageDays = (s: GameState, b: RanchBeast) => (s.tick - b.born) / TICKS_PER_DAY;
export const grown = (s: GameState, b: RanchBeast) => ageDays(s, b) >= GROWN_DAYS;
const traitMult = (b: RanchBeast, k: 'damage' | 'hp' | 'hunt' | 'haul' | 'train' | 'breed' | 'life' | 'sick' | 'speed') => b.traits.reduce((m, t) => m * (BEAST_TRAITS[t][k] ?? 1), 1);
export const lifeOf = (b: RanchBeast) => Math.round(lifespanOf(beastTier(b)) * traitMult(b, 'life'));
export const isGrazer = (kind: string) => GRAZERS.test(kind);
export const canRide = (kind: string) => RIDEABLE.test(kind) && tierOf(ENEMIES[kind]?.hp ?? 25) >= 1.5;
/** How a beast fights: its kind's health and blows, raised by level and its traits. */
export function beastMight(b: RanchBeast): { hp: number; damage: number; speed: number } {
  const lv = 1 + (b.level - 1) * PER_LEVEL;
  return { hp: lv * traitMult(b, 'hp'), damage: lv * traitMult(b, 'damage'), speed: traitMult(b, 'speed') };
}
export const beastPrice = (b: RanchBeast) => priceOf(beastTier(b), b.level, b.traits.filter((t) => !BEAST_TRAITS[t].bad).length, b.traits.filter((t) => BEAST_TRAITS[t].bad).length);
const healthy = (s: GameState, b: RanchBeast) => !b.sick && b.hp >= 0.5 && grown(s, b);

function beastName(s: GameState, rng: Rng): string {
  const taken = new Set(ranchOf(s).beasts.map((b) => b.name));
  const free = BEAST_NAMES.filter((n) => !taken.has(n));
  return free.length ? free[rng.int(0, free.length - 1)] : `${BEAST_NAMES[rng.int(0, BEAST_NAMES.length - 1)]} ${ranchOf(s).next}`;
}

/** A beast joins the ranch (if there's room). */
/** Only an animal can be kept in a pen: a creature named a beast, or drawn from a creature sheet. The packs' people (a
 *  kunoichi, a ninja) read as beasts to `natureOf` (they have a sheet), and stood in the pens as foes. */
export function penKind(kind: string): boolean {
  const d = ENEMIES[kind];
  if (!d) return false;
  if (d.nature) return d.nature === 'beast';
  return natureOf(kind) === 'beast' && !('sheet' in d.sprite && d.sprite.sheet in PACK_SHEETS);
}

export function addBeast(s: GameState, kind: string, from: RanchBeast['from'], rng: Rng, opts: { by?: string; parents?: [RanchBeast, RanchBeast]; traits?: TraitId[] } = {}): RanchBeast | null {
  const r = ranchOf(s);
  if (!penKind(kind) || r.beasts.length >= ranchRoom(s)) return null;
  let traits = opts.traits;
  if (!traits) {
    traits = [];
    if (opts.parents) {
      for (const t of new Set([...opts.parents[0].traits, ...opts.parents[1].traits])) if (rng.chance(INHERIT)) traits.push(t);
      if (rng.chance(MUTATE)) traits.push(TRAIT_IDS[rng.int(0, TRAIT_IDS.length - 1)]);
    } else {
      traits.push(TRAIT_IDS[rng.int(0, TRAIT_IDS.length - 1)]);
      if (rng.chance(0.3)) traits.push(TRAIT_IDS[rng.int(0, TRAIT_IDS.length - 1)]);
    }
    traits = [...new Set(traits)].slice(0, TRAITS_MOST);
  }
  const b: RanchBeast = {
    id: r.next++,
    kind,
    name: beastName(s, rng),
    sex: rng.chance(0.5) ? 'm' : 'f',
    born: from === 'bred' ? s.tick : s.tick - Math.round((GROWN_DAYS + rng.int(0, 8)) * TICKS_PER_DAY),
    traits,
    level: from === 'bred' ? 1 : 1 + rng.int(0, 2),
    xp: 0,
    job: 'rest',
    hp: 1,
    hunger: 0,
    from,
    gen: opts.parents ? Math.max(opts.parents[0].gen, opts.parents[1].gen) + 1 : 1,
    wins: 0,
    losses: 0,
    ...(opts.by ? { by: opts.by } : {}),
    ...(opts.parents ? { parents: [opts.parents[0].id, opts.parents[1].id] as [number, number] } : {}),
  };
  r.beasts.push(b);
  return b;
}

const kindName = (kind: string) => ENEMIES[kind]?.name.toLowerCase() ?? kind;

function lose(s: GameState, b: RanchBeast, how: 'died' | 'sold' | 'lost', text: string): void {
  const r = ranchOf(s);
  r.beasts = r.beasts.filter((x) => x !== b);
  r[how === 'died' ? 'died' : how === 'sold' ? 'sold' : 'lost']++;
  note(s, text, how === 'died' && (b.named || b.wins > 0));
}

/* ------------------------------------------------------------ raids */

/** A raid over (from raids.ts endRaid): the tamed beasts still standing come home; with a ranch and a catcher at home, a
 *  beast left down on the field may be caught; the ranch's own guards that fell are hurt, and may die. */
export function ranchRaidOver(s: GameState, raid: Raid): void {
  if (s.autopilot === false) return;
  const rng = roll(s, `raid:${raid.id}`);
  const r = ranchOf(s);
  for (const rd of raid.raiders) {
    if (rd.ranch === undefined || !(rd.down || rd.hp <= 0)) continue;
    const b = r.beasts.find((x) => x.id === rd.ranch);
    if (!b) continue;
    if (rng.chance(0.25)) lose(s, b, 'died', `${b.name} the ${kindName(b.kind)} died defending the town.`);
    else {
      b.hp = 0.3;
      note(s, `${b.name} the ${kindName(b.kind)} was badly hurt guarding the town.`);
    }
  }
  for (const rd of raid.raiders) {
    if (!rd.ally || rd.tamedBy === undefined || rd.down || rd.gone || rd.ranch !== undefined || !penKind(rd.kind) || ENEMIES[rd.kind]?.boss) continue;
    const tamer = s.people.find((p) => p.id === rd.tamedBy);
    const b = addBeast(s, rd.kind, 'tamed', rng, { by: tamer?.name });
    if (b) {
      b.hp = Math.max(0.3, rd.hp / Math.max(1, rd.maxHp));
      note(s, `${tamer?.name ?? 'The tamer'} leads the tamed ${kindName(b.kind)} home: the ranch calls it ${b.name}.`, true);
    } else notify(s, `The tamed ${kindName(rd.kind)} has nowhere to be kept, and slips away into the wild.`);
  }
  const catcher = operatorOf(s, 'beast_ranch') ?? s.people.find((p) => p.cls === 'beast_tamer' && p.away === null && !p.downed);
  if (ranches(s).length && catcher) {
    for (const rd of raid.raiders) {
      if (rd.ally || !rd.down || !penKind(rd.kind) || ENEMIES[rd.kind]?.boss || !rng.chance(CATCH_DOWNED)) continue;
      const b = addBeast(s, rd.kind, 'caught', rng, { by: catcher.name });
      if (!b) break;
      b.hp = 0.3;
      note(s, `${catcher.name} ropes the stunned ${kindName(b.kind)} and brings it in to the ranch: ${b.name}.`);
    }
  }
}

/** The ranch's guards come out to fight in a raid (from raids.ts startRaid). */
export function ranchAllies(s: GameState, raid: Raid, make: (kind: string) => Raider): number {
  if (s.autopilot === false || !s.ranch) return 0;
  const guards = s.ranch.beasts.filter((b) => b.job === 'guard' && healthy(s, b));
  for (const b of guards) {
    const a = make(b.kind);
    const m = beastMight(b);
    a.maxHp = Math.round(a.maxHp * m.hp);
    a.hp = Math.round(a.maxHp * b.hp);
    a.ranch = b.id;
    raid.raiders.push(a);
  }
  if (guards.length) notify(s, `The ranch's beasts are let out to fight: ${guards.map((b) => b.name).join(', ')}.`);
  return guards.length;
}

/** A rider's blows in a raid (raids.ts): harder for the mount they sit. */
export function mountFight(s: GameState, p: Person): number {
  const b = s.ranch?.beasts.find((x) => x.rider === p.id && x.job === 'ride');
  return b && !b.sick && b.hp >= 0.5 ? rideFight(beastTier(b)) : 1;
}

/** The beast a person rides, if any. */
export const mountOf = (s: GameState, id: number) => s.ranch?.beasts.find((b) => b.rider === id && b.job === 'ride');

/* ------------------------------------------------------------ the day */

export function ranchHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  // (each hour the beasts are set to work afresh: a newcomer needn't wait for the morning, nor a rider long dead)
  // (a pen kept a pack's person in an older save: they are let go)
  const odd = s.ranch?.beasts.filter((b) => !penKind(b.kind));
  if (odd?.length) for (const b of odd) lose(s, b, 'lost', `${b.name} the ${kindName(b.kind)} was let out of the pens.`);
  if (s.ranch?.beasts.length) setJobs(s);
  if (calendar(s.tick).hour !== RANCH_HOUR) return;
  buildRanch(s);
  const r = s.ranch;
  if (!r?.beasts.length) return;
  const rng = roll(s, 'day');
  feed(s, rng);
  live(s, rng);
  breed(s, rng);
  train(s);
  setJobs(s);
  work(s, rng);
  sell(s);
}

/** The town raises a ranch once it has a beast to keep (or a tamer to win one), and a second when the first is full. */
export function buildRanch(s: GameState): void {
  const def = BUILDING_BY_ID.beast_ranch;
  if (!def || !isUnlocked(unlockInfo(s), def)) return;
  const mine = s.buildings.filter((b) => b.def === 'beast_ranch');
  if (mine.some((b) => b.status !== 'done') || mine.length >= RANCHES_MOST) return;
  const grownUps = s.people.filter((p) => !isChild(p)).length;
  if (grownUps < RANCH_PEOPLE) return;
  const held = s.ranch?.beasts.length ?? 0;
  const want = mine.length ? held >= ranchRoom(s) - 1 : held > 0 || s.people.some((p) => p.cls === 'beast_tamer') || grownUps >= RANCH_PEOPLE_UNASKED;
  if (!want) return;
  const stock = totalStock(s);
  if (!Object.entries(def.cost).every(([m, n]) => (stock[m as Material] ?? 0) >= (n ?? 0))) return;
  const at = findSpot(s, def);
  if (at && placeBlueprint(s, def.id, at.x, at.y, false, false, !!at.wild).ok) notify(s, mine.length ? 'The ranch is full: the town lays out a second.' : 'The town lays out a ranch for its beasts.');
}

function foodDays(s: GameState): number {
  const stock = totalStock(s);
  return foodDaysFor(s, Object.entries(FOOD_VALUE).reduce((n, [m, v]) => n + (stock[m as Material] ?? 0) * (v ?? 0), 0));
}

function feed(s: GameState, _rng: Rng): void {
  const r = ranchOf(s);
  for (const b of [...r.beasts]) {
    const want = feedOf(beastTier(b));
    const diet = isGrazer(b.kind) ? [...GRAZER_FOOD, ...MEAT_FOOD] : [...MEAT_FOOD, ...GRAZER_FOOD];
    let got = 0;
    for (const m of diet) {
      if (got >= want) break;
      got += takeFromStorage(s, m as Material, want - got);
    }
    if (got >= want) b.hunger = 0;
    else if (++b.hunger >= HUNGRY_FLEE) lose(s, b, 'lost', `${b.name} the ${kindName(b.kind)}, starved ${b.hunger} days, breaks its pen and runs off.`);
  }
}

function live(s: GameState, rng: Rng): void {
  const r = ranchOf(s);
  const keeper = operatorOf(s, 'beast_ranch');
  const crowded = r.beasts.length > ranchRoom(s);
  for (const b of [...r.beasts]) {
    // mending: a little a day, more with a Beastmaster
    b.hp = Math.min(1, b.hp + (keeper ? 0.35 : 0.2));
    // old age
    const age = ageDays(s, b);
    const life = lifeOf(b);
    if (age >= life || (age >= life * OLD_SHARE && rng.chance(OLD_DEATH))) {
      lose(s, b, 'died', `${b.name} the ${kindName(b.kind)} died of old age at the ranch, ${Math.round(age)} days old.`);
      continue;
    }
    // sickness
    if (b.sick !== undefined) {
      if (s.tick >= b.sick || (keeper && rng.chance(TEND_CURE + (keeper.skills.animals?.level ?? 0) * TEND_PER_LEVEL))) {
        delete b.sick;
        note(s, `${b.name} the ${kindName(b.kind)} is well again${keeper ? `, thanks to ${keeper.name}` : ''}.`);
      } else if (rng.chance(keeper ? SICK_DEATH_TENDED : SICK_DEATH)) {
        lose(s, b, 'died', `${b.name} the ${kindName(b.kind)} died of a sickness at the ranch.`);
        continue;
      }
    } else if (rng.chance((SICK_DAILY + (b.hunger ? SICK_HUNGRY : 0) + (crowded ? SICK_CROWDED : 0)) * traitMult(b, 'sick'))) {
      b.sick = s.tick + SICK_DAYS * TICKS_PER_DAY;
      if (b.job === 'ride') delete b.rider;
      b.job = 'rest';
      note(s, `${b.name} the ${kindName(b.kind)} has sickened.`);
    }
  }
}

function breed(s: GameState, rng: Rng): void {
  const r = ranchOf(s);
  const ready = r.beasts.filter((b) => healthy(s, b) && !b.hunger && ageDays(s, b) < lifeOf(b) * OLD_SHARE);
  const used = new Set<number>();
  for (const a of ready) {
    if (r.beasts.length >= ranchRoom(s)) return;
    if (used.has(a.id) || a.sex !== 'f') continue;
    const mate = ready.find((b) => !used.has(b.id) && b.sex === 'm' && b.kind === a.kind);
    if (!mate) continue;
    used.add(a.id).add(mate.id);
    if (!rng.chance(BREED_DAILY * Math.max(traitMult(a, 'breed'), traitMult(mate, 'breed')))) continue;
    const cub = addBeast(s, a.kind, 'bred', rng, { parents: [a, mate] });
    if (!cub) return;
    r.bred++;
    const keeper = operatorOf(s, 'beast_ranch');
    addDeed(keeper, 'beasts');
    const traits = cub.traits.map((t) => BEAST_TRAITS[t].name.toLowerCase());
    note(s, `A ${kindName(cub.kind)} is born at the ranch to ${a.name} and ${mate.name}: ${cub.name}${traits.length ? ` (${traits.join(', ')})` : ''}.`);
  }
}

function train(s: GameState): void {
  const keeper = operatorOf(s, 'beast_ranch');
  if (!keeper) return;
  for (const b of ranchOf(s).beasts) {
    if (b.sick !== undefined || b.level >= BEAST_LEVEL_MOST) continue;
    b.xp += TRAIN_XP * (1 + (keeper.skills.animals?.level ?? 0) * TRAIN_PER_LEVEL) * traitMult(b, 'train');
    while (b.xp >= LEVEL_XP * b.level && b.level < BEAST_LEVEL_MOST) {
      b.xp -= LEVEL_XP * b.level;
      b.level++;
      if (b.level % 5 === 0) {
        note(s, `${keeper.name} has trained ${b.name} the ${kindName(b.kind)} to level ${b.level}.`);
        addDeed(keeper, 'beasts');
      }
    }
  }
}

/** Who'd ride: the town's fighters, guards first, then by level; never a child. */
function riders(s: GameState): Person[] {
  return s.people
    .filter((p) => p.away === null && !p.downed && !isChild(p) && (p.guard || p.cls))
    .sort((a, b) => Number(!!b.guard) - Number(!!a.guard) || levelOf(b) - levelOf(a) || a.id - b.id);
}

/** The town sets each beast to work: a mount for a fighter, the fiercest to guard, the meat-eaters to hunt, the grazers
 *  to haul. The sick and the young rest. */
export function setJobs(s: GameState): void {
  const r = ranchOf(s);
  const alive = new Set(s.people.map((p) => p.id));
  for (const b of r.beasts) if (b.rider !== undefined && (!alive.has(b.rider) || b.job !== 'ride')) delete b.rider;
  const free = riders(s).filter((p) => !r.beasts.some((b) => b.rider === p.id));
  const ordered = [...r.beasts].sort((a, b) => beastTier(b) * beastMight(b).damage - beastTier(a) * beastMight(a).damage || a.id - b.id);
  let guards = 0;
  for (const b of ordered) {
    if (!healthy(s, b)) {
      if (b.job === 'ride') delete b.rider;
      b.job = 'rest';
      continue;
    }
    if (b.job === 'ride' && b.rider !== undefined) continue;
    if (canRide(b.kind) && free.length && (b.traits.includes('gentle') || b.traits.includes('swift') || guards >= 1)) {
      b.job = 'ride';
      b.rider = free.shift()!.id;
    } else if (!isGrazer(b.kind) && (guards < Math.ceil(r.beasts.length / 3) || b.traits.includes('fierce'))) {
      b.job = 'guard';
      guards++;
    } else b.job = isGrazer(b.kind) && !b.traits.includes('keen') ? 'haul' : 'hunt';
  }
}

function work(s: GameState, rng: Rng): void {
  const r = ranchOf(s);
  const at = ranches(s)[0] ? buildingCentre(ranches(s)[0]) : campXY(s);
  let meat = 0;
  let hide = 0;
  let wood = 0;
  let stone = 0;
  for (const b of r.beasts) {
    if (!healthy(s, b)) continue;
    if (b.job === 'hunt') {
      meat += Math.round(huntOf(beastTier(b)) * traitMult(b, 'hunt'));
      if (rng.chance(HUNT_HIDE)) hide++;
      if (rng.chance(HUNT_HURT)) b.hp = 0.4;
    } else if (b.job === 'haul') {
      const n = Math.round(haulOf(beastTier(b)) * traitMult(b, 'haul'));
      if ((b.id + day(s)) % 2) wood += n;
      else stone += n;
    }
  }
  const got = { ...(meat ? { meat } : {}), ...(hide ? { hide } : {}), ...(wood ? { wood } : {}), ...(stone ? { stone } : {}) };
  if (Object.keys(got).length) {
    const left = depositNear(s, at, got);
    const kept = Object.entries(got).map(([m, n]) => [m, n - (left[m as Material] ?? 0)] as const).filter(([, n]) => n > 0);
    if (kept.length) {
      r.log.unshift(`Day ${day(s)}: the beasts brought in ${kept.map(([m, n]) => `${n} ${m}`).join(', ')}.`);
      if (r.log.length > LOG_KEPT) r.log.length = LOG_KEPT;
    }
  }
}

/** The town sells what it can't keep: over the room, the old past use, or when food runs short. Never one the player
 *  has forbidden it to sell. */
function sell(s: GameState): void {
  const r = ranchOf(s);
  const sellable = () => r.beasts.filter((b) => !b.keep).sort((a, b) => beastPrice(a) - beastPrice(b) || a.id - b.id);
  const hungry = foodDays(s) < SELL_FOOD_DAYS;
  let n = 0;
  while (n < 2 && (r.beasts.length > ranchRoom(s) || (hungry && n === 0))) {
    const b = sellable()[0];
    if (!b) break;
    const coins = beastPrice(b);
    s.coins = (s.coins ?? 0) + coins;
    earn(s, 'ranch', coins);
    lose(s, b, 'sold', `The town sells ${b.name} the ${kindName(b.kind)} to a passing drover for ${coins} coins${hungry ? ': there is too little food to keep it' : ''}.`);
    n++;
  }
  // (the old, still fit, are sold before they die on the ranch's hands)
  for (const b of sellable()) if (ageDays(s, b) >= lifeOf(b) * 0.9 && n++ < 3) {
    const coins = Math.round(beastPrice(b) / 2);
    s.coins = (s.coins ?? 0) + coins;
    earn(s, 'ranch', coins);
    lose(s, b, 'sold', `${b.name} the ${kindName(b.kind)}, old and slow now, is sold to a farm down the valley for ${coins} coins.`);
  }
}

/* ------------------------------------------------------------ the player */

/** Name a beast, or forbid (or allow) its sale. */
export function ranchCommand(s: GameState, id: number, op: 'name' | 'keep', name?: string, keep?: boolean): boolean {
  const b = s.ranch?.beasts.find((x) => x.id === id);
  if (!b) return false;
  if (op === 'name') {
    const n = (name ?? '').trim().slice(0, 24);
    if (!n) return false;
    b.name = n;
    b.named = true;
    return true;
  }
  b.keep = !!keep;
  return true;
}

/* ------------------------------------------------------------ the menu */

export interface BeastView {
  id: number;
  kind: string;
  kindName: string;
  name: string;
  named: boolean;
  sex: 'm' | 'f';
  age: number;
  life: number;
  old: boolean;
  young: boolean;
  traits: { id: TraitId; name: string; text: string; bad: boolean }[];
  level: number;
  /** Share of the way to the next level. */
  toNext: number;
  job: BeastJob;
  doing: string;
  rider: { id: number; name: string } | null;
  hp: number;
  sick: boolean;
  hunger: number;
  keep: boolean;
  from: string;
  parents: string[];
  gen: number;
  price: number;
  tier: number;
  wins: number;
  losses: number;
  crowns: number;
  eats: string;
}

export interface RanchView {
  beasts: BeastView[];
  room: number;
  ranches: number;
  keeper: { id: number; name: string; animals: number } | null;
  log: string[];
  bred: number;
  sold: number;
  died: number;
  lost: number;
}

export function ranchView(s: GameState): RanchView | null {
  const r = s.ranch;
  if (!r && !ranches(s).length) return null;
  const keeper = operatorOf(s, 'beast_ranch');
  return {
    beasts: (r?.beasts ?? []).map((b) => {
      const age = ageDays(s, b);
      const parents = (b.parents ?? []).map((id) => r!.beasts.find((x) => x.id === id)?.name ?? 'one long gone');
      const rider = b.rider !== undefined ? s.people.find((p) => p.id === b.rider) : undefined;
      return {
        id: b.id,
        kind: b.kind,
        kindName: ENEMIES[b.kind]?.name ?? b.kind,
        name: b.name,
        named: !!b.named,
        sex: b.sex,
        age: Math.floor(age),
        life: lifeOf(b),
        old: age >= lifeOf(b) * OLD_SHARE,
        young: !grown(s, b),
        traits: b.traits.map((t) => ({ id: t, name: BEAST_TRAITS[t].name, text: BEAST_TRAITS[t].text, bad: !!BEAST_TRAITS[t].bad })),
        level: b.level,
        toNext: b.level >= BEAST_LEVEL_MOST ? 1 : Math.min(1, b.xp / (LEVEL_XP * b.level)),
        job: b.job,
        doing: b.sick !== undefined ? 'Sick' : !grown(s, b) ? 'Too young to work' : b.job === 'ride' && rider ? `Ridden by ${rider.name}` : JOB_NAMES[b.job],
        rider: rider ? { id: rider.id, name: rider.name } : null,
        hp: Math.round(b.hp * 100) / 100,
        sick: b.sick !== undefined,
        hunger: b.hunger,
        keep: !!b.keep,
        from: b.from === 'tamed' ? `Tamed in a raid${b.by ? ` by ${b.by}` : ''}` : b.from === 'caught' ? `Caught on the field${b.by ? ` by ${b.by}` : ''}` : `Born at the ranch`,
        parents,
        gen: b.gen,
        price: beastPrice(b),
        tier: Math.round(beastTier(b) * 10) / 10,
        wins: b.wins,
        losses: b.losses,
        crowns: b.crowns ?? 0,
        eats: isGrazer(b.kind) ? 'grain and greens' : 'meat and fish',
      };
    }),
    room: ranchRoom(s),
    ranches: ranches(s).length,
    keeper: keeper ? { id: keeper.id, name: keeper.name, animals: keeper.skills.animals?.level ?? 0 } : null,
    log: r?.log ?? [],
    bred: r?.bred ?? 0,
    sold: r?.sold ?? 0,
    died: r?.died ?? 0,
    lost: r?.lost ?? 0,
  };
}

/** Where a beast is drawn on the map: its ranch's ground (by its id), else by the camp's fire. */
export function beastHome(s: GameState, b: RanchBeast): { x: number; y: number; w: number; h: number } {
  const rs = ranches(s);
  if (!rs.length) {
    const c = campXY(s);
    return { x: c.x - 48, y: c.y + 24, w: 96, h: 24 };
  }
  const i = Math.max(0, ranchOf(s).beasts.indexOf(b));
  const f = footprint(rs[Math.min(rs.length - 1, Math.floor(i / RANCH_ROOM))]);
  return { x: f.x * 32 + 10, y: f.y * 32 + 14, w: f.w * 32 - 20, h: f.h * 32 - 24 };
}
