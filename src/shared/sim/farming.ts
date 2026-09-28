// Fields (DESIGN §15): someone with the Farm job sows a fallow field, it grows by itself (faster in summer,
// not at all in winter), and when it's ripe a farmer harvests it into storage and sows it again.

import { CROPS, SEASON_GROWTH, WORKPLACES, YIELD_PER_LEVEL } from '../data/crops';
import type { Material, Stock } from '../data/materials';
import { skillSpeed } from '../data/skills';
import { buildingCentreX, depositNear } from './buildings';
import { toolSpeed } from './crafting';
import { modifiers } from './research';
import { doomGrowth } from './doom';
import { biomeOf } from '../data/biomes';
import { BUILDING_BY_ID, RIVER_GROWTH, RIVER_TILES } from '../data/buildings';
import { generateWorld } from '../world';
import { addStock, carryCapacity, ERA_MULTIPLIER, poolSize, type Building, type GameState, type Person } from './state';
import { calendar, TICK_HZ, TICKS_PER_HOUR } from './time';
import { gainSkill, workFactor } from './townsfolk';

const FARM_XP_PER_SEC = 2;
const HARVEST_XP = 20;

export const isField = (b: Building) => !!CROPS[b.def] && b.status === 'done';

/** A field's crop state (fields finished before crops existed start fallow). */
export function cropOf(b: Building): NonNullable<Building['crop']> {
  b.crop ??= { stage: 'fallow', growth: 0, work: 0 };
  return b.crop;
}

/** Where the rivers run, per world (they never change, so work them out once). */
const riverCache = new Map<string, number[]>();
/** A field beside a river grows faster. */
export function byRiver(s: GameState, b: Building): boolean {
  const key = `${s.seed}|${s.biome ?? 'forest'}`;
  let rivers = riverCache.get(key);
  if (!rivers) {
    rivers = generateWorld(s.seed, s.biome).rivers;
    riverCache.set(key, rivers);
  }
  const mid = b.tile + BUILDING_BY_ID[b.def].width / 2;
  return rivers.some((r) => Math.abs(r - mid) <= RIVER_TILES);
}

/** Every tick: crops grow. */
export function growCrops(s: GameState): void {
  const season = calendar(s.tick).season;
  let speed: number | null = null;
  for (const b of s.buildings) {
    if (!isField(b)) continue;
    const c = cropOf(b);
    if (c.stage !== 'growing') continue;
    speed ??= modifiers(s.research).cropSpeed;
    // indoor fields (hydroponics) don't care about the season or the weather
    const indoor = CROPS[b.def].indoor;
    const outside = indoor ? 1 : SEASON_GROWTH[season] * doomGrowth(s) * biomeOf(s).crops * (byRiver(s, b) ? RIVER_GROWTH : 1);
    // (crops are food, and people eat on the same clock in every era: growing isn't stretched by the era)
    c.growth += (outside * speed) / (CROPS[b.def].growHours * TICKS_PER_HOUR);
    if (c.growth >= 1) {
      c.growth = 1;
      c.stage = 'ripe';
      c.work = 0;
    }
  }
}

/** A field needing hands (fallow or ripe), nearest first, that no other farmer is working. */
export function fieldToWork(s: GameState, p: Person): Building | null {
  let best: Building | null = null;
  for (const b of s.buildings) {
    if (!isField(b)) continue;
    const c = cropOf(b);
    if (c.stage === 'growing') continue;
    // nothing grows in winter, so there's no point sowing then
    if (c.stage === 'fallow' && calendar(s.tick).season === 'winter' && !CROPS[b.def].indoor) continue;
    if (s.people.some((o) => o !== p && o.task?.type === 'farm' && o.task.building === b.id)) continue;
    if (!best || Math.abs(buildingCentreX(b) - p.x) < Math.abs(buildingCentreX(best) - p.x)) best = b;
  }
  return best;
}

/** One tick of sowing or harvesting. Returns true when the job is done. */
export function workField(s: GameState, p: Person, b: Building): boolean {
  const def = CROPS[b.def];
  const c = cropOf(b);
  const seconds = c.stage === 'ripe' ? def.harvestSeconds : def.sowSeconds;
  c.work += (skillSpeed(p.skills.farming.level) * workFactor(s, p) * (greenThumb(p) ? 1.25 : 1)) / (seconds * TICK_HZ);
  gainSkill(p, 'farming', FARM_XP_PER_SEC / TICK_HZ);
  if (c.work < 1) return false;
  c.work = 0;
  if (c.stage === 'fallow') {
    c.stage = 'growing';
    c.growth = 0;
  } else {
    const n = Math.round(def.yield * (1 + (p.skills.farming.level - 1) * YIELD_PER_LEVEL) * (greenThumb(p) ? 1.25 : 1));
    // the farmer carries what they can; the rest goes straight into the nearest store
    const carry = Math.min(n, Math.max(0, carryCapacity(s, p) - poolSize(p.carrying)));
    addStock(p.carrying, def.material, carry);
    if (n > carry) depositNear(s, buildingCentreX(b), { [def.material]: n - carry });
    c.stage = 'fallow';
    c.growth = 0;
    gainSkill(p, 'farming', HARVEST_XP);
  }
  return true;
}

const greenThumb = (p: Person) => p.traits.includes('green_thumb');

/* ------------------------------------------------------------ mines */

/** A mine with room for another digger (nearest first). Gatherers use it when no tiles are marked. */
export function mineToWork(s: GameState, p: Person): Building | null {
  let best: Building | null = null;
  for (const b of s.buildings) {
    if (b.status !== 'done' || !WORKPLACES[b.def]) continue;
    const diggers = s.people.filter((o) => o !== p && o.task?.type === 'mine' && o.task.building === b.id).length;
    if (diggers >= WORKPLACES[b.def].workers) continue;
    if (!best || Math.abs(buildingCentreX(b) - p.x) < Math.abs(buildingCentreX(best) - p.x)) best = b;
  }
  return best;
}

/** One tick of digging. Returns true when a load is dug out (it goes into the digger's hands). */
export function workMine(s: GameState, p: Person, b: Building, progress: { work: number }): boolean {
  const w = WORKPLACES[b.def];
  progress.work += (skillSpeed(p.skills.gathering.level) * toolSpeed(p, 'mine') * modifiers(s.research).gather.mine * workFactor(s, p)) / (w.seconds * ERA_MULTIPLIER[s.era] * TICK_HZ);
  gainSkill(p, 'gathering', FARM_XP_PER_SEC / TICK_HZ);
  if (progress.work < 1) return false;
  progress.work = 0;
  const room = Math.max(0, carryCapacity(s, p) - poolSize(p.carrying));
  let left = room;
  const spill: Stock = {};
  for (const [m, n] of Object.entries(w.outputs) as [Material, number][]) {
    const k = Math.min(n, left);
    addStock(p.carrying, m, k);
    left -= k;
    if (n > k) spill[m] = n - k;
  }
  if (poolSize(spill)) depositNear(s, buildingCentreX(b), spill);
  gainSkill(p, 'gathering', HARVEST_XP);
  return true;
}
