// Craftable items and refining recipes by era (DESIGN §15 and on). Numbers are starting points for tuning.
//
// Gear is worn in a slot and does something for its wearer. Everything else is kept in the town's
// inventory (it takes no storage room) and works from there: rope goes into other recipes, snares catch
// food, clay pots add storage, bedrolls go to people without a bed, poultices treat the badly hurt, and
// waterskins go with expeditions. Food and ammo are made as materials instead, so they sit in storage
// and get eaten or packed like any other.

import type { Material } from './materials';
import type { WorkAnim } from './terrain';

export type Slot = 'tool' | 'weapon' | 'offhand' | 'head' | 'body' | 'charm' | 'pack';
export const SLOTS: readonly Slot[] = ['weapon', 'offhand', 'head', 'body', 'tool', 'charm', 'pack'];
export const SLOT_NAMES: Record<Slot, string> = {
  tool: 'Tool',
  weapon: 'Weapon',
  offhand: 'Off-hand',
  head: 'Head',
  body: 'Body',
  charm: 'Charm',
  pack: 'Pack',
};

/** Where an item is made (a building id). 'campfire' needs only the camp's fire. */
export type Station =
  | 'campfire'
  | 'workbench'
  | 'tanning_rack'
  | 'drying_rack'
  | 'kiln'
  | 'bloomery'
  | 'smithy'
  | 'sawmill'
  | 'tannery'
  | 'loom'
  | 'windmill'
  | 'bakery'
  | 'steelworks'
  | 'glassworks'
  | 'gunsmith'
  | 'refinery'
  | 'cement_works'
  | 'electronics_plant'
  | 'garage'
  | 'alloy_foundry'
  | 'chip_fab'
  | 'battery_plant'
  | 'robot_workshop'
  | 'tavern';
export const STATIONS: readonly Station[] = ['campfire', 'workbench', 'tanning_rack', 'drying_rack', 'kiln', 'bloomery', 'smithy', 'sawmill', 'tannery', 'loom', 'windmill', 'bakery', 'steelworks', 'glassworks', 'gunsmith', 'refinery', 'cement_works', 'electronics_plant', 'garage', 'alloy_foundry', 'chip_fab', 'battery_plant', 'robot_workshop', 'tavern'];

/** What an item does for whoever wears it (gear) or for the town (the rest). */
export interface ItemEffects {
  /** Work speed multipliers for the wearer. */
  gather?: Partial<Record<WorkAnim, number>>;
  construct?: number;
  /** Combat: extra damage, extra damage against beasts, hit chance, share of damage taken away, chance to block. */
  damage?: number;
  beastDamage?: number;
  accuracy?: number;
  armor?: number;
  block?: number;
  /** A weapon for shooting or throwing (fights from range; does more with its ammo). */
  ranged?: boolean;
  /** What it shoots: each shot uses one, for extra damage (see AMMO_DAMAGE). */
  ammo?: Material;
  /** Extra carrying room. */
  carry?: number;
  morale?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  /** Gear slot, or null for inventory items. Material outputs have their own `makes`. */
  slot: Slot | null;
  station: Station;
  /** Materials and items used up. */
  cost: Partial<Record<Material, number>>;
  items?: Record<string, number>;
  /** Base seconds of crafting work (before era multiplier and crafter speed). */
  seconds: number;
  /** Research needed (all of them). */
  research: string[];
  /** Made as materials into storage, instead of an item. */
  makes?: Partial<Record<Material, number>>;
  effects: ItemEffects;
  description: string;
  /** DawnLike item sheet and cell (16px); or a code-drawn one by name (sheet 'Custom'). */
  icon: { sheet: IconSheet; x: number; y: number; name?: string };
  /** A relic: never crafted, only found on expeditions (DESIGN §9 special items). */
  relic?: boolean;
  /** Shop furnishings (see data/shop.ts): what it is, how many cells of the shop floor it takes, and how much it
   *  draws travellers in. The shopkeeper sets it out once it's made. */
  furnish?: Furnish;
  /** Wares: fine goods made only to sell in the shop, to customers of this tier or higher (see data/shop.ts), for
   *  this many coins. */
  ware?: { tier: WareTier; price: number };
  /** Fare: served in the tavern, for this many coins (times the era's scale). */
  fare?: { kind: FareKind; price: number };
}

export type WareTier = 1 | 2 | 3 | 4;

export type FurnishKind = 'shelf' | 'table' | 'stand' | 'decor' | 'rug';
export interface Furnish {
  kind: FurnishKind;
  w: number;
  h: number;
  /** Appeal in a shop, comfort in a tavern. */
  appeal: number;
  /** Where it goes: a shop (when left out), a tavern, or either. */
  venue?: 'tavern' | 'both';
}

/** Fare: what a tavern serves. Guests come wanting a kind of it, or one dish in particular. */
export type FareKind = 'hearty' | 'sweet' | 'drink';
export const FARE_NAMES: Record<FareKind, string> = { hearty: 'a hearty meal', sweet: 'something sweet', drink: 'a drink' };

export type IconSheet =
  | 'ShortWep'
  | 'MedWep'
  | 'LongWep'
  | 'Tool'
  | 'Rock'
  | 'Shield'
  | 'Hat'
  | 'Armor'
  | 'Amulet'
  | 'Light'
  | 'Potion'
  | 'Chest0'
  | 'Chest1'
  | 'Food'
  | 'Flesh'
  | 'Money'
  | 'Ammo'
  | 'Scroll'
  | 'Magic'
  | 'Plate'
  | 'Custom';

export const ITEMS: readonly ItemDef[] = [
  // tools
  { id: 'flint_knife', name: 'Flint Knife', slot: 'tool', station: 'campfire', cost: { flint: 2, wood: 1 }, seconds: 30, research: ['flint_knapping'], effects: { gather: { forage: 1.25 }, damage: 1 }, description: 'Forage 25% faster. A little bite in a fight.', icon: { sheet: 'ShortWep', x: 2, y: 1 } },
  { id: 'stone_axe', name: 'Stone Axe', slot: 'tool', station: 'workbench', cost: { flint: 2, wood: 2, fiber: 1 }, seconds: 45, research: ['woodcutting'], effects: { gather: { chop: 1.5 } }, description: 'Chop wood 50% faster.', icon: { sheet: 'MedWep', x: 0, y: 1 } },
  { id: 'stone_hammer', name: 'Stone Hammer', slot: 'tool', station: 'workbench', cost: { stone: 2, wood: 2, fiber: 1 }, seconds: 45, research: ['stoneworking'], effects: { gather: { mine: 1.5 }, construct: 1.25 }, description: 'Break rock 50% faster, build 25% faster.', icon: { sheet: 'Tool', x: 1, y: 1 } },
  // weapons
  { id: 'wooden_club', name: 'Wooden Club', slot: 'weapon', station: 'campfire', cost: { wood: 3 }, seconds: 20, research: [], effects: { damage: 2 }, description: '+2 melee damage.', icon: { sheet: 'ShortWep', x: 0, y: 2 } },
  { id: 'spear', name: 'Spear', slot: 'weapon', station: 'workbench', cost: { wood: 2, flint: 1, fiber: 1 }, seconds: 45, research: ['spear_hunting'], effects: { damage: 4, accuracy: 0.05 }, description: '+4 melee damage, better aim.', icon: { sheet: 'LongWep', x: 4, y: 4 } },
  { id: 'fire_spear', name: 'Fire-Hardened Spear', slot: 'weapon', station: 'campfire', cost: { wood: 1 }, items: { spear: 1 }, seconds: 40, research: ['spear_hunting', 'fire_keeping'], effects: { damage: 6, accuracy: 0.05 }, description: '+6 melee damage, better aim.', icon: { sheet: 'LongWep', x: 2, y: 4 } },
  { id: 'sling', name: 'Sling', slot: 'weapon', station: 'workbench', cost: { hide: 1 }, items: { rope: 1 }, seconds: 40, research: ['cordage'], effects: { ranged: true, ammo: 'sling_stones', damage: 2 }, description: 'Fights from range. +2 damage, +3 more with sling stones.', icon: { sheet: 'LongWep', x: 0, y: 5 } },
  { id: 'sling_stones', name: 'Sling Stones', slot: null, station: 'campfire', cost: { stone: 2 }, seconds: 20, research: ['cordage'], makes: { sling_stones: 6 }, effects: {}, description: 'Ammunition for slings: 6 per batch, one per shot.', icon: { sheet: 'Rock', x: 1, y: 1 } },
  // armour and trinkets
  { id: 'wicker_shield', name: 'Wicker Shield', slot: 'offhand', station: 'workbench', cost: { wood: 2, fiber: 3 }, seconds: 45, research: ['cordage'], effects: { block: 0.15 }, description: 'Blocks 15% of blows.', icon: { sheet: 'Shield', x: 5, y: 0 } },
  { id: 'torch', name: 'Torch', slot: 'offhand', station: 'campfire', cost: { wood: 1, fiber: 1 }, seconds: 15, research: ['fire_keeping'], effects: { beastDamage: 3 }, description: 'Beasts fear fire: +3 damage against animals.', icon: { sheet: 'Light', x: 0, y: 0 } },
  { id: 'hide_cap', name: 'Hide Cap', slot: 'head', station: 'tanning_rack', cost: { hide: 2, fiber: 1 }, seconds: 40, research: ['tanning'], effects: { armor: 0.1 }, description: 'Takes 10% off every hit.', icon: { sheet: 'Hat', x: 0, y: 1 } },
  { id: 'hide_armor', name: 'Hide Armor', slot: 'body', station: 'tanning_rack', cost: { hide: 5, fiber: 2 }, seconds: 90, research: ['tanning'], effects: { armor: 0.2 }, description: 'Takes 20% off every hit.', icon: { sheet: 'Armor', x: 0, y: 7 } },
  { id: 'bone_charm', name: 'Bone Charm', slot: 'charm', station: 'campfire', cost: { bone: 2, fiber: 1 }, seconds: 30, research: [], effects: { morale: 5 }, description: '+5 morale for whoever wears it.', icon: { sheet: 'Amulet', x: 3, y: 1 } },
  { id: 'backpack', name: 'Backpack', slot: 'pack', station: 'tanning_rack', cost: { hide: 3 }, items: { rope: 1 }, seconds: 60, research: ['pack_carrying'], effects: { carry: 5 }, description: 'Carry 5 more.', icon: { sheet: 'Chest0', x: 0, y: 2 } },
  // town inventory
  { id: 'rope', name: 'Rope', slot: null, station: 'campfire', cost: { fiber: 3 }, seconds: 20, research: ['cordage'], effects: {}, description: 'Goes into slings, snares and backpacks.', icon: { sheet: 'Tool', x: 2, y: 2 } },
  { id: 'snare', name: 'Snare', slot: null, station: 'campfire', cost: { wood: 1 }, items: { rope: 1 }, seconds: 30, research: ['cordage'], effects: {}, description: 'Set around camp: catches meat now and then. Sometimes breaks.', icon: { sheet: 'Tool', x: 6, y: 1 } },
  { id: 'clay_pot', name: 'Clay Pot', slot: null, station: 'kiln', cost: { clay: 3 }, seconds: 45, research: ['pottery'], effects: {}, description: '+5 room in the campfire store (up to 10 pots).', icon: { sheet: 'Potion', x: 4, y: 2 } },
  { id: 'waterskin', name: 'Waterskin', slot: null, station: 'tanning_rack', cost: { hide: 2, fiber: 1 }, seconds: 40, research: ['tanning'], effects: {}, description: 'A party with one each walks 10% faster.', icon: { sheet: 'Potion', x: 1, y: 3 } },
  { id: 'bedroll', name: 'Bedroll', slot: null, station: 'tanning_rack', cost: { hide: 2, fiber: 2 }, seconds: 45, research: ['tanning'], effects: {}, description: 'Someone without a bed sleeps almost as well.', icon: { sheet: 'Armor', x: 3, y: 5 } },
  // wares: fine goods made to sell in the shop (the better the customers it draws, the finer the goods they want)
  { id: 'bone_trinket', name: 'Bone Trinkets', slot: null, station: 'campfire', cost: { bone: 2 }, seconds: 30, research: ['barter'], effects: {}, ware: { tier: 1, price: 6 }, description: 'A ware for the shop: carved beads and toggles. Travellers pay 6 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'bone_trinket' } },
  { id: 'reed_basket', name: 'Reed Basket', slot: null, station: 'campfire', cost: { fiber: 4 }, seconds: 35, research: ['barter', 'cordage'], effects: {}, ware: { tier: 1, price: 7 }, description: 'A ware for the shop. Travellers pay 7 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'reed_basket' } },
  { id: 'clay_figurine', name: 'Clay Figurine', slot: null, station: 'kiln', cost: { clay: 3 }, seconds: 40, research: ['barter', 'pottery'], effects: {}, ware: { tier: 1, price: 8 }, description: 'A ware for the shop: a little fired beast. Travellers pay 8 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'clay_figurine' } },
  { id: 'herbal_salve', name: 'Herbal Salve', slot: null, station: 'campfire', cost: { herbs: 3 }, seconds: 40, research: ['barter', 'herbalism'], effects: {}, ware: { tier: 1, price: 10 }, description: 'A ware for the shop. Travellers pay 10 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'herbal_salve' } },
  { id: 'painted_urn', name: 'Painted Urn', slot: null, station: 'kiln', cost: { clay: 4, herbs: 2 }, seconds: 60, research: ['barter', 'pottery', 'herbalism'], effects: {}, ware: { tier: 2, price: 20 }, description: 'A ware for merchants: an urn painted with herb dyes. 20 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'painted_urn' } },
  { id: 'sweet_loaves', name: 'Sweet Loaves', slot: null, station: 'bakery', cost: { bread: 2, berries: 2 }, seconds: 60, research: ['barter', 'baking'], effects: {}, ware: { tier: 2, price: 24 }, description: 'A ware for merchants: berry bread. 24 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'sweet_loaves' } },
  { id: 'leather_satchel', name: 'Leather Satchel', slot: null, station: 'tannery', cost: { leather: 2 }, seconds: 90, research: ['barter', 'leatherworking'], effects: {}, ware: { tier: 2, price: 30 }, description: 'A ware for merchants. 30 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'leather_satchel' } },
  { id: 'dyed_cloth', name: 'Dyed Cloth', slot: null, station: 'loom', cost: { cloth: 2, herbs: 1 }, seconds: 90, research: ['barter', 'weaving'], effects: {}, ware: { tier: 2, price: 32 }, description: 'A ware for merchants: cloth dyed with herbs. 32 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'dyed_cloth' } },
  { id: 'iron_brooch', name: 'Iron Brooch', slot: null, station: 'smithy', cost: { iron: 2 }, seconds: 120, research: ['barter', 'iron_working'], effects: {}, ware: { tier: 3, price: 60 }, description: 'A ware for nobles: fine metalwork. 60 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'iron_brooch' } },
  { id: 'glassware', name: 'Glassware', slot: null, station: 'glassworks', cost: { glass: 2 }, seconds: 120, research: ['barter', 'glassblowing'], effects: {}, ware: { tier: 3, price: 75 }, description: 'A ware for nobles: goblets and a decanter. 75 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'glassware' } },
  { id: 'steel_cutlery', name: 'Steel Cutlery', slot: null, station: 'steelworks', cost: { steel: 1, lumber: 1 }, seconds: 150, research: ['barter', 'steelmaking'], effects: {}, ware: { tier: 3, price: 85 }, description: 'A ware for nobles. 85 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'steel_cutlery' } },
  { id: 'plastic_toys', name: 'Plastic Toys', slot: null, station: 'refinery', cost: { plastic: 2 }, seconds: 120, research: ['barter', 'refining'], effects: {}, ware: { tier: 4, price: 140 }, description: 'A ware for magnates (for their children). 140 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'plastic_toys' } },
  { id: 'radio_set', name: 'Radio Set', slot: null, station: 'electronics_plant', cost: { electronics: 2, plastic: 1 }, seconds: 200, research: ['barter', 'electronics'], effects: {}, ware: { tier: 4, price: 240 }, description: 'A ware for magnates. 240 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'radio_set' } },
  { id: 'holo_charm', name: 'Holo Charm', slot: null, station: 'chip_fab', cost: { circuits: 1, alloys: 1 }, seconds: 240, research: ['barter', 'microchips'], effects: {}, ware: { tier: 4, price: 420 }, description: 'A ware for magnates: a charm that shows moving pictures. 420 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'holo_charm' } },
  // tavern furnishings (comfort: the more comfortable the tavern, the better-off the guests)
  { id: 'log_table', name: 'Log Table', slot: null, station: 'workbench', cost: { wood: 8 }, seconds: 50, research: ['hospitality'], effects: {}, furnish: { kind: 'table', w: 2, h: 2, appeal: 3, venue: 'tavern' }, description: 'Tavern furnishing: a table of split logs with benches. Comfort +3.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'log_table' } },
  { id: 'stone_hearth', name: 'Stone Hearth', slot: null, station: 'campfire', cost: { stone: 10 }, seconds: 60, research: ['hospitality'], effects: {}, furnish: { kind: 'shelf', w: 2, h: 1, appeal: 5, venue: 'tavern' }, description: 'Tavern furnishing: a fire to sit by. Comfort +5.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'stone_hearth' } },
  { id: 'barrels', name: 'Barrels', slot: null, station: 'workbench', cost: { wood: 5 }, seconds: 40, research: ['hospitality'], effects: {}, furnish: { kind: 'stand', w: 1, h: 1, appeal: 1, venue: 'tavern' }, description: 'Tavern furnishing: somewhere to lean. Comfort +1.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'barrels' } },
  { id: 'hide_rug', name: 'Hide Rug', slot: null, station: 'tanning_rack', cost: { hide: 3 }, seconds: 45, research: ['hospitality', 'tanning'], effects: {}, furnish: { kind: 'rug', w: 2, h: 1, appeal: 3, venue: 'tavern' }, description: 'Tavern furnishing: warm underfoot. Comfort +3.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'hide_rug' } },
  { id: 'oak_table', name: 'Oak Table', slot: null, station: 'sawmill', cost: { lumber: 6 }, seconds: 90, research: ['hospitality', 'carpentry'], effects: {}, furnish: { kind: 'table', w: 2, h: 2, appeal: 6, venue: 'tavern' }, description: 'Tavern furnishing: a sawn table with proper chairs. Comfort +6.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'oak_table' } },
  { id: 'brick_hearth', name: 'Brick Hearth', slot: null, station: 'kiln', cost: { bricks: 6, stone: 4 }, seconds: 120, research: ['hospitality', 'masonry'], effects: {}, furnish: { kind: 'shelf', w: 2, h: 1, appeal: 9, venue: 'tavern' }, description: 'Tavern furnishing: a great hearth with a spit. Comfort +9.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'brick_hearth' } },
  { id: 'tapestry', name: 'Tapestry', slot: null, station: 'loom', cost: { cloth: 3 }, seconds: 100, research: ['hospitality', 'weaving'], effects: {}, furnish: { kind: 'decor', w: 1, h: 1, appeal: 5, venue: 'tavern' }, description: 'Tavern furnishing: a woven hunting scene. Comfort +5.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'tapestry' } },
  { id: 'upright_piano', name: 'Upright Piano', slot: null, station: 'sawmill', cost: { lumber: 8, steel: 1 }, seconds: 150, research: ['hospitality', 'steelmaking'], effects: {}, furnish: { kind: 'shelf', w: 2, h: 1, appeal: 12, venue: 'tavern' }, description: 'Tavern furnishing: songs of an evening. Comfort +12.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'upright_piano' } },
  // fare (served in the tavern; guests come for a kind of it, or one dish in particular)
  { id: 'roast_meat', name: 'Roast', slot: null, station: 'campfire', cost: { meat: 2 }, seconds: 30, research: ['hospitality'], effects: {}, fare: { kind: 'hearty', price: 6 }, description: 'Tavern fare: meat off the spit. 6 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'roast_meat' } },
  { id: 'porridge', name: 'Porridge', slot: null, station: 'campfire', cost: { grain: 3 }, seconds: 25, research: ['hospitality', 'early_agriculture'], effects: {}, fare: { kind: 'hearty', price: 4 }, description: 'Tavern fare: a bowl of hot grain. 4 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'porridge' } },
  { id: 'berry_bowl', name: 'Berry Bowl', slot: null, station: 'campfire', cost: { berries: 3 }, seconds: 20, research: ['hospitality'], effects: {}, fare: { kind: 'sweet', price: 4 }, description: 'Tavern fare: wild berries. 4 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'berry_bowl' } },
  { id: 'herb_tea', name: 'Herb Tea', slot: null, station: 'campfire', cost: { herbs: 1 }, seconds: 20, research: ['hospitality', 'herbalism'], effects: {}, fare: { kind: 'drink', price: 4 }, description: 'Tavern fare: a hot brew of herbs. 4 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'herb_tea' } },
  { id: 'berry_wine', name: 'Berry Wine', slot: null, station: 'kiln', cost: { berries: 4 }, seconds: 60, research: ['hospitality', 'pottery'], effects: {}, fare: { kind: 'drink', price: 9 }, description: 'Tavern fare: wine laid down in clay jars. 9 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'berry_wine' } },
  { id: 'ale', name: 'Ale', slot: null, station: 'tavern', cost: { grain: 3 }, seconds: 60, research: ['hospitality', 'brewing'], effects: {}, fare: { kind: 'drink', price: 10 }, description: 'Tavern fare: brewed in the tavern. 10 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'ale' } },
  { id: 'stew', name: 'Stew', slot: null, station: 'tavern', cost: { meat: 1, herbs: 1, grain: 2 }, seconds: 60, research: ['hospitality', 'brewing'], effects: {}, fare: { kind: 'hearty', price: 11 }, description: 'Tavern fare: a pot kept on the fire. 11 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'stew' } },
  { id: 'meat_pie', name: 'Meat Pie', slot: null, station: 'bakery', cost: { meat: 2, flour: 1 }, seconds: 80, research: ['hospitality', 'baking'], effects: {}, fare: { kind: 'hearty', price: 15 }, description: 'Tavern fare: baked in a crust. 15 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'meat_pie' } },
  { id: 'honey_cake', name: 'Honey Cake', slot: null, station: 'bakery', cost: { flour: 1, berries: 2 }, seconds: 70, research: ['hospitality', 'baking'], effects: {}, fare: { kind: 'sweet', price: 13 }, description: 'Tavern fare: sticky and sweet. 13 coins.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'honey_cake' } },
  // shop furnishings (the shopkeeper sets them out in the shop; a better-furnished shop sells more)
  { id: 'crate_stand', name: 'Crate Stand', slot: null, station: 'campfire', cost: { wood: 3 }, seconds: 25, research: ['barter'], effects: {}, furnish: { kind: 'stand', w: 1, h: 1, appeal: 1 }, description: 'Shop furnishing: an upturned crate with goods on it. Appeal +1.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'crate_stand' } },
  { id: 'plank_shelf', name: 'Plank Shelf', slot: null, station: 'workbench', cost: { wood: 6 }, seconds: 40, research: ['barter'], effects: {}, furnish: { kind: 'shelf', w: 2, h: 1, appeal: 3 }, description: 'Shop furnishing: goods laid out along a wall. Appeal +3.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'plank_shelf' } },
  { id: 'woven_mat', name: 'Woven Mat', slot: null, station: 'campfire', cost: { fiber: 4 }, seconds: 30, research: ['barter', 'cordage'], effects: {}, furnish: { kind: 'rug', w: 2, h: 1, appeal: 2, venue: 'both' }, description: 'Shop furnishing: a mat for the floor. Appeal +2.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'woven_mat' } },
  { id: 'clay_urns', name: 'Clay Urns', slot: null, station: 'kiln', cost: { clay: 4 }, seconds: 40, research: ['barter', 'pottery'], effects: {}, furnish: { kind: 'decor', w: 1, h: 1, appeal: 2, venue: 'both' }, description: 'Shop furnishing: painted urns in a corner. Appeal +2.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'clay_urns' } },
  { id: 'trestle_table', name: 'Trestle Table', slot: null, station: 'workbench', cost: { wood: 8, stone: 2 }, seconds: 60, research: ['barter', 'woodcutting'], effects: {}, furnish: { kind: 'table', w: 2, h: 2, appeal: 4 }, description: 'Shop furnishing: a big table of wares in the middle of the floor. Appeal +4.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'trestle_table' } },
  { id: 'herb_planter', name: 'Herb Planter', slot: null, station: 'kiln', cost: { clay: 2, herbs: 3 }, seconds: 40, research: ['barter', 'pottery', 'herbalism'], effects: {}, furnish: { kind: 'decor', w: 1, h: 1, appeal: 3, venue: 'both' }, description: 'Shop furnishing: a pot of sweet herbs. Appeal +3.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'herb_planter' } },
  { id: 'oak_shelves', name: 'Oak Shelves', slot: null, station: 'sawmill', cost: { lumber: 6 }, seconds: 90, research: ['barter', 'carpentry'], effects: {}, furnish: { kind: 'shelf', w: 2, h: 1, appeal: 6 }, description: 'Shop furnishing: tall sawn shelves. Appeal +6.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'oak_shelves' } },
  { id: 'display_table', name: 'Display Table', slot: null, station: 'sawmill', cost: { lumber: 8, cloth: 2 }, seconds: 120, research: ['barter', 'carpentry', 'weaving'], effects: {}, furnish: { kind: 'table', w: 2, h: 2, appeal: 8 }, description: 'Shop furnishing: a cloth-covered table of the best wares. Appeal +8.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'display_table' } },
  { id: 'wool_rug', name: 'Wool Rug', slot: null, station: 'loom', cost: { cloth: 3 }, seconds: 90, research: ['barter', 'weaving'], effects: {}, furnish: { kind: 'rug', w: 2, h: 1, appeal: 5, venue: 'both' }, description: 'Shop furnishing: a patterned rug. Appeal +5.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'wool_rug' } },
  { id: 'iron_lantern', name: 'Iron Lantern', slot: null, station: 'smithy', cost: { iron: 2 }, seconds: 90, research: ['barter', 'iron_working'], effects: {}, furnish: { kind: 'decor', w: 1, h: 1, appeal: 5, venue: 'both' }, description: 'Shop furnishing: a warm light to shop by. Appeal +5.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'iron_lantern' } },
  { id: 'glass_cabinet', name: 'Glass Cabinet', slot: null, station: 'glassworks', cost: { glass: 4, lumber: 2 }, seconds: 150, research: ['barter', 'glassblowing'], effects: {}, furnish: { kind: 'shelf', w: 2, h: 1, appeal: 10 }, description: 'Shop furnishing: goods behind glass. Appeal +10.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'glass_cabinet' } },
  { id: 'neon_sign', name: 'Neon Sign', slot: null, station: 'electronics_plant', cost: { glass: 2, electronics: 1 }, seconds: 150, research: ['barter', 'electronics'], effects: {}, furnish: { kind: 'decor', w: 1, h: 1, appeal: 12 }, description: 'Shop furnishing: it glows, and people come. Appeal +12.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'neon_sign' } },
  { id: 'poultice', name: 'Poultice', slot: null, station: 'campfire', cost: { herbs: 2, fiber: 1 }, seconds: 30, research: ['herbalism'], effects: {}, description: 'Used on anyone badly hurt in town: stops bleeding, +20 health.', icon: { sheet: 'Food', x: 6, y: 1 } },
  // food
  { id: 'dried_meat', name: 'Dried Meat', slot: null, station: 'drying_rack', cost: { meat: 2 }, seconds: 60, research: ['food_preservation'], makes: { dried_meat: 2 }, effects: {}, description: 'More filling than raw meat.', icon: { sheet: 'Flesh', x: 5, y: 4 } },
  { id: 'travel_rations', name: 'Travel Rations', slot: null, station: 'drying_rack', cost: { dried_meat: 1, berries: 2 }, seconds: 60, research: ['food_preservation'], makes: { rations: 2 }, effects: {}, description: 'The most filling food. Expeditions pack it first.', icon: { sheet: 'Food', x: 1, y: 4 } },

  // Industrial
  { id: 'make_steel', name: 'Steel', slot: null, station: 'steelworks', cost: { iron: 2, coal: 3 }, seconds: 60, research: ['steelmaking'], makes: { steel: 1 }, effects: {}, description: 'Iron and coal into steel: 1 per batch.', icon: { sheet: 'Money', x: 4, y: 0 } },
  { id: 'make_glass', name: 'Glass', slot: null, station: 'glassworks', cost: { stone: 3, coal: 2 }, seconds: 50, research: ['glassblowing'], makes: { glass: 2 }, effects: {}, description: 'Glass: 2 per batch.', icon: { sheet: 'Potion', x: 7, y: 2 } },
  { id: 'make_shot', name: 'Musket Shot', slot: null, station: 'gunsmith', cost: { iron: 1, coal: 1 }, seconds: 30, research: ['firearms'], makes: { shot: 10 }, effects: {}, description: 'Ammunition for muskets: 10 per batch.', icon: { sheet: 'Rock', x: 0, y: 0 } },
  { id: 'steel_axe', name: 'Steel Axe', slot: 'tool', station: 'steelworks', cost: { steel: 2, lumber: 1 }, seconds: 80, research: ['steelmaking'], effects: { gather: { chop: 2.8 } }, description: 'Chop wood almost three times as fast.', icon: { sheet: 'MedWep', x: 1, y: 1 } },
  { id: 'steel_pick', name: 'Steel Pick', slot: 'tool', station: 'steelworks', cost: { steel: 2, lumber: 1 }, seconds: 80, research: ['steelmaking'], effects: { gather: { mine: 2.8 } }, description: 'Dig almost three times as fast.', icon: { sheet: 'ShortWep', x: 2, y: 3 } },
  { id: 'musket', name: 'Musket', slot: 'weapon', station: 'gunsmith', cost: { steel: 3, lumber: 2 }, seconds: 120, research: ['firearms'], effects: { ranged: true, ammo: 'shot', damage: 8, accuracy: 0.05 }, description: 'Fires from range. +8 damage, +10 more with shot.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'musket' } },
  { id: 'steel_cuirass', name: 'Steel Cuirass', slot: 'body', station: 'steelworks', cost: { steel: 5, leather: 2 }, seconds: 160, research: ['firearms'], effects: { armor: 0.45 }, description: 'Takes 45% off every hit.', icon: { sheet: 'Plate', x: 0, y: 0 } },
  // Modern
  { id: 'make_fuel', name: 'Fuel', slot: null, station: 'refinery', cost: { oil: 3 }, seconds: 50, research: ['refining'], makes: { fuel: 2 }, effects: {}, description: 'Crude oil into fuel for trucks: 2 per batch.', icon: { sheet: 'Potion', x: 2, y: 0 } },
  { id: 'make_plastic', name: 'Plastic', slot: null, station: 'refinery', cost: { oil: 2, coal: 1 }, seconds: 50, research: ['refining'], makes: { plastic: 2 }, effects: {}, description: 'Plastic: 2 per batch.', icon: { sheet: 'Potion', x: 5, y: 0 } },
  { id: 'make_concrete', name: 'Concrete', slot: null, station: 'cement_works', cost: { stone: 3, coal: 1 }, seconds: 40, research: ['concrete'], makes: { concrete: 3 }, effects: {}, description: 'Concrete: 3 per batch.', icon: { sheet: 'Rock', x: 2, y: 0 } },
  { id: 'make_electronics', name: 'Electronics', slot: null, station: 'electronics_plant', cost: { glass: 1, steel: 1, plastic: 1 }, seconds: 70, research: ['electronics'], makes: { electronics: 1 }, effects: {}, description: 'Circuits and wiring: 1 per batch.', icon: { sheet: 'Money', x: 6, y: 1 } },
  { id: 'make_cartridges', name: 'Rifle Cartridges', slot: null, station: 'gunsmith', cost: { steel: 1, plastic: 1 }, seconds: 30, research: ['rifles'], makes: { cartridges: 15 }, effects: {}, description: 'Ammunition for rifles: 15 per batch.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'cartridges' } },
  { id: 'rifle', name: 'Rifle', slot: 'weapon', station: 'gunsmith', cost: { steel: 3, plastic: 2 }, seconds: 140, research: ['rifles'], effects: { ranged: true, ammo: 'cartridges', damage: 12, accuracy: 0.1 }, description: 'Fires from range, and true. +12 damage, +14 more with cartridges.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'rifle' } },
  { id: 'kevlar_vest', name: 'Kevlar Vest', slot: 'body', station: 'loom', cost: { plastic: 4, cloth: 4 }, seconds: 160, research: ['rifles'], effects: { armor: 0.55 }, description: 'Takes 55% off every hit.', icon: { sheet: 'Armor', x: 7, y: 6 } },
  { id: 'combat_helmet', name: 'Combat Helmet', slot: 'head', station: 'steelworks', cost: { steel: 2, plastic: 1 }, seconds: 90, research: ['rifles'], effects: { armor: 0.2 }, description: 'Takes 20% off every hit.', icon: { sheet: 'Hat', x: 2, y: 1 } },
  { id: 'power_drill', name: 'Power Drill', slot: 'tool', station: 'electronics_plant', cost: { steel: 2, electronics: 1, plastic: 1 }, seconds: 100, research: ['electronics'], effects: { gather: { mine: 3.6 }, construct: 1.5 }, description: 'Dig over three times as fast, build 50% faster.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'power_drill' } },
  { id: 'chainsaw', name: 'Chainsaw', slot: 'tool', station: 'electronics_plant', cost: { steel: 2, electronics: 1, plastic: 1 }, seconds: 100, research: ['electronics'], effects: { gather: { chop: 3.6 } }, description: 'Cut wood over three times as fast.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'chainsaw' } },
  // Robotic & Space
  { id: 'make_alloys', name: 'Alloys', slot: null, station: 'alloy_foundry', cost: { steel: 2, rare_minerals: 2 }, seconds: 80, research: ['advanced_alloys'], makes: { alloys: 1 }, effects: {}, description: 'Light, hard alloys: 1 per batch.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'alloy' } },
  { id: 'make_circuits', name: 'Circuits', slot: null, station: 'chip_fab', cost: { electronics: 1, rare_minerals: 1, plastic: 1 }, seconds: 80, research: ['microchips'], makes: { circuits: 1 }, effects: {}, description: 'Microchips on a board: 1 per batch.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'circuit' } },
  { id: 'make_power_cells', name: 'Power Cells', slot: null, station: 'battery_plant', cost: { rare_minerals: 1, plastic: 1, steel: 1 }, seconds: 50, research: ['power_storage'], makes: { power_cells: 6 }, effects: {}, description: 'Power cells: 6 per batch. They also charge laser rifles, one per shot.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'power_cell' } },
  { id: 'worker_bot', name: 'Worker Bot', slot: null, station: 'robot_workshop', cost: { alloys: 3, circuits: 2, power_cells: 4 }, seconds: 300, research: ['robotics'], effects: {}, description: 'Lends a hand with everything: each makes all work 5% faster (up to 10 bots).', icon: { sheet: 'Custom', x: 0, y: 0, name: 'worker_bot' } },
  { id: 'laser_rifle', name: 'Laser Rifle', slot: 'weapon', station: 'chip_fab', cost: { alloys: 3, circuits: 2 }, seconds: 200, research: ['energy_weapons'], effects: { ranged: true, ammo: 'power_cells', damage: 16, accuracy: 0.15 }, description: 'Fires from range and rarely misses. +16 damage, +20 more with power cells.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'laser_rifle' } },
  { id: 'powered_armor', name: 'Powered Armour', slot: 'body', station: 'robot_workshop', cost: { alloys: 6, circuits: 2, power_cells: 4 }, seconds: 260, research: ['energy_weapons'], effects: { armor: 0.65, carry: 10 }, description: 'Takes 65% off every hit, and carries 10 more.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'powered_armor' } },
  { id: 'visor_helmet', name: 'Visor Helmet', slot: 'head', station: 'chip_fab', cost: { alloys: 2, circuits: 1 }, seconds: 120, research: ['energy_weapons'], effects: { armor: 0.25, accuracy: 0.05 }, description: 'Takes 25% off every hit, and helps the aim.', icon: { sheet: 'Hat', x: 3, y: 1 } },
  { id: 'energy_shield', name: 'Personal Shield', slot: 'offhand', station: 'chip_fab', cost: { alloys: 2, power_cells: 4, circuits: 1 }, seconds: 160, research: ['energy_shields'], effects: { block: 0.35 }, description: 'Blocks 35% of hits.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'energy_shield' } },
  { id: 'plasma_cutter', name: 'Plasma Cutter', slot: 'tool', station: 'robot_workshop', cost: { alloys: 2, power_cells: 2, circuits: 1 }, seconds: 160, research: ['robotics'], effects: { gather: { chop: 5, mine: 5 }, construct: 2 }, description: 'Cut wood and rock five times as fast, build twice as fast.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'plasma_cutter' } },  { id: 'medkit', name: 'Emergency Medkit', slot: null, station: 'loom', cost: { cloth: 3, glass: 1, herbs: 2 }, seconds: 90, research: ['sanitation'], effects: {}, description: 'Used by itself the moment someone is struck down: they get straight back up.', icon: { sheet: 'Potion', x: 3, y: 0 } },
  // relics (found, never made)
  // boss trophies (relics: each one boss's, found only on its body)
  { id: 'black_blade', name: 'The Black Blade', slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { damage: 16, accuracy: 0.1 }, description: "The Black Knight's sword. +16 damage, and it rarely misses.", icon: { sheet: 'LongWep', x: 3, y: 0 } },
  { id: 'dragonscale_armor', name: 'Dragonscale Armour', slot: 'body', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { armor: 0.6, beastDamage: 6 }, description: 'Scales from Vermithrax the Red. Takes 60% off every hit, and beasts fear it.', icon: { sheet: 'Armor', x: 4, y: 7 } },
  { id: 'barons_pistols', name: "The Baron's Pistols", slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { ranged: true, ammo: 'shot', damage: 14, accuracy: 0.1 }, description: 'A matched pair. +14 damage from range (+10 more with shot).', icon: { sheet: 'Custom', x: 0, y: 0, name: 'pistols' } },
  { id: 'colossus_core', name: 'Colossus Core', slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { armor: 0.15, morale: 5 }, description: 'Still warm. Its bearer shrugs off blows (15% off every hit), and feels unstoppable.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'core' } },
  { id: 'warlords_banner', name: "Warlord's Banner", slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { morale: 12, damage: 3 }, description: 'Taken from the Warlord. +12 morale and +3 damage for whoever carries it.', icon: { sheet: 'Scroll', x: 2, y: 0 } },
  { id: 'tank_plating', name: 'Tank Plating', slot: 'body', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { armor: 0.65 }, description: 'Cut from the War Machine. Takes 65% off every hit.', icon: { sheet: 'Armor', x: 5, y: 6 } },
  { id: 'pirate_crown', name: "The Pirate King's Crown", slot: 'head', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { armor: 0.2, morale: 10, accuracy: 0.1 }, description: 'Heavy, gaudy, and yours now. +10 morale, better aim, 20% off every hit.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'crown' } },
  { id: 'reaver_core', name: 'Reaver Core', slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { damage: 8, armor: 0.1 }, description: "The Star Reaver's heart. +8 damage and 10% off every hit.", icon: { sheet: 'Custom', x: 0, y: 0, name: 'core' } },
  { id: 'abomination_heart', name: "The Abomination's Heart", slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { damage: 6, beastDamage: 4 }, description: 'It still beats. +6 damage for whoever dares to carry it.', icon: { sheet: 'Flesh', x: 1, y: 0 } },  { id: 'deaths_bargain', name: "Death's Bargain", slot: null, station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: {}, description: 'An old coin. If the founder dies, Death takes the coin instead. Once.', icon: { sheet: 'Magic', x: 7, y: 1 } },
  { id: 'rat_king_crown', name: "The Rat King's Crown", slot: 'head', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { armor: 0.15, accuracy: 0.1, beastDamage: 8 }, description: 'A crown of knotted tails, still twitching. 15% off every hit, better aim, and beasts shrink from it.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'crown' } },
  { id: 'bearskin_cloak', name: 'Bearskin Cloak', slot: 'body', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { armor: 0.3, beastDamage: 5, morale: 4 }, description: "The Cave Bear's pelt. Takes 30% off every hit, beasts fear its wearer, and they stand taller in it.", icon: { sheet: 'Armor', x: 0, y: 7 } },
  { id: 'staff_of_rime', name: 'Staff of Rime', slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { ranged: true, damage: 15, accuracy: 0.1 }, description: "The Frost Archmage's staff, cold enough to burn. +15 damage from range, and it rarely misses.", icon: { sheet: 'Magic', x: 3, y: 3 } },
  { id: 'phoenix_feather', name: 'Phoenix Feather', slot: null, station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: {}, description: 'Warm to the touch. The next person to die in town rises from the ashes instead. Once.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'phoenix_feather' } },
  // Rival lords' trophies (see data/rivals.ts)
  { id: 'lich_phylactery', name: "The Lich Lord's Phylactery", slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { damage: 6, armor: 0.1, morale: -2 }, description: 'Cold, and whispering. +6 damage and 10% off every hit, but its bearer sleeps badly.', icon: { sheet: 'Amulet', x: 2, y: 1 } },
  { id: 'archdruid_staff', name: "The Archdruid's Staff", slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { ranged: true, damage: 12, beastDamage: 8, gather: { forage: 1.3 } }, description: 'Still putting out leaves. +12 damage from range, beasts fear it, and it finds food.', icon: { sheet: 'Magic', x: 0, y: 1 } },
  { id: 'countess_ring', name: "The Countess's Ring", slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { damage: 5, accuracy: 0.1, morale: 6 }, description: 'A blood-red stone. +5 damage, better aim, and its wearer carries themselves like nobility.', icon: { sheet: 'Magic', x: 3, y: 0 } },
  { id: 'alpha_pelt', name: "The Alpha's Pelt", slot: 'body', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { armor: 0.4, beastDamage: 8, damage: 3 }, description: 'Takes 40% off every hit, and wolves know who wears it.', icon: { sheet: 'Armor', x: 1, y: 7 } },
  { id: 'overmind_core', name: 'Overmind Core', slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { accuracy: 0.15, construct: 1.3 }, description: 'It still thinks, a little. Better aim, and its bearer builds 30% faster.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'core' } },
  { id: 'thane_hammer', name: "The Thane's Hammer", slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { damage: 15, construct: 1.25 }, description: 'Rune-cut. +15 damage, and it drives a nail like nothing else.', icon: { sheet: 'MedWep', x: 3, y: 0 } },
  { id: 'tide_trident', name: "The Tide Queen's Trident", slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { damage: 13, accuracy: 0.1, gather: { forage: 1.25 } }, description: 'Salt-crusted. +13 damage, it rarely misses, and it spears a fish for supper.', icon: { sheet: 'LongWep', x: 1, y: 1 } },
  { id: 'khan_bow', name: "The Khan's Bow", slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { ranged: true, ammo: 'arrows', damage: 13, accuracy: 0.15 }, description: 'Horn and sinew. +13 damage from range (more with arrows), and it hardly misses.', icon: { sheet: 'LongWep', x: 6, y: 2 } },
  { id: 'hunt_crown', name: 'Crown of the Wild Hunt', slot: 'head', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { armor: 0.15, morale: 12 }, description: 'Antlers and starlight. +12 morale, and 15% off every hit.', icon: { sheet: 'Custom', x: 0, y: 0, name: 'crown' } },
  { id: 'philosophers_stone', name: "Philosopher's Stone", slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { damage: 4, armor: 0.1, morale: 4 }, description: 'Warm, and heavier than it looks. A little of everything: +4 damage, 10% off every hit, +4 morale.', icon: { sheet: 'Magic', x: 4, y: 2 } },
  { id: 'order_shield', name: "The Grand Master's Shield", slot: 'offhand', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { block: 0.35, armor: 0.1, morale: 4 }, description: 'The Order\'s arms, scored by a hundred fights. Blocks 35% of blows.', icon: { sheet: 'Shield', x: 7, y: 0 } },
  { id: 'truck', name: 'Truck', slot: null, station: 'garage', cost: { steel: 10, electronics: 3, plastic: 4 }, seconds: 400, research: ['motor_transport'], effects: {}, description: `An expedition that takes a truck (and fuel) carries far more and travels far faster.`, icon: { sheet: 'Custom', x: 0, y: 0, name: 'truck' } },
  // Occult
  { id: 'spirit_totem', name: 'Spirit Totem', slot: null, station: 'campfire', cost: { bone: 8, herbs: 4, hide: 2 }, seconds: 120, research: ['spirit_binding'], effects: {}, description: 'If the founder dies, they come back, once.', icon: { sheet: 'Magic', x: 4, y: 1 } },
  // Medieval: refining (raw -> refined, into storage)
  { id: 'smelt_iron', name: 'Iron', slot: null, station: 'bloomery', cost: { iron_ore: 2, wood: 2 }, seconds: 60, research: ['iron_working'], makes: { iron: 1 }, effects: {}, description: 'Smelt ore into iron: 1 per batch.', icon: { sheet: 'Money', x: 3, y: 0 } },
  { id: 'saw_lumber', name: 'Lumber', slot: null, station: 'sawmill', cost: { wood: 3 }, seconds: 30, research: ['carpentry'], makes: { lumber: 2 }, effects: {}, description: 'Saw wood into lumber: 2 per batch.', icon: { sheet: 'Money', x: 2, y: 5 } },
  { id: 'fire_bricks', name: 'Bricks', slot: null, station: 'kiln', cost: { clay: 3 }, seconds: 40, research: ['masonry'], makes: { bricks: 2 }, effects: {}, description: 'Fire clay into bricks: 2 per batch.', icon: { sheet: 'Money', x: 0, y: 0 } },
  { id: 'cure_leather', name: 'Leather', slot: null, station: 'tannery', cost: { hide: 2 }, seconds: 40, research: ['leatherworking'], makes: { leather: 2 }, effects: {}, description: 'Cure hides into leather: 2 per batch.', icon: { sheet: 'Flesh', x: 6, y: 1 } },
  { id: 'weave_cloth', name: 'Cloth', slot: null, station: 'loom', cost: { fiber: 4 }, seconds: 40, research: ['weaving'], makes: { cloth: 2 }, effects: {}, description: 'Weave fiber into cloth: 2 per batch.', icon: { sheet: 'Armor', x: 2, y: 5 } },
  { id: 'grind_flour', name: 'Flour', slot: null, station: 'windmill', cost: { grain: 4 }, seconds: 30, research: ['milling'], makes: { flour: 3 }, effects: {}, description: 'Grind grain into flour: 3 per batch.', icon: { sheet: 'Chest1', x: 0, y: 2 } },
  { id: 'bake_bread', name: 'Bread', slot: null, station: 'bakery', cost: { flour: 2 }, seconds: 40, research: ['baking'], makes: { bread: 3 }, effects: {}, description: 'Filling and keeps well: 3 loaves per batch.', icon: { sheet: 'Food', x: 0, y: 4 } },
  { id: 'arrows', name: 'Arrows', slot: null, station: 'workbench', cost: { wood: 1, flint: 1 }, seconds: 30, research: ['archery'], makes: { arrows: 8 }, effects: {}, description: 'Ammunition for bows: 8 per batch, one per shot.', icon: { sheet: 'Ammo', x: 5, y: 2 } },
  // Medieval: gear
  { id: 'iron_axe', name: 'Iron Axe', slot: 'tool', station: 'smithy', cost: { iron: 2, lumber: 1 }, seconds: 60, research: ['iron_working'], effects: { gather: { chop: 2 } }, description: 'Chop wood twice as fast.', icon: { sheet: 'MedWep', x: 1, y: 1 } },
  { id: 'iron_pick', name: 'Iron Pick', slot: 'tool', station: 'smithy', cost: { iron: 2, lumber: 1 }, seconds: 60, research: ['iron_working'], effects: { gather: { mine: 2 } }, description: 'Dig and break rock twice as fast.', icon: { sheet: 'ShortWep', x: 1, y: 3 } },
  { id: 'iron_hammer', name: 'Iron Hammer', slot: 'tool', station: 'smithy', cost: { iron: 2, lumber: 1 }, seconds: 60, research: ['iron_working'], effects: { gather: { mine: 1.4 }, construct: 1.6 }, description: 'Build 60% faster.', icon: { sheet: 'ShortWep', x: 0, y: 4 } },
  { id: 'iron_sword', name: 'Iron Sword', slot: 'weapon', station: 'smithy', cost: { iron: 3, leather: 1 }, seconds: 90, research: ['iron_working'], effects: { damage: 8, accuracy: 0.1 }, description: '+8 melee damage, much better aim.', icon: { sheet: 'MedWep', x: 0, y: 0 } },
  { id: 'bow', name: 'Bow', slot: 'weapon', station: 'workbench', cost: { lumber: 2, fiber: 2 }, seconds: 60, research: ['archery'], effects: { ranged: true, ammo: 'arrows', damage: 3, accuracy: 0.05 }, description: 'Shoots from range. +3 damage, +5 more with arrows.', icon: { sheet: 'Ammo', x: 0, y: 1 } },
  { id: 'leather_cap', name: 'Leather Cap', slot: 'head', station: 'tannery', cost: { leather: 2 }, seconds: 50, research: ['leatherworking'], effects: { armor: 0.12 }, description: 'Takes 12% off every hit.', icon: { sheet: 'Hat', x: 0, y: 2 } },
  { id: 'leather_armor', name: 'Leather Armor', slot: 'body', station: 'tannery', cost: { leather: 5 }, seconds: 90, research: ['leatherworking'], effects: { armor: 0.28 }, description: 'Takes 28% off every hit.', icon: { sheet: 'Armor', x: 1, y: 7 } },
  { id: 'iron_helm', name: 'Iron Helm', slot: 'head', station: 'smithy', cost: { iron: 3 }, seconds: 80, research: ['armoring'], effects: { armor: 0.15 }, description: 'Takes 15% off every hit.', icon: { sheet: 'Hat', x: 1, y: 1 } },
  { id: 'chainmail', name: 'Chainmail', slot: 'body', station: 'smithy', cost: { iron: 6, leather: 2 }, seconds: 150, research: ['armoring'], effects: { armor: 0.38 }, description: 'Takes 38% off every hit.', icon: { sheet: 'Armor', x: 0, y: 8 } },
  { id: 'iron_shield', name: 'Iron-Rimmed Shield', slot: 'offhand', station: 'smithy', cost: { iron: 2, lumber: 2 }, seconds: 80, research: ['armoring'], effects: { block: 0.25 }, description: 'Blocks 25% of blows.', icon: { sheet: 'Shield', x: 4, y: 0 } },
  { id: 'wool_cloak', name: 'Cloak', slot: 'charm', station: 'loom', cost: { cloth: 3 }, seconds: 50, research: ['weaving'], effects: { morale: 4, armor: 0.03 }, description: '+4 morale; a little protection.', icon: { sheet: 'Armor', x: 1, y: 5 } },
  { id: 'wheelbarrow', name: 'Wheelbarrow', slot: 'pack', station: 'workbench', cost: { lumber: 4, iron: 1 }, seconds: 80, research: ['carts'], effects: { carry: 12 }, description: 'Carry 12 more.', icon: { sheet: 'Chest1', x: 3, y: 0 } },
  { id: 'bandage', name: 'Bandage', slot: null, station: 'loom', cost: { cloth: 1, herbs: 1 }, seconds: 30, research: ['physick'], effects: {}, description: 'Like a poultice but better: stops bleeding, +35 health.', icon: { sheet: 'Scroll', x: 5, y: 4 } },
];

export const ITEM_BY_ID: Readonly<Record<string, ItemDef>> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Craft queue slots (DESIGN §2: queues start at 2-3 slots). Each order can repeat up to MAX_ORDER times. */
export const CRAFT_QUEUE_SLOTS = 3;
export const MAX_ORDER = 10;
/** Clay pots: storage room each, and how many count. */
export const POT_STORAGE = 5;
export const MAX_POTS = 10;
/** Snares: chance each game hour that one snare catches something, and that a catch breaks it. */
export const SNARE_CATCH = 0.2;
export const SNARE_BREAK = 0.15;
/** Poultice: health restored. Bedroll: how well you sleep on it (1 = like a bed). */
export const POULTICE_HP = 20;
export const BEDROLL_SLEEP = 0.9;
/** Party walking speed when everyone has a waterskin. */
export const WATERSKIN_SPEEDUP = 0.9;
/** Extra damage per shot with ammunition. */
export const AMMO_DAMAGE: Partial<Record<Material, number>> = { sling_stones: 3, arrows: 5, shot: 10, cartridges: 14, power_cells: 20 };
/** Bandages restore this much (and are used before poultices). */
export const BANDAGE_HP = 35;
