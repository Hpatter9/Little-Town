// More buildings and crafting stations (the owner's ask: "even more building and crafting stations"): a workshop for
// every age, one of each people's own, and a few comforts. Each station is a building whose id is the station of its
// recipes (sim/crafting.ts `stationFor`); the planner builds one of each it has learned (planner.ts, "a new workshop")
// and crafts their wares for the shop from spare materials, their fare for the tavern and their furnishings to order.
import type { BuildingDef } from './buildings';
import type { Era } from './eras';
import type { FareKind, FurnishKind, IconSheet, ItemDef, Station, WareTier } from './items';
import type { Material } from './materials';
import type { OriginId } from './origins';
import type { Branch, Topic } from './research';

type Icon = ItemDef['icon'];
const ic = (sheet: IconSheet, x: number, y: number): Icon => ({ sheet, x, y });

/** New topics the workshops hang on (the rest use topics the game already has). */
function topic(id: string, name: string, branch: Branch, era: Era, seconds: number, prereqs: string[], unlocks: string): Topic {
  return { id, name, branch, era, seconds, prereqs, unlocks, effects: [] };
}
export const WORKSHOP_TOPICS: readonly Topic[] = [
  topic('jewellery', 'Jewellery', 'crafting', 'medieval', 420, ['iron_working', 'trade'], 'Rings and pendants of gold, gems and pearls for the shop'),
  topic('printing', 'Printing', 'society', 'industrial', 480, ['public_library'], 'Books and almanacs for the shop'),
  topic('clockwork', 'Clockwork', 'crafting', 'industrial', 480, ['machine_tools'], 'Watches, music boxes and clocks'),
  topic('canning', 'Canning', 'agriculture', 'industrial', 420, ['industrial_farming', 'steelmaking'], 'Tinned food: rations that keep'),
  topic('appliances', 'Household Appliances', 'crafting', 'modern', 480, ['electronics'], 'Televisions, refrigerators and electric light'),
  topic('biofabrication', 'Biofabrication', 'crafting', 'space', 540, ['hydroponics', 'microchips'], 'Grown food and designer blooms'),
];

/** A workshop: a station of its own. */
function shop(id: Station, name: string, width: number, cost: BuildingDef['cost'], buildSeconds: number, purpose: string, research: string, more: Partial<BuildingDef> = {}): BuildingDef {
  return { id, name, layer: 'mid', width, cost, buildSeconds, purpose, research, ...more };
}
/** One of a people's own (from the Medieval age; another people never build it). */
const own = (origin: OriginId): Partial<BuildingDef> => ({ origin, era: 'medieval' });

export const WORKSHOP_BUILDINGS: readonly BuildingDef[] = [
  // Stone Age
  shop('smokehouse', 'Smokehouse', 2, { wood: 10, stone: 6, hide: 2 }, 60, 'Smokes meat and fish over a slow fire: more keeps than on the rack.', 'food_preservation'),
  shop('bone_carver', "Bone Carver's Hut", 2, { wood: 8, bone: 6, hide: 2 }, 60, 'Carves combs, dice and flutes from bone, for the shop.', 'bone_tools'),
  shop('basketry', "Basket Weaver's", 2, { wood: 6, fiber: 8 }, 50, 'Weaves hampers, mats and chairs from reed and fiber.', 'cordage'),
  // Medieval
  shop('brewery', 'Brewery', 3, { lumber: 12, stone: 8, clay: 4 }, 120, 'Brews ale and mead by the cask: drink for the tavern, and casks to sell.', 'brewing'),
  shop('tailor', "Tailor's", 2, { lumber: 10, cloth: 4 }, 100, 'Cuts fine tunics and gowns from cloth, for the shop.', 'weaving'),
  shop('jeweller', "Jeweller's", 2, { stone: 12, lumber: 8, iron: 4 }, 140, 'Sets gold, gems and pearls into rings and pendants: the dearest wares a shop can hold.', 'jewellery'),
  shop('cooper', 'Cooperage', 2, { lumber: 10, iron: 2 }, 100, 'Makes casks and barrels: furnishings for the venues, and wine to sell.', 'carpentry'),
  shop('apothecary', 'Apothecary', 2, { lumber: 10, stone: 6, cloth: 2 }, 120, 'Tinctures and draughts from herbs, for the shop.', 'physick'),
  shop('chandlery', 'Chandlery', 2, { lumber: 8, stone: 4 }, 90, 'Dips candles from tallow: light for the venues, and scented ones to sell.', 'animal_husbandry'),
  shop('dyeworks', 'Dyeworks', 2, { stone: 10, lumber: 8, clay: 4 }, 110, 'Dyes bolts of cloth in berry red and herb blue, and paints banners.', 'weaving'),
  // Industrial
  shop('print_shop', 'Printing Press', 3, { bricks: 16, steel: 4, lumber: 8 }, 200, 'Prints books and almanacs for the shop.', 'printing'),
  shop('clockmaker', "Clockmaker's", 2, { bricks: 14, steel: 4, glass: 4 }, 200, 'Watches, music boxes and mantel clocks: fine wares.', 'clockwork'),
  shop('cannery', 'Cannery', 3, { bricks: 16, steel: 6 }, 200, 'Tins vegetables, fish and meat into rations that keep.', 'canning'),
  shop('textile_mill', 'Textile Mill', 4, { bricks: 24, steel: 8 }, 260, 'Steam looms: cloth from fiber and wool three bolts at a time.', 'steam_power'),
  // Modern
  shop('appliance_plant', 'Appliance Plant', 4, { concrete: 20, steel: 10, glass: 6 }, 320, 'Televisions, refrigerators and electric lamps.', 'appliances'),
  shop('pharmacy', 'Pharmacy', 3, { concrete: 16, glass: 8, electronics: 4 }, 300, 'Antibiotics and vitamins for the shop.', 'trauma_surgery'),
  // Robotic & Space
  shop('bio_lab', 'Biofabrication Lab', 3, { concrete: 20, alloys: 6, circuits: 4, glass: 8 }, 360, 'Grows steaks in vats and blooms to order.', 'biofabrication'),
  shop('nanoforge', 'Nanoforge', 3, { alloys: 12, circuits: 8, concrete: 16 }, 400, 'Nanite fabric, and alloys mended atom by atom.', 'nanofabrication'),
  // Each people's own
  shop('blood_cellar', 'Blood Cellar', 2, { stone: 14, lumber: 6 }, 140, "The Court's vintages age in the dark: the dearest blood wine, and a black pudding for the inn.", 'barter', own('vampire')),
  shop('bone_forge', 'Bone Forge', 2, { bone: 16, iron: 6, stone: 10 }, 150, 'Idols and lanterns of bone.', 'barter', own('lich')),
  shop('gem_cutter', "Gem Cutter's", 2, { stone: 16, iron: 6 }, 150, "Cuts the hold's gems and casts its gold into goblets.", 'barter', own('dwarves')),
  shop('herb_press', 'Wildcrafters’ Bower', 2, { wood: 10, herbs: 8 }, 100, 'Sacred oils and wreaths from the grove.', 'barter', own('druid')),
  shop('pearl_works', 'Pearl Works', 2, { stone: 12, wood: 8 }, 120, 'Combs and mirrors of mother-of-pearl.', 'barter', own('merfolk')),
  shop('felt_works', 'Felt Works', 2, { wood: 8, hide: 6, fiber: 6 }, 90, 'Beats wool into felt: cloth, and rugs for the venues.', 'barter', own('nomads')),
  shop('glamour_loom', 'Glamour Loom', 2, { wood: 10, fiber: 8, herbs: 4 }, 120, 'Weaves moonsilk and dream-catchers.', 'barter', own('fae')),
  shop('alembic', 'Alembic', 2, { stone: 12, clay: 8, iron: 4 }, 130, 'Elixirs, and the dust of the Great Work.', 'barter', own('alchemists')),
  shop('assembler', 'Assembler', 2, { stone: 14, iron: 10 }, 140, 'Clockwork toys and brass automata.', 'barter', own('robot')),
  shop('armourer', "Armourer's Hall", 3, { stone: 14, iron: 8, lumber: 8 }, 160, 'Heraldic shields and tourney pennants.', 'barter', own('knights')),
  shop('pelt_house', 'Pelt House', 2, { wood: 12, hide: 8, bone: 4 }, 100, 'Pelts and fang necklaces from the hunt.', 'barter', own('werewolf')),
  // comforts and stores (no station)
  { id: 'granary', name: 'Granary', layer: 'mid', width: 3, cost: { lumber: 16, stone: 8 }, buildSeconds: 120, purpose: 'A raised store for the harvest: 150 units.', research: 'milling', storage: 150 },
  { id: 'theatre', name: 'Theatre', layer: 'mid', width: 4, cost: { lumber: 20, bricks: 10, cloth: 6 }, buildSeconds: 240, purpose: 'Morale: players on the boards of an evening.', research: 'guilds', morale: [8, 'A play at the theatre'] },
  { id: 'bathhouse', name: 'Bathhouse', layer: 'mid', width: 3, cost: { bricks: 20, glass: 4, lumber: 8 }, buildSeconds: 240, purpose: 'Morale: hot baths, and the sick are fewer.', research: 'sanitation', morale: [6, 'Hot baths at the bathhouse'] },
];

/** The stations among them (for the Station union and STATIONS in data/items.ts). */
export const WORKSHOP_STATIONS = WORKSHOP_BUILDINGS.filter((b) => !b.storage && !b.morale).map((b) => b.id as Station);

type Cost = Partial<Record<Material, number>>;
const base = (id: string, name: string, station: Station, cost: Cost, seconds: number, research: string[], description: string, icon: Icon): ItemDef => ({ id, name, slot: null, station, cost, seconds, research, effects: {}, description, icon });
/** A ware for the shop (needs Barter besides). */
const ware = (id: string, name: string, station: Station, cost: Cost, seconds: number, research: string[], tier: WareTier, price: number, text: string, icon: Icon): ItemDef => ({
  ...base(id, name, station, cost, seconds, ['barter', ...research], `A ware for the shop: ${text} ${price} coins.`, icon),
  ware: { tier, price },
});
/** Fare for the tavern (needs Hospitality besides). */
const fare = (id: string, name: string, station: Station, cost: Cost, seconds: number, research: string[], kind: FareKind, price: number, text: string, icon: Icon): ItemDef => ({
  ...base(id, name, station, cost, seconds, ['hospitality', ...research], `Tavern fare: ${text} ${price} coins.`, icon),
  fare: { kind, price },
});
/** A furnishing for either venue. */
const furnish = (id: string, name: string, station: Station, cost: Cost, seconds: number, research: string[], kind: FurnishKind, appeal: number, text: string, icon: Icon): ItemDef => ({
  ...base(id, name, station, cost, seconds, research, `Furnishing: ${text}`, icon),
  furnish: { kind, w: 1, h: 1, appeal, venue: 'both' },
});
/** A recipe that makes materials. */
const makes = (id: string, name: string, station: Station, cost: Cost, seconds: number, research: string[], out: Cost, text: string, icon: Icon): ItemDef => ({ ...base(id, name, station, cost, seconds, research, text, icon), makes: out });

export const WORKSHOP_ITEMS: readonly ItemDef[] = [
  // the smokehouse
  makes('smoked_meat', 'Smoked Meat', 'smokehouse', { meat: 3, wood: 1 }, 50, ['food_preservation'], { dried_meat: 4 }, 'Meat smoked slow over the fire: 4 dried meat from 3.', ic('Flesh', 4, 4)),
  makes('smoked_fish', 'Smoked Fish', 'smokehouse', { fish: 3, wood: 1 }, 50, ['food_preservation'], { rations: 2 }, 'Fish smoked hard enough to pack for a trip: 2 rations.', ic('Flesh', 7, 0)),
  // the bone carver
  ware('bone_comb', 'Bone Comb', 'bone_carver', { bone: 2 }, 30, ['bone_tools'], 1, 7, 'a comb cut from bone.', ic('Tool', 2, 0)),
  ware('bone_dice', 'Bone Dice', 'bone_carver', { bone: 1 }, 25, ['bone_tools'], 1, 5, 'a pair of knucklebone dice.', ic('Rock', 0, 1)),
  ware('bone_flute', 'Bone Flute', 'bone_carver', { bone: 3, fiber: 1 }, 45, ['bone_tools'], 2, 16, 'a flute that plays sweetly.', ic('Wand', 0, 0)),
  // the basket weaver
  ware('woven_hamper', 'Woven Hamper', 'basketry', { fiber: 5 }, 35, ['cordage'], 1, 9, 'a lidded hamper of woven reed.', ic('Chest0', 0, 0)),
  furnish('rush_mat', 'Rush Mat', 'basketry', { fiber: 6 }, 35, ['cordage', 'hospitality'], 'rug', 3, 'a floor mat of plaited rushes.', ic('Chest0', 1, 0)),
  furnish('wicker_chair', 'Wicker Chair', 'basketry', { fiber: 6, wood: 2 }, 45, ['cordage', 'hospitality'], 'decor', 3, 'a chair of woven wicker.', ic('Chest0', 2, 0)),
  // the brewery
  fare('mead', 'Mead', 'brewery', { berries: 2, grain: 2 }, 60, ['brewing'], 'drink', 12, 'sweet and strong, from the cask.', ic('Potion', 0, 0)),
  fare('dark_ale', 'Dark Ale', 'brewery', { grain: 4 }, 60, ['brewing'], 'drink', 11, 'a black, bitter brew.', ic('Potion', 1, 0)),
  ware('cask_ale', 'Cask of Ale', 'brewery', { grain: 6 }, 90, ['brewing'], 2, 22, 'a whole cask, for the road.', ic('Chest1', 0, 0)),
  // the tailor
  ware('fine_tunic', 'Fine Tunic', 'tailor', { cloth: 2 }, 70, ['weaving'], 2, 28, 'a tunic well cut and stitched.', ic('Armor', 0, 0)),
  ware('embroidered_gown', 'Embroidered Gown', 'tailor', { cloth: 3, herbs: 1 }, 120, ['weaving'], 3, 55, 'a gown worked with flowers.', ic('Armor', 1, 0)),
  // the jeweller
  ware('iron_bangle', 'Iron Bangle', 'jeweller', { iron: 1 }, 60, ['jewellery'], 2, 18, 'a plain bangle of polished iron.', ic('Amulet', 0, 0)),
  ware('gold_ring', 'Gold Ring', 'jeweller', { gold: 1 }, 120, ['jewellery'], 3, 60, 'a ring of beaten gold.', ic('Amulet', 1, 0)),
  ware('pearl_necklace', 'Pearl Necklace', 'jeweller', { pearls: 2 }, 120, ['jewellery'], 3, 70, 'pearls on a silk thread.', ic('Amulet', 2, 0)),
  ware('gem_pendant', 'Gem Pendant', 'jeweller', { gold: 1, gems: 1 }, 180, ['jewellery'], 4, 150, 'a cut stone set in gold.', ic('Amulet', 3, 0)),
  // the cooper
  furnish('oak_casks', 'Oak Casks', 'cooper', { lumber: 5 }, 60, ['carpentry', 'hospitality'], 'stand', 4, 'casks stacked on their sides.', ic('Chest1', 1, 0)),
  ware('fruit_wine', 'Fruit Wine', 'cooper', { lumber: 2, fruit: 3 }, 100, ['carpentry'], 2, 20, 'a small cask of orchard wine.', ic('Potion', 2, 0)),
  // the apothecary
  ware('tincture', 'Tincture', 'apothecary', { herbs: 3 }, 60, ['physick'], 2, 20, 'herbs steeped in spirit, for aches.', ic('Potion', 3, 0)),
  ware('sleeping_draught', 'Sleeping Draught', 'apothecary', { herbs: 4, milk: 1 }, 100, ['physick'], 3, 45, 'a draught for a sound night.', ic('Potion', 4, 0)),
  // the chandlery
  furnish('tallow_candles', 'Tallow Candles', 'chandlery', { meat: 2, fiber: 1 }, 40, ['animal_husbandry', 'hospitality'], 'decor', 4, 'candles in a tin sconce.', ic('Light', 0, 0)),
  ware('scented_candles', 'Scented Candles', 'chandlery', { meat: 2, herbs: 2 }, 60, ['animal_husbandry'], 2, 24, 'candles scented with herbs.', ic('Light', 1, 0)),
  // the dyeworks
  ware('dyed_bolts', 'Dyed Bolts', 'dyeworks', { cloth: 3, berries: 3 }, 110, ['weaving'], 3, 50, 'bolts of cloth in deep red and blue.', ic('Armor', 2, 0)),
  furnish('painted_banner', 'Painted Banner', 'dyeworks', { cloth: 2, herbs: 1 }, 80, ['weaving', 'hospitality'], 'decor', 6, 'a banner painted bright.', ic('Armor', 3, 0)),
  // the printing press
  ware('almanac', 'Almanac', 'print_shop', { cloth: 1, lumber: 1 }, 90, ['printing'], 2, 30, 'the year’s weather, fairs and moons.', ic('Scroll', 0, 0)),
  ware('books', 'Bound Books', 'print_shop', { cloth: 2, lumber: 2 }, 150, ['printing'], 3, 70, 'a shelf of bound books.', ic('Scroll', 1, 0)),
  // the clockmaker
  ware('music_box', 'Music Box', 'clockmaker', { steel: 1, lumber: 2 }, 150, ['clockwork'], 3, 85, 'a box that plays a tune when wound.', ic('Tool', 3, 0)),
  ware('gold_watch', 'Gold Watch', 'clockmaker', { steel: 1, glass: 1 }, 200, ['clockwork'], 4, 160, 'a watch on a chain.', ic('Tool', 4, 0)),
  furnish('mantel_clock', 'Mantel Clock', 'clockmaker', { steel: 1, lumber: 2, glass: 1 }, 180, ['clockwork', 'hospitality'], 'decor', 8, 'a clock that chimes the hour.', ic('Tool', 5, 0)),
  // the cannery
  makes('canned_vegetables', 'Tinned Vegetables', 'cannery', { vegetables: 3, steel: 1 }, 60, ['canning'], { rations: 4 }, 'Vegetables sealed in tins: 4 rations.', ic('Food', 0, 3)),
  makes('canned_fish', 'Tinned Fish', 'cannery', { fish: 3, steel: 1 }, 60, ['canning'], { rations: 4 }, 'Fish sealed in tins: 4 rations.', ic('Flesh', 6, 0)),
  makes('canned_meat', 'Tinned Meat', 'cannery', { meat: 2, steel: 1 }, 60, ['canning'], { rations: 3 }, 'Meat sealed in tins: 3 rations.', ic('Flesh', 3, 0)),
  // the textile mill
  makes('mill_cloth', 'Milled Cloth', 'textile_mill', { fiber: 6 }, 60, ['steam_power'], { cloth: 3 }, 'Steam looms: 3 bolts of cloth from fiber.', ic('Armor', 4, 0)),
  makes('mill_wool', 'Milled Wool Cloth', 'textile_mill', { wool: 4 }, 60, ['steam_power'], { cloth: 3 }, 'Steam looms: 3 bolts of cloth from wool.', ic('Armor', 5, 0)),
  ware('calico', 'Bolt of Calico', 'textile_mill', { cloth: 3 }, 100, ['steam_power'], 3, 55, 'printed calico by the bolt.', ic('Armor', 6, 0)),
  // the appliance plant
  ware('television', 'Television', 'appliance_plant', { electronics: 2, glass: 1, plastic: 1 }, 220, ['appliances'], 4, 180, 'a set with a glowing screen.', ic('Magic', 0, 0)),
  ware('refrigerator', 'Refrigerator', 'appliance_plant', { steel: 2, electronics: 1, plastic: 1 }, 220, ['appliances'], 4, 170, 'a humming white box that keeps food cold.', ic('Chest1', 2, 0)),
  furnish('electric_lamp', 'Electric Lamp', 'appliance_plant', { electronics: 1, glass: 1 }, 120, ['appliances', 'hospitality'], 'decor', 10, 'a lamp with a fringed shade.', ic('Light', 2, 0)),
  // the pharmacy
  ware('vitamins', 'Vitamins', 'pharmacy', { fruit: 3, plastic: 1 }, 120, ['trauma_surgery'], 3, 60, 'a bottle of vitamin pills.', ic('Potion', 5, 0)),
  ware('antibiotics', 'Antibiotics', 'pharmacy', { herbs: 4, glass: 1, plastic: 1 }, 200, ['trauma_surgery'], 4, 120, 'a course of antibiotics.', ic('Potion', 6, 0)),
  // the biofabrication lab
  makes('vat_steak', 'Vat Steak', 'bio_lab', { vegetables: 2, power_cells: 1 }, 90, ['biofabrication'], { rations: 6 }, 'Meat grown in a vat: 6 rations.', ic('Flesh', 5, 0)),
  ware('designer_blooms', 'Designer Blooms', 'bio_lab', { herbs: 2, circuits: 1 }, 200, ['biofabrication'], 4, 200, 'flowers in colours nature never made.', ic('Food', 2, 1)),
  // the nanoforge
  makes('nanite_mending', 'Nanite Mending', 'nanoforge', { steel: 2, power_cells: 1 }, 90, ['nanofabrication'], { alloys: 2 }, 'Steel remade atom by atom: 2 alloys.', ic('Money', 4, 0)),
  ware('nano_fabric', 'Nano Fabric', 'nanoforge', { alloys: 1, circuits: 1 }, 240, ['nanofabrication'], 4, 220, 'a cloth that cleans and mends itself.', ic('Armor', 7, 0)),
  // each people's own
  ware('vintage_blood', 'Vintage Blood', 'blood_cellar', { blood: 6 }, 120, [], 4, 90, 'a vintage aged in the dark.', ic('Potion', 7, 0)),
  fare('blood_pudding', 'Black Pudding', 'blood_cellar', { blood: 1, meat: 1 }, 40, [], 'hearty', 12, 'a dark sausage, rich and hot.', ic('Flesh', 2, 4)),
  ware('bone_idol', 'Bone Idol', 'bone_forge', { bone: 4 }, 100, [], 3, 65, 'an idol of fused bone.', ic('Amulet', 4, 0)),
  furnish('skull_lantern', 'Skull Lantern', 'bone_forge', { bone: 3, herbs: 1 }, 80, ['hospitality'], 'decor', 6, 'a skull with a green flame in it.', ic('Light', 3, 0)),
  ware('cut_gems', 'Cut Gems', 'gem_cutter', { gems: 2 }, 180, [], 4, 180, 'gems cut to catch the light.', ic('Rock', 1, 0)),
  ware('gold_goblet', 'Gold Goblet', 'gem_cutter', { gold: 2 }, 150, [], 3, 80, 'a goblet of hold gold.', ic('Money', 1, 0)),
  ware('sacred_oils', 'Sacred Oils', 'herb_press', { herbs: 4, fruit: 1 }, 90, [], 3, 55, 'oils pressed in the grove.', ic('Potion', 0, 1)),
  ware('wreaths', 'Wreaths', 'herb_press', { herbs: 2, fiber: 1 }, 30, [], 1, 8, 'a wreath of leaves and berries.', ic('Food', 2, 1)),
  ware('pearl_combs', 'Pearl Combs', 'pearl_works', { pearls: 1, bone: 1 }, 100, [], 3, 70, 'a comb inlaid with mother-of-pearl.', ic('Amulet', 5, 0)),
  ware('pearl_mirror', 'Pearl Mirror', 'pearl_works', { pearls: 3, wood: 1 }, 180, [], 4, 160, 'a mirror framed in nacre.', ic('Amulet', 6, 0)),
  makes('felt', 'Felt', 'felt_works', { wool: 3 }, 50, [], { cloth: 2 }, 'Wool beaten into felt: 2 cloth.', ic('Armor', 4, 0)),
  furnish('felt_rugs', 'Felt Rugs', 'felt_works', { wool: 4 }, 60, ['hospitality'], 'rug', 5, 'rugs of pressed wool in the horde’s patterns.', ic('Chest0', 3, 0)),
  ware('moonsilk', 'Moonsilk', 'glamour_loom', { cloth: 2, herbs: 2 }, 180, [], 4, 170, 'a cloth that shines by moonlight.', ic('Magic', 1, 0)),
  furnish('dream_catcher', 'Dream-Catcher', 'glamour_loom', { fiber: 3, bone: 1 }, 60, ['hospitality'], 'decor', 7, 'a hoop strung with charms.', ic('Magic', 2, 0)),
  ware('elixir', 'Elixir', 'alembic', { herbs: 3, berries: 2 }, 120, [], 3, 75, 'a cordial of the alembic.', ic('Potion', 1, 1)),
  ware('philosophers_dust', "Philosopher's Dust", 'alembic', { gold: 1, herbs: 3 }, 240, [], 4, 190, 'a pinch of the Great Work.', ic('Magic', 3, 0)),
  ware('clockwork_toys', 'Clockwork Toys', 'assembler', { iron: 2, wood: 1 }, 120, [], 3, 70, 'toys that walk when wound.', ic('Tool', 6, 0)),
  ware('brass_automaton', 'Brass Automaton', 'assembler', { iron: 4, coal: 1 }, 240, [], 4, 175, 'a little brass figure that bows.', ic('Tool', 7, 0)),
  ware('heraldic_shield', 'Heraldic Shield', 'armourer', { iron: 2, cloth: 1 }, 150, [], 3, 85, 'a shield painted with arms.', ic('Shield', 0, 0)),
  furnish('tourney_pennants', 'Tourney Pennants', 'armourer', { cloth: 2 }, 70, ['hospitality'], 'decor', 6, 'pennants from the lists.', ic('Armor', 3, 0)),
  ware('wolf_pelts', 'Wolf Pelts', 'pelt_house', { hide: 3 }, 60, [], 2, 30, 'pelts from the hunt.', ic('Flesh', 0, 8)),
  ware('fang_necklace', 'Fang Necklace', 'pelt_house', { bone: 3, hide: 1 }, 90, [], 3, 50, 'fangs on a leather cord.', ic('Amulet', 7, 0)),
];
