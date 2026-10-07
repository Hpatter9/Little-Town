// The scenes a watched fight can play out in (renderer/art/fightBackdrop.ts paints them): 17 out in the land and 8
// inside dungeons. Which one: by the destination, whether the party is on the road (the land on the way) or there
// (inside, for a dungeon), and the town's biome (the green ones become sand, snow or shore).

import type { BackdropId } from './backdrops';
import { BESTIARY_ROUTES } from './bestiary';
import { SCOUT_ROUTES } from './regions';
import { TRADE_ROUTES } from './minerals';
import { ISLAND_ROUTES } from './boats';
import { DUNGEON_ROUTES } from './dungeons';
import { FACTION_DEFS } from './factions';
import { biomeById, type Biome } from './biomes';

export const SCENES = [
  // out in the land
  'meadow', 'riverbank', 'pinewoods', 'quarry', 'highlands', 'ruins', 'bandit_camp', 'burned_village', 'coal_fields', 'mill_yard',
  'oil_fields', 'ghost_city', 'compound', 'crater', 'dunes', 'tundra', 'coast', 'fen', 'jungle', 'ashland', 'steppe',
  // inside
  'cave', 'keep', 'dragon_den', 'crypt', 'vault', 'ship_hold', 'factory', 'bunker',
] as const;
export type SceneId = (typeof SCENES)[number];

/** Each destination's scene on the road there, and at it (inside, for a dungeon). */
export const ROUTES: Record<string, [SceneId, SceneId]> = {
  // (the new bosses' lairs: data/bestiary.ts)
  ...BESTIARY_ROUTES,
  ...SCOUT_ROUTES,
  ...TRADE_ROUTES,
  ...DUNGEON_ROUTES,
  ...ISLAND_ROUTES,
  // (assaults: a power's stronghold, the road there and inside its walls; a dungeon stormed as it is delved)
  ...Object.fromEntries(FACTION_DEFS.map((f) => [`assault:${f.id}`, [f.road, f.inside] as [SceneId, SceneId]])),
  ...Object.fromEntries(Object.entries(DUNGEON_ROUTES).map(([id, r]) => [`assault:dungeon:${id}`, r])),
  berry_thicket: ['meadow', 'meadow'],
  riverbank: ['riverbank', 'riverbank'],
  deep_woods: ['pinewoods', 'pinewoods'],
  old_quarry: ['meadow', 'quarry'],
  bear_cave: ['highlands', 'cave'],
  iron_hills: ['highlands', 'highlands'],
  old_ruins: ['ruins', 'crypt'],
  bandit_camp: ['pinewoods', 'bandit_camp'],
  lost_village: ['riverbank', 'burned_village'],
  coal_fields: ['highlands', 'coal_fields'],
  abandoned_mill: ['mill_yard', 'factory'],
  gang_hideout: ['ghost_city', 'bunker'],
  oil_fields: ['dunes', 'oil_fields'],
  ghost_city: ['ghost_city', 'ghost_city'],
  militia_compound: ['ghost_city', 'compound'],
  crater: ['highlands', 'crater'],
  fallen_satellite: ['pinewoods', 'crater'],
  rogue_foundry: ['crater', 'vault'],
  dark_keep: ['burned_village', 'keep'],
  dragon_lair: ['highlands', 'dragon_den'],
  baron_manor: ['coal_fields', 'factory'],
  warlord_fort: ['compound', 'bunker'],
  pirate_flagship: ['coast', 'ship_hold'],
};
const OLD_SCENERY: Record<string, SceneId> = { thicket: 'meadow', river: 'riverbank', woods: 'pinewoods', quarry: 'quarry', cave: 'cave' };
/** The green scenes take the town's own land: sand, snow, shore, fen, jungle, ash or steppe (`scenes` in data/biomes.ts). */
const biomeSwap = (biome: Biome, id: SceneId): SceneId => (biomeById(biome).scenes[id] as SceneId | undefined) ?? id;
export const INDOOR_SCENES: ReadonlySet<SceneId> = new Set<SceneId>(['cave', 'keep', 'dragon_den', 'crypt', 'vault', 'ship_hold', 'factory', 'bunker']);

export function sceneFor(dest: string, scenery: string, phase: string, biome: Biome | undefined): SceneId {
  const route = ROUTES[dest];
  let id: SceneId = route ? (phase === 'work' ? route[1] : route[0]) : (OLD_SCENERY[scenery] ?? 'meadow');
  if (biome && !INDOOR_SCENES.has(id)) id = biomeSwap(biome, id);
  return id;
}

/* ------------------------------------------------------------ painted backdrops (the Craftpix parallax packs) */


/** How a scene is shown: painted in code (`painted`), a painted backdrop from the packs in its place, or the painted
 *  scene under a painted sky from the packs (`sky:...`, for the packs that are only sky). */
export type SceneLook = 'painted' | BackdropId | `sky:${BackdropId}`;

const n = (prefix: string, ...nums: number[]) => nums.map((i) => `${prefix}_${i}` as BackdropId);
const skies = (...ids: BackdropId[]) => ids.map((id) => `sky:${id}` as const);

/** Each scene's looks, picked from per trip (the painted one is always among them). */
export const SCENE_LOOKS: Record<SceneId, SceneLook[]> = {
  meadow: ['painted', ...n('summer', 1, 2, 4, 5), ...n('meadows', 1), ...n('nature', 4), ...n('forest', 1), ...skies(...n('clouds', 1, 5), ...n('skies', 1))],
  riverbank: ['painted', ...n('peaks', 4), ...n('summer', 3), ...n('forest', 4), ...skies(...n('clouds', 2), ...n('heights', 4))],
  pinewoods: ['painted', ...n('forest', 2, 3, 4, 5), ...n('peaks', 2), ...skies(...n('skies', 3))],
  quarry: ['painted', ...n('nature', 3), ...n('meadows', 4), ...n('mountains', 4), ...skies(...n('clouds', 4))],
  highlands: ['painted', ...n('mountains', 1, 2, 3, 5), ...n('peaks', 1, 3), ...n('nature', 1, 2), ...skies(...n('heights', 1), ...n('skies', 4))],
  ruins: ['painted', ...n('temple', 1, 2, 3, 4), 'battle_ruins', ...skies(...n('cloudscape', 4))],
  bandit_camp: ['painted', ...n('forest', 2), ...n('meadows', 1), ...skies(...n('skies', 2), ...n('cloudscape', 2))],
  burned_village: ['painted', ...n('abandoned', 3), 'wasteland_1', ...skies(...n('heights', 3))],
  coal_fields: ['painted', 'industrial_day', 'industrial_night', ...n('steampunk', 3)],
  mill_yard: ['painted', ...n('steampunk', 1), 'industrial_day', ...skies(...n('clouds', 5))],
  oil_fields: ['painted', 'wasteland_3', ...n('abandoned', 1), ...skies(...n('cloudscape', 3))],
  ghost_city: ['painted', ...n('ruins', 1, 2, 3, 4), 'wasteland_2', ...n('city', 1, 3, 5)],
  compound: ['painted', ...n('abandoned', 2), ...n('city', 2, 4), 'industrial_day'],
  crater: ['painted', ...n('moon', 1, 2, 3, 4), ...n('future', 1, 2, 3, 4), ...skies(...n('clouds', 3), ...n('heights', 2), ...n('cloudscape', 1))],
  dunes: ['painted', ...n('oasis', 1, 2, 3, 4), ...n('nature', 3)],
  tundra: ['painted', ...n('winter', 1, 2, 3, 4, 5, 6, 7), ...n('snowfield', 1, 2, 3, 4), ...skies(...n('meadows', 2))],
  coast: ['painted', ...n('meadows', 3), ...skies(...n('ocean', 1, 2, 3, 4, 5), ...n('underwater', 4))],
  // (the new lands: the fens under heavy skies, the jungle's green walls, the ashlands' wastes and the open steppe)
  fen: ['painted', ...n('forest', 1, 3), ...n('nature', 2), ...n('abandoned', 4), 'battle_graves', ...skies(...n('cloudscape', 2, 4), ...n('heights', 3))],
  jungle: ['painted', 'battle_jungle', ...n('forest', 1, 4, 5), ...n('nature', 2, 4), ...n('summer', 4), ...skies(...n('clouds', 2))],
  ashland: ['painted', ...n('wasteland', 1, 2, 3), 'battle_ruins', ...n('abandoned', 3), ...n('moon', 3), ...skies(...n('skies', 4), ...n('heights', 2))],
  steppe: ['painted', ...n('meadows', 1, 2, 4), ...n('summer', 2, 5), ...n('nature', 4), ...skies(...n('clouds', 1, 3, 4), ...n('skies', 1))],
  cave: ['painted', ...n('crystal', 1, 2, 3, 4)],
  keep: ['painted', 'battle_hall'],
  dragon_den: ['painted'],
  crypt: ['painted', 'battle_graves', ...n('temple', 3)],
  vault: ['painted'],
  ship_hold: ['painted', ...n('underwater', 1, 2, 3)],
  factory: ['painted', ...n('steampunk', 2, 4), 'industrial_night'],
  bunker: ['painted'],
};

/** The green scenes turn with the year: autumn woods in autumn, snow in winter. */
const SEASON_LOOKS: Partial<Record<string, SceneLook[]>> = {
  autumn: n('autumn', 1, 2, 3, 4),
  winter: [...n('winter', 1, 3, 5), ...n('snowfield', 1, 3)],
};
const SEASONAL = new Set<SceneId>(['meadow', 'riverbank', 'pinewoods', 'bandit_camp', 'highlands', 'steppe', 'fen']);

/** The look for a trip (the same one all the way, seeded by the trip). */
/** A shore town's trips (the merfolk) out of doors: under the waves, or the open sea under the sky. */
const SEA_LOOKS: readonly SceneLook[] = [...n('underwater', 1, 2, 3, 4), ...skies(...n('ocean', 1, 2, 3, 4, 5))];

export function lookFor(scene: SceneId, seed: number, season?: string, sea = false): SceneLook {
  const own = sea && !INDOOR_SCENES.has(scene) ? SEA_LOOKS : (season && SEASONAL.has(scene) && SEASON_LOOKS[season]) || SCENE_LOOKS[scene];
  const h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return own[h % own.length];
}
