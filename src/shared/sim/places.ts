// The places on the town's land (data/places.ts). They're seeded from the town's seed over the land, found when the
// known land reaches them, and either looked over by the town itself (a vein becomes rich rock to dig; ruins, bones
// and a cart give what they hold) or left for a party the player picks (a cave, a beast's lair, a cart with its
// robbers still about): a trip to it from the Expedition Board, fought on the way-and-there as any trip, and its
// hoard home with the party when cleared.

import { Rng, hashSeed } from '../rng';
import { BIOME_BEASTS, BEAST_DAYS, CART_ROBBED, LOOK_HOURS, PLACE_APART, PLACE_COUNT, PLACE_DEFS, PLACE_FAR, PLACE_FOES, PLACE_NEAR, PLACE_SECONDS_PER_CELL, directionName, isPlaceDest, placeDestId, placeIdOf, type PlaceKind } from '../data/places';
import type { Destination } from '../data/expeditions';
import type { Material } from '../data/materials';
import { ERAS } from '../data/eras';
import { CELL, groundAt, inMap, isOpen, setGround, WILD, type LandMap, type Pt } from './land';
import { addStock, campCell, earn, notify, type GameState } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { depositNear } from './buildings';
import { packLairCleared } from './pack';

export interface MapPlace {
  id: number;
  kind: PlaceKind;
  /** Its cell. */
  x: number;
  y: number;
  /** When it was found (null: still in the unknown), and what became of it. */
  found: number | null;
  state: 'waiting' | 'done' | 'gone';
  /** A fight place: who waits there (rolled when found). */
  foes?: Record<string, number>;
  /** A peaceful place: when the town has looked it over. */
  lookedAt?: number;
}

/** The places a land holds, from the seed: scattered round the camp, none too near another, on dry land. */
export function seedPlaces(land: LandMap, seed: string): MapPlace[] {
  const rng = Rng.from(hashSeed(seed), 0x51);
  const camp = land.camp;
  const out: MapPlace[] = [];
  const weights = Object.fromEntries(Object.values(PLACE_DEFS).map((d) => [d.kind, d.weight])) as Record<PlaceKind, number>;
  for (let tries = 0; tries < 400 && out.length < PLACE_COUNT; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(PLACE_NEAR, PLACE_FAR);
    const x = Math.round(camp.x + Math.cos(a) * r);
    const y = Math.round(camp.y + Math.sin(a) * r);
    if (!inMap(land, x, y) || x < 2 || y < 2 || x >= land.w - 2 || y >= land.h - 2) continue;
    if (groundAt(land, x, y) === 'water') continue;
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < PLACE_APART)) continue;
    const kind = rng.weighted(weights);
    // (a vein lies in rock or hills; a cave in a hillside)
    if ((kind === 'vein' || kind === 'cave') && !['rock', 'hill', 'forest'].includes(groundAt(land, x, y))) continue;
    out.push({ id: out.length + 1, kind, x, y, found: null, state: 'waiting' });
  }
  return out;
}

const places = (s: GameState): MapPlace[] => (s.places ??= seedPlaces(s.land, s.seed));
export const placeById = (s: GameState, id: number) => (s.places ?? []).find((p) => p.id === id);

/** The foes that wait at a fight place when it's found. */
function rollFoes(s: GameState, kind: PlaceKind, rng: Rng): Record<string, number> {
  const table = PLACE_FOES[kind as 'cave' | 'beast' | 'cart'];
  const era = ERAS.includes(s.era) ? s.era : 'neolithic';
  let groups = table[era] ?? table.neolithic!;
  if (kind === 'beast' && s.biome && BIOME_BEASTS[s.biome]) groups = [...groups, ...BIOME_BEASTS[s.biome]];
  return { ...rng.pick(groups) };
}

/** Once an hour: places the open land has reached are found; the peaceful ones are looked over a little later; a
 *  beast left alone long enough wanders off. */
export function placesHourly(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver) return;
  const camp = campCell(s);
  for (const p of places(s)) {
    if (p.state !== 'waiting') continue;
    if (p.found === null) {
      if (!isOpen(s.land, p.x, p.y)) continue;
      p.found = s.tick;
      const def = PLACE_DEFS[p.kind];
      const where = directionName(p.x - camp.x, p.y - camp.y);
      if (p.kind === 'cart' && rng.chance(CART_ROBBED)) p.foes = rollFoes(s, 'cart', rng);
      else if (def.fight) p.foes = rollFoes(s, p.kind, rng);
      const danger = p.foes ? ` ${describeFoes(p.foes)} ${Object.values(p.foes).reduce((n, k) => n + k, 0) > 1 ? 'are' : 'is'} there: pick a party under Expeditions to deal with it.` : '';
      notify(s, `${def.name} found to the ${where}. ${def.found}${danger}`, true);
      if (!p.foes) p.lookedAt = s.tick + LOOK_HOURS * TICKS_PER_HOUR;
      continue;
    }
    if (!p.foes && p.lookedAt !== undefined && s.tick >= p.lookedAt) lookOver(s, p, rng);
    else if (p.foes && p.kind === 'beast' && s.tick - p.found > BEAST_DAYS * TICKS_PER_DAY) {
      p.state = 'gone';
      notify(s, `The beast has left its lair to the ${directionName(p.x - camp.x, p.y - camp.y)}: nobody went after it.`, true);
    }
  }
}

/** The town has looked a peaceful place over: what it gives. */
function lookOver(s: GameState, p: MapPlace, rng: Rng): void {
  const def = PLACE_DEFS[p.kind];
  const camp = campCell(s);
  const where = directionName(p.x - camp.x, p.y - camp.y);
  p.state = 'done';
  if (p.kind === 'beast') packLairCleared(s); // (a beast's lair: renown for the Moon Pack)
  const at = { x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL };
  switch (p.kind) {
    case 'vein': {
      // the rock round it is rich: stone, iron ore and coal to dig (the planner marks it like any wild land)
      let cells = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = p.x + dx;
          const y = p.y + dy;
          if (!inMap(s.land, x, y) || groundAt(s.land, x, y) === 'water') continue;
          if (dx && dy && rng.chance(0.5)) continue;
          if (!WILD.includes(groundAt(s.land, x, y))) setGround(s.land, x, y, 'rock');
          s.land.pools[y * s.land.w + x] = { stone: rng.int(6, 10), iron_ore: rng.int(4, 8), coal: rng.int(2, 5) };
          cells++;
        }
      notify(s, `The ore vein to the ${where} is rich: ${cells} patches of rock worth digging for iron and coal.`, true);
      return;
    }
    case 'ruin': {
      // old writings: half the topic being studied, else a few coins
      const r = s.research;
      const topic = r.queue[0];
      const coins = rng.int(def.coins[0], def.coins[1]);
      if (coins) earn(s, 'events', coins);
      if (topic) {
        const prog = r.progress[topic] ?? 0;
        r.progress[topic] = prog + (1 - prog) / 2;
        notify(s, `Among the ruins to the ${where}: carvings that bear on ${topic.replace(/_/g, ' ')}, and ${coins} old coins.`, true);
      } else notify(s, `Among the ruins to the ${where}: ${coins} old coins, and little else.`, true);
      depositNear(s, at, { ...def.hoard });
      return;
    }
    case 'bones':
      depositNear(s, at, { ...def.hoard });
      notify(s, `The great bones to the ${where} are worth having: ${def.hoard.bone} bone brought home.`, true);
      return;
    case 'cart': {
      const coins = rng.int(def.coins[0], def.coins[1]);
      earn(s, 'events', coins);
      const goods: Partial<Record<Material, number>> = { cloth: rng.int(1, 3), rations: rng.int(1, 2) };
      depositNear(s, at, goods);
      notify(s, `The cart to the ${where} was picked over: ${coins} coins and some goods, and no sign of whoever did it.`, true);
      return;
    }
    default:
      return;
  }
}

/** A fight place as a destination on the Expedition Board. */
export function placeDestination(s: GameState, p: MapPlace): Destination {
  const def = PLACE_DEFS[p.kind];
  const camp = campCell(s);
  const cells = Math.max(4, Math.hypot(p.x - camp.x, p.y - camp.y));
  const where = directionName(p.x - camp.x, p.y - camp.y);
  return {
    id: placeDestId(p.id),
    name: `${def.name} to the ${where}`,
    type: 'clear',
    outSeconds: Math.round(cells * PLACE_SECONDS_PER_CELL),
    workSeconds: 30,
    secondsPerUnit: 8,
    loot: def.loot,
    threats: p.foes ? describeFoes(p.foes) : 'Nothing, now',
    encounters: { arrival: p.foes ? 1 : 0, ambush: 0, groups: [{ enemies: p.foes ?? {}, weight: 1 }] },
    recommendedParty: def.party,
    scenery: def.scenery,
    description: `${def.found} On the town's own land: a short walk, and a fight at the end of it.`,
  };
}

/** The fight places waiting on the board. */
export const placeDestinations = (s: GameState): Destination[] => (s.places ?? []).filter((p) => p.found !== null && p.state === 'waiting' && p.foes).map((p) => placeDestination(s, p));

/** The place a trip's destination stands for, if it's one. */
export const placeOfDest = (s: GameState, dest: string): MapPlace | undefined => (isPlaceDest(dest) ? placeById(s, placeIdOf(dest)) : undefined);

/** A party cleared a place: its hoard and coins go with them, and it's done (a cave stays, empty). */
export function placeCleared(s: GameState, dest: string, loot: Partial<Record<Material, number>>, rng: Rng): void {
  const p = placeOfDest(s, dest);
  if (!p || p.state !== 'waiting') return;
  const def = PLACE_DEFS[p.kind];
  p.state = 'done';
  for (const [m, n] of Object.entries(def.hoard) as [Material, number][]) addStock(loot, m, n);
  const coins = rng.int(def.coins[0], def.coins[1]);
  if (coins) earn(s, 'events', coins);
  const camp = campCell(s);
  notify(s, `The ${def.name.toLowerCase()} to the ${directionName(p.x - camp.x, p.y - camp.y)} is cleared${coins ? `: ${coins} coins among the leavings` : ''}.`, true);
}

/** "2 wolves and a wolf pack alpha". */
export function describeFoes(group: Record<string, number>): string {
  const parts = Object.entries(group).map(([k, n]) => `${n === 1 ? (/^[aeiou]/i.test(k) ? 'an' : 'a') : n} ${k.replace(/_/g, ' ')}${n > 1 ? 's' : ''}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? 'nothing');
}

/** A place's middle on the land, in px. */
export const placeXY = (p: MapPlace): Pt => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL });
