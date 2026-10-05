// Horses and trade caravans (DESIGN §8, Milestone 2). All numbers are starting points for tuning.

import type { Era } from './eras';
import type { Material } from './materials';
import type { OriginId } from './origins';

/** What a unit of each material is worth in barter. */
export const WORTH: Record<Material, number> = {
  wood: 1,
  stone: 1,
  flint: 2,
  fiber: 1,
  hide: 3,
  bone: 2,
  clay: 1,
  herbs: 2,
  meat: 2,
  berries: 1,
  grain: 1,
  dried_meat: 3,
  rations: 4,
  sling_stones: 1,
  totem: 50,
  eggs: 1,
  milk: 1,
  wool: 2,
  vegetables: 1,
  fruit: 2,
  iron_ore: 3,
  iron: 8,
  lumber: 2,
  bricks: 3,
  leather: 5,
  cloth: 5,
  flour: 2,
  bread: 3,
  arrows: 1,
  coal: 2,
  steel: 14,
  glass: 6,
  shot: 1,
  oil: 3,
  fuel: 5,
  plastic: 5,
  concrete: 3,
  electronics: 20,
  cartridges: 1,
  rare_minerals: 12,
  alloys: 25,
  circuits: 30,
  power_cells: 8,
  gold: 9,
  gems: 16,
  fish: 2,
  kelp: 1,
  pearls: 14,
  blood: 5,
  copper_ore: 3,
  tin_ore: 4,
  silver_ore: 6,
  sulphur: 4,
  copper: 7,
  bronze: 12,
  silver: 15,
  // monster parts (data/hunts.ts): the rarer, the dearer
  beast_fang: 4,
  thick_pelt: 6,
  venom_sac: 8,
  chitin: 9,
  great_horn: 12,
  wyrm_scale: 16,
  gorgon_eye: 22,
  ghost_essence: 14,
  monster_heart: 20,
  dragon_heart: 60,
};

/** What caravans bring to sell, by era (caravans only come from the Medieval era on). */
export const CARAVAN_GOODS: Partial<Record<Era, Material[]>> = {
  medieval: ['iron', 'cloth', 'leather', 'bread', 'lumber', 'bricks', 'iron_ore', 'herbs', 'arrows', 'grain', 'copper_ore', 'tin_ore'],
  industrial: ['steel', 'glass', 'coal', 'iron', 'bricks', 'lumber', 'cloth', 'bread', 'shot', 'leather', 'copper', 'silver_ore', 'sulphur'],
  modern: ['fuel', 'plastic', 'electronics', 'concrete', 'steel', 'glass', 'oil', 'cartridges', 'bread', 'cloth', 'silver', 'sulphur'],
  space: ['rare_minerals', 'alloys', 'circuits', 'power_cells', 'electronics', 'plastic', 'fuel', 'concrete', 'bread', 'steel', 'silver'],
};
/** What another people's caravan brings besides the era's goods (data/minerals.ts has the minerals; the caravan is
 *  named for its people: "a caravan of the Deep Hold"). */
export const FACTION_GOODS: Partial<Record<OriginId, Material[]>> = {
  settlers: ['grain', 'bread', 'cloth', 'copper_ore'],
  lich: ['bone', 'silver_ore', 'herbs'],
  druid: ['herbs', 'wood', 'fruit', 'tin_ore'],
  vampire: ['cloth', 'leather', 'silver'],
  werewolf: ['hide', 'meat', 'bone'],
  robot: ['copper', 'tin_ore', 'sulphur'],
  dwarves: ['iron_ore', 'copper_ore', 'tin_ore', 'gold', 'gems'],
  merfolk: ['fish', 'kelp', 'pearls'],
  nomads: ['hide', 'wool', 'milk', 'meat'],
  fae: ['herbs', 'fruit', 'silver_ore'],
  alchemists: ['sulphur', 'glass', 'herbs', 'copper'],
  knights: ['iron', 'bronze', 'bricks'],
};
/** Most caravans are another people's. */
export const FACTION_CARAVAN = 0.75;
export const caravanGoods = (era: Era): Material[] => CARAVAN_GOODS[era] ?? CARAVAN_GOODS.modern!;
/** Offers are worth more in later eras. */
export const OFFER_SCALE: Partial<Record<Era, number>> = { industrial: 2, modern: 3, space: 4 };
/** Caravans sell at this much over worth and buy at this much under. */
export const SELL_MARKUP = 1.3;
export const BUY_RATE = 0.75;
/** Worth of one offer, roughly. */
export const OFFER_WORTH: [number, number] = [18, 36];
/** Game hours between caravans, and how long one stays. */
export const CARAVAN_EVERY: [number, number] = [36, 60];
export const CARAVAN_STAY_HOURS = 12;

/* ------------------------------------------------------------ horses */

export const HORSE_WORTH = 45;
export const HORSE_HP = 60;
/** Each horse on an expedition carries this much; a party with a horse each walks this much faster. */
export const HORSE_CARRY = 20;
export const HORSE_SPEEDUP = 0.75;
/** A lost fight: chance each horse is killed. A retreat: chance each is hurt (and how badly). */
export const HORSE_DIE_ON_LOSS = 0.5;
export const HORSE_HURT_ON_RETREAT = 0.3;
export const HORSE_HURT = 20;
/** Horses heal this much a game hour at home. */
export const HORSE_HEAL = 5;
/** When thieves get away, the chance they take a horse too. */
export const HORSE_THEFT = 0.35;

export const HORSE_NAMES = ['Ash', 'Bramble', 'Clover', 'Dusk', 'Ember', 'Fern', 'Gale', 'Hazel', 'Iris', 'Juniper', 'Kestrel', 'Loam', 'Moss', 'Nettle', 'Oak', 'Pebble', 'Quill', 'Rowan', 'Sorrel', 'Thistle'];
