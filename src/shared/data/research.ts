// Research by era (DESIGN §5, §15). Research costs no materials, only time. Numbers are starting points.

import type { Era } from './eras';
import type { WorkAnim } from './terrain';

export type Branch = 'construction' | 'crafting' | 'agriculture' | 'military' | 'medicine' | 'logistics' | 'society' | 'occult';

export const BRANCH_NAMES: Record<Branch, string> = {
  construction: 'Construction',
  crafting: 'Crafting',
  agriculture: 'Agriculture',
  military: 'Military',
  medicine: 'Medicine',
  logistics: 'Logistics',
  society: 'Society',
  occult: 'Occult',
};

/** Lasting effects of a finished topic. Only effects with something to act on yet are listed. */
export type Effect =
  | { type: 'gatherSpeed'; anim: WorkAnim; mult: number }
  | { type: 'researchSlots'; add: number }
  | { type: 'researchSpeed'; mult: number }
  | { type: 'carry'; add: number }
  | { type: 'storage'; mult: number }
  | { type: 'cropSpeed'; mult: number }
  | { type: 'queueSlots'; add: number }
  | { type: 'eraCapstone' };

export interface Topic {
  id: string;
  name: string;
  branch: Branch;
  /** The era it belongs to (hidden until the town reaches it). Neolithic when left out. */
  era?: Era;
  /** Hidden research (DESIGN §9): not shown or researchable until the town has discovered it. */
  hidden?: boolean;
  /** Base seconds of research work (before era multiplier and researcher speed). */
  seconds: number;
  prereqs: string[];
  /** Also requires this many other finished topics (Elder's Council). */
  requiresCount?: number;
  /** What else it unlocks, for display. Buildings and items are listed automatically from their data. */
  unlocks: string;
  effects: Effect[];
}

export const TOPICS: readonly Topic[] = [
  { id: 'fire_keeping', name: 'Fire Keeping', branch: 'crafting', seconds: 120, prereqs: [], unlocks: '', effects: [] },
  { id: 'flint_knapping', name: 'Flint Knapping', branch: 'crafting', seconds: 150, prereqs: [], unlocks: '', effects: [] },
  { id: 'foraging', name: 'Foraging', branch: 'agriculture', seconds: 120, prereqs: [], unlocks: 'Faster foraging, Forager job', effects: [{ type: 'gatherSpeed', anim: 'forage', mult: 1.3 }] },
  { id: 'basic_shelter', name: 'Basic Shelter', branch: 'construction', seconds: 120, prereqs: [], unlocks: '', effects: [] },
  { id: 'woodcutting', name: 'Woodcutting', branch: 'construction', seconds: 180, prereqs: ['flint_knapping'], unlocks: 'Faster forest clearing', effects: [{ type: 'gatherSpeed', anim: 'chop', mult: 1.3 }] },
  { id: 'stoneworking', name: 'Stoneworking', branch: 'construction', seconds: 180, prereqs: ['flint_knapping'], unlocks: 'Faster rock clearing', effects: [{ type: 'gatherSpeed', anim: 'mine', mult: 1.3 }] },
  { id: 'cordage', name: 'Cordage', branch: 'crafting', seconds: 180, prereqs: ['foraging'], unlocks: '', effects: [] },
  { id: 'spear_hunting', name: 'Spear Hunting', branch: 'military', seconds: 210, prereqs: ['flint_knapping'], unlocks: 'Hunt expeditions', effects: [] },
  { id: 'tanning', name: 'Tanning', branch: 'crafting', seconds: 210, prereqs: ['spear_hunting'], unlocks: '', effects: [] },
  { id: 'food_preservation', name: 'Food Preservation', branch: 'agriculture', seconds: 180, prereqs: ['fire_keeping'], unlocks: '', effects: [] },
  { id: 'pottery', name: 'Pottery', branch: 'crafting', seconds: 210, prereqs: ['fire_keeping'], unlocks: '+20% storage', effects: [{ type: 'storage', mult: 1.2 }] },
  { id: 'herbalism', name: 'Herbalism', branch: 'medicine', seconds: 180, prereqs: ['foraging'], unlocks: '', effects: [] },
  { id: 'scouting', name: 'Scouting', branch: 'logistics', seconds: 240, prereqs: ['cordage'], unlocks: 'Scout expeditions, more destinations', effects: [] },
  { id: 'palisades', name: 'Palisades', branch: 'military', seconds: 240, prereqs: ['woodcutting'], unlocks: '', effects: [] },
  { id: 'lookout', name: 'Lookout', branch: 'military', seconds: 240, prereqs: ['palisades'], unlocks: 'Raid warning', effects: [] },
  { id: 'early_agriculture', name: 'Early Agriculture', branch: 'agriculture', seconds: 240, prereqs: ['foraging'], unlocks: 'Wild grain', effects: [] },
  { id: 'oral_tradition', name: 'Oral Tradition', branch: 'society', seconds: 180, prereqs: ['fire_keeping'], unlocks: '+1 research queue slot, +10% research speed', effects: [{ type: 'researchSlots', add: 1 }, { type: 'researchSpeed', mult: 1.1 }] },
  { id: 'barter', name: 'Barter', branch: 'logistics', seconds: 180, prereqs: ['fire_keeping'], unlocks: 'Travellers stop to buy and sell: coins', effects: [] },
  { id: 'pack_carrying', name: 'Pack Carrying', branch: 'logistics', seconds: 240, prereqs: ['tanning', 'cordage'], unlocks: '+5 carry', effects: [{ type: 'carry', add: 5 }] },
  { id: 'elders_council', name: "Elder's Council", branch: 'society', seconds: 600, prereqs: ['oral_tradition'], requiresCount: 10, unlocks: 'Building the Elder Lodge opens the Medieval era', effects: [{ type: 'eraCapstone' }] },

  // Medieval (every time here is stretched by the era multiplier, 2.5x)
  { id: 'mining', name: 'Mining', branch: 'construction', era: 'medieval', seconds: 300, prereqs: [], unlocks: 'Iron Hills expeditions', effects: [] },
  { id: 'iron_working', name: 'Iron Working', branch: 'crafting', era: 'medieval', seconds: 420, prereqs: ['mining'], unlocks: 'Iron from ore', effects: [] },
  { id: 'carpentry', name: 'Carpentry', branch: 'construction', era: 'medieval', seconds: 300, prereqs: [], unlocks: 'Lumber', effects: [] },
  { id: 'masonry', name: 'Masonry', branch: 'construction', era: 'medieval', seconds: 420, prereqs: ['mining'], unlocks: 'Bricks (at the kiln)', effects: [] },
  { id: 'leatherworking', name: 'Leatherworking', branch: 'crafting', era: 'medieval', seconds: 300, prereqs: [], unlocks: 'Leather', effects: [] },
  { id: 'weaving', name: 'Weaving', branch: 'crafting', era: 'medieval', seconds: 300, prereqs: [], unlocks: 'Cloth', effects: [] },
  { id: 'milling', name: 'Milling', branch: 'agriculture', era: 'medieval', seconds: 360, prereqs: ['carpentry'], unlocks: 'Flour from grain', effects: [] },
  { id: 'baking', name: 'Baking', branch: 'agriculture', era: 'medieval', seconds: 300, prereqs: ['milling', 'masonry'], unlocks: 'Bread', effects: [] },
  { id: 'crop_rotation', name: 'Crop Rotation', branch: 'agriculture', era: 'medieval', seconds: 360, prereqs: [], unlocks: 'Fields grow 30% faster', effects: [{ type: 'cropSpeed', mult: 1.3 }] },
  { id: 'animal_husbandry', name: 'Animal Husbandry', branch: 'agriculture', era: 'medieval', seconds: 480, prereqs: ['carpentry'], unlocks: 'Horses for expeditions', effects: [] },
  { id: 'physick', name: 'Physick', branch: 'medicine', era: 'medieval', seconds: 420, prereqs: ['weaving'], unlocks: 'Faster healing', effects: [] },
  { id: 'archery', name: 'Archery', branch: 'military', era: 'medieval', seconds: 360, prereqs: ['carpentry'], unlocks: '', effects: [] },
  { id: 'armoring', name: 'Armoring', branch: 'military', era: 'medieval', seconds: 540, prereqs: ['iron_working', 'leatherworking'], unlocks: '', effects: [] },
  { id: 'fortification', name: 'Fortification', branch: 'military', era: 'medieval', seconds: 480, prereqs: ['masonry'], unlocks: 'Two hours of raid warning', effects: [] },
  { id: 'carts', name: 'Carts', branch: 'logistics', era: 'medieval', seconds: 420, prereqs: ['carpentry', 'iron_working'], unlocks: '+5 carry, +20% storage', effects: [{ type: 'carry', add: 5 }, { type: 'storage', mult: 1.2 }] },
  { id: 'writing', name: 'Writing', branch: 'society', era: 'medieval', seconds: 480, prereqs: ['weaving'], unlocks: '+1 research queue slot', effects: [{ type: 'researchSlots', add: 1 }] },
  { id: 'brewing', name: 'Brewing', branch: 'society', era: 'medieval', seconds: 420, prereqs: ['milling'], unlocks: 'Morale, and more wanderers', effects: [] },
  { id: 'trade', name: 'Trade', branch: 'society', era: 'medieval', seconds: 480, prereqs: ['carpentry', 'weaving'], unlocks: 'Trade caravans', effects: [] },
  { id: 'family_life', name: 'Family Life', branch: 'society', era: 'medieval', seconds: 420, prereqs: [], unlocks: 'Couples marry and raise children', effects: [] },
  { id: 'schooling', name: 'Schooling', branch: 'society', era: 'medieval', seconds: 420, prereqs: ['writing', 'family_life'], unlocks: 'Children grow up more skilled', effects: [] },
  { id: 'guilds', name: 'Guilds', branch: 'logistics', era: 'medieval', seconds: 480, prereqs: ['writing'], unlocks: '+1 craft and build queue slot', effects: [{ type: 'queueSlots', add: 1 }] },
  // Industrial (times stretched 6x)
  { id: 'coal_mining', name: 'Coal Mining', branch: 'construction', era: 'industrial', seconds: 300, prereqs: [], unlocks: '', effects: [] },
  { id: 'steelmaking', name: 'Steelmaking', branch: 'crafting', era: 'industrial', seconds: 420, prereqs: ['coal_mining'], unlocks: 'Steel from iron and coal', effects: [] },
  { id: 'glassblowing', name: 'Glassblowing', branch: 'crafting', era: 'industrial', seconds: 360, prereqs: ['coal_mining'], unlocks: 'Glass', effects: [] },
  { id: 'steam_power', name: 'Steam Power', branch: 'crafting', era: 'industrial', seconds: 600, prereqs: ['steelmaking'], unlocks: 'The Factory: crafting at twice the speed', effects: [] },
  { id: 'firearms', name: 'Firearms', branch: 'military', era: 'industrial', seconds: 480, prereqs: ['steelmaking'], unlocks: '', effects: [] },
  { id: 'industrial_farming', name: 'Industrial Farming', branch: 'agriculture', era: 'industrial', seconds: 480, prereqs: ['steam_power'], unlocks: 'Fields grow 50% faster', effects: [{ type: 'cropSpeed', mult: 1.5 }] },
  { id: 'sanitation', name: 'Sanitation', branch: 'medicine', era: 'industrial', seconds: 420, prereqs: ['glassblowing'], unlocks: 'The Hospital; plague spreads far less', effects: [] },
  { id: 'railways', name: 'Railways', branch: 'logistics', era: 'industrial', seconds: 600, prereqs: ['steam_power'], unlocks: '+10 carry, +30% storage', effects: [{ type: 'carry', add: 10 }, { type: 'storage', mult: 1.3 }] },
  { id: 'urban_housing', name: 'Urban Housing', branch: 'construction', era: 'industrial', seconds: 420, prereqs: ['steelmaking'], unlocks: '', effects: [] },
  { id: 'public_library', name: 'Public Libraries', branch: 'society', era: 'industrial', seconds: 540, prereqs: ['glassblowing'], unlocks: '+1 research queue slot', effects: [{ type: 'researchSlots', add: 1 }] },
  { id: 'assembly_lines', name: 'Assembly Lines', branch: 'logistics', era: 'industrial', seconds: 600, prereqs: ['steam_power'], unlocks: '+1 craft and build queue slot', effects: [{ type: 'queueSlots', add: 1 }] },
  { id: 'electricity', name: 'Electricity', branch: 'society', era: 'industrial', seconds: 1500, prereqs: ['steam_power', 'public_library'], requiresCount: 6, unlocks: 'Building the Power Station opens the Modern era', effects: [{ type: 'eraCapstone' }] },

  // Modern (times stretched 15x)
  { id: 'oil_drilling', name: 'Oil Drilling', branch: 'construction', era: 'modern', seconds: 300, prereqs: [], unlocks: 'Crude oil', effects: [] },
  { id: 'refining', name: 'Refining', branch: 'crafting', era: 'modern', seconds: 420, prereqs: ['oil_drilling'], unlocks: 'Fuel and plastic', effects: [] },
  { id: 'concrete', name: 'Concrete', branch: 'construction', era: 'modern', seconds: 360, prereqs: [], unlocks: 'Concrete, and walls of it', effects: [] },
  { id: 'electronics', name: 'Electronics', branch: 'crafting', era: 'modern', seconds: 540, prereqs: ['refining'], unlocks: 'Electronics, and power tools', effects: [] },
  { id: 'motor_transport', name: 'Motor Transport', branch: 'logistics', era: 'modern', seconds: 480, prereqs: ['refining'], unlocks: 'Trucks for expeditions; +10 carry', effects: [{ type: 'carry', add: 10 }] },
  { id: 'modern_housing', name: 'Modern Housing', branch: 'construction', era: 'modern', seconds: 420, prereqs: ['concrete'], unlocks: '', effects: [] },
  { id: 'rifles', name: 'Rifles', branch: 'military', era: 'modern', seconds: 480, prereqs: ['refining'], unlocks: 'Rifles, cartridges and body armour', effects: [] },
  { id: 'mechanized_farming', name: 'Mechanized Farming', branch: 'agriculture', era: 'modern', seconds: 480, prereqs: ['motor_transport'], unlocks: 'Fields grow 50% faster', effects: [{ type: 'cropSpeed', mult: 1.5 }] },
  { id: 'trauma_surgery', name: 'Trauma Surgery', branch: 'medicine', era: 'modern', seconds: 540, prereqs: ['electronics'], unlocks: 'The Trauma Center', effects: [] },
  { id: 'radio', name: 'Radio', branch: 'society', era: 'modern', seconds: 480, prereqs: ['electronics'], unlocks: '+1 research queue slot', effects: [{ type: 'researchSlots', add: 1 }] },
  { id: 'higher_education', name: 'Higher Education', branch: 'society', era: 'modern', seconds: 600, prereqs: ['electronics', 'modern_housing'], unlocks: 'The University: research five times as fast', effects: [] },
  { id: 'containerization', name: 'Containerization', branch: 'logistics', era: 'modern', seconds: 540, prereqs: ['motor_transport'], unlocks: '+1 craft and build queue slot, +30% storage', effects: [{ type: 'queueSlots', add: 1 }, { type: 'storage', mult: 1.3 }] },
  { id: 'cryonics', name: 'Cryonics', branch: 'medicine', era: 'modern', seconds: 600, prereqs: ['trauma_surgery'], unlocks: 'The Cryo Pod: the founder can be brought back, frailer', effects: [] },
  { id: 'space_program', name: 'Space Program', branch: 'society', era: 'modern', seconds: 1500, prereqs: ['higher_education', 'radio'], requiresCount: 7, unlocks: 'Building Mission Control opens the Robotic & Space era', effects: [{ type: 'eraCapstone' }] },

  // Robotic & Space (times stretched 40x)
  { id: 'deep_mining', name: 'Deep Mining', branch: 'construction', era: 'space', seconds: 300, prereqs: [], unlocks: 'Rare minerals', effects: [] },
  { id: 'advanced_alloys', name: 'Advanced Alloys', branch: 'crafting', era: 'space', seconds: 420, prereqs: ['deep_mining'], unlocks: 'Alloys', effects: [] },
  { id: 'microchips', name: 'Microchips', branch: 'crafting', era: 'space', seconds: 420, prereqs: ['deep_mining'], unlocks: 'Circuits', effects: [] },
  { id: 'power_storage', name: 'Power Storage', branch: 'crafting', era: 'space', seconds: 420, prereqs: ['microchips'], unlocks: 'Power cells', effects: [] },
  { id: 'robotics', name: 'Robotics', branch: 'crafting', era: 'space', seconds: 540, prereqs: ['microchips', 'advanced_alloys'], unlocks: 'Worker bots: every job goes faster', effects: [] },
  { id: 'drones', name: 'Drones', branch: 'logistics', era: 'space', seconds: 480, prereqs: ['microchips', 'power_storage'], unlocks: '+20 carry, +30% storage', effects: [{ type: 'carry', add: 20 }, { type: 'storage', mult: 1.3 }] },
  { id: 'habitats', name: 'Habitats', branch: 'construction', era: 'space', seconds: 420, prereqs: ['advanced_alloys'], unlocks: '', effects: [] },
  { id: 'hydroponics', name: 'Hydroponics', branch: 'agriculture', era: 'space', seconds: 480, prereqs: ['power_storage'], unlocks: 'Fields grow twice as fast, and even in winter', effects: [{ type: 'cropSpeed', mult: 2 }] },
  { id: 'energy_weapons', name: 'Energy Weapons', branch: 'military', era: 'space', seconds: 540, prereqs: ['power_storage', 'advanced_alloys'], unlocks: 'Laser rifles and powered armour', effects: [] },
  { id: 'fusion', name: 'Fusion Power', branch: 'construction', era: 'space', seconds: 600, prereqs: ['power_storage'], unlocks: 'The Fusion Reactor: crafting 50% faster', effects: [] },
  { id: 'energy_shields', name: 'Energy Shields', branch: 'military', era: 'space', seconds: 600, prereqs: ['fusion'], unlocks: 'The Shield Generator', effects: [] },
  { id: 'cloning', name: 'Cloning', branch: 'medicine', era: 'space', seconds: 600, prereqs: ['robotics'], unlocks: 'The Clone Vat: the founder can be brought back, forgetting some skill', effects: [] },
  { id: 'artificial_intelligence', name: 'Artificial Intelligence', branch: 'society', era: 'space', seconds: 720, prereqs: ['robotics'], unlocks: '+1 research queue slot, +25% research speed', effects: [{ type: 'researchSlots', add: 1 }, { type: 'researchSpeed', mult: 1.25 }] },
  { id: 'starship_design', name: 'Starship Design', branch: 'society', era: 'space', seconds: 1800, prereqs: ['artificial_intelligence', 'fusion'], requiresCount: 8, unlocks: 'The Launch Site: build the ship and leave for the stars', effects: [{ type: 'eraCapstone' }] },

  // Occult (hidden until revealed: a strange tome, a hermit, or a vision)
  { id: 'forbidden_lore', name: 'Forbidden Lore', branch: 'occult', hidden: true, seconds: 300, prereqs: [], unlocks: 'The first steps into the Occult', effects: [] },
  { id: 'spirit_binding', name: 'Spirit Binding', branch: 'occult', hidden: true, seconds: 420, prereqs: ['forbidden_lore'], unlocks: 'The Spirit Totem: a second life, once', effects: [] },
  { id: 'blood_rite', name: 'The Blood Rite', branch: 'occult', hidden: true, seconds: 600, prereqs: ['spirit_binding'], unlocks: 'The founder may become a vampire', effects: [] },
  { id: 'resurrection_rites', name: 'Resurrection Rites', branch: 'occult', hidden: true, era: 'medieval', seconds: 900, prereqs: ['spirit_binding'], unlocks: '', effects: [] },
  { id: 'lichcraft', name: 'Lichcraft', branch: 'occult', hidden: true, era: 'medieval', seconds: 1200, prereqs: ['resurrection_rites'], unlocks: 'The Phylactery: the founder becomes a lich', effects: [] },
  // special classes (see classes.ts): three hidden in the Occult, one out in the open
  { id: 'necromancy', name: 'Necromancy', branch: 'occult', hidden: true, era: 'medieval', seconds: 1200, prereqs: ['resurrection_rites'], unlocks: 'Train a Necromancer (Townsfolk)', effects: [] },
  { id: 'summoning', name: 'Summoning', branch: 'occult', hidden: true, seconds: 900, prereqs: ['blood_rite'], unlocks: 'Train a Summoner (Townsfolk)', effects: [] },
  { id: 'blood_oath', name: 'The Blood Oath', branch: 'occult', hidden: true, seconds: 900, prereqs: ['blood_rite'], unlocks: 'Train a Blood Knight (Townsfolk)', effects: [] },
  { id: 'beast_lore', name: 'Beast Lore', branch: 'military', seconds: 300, prereqs: ['spear_hunting'], unlocks: 'Train a Beast Tamer (Townsfolk)', effects: [] },
  { id: 'moon_rite', name: 'The Moon Rite', branch: 'occult', hidden: true, seconds: 600, prereqs: ['spirit_binding', 'beast_lore'], unlocks: 'The founder may become a werewolf', effects: [] },
  { id: 'town_charter', name: 'Town Charter', branch: 'society', era: 'medieval', seconds: 1200, prereqs: ['writing', 'guilds'], requiresCount: 12, unlocks: 'Building the Town Hall opens the Industrial era', effects: [{ type: 'eraCapstone' }] },
];

export const TOPIC_BY_ID: Readonly<Record<string, Topic>> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/** Research queue slots before any bonuses (DESIGN §2: queues start at 2-3 slots). */
export const RESEARCH_QUEUE_BASE = 2;

/** Research speed multiplier for working at each place. */
export const RESEARCH_STATIONS: Readonly<Record<string, { mult: number; label: string }>> = {
  ai_core: { mult: 8, label: 'the AI Core' },
  university: { mult: 5, label: 'the University' },
  library: { mult: 3, label: 'the Library' },
  scriptorium: { mult: 2, label: 'the Scriptorium' },
  storytellers_circle: { mult: 1.5, label: "Storyteller's Circle" },
  campfire: { mult: 1, label: 'the campfire' },
};
