// Dungeons to delve: long trips the player picks the party for. Each dungeon hides in a region of the world map
// (regions.ts) until scouts map it, and is a destination of type `delve` (expeditions.ts), so the road there and back,
// food, wounds and the Watch view work as for any trip. Inside, the party goes room by room (sim/delves.ts): fights, traps,
// treasure, shrines, puzzle doors, rest camps and forks, with the boss at the bottom, burning a torch a room.

import type { Destination } from './expeditions';
import type { Era } from './eras';
import type { Material } from './materials';
import type { SceneId } from './scenes';

export type RoomKind = 'fight' | 'trap' | 'treasure' | 'shrine' | 'puzzle' | 'camp' | 'fork' | 'boss';

export interface DungeonDef {
  id: string;
  name: string;
  /** The region it's hidden in (mapped by a scouting party). */
  region: string;
  era: Era;
  research?: string;
  /** Rooms before the boss's. */
  rooms: number;
  /** Who's met in its fights (one group a fight; more of them deeper down), and the boss with its guard. */
  foes: Record<string, number>[];
  boss: Record<string, number>;
  /** What's picked up along the way, and the hoard at the bottom. */
  loot: Partial<Record<Material, number>>;
  hoard: Partial<Record<Material, number>>;
  /** The road there, and inside (the watched trip's scenes). */
  road: SceneId;
  inside: SceneId;
  /** How far it lies (seconds each way). */
  outSeconds: number;
  /** Where it is on the world map (768px square). */
  x: number;
  y: number;
  /** Who waits at the bottom (for the board). */
  threat: string;
  description: string;
}

export const DUNGEONS: readonly DungeonDef[] = [
  {
    id: 'barrow_crypt', name: 'The Barrow Crypt', region: 'westwood', era: 'neolithic', research: 'storytelling', rooms: 8,
    foes: [{ skeleton_warrior: 2 }, { skeleton_spearman: 1, skeleton_archer: 1 }, { skeleton_warrior: 1, skeleton_archer: 2 }],
    boss: { lich_lord: 1, skeleton_warrior: 2 }, loot: { bone: 3, stone: 2, herbs: 1 }, hoard: { bone: 10, iron: 4, cloth: 4 },
    road: 'pinewoods', inside: 'crypt', x: 55, y: 400, threat: 'The Lich Lord', outSeconds: 260, description: 'Barrows in the Westwood, and under them, a crypt that goes down further than any grave should.',
  },
  {
    id: 'gremlin_warren', name: 'The Gremlin Warren', region: 'northern_crags', era: 'neolithic', rooms: 7,
    foes: [{ pink_gremlin: 2, blue_gremlin: 1 }, { giant_rat: 3 }, { owlet_gremlin: 2, giant_rat: 1 }],
    boss: { rat_king: 1, giant_rat: 2 }, loot: { flint: 3, hide: 2, berries: 2 }, hoard: { flint: 10, hide: 6, clay: 6 },
    road: 'highlands', inside: 'cave', x: 350, y: 62, threat: 'The Rat King', outSeconds: 280, description: 'Burrows under the crags, full of giggling and the smell of rat.',
  },
  {
    id: 'deep_mine', name: 'The Deep Mine', region: 'southern_ridges', era: 'medieval', research: 'mining', rooms: 10,
    foes: [{ giant_rat: 3 }, { mossback: 1 }, { skeleton_warrior: 1, skeleton_spearman: 1 }, { minotaur: 1 }],
    boss: { behemoth: 1 }, loot: { iron_ore: 3, coal: 2, stone: 2 }, hoard: { iron: 10, rare_minerals: 2, coal: 10 },
    road: 'quarry', inside: 'cave', x: 110, y: 590, threat: 'The Behemoth', outSeconds: 300, description: 'An old mine the miners left in a hurry. Something big lives in the bottom gallery.',
  },
  {
    id: 'fey_hollow', name: 'The Fey Hollow', region: 'eastwood', era: 'medieval', research: 'herbalism', rooms: 9,
    foes: [{ satyr: 2 }, { satyr_reveller: 1, satyr_shaman: 1 }, { karasu_tengu: 2 }, { wolf_alpha: 1, wolf: 2 }],
    boss: { hunt_queen: 1, satyr: 2 }, loot: { herbs: 3, berries: 3, fiber: 2 }, hoard: { herbs: 10, cloth: 6, rare_minerals: 1 },
    road: 'pinewoods', inside: 'cave', x: 515, y: 445, threat: 'The Queen of the Wild Hunt', outSeconds: 300, description: 'A hollow under the oldest trees of the Eastwood, where the Wild Hunt rests between rides.',
  },
];
export const DUNGEON_BY_ID: Readonly<Record<string, DungeonDef>> = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));

/** How long each room takes to get through, besides its fight (game seconds). */
export const ROOM_SECONDS = 150;

/** Each dungeon as a destination on the Expedition Board (type `delve`). */
export const DUNGEON_DESTINATIONS: readonly Destination[] = DUNGEONS.map((d) => ({
  id: d.id,
  name: d.name,
  type: 'delve',
  outSeconds: d.outSeconds,
  workSeconds: (d.rooms + 1) * ROOM_SECONDS,
  secondsPerUnit: 10,
  loot: d.loot,
  threats: `${d.rooms} rooms deep, and at the bottom ${d.threat} (boss)`,
  encounters: { arrival: 0, ambush: 0.1, groups: [{ enemies: d.foes[0], weight: 1 }] },
  recommendedParty: 4,
  research: d.research,
  era: d.era,
  scenery: 'cave',
  description: d.description,
}));

export const DUNGEON_SPOTS: Readonly<Record<string, { x: number; y: number }>> = Object.fromEntries(DUNGEONS.map((d) => [d.id, { x: d.x, y: d.y }]));
export const DUNGEON_ROUTES: Readonly<Record<string, [SceneId, SceneId]>> = Object.fromEntries(DUNGEONS.map((d) => [d.id, [d.road, d.inside]]));
