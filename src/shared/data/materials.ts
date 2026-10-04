// Materials by era (DESIGN §6: raw -> refined). Crafted food and ammo are materials too, so they sit in
// storage and get hauled, eaten and packed like the rest.

export const MATERIALS = [
  // Neolithic
  'wood', 'stone', 'flint', 'fiber', 'hide', 'bone', 'clay', 'herbs', 'meat', 'berries', 'grain', 'dried_meat', 'rations', 'sling_stones', 'totem',
  // Livestock (from the coop, the pens and the fold)
  'eggs', 'milk', 'wool',
  // Fields (the vegetable patch and the orchard)
  'vegetables', 'fruit',
  // Medieval
  'iron_ore', 'iron', 'lumber', 'bricks', 'leather', 'cloth', 'flour', 'bread', 'arrows',
  // Industrial
  'coal', 'steel', 'glass', 'shot',
  // Modern
  'oil', 'fuel', 'plastic', 'concrete', 'electronics', 'cartridges',
  // Robotic & Space
  'rare_minerals', 'alloys', 'circuits', 'power_cells',
  // The mountain's deep veins (the dwarves' hold)
  'gold', 'gems',
  // The sea (the merfolk's shore)
  'fish', 'kelp', 'pearls',
  // The Blood Court's
  'blood',
  // Minerals (the land's caves dug as mines, travellers, caravans and trade caravans; data/minerals.ts)
  'copper_ore', 'tin_ore', 'silver_ore', 'sulphur', 'copper', 'bronze', 'silver',
] as const;
export type Material = (typeof MATERIALS)[number];
/** What the sea's cells hold (sim/land.ts `seaPool`): gathered by a shore town only. */
export const SEA_MATERIALS: readonly Material[] = ['fish', 'kelp', 'pearls'];

export const MATERIAL_NAMES: Record<Material, string> = {
  wood: 'Wood',
  stone: 'Stone',
  flint: 'Flint',
  fiber: 'Fiber',
  hide: 'Hide',
  bone: 'Bone',
  clay: 'Clay',
  herbs: 'Herbs',
  meat: 'Raw meat',
  berries: 'Berries',
  grain: 'Wild grain',
  dried_meat: 'Dried meat',
  rations: 'Rations',
  sling_stones: 'Sling stones',
  totem: 'Cave Bear Totem',
  eggs: 'Eggs',
  milk: 'Milk',
  wool: 'Wool',
  vegetables: 'Vegetables',
  fruit: 'Fruit',
  iron_ore: 'Iron ore',
  iron: 'Iron',
  lumber: 'Lumber',
  bricks: 'Bricks',
  leather: 'Leather',
  cloth: 'Cloth',
  flour: 'Flour',
  bread: 'Bread',
  arrows: 'Arrows',
  coal: 'Coal',
  steel: 'Steel',
  glass: 'Glass',
  shot: 'Musket shot',
  oil: 'Crude oil',
  fuel: 'Fuel',
  plastic: 'Plastic',
  concrete: 'Concrete',
  electronics: 'Electronics',
  cartridges: 'Rifle cartridges',
  rare_minerals: 'Rare minerals',
  alloys: 'Alloys',
  circuits: 'Circuits',
  power_cells: 'Power cells',
  gold: 'Gold',
  gems: 'Gems',
  fish: 'Fish',
  kelp: 'Kelp',
  pearls: 'Pearls',
  blood: 'Blood',
  copper_ore: 'Copper ore',
  tin_ore: 'Tin ore',
  silver_ore: 'Silver ore',
  sulphur: 'Sulphur',
  copper: 'Copper',
  bronze: 'Bronze',
  silver: 'Silver',
};

export type Stock = Partial<Record<Material, number>>;
