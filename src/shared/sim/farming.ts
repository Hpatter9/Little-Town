// Fields (DESIGN §15): someone with the Farm job sows a fallow field, it grows by itself (faster in summer,
// not at all in winter), and when it's ripe a farmer harvests it into storage and sows it again.
// Phase 4: the soil tires with each harvest and rests while fallow, mended by muck from the pens (a tired field is left
// to rest unless the town is hungry); blight strikes now and then, worst where one crop is grown everywhere; orchards
// take a few seasons to bear, then fruit without sowing; nobody sows in autumn what can't ripen before winter; and at
// the turn of winter the town holds a harvest home if the stores are full (or goes short-tempered if they're not).

import { earlier } from '../data/eras';
import { eraOfResearch } from '../data/research';
import { BLIGHT, CROPS, SEASON_GROWTH, SOIL, WORKPLACES, YIELD_PER_LEVEL } from '../data/crops';
import { HERDS } from '../data/livestock';
import { FOOD_VALUE } from '../data/people';
import type { Rng } from '../rng';
import { weatherAt } from './weather';
import type { Material, Stock } from '../data/materials';
import { skillSpeed } from '../data/skills';
import { buildingCentreX, depositNear, totalStock } from './buildings';
import { toolSpeed } from './crafting';
import { holds } from './operators';
import { HOLDER_EDGE } from '../data/operators';
import { modifiers } from './research';
import { doomGrowth } from './doom';
import { biomeOf } from '../data/biomes';
import { BUILDING_BY_ID, RIVER_GROWTH, RIVER_TILES } from '../data/buildings';
import { generateWorld } from '../world';
import { addStock, foodDaysFor, carryCapacity, ERA_MULTIPLIER, notify, poolSize, type Building, type GameState, type Person } from './state';
import { calendar, DAYS_PER_SEASON, TICK_HZ, TICKS_PER_HOUR } from './time';
import { gainSkill, workFactor } from './townsfolk';
import { cropSpeed } from './origin';

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
    const def = CROPS[b.def];
    const indoor = def.indoor;
    const seasonal = def.hardy && season === 'autumn' ? 1 : SEASON_GROWTH[season];
    const outside = indoor ? 1 : seasonal * doomGrowth(s) * biomeOf(s).crops * cropSpeed(s) * (byRiver(s, b) ? RIVER_GROWTH : 1);
    // (crops are food, and people eat on the same clock in every era: growing isn't stretched by the era)
    // (young trees take their while to come into bearing, the first time)
    const hours = def.growHours + (def.establishHours && !c.bearing ? def.establishHours : 0);
    c.growth += (outside * speed) / (hours * TICKS_PER_HOUR);
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
  let hungry: boolean | undefined;
  for (const b of s.buildings) {
    if (!isField(b)) continue;
    const c = cropOf(b);
    if (c.stage === 'growing') continue;
    // nothing grows in winter, so there's no point sowing then, nor in autumn what can't ripen before it; and a tired
    // field is left to rest while the town has food
    if (c.stage === 'fallow' && !CROPS[b.def].indoor) {
      if (!ripensInTime(s, b)) continue;
      if ((c.soil ?? SOIL.start) < SOIL.tired && (hungry ??= foodDays(s) < 2) === false) continue;
    }
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
    const soil = def.indoor ? 1 : (c.soil ?? SOIL.start);
    const n = Math.round(def.yield * soil * (1 + (p.skills.farming.level - 1) * YIELD_PER_LEVEL) * (greenThumb(p) ? 1.25 : 1));
    // the farmer carries what they can; the rest goes straight into the nearest store
    const carry = Math.min(n, Math.max(0, carryCapacity(s, p) - poolSize(p.carrying)));
    addStock(p.carrying, def.material, carry);
    if (n > carry) depositNear(s, buildingCentreX(b), { [def.material]: n - carry });
    c.growth = 0;
    if (def.establishHours) {
      // (the trees fruit again next year: nothing to sow)
      c.bearing = true;
      c.stage = 'growing';
    } else {
      c.stage = 'fallow';
      if (!def.indoor) c.soil = Math.max(SOIL.min, soil - SOIL.drain * modifiers(s.research).soil);
    }
    gainSkill(p, 'farming', HARVEST_XP);
  }
  return true;
}

/** Days of food in store for everyone who eats. */
function foodDays(s: GameState): number {
  const stock = totalStock(s);
  const food = Object.entries(FOOD_VALUE).reduce((n, [m, v]) => n + (stock[m as Material] ?? 0) * (v ?? 0), 0);
  return foodDaysFor(s, food);
}

/** Whether a crop sown now would ripen before winter stops it (always, indoors; never, in winter). */
export function ripensInTime(s: GameState, b: Building): boolean {
  const def = CROPS[b.def];
  if (def.indoor) return true;
  const cal = calendar(s.tick);
  if (cal.season === 'winter') return false;
  if (cal.season !== 'autumn' || def.establishHours) return true;
  const left = (DAYS_PER_SEASON - cal.dayOfSeason) * 24 + (24 - cal.hour);
  const speed = (def.hardy ? 1 : SEASON_GROWTH.autumn) * modifiers(s.research).cropSpeed * cropSpeed(s) * biomeOf(s).crops;
  return left * speed >= def.growHours;
}

/** Once a day, at dawn: the soil rests and is mucked, blight may strike, and at the turn of winter, the harvest home. */
export function tendFields(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const cal = calendar(s.tick);
  if (cal.hour !== 6) return;
  const fields = s.buildings.filter((b) => isField(b) && !CROPS[b.def].indoor);
  if (cal.season === 'winter' && cal.dayOfSeason === 1) harvestHome(s);
  if (!fields.length) return;
  const pens = s.buildings.filter((b) => b.status === 'done' && HERDS[b.def] && (b.herd?.head ?? 0) > 0).length;
  const muck = Math.min(SOIL.manureMax, pens * SOIL.manurePerPen);
  const soilMod = modifiers(s.research).soil;
  for (const b of fields) {
    const c = cropOf(b);
    const resting = c.stage === 'fallow' || cal.season === 'winter';
    c.soil = Math.min(SOIL.max, Math.max(SOIL.min, (c.soil ?? SOIL.start) + (resting ? SOIL.restPerDay : 0) + muck));
  }
  // blight: in the ground, outside, in the growing seasons (it spreads between fields of the same crop)
  if (cal.season === 'winter') return;
  const kind = weatherAt(s.seed, s.tick, s.doom?.phase === 'active' ? s.doom.kind : null).kind;
  const wet = kind === 'rain' || kind === 'storm' || kind === 'fog' ? BLIGHT.wet : 1;
  for (const b of fields) {
    const c = cropOf(b);
    if (c.stage !== 'growing' || (c.growth < 0.05 && !c.bearing)) continue;
    const same = fields.filter((o) => o.def === b.def).length;
    const trees = CROPS[b.def].establishHours ? BLIGHT.trees : 1;
    if (!rng.chance(BLIGHT.chance * wet * (1 + BLIGHT.perSame * (same - 1)) * soilMod * trees)) continue;
    const hit = [b, ...fields.filter((o) => o !== b && o.def === b.def && cropOf(o).stage !== 'fallow' && rng.chance(BLIGHT.spread))];
    for (const f of hit) blight(f);
    const name = BUILDING_BY_ID[b.def].name.toLowerCase();
    const lost = CROPS[b.def].establishHours ? "this year's fruit is lost" : 'the crop is lost';
    notify(s, hit.length > 1 ? `Blight! It spread through ${hit.length} of the town's ${name}s, and ${lost}.` : `Blight struck the ${name}: ${lost}.`, true);
    break; // (one outbreak a day)
  }
}

/** A blighted field loses its crop (trees lose this year's fruit, but live). */
function blight(b: Building): void {
  const c = cropOf(b);
  c.work = 0;
  // (young trees are set back, not killed)
  if (CROPS[b.def].establishHours) c.growth = c.bearing ? 0 : c.growth / 2;
  else {
    c.growth = 0;
    c.stage = 'fallow';
  }
}

/** Morale at the turn of winter: a feast if the stores are full, grumbling if they're thin. */
export const HARVEST_HOME = { days: 3, lean: 1.5, feast: 6, grumble: -5, hours: 36 } as const;
function harvestHome(s: GameState): void {
  if (!s.buildings.some((b) => isField(b) && !CROPS[b.def].indoor) || !s.people.length) return;
  const days = foodDays(s);
  if (days >= HARVEST_HOME.days) {
    (s.marks ??= []).push({ lever: 'morale', value: HARVEST_HOME.feast, until: s.tick + HARVEST_HOME.hours * TICKS_PER_HOUR, text: 'The harvest home' });
    notify(s, `The harvest is in: the town feasts at the harvest home, with ${Math.floor(days)} days' food put by for the winter.`, true);
  } else if (days < HARVEST_HOME.lean) {
    (s.marks ??= []).push({ lever: 'morale', value: HARVEST_HOME.grumble, until: s.tick + HARVEST_HOME.hours * TICKS_PER_HOUR, text: 'A thin harvest' });
    notify(s, 'A thin harvest: winter comes with the stores nearly bare.', true);
  }
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
  progress.work += (skillSpeed(p.skills.gathering.level) * toolSpeed(p, 'mine') * modifiers(s.research).gather.mine * workFactor(s, p) * (holds(p, b) ? HOLDER_EDGE : 1)) / (w.seconds * ERA_MULTIPLIER[earlier(s.era, eraOfResearch(BUILDING_BY_ID[b.def].research))] * TICK_HZ);
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
