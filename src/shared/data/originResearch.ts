// The shared research, shaped for each people (the owner's ask: research trees that make sense to the different
// origins). The topics stay the same underneath (the buildings, items and rules they open are each people's alike), but
// each people calls them by its own names, has its own names for the lanes of the tree, studies what it is good at
// faster and what is foreign to it slower, and leaves out what it would never need (the undying dead and the machines
// have no children to raise and no crops worth bettering). The settlers keep the shared tree as it was.

import type { OriginId } from './origins';
import { BRANCH_NAMES, TOPIC_BY_ID, type Branch } from './research';

export interface OriginResearch {
  /** The lanes of the tree by this people's own names. */
  lanes?: Partial<Record<Branch, string>>;
  /** Topics by this people's own names. */
  names?: Readonly<Record<string, string>>;
  /** How long a lane's topics take to study, against the shared time (under 1 is quicker). */
  pace?: Partial<Record<Branch, number>>;
  /** Topics this people never studies: left out of its tree, and counted as met where another topic needs them
   *  (what they would open stays closed). */
  forgone?: readonly string[];
}

/** What the dead and the machines never need: children to raise, and the crops' refinements (they sow a field only
 *  for the tavern's guests). */
const UNDYING_FORGO = ['family_life', 'schooling', 'seed_saving', 'windmills', 'crop_rotation', 'fertilisers', 'green_revolution', 'gene_crops'] as const;

export const ORIGIN_RESEARCH: Readonly<Partial<Record<OriginId, OriginResearch>>> = {
  lich: {
    lanes: { construction: 'Bonework', crafting: 'Grave Crafts', agriculture: 'Grave Tending', military: 'The Legion', medicine: 'Embalming', logistics: 'Long Roads', society: 'The Silent Court', occult: 'Necromancy' },
    pace: { occult: 0.6, military: 0.9, medicine: 1.25, agriculture: 1.4, society: 1.15 },
    forgone: UNDYING_FORGO,
    names: {
      fire_keeping: 'Corpse Candles', flint_knapping: 'Bone Shards', foraging: 'Grave Robbing', basic_shelter: 'Barrow Digging',
      woodcutting: 'Deadwood Felling', stoneworking: 'Tomb Carving', cordage: 'Sinew Binding', spear_hunting: 'Bone Spears',
      tanning: 'Flaying', food_preservation: 'Salting the Dead', pottery: 'Funerary Urns', herbalism: 'Embalming Herbs',
      bonesetting: 'Rebinding Bones', field_dressing: 'Stitching', scouting: 'Restless Watchers', palisades: 'Bone Palisades',
      lookout: 'Ossuary Towers', trapmaking: 'Grasping Hands', early_agriculture: 'Grave Gardens', domestication: 'Carrion Herds',
      oral_tradition: 'Whispers of the Dead', barter: 'Trade with the Living', hospitality: 'Guests of the Grave',
      elders_council: 'The Silent Council', storytelling: 'Dirges', mining: 'Catacomb Mining', masonry: 'Mausoleum Masonry',
      iron_working: 'Grave Iron', archery: 'Skeletal Archers', armoring: 'Bone Plate', fortification: 'Charnel Walls',
      writing: 'Grave Inscriptions', physick: 'Preservation', convalescence: 'Reknitting', barber_surgeons: 'Grafting',
      peg_and_hook: 'Bone Limbs', brewing: 'Grave Wine', trade: 'Dealings with the Living', guilds: 'Covens',
      arcane_arts: 'The Black Arts', planar_lore: 'The Veil Between', sanitation: 'Ossuaries', antiseptics: 'Embalming Fluids',
      prosthetics: 'Stitched Limbs', electricity: 'Galvanism', trauma_surgery: 'Reanimation Surgery', cryonics: 'The Long Sleep',
      cloning: 'Flesh Vats', artificial_intelligence: 'Bound Minds', starship_design: 'The Black Barge',
    },
  },
  druid: {
    lanes: { construction: 'Living Wood', crafting: 'Handcraft', agriculture: 'The Green', military: 'The Thorn', medicine: 'Healing Herbs', logistics: 'Wild Ways', society: 'The Circle', occult: 'Old Mysteries' },
    pace: { agriculture: 0.7, medicine: 0.8, society: 0.9, construction: 1.15, crafting: 1.2 },
    names: {
      fire_keeping: 'Hearthfire Rites', flint_knapping: 'Stone Gifts', foraging: 'Wildcraft', basic_shelter: 'Bough Shelters',
      woodcutting: 'Deadfall Gathering', stoneworking: 'Standing Stones', cordage: 'Vine Weaving', spear_hunting: 'The Thorned Spear',
      tanning: 'Hide Blessing', food_preservation: 'Root Cellars', pottery: 'Clay Shaping', herbalism: 'Green Lore',
      bonesetting: 'Splints and Poultices', field_dressing: 'Moss Dressings', scouting: 'Reading the Wood', palisades: 'Thorn Hedges',
      lookout: 'Tree Watches', trapmaking: 'Snares of Briar', early_agriculture: 'Seed Blessing', domestication: 'Friends of the Herd',
      orcharding: 'Sacred Groves', seed_saving: 'Seed Keeping', oral_tradition: 'The Old Songs', storytelling: 'Ogham Tales',
      elders_council: 'The Oak Council', mining: 'Asking the Stone', iron_working: 'Bending Iron', carpentry: 'Living Joinery',
      masonry: 'Dry Stone', crop_rotation: 'Resting the Land', animal_husbandry: 'Herd Kinship', physick: 'Druid Medicine',
      archery: 'Yew Bows', fortification: 'Hedge Walls', writing: 'Ogham', brewing: 'Mead Making', arcane_arts: 'The Weave',
      windmills: 'Wind Spirits', coal_mining: 'Black Earth', steam_power: 'Captive Steam', industrial_farming: 'Great Tilling',
      fertilisers: 'Feeding the Soil', electricity: 'Caught Lightning', hydroponics: 'Water Gardens', gene_crops: 'Green Awakening',
      cloning: 'Seedlings of Flesh', artificial_intelligence: 'Minds of Root',
    },
  },
  vampire: {
    lanes: { construction: 'Stonework', crafting: 'Fine Crafts', agriculture: "Thralls' Fields", military: 'The Night Guard', medicine: 'The Blood', logistics: 'Night Roads', society: 'The Court', occult: 'Dark Arts' },
    pace: { occult: 0.75, society: 0.85, military: 0.9, agriculture: 1.3, medicine: 1.1 },
    names: {
      fire_keeping: 'Candlelight', foraging: 'Thralls Gather', basic_shelter: 'Crypt Chambers', stoneworking: 'Dark Masonry',
      spear_hunting: 'The Hunt by Night', herbalism: 'Nightshade', bonesetting: 'Mending Thralls', scouting: 'Bat Scouts',
      palisades: 'Iron Railings', lookout: 'Belfries', early_agriculture: "Thralls' Plots", domestication: 'The Herd',
      oral_tradition: 'Old Bloodlines', barter: 'Courtly Bargains', hospitality: 'Hosting the Living', elders_council: 'The Elder Court',
      masonry: 'Gothic Masonry', physick: 'Bloodletting', convalescence: 'Feeding the Weak', archery: 'Crossbows',
      armoring: 'Black Plate', fortification: 'Curtain Walls', writing: 'Illuminated Letters', brewing: 'Blood Wine',
      trade: 'Velvet Trade', guilds: 'Noble Houses', arcane_arts: 'Blood Sorcery', schooling: 'Tutors of the Court',
      family_life: 'Bloodlines', sanitation: 'Drains and Cisterns', public_library: 'The Forbidden Library',
      electricity: 'Electric Night', trauma_surgery: 'Transfusion', cryonics: 'The Coffin Sleep', cloning: 'Bloodline Vats',
      planar_lore: 'Shadow Realms',
    },
  },
  werewolf: {
    lanes: { construction: 'Den Building', crafting: 'Handcraft', agriculture: "The Hunt's Bounty", military: 'The Hunt', medicine: 'Licking Wounds', logistics: 'The Run', society: 'The Pack', occult: 'The Moon' },
    pace: { military: 0.8, logistics: 0.85, occult: 0.9, society: 1.15, crafting: 1.1 },
    names: {
      fire_keeping: 'Fire Against the Dark', flint_knapping: 'Fang and Flint', foraging: 'Scent Tracking', basic_shelter: 'Dens',
      cordage: 'Gut Cords', spear_hunting: 'Pack Hunting', tanning: 'Pelt Curing', food_preservation: 'Smoking the Kill',
      herbalism: 'Wolfsbane Lore', bonesetting: 'Setting the Leg', field_dressing: 'Binding Wounds', scouting: 'Running the Bounds',
      palisades: 'Stake Fences', lookout: 'Howling Rocks', trapmaking: 'Jaw Traps', early_agriculture: 'Planting for the Lean Moons',
      domestication: 'Tamed Beasts', oral_tradition: 'Howls and Tales', barter: 'Trading Pelts', elders_council: 'The Grey Muzzles',
      beast_lore: 'Kin of the Wild', storytelling: 'Moon Tales', trail_marking: 'Scent Marking', mining: 'Digging Deep',
      iron_working: 'Silver-Proof Iron', archery: 'Hunting Bows', armoring: 'Hide Armour', fortification: 'The Great Den',
      writing: 'Claw Marks', animal_husbandry: 'The Herd Kept Close', physick: 'Pack Medicine', brewing: 'Bitter Brews',
      arcane_arts: 'Moon Craft', family_life: 'Cubs', schooling: 'Teaching the Cubs', railways: 'Iron Trails',
      firearms: 'Fire Sticks', drones: 'Iron Hounds',
    },
  },
  robot: {
    lanes: { construction: 'Fabrication', crafting: 'Manufacture', agriculture: 'Bio-Supply', military: 'Defence Protocols', medicine: 'Maintenance', logistics: 'Logistics Net', society: 'The Network', occult: 'Anomalies' },
    pace: { crafting: 0.75, construction: 0.8, logistics: 0.9, society: 1.25, medicine: 1.1, occult: 1.4 },
    forgone: UNDYING_FORGO,
    names: {
      fire_keeping: 'Thermal Control', flint_knapping: 'Edge Grinding', foraging: 'Salvage', basic_shelter: 'Shelter Shells',
      woodcutting: 'Timber Cutting', stoneworking: 'Stone Milling', cordage: 'Cable Spooling', spear_hunting: 'Pest Control',
      tanning: 'Polymer Sheeting', food_preservation: 'Organic Storage', pottery: 'Ceramic Casting', herbalism: 'Lubricants',
      bonesetting: 'Joint Repair', field_dressing: 'Patch Kits', scouting: 'Survey Units', palisades: 'Barrier Fences',
      lookout: 'Sensor Masts', trapmaking: 'Tripwires', early_agriculture: 'Bio-Farming', domestication: 'Livestock Handling',
      oral_tradition: 'Data Logs', barter: 'Exchange Protocols', hospitality: 'Organic Hospitality', elders_council: 'Consensus Core',
      storytelling: 'Archive Recall', mining: 'Ore Extraction', iron_working: 'Smelting', carpentry: 'Frame Assembly',
      masonry: 'Block Laying', physick: 'Diagnostics', barber_surgeons: 'Field Repair', peg_and_hook: 'Spare Limbs',
      convalescence: 'Recalibration', writing: 'Encoding', brewing: 'Organic Beverages', guilds: 'Work Queues',
      arcane_arts: 'Unexplained Phenomena', sanitation: 'Coolant Systems', antiseptics: 'Corrosion Control', prosthetics: 'Modular Limbs',
      trauma_surgery: 'Rebuild Bays', cryonics: 'Cold Storage', bionics: 'Upgrades', cloning: 'Organic Printing',
      artificial_intelligence: 'Self-Awareness',
    },
  },
  dwarves: {
    lanes: { construction: 'Stonecraft', crafting: 'The Forge', agriculture: 'Deep Farms', military: 'The Shieldwall', medicine: 'Bonesetters', logistics: 'Tunnels and Roads', society: 'The Hold', occult: 'Runes' },
    pace: { construction: 0.75, crafting: 0.75, military: 0.9, agriculture: 1.3, logistics: 1.15, occult: 1.15 },
    names: {
      fire_keeping: 'Forge Fire', flint_knapping: 'Stone Chipping', foraging: 'Mushroom Picking', basic_shelter: 'Delved Halls',
      woodcutting: 'Pit Props', stoneworking: 'Rune-Cut Stone', cordage: 'Rope for the Shafts', spear_hunting: 'Axe and Spear',
      tanning: 'Apron Leather', pottery: 'Crucibles', herbalism: 'Cave Moss Remedies', scouting: 'Prospecting',
      palisades: 'Stone Barricades', lookout: 'Watch Holes', trapmaking: 'Pit Traps', early_agriculture: 'Mushroom Beds',
      domestication: 'Cave Goats', oral_tradition: 'Ancestor Lays', barter: 'Ingot Trade', hospitality: 'Mead Halls',
      elders_council: 'The Thanes', mining: 'Deep Delving', iron_working: 'Smithcraft', masonry: 'Hold Masonry',
      leatherworking: 'Harness Making', archery: 'Crossbow Craft', armoring: 'Mail and Plate', fortification: 'Hold Gates',
      siege_engines: 'War Machines', writing: 'Rune Letters', brewing: 'Ale Halls', trade: 'Ore Caravans', guilds: 'Clan Guilds',
      jewellery: 'Gemcraft', delving: 'The Deep Roads', arcane_arts: 'Rune Magic', coal_mining: 'Coal Seams',
      steelmaking: 'Dwarven Steel', steam_power: 'Steam Bellows', railways: 'Mine Rails', deep_mining: 'The Roots of the World',
      advanced_alloys: 'Mithril',
    },
  },
  merfolk: {
    lanes: { construction: 'Coral Building', crafting: 'Shellcraft', agriculture: 'Kelp Beds', military: 'The Tide Guard', medicine: 'Sea Remedies', logistics: 'Currents', society: 'The Shoal', occult: 'Deep Mysteries' },
    pace: { logistics: 0.75, agriculture: 0.9, medicine: 0.9, construction: 1.2, military: 1.1 },
    names: {
      fire_keeping: 'Shore Fires', flint_knapping: 'Shell Blades', foraging: 'Tide Pooling', basic_shelter: 'Stilt Huts',
      woodcutting: 'Driftwood', stoneworking: 'Coral Cutting', cordage: 'Kelp Rope', spear_hunting: 'Trident Fishing',
      tanning: 'Sharkskin', food_preservation: 'Salting Fish', pottery: 'Shell Bowls', herbalism: 'Seaweed Salves',
      scouting: 'Reading Currents', palisades: 'Reef Barriers', lookout: 'Lighthouse Rocks', trapmaking: 'Net Traps',
      early_agriculture: 'Kelp Farming', domestication: 'Shore Herds', fish_traps: 'Weirs', oral_tradition: 'Songs of the Deep',
      barter: 'Pearl Trade', hospitality: 'Shore Welcome', elders_council: 'The Shoal Council', boatbuilding: 'Hollowed Hulls',
      shipwrighting: 'Ocean Ships', navigation: 'Star and Swell', mining: 'Seabed Digging', masonry: 'Coral Masonry',
      archery: 'Harpoons', fortification: 'Sea Walls', writing: 'Shell Script', brewing: 'Kelp Wine', trade: 'Tide Markets',
      jewellery: 'Pearlcraft', arcane_arts: 'Tide Magic', steamships: 'Steam Hulls', hydroponics: 'Sea Gardens',
    },
  },
  nomads: {
    lanes: { construction: 'Tents and Poles', crafting: 'Felt and Leather', agriculture: 'Herds and Grazing', military: 'Horse Archery', medicine: 'Healers of the Road', logistics: 'The Trail', society: 'The Clans', occult: 'Sky Spirits' },
    pace: { logistics: 0.75, military: 0.85, crafting: 0.95, construction: 1.3, agriculture: 1.1 },
    names: {
      fire_keeping: 'Dung Fires', foraging: 'Steppe Gathering', basic_shelter: 'Hide Tents', woodcutting: 'Tent Poles',
      stoneworking: 'Grinding Stones', cordage: 'Horsehair Rope', spear_hunting: 'Lance Hunting', tanning: 'Felt Making',
      food_preservation: 'Dried Curds', herbalism: 'Steppe Herbs', scouting: 'Outriders', palisades: 'Wagon Barriers',
      lookout: 'Hill Watches', early_agriculture: 'Seasonal Plots', domestication: 'Horse Taming', oral_tradition: 'Epic Songs',
      barter: 'Caravan Trade', hospitality: 'Guest Right', pack_carrying: 'Pack Horses', elders_council: 'The Kurultai',
      trail_marking: 'Cairns', carpentry: 'Wagon Making', leatherworking: 'Saddlery', weaving: 'Carpet Weaving',
      animal_husbandry: 'Great Herds', archery: 'The Composite Bow', armoring: 'Lamellar', fortification: 'Wagon Forts',
      carts: 'Great Wagons', writing: 'Tamga Signs', brewing: 'Kumis', trade: 'The Silk Road', cartography: 'Star Charts',
      arcane_arts: 'Shamanry', railways: 'Iron Roads', urban_housing: 'Settled Quarters', motor_transport: 'Iron Horses',
    },
  },
  fae: {
    lanes: { construction: 'Glamour and Bower', crafting: 'Fey Crafts', agriculture: 'The Bloom', military: 'The Thorn Guard', medicine: 'Dew Remedies', logistics: 'Moon Paths', society: 'The Court', occult: 'Glamour' },
    pace: { occult: 0.7, society: 0.85, agriculture: 0.9, crafting: 1.25, construction: 1.15 },
    names: {
      fire_keeping: 'Will-o-Wisps', flint_knapping: 'Thorn Blades', foraging: 'Dewgathering', basic_shelter: 'Bowers',
      woodcutting: 'Asking the Trees', stoneworking: 'Fairy Rings', cordage: 'Spider Silk', spear_hunting: 'Thorn Spears',
      tanning: 'Moth Wing', pottery: 'Acorn Cups', herbalism: 'Dewdrop Salves', scouting: 'Wisp Scouts', palisades: 'Briar Walls',
      lookout: 'Mushroom Towers', trapmaking: 'Glamour Snares', early_agriculture: 'Flower Tending', domestication: 'Charmed Beasts',
      oral_tradition: 'Riddles', barter: 'Fair Bargains', hospitality: 'Faerie Revels', elders_council: 'The Seelie Court',
      storytelling: 'Glamour Tales', mining: 'Crystal Gathering', iron_working: 'Cold Iron (Gloved)', masonry: 'Moonstone Building',
      weaving: 'Moonlight Weaving', archery: 'Elf Shot', armoring: 'Thornmail', fortification: 'Enchanted Walls',
      writing: 'Leaf Script', brewing: 'Faerie Wine', trade: 'Moonlit Markets', jewellery: 'Dew Gems', arcane_arts: 'High Glamour',
      planar_lore: 'The Feywild Paths', steelmaking: 'Bearing Iron', electricity: 'Bottled Lightning',
    },
  },
  alchemists: {
    lanes: { construction: 'Laboratories', crafting: 'The Crucible', agriculture: 'Distilled Harvests', military: 'Volatile Defence', medicine: 'Tinctures', logistics: 'Supply Lines', society: 'The Guild', occult: 'Hermetic Arts' },
    pace: { medicine: 0.75, crafting: 0.85, occult: 0.85, society: 0.95, military: 1.2 },
    names: {
      fire_keeping: 'The Athanor Flame', flint_knapping: 'Grinding Minerals', foraging: 'Reagent Gathering', basic_shelter: 'Workshops',
      stoneworking: 'Mortar and Pestle', cordage: 'Wick Making', pottery: 'Alembics', food_preservation: 'Brine and Spirits',
      herbalism: 'Herbal Tinctures', bonesetting: 'Plasters', field_dressing: 'Styptics', scouting: 'Specimen Hunting',
      palisades: 'Acid-Etched Stakes', trapmaking: 'Caustic Pits', early_agriculture: 'Physic Gardens', oral_tradition: 'Formulae',
      barter: 'Reagent Trade', elders_council: 'The Magisterium', mining: 'Mineral Prospecting', iron_working: 'Metallurgy',
      masonry: 'Furnace Building', physick: 'Iatrochemistry', barber_surgeons: 'Chirurgery', convalescence: 'Restoratives',
      archery: 'Fire Arrows', fortification: 'Bastions', siege_engines: 'Incendiaries', writing: 'Ciphers', brewing: 'Distillation',
      guilds: 'The Alchemical Guild', jewellery: 'Gem Synthesis', arcane_arts: 'Hermeticism', glassblowing: 'Glassware',
      sanitation: 'Disinfection', antiseptics: 'Carbolic Acid', firearms: 'Black Powder', refining: 'Fractional Distillation',
      trauma_surgery: 'Anaesthetics', cloning: 'The Homunculus Vats',
    },
  },
  knights: {
    lanes: { construction: 'Castles', crafting: 'The Armoury', agriculture: 'The Demesne', military: 'Chivalry', medicine: 'Hospitallers', logistics: 'Roads of the Realm', society: 'The Order', occult: 'Forbidden Arts' },
    pace: { military: 0.75, construction: 0.9, society: 0.95, medicine: 0.95, occult: 1.3 },
    names: {
      fire_keeping: 'Hearth and Hall', foraging: 'Gleaning', basic_shelter: 'Motte Huts', stoneworking: 'Keep Stones',
      spear_hunting: 'The Lance', herbalism: 'Monastery Herbs', scouting: 'Heralds', palisades: 'Motte and Bailey',
      lookout: 'Watchtowers', early_agriculture: 'Manorial Fields', domestication: 'Warhorses', oral_tradition: 'Chansons',
      barter: 'Market Rights', hospitality: 'Hospitality of the Hall', elders_council: 'The Round Table', storytelling: 'Romances',
      masonry: 'Castle Masonry', archery: 'The Longbow', armoring: 'Plate Armour', fortification: 'Concentric Castles',
      siege_engines: 'Trebuchets', physick: 'Hospitallers', writing: 'Charters', brewing: 'Monastic Ale', trade: 'Fairs',
      guilds: 'Liveries', town_charter: 'Royal Charter', arcane_arts: 'Court Magic', schooling: 'Squires',
      family_life: 'Heirs', firearms: 'Gunpowder', drill_manuals: 'Drill and Discipline', rifles: 'Musketry',
    },
  },
  orcs: {
    lanes: { construction: 'Hutbuildin', crafting: "Smashin' an' Makin'", agriculture: 'Grub', military: 'Fightin', medicine: 'Patchin Up', logistics: 'Raidin Roads', society: 'Da Mob', occult: 'Spirit Talk' },
    pace: { military: 0.75, construction: 0.9, crafting: 1.1, medicine: 1.2, society: 1.25, occult: 1.1 },
    names: {
      fire_keeping: 'Big Fires', flint_knapping: 'Sharp Rocks', foraging: 'Grabbin Grub', basic_shelter: 'Mud Huts',
      woodcutting: 'Choppin Trees', stoneworking: 'Smashin Rocks', cordage: 'Gut Rope', spear_hunting: 'Pointy Sticks',
      tanning: 'Skinnin', food_preservation: 'Smokin Meat', pottery: 'Grog Pots', herbalism: 'Fungus Mash', bonesetting: 'Bone Bashin Back',
      field_dressing: 'Stitchin Up', scouting: 'Sneaky Gits', palisades: 'Spiky Fences', lookout: 'Lookout Poles', trapmaking: 'Spike Pits',
      early_agriculture: 'Growin Grub', domestication: 'Boar Herdin', oral_tradition: 'Shoutin Tales', barter: 'Swappin Loot',
      hospitality: 'Feastin', elders_council: 'Big Boss Talk', mining: 'Diggin', iron_working: 'Choppa Makin', masonry: 'Rock Walls',
      carpentry: 'Hammerin', archery: 'Shooty Bows', armoring: 'Big Armour', fortification: 'Big Walls', siege_engines: 'Smasha Engines',
      writing: 'Scratchin Marks', brewing: 'Grog Brewin', trade: 'Proper Tradin', arcane_arts: 'Waaagh Magic', firearms: 'Shootas',
      steam_power: 'Smoky Engines', motor_transport: 'Wartrukks', rifles: 'Big Shootas', energy_weapons: 'Zappas',
    },
  },
};

/** A topic's name for a people (the shared name where it has none of its own). */
export function topicName(id: string, origin: OriginId | undefined): string {
  return ORIGIN_RESEARCH[origin ?? 'settlers']?.names?.[id] ?? TOPIC_BY_ID[id]?.name ?? id;
}

/** A lane's name for a people. */
export function laneName(branch: Branch, origin: OriginId | undefined): string {
  return ORIGIN_RESEARCH[origin ?? 'settlers']?.lanes?.[branch] ?? BRANCH_NAMES[branch];
}

/** How long a topic takes this people, against the shared time (heritage topics as written). */
export function studyPace(id: string, origin: OriginId | undefined): number {
  const t = TOPIC_BY_ID[id];
  if (!t || t.origin) return 1;
  return ORIGIN_RESEARCH[origin ?? 'settlers']?.pace?.[t.branch] ?? 1;
}

/** Whether a people never studies a topic. */
export function forgone(id: string, origin: OriginId | undefined): boolean {
  return !!ORIGIN_RESEARCH[origin ?? 'settlers']?.forgone?.includes(id);
}
