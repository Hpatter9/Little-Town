// Boats (the owner's design: every town by water sails; islands only a boat reaches, sea trade, fishing boats and
// faster trips along the water; real losses at sea; the town sails on its own, the player forbidding or posting a
// bounty as for any trip). The boatyard stands at the water's edge (`shore`) and builds the town's boats, one kind an
// age; a boat at home fishes, a boat away carries a party (sim/boats.ts). Merged into the game's lists by
// research.ts, buildings.ts, items.ts, expeditions.ts, worldMap.ts, scenes.ts and enemies.ts.

import type { BuildingDef } from './buildings';
import type { EnemyDef, EnemyGroup } from './enemies';
import type { Era } from './eras';
import type { Destination } from './expeditions';
import type { ItemDef } from './items';
import type { Material } from './materials';
import { PACK_SHEETS } from './packSheets';
import type { Topic } from './research';
import type { SceneId } from './scenes';

export type BoatKind = 'dugout' | 'longboat' | 'carrack' | 'steamer' | 'motor_launch' | 'hydrofoil';

export interface BoatDef {
  kind: BoatKind;
  name: string;
  era: Era;
  research: string;
  /** How many may sail in her, how much faster than walking the trip goes, her hull, what she carries over the
   *  party's own packs, and the fish she brings in a day at home. */
  crew: number;
  speed: number;
  hull: number;
  cargo: number;
  catch: number;
  cost: Partial<Record<Material, number>>;
  seconds: number;
  description: string;
}

export const BOATS: readonly BoatDef[] = [
  { kind: 'dugout', name: 'Dugout Canoe', era: 'neolithic', research: 'boatbuilding', crew: 3, speed: 1.25, hull: 30, cargo: 8, catch: 3, cost: { wood: 20, fiber: 4 }, seconds: 120, description: 'A log hollowed with fire and adze. Three paddle her; she rides low.' },
  { kind: 'longboat', name: 'Longboat', era: 'medieval', research: 'shipwrighting', crew: 5, speed: 1.5, hull: 70, cargo: 20, catch: 6, cost: { lumber: 24, cloth: 6, iron: 2 }, seconds: 200, description: 'Clinker-built, oars and a square sail: quick along the coast.' },
  { kind: 'carrack', name: 'Carrack', era: 'medieval', research: 'navigation', crew: 5, speed: 1.7, hull: 110, cargo: 30, catch: 8, cost: { lumber: 40, cloth: 12, iron: 6 }, seconds: 300, description: 'A deep-hulled sailing ship, high at bow and stern, built for the open sea.' },
  { kind: 'steamer', name: 'Steamer', era: 'industrial', research: 'steamships', crew: 5, speed: 2.1, hull: 160, cargo: 40, catch: 12, cost: { steel: 20, lumber: 10, coal: 10 }, seconds: 360, description: 'An iron hull and a paddle wheel: she goes where she likes, wind or none.' },
  { kind: 'motor_launch', name: 'Motor Launch', era: 'modern', research: 'motor_boats', crew: 5, speed: 2.6, hull: 180, cargo: 40, catch: 16, cost: { steel: 16, fuel: 10, electronics: 2 }, seconds: 360, description: 'A diesel engine and a steel deck, quick in any weather short of a gale.' },
  { kind: 'hydrofoil', name: 'Hydrofoil', era: 'space', research: 'hydrofoils', crew: 5, speed: 3.2, hull: 220, cargo: 50, catch: 20, cost: { alloys: 12, circuits: 4 }, seconds: 400, description: 'She lifts out of the water on her foils and flies over the waves.' },
];
export const BOAT_BY_KIND: Readonly<Record<BoatKind, BoatDef>> = Object.fromEntries(BOATS.map((b) => [b.kind, b])) as Record<BoatKind, BoatDef>;

const topic = (id: string, name: string, era: Era, seconds: number, prereqs: string[], unlocks: string): Topic => ({ id, name, branch: 'logistics', era, seconds, prereqs, unlocks, effects: [] });
export const BOAT_TOPICS: readonly Topic[] = [
  topic('boatbuilding', 'Boatbuilding', 'neolithic', 240, ['fish_traps'], 'The boatyard and the dugout canoe: fishing from a boat, and the nearest islands'),
  topic('shipwrighting', 'Shipwrighting', 'medieval', 360, ['boatbuilding', 'carpentry'], 'The longboat: crews of five, and the islands further out'),
  topic('navigation', 'Navigation', 'medieval', 420, ['shipwrighting', 'cartography'], 'The carrack, the open sea, its markets and what lives in the deep'),
  topic('steamships', 'Steamships', 'industrial', 420, ['steam_power', 'navigation'], 'The steamer: iron hulls that shrug off a storm, and the far spice port'),
  topic('motor_boats', 'Motor Boats', 'modern', 420, ['motor_transport', 'steamships'], 'The motor launch'),
  topic('hydrofoils', 'Hydrofoils', 'space', 480, ['advanced_alloys', 'motor_boats'], 'The hydrofoil'),
];

/** The boatyard: at the water's edge (any water: the sea, a river, the hold's tarn). */
export const BOATYARD: BuildingDef = {
  id: 'boatyard',
  name: 'Boatyard',
  layer: 'mid',
  width: 3,
  cost: { wood: 16, stone: 4, fiber: 6 },
  buildSeconds: 90,
  purpose: "Builds and mends the town's boats at the water's edge. A boat at home goes out fishing.",
  research: 'boatbuilding',
  shore: true,
};

/** A boat to build at the boatyard (it goes to the fleet, not the stores: sim/boats.ts `launch`). */
export const BOAT_ITEMS: readonly ItemDef[] = BOATS.map((b) => ({
  id: `boat_${b.kind}`,
  name: b.name,
  slot: null,
  station: 'boatyard',
  cost: b.cost,
  seconds: b.seconds,
  research: [b.research],
  effects: {},
  boat: b.kind,
  description: `${b.description} Crew ${b.crew}, hull ${b.hull}.`,
  icon: { sheet: 'Custom', x: 0, y: 0, name: `boat_${b.kind}` },
}));
export const boatOfItem = (id: string): BoatKind | undefined => BOAT_ITEMS.find((i) => i.id === id)?.boat;

/* ------------------------------------------------------------ the sea's own foes, and the Kraken */

const sprite = (height: number) => ({ sheet: 'squidman' as const, block: 0, scale: +(height / PACK_SHEETS.squidman).toFixed(2) });
export const BOAT_ENEMIES: Record<string, EnemyDef> = {
  kraken: { id: 'kraken', name: 'The Kraken', hp: 520, damage: [16, 26], accuracy: 0.72, dodge: 0.04, interval: 1.6, ranged: false, boss: true, loot: { pearls: 4, leather: 4 }, sprite: sprite(100), nature: 'beast', look: { hue: 150, bright: 0.85 } },
};

/** Who a boat meets at sea, by the age (squid spawn and crocodiles in the shallows; reavers and the drowned further
 *  out once there are ships to take). */
export const SEA_FOES: Readonly<Record<Era, EnemyGroup[]>> = {
  neolithic: [{ squid_spawn: 1 }, { crocodile: 2 }],
  medieval: [{ squid_spawn: 2 }, { sea_reaver: 2 }, { drowned_sailor: 2 }],
  industrial: [{ sea_reaver: 3 }, { squid_spawn: 2, sea_reaver: 1 }],
  modern: [{ sea_reaver: 3 }, { squid_spawn: 3 }],
  space: [{ sea_reaver: 3 }, { squid_spawn: 3 }],
};

/* ------------------------------------------------------------ islands and far markets: only a boat reaches them */

const island = (d: Omit<Destination, 'scenery' | 'recommendedParty'> & { recommendedParty?: number }): Destination => ({ recommendedParty: 3, scenery: 'river', byBoat: true, ...d });
export const ISLANDS: readonly Destination[] = [
  island({ id: 'gull_rock', name: 'Gull Rocks', type: 'gather', outSeconds: 260, workSeconds: 140, secondsPerUnit: 5, loot: { eggs: 4, fish: 4, bone: 2 }, threats: 'Little: the gulls, and the crossing', encounters: { arrival: 0.1, ambush: 0, groups: [{ enemies: { crocodile: 1 }, weight: 1 }] }, research: 'boatbuilding', recommendedParty: 2, description: 'White crags off the east coast, loud with nesting gulls. Eggs and fish for the taking.' }),
  island({ id: 'turtle_atoll', name: 'Turtle Atoll', type: 'gather', outSeconds: 300, workSeconds: 160, secondsPerUnit: 5, loot: { fish: 5, kelp: 4, pearls: 1 }, threats: 'Crocodiles in the lagoon', encounters: { arrival: 0.2, ambush: 0.1, groups: [{ enemies: { crocodile: 2 }, weight: 1 }] }, research: 'boatbuilding', recommendedParty: 2, description: 'A ring of sand round a warm lagoon, south across the strait. The oysters there keep pearls.' }),
  island({ id: 'seal_skerries', name: 'The Seal Skerries', type: 'hunt', outSeconds: 340, workSeconds: 180, secondsPerUnit: 6, loot: { meat: 6, hide: 5, bone: 2 }, threats: 'Squid spawn among the rocks', encounters: { arrival: 0.3, ambush: 0.2, groups: [{ enemies: { squid_spawn: 2 }, weight: 1 }] }, research: 'shipwrighting', era: 'medieval', description: 'Low rocks far to the east where the seals haul out. Good hides, if the tide allows.' }),
  island({ id: 'drowned_spires', name: 'The Drowned Spires', type: 'salvage', outSeconds: 380, workSeconds: 200, secondsPerUnit: 7, loot: { iron: 4, cloth: 3, glass: 2, silver: 1 }, threats: 'The drowned keep their towers', encounters: { arrival: 0.5, ambush: 0.2, groups: [{ enemies: { drowned_sailor: 2 }, weight: 2 }, { enemies: { drowned_sailor: 1, sea_reaver: 1 }, weight: 1 }] }, research: 'shipwrighting', era: 'medieval', description: 'The towers of a town the sea took, standing out of the water off the south-west. Its cellars are full.' }),
  island({ id: 'kraken_deep', name: 'The Kraken Deep', type: 'legendary', outSeconds: 420, workSeconds: 220, secondsPerUnit: 8, loot: { pearls: 3, leather: 3, fish: 6 }, guaranteed: { pearls: 6, leather: 4 }, threats: 'The Kraken (boss) and its spawn', encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { kraken: 1, squid_spawn: 2 }, weight: 1 }] }, research: 'navigation', era: 'medieval', description: 'Black water in the middle of the strait, where boats go missing. Something lives below.' }),
  island({ id: 'pirate_haven', name: 'Pirate Haven', type: 'trade', outSeconds: 360, workSeconds: 80, secondsPerUnit: 5, loot: { cloth: 3, glass: 2, silver: 2, gems: 1, pearls: 2 }, coins: 120, threats: 'Reavers, in and out of port', encounters: { arrival: 0, ambush: 0.25, groups: [{ enemies: { sea_reaver: 2 }, weight: 1 }] }, research: 'navigation', era: 'medieval', recommendedParty: 2, description: "A cove of lanterns and no questions off the west coast. A purse goes further there than at any market ashore." }),
  island({ id: 'spice_port', name: 'The Spice Port', type: 'trade', outSeconds: 420, workSeconds: 80, secondsPerUnit: 5, loot: { silver: 3, gems: 2, glass: 3, cloth: 4, steel: 2 }, coins: 240, threats: 'Pirates on the long run', encounters: { arrival: 0, ambush: 0.3, groups: [{ enemies: { sea_reaver: 3 }, weight: 1 }] }, research: 'steamships', era: 'industrial', recommendedParty: 2, description: 'A great harbour over the horizon to the south-east, where ships from everywhere trade.' }),
];
export const ISLAND_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  gull_rock: { x: 632, y: 300 },
  turtle_atoll: { x: 325, y: 606 },
  seal_skerries: { x: 720, y: 370 },
  drowned_spires: { x: 206, y: 718 },
  kraken_deep: { x: 478, y: 560 },
  pirate_haven: { x: 44, y: 632 },
  spice_port: { x: 736, y: 722 },
};
export const ISLAND_ROUTES: Readonly<Record<string, [SceneId, SceneId]>> = Object.fromEntries(ISLANDS.map((d) => [d.id, ['coast', 'coast']]));

/* ------------------------------------------------------------ at sea, and at home */

/** A storm's chance an hour at sea, by the season, and what it does to a hull (its share of the hull). */
export const STORM_HOURLY: Readonly<Record<'spring' | 'summer' | 'autumn' | 'winter', number>> = { spring: 0.02, summer: 0.012, autumn: 0.03, winter: 0.06 };
export const STORM_HURT: [number, number] = [0.12, 0.35];
/** In a bad storm (more than this share of the hull at once) someone may be swept over the side. */
export const OVERBOARD_AT = 0.28;
export const OVERBOARD = 0.25;
/** The chance an hour at sea of meeting the sea's foes, and of pirates (from the Medieval age). */
export const MONSTER_HOURLY = 0.02;
export const PIRATE_HOURLY = 0.015;
/** Wrecked: each aboard drowns at this chance (one who swims, a merrow, rarely). */
export const DROWN = 0.4;
export const DROWN_SWIMMER = 0.05;
/** Mended at home each dawn, this share of the hull, for a unit of wood (or lumber) a boat. */
export const REPAIR_SHARE = 0.25;
/** A boat sails only above this share of her hull. */
export const SEAWORTHY = 0.5;
/** Fishing: a boat at home brings in her catch each evening (half in winter), at the hour. */
export const FISH_HOUR = 18;
export const WINTER_CATCH = 0.5;
/** The most boats a town keeps (the worst is broken up when a better is built past it). */
export const FLEET_MOST = 3;
/** A boat at home has a small chance a day to take storm damage while out fishing. */
export const FISHING_STORM = 0.08;

/** Names for the town's boats (by the boat's number, in turn). */
export const BOAT_NAMES: readonly string[] = [
  'Gull', 'Sea Wolf', 'Good Hope', 'Tern', 'Saltheart', 'Morning Star', 'Wavecutter', 'Old Faithful', 'Kestrel', 'Lucky Hand',
  'Driftwood', 'Grey Lady', 'Swift', 'Whale Road', 'Brave Heron', 'Silver Fin', 'North Wind', 'Merry Anne', 'Seal', 'Tide Runner',
];
