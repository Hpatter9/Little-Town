// The world map's regions. The town knows its own (the Heartland: the lake and the country round home) and the old
// roads out of it; the rest lies under fog until a scouting party maps it. Each region has a scouting trip of its own
// (a destination of type `scout`), and mapping it reveals what's hidden there: the bosses' lairs now, and the
// dungeons to delve later. Destinations that aren't in a region's keeping stay where they always were.

import type { Era } from './eras';
import type { Destination } from './expeditions';
import type { Material } from './materials';
import type { SceneId } from './scenes';
import { DUNGEONS } from './dungeons';

export interface Region {
  id: string;
  name: string;
  /** Its middle on the map (768px square), and how far its fog reaches (px). */
  x: number;
  y: number;
  r: number;
  /** The era a scouting party can first reach it in. */
  era: Era;
  /** What the scouts bring back from the way, and who they may run into. */
  loot: Partial<Record<Material, number>>;
  foes: Record<string, number>[];
  /** The land on the way (the watched trip's scene). */
  scene: SceneId;
  description: string;
}

export const HOME_REGION = 'heartland';

export const REGIONS: readonly Region[] = [
  { id: 'heartland', name: 'The Heartland', x: 390, y: 390, r: 150, era: 'neolithic', loot: {}, foes: [], scene: 'meadow', description: 'Home: the lake, the old roads, and the fields round the town.' },
  { id: 'westwood', name: 'The Westwood', x: 110, y: 380, r: 150, era: 'neolithic', loot: { wood: 4, herbs: 3, fiber: 2 }, foes: [{ wolf: 2 }, { bandit: 2 }], scene: 'pinewoods', description: 'Deep forest down the west of the island, where the paths give out.' },
  { id: 'northern_crags', name: 'The Northern Crags', x: 290, y: 110, r: 150, era: 'neolithic', loot: { stone: 4, flint: 3, bone: 2 }, foes: [{ wolf_alpha: 1, wolf: 1 }, { pink_gremlin: 2 }], scene: 'highlands', description: 'Bare mountains in the north, cut by passes and cold winds.' },
  { id: 'eastwood', name: 'The Eastwood', x: 540, y: 330, r: 150, era: 'neolithic', loot: { wood: 4, berries: 3, herbs: 2 }, foes: [{ boar: 2 }, { satyr: 2 }], scene: 'pinewoods', description: 'Old forest to the east of home, thick and loud with things that grunt.' },
  { id: 'southern_ridges', name: 'The Southern Ridges', x: 170, y: 570, r: 150, era: 'neolithic', loot: { stone: 3, clay: 3, flint: 2 }, foes: [{ wolf: 2 }, { giant_rat: 3 }], scene: 'quarry', description: 'Broken hills and old diggings running down to the south-west coast.' },
  { id: 'southern_isle', name: 'The Southern Isle', x: 550, y: 620, r: 140, era: 'medieval', loot: { wood: 3, herbs: 3, cloth: 1 }, foes: [{ bandit: 2 }, { gorgon: 1 }], scene: 'coast', description: 'An island across the strait, wooded in the east and walled in the west.' },
  { id: 'the_sea', name: 'The Sea of Wrecks', x: 280, y: 705, r: 110, era: 'medieval', loot: { cloth: 2, iron: 2, leather: 1 }, foes: [{ skeleton_warrior: 2 }, { bandit: 2 }], scene: 'coast', description: 'Reefs and shoals off the south coast, where ships go down.' },
  { id: 'far_isles', name: 'The Far Isles', x: 670, y: 240, r: 170, era: 'medieval', loot: { stone: 3, glass: 1, herbs: 3 }, foes: [{ karasu_tengu: 2 }, { wolf_alpha: 1, wolf: 2 }], scene: 'tundra', description: 'The frozen isle in the north-east, and the scattered islets down the east.' },
];
export const REGION_BY_ID: Readonly<Record<string, Region>> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** The hidden places and the region whose mapping reveals each (any destination not listed is never hidden). */
export const HIDDEN_IN: Readonly<Record<string, string>> = {
  labyrinth: 'westwood',
  shaman_totems: 'northern_crags',
  ronin_pass: 'northern_crags',
  boar_wallow: 'eastwood',
  thornwood: 'eastwood',
  idol_grove: 'eastwood',
  devils_gate: 'southern_ridges',
  smugglers_cove: 'southern_ridges',
  gorgon_isle: 'southern_isle',
  sunken_galleon: 'the_sea',
  fox_shrine: 'far_isles',
  iron_citadel: 'far_isles',
  // (and every dungeon, in its own region)
  ...Object.fromEntries(DUNGEONS.map((d) => [d.id, d.region])),
};

/** A region's scouting trip: its destination id, and the region a scouting destination maps. */
export const scoutId = (region: string) => `scout_${region}`;
export const regionScouted = (dest: string): string | null => (dest.startsWith('scout_') ? dest.slice(6) : null);

const HOME = { x: 395, y: 410 };
/** The scouting trips: one for each region but home, longer the further it lies. */
export const SCOUT_DESTINATIONS: readonly Destination[] = REGIONS.filter((r) => r.id !== HOME_REGION).map((r) => {
  const far = Math.hypot(r.x - HOME.x, r.y - HOME.y);
  return {
    id: scoutId(r.id),
    name: `Scout ${r.name.replace(/^The /, 'the ')}`,
    type: 'scout',
    outSeconds: Math.round(80 + far * 0.6),
    workSeconds: 120,
    secondsPerUnit: 8,
    loot: r.loot,
    threats: 'Whatever lives there, now and then',
    encounters: { arrival: 0.3, ambush: 0.15, groups: r.foes.map((enemies) => ({ enemies, weight: 1 })) },
    recommendedParty: 2,
    era: r.era,
    scenery: 'woods',
    description: `${r.description} Map it, and see what's out there.`,
  };
});
export const SCOUT_SPOTS: Readonly<Record<string, { x: number; y: number }>> = Object.fromEntries(REGIONS.filter((r) => r.id !== HOME_REGION).map((r) => [scoutId(r.id), { x: r.x, y: r.y }]));
export const SCOUT_ROUTES: Readonly<Record<string, [SceneId, SceneId]>> = Object.fromEntries(REGIONS.filter((r) => r.id !== HOME_REGION).map((r) => [scoutId(r.id), [r.scene, r.scene]]));
