// Buildings by era (DESIGN §15 and on). Costs and times are starting points for tuning.

import type { Stock } from './materials';
import type { Era } from './eras';
import type { OriginId } from './origins';
import { SEAT_DEFS, SEAT_UPGRADES } from './seats';
import { DEFENSE_BUILDINGS, ORIGIN_DEFENSES } from './defenses';
import { BLOOD_FARM } from './vampires';
import { WORKSHOP_BUILDINGS } from './workshops';
import { RECREATION_BUILDINGS } from './recreation';
import { PRISON_BUILDINGS, PRISON_UPGRADES } from './prisons';
import { FAITH_BUILDINGS, FAITH_UPGRADES } from './gods';
import { BOATYARD } from './boats';
import { MINERAL_BUILDINGS } from './minerals';
import { MONSTER_GUILD } from './hunts';
import { STORE_BUILDINGS, type ShopLine } from './stores';

export type BuildLayer = 'fore' | 'mid' | 'back';
export type Venue = 'shop' | 'tavern';

export interface BuildingDef {
  id: string;
  name: string;
  layer: BuildLayer;
  /** Its footprint on the land: this many cells wide, and `depth` deep (worked out from the width when left out:
   *  sim/buildings.ts depthOf). */
  width: number;
  depth?: number;
  cost: Stock;
  /** Base seconds of construction work (before era multiplier and worker speed). */
  buildSeconds: number;
  purpose: string;
  /** Stands at the water's edge: a cell of water or shallows beside its footprint (the boatyard). */
  shore?: boolean;
  /** Stands in the water only (the ring wall's grates over a river: sim/ringWall.ts): every cell of its footprint wet,
   *  so the water runs through and nobody does. */
  onWater?: boolean;
  /** Placed only by the sim itself (a nomad tribe's wagon circle): never planned, placed or shown to build. */
  never?: boolean;
  /** Research topic that unlocks it (none = available from the start). */
  research?: string;
  /** Units of materials it can store. */
  storage?: number;
  /** Beds it provides. */
  housing?: number;
  /** Walls and gates: health, and they stop raiders until broken. */
  hp?: number;
  /** Morale for everyone while it stands (the strongest such building counts), and its reason text. */
  morale?: [number, string];
  /** Raid warning, in game minutes, while it stands (the longest counts). */
  warningMinutes?: number;
  /** Extra chance per hour of a wanderer turning up. */
  arrivals?: number;
  /** Healing in town goes this much faster. */
  healing?: number;
  /** A prison's cells, and how readily prisoners get away from it (1 as from a stockade; data/prisons.ts). */
  cells?: number;
  escape?: number;
  /** Horses it can keep. */
  stalls?: number;
  /** Venues (see data/shop.ts): a shop or a tavern, the size of the one room it starts with, in cells (more rooms are
   *  bought with coins), and the appeal (a shop) or comfort (a tavern) it has bare: none, as they all start bare. */
  /** A venue's floor; a specialty shop's `line` is what it sells (data/stores.ts). */
  floor?: { venue: Venue; line?: ShopLine; cols: number; rows: number; appeal: number };
  /** Traps and turrets: they hit the nearest raider in range (px from the building's centre) every interval seconds,
   *  with the quirks of data/defenses.ts (splash px, slow share, burn a second, chain count, night multiplier, rout chance). */
  defense?: { damage: [number, number]; range: number; interval: number; accuracy: number; splash?: number; slow?: number; burn?: number; chain?: number; night?: number; rout?: number };
  /** Opens only once the town has reached this era (beside any research). */
  era?: Era;
  /** One origin's own (data/seats.ts): another people never build it. */
  origin?: OriginId;
  /** A seat of the town (data/seats.ts), and which of its five stages. */
  seat?: number;
}

const BASE_BUILDINGS: readonly BuildingDef[] = [
  { id: 'campfire', name: 'Campfire', layer: 'fore', width: 2, cost: { wood: 4, stone: 3 }, buildSeconds: 20, purpose: 'Cooking, warmth and morale. Doubles as a small camp cache.', storage: 30 },
  { id: 'stockpile', name: 'Stockpile', layer: 'fore', width: 3, cost: { wood: 6 }, buildSeconds: 20, purpose: 'Stores materials. Put them near the work to cut hauling.', storage: 100 },
  { id: 'lean_to', name: 'Lean-to', layer: 'mid', width: 2, cost: { wood: 8, fiber: 4 }, buildSeconds: 30, purpose: 'Houses 1.', research: 'basic_shelter', housing: 1 },
  { id: 'hide_tent', name: 'Hide Tent', layer: 'mid', width: 3, cost: { wood: 6, hide: 6, fiber: 4 }, buildSeconds: 60, purpose: 'Houses 2.', research: 'tanning', housing: 2 },
  { id: 'longhouse', name: 'Longhouse', layer: 'mid', width: 4, cost: { wood: 24, stone: 6 }, buildSeconds: 90, purpose: 'Houses 3. A long timber hall under one thatched roof, where two lean-tos stood.', research: 'oral_tradition', housing: 3 },
  { id: 'workbench', name: 'Workbench', layer: 'mid', width: 2, cost: { wood: 10, stone: 4 }, buildSeconds: 45, purpose: 'Crafts tools and weapons.', research: 'flint_knapping' },
  { id: 'drying_rack', name: 'Drying Rack', layer: 'mid', width: 1, cost: { wood: 5, fiber: 3 }, buildSeconds: 25, purpose: 'Preserves food.', research: 'food_preservation' },
  { id: 'tanning_rack', name: 'Tanning Rack', layer: 'mid', width: 2, cost: { wood: 6, fiber: 2, stone: 2 }, buildSeconds: 40, purpose: 'Processes hides.', research: 'tanning' },
  { id: 'kiln', name: 'Kiln', layer: 'mid', width: 2, cost: { stone: 12, clay: 8 }, buildSeconds: 90, purpose: 'Fires pottery.', research: 'pottery' },
  { id: 'hunters_lodge', name: "Hunter's Lodge", layer: 'mid', width: 3, cost: { wood: 16, hide: 4, bone: 4 }, buildSeconds: 120, purpose: 'Hunts bring back game 40% faster.', research: 'spear_hunting' },
  { id: 'storytellers_circle', name: "Storyteller's Circle", layer: 'mid', width: 3, cost: { stone: 10, wood: 6 }, buildSeconds: 90, purpose: 'Research workstation (tier 1) and morale.', research: 'oral_tradition' },
  { id: 'herb_garden', name: 'Herb Garden', layer: 'back', width: 3, cost: { wood: 4, fiber: 4, herbs: 3 }, buildSeconds: 45, purpose: 'Grows herbs: sown and harvested by farmers. Nothing grows in winter.', research: 'herbalism' },
  { id: 'garden_plot', name: 'Garden Plot', layer: 'back', width: 4, cost: { wood: 6, fiber: 4 }, buildSeconds: 60, purpose: 'Grows wild grain (food): sown and harvested by farmers. Nothing grows in winter.', research: 'early_agriculture' },
  { id: 'flax_field', name: 'Flax Field', layer: 'back', width: 3, cost: { wood: 4, fiber: 2 }, buildSeconds: 45, purpose: 'Grows flax for fiber: sown and harvested by farmers. Nothing grows in winter.', research: 'flax_growing' },
  { id: 'chicken_coop', name: 'Chicken Coop', layer: 'back', width: 2, cost: { wood: 8, fiber: 4 }, buildSeconds: 40, purpose: 'Hens (bought in, 3 to start; the pen is fenced wider as the herd grows): eggs every few hours. They breed in spring and summer and need grain in winter.', research: 'domestication' },
  { id: 'goat_pen', name: 'Goat Pen', layer: 'back', width: 3, cost: { wood: 12, fiber: 4 }, buildSeconds: 50, purpose: 'Goats (bought in, 2 to start; the pen is fenced wider as the herd grows): milk twice a day, and meat and hide when the pen is full.', research: 'domestication' },
  { id: 'healers_hut', name: "Healer's Hut", layer: 'mid', width: 2, cost: { wood: 12, hide: 4, herbs: 6 }, buildSeconds: 90, purpose: 'Herbs and a fire for the hurt: wounds heal half again as fast, and the downed take longer to bleed out.', research: 'herbalism', healing: 1.5 },
  { id: 'graveyard', name: 'Graveyard', layer: 'mid', width: 3, cost: { wood: 10, stone: 8 }, buildSeconds: 60, purpose: 'The dead are laid to rest here: mourning weighs less and grief passes sooner. (A Necromancer may find other uses for it.)' },
  { id: 'well', name: 'Well', layer: 'mid', width: 1, cost: { stone: 12, wood: 4 }, buildSeconds: 60, purpose: 'Fields keep growing (slower) through a drought.', research: 'early_agriculture' },
  // (never built: a nomad tribe's wagons drawn up across the ends of the camp while raiders are about, see nomads.ts)
  { id: 'wagon_circle', name: 'Wagon Circle', layer: 'fore', width: 1, cost: {}, buildSeconds: 1, purpose: 'Wagons drawn up across the camp while raiders are about.', never: true, hp: 110 },
  { id: 'palisade_wall', name: 'Palisade Wall', layer: 'fore', width: 1, cost: { wood: 8 }, buildSeconds: 40, purpose: 'Stops raiders until they break it. Townsfolk can pass. Best at the town edges.', research: 'palisades', hp: 150 },
  { id: 'palisade_gate', name: 'Palisade Gate', layer: 'fore', width: 2, cost: { wood: 14, fiber: 4 }, buildSeconds: 70, purpose: 'Like a wall, but weaker. Townsfolk come and go through it.', research: 'palisades', hp: 120 },
  { id: 'palisade_grate', name: 'Palisade Grate', layer: 'fore', width: 1, cost: { wood: 10 }, buildSeconds: 50, purpose: 'The palisade carried over a stream on a grating of stakes: the water runs through, nobody does.', research: 'palisades', hp: 130, onWater: true },
  { id: 'lookout', name: 'Lookout Platform', layer: 'mid', width: 2, cost: { wood: 14, fiber: 6 }, buildSeconds: 90, purpose: 'Spots raiders early: an hour of warning instead of minutes.', research: 'lookout', warningMinutes: 60 },
  { id: 'spike_trap', name: 'Spike Pit', layer: 'fore', width: 1, cost: { wood: 6, flint: 2 }, buildSeconds: 40, purpose: 'Hurts raiders who cross it.', research: 'palisades', defense: { damage: [6, 12], range: 16, interval: 5, accuracy: 0.8 } },
  { id: 'trading_post', name: 'Trading Post', layer: 'mid', width: 3, cost: { wood: 12, stone: 8 }, buildSeconds: 90, purpose: 'A shop: travellers stop to buy the town\'s goods for coins, and sell it what it lacks. It starts as one bare room with a counter: every shelf and table, and every room more, is bought with coins, and a better-furnished shop sells more.', research: 'barter', floor: { venue: 'shop', cols: 8, rows: 5, appeal: 0 } },
  { id: 'fireside_inn', name: 'Fireside Inn', layer: 'mid', width: 3, cost: { wood: 14, stone: 6 }, buildSeconds: 100, purpose: 'Travellers stop for a meal and a drink, and pay in coins. It starts as one bare room with a bar: every table and hearth, and every room more, is bought with coins. The more comfortable it is, the better-off the guests.', research: 'hospitality', floor: { venue: 'tavern', cols: 9, rows: 6, appeal: 0 } },
  { id: 'elder_lodge', name: 'Elder Lodge', layer: 'mid', width: 5, cost: { wood: 40, stone: 30, hide: 10, totem: 1 }, buildSeconds: 300, purpose: 'Era capstone: opens the Medieval era. Needs the totem from the Bear Cave.', research: 'elders_council', morale: [4, 'The elders keep the peace'] },

  // Medieval
  { id: 'mine', name: 'Mine', layer: 'mid', width: 3, cost: { wood: 20, stone: 10 }, buildSeconds: 120, purpose: 'Gatherers dig iron ore and stone here, without end.', research: 'mining' },
  { id: 'bloomery', name: 'Bloomery', layer: 'mid', width: 2, cost: { stone: 16, clay: 8 }, buildSeconds: 100, purpose: 'Smelts iron ore into iron.', research: 'iron_working' },
  { id: 'smithy', name: 'Smithy', layer: 'mid', width: 3, cost: { stone: 12, wood: 10, iron: 4 }, buildSeconds: 140, purpose: 'Forges iron tools, weapons and armour.', research: 'iron_working' },
  { id: 'sawmill', name: 'Sawmill', layer: 'mid', width: 3, cost: { wood: 20, stone: 6 }, buildSeconds: 100, purpose: 'Saws wood into lumber.', research: 'carpentry' },
  { id: 'tannery', name: 'Tannery', layer: 'mid', width: 3, cost: { wood: 16, stone: 8 }, buildSeconds: 100, purpose: 'Cures hides into leather.', research: 'leatherworking' },
  { id: 'loom', name: 'Loom', layer: 'mid', width: 2, cost: { wood: 12, fiber: 6 }, buildSeconds: 80, purpose: 'Weaves fiber into cloth.', research: 'weaving' },
  { id: 'windmill', name: 'Windmill', layer: 'back', width: 3, cost: { lumber: 16, stone: 12, cloth: 4 }, buildSeconds: 160, purpose: 'Grinds grain into flour.', research: 'milling' },
  { id: 'bakery', name: 'Bakery', layer: 'mid', width: 3, cost: { bricks: 12, lumber: 8 }, buildSeconds: 140, purpose: 'Bakes flour into bread.', research: 'baking' },
  { id: 'cottage', name: 'Cottage', layer: 'mid', width: 3, cost: { lumber: 14, stone: 8, cloth: 2 }, buildSeconds: 150, purpose: 'Houses 4.', research: 'carpentry', housing: 4 },
  { id: 'stone_wall', name: 'Stone Wall', layer: 'fore', width: 1, cost: { stone: 18, bricks: 4 }, buildSeconds: 120, purpose: 'Much tougher than a palisade.', research: 'fortification', hp: 420 },
  { id: 'stone_gate', name: 'Stone Gate', layer: 'fore', width: 2, cost: { stone: 20, lumber: 8, iron: 2 }, buildSeconds: 150, purpose: 'A strong gate townsfolk pass through.', research: 'fortification', hp: 340 },
  { id: 'stone_grate', name: 'Stone Grate', layer: 'fore', width: 1, cost: { stone: 16, iron: 2 }, buildSeconds: 130, purpose: 'An iron grating in the stone wall where the river runs under it.', research: 'fortification', hp: 360, onWater: true },
  { id: 'watchtower', name: 'Watchtower', layer: 'mid', width: 2, cost: { stone: 20, lumber: 10 }, buildSeconds: 160, purpose: 'Two hours of raid warning.', research: 'fortification', warningMinutes: 120 },
  { id: 'guard_tower', name: 'Archer Tower', layer: 'mid', width: 1, cost: { stone: 16, lumber: 8 }, buildSeconds: 150, purpose: 'Shoots arrows at raiders in range.', research: 'archery', defense: { damage: [5, 9], range: 150, interval: 2.5, accuracy: 0.65 } },
  { id: 'barracks', name: 'Barracks', layer: 'mid', width: 4, cost: { stone: 20, lumber: 16, iron: 4 }, buildSeconds: 200, purpose: 'Guards (Defend on High) drill here and take day and night patrol shifts: they fight better, and patrols spot raiders half an hour sooner.', research: 'fortification', morale: [3, 'Guards on watch'] },
  { id: 'trophy_hall', name: 'Trophy Hall', layer: 'mid', width: 4, cost: { stone: 20, lumber: 10, cloth: 4 }, buildSeconds: 240, purpose: "Shows off the town's boss trophies and unique weapons: each one makes the shop and the tavern better known, and draws travellers.", research: 'writing' },
  { id: 'scriptorium', name: 'Scriptorium', layer: 'mid', width: 4, cost: { bricks: 16, lumber: 12, cloth: 4 }, buildSeconds: 200, purpose: 'Research workstation (tier 2): research twice as fast.', research: 'writing' },
  { id: 'tavern', name: 'Tavern', layer: 'mid', width: 5, cost: { lumber: 24, bricks: 16, cloth: 6 }, buildSeconds: 240, purpose: 'Morale, and draws more wanderers. Travellers stop for food and drink, and pay in coins; the more comfortable it is, the better-off the guests.', research: 'brewing', morale: [8, 'A drink at the tavern'], arrivals: 0.08, floor: { venue: 'tavern', cols: 13, rows: 7, appeal: 0 } },
  { id: 'infirmary', name: 'Infirmary', layer: 'mid', width: 4, cost: { lumber: 16, bricks: 10, cloth: 6 }, buildSeconds: 180, purpose: 'Wounds heal twice as fast.', research: 'physick', healing: 2 },
  { id: 'open_field', name: 'Open Field', layer: 'back', width: 8, cost: { wood: 10, fiber: 4 }, buildSeconds: 80, purpose: 'Grain (food) on a big ploughed field: more than two garden plots give, for the same work. The town ploughs two plots side by side into one.', research: 'ard_plough' },
  { id: 'estate_farm', name: 'Estate Farm', layer: 'back', width: 8, cost: { lumber: 12, stone: 6 }, buildSeconds: 150, purpose: 'Grain (food) from a farm run in rotation, with a barn: a bigger harvest than an open field, quicker to work.', research: 'crop_rotation' },
  { id: 'vegetable_patch', name: 'Vegetable Patch', layer: 'back', width: 3, cost: { wood: 6, stone: 2 }, buildSeconds: 50, purpose: 'Grows vegetables (food): hardy, they grow on through the autumn at full speed.', research: 'market_gardens' },
  { id: 'orchard', name: 'Orchard', layer: 'back', width: 5, cost: { wood: 14, fiber: 4 }, buildSeconds: 90, purpose: 'Fruit trees (food): slow to come into bearing, then they fruit again and again without sowing, and never tire the soil.', research: 'orcharding' },
  { id: 'pig_sty', name: 'Pig Sty', layer: 'back', width: 3, cost: { wood: 10, stone: 6 }, buildSeconds: 60, purpose: 'Pigs (bought in, 2 to start; the pen is fenced wider as the herd grows): they breed fast and are kept for meat, hide and bone.', research: 'animal_husbandry' },
  { id: 'sheep_fold', name: 'Sheep Fold', layer: 'back', width: 4, cost: { lumber: 12, stone: 6 }, buildSeconds: 90, purpose: 'Sheep (bought in, 3 to start; the pen is fenced wider as the herd grows): wool once a day, woven into cloth at the loom.', research: 'animal_husbandry' },
  { id: 'cattle_pasture', name: 'Cattle Pasture', layer: 'back', width: 5, cost: { lumber: 16, fiber: 8 }, buildSeconds: 120, purpose: 'Cattle (bought in, 2 to start; the pen is fenced wider as the herd grows): plenty of milk, and a great deal of meat and hide. Slow to breed; hungry in winter.', research: 'animal_husbandry' },
  { id: 'stable', name: 'Stable', layer: 'mid', width: 4, cost: { lumber: 20, stone: 6, fiber: 10 }, buildSeconds: 180, purpose: 'Keeps up to 4 horses. Buy them from caravans.', research: 'animal_husbandry', stalls: 4 },
  { id: 'school', name: 'School', layer: 'mid', width: 4, cost: { lumber: 16, bricks: 8, cloth: 2 }, buildSeconds: 180, purpose: 'Children grow up with better skills.', research: 'schooling' },
  { id: 'general_store', name: 'General Store', layer: 'mid', width: 4, cost: { lumber: 16, stone: 8, cloth: 2 }, buildSeconds: 180, purpose: 'A bigger shop, with room for more furnishings: more travellers stop, and they spend more.', research: 'carpentry', floor: { venue: 'shop', cols: 11, rows: 6, appeal: 0 } },
  { id: 'market', name: 'Market Stall', layer: 'fore', width: 3, cost: { lumber: 12, cloth: 6 }, buildSeconds: 120, purpose: 'Trade caravans stop here.', research: 'trade' },
  { id: 'resurrection_shrine', name: 'Resurrection Shrine', layer: 'mid', width: 2, cost: { stone: 30, bricks: 10, iron: 4, cloth: 4 }, buildSeconds: 400, purpose: 'If the founder dies, they come back. Works once.', research: 'resurrection_rites' },
  // Industrial
  { id: 'coal_mine', name: 'Coal Mine', layer: 'mid', width: 3, cost: { lumber: 20, stone: 20, iron: 4 }, buildSeconds: 150, purpose: 'Gatherers dig coal here, without end.', research: 'coal_mining' },
  { id: 'steelworks', name: 'Steelworks', layer: 'mid', width: 4, cost: { bricks: 30, iron: 10 }, buildSeconds: 240, purpose: 'Makes steel from iron and coal.', research: 'steelmaking' },
  { id: 'glassworks', name: 'Glassworks', layer: 'mid', width: 3, cost: { bricks: 20, iron: 4 }, buildSeconds: 180, purpose: 'Makes glass from stone and coal.', research: 'glassblowing' },
  { id: 'factory', name: 'Factory', layer: 'mid', width: 6, cost: { bricks: 40, steel: 10, glass: 6 }, buildSeconds: 360, purpose: 'Steam-driven: everything crafted here and at other stations goes twice as fast.', research: 'steam_power' },
  { id: 'gunsmith', name: 'Gunsmith', layer: 'mid', width: 3, cost: { bricks: 16, steel: 6, lumber: 8 }, buildSeconds: 200, purpose: 'Makes muskets and shot.', research: 'firearms' },
  { id: 'gun_nest', name: 'Gun Nest', layer: 'fore', width: 1, cost: { bricks: 16, steel: 6 }, buildSeconds: 180, purpose: 'A sandbagged gun that fires on raiders in range.', research: 'firearms', defense: { damage: [9, 14], range: 170, interval: 1.6, accuracy: 0.65 } },
  { id: 'emporium', name: 'Emporium', layer: 'mid', width: 5, cost: { bricks: 24, glass: 8, lumber: 10 }, buildSeconds: 300, purpose: 'A grand shop with glass windows and room for a lot of furnishings.', research: 'glassblowing', floor: { venue: 'shop', cols: 14, rows: 7, appeal: 0 } },
  { id: 'rowhouse', name: 'Row Houses', layer: 'mid', width: 4, cost: { bricks: 30, lumber: 12, glass: 4 }, buildSeconds: 300, purpose: 'Houses 6.', research: 'urban_housing', housing: 6 },
  { id: 'hospital', name: 'Hospital', layer: 'mid', width: 5, cost: { bricks: 30, steel: 4, glass: 6, cloth: 10 }, buildSeconds: 360, purpose: 'Wounds heal three times as fast.', research: 'sanitation', healing: 3 },
  { id: 'library', name: 'Library', layer: 'mid', width: 4, cost: { bricks: 24, glass: 8, lumber: 12 }, buildSeconds: 300, purpose: 'Research workstation (tier 3): research three times as fast.', research: 'public_library' },
  { id: 'brick_wall', name: 'Brick Wall', layer: 'fore', width: 1, cost: { bricks: 20, steel: 2 }, buildSeconds: 150, purpose: 'The toughest wall yet.', research: 'urban_housing', hp: 800 },
  { id: 'power_station', name: 'Power Station', layer: 'mid', width: 6, cost: { bricks: 60, steel: 30, glass: 10, coal: 40 }, buildSeconds: 3000, purpose: 'Era capstone: electric light for the town opens the Modern era.', research: 'electricity', morale: [8, 'Lights in every window'] },
  // Modern
  { id: 'oil_derrick', name: 'Oil Derrick', layer: 'mid', width: 2, cost: { steel: 12, lumber: 10 }, buildSeconds: 180, purpose: 'Gatherers pump crude oil here, without end.', research: 'oil_drilling' },
  { id: 'refinery', name: 'Refinery', layer: 'mid', width: 4, cost: { steel: 20, bricks: 20, glass: 4 }, buildSeconds: 300, purpose: 'Refines crude oil into fuel and plastic.', research: 'refining' },
  { id: 'cement_works', name: 'Cement Works', layer: 'mid', width: 3, cost: { bricks: 20, steel: 6 }, buildSeconds: 220, purpose: 'Makes concrete from stone and coal.', research: 'concrete' },
  { id: 'electronics_plant', name: 'Electronics Plant', layer: 'mid', width: 4, cost: { concrete: 20, steel: 10, glass: 10 }, buildSeconds: 320, purpose: 'Makes electronics and power tools.', research: 'electronics' },
  { id: 'garage', name: 'Garage', layer: 'mid', width: 4, cost: { concrete: 16, steel: 12 }, buildSeconds: 260, purpose: 'Builds trucks. A truck carries a lot and gets an expedition there and back far faster, on fuel.', research: 'motor_transport' },
  { id: 'apartments', name: 'Apartment Block', layer: 'mid', width: 4, cost: { concrete: 30, steel: 10, glass: 10 }, buildSeconds: 360, purpose: 'Houses 10.', research: 'modern_housing', housing: 10 },
  { id: 'trauma_center', name: 'Trauma Center', layer: 'mid', width: 5, cost: { concrete: 30, electronics: 6, plastic: 8, cloth: 10 }, buildSeconds: 400, purpose: 'Wounds heal four times as fast.', research: 'trauma_surgery', healing: 4 },
  { id: 'radio_tower', name: 'Radio Tower', layer: 'mid', width: 1, cost: { steel: 12, electronics: 4 }, buildSeconds: 240, purpose: 'Four hours of raid warning, and news of the town draws newcomers.', research: 'radio', warningMinutes: 240, arrivals: 0.05 },
  { id: 'cinema', name: 'Cinema', layer: 'mid', width: 4, cost: { concrete: 20, electronics: 4, plastic: 6 }, buildSeconds: 300, purpose: 'Morale: a night at the pictures.', research: 'radio', morale: [10, 'A night at the pictures'] },
  { id: 'university', name: 'University', layer: 'mid', width: 6, cost: { concrete: 40, glass: 16, electronics: 6 }, buildSeconds: 480, purpose: 'Research workstation (tier 4): research five times as fast.', research: 'higher_education' },
  { id: 'gun_turret', name: 'Gun Turret', layer: 'fore', width: 1, cost: { concrete: 12, steel: 8, electronics: 2 }, buildSeconds: 220, purpose: 'An automatic gun that fires on raiders in range.', research: 'rifles', defense: { damage: [14, 20], range: 190, interval: 1.2, accuracy: 0.7 } },
  { id: 'concrete_wall', name: 'Concrete Wall', layer: 'fore', width: 1, cost: { concrete: 24, steel: 4 }, buildSeconds: 180, purpose: 'Hard to break even with guns.', research: 'concrete', hp: 1600 },
  { id: 'cryo_pod', name: 'Cryo Pod', layer: 'mid', width: 1, cost: { steel: 8, electronics: 6, glass: 4 }, buildSeconds: 300, purpose: 'If the founder dies, they are frozen and revived, frailer each time (at most once every 3 days).', research: 'cryonics' },
  { id: 'mission_control', name: 'Mission Control', layer: 'mid', width: 6, cost: { concrete: 60, electronics: 20, glass: 20, steel: 20 }, buildSeconds: 3000, purpose: 'Era capstone: opens the Robotic & Space era.', research: 'space_program', morale: [10, 'Eyes on the stars'] },
  // Robotic & Space
  { id: 'deep_mine', name: 'Deep Mine', layer: 'mid', width: 3, cost: { concrete: 20, steel: 12, electronics: 4 }, buildSeconds: 240, purpose: 'Gatherers dig rare minerals here, without end.', research: 'deep_mining' },
  { id: 'alloy_foundry', name: 'Alloy Foundry', layer: 'mid', width: 4, cost: { concrete: 24, steel: 16 }, buildSeconds: 300, purpose: 'Makes alloys from steel and rare minerals.', research: 'advanced_alloys' },
  { id: 'chip_fab', name: 'Chip Fab', layer: 'mid', width: 4, cost: { concrete: 20, glass: 16, electronics: 8 }, buildSeconds: 320, purpose: 'Makes circuits, and the gear built with them.', research: 'microchips' },
  { id: 'battery_plant', name: 'Battery Plant', layer: 'mid', width: 3, cost: { concrete: 16, alloys: 4, plastic: 8 }, buildSeconds: 280, purpose: 'Makes power cells.', research: 'power_storage' },
  { id: 'robot_workshop', name: 'Robot Workshop', layer: 'mid', width: 4, cost: { concrete: 20, alloys: 8, circuits: 4 }, buildSeconds: 320, purpose: 'Builds worker bots and drones.', research: 'robotics' },
  { id: 'drone_hub', name: 'Drone Hub', layer: 'mid', width: 2, cost: { alloys: 6, circuits: 4, concrete: 10 }, buildSeconds: 240, purpose: 'Drones scout for trouble: six hours of raid warning.', research: 'drones', warningMinutes: 360 },
  { id: 'habitat_dome', name: 'Habitat Dome', layer: 'mid', width: 5, cost: { alloys: 16, glass: 24, concrete: 20 }, buildSeconds: 400, purpose: 'Houses 16.', research: 'habitats', housing: 16, morale: [8, 'Life under the dome'] },
  { id: 'hydroponics_bay', name: 'Hydroponics Bay', layer: 'back', width: 4, cost: { alloys: 6, glass: 12, power_cells: 4 }, buildSeconds: 300, purpose: 'Grows grain under lamps: sown and harvested by farmers, even in winter.', research: 'hydroponics' },
  { id: 'fusion_reactor', name: 'Fusion Reactor', layer: 'mid', width: 5, cost: { alloys: 20, circuits: 8, concrete: 30 }, buildSeconds: 480, purpose: 'Power to spare: crafting everywhere goes 50% faster.', research: 'fusion' },
  { id: 'shield_generator', name: 'Shield Generator', layer: 'mid', width: 2, cost: { alloys: 12, circuits: 6, power_cells: 10 }, buildSeconds: 360, purpose: 'A dome of force: raiders can\'t set fires, and meteors burn up before they land.', research: 'energy_shields' },
  { id: 'clone_vat', name: 'Clone Vat', layer: 'mid', width: 2, cost: { alloys: 10, circuits: 6, glass: 8 }, buildSeconds: 400, purpose: 'If the founder dies, a clone wakes with their memories, though some skill is lost (at most once every 2 days).', research: 'cloning' },
  { id: 'ai_core', name: 'AI Core', layer: 'mid', width: 3, cost: { circuits: 16, alloys: 8, power_cells: 8 }, buildSeconds: 480, purpose: 'Research workstation (tier 5): research eight times as fast.', research: 'artificial_intelligence' },
  { id: 'laser_turret', name: 'Laser Turret', layer: 'fore', width: 1, cost: { alloys: 6, circuits: 3, power_cells: 6 }, buildSeconds: 260, purpose: 'Burns raiders in range, and rarely misses.', research: 'energy_weapons', defense: { damage: [22, 32], range: 230, interval: 1.0, accuracy: 0.85 } },
  { id: 'force_wall', name: 'Force Wall', layer: 'fore', width: 1, cost: { alloys: 10, power_cells: 6 }, buildSeconds: 200, purpose: 'The strongest wall there is.', research: 'energy_shields', hp: 3000 },
  { id: 'brick_gate', name: 'Brick Gate', layer: 'fore', width: 2, cost: { bricks: 24, steel: 4, lumber: 6 }, buildSeconds: 170, purpose: 'The gate in a brick ring wall: townsfolk pass through it.', research: 'urban_housing', hp: 650 },
  { id: 'concrete_gate', name: 'Concrete Gate', layer: 'fore', width: 2, cost: { concrete: 28, steel: 8 }, buildSeconds: 200, purpose: 'A steel-barred gate in a concrete wall.', research: 'concrete', hp: 1300 },
  { id: 'force_gate', name: 'Force Gate', layer: 'fore', width: 2, cost: { alloys: 12, power_cells: 8 }, buildSeconds: 220, purpose: 'A gap in the force wall that opens for the town\'s own.', research: 'energy_shields', hp: 2400 },
  { id: 'brick_grate', name: 'Brick Grate', layer: 'fore', width: 1, cost: { bricks: 18, steel: 3 }, buildSeconds: 160, purpose: 'A steel grating in the brick wall where the river runs under it.', research: 'urban_housing', hp: 700, onWater: true },
  { id: 'concrete_grate', name: 'Concrete Grate', layer: 'fore', width: 1, cost: { concrete: 22, steel: 6 }, buildSeconds: 190, purpose: 'A steel sluice grating in the concrete wall where the river runs under it.', research: 'concrete', hp: 1400, onWater: true },
  { id: 'force_grate', name: 'Force Grate', layer: 'fore', width: 1, cost: { alloys: 10, power_cells: 7 }, buildSeconds: 210, purpose: 'The force wall carried over the water: the river runs through it, nothing else does.', research: 'energy_shields', hp: 2600, onWater: true },
  { id: 'launch_site', name: 'Launch Site', layer: 'mid', width: 8, cost: { alloys: 120, circuits: 60, power_cells: 80, fuel: 150, concrete: 100 }, buildSeconds: 30000, purpose: 'Build the ship, and the town leaves for the stars. The end of the game (a win).', research: 'starship_design' },
  { id: 'phylactery', name: 'Phylactery', layer: 'mid', width: 1, cost: { bone: 12, iron: 6, herbs: 6, cloth: 2 }, buildSeconds: 300, purpose: 'The founder becomes a lich and always returns here after death. If it burns, the next death is final.', research: 'lichcraft' },
  { id: 'town_hall', name: 'Town Hall', layer: 'mid', width: 6, cost: { bricks: 40, lumber: 30, iron: 10, cloth: 10 }, buildSeconds: 3000, purpose: 'Era capstone: the seat of the town opens the Industrial era.', research: 'town_charter', morale: [6, 'A proper town'] },
];

export const BUILDINGS: readonly BuildingDef[] = [...BASE_BUILDINGS, ...DEFENSE_BUILDINGS, ...ORIGIN_DEFENSES, ...SEAT_DEFS, BLOOD_FARM, ...WORKSHOP_BUILDINGS, ...MINERAL_BUILDINGS, ...STORE_BUILDINGS, BOATYARD, MONSTER_GUILD, ...PRISON_BUILDINGS, ...FAITH_BUILDINGS, ...RECREATION_BUILDINGS];
export const BUILDING_BY_ID: Readonly<Record<string, BuildingDef>> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export const LAYER_NAMES: Record<BuildLayer, string> = { fore: 'Foreground (walkway)', mid: 'Midground', back: 'Background (fields)' };

/** Upgrades in place (DESIGN §4): what each building can be rebuilt into where it stands (it may grow wider). */
export const UPGRADES: Readonly<Record<string, string>> = {
  ...PRISON_UPGRADES,
  ...FAITH_UPGRADES,
  lean_to: 'longhouse',
  garden_plot: 'open_field',
  open_field: 'estate_farm',
  trading_post: 'general_store',
  fireside_inn: 'tavern',
  general_store: 'emporium',
  hide_tent: 'longhouse',
  longhouse: 'cottage',
  cottage: 'rowhouse',
  rowhouse: 'apartments',
  apartments: 'habitat_dome',
  palisade_wall: 'stone_wall',
  stone_wall: 'brick_wall',
  brick_wall: 'concrete_wall',
  concrete_wall: 'force_wall',
  palisade_gate: 'stone_gate',
  stone_gate: 'brick_gate',
  brick_gate: 'concrete_gate',
  concrete_gate: 'force_gate',
  palisade_grate: 'stone_grate',
  stone_grate: 'brick_grate',
  brick_grate: 'concrete_grate',
  concrete_grate: 'force_grate',
  lookout: 'watchtower',
  infirmary: 'hospital',
  hospital: 'trauma_center',
  storytellers_circle: 'scriptorium',
  scriptorium: 'library',
  library: 'university',
  university: 'ai_core',
  healers_hut: 'infirmary',
  watchtower: 'radio_tower',
  radio_tower: 'drone_hub',
  gun_nest: 'gun_turret',
  gun_turret: 'laser_turret',
  ...SEAT_UPGRADES,
};

/** Adjacency bonuses (DESIGN §4): a workshop near its raw material works faster; a tavern near the market cheers more. */
export const ADJACENT_TILES = 8;
export const NEAR_SOURCE: Readonly<Record<string, string[]>> = { bloomery: ['mine'], smithy: ['mine'], steelworks: ['coal_mine'], glassworks: ['coal_mine'], refinery: ['oil_derrick'], alloy_foundry: ['deep_mine'], chip_fab: ['deep_mine'] };
export const NEAR_SOURCE_BONUS = 1.25;
export const TAVERN_MARKET_MORALE = 3;
/** Fields within this many columns of a river grow faster. */
export const RIVER_TILES = 4;
export const RIVER_GROWTH = 1.3;

/** Unfinished constructions allowed at once (DESIGN §2: queues start at 2-3 slots). */
export const BUILD_QUEUE_SLOTS = 3;
/** Share of a finished building's cost returned when it is demolished. */
export const DEMOLISH_REFUND = 0.5;
