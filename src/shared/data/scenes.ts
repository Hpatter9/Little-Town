// The scenes a watched fight can play out in (renderer/art/fightBackdrop.ts paints them): 17 out in the land and 8
// inside dungeons. Which one: by the destination, whether the party is on the road (the land on the way) or there
// (inside, for a dungeon), and the town's biome (the green ones become sand, snow or shore).

import type { Biome } from './biomes';

export const SCENES = [
  // out in the land
  'meadow', 'riverbank', 'pinewoods', 'quarry', 'highlands', 'ruins', 'bandit_camp', 'burned_village', 'coal_fields', 'mill_yard',
  'oil_fields', 'ghost_city', 'compound', 'crater', 'dunes', 'tundra', 'coast',
  // inside
  'cave', 'keep', 'dragon_den', 'crypt', 'vault', 'ship_hold', 'factory', 'bunker',
] as const;
export type SceneId = (typeof SCENES)[number];

/** Each destination's scene on the road there, and at it (inside, for a dungeon). */
export const ROUTES: Record<string, [SceneId, SceneId]> = {
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
/** The green scenes take the town's own land: sand, snow or shore. */
const BIOME_SWAP: Partial<Record<Biome, Partial<Record<SceneId, SceneId>>>> = {
  desert: { meadow: 'dunes', pinewoods: 'dunes', riverbank: 'dunes' },
  tundra: { meadow: 'tundra', pinewoods: 'tundra', riverbank: 'tundra' },
  coast: { meadow: 'coast' },
};
export const INDOOR_SCENES: ReadonlySet<SceneId> = new Set<SceneId>(['cave', 'keep', 'dragon_den', 'crypt', 'vault', 'ship_hold', 'factory', 'bunker']);

export function sceneFor(dest: string, scenery: string, phase: string, biome: Biome | undefined): SceneId {
  const route = ROUTES[dest];
  let id: SceneId = route ? (phase === 'work' ? route[1] : route[0]) : (OLD_SCENERY[scenery] ?? 'meadow');
  if (biome && !INDOOR_SCENES.has(id)) id = BIOME_SWAP[biome]?.[id] ?? id;
  return id;
}
