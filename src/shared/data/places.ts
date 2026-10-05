// Places on the town's own land, found as the known land grows (sim/places.ts): an ore vein the town can dig, a cave
// with something living in it, a burnt-out trader's cart, a beast's lair, old ruins, great bones. The peaceful ones
// the town looks into itself; the dangerous ones wait for a party the player picks, fought as a trip (the FF
// screen), and give up their hoard when cleared.

import type { Era } from './eras';
import type { Material } from './materials';

export type PlaceKind = 'vein' | 'cave' | 'cart' | 'beast' | 'ruin' | 'bones' | 'reef';

export interface PlaceDef {
  kind: PlaceKind;
  name: string;
  /** How likely, among the places seeded on a land. */
  weight: number;
  /** What's found there (the feed's line), and for a fight, what waits. */
  found: string;
  /** Whether something has to be fought first. */
  fight: boolean;
  /** The hoard that comes home with the party that clears it (odds by material, for the trip's loot), and what's
   *  always there. */
  loot: Partial<Record<Material, number>>;
  hoard: Partial<Record<Material, number>>;
  coins: [number, number];
  /** The scenery on the way and there. */
  scenery: 'woods' | 'cave' | 'quarry' | 'thicket' | 'river';
  /** Suggested party. */
  party: number;
}

export const PLACE_DEFS: Record<PlaceKind, PlaceDef> = {
  vein: { kind: 'vein', name: 'Ore Vein', weight: 3, found: 'A seam of ore shows in the rock: stone, iron and coal for the digging.', fight: false, loot: {}, hoard: {}, coins: [0, 0], scenery: 'quarry', party: 0 },
  cave: { kind: 'cave', name: 'Cave', weight: 2, found: 'A dark mouth in the hillside, and tracks going in. Something lives there.', fight: true, loot: { hide: 3, bone: 3, stone: 2 }, hoard: { hide: 2, bone: 2 }, coins: [20, 60], scenery: 'cave', party: 3 },
  cart: { kind: 'cart', name: "Trader's Cart", weight: 3, found: 'A burnt-out cart by the way, its goods strewn about. Who did this is still near, perhaps.', fight: false, loot: { cloth: 2, rations: 2 }, hoard: { cloth: 2 }, coins: [10, 40], scenery: 'woods', party: 2 },
  beast: { kind: 'beast', name: "Beast's Lair", weight: 3, found: 'Gnawed bones and a trampled den: a great beast hunts from here.', fight: true, loot: { hide: 3, meat: 4, bone: 2 }, hoard: { hide: 2, meat: 3 }, coins: [0, 0], scenery: 'thicket', party: 3 },
  ruin: { kind: 'ruin', name: 'Old Ruins', weight: 2, found: 'Worked stones under the moss, older than anyone remembers. There may be something to learn here.', fight: false, loot: {}, hoard: { stone: 6 }, coins: [8, 30], scenery: 'quarry', party: 0 },
  // (a shore town's sea beast, laired on a wreck out on the reef: seeded only on a sea-shaped land, sim/places.ts)
  reef: { kind: 'reef', name: "Sea Beast's Reef", weight: 0, found: 'Out past the shallows the water boils over an old wreck on the reef: something big lairs there.', fight: true, loot: { fish: 4, kelp: 3, pearls: 1 }, hoard: { pearls: 2, fish: 4 }, coins: [10, 40], scenery: 'river', party: 3 },
  bones: { kind: 'bones', name: 'Great Bones', weight: 1, found: 'The bones of something vast, bleached white. Nothing has lived here for an age.', fight: false, loot: {}, hoard: { bone: 10 }, coins: [0, 0], scenery: 'quarry', party: 0 },
};

/** What waits at a fight place, by the era it's found in (a cave's or lair's dwellers, a cart's robbers). */
export const PLACE_FOES: Record<'cave' | 'beast' | 'cart' | 'reef', Partial<Record<Era, Record<string, number>[]>>> = {
  reef: {
    neolithic: [{ squid_spawn: 2 }, { crocodile: 3 }],
    medieval: [{ squidbeard: 1, squid_spawn: 1 }, { squid_spawn: 3 }],
    industrial: [{ squidbeard: 1, squid_spawn: 2 }],
    modern: [{ kraken: 1 }],
    space: [{ kraken: 1, squid_spawn: 2 }],
  },
  cave: {
    neolithic: [{ wolf: 3, wolf_alpha: 1 }, { boar: 2 }, { rival_spear: 2, rival_slinger: 1 }],
    medieval: [{ ogre: 1 }, { bandit: 2, bandit_archer: 1 }, { slime: 3 }, { wolf_alpha: 1, wolf: 3 }],
    industrial: [{ ogre: 1, wolf: 2 }, { gangster: 3 }, { zombie_bear: 1 }],
    modern: [{ raider: 3 }, { ogre: 2 }],
    space: [{ space_pirate: 3 }, { slug_bot: 1 }],
  },
  beast: {
    neolithic: [{ cave_bear: 1 }, { wolf_alpha: 1, wolf: 2 }, { boar: 3 }],
    medieval: [{ cave_bear: 1 }, { ogre: 1 }, { wolf_alpha: 2, wolf: 2 }],
    industrial: [{ zombie_bear: 1 }, { frost_yeti: 2 }, { cave_bear: 1 }],
    modern: [{ zombie_bear: 2 }, { frost_yeti: 2 }],
    space: [{ drake: 2 }, { abomination: 1 }],
  },
  cart: {
    neolithic: [{ rival_spear: 2, rival_slinger: 1 }],
    medieval: [{ bandit: 2, bandit_archer: 1 }],
    industrial: [{ gangster: 2 }],
    modern: [{ raider: 2 }],
    space: [{ space_pirate: 2 }],
  },
};

/** The land's own beasts: in the savannah and the swamp the lairs hold them. */
export const BIOME_BEASTS: Record<string, Record<string, number>[]> = {
  desert: [{ lion: 1, lioness: 2 }, { wild_dog: 4 }],
  coast: [{ crocodile: 2 }],
};

/** How many places a land holds, how far from the camp they lie (cells), and how far apart. */
export const PLACE_COUNT = 14;
export const PLACE_NEAR = 10;
export const PLACE_FAR = 42;
export const PLACE_APART = 5;
/** A found cart's robbers are still about this often. */
export const CART_ROBBED = 0.4;
/** Hours after a peaceful place is found before the town has looked it over. */
export const LOOK_HOURS = 3;
/** Days a beast stays in its lair unfought before it wanders off; a cave's dwellers stay. */
export const BEAST_DAYS = 6;
/** Walking time to a place, per cell. */
export const PLACE_SECONDS_PER_CELL = 2;

/** A place's destination id on the Expedition Board, and whether an id is one. */
export const placeDestId = (id: number) => `place:${id}`;
export const isPlaceDest = (id: string) => id.startsWith('place:');
export const placeIdOf = (dest: string) => Number(dest.slice(6));

/** The eight directions, for the feed ("to the north-east"). */
export function directionName(dx: number, dy: number): string {
  const a = ((Math.atan2(dy, dx) * 180) / Math.PI + 360 + 22.5) % 360;
  return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.floor(a / 45)];
}
