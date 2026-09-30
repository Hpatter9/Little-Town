// Research by era (DESIGN §5, §15). Research costs no materials, only time. Numbers are starting points.

import { ERAS, type Era } from './eras';
import type { OriginId } from './origins';
import type { WorkAnim } from './terrain';

export type Branch = 'construction' | 'crafting' | 'agriculture' | 'military' | 'medicine' | 'logistics' | 'society' | 'occult' | 'heritage';

export const BRANCH_NAMES: Record<Branch, string> = {
  construction: 'Construction',
  crafting: 'Crafting',
  agriculture: 'Agriculture',
  military: 'Military',
  medicine: 'Medicine',
  logistics: 'Logistics',
  society: 'Society',
  occult: 'Occult',
  heritage: 'Heritage',
};

/** The parts of the town research can bend, beyond the ones below: the same levers an origin pulls (see
 *  sim/origin.ts). Each is a multiplier; for guard (the harm townsfolk take), lower is better. */
export type ResearchRule = 'build' | 'craft' | 'travellers' | 'prices' | 'fight' | 'guard' | 'day' | 'night';

/** Lasting effects of a finished topic. Only effects with something to act on yet are listed. */
export type Effect =
  | { type: 'gatherSpeed'; anim: WorkAnim; mult: number }
  | { type: 'researchSlots'; add: number }
  | { type: 'researchSpeed'; mult: number }
  | { type: 'carry'; add: number }
  | { type: 'storage'; mult: number }
  | { type: 'cropSpeed'; mult: number }
  /** Fields tire and take blight this much (a multiplier: lower is better). */
  | { type: 'soil'; mult: number }
  | { type: 'queueSlots'; add: number }
  | { type: 'rule'; rule: ResearchRule; mult: number }
  /** Crafted things come out this many grades finer. */
  | { type: 'quality'; add: number }
  /** The town's powers come back this much sooner (a multiplier on the wait), and their effects last this much longer. */
  | { type: 'powers'; recharge: number; lasts?: number }
  | { type: 'eraCapstone' };

export interface Topic {
  id: string;
  name: string;
  branch: Branch;
  /** The era it belongs to (hidden until the town reaches it). Neolithic when left out. */
  era?: Era;
  /** Hidden research (DESIGN §9): not shown or researchable until the town has discovered it. */
  hidden?: boolean;
  /** Heritage: only a town of this origin can study it (and only it sees it). */
  origin?: OriginId;
  /** A refinement: it only makes the town better at what it does (nothing new to build or make). A town waits until
   *  it's a few people strong before it studies these, so its first days go on shelter and food. */
  refinement?: boolean;
  /** Base seconds of research work (before era multiplier and researcher speed). */
  seconds: number;
  prereqs: string[];
  /** Also requires this many other finished topics (Elder's Council). */
  requiresCount?: number;
  /** What else it unlocks, for display. Buildings and items are listed automatically from their data. */
  unlocks: string;
  effects: Effect[];
}

function R(rule: ResearchRule, mult: number): Effect {
  return { type: 'rule', rule, mult };
}

/** A topic whose effects say what it unlocks. */
function T(id: string, name: string, branch: Branch, era: Era, seconds: number, prereqs: string[], effects: Effect[], origin?: OriginId): Topic {
  return { id, name, branch, ...(era === 'neolithic' ? {} : { era }), ...(origin ? { origin } : {}), refinement: true, seconds, prereqs, unlocks: describeEffects(effects), effects };
}

/** Where each of an origin's six heritage topics falls, and how long it takes; each needs the one before. */
const HERITAGE_STEPS: [Era, number][] = [
  ['neolithic', 240],
  ['neolithic', 300],
  ['medieval', 480],
  ['industrial', 480],
  ['modern', 540],
  ['space', 600],
];

function heritage(origin: OriginId, steps: [string, string, Effect[]][]): Topic[] {
  return steps.map(([id, name, effects], i) => T(id, name, 'heritage', HERITAGE_STEPS[i][0], HERITAGE_STEPS[i][1], i ? [steps[i - 1][0]] : [], effects, origin));
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
  { id: 'flax_growing', name: 'Flax Growing', branch: 'agriculture', seconds: 210, prereqs: ['early_agriculture', 'cordage'], unlocks: 'Fiber from fields', effects: [] },
  { id: 'market_gardens', name: 'Garden Crops', branch: 'agriculture', seconds: 210, prereqs: ['early_agriculture'], unlocks: 'Vegetables', effects: [] },
  { id: 'orcharding', name: 'Orcharding', branch: 'agriculture', seconds: 270, prereqs: ['early_agriculture', 'woodcutting'], unlocks: 'Fruit trees', effects: [] },
  { id: 'ard_plough', name: 'The Ard Plough', branch: 'agriculture', seconds: 240, prereqs: ['early_agriculture', 'woodcutting'], unlocks: 'Two garden plots ploughed into one open field', effects: [] },
  { id: 'domestication', name: 'Domestication', branch: 'agriculture', seconds: 240, prereqs: ['early_agriculture', 'cordage'], unlocks: 'Hens for eggs and goats for milk', effects: [] },
  { id: 'oral_tradition', name: 'Oral Tradition', branch: 'society', seconds: 180, prereqs: ['fire_keeping'], unlocks: '+1 research queue slot, +10% research speed', effects: [{ type: 'researchSlots', add: 1 }, { type: 'researchSpeed', mult: 1.1 }] },
  { id: 'barter', name: 'Barter', branch: 'logistics', seconds: 180, prereqs: ['fire_keeping'], unlocks: 'Travellers stop to buy and sell: coins', effects: [] },
  { id: 'hospitality', name: 'Hospitality', branch: 'society', seconds: 180, prereqs: ['barter'], unlocks: 'Travellers stop to eat and drink: coins', effects: [] },
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
  { id: 'crop_rotation', name: 'Crop Rotation', branch: 'agriculture', era: 'medieval', seconds: 360, prereqs: [], unlocks: 'Fields grow 30% faster, and tire and take blight half as much', effects: [{ type: 'cropSpeed', mult: 1.3 }, { type: 'soil', mult: 0.5 }] },
  { id: 'animal_husbandry', name: 'Animal Husbandry', branch: 'agriculture', era: 'medieval', seconds: 480, prereqs: ['carpentry', 'domestication'], unlocks: 'Horses for expeditions', effects: [] },
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

  // More of the craft of each era: steady gains in how the town works, fights and trades
  T('bone_tools', 'Bone Tools', 'crafting', 'neolithic', 180, ['flint_knapping'], [R('craft', 1.1)]),
  T('fish_traps', 'Fish Traps', 'agriculture', 'neolithic', 180, ['cordage'], [{ type: 'gatherSpeed', anim: 'forage', mult: 1.15 }]),
  T('seed_saving', 'Seed Saving', 'agriculture', 'neolithic', 210, ['early_agriculture'], [{ type: 'cropSpeed', mult: 1.1 }]),
  T('sling_stones', 'Sling Stones', 'military', 'neolithic', 180, ['cordage'], [R('fight', 1.05)]),
  T('trail_marking', 'Trail Marking', 'logistics', 'neolithic', 210, ['scouting'], [{ type: 'carry', add: 3 }]),
  T('storytelling', 'Storytelling', 'society', 'neolithic', 210, ['oral_tradition'], [{ type: 'researchSpeed', mult: 1.1 }]),

  T('masons_lodge', "Masons' Lodge", 'construction', 'medieval', 360, ['masonry'], [R('build', 1.1)]),
  T('apprenticeships', 'Apprenticeships', 'crafting', 'medieval', 420, ['guilds'], [R('craft', 1.1)]),
  T('windmills', 'Windmills', 'agriculture', 'medieval', 360, ['milling'], [{ type: 'cropSpeed', mult: 1.1 }]),
  T('siege_craft', 'Siege Craft', 'military', 'medieval', 420, ['fortification'], [R('guard', 0.92)]),
  T('cartography', 'Cartography', 'logistics', 'medieval', 360, ['writing'], [{ type: 'carry', add: 5 }]),
  T('market_charters', 'Market Charters', 'society', 'medieval', 420, ['trade'], [R('travellers', 1.15)]),

  T('prefabrication', 'Prefabrication', 'construction', 'industrial', 420, ['urban_housing'], [R('build', 1.15)]),
  T('machine_tools', 'Machine Tools', 'crafting', 'industrial', 420, ['steelmaking'], [R('craft', 1.15)]),
  T('fertilisers', 'Fertilisers', 'agriculture', 'industrial', 420, ['industrial_farming'], [{ type: 'cropSpeed', mult: 1.1 }, { type: 'soil', mult: 0.5 }]),
  T('drill_manuals', 'Drill Manuals', 'military', 'industrial', 420, ['firearms'], [R('fight', 1.1)]),
  T('banking', 'Banking', 'logistics', 'industrial', 480, ['assembly_lines'], [R('prices', 1.1)]),
  T('telegraph', 'Telegraph', 'society', 'industrial', 480, ['public_library'], [{ type: 'researchSpeed', mult: 1.1 }]),

  T('tower_cranes', 'Tower Cranes', 'construction', 'modern', 420, ['concrete'], [R('build', 1.15)]),
  T('automation', 'Automation', 'crafting', 'modern', 480, ['electronics'], [R('craft', 1.15)]),
  T('green_revolution', 'Green Revolution', 'agriculture', 'modern', 480, ['mechanized_farming'], [{ type: 'cropSpeed', mult: 1.1 }]),
  T('field_tactics', 'Field Tactics', 'military', 'modern', 480, ['rifles'], [R('guard', 0.9)]),
  T('tourism', 'Tourism', 'logistics', 'modern', 480, ['motor_transport'], [R('travellers', 1.2)]),
  T('computing', 'Computing', 'society', 'modern', 540, ['radio'], [{ type: 'researchSpeed', mult: 1.15 }]),

  T('self_assembly', 'Self-Assembly', 'construction', 'space', 480, ['robotics'], [R('build', 1.2)]),
  T('nanofabrication', 'Nanofabrication', 'crafting', 'space', 540, ['advanced_alloys'], [R('craft', 1.2), { type: 'quality', add: 0.5 }]),
  T('gene_crops', 'Gene-Tailored Crops', 'agriculture', 'space', 480, ['hydroponics'], [{ type: 'cropSpeed', mult: 1.2 }]),
  T('exosuits', 'Exosuits', 'military', 'space', 540, ['energy_weapons'], [R('fight', 1.1), R('guard', 0.9)]),
  T('orbital_trade', 'Orbital Trade', 'logistics', 'space', 540, ['drones'], [R('travellers', 1.2), R('prices', 1.1)]),
  T('quantum_computing', 'Quantum Computing', 'society', 'space', 600, ['artificial_intelligence'], [{ type: 'researchSpeed', mult: 1.2 }]),

  // Heritage: each origin's own line of study, one or two topics an era, each leading to the next
  ...heritage('settlers', [
    ['homesteading', 'Homesteading', [R('build', 1.1)]],
    ['village_fair', 'Village Fair', [R('travellers', 1.1)]],
    ['common_law', 'Common Law', [{ type: 'queueSlots', add: 1 }]],
    ['cooperatives', 'Cooperatives', [R('craft', 1.1), R('prices', 1.05)]],
    ['civil_defence', 'Civil Defence', [R('guard', 0.9)]],
    ['pioneer_spirit', 'Pioneer Spirit', [R('day', 1.1), { type: 'researchSpeed', mult: 1.1 }]],
  ]),
  ...heritage('lich', [
    ['bone_carving', 'Bone Carving', [R('craft', 1.1), { type: 'quality', add: 0.5 }]],
    ['death_whispers', 'Whispers of the Dead', [{ type: 'researchSpeed', mult: 1.1 }]],
    ['ossuary_rites', 'Ossuary Rites', [{ type: 'powers', recharge: 0.75 }]],
    ['embalming', 'Embalming Arts', [R('guard', 0.88)]],
    ['galvanic_reanimation', 'Galvanic Reanimation', [R('day', 1.1), R('night', 1.1)]],
    ['eternal_engine', 'The Eternal Engine', [{ type: 'powers', recharge: 0.75, lasts: 1.5 }]],
  ]),
  ...heritage('druid', [
    ['seed_lore', 'Seed Lore', [{ type: 'cropSpeed', mult: 1.15 }]],
    ['wild_speech', 'Wild Speech', [{ type: 'gatherSpeed', anim: 'forage', mult: 1.2 }]],
    ['sacred_groves', 'Sacred Groves', [{ type: 'powers', recharge: 0.8 }]],
    ['green_masonry', 'Green Masonry', [R('build', 1.12)]],
    ['living_walls', 'Living Walls', [R('guard', 0.9)]],
    ['gaia_mind', 'The Gaia Mind', [{ type: 'cropSpeed', mult: 1.3 }, { type: 'researchSpeed', mult: 1.1 }]],
  ]),
  ...heritage('vampire', [
    ['night_eyes', 'Night Eyes', [R('night', 1.1)]],
    ['thrall_bonds', 'Thrall Bonds', [R('day', 1.1)]],
    ['blood_alchemy', 'Blood Alchemy', [{ type: 'powers', recharge: 0.8 }]],
    ['velvet_salons', 'Velvet Salons', [R('prices', 1.15)]],
    ['eclipse_veils', 'Eclipse Veils', [R('day', 1.15)]],
    ['eternal_night', 'Eternal Night', [R('night', 1.15), R('fight', 1.1)]],
  ]),
  ...heritage('werewolf', [
    ['scent_tracking', 'Scent Tracking', [{ type: 'gatherSpeed', anim: 'forage', mult: 1.15 }]],
    ['pack_tactics', 'Pack Tactics', [R('fight', 1.1)]],
    ['moon_calendar', 'The Moon Calendar', [{ type: 'powers', recharge: 0.8 }]],
    ['iron_hide', 'Iron Hide', [R('guard', 0.9)]],
    ['feral_rage', 'Feral Rage', [R('fight', 1.1)]],
    ['lunar_engine', 'The Lunar Engine', [R('day', 1.1), R('night', 1.1)]],
  ]),
  ...heritage('robot', [
    ['salvage_protocols', 'Salvage Protocols', [R('build', 1.1)]],
    ['subroutines', 'Subroutines', [{ type: 'researchSpeed', mult: 1.1 }]],
    ['self_repair', 'Self-Repair', [R('guard', 0.9)]],
    ['swarm_logic', 'Swarm Logic', [{ type: 'queueSlots', add: 1 }]],
    ['neural_mesh', 'Neural Mesh', [{ type: 'researchSlots', add: 1 }, { type: 'researchSpeed', mult: 1.1 }]],
    ['singularity', 'The Singularity', [R('day', 1.15), R('night', 1.15), { type: 'powers', recharge: 0.75 }]],
  ]),
  ...heritage('dwarves', [
    ['deep_roads', 'Deep Roads', [{ type: 'gatherSpeed', anim: 'mine', mult: 1.25 }]],
    ['ancestor_runes', 'Ancestor Runes', [{ type: 'quality', add: 0.5 }]],
    ['forge_songs', 'Forge Songs', [R('craft', 1.15)]],
    ['steam_bores', 'Steam Bores', [{ type: 'gatherSpeed', anim: 'mine', mult: 1.25 }, R('build', 1.1)]],
    ['runic_steel', 'Runic Steel', [R('guard', 0.9), { type: 'quality', add: 0.5 }]],
    ['heart_of_the_mountain', 'Heart of the Mountain', [R('build', 1.15), { type: 'powers', recharge: 0.75 }]],
  ]),
  ...heritage('merfolk', [
    ['net_weaving', 'Net Weaving', [{ type: 'gatherSpeed', anim: 'forage', mult: 1.2 }]],
    ['tide_reading', 'Tide Reading', [R('travellers', 1.15)]],
    ['coral_masonry', 'Coral Masonry', [R('build', 1.1)]],
    ['storm_calling', 'Storm Calling', [{ type: 'powers', recharge: 0.8 }]],
    ['deep_trade', 'Deep Trade', [R('prices', 1.15)]],
    ['abyssal_cities', 'Abyssal Cities', [{ type: 'storage', mult: 1.3 }, R('travellers', 1.2)]],
  ]),
  ...heritage('nomads', [
    ['horse_lore', 'Horse Lore', [{ type: 'carry', add: 5 }]],
    ['songlines', 'Songlines', [{ type: 'researchSpeed', mult: 1.1 }]],
    ['caravanserai', 'Caravanserai', [R('travellers', 1.15), { type: 'powers', recharge: 0.85 }]],
    ['caravan_city', 'The Caravan City', [R('build', 1.15), { type: 'storage', mult: 1.2 }]],
    ['far_markets', 'Far Markets', [R('prices', 1.15)]],
    ['star_caravans', 'Star Caravans', [R('travellers', 1.2), { type: 'carry', add: 10 }]],
  ]),
  ...heritage('fae', [
    ['moonlit_revels', 'Moonlit Revels', [R('night', 1.1)]],
    ['glamour_weaving', 'Glamour Weaving', [R('prices', 1.1)]],
    ['cold_iron_wards', 'Cold Iron Wards', [R('craft', 1.15)]],
    ['fairy_rings', 'Fairy Rings', [{ type: 'powers', recharge: 0.8 }]],
    ['dream_trade', 'Dream Trade', [R('travellers', 1.2)]],
    ['otherworld_gate', 'The Otherworld Gate', [R('prices', 1.15), { type: 'powers', recharge: 0.8, lasts: 1.5 }]],
  ]),
  ...heritage('alchemists', [
    ['distillation', 'Distillation', [R('craft', 1.1)]],
    ['volatile_compounds', 'Volatile Compounds', [R('fight', 1.1)]],
    ['transmutation_theory', 'Transmutation Theory', [{ type: 'powers', recharge: 0.8 }]],
    ['catalysts', 'Catalysts', [R('build', 1.15)]],
    ['panacea', 'The Panacea', [R('guard', 0.9)]],
    ['magnum_opus', 'The Magnum Opus', [{ type: 'quality', add: 1 }, { type: 'researchSpeed', mult: 1.15 }]],
  ]),
  ...heritage('knights', [
    ['drill_yard', 'The Drill Yard', [R('fight', 1.1)]],
    ['heraldry', 'Heraldry', [R('travellers', 1.1)]],
    ['chivalry', 'Chivalry', [{ type: 'powers', recharge: 0.8 }, R('prices', 1.05)]],
    ['military_engineering', 'Military Engineering', [R('build', 1.1), R('craft', 1.1)]],
    ['combined_arms', 'Combined Arms', [R('guard', 0.9)]],
    ['star_knights', 'Star Knights', [R('fight', 1.15), R('guard', 0.9)]],
  ]),
];

/** What a finished topic's lasting effects do, in words. */
export function describeEffects(effects: readonly Effect[]): string {
  const pct = (m: number) => `${m >= 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`;
  const RULE_TEXT: Record<ResearchRule, string> = {
    build: 'building speed',
    craft: 'crafting speed',
    travellers: 'travellers',
    prices: 'what strangers pay',
    fight: 'fighting',
    guard: 'harm taken in raids',
    day: 'work by day',
    night: 'work by night',
  };
  const GATHER_TEXT: Record<WorkAnim, string> = { chop: 'woodcutting', mine: 'mining', forage: 'foraging' };
  return effects
    .map((e) => {
      switch (e.type) {
        case 'rule':
          return `${pct(e.mult)} ${RULE_TEXT[e.rule]}`;
        case 'quality':
          return `crafted things ${e.add >= 1 ? `${e.add} grade${e.add === 1 ? '' : 's'}` : 'a little'} finer`;
        case 'powers':
          return `powers return ${Math.round((1 - e.recharge) * 100)}% sooner${e.lasts ? ` and last ${Math.round((e.lasts - 1) * 100)}% longer` : ''}`;
        case 'gatherSpeed':
          return `${pct(e.mult)} ${GATHER_TEXT[e.anim]}`;
        case 'cropSpeed':
          return `fields grow ${pct(e.mult)} faster`;
        case 'soil':
          return `fields tire and take blight ${Math.round((1 - e.mult) * 100)}% less`;
        case 'researchSpeed':
          return `${pct(e.mult)} research speed`;
        case 'researchSlots':
          return `+${e.add} research queue slot`;
        case 'queueSlots':
          return `+${e.add} craft and build queue slot`;
        case 'carry':
          return `+${e.add} carry`;
        case 'storage':
          return `${pct(e.mult)} storage`;
        case 'eraCapstone':
          return '';
      }
    })
    .filter(Boolean)
    .join(', ')
    .replace(/^./, (c) => c.toUpperCase());
}

export const TOPIC_BY_ID: Readonly<Record<string, Topic>> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/** The era a thing belongs to, from the research that opens it (the latest of them): Neolithic with none. Work is
 *  stretched by the era of what's being made, not the town's: a lean-to is no harder to put up in the Medieval era. */
export function eraOfResearch(ids: readonly string[] | string | undefined): Era {
  const list = ids === undefined ? [] : typeof ids === 'string' ? [ids] : ids;
  let era: Era = 'neolithic';
  for (const id of list) {
    const e = TOPIC_BY_ID[id]?.era ?? 'neolithic';
    if (ERAS.indexOf(e) > ERAS.indexOf(era)) era = e;
  }
  return era;
}

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
