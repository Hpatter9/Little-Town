// Dungeons to delve: long trips the player picks the party for. Each dungeon hides in a region of the world map
// (regions.ts) until scouts map it, and is a destination of type `delve` (expeditions.ts), so the road there and back,
// food, wounds and the Watch view work as for any trip. Inside, the party goes room by room (sim/delves.ts): fights, traps,
// treasure, shrines, puzzle doors, rest camps and forks, with the boss at the bottom, burning a torch a room.

import type { Destination } from './expeditions';
import type { Era } from './eras';
import type { Material } from './materials';
import type { SceneId } from './scenes';

export type RoomKind = 'fight' | 'trap' | 'treasure' | 'shrine' | 'puzzle' | 'camp' | 'fork' | 'boss';

/** The kinds of dungeon (each with its own look inside, its own foes, and its own bosses). */
export type DungeonType = 'crypt' | 'warren' | 'mine' | 'fey' | 'temple' | 'tower' | 'nest' | 'wreck' | 'ice' | 'forge' | 'vault' | 'den';

export interface DungeonDef {
  id: string;
  name: string;
  type: DungeonType;
  /** The region it's hidden in (mapped by a scouting party). */
  region: string;
  era: Era;
  research?: string;
  /** Rooms before the boss's. */
  rooms: number;
  /** Who's met in its fights (one group a fight; more of them deeper down). */
  foes: Record<string, number>[];
  /** Who may wait at the bottom: one of these (a boss and its guard), rolled for each delve. */
  bosses: Record<string, number>[];
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
  /** Who may wait at the bottom (for the board). */
  threat: string;
  description: string;
}

export const DUNGEONS: readonly DungeonDef[] = [
  {
    id: 'barrow_crypt', name: 'The Barrow Crypt', type: 'crypt', region: 'westwood', era: 'neolithic', research: 'storytelling', rooms: 8,
    foes: [{ skeleton_warrior: 2 }, { skeleton_spearman: 1, skeleton_archer: 1 }, { skeleton_warrior: 1, skeleton_archer: 2 }, { flying_skull: 2 }],
    bosses: [{ lich_lord: 1, skeleton_warrior: 2 }, { barrow_wight: 1, skeleton_warrior: 1 }, { bone_colossus: 1 }],
    loot: { bone: 3, stone: 2, herbs: 1 }, hoard: { bone: 10, iron: 4, cloth: 4 },
    road: 'pinewoods', inside: 'crypt', x: 55, y: 400, threat: 'the Lich Lord, the Barrow Wight or the Bone Colossus', outSeconds: 260,
    description: 'Barrows in the Westwood, and under them, a crypt that goes down further than any grave should.',
  },
  {
    id: 'gremlin_warren', name: 'The Gremlin Warren', type: 'warren', region: 'northern_crags', era: 'neolithic', rooms: 7,
    foes: [{ pink_gremlin: 2, blue_gremlin: 1 }, { giant_rat: 3 }, { owlet_gremlin: 2, giant_rat: 1 }, { redcap: 2 }],
    bosses: [{ rat_king: 1, giant_rat: 2 }, { goblin_king: 1, redcap: 1 }, { grub_mother: 1 }],
    loot: { flint: 3, hide: 2, berries: 2 }, hoard: { flint: 10, hide: 6, clay: 6 },
    road: 'highlands', inside: 'cave', x: 350, y: 62, threat: 'the Rat King, the Goblin King or the Grub Mother', outSeconds: 280,
    description: 'Burrows under the crags, full of giggling and the smell of rat.',
  },
  {
    id: 'deep_mine', name: 'The Deep Mine', type: 'mine', region: 'southern_ridges', era: 'medieval', research: 'mining', rooms: 10,
    foes: [{ giant_rat: 3 }, { mossback: 1 }, { skeleton_warrior: 1, skeleton_spearman: 1 }, { minotaur: 1 }, { acid_slime: 2 }],
    bosses: [{ behemoth: 1 }, { delvers_bane: 1 }, { cave_troll: 1, giant_rat: 2 }],
    loot: { iron_ore: 3, coal: 2, stone: 2 }, hoard: { iron: 10, rare_minerals: 2, coal: 10 },
    road: 'quarry', inside: 'cave', x: 110, y: 590, threat: "the Behemoth, the Delvers' Bane or the Cave Troll", outSeconds: 300,
    description: 'An old mine the miners left in a hurry. Something big lives in the bottom gallery.',
  },
  {
    id: 'fey_hollow', name: 'The Fey Hollow', type: 'fey', region: 'eastwood', era: 'medieval', research: 'herbalism', rooms: 9,
    foes: [{ satyr: 2 }, { satyr_reveller: 1, satyr_shaman: 1 }, { karasu_tengu: 2 }, { wolf_alpha: 1, wolf: 2 }, { shroom_folk: 3 }],
    bosses: [{ hunt_queen: 1, satyr: 2 }, { erl_king: 1, satyr: 1 }, { moth_queen: 1 }],
    loot: { herbs: 3, berries: 3, fiber: 2 }, hoard: { herbs: 10, cloth: 6, rare_minerals: 1 },
    road: 'pinewoods', inside: 'cave', x: 515, y: 445, threat: 'the Queen of the Wild Hunt, the Erl-King or the Moth Queen', outSeconds: 300,
    description: 'A hollow under the oldest trees of the Eastwood, where the Wild Hunt rests between rides.',
  },
  {
    id: 'spider_nest', name: 'The Webbed Hollows', type: 'nest', region: 'westwood', era: 'medieval', research: 'trail_marking', rooms: 8,
    foes: [{ giant_rat: 2, vampire_bat: 2 }, { acid_slime: 2 }, { vampire_bat: 3 }, { zombie_hound: 2 }],
    bosses: [{ brood_mother: 1, giant_rat: 2 }, { ooze_mother: 1 }],
    loot: { fiber: 4, hide: 2, herbs: 1 }, hoard: { fiber: 14, cloth: 6, herbs: 4 },
    road: 'pinewoods', inside: 'cave', x: 40, y: 260, threat: 'Arachnis, the Brood Mother, or the Ooze Mother', outSeconds: 300,
    description: 'Webs as thick as sailcloth fill the caves at the Westwood\'s edge. Things hang in them.',
  },
  {
    id: 'flooded_temple', name: 'The Flooded Temple', type: 'temple', region: 'the_sea', era: 'medieval', research: 'cartography', rooms: 9,
    foes: [{ skeleton_spearman: 2 }, { gorgon: 1 }, { crocodile: 1, skeleton_warrior: 1 }, { grave_ghost: 2 }],
    bosses: [{ drowned_priestess: 1, skeleton_warrior: 1 }, { old_snapjaw: 1 }, { sea_hag: 1, grave_ghost: 1 }],
    loot: { stone: 3, cloth: 2, glass: 1 }, hoard: { stone: 10, cloth: 8, glass: 4, rare_minerals: 1 },
    road: 'coast', inside: 'crypt', x: 420, y: 745, threat: 'the Drowned Priestess, Old Snapjaw or the Sea Hag', outSeconds: 340,
    description: 'An old temple half under the sea. At low tide its doors open, and something inside still worships.',
  },
  {
    id: 'sunken_ship', name: 'The Wreck of the Merrow', type: 'wreck', region: 'the_sea', era: 'medieval', research: 'cartography', rooms: 7,
    foes: [{ skeleton_warrior: 2 }, { skeleton_archer: 2 }, { crocodile: 1 }, { grave_ghost: 1, skeleton_warrior: 1 }],
    bosses: [{ bosun_grimbones: 1, skeleton_warrior: 1 }, { krakens_spawn: 1 }],
    loot: { cloth: 3, iron: 2, leather: 1 }, hoard: { cloth: 10, iron: 6, leather: 4 },
    road: 'coast', inside: 'ship_hold', x: 180, y: 745, threat: "Bosun Grimbones or the Kraken's Spawn", outSeconds: 320,
    description: 'A merchantman on the reef, its hold still full, and its crew still aboard.',
  },
  {
    id: 'wizards_tower', name: 'The Leaning Tower', type: 'tower', region: 'far_isles', era: 'medieval', research: 'writing', rooms: 10,
    foes: [{ fire_wizard: 1, possessed_tome: 1 }, { storm_mage: 1 }, { wandering_magus: 1, possessed_tome: 2 }, { wraith: 2 }],
    bosses: [{ archmage_malakar: 1, possessed_tome: 1 }, { storm_lord: 1 }, { grand_grimoire: 1, possessed_tome: 1 }],
    loot: { glass: 1, cloth: 2, herbs: 3 }, hoard: { glass: 6, cloth: 6, rare_minerals: 2, herbs: 8 },
    road: 'tundra', inside: 'keep', x: 735, y: 190, threat: 'Archmage Malakar, the Storm Lord or the Hollow Librarian', outSeconds: 380,
    description: 'A wizard\'s tower on the Far Isles, leaning at an angle nothing should stand at. Its windows still light up at night.',
  },
  {
    id: 'ice_cave', name: 'The Rime Caves', type: 'ice', region: 'far_isles', era: 'medieval', research: 'fortification', rooms: 9,
    foes: [{ ice_golem: 1 }, { frost_yeti: 1 }, { wolf_alpha: 1, wolf: 2 }, { ice_golem: 1, wolf: 1 }],
    bosses: [{ yeti_king: 1, frost_yeti: 1 }, { rimewyrm: 1 }, { frost_archmage: 1, ice_golem: 1 }],
    loot: { stone: 3, hide: 2, glass: 1 }, hoard: { hide: 10, glass: 6, rare_minerals: 2 },
    road: 'tundra', inside: 'cave', x: 580, y: 60, threat: 'the Yeti King, the Rimewyrm or the Frost Archmage', outSeconds: 380,
    description: 'Caves under the glacier on the frozen isle, blue and creaking, and colder the deeper they go.',
  },
  {
    id: 'volcanic_forge', name: 'The Cinder Forge', type: 'forge', region: 'southern_ridges', era: 'industrial', research: 'drill_manuals', rooms: 11,
    foes: [{ night_shade: 1 }, { fire_wizard: 2 }, { drake: 2 }, { thrall: 2 }],
    bosses: [{ forge_lord: 1, night_shade: 1 }, { magma_golem: 1 }, { salamander: 1, drake: 1 }],
    loot: { coal: 3, iron: 2, steel: 1 }, hoard: { steel: 10, coal: 12, rare_minerals: 2 },
    road: 'quarry', inside: 'dragon_den', x: 60, y: 640, threat: 'the Forge Lord, the Magma Golem or the Great Salamander', outSeconds: 360,
    description: 'An old dwarf forge where the mountain bleeds fire. The hammers still ring, and nobody is swinging them.',
  },
  {
    id: 'dragons_den', name: "The Dragons' Den", type: 'den', region: 'northern_crags', era: 'industrial', research: 'firearms', rooms: 12,
    foes: [{ drake: 3 }, { drake: 2, wolf_alpha: 1 }, { night_shade: 1, drake: 1 }],
    bosses: [{ ashen_wyrm: 1 }, { twin_drakes: 1, drake: 1 }, { dragon: 1 }],
    loot: { hide: 3, bone: 3, rare_minerals: 1 }, hoard: { rare_minerals: 4, steel: 8, hide: 10 },
    road: 'highlands', inside: 'dragon_den', x: 180, y: 40, threat: 'the Ashen Wyrm, the Elder Drake or Vermithrax the Red', outSeconds: 400,
    description: 'Caves high in the crags, littered with bones and old coins. Dragons are bred here.',
  },
  {
    id: 'machine_vault', name: 'Vault Nine', type: 'vault', region: 'southern_isle', era: 'modern', research: 'field_tactics', rooms: 12,
    foes: [{ infantry_bot: 2 }, { blade_bot: 1, infantry_bot: 1 }, { combat_drone: 2 }, { war_bot: 1 }],
    bosses: [{ vault_warden: 1, infantry_bot: 1 }, { prime_core: 1, combat_drone: 1 }, { rogue_ai: 1, combat_drone: 2 }],
    loot: { electronics: 2, steel: 2, alloys: 1 }, hoard: { electronics: 10, alloys: 6, circuits: 4 },
    road: 'compound', inside: 'vault', x: 690, y: 640, threat: 'the Vault Warden, the Prime Core or a Rogue AI', outSeconds: 360,
    description: 'A sealed vault from before the war, under the Southern Isle. Its guards never got the order to stand down.',
  },
];

/** A twist each delve rolls (sim/delves.ts): how it changes the dungeon, in a word and a line. */
export type TwistId = 'none' | 'haunted' | 'flooded' | 'rich' | 'cursed' | 'swarming' | 'dark' | 'blessed' | 'elite';
export const TWISTS: Readonly<Record<TwistId, { name: string; text: string; weight: number }>> = {
  none: { name: 'Quiet', text: 'Nothing strange about it.', weight: 3 },
  haunted: { name: 'Haunted', text: 'The dead walk here: a spirit joins every fight.', weight: 2 },
  flooded: { name: 'Flooded', text: 'Waist-deep water: every room takes half again as long.', weight: 2 },
  rich: { name: 'Rich Veins', text: 'Gold in the walls: hoards and puzzle vaults give twice as much.', weight: 2 },
  cursed: { name: 'Cursed', text: 'A curse lies on it: no camp or shrine heals here.', weight: 2 },
  swarming: { name: 'Swarming', text: 'More of them than usual: one more foe in every fight, and more coins.', weight: 2 },
  dark: { name: 'Pitch Dark', text: 'The dark eats light: torches burn twice as fast.', weight: 2 },
  blessed: { name: 'Blessed', text: 'An old saint watched over it: camps and shrines heal twice as well.', weight: 1 },
  elite: { name: 'Champions', text: 'Its monsters are the best of their kind: elites are twice as common.', weight: 2 },
};
/** Elite affixes: what each does to a foe, and the word it adds to its name. */
export type EliteAffix = 'fiery' | 'armoured' | 'swift' | 'vampiric' | 'giant';
export const ELITES: Readonly<Record<EliteAffix, { name: string; tint: number }>> = {
  fiery: { name: 'Fiery', tint: 0xff9050 },
  armoured: { name: 'Armoured', tint: 0xb0b8c8 },
  swift: { name: 'Swift', tint: 0x80f0ff },
  vampiric: { name: 'Vampiric', tint: 0xff5070 },
  giant: { name: 'Giant', tint: 0xe0d090 },
};
/** A foe's chance to be an elite: a base, more the deeper down, more again for a risky party (twice in a Champions run). */
export const ELITE_BASE = 0.08;
export const ELITE_PER_ROOM = 0.02;
export const ELITE_RISKY = 0.06;

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
  threats: `${d.rooms} rooms deep, and at the bottom ${d.threat}`,
  encounters: { arrival: 0, ambush: 0.1, groups: [{ enemies: d.foes[0], weight: 1 }] },
  recommendedParty: 4,
  research: d.research,
  era: d.era,
  scenery: 'cave',
  description: d.description,
}));

export const DUNGEON_SPOTS: Readonly<Record<string, { x: number; y: number }>> = Object.fromEntries(DUNGEONS.map((d) => [d.id, { x: d.x, y: d.y }]));
export const DUNGEON_ROUTES: Readonly<Record<string, [SceneId, SceneId]>> = Object.fromEntries(DUNGEONS.map((d) => [d.id, [d.road, d.inside]]));
