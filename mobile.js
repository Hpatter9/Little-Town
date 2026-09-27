"use strict";
(() => {
  // src/shared/constants.ts
  var STRIP_HEIGHT = 200;
  var TILE = 32;
  var WORLD_TILES = 200;
  var WORLD_WIDTH = WORLD_TILES * TILE;
  var BACK_PAD_TILES = 48;
  var CAMP_CLEAR_RADIUS = 8;

  // src/shared/ipc.ts
  var PANELS = [
    { id: "build", label: "Build" },
    { id: "research", label: "Research" },
    { id: "expeditions", label: "Expeditions" },
    { id: "townsfolk", label: "Townsfolk" },
    { id: "crafting", label: "Crafting" },
    { id: "trade", label: "Trade" },
    { id: "journal", label: "Journal" }
  ];
  var DEFAULT_ALERTS = { enabled: false, server: "https://ntfy.sh", topic: "", leadMinutes: 10, raids: true, deaths: true, expeditions: false, choices: false };

  // src/shared/data/materials.ts
  var MATERIALS = [
    // Neolithic
    "wood",
    "stone",
    "flint",
    "fiber",
    "hide",
    "bone",
    "clay",
    "herbs",
    "meat",
    "berries",
    "grain",
    "dried_meat",
    "rations",
    "sling_stones",
    "totem",
    // Medieval
    "iron_ore",
    "iron",
    "lumber",
    "bricks",
    "leather",
    "cloth",
    "flour",
    "bread",
    "arrows",
    // Industrial
    "coal",
    "steel",
    "glass",
    "shot",
    // Modern
    "oil",
    "fuel",
    "plastic",
    "concrete",
    "electronics",
    "cartridges",
    // Robotic & Space
    "rare_minerals",
    "alloys",
    "circuits",
    "power_cells"
  ];
  var MATERIAL_NAMES = {
    wood: "Wood",
    stone: "Stone",
    flint: "Flint",
    fiber: "Fiber",
    hide: "Hide",
    bone: "Bone",
    clay: "Clay",
    herbs: "Herbs",
    meat: "Raw meat",
    berries: "Berries",
    grain: "Wild grain",
    dried_meat: "Dried meat",
    rations: "Rations",
    sling_stones: "Sling stones",
    totem: "Cave Bear Totem",
    iron_ore: "Iron ore",
    iron: "Iron",
    lumber: "Lumber",
    bricks: "Bricks",
    leather: "Leather",
    cloth: "Cloth",
    flour: "Flour",
    bread: "Bread",
    arrows: "Arrows",
    coal: "Coal",
    steel: "Steel",
    glass: "Glass",
    shot: "Musket shot",
    oil: "Crude oil",
    fuel: "Fuel",
    plastic: "Plastic",
    concrete: "Concrete",
    electronics: "Electronics",
    cartridges: "Rifle cartridges",
    rare_minerals: "Rare minerals",
    alloys: "Alloys",
    circuits: "Circuits",
    power_cells: "Power cells"
  };

  // src/shared/data/buildings.ts
  var BUILDINGS = [
    { id: "campfire", name: "Campfire", layer: "fore", width: 2, cost: { wood: 4, stone: 3 }, buildSeconds: 20, purpose: "Cooking, warmth and morale. Doubles as a small camp cache.", storage: 30 },
    { id: "stockpile", name: "Stockpile", layer: "fore", width: 3, cost: { wood: 6 }, buildSeconds: 20, purpose: "Stores materials. Put them near the work to cut hauling.", storage: 100 },
    { id: "lean_to", name: "Lean-to", layer: "mid", width: 2, cost: { wood: 8, fiber: 4 }, buildSeconds: 30, purpose: "Houses 1.", research: "basic_shelter", housing: 1 },
    { id: "hide_tent", name: "Hide Tent", layer: "mid", width: 3, cost: { wood: 6, hide: 6, fiber: 4 }, buildSeconds: 60, purpose: "Houses 2.", research: "tanning", housing: 2 },
    { id: "workbench", name: "Workbench", layer: "mid", width: 2, cost: { wood: 10, stone: 4 }, buildSeconds: 45, purpose: "Crafts tools and weapons.", research: "flint_knapping" },
    { id: "drying_rack", name: "Drying Rack", layer: "mid", width: 1, cost: { wood: 5, fiber: 3 }, buildSeconds: 25, purpose: "Preserves food.", research: "food_preservation" },
    { id: "tanning_rack", name: "Tanning Rack", layer: "mid", width: 2, cost: { wood: 6, fiber: 2, stone: 2 }, buildSeconds: 40, purpose: "Processes hides.", research: "tanning" },
    { id: "kiln", name: "Kiln", layer: "mid", width: 2, cost: { stone: 12, clay: 8 }, buildSeconds: 90, purpose: "Fires pottery.", research: "pottery" },
    { id: "hunters_lodge", name: "Hunter's Lodge", layer: "mid", width: 3, cost: { wood: 16, hide: 4, bone: 4 }, buildSeconds: 120, purpose: "Hunts bring back game 40% faster.", research: "spear_hunting" },
    { id: "storytellers_circle", name: "Storyteller's Circle", layer: "mid", width: 3, cost: { stone: 10, wood: 6 }, buildSeconds: 90, purpose: "Research workstation (tier 1) and morale.", research: "oral_tradition" },
    { id: "herb_garden", name: "Herb Garden", layer: "back", width: 3, cost: { wood: 4, fiber: 4, herbs: 3 }, buildSeconds: 45, purpose: "Grows herbs: sown and harvested by farmers. Nothing grows in winter.", research: "herbalism" },
    { id: "garden_plot", name: "Garden Plot", layer: "back", width: 4, cost: { wood: 6, fiber: 4 }, buildSeconds: 60, purpose: "Grows wild grain (food): sown and harvested by farmers. Nothing grows in winter.", research: "early_agriculture" },
    { id: "healers_hut", name: "Healer's Hut", layer: "mid", width: 2, cost: { wood: 12, hide: 4, herbs: 6 }, buildSeconds: 90, purpose: "Herbs and a fire for the hurt: wounds heal half again as fast, and the downed take longer to bleed out.", research: "herbalism", healing: 1.5 },
    { id: "graveyard", name: "Graveyard", layer: "mid", width: 3, cost: { wood: 10, stone: 8 }, buildSeconds: 60, purpose: "The dead are laid to rest here: mourning weighs less and grief passes sooner. (A Necromancer may find other uses for it.)" },
    { id: "well", name: "Well", layer: "mid", width: 1, cost: { stone: 12, wood: 4 }, buildSeconds: 60, purpose: "Fields keep growing (slower) through a drought.", research: "early_agriculture" },
    { id: "palisade_wall", name: "Palisade Wall", layer: "fore", width: 1, cost: { wood: 8 }, buildSeconds: 40, purpose: "Stops raiders until they break it. Townsfolk can pass. Best at the town edges.", research: "palisades", hp: 150 },
    { id: "palisade_gate", name: "Palisade Gate", layer: "fore", width: 2, cost: { wood: 14, fiber: 4 }, buildSeconds: 70, purpose: "Like a wall, but weaker. Townsfolk come and go through it.", research: "palisades", hp: 120 },
    { id: "lookout", name: "Lookout Platform", layer: "mid", width: 2, cost: { wood: 14, fiber: 6 }, buildSeconds: 90, purpose: "Spots raiders early: an hour of warning instead of minutes.", research: "lookout", warningMinutes: 60 },
    { id: "spike_trap", name: "Spike Pit", layer: "fore", width: 1, cost: { wood: 6, flint: 2 }, buildSeconds: 40, purpose: "Hurts raiders who cross it.", research: "palisades", defense: { damage: [6, 12], range: 16, interval: 5, accuracy: 0.8 } },
    { id: "elder_lodge", name: "Elder Lodge", layer: "mid", width: 5, cost: { wood: 40, stone: 30, hide: 10, totem: 1 }, buildSeconds: 300, purpose: "Era capstone: opens the Medieval era. Needs the totem from the Bear Cave.", research: "elders_council", morale: [4, "The elders keep the peace"] },
    // Medieval
    { id: "mine", name: "Mine", layer: "mid", width: 3, cost: { wood: 20, stone: 10 }, buildSeconds: 120, purpose: "Gatherers dig iron ore and stone here, without end.", research: "mining" },
    { id: "bloomery", name: "Bloomery", layer: "mid", width: 2, cost: { stone: 16, clay: 8 }, buildSeconds: 100, purpose: "Smelts iron ore into iron.", research: "iron_working" },
    { id: "smithy", name: "Smithy", layer: "mid", width: 3, cost: { stone: 12, wood: 10, iron: 4 }, buildSeconds: 140, purpose: "Forges iron tools, weapons and armour.", research: "iron_working" },
    { id: "sawmill", name: "Sawmill", layer: "mid", width: 3, cost: { wood: 20, stone: 6 }, buildSeconds: 100, purpose: "Saws wood into lumber.", research: "carpentry" },
    { id: "tannery", name: "Tannery", layer: "mid", width: 3, cost: { wood: 16, stone: 8 }, buildSeconds: 100, purpose: "Cures hides into leather.", research: "leatherworking" },
    { id: "loom", name: "Loom", layer: "mid", width: 2, cost: { wood: 12, fiber: 6 }, buildSeconds: 80, purpose: "Weaves fiber into cloth.", research: "weaving" },
    { id: "windmill", name: "Windmill", layer: "back", width: 3, cost: { lumber: 16, stone: 12, cloth: 4 }, buildSeconds: 160, purpose: "Grinds grain into flour.", research: "milling" },
    { id: "bakery", name: "Bakery", layer: "mid", width: 3, cost: { bricks: 12, lumber: 8 }, buildSeconds: 140, purpose: "Bakes flour into bread.", research: "baking" },
    { id: "cottage", name: "Cottage", layer: "mid", width: 3, cost: { lumber: 14, stone: 8, cloth: 2 }, buildSeconds: 150, purpose: "Houses 3.", research: "carpentry", housing: 3 },
    { id: "stone_wall", name: "Stone Wall", layer: "fore", width: 1, cost: { stone: 18, bricks: 4 }, buildSeconds: 120, purpose: "Much tougher than a palisade.", research: "fortification", hp: 420 },
    { id: "stone_gate", name: "Stone Gate", layer: "fore", width: 2, cost: { stone: 20, lumber: 8, iron: 2 }, buildSeconds: 150, purpose: "A strong gate townsfolk pass through.", research: "fortification", hp: 340 },
    { id: "watchtower", name: "Watchtower", layer: "mid", width: 2, cost: { stone: 20, lumber: 10 }, buildSeconds: 160, purpose: "Two hours of raid warning.", research: "fortification", warningMinutes: 120 },
    { id: "guard_tower", name: "Archer Tower", layer: "mid", width: 1, cost: { stone: 16, lumber: 8 }, buildSeconds: 150, purpose: "Shoots arrows at raiders in range.", research: "archery", defense: { damage: [5, 9], range: 150, interval: 2.5, accuracy: 0.65 } },
    { id: "barracks", name: "Barracks", layer: "mid", width: 4, cost: { stone: 20, lumber: 16, iron: 4 }, buildSeconds: 200, purpose: "Guards (Defend on High) drill here and take day and night patrol shifts: they fight better, and patrols spot raiders half an hour sooner.", research: "fortification", morale: [3, "Guards on watch"] },
    { id: "scriptorium", name: "Scriptorium", layer: "mid", width: 4, cost: { bricks: 16, lumber: 12, cloth: 4 }, buildSeconds: 200, purpose: "Research workstation (tier 2): research twice as fast.", research: "writing" },
    { id: "tavern", name: "Tavern", layer: "mid", width: 5, cost: { lumber: 24, bricks: 16, cloth: 6 }, buildSeconds: 240, purpose: "Morale, and draws more wanderers.", research: "brewing", morale: [8, "A drink at the tavern"], arrivals: 0.08 },
    { id: "infirmary", name: "Infirmary", layer: "mid", width: 4, cost: { lumber: 16, bricks: 10, cloth: 6 }, buildSeconds: 180, purpose: "Wounds heal twice as fast.", research: "physick", healing: 2 },
    { id: "stable", name: "Stable", layer: "mid", width: 4, cost: { lumber: 20, stone: 6, fiber: 10 }, buildSeconds: 180, purpose: "Keeps up to 4 horses. Buy them from caravans.", research: "animal_husbandry", stalls: 4 },
    { id: "school", name: "School", layer: "mid", width: 4, cost: { lumber: 16, bricks: 8, cloth: 2 }, buildSeconds: 180, purpose: "Children grow up with better skills.", research: "schooling" },
    { id: "market", name: "Market Stall", layer: "fore", width: 3, cost: { lumber: 12, cloth: 6 }, buildSeconds: 120, purpose: "Trade caravans stop here.", research: "trade" },
    { id: "resurrection_shrine", name: "Resurrection Shrine", layer: "mid", width: 2, cost: { stone: 30, bricks: 10, iron: 4, cloth: 4 }, buildSeconds: 400, purpose: "If the founder dies, they come back. Works once.", research: "resurrection_rites" },
    // Industrial
    { id: "coal_mine", name: "Coal Mine", layer: "mid", width: 3, cost: { lumber: 20, stone: 20, iron: 4 }, buildSeconds: 150, purpose: "Gatherers dig coal here, without end.", research: "coal_mining" },
    { id: "steelworks", name: "Steelworks", layer: "mid", width: 4, cost: { bricks: 30, iron: 10 }, buildSeconds: 240, purpose: "Makes steel from iron and coal.", research: "steelmaking" },
    { id: "glassworks", name: "Glassworks", layer: "mid", width: 3, cost: { bricks: 20, iron: 4 }, buildSeconds: 180, purpose: "Makes glass from stone and coal.", research: "glassblowing" },
    { id: "factory", name: "Factory", layer: "mid", width: 6, cost: { bricks: 40, steel: 10, glass: 6 }, buildSeconds: 360, purpose: "Steam-driven: everything crafted here and at other stations goes twice as fast.", research: "steam_power" },
    { id: "gunsmith", name: "Gunsmith", layer: "mid", width: 3, cost: { bricks: 16, steel: 6, lumber: 8 }, buildSeconds: 200, purpose: "Makes muskets and shot.", research: "firearms" },
    { id: "gun_nest", name: "Gun Nest", layer: "fore", width: 1, cost: { bricks: 16, steel: 6 }, buildSeconds: 180, purpose: "A sandbagged gun that fires on raiders in range.", research: "firearms", defense: { damage: [9, 14], range: 170, interval: 1.6, accuracy: 0.65 } },
    { id: "rowhouse", name: "Row Houses", layer: "mid", width: 4, cost: { bricks: 30, lumber: 12, glass: 4 }, buildSeconds: 300, purpose: "Houses 6.", research: "urban_housing", housing: 6 },
    { id: "hospital", name: "Hospital", layer: "mid", width: 5, cost: { bricks: 30, steel: 4, glass: 6, cloth: 10 }, buildSeconds: 360, purpose: "Wounds heal three times as fast.", research: "sanitation", healing: 3 },
    { id: "library", name: "Library", layer: "mid", width: 4, cost: { bricks: 24, glass: 8, lumber: 12 }, buildSeconds: 300, purpose: "Research workstation (tier 3): research three times as fast.", research: "public_library" },
    { id: "brick_wall", name: "Brick Wall", layer: "fore", width: 1, cost: { bricks: 20, steel: 2 }, buildSeconds: 150, purpose: "The toughest wall yet.", research: "urban_housing", hp: 800 },
    { id: "power_station", name: "Power Station", layer: "mid", width: 6, cost: { bricks: 60, steel: 30, glass: 10, coal: 40 }, buildSeconds: 3e3, purpose: "Era capstone: electric light for the town opens the Modern era.", research: "electricity", morale: [8, "Lights in every window"] },
    // Modern
    { id: "oil_derrick", name: "Oil Derrick", layer: "mid", width: 2, cost: { steel: 12, lumber: 10 }, buildSeconds: 180, purpose: "Gatherers pump crude oil here, without end.", research: "oil_drilling" },
    { id: "refinery", name: "Refinery", layer: "mid", width: 4, cost: { steel: 20, bricks: 20, glass: 4 }, buildSeconds: 300, purpose: "Refines crude oil into fuel and plastic.", research: "refining" },
    { id: "cement_works", name: "Cement Works", layer: "mid", width: 3, cost: { bricks: 20, steel: 6 }, buildSeconds: 220, purpose: "Makes concrete from stone and coal.", research: "concrete" },
    { id: "electronics_plant", name: "Electronics Plant", layer: "mid", width: 4, cost: { concrete: 20, steel: 10, glass: 10 }, buildSeconds: 320, purpose: "Makes electronics and power tools.", research: "electronics" },
    { id: "garage", name: "Garage", layer: "mid", width: 4, cost: { concrete: 16, steel: 12 }, buildSeconds: 260, purpose: "Builds trucks. A truck carries a lot and gets an expedition there and back far faster, on fuel.", research: "motor_transport" },
    { id: "apartments", name: "Apartment Block", layer: "mid", width: 4, cost: { concrete: 30, steel: 10, glass: 10 }, buildSeconds: 360, purpose: "Houses 10.", research: "modern_housing", housing: 10 },
    { id: "trauma_center", name: "Trauma Center", layer: "mid", width: 5, cost: { concrete: 30, electronics: 6, plastic: 8, cloth: 10 }, buildSeconds: 400, purpose: "Wounds heal four times as fast.", research: "trauma_surgery", healing: 4 },
    { id: "radio_tower", name: "Radio Tower", layer: "mid", width: 1, cost: { steel: 12, electronics: 4 }, buildSeconds: 240, purpose: "Four hours of raid warning, and news of the town draws newcomers.", research: "radio", warningMinutes: 240, arrivals: 0.05 },
    { id: "cinema", name: "Cinema", layer: "mid", width: 4, cost: { concrete: 20, electronics: 4, plastic: 6 }, buildSeconds: 300, purpose: "Morale: a night at the pictures.", research: "radio", morale: [10, "A night at the pictures"] },
    { id: "university", name: "University", layer: "mid", width: 6, cost: { concrete: 40, glass: 16, electronics: 6 }, buildSeconds: 480, purpose: "Research workstation (tier 4): research five times as fast.", research: "higher_education" },
    { id: "gun_turret", name: "Gun Turret", layer: "fore", width: 1, cost: { concrete: 12, steel: 8, electronics: 2 }, buildSeconds: 220, purpose: "An automatic gun that fires on raiders in range.", research: "rifles", defense: { damage: [14, 20], range: 190, interval: 1.2, accuracy: 0.7 } },
    { id: "concrete_wall", name: "Concrete Wall", layer: "fore", width: 1, cost: { concrete: 24, steel: 4 }, buildSeconds: 180, purpose: "Hard to break even with guns.", research: "concrete", hp: 1600 },
    { id: "cryo_pod", name: "Cryo Pod", layer: "mid", width: 1, cost: { steel: 8, electronics: 6, glass: 4 }, buildSeconds: 300, purpose: "If the founder dies, they are frozen and revived, frailer each time (at most once every 3 days).", research: "cryonics" },
    { id: "mission_control", name: "Mission Control", layer: "mid", width: 6, cost: { concrete: 60, electronics: 20, glass: 20, steel: 20 }, buildSeconds: 3e3, purpose: "Era capstone: opens the Robotic & Space era.", research: "space_program", morale: [10, "Eyes on the stars"] },
    // Robotic & Space
    { id: "deep_mine", name: "Deep Mine", layer: "mid", width: 3, cost: { concrete: 20, steel: 12, electronics: 4 }, buildSeconds: 240, purpose: "Gatherers dig rare minerals here, without end.", research: "deep_mining" },
    { id: "alloy_foundry", name: "Alloy Foundry", layer: "mid", width: 4, cost: { concrete: 24, steel: 16 }, buildSeconds: 300, purpose: "Makes alloys from steel and rare minerals.", research: "advanced_alloys" },
    { id: "chip_fab", name: "Chip Fab", layer: "mid", width: 4, cost: { concrete: 20, glass: 16, electronics: 8 }, buildSeconds: 320, purpose: "Makes circuits, and the gear built with them.", research: "microchips" },
    { id: "battery_plant", name: "Battery Plant", layer: "mid", width: 3, cost: { concrete: 16, alloys: 4, plastic: 8 }, buildSeconds: 280, purpose: "Makes power cells.", research: "power_storage" },
    { id: "robot_workshop", name: "Robot Workshop", layer: "mid", width: 4, cost: { concrete: 20, alloys: 8, circuits: 4 }, buildSeconds: 320, purpose: "Builds worker bots and drones.", research: "robotics" },
    { id: "drone_hub", name: "Drone Hub", layer: "mid", width: 2, cost: { alloys: 6, circuits: 4, concrete: 10 }, buildSeconds: 240, purpose: "Drones scout for trouble: six hours of raid warning.", research: "drones", warningMinutes: 360 },
    { id: "habitat_dome", name: "Habitat Dome", layer: "mid", width: 5, cost: { alloys: 16, glass: 24, concrete: 20 }, buildSeconds: 400, purpose: "Houses 16.", research: "habitats", housing: 16, morale: [8, "Life under the dome"] },
    { id: "hydroponics_bay", name: "Hydroponics Bay", layer: "back", width: 4, cost: { alloys: 6, glass: 12, power_cells: 4 }, buildSeconds: 300, purpose: "Grows grain under lamps: sown and harvested by farmers, even in winter.", research: "hydroponics" },
    { id: "fusion_reactor", name: "Fusion Reactor", layer: "mid", width: 5, cost: { alloys: 20, circuits: 8, concrete: 30 }, buildSeconds: 480, purpose: "Power to spare: crafting everywhere goes 50% faster.", research: "fusion" },
    { id: "shield_generator", name: "Shield Generator", layer: "mid", width: 2, cost: { alloys: 12, circuits: 6, power_cells: 10 }, buildSeconds: 360, purpose: "A dome of force: raiders can't set fires, and meteors burn up before they land.", research: "energy_shields" },
    { id: "clone_vat", name: "Clone Vat", layer: "mid", width: 2, cost: { alloys: 10, circuits: 6, glass: 8 }, buildSeconds: 400, purpose: "If the founder dies, a clone wakes with their memories, though some skill is lost (at most once every 2 days).", research: "cloning" },
    { id: "ai_core", name: "AI Core", layer: "mid", width: 3, cost: { circuits: 16, alloys: 8, power_cells: 8 }, buildSeconds: 480, purpose: "Research workstation (tier 5): research eight times as fast.", research: "artificial_intelligence" },
    { id: "laser_turret", name: "Laser Turret", layer: "fore", width: 1, cost: { alloys: 6, circuits: 3, power_cells: 6 }, buildSeconds: 260, purpose: "Burns raiders in range, and rarely misses.", research: "energy_weapons", defense: { damage: [22, 32], range: 230, interval: 1, accuracy: 0.85 } },
    { id: "force_wall", name: "Force Wall", layer: "fore", width: 1, cost: { alloys: 10, power_cells: 6 }, buildSeconds: 200, purpose: "The strongest wall there is.", research: "energy_shields", hp: 3e3 },
    { id: "launch_site", name: "Launch Site", layer: "mid", width: 8, cost: { alloys: 120, circuits: 60, power_cells: 80, fuel: 150, concrete: 100 }, buildSeconds: 3e4, purpose: "Build the ship, and the town leaves for the stars. The end of the game (a win).", research: "starship_design" },
    { id: "phylactery", name: "Phylactery", layer: "mid", width: 1, cost: { bone: 12, iron: 6, herbs: 6, cloth: 2 }, buildSeconds: 300, purpose: "The founder becomes a lich and always returns here after death. If it burns, the next death is final.", research: "lichcraft" },
    { id: "town_hall", name: "Town Hall", layer: "mid", width: 6, cost: { bricks: 40, lumber: 30, iron: 10, cloth: 10 }, buildSeconds: 3e3, purpose: "Era capstone: the seat of the town opens the Industrial era.", research: "town_charter", morale: [6, "A proper town"] }
  ];
  var BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
  var UPGRADES = {
    lean_to: "hide_tent",
    hide_tent: "cottage",
    cottage: "rowhouse",
    rowhouse: "apartments",
    apartments: "habitat_dome",
    palisade_wall: "stone_wall",
    stone_wall: "brick_wall",
    brick_wall: "concrete_wall",
    concrete_wall: "force_wall",
    palisade_gate: "stone_gate",
    lookout: "watchtower",
    infirmary: "hospital",
    hospital: "trauma_center",
    scriptorium: "library",
    gun_nest: "gun_turret",
    gun_turret: "laser_turret"
  };
  var ADJACENT_TILES = 8;
  var NEAR_SOURCE = { bloomery: ["mine"], smithy: ["mine"], steelworks: ["coal_mine"], glassworks: ["coal_mine"], refinery: ["oil_derrick"], alloy_foundry: ["deep_mine"], chip_fab: ["deep_mine"] };
  var NEAR_SOURCE_BONUS = 1.25;
  var TAVERN_MARKET_MORALE = 3;
  var RIVER_TILES = 4;
  var RIVER_GROWTH = 1.3;
  var BUILD_QUEUE_SLOTS = 3;
  var DEMOLISH_REFUND = 0.5;

  // src/shared/data/research.ts
  var TOPICS = [
    { id: "fire_keeping", name: "Fire Keeping", branch: "crafting", seconds: 120, prereqs: [], unlocks: "", effects: [] },
    { id: "flint_knapping", name: "Flint Knapping", branch: "crafting", seconds: 150, prereqs: [], unlocks: "", effects: [] },
    { id: "foraging", name: "Foraging", branch: "agriculture", seconds: 120, prereqs: [], unlocks: "Faster foraging, Forager job", effects: [{ type: "gatherSpeed", anim: "forage", mult: 1.3 }] },
    { id: "basic_shelter", name: "Basic Shelter", branch: "construction", seconds: 120, prereqs: [], unlocks: "", effects: [] },
    { id: "woodcutting", name: "Woodcutting", branch: "construction", seconds: 180, prereqs: ["flint_knapping"], unlocks: "Faster forest clearing", effects: [{ type: "gatherSpeed", anim: "chop", mult: 1.3 }] },
    { id: "stoneworking", name: "Stoneworking", branch: "construction", seconds: 180, prereqs: ["flint_knapping"], unlocks: "Faster rock clearing", effects: [{ type: "gatherSpeed", anim: "mine", mult: 1.3 }] },
    { id: "cordage", name: "Cordage", branch: "crafting", seconds: 180, prereqs: ["foraging"], unlocks: "", effects: [] },
    { id: "spear_hunting", name: "Spear Hunting", branch: "military", seconds: 210, prereqs: ["flint_knapping"], unlocks: "Hunt expeditions", effects: [] },
    { id: "tanning", name: "Tanning", branch: "crafting", seconds: 210, prereqs: ["spear_hunting"], unlocks: "", effects: [] },
    { id: "food_preservation", name: "Food Preservation", branch: "agriculture", seconds: 180, prereqs: ["fire_keeping"], unlocks: "", effects: [] },
    { id: "pottery", name: "Pottery", branch: "crafting", seconds: 210, prereqs: ["fire_keeping"], unlocks: "+20% storage", effects: [{ type: "storage", mult: 1.2 }] },
    { id: "herbalism", name: "Herbalism", branch: "medicine", seconds: 180, prereqs: ["foraging"], unlocks: "", effects: [] },
    { id: "scouting", name: "Scouting", branch: "logistics", seconds: 240, prereqs: ["cordage"], unlocks: "Scout expeditions, more destinations", effects: [] },
    { id: "palisades", name: "Palisades", branch: "military", seconds: 240, prereqs: ["woodcutting"], unlocks: "", effects: [] },
    { id: "lookout", name: "Lookout", branch: "military", seconds: 240, prereqs: ["palisades"], unlocks: "Raid warning", effects: [] },
    { id: "early_agriculture", name: "Early Agriculture", branch: "agriculture", seconds: 240, prereqs: ["foraging"], unlocks: "Wild grain", effects: [] },
    { id: "oral_tradition", name: "Oral Tradition", branch: "society", seconds: 180, prereqs: ["fire_keeping"], unlocks: "+1 research queue slot, +10% research speed", effects: [{ type: "researchSlots", add: 1 }, { type: "researchSpeed", mult: 1.1 }] },
    { id: "pack_carrying", name: "Pack Carrying", branch: "logistics", seconds: 240, prereqs: ["tanning", "cordage"], unlocks: "+5 carry", effects: [{ type: "carry", add: 5 }] },
    { id: "elders_council", name: "Elder's Council", branch: "society", seconds: 600, prereqs: ["oral_tradition"], requiresCount: 10, unlocks: "Building the Elder Lodge opens the Medieval era", effects: [{ type: "eraCapstone" }] },
    // Medieval (every time here is stretched by the era multiplier, 2.5x)
    { id: "mining", name: "Mining", branch: "construction", era: "medieval", seconds: 300, prereqs: [], unlocks: "Iron Hills expeditions", effects: [] },
    { id: "iron_working", name: "Iron Working", branch: "crafting", era: "medieval", seconds: 420, prereqs: ["mining"], unlocks: "Iron from ore", effects: [] },
    { id: "carpentry", name: "Carpentry", branch: "construction", era: "medieval", seconds: 300, prereqs: [], unlocks: "Lumber", effects: [] },
    { id: "masonry", name: "Masonry", branch: "construction", era: "medieval", seconds: 420, prereqs: ["mining"], unlocks: "Bricks (at the kiln)", effects: [] },
    { id: "leatherworking", name: "Leatherworking", branch: "crafting", era: "medieval", seconds: 300, prereqs: [], unlocks: "Leather", effects: [] },
    { id: "weaving", name: "Weaving", branch: "crafting", era: "medieval", seconds: 300, prereqs: [], unlocks: "Cloth", effects: [] },
    { id: "milling", name: "Milling", branch: "agriculture", era: "medieval", seconds: 360, prereqs: ["carpentry"], unlocks: "Flour from grain", effects: [] },
    { id: "baking", name: "Baking", branch: "agriculture", era: "medieval", seconds: 300, prereqs: ["milling", "masonry"], unlocks: "Bread", effects: [] },
    { id: "crop_rotation", name: "Crop Rotation", branch: "agriculture", era: "medieval", seconds: 360, prereqs: [], unlocks: "Fields grow 30% faster", effects: [{ type: "cropSpeed", mult: 1.3 }] },
    { id: "animal_husbandry", name: "Animal Husbandry", branch: "agriculture", era: "medieval", seconds: 480, prereqs: ["carpentry"], unlocks: "Horses for expeditions", effects: [] },
    { id: "physick", name: "Physick", branch: "medicine", era: "medieval", seconds: 420, prereqs: ["weaving"], unlocks: "Faster healing", effects: [] },
    { id: "archery", name: "Archery", branch: "military", era: "medieval", seconds: 360, prereqs: ["carpentry"], unlocks: "", effects: [] },
    { id: "armoring", name: "Armoring", branch: "military", era: "medieval", seconds: 540, prereqs: ["iron_working", "leatherworking"], unlocks: "", effects: [] },
    { id: "fortification", name: "Fortification", branch: "military", era: "medieval", seconds: 480, prereqs: ["masonry"], unlocks: "Two hours of raid warning", effects: [] },
    { id: "carts", name: "Carts", branch: "logistics", era: "medieval", seconds: 420, prereqs: ["carpentry", "iron_working"], unlocks: "+5 carry, +20% storage", effects: [{ type: "carry", add: 5 }, { type: "storage", mult: 1.2 }] },
    { id: "writing", name: "Writing", branch: "society", era: "medieval", seconds: 480, prereqs: ["weaving"], unlocks: "+1 research queue slot", effects: [{ type: "researchSlots", add: 1 }] },
    { id: "brewing", name: "Brewing", branch: "society", era: "medieval", seconds: 420, prereqs: ["milling"], unlocks: "Morale, and more wanderers", effects: [] },
    { id: "trade", name: "Trade", branch: "society", era: "medieval", seconds: 480, prereqs: ["carpentry", "weaving"], unlocks: "Trade caravans", effects: [] },
    { id: "family_life", name: "Family Life", branch: "society", era: "medieval", seconds: 420, prereqs: [], unlocks: "Couples marry and raise children", effects: [] },
    { id: "schooling", name: "Schooling", branch: "society", era: "medieval", seconds: 420, prereqs: ["writing", "family_life"], unlocks: "Children grow up more skilled", effects: [] },
    { id: "guilds", name: "Guilds", branch: "logistics", era: "medieval", seconds: 480, prereqs: ["writing"], unlocks: "+1 craft and build queue slot", effects: [{ type: "queueSlots", add: 1 }] },
    // Industrial (times stretched 6x)
    { id: "coal_mining", name: "Coal Mining", branch: "construction", era: "industrial", seconds: 300, prereqs: [], unlocks: "", effects: [] },
    { id: "steelmaking", name: "Steelmaking", branch: "crafting", era: "industrial", seconds: 420, prereqs: ["coal_mining"], unlocks: "Steel from iron and coal", effects: [] },
    { id: "glassblowing", name: "Glassblowing", branch: "crafting", era: "industrial", seconds: 360, prereqs: ["coal_mining"], unlocks: "Glass", effects: [] },
    { id: "steam_power", name: "Steam Power", branch: "crafting", era: "industrial", seconds: 600, prereqs: ["steelmaking"], unlocks: "The Factory: crafting at twice the speed", effects: [] },
    { id: "firearms", name: "Firearms", branch: "military", era: "industrial", seconds: 480, prereqs: ["steelmaking"], unlocks: "", effects: [] },
    { id: "industrial_farming", name: "Industrial Farming", branch: "agriculture", era: "industrial", seconds: 480, prereqs: ["steam_power"], unlocks: "Fields grow 50% faster", effects: [{ type: "cropSpeed", mult: 1.5 }] },
    { id: "sanitation", name: "Sanitation", branch: "medicine", era: "industrial", seconds: 420, prereqs: ["glassblowing"], unlocks: "The Hospital; plague spreads far less", effects: [] },
    { id: "railways", name: "Railways", branch: "logistics", era: "industrial", seconds: 600, prereqs: ["steam_power"], unlocks: "+10 carry, +30% storage", effects: [{ type: "carry", add: 10 }, { type: "storage", mult: 1.3 }] },
    { id: "urban_housing", name: "Urban Housing", branch: "construction", era: "industrial", seconds: 420, prereqs: ["steelmaking"], unlocks: "", effects: [] },
    { id: "public_library", name: "Public Libraries", branch: "society", era: "industrial", seconds: 540, prereqs: ["glassblowing"], unlocks: "+1 research queue slot", effects: [{ type: "researchSlots", add: 1 }] },
    { id: "assembly_lines", name: "Assembly Lines", branch: "logistics", era: "industrial", seconds: 600, prereqs: ["steam_power"], unlocks: "+1 craft and build queue slot", effects: [{ type: "queueSlots", add: 1 }] },
    { id: "electricity", name: "Electricity", branch: "society", era: "industrial", seconds: 1500, prereqs: ["steam_power", "public_library"], requiresCount: 6, unlocks: "Building the Power Station opens the Modern era", effects: [{ type: "eraCapstone" }] },
    // Modern (times stretched 15x)
    { id: "oil_drilling", name: "Oil Drilling", branch: "construction", era: "modern", seconds: 300, prereqs: [], unlocks: "Crude oil", effects: [] },
    { id: "refining", name: "Refining", branch: "crafting", era: "modern", seconds: 420, prereqs: ["oil_drilling"], unlocks: "Fuel and plastic", effects: [] },
    { id: "concrete", name: "Concrete", branch: "construction", era: "modern", seconds: 360, prereqs: [], unlocks: "Concrete, and walls of it", effects: [] },
    { id: "electronics", name: "Electronics", branch: "crafting", era: "modern", seconds: 540, prereqs: ["refining"], unlocks: "Electronics, and power tools", effects: [] },
    { id: "motor_transport", name: "Motor Transport", branch: "logistics", era: "modern", seconds: 480, prereqs: ["refining"], unlocks: "Trucks for expeditions; +10 carry", effects: [{ type: "carry", add: 10 }] },
    { id: "modern_housing", name: "Modern Housing", branch: "construction", era: "modern", seconds: 420, prereqs: ["concrete"], unlocks: "", effects: [] },
    { id: "rifles", name: "Rifles", branch: "military", era: "modern", seconds: 480, prereqs: ["refining"], unlocks: "Rifles, cartridges and body armour", effects: [] },
    { id: "mechanized_farming", name: "Mechanized Farming", branch: "agriculture", era: "modern", seconds: 480, prereqs: ["motor_transport"], unlocks: "Fields grow 50% faster", effects: [{ type: "cropSpeed", mult: 1.5 }] },
    { id: "trauma_surgery", name: "Trauma Surgery", branch: "medicine", era: "modern", seconds: 540, prereqs: ["electronics"], unlocks: "The Trauma Center", effects: [] },
    { id: "radio", name: "Radio", branch: "society", era: "modern", seconds: 480, prereqs: ["electronics"], unlocks: "+1 research queue slot", effects: [{ type: "researchSlots", add: 1 }] },
    { id: "higher_education", name: "Higher Education", branch: "society", era: "modern", seconds: 600, prereqs: ["electronics", "modern_housing"], unlocks: "The University: research five times as fast", effects: [] },
    { id: "containerization", name: "Containerization", branch: "logistics", era: "modern", seconds: 540, prereqs: ["motor_transport"], unlocks: "+1 craft and build queue slot, +30% storage", effects: [{ type: "queueSlots", add: 1 }, { type: "storage", mult: 1.3 }] },
    { id: "cryonics", name: "Cryonics", branch: "medicine", era: "modern", seconds: 600, prereqs: ["trauma_surgery"], unlocks: "The Cryo Pod: the founder can be brought back, frailer", effects: [] },
    { id: "space_program", name: "Space Program", branch: "society", era: "modern", seconds: 1500, prereqs: ["higher_education", "radio"], requiresCount: 7, unlocks: "Building Mission Control opens the Robotic & Space era", effects: [{ type: "eraCapstone" }] },
    // Robotic & Space (times stretched 40x)
    { id: "deep_mining", name: "Deep Mining", branch: "construction", era: "space", seconds: 300, prereqs: [], unlocks: "Rare minerals", effects: [] },
    { id: "advanced_alloys", name: "Advanced Alloys", branch: "crafting", era: "space", seconds: 420, prereqs: ["deep_mining"], unlocks: "Alloys", effects: [] },
    { id: "microchips", name: "Microchips", branch: "crafting", era: "space", seconds: 420, prereqs: ["deep_mining"], unlocks: "Circuits", effects: [] },
    { id: "power_storage", name: "Power Storage", branch: "crafting", era: "space", seconds: 420, prereqs: ["microchips"], unlocks: "Power cells", effects: [] },
    { id: "robotics", name: "Robotics", branch: "crafting", era: "space", seconds: 540, prereqs: ["microchips", "advanced_alloys"], unlocks: "Worker bots: every job goes faster", effects: [] },
    { id: "drones", name: "Drones", branch: "logistics", era: "space", seconds: 480, prereqs: ["microchips", "power_storage"], unlocks: "+20 carry, +30% storage", effects: [{ type: "carry", add: 20 }, { type: "storage", mult: 1.3 }] },
    { id: "habitats", name: "Habitats", branch: "construction", era: "space", seconds: 420, prereqs: ["advanced_alloys"], unlocks: "", effects: [] },
    { id: "hydroponics", name: "Hydroponics", branch: "agriculture", era: "space", seconds: 480, prereqs: ["power_storage"], unlocks: "Fields grow twice as fast, and even in winter", effects: [{ type: "cropSpeed", mult: 2 }] },
    { id: "energy_weapons", name: "Energy Weapons", branch: "military", era: "space", seconds: 540, prereqs: ["power_storage", "advanced_alloys"], unlocks: "Laser rifles and powered armour", effects: [] },
    { id: "fusion", name: "Fusion Power", branch: "construction", era: "space", seconds: 600, prereqs: ["power_storage"], unlocks: "The Fusion Reactor: crafting 50% faster", effects: [] },
    { id: "energy_shields", name: "Energy Shields", branch: "military", era: "space", seconds: 600, prereqs: ["fusion"], unlocks: "The Shield Generator", effects: [] },
    { id: "cloning", name: "Cloning", branch: "medicine", era: "space", seconds: 600, prereqs: ["robotics"], unlocks: "The Clone Vat: the founder can be brought back, forgetting some skill", effects: [] },
    { id: "artificial_intelligence", name: "Artificial Intelligence", branch: "society", era: "space", seconds: 720, prereqs: ["robotics"], unlocks: "+1 research queue slot, +25% research speed", effects: [{ type: "researchSlots", add: 1 }, { type: "researchSpeed", mult: 1.25 }] },
    { id: "starship_design", name: "Starship Design", branch: "society", era: "space", seconds: 1800, prereqs: ["artificial_intelligence", "fusion"], requiresCount: 8, unlocks: "The Launch Site: build the ship and leave for the stars", effects: [{ type: "eraCapstone" }] },
    // Occult (hidden until revealed: a strange tome, a hermit, or a vision)
    { id: "forbidden_lore", name: "Forbidden Lore", branch: "occult", hidden: true, seconds: 300, prereqs: [], unlocks: "The first steps into the Occult", effects: [] },
    { id: "spirit_binding", name: "Spirit Binding", branch: "occult", hidden: true, seconds: 420, prereqs: ["forbidden_lore"], unlocks: "The Spirit Totem: a second life, once", effects: [] },
    { id: "blood_rite", name: "The Blood Rite", branch: "occult", hidden: true, seconds: 600, prereqs: ["spirit_binding"], unlocks: "The founder may become a vampire", effects: [] },
    { id: "resurrection_rites", name: "Resurrection Rites", branch: "occult", hidden: true, era: "medieval", seconds: 900, prereqs: ["spirit_binding"], unlocks: "", effects: [] },
    { id: "lichcraft", name: "Lichcraft", branch: "occult", hidden: true, era: "medieval", seconds: 1200, prereqs: ["resurrection_rites"], unlocks: "The Phylactery: the founder becomes a lich", effects: [] },
    // special classes (see classes.ts): three hidden in the Occult, one out in the open
    { id: "necromancy", name: "Necromancy", branch: "occult", hidden: true, seconds: 420, prereqs: ["forbidden_lore"], unlocks: "Train a Necromancer (Townsfolk)", effects: [] },
    { id: "summoning", name: "Summoning", branch: "occult", hidden: true, seconds: 420, prereqs: ["spirit_binding"], unlocks: "Train a Summoner (Townsfolk)", effects: [] },
    { id: "blood_oath", name: "The Blood Oath", branch: "occult", hidden: true, seconds: 480, prereqs: ["forbidden_lore"], unlocks: "Train a Blood Knight (Townsfolk)", effects: [] },
    { id: "beast_lore", name: "Beast Lore", branch: "military", seconds: 300, prereqs: ["spear_hunting"], unlocks: "Train a Beast Tamer (Townsfolk)", effects: [] },
    { id: "moon_rite", name: "The Moon Rite", branch: "occult", hidden: true, seconds: 600, prereqs: ["spirit_binding", "beast_lore"], unlocks: "The founder may become a werewolf", effects: [] },
    { id: "town_charter", name: "Town Charter", branch: "society", era: "medieval", seconds: 1200, prereqs: ["writing", "guilds"], requiresCount: 12, unlocks: "Building the Town Hall opens the Industrial era", effects: [{ type: "eraCapstone" }] }
  ];
  var TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
  var RESEARCH_QUEUE_BASE = 2;
  var RESEARCH_STATIONS = {
    ai_core: { mult: 8, label: "the AI Core" },
    university: { mult: 5, label: "the University" },
    library: { mult: 3, label: "the Library" },
    scriptorium: { mult: 2, label: "the Scriptorium" },
    storytellers_circle: { mult: 1.5, label: "Storyteller's Circle" },
    campfire: { mult: 1, label: "the campfire" }
  };

  // src/shared/data/items.ts
  var SLOTS = ["weapon", "offhand", "head", "body", "tool", "charm", "pack"];
  var ITEMS = [
    // tools
    { id: "flint_knife", name: "Flint Knife", slot: "tool", station: "campfire", cost: { flint: 2, wood: 1 }, seconds: 30, research: ["flint_knapping"], effects: { gather: { forage: 1.25 }, damage: 1 }, description: "Forage 25% faster. A little bite in a fight.", icon: { sheet: "ShortWep", x: 2, y: 1 } },
    { id: "stone_axe", name: "Stone Axe", slot: "tool", station: "workbench", cost: { flint: 2, wood: 2, fiber: 1 }, seconds: 45, research: ["woodcutting"], effects: { gather: { chop: 1.5 } }, description: "Chop wood 50% faster.", icon: { sheet: "MedWep", x: 0, y: 1 } },
    { id: "stone_hammer", name: "Stone Hammer", slot: "tool", station: "workbench", cost: { stone: 2, wood: 2, fiber: 1 }, seconds: 45, research: ["stoneworking"], effects: { gather: { mine: 1.5 }, construct: 1.25 }, description: "Break rock 50% faster, build 25% faster.", icon: { sheet: "Tool", x: 1, y: 1 } },
    // weapons
    { id: "wooden_club", name: "Wooden Club", slot: "weapon", station: "campfire", cost: { wood: 3 }, seconds: 20, research: [], effects: { damage: 2 }, description: "+2 melee damage.", icon: { sheet: "ShortWep", x: 0, y: 2 } },
    { id: "spear", name: "Spear", slot: "weapon", station: "workbench", cost: { wood: 2, flint: 1, fiber: 1 }, seconds: 45, research: ["spear_hunting"], effects: { damage: 4, accuracy: 0.05 }, description: "+4 melee damage, better aim.", icon: { sheet: "LongWep", x: 4, y: 4 } },
    { id: "fire_spear", name: "Fire-Hardened Spear", slot: "weapon", station: "campfire", cost: { wood: 1 }, items: { spear: 1 }, seconds: 40, research: ["spear_hunting", "fire_keeping"], effects: { damage: 6, accuracy: 0.05 }, description: "+6 melee damage, better aim.", icon: { sheet: "LongWep", x: 2, y: 4 } },
    { id: "sling", name: "Sling", slot: "weapon", station: "workbench", cost: { hide: 1 }, items: { rope: 1 }, seconds: 40, research: ["cordage"], effects: { ranged: true, ammo: "sling_stones", damage: 2 }, description: "Fights from range. +2 damage, +3 more with sling stones.", icon: { sheet: "LongWep", x: 0, y: 5 } },
    { id: "sling_stones", name: "Sling Stones", slot: null, station: "campfire", cost: { stone: 2 }, seconds: 20, research: ["cordage"], makes: { sling_stones: 6 }, effects: {}, description: "Ammunition for slings: 6 per batch, one per shot.", icon: { sheet: "Rock", x: 1, y: 1 } },
    // armour and trinkets
    { id: "wicker_shield", name: "Wicker Shield", slot: "offhand", station: "workbench", cost: { wood: 2, fiber: 3 }, seconds: 45, research: ["cordage"], effects: { block: 0.15 }, description: "Blocks 15% of blows.", icon: { sheet: "Shield", x: 5, y: 0 } },
    { id: "torch", name: "Torch", slot: "offhand", station: "campfire", cost: { wood: 1, fiber: 1 }, seconds: 15, research: ["fire_keeping"], effects: { beastDamage: 3 }, description: "Beasts fear fire: +3 damage against animals.", icon: { sheet: "Light", x: 0, y: 0 } },
    { id: "hide_cap", name: "Hide Cap", slot: "head", station: "tanning_rack", cost: { hide: 2, fiber: 1 }, seconds: 40, research: ["tanning"], effects: { armor: 0.1 }, description: "Takes 10% off every hit.", icon: { sheet: "Hat", x: 0, y: 1 } },
    { id: "hide_armor", name: "Hide Armor", slot: "body", station: "tanning_rack", cost: { hide: 5, fiber: 2 }, seconds: 90, research: ["tanning"], effects: { armor: 0.2 }, description: "Takes 20% off every hit.", icon: { sheet: "Armor", x: 0, y: 7 } },
    { id: "bone_charm", name: "Bone Charm", slot: "charm", station: "campfire", cost: { bone: 2, fiber: 1 }, seconds: 30, research: [], effects: { morale: 5 }, description: "+5 morale for whoever wears it.", icon: { sheet: "Amulet", x: 3, y: 1 } },
    { id: "backpack", name: "Backpack", slot: "pack", station: "tanning_rack", cost: { hide: 3 }, items: { rope: 1 }, seconds: 60, research: ["pack_carrying"], effects: { carry: 5 }, description: "Carry 5 more.", icon: { sheet: "Chest0", x: 0, y: 2 } },
    // town inventory
    { id: "rope", name: "Rope", slot: null, station: "campfire", cost: { fiber: 3 }, seconds: 20, research: ["cordage"], effects: {}, description: "Goes into slings, snares and backpacks.", icon: { sheet: "Tool", x: 2, y: 2 } },
    { id: "snare", name: "Snare", slot: null, station: "campfire", cost: { wood: 1 }, items: { rope: 1 }, seconds: 30, research: ["cordage"], effects: {}, description: "Set around camp: catches meat now and then. Sometimes breaks.", icon: { sheet: "Tool", x: 6, y: 1 } },
    { id: "clay_pot", name: "Clay Pot", slot: null, station: "kiln", cost: { clay: 3 }, seconds: 45, research: ["pottery"], effects: {}, description: "+5 room in the campfire store (up to 10 pots).", icon: { sheet: "Potion", x: 4, y: 2 } },
    { id: "waterskin", name: "Waterskin", slot: null, station: "tanning_rack", cost: { hide: 2, fiber: 1 }, seconds: 40, research: ["tanning"], effects: {}, description: "A party with one each walks 10% faster.", icon: { sheet: "Potion", x: 1, y: 3 } },
    { id: "bedroll", name: "Bedroll", slot: null, station: "tanning_rack", cost: { hide: 2, fiber: 2 }, seconds: 45, research: ["tanning"], effects: {}, description: "Someone without a bed sleeps almost as well.", icon: { sheet: "Armor", x: 3, y: 5 } },
    { id: "poultice", name: "Poultice", slot: null, station: "campfire", cost: { herbs: 2, fiber: 1 }, seconds: 30, research: ["herbalism"], effects: {}, description: "Used on anyone badly hurt in town: stops bleeding, +20 health.", icon: { sheet: "Food", x: 6, y: 1 } },
    // food
    { id: "dried_meat", name: "Dried Meat", slot: null, station: "drying_rack", cost: { meat: 2 }, seconds: 60, research: ["food_preservation"], makes: { dried_meat: 2 }, effects: {}, description: "More filling than raw meat.", icon: { sheet: "Flesh", x: 5, y: 4 } },
    { id: "travel_rations", name: "Travel Rations", slot: null, station: "drying_rack", cost: { dried_meat: 1, berries: 2 }, seconds: 60, research: ["food_preservation"], makes: { rations: 2 }, effects: {}, description: "The most filling food. Expeditions pack it first.", icon: { sheet: "Food", x: 1, y: 4 } },
    // Industrial
    { id: "make_steel", name: "Steel", slot: null, station: "steelworks", cost: { iron: 2, coal: 3 }, seconds: 60, research: ["steelmaking"], makes: { steel: 1 }, effects: {}, description: "Iron and coal into steel: 1 per batch.", icon: { sheet: "Money", x: 4, y: 0 } },
    { id: "make_glass", name: "Glass", slot: null, station: "glassworks", cost: { stone: 3, coal: 2 }, seconds: 50, research: ["glassblowing"], makes: { glass: 2 }, effects: {}, description: "Glass: 2 per batch.", icon: { sheet: "Potion", x: 7, y: 2 } },
    { id: "make_shot", name: "Musket Shot", slot: null, station: "gunsmith", cost: { iron: 1, coal: 1 }, seconds: 30, research: ["firearms"], makes: { shot: 10 }, effects: {}, description: "Ammunition for muskets: 10 per batch.", icon: { sheet: "Rock", x: 0, y: 0 } },
    { id: "steel_axe", name: "Steel Axe", slot: "tool", station: "steelworks", cost: { steel: 2, lumber: 1 }, seconds: 80, research: ["steelmaking"], effects: { gather: { chop: 2.8 } }, description: "Chop wood almost three times as fast.", icon: { sheet: "MedWep", x: 1, y: 1 } },
    { id: "steel_pick", name: "Steel Pick", slot: "tool", station: "steelworks", cost: { steel: 2, lumber: 1 }, seconds: 80, research: ["steelmaking"], effects: { gather: { mine: 2.8 } }, description: "Dig almost three times as fast.", icon: { sheet: "ShortWep", x: 2, y: 3 } },
    { id: "musket", name: "Musket", slot: "weapon", station: "gunsmith", cost: { steel: 3, lumber: 2 }, seconds: 120, research: ["firearms"], effects: { ranged: true, ammo: "shot", damage: 8, accuracy: 0.05 }, description: "Fires from range. +8 damage, +10 more with shot.", icon: { sheet: "Custom", x: 0, y: 0, name: "musket" } },
    { id: "steel_cuirass", name: "Steel Cuirass", slot: "body", station: "steelworks", cost: { steel: 5, leather: 2 }, seconds: 160, research: ["firearms"], effects: { armor: 0.45 }, description: "Takes 45% off every hit.", icon: { sheet: "Plate", x: 0, y: 0 } },
    // Modern
    { id: "make_fuel", name: "Fuel", slot: null, station: "refinery", cost: { oil: 3 }, seconds: 50, research: ["refining"], makes: { fuel: 2 }, effects: {}, description: "Crude oil into fuel for trucks: 2 per batch.", icon: { sheet: "Potion", x: 2, y: 0 } },
    { id: "make_plastic", name: "Plastic", slot: null, station: "refinery", cost: { oil: 2, coal: 1 }, seconds: 50, research: ["refining"], makes: { plastic: 2 }, effects: {}, description: "Plastic: 2 per batch.", icon: { sheet: "Potion", x: 5, y: 0 } },
    { id: "make_concrete", name: "Concrete", slot: null, station: "cement_works", cost: { stone: 3, coal: 1 }, seconds: 40, research: ["concrete"], makes: { concrete: 3 }, effects: {}, description: "Concrete: 3 per batch.", icon: { sheet: "Rock", x: 2, y: 0 } },
    { id: "make_electronics", name: "Electronics", slot: null, station: "electronics_plant", cost: { glass: 1, steel: 1, plastic: 1 }, seconds: 70, research: ["electronics"], makes: { electronics: 1 }, effects: {}, description: "Circuits and wiring: 1 per batch.", icon: { sheet: "Money", x: 6, y: 1 } },
    { id: "make_cartridges", name: "Rifle Cartridges", slot: null, station: "gunsmith", cost: { steel: 1, plastic: 1 }, seconds: 30, research: ["rifles"], makes: { cartridges: 15 }, effects: {}, description: "Ammunition for rifles: 15 per batch.", icon: { sheet: "Custom", x: 0, y: 0, name: "cartridges" } },
    { id: "rifle", name: "Rifle", slot: "weapon", station: "gunsmith", cost: { steel: 3, plastic: 2 }, seconds: 140, research: ["rifles"], effects: { ranged: true, ammo: "cartridges", damage: 12, accuracy: 0.1 }, description: "Fires from range, and true. +12 damage, +14 more with cartridges.", icon: { sheet: "Custom", x: 0, y: 0, name: "rifle" } },
    { id: "kevlar_vest", name: "Kevlar Vest", slot: "body", station: "loom", cost: { plastic: 4, cloth: 4 }, seconds: 160, research: ["rifles"], effects: { armor: 0.55 }, description: "Takes 55% off every hit.", icon: { sheet: "Armor", x: 7, y: 6 } },
    { id: "combat_helmet", name: "Combat Helmet", slot: "head", station: "steelworks", cost: { steel: 2, plastic: 1 }, seconds: 90, research: ["rifles"], effects: { armor: 0.2 }, description: "Takes 20% off every hit.", icon: { sheet: "Hat", x: 2, y: 1 } },
    { id: "power_drill", name: "Power Drill", slot: "tool", station: "electronics_plant", cost: { steel: 2, electronics: 1, plastic: 1 }, seconds: 100, research: ["electronics"], effects: { gather: { mine: 3.6 }, construct: 1.5 }, description: "Dig over three times as fast, build 50% faster.", icon: { sheet: "Custom", x: 0, y: 0, name: "power_drill" } },
    { id: "chainsaw", name: "Chainsaw", slot: "tool", station: "electronics_plant", cost: { steel: 2, electronics: 1, plastic: 1 }, seconds: 100, research: ["electronics"], effects: { gather: { chop: 3.6 } }, description: "Cut wood over three times as fast.", icon: { sheet: "Custom", x: 0, y: 0, name: "chainsaw" } },
    // Robotic & Space
    { id: "make_alloys", name: "Alloys", slot: null, station: "alloy_foundry", cost: { steel: 2, rare_minerals: 2 }, seconds: 80, research: ["advanced_alloys"], makes: { alloys: 1 }, effects: {}, description: "Light, hard alloys: 1 per batch.", icon: { sheet: "Custom", x: 0, y: 0, name: "alloy" } },
    { id: "make_circuits", name: "Circuits", slot: null, station: "chip_fab", cost: { electronics: 1, rare_minerals: 1, plastic: 1 }, seconds: 80, research: ["microchips"], makes: { circuits: 1 }, effects: {}, description: "Microchips on a board: 1 per batch.", icon: { sheet: "Custom", x: 0, y: 0, name: "circuit" } },
    { id: "make_power_cells", name: "Power Cells", slot: null, station: "battery_plant", cost: { rare_minerals: 1, plastic: 1, steel: 1 }, seconds: 50, research: ["power_storage"], makes: { power_cells: 6 }, effects: {}, description: "Power cells: 6 per batch. They also charge laser rifles, one per shot.", icon: { sheet: "Custom", x: 0, y: 0, name: "power_cell" } },
    { id: "worker_bot", name: "Worker Bot", slot: null, station: "robot_workshop", cost: { alloys: 3, circuits: 2, power_cells: 4 }, seconds: 300, research: ["robotics"], effects: {}, description: "Lends a hand with everything: each makes all work 5% faster (up to 10 bots).", icon: { sheet: "Custom", x: 0, y: 0, name: "worker_bot" } },
    { id: "laser_rifle", name: "Laser Rifle", slot: "weapon", station: "chip_fab", cost: { alloys: 3, circuits: 2 }, seconds: 200, research: ["energy_weapons"], effects: { ranged: true, ammo: "power_cells", damage: 16, accuracy: 0.15 }, description: "Fires from range and rarely misses. +16 damage, +20 more with power cells.", icon: { sheet: "Custom", x: 0, y: 0, name: "laser_rifle" } },
    { id: "powered_armor", name: "Powered Armour", slot: "body", station: "robot_workshop", cost: { alloys: 6, circuits: 2, power_cells: 4 }, seconds: 260, research: ["energy_weapons"], effects: { armor: 0.65, carry: 10 }, description: "Takes 65% off every hit, and carries 10 more.", icon: { sheet: "Custom", x: 0, y: 0, name: "powered_armor" } },
    { id: "visor_helmet", name: "Visor Helmet", slot: "head", station: "chip_fab", cost: { alloys: 2, circuits: 1 }, seconds: 120, research: ["energy_weapons"], effects: { armor: 0.25, accuracy: 0.05 }, description: "Takes 25% off every hit, and helps the aim.", icon: { sheet: "Hat", x: 3, y: 1 } },
    { id: "energy_shield", name: "Personal Shield", slot: "offhand", station: "chip_fab", cost: { alloys: 2, power_cells: 4, circuits: 1 }, seconds: 160, research: ["energy_shields"], effects: { block: 0.35 }, description: "Blocks 35% of hits.", icon: { sheet: "Custom", x: 0, y: 0, name: "energy_shield" } },
    { id: "plasma_cutter", name: "Plasma Cutter", slot: "tool", station: "robot_workshop", cost: { alloys: 2, power_cells: 2, circuits: 1 }, seconds: 160, research: ["robotics"], effects: { gather: { chop: 5, mine: 5 }, construct: 2 }, description: "Cut wood and rock five times as fast, build twice as fast.", icon: { sheet: "Custom", x: 0, y: 0, name: "plasma_cutter" } },
    { id: "medkit", name: "Emergency Medkit", slot: null, station: "loom", cost: { cloth: 3, glass: 1, herbs: 2 }, seconds: 90, research: ["sanitation"], effects: {}, description: "Used by itself the moment someone is struck down: they get straight back up.", icon: { sheet: "Potion", x: 3, y: 0 } },
    // relics (found, never made)
    // boss trophies (relics: each one boss's, found only on its body)
    { id: "black_blade", name: "The Black Blade", slot: "weapon", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { damage: 16, accuracy: 0.1 }, description: "The Black Knight's sword. +16 damage, and it rarely misses.", icon: { sheet: "LongWep", x: 3, y: 0 } },
    { id: "dragonscale_armor", name: "Dragonscale Armour", slot: "body", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { armor: 0.6, beastDamage: 6 }, description: "Scales from Vermithrax the Red. Takes 60% off every hit, and beasts fear it.", icon: { sheet: "Armor", x: 4, y: 7 } },
    { id: "barons_pistols", name: "The Baron's Pistols", slot: "weapon", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { ranged: true, ammo: "shot", damage: 14, accuracy: 0.1 }, description: "A matched pair. +14 damage from range (+10 more with shot).", icon: { sheet: "Custom", x: 0, y: 0, name: "pistols" } },
    { id: "colossus_core", name: "Colossus Core", slot: "charm", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { armor: 0.15, morale: 5 }, description: "Still warm. Its bearer shrugs off blows (15% off every hit), and feels unstoppable.", icon: { sheet: "Custom", x: 0, y: 0, name: "core" } },
    { id: "warlords_banner", name: "Warlord's Banner", slot: "charm", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { morale: 12, damage: 3 }, description: "Taken from the Warlord. +12 morale and +3 damage for whoever carries it.", icon: { sheet: "Scroll", x: 2, y: 0 } },
    { id: "tank_plating", name: "Tank Plating", slot: "body", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { armor: 0.65 }, description: "Cut from the War Machine. Takes 65% off every hit.", icon: { sheet: "Armor", x: 5, y: 6 } },
    { id: "pirate_crown", name: "The Pirate King's Crown", slot: "head", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { armor: 0.2, morale: 10, accuracy: 0.1 }, description: "Heavy, gaudy, and yours now. +10 morale, better aim, 20% off every hit.", icon: { sheet: "Custom", x: 0, y: 0, name: "crown" } },
    { id: "reaver_core", name: "Reaver Core", slot: "charm", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { damage: 8, armor: 0.1 }, description: "The Star Reaver's heart. +8 damage and 10% off every hit.", icon: { sheet: "Custom", x: 0, y: 0, name: "core" } },
    { id: "abomination_heart", name: "The Abomination's Heart", slot: "charm", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { damage: 6, beastDamage: 4 }, description: "It still beats. +6 damage for whoever dares to carry it.", icon: { sheet: "Flesh", x: 1, y: 0 } },
    { id: "deaths_bargain", name: "Death's Bargain", slot: null, station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: {}, description: "An old coin. If the founder dies, Death takes the coin instead. Once.", icon: { sheet: "Magic", x: 7, y: 1 } },
    { id: "rat_king_crown", name: "The Rat King's Crown", slot: "head", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { armor: 0.15, accuracy: 0.1, beastDamage: 8 }, description: "A crown of knotted tails, still twitching. 15% off every hit, better aim, and beasts shrink from it.", icon: { sheet: "Custom", x: 0, y: 0, name: "crown" } },
    { id: "bearskin_cloak", name: "Bearskin Cloak", slot: "body", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { armor: 0.3, beastDamage: 5, morale: 4 }, description: "The Cave Bear's pelt. Takes 30% off every hit, beasts fear its wearer, and they stand taller in it.", icon: { sheet: "Armor", x: 0, y: 7 } },
    { id: "staff_of_rime", name: "Staff of Rime", slot: "weapon", station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: { ranged: true, damage: 15, accuracy: 0.1 }, description: "The Frost Archmage's staff, cold enough to burn. +15 damage from range, and it rarely misses.", icon: { sheet: "Magic", x: 3, y: 3 } },
    { id: "phoenix_feather", name: "Phoenix Feather", slot: null, station: "campfire", cost: {}, seconds: 0, research: ["__relic"], relic: true, effects: {}, description: "Warm to the touch. The next person to die in town rises from the ashes instead. Once.", icon: { sheet: "Custom", x: 0, y: 0, name: "phoenix_feather" } },
    { id: "truck", name: "Truck", slot: null, station: "garage", cost: { steel: 10, electronics: 3, plastic: 4 }, seconds: 400, research: ["motor_transport"], effects: {}, description: `An expedition that takes a truck (and fuel) carries far more and travels far faster.`, icon: { sheet: "Custom", x: 0, y: 0, name: "truck" } },
    // Occult
    { id: "spirit_totem", name: "Spirit Totem", slot: null, station: "campfire", cost: { bone: 8, herbs: 4, hide: 2 }, seconds: 120, research: ["spirit_binding"], effects: {}, description: "If the founder dies, they come back, once.", icon: { sheet: "Magic", x: 4, y: 1 } },
    // Medieval: refining (raw -> refined, into storage)
    { id: "smelt_iron", name: "Iron", slot: null, station: "bloomery", cost: { iron_ore: 2, wood: 2 }, seconds: 60, research: ["iron_working"], makes: { iron: 1 }, effects: {}, description: "Smelt ore into iron: 1 per batch.", icon: { sheet: "Money", x: 3, y: 0 } },
    { id: "saw_lumber", name: "Lumber", slot: null, station: "sawmill", cost: { wood: 3 }, seconds: 30, research: ["carpentry"], makes: { lumber: 2 }, effects: {}, description: "Saw wood into lumber: 2 per batch.", icon: { sheet: "Money", x: 2, y: 5 } },
    { id: "fire_bricks", name: "Bricks", slot: null, station: "kiln", cost: { clay: 3 }, seconds: 40, research: ["masonry"], makes: { bricks: 2 }, effects: {}, description: "Fire clay into bricks: 2 per batch.", icon: { sheet: "Money", x: 0, y: 0 } },
    { id: "cure_leather", name: "Leather", slot: null, station: "tannery", cost: { hide: 2 }, seconds: 40, research: ["leatherworking"], makes: { leather: 2 }, effects: {}, description: "Cure hides into leather: 2 per batch.", icon: { sheet: "Flesh", x: 6, y: 1 } },
    { id: "weave_cloth", name: "Cloth", slot: null, station: "loom", cost: { fiber: 4 }, seconds: 40, research: ["weaving"], makes: { cloth: 2 }, effects: {}, description: "Weave fiber into cloth: 2 per batch.", icon: { sheet: "Armor", x: 2, y: 5 } },
    { id: "grind_flour", name: "Flour", slot: null, station: "windmill", cost: { grain: 4 }, seconds: 30, research: ["milling"], makes: { flour: 3 }, effects: {}, description: "Grind grain into flour: 3 per batch.", icon: { sheet: "Chest1", x: 0, y: 2 } },
    { id: "bake_bread", name: "Bread", slot: null, station: "bakery", cost: { flour: 2 }, seconds: 40, research: ["baking"], makes: { bread: 3 }, effects: {}, description: "Filling and keeps well: 3 loaves per batch.", icon: { sheet: "Food", x: 0, y: 4 } },
    { id: "arrows", name: "Arrows", slot: null, station: "workbench", cost: { wood: 1, flint: 1 }, seconds: 30, research: ["archery"], makes: { arrows: 8 }, effects: {}, description: "Ammunition for bows: 8 per batch, one per shot.", icon: { sheet: "Ammo", x: 5, y: 2 } },
    // Medieval: gear
    { id: "iron_axe", name: "Iron Axe", slot: "tool", station: "smithy", cost: { iron: 2, lumber: 1 }, seconds: 60, research: ["iron_working"], effects: { gather: { chop: 2 } }, description: "Chop wood twice as fast.", icon: { sheet: "MedWep", x: 1, y: 1 } },
    { id: "iron_pick", name: "Iron Pick", slot: "tool", station: "smithy", cost: { iron: 2, lumber: 1 }, seconds: 60, research: ["iron_working"], effects: { gather: { mine: 2 } }, description: "Dig and break rock twice as fast.", icon: { sheet: "ShortWep", x: 1, y: 3 } },
    { id: "iron_hammer", name: "Iron Hammer", slot: "tool", station: "smithy", cost: { iron: 2, lumber: 1 }, seconds: 60, research: ["iron_working"], effects: { gather: { mine: 1.4 }, construct: 1.6 }, description: "Build 60% faster.", icon: { sheet: "ShortWep", x: 0, y: 4 } },
    { id: "iron_sword", name: "Iron Sword", slot: "weapon", station: "smithy", cost: { iron: 3, leather: 1 }, seconds: 90, research: ["iron_working"], effects: { damage: 8, accuracy: 0.1 }, description: "+8 melee damage, much better aim.", icon: { sheet: "MedWep", x: 0, y: 0 } },
    { id: "bow", name: "Bow", slot: "weapon", station: "workbench", cost: { lumber: 2, fiber: 2 }, seconds: 60, research: ["archery"], effects: { ranged: true, ammo: "arrows", damage: 3, accuracy: 0.05 }, description: "Shoots from range. +3 damage, +5 more with arrows.", icon: { sheet: "Ammo", x: 0, y: 1 } },
    { id: "leather_cap", name: "Leather Cap", slot: "head", station: "tannery", cost: { leather: 2 }, seconds: 50, research: ["leatherworking"], effects: { armor: 0.12 }, description: "Takes 12% off every hit.", icon: { sheet: "Hat", x: 0, y: 2 } },
    { id: "leather_armor", name: "Leather Armor", slot: "body", station: "tannery", cost: { leather: 5 }, seconds: 90, research: ["leatherworking"], effects: { armor: 0.28 }, description: "Takes 28% off every hit.", icon: { sheet: "Armor", x: 1, y: 7 } },
    { id: "iron_helm", name: "Iron Helm", slot: "head", station: "smithy", cost: { iron: 3 }, seconds: 80, research: ["armoring"], effects: { armor: 0.15 }, description: "Takes 15% off every hit.", icon: { sheet: "Hat", x: 1, y: 1 } },
    { id: "chainmail", name: "Chainmail", slot: "body", station: "smithy", cost: { iron: 6, leather: 2 }, seconds: 150, research: ["armoring"], effects: { armor: 0.38 }, description: "Takes 38% off every hit.", icon: { sheet: "Armor", x: 0, y: 8 } },
    { id: "iron_shield", name: "Iron-Rimmed Shield", slot: "offhand", station: "smithy", cost: { iron: 2, lumber: 2 }, seconds: 80, research: ["armoring"], effects: { block: 0.25 }, description: "Blocks 25% of blows.", icon: { sheet: "Shield", x: 4, y: 0 } },
    { id: "wool_cloak", name: "Cloak", slot: "charm", station: "loom", cost: { cloth: 3 }, seconds: 50, research: ["weaving"], effects: { morale: 4, armor: 0.03 }, description: "+4 morale; a little protection.", icon: { sheet: "Armor", x: 1, y: 5 } },
    { id: "wheelbarrow", name: "Wheelbarrow", slot: "pack", station: "workbench", cost: { lumber: 4, iron: 1 }, seconds: 80, research: ["carts"], effects: { carry: 12 }, description: "Carry 12 more.", icon: { sheet: "Chest1", x: 3, y: 0 } },
    { id: "bandage", name: "Bandage", slot: null, station: "loom", cost: { cloth: 1, herbs: 1 }, seconds: 30, research: ["physick"], effects: {}, description: "Like a poultice but better: stops bleeding, +35 health.", icon: { sheet: "Scroll", x: 5, y: 4 } }
  ];
  var ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  var CRAFT_QUEUE_SLOTS = 3;
  var MAX_ORDER = 10;
  var POT_STORAGE = 5;
  var MAX_POTS = 10;
  var SNARE_CATCH = 0.2;
  var SNARE_BREAK = 0.15;
  var POULTICE_HP = 20;
  var BEDROLL_SLEEP = 0.9;
  var WATERSKIN_SPEEDUP = 0.9;
  var AMMO_DAMAGE = { sling_stones: 3, arrows: 5, shot: 10, cartridges: 14, power_cells: 20 };
  var BANDAGE_HP = 35;

  // src/shared/data/eras.ts
  var ERAS = ["neolithic", "medieval", "industrial", "modern", "space"];
  var ERA_NAMES = {
    neolithic: "Neolithic",
    medieval: "Medieval",
    industrial: "Industrial",
    modern: "Modern",
    space: "Robotic & Space"
  };
  var eraReached = (current, era = "neolithic") => ERAS.indexOf(current) >= ERAS.indexOf(era);
  var nextEra = (e) => ERAS[ERAS.indexOf(e) + 1] ?? null;

  // src/shared/sim/research.ts
  function modifiers(r) {
    const m = { gather: { chop: 1, mine: 1, forage: 1 }, researchSlots: RESEARCH_QUEUE_BASE, researchSpeed: 1, carryBonus: 0, storage: 1, cropSpeed: 1, queueSlots: 0 };
    for (const id of r.done) {
      for (const e of TOPIC_BY_ID[id]?.effects ?? []) {
        switch (e.type) {
          case "gatherSpeed":
            m.gather[e.anim] *= e.mult;
            break;
          case "researchSlots":
            m.researchSlots += e.add;
            break;
          case "researchSpeed":
            m.researchSpeed *= e.mult;
            break;
          case "carry":
            m.carryBonus += e.add;
            break;
          case "storage":
            m.storage *= e.mult;
            break;
          case "cropSpeed":
            m.cropSpeed *= e.mult;
            break;
          case "queueSlots":
            m.queueSlots += e.add;
            break;
          case "eraCapstone":
            break;
        }
      }
    }
    return m;
  }
  function prereqsMet(r, id, era = "neolithic") {
    const t = TOPIC_BY_ID[id];
    if (!t) return { ok: false, reason: "Unknown topic" };
    if (t.hidden && !(r.revealed ?? []).includes(t.id)) return { ok: false, reason: "Undiscovered" };
    if (!eraReached(era, t.era)) return { ok: false, reason: `Opens in the ${ERA_NAMES[t.era]} era` };
    const missing = t.prereqs.filter((p) => !r.done.includes(p) && !r.queue.includes(p));
    if (missing.length) return { ok: false, reason: `Needs ${missing.map((p) => TOPIC_BY_ID[p].name).join(", ")}` };
    if (t.requiresCount) {
      const sameEra = (d) => (TOPIC_BY_ID[d]?.era ?? "neolithic") === (t.era ?? "neolithic");
      const others = r.done.filter((d) => !t.prereqs.includes(d) && sameEra(d)).length;
      if (others < t.requiresCount) return { ok: false, reason: `Needs ${t.requiresCount} other topics researched (${others} so far)` };
    }
    return { ok: true };
  }
  function canQueue(r, id, era = "neolithic") {
    if (r.done.includes(id)) return { ok: false, reason: "Already researched" };
    if (r.queue.includes(id)) return { ok: false, reason: "Already queued" };
    const pre = prereqsMet(r, id, era);
    if (!pre.ok) return pre;
    if (r.queue.length >= modifiers(r).researchSlots) return { ok: false, reason: "Research queue is full" };
    return { ok: true };
  }
  function queueResearch(r, id, era = "neolithic") {
    const check = canQueue(r, id, era);
    if (check.ok) r.queue.push(id);
    return check;
  }
  function cancelResearch(r, id) {
    if (!r.queue.includes(id)) return;
    const drop = /* @__PURE__ */ new Set([id]);
    for (const q of r.queue) if (TOPIC_BY_ID[q].prereqs.some((p) => drop.has(p))) drop.add(q);
    r.queue = r.queue.filter((q) => !drop.has(q));
  }
  function researchNext(r, id) {
    const i = r.queue.indexOf(id);
    if (i <= 0) return;
    if (!TOPIC_BY_ID[id].prereqs.every((p) => r.done.includes(p))) return;
    r.queue.splice(i, 1);
    r.queue.unshift(id);
  }
  function researchStation(s) {
    let best = { buildingId: null, label: "camp", mult: 1 };
    for (const b of s.buildings) {
      const st = RESEARCH_STATIONS[b.def];
      if (b.status === "done" && st && (best.buildingId === null || st.mult > best.mult)) best = { buildingId: b.id, label: st.label, mult: st.mult };
    }
    return best;
  }

  // src/shared/data/people.ts
  var NAMES = [
    "Arn",
    "Bera",
    "Cato",
    "Dagna",
    "Edda",
    "Fen",
    "Gudrun",
    "Hakon",
    "Ida",
    "Joro",
    "Kel",
    "Lif",
    "Maren",
    "Nils",
    "Orla",
    "Pell",
    "Runa",
    "Sten",
    "Tova",
    "Ulf",
    "Vesna",
    "Wren",
    "Yrsa",
    "Asa",
    "Brand",
    "Carro",
    "Doran",
    "Elka",
    "Frode",
    "Hild"
  ];
  var SKINS = ["#f0cfa8", "#e3b890", "#c9956a", "#a0704a", "#7a5236"];
  var HAIR_COLORS = ["#2a1c14", "#4a3020", "#6e4a2c", "#9a6e40", "#c49a62", "#3c3434", "#8a3a22"];
  var HAIR_STYLES = ["plain", "long", "ponytail", "unkempt", "messy1", "messy2", "loose", "bedhead", "shoulderl", "bangs", "shortknot", "longknot"];
  var HIDE_COLORS = ["#8a6a48", "#7a5a3a", "#9c7c54", "#6c5040", "#8c7458"];
  function randomLook(rng, elder = false) {
    const gender = rng.chance(0.5) ? "m" : "f";
    return {
      gender,
      skin: rng.pick(SKINS),
      hair: rng.pick(HAIR_STYLES),
      hairColor: elder ? rng.pick(["#d8d4cc", "#b8b2a8", "#9a948c"]) : rng.pick(HAIR_COLORS),
      beard: gender === "m" && rng.chance(elder ? 0.8 : 0.4),
      outfit: rng.pick(HIDE_COLORS)
    };
  }
  var RECRUIT_TYPES = {
    founder: { id: "founder", name: "Founder", skills: { gathering: [3, 4], construction: [2, 3], research: [2, 3] }, passionFor: ["gathering", "construction", "research"] },
    wanderer: { id: "wanderer", name: "Wanderer", skills: {}, passionFor: [] },
    hunter: { id: "hunter", name: "Hunter", skills: { melee: [4, 8], ranged: [4, 8], animals: [2, 5] }, passionFor: ["melee", "ranged"] },
    gatherer: { id: "gatherer", name: "Gatherer", skills: { gathering: [4, 8], farming: [3, 7] }, passionFor: ["gathering", "farming"] },
    crafter: { id: "crafter", name: "Crafter", skills: { crafting: [4, 8], construction: [4, 8] }, passionFor: ["crafting", "construction"] },
    child: { id: "child", name: "Child", skills: {}, passionFor: [] },
    werewolf: { id: "werewolf", name: "Werewolf", skills: { melee: [8, 12], gathering: [3, 6] }, passionFor: ["melee"] },
    vampire: { id: "vampire", name: "Vampire", skills: { melee: [6, 10], social: [6, 10], research: [4, 7] }, passionFor: ["social", "melee"] },
    hermit: { id: "hermit", name: "Hermit", skills: { research: [5, 9], medicine: [3, 6], melee: [1, 2] }, passionFor: ["research", "medicine"] },
    elder: { id: "elder", name: "Elder", skills: { research: [5, 9], social: [4, 8], melee: [1, 1], ranged: [1, 1] }, passionFor: ["research", "social"] }
  };
  var ARRIVING_TYPES = { wanderer: 4, gatherer: 2, crafter: 2, hunter: 2, elder: 1, hermit: 0.4 };
  var TRAITS = [
    { id: "hard_worker", name: "Hard Worker", description: "Works 20% faster.", excludes: ["lazy"] },
    { id: "lazy", name: "Lazy", description: "Works 20% slower.", excludes: ["hard_worker"] },
    { id: "quick_learner", name: "Quick Learner", description: "Gains skill 50% faster." },
    { id: "glutton", name: "Glutton", description: "Gets hungry 50% faster." },
    { id: "night_owl", name: "Night Owl", description: "Works 20% faster at night, 10% slower by day." },
    { id: "loner", name: "Loner", description: "Unhappy when more than four people live in town." },
    { id: "green_thumb", name: "Green Thumb", description: "Farms 25% faster and harvests 25% more." },
    { id: "tough", name: "Tough", description: "More health, and takes less damage." },
    { id: "coward", name: "Coward", description: "Backs out of the front line once hurt." }
  ];
  var LATER_TRAITS = [{ id: "frail", name: "Frail", description: "Brought back from the cold: less health (each time)." }];
  var TRAIT_BY_ID = Object.fromEntries([...TRAITS, ...LATER_TRAITS].map((t) => [t.id, t]));
  var JOBS = ["haul", "construct", "farm", "craft", "research", "gather", "defend"];
  var JOB_SKILL = { haul: null, construct: "construction", farm: "farming", craft: "crafting", research: "research", gather: "gathering", defend: "melee" };
  var FOOD_VALUE = { grain: 0.4, berries: 0.5, meat: 0.7, dried_meat: 0.9, bread: 0.9, rations: 1 };

  // src/shared/data/skills.ts
  var SKILLS = ["construction", "crafting", "research", "farming", "cooking", "gathering", "medicine", "melee", "ranged", "social", "animals"];
  var MAX_SKILL = 20;
  function skillSpeed(level) {
    return 1 + (level - 1) * 3 / 14;
  }
  function xpToNext(level) {
    return 40 * level;
  }
  function gainXp(s, xp) {
    const before = s.level;
    s.xp += xp;
    while (s.level < MAX_SKILL && s.xp >= xpToNext(s.level)) {
      s.xp -= xpToNext(s.level);
      s.level++;
    }
    if (s.level === MAX_SKILL) s.xp = 0;
    return s.level !== before;
  }

  // src/shared/data/expeditions.ts
  var DESTINATIONS = [
    {
      id: "berry_thicket",
      name: "Berry Thicket",
      type: "gather",
      outSeconds: 70,
      workSeconds: 40,
      secondsPerUnit: 4,
      loot: { berries: 6, fiber: 3, herbs: 2 },
      threats: "A wild boar, now and then",
      encounters: { arrival: 0.15, ambush: 0, groups: [{ enemies: { boar: 1 }, weight: 1 }] },
      recommendedParty: 1,
      scenery: "thicket",
      description: "Bramble and fruit a short walk away."
    },
    {
      id: "riverbank",
      name: "Riverbank",
      type: "gather",
      outSeconds: 140,
      workSeconds: 80,
      secondsPerUnit: 5,
      loot: { clay: 4, flint: 3, stone: 3 },
      threats: "Low: a stray wolf",
      encounters: { arrival: 0.05, ambush: 0.03, groups: [{ enemies: { wolf: 1 }, weight: 1 }] },
      recommendedParty: 2,
      scenery: "river",
      description: "Clay banks and flint in the shallows."
    },
    {
      id: "deep_woods",
      name: "Deep Woods",
      type: "hunt",
      outSeconds: 230,
      workSeconds: 140,
      secondsPerUnit: 7,
      loot: { meat: 5, hide: 3, bone: 3 },
      threats: "Wolves",
      encounters: {
        arrival: 0.6,
        ambush: 0.1,
        groups: [
          { enemies: { wolf: 2 }, weight: 3 },
          { enemies: { wolf: 3 }, weight: 2 },
          { enemies: { wolf_alpha: 1, wolf: 2 }, weight: 1 }
        ]
      },
      recommendedParty: 2,
      research: "spear_hunting",
      scenery: "woods",
      description: "Game trails under the old pines."
    },
    {
      id: "old_quarry",
      name: "Old Quarry",
      type: "gather",
      outSeconds: 350,
      workSeconds: 200,
      secondsPerUnit: 4,
      loot: { stone: 6, flint: 4 },
      threats: "Rival tribe scouts",
      encounters: {
        arrival: 0.45,
        ambush: 0.15,
        groups: [
          { enemies: { rival_spear: 2 }, weight: 2 },
          { enemies: { rival_spear: 2, rival_slinger: 1 }, weight: 1 }
        ]
      },
      recommendedParty: 3,
      research: "scouting",
      scenery: "quarry",
      description: "Broken stone in heaps, if you can carry it."
    },
    {
      id: "bear_cave",
      name: "Bear Cave",
      type: "legendary",
      outSeconds: 700,
      workSeconds: 400,
      secondsPerUnit: 8,
      loot: { hide: 4, bone: 4, meat: 3 },
      guaranteed: { totem: 1 },
      threats: "The Cave Bear (boss)",
      encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { cave_bear: 1 }, weight: 1 }] },
      recommendedParty: 3,
      research: "scouting",
      scenery: "cave",
      description: "Something huge sleeps here. Its totem is needed for the Elder Lodge."
    },
    // Medieval (times stretched by the era multiplier)
    {
      id: "iron_hills",
      name: "Iron Hills",
      type: "gather",
      outSeconds: 260,
      workSeconds: 200,
      secondsPerUnit: 5,
      loot: { iron_ore: 5, stone: 3, flint: 1 },
      threats: "Wolves and bandits",
      encounters: {
        arrival: 0.3,
        ambush: 0.1,
        groups: [
          { enemies: { wolf: 3 }, weight: 1 },
          { enemies: { bandit: 2 }, weight: 1 }
        ]
      },
      recommendedParty: 3,
      research: "mining",
      era: "medieval",
      scenery: "quarry",
      description: "Rust-red rock full of ore."
    },
    {
      id: "old_ruins",
      name: "Old Ruins",
      type: "salvage",
      outSeconds: 320,
      workSeconds: 240,
      secondsPerUnit: 7,
      loot: { bricks: 3, iron: 2, cloth: 2, bone: 1 },
      threats: "Bandits hiding in the rubble",
      encounters: {
        arrival: 0.5,
        ambush: 0.1,
        groups: [
          { enemies: { bandit: 2, bandit_archer: 1 }, weight: 2 },
          { enemies: { wolf: 3 }, weight: 1 }
        ]
      },
      recommendedParty: 3,
      research: "writing",
      era: "medieval",
      scenery: "quarry",
      description: "Fallen walls of an older people. Old writings here can speed your research."
    },
    {
      id: "bandit_camp",
      name: "Bandit Camp",
      type: "clear",
      outSeconds: 300,
      workSeconds: 100,
      secondsPerUnit: 6,
      loot: { iron: 2, cloth: 2, bread: 3, leather: 2 },
      threats: "A bandit gang and its chief",
      encounters: {
        arrival: 1,
        ambush: 0,
        groups: [
          { enemies: { bandit: 3, bandit_archer: 1 }, weight: 2 },
          { enemies: { bandit: 2, bandit_archer: 1, bandit_chief: 1 }, weight: 1 }
        ]
      },
      recommendedParty: 3,
      era: "medieval",
      scenery: "woods",
      description: "Win here and the raids stop for a few days."
    },
    {
      id: "lost_village",
      name: "Lost Village",
      type: "rescue",
      outSeconds: 360,
      workSeconds: 120,
      secondsPerUnit: 10,
      loot: { grain: 4, cloth: 1 },
      threats: "Bandits on the road",
      encounters: { arrival: 0.35, ambush: 0.15, groups: [{ enemies: { bandit: 2 }, weight: 1 }] },
      recommendedParty: 2,
      era: "medieval",
      scenery: "river",
      description: "Survivors of a burned village. Bring some of them home."
    },
    // Industrial (times stretched 6x)
    {
      id: "coal_fields",
      name: "Coal Fields",
      type: "gather",
      outSeconds: 240,
      workSeconds: 200,
      secondsPerUnit: 4,
      loot: { coal: 6, iron_ore: 3, stone: 2 },
      threats: "Gangs",
      encounters: { arrival: 0.3, ambush: 0.15, groups: [{ enemies: { gangster: 2 }, weight: 1 }] },
      recommendedParty: 3,
      research: "coal_mining",
      era: "industrial",
      scenery: "quarry",
      description: "Black seams in the hills, free for the taking."
    },
    {
      id: "abandoned_mill",
      name: "Abandoned Mill",
      type: "salvage",
      outSeconds: 300,
      workSeconds: 240,
      secondsPerUnit: 6,
      loot: { steel: 2, glass: 2, cloth: 3, lumber: 3 },
      threats: "Squatters with guns",
      encounters: { arrival: 0.5, ambush: 0.1, groups: [{ enemies: { gangster: 3 }, weight: 1 }] },
      recommendedParty: 3,
      era: "industrial",
      scenery: "quarry",
      description: "A gutted mill. Old records here can speed your research."
    },
    {
      id: "gang_hideout",
      name: "Gang Hideout",
      type: "clear",
      outSeconds: 280,
      workSeconds: 100,
      secondsPerUnit: 6,
      loot: { steel: 3, shot: 20, bread: 4 },
      threats: "The gang, in force",
      encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { gangster: 4 }, weight: 2 }, { enemies: { gangster: 3, rifleman: 1 }, weight: 1 }] },
      recommendedParty: 3,
      era: "industrial",
      scenery: "woods",
      description: "Break the gang and the raids stop for a few days (and any captives come home)."
    },
    // Modern (times stretched 15x: take a truck)
    {
      id: "oil_fields",
      name: "Oil Fields",
      type: "gather",
      outSeconds: 240,
      workSeconds: 200,
      secondsPerUnit: 4,
      loot: { oil: 6, coal: 2, steel: 1 },
      threats: "Marauders",
      encounters: { arrival: 0.3, ambush: 0.15, groups: [{ enemies: { raider: 2 }, weight: 2 }, { enemies: { raider: 3 }, weight: 1 }] },
      recommendedParty: 3,
      research: "oil_drilling",
      era: "modern",
      scenery: "quarry",
      description: "Abandoned wells that still seep oil."
    },
    {
      id: "ghost_city",
      name: "Ghost City",
      type: "salvage",
      outSeconds: 300,
      workSeconds: 240,
      secondsPerUnit: 6,
      loot: { electronics: 2, plastic: 3, steel: 3, glass: 2, concrete: 3 },
      threats: "Marauders among the ruins",
      encounters: { arrival: 0.5, ambush: 0.1, groups: [{ enemies: { raider: 3 }, weight: 2 }, { enemies: { trooper: 2 }, weight: 1 }] },
      recommendedParty: 3,
      era: "modern",
      scenery: "quarry",
      description: "An emptied city. Old files here can speed your research."
    },
    {
      id: "militia_compound",
      name: "Militia Compound",
      type: "clear",
      outSeconds: 280,
      workSeconds: 100,
      secondsPerUnit: 6,
      loot: { cartridges: 30, electronics: 2, fuel: 6 },
      threats: "Troopers and their commander",
      encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { trooper: 3, commander: 1 }, weight: 1 }, { enemies: { raider: 3, trooper: 1 }, weight: 1 }] },
      recommendedParty: 3,
      era: "modern",
      scenery: "woods",
      description: "Take the compound and the raids stop for a few days (and any captives come home)."
    },
    // Robotic & Space (times stretched 40x: take a truck)
    {
      id: "crater",
      name: "Meteor Crater",
      type: "gather",
      outSeconds: 200,
      workSeconds: 200,
      secondsPerUnit: 5,
      loot: { rare_minerals: 5, stone: 3, steel: 1 },
      threats: "Drones guarding the site",
      encounters: { arrival: 0.35, ambush: 0.1, groups: [{ enemies: { combat_drone: 2 }, weight: 2 }, { enemies: { combat_drone: 1, war_bot: 1 }, weight: 1 }] },
      recommendedParty: 3,
      research: "deep_mining",
      era: "space",
      scenery: "quarry",
      description: "A fresh crater, glittering with rare minerals."
    },
    {
      id: "fallen_satellite",
      name: "Fallen Satellite",
      type: "salvage",
      outSeconds: 260,
      workSeconds: 220,
      secondsPerUnit: 7,
      loot: { circuits: 2, alloys: 2, power_cells: 4, electronics: 2 },
      threats: "Pirates want it too",
      encounters: { arrival: 0.5, ambush: 0.15, groups: [{ enemies: { space_pirate: 2 }, weight: 2 }, { enemies: { space_pirate: 3 }, weight: 1 }] },
      recommendedParty: 3,
      era: "space",
      scenery: "woods",
      description: "A satellite came down in the forest. Its data banks can speed your research."
    },
    {
      id: "rogue_foundry",
      name: "Rogue Foundry",
      type: "clear",
      outSeconds: 260,
      workSeconds: 100,
      secondsPerUnit: 6,
      loot: { alloys: 4, circuits: 3, power_cells: 10 },
      threats: "War bots and the AI that builds them",
      encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { war_bot: 2, combat_drone: 2 }, weight: 2 }, { enemies: { rogue_ai: 1, combat_drone: 2 }, weight: 1 }] },
      recommendedParty: 3,
      era: "space",
      scenery: "quarry",
      description: "Shut down the machines and the raids stop for a few days (and any captives come home)."
    },
    // Era bosses (legendary: a boss and its guard; rare finds, and a relic more often than not)
    { id: "dark_keep", name: "The Dark Keep", type: "legendary", outSeconds: 400, workSeconds: 200, secondsPerUnit: 8, loot: { iron: 5, cloth: 4, bread: 4 }, guaranteed: { iron: 10 }, threats: "The Black Knight (boss)", encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { black_knight: 1, soldier: 2 }, weight: 1 }] }, recommendedParty: 3, research: "armoring", era: "medieval", scenery: "cave", description: "A knight in black armour holds the keep, and the roads around it." },
    { id: "dragon_lair", name: "The Red Crags", type: "legendary", outSeconds: 440, workSeconds: 200, secondsPerUnit: 8, loot: { iron: 6, cloth: 6, bread: 4 }, guaranteed: { iron: 14, leather: 8 }, threats: "Vermithrax the Red (dragon)", encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { dragon: 1 }, weight: 1 }] }, recommendedParty: 3, research: "fortification", era: "medieval", scenery: "cave", description: "A dragon sleeps on a hoard in the crags. Bring your best, and water for the burns." },
    { id: "baron_manor", name: "The Baron's Works", type: "legendary", outSeconds: 360, workSeconds: 200, secondsPerUnit: 7, loot: { steel: 4, glass: 4, coal: 6 }, guaranteed: { steel: 12 }, threats: "The Iron Baron and his Iron Colossus (bosses)", encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { iron_baron: 1, iron_colossus: 1 }, weight: 1 }] }, recommendedParty: 3, research: "firearms", era: "industrial", scenery: "quarry", description: "A robber baron and his hired guns. His vaults are full." },
    { id: "warlord_fort", name: "The Warlord's Fort", type: "legendary", outSeconds: 340, workSeconds: 200, secondsPerUnit: 7, loot: { electronics: 3, fuel: 8, concrete: 6 }, guaranteed: { electronics: 10 }, threats: "The Warlord and his War Machine (bosses)", encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { warlord: 1, war_machine: 1 }, weight: 1 }] }, recommendedParty: 3, research: "rifles", era: "modern", scenery: "woods", description: "A warlord has carved out a kingdom in the hills." },
    { id: "pirate_flagship", name: "The Pirate Flagship", type: "legendary", outSeconds: 320, workSeconds: 200, secondsPerUnit: 7, loot: { alloys: 3, circuits: 3, power_cells: 10 }, guaranteed: { alloys: 12 }, threats: "The Pirate King and the Star Reaver (bosses)", encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { pirate_king: 1, star_mech: 1 }, weight: 1 }] }, recommendedParty: 3, research: "energy_weapons", era: "space", scenery: "quarry", description: "The pirates crashed their flagship here. Their king is still aboard." }
  ];
  var DESTINATION_BY_ID = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));
  var CLEARED_RAID_DELAY_DAYS = 3;
  var SALVAGE_NOTES_CHANCE = 0.5;
  var RESCUE_MAX = 2;
  var TRUCK_CARRY = 80;
  var TRUCK_SPEEDUP = 0.4;
  var TRUCK_FUEL = 6;
  var TRUCK_LOST_ON_LOSS = 0.5;
  var MAX_PARTY = 3;
  var MAX_EXPEDITIONS = 2;
  var LOADED_SLOWDOWN = 0.25;
  var CARRYING_WOUNDED_SLOWDOWN = 0.4;
  var STANCES = {
    cautious: { name: "Cautious", retreatAt: 0.6, description: "Falls back early and avoids trouble." },
    balanced: { name: "Balanced", retreatAt: 0.4, description: "Fights on while it goes well." },
    bold: { name: "Bold", retreatAt: 0.2, description: "Fights to the last and takes risks for reward." }
  };
  var SCOUT_AVOID = 0.3;
  var PORTER_CARRY = 1.5;

  // src/shared/data/raids.ts
  var RAID_KINDS = [
    { id: "wolves", name: "Wolf pack", goal: "harm", enemies: { wolf: 8, wolf_alpha: 20 }, fromDay: 0, untilEra: "industrial", weight: 3, speed: 80, bribable: false, plural: false },
    { id: "boars", name: "Boar charge", goal: "harm", enemies: { boar: 11 }, fromDay: 0, untilEra: "medieval", weight: 2, speed: 60, bribable: false, plural: false },
    { id: "rivals", name: "Rival tribe scouts", goal: "steal", enemies: { rival_spear: 12, rival_slinger: 10 }, fromDay: 3, untilEra: "neolithic", weight: 2, speed: 50, bribable: true, plural: true },
    { id: "slimes", name: "Bog slimes", goal: "harm", enemies: { slime: 6 }, fromDay: 2, untilEra: "medieval", weight: 1, speed: 25, bribable: false, plural: true },
    // Medieval
    { id: "bandits", name: "Bandits", goal: "steal", goals: { steal: 4, burn: 1, kidnap: 1 }, steals: "valuables", enemies: { bandit: 14, bandit_archer: 12, bandit_chief: 30 }, fromDay: 0, era: "medieval", untilEra: "industrial", weight: 4, speed: 55, bribable: true, plural: true },
    // (never picked at random: sent by the Hunter's Guild, see monsters.ts)
    { id: "hunters", name: "Hunter's Guild", goal: "harm", enemies: { guild_hunter: 20 }, fromDay: 9999, weight: 0, speed: 55, bribable: false, plural: false },
    // Industrial
    { id: "gang", name: "Gang", goal: "steal", goals: { steal: 4, burn: 2, kidnap: 1 }, steals: "valuables", enemies: { gangster: 18 }, fromDay: 0, era: "industrial", untilEra: "modern", weight: 4, speed: 60, bribable: true, plural: false },
    { id: "army", name: "Rival army", goal: "harm", goals: { harm: 3, burn: 1 }, enemies: { rifleman: 24, soldier: 20 }, fromDay: 0, era: "industrial", untilEra: "industrial", weight: 2, speed: 50, bribable: true, plural: false },
    // Modern
    { id: "marauders", name: "Marauders", goal: "steal", goals: { steal: 4, burn: 2, kidnap: 1 }, steals: "valuables", enemies: { raider: 24 }, fromDay: 0, era: "modern", untilEra: "modern", weight: 4, speed: 70, bribable: true, plural: true },
    { id: "mechanized", name: "Mechanized force", goal: "harm", goals: { harm: 3, burn: 2 }, enemies: { trooper: 28, commander: 60 }, fromDay: 0, era: "modern", untilEra: "modern", weight: 2, speed: 65, bribable: true, plural: false },
    // (never picked at random: the waves of a zombie outbreak, see doom.ts)
    { id: "zombies", name: "Walking dead", goal: "harm", enemies: { zombie: 8, zombie_hound: 7, mummy: 14, zombie_brute: 22, zombie_bear: 26 }, fromDay: 9999, weight: 0, speed: 28, bribable: false, plural: true },
    // (never picked at random: the ice mages of a Deep Freeze, see doom.ts)
    { id: "frost", name: "Ice mages", goal: "harm", goals: { harm: 4, steal: 1 }, steals: "food", enemies: { ice_mage: 12, frost_yeti: 16, ice_golem: 24 }, fromDay: 9999, weight: 0, speed: 40, bribable: false, plural: true },
    // (never picked at random: the swarms of a Rat Plague, see doom.ts)
    { id: "rats", name: "Rat swarm", goal: "steal", goals: { steal: 3, harm: 2 }, steals: "food", enemies: { rat: 3, plague_rat: 6 }, fromDay: 9999, weight: 0, speed: 75, bribable: false, plural: false },
    // Robotic & Space
    { id: "pirates", name: "Space pirates", goal: "steal", goals: { steal: 4, burn: 1, kidnap: 2 }, steals: "valuables", enemies: { space_pirate: 30 }, fromDay: 0, era: "space", weight: 4, speed: 75, bribable: true, plural: true },
    { id: "drones", name: "Drone swarm", goal: "harm", goals: { harm: 3, burn: 2 }, enemies: { combat_drone: 22, slug_bot: 32, war_bot: 40 }, fromDay: 0, era: "space", weight: 3, speed: 90, bribable: false, plural: false },
    { id: "warband", name: "Warband", goal: "harm", goals: { harm: 3, burn: 2 }, enemies: { soldier: 20, bandit_archer: 12, ogre: 32, hedge_wizard: 18 }, fromDay: 0, era: "medieval", untilEra: "industrial", weight: 2, speed: 50, bribable: true, plural: false }
  ];
  var RAID_KIND_BY_ID = Object.fromEntries(RAID_KINDS.map((k) => [k.id, k]));
  var RAID_GRACE_HOURS = 48;
  var RAID_INTERVAL_HOURS = 30;
  var RAID_INTERVAL_MIN = 14;
  var RAID_INTERVAL_JITTER = 6;
  var RAID_BUDGET_BASE = 12;
  var RAID_BUDGET_PER_DAY = 2;
  var RAID_BUDGET_PER_WEALTH = 1 / 25;
  var RAID_MAX_SIZE = 6;
  var WARNING_MINUTES = 10;
  var PATROL_WARNING_MINUTES = 30;
  var RAID_MAX_HOURS = 3;
  var RAIDER_FLEE = { harm: 0.25, steal: 0.4, burn: 0.4, kidnap: 0.4 };
  var LOOT_VALUE = { iron: 6, cloth: 4, leather: 4, bread: 3, bricks: 2, lumber: 2, iron_ore: 2, arrows: 2, dried_meat: 2, rations: 3, steel: 5, glass: 3, electronics: 8, plastic: 3, fuel: 3, concrete: 2, cartridges: 1, shot: 1, rare_minerals: 6, alloys: 10, circuits: 12, power_cells: 2 };
  var BURN_HOURS = 4;
  var SPREAD_PER_HOUR = 0.35;
  var EXTINGUISH_SECONDS = 25;
  var RAIDER_CARRY = 5;
  var BRIBE_FOOD_PER_RAIDER = 3;
  var FINISH_OFF_CHANCE = 0.3;
  var MELEE_RANGE = 22;
  var THROW_RANGE = 120;

  // src/shared/data/terrain.ts
  var TERRAIN = {
    forest: { name: "Forest", verb: "Chopping", anim: "chop", secondsPerUnit: 6, pool: { wood: [8, 12], fiber: [1, 3], berries: [0, 3] } },
    rock: { name: "Rocks", verb: "Breaking rock", anim: "mine", secondsPerUnit: 8, pool: { stone: [6, 10], flint: [2, 4] } },
    marsh: { name: "Marsh", verb: "Foraging", anim: "forage", secondsPerUnit: 5, pool: { fiber: [3, 6], clay: [2, 4], herbs: [1, 3] } },
    hill: { name: "Hill", verb: "Digging", anim: "mine", secondsPerUnit: 7, pool: { stone: [2, 4], fiber: [2, 4], flint: [0, 2], herbs: [0, 2] } }
  };

  // src/shared/rng.ts
  function hashSeed(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return fmix32(h);
  }
  function mixSeed(base, ...salts) {
    let h = base >>> 0;
    for (const s of salts) h = fmix32(h ^ Math.imul((s | 0) + 2654435769, 2246822507));
    return h;
  }
  function fmix32(h) {
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  }
  var Rng = class _Rng {
    s;
    /** `seed` is either a fresh seed or a `state` saved earlier (resumes the exact same sequence). */
    constructor(seed) {
      this.s = seed >>> 0;
    }
    static from(base, ...salts) {
      return new _Rng(mixSeed(base, ...salts));
    }
    /** Internal state, so the sequence can be saved and resumed exactly. */
    get state() {
      return this.s;
    }
    /** Float in [0, 1). */
    next() {
      let t = this.s = this.s + 1831565813 >>> 0;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    /** Float in [min, max). */
    range(min, max) {
      return min + (max - min) * this.next();
    }
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    }
    chance(p) {
      return this.next() < p;
    }
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    }
    /** Pick a key from a weight table. */
    weighted(weights) {
      const keys = Object.keys(weights);
      let total = 0;
      for (const k of keys) total += weights[k];
      let r = this.next() * total;
      for (const k of keys) {
        r -= weights[k];
        if (r < 0) return k;
      }
      return keys[keys.length - 1];
    }
  };

  // src/shared/data/biomes.ts
  var BIOMES = ["forest", "desert", "tundra", "coast"];
  var BIOME_DEFS = {
    forest: {
      name: "Forest",
      description: "Woods, rivers and meadows. Plenty of timber; wolves in the trees.",
      mid: { forest: 5, rock: 2, marsh: 1.2, hill: 1.5 },
      back: { meadow: 3, forest: 4, hills: 2.5, marsh: 1, fertile: 1.5 },
      crops: 1,
      forage: 1
    },
    desert: {
      name: "Desert",
      description: "Rock and sand, little wood, poor soil. Droughts are common, and rivals prowl.",
      mid: { forest: 1, rock: 5, marsh: 0.3, hill: 3 },
      back: { meadow: 3, forest: 0.5, hills: 4, marsh: 0.3, fertile: 0.8 },
      crops: 0.7,
      forage: 0.8,
      raids: { wolves: 0.4, rivals: 1.6, bandits: 1.3 },
      dooms: { drought: 3, plague: 0.7, deep_freeze: 0.3 }
    },
    tundra: {
      name: "Tundra",
      description: "Cold and hard. Short growing, pine and stone, hungry wolves, and ice mages in the north.",
      mid: { forest: 3, rock: 3, marsh: 0.6, hill: 2 },
      back: { meadow: 3, forest: 2.5, hills: 3, marsh: 0.8, fertile: 0.6 },
      crops: 0.6,
      forage: 0.8,
      raids: { wolves: 2, boars: 0.6 },
      dooms: { drought: 0.3, ash_winter: 2, deep_freeze: 2.5 }
    },
    coast: {
      name: "Coast",
      description: "Shore and marsh with rich foraging and busy trade, but raiders come by sea.",
      mid: { forest: 3, rock: 1.5, marsh: 2.5, hill: 1 },
      back: { meadow: 3, forest: 2, hills: 1.5, marsh: 2.5, fertile: 2 },
      crops: 1,
      forage: 1.3,
      raids: { rivals: 1.3, bandits: 1.3, pirates: 1.5, slimes: 2 },
      dooms: { plague: 1.5 },
      caravans: 1.5
    }
  };
  var biomeOf = (s) => BIOME_DEFS[s.biome ?? "forest"];
  var DIFFICULTIES = ["easy", "normal", "hard"];
  var DIFFICULTY_DEFS = {
    easy: { name: "Easy", description: "Smaller raids, further apart; fewer disasters.", raidStrength: 0.6, raidGap: 1.5, doomGap: 1.5 },
    normal: { name: "Normal", description: "As designed.", raidStrength: 1, raidGap: 1, doomGap: 1 },
    hard: { name: "Hard", description: "Bigger raids, more often; more disasters.", raidStrength: 1.4, raidGap: 0.75, doomGap: 0.75 }
  };
  var difficultyOf = (s) => DIFFICULTY_DEFS[s.difficulty ?? "normal"];

  // src/shared/world.ts
  function generateWorld(seed, biome = "forest") {
    const MID_WEIGHTS = BIOME_DEFS[biome].mid;
    const BACK_WEIGHTS = BIOME_DEFS[biome].back;
    const seedHash = hashSeed(seed);
    const tiles = WORLD_TILES;
    const camp = Math.floor(tiles / 2);
    const rivRng = Rng.from(seedHash, 1);
    const rivers = [];
    const riverCount = rivRng.chance(0.4) ? 2 : 1;
    for (let tries = 0; rivers.length < riverCount && tries < 50; tries++) {
      const col = rivers.length === 0 ? camp + rivRng.pick([-1, 1]) * rivRng.int(CAMP_CLEAR_RADIUS + 2, 30) : rivRng.int(10, tiles - 12);
      if (Math.abs(col - camp) <= CAMP_CLEAR_RADIUS + 1) continue;
      if (rivers.some((r) => Math.abs(r - col) < 20)) continue;
      rivers.push(col);
    }
    const nearRiver = (col, dist) => rivers.some((r) => Math.abs(r - col) <= dist);
    const midRng = Rng.from(seedHash, 2);
    const mid = new Array(tiles);
    for (let c = camp - CAMP_CLEAR_RADIUS; c < camp + CAMP_CLEAR_RADIUS; c++) mid[c] = "clear";
    const fillOutward = (start, step) => {
      let c = start;
      let prev = "clear";
      while (c >= 0 && c < tiles) {
        let kind = midRng.weighted(MID_WEIGHTS);
        if (kind === prev && midRng.chance(0.6)) kind = midRng.weighted(MID_WEIGHTS);
        const len = kind === "hill" ? midRng.int(4, 8) : midRng.int(3, 10);
        for (let i = 0; i < len && c >= 0 && c < tiles; i++, c += step) {
          mid[c] = nearRiver(c, 1) ? "marsh" : kind;
        }
        prev = kind;
      }
    };
    fillOutward(camp + CAMP_CLEAR_RADIUS, 1);
    fillOutward(camp - CAMP_CLEAR_RADIUS - 1, -1);
    const backRng = Rng.from(seedHash, 3);
    const backLen = tiles + BACK_PAD_TILES * 2;
    const back = new Array(backLen);
    for (let i = 0; i < backLen; ) {
      const kind = backRng.weighted(BACK_WEIGHTS);
      const len = backRng.int(4, 14);
      for (let j = 0; j < len && i < backLen; j++, i++) back[i] = kind;
    }
    for (let i = 0; i < backLen; i++) {
      const col = i - BACK_PAD_TILES;
      if (rivers.includes(col) || rivers.includes(col - 1)) back[i] = "river";
      else if (nearRiver(col, 3) && back[i] !== "hills") back[i] = backRng.chance(0.7) ? "fertile" : "marsh";
    }
    for (let col = camp - 4; col < camp + 4; col++) {
      const i = col + BACK_PAD_TILES;
      if (back[i] === "forest" || back[i] === "hills") back[i] = "meadow";
    }
    return { seed, seedHash, tiles, camp, mid, back, rivers };
  }

  // src/shared/data/monsters.ts
  var MONSTER_NAMES = { werewolf: "Werewolf", vampire: "Vampire", undead: "Undead" };
  var MONSTER_ARRIVAL = 0.12;
  var MONSTER_HP = 30;
  var FULL_MOON_DAYS = 6;
  var MAUL_DAMAGE = 14;
  var FEED_HOURS = 48;
  var BITE_DAMAGE = 12;
  var UNEASY_MORALE = -3;
  var GUILD_PER_MONSTER_DAY = 12;
  var GUILD_DECAY_DAY = 5;
  var GUILD_THRESHOLD = 60;
  var HIDE_BASE = 0.3;
  var HIDE_PER_SOCIAL = 0.05;
  var UNDEAD_HEAL = 0.3;
  var LIVING_AMONG_DEAD_MORALE = -4;
  var UNDEAD_TOWN_ARRIVALS = 0.3;
  var VAMPIRE_NIGHT_WORK = 1.25;
  var VAMPIRE_DAY_WORK = 0.85;
  var THIRST_HP_PER_HOUR = 3;
  var THIRST_MORALE = -12;
  var WEREWOLF_DAMAGE = 3;
  var PACK_HUNT_MEAT = 3;
  var TURNING_FEAR_MORALE = -6;
  var TURNING_FEAR_HOURS = 24;

  // src/shared/sim/time.ts
  var TICK_HZ = 10;
  var TICK_MS = 1e3 / TICK_HZ;
  var SECONDS_PER_GAME_HOUR = 60;
  var TICKS_PER_HOUR = SECONDS_PER_GAME_HOUR * TICK_HZ;
  var TICKS_PER_DAY = TICKS_PER_HOUR * 24;
  var DAYS_PER_SEASON = 3;
  var SEASONS = ["spring", "summer", "autumn", "winter"];
  var START_HOUR = 7;
  var SUNRISE = [5, 7];
  var SUNSET = [19, 21];
  function calendar(tick) {
    const t = tick + START_HOUR * TICKS_PER_HOUR;
    const dayIndex = Math.floor(t / TICKS_PER_DAY);
    const hoursIntoDay = t % TICKS_PER_DAY / TICKS_PER_HOUR;
    const seasonIndex = Math.floor(dayIndex / DAYS_PER_SEASON);
    return {
      day: dayIndex + 1,
      year: Math.floor(seasonIndex / SEASONS.length) + 1,
      season: SEASONS[seasonIndex % SEASONS.length],
      dayOfSeason: dayIndex % DAYS_PER_SEASON + 1,
      hour: Math.floor(hoursIntoDay),
      minute: Math.floor(hoursIntoDay % 1 * 60),
      daylight: daylight(hoursIntoDay)
    };
  }
  function daylight(h) {
    if (h < SUNRISE[0] || h >= SUNSET[1]) return 0;
    if (h < SUNRISE[1]) return smooth((h - SUNRISE[0]) / (SUNRISE[1] - SUNRISE[0]));
    if (h < SUNSET[0]) return 1;
    return 1 - smooth((h - SUNSET[0]) / (SUNSET[1] - SUNSET[0]));
  }
  function smooth(x) {
    return x * x * (3 - 2 * x);
  }

  // src/shared/data/founding.ts
  var BACKGROUNDS = [
    { id: "forager", name: "Forager", description: "A bit of everything: gathers, builds and thinks.", skills: { gathering: 4, construction: 3, research: 3 }, passions: ["gathering", "construction"] },
    { id: "hunter", name: "Hunter", description: "Keeps the town fed and safe with spear and bow.", skills: { melee: 4, ranged: 5, animals: 3 }, passions: ["ranged", "melee"] },
    { id: "farmer", name: "Farmer", description: "Green fields early, and full stores.", skills: { farming: 5, gathering: 4, cooking: 3 }, passions: ["farming", "gathering"] },
    { id: "builder", name: "Builder", description: "Raises the camp fast and makes the tools.", skills: { construction: 5, crafting: 4 }, passions: ["construction", "crafting"] },
    { id: "scholar", name: "Scholar", description: "Researches quickly; not much of a fighter.", skills: { research: 5, medicine: 3, melee: 1 }, passions: ["research", "medicine"] },
    { id: "healer", name: "Healer", description: "Keeps the wounded alive and the town together.", skills: { medicine: 5, social: 4, research: 3 }, passions: ["medicine", "social"] }
  ];
  var BACKGROUND_BY_ID = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]));
  function founderSkills(b) {
    return Object.fromEntries(SKILLS.map((k) => [k, b.skills[k] ?? 2]));
  }
  var MAX_FOUNDER_TRAITS = 2;
  var MAX_NAME_LENGTH = 16;
  var SCENARIOS = [
    { id: "lone", name: "Lone Founder", description: "You, a campfire and a few berries. The classic start.", companions: [], stores: { berries: 8 }, research: [] },
    { id: "band", name: "Band of Three", description: "Arrive with a gatherer and a hunter. More hands, more mouths.", companions: ["gatherer", "hunter"], stores: { berries: 20 }, research: [] },
    {
      id: "tribe",
      name: "Lost Tribe",
      description: "Six of you, young and old, and not much food. Put everyone to work fast.",
      companions: ["gatherer", "hunter", "crafter", "elder", "child"],
      stores: { berries: 36 },
      research: []
    },
    {
      id: "supplied",
      name: "Well Supplied",
      description: "Alone, but with a stockpile of wood, stone and food, and shelter-making already known.",
      companions: [],
      stores: { berries: 40, wood: 40, stone: 20, fiber: 15 },
      research: ["foraging", "basic_shelter"]
    }
  ];
  var SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
  function cleanNewGameOptions(raw) {
    if (typeof raw !== "object" || raw === null) return null;
    const o = raw;
    const biome = pick(BIOMES, o.biome);
    const difficulty = pick(DIFFICULTIES, o.difficulty);
    const scenario = o.scenario === void 0 ? "lone" : typeof o.scenario === "string" && SCENARIO_BY_ID[o.scenario] ? o.scenario : null;
    const founder = o.founder === void 0 ? void 0 : cleanFounder(o.founder);
    if (!biome || !difficulty || !scenario || founder === null) return null;
    return { biome, difficulty, ironman: o.ironman === true, scenario, ...founder ? { founder } : {} };
  }
  var pick = (list2, v) => list2.find((x) => x === v);
  function cleanLook(raw) {
    if (typeof raw !== "object" || raw === null) return null;
    const o = raw;
    const gender = pick(["m", "f"], o.gender);
    const skin = pick(SKINS, o.skin);
    const hair = pick(HAIR_STYLES, o.hair);
    const hairColor = pick(HAIR_COLORS, o.hairColor);
    const outfit = pick(HIDE_COLORS, o.outfit);
    if (!gender || !skin || !hair || !hairColor || !outfit) return null;
    return { gender, skin, hair, hairColor, outfit, beard: gender === "m" && o.beard === true };
  }
  function cleanFounder(raw) {
    if (typeof raw !== "object" || raw === null) return null;
    const o = raw;
    if (typeof o.background !== "string" || !BACKGROUND_BY_ID[o.background]) return null;
    const traits = Array.isArray(o.traits) ? [...new Set(o.traits.filter((t) => typeof t === "string"))] : [];
    if (traits.length > MAX_FOUNDER_TRAITS) return null;
    for (const t of traits) {
      const def = TRAITS.find((d) => d.id === t);
      if (!def || traits.some((u) => def.excludes?.includes(u))) return null;
    }
    const name = typeof o.name === "string" ? o.name.replace(/[^\p{L}\p{N} '\-]/gu, "").trim().slice(0, MAX_NAME_LENGTH) : "";
    const look = o.look === void 0 ? null : cleanLook(o.look);
    if (o.look !== void 0 && !look) return null;
    return { background: o.background, traits, ...name ? { name } : {}, ...look ? { look } : {} };
  }

  // src/shared/sim/state.ts
  var ERA_MULTIPLIER = { neolithic: 1, medieval: 2.5, industrial: 6, modern: 15, space: 40 };
  var RESEARCH_MULTIPLIER = { neolithic: 1, medieval: 15, industrial: 120, modern: 700, space: 2500 };
  var BUILD_MULTIPLIER = { neolithic: 1, medieval: 5, industrial: 20, modern: 60, space: 200 };
  var CARRY_CAPACITY = 10;
  var BASE_HP = 60;
  var TOUGH_HP = 20;
  var FRAIL_HP = 12;
  var MIN_HP = 24;
  function maxHp(p) {
    const frail = p.traits.filter((t) => t === "frail").length * FRAIL_HP;
    return Math.max(MIN_HP, BASE_HP + (p.traits.includes("tough") ? TOUGH_HP : 0) + (p.monster ? MONSTER_HP : 0) - frail);
  }
  var FX_TICKS = 60;
  function personFx(s, id, kind) {
    s.fx = (s.fx ?? []).filter((f) => s.tick - f.tick < FX_TICKS);
    s.fx.push({ tick: s.tick, id, kind });
  }
  var MAX_NOTICES = 20;
  var MAX_JOURNAL = 400;
  function notify(s, text, key2 = false) {
    const n = { id: s.nextId++, tick: s.tick, text };
    s.notices.push(n);
    if (s.notices.length > MAX_NOTICES) s.notices.splice(0, s.notices.length - MAX_NOTICES);
    addJournal(s, key2 ? { ...n, key: key2 } : { ...n });
  }
  function addJournal(s, e) {
    s.journal.push(e);
    if (s.journal.length > MAX_JOURNAL) s.journal.splice(0, s.journal.length - MAX_JOURNAL);
  }
  function carryCapacity(s, p) {
    const pack = p?.gear.pack ? ITEM_BY_ID[p.gear.pack]?.effects.carry ?? 0 : 0;
    return CARRY_CAPACITY + modifiers(s.research).carryBonus + pack;
  }
  function makeFounder(p, f) {
    const bg = BACKGROUND_BY_ID[f.background] ?? BACKGROUND_BY_ID.forager;
    const levels = founderSkills(bg);
    p.skills = Object.fromEntries(SKILLS.map((k) => [k, { level: levels[k], xp: 0 }]));
    p.passions = [...bg.passions];
    p.traits = [...f.traits];
    if (f.name) p.name = f.name;
    if (f.look) p.look = { ...f.look };
    p.priorities = autoPriorities(p.skills);
    p.hp = maxHp(p);
  }
  function makeChild(p) {
    p.skills = Object.fromEntries(SKILLS.map((k) => [k, { level: 1, xp: 0 }]));
    p.traits = [];
    p.look = { ...p.look, beard: false };
    p.priorities = { haul: 0, construct: 0, farm: 0, craft: 0, research: 0, gather: 0, defend: 0 };
    p.autoPriorities = false;
    p.bornTick = 0;
    p.hp = maxHp(p);
  }
  function newGame(seed, opts = {}) {
    const world = generateWorld(seed, opts.biome);
    const rng = new Rng(mixSeed(hashSeed(seed), 24301));
    const tiles = world.mid.map((terrain) => {
      const pool = {};
      if (terrain !== "clear") {
        for (const [m, [lo, hi]] of Object.entries(TERRAIN[terrain].pool)) {
          const n = rng.int(lo, hi);
          if (n > 0) pool[m] = n;
        }
      }
      return { terrain, pool, designated: false };
    });
    const main = makePerson(rng, 1, "founder", (world.camp + 0.5) * TILE - TILE, []);
    if (opts.founder) makeFounder(main, opts.founder);
    const scenario = SCENARIO_BY_ID[opts.scenario ?? "lone"] ?? SCENARIO_BY_ID.lone;
    const campfire = { id: 2, def: "campfire", tile: world.camp, status: "done", delivered: {}, progress: 1, store: {} };
    const buildings = [campfire];
    const people = [main];
    let nextId = 3;
    for (const type of scenario.companions) {
      const x = (world.camp + 0.5) * TILE + (people.length % 2 ? 1 : -1) * Math.ceil(people.length / 2) * TILE;
      const p = makePerson(rng, nextId++, type, x, people.map((q) => q.name));
      if (type === "child") makeChild(p);
      people.push(p);
    }
    let room = BUILDING_BY_ID.campfire.storage ?? 0;
    const extra = {};
    for (const [m, n] of Object.entries(scenario.stores)) {
      const here = Math.min(n, room);
      if (here > 0) campfire.store[m] = here;
      room -= here;
      if (n > here) extra[m] = n - here;
    }
    if (Object.keys(extra).length) buildings.push({ id: nextId++, def: "stockpile", tile: world.camp + BUILDING_BY_ID.campfire.width + 1, status: "done", delivered: {}, progress: 1, store: extra });
    return {
      version: 15,
      seed,
      tick: 0,
      rngState: rng.state,
      paused: false,
      era: "neolithic",
      tiles,
      tileRev: 0,
      buildings,
      people,
      mainId: main.id,
      nextId,
      visitor: null,
      expeditions: [],
      scouted: [],
      destSides: Object.fromEntries(DESTINATIONS.map((d) => [d.id, rng.chance(0.5) ? -1 : 1])),
      prompts: [],
      reputation: 0,
      gameOver: null,
      mourningUntil: 0,
      raid: null,
      nextRaidTick: RAID_GRACE_HOURS * TICKS_PER_HOUR,
      captives: [],
      relations: {},
      celebrationUntil: 0,
      prisoners: [],
      horses: [],
      caravan: null,
      nextCaravanTick: 0,
      research: { done: [...scenario.research], queue: [], progress: {} },
      items: {},
      crafting: [],
      notices: [],
      journal: [],
      unreadAway: null,
      eraReady: false,
      cheats: { unlockAll: false },
      ...opts.biome && opts.biome !== "forest" ? { biome: opts.biome } : {},
      ...opts.ironman ? { ironman: true } : {},
      ...opts.difficulty && opts.difficulty !== "normal" ? { difficulty: opts.difficulty } : {}
    };
  }
  function makePerson(rng, id, typeId, x, takenNames) {
    const type = RECRUIT_TYPES[typeId];
    const skills = Object.fromEntries(
      SKILLS.map((k) => {
        const [lo, hi] = type.skills[k] ?? [1, 3];
        return [k, { level: rng.int(lo, hi), xp: 0 }];
      })
    );
    const passions = [];
    for (let n = rng.int(1, typeId === "founder" ? 2 : 3); passions.length < n; ) {
      const pick2 = type.passionFor.length && rng.chance(0.7) ? rng.pick(type.passionFor) : rng.pick(SKILLS);
      if (!passions.includes(pick2)) passions.push(pick2);
      else if (passions.length >= type.passionFor.length) n--;
    }
    const traits = [];
    for (let tries = 0, n = rng.int(1, 2); traits.length < n && tries < 20; tries++) {
      const t = rng.pick(TRAITS);
      if (traits.includes(t.id) || traits.some((o) => t.excludes?.includes(o))) continue;
      traits.push(t.id);
    }
    const free = NAMES.filter((n) => !takenNames.includes(n));
    return {
      id,
      name: rng.pick(free.length ? free : NAMES),
      type: typeId,
      look: randomLook(rng, typeId === "elder"),
      x,
      dir: 1,
      skills,
      passions,
      traits,
      needs: { food: 0.8, rest: 0.9 },
      morale: 55,
      lastSlept: null,
      bed: null,
      priorities: autoPriorities(skills),
      autoPriorities: true,
      task: null,
      activity: "idle",
      carrying: {},
      gear: {},
      blocked: false,
      away: null,
      hp: maxHp({ traits }),
      downed: null
    };
  }
  function autoPriorities(skills) {
    return Object.fromEntries(
      JOBS.map((j) => {
        if (j === "defend") {
          const fight = Math.max(skills.melee.level, skills.ranged.level);
          return [j, fight >= 5 ? 1 : fight >= 3 ? 2 : fight >= 2 ? 3 : 0];
        }
        const skill = JOB_SKILL[j];
        const level = skill ? skills[skill].level : 3;
        return [j, level >= 6 ? 1 : level >= 3 ? 2 : 3];
      })
    );
  }
  function campX(s) {
    return tileCentreX(Math.floor(s.tiles.length / 2));
  }
  function tileCentreX(tile) {
    return (tile + 0.5) * TILE;
  }
  function poolSize(pool) {
    let n = 0;
    for (const v of Object.values(pool)) n += v ?? 0;
    return n;
  }
  function addStock(to, m, n) {
    const v = (to[m] ?? 0) + n;
    if (v > 0) to[m] = v;
    else delete to[m];
  }

  // src/shared/sim/buildings.ts
  var BACK_BUILDABLE = /* @__PURE__ */ new Set(["meadow", "fertile"]);
  var defOf = (b) => BUILDING_BY_ID[b.def];
  function buildingCentreX(b) {
    return (b.tile + defOf(b).width / 2) * TILE;
  }
  function isUnlocked(u, def) {
    return !def.research || u.unlockAll || u.done.includes(def.research);
  }
  var unlockInfo = (s) => ({ unlockAll: s.cheats.unlockAll, done: s.research.done });
  function storageCapacity(s, b) {
    const base = b.status === "done" ? defOf(b).storage ?? 0 : 0;
    const pots = b.def === "campfire" && b.status === "done" ? potStorage(s) : 0;
    return Math.floor(base * modifiers(s.research).storage) + pots;
  }
  var potStorage = (s) => Math.min(MAX_POTS, s.items.clay_pot ?? 0) * POT_STORAGE;
  function storageFree(s, b) {
    return storageCapacity(s, b) - poolSize(b.store);
  }
  function storages(s) {
    return s.buildings.filter((b) => storageCapacity(s, b) > 0);
  }
  function totalStock(s) {
    const out = {};
    for (const b of storages(s)) for (const m of MATERIALS) if (b.store[m]) addStock(out, m, b.store[m]);
    return out;
  }
  function totalCapacity(s) {
    return storages(s).reduce((n, b) => n + storageCapacity(s, b), 0);
  }
  function depositNear(s, x, stock) {
    const left = { ...stock };
    const byDistance = storages(s).sort((a, b) => Math.abs(buildingCentreX(a) - x) - Math.abs(buildingCentreX(b) - x));
    for (const st of byDistance) {
      for (const m of MATERIALS) {
        const n = Math.min(left[m] ?? 0, storageFree(s, st));
        if (n <= 0) continue;
        addStock(st.store, m, n);
        addStock(left, m, -n);
      }
    }
    return left;
  }
  function discardStock(s, id, m) {
    const b = s.buildings.find((q) => q.id === id);
    const n = b?.store[m] ?? 0;
    if (!b || n <= 0 || m === "totem") return 0;
    delete b.store[m];
    return n;
  }
  function stillNeeded(b) {
    const out = {};
    for (const [m, n] of Object.entries(defOf(b).cost)) {
      const need = n - (b.delivered[m] ?? 0);
      if (need > 0) out[m] = need;
    }
    return out;
  }
  var buildSlots = (s) => BUILD_QUEUE_SLOTS + modifiers(s.research).queueSlots;
  function blueprintCount(s) {
    return s.buildings.filter((b) => b.status === "blueprint").length;
  }
  function canPlace(view, back, def, tile) {
    if (tile < 0 || tile + def.width > view.tiles.length) return { ok: false, reason: "Outside the town" };
    for (let t = tile; t < tile + def.width; t++) {
      if (def.layer === "back") {
        if (!BACK_BUILDABLE.has(back[t + BACK_PAD_TILES])) return { ok: false, reason: "Needs open meadow or fertile soil" };
      } else if (view.tiles[t].terrain !== "clear") {
        return { ok: false, reason: "Clear the land first" };
      }
    }
    for (const b of view.buildings) {
      const d = defOf(b);
      if (d.layer === def.layer && b.tile < tile + def.width && tile < b.tile + d.width) return { ok: false, reason: `Overlaps ${d.name}` };
    }
    return { ok: true };
  }
  function placeBlueprint(s, back, defId, tile) {
    const def = BUILDING_BY_ID[defId];
    if (!def) return { ok: false, reason: "Unknown building" };
    if (!isUnlocked(unlockInfo(s), def)) return { ok: false, reason: "Not researched yet" };
    if (blueprintCount(s) >= buildSlots(s)) return { ok: false, reason: "Construction queue is full" };
    const check = canPlace(s, back, def, tile);
    if (!check.ok) return check;
    s.buildings.push({ id: s.nextId++, def: defId, tile, status: "blueprint", delivered: {}, progress: 0, store: {} });
    return { ok: true };
  }
  function canUpgrade(s, back, id) {
    const b = s.buildings.find((q) => q.id === id);
    const to = b && UPGRADES[b.def];
    if (!b || !to || b.status !== "done") return { ok: false, reason: "Nothing to upgrade to" };
    const def = BUILDING_BY_ID[to];
    if (!isUnlocked(unlockInfo(s), def)) return { ok: false, reason: `Needs research: ${TOPIC_BY_ID[def.research]?.name ?? def.research}`, to };
    if (blueprintCount(s) >= buildSlots(s)) return { ok: false, reason: "Construction queue is full", to };
    if (b.fire !== void 0) return { ok: false, reason: "It is on fire", to };
    const others = { tiles: s.tiles, buildings: s.buildings.filter((q) => q !== b) };
    const grow = def.width - defOf(b).width;
    for (const tile of grow > 0 ? [b.tile, b.tile - grow] : [b.tile]) {
      if (canPlace(others, back, def, tile).ok) return { ok: true, to, tile };
    }
    return { ok: false, reason: `No room for the ${def.name}`, to };
  }
  function upgrade(s, back, id) {
    const check = canUpgrade(s, back, id);
    if (!check.ok) return check;
    const b = s.buildings.find((q) => q.id === id);
    const next = BUILDING_BY_ID[check.to];
    const salvage = {};
    for (const [m, n] of Object.entries(defOf(b).cost)) salvage[m] = Math.floor(n * DEMOLISH_REFUND);
    for (const m of MATERIALS) if (b.store[m]) addStock(salvage, m, b.store[m]);
    const delivered = {};
    for (const [m, n] of Object.entries(next.cost)) {
      const k = Math.min(n, salvage[m] ?? 0);
      if (k > 0) {
        delivered[m] = k;
        addStock(salvage, m, -k);
      }
    }
    const x = buildingCentreX(b);
    b.def = next.id;
    b.tile = check.tile;
    b.status = "blueprint";
    b.progress = 0;
    b.delivered = delivered;
    b.store = {};
    delete b.hp;
    delete b.readyTick;
    depositNear(s, x, salvage);
    notify(s, `Upgrading to a ${next.name}.`);
    return { ok: true };
  }
  function demolish(s, id) {
    const i = s.buildings.findIndex((b2) => b2.id === id);
    if (i < 0) return;
    const b = s.buildings[i];
    const refund = { ...b.delivered };
    if (b.status === "done") {
      for (const [m, n] of Object.entries(defOf(b).cost)) refund[m] = Math.floor(n * DEMOLISH_REFUND);
      for (const m of MATERIALS) if (b.store[m]) addStock(refund, m, b.store[m]);
    }
    s.buildings.splice(i, 1);
    depositNear(s, buildingCentreX(b), refund);
  }

  // src/shared/sim/offline.ts
  var OFFLINE_REPORT_MS = 2 * 6e4;
  var MAX_OFFLINE_MS = 3 * 24 * 36e5;
  var REPORT_EVENTS = 8;
  function startCatchUp(sim, awayMs) {
    const s = sim.state;
    const want = s.paused || s.gameOver ? 0 : Math.floor(Math.min(Math.max(0, awayMs), MAX_OFFLINE_MS) / TICK_MS);
    const before = { tick: s.tick, stock: totalStock(s), people: s.people.length, lastEntry: s.journal.at(-1)?.id ?? 0 };
    const job = {
      left: want,
      get progress() {
        return want ? 1 - job.left / want : 1;
      },
      run(ticks) {
        for (let i = 0; i < ticks && job.left > 0; i++, job.left--) {
          if (s.gameOver || s.paused) job.left = 0;
          else sim.step();
        }
        return job.left <= 0;
      },
      finish: () => report(s, awayMs, before)
    };
    return job;
  }
  function report(s, awayMs, before) {
    const ticks = s.tick - before.tick;
    if (ticks <= 0) return { ticks: 0, reportId: null };
    if (awayMs < OFFLINE_REPORT_MS) return { ticks, reportId: null };
    const lines = [];
    const events = s.journal.filter((e) => e.id > before.lastEntry && !e.lines);
    const key2 = events.filter((e) => e.key);
    const lost = events.map((e) => / has died (.+?)\.?$/.exec(e.text) && e.text.split(" has died ")).filter((m) => !!m).map(([who, how]) => `${who} (${how.split(".")[0]})`);
    if (lost.length) lines.push(`Lost while you were away: ${lost.join(", ")}.`);
    if (key2.length > REPORT_EVENTS) lines.push(`(${key2.length - REPORT_EVENTS} earlier milestones are in the Journal.)`);
    for (const e of key2.slice(-REPORT_EVENTS)) lines.push(e.text);
    const minor = events.length - key2.length;
    if (minor) lines.push(`${minor} smaller event${minor === 1 ? "" : "s"}: see the Journal.`);
    const stock = stockChange(before.stock, totalStock(s));
    if (stock) lines.push(`Stores: ${stock}.`);
    const idle = idleNote(s);
    if (idle) lines.push(idle);
    if (!lines.length) lines.push("A quiet time. Nothing much happened.");
    if (awayMs > MAX_OFFLINE_MS) lines.push(`(Only the first ${MAX_OFFLINE_MS / 36e5} hours away were simulated.)`);
    const id = s.nextId++;
    addJournal(s, { id, tick: s.tick, text: `While you were away (${realDuration(awayMs)}, ${gameDuration(ticks)})`, lines });
    s.unreadAway = id;
    return { ticks, reportId: id };
  }
  function stockChange(a, b) {
    const parts = [];
    for (const m of MATERIALS) {
      const d = (b[m] ?? 0) - (a[m] ?? 0);
      if (d) parts.push(`${d > 0 ? "+" : "\u2212"}${Math.abs(d)} ${MATERIAL_NAMES[m].toLowerCase()}`);
    }
    return parts.join(", ");
  }
  function idleNote(s) {
    const gathering = s.tiles.some((t) => t.designated);
    if (gathering || blueprintCount(s) > 0 || s.research.queue.length > 0) return null;
    return "The queues ran dry: no building, research or gathering is waiting.";
  }
  function realDuration(ms) {
    const min = Math.round(ms / 6e4);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `${h}h ${min % 60}m`;
    return `${Math.floor(h / 24)} days ${h % 24}h`;
  }
  function gameDuration(ticks) {
    if (ticks >= TICKS_PER_DAY) {
      const d = Math.round(ticks / TICKS_PER_DAY * 10) / 10;
      return `${d} game day${d === 1 ? "" : "s"}`;
    }
    const h = Math.round(ticks / TICKS_PER_HOUR);
    return `${h} game hour${h === 1 ? "" : "s"}`;
  }

  // src/shared/data/operators.ts
  var OPERATORS = {
    tavern: { title: "Barkeep", skill: "social", effect: "The tavern lifts morale more" },
    market: { title: "Merchant", skill: "social", effect: "Better prices from caravans" },
    infirmary: { title: "Healer", skill: "medicine", effect: "Wounds heal faster still" },
    watchtower: { title: "Guard Captain", skill: "melee", effect: "Defenders hit harder and more often" }
  };
  var TAVERN_BASE = 4;
  var TAVERN_PER_LEVEL = 0.6;
  var MERCHANT_PER_LEVEL = 0.02;
  var HEALER_PER_LEVEL = 0.1;
  var CAPTAIN_PER_LEVEL = 0.01;

  // src/shared/data/social.ts
  var FRIEND = 40;
  var RIVAL = -30;
  var COUPLE = 75;
  var COUPLE_CHANCE = 0.02;
  var MARRY = 90;
  var MARRY_CHANCE = 0.02;
  var CHILD_CHANCE = 0.01;
  var MAX_CHILDREN = 2;
  var CHILD_HOURS = 7 * 24 * 60;
  var SCHOOL_BONUS = 2;
  var WARM_PER_HOUR = 0.6;
  var FRICTION_CHANCE = 0.03;
  var FRICTION = 3;
  var NEAR_PX = 5 * 32;
  var GRIEF_PARTNER = [-20, 72];
  var GRIEF_FRIEND = [-8, 24];
  var GRAVEYARD_GRIEF = 0.5;
  var MOURNING_MORALE = -8;
  var MOURNING_LAID_TO_REST = -3;
  var WEDDING_MORALE = [5, 24];

  // src/shared/data/classes.ts
  var CLASSES = ["necromancer", "summoner", "beast_tamer", "blood_knight"];
  var CLASS_DEFS = {
    necromancer: {
      name: "Necromancer",
      description: "Raises fallen enemies to fight for the town (two a fight).",
      research: "necromancy",
      cost: { bone: 10, herbs: 4 },
      skill: "research",
      level: 4
    },
    summoner: {
      name: "Summoner",
      description: "Calls a spirit to fight at their side in every fight.",
      research: "summoning",
      cost: { herbs: 6, fiber: 6 },
      skill: "research",
      level: 4
    },
    beast_tamer: {
      name: "Beast Tamer",
      description: "Fights with a wolf companion, and tames wild beasts that come near.",
      research: "beast_lore",
      cost: { meat: 10, hide: 4 },
      skill: "gathering",
      level: 3
    },
    blood_knight: {
      name: "Blood Knight",
      description: "Heals from the wounds they deal, and hits harder the more hurt they are.",
      research: "blood_oath",
      cost: { meat: 8, hide: 6 },
      skill: "melee",
      level: 5
    }
  };
  var BLOOD_LIFESTEAL = 0.35;
  var BLOOD_FURY = 1.3;
  var NECRO_RAISES = 2;
  var NECRO_RANGE = 250;
  var TAME_RANGE = 150;
  var TAME_EVERY = 20;
  var RARE_CLASS_CHANCE = 0.04;

  // src/shared/sim/monsters.ts
  var inTown = (s) => s.people.filter((p) => p.away === null);
  var monsters = (s) => s.people.filter((p) => p.monster);
  function becomeMonster(s, p, kind) {
    p.monster = kind;
    p.order = "hide";
    p.lastFed = s.tick;
    p.hp = maxHp(p);
  }
  var fullMoon = (s) => Math.floor(calendar(s.tick).day - 1) % FULL_MOON_DAYS === FULL_MOON_DAYS - 1;
  var packLeader = (s) => s.people.some((p) => p.id === s.mainId && p.monster === "werewolf" && p.away === null);
  function runWithThePack(s, raiders) {
    if (!packLeader(s)) return;
    let joined = 0;
    raiders.forEach((r, i) => {
      if (r.kind === "wolf" && i % 3 !== 2) {
        r.ally = true;
        joined++;
      }
    });
    if (joined) notify(s, `The wolves catch the founder's scent: ${joined === 1 ? "one of the pack runs" : `${joined} of the pack run`} with the town now.`, true);
  }
  function updateMonsters(s, rng, startGuildRaid2) {
    if (s.tick % TICKS_PER_HOUR !== 0) return;
    const hour = calendar(s.tick).hour;
    let packHunted = false;
    for (const m of monsters(s)) {
      if (m.away !== null || m.downed) continue;
      const victims = inTown(s).filter((p) => p !== m && !p.downed && !p.monster);
      if (m.monster === "werewolf" && hour === 23 && fullMoon(s)) {
        if (victims.length) {
          const v = rng.pick(victims);
          v.hp = Math.max(1, v.hp - MAUL_DAMAGE);
          notify(s, `Under the full moon, ${m.name} went feral and mauled ${v.name}!`, true);
        } else {
          depositNear(s, m.x, { meat: PACK_HUNT_MEAT });
          packHunted = true;
        }
      }
      if (m.monster === "vampire" && hour === 2 && s.tick - (m.lastFed ?? 0) >= FEED_HOURS * TICKS_PER_HOUR) {
        const sleepers = victims.filter((p) => p.activity === "sleep");
        if (victims.length) {
          const v = rng.pick(sleepers.length ? sleepers : victims);
          v.hp = Math.max(1, v.hp - BITE_DAMAGE);
          m.lastFed = s.tick;
          notify(s, `${v.name} woke pale and weak. Something fed on them in the night.`, true);
        } else if (s.prisoners.length) {
          m.lastFed = s.tick;
          notify(s, `${m.name} fed on a prisoner in the night.`);
        }
      }
      if (m.monster === "vampire" && s.tick - (m.lastFed ?? s.tick) > FEED_HOURS * 1.5 * TICKS_PER_HOUR) m.hp = Math.max(1, m.hp - THIRST_HP_PER_HOUR);
    }
    if (packHunted) notify(s, "Under the full moon the pack ran down game in the hills and brought back meat.");
    if (hour !== 12) return;
    const n = monsters(s).length;
    s.guild = Math.max(0, Math.min(100, (s.guild ?? 0) + (n ? n * GUILD_PER_MONSTER_DAY : -GUILD_DECAY_DAY)));
    if (n && (s.guild ?? 0) >= GUILD_THRESHOLD && !s.raid) {
      const target = rng.pick(monsters(s).filter((m) => m.away === null));
      if (target) startGuildRaid2(target);
    }
  }
  function guildOptions(target) {
    const options = [`Give up ${target.name}`, "Hide them", "Fight"];
    const order = target.order ?? "hide";
    return { options, defaultOption: order === "give_up" ? 0 : order === "hide" ? 1 : 2 };
  }
  function answerGuild(s, label2, rng) {
    const target = s.people.find((p) => p.id === s.guildTarget);
    if (!target) return true;
    if (label2.startsWith("Give up")) {
      s.people = s.people.filter((p) => p !== target);
      grieve(s, target);
      s.guild = Math.max(0, (s.guild ?? 0) - 40);
      notify(s, `${target.name} was handed over to the Hunter's Guild.`, true);
      return true;
    }
    if (label2.startsWith("Hide")) {
      const social = Math.max(1, ...inTown(s).map((p) => p.skills.social.level));
      if (rng.chance(HIDE_BASE + social * HIDE_PER_SOCIAL)) {
        s.guild = Math.max(0, (s.guild ?? 0) - 15);
        notify(s, `The hunters searched the town and found nothing. ${target.name} stays hidden.`, true);
        return true;
      }
      notify(s, `The hunters found ${target.name}! They attack.`, true);
      return false;
    }
    return false;
  }
  function guildDefeated(s) {
    s.guild = Math.min(100, (s.guild ?? 0) + 20);
    s.guildTarget = null;
    notify(s, "The Guild's hunters were driven off. They will come back in greater numbers.", true);
  }
  var HUNTERS = RAID_KIND_BY_ID.hunters;

  // src/shared/sim/occult.ts
  function offerBloodRite(s) {
    const main = s.people.find((p) => p.id === s.mainId);
    if (!main || main.monster) return;
    s.prompts.push({
      id: s.nextId++,
      kind: "rite",
      expedition: null,
      title: "The Blood Rite",
      text: `The rite is ready. Should ${main.name} become a vampire? (Stronger, rises again once a night, but must feed, and the Hunter's Guild will come.)`,
      options: ["Embrace the night", "Refuse"],
      defaultOption: 1,
      expiresTick: s.tick + 24 * 600
    });
    notify(s, "The Blood Rite is ready. A choice awaits.", true);
  }
  function offerMoonRite(s) {
    const main = s.people.find((p) => p.id === s.mainId);
    if (!main || main.monster) return;
    s.prompts.push({
      id: s.nextId++,
      kind: "rite",
      expedition: null,
      title: "The Moon Rite",
      text: `The moon is rising. Should ${main.name} answer it and become a werewolf? (The wolf packs will run with them, and under a full moon they can't stay dead; but on those nights the beast gets out, and the Hunter's Guild will come.)`,
      options: ["Answer the moon", "Refuse"],
      defaultOption: 1,
      expiresTick: s.tick + 24 * 600
    });
    notify(s, "The Moon Rite is ready. A choice awaits.", true);
  }
  function answerRite(s, label2) {
    const main = s.people.find((p) => p.id === s.mainId);
    const kind = label2.startsWith("Embrace") ? "vampire" : label2.startsWith("Answer the moon") ? "werewolf" : null;
    if (!main || !kind) return notify(s, "The rite was refused.");
    main.monster = kind;
    main.order = "fight";
    main.lastFed = s.tick;
    personFx(s, main.id, kind);
    notify(s, kind === "vampire" ? `${main.name} has become a vampire.` : `${main.name} howls at the moon, and the wolves howl back. ${main.name} is a werewolf now.`, true);
  }
  var occultRevealed = (s) => (s.research.revealed ?? []).includes("forbidden_lore");
  function revealOccult(s, how) {
    if (occultRevealed(s)) return;
    s.research.revealed = [...s.research.revealed ?? [], ...TOPICS.filter((t) => t.branch === "occult").map((t) => t.id)];
    notify(s, `${how} A hidden branch of research has opened: the Occult.`, true);
  }
  var CRYO_COOLDOWN_DAYS = 3;
  var CLONE_COOLDOWN_DAYS = 2;
  var CLONE_SKILL_LOSS = 0.25;
  function tryRevive(s, p) {
    let how = null;
    const day = Math.floor(s.tick / TICKS_PER_DAY);
    const phylactery = s.buildings.find((b) => b.def === "phylactery" && b.status === "done");
    if (phylactery) {
      how = "Dark light gathers at the phylactery";
      p.x = buildingCentreX(phylactery);
    } else if (p.monster === "vampire" && s.vampireRevivedDay !== day) {
      s.vampireRevivedDay = day;
      how = "At dusk the grave stirs";
    } else if (p.monster === "werewolf" && fullMoon(s) && s.werewolfRevivedDay !== day) {
      s.werewolfRevivedDay = day;
      how = "The full moon breaks through the clouds, and the body twitches";
    } else if ((s.items.spirit_totem ?? 0) > 0) {
      addItems(s, "spirit_totem", -1);
      how = "The Spirit Totem crumbles to dust";
    } else {
      const shrine = s.buildings.find((b) => b.def === "resurrection_shrine" && b.status === "done" && !b.spent);
      const ready = (def) => s.buildings.find((b) => b.def === def && b.status === "done" && (b.readyTick ?? 0) <= s.tick);
      const vat = ready("clone_vat");
      const pod = ready("cryo_pod");
      if (vat) {
        vat.readyTick = s.tick + CLONE_COOLDOWN_DAYS * TICKS_PER_DAY;
        for (const sk of Object.values(p.skills)) {
          sk.level = Math.max(1, Math.round(sk.level * (1 - CLONE_SKILL_LOSS)));
          sk.xp = 0;
        }
        how = "The Clone Vat drains, and a familiar face steps out (a little less skilled)";
      } else if (pod) {
        pod.readyTick = s.tick + CRYO_COOLDOWN_DAYS * TICKS_PER_DAY;
        p.traits.push("frail");
        how = "The Cryo Pod hisses open";
      } else if ((s.items.deaths_bargain ?? 0) > 0) {
        addItems(s, "deaths_bargain", -1);
        how = "Death takes the old coin instead";
      } else if (shrine) {
        shrine.spent = true;
        how = "The Resurrection Shrine flares and goes dark";
      }
    }
    if (!how) return false;
    p.hp = Math.round(maxHp(p) * 0.3);
    p.downed = null;
    p.sick = null;
    p.away = null;
    p.task = null;
    if (!phylactery) p.x = campX(s);
    if (!s.people.includes(p)) s.people.push(p);
    s.revivedAt = { tick: s.tick, id: p.id };
    notify(s, `${how}, and ${p.name} draws breath again.`, true);
    return true;
  }

  // src/shared/sim/turning.ts
  var isLich = (s) => s.buildings.some((b) => b.def === "phylactery" && b.status === "done");
  function turnable(s) {
    const out = [];
    if (isLich(s)) out.push("undead");
    if (s.people.some((p) => p.monster === "vampire" && p.away === null)) out.push("vampire");
    if (s.people.some((p) => p.monster === "werewolf" && p.away === null)) out.push("werewolf");
    return out;
  }
  function canTurn(s, p, kind) {
    if (!turnable(s).includes(kind)) return { ok: false, reason: `Nobody in town can make a ${MONSTER_NAMES[kind].toLowerCase()}` };
    if (p.monster) return { ok: false, reason: `${p.name} is already a ${MONSTER_NAMES[p.monster].toLowerCase()}` };
    if (p.bornTick != null) return { ok: false, reason: "Not a child" };
    if (p.away !== null) return { ok: false, reason: "Away" };
    if (p.id === s.mainId) return { ok: false, reason: "Not the founder" };
    return { ok: true };
  }
  function turn(s, p, kind) {
    becomeMonster(s, p, kind);
    personFx(s, p.id, kind);
    if (kind === "undead") {
      const partner = s.people.find((q) => q.id === p.partner);
      if (partner) partner.partner = null;
      p.partner = null;
      p.married = false;
      p.needs = { food: 1, rest: 1 };
    }
  }
  function turnPerson(s, id, kind) {
    const p = s.people.find((q) => q.id === id);
    if (!p) return { ok: false, reason: "Unknown person" };
    const check = canTurn(s, p, kind);
    if (!check.ok) return check;
    turn(s, p, kind);
    s.turningFearUntil = s.tick + TURNING_FEAR_HOURS * TICKS_PER_HOUR;
    notify(s, TURN_TEXT[kind](p.name), true);
    return { ok: true };
  }
  function turnTown(s, kind) {
    const who = s.people.filter((p) => canTurn(s, p, kind).ok);
    for (const p of who) turn(s, p, kind);
    if (who.length) notify(s, TOWN_TEXT[kind](who.length), true);
    return who.length;
  }
  var TURN_TEXT = {
    undead: (n) => `${n} breathes their last, and rises again at the lich's word: undead now.`,
    vampire: (n) => `${n} was given the dark kiss. They are a vampire now.`,
    werewolf: (n) => `${n} was bitten under the moon. They are a werewolf now.`
  };
  var TOWN_TEXT = {
    undead: (n) => `The lich's will sweeps the town: ${n} ${n === 1 ? "soul rises" : "souls rise"} as the undead. This is a haven of the dead now.`,
    vampire: (n) => `One night of blood: ${n} townsfolk ${n === 1 ? "wakes" : "wake"} as vampires. The town belongs to the night.`,
    werewolf: (n) => `The whole town howls at the moon: ${n} more werewolves. The pack is complete.`
  };
  var undeadShare = (s) => s.people.length ? s.people.filter((p) => p.monster === "undead").length / s.people.length : 0;

  // src/shared/data/enemies.ts
  var ENEMIES = {
    wolf: { id: "wolf", name: "Wolf", hp: 28, damage: [3, 6], accuracy: 0.7, dodge: 0.12, interval: 1.1, ranged: false, loot: { hide: 1, meat: 1, bone: 1 }, sprite: { sheet: "wolf", block: 1, scale: 1 } },
    wolf_alpha: { id: "wolf_alpha", name: "Wolf Pack Alpha", hp: 55, damage: [5, 9], accuracy: 0.75, dodge: 0.15, interval: 1, ranged: false, loot: { hide: 2, meat: 2, bone: 1 }, sprite: { sheet: "wolf", block: 2, scale: 1.2 } },
    boar: { id: "boar", name: "Boar", hp: 45, damage: [5, 10], accuracy: 0.6, dodge: 0.08, interval: 1.5, ranged: false, loot: { meat: 3, hide: 1, bone: 1 }, sprite: { sheet: "boar", block: 0, scale: 1 } },
    cave_bear: { id: "cave_bear", name: "Cave Bear", hp: 240, damage: [12, 20], accuracy: 0.7, dodge: 0.05, interval: 1.8, ranged: false, boss: true, loot: { hide: 4, meat: 4, bone: 3 }, sprite: { sheet: "bear", block: 5, scale: 1.8 }, kit: { roar: "The Cave Bear rears up and roars: the whole cave shakes!", enrage: "Bleeding and cornered, the Cave Bear goes berserk!", area: { every: 3, targets: 2, name: "slams the ground", fx: "quake" }, trophy: "bearskin_cloak" } },
    rival_spear: { id: "rival_spear", name: "Rival Tribesman", hp: 40, damage: [4, 8], accuracy: 0.65, dodge: 0.12, interval: 1.2, ranged: false, loot: { flint: 1 }, sprite: { people: "rival", weapon: "spear" } },
    rival_slinger: { id: "rival_slinger", name: "Rival Slinger", hp: 30, damage: [3, 6], accuracy: 0.6, dodge: 0.1, interval: 1.4, ranged: true, loot: { stone: 2 }, sprite: { people: "rival", weapon: null } },
    // Medieval
    bandit: { id: "bandit", name: "Bandit", hp: 50, damage: [5, 9], accuracy: 0.68, dodge: 0.12, interval: 1.2, ranged: false, loot: { iron: 1, cloth: 1 }, sprite: { people: "bandit", weapon: "mace" } },
    bandit_archer: { id: "bandit_archer", name: "Bandit Archer", hp: 38, damage: [4, 8], accuracy: 0.66, dodge: 0.1, interval: 1.4, ranged: true, loot: { arrows: 4, leather: 1 }, sprite: { people: "bandit", weapon: "bow" } },
    bandit_chief: { id: "bandit_chief", name: "Bandit Chief", hp: 120, damage: [8, 13], accuracy: 0.72, dodge: 0.15, interval: 1.2, ranged: false, loot: { iron: 3, bread: 2, cloth: 2 }, sprite: { people: "bandit", weapon: "sword" } },
    guild_hunter: { id: "guild_hunter", name: "Guild Hunter", hp: 80, damage: [8, 12], accuracy: 0.76, dodge: 0.15, interval: 1.2, ranged: false, loot: { iron: 2, cloth: 1 }, sprite: { people: "soldier", weapon: "sword" } },
    // Industrial
    gangster: { id: "gangster", name: "Gang Member", hp: 60, damage: [7, 12], accuracy: 0.68, dodge: 0.14, interval: 1.3, ranged: true, loot: { steel: 1, cloth: 1, shot: 5 }, sprite: { people: "bandit", weapon: null } },
    rifleman: { id: "rifleman", name: "Rifleman", hp: 90, damage: [10, 16], accuracy: 0.74, dodge: 0.12, interval: 1.5, ranged: true, loot: { steel: 2, shot: 8 }, sprite: { people: "soldier", weapon: null } },
    // Epic bosses: each rules a legendary destination, and now and then leads a raid. See bosses.ts.
    black_knight: { id: "black_knight", name: "The Black Knight", hp: 420, damage: [14, 22], accuracy: 0.8, dodge: 0.15, interval: 1.3, ranged: false, boss: true, loot: { iron: 8, leather: 4 }, sprite: { sheet: "dark_knight", block: 0, scale: 1.5 }, kit: { roar: 'The Black Knight lowers his visor. "Kneel, or be broken."', enrage: "The Black Knight casts aside his shield and fights like a storm!", summon: { kind: "soldier", count: 2, text: "The Black Knight sounds his horn: his sworn men answer!" }, trophy: "black_blade" } },
    dragon: { id: "dragon", name: "Vermithrax the Red", hp: 900, damage: [18, 28], accuracy: 0.8, dodge: 0.1, interval: 2, ranged: true, boss: true, loot: { hide: 10, bone: 12 }, sprite: { sheet: "wyvern", block: 0, scale: 1.1 }, kit: { roar: "A roar splits the sky. Vermithrax the Red has come!", enrage: "Blood on its scales, the dragon rises in fury!", area: { every: 3, targets: 3, name: "breathes fire", burns: true, fx: "fire" }, summon: { kind: "drake", count: 2, text: "Hatchlings scramble out of the crags to defend their mother!" }, trophy: "dragonscale_armor" } },
    drake: { id: "drake", name: "Dragon Hatchling", hp: 90, damage: [8, 14], accuracy: 0.72, dodge: 0.15, interval: 1.4, ranged: false, loot: { hide: 2, bone: 2 }, sprite: { sheet: "drakes", block: 1, scale: 1 } },
    iron_baron: { id: "iron_baron", name: "The Iron Baron", hp: 480, damage: [18, 28], accuracy: 0.8, dodge: 0.1, interval: 1.4, ranged: true, boss: true, loot: { steel: 8, shot: 30 }, sprite: { people: "soldier", weapon: null }, kit: { roar: '"Men, machines: to work!" bellows the Iron Baron.', enrage: "The Iron Baron empties both pistols in a rage!", summon: { kind: "rifleman", count: 2, text: "The Iron Baron whistles up his hired guns!" }, trophy: "barons_pistols" } },
    iron_colossus: { id: "iron_colossus", name: "The Iron Colossus", hp: 1100, damage: [22, 32], accuracy: 0.72, dodge: 0, interval: 2.2, ranged: false, boss: true, loot: { steel: 14, coal: 12 }, sprite: { sheet: "golems", block: 1, scale: 2 }, kit: { roar: "Steam shrieks from its vents: the Iron Colossus lumbers into view!", enrage: "Its boiler glowing white, the Colossus overdrives!", area: { every: 3, targets: 2, name: "brings its fists down", burns: false, fx: "quake" }, trophy: "colossus_core" } },
    warlord: { id: "warlord", name: "The Warlord", hp: 650, damage: [22, 32], accuracy: 0.82, dodge: 0.15, interval: 1.3, ranged: true, boss: true, loot: { electronics: 6, cartridges: 40 }, sprite: { people: "soldier", weapon: "sword" }, kit: { roar: "The Warlord stands on his tank and points your way.", enrage: "Wounded, the Warlord calls in everything he has!", summon: { kind: "trooper", count: 2, text: "Reinforcements drop in for the Warlord!" }, trophy: "warlords_banner" } },
    war_machine: { id: "war_machine", name: "The War Machine", hp: 1400, damage: [24, 36], accuracy: 0.75, dodge: 0, interval: 2.4, ranged: true, boss: true, loot: { steel: 16, fuel: 12, electronics: 4 }, sprite: { machine: "tank", scale: 1.15 }, kit: { roar: "Treads grind and the ground shakes: the War Machine rolls in!", enrage: "Smoking and sparking, the War Machine fires everything at once!", area: { every: 3, targets: 3, name: "fires its cannon", burns: true, fx: "shell" }, trophy: "tank_plating" } },
    pirate_king: { id: "pirate_king", name: "The Pirate King", hp: 900, damage: [26, 38], accuracy: 0.85, dodge: 0.2, interval: 1.2, ranged: true, boss: true, loot: { alloys: 8, power_cells: 30 }, sprite: { people: "bandit", weapon: "sword" }, kit: { roar: '"Your stars are mine now," laughs the Pirate King.', enrage: "The Pirate King draws a second blade!", summon: { kind: "space_pirate", count: 2, text: "The Pirate King calls down his boarding crew!" }, trophy: "pirate_crown" } },
    star_mech: { id: "star_mech", name: "The Star Reaver", hp: 1800, damage: [28, 40], accuracy: 0.8, dodge: 0.05, interval: 2, ranged: true, boss: true, loot: { alloys: 14, circuits: 8, power_cells: 20 }, sprite: { still: "sentinel", scale: 0.9 }, kit: { roar: "A war-mech the size of a house drops from the clouds: the Star Reaver!", enrage: "Its armour cracked, the Star Reaver's core burns red!", area: { every: 3, targets: 3, name: "sweeps its beam", burns: true, fx: "beam" }, trophy: "reaver_core" } },
    // Allies (special classes): a Summoner's spirit; a Beast Tamer's wolf; the Necromancer raises the fallen instead
    // (a Necromancer calls the town's own dead up out of the graveyard to defend it)
    grave_ghost: { id: "grave_ghost", name: "Restless Dead", hp: 45, damage: [6, 11], accuracy: 0.75, dodge: 0.35, interval: 1.3, ranged: false, loot: {}, sprite: { sheet: "ghosts", block: 1, scale: 1.1 } },
    spirit: { id: "spirit", name: "Summoned Spirit", hp: 60, damage: [6, 10], accuracy: 0.8, dodge: 0.3, interval: 1.2, ranged: true, loot: {}, sprite: { sheet: "skeleghouls", block: 4, scale: 1 } },
    companion_wolf: { id: "companion_wolf", name: "Wolf Companion", hp: 50, damage: [5, 9], accuracy: 0.75, dodge: 0.15, interval: 1, ranged: false, loot: {}, sprite: { sheet: "wolf", block: 3, scale: 1 } },
    // More from tiny-rpg-town's battle sprites
    ogre: { id: "ogre", name: "Ogre", hp: 170, damage: [12, 20], accuracy: 0.62, dodge: 0.02, interval: 2, ranged: false, loot: { hide: 3, meat: 4, bone: 2 }, sprite: { still: "ogre", scale: 0.55 } },
    hedge_wizard: { id: "hedge_wizard", name: "Hedge Wizard", hp: 55, damage: [9, 15], accuracy: 0.72, dodge: 0.12, interval: 1.6, ranged: true, loot: { herbs: 3, cloth: 1 }, sprite: { still: "wizard", scale: 0.42 } },
    slime: { id: "slime", name: "Bog Slime", hp: 30, damage: [3, 6], accuracy: 0.6, dodge: 0.05, interval: 1.4, ranged: false, loot: { fiber: 1, herbs: 1 }, sprite: { still: "slime", scale: 0.35 } },
    mummy: { id: "mummy", name: "Mummy", hp: 80, damage: [6, 11], accuracy: 0.62, dodge: 0.02, interval: 1.8, ranged: false, loot: { cloth: 2, bone: 1 }, sprite: { still: "mummy", scale: 0.6 } },
    slug_bot: { id: "slug_bot", name: "Crawler Bot", hp: 140, damage: [14, 20], accuracy: 0.72, dodge: 0.02, interval: 1.6, ranged: false, loot: { alloys: 1, circuits: 1 }, sprite: { still: "metal_slug", scale: 0.5 } },
    // The dead (a zombie outbreak, any era)
    zombie: { id: "zombie", name: "Zombie", hp: 45, damage: [4, 8], accuracy: 0.6, dodge: 0.02, interval: 1.6, ranged: false, loot: { bone: 1 }, sprite: { people: "zombie", weapon: null } },
    zombie_hound: { id: "zombie_hound", name: "Rotting Hound", hp: 35, damage: [4, 7], accuracy: 0.7, dodge: 0.1, interval: 1.1, ranged: false, loot: { bone: 1 }, sprite: { sheet: "zombieanimals", block: 0, scale: 1 } },
    // The Rat Plague (see doom.ts): swarms out of the slums, and the Rat King behind them
    rat: { id: "rat", name: "Rat", hp: 14, damage: [2, 5], accuracy: 0.7, dodge: 0.3, interval: 0.8, ranged: false, loot: {}, sprite: { sheet: "mouse", block: 0, scale: 1.5 } },
    plague_rat: { id: "plague_rat", name: "Plague Rat", hp: 22, damage: [3, 6], accuracy: 0.7, dodge: 0.25, interval: 0.9, ranged: false, loot: {}, sprite: { sheet: "mouse", block: 5, scale: 1.7 } },
    rat_king: { id: "rat_king", name: "The Rat King", hp: 650, damage: [14, 22], accuracy: 0.78, dodge: 0.15, interval: 1.2, ranged: false, boss: true, loot: { leather: 4 }, sprite: { sheet: "mouse", block: 3, scale: 3.6 }, kit: { roar: "A squealing tide parts, and the Rat King drags its knotted bulk into the light!", enrage: "Bleeding, the Rat King shrieks, and every rat in the walls answers!", area: { every: 3, targets: 3, name: "sprays filth", fx: "acid" }, summon: { kind: "plague_rat", count: 4, text: "Rats boil up out of the drains to defend their king!" }, trophy: "rat_king_crown" } },
    // The Deep Freeze (see doom.ts): ice mages and what they raise out of the snow, and the Archmage behind it
    ice_mage: { id: "ice_mage", name: "Ice Mage", hp: 50, damage: [8, 13], accuracy: 0.72, dodge: 0.12, interval: 1.6, ranged: true, loot: { herbs: 2, cloth: 1 }, sprite: { people: "frost", weapon: null } },
    ice_golem: { id: "ice_golem", name: "Ice Golem", hp: 120, damage: [10, 16], accuracy: 0.64, dodge: 0, interval: 2, ranged: false, loot: { stone: 3 }, sprite: { sheet: "golems2", block: 1, scale: 1.3 } },
    frost_yeti: { id: "frost_yeti", name: "Frost Yeti", hp: 85, damage: [9, 15], accuracy: 0.7, dodge: 0.1, interval: 1.3, ranged: false, loot: { hide: 3, meat: 2 }, sprite: { sheet: "snowmonkey", block: 1, scale: 1.3 } },
    frost_archmage: { id: "frost_archmage", name: "The Frost Archmage", hp: 700, damage: [16, 26], accuracy: 0.8, dodge: 0.12, interval: 1.5, ranged: true, boss: true, loot: { herbs: 6, cloth: 4 }, sprite: { people: "archmage", weapon: null }, kit: { roar: "The air turns to knives. The Frost Archmage has come to bury the town in ice!", enrage: "Cracked and bleeding frost, the Archmage calls down the whole winter!", area: { every: 3, targets: 3, name: "unleashes a frost nova", fx: "frost" }, summon: { kind: "ice_golem", count: 2, text: "The Archmage raises golems out of the snow!" }, trophy: "staff_of_rime" } },
    zombie_bear: { id: "zombie_bear", name: "Rotting Bear", hp: 150, damage: [10, 16], accuracy: 0.62, dodge: 0, interval: 1.9, ranged: false, loot: { bone: 3, hide: 1 }, sprite: { sheet: "zombieanimals", block: 2, scale: 1.4 } },
    zombie_brute: { id: "zombie_brute", name: "Bloated Brute", hp: 120, damage: [8, 14], accuracy: 0.6, dodge: 0, interval: 2, ranged: false, loot: { bone: 3 }, sprite: { people: "zombie", weapon: "mace" } },
    abomination: { id: "abomination", name: "The Abomination", hp: 700, damage: [14, 24], accuracy: 0.7, dodge: 0, interval: 1.8, ranged: false, boss: true, loot: { bone: 10, herbs: 6 }, sprite: { sheet: "horror", block: 0, scale: 1.4 }, kit: { roar: "A wet, many-throated howl: the Abomination drags itself forward!", enrage: "The Abomination splits open and lashes out wildly!", area: { every: 3, targets: 2, name: "flails its many arms", fx: "acid" }, summon: { kind: "zombie", count: 3, text: "The Abomination spews up more of the dead!" }, trophy: "abomination_heart" } },
    // Robotic & Space
    space_pirate: { id: "space_pirate", name: "Space Pirate", hp: 130, damage: [14, 22], accuracy: 0.76, dodge: 0.16, interval: 1.2, ranged: true, loot: { power_cells: 6, alloys: 1 }, sprite: { people: "bandit", weapon: null } },
    combat_drone: { id: "combat_drone", name: "Combat Drone", hp: 80, damage: [12, 18], accuracy: 0.8, dodge: 0.3, interval: 1, ranged: true, loot: { circuits: 1, power_cells: 2 }, sprite: { still: "observer", scale: 0.45, hover: true } },
    war_bot: { id: "war_bot", name: "War Bot", hp: 220, damage: [18, 26], accuracy: 0.74, dodge: 0.05, interval: 1.5, ranged: false, loot: { alloys: 2, circuits: 1 }, sprite: { still: "steel_eagle", scale: 0.55, hover: true } },
    rogue_ai: { id: "rogue_ai", name: "Rogue AI Core", hp: 500, damage: [22, 32], accuracy: 0.85, dodge: 0.05, interval: 1.4, ranged: true, boss: true, loot: { circuits: 8, alloys: 6 }, sprite: { still: "drone", scale: 0.8, hover: true } },
    // Modern
    trooper: { id: "trooper", name: "Trooper", hp: 110, damage: [12, 18], accuracy: 0.76, dodge: 0.14, interval: 1.3, ranged: true, loot: { cartridges: 10, plastic: 1 }, sprite: { people: "soldier", weapon: null } },
    raider: { id: "raider", name: "Raider", hp: 90, damage: [10, 15], accuracy: 0.7, dodge: 0.16, interval: 1.2, ranged: true, loot: { fuel: 2, electronics: 1 }, sprite: { people: "bandit", weapon: null } },
    commander: { id: "commander", name: "Commander", hp: 200, damage: [14, 22], accuracy: 0.8, dodge: 0.15, interval: 1.2, ranged: true, boss: true, loot: { electronics: 3, cartridges: 20 }, sprite: { people: "soldier", weapon: "sword" } },
    soldier: { id: "soldier", name: "Warband Soldier", hp: 70, damage: [7, 11], accuracy: 0.72, dodge: 0.14, interval: 1.2, ranged: false, loot: { iron: 2, leather: 1 }, sprite: { people: "soldier", weapon: "spear" } }
  };

  // src/shared/sim/combat.ts
  var ammoOf = (p) => p.gear.weapon ? ITEM_BY_ID[p.gear.weapon]?.effects.ammo ?? null : null;
  var isBeast = (kind) => !!ENEMIES[kind] && "sheet" in ENEMIES[kind].sprite;
  var MIN_TICKS_BEFORE_RETREAT = 2 * TICK_HZ;
  var PERSON_INTERVAL = 1.2;
  function personFighter(p, role, row, ammo = 0) {
    const melee = p.skills.melee.level;
    const ranged = p.skills.ranged.level;
    const weapon = p.gear.weapon ? ITEM_BY_ID[p.gear.weapon] : void 0;
    const knife = p.gear.tool ? ITEM_BY_ID[p.gear.tool]?.effects.damage ?? 0 : 0;
    const sling = !!weapon?.effects.ranged;
    const useRanged = sling || row === "back" || ranged > melee + 2;
    const skill = useRanged ? ranged : melee;
    const bonus = useRanged ? sling ? weapon.effects.damage ?? 0 : 0 : sling || !weapon ? knife : weapon.effects.damage ?? 0;
    const aim = weapon && sling === useRanged ? weapon.effects.accuracy ?? 0 : 0;
    const base = useRanged ? [Math.round(2 + ranged * 0.5), Math.round(4 + ranged * 0.5)] : [Math.round(3 + melee * 0.6), Math.round(5 + melee * 0.6)];
    const wolf = p.monster === "werewolf" ? WEREWOLF_DAMAGE : 0;
    const damage = [base[0] + bonus + wolf, base[1] + bonus + wolf];
    const g = gearEffects(p);
    return {
      side: "party",
      ref: p.id,
      kind: "person",
      name: p.name,
      hp: p.hp,
      maxHp: maxHp(p),
      row,
      ranged: useRanged,
      damage: role === "porter" ? [0, 0] : damage,
      accuracy: 0.55 + skill * 0.025 + aim,
      dodge: 0.05 + melee * 0.01,
      interval: Math.round(PERSON_INTERVAL * TICK_HZ),
      cooldown: 0,
      down: p.hp <= 0,
      role,
      heal: role === "medic" ? 3 + p.skills.medicine.level * 0.5 : 0,
      tough: p.traits.includes("tough"),
      coward: p.traits.includes("coward"),
      lastAction: -99,
      lastHit: -99,
      attacks: 0,
      armor: Math.min(0.6, g.armor),
      block: g.block,
      beastDamage: g.beastDamage,
      ammoType: ammoOf(p),
      ammo: ammoOf(p) ? ammo : 0,
      ammoBonus: AMMO_DAMAGE[ammoOf(p) ?? "wood"] ?? 0,
      ammoUsed: 0,
      cls: p.cls ?? null
    };
  }
  function hitDamage(f, target, rng) {
    let dmg = rng.int(f.damage[0], f.damage[1]);
    if (f.ammoBonus && f.ammo > 0) {
      f.ammo--;
      f.ammoUsed++;
      dmg += f.ammoBonus;
    }
    if (isBeast(target.kind)) dmg += f.beastDamage;
    if (target.block && rng.chance(target.block)) return 0;
    return Math.max(1, Math.round(dmg * (1 - target.armor) * (target.tough ? 0.85 : 1)));
  }
  function enemyFighters(group) {
    const out = [];
    for (const [id, n] of Object.entries(group)) for (let i = 0; i < n; i++) out.push(unitFighter(id, "enemy", out.length));
    return out;
  }
  function unitFighter(id, side, ref) {
    const d = ENEMIES[id];
    return {
      side,
      ref,
      kind: id,
      name: d.name,
      hp: d.hp,
      maxHp: d.hp,
      row: d.ranged ? "back" : "front",
      ranged: d.ranged,
      damage: d.damage,
      accuracy: d.accuracy,
      dodge: d.dodge,
      interval: Math.round(d.interval * TICK_HZ),
      cooldown: 0,
      down: false,
      role: side === "enemy" ? "enemy" : "fighter",
      heal: 0,
      tough: false,
      coward: false,
      lastAction: -99,
      lastHit: -99,
      attacks: 0,
      armor: 0,
      block: 0,
      beastDamage: 0,
      ammo: 0,
      ammoBonus: 0,
      ammoUsed: 0
    };
  }
  function startBattle(members, roles, group, rng, ammo = {}) {
    const standing = members.filter((p) => p.hp > 0 && !p.downed);
    const anyFighter = standing.some((p) => (roles[p.id] ?? "fighter") === "fighter");
    const party = standing.map((p) => {
      const role = roles[p.id] ?? "fighter";
      const front = role === "fighter" || !anyFighter && role !== "porter";
      const kind = ammoOf(p);
      const shooters = kind ? standing.filter((q) => ammoOf(q) === kind) : [];
      const have = kind ? ammo[kind] ?? 0 : 0;
      const i = shooters.indexOf(p);
      const share = i < 0 ? 0 : Math.floor(have / shooters.length) + (i < have % shooters.length ? 1 : 0);
      return personFighter(p, role, front ? "front" : "back", share);
    });
    const fighters = [...party, ...enemyFighters(group)];
    for (const f of fighters) f.cooldown = rng.int(1, f.interval);
    return { fighters, tick: 0, outcome: null, boss: Object.keys(group).some((id) => ENEMIES[id].boss) };
  }
  function stepBattle(b, rng, rules) {
    if (b.outcome) return;
    b.tick++;
    for (const f of b.fighters) {
      if (f.down || --f.cooldown > 0) continue;
      f.cooldown = f.interval;
      if (f.role === "porter") continue;
      if (f.role === "medic") {
        const hurt = b.fighters.filter((o) => o.side === f.side && !o.down && o.hp < o.maxHp).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
        if (hurt) {
          hurt.hp = Math.min(hurt.maxHp, hurt.hp + f.heal);
          f.lastAction = b.tick;
        }
        continue;
      }
      if (f.coward && f.row === "front" && f.hp < f.maxHp * 0.6) {
        f.row = "back";
        f.ranged = true;
      }
      const foes = b.fighters.filter((o) => o.side !== f.side && !o.down);
      if (!foes.length) break;
      const front = foes.filter((o) => o.row === "front");
      const reachable = f.ranged || !front.length ? foes : front;
      const target = f.ranged ? reachable.reduce((a, c) => c.hp < a.hp ? c : a) : reachable[rng.int(0, reachable.length - 1)];
      f.lastAction = b.tick;
      f.attacks++;
      if (rng.next() >= f.accuracy - target.dodge) {
        if (f.ammoBonus && f.ammo > 0) f.ammo--, f.ammoUsed++;
        continue;
      }
      const kit = f.kind !== "person" ? ENEMIES[f.kind]?.kit : void 0;
      if (kit?.area) {
        f.bossAttacks = (f.bossAttacks ?? 0) + 1;
        if (f.bossAttacks % kit.area.every === 0) {
          const hit = foes.slice().sort(() => rng.next() - 0.5).slice(0, kit.area.targets);
          for (const t of hit) {
            const d = hitDamage(f, t, rng);
            t.hp = Math.max(0, t.hp - d);
            t.lastHit = b.tick;
            t.hitFx = null;
            if (t.hp === 0) t.down = true;
          }
          (b.shouts ??= []).push(`${f.name} ${kit.area.name}!`);
          f.lastArea = b.tick;
          continue;
        }
      }
      let dmg = hitDamage(f, target, rng);
      if (!dmg) continue;
      if (f.cls === "blood_knight") {
        if (f.hp < f.maxHp / 2) dmg = Math.round(dmg * BLOOD_FURY);
        f.hp = Math.min(f.maxHp, f.hp + Math.round(dmg * BLOOD_LIFESTEAL));
      }
      target.hp = Math.max(0, target.hp - dmg);
      target.lastHit = b.tick;
      target.hitFx = f.cls === "blood_knight" ? "blood" : f.ranged && f.ammoType === "power_cells" ? "lightning" : f.ranged && (f.ammoType === "shot" || f.ammoType === "cartridges") ? "fire" : null;
      bossHurt(b, target);
      if (target.hp === 0) {
        target.down = true;
        const necro = target.side === "enemy" ? b.fighters.find((o) => o.side === "party" && o.cls === "necromancer" && !o.down && (o.raised ?? 0) < NECRO_RAISES) : void 0;
        if (necro && !ENEMIES[target.kind]?.boss) {
          necro.raised = (necro.raised ?? 0) + 1;
          target.side = "party";
          target.role = "fighter";
          target.down = false;
          target.hp = Math.round(target.maxHp / 2);
          target.raisedBy = necro.ref;
        }
      }
    }
    const party = b.fighters.filter((f) => f.side === "party");
    const enemies = b.fighters.filter((f) => f.side === "enemy");
    if (enemies.every((f) => f.down)) b.outcome = "won";
    else if (party.every((f) => f.down || f.role === "porter")) b.outcome = "lost";
    else if (b.tick >= MIN_TICKS_BEFORE_RETREAT) {
      const hp = party.reduce((n, f) => n + f.hp, 0) / party.reduce((n, f) => n + f.maxHp, 0);
      const main = party.find((f) => f.ref === rules.mainId);
      if (hp < rules.retreatAt || main && !main.down && main.hp < main.maxHp * 0.5 || main && main.down) b.outcome = "retreated";
    }
  }
  function bossHurt(b, f) {
    const kit = f.kind !== "person" ? ENEMIES[f.kind]?.kit : void 0;
    if (!kit || f.down || f.hp >= f.maxHp / 2) return;
    if (!f.enraged) {
      f.enraged = true;
      f.damage = [Math.round(f.damage[0] * BOSS_RAGE), Math.round(f.damage[1] * BOSS_RAGE)];
      f.interval = Math.max(3, Math.round(f.interval * 0.75));
      (b.shouts ??= []).push(kit.enrage);
    }
    if (kit.summon && !f.summoned) {
      f.summoned = true;
      for (let i = 0; i < kit.summon.count; i++) b.fighters.push({ ...unitFighter(kit.summon.kind, f.side, 100 + b.fighters.length), cooldown: 5 });
      (b.shouts ??= []).push(kit.summon.text);
    }
  }
  var BOSS_RAGE = 1.5;
  function battleLoot(b) {
    const out = {};
    for (const f of b.fighters) {
      if (f.side !== "enemy" || !f.down) continue;
      for (const [m, n] of Object.entries(ENEMIES[f.kind].loot)) out[m] = (out[m] ?? 0) + (n ?? 0);
    }
    return out;
  }

  // src/shared/sim/fire.ts
  function flammable(b) {
    const c = BUILDING_BY_ID[b.def].cost;
    const soft = (c.wood ?? 0) + (c.lumber ?? 0) + (c.fiber ?? 0) + (c.hide ?? 0) + (c.cloth ?? 0);
    const hard = (c.stone ?? 0) + (c.bricks ?? 0) + (c.clay ?? 0) + (c.iron ?? 0);
    return soft > hard && b.def !== "campfire" || b.def === "phylactery";
  }
  var burning = (s) => s.buildings.filter((b) => b.fire !== void 0);
  function setFire(s, b, force = false) {
    if (b.status !== "done" || b.fire !== void 0 || !force && !flammable(b)) return false;
    b.fire = 1e-3;
    notify(s, `The ${defOf(b).name.toLowerCase()} is on fire!`, true);
    return true;
  }
  function updateFires(s, rng) {
    for (const b of burning(s)) {
      b.fire += 1 / (BURN_HOURS * TICKS_PER_HOUR);
      if (rng.chance(SPREAD_PER_HOUR / TICKS_PER_HOUR)) {
        const next = s.buildings.find((o) => o !== b && o.fire === void 0 && defOf(o).layer === defOf(b).layer && gap(o, b) <= 1 && flammable(o) && o.status === "done");
        if (next) setFire(s, next);
      }
      if (b.fire >= 1) {
        s.buildings = s.buildings.filter((q) => q !== b);
        notify(s, `The ${defOf(b).name.toLowerCase()} burned down.`, true);
      }
    }
  }
  function gap(a, b) {
    const [l, r] = a.tile < b.tile ? [a, b] : [b, a];
    return r.tile - (l.tile + defOf(l).width);
  }
  function fireToFight(s, p) {
    let best = null;
    for (const b of burning(s)) if (!best || Math.abs(buildingCentreX(b) - p.x) < Math.abs(buildingCentreX(best) - p.x)) best = b;
    return best;
  }
  function fightFire(s, p, b) {
    if (b.fire === void 0) return true;
    const work = skillSpeed(p.skills.construction.level) * workFactor(s, p) / (EXTINGUISH_SECONDS * TICK_HZ * (1 + b.fire * 2));
    b.fire -= work;
    if (b.fire > 0) return false;
    delete b.fire;
    notify(s, `The fire at the ${defOf(b).name.toLowerCase()} is out.`);
    return true;
  }

  // src/shared/sim/bosses.ts
  var DREAD_HOURS = 6;
  var DREAD_MORALE = -6;
  var TRIUMPH_HOURS = 36;
  var TRIUMPH_MORALE = 10;
  var AREA_REACH = 90;
  var kitOf = (kind) => ENEMIES[kind]?.kit;
  function bossArrives(s, kind) {
    const kit = kitOf(kind);
    if (!kit) return;
    notify(s, kit.roar, true);
    s.dreadUntil = s.tick + DREAD_HOURS * TICKS_PER_HOUR;
    s.bossShake = s.tick;
  }
  function bossesInRaid(s, r) {
    for (const rd of r.raiders) {
      const kit = kitOf(rd.kind);
      if (!kit || rd.ally) continue;
      if (rd.down) {
        if (!rd.trophyGiven) {
          rd.trophyGiven = true;
          bossSlain(s, rd.kind);
        }
        continue;
      }
      if (rd.hp >= rd.maxHp / 2) continue;
      if (!rd.enraged) {
        rd.enraged = true;
        notify(s, kit.enrage, true);
        s.bossShake = s.tick;
      }
      if (kit.summon && !rd.summoned) {
        rd.summoned = true;
        const d = ENEMIES[kit.summon.kind];
        for (let i = 0; i < kit.summon.count; i++) {
          r.raiders.push({ id: s.nextId++, kind: kit.summon.kind, x: rd.x - rd.dir * (20 + i * 16), dir: rd.dir, hp: d.hp, maxHp: d.hp, cooldown: 10, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: "harm" });
        }
        notify(s, kit.summon.text, true);
      }
    }
  }
  function bossBlow(s, rd, targets, hit) {
    const kit = kitOf(rd.kind);
    if (!kit) return 1;
    const rage = rd.enraged ? BOSS_RAGE : 1;
    if (!kit.area) return rage;
    rd.bossAttacks = (rd.bossAttacks ?? 0) + 1;
    if (rd.bossAttacks % kit.area.every !== 0) return rage;
    const near = targets.filter((p) => Math.abs(p.x - rd.x) <= AREA_REACH).slice(0, kit.area.targets);
    for (const p of near) {
      p.hp = Math.max(0, p.hp - Math.round(hit(p) * rage));
      if (p.hp === 0 && !p.downed) knockDown(s, p);
    }
    if (kit.area.burns) {
      const b = s.buildings.filter((q) => q.status === "done" && q.fire === void 0 && !BUILDING_BY_ID[q.def].hp).sort((a, c) => Math.abs(buildingCentreX(a) - rd.x) - Math.abs(buildingCentreX(c) - rd.x))[0];
      if (b && Math.abs(buildingCentreX(b) - rd.x) < AREA_REACH * 2) setFire(s, b, true);
    }
    notify(s, `${ENEMIES[rd.kind].name} ${kit.area.name}!`);
    rd.lastArea = s.tick;
    s.bossShake = s.tick;
    rd.cooldown += Math.round(TICK_HZ * 0.5);
    return 0;
  }
  function bossSlain(s, kind) {
    const kit = kitOf(kind);
    if (!kit) return;
    s.items[kit.trophy] = (s.items[kit.trophy] ?? 0) + 1;
    s.triumph = { until: s.tick + TRIUMPH_HOURS * TICKS_PER_HOUR, name: ENEMIES[kind].name };
    s.dreadUntil = 0;
    notify(s, `${ENEMIES[kind].name} is slain! The town takes ${ITEM_BY_ID[kit.trophy]?.name ?? "a trophy"} as a trophy.`, true);
    if (kind === "frost_archmage" && s.doom?.kind === "deep_freeze" && s.doom.phase === "active") s.doom.untilTick = s.tick;
    if (kind === "rat_king" && s.doom?.kind === "rat_plague" && s.doom.phase === "active") s.doom.untilTick = s.tick;
  }

  // src/shared/data/doom.ts
  var DOOMS = {
    drought: {
      name: "Drought",
      signs: "The streams are running low and the air is dry. A drought is coming.",
      strikes: "Drought! Fields stop growing and wild food is scarce. A well would help.",
      ends: "Rain at last. The drought is over.",
      warnHours: 24,
      hours: [48, 96],
      weight: 1
    },
    plague: {
      name: "Plague",
      signs: "Travellers speak of a sickness in the villages nearby. Plague may be coming.",
      strikes: "Plague has reached the town!",
      ends: "The last of the sick are on the mend. The plague has passed.",
      warnHours: 24,
      hours: [0, 0],
      weight: 1
    },
    ash_winter: {
      name: "Ash Winter",
      signs: "The ground trembled in the night and the sky to the west is dark. Ash is coming.",
      strikes: "Ash blots out the sun! Nothing grows, foraging is poor, and spirits are low. Live on what you stored.",
      ends: "The ash has settled and the sun is back.",
      warnHours: 24,
      hours: [48, 84],
      weight: 1,
      era: "medieval"
    },
    smog: {
      name: "Smog",
      signs: "The smoke from the works hangs low and the air tastes of soot. Smog is building.",
      strikes: "Smog! The air is thick with soot: everyone in town slowly sickens and spirits drop. A hospital helps.",
      ends: "The wind has changed and the smog has cleared.",
      warnHours: 24,
      hours: [36, 72],
      weight: 1,
      era: "industrial"
    },
    war: {
      name: "War",
      signs: "News comes of armies massing on the border. War is coming.",
      strikes: "War! Raids will come again and again, and harder, until it ends. Man the walls.",
      ends: "The war is over. The roads fall quiet.",
      warnHours: 36,
      hours: [72, 120],
      weight: 1,
      era: "modern"
    },
    meteors: {
      name: "Meteor shower",
      signs: "The observatory has spotted rocks falling toward the town. A meteor shower is coming.",
      strikes: "Meteors! Fire rains from the sky.",
      ends: "The sky is clear again.",
      warnHours: 36,
      hours: [2, 4],
      weight: 1,
      era: "space"
    },
    outbreak: {
      name: "Zombie outbreak",
      signs: "Travellers whisper that the dead are walking in the villages nearby. Bar the gates.",
      strikes: "The dead are rising! Wave after wave will come, and anyone who falls may rise again.",
      ends: "The last of the dead lie still. The outbreak is over.",
      warnHours: 24,
      hours: [60, 96],
      weight: 0.6
    },
    deep_freeze: {
      name: "Deep Freeze",
      signs: "Frost out of season, and robed figures seen walking the snowline. Ice mages are coming: stack the firewood.",
      strikes: "The Deep Freeze! The ice mages bring winter with them: nothing grows outdoors, the town must burn wood or coal to keep warm, and they will attack again and again. Slay their Archmage to break it.",
      ends: "The ice cracks and melts. The Deep Freeze is over.",
      warnHours: 24,
      hours: [60, 96],
      weight: 0.7
    },
    rat_plague: {
      name: "Rat Plague",
      signs: "Scratching in the walls and droppings in the grain. Something is breeding in the slums.",
      strikes: "The Rat Plague! Swarms pour out of the cellars: they eat the stores, their bites carry sickness, and they keep coming. Kill their Rat King to end it.",
      ends: "The last of the rats slink away. The Rat Plague is over.",
      warnHours: 24,
      hours: [60, 96],
      weight: 0.8,
      era: "industrial"
    },
    meltdown: {
      name: "Meltdown",
      signs: "The power station is running hot, and the gauges will not settle. Something is going wrong in the reactor.",
      strikes: "Meltdown! The power station is ablaze and fallout drifts over the town: everyone outdoors sickens, and nothing grows. A hospital helps.",
      ends: "The fallout has blown away. The air is clean again.",
      warnHours: 24,
      hours: [36, 60],
      weight: 0.8,
      era: "modern"
    },
    rogue_ai: {
      name: "Machine uprising",
      signs: "The worker bots are acting strangely, and machines have been seen gathering in the hills.",
      strikes: "The machines have risen! Worker bots down tools, and drone swarms attack again and again.",
      ends: "The rogue machines have gone quiet. The bots return to work.",
      warnHours: 24,
      hours: [48, 96],
      weight: 1,
      era: "space"
    }
  };
  var DOOM_FIRST_DAY = 5;
  var DOOM_EVERY_DAYS = [6, 10];
  var DROUGHT_GROWTH = 0;
  var DROUGHT_GROWTH_WELL = 0.6;
  var DROUGHT_FORAGE = 0.5;
  var PLAGUE_SPREAD = 0.04;
  var PLAGUE_HP_PER_HOUR = 1.2;
  var PLAGUE_HOURS = [24, 48];
  var PLAGUE_WORK = 0.6;
  var PLAGUE_MORALE = -8;
  var ASH_FORAGE = 0.4;
  var ASH_MORALE = -6;
  var SMOG_MIN_WORKS = 3;
  var SMOKY_WORKS = ["coal_mine", "steelworks", "glassworks", "factory", "gunsmith", "power_station", "refinery", "cement_works"];
  var SMOG_HP_PER_HOUR = 0.8;
  var SMOG_MORALE = -6;
  var WAR_RAID_EVERY_HOURS = 10;
  var WAR_RAID_BUDGET = 1.5;
  var OUTBREAK_FROM_DAY = 8;
  var ZOMBIE_WAVE_HOURS = 8;
  var ABOMINATION_BEFORE_END_HOURS = 12;
  var FREEZE_FROM_DAY = 10;
  var FREEZE_WAVE_HOURS = 10;
  var ARCHMAGE_BEFORE_END_HOURS = 30;
  var ARCHMAGE_HP_BY_ERA = { neolithic: 0.35, medieval: 0.6, industrial: 1, modern: 1.5, space: 2 };
  var FREEZE_FORAGE = 0.3;
  var FREEZE_PEOPLE_PER_HEAT = 4;
  var HEAT_VALUE = { wood: 1, coal: 3, fuel: 4 };
  var FREEZE_HEATERS = ["power_station"];
  var FREEZE_HP_PER_HOUR = 2;
  var FREEZE_COLD_MORALE = -12;
  var FREEZE_MORALE = -4;
  var RAT_WAVE_HOURS = 8;
  var RAT_KING_BEFORE_END_HOURS = 30;
  var RATS_EAT_PER_HOUR = 0.02;
  var RAT_BITE_SICKNESS = 0.25;
  var RAT_KING_HP_BY_ERA = { industrial: 1, modern: 1.6, space: 2.4 };
  var FALLOUT_HP_PER_HOUR = 1.5;
  var FALLOUT_MORALE = -8;
  var METEOR_HITS = [1, 3];

  // src/shared/sim/townsfolk.ts
  var FOOD_PER_HOUR = 1 / 24;
  var REST_PER_HOUR = 1 / 18;
  var SLEEP_PER_HOUR = 1 / 8;
  var GROUND_SLEEP = 0.7;
  var HUNGRY = 0.4;
  var MORALE_DRIFT_PER_HOUR = 10;
  var SULK_MORALE = 15;
  var XP_BOOST = 1.5;
  var ARRIVAL_BASE = 0.06;
  var ARRIVAL_CAMPFIRE = 0.04;
  var ARRIVAL_CIRCLE = 0.06;
  var VISITOR_WAIT_HOURS = 6;
  var ARRIVAL_PER_REPUTATION = 0.02;
  var ARRIVAL_REPUTATION_MAX = 0.1;
  function drainNeeds(p, asleep) {
    if (p.monster === "undead") return;
    const glutton = p.traits.includes("glutton") ? 1.5 : 1;
    p.needs.food = Math.max(0, p.needs.food - FOOD_PER_HOUR * glutton / TICKS_PER_HOUR);
    if (!asleep) p.needs.rest = Math.max(0, p.needs.rest - REST_PER_HOUR / TICKS_PER_HOUR);
  }
  function isNight(hour) {
    return hour >= 22 || hour < 5;
  }
  function wantsSleep(s, p) {
    if (p.monster === "undead") return false;
    return isNight(calendar(s.tick).hour) && p.needs.rest < 0.9 || p.needs.rest < 0.15;
  }
  function wantsToWake(s, p) {
    if (p.downed) return false;
    const h = calendar(s.tick).hour;
    return p.needs.rest >= 1 || h >= 6 && h < 22 && p.needs.rest >= 0.6;
  }
  function mood(s, p) {
    const reasons = [];
    const add = (text, value) => reasons.push({ text, value });
    const { food, rest } = p.needs;
    if (food <= 0.02) add("Starving", -25);
    else if (food < 0.25) add("Hungry", -10);
    else if (food >= 0.5) add("Well fed", 5);
    if (rest <= 0.02) add("Exhausted", -18);
    else if (rest < 0.2) add("Tired", -8);
    else if (rest >= 0.5) add("Rested", 3);
    if (p.lastSlept === "bed") add("Slept in a bed", 5);
    else if (p.lastSlept === "bedroll") add("Slept on a bedroll", -1);
    else if (p.lastSlept === "ground") add("Slept on the ground", -6);
    const charm = gearEffects(p).morale;
    if (charm) add("Lucky charm", charm);
    const done = (id) => s.buildings.some((b) => b.def === id && b.status === "done");
    if (done("campfire")) add("Warm campfire", 5);
    if (done("storytellers_circle")) add("Stories by the fire", 6);
    const best = s.buildings.filter((b) => b.status === "done" && BUILDING_BY_ID[b.def]?.morale).map((b) => {
      const m = BUILDING_BY_ID[b.def].morale;
      if (b.def !== "tavern") return m;
      const market2 = s.buildings.some((q) => q.def === "market" && q.status === "done" && Math.abs(q.tile - b.tile) <= ADJACENT_TILES);
      return [Math.round(TAVERN_BASE + operatorSkill(s, "tavern") * TAVERN_PER_LEVEL) + (market2 ? TAVERN_MARKET_MORALE : 0), market2 ? `${m[1]}, by the market` : m[1]];
    }).sort((a, b) => b[0] - a[0])[0];
    if (best) add(best[1], best[0]);
    if (p.traits.includes("loner") && s.people.length > 4) add("Too many people (Loner)", -10);
    if (p.downed) add("Badly hurt", -12);
    else if (isInjured(p)) add("Injured", -6);
    if (s.tick < s.mourningUntil) {
      if (hasGraveyard(s)) add("Mourning a death (laid to rest)", MOURNING_LAID_TO_REST);
      else add("Mourning a death", MOURNING_MORALE);
    }
    if (p.grief && s.tick < p.grief.until) add(p.grief.text, p.grief.value);
    if (p.sick) add("Sick with the plague", PLAGUE_MORALE);
    if (s.doom?.phase === "active" && s.doom.kind === "ash_winter") add("Ash blots out the sun", ASH_MORALE);
    if (s.doom?.phase === "active" && s.doom.kind === "smog" && p.away === null) add("Choking smog", SMOG_MORALE);
    if (s.doom?.phase === "active" && s.doom.kind === "meltdown" && p.away === null && p.monster !== "undead") add("Fallout sickness", FALLOUT_MORALE);
    if (s.doom?.phase === "active" && s.doom.kind === "deep_freeze" && p.away === null && p.monster !== "undead") add(s.doom.cold ? "Freezing: nothing left to burn" : "The Deep Freeze", s.doom.cold ? FREEZE_COLD_MORALE : FREEZE_MORALE);
    if (!p.monster && s.people.some((q) => q.monster === "vampire" && q.away === null)) add("Uneasy nights (a vampire in town)", UNEASY_MORALE);
    if (s.tick < s.celebrationUntil) add("A wedding in town", 5);
    if (s.tick < (s.dreadUntil ?? 0)) add("A monster at the gates", DREAD_MORALE);
    if (s.triumph && s.tick < s.triumph.until) add(`Slew ${s.triumph.name}`, TRIUMPH_MORALE);
    if (!p.monster && s.people.some((q) => q.monster === "undead" && q.away === null)) add("Living among the dead", LIVING_AMONG_DEAD_MORALE);
    if (!p.monster && s.tick < (s.turningFearUntil ?? 0)) add("Afraid of being turned", TURNING_FEAR_MORALE);
    if (p.monster === "vampire" && s.tick - (p.lastFed ?? s.tick) > FEED_HOURS * 1.5 * TICKS_PER_HOUR) add("Thirsting for blood", THIRST_MORALE);
    const partner = p.partner == null ? void 0 : s.people.find((q) => q.id === p.partner);
    if (partner) add(p.married ? `Married to ${partner.name}` : `In love with ${partner.name}`, p.married ? 6 : 4);
    if (friendsOf(s, p).some((f) => f.id !== p.partner)) add("Has friends", 3);
    const rival = rivalsOf(s, p)[0];
    if (rival) add(`Can't stand ${rival.name}`, -5);
    if (s.people.some((k) => isChild(k) && k.parents?.includes(p.id))) add("A child to raise", 3);
    if (isChild(p)) add(done("school") ? "Learning at school" : "Playing", 5);
    const target = Math.max(0, Math.min(100, 50 + reasons.reduce((n, r) => n + r.value, 0)));
    return { target, reasons };
  }
  var MORALE_EVERY = 10;
  function driftMorale(s, p) {
    if (s.tick % MORALE_EVERY !== 0) return;
    const { target } = mood(s, p);
    const step = MORALE_DRIFT_PER_HOUR / TICKS_PER_HOUR * MORALE_EVERY;
    p.morale = p.morale < target ? Math.min(target, p.morale + step) : Math.max(target, p.morale - step);
  }
  var DRILL_XP_PER_HOUR = 25;
  function drillGuards(s) {
    if (s.tick % TICKS_PER_HOUR !== 0 || s.raid) return;
    if (!s.buildings.some((b) => b.def === "barracks" && b.status === "done")) return;
    for (const p of s.people) {
      if (p.away !== null || p.downed || p.bornTick != null || p.priorities.defend !== 1) continue;
      gainSkill(p, "melee", DRILL_XP_PER_HOUR);
      gainSkill(p, "ranged", DRILL_XP_PER_HOUR);
    }
  }
  var BOT_WORK = 0.05;
  var MAX_BOTS = 10;
  function workFactor(s, p) {
    let f = 1;
    if (p.traits.includes("hard_worker")) f *= 1.2;
    if (p.traits.includes("lazy")) f *= 0.8;
    if (p.traits.includes("night_owl")) {
      const h = calendar(s.tick).hour;
      f *= h >= 20 || h < 5 ? 1.2 : 0.9;
    }
    if (p.morale >= 70) f *= 1.1;
    else if (p.morale < 30) f *= 0.85;
    if (p.needs.food <= 0.02) f *= 0.7;
    if (p.needs.rest <= 0.02) f *= 0.7;
    if (isInjured(p)) f *= 0.8;
    if (p.sick) f *= PLAGUE_WORK;
    if (p.monster === "vampire") {
      const h = calendar(s.tick).hour;
      f *= h >= 20 || h < 5 ? VAMPIRE_NIGHT_WORK : VAMPIRE_DAY_WORK;
    }
    const uprising = s.doom?.kind === "rogue_ai" && s.doom.phase === "active";
    const bots = uprising ? 0 : Math.min(MAX_BOTS, s.items.worker_bot ?? 0);
    if (bots) f *= 1 + BOT_WORK * bots;
    return f;
  }
  function gainSkill(p, skill, xp) {
    const k = (p.passions.includes(skill) ? XP_BOOST : 1) * (p.traits.includes("quick_learner") ? XP_BOOST : 1);
    gainXp(p.skills[skill], xp * k);
  }
  function housingCapacity(s) {
    return s.buildings.reduce((n, b) => n + (b.status === "done" ? BUILDING_BY_ID[b.def].housing ?? 0 : 0), 0);
  }
  function assignBeds(s) {
    const used = /* @__PURE__ */ new Map();
    for (const p of s.people) {
      const b = p.bed === null ? void 0 : s.buildings.find((q) => q.id === p.bed);
      if (!b || b.status !== "done" || !defOf(b).housing) p.bed = null;
      else used.set(b.id, (used.get(b.id) ?? 0) + 1);
    }
    for (const p of s.people) {
      if (p.bed !== null) continue;
      const free = s.buildings.find((b) => b.status === "done" && (defOf(b).housing ?? 0) > (used.get(b.id) ?? 0));
      if (!free) return;
      p.bed = free.id;
      used.set(free.id, (used.get(free.id) ?? 0) + 1);
    }
  }
  function campEdgeX(s, side) {
    let t = Math.floor(s.tiles.length / 2);
    while (t + side >= 0 && t + side < s.tiles.length && s.tiles[t + side].terrain === "clear") t += side;
    return (t + 0.5 - side) * TILE;
  }
  function maybeArrive(s, rng) {
    if (s.tick % TICKS_PER_HOUR !== 0 || s.visitor) return;
    if (housingCapacity(s) <= s.people.length) return;
    const done = (id) => s.buildings.some((b) => b.def === id && b.status === "done");
    const chance = ARRIVAL_BASE + (done("campfire") ? ARRIVAL_CAMPFIRE : 0) + (done("storytellers_circle") ? ARRIVAL_CIRCLE : 0) + s.buildings.reduce((n, b) => n + (b.status === "done" ? BUILDING_BY_ID[b.def]?.arrivals ?? 0 : 0), 0) + Math.min(ARRIVAL_REPUTATION_MAX, s.reputation * ARRIVAL_PER_REPUTATION);
    if (!rng.chance(chance * (undeadShare(s) >= 0.5 ? UNDEAD_TOWN_ARRIVALS : 1))) return;
    const side = rng.chance(0.5) ? -1 : 1;
    const edge = side < 0 ? 0 : WORLD_WIDTH;
    const monster = occultRevealed(s) && rng.chance(MONSTER_ARRIVAL) ? rng.pick(["werewolf", "vampire"]) : null;
    const type = monster ?? rng.weighted(ARRIVING_TYPES);
    const person = makePerson(rng, s.nextId++, type, edge, [...s.people.map((p) => p.name)]);
    if (monster) becomeMonster(s, person, monster);
    const roll = mixSeed(hashSeed(s.seed), person.id * 7919);
    if (!monster && roll % 1e3 < RARE_CLASS_CHANCE * 1e3) person.cls = CLASSES[Math.floor(roll / 1e3) % CLASSES.length];
    person.dir = side < 0 ? 1 : -1;
    s.visitor = { person, waitX: campEdgeX(s, side), leavesTick: s.tick + VISITOR_WAIT_HOURS * TICKS_PER_HOUR, leavingTo: null };
    const trained = person.cls ? ` (a ${CLASS_DEFS[person.cls].name}!)` : "";
    notify(s, `${/^[aeiou]/.test(type) ? "An" : "A"} ${type}${trained} is coming to camp. See Townsfolk.`, !!person.cls);
  }
  function updateVisitor(s, walkTo2) {
    const v = s.visitor;
    if (!v) return;
    if (v.leavingTo === null && s.tick >= v.leavesTick) {
      v.leavingTo = edgeBehind(v);
      notify(s, `${v.person.name} got tired of waiting and moved on.`);
    }
    if (v.leavingTo !== null) {
      if (walkTo2(v.person, v.leavingTo)) s.visitor = null;
    } else if (walkTo2(v.person, v.waitX)) {
      v.person.activity = "idle";
      v.person.dir = v.waitX < campX(s) ? 1 : -1;
    }
  }
  var edgeBehind = (v) => v.waitX < WORLD_WIDTH / 2 ? 0 : WORLD_WIDTH;
  function acceptVisitor(s) {
    const v = s.visitor;
    if (!v || v.leavingTo !== null) return;
    s.people.push(v.person);
    s.visitor = null;
    assignBeds(s);
    equipAll(s);
    notify(s, `${v.person.name} joined the town.`, true);
    if (v.person.type === "hermit") revealOccult(s, `${v.person.name} the hermit brought old, forbidden knowledge.`);
  }
  function rejectVisitor(s) {
    const v = s.visitor;
    if (!v || v.leavingTo !== null) return;
    v.leavingTo = edgeBehind(v);
  }

  // src/shared/sim/social.ts
  var key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
  var opinion = (s, a, b) => s.relations[key(a, b)] ?? 0;
  var relationsRev = /* @__PURE__ */ new WeakMap();
  var relationsChanged = (s) => relationsRev.set(s, (relationsRev.get(s) ?? 0) + 1);
  var tiesMemo = /* @__PURE__ */ new WeakMap();
  function ties(s) {
    const rev = relationsRev.get(s) ?? 0;
    const hour = Math.floor(s.tick / TICKS_PER_HOUR);
    let t = tiesMemo.get(s);
    if (t && t.rev === rev && t.tick === hour) return t;
    t = { rev, tick: hour, friends: /* @__PURE__ */ new Map(), rivals: /* @__PURE__ */ new Map() };
    const put = (m, a, b) => (m.get(a) ?? m.set(a, /* @__PURE__ */ new Set()).get(a)).add(b);
    for (const k in s.relations) {
      const v = s.relations[k];
      if (v < FRIEND && v > RIVAL) continue;
      const dash = k.indexOf("-");
      const a = Number(k.slice(0, dash));
      const b = Number(k.slice(dash + 1));
      const m = v >= FRIEND ? t.friends : t.rivals;
      put(m, a, b);
      put(m, b, a);
    }
    tiesMemo.set(s, t);
    return t;
  }
  function adjust(s, a, b, by) {
    const v = Math.max(-100, Math.min(100, opinion(s, a, b) + by));
    s.relations[key(a, b)] = v;
    relationsChanged(s);
    return v;
  }
  var isChild = (p) => p.bornTick != null;
  var inTown2 = (s) => s.people.filter((p) => p.away === null);
  function friendsOf(s, p) {
    const mine = ties(s).friends.get(p.id);
    return mine ? s.people.filter((o) => o !== p && mine.has(o.id)) : [];
  }
  function rivalsOf(s, p) {
    const mine = ties(s).rivals.get(p.id);
    return mine ? s.people.filter((o) => o !== p && mine.has(o.id)) : [];
  }
  function updateSocial(s, rng) {
    if (s.tick % TICKS_PER_HOUR !== 0) return;
    const here = inTown2(s);
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const a = here[i];
        const b = here[j];
        if (Math.abs(a.x - b.x) > NEAR_PX) continue;
        const social = 1 + (a.skills.social.level + b.skills.social.level) / 20;
        const loner = a.traits.includes("loner") || b.traits.includes("loner") ? 0.5 : 1;
        let v = adjust(s, a.id, b.id, WARM_PER_HOUR * chemistry(s, a.id, b.id) * social * loner);
        if (rng.chance(FRICTION_CHANCE * (1 + friction(a) + friction(b)))) v = adjust(s, a.id, b.id, -FRICTION);
        if (v >= COUPLE && canPair(a) && canPair(b) && rng.chance(COUPLE_CHANCE)) {
          a.partner = b.id;
          b.partner = a.id;
          notify(s, `${a.name} and ${b.name} are a couple.`, true);
        }
      }
    }
    families(s, rng);
    growUp(s);
  }
  function chemistry(s, a, b) {
    const h = mixSeed(hashSeed(s.seed), Math.min(a, b) * 7919 + Math.max(a, b));
    return (h >>> 0) % 1801 / 1e3 - 0.4;
  }
  var friction = (p) => ["lazy", "glutton", "coward", "loner"].filter((t) => p.traits.includes(t)).length * 0.5;
  var canPair = (p) => !isChild(p) && (p.partner ?? null) === null && p.monster !== "undead";
  function families(s, rng) {
    if (!s.research.done.includes("family_life")) return;
    for (const a of inTown2(s)) {
      const b = a.partner == null ? void 0 : s.people.find((q) => q.id === a.partner);
      if (!b || a.id > b.id || b.away !== null) continue;
      if (!a.married && opinion(s, a.id, b.id) >= MARRY && rng.chance(MARRY_CHANCE)) {
        a.married = b.married = true;
        s.celebrationUntil = s.tick + WEDDING_MORALE[1] * TICKS_PER_HOUR;
        notify(s, `${a.name} and ${b.name} were married! The whole town celebrates.`, true);
        continue;
      }
      const kids = s.people.filter((k) => k.parents?.includes(a.id) && k.parents.includes(b.id)).length;
      if (a.married && kids < MAX_CHILDREN && housingCapacity(s) > s.people.length && rng.chance(CHILD_CHANCE)) welcomeChild(s, a, b, rng);
    }
  }
  function welcomeChild(s, a, b, rng) {
    const taken = [...s.people, ...s.captives].map((p) => p.name);
    const free = NAMES.filter((n) => !taken.includes(n));
    const parent = rng.chance(0.5) ? a : b;
    const passion = parent.passions.length ? rng.pick(parent.passions) : rng.pick(SKILLS);
    const skills = Object.fromEntries(SKILLS.map((k) => [k, { level: 1, xp: 0 }]));
    const look = { ...randomLook(rng), skin: rng.chance(0.5) ? a.look.skin : b.look.skin, hairColor: rng.chance(0.5) ? a.look.hairColor : b.look.hairColor };
    const child = {
      id: s.nextId++,
      name: rng.pick(free.length ? free : NAMES),
      type: "child",
      look: { ...look, beard: false },
      x: a.x,
      dir: 1,
      skills,
      passions: [passion],
      traits: [],
      needs: { food: 1, rest: 1 },
      morale: 70,
      lastSlept: null,
      bed: null,
      priorities: { haul: 0, construct: 0, farm: 0, craft: 0, research: 0, gather: 0, defend: 0 },
      autoPriorities: false,
      task: null,
      activity: "idle",
      carrying: {},
      gear: {},
      blocked: false,
      away: null,
      hp: maxHp({ traits: [] }),
      downed: null,
      partner: null,
      bornTick: s.tick,
      parents: [a.id, b.id]
    };
    s.people.push(child);
    adjust(s, child.id, a.id, 60);
    adjust(s, child.id, b.id, 60);
    notify(s, `${a.name} and ${b.name} welcomed a child, ${child.name}.`, true);
  }
  function growUp(s) {
    for (const p of s.people) {
      if (!isChild(p) || s.tick - p.bornTick < CHILD_HOURS * TICKS_PER_HOUR) continue;
      p.bornTick = null;
      p.type = "wanderer";
      const school = s.buildings.some((b) => b.def === "school" && b.status === "done") ? SCHOOL_BONUS : 0;
      for (const k of SKILLS) p.skills[k].level = (p.passions.includes(k) ? 5 : 2) + school;
      p.autoPriorities = true;
      p.priorities = { haul: 2, construct: 2, farm: 2, craft: 2, research: 2, gather: 2, defend: 3 };
      notify(s, `${p.name} has grown up and joins the work.`, true);
    }
  }
  var hasGraveyard = (s) => s.buildings.some((b) => b.def === "graveyard" && b.status === "done");
  function grieve(s, dead) {
    const eased = hasGraveyard(s) ? GRAVEYARD_GRIEF : 1;
    for (const p of s.people) {
      if (p === dead) continue;
      if (p.partner === dead.id) {
        p.grief = { until: s.tick + GRIEF_PARTNER[1] * eased * TICKS_PER_HOUR, value: GRIEF_PARTNER[0], text: `Lost ${dead.name}` };
        p.partner = null;
        p.married = false;
      } else if (opinion(s, p.id, dead.id) >= FRIEND || p.parents?.includes(dead.id) || dead.parents?.includes(p.id)) {
        p.grief = { until: s.tick + GRIEF_FRIEND[1] * eased * TICKS_PER_HOUR, value: GRIEF_FRIEND[0], text: `Misses ${dead.name}` };
      }
    }
    for (const k of Object.keys(s.relations)) if (k.split("-").includes(String(dead.id))) delete s.relations[k];
    relationsChanged(s);
  }

  // src/shared/sim/operators.ts
  var roleOf = (b) => b.status === "done" ? OPERATORS[b.def] : void 0;
  function candidates(s, b) {
    const busy = new Set(s.buildings.filter((q) => q !== b && q.operator != null).map((q) => q.operator));
    return s.people.filter((p) => !isChild(p) && !busy.has(p.id));
  }
  var skillOf = (p, b) => {
    const role = OPERATORS[b.def];
    return role.skill === "melee" ? Math.max(p.skills.melee.level, p.skills.ranged.level) : p.skills[role.skill].level;
  };
  function operatorOf(s, def) {
    const b = s.buildings.find((q) => q.def === def && q.status === "done" && q.operator != null);
    const p = b ? s.people.find((q) => q.id === b.operator) : void 0;
    return p && p.away === null && !p.downed ? p : void 0;
  }
  function operatorSkill(s, def) {
    const p = operatorOf(s, def);
    const b = s.buildings.find((q) => q.def === def && q.status === "done");
    return p && b ? skillOf(p, b) : 0;
  }
  function assignOperators(s) {
    if (s.tick % TICKS_PER_HOUR !== 0) return;
    for (const b of s.buildings) {
      const role = roleOf(b);
      if (!role) continue;
      if (b.operator != null && !s.people.some((p) => p.id === b.operator)) {
        b.operator = null;
        b.operatorChosen = false;
      }
      if (b.operator != null) continue;
      const best = candidates(s, b).sort((x, y) => skillOf(y, b) - skillOf(x, b))[0];
      if (!best) continue;
      b.operator = best.id;
      notify(s, `${best.name} is now the ${role.title.toLowerCase()}.`);
    }
  }
  function cycleOperator(s, buildingId) {
    const b = s.buildings.find((q) => q.id === buildingId);
    if (!b || !roleOf(b)) return;
    const list2 = candidates(s, b).sort((x, y) => skillOf(y, b) - skillOf(x, b));
    if (!list2.length) return;
    const i = list2.findIndex((p) => p.id === b.operator);
    b.operator = list2[(i + 1) % list2.length].id;
    b.operatorChosen = true;
  }

  // src/shared/sim/health.ts
  var BLEED_TICKS = 2 * TICKS_PER_HOUR;
  var MOURNING_TICKS = 24 * TICKS_PER_HOUR;
  var MAX_GRAVES = 12;
  var REGEN_AWAKE = 4;
  var REGEN_GROUND = 8;
  var REGEN_BED = 12;
  var BACK_ON_FEET = 0.3;
  var VISION_AFTER_TOPICS = 10;
  var STARVING = 0.02;
  var STARVE_HP_PER_HOUR = 1.2;
  var INJURED = 0.5;
  function knockDown(s, p) {
    if (p.away === null && (s.items.medkit ?? 0) > 0) {
      s.items.medkit -= 1;
      p.hp = Math.round(maxHp(p) * MEDKIT_HP);
      p.downed = null;
      personFx(s, p.id, "heal");
      notify(s, `${p.name} was struck down, but a medkit got them straight back up.`);
      return;
    }
    p.hp = 0;
    const slower = p.away === null ? bestHealing(s) : 1;
    p.downed = { bleedUntil: p.id === s.mainId && p.away === null ? null : s.tick + BLEED_TICKS * slower };
  }
  var bestHealing = (s) => s.buildings.reduce((m, b) => b.status === "done" ? Math.max(m, BUILDING_BY_ID[b.def]?.healing ?? 1) : m, 1);
  var MEDKIT_HP = 0.4;
  function stabilize(p) {
    if (p.downed) p.downed.bleedUntil = null;
  }
  var isInjured = (p) => p.hp < maxHp(p) * INJURED;
  function killPerson(s, p, cause) {
    for (const e of s.expeditions) {
      e.members = e.members.filter((id) => id !== p.id);
      delete e.roles[p.id];
    }
    if (p.id === s.mainId && tryRevive(s, p)) return;
    if (p.away === null && (s.items.phoenix_feather ?? 0) > 0) {
      s.items.phoenix_feather -= 1;
      p.hp = maxHp(p);
      p.downed = null;
      p.sick = null;
      s.revivedAt = { tick: s.tick, id: p.id };
      notify(s, `${p.name} fell, and the Phoenix Feather burst into flame: ${p.name} rises from the ashes!`, true);
      return;
    }
    s.people = s.people.filter((q) => q !== p);
    if (p.away === null) for (const id of Object.values(p.gear)) s.items[id] = (s.items[id] ?? 0) + 1;
    if (p.id === s.mainId) {
      s.gameOver = { tick: s.tick, text: `${p.name} has died ${cause}. Without them, the camp breaks apart.` };
      notify(s, s.gameOver.text, true);
      return;
    }
    s.mourningUntil = s.tick + MOURNING_TICKS;
    if (p.away === null) {
      s.graves = [...s.graves ?? [], { x: Math.round(p.x), name: p.name }].slice(-MAX_GRAVES);
      layOutGraves(s);
    }
    grieve(s, p);
    notify(s, `${p.name} has died ${cause}.`, true);
    const r = s.raid;
    if (r && r.kind === "zombies" && r.phase === "active" && p.away === null) {
      r.raiders.push({ id: s.nextId++, kind: "zombie", x: p.x, dir: p.dir, hp: 45, maxHp: 45, cooldown: 20, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: "harm", risenFrom: p.name, ally: s.doom?.kind === "outbreak" && s.doom.commanded === true, conjuredAt: s.tick });
      notify(s, s.doom?.commanded ? `${p.name} rises again, and stands with the lich.` : `${p.name} rises again, one of the dead now.`, true);
    }
  }
  function layOutGraves(s) {
    const yard = s.buildings.find((b) => b.def === "graveyard" && b.status === "done");
    if (!yard || !s.graves) return;
    const cx = buildingCentreX(yard);
    s.graves.forEach((g, i) => g.x = Math.round(cx + (i % 5 - 2) * 18 + Math.floor(i / 5) * 7));
  }
  function checkBleeding(s, p) {
    if (p.downed?.bleedUntil != null && s.tick >= p.downed.bleedUntil) killPerson(s, p, "of their wounds");
  }
  function heal(s, p) {
    const max = maxHp(p);
    if (p.needs.food <= STARVING && p.monster !== "undead" && !p.downed) {
      if (!p.starving) {
        p.starving = true;
        notify(s, `${p.name} is starving! There's no food to be had: plant fields, hunt, or trade for some.`, true);
      }
      p.hp -= STARVE_HP_PER_HOUR / TICKS_PER_HOUR;
      if (p.hp <= 0) killPerson(s, p, "of hunger");
      return;
    }
    if (p.starving && p.needs.food > STARVING) p.starving = false;
    if (p.hp >= max) return;
    const asleep = p.task?.type === "sleep" && p.activity === "sleep";
    const rate = asleep ? p.task?.type === "sleep" && p.task.building !== null ? REGEN_BED : REGEN_GROUND : REGEN_AWAKE;
    let infirmary = bestHealing(s);
    if (infirmary > 1) infirmary += operatorSkill(s, "infirmary") * HEALER_PER_LEVEL;
    p.hp = Math.min(max, p.hp + rate * infirmary * (p.monster === "undead" ? UNDEAD_HEAL : 1) / TICKS_PER_HOUR);
    if (p.downed && p.downed.bleedUntil === null && p.hp >= max * BACK_ON_FEET) {
      p.downed = null;
      notify(s, `${p.name} is back on their feet.`);
      if (p.id === s.mainId && s.research.done.length >= VISION_AFTER_TOPICS) revealOccult(s, `Near death, ${p.name} had a strange vision.`);
    }
  }

  // src/shared/data/trade.ts
  var WORTH = {
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
    power_cells: 8
  };
  var CARAVAN_GOODS = {
    medieval: ["iron", "cloth", "leather", "bread", "lumber", "bricks", "iron_ore", "herbs", "arrows", "grain"],
    industrial: ["steel", "glass", "coal", "iron", "bricks", "lumber", "cloth", "bread", "shot", "leather"],
    modern: ["fuel", "plastic", "electronics", "concrete", "steel", "glass", "oil", "cartridges", "bread", "cloth"],
    space: ["rare_minerals", "alloys", "circuits", "power_cells", "electronics", "plastic", "fuel", "concrete", "bread", "steel"]
  };
  var caravanGoods = (era) => CARAVAN_GOODS[era] ?? CARAVAN_GOODS.modern;
  var OFFER_SCALE = { industrial: 2, modern: 3, space: 4 };
  var SELL_MARKUP = 1.3;
  var BUY_RATE = 0.75;
  var OFFER_WORTH = [18, 36];
  var CARAVAN_EVERY = [36, 60];
  var CARAVAN_STAY_HOURS = 12;
  var HORSE_WORTH = 45;
  var HORSE_HP = 60;
  var HORSE_CARRY = 20;
  var HORSE_SPEEDUP = 0.75;
  var HORSE_DIE_ON_LOSS = 0.5;
  var HORSE_HURT_ON_RETREAT = 0.3;
  var HORSE_HURT = 20;
  var HORSE_HEAL = 5;
  var HORSE_THEFT = 0.35;
  var HORSE_NAMES = ["Ash", "Bramble", "Clover", "Dusk", "Ember", "Fern", "Gale", "Hazel", "Iris", "Juniper", "Kestrel", "Loam", "Moss", "Nettle", "Oak", "Pebble", "Quill", "Rowan", "Sorrel", "Thistle"];

  // src/shared/sim/prisoners.ts
  var CAPTURE_CHANCE = 0.4;
  var CONVERT_BASE = 0.12;
  var CONVERT_PER_SOCIAL = 0.02;
  var ESCAPE_PER_DAY = 0.06;
  var isHuman = (kind) => !!ENEMIES[kind] && "people" in ENEMIES[kind].sprite && ENEMIES[kind].sprite.people !== "zombie";
  function takePrisoners(s, raiders, rng) {
    let n = 0;
    for (const rd of raiders) {
      if (!rd.down || !isHuman(rd.kind) || !rng.chance(CAPTURE_CHANCE)) continue;
      const taken = [...s.people, ...s.prisoners].map((p) => p.name);
      const free = NAMES.filter((x) => !taken.includes(x));
      s.prisoners.push({ id: s.nextId++, enemy: rd.kind, name: rng.pick(free.length ? free : NAMES), conviction: 0, since: s.tick, hungry: false });
      n++;
    }
    if (n) notify(s, `${n === 1 ? "One raider was" : `${n} raiders were`} taken prisoner. See Townsfolk.`, true);
    return n;
  }
  function updatePrisoners(s, rng) {
    if (s.tick % TICKS_PER_HOUR !== 0 || !s.prisoners.length) return;
    const social = Math.max(1, ...s.people.filter((p) => p.away === null && p.bornTick == null).map((p) => p.skills.social.level));
    for (const pr of [...s.prisoners]) {
      if ((s.tick - pr.since) % TICKS_PER_DAY === 0) pr.hungry = !feed(s);
      if (rng.chance(ESCAPE_PER_DAY * (pr.hungry ? 3 : 1) / 24)) {
        s.prisoners = s.prisoners.filter((q) => q !== pr);
        notify(s, `${pr.name} the prisoner escaped in the night.`, true);
        continue;
      }
      pr.conviction += (CONVERT_BASE + social * CONVERT_PER_SOCIAL) * (pr.hungry ? 0.3 : 1) / 24;
      if (pr.conviction >= 1) convert(s, pr, rng);
    }
  }
  function feed(s) {
    for (const st of storages(s)) {
      for (const m of Object.keys(FOOD_VALUE)) {
        if ((st.store[m] ?? 0) > 0) {
          addStock(st.store, m, -1);
          return true;
        }
      }
    }
    return false;
  }
  function convert(s, pr, rng) {
    s.prisoners = s.prisoners.filter((q) => q !== pr);
    const p = makePerson(rng, s.nextId++, "hunter", campX(s), s.people.map((q) => q.name));
    p.name = pr.name;
    s.people.push(p);
    assignBeds(s);
    notify(s, `${pr.name}, once a raider, has come round and joined the town.`, true);
  }
  function releasePrisoner(s, id) {
    const pr = s.prisoners.find((q) => q.id === id);
    if (!pr) return;
    s.prisoners = s.prisoners.filter((q) => q !== pr);
    s.reputation += 1;
    notify(s, `${pr.name} was set free.`);
  }

  // src/shared/sim/classes.ts
  function canTrain(s, p, cls) {
    const def = CLASS_DEFS[cls];
    if (!def) return { ok: false, reason: "Unknown class" };
    if (p.cls) return { ok: false, reason: `${p.name} is already a ${CLASS_DEFS[p.cls].name}` };
    if (p.bornTick != null) return { ok: false, reason: "Too young" };
    if (p.away !== null) return { ok: false, reason: "Away" };
    if (!s.research.done.includes(def.research)) return { ok: false, reason: `Needs research: ${TOPIC_BY_ID[def.research]?.name ?? def.research}` };
    if (p.skills[def.skill].level < def.level) return { ok: false, reason: `Needs ${def.skill} ${def.level}` };
    const stock = totalStock(s);
    const short = Object.entries(def.cost).filter(([m, n]) => (stock[m] ?? 0) < n);
    if (short.length) return { ok: false, reason: `Needs ${short.map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`).join(", ")}` };
    return { ok: true };
  }
  function train(s, personId, cls) {
    const p = s.people.find((q) => q.id === personId);
    if (!p) return { ok: false, reason: "Unknown person" };
    const check = canTrain(s, p, cls);
    if (!check.ok) return check;
    for (const [m, n] of Object.entries(CLASS_DEFS[cls].cost)) {
      let left = n;
      for (const st of storages(s)) {
        const k = Math.min(left, st.store[m] ?? 0);
        if (k > 0) {
          addStock(st.store, m, -k);
          left -= k;
        }
      }
    }
    p.cls = cls;
    notify(s, `${p.name} has become a ${CLASS_DEFS[cls].name}.`, true);
    return { ok: true };
  }
  function classAllies(members) {
    const out = [];
    for (const p of members) {
      if (p.hp <= 0 || p.downed) continue;
      if (p.cls === "summoner") out.push(unitFighter("spirit", "party", -p.id * 10 - 1));
      if (p.cls === "beast_tamer") out.push(unitFighter("companion_wolf", "party", -p.id * 10 - 2));
    }
    return out;
  }
  var inTown3 = (s, cls) => s.people.filter((p) => p.cls === cls && p.away === null && !p.downed);
  function ally(s, kind, x, dir) {
    const d = ENEMIES[kind];
    return { id: s.nextId++, kind, x, dir, hp: d.hp, maxHp: d.hp, cooldown: 5, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: "harm", ally: true, conjuredAt: s.tick };
  }
  function summonForRaid(s, r) {
    for (const p of inTown3(s, "summoner")) r.raiders.push(ally(s, "spirit", p.x, p.dir));
    if (inTown3(s, "summoner").length) notify(s, "Spirits answer the summoner's call!");
    const yard = s.buildings.find((b) => b.def === "graveyard" && b.status === "done");
    const graves = s.graves ?? [];
    if (!yard || !graves.length) return;
    const necros = inTown3(s, "necromancer").slice(0, graves.length);
    necros.forEach((p, i) => {
      const g = graves[graves.length - 1 - i];
      const ghost = ally(s, "grave_ghost", g.x, p.dir);
      ghost.risenFrom = g.name;
      r.raiders.push(ghost);
    });
    if (necros.length) notify(s, `The necromancer calls on the graveyard: ${necros.map((_, i) => graves[graves.length - 1 - i].name).join(" and ")} ${necros.length === 1 ? "rises" : "rise"} to defend the town once more.`, true);
  }
  function classesInRaid(s, r) {
    const necros = inTown3(s, "necromancer");
    if (necros.length) {
      for (const rd of r.raiders) {
        if (!rd.down || rd.ally || rd.raiseChecked) continue;
        rd.raiseChecked = true;
        if ((r.raised ?? 0) >= necros.length * 2) continue;
        if (!necros.some((p) => Math.abs(p.x - rd.x) <= NECRO_RANGE)) continue;
        if (rd.risenFrom) continue;
        rd.down = false;
        rd.ally = true;
        rd.hp = Math.round(rd.maxHp / 2);
        rd.fleeing = false;
        rd.carrying = {};
        rd.conjuredAt = s.tick;
        r.raised = (r.raised ?? 0) + 1;
        notify(s, `The necromancer raises the fallen ${ENEMIES[rd.kind].name.toLowerCase()} to fight for the town!`);
      }
    }
    const tamers = inTown3(s, "beast_tamer");
    if (tamers.length && s.tick >= (r.nextTame ?? 0)) {
      for (const p of tamers) {
        const beast = r.raiders.find((rd) => !rd.down && !rd.gone && !rd.ally && isBeast(rd.kind) && !ENEMIES[rd.kind].boss && Math.abs(rd.x - p.x) <= TAME_RANGE);
        if (!beast) continue;
        beast.ally = true;
        beast.fleeing = false;
        beast.conjuredAt = s.tick;
        r.nextTame = s.tick + TAME_EVERY * TICK_HZ;
        notify(s, `${p.name} tames the ${ENEMIES[beast.kind].name.toLowerCase()}: it turns on the others!`);
      }
    }
  }

  // src/shared/sim/roadEvents.ts
  var ROAD_EVENT_CHANCE = 0.2;
  var PROMPT_TICKS = TICKS_PER_HOUR;
  var SPRAIN_DAMAGE = 10;
  var EVENT_ODDS = { cache: 3, sprain: 2, strangers: 2 };
  var STRANGER_OPTIONS = ["Help (share food)", "Ignore them", "Rob them"];
  function rollRoadEvent(s, e, members, rng) {
    if (!rng.chance(ROAD_EVENT_CHANCE) || !members.length) return;
    const d = DESTINATION_BY_ID[e.dest];
    switch (rng.weighted(EVENT_ODDS)) {
      case "cache": {
        const m = rng.pick(["stone", "flint", "fiber"]);
        const n = Math.min(rng.int(2, 4), partyCarry(s, e) - poolSize(e.loot));
        if (n <= 0) return;
        addStock(e.loot, m, n);
        notify(s, `The ${d.name} party found a hidden cache: ${n} ${m}.`);
        return;
      }
      case "sprain": {
        const p = rng.pick(members);
        if (e.stance === "cautious") {
          if (e.phase === "out") e.outTicks += Math.round(e.outTicks * 0.1);
          else e.backTicks += Math.round(e.backTicks * 0.1);
          notify(s, `${p.name} twisted an ankle. The party rested before going on.`);
        } else {
          p.hp = Math.max(1, p.hp - SPRAIN_DAMAGE);
          notify(s, `${p.name} twisted an ankle on the road and pushed on.`);
        }
        return;
      }
      case "strangers": {
        const defaultOption = e.stance === "cautious" ? 1 : e.stance === "balanced" ? 0 : 2;
        const prompt = {
          id: s.nextId++,
          kind: "strangers",
          expedition: e.id,
          title: "Strangers on the road",
          text: `The ${d.name} party meets a ragged family on the road. They look hungry.`,
          options: STRANGER_OPTIONS,
          defaultOption,
          expiresTick: s.tick + PROMPT_TICKS
        };
        s.prompts.push(prompt);
        e.prompt = prompt.id;
        notify(s, `${prompt.title}: the ${d.name} party needs a decision.`);
        return;
      }
    }
  }
  function answerPrompt(s, id, option, rng) {
    const prompt = s.prompts.find((q) => q.id === id);
    if (!prompt || option < 0 || option >= prompt.options.length) return;
    s.prompts = s.prompts.filter((q) => q !== prompt);
    if (prompt.kind === "raid") return answerRaidPrompt(s, prompt.options[option], rng);
    if (prompt.kind === "rite") return answerRite(s, prompt.options[option]);
    if (prompt.kind === "lich") return answerLich(s, prompt.options[option]);
    const e = s.expeditions.find((q) => q.id === prompt.expedition);
    if (!e) return;
    e.prompt = null;
    const members = e.members.map((m) => s.people.find((p) => p.id === m)).filter((p) => !!p);
    switch (option) {
      case 0: {
        let given = 0;
        for (const m of Object.keys(FOOD_VALUE)) {
          while (given < 2 && (e.supplies[m] ?? 0) > 0) {
            addStock(e.supplies, m, -1);
            given++;
          }
        }
        s.reputation += 1;
        notify(s, given ? "The strangers thank you. Word of your kindness will spread." : "You had no food to spare, but the strangers remember the kindness.");
        return;
      }
      case 1:
        notify(s, "The party passes the strangers by.");
        return;
      case 2:
        if (rng.chance(0.5)) {
          const m = rng.pick(["hide", "flint", "fiber"]);
          addStock(e.loot, m, rng.int(2, 4));
          s.reputation = Math.max(0, s.reputation - 1);
          notify(s, `The party robs the strangers and takes their ${m}.`);
        } else {
          notify(s, "The strangers fight back!");
          e.battle = startBattle(members, e.roles, { rival_spear: 2 }, rng, e.supplies);
        }
        return;
    }
  }
  function expirePrompts(s, rng) {
    for (const p of [...s.prompts]) if (s.tick >= p.expiresTick) answerPrompt(s, p.id, p.defaultOption, rng);
  }

  // src/shared/sim/expeditions.ts
  var LOOT_XP = 10;
  var FIGHT_XP = 6;
  var CRAWL_HOME = 0.6;
  var AMBUSH_AT = 0.3;
  var EVENT_AT = 0.5;
  var HUNTERS_LODGE_BONUS = 1.4;
  var STRANGE_TOME_CHANCE = 0.35;
  var AMMO_PER_SHOOTER = 10;
  function destinationUnlocked(s, d) {
    if (s.cheats.unlockAll) return true;
    return eraReached(s.era, d.era) && (!d.research || s.research.done.includes(d.research));
  }
  function workSkill(d, p) {
    if (d.type === "gather") return "gathering";
    return p.skills.ranged.level >= p.skills.melee.level ? "ranged" : "melee";
  }
  var phaseTicks = (s, seconds) => Math.round(seconds * TICK_HZ * ERA_MULTIPLIER[s.era]);
  function foodNeeded(s, d, size) {
    const hours = (phaseTicks(s, d.outSeconds) * 2 + phaseTicks(s, d.workSeconds)) / TICKS_PER_HOUR;
    return size * hours * FOOD_PER_HOUR;
  }
  function canSend(s, destId, memberIds) {
    const d = DESTINATION_BY_ID[destId];
    if (!d) return { ok: false, reason: "Unknown destination" };
    if (!destinationUnlocked(s, d)) return { ok: false, reason: "Not discovered yet" };
    if (s.expeditions.length >= MAX_EXPEDITIONS) return { ok: false, reason: `At most ${MAX_EXPEDITIONS} expeditions at once` };
    if (memberIds.length < 1) return { ok: false, reason: "Pick someone to go" };
    if (memberIds.length > MAX_PARTY) return { ok: false, reason: `Parties are at most ${MAX_PARTY} people` };
    if (new Set(memberIds).size !== memberIds.length) return { ok: false, reason: "Someone is listed twice" };
    for (const id of memberIds) {
      const p = s.people.find((q) => q.id === id);
      if (!p) return { ok: false, reason: "Unknown person" };
      if (p.away !== null) return { ok: false, reason: `${p.name} is already away` };
      if (p.downed) return { ok: false, reason: `${p.name} is too badly hurt` };
      if (p.bornTick != null) return { ok: false, reason: `${p.name} is too young` };
    }
    return { ok: true };
  }
  function truckReady(s) {
    if ((s.items.truck ?? 0) < 1) return { ok: false, reason: "No truck at home" };
    const fuel = storages(s).reduce((n, st) => n + (st.store.fuel ?? 0), 0);
    if (fuel < TRUCK_FUEL) return { ok: false, reason: `Needs ${TRUCK_FUEL} fuel (${fuel} stored)` };
    return { ok: true };
  }
  function sendExpedition(s, destId, memberIds, roles = {}, stance = "balanced", horseCount = 0, truck = false) {
    const check = canSend(s, destId, memberIds);
    if (!check.ok) return check;
    if (truck) {
      const t = truckReady(s);
      if (!t.ok) return t;
    }
    const d = DESTINATION_BY_ID[destId];
    const members = memberIds.map((id) => s.people.find((p) => p.id === id));
    for (const p of members) {
      if (poolSize(p.carrying)) depositNear(s, p.x, p.carrying);
      p.carrying = {};
    }
    const supplies = packFood(s, foodNeeded(s, d, members.length));
    for (const p of members) {
      const kind = ammoOf(p);
      const n = kind ? takeFromStorage(s, kind, AMMO_PER_SHOOTER) : 0;
      if (n) addStock(supplies, kind, n);
    }
    const waterskins = (s.items.waterskin ?? 0) >= members.length ? members.length : 0;
    if (waterskins) s.items.waterskin -= waterskins;
    const horses = s.horses.filter((h) => h.hp >= HORSE_HP / 2).slice(0, Math.max(0, horseCount));
    s.horses = s.horses.filter((h) => !horses.includes(h));
    const mounted = horses.length >= members.length;
    if (truck) {
      s.items.truck -= 1;
      takeFromStorage(s, "fuel", TRUCK_FUEL);
    }
    const speed = truck ? TRUCK_SPEEDUP : (waterskins ? WATERSKIN_SPEEDUP : 1) * (mounted ? HORSE_SPEEDUP : 1);
    const out = Math.round(phaseTicks(s, d.outSeconds) * speed);
    const e = {
      id: s.nextId++,
      dest: destId,
      members: [...memberIds],
      phase: "out",
      elapsed: 0,
      outTicks: out,
      workTicks: phaseTicks(s, d.workSeconds),
      backTicks: out,
      work: 0,
      loot: {},
      supplies,
      recalled: false,
      roles: Object.fromEntries(memberIds.map((id) => [id, roles[id] ?? "fighter"])),
      stance,
      battle: null,
      prompt: null,
      rolled: { outEvent: false, backEvent: false, ambush: false },
      waterskins,
      horses,
      ...truck ? { truck: true } : {}
    };
    s.expeditions.push(e);
    for (const p of members) {
      p.away = e.id;
      p.task = null;
      p.activity = "walk";
      p.blocked = false;
    }
    notify(s, `${names(members)} set out for the ${d.name}.`);
    return { ok: true };
  }
  function takeFromStorage(s, m, n) {
    let taken = 0;
    for (const st of storages(s)) {
      const k = Math.min(n - taken, st.store[m] ?? 0);
      if (k > 0) {
        addStock(st.store, m, -k);
        taken += k;
      }
    }
    return taken;
  }
  function packFood(s, need) {
    const packed = {};
    let value = 0;
    for (const m of Object.keys(FOOD_VALUE).reverse()) {
      for (const st of storages(s)) {
        while (value < need && (st.store[m] ?? 0) > 0) {
          addStock(st.store, m, -1);
          addStock(packed, m, 1);
          value += FOOD_VALUE[m];
        }
      }
    }
    return packed;
  }
  function recallExpedition(s, id) {
    const e = s.expeditions.find((q) => q.id === id);
    if (!e || e.phase === "back" || e.battle) return;
    startBack(s, e, e.phase === "out" ? e.elapsed : e.outTicks);
    e.recalled = true;
  }
  function startBack(s, e, walkedTicks) {
    const load = poolSize(e.loot) / Math.max(1, partyCarry(s, e));
    e.phase = "back";
    e.elapsed = 0;
    e.backTicks = Math.round(walkedTicks * (1 + LOADED_SLOWDOWN * Math.min(1, load)) * (anyDowned(s, e) ? 1 + CARRYING_WOUNDED_SLOWDOWN : 1));
  }
  function partyCarry(s, e) {
    const people = e.members.reduce((n, id) => n + carryCapacity(s, s.people.find((p) => p.id === id)) * (e.roles[id] === "porter" ? PORTER_CARRY : 1), 0);
    return people + (e.horses?.length ?? 0) * HORSE_CARRY + (e.truck ? TRUCK_CARRY : 0);
  }
  var membersOf = (s, e) => e.members.map((id) => s.people.find((p) => p.id === id)).filter((p) => !!p);
  var anyDowned = (s, e) => membersOf(s, e).some((p) => p.downed);
  var medicUp = (e, members) => members.some((p) => e.roles[p.id] === "medic" && !p.downed);
  function updateExpeditions(s, rng) {
    for (const e of [...s.expeditions]) {
      if (s.gameOver) return;
      const d = DESTINATION_BY_ID[e.dest];
      let members = membersOf(s, e);
      for (const p of members) {
        const rest = p.needs.rest;
        drainNeeds(p, false);
        p.needs.rest = rest;
        if (p.needs.food < HUNGRY) eatSupplies(e, p);
        if (p.downed && medicUp(e, members)) stabilize(p);
        checkBleeding(s, p);
      }
      if (s.gameOver) return;
      members = membersOf(s, e);
      if (!members.length) {
        s.expeditions = s.expeditions.filter((q) => q !== e);
        notify(s, `No one came back from the ${d.name}.`, true);
        continue;
      }
      if (e.prompt !== null) continue;
      if (e.battle) {
        stepBattle(e.battle, rng, { retreatAt: STANCES[e.stance].retreatAt, mainId: members.some((p) => p.id === s.mainId) ? s.mainId : null });
        if (e.battle.shouts?.length) {
          for (const t of e.battle.shouts) notify(s, `At the ${d.name}: ${t}`, true);
          e.battle.shouts = [];
        }
        if (e.battle.outcome) finishBattle(s, e, d, members, rng);
        continue;
      }
      e.elapsed++;
      switch (e.phase) {
        case "out":
          if (!e.rolled.outEvent && e.elapsed >= e.outTicks * EVENT_AT) {
            e.rolled.outEvent = true;
            rollRoadEvent(s, e, members, rng);
          }
          if (e.elapsed >= e.outTicks) {
            e.phase = "work";
            e.elapsed = 0;
            maybeFight(s, e, d, members, d.encounters.arrival, rng);
          }
          break;
        case "work": {
          const cap = partyCarry(s, e);
          const lodge = d.type === "hunt" && s.buildings.some((b) => b.def === "hunters_lodge" && b.status === "done") ? HUNTERS_LODGE_BONUS : 1;
          for (const p of members) {
            if (p.downed || e.roles[p.id] === "porter") continue;
            e.work += skillSpeed(p.skills[workSkill(d, p)].level) * workFactor(s, p) * lodge / (d.secondsPerUnit * ERA_MULTIPLIER[s.era] * TICK_HZ);
          }
          while (e.work >= 1 && poolSize(e.loot) < cap) {
            e.work -= 1;
            addStock(e.loot, rng.weighted(d.loot), 1);
            const workers = members.filter((p) => !p.downed);
            const worker = workers[rng.int(0, workers.length - 1)] ?? members[0];
            gainSkill(worker, workSkill(d, worker), LOOT_XP);
          }
          if (e.elapsed >= e.workTicks || poolSize(e.loot) >= cap) {
            for (const [m, n] of Object.entries(d.guaranteed ?? {})) addStock(e.loot, m, n);
            startBack(s, e, e.outTicks);
          }
          break;
        }
        case "back":
          if (!e.rolled.ambush && e.elapsed >= e.backTicks * AMBUSH_AT) {
            e.rolled.ambush = true;
            maybeFight(s, e, d, members, d.encounters.ambush, rng);
            if (e.battle) break;
          }
          if (!e.rolled.backEvent && e.elapsed >= e.backTicks * EVENT_AT) {
            e.rolled.backEvent = true;
            rollRoadEvent(s, e, members, rng);
          }
          if (e.elapsed >= e.backTicks) comeHome(s, e, d, members, rng);
          break;
      }
    }
  }
  function maybeFight(s, e, d, members, chance, rng) {
    if (!rng.chance(chance)) return;
    const group = d.encounters.groups[pickIndex(d.encounters.groups.map((g) => g.weight), rng)].enemies;
    const boss = Object.keys(group).some((id) => ENEMIES[id].boss);
    const scout = members.find((p) => e.roles[p.id] === "scout" && !p.downed);
    if (scout && !boss && rng.chance(SCOUT_AVOID)) {
      notify(s, `${scout.name} spotted ${describeGroup(group)} ahead, and the party slipped past.`);
      return;
    }
    e.battle = startBattle(members, e.roles, group, rng, e.supplies);
    for (const f of classAllies(members)) e.battle.fighters.push({ ...f, cooldown: f.interval });
    for (const kind of new Set(Object.keys(group))) if (ENEMIES[kind]?.kit) notify(s, `At the ${d.name}: ${ENEMIES[kind].kit.roar}`, true);
    notify(s, `The ${d.name} party is attacked by ${describeGroup(group)}!`);
  }
  function finishBattle(s, e, d, members, rng) {
    const b = e.battle;
    e.battle = null;
    for (const f of b.fighters) {
      if (f.side !== "party" || f.kind !== "person") continue;
      if (f.ammoUsed && f.ammoType) addStock(e.supplies, f.ammoType, -f.ammoUsed);
      const p = members.find((q) => q.id === f.ref);
      if (!p) continue;
      if (f.down && !p.downed) knockDown(s, p);
      else if (!f.down) p.hp = f.hp;
      if (f.attacks) gainSkill(p, f.ranged ? "ranged" : "melee", f.attacks * FIGHT_XP);
      if (e.roles[p.id] === "medic" && f.lastAction >= 0) gainSkill(p, "medicine", FIGHT_XP * 3);
    }
    if (medicUp(e, members)) {
      for (const p of members) if (p.downed) stabilize(p);
    }
    switch (b.outcome) {
      case "won": {
        for (const f of b.fighters) if (f.side === "enemy" && f.down && ENEMIES[f.kind]?.kit) bossSlain(s, f.kind);
        const drops = battleLoot(b);
        const room = partyCarry(s, e) - poolSize(e.loot);
        let taken = 0;
        for (const [m, n] of Object.entries(drops)) {
          const k = Math.min(n, room - taken);
          if (k > 0) addStock(e.loot, m, k);
          taken += Math.max(0, k);
        }
        notify(s, `The ${d.name} party won the fight${taken ? ` and took ${listStock(drops)}` : ""}.`);
        if (d.type === "clear" && e.phase === "work") e.cleared = true;
        break;
      }
      case "retreated":
        for (const h of e.horses ?? []) if (rng.chance(HORSE_HURT_ON_RETREAT)) h.hp = Math.max(1, h.hp - HORSE_HURT);
        notify(s, `The ${d.name} party fell back from the fight and is heading home.`);
        if (e.phase !== "back") startBack(s, e, e.phase === "out" ? e.elapsed : e.outTicks);
        break;
      case "lost": {
        for (const p of members) {
          if (!p.downed) continue;
          if (rng.chance(CRAWL_HOME)) {
            p.downed = { bleedUntil: null };
            p.hp = 1;
          } else {
            killPerson(s, p, `at the ${d.name}`);
            if (s.gameOver) return;
          }
        }
        const lostHorses = (e.horses ?? []).filter(() => rng.chance(HORSE_DIE_ON_LOSS));
        if (lostHorses.length) {
          e.horses = (e.horses ?? []).filter((h) => !lostHorses.includes(h));
          notify(s, `${names(lostHorses)} ${lostHorses.length === 1 ? "was" : "were"} killed in the fight.`, true);
        }
        if (e.truck && rng.chance(TRUCK_LOST_ON_LOSS)) {
          e.truck = false;
          notify(s, `The truck was wrecked at the ${d.name}.`, true);
        }
        if (!membersOf(s, e).length) return;
        notify(s, `The ${d.name} party was overrun. The survivors are crawling home.`, true);
        if (e.phase !== "back") startBack(s, e, e.phase === "out" ? e.elapsed : e.outTicks);
        break;
      }
    }
    if (e.phase === "back" && anyDowned(s, e)) {
      const left = e.backTicks - e.elapsed;
      e.backTicks = e.elapsed + Math.round(left * (1 + CARRYING_WOUNDED_SLOWDOWN));
    }
  }
  function eatSupplies(e, p) {
    const food = Object.keys(FOOD_VALUE).find((m) => (e.supplies[m] ?? 0) > 0);
    if (!food) return;
    addStock(e.supplies, food, -1);
    p.needs.food = Math.min(1, p.needs.food + FOOD_VALUE[food]);
  }
  function comeHome(s, e, d, members, rng) {
    s.expeditions = s.expeditions.filter((q) => q !== e);
    if (e.waterskins) s.items.waterskin = (s.items.waterskin ?? 0) + e.waterskins;
    if (e.horses?.length) s.horses.push(...e.horses);
    if (e.truck) s.items.truck = (s.items.truck ?? 0) + 1;
    const side = s.destSides[d.id] ?? 1;
    const x = campEdgeX(s, side);
    const haul = { ...e.loot };
    for (const m of MATERIALS) if (e.supplies[m]) addStock(haul, m, e.supplies[m]);
    const bearers = members.filter((p) => !p.downed);
    const each = bearers.length ? Math.ceil(poolSize(haul) / bearers.length) : 0;
    for (const [i, p] of members.entries()) {
      p.away = null;
      p.x = x - side * i * 20;
      p.dir = side > 0 ? -1 : 1;
      p.task = null;
      p.activity = "idle";
      stabilize(p);
      if (p.downed) continue;
      for (const m of MATERIALS) {
        const n = Math.min(haul[m] ?? 0, each - poolSize(p.carrying));
        if (n > 0) {
          addStock(p.carrying, m, n);
          addStock(haul, m, -n);
        }
      }
    }
    if (poolSize(haul)) depositNear(s, x, haul);
    if (!s.scouted.includes(d.id)) s.scouted.push(d.id);
    const found = listStock(e.loot);
    notify(s, `The ${d.name} party is back${e.recalled ? " (recalled)" : ""}: ${found || "empty-handed"}.`, true);
    if (!e.recalled) specialOutcome(s, e, d, x, rng);
    if (!e.recalled) findRelic(s, e, d, rng);
  }
  var RELIC_ODDS = { legendary: ["deaths_bargain", 0.3], clear: ["deaths_bargain", 0.12], salvage: ["phoenix_feather", 0.08] };
  function findRelic(s, e, d, rng) {
    const odds = RELIC_ODDS[d.type];
    if (!odds || d.type === "clear" && !e.cleared) return;
    if (!rng.chance(odds[1])) return;
    s.items[odds[0]] = (s.items[odds[0]] ?? 0) + 1;
    notify(s, odds[0] === "deaths_bargain" ? `At the ${d.name} the party found an old coin, cold as the grave: Death's Bargain.` : `At the ${d.name} the party found a feather that glows like embers: a Phoenix Feather!`, true);
  }
  function specialOutcome(s, e, d, x, rng) {
    switch (d.type) {
      case "clear":
        if (!e.cleared) return;
        s.nextRaidTick = Math.max(s.nextRaidTick, s.tick + CLEARED_RAID_DELAY_DAYS * TICKS_PER_DAY);
        notify(s, `With the ${d.name} broken up, the roads are quiet: no raids for ${CLEARED_RAID_DELAY_DAYS} days.`, true);
        if (s.captives.length) {
          const freed = s.captives.splice(0);
          for (const p of freed) {
            p.x = x;
            p.away = null;
            p.task = null;
            s.people.push(p);
          }
          assignBeds(s);
          notify(s, `${names(freed)} ${freed.length === 1 ? "was" : "were"} freed from their captors and came home!`, true);
        }
        return;
      case "salvage": {
        if (!occultRevealed(s) && rng.chance(STRANGE_TOME_CHANCE)) {
          revealOccult(s, `Among the rubble of the ${d.name} the party found a strange, cold tome.`);
          return;
        }
        if (!rng.chance(SALVAGE_NOTES_CHANCE)) return;
        const r = s.research;
        const topic = r.queue[0] ?? TOPICS.find((t) => !r.done.includes(t.id) && prereqsMet(r, t.id, s.era).ok)?.id;
        if (!topic) return;
        const p = r.progress[topic] ?? 0;
        r.progress[topic] = p + (1 - p) / 2;
        notify(s, `Old writings from the ${d.name}: research on ${TOPIC_BY_ID[topic].name} is half done.`, true);
        return;
      }
      case "rescue": {
        const n = rng.int(1, RESCUE_MAX);
        const joined = [];
        for (let i = 0; i < n; i++) {
          const type = rng.weighted(ARRIVING_TYPES);
          const p = makePerson(rng, s.nextId++, type, x, s.people.map((q) => q.name));
          s.people.push(p);
          joined.push(p);
        }
        assignBeds(s);
        notify(s, `${names(joined)} from the ${d.name} came home with the party and joined the town.`, true);
        return;
      }
    }
  }
  function pickIndex(weights, rng) {
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
    return weights.length - 1;
  }
  function describeGroup(group) {
    return Object.entries(group).map(([id, n]) => n === 1 ? `a ${ENEMIES[id].name.toLowerCase()}` : `${n} ${ENEMIES[id].name.toLowerCase()}s`).join(" and ");
  }
  var listStock = (st) => Object.entries(st).filter(([, n]) => (n ?? 0) > 0).map(([m, n]) => `${n} ${m === "totem" ? "totem" : m}`).join(", ");
  var names = (ps) => ps.length === 1 ? ps[0].name : `${ps.slice(0, -1).map((p) => p.name).join(", ")} and ${ps.at(-1).name}`;

  // src/shared/sim/raids.ts
  var OFF_MAP = 40;
  function scheduleNextRaid(s, rng) {
    const days = s.tick / TICKS_PER_DAY;
    const hours = Math.max(RAID_INTERVAL_MIN, RAID_INTERVAL_HOURS - days * 0.5) + rng.range(-RAID_INTERVAL_JITTER, RAID_INTERVAL_JITTER);
    s.nextRaidTick = s.tick + Math.round(Math.max(RAID_INTERVAL_MIN, hours) * ERA_MULTIPLIER[s.era] * difficultyOf(s).raidGap * TICKS_PER_HOUR);
  }
  function wealth(s) {
    return poolSize(totalStock(s)) + 5 * s.buildings.filter((b) => b.status === "done").length;
  }
  function raidBudget(s) {
    const day = Math.floor(s.tick / TICKS_PER_DAY);
    const war = s.doom?.kind === "war" && s.doom.phase === "active" ? WAR_RAID_BUDGET : 1;
    return Math.round((RAID_BUDGET_BASE + day * RAID_BUDGET_PER_DAY + Math.floor(wealth(s) * RAID_BUDGET_PER_WEALTH)) * war * difficultyOf(s).raidStrength);
  }
  function lookoutOf(s) {
    return s.buildings.filter((b) => b.status === "done" && BUILDING_BY_ID[b.def]?.warningMinutes).sort((a, b) => BUILDING_BY_ID[b.def].warningMinutes - BUILDING_BY_ID[a.def].warningMinutes)[0];
  }
  var raidKindsFor = (era, day) => RAID_KINDS.filter((k) => day >= k.fromDay && eraReached(era, k.era) && (!k.untilEra || eraReached(k.untilEra, era)));
  var shielded = (s) => s.buildings.some((b) => b.def === "shield_generator" && b.status === "done");
  function maybeStartRaid(s, rng) {
    if (s.raid || s.tick < s.nextRaidTick) return;
    const day = Math.floor(s.tick / TICKS_PER_DAY);
    const uprising = s.doom?.kind === "rogue_ai" && s.doom.phase === "active";
    const outbreak = s.doom?.kind === "outbreak" && s.doom.phase === "active";
    const freeze = s.doom?.kind === "deep_freeze" && s.doom.phase === "active";
    const rats = s.doom?.kind === "rat_plague" && s.doom.phase === "active";
    const kinds = uprising ? [RAID_KIND_BY_ID.drones] : outbreak ? [RAID_KIND_BY_ID.zombies] : freeze ? [RAID_KIND_BY_ID.frost] : rats ? [RAID_KIND_BY_ID.rats] : raidKindsFor(s.era, day);
    const odds = biomeOf(s).raids ?? {};
    const kind = RAID_KIND_BY_ID[rng.weighted(Object.fromEntries(kinds.map((k) => [k.id, k.weight * (odds[k.id] ?? 1)])))];
    const raid = startRaid(s, kind, raidBudget(s), rng);
    const bosses = ERA_BOSS[s.era];
    if (bosses && day >= BOSS_RAID_FROM_DAY && kind.steals !== void 0 && rng.chance(BOSS_RAID_CHANCE)) {
      const boss = rng.pick(bosses);
      const first = raid.raiders[0];
      raid.raiders.push({ ...first, id: s.nextId++, kind: boss, hp: ENEMIES[boss].hp, maxHp: ENEMIES[boss].hp, goal: "harm", x: first.x + raid.side * 30, carrying: {} });
      notify(s, `${ENEMIES[boss].name} leads them!`, true);
    }
    scheduleNextRaid(s, rng);
  }
  var ERA_BOSS = { medieval: ["black_knight", "dragon"], industrial: ["iron_baron", "iron_colossus"], modern: ["warlord", "war_machine"], space: ["pirate_king", "star_mech"] };
  var BOSS_RAID_CHANCE = 0.12;
  var BOSS_RAID_FROM_DAY = 10;
  function startRaid(s, kind, budget, rng) {
    const side = rng.chance(0.5) ? -1 : 1;
    const raiders = [];
    const costs = Object.entries(kind.enemies);
    const cheapest = Math.min(...costs.map(([, c]) => c));
    let left = budget;
    while (raiders.length < RAID_MAX_SIZE && (left >= cheapest || raiders.length === 0)) {
      const affordable = costs.filter(([, c]) => c <= left);
      const [id, cost] = affordable.length ? rng.pick(affordable) : costs.find(([, c]) => c === cheapest);
      left -= cost;
      const d = ENEMIES[id];
      raiders.push({
        id: s.nextId++,
        kind: id,
        x: side < 0 ? -OFF_MAP - raiders.length * 24 : WORLD_WIDTH + OFF_MAP + raiders.length * 24,
        dir: side < 0 ? 1 : -1,
        hp: d.hp,
        maxHp: d.hp,
        cooldown: rng.int(1, Math.round(d.interval * TICK_HZ)),
        down: false,
        fleeing: false,
        gone: false,
        carrying: {},
        lastAction: -999,
        lastHit: -999,
        // (only kinds with several goals draw one, so older raids replay the same)
        goal: kind.goals ? rng.weighted(kind.goals) : kind.goal
      });
    }
    if (kind.id === "zombies") bindTheDead(s, raiders);
    if (kind.id === "wolves") runWithThePack(s, raiders);
    const lookout = lookoutOf(s);
    const patrol = s.people.some((p) => p.task?.type === "patrol") ? PATROL_WARNING_MINUTES : 0;
    const warn = Math.round(((lookout ? BUILDING_BY_ID[lookout.def].warningMinutes : WARNING_MINUTES) + patrol) / 60 * TICKS_PER_HOUR);
    const raid = { id: s.nextId++, kind: kind.id, side, phase: "warning", arrivesTick: s.tick + warn, leavesTick: s.tick + warn + RAID_MAX_HOURS * TICKS_PER_HOUR, raiders, prompt: null };
    const options = ["Sound the alarm"];
    if (kind.bribable) options.push(`Pay them off (${bribeCost(raid)} food)`);
    if (s.expeditions.length) options.push("Recall expeditions");
    const where = side < 0 ? "west" : "east";
    const prompt = {
      id: s.nextId++,
      kind: "raid",
      expedition: null,
      title: `${kind.name} spotted!`,
      text: `${raiders.length} ${raiders.length === 1 ? "raider is" : "raiders are"} coming from the ${where}${lookout ? ` (seen from the ${BUILDING_BY_ID[lookout.def].name.toLowerCase()})` : ""}.`,
      options,
      defaultOption: 0,
      expiresTick: raid.arrivesTick
    };
    s.prompts.push(prompt);
    raid.prompt = prompt.id;
    s.raid = raid;
    notify(s, `${kind.name} ${kind.plural ? "are" : "is"} coming from the ${where}!`);
    return raid;
  }
  var bribeCost = (r) => r.raiders.length * BRIBE_FOOD_PER_RAIDER;
  function startGuildRaid(s, target, rng) {
    const raid = startRaid(s, RAID_KIND_BY_ID.hunters, 40 + Math.round((s.guild ?? 0) / 2), rng);
    const prompt = s.prompts.find((p) => p.id === raid.prompt);
    const { options, defaultOption } = guildOptions(target);
    prompt.title = "The Hunter's Guild is coming!";
    prompt.text = `Hunters are coming for ${target.name} the ${target.monster}. Give them up, try to hide them, or fight?`;
    prompt.options = options;
    prompt.defaultOption = defaultOption;
    s.guildTarget = target.id;
  }
  function answerRaidPrompt(s, label2, rng) {
    const r = s.raid;
    if (!r) return;
    r.prompt = null;
    if (r.kind === "hunters") {
      if (answerGuild(s, label2, rng)) {
        s.raid = null;
        s.guildTarget = null;
      }
      return;
    }
    if (label2.startsWith("Pay")) {
      if (takeFood(s, bribeCost(r))) {
        notify(s, `You paid off the ${RAID_KIND_BY_ID[r.kind].name.toLowerCase()}. They turn back.`, true);
        s.raid = null;
        return;
      }
      notify(s, "Not enough food to pay them off. Sound the alarm!");
    } else if (label2.startsWith("Recall")) {
      for (const e of s.expeditions) recallExpedition(s, e.id);
      notify(s, "Expeditions recalled. They are a long way off, though.");
    }
  }
  function takeFood(s, units) {
    const foods = Object.keys(FOOD_VALUE);
    const have = storages(s).reduce((n, b) => n + foods.reduce((k, m) => k + (b.store[m] ?? 0), 0), 0);
    if (have < units) return false;
    let left = units;
    for (const b of storages(s)) {
      for (const m of foods) {
        const n = Math.min(left, b.store[m] ?? 0);
        if (n > 0) {
          addStock(b.store, m, -n);
          left -= n;
        }
      }
    }
    return true;
  }
  function exposed(p, raidKind) {
    if (p.away !== null || p.downed) return false;
    if (raidKind === "zombies" && p.monster === "undead") return false;
    if ((p.task?.type === "shelter" || p.task?.type === "sleep") && p.bed !== null && p.activity === "sleep") return false;
    return true;
  }
  var walls = (s) => s.buildings.filter((b) => b.status === "done" && BUILDING_BY_ID[b.def].hp && (b.hp ?? 0) > 0);
  function wallBetween(s, x, target) {
    let best = null;
    for (const w of walls(s)) {
      const cx = buildingCentreX(w);
      if ((cx - x) * (target - x) <= 0 || Math.abs(cx - x) > Math.abs(target - x)) continue;
      if (!best || Math.abs(cx - x) < Math.abs(buildingCentreX(best) - x)) best = w;
    }
    return best;
  }
  function updateRaid(s, rng) {
    const r = s.raid;
    if (!r) return;
    const kind = RAID_KIND_BY_ID[r.kind];
    if (r.phase === "warning") {
      if (s.tick < r.arrivesTick) return;
      r.phase = "active";
      notify(s, `The ${kind.name.toLowerCase()} ${kind.plural ? "are" : "is"} here!`);
      summonForRaid(s, r);
      for (const kind2 of new Set(r.raiders.filter((q) => ENEMIES[q.kind].kit && !q.ally).map((q) => q.kind))) bossArrives(s, kind2);
    }
    classesInRaid(s, r);
    bossesInRaid(s, r);
    const step = kind.speed / TICK_HZ;
    const edge = r.side < 0 ? -OFF_MAP : WORLD_WIDTH + OFF_MAP;
    fireDefenses(s, rng);
    for (const rd of r.raiders) {
      if (rd.down && rd.captive) release(s, rd);
      if (rd.down || rd.gone) continue;
      if (rd.ally) {
        allyAct(r, rd, rng, step);
        continue;
      }
      const def = ENEMIES[rd.kind];
      const goal = rd.goal ?? kind.goal;
      rd.cooldown--;
      const coward = !ENEMIES[rd.kind].kit && rd.hp < rd.maxHp * RAIDER_FLEE[goal];
      if (!rd.fleeing && (coward || s.tick >= r.leavesTick || poolSize(rd.carrying) >= RAIDER_CARRY)) rd.fleeing = true;
      if (rd.fleeing) {
        rd.dir = edge > rd.x ? 1 : -1;
        rd.x += rd.dir * step * (rd.captive ? 0.8 : 1.2);
        if (rd.dir > 0 && rd.x >= edge || rd.dir < 0 && rd.x <= edge) {
          rd.gone = true;
          if (rd.captive) carriedOff(s, rd, kind.name);
        }
        continue;
      }
      const reach = def.ranged ? THROW_RANGE : MELEE_RANGE;
      if (goal === "kidnap") {
        const fallen2 = s.people.filter((p) => p.downed && p.away === null && p.id !== s.mainId).sort((a, b) => Math.abs(a.x - rd.x) - Math.abs(b.x - rd.x))[0];
        if (fallen2 && Math.abs(fallen2.x - rd.x) <= MELEE_RANGE) {
          grab(s, rd, fallen2);
          continue;
        }
        if (fallen2 && !s.people.some((p) => exposed(p, kind.id) && Math.abs(p.x - rd.x) <= reach)) {
          moveToward(rd, fallen2.x, step);
          continue;
        }
      }
      const near = s.people.filter((p) => exposed(p, kind.id) && Math.abs(p.x - rd.x) <= reach).sort((a, b) => Math.abs(a.x - rd.x) - Math.abs(b.x - rd.x))[0];
      if (near) {
        rd.dir = near.x >= rd.x ? 1 : -1;
        if (rd.cooldown <= 0) attackPerson(s, rd, near, rng);
        continue;
      }
      const fallen = goal === "harm" ? s.people.find((p) => p.downed && p.away === null && p.id !== s.mainId && p.activity !== "sleep" && Math.abs(p.x - rd.x) <= MELEE_RANGE && (kind.id !== "hunters" || !!p.monster)) : void 0;
      if (fallen && rd.cooldown <= 0) {
        rd.cooldown = Math.round(def.interval * TICK_HZ);
        rd.lastAction = s.tick;
        if (rng.chance(FINISH_OFF_CHANCE)) killPerson(s, fallen, `at the hands of the ${def.name.replace(/^The /, "")}`);
        continue;
      }
      let target = null;
      if (goal === "harm" || goal === "kidnap") {
        const prey = s.people.filter((p) => exposed(p, kind.id) && (goal === "harm" || p.id !== s.mainId)).sort((a, b) => Math.abs(a.x - rd.x) - Math.abs(b.x - rd.x))[0];
        if (prey) target = { x: prey.x };
      }
      if (!target && goal === "burn" && (rd.fires ?? 0) < ARSON_LIMIT && !shielded(s)) {
        const b = s.buildings.filter((q) => q.status === "done" && q.fire === void 0 && !defOf(q).hp && flammable(q)).sort((a, c) => Math.abs(buildingCentreX(a) - rd.x) - Math.abs(buildingCentreX(c) - rd.x))[0];
        if (b) target = { x: buildingCentreX(b), burn: b };
      }
      if (!target) {
        const score2 = kind.steals === "valuables" ? valueScore : foodScore;
        const st = storages(s).filter((b) => poolSize(b.store) > 0).sort((a, b) => score2(b) - score2(a) || Math.abs(buildingCentreX(a) - rd.x) - Math.abs(buildingCentreX(b) - rd.x))[0];
        if (st) target = { x: buildingCentreX(st), store: st };
      }
      if (!target) {
        rd.fleeing = true;
        continue;
      }
      const wall = wallBetween(s, rd.x, target.x);
      if (wall) {
        const wx = buildingCentreX(wall) - rd.dir * (defOf(wall).width * 16 + 6);
        if (Math.abs(wx - rd.x) > step) moveToward(rd, wx, step);
        else if (rd.cooldown <= 0) attackWall(s, rd, wall, rng);
        continue;
      }
      if (Math.abs(target.x - rd.x) > step) {
        moveToward(rd, target.x, step);
        continue;
      }
      if (target.burn) {
        if (rd.cooldown > 0) continue;
        rd.cooldown = Math.round(def.interval * TICK_HZ * 3);
        rd.lastAction = s.tick;
        if (setFire(s, target.burn)) rd.fires = (rd.fires ?? 0) + 1;
        if ((rd.fires ?? 0) >= ARSON_LIMIT) rd.fleeing = true;
        continue;
      }
      if (target.store) steal(rd, target.store, kind.steals ?? "food");
    }
    if (r.raiders.every((rd) => rd.down || rd.gone || rd.ally)) endRaid(s, rng);
  }
  var ARSON_LIMIT = 2;
  var foodScore = (b) => Object.keys(FOOD_VALUE).reduce((n, m) => n + (b.store[m] ?? 0), 0);
  var valueScore = (b) => MATERIALS.reduce((n, m) => n + (b.store[m] ?? 0) * (LOOT_VALUE[m] ?? 1), 0);
  function grab(s, rd, p) {
    s.people = s.people.filter((q) => q !== p);
    stabilize(p);
    p.task = null;
    p.carrying = {};
    rd.captive = p;
    rd.fleeing = true;
    notify(s, `${p.name} is being carried off!`, true);
  }
  function release(s, rd) {
    const p = rd.captive;
    rd.captive = null;
    p.x = Math.max(0, Math.min(WORLD_WIDTH, rd.x));
    p.away = null;
    s.people.push(p);
    notify(s, `${p.name} was saved from the kidnapper.`, true);
  }
  function carriedOff(s, rd, by) {
    const p = rd.captive;
    rd.captive = null;
    s.captives.push(p);
    notify(s, `${p.name} was carried off by the ${by.toLowerCase()}. Clear the Bandit Camp to bring them home.`, true);
  }
  function moveToward(rd, x, step) {
    rd.dir = x >= rd.x ? 1 : -1;
    rd.x += rd.dir * Math.min(step, Math.abs(x - rd.x));
  }
  function steal(rd, st, what) {
    const foods = Object.keys(FOOD_VALUE);
    const order = what === "valuables" ? [...MATERIALS].sort((a, b) => (LOOT_VALUE[b] ?? 1) - (LOOT_VALUE[a] ?? 1)) : [...foods, ...MATERIALS.filter((m) => !foods.includes(m))];
    for (const m of order) {
      const n = Math.min(st.store[m] ?? 0, RAIDER_CARRY - poolSize(rd.carrying));
      if (n > 0) {
        addStock(st.store, m, -n);
        addStock(rd.carrying, m, n);
      }
    }
    rd.fleeing = true;
  }
  function attackPerson(s, rd, p, rng) {
    const def = ENEMIES[rd.kind];
    rd.cooldown = Math.round(def.interval * TICK_HZ);
    rd.lastAction = s.tick;
    const dodge = 0.05 + p.skills.melee.level * 0.01;
    if (rng.next() >= def.accuracy - dodge) return;
    const blow = (q) => {
      const g = gearEffects(q);
      return hitDamage({ damage: def.damage, ammo: 0, ammoBonus: 0, ammoUsed: 0, beastDamage: 0 }, { kind: "person", armor: Math.min(0.6, g.armor), block: g.block, tough: q.traits.includes("tough") }, rng);
    };
    const mult = def.kit ? bossBlow(s, rd, s.people.filter((q) => exposed(q)), blow) : 1;
    if (!mult) return;
    const dmg = Math.round(blow(p) * mult);
    p.hp = Math.max(0, p.hp - dmg);
    if (dmg > 0 && (rd.kind === "ice_mage" || rd.kind === "frost_archmage")) personFx(s, p.id, "frost");
    if (dmg > 0 && (rd.kind === "plague_rat" || rd.kind === "rat_king") && p.monster !== "undead" && !p.sick && rng.chance(RAT_BITE_SICKNESS)) sicken(s, p, rng);
    if (p.hp === 0) {
      knockDown(s, p);
      notify(s, `${p.name} was struck down!`);
    }
  }
  function attackWall(s, rd, wall, rng) {
    const def = ENEMIES[rd.kind];
    rd.cooldown = Math.round(def.interval * TICK_HZ);
    rd.lastAction = s.tick;
    wall.hp = Math.max(0, (wall.hp ?? 0) - rng.int(def.damage[0], def.damage[1]));
    if (wall.hp === 0) {
      s.buildings = s.buildings.filter((b) => b !== wall);
      notify(s, `The raiders broke through the ${defOf(wall).name.toLowerCase()}!`, true);
    }
  }
  function allyAct(r, rd, rng, step) {
    const def = ENEMIES[rd.kind];
    const foe = r.raiders.filter((o) => !o.ally && !o.down && !o.gone && o.x >= 0 && o.x <= WORLD_WIDTH).sort((a, b) => Math.abs(a.x - rd.x) - Math.abs(b.x - rd.x))[0];
    if (!foe) return;
    rd.dir = foe.x >= rd.x ? 1 : -1;
    const reach = def.ranged ? THROW_RANGE : MELEE_RANGE;
    if (Math.abs(foe.x - rd.x) > reach) {
      rd.x += rd.dir * step;
      return;
    }
    if (--rd.cooldown > 0) return;
    rd.cooldown = Math.round(def.interval * TICK_HZ);
    if (rng.next() >= def.accuracy - ENEMIES[foe.kind].dodge) return;
    foe.hp = Math.max(0, foe.hp - rng.int(def.damage[0], def.damage[1]));
    if (foe.hp === 0) foe.down = true;
  }
  function fireDefenses(s, rng) {
    for (const b of s.buildings) {
      const d = b.status === "done" ? BUILDING_BY_ID[b.def]?.defense : void 0;
      if (!d || (b.readyTick ?? 0) > s.tick) continue;
      const x = buildingCentreX(b);
      const target = s.raid.raiders.filter((rd) => !rd.down && !rd.gone && !rd.ally && Math.abs(rd.x - x) <= d.range).sort((a, c) => Math.abs(a.x - x) - Math.abs(c.x - x))[0];
      if (!target) continue;
      b.readyTick = s.tick + Math.round(d.interval * TICK_HZ);
      if (rng.next() >= d.accuracy - ENEMIES[target.kind].dodge / 2) continue;
      target.hp = Math.max(0, target.hp - rng.int(d.damage[0], d.damage[1]));
      target.lastHit = s.tick;
      target.hitFx = b.def === "laser_turret" ? "shock" : null;
      if (target.hp === 0) target.down = true;
    }
  }
  function defenderAttack(s, p, rd, rng, bonus = 0) {
    const kind = ammoOf(p);
    const store = kind ? storages(s).find((b) => (b.store[kind] ?? 0) > 0) : void 0;
    const f = personFighter(p, "fighter", "front", store ? 1 : 0);
    if (store) addStock(store.store, kind, -1);
    const dodge = ENEMIES[rd.kind].dodge;
    gainSkill(p, f.ranged ? "ranged" : "melee", 6);
    const captain = operatorSkill(s, "watchtower") * CAPTAIN_PER_LEVEL;
    if (rng.next() >= f.accuracy + captain - dodge) return;
    let dmg = hitDamage(f, { kind: rd.kind, armor: 0, block: 0, tough: false }, rng) + bonus;
    if (p.cls === "blood_knight") {
      if (p.hp < maxHp(p) / 2) dmg = Math.round(dmg * BLOOD_FURY);
      p.hp = Math.min(maxHp(p), p.hp + Math.round(dmg * BLOOD_LIFESTEAL));
    }
    rd.hp = Math.max(0, rd.hp - dmg);
    rd.lastHit = s.tick;
    rd.hitFx = p.cls === "blood_knight" ? "blood" : store && kind === "power_cells" ? "lightning" : store && (kind === "shot" || kind === "cartridges") ? "fire" : null;
    if (rd.hp === 0) rd.down = true;
  }
  function defenderReach(p) {
    const sling = !!p.gear.weapon && !!ITEM_BY_ID[p.gear.weapon]?.effects.ranged;
    return sling || p.skills.ranged.level > p.skills.melee.level + 2 ? THROW_RANGE : MELEE_RANGE;
  }
  function nearestRaider(s, x) {
    const r = s.raid;
    if (!r || r.phase !== "active") return null;
    let best = null;
    for (const rd of r.raiders) {
      if (rd.down || rd.gone || rd.ally || rd.x < 0 || rd.x > WORLD_WIDTH) continue;
      if (!best || Math.abs(rd.x - x) < Math.abs(best.x - x)) best = rd;
    }
    return best;
  }
  var rallyX = (s) => campEdgeX(s, s.raid?.side ?? 1);
  function endRaid(s, rng) {
    const r = s.raid;
    s.raid = null;
    const kind = RAID_KIND_BY_ID[r.kind];
    if (r.kind === "hunters") guildDefeated(s);
    if (s.horses.length && r.raiders.some((rd) => rd.gone && poolSize(rd.carrying) > 0) && rng.chance(HORSE_THEFT)) {
      const h = s.horses.splice(rng.int(0, s.horses.length - 1), 1)[0];
      notify(s, `The raiders stole ${h.name} from the stable.`, true);
    }
    const stolen = {};
    let killed = 0;
    const foes = r.raiders.filter((rd) => !rd.ally || rd.raiseChecked);
    const enemies = r.raiders.filter((rd) => !rd.ally);
    for (const rd of foes) {
      if (rd.down || rd.ally) {
        killed++;
        depositNear(s, Math.max(0, Math.min(WORLD_WIDTH, rd.x)), { ...ENEMIES[rd.kind].loot });
      } else for (const m of MATERIALS) if (rd.carrying[m]) addStock(stolen, m, rd.carrying[m]);
    }
    const infirmary = s.buildings.some((b) => b.status === "done" && (BUILDING_BY_ID[b.def]?.healing ?? 1) >= 2);
    const bleeding = s.people.filter((p) => p.downed?.bleedUntil != null && p.away === null);
    if (infirmary) bleeding.forEach(stabilize);
    else if (bleeding.length) notify(s, `${bleeding.map((p) => p.name).join(", ")} ${bleeding.length === 1 ? "is" : "are"} bleeding out! Someone must tend them (Medicine helps; a bandage or poultice always works).`, true);
    takePrisoners(s, enemies, rng);
    const took = MATERIALS.filter((m) => stolen[m]).map((m) => `${stolen[m]} ${m}`);
    const outcome = killed && killed === foes.length ? killed === 1 ? "The raider was killed." : `All ${killed} were killed.` : killed ? `${killed} killed, the rest fled.` : took.length ? "They got away." : "They were driven off.";
    notify(s, `Raid by the ${kind.name.toLowerCase()} is over. ${outcome}${took.length ? ` They took ${took.join(", ")}.` : ""}`, true);
  }

  // src/shared/sim/doom.ts
  var FOOD_DOOMS = ["drought", "ash_winter", "deep_freeze", "meltdown"];
  var stretch = (s) => s.doom && FOOD_DOOMS.includes(s.doom.kind) ? 1 : Math.sqrt(ERA_MULTIPLIER[s.era]);
  var built = (s, def) => s.buildings.some((b) => b.def === def && b.status === "done");
  var drought = (s) => s.doom?.kind === "drought" && s.doom.phase === "active";
  var isSick = (p) => p.sick != null;
  var striking = (s, kind) => s.doom?.kind === kind && s.doom.phase === "active";
  function possibleDooms(s) {
    const works = s.buildings.filter((b) => b.status === "done" && SMOKY_WORKS.includes(b.def)).length;
    return Object.keys(DOOMS).filter((k) => eraReached(s.era, DOOMS[k].era) && (k !== "smog" || works >= SMOG_MIN_WORKS) && (k !== "rogue_ai" || s.research.done.includes("robotics")) && (k !== "outbreak" || s.tick >= OUTBREAK_FROM_DAY * TICKS_PER_DAY) && (k !== "deep_freeze" || s.tick >= FREEZE_FROM_DAY * TICKS_PER_DAY) && (k !== "meltdown" || built(s, "power_station")));
  }
  function updateDoom(s, rng) {
    if (s.tick % TICKS_PER_HOUR !== 0) return;
    if (!s.nextDoomTick) s.nextDoomTick = DOOM_FIRST_DAY * TICKS_PER_DAY + mixSeed(hashSeed(s.seed), 208) % 48 * TICKS_PER_HOUR;
    const d = s.doom;
    if (!d) {
      if (s.tick < s.nextDoomTick) return;
      const odds = biomeOf(s).dooms ?? {};
      const kind = rng.weighted(Object.fromEntries(possibleDooms(s).map((k) => [k, DOOMS[k].weight * (odds[k] ?? 1)])));
      s.doom = { kind, phase: "signs", untilTick: s.tick + Math.round(DOOMS[kind].warnHours * stretch(s) * TICKS_PER_HOUR) };
      notify(s, DOOMS[kind].signs, true);
      return;
    }
    const def = DOOMS[d.kind];
    if (d.phase === "signs") {
      if (s.tick < d.untilTick) return;
      d.phase = "active";
      d.untilTick = s.tick + Math.round(rng.int(def.hours[0], def.hours[1]) * stretch(s) * TICKS_PER_HOUR);
      notify(s, def.strikes, true);
      if (d.kind === "plague") {
        const here = s.people.filter((p) => p.away === null);
        if (here.length) infect(s, rng.pick(here), rng);
      }
      if (d.kind === "meteors") meteorStrike(s, rng);
      if (d.kind === "meltdown") {
        const reactor = s.buildings.find((b) => b.def === "power_station" && b.status === "done");
        if (reactor) setFire(s, reactor, true);
      }
      if (d.kind === "outbreak" && isLich(s)) {
        const main = s.people.find((p) => p.id === s.mainId);
        s.prompts.push({
          id: s.nextId++,
          kind: "lich",
          expedition: null,
          title: "The dead hear their master",
          text: `The walking dead turn their heads toward ${main?.name ?? "the lich"}. They are waiting for a command.`,
          options: ["Command the dead", "Let them be"],
          defaultOption: 0,
          expiresTick: s.tick + 6 * TICKS_PER_HOUR
        });
      }
      return;
    }
    if (d.kind === "plague") spreadPlague(s, rng);
    if (d.kind === "smog") breatheSmog(s);
    if (d.kind === "meltdown") breatheSmog(s, FALLOUT_HP_PER_HOUR);
    if (d.kind === "outbreak") {
      s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + Math.round(ZOMBIE_WAVE_HOURS * stretch(s) * TICKS_PER_HOUR));
      if (!d.bossSent && !s.raid && d.untilTick - s.tick <= ABOMINATION_BEFORE_END_HOURS * stretch(s) * TICKS_PER_HOUR) {
        d.bossSent = true;
        const wave = startRaid(s, RAID_KIND_BY_ID.zombies, raidBudget(s), rng);
        wave.raiders.push({ ...wave.raiders[0], id: s.nextId++, kind: "abomination", hp: ENEMIES.abomination.hp, maxHp: ENEMIES.abomination.hp, x: wave.raiders[0].x + wave.side * 30, ally: false });
      }
    }
    if (d.kind === "deep_freeze") {
      keepWarm(s, d, stretch(s));
      const gap2 = Math.round(FREEZE_WAVE_HOURS * stretch(s) * TICKS_PER_HOUR);
      s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + gap2);
      leadWaves(s, d, rng, "frost", "frost_archmage", ARCHMAGE_BEFORE_END_HOURS, ARCHMAGE_HP_BY_ERA[s.era], gap2, "The Frost Archmage strides back out of the storm!");
    }
    if (d.kind === "rat_plague") {
      gnawStores(s);
      const gap2 = Math.round(RAT_WAVE_HOURS * stretch(s) * TICKS_PER_HOUR);
      s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + gap2);
      leadWaves(s, d, rng, "rats", "rat_king", RAT_KING_BEFORE_END_HOURS, RAT_KING_HP_BY_ERA[s.era] ?? 1, gap2, "The Rat King crawls back up out of the sewers!");
    }
    if (d.kind === "war" || d.kind === "rogue_ai") s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + Math.round(WAR_RAID_EVERY_HOURS * stretch(s) * TICKS_PER_HOUR));
    const over = d.kind === "plague" ? !s.people.some(isSick) : s.tick >= d.untilTick;
    if (over) {
      s.doom = null;
      s.nextDoomTick = s.tick + Math.round(rng.int(DOOM_EVERY_DAYS[0] * 24, DOOM_EVERY_DAYS[1] * 24) * ERA_MULTIPLIER[s.era] * difficultyOf(s).doomGap * TICKS_PER_HOUR);
      notify(s, def.ends, true);
    }
  }
  function leadWaves(s, d, rng, raidKind, boss, beforeEndHours, hpScale, gap2, again) {
    if (s.raid || s.tick < (d.bossAgainTick ?? 0) || d.untilTick - s.tick > beforeEndHours * stretch(s) * TICKS_PER_HOUR) return;
    if (d.bossSent) notify(s, again, true);
    d.bossSent = true;
    d.bossAgainTick = s.tick + gap2;
    const wave = startRaid(s, RAID_KIND_BY_ID[raidKind], raidBudget(s), rng);
    const hp = Math.round(ENEMIES[boss].hp * hpScale);
    wave.raiders.push({ ...wave.raiders[0], id: s.nextId++, kind: boss, hp, maxHp: hp, x: wave.raiders[0].x + wave.side * 30, goal: "harm", carrying: {} });
  }
  function gnawStores(s) {
    for (const st of storages(s)) {
      for (const m of Object.keys(FOOD_VALUE)) {
        const n = Math.round((st.store[m] ?? 0) * RATS_EAT_PER_HOUR);
        if (n > 0) addStock(st.store, m, -n);
      }
    }
  }
  function keepWarm(s, d, stretch2) {
    const here = s.people.filter((p) => p.away === null && p.monster !== "undead");
    const wasCold = !!d.cold;
    let need = FREEZE_HEATERS.some((h) => built(s, h)) ? 0 : (d.heatOwed ?? 0) + here.length / FREEZE_PEOPLE_PER_HEAT / stretch2;
    for (const m of ["wood", "coal", "fuel"]) {
      for (const st of storages(s)) {
        while (need >= 1 && (st.store[m] ?? 0) > 0) {
          addStock(st.store, m, -1);
          need -= HEAT_VALUE[m];
        }
      }
    }
    d.cold = need >= 1;
    d.heatOwed = Math.min(1, need);
    if (d.cold) {
      for (const p of here) if (!p.downed && p.hp > 1) p.hp = Math.max(1, p.hp - FREEZE_HP_PER_HOUR);
    }
    if (d.cold && !wasCold) notify(s, "There is nothing left to burn: the town is freezing! Gather wood (or coal) to keep warm.", true);
    if (!d.cold && wasCold) notify(s, "Fires are lit again, and the town thaws out a little.");
  }
  var sicken = (s, p, rng) => infect(s, p, rng);
  function infect(s, p, rng) {
    if (isSick(p) || p.monster === "undead") return;
    p.sick = { until: s.tick + rng.int(PLAGUE_HOURS[0], PLAGUE_HOURS[1]) * TICKS_PER_HOUR };
    notify(s, `${p.name} has fallen sick.`);
  }
  function spreadPlague(s, rng) {
    const guard = (built(s, "infirmary") || built(s, "hospital") ? 0.5 : 1) * (s.research.done.includes("sanitation") ? 0.3 : 1);
    for (const p of [...s.people]) {
      if (!isSick(p) || p.away !== null) continue;
      for (const o of s.people) if (o !== p && o.away === null && !isSick(o) && Math.abs(o.x - p.x) <= NEAR_PX && rng.chance(PLAGUE_SPREAD * guard)) infect(s, o, rng);
      p.hp -= PLAGUE_HP_PER_HOUR;
      if (p.hp <= 0) {
        killPerson(s, p, "of the plague");
        if (s.gameOver) return;
        continue;
      }
      if (s.tick >= p.sick.until) {
        p.sick = null;
        notify(s, `${p.name} has recovered.`);
      }
    }
  }
  function meteorStrike(s, rng) {
    if (shielded(s)) {
      notify(s, "The shield flares white, and the meteors burn up above the town.", true);
      return;
    }
    const targets = s.buildings.filter((b) => b.status === "done" && b.fire === void 0 && b.def !== "campfire");
    const hits = Math.min(targets.length, rng.int(METEOR_HITS[0], METEOR_HITS[1]));
    for (let i = 0; i < hits; i++) {
      const b = targets.splice(rng.int(0, targets.length - 1), 1)[0];
      setFire(s, b, true);
      s.impacts = [...(s.impacts ?? []).filter((m) => s.tick - m.tick < TICKS_PER_HOUR), { tick: s.tick, x: buildingCentreX(b) }];
    }
  }
  function breatheSmog(s, perHour = SMOG_HP_PER_HOUR) {
    const guard = built(s, "hospital") || built(s, "trauma_center") ? 0.5 : 1;
    for (const p of s.people) if (p.away === null && !p.downed && p.hp > 1 && p.monster !== "undead") p.hp = Math.max(1, p.hp - perHour * guard);
  }
  function treatSickness(s, p) {
    if (!p.sick || p.sick.treated) return false;
    p.sick.until = s.tick + Math.max(0, p.sick.until - s.tick) / 2;
    p.sick.treated = true;
    return true;
  }
  function doomGrowth(s) {
    if (striking(s, "ash_winter") || striking(s, "deep_freeze") || striking(s, "meltdown")) return 0;
    if (!drought(s)) return 1;
    return built(s, "well") ? DROUGHT_GROWTH_WELL : DROUGHT_GROWTH;
  }
  var doomForage = (s) => drought(s) ? DROUGHT_FORAGE : striking(s, "ash_winter") ? ASH_FORAGE : striking(s, "deep_freeze") ? FREEZE_FORAGE : 1;
  function answerLich(s, label2) {
    if (s.doom?.kind !== "outbreak") return;
    if (label2.startsWith("Command")) {
      s.doom.commanded = true;
      personFx(s, s.mainId, "undead");
      notify(s, "The lich raises a hand, and most of the dead bow. Each wave, they turn on their own kind.", true);
    } else notify(s, "The lich lets the dead go their own way.");
  }
  function bindTheDead(s, raiders) {
    if (s.doom?.kind !== "outbreak" || !s.doom.commanded) return;
    raiders.forEach((r, i) => {
      if (r.kind !== "abomination" && i % 3 !== 0) r.ally = true;
    });
  }

  // src/shared/sim/crafting.ts
  function itemUnlocked(s, def) {
    return s.cheats.unlockAll || def.research.every((r) => s.research.done.includes(r));
  }
  function stationFor(s, def) {
    return s.buildings.find((b) => b.def === def.station && b.status === "done");
  }
  var stationName = (def) => BUILDING_BY_ID[def.station]?.name ?? def.station;
  function craftNeeded(o) {
    const out = {};
    for (const [m, n] of Object.entries(ITEM_BY_ID[o.item].cost)) {
      const need = n - (o.delivered[m] ?? 0);
      if (need > 0) out[m] = need;
    }
    return out;
  }
  function missingItems(s, o) {
    if (o.itemsTaken) return [];
    return Object.entries(ITEM_BY_ID[o.item].items ?? {}).filter(([id, n]) => (s.items[id] ?? 0) < n).map(([id]) => ITEM_BY_ID[id].name);
  }
  var craftSlots = (s) => CRAFT_QUEUE_SLOTS + modifiers(s.research).queueSlots;
  function canQueueCraft(s, itemId) {
    const def = ITEM_BY_ID[itemId];
    if (!def) return { ok: false, reason: "Unknown item" };
    if (!itemUnlocked(s, def)) return { ok: false, reason: "Not researched yet" };
    const same = s.crafting.find((o) => o.item === itemId && o.count < MAX_ORDER);
    if (!same && s.crafting.length >= craftSlots(s)) return { ok: false, reason: "Craft queue is full" };
    return { ok: true };
  }
  function queueCraft(s, itemId) {
    const check = canQueueCraft(s, itemId);
    if (!check.ok) return check;
    const same = s.crafting.find((o) => o.item === itemId && o.count < MAX_ORDER);
    if (same) same.count++;
    else s.crafting.push({ id: s.nextId++, item: itemId, count: 1, delivered: {}, itemsTaken: false, progress: 0, made: 0 });
    return { ok: true };
  }
  function reduceCraft(s, orderId, all = false) {
    const o = s.crafting.find((q) => q.id === orderId);
    if (!o) return;
    o.count = all ? 0 : o.count - 1;
    if (o.count > 0) return;
    s.crafting = s.crafting.filter((q) => q !== o);
    const def = ITEM_BY_ID[o.item];
    const at = stationFor(s, def);
    depositNear(s, at ? buildingCentreX(at) : campX(s), o.delivered);
    if (o.itemsTaken) for (const [id, n] of Object.entries(def.items ?? {})) addItems(s, id, n);
  }
  function addItems(s, id, n) {
    const v = (s.items[id] ?? 0) + n;
    if (v > 0) s.items[id] = v;
    else delete s.items[id];
  }
  function takeItemInputs(s, o) {
    if (o.itemsTaken) return true;
    if (missingItems(s, o).length) return false;
    for (const [id, n] of Object.entries(ITEM_BY_ID[o.item].items ?? {})) addItems(s, id, -n);
    o.itemsTaken = true;
    return true;
  }
  function finishPiece(s, o, p) {
    const def = ITEM_BY_ID[o.item];
    if (def.makes) {
      const at = stationFor(s, def);
      const left = depositNear(s, at ? buildingCentreX(at) : p.x, def.makes);
      for (const m of MATERIALS) if (left[m]) addStock(p.carrying, m, left[m]);
    } else {
      addItems(s, def.id, 1);
    }
    o.delivered = {};
    o.itemsTaken = false;
    o.progress = 0;
    o.count--;
    o.made++;
    if (o.count <= 0) {
      s.crafting = s.crafting.filter((q) => q !== o);
      notify(s, `Crafted: ${o.made > 1 ? `${o.made} \xD7 ` : ""}${def.name}`);
    }
    if (def.slot) equipAll(s);
  }
  function gearEffects(p) {
    const e = { damage: 0, beastDamage: 0, accuracy: 0, armor: 0, block: 0, carry: 0, morale: 0, ranged: false };
    for (const id of Object.values(p.gear)) {
      const fx = ITEM_BY_ID[id]?.effects;
      if (!fx) continue;
      if (fx.damage && !(ITEM_BY_ID[id].slot === "tool" && p.gear.weapon)) e.damage += fx.damage;
      e.beastDamage += fx.beastDamage ?? 0;
      e.accuracy += fx.accuracy ?? 0;
      e.armor += fx.armor ?? 0;
      e.block += fx.block ?? 0;
      e.carry += fx.carry ?? 0;
      e.morale += fx.morale ?? 0;
      if (fx.ranged) e.ranged = true;
    }
    return e;
  }
  function toolSpeed(p, work) {
    const fx = p.gear.tool ? ITEM_BY_ID[p.gear.tool]?.effects : void 0;
    if (!fx) return 1;
    return work === "construct" ? fx.construct ?? 1 : fx.gather?.[work] ?? 1;
  }
  function pickTool(s, p, work) {
    let best = p.gear.tool;
    let bestSpeed = toolSpeed(p, work);
    for (const [id, n] of Object.entries(s.items)) {
      const def = ITEM_BY_ID[id];
      if (!n || def?.slot !== "tool") continue;
      const speed = work === "construct" ? def.effects.construct ?? 1 : def.effects.gather?.[work] ?? 1;
      if (speed > bestSpeed) {
        best = id;
        bestSpeed = speed;
      }
    }
    if (best && best !== p.gear.tool) equip(s, p, "tool", best);
  }
  function score(def) {
    const e = def.effects;
    const gather = Object.values(e.gather ?? {}).reduce((a, b) => a + (b - 1), 0);
    return (e.damage ?? 0) + (e.beastDamage ?? 0) * 0.5 + (e.accuracy ?? 0) * 20 + (e.armor ?? 0) * 30 + (e.block ?? 0) * 30 + (e.carry ?? 0) + (e.morale ?? 0) + gather * 10 + ((e.construct ?? 1) - 1) * 10;
  }
  function equip(s, p, slot, itemId) {
    if (itemId !== null && ((s.items[itemId] ?? 0) <= 0 || ITEM_BY_ID[itemId]?.slot !== slot)) return;
    const old = p.gear[slot];
    if (old) addItems(s, old, 1);
    if (itemId === null) delete p.gear[slot];
    else {
      addItems(s, itemId, -1);
      p.gear[slot] = itemId;
    }
  }
  function equipAll(s) {
    const fightSkill = (p) => Math.max(p.skills.melee.level, p.skills.ranged.level) + (p.id === s.mainId ? 0.5 : 0) + (p.priorities.defend ? 3 : 0);
    for (const slot of SLOTS) {
      const combat = slot === "weapon" || slot === "offhand" || slot === "head" || slot === "body";
      const people = s.people.filter((p) => p.away === null).sort((a, b) => combat ? fightSkill(b) - fightSkill(a) : a.id - b.id);
      for (const p of people) {
        const spare = Object.entries(s.items).filter(([id, n]) => n > 0 && ITEM_BY_ID[id]?.slot === slot).map(([id]) => ITEM_BY_ID[id]).sort((a, b) => score(b) - score(a))[0];
        if (!spare) break;
        const worn = p.gear[slot] ? ITEM_BY_ID[p.gear[slot]] : void 0;
        if (worn && score(spare) <= score(worn)) continue;
        equip(s, p, slot, spare.id);
      }
    }
  }
  function hasBedroll(s, p) {
    if (p.bed !== null) return false;
    const bedless = s.people.filter((q) => q.bed === null && q.away === null);
    return bedless.indexOf(p) < (s.items.bedroll ?? 0) && bedless.includes(p);
  }
  function hourlyItems(s, rng) {
    if (s.tick % TICKS_PER_HOUR !== 0) return;
    const snares = s.items.snare ?? 0;
    let caught = 0;
    for (let i = 0; i < snares; i++) {
      if (!rng.chance(SNARE_CATCH)) continue;
      caught++;
      if (rng.chance(SNARE_BREAK)) {
        addItems(s, "snare", -1);
        notify(s, "A snare broke.");
      }
    }
    if (caught) depositNear(s, campX(s), { meat: caught });
    const hurt = s.people.filter((p) => p.away === null && (p.downed || p.hp < maxHp(p) * 0.5)).sort((a, b) => Number(!!b.downed?.bleedUntil) - Number(!!a.downed?.bleedUntil) || a.hp - b.hp);
    for (const p of s.people) {
      if (!p.sick || p.sick.treated || p.away !== null) continue;
      const use = (s.items.bandage ?? 0) > 0 ? "bandage" : (s.items.poultice ?? 0) > 0 ? "poultice" : null;
      if (!use) break;
      if (treatSickness(s, p)) {
        addItems(s, use, -1);
        notify(s, `${p.name} was tended with a ${use} and is getting better.`);
      }
    }
    for (const p of hurt) {
      const use = (s.items.bandage ?? 0) > 0 ? "bandage" : (s.items.poultice ?? 0) > 0 ? "poultice" : null;
      if (!use) break;
      addItems(s, use, -1);
      stabilize(p);
      p.hp = Math.min(maxHp(p), p.hp + (use === "bandage" ? BANDAGE_HP : POULTICE_HP));
      notify(s, `${p.name}'s wounds were dressed with a ${use}.`);
    }
  }
  function craftSeconds(def, era) {
    const food = Object.keys(def.makes ?? {}).some((m) => FOOD_VALUE[m] || m === "flour");
    return def.seconds * (food ? 1 : ERA_MULTIPLIER[era]);
  }

  // src/shared/data/crops.ts
  var CROPS = {
    garden_plot: { material: "grain", yield: 10, growHours: 18, sowSeconds: 25, harvestSeconds: 30 },
    herb_garden: { material: "herbs", yield: 5, growHours: 14, sowSeconds: 20, harvestSeconds: 20 },
    hydroponics_bay: { material: "grain", yield: 16, growHours: 12, sowSeconds: 20, harvestSeconds: 25, indoor: true }
  };
  var WORKPLACES = {
    mine: { outputs: { iron_ore: 3, stone: 2 }, seconds: 40, workers: 2 },
    coal_mine: { outputs: { coal: 4, stone: 1 }, seconds: 40, workers: 3 },
    oil_derrick: { outputs: { oil: 4 }, seconds: 40, workers: 2 },
    deep_mine: { outputs: { rare_minerals: 2, stone: 2 }, seconds: 45, workers: 3 }
  };
  var SEASON_GROWTH = { spring: 1, summer: 1.2, autumn: 0.6, winter: 0 };
  var YIELD_PER_LEVEL = 0.08;

  // src/shared/sim/farming.ts
  var FARM_XP_PER_SEC = 2;
  var HARVEST_XP = 20;
  var isField = (b) => !!CROPS[b.def] && b.status === "done";
  function cropOf(b) {
    b.crop ??= { stage: "fallow", growth: 0, work: 0 };
    return b.crop;
  }
  var riverCache = /* @__PURE__ */ new Map();
  function byRiver(s, b) {
    const key2 = `${s.seed}|${s.biome ?? "forest"}`;
    let rivers = riverCache.get(key2);
    if (!rivers) {
      rivers = generateWorld(s.seed, s.biome).rivers;
      riverCache.set(key2, rivers);
    }
    const mid = b.tile + BUILDING_BY_ID[b.def].width / 2;
    return rivers.some((r) => Math.abs(r - mid) <= RIVER_TILES);
  }
  function growCrops(s) {
    const season = calendar(s.tick).season;
    let speed = null;
    for (const b of s.buildings) {
      if (!isField(b)) continue;
      const c = cropOf(b);
      if (c.stage !== "growing") continue;
      speed ??= modifiers(s.research).cropSpeed;
      const indoor = CROPS[b.def].indoor;
      const outside = indoor ? 1 : SEASON_GROWTH[season] * doomGrowth(s) * biomeOf(s).crops * (byRiver(s, b) ? RIVER_GROWTH : 1);
      c.growth += outside * speed / (CROPS[b.def].growHours * TICKS_PER_HOUR);
      if (c.growth >= 1) {
        c.growth = 1;
        c.stage = "ripe";
        c.work = 0;
      }
    }
  }
  function fieldToWork(s, p) {
    let best = null;
    for (const b of s.buildings) {
      if (!isField(b)) continue;
      const c = cropOf(b);
      if (c.stage === "growing") continue;
      if (c.stage === "fallow" && calendar(s.tick).season === "winter" && !CROPS[b.def].indoor) continue;
      if (s.people.some((o) => o !== p && o.task?.type === "farm" && o.task.building === b.id)) continue;
      if (!best || Math.abs(buildingCentreX(b) - p.x) < Math.abs(buildingCentreX(best) - p.x)) best = b;
    }
    return best;
  }
  function workField(s, p, b) {
    const def = CROPS[b.def];
    const c = cropOf(b);
    const seconds = c.stage === "ripe" ? def.harvestSeconds : def.sowSeconds;
    c.work += skillSpeed(p.skills.farming.level) * workFactor(s, p) * (greenThumb(p) ? 1.25 : 1) / (seconds * TICK_HZ);
    gainSkill(p, "farming", FARM_XP_PER_SEC / TICK_HZ);
    if (c.work < 1) return false;
    c.work = 0;
    if (c.stage === "fallow") {
      c.stage = "growing";
      c.growth = 0;
    } else {
      const n = Math.round(def.yield * (1 + (p.skills.farming.level - 1) * YIELD_PER_LEVEL) * (greenThumb(p) ? 1.25 : 1));
      const carry = Math.min(n, Math.max(0, carryCapacity(s, p) - poolSize(p.carrying)));
      addStock(p.carrying, def.material, carry);
      if (n > carry) depositNear(s, buildingCentreX(b), { [def.material]: n - carry });
      c.stage = "fallow";
      c.growth = 0;
      gainSkill(p, "farming", HARVEST_XP);
    }
    return true;
  }
  var greenThumb = (p) => p.traits.includes("green_thumb");
  function mineToWork(s, p) {
    let best = null;
    for (const b of s.buildings) {
      if (b.status !== "done" || !WORKPLACES[b.def]) continue;
      const diggers = s.people.filter((o) => o !== p && o.task?.type === "mine" && o.task.building === b.id).length;
      if (diggers >= WORKPLACES[b.def].workers) continue;
      if (!best || Math.abs(buildingCentreX(b) - p.x) < Math.abs(buildingCentreX(best) - p.x)) best = b;
    }
    return best;
  }
  function workMine(s, p, b, progress) {
    const w = WORKPLACES[b.def];
    progress.work += skillSpeed(p.skills.gathering.level) * toolSpeed(p, "mine") * modifiers(s.research).gather.mine * workFactor(s, p) / (w.seconds * ERA_MULTIPLIER[s.era] * TICK_HZ);
    gainSkill(p, "gathering", FARM_XP_PER_SEC / TICK_HZ);
    if (progress.work < 1) return false;
    progress.work = 0;
    const room = Math.max(0, carryCapacity(s, p) - poolSize(p.carrying));
    let left = room;
    const spill = {};
    for (const [m, n] of Object.entries(w.outputs)) {
      const k = Math.min(n, left);
      addStock(p.carrying, m, k);
      left -= k;
      if (n > k) spill[m] = n - k;
    }
    if (poolSize(spill)) depositNear(s, buildingCentreX(b), spill);
    gainSkill(p, "gathering", HARVEST_XP);
    return true;
  }

  // src/shared/sim/breaks.ts
  var BREAK_MORALE = 10;
  var BREAK_AFTER_HOURS = 2;
  var BREAK_CHANCE = 0.35;
  var LEAVE_MORALE = 5;
  var RELIEF = 15;
  function updateBreaks(s, rng) {
    if (s.tick % TICKS_PER_HOUR !== 0) return;
    for (const p of [...s.people]) {
      if (p.away !== null || p.bornTick != null) continue;
      const b = p.breakdown;
      if (b) {
        if (b.kind === "binge") binge(s, p);
        if (s.tick >= b.until && b.kind !== "wander") {
          p.breakdown = null;
          p.morale = Math.min(100, p.morale + RELIEF);
          notify(s, `${p.name} has calmed down.`);
        }
        continue;
      }
      p.lowMoraleHours = p.morale <= BREAK_MORALE ? (p.lowMoraleHours ?? 0) + 1 : 0;
      if (p.lowMoraleHours < BREAK_AFTER_HOURS || !rng.chance(BREAK_CHANCE)) continue;
      startBreak(s, p, rng);
    }
  }
  function startBreak(s, p, rng) {
    const rival = rivalsOf(s, p).find((r) => r.away === null && !r.downed);
    const odds = { sulk: 3, binge: 2 };
    if (rival) odds.brawl = 3;
    if (p.morale <= LEAVE_MORALE && p.id !== s.mainId) odds.wander = 2;
    const kind = rng.weighted(odds);
    const hours = rng.int(3, 6);
    p.breakdown = { kind, until: s.tick + hours * TICKS_PER_HOUR };
    p.lowMoraleHours = 0;
    p.task = null;
    switch (kind) {
      case "sulk":
        notify(s, `${p.name} has had enough and is sulking.`, true);
        return;
      case "binge":
        notify(s, `${p.name} is stress-eating the town's food.`, true);
        binge(s, p);
        return;
      case "brawl": {
        const hurt = (q) => q.hp = Math.max(1, q.hp - rng.int(6, 14));
        hurt(p);
        hurt(rival);
        s.relations[p.id < rival.id ? `${p.id}-${rival.id}` : `${rival.id}-${p.id}`] = -60;
        relationsChanged(s);
        p.breakdown.target = rival.id;
        notify(s, `${p.name} started a fight with ${rival.name}!`, true);
        return;
      }
      case "wander":
        notify(s, `${p.name} can't take it any more and is walking out of town.`, true);
        return;
    }
  }
  function binge(s, p) {
    let eaten = 0;
    for (const st of storages(s)) {
      for (const m of Object.keys(FOOD_VALUE)) {
        while (eaten < 2 && (st.store[m] ?? 0) > 0) {
          addStock(st.store, m, -1);
          eaten++;
        }
      }
    }
    p.needs.food = 1;
  }
  var DESPAIR_MORALE = 8;
  var DESPAIR_HOURS = 24;
  function checkDespair(s) {
    if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver) return;
    const here = s.people.filter((p) => p.away === null);
    const avg = here.length ? here.reduce((n, p) => n + p.morale, 0) / here.length : 100;
    s.despairHours = avg <= DESPAIR_MORALE ? (s.despairHours ?? 0) + 1 : Math.max(0, (s.despairHours ?? 0) - 2);
    if (s.despairHours === DESPAIR_HOURS / 2) notify(s, "The town is in despair. If spirits don't lift soon, everyone will abandon it.", true);
    if (s.despairHours >= DESPAIR_HOURS) {
      s.gameOver = { tick: s.tick, text: "Hope ran out. One by one, the townsfolk packed up and left, and the town fell silent." };
      notify(s, s.gameOver.text, true);
    }
  }
  var leaveX = (p) => p.x < WORLD_WIDTH / 2 ? 0 : WORLD_WIDTH;
  function checkLeavers(s) {
    for (const p of s.people) {
      if (p.breakdown?.kind !== "wander" || Math.abs(p.x - leaveX(p)) > 1) continue;
      s.people = s.people.filter((q) => q !== p);
      if (p.partner != null) {
        const partner = s.people.find((q) => q.id === p.partner);
        if (partner) partner.partner = null;
      }
      notify(s, `${p.name} left town for good.`, true);
      return;
    }
  }

  // src/shared/sim/trade.ts
  var market = (s) => s.buildings.find((b) => b.def === "market" && b.status === "done");
  var stalls = (s) => s.buildings.reduce((n, b) => n + (b.status === "done" ? BUILDING_BY_ID[b.def]?.stalls ?? 0 : 0), 0);
  var horsesOwned = (s) => s.horses.length + s.expeditions.reduce((n, e) => n + (e.horses?.length ?? 0), 0);
  function updateTrade(s, rng) {
    if (s.tick % TICKS_PER_HOUR === 0) for (const h of s.horses) h.hp = Math.min(HORSE_HP, h.hp + HORSE_HEAL);
    const c = s.caravan;
    if (c) {
      if (s.tick >= c.leavesTick || !market(s)) {
        s.caravan = null;
        notify(s, "The trade caravan has moved on.");
        scheduleCaravan(s, rng);
      }
      return;
    }
    const m = market(s);
    if (!m) return;
    if (s.nextCaravanTick === 0) scheduleCaravan(s, rng);
    if (s.tick < s.nextCaravanTick) return;
    const stay = CARAVAN_STAY_HOURS * ERA_MULTIPLIER[s.era];
    s.caravan = { x: buildingCentreX(m), leavesTick: s.tick + Math.round(stay * TICKS_PER_HOUR), offers: makeOffers(s, rng) };
    notify(s, `A trade caravan has arrived at the market. It stays ${Math.round(stay)} hours: see the Trade tab.`, true);
  }
  function scheduleCaravan(s, rng) {
    s.nextCaravanTick = s.tick + Math.round(rng.int(CARAVAN_EVERY[0], CARAVAN_EVERY[1]) * ERA_MULTIPLIER[s.era] * TICKS_PER_HOUR / (biomeOf(s).caravans ?? 1));
  }
  function makeOffers(s, rng) {
    const stock = totalStock(s);
    const haggle = operatorSkill(s, "market") * MERCHANT_PER_LEVEL;
    const markup = Math.max(1, SELL_MARKUP - haggle);
    const rate = Math.min(0.95, BUY_RATE + haggle);
    const plenty = MATERIALS.filter((m) => m !== "totem" && (stock[m] ?? 0) > 0).sort((a, b) => (stock[b] ?? 0) * WORTH[b] - (stock[a] ?? 0) * WORTH[a]);
    const payWith = (worth) => {
      const m = plenty[rng.int(0, Math.min(2, Math.max(0, plenty.length - 1)))] ?? "wood";
      return { [m]: Math.max(1, Math.ceil(worth / WORTH[m])) };
    };
    const offers = [];
    const all = caravanGoods(s.era);
    const scale = OFFER_SCALE[s.era] ?? 1;
    const goods = [...all];
    for (let i = 0; i < 3; i++) {
      const g = goods.splice(rng.int(0, goods.length - 1), 1)[0];
      const worth = rng.int(OFFER_WORTH[0], OFFER_WORTH[1]) * scale;
      const n = Math.max(1, Math.round(worth / WORTH[g]));
      offers.push({ id: s.nextId++, gives: { [g]: n }, horse: false, wants: payWith(n * WORTH[g] * markup), done: false });
    }
    if (stalls(s) > 0) offers.push({ id: s.nextId++, gives: {}, horse: true, wants: payWith(HORSE_WORTH * markup), done: false });
    for (const m of plenty.slice(0, 2)) {
      const n = Math.max(1, Math.round(rng.int(OFFER_WORTH[0], OFFER_WORTH[1]) * scale / WORTH[m]));
      const back = all.filter((g) => g !== m)[rng.int(0, all.length - 2)];
      offers.push({ id: s.nextId++, gives: { [back]: Math.max(1, Math.floor(n * WORTH[m] * rate / WORTH[back])) }, horse: false, wants: { [m]: n }, done: false });
    }
    return offers;
  }
  function canTrade(s, offerId) {
    const o = s.caravan?.offers.find((q) => q.id === offerId);
    if (!o) return { ok: false, reason: "No such offer" };
    if (o.done) return { ok: false, reason: "Already traded" };
    const stock = totalStock(s);
    const short = Object.entries(o.wants).filter(([m, n]) => (stock[m] ?? 0) < n);
    if (short.length) return { ok: false, reason: `Not enough ${short.map(([m]) => MATERIAL_NAMES[m].toLowerCase()).join(", ")}` };
    if (o.horse && horsesOwned(s) >= stalls(s)) return { ok: false, reason: "No free stall in the stable" };
    const room = totalCapacity(s) - poolSize(stock) + poolSize(o.wants);
    if (poolSize(o.gives) > 0 && poolSize(o.gives) > room) return { ok: false, reason: "No room in storage for it" };
    return { ok: true };
  }
  function trade(s, offerId, rng) {
    const check = canTrade(s, offerId);
    if (!check.ok) return check;
    const c = s.caravan;
    const o = c.offers.find((q) => q.id === offerId);
    for (const [m, n] of Object.entries(o.wants)) take(s, m, n);
    if (poolSize(o.gives)) depositNear(s, c.x, o.gives);
    if (o.horse) {
      const h = newHorse(s, rng);
      s.horses.push(h);
      notify(s, `Bought a horse, ${h.name}.`, true);
    } else notify(s, `Traded with the caravan: ${list(o.wants)} for ${list(o.gives)}.`);
    o.done = true;
    return { ok: true };
  }
  function take(s, m, n) {
    let left = n;
    for (const st of storages(s)) {
      const k = Math.min(left, st.store[m] ?? 0);
      if (k > 0) {
        addStock(st.store, m, -k);
        left -= k;
      }
    }
  }
  function newHorse(s, rng) {
    const taken = [...s.horses, ...s.expeditions.flatMap((e) => e.horses ?? [])].map((h) => h.name);
    const free = HORSE_NAMES.filter((n) => !taken.includes(n));
    return { id: s.nextId++, name: rng.pick(free.length ? free : HORSE_NAMES), hp: HORSE_HP, coat: rng.int(0, 7) };
  }
  var list = (st) => Object.entries(st).map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`).join(", ");

  // src/shared/sim/advice.ts
  var foodDays = (s) => {
    const st = totalStock(s);
    const food = Object.entries(FOOD_VALUE).reduce((n, [m, v]) => n + (st[m] ?? 0) * (v ?? 0), 0);
    return food / Math.max(1, s.people.length);
  };
  var TIPS = [
    {
      id: "mark",
      when: (s) => s.tick >= TICKS_PER_HOUR / 2 && !s.tiles.some((t) => t.designated) && s.tiles.some((t) => t.terrain !== "clear"),
      text: "Camp advice: click trees, rocks and marsh on the strip to mark them for gathering. Your people fetch wood, stone, fiber and berries from what you mark."
    },
    {
      id: "research",
      when: (s) => s.tick >= TICKS_PER_HOUR && s.research.done.length === 0 && s.research.queue.length === 0,
      text: "Camp advice: open Research and pick a topic. Basic Shelter gives beds (and wanderers only join while a bed is free)."
    },
    {
      id: "food",
      when: (s) => s.tick >= TICKS_PER_HOUR && foodDays(s) < 1.5 && !s.buildings.some((b) => b.crop),
      text: "Camp advice: food is running low. Forest holds berries; Early Agriculture unlocks garden plots, and Spear Hunting brings in meat. The starving waste away."
    },
    {
      id: "wanderer",
      when: (s) => !!s.visitor && s.people.length <= 3,
      text: "Camp advice: a wanderer asks to join (see Townsfolk). A small camp needs every pair of hands: more people gather, farm and fight, and the work gets done faster."
    },
    {
      id: "winter",
      when: (s) => calendar(s.tick).season === "autumn" && s.buildings.some((b) => b.crop),
      text: "Camp advice: autumn is here, and winter follows in three days. Nothing grows in winter, so put food by now (dried meat and bread keep; so does grain)."
    },
    {
      id: "famine",
      when: (s) => s.buildings.some((b) => b.crop) && s.people.some((p) => p.needs.food <= 0.02 && p.away === null && p.monster !== "undead"),
      text: "Camp advice: people are starving. Plant about one field for every two people, and keep a store of food put by: nothing grows in winter, and droughts, ash winters and the Deep Freeze stop the fields for days (a drying rack makes meat keep)."
    },
    {
      id: "wounded",
      when: (s) => s.people.some((p) => p.downed?.bleedUntil != null),
      text: "Camp advice: someone downed bleeds out in about 2 hours. Anyone free goes to tend them (Medicine skill helps), a poultice (Herbalism) always works, a Healer's Hut slows the bleeding, and an infirmary later saves everyone after a raid."
    },
    {
      id: "grave",
      when: (s) => (s.graves?.length ?? 0) > 0,
      text: "Camp advice: a Graveyard lays the dead to rest. Mourning weighs less and grief passes sooner."
    }
  ];
  function updateAdvice(s) {
    if (s.tick % 60 !== 0) return;
    const given = s.advice ??= [];
    for (const t of TIPS) {
      if (given.includes(t.id) || !t.when(s)) continue;
      given.push(t.id);
      notify(s, t.text, true);
    }
  }

  // src/shared/sim/era.ts
  var CAPSTONES = { neolithic: "elder_lodge", medieval: "town_hall", industrial: "power_station", modern: "mission_control" };
  var LAUNCH_COUNTDOWN_HOURS = 12;
  function onBuilt(s, b) {
    if (b.def === "graveyard" && s.graves?.length) {
      layOutGraves(s);
      notify(s, "The dead are moved to the new graveyard and laid properly to rest.");
    }
    if (b.def === "launch_site" && s.launchTick == null) {
      s.launchTick = s.tick + LAUNCH_COUNTDOWN_HOURS * TICKS_PER_HOUR;
      notify(s, `The ship stands ready on the Launch Site. Lift-off in ${LAUNCH_COUNTDOWN_HOURS} hours: keep the town safe until then!`, true);
      return;
    }
    if (CAPSTONES[s.era] !== b.def) return;
    const next = nextEra(s.era);
    if (!next) return;
    s.era = next;
    s.eraReady = false;
    notify(s, `A new age begins: the ${ERA_NAMES[next]} era. New research is open, and work takes longer but builds greater things.`, true);
  }
  function updateLaunch(s) {
    if (s.launchTick == null) return;
    const site = s.buildings.some((b) => b.def === "launch_site" && b.status === "done");
    if (!site) {
      s.launchTick = null;
      notify(s, "The Launch Site is gone, and the launch with it.", true);
      return;
    }
    if (s.tick < s.launchTick) return;
    const days = Math.floor(s.tick / TICKS_PER_DAY) + 1;
    const people = s.people.length;
    s.gameOver = {
      tick: s.tick,
      won: true,
      text: `Engines roar, and the ship climbs into the sky. After ${days} days, ${people === 1 ? "the last of the town" : `all ${people} townsfolk`} leave for the stars. From a campfire to the stars: you won!`
    };
    notify(s, s.gameOver.text, true);
  }

  // src/shared/sim/people.ts
  var WALK_SPEED = 48;
  var STEP = WALK_SPEED / TICK_HZ;
  var GATHER_XP = 10;
  var BUILD_XP_PER_SEC = 2;
  var CRAFT_XP_PER_SEC = 2;
  var RESEARCH_XP_PER_SEC = 2;
  var WANDER_TILES = 3;
  var STACKING = 0.7;
  var MAX_PER_TILE = 2;
  var RECHECK_TICKS = 5 * TICK_HZ;
  var CAVALRY_DAMAGE = 4;
  var LOOK_TICKS = TICK_HZ;
  var EAT_TICKS = 3 * TICK_HZ;
  var REPAIR_HP_PER_SEC = 8;
  var PRECIOUS = ["totem"];
  var SCROUNGE_SECONDS = 4;
  var TEND_SECONDS = 15;
  var TEND_XP_PER_SEC = 3;
  var tendChance = (medicine) => Math.min(0.9, 0.2 + 0.08 * medicine);
  var TEND_SETBACK_TICKS = TICKS_PER_HOUR / 4;
  var TEND_SKILL_PX = 40;
  var DEFEND_INTERVAL = Math.round(1.2 * TICK_HZ);
  function newTickContext() {
    return { workers: /* @__PURE__ */ new Map() };
  }
  function stackFactor(ctx, key2) {
    const n = ctx.workers.get(key2) ?? 0;
    ctx.workers.set(key2, n + 1);
    return STACKING ** n;
  }
  function updatePerson(s, p, rng, ctx) {
    drainNeeds(p, p.task?.type === "sleep" && p.activity === "sleep");
    if (p.task && !stillValid(s, p, p.task)) p.task = null;
    const loafing = !p.task || p.task.type === "wander" || p.task.type === "idle";
    if (loafing && (!p.task || (s.tick + p.id) % LOOK_TICKS === 0) || (s.tick + p.id) % RECHECK_TICKS === 0) {
      const next = chooseTask(s, p);
      if (next && (loafing || rank(next, p) < rank(p.task, p))) p.task = next;
    }
    if (!p.task) p.task = { type: "wander", targetX: campX(s) + rng.range(-WANDER_TILES, WANDER_TILES) * TILE };
    const task = p.task;
    switch (task.type) {
      case "wander":
        if (walkTo(p, task.targetX)) p.task = { type: "idle", untilTick: s.tick + rng.int(4, 12) * TICK_HZ };
        break;
      case "idle":
        p.activity = "idle";
        if (s.tick >= task.untilTick) p.task = null;
        break;
      case "gather":
        if (walkTo(p, tileCentreX(task.tile))) {
          if (task.scrounge) scrounge(s, p, task);
          else workGather(s, p, task, rng);
        }
        break;
      case "store": {
        const st = byId(s, task.building);
        if (!walkTo(p, buildingCentreX(st))) break;
        for (const m of MATERIALS) {
          const n = Math.min(p.carrying[m] ?? 0, storageFree(s, st));
          if (n > 0) {
            addStock(st.store, m, n);
            addStock(p.carrying, m, -n);
          }
        }
        p.task = null;
        break;
      }
      case "fetch": {
        const from = byId(s, task.from);
        if (!walkTo(p, buildingCentreX(from))) break;
        for (const m of MATERIALS) {
          const n = Math.min(task.amounts[m] ?? 0, from.store[m] ?? 0, carryCapacity(s, p) - poolSize(p.carrying));
          if (n > 0) {
            addStock(from.store, m, -n);
            addStock(p.carrying, m, n);
          }
        }
        p.task = { type: "deliver", building: task.building };
        break;
      }
      case "deliver": {
        const site = byId(s, task.building);
        if (!walkTo(p, buildingCentreX(site))) break;
        const need = stillNeeded(site);
        for (const m of MATERIALS) {
          const n = Math.min(p.carrying[m] ?? 0, need[m] ?? 0);
          if (n > 0) {
            addStock(site.delivered, m, n);
            addStock(p.carrying, m, -n);
          }
        }
        p.task = null;
        break;
      }
      case "build": {
        const site = byId(s, task.building);
        if (!walkTo(p, buildingCentreX(site))) break;
        if (p.activity !== "build") pickTool(s, p, "construct");
        p.activity = "build";
        const speed = skillSpeed(p.skills.construction.level) * toolSpeed(p, "construct") * workFactor(s, p) * stackFactor(ctx, `b${site.id}`);
        site.progress += speed / (defOf(site).buildSeconds * BUILD_MULTIPLIER[s.era] * TICK_HZ);
        gainSkill(p, "construction", BUILD_XP_PER_SEC / TICK_HZ);
        if (site.progress >= 1) {
          site.progress = 1;
          site.status = "done";
          site.delivered = {};
          if (defOf(site).hp) site.hp = defOf(site).hp;
          p.task = null;
          notify(s, `Finished building: ${defOf(site).name}`, true);
          onBuilt(s, site);
        }
        break;
      }
      case "repair": {
        const wall = byId(s, task.building);
        if (!walkTo(p, buildingCentreX(wall))) break;
        if (p.activity !== "build") pickTool(s, p, "construct");
        p.activity = "build";
        const max = defOf(wall).hp ?? 0;
        wall.hp = Math.min(max, (wall.hp ?? 0) + REPAIR_HP_PER_SEC * skillSpeed(p.skills.construction.level) * toolSpeed(p, "construct") * workFactor(s, p) / TICK_HZ);
        gainSkill(p, "construction", BUILD_XP_PER_SEC / TICK_HZ);
        if (wall.hp >= max) p.task = null;
        break;
      }
      case "research":
        workResearch(s, p, ctx);
        break;
      case "craft":
        doCraft(s, p, task);
        break;
      case "farm": {
        const field = byId(s, task.building);
        if (!walkTo(p, buildingCentreX(field))) break;
        p.activity = "forage";
        if (workField(s, p, field)) p.task = null;
        break;
      }
      case "extinguish": {
        const b = byId(s, task.building);
        if (!b) {
          p.task = null;
          break;
        }
        if (!walkTo(p, buildingCentreX(b))) break;
        p.activity = "build";
        if (fightFire(s, p, b)) p.task = null;
        break;
      }
      case "mine": {
        const mine = byId(s, task.building);
        if (!walkTo(p, buildingCentreX(mine))) break;
        if (p.activity !== "mine") pickTool(s, p, "mine");
        p.activity = "mine";
        if (workMine(s, p, mine, task)) p.task = null;
        break;
      }
      case "eat":
        doEat(s, p, task);
        break;
      case "sleep":
        doSleep(s, p, task);
        break;
      case "defend":
        doDefend(s, p, task, rng);
        break;
      case "patrol":
        if (walkTo(p, task.targetX)) p.task = null;
        break;
      case "tend":
        doTend(s, p, task, rng);
        break;
      case "shelter": {
        const bed = p.bed === null ? void 0 : byId(s, p.bed);
        if (!walkTo(p, bed ? buildingCentreX(bed) : campX(s))) break;
        p.activity = bed ? "sleep" : "idle";
        break;
      }
    }
  }
  function patientFor(s, p) {
    if (p.downed || p.bornTick != null || p.away !== null) return void 0;
    const bleeding = s.people.filter((q) => q !== p && q.away === null && q.downed?.bleedUntil != null);
    if (!bleeding.length) return void 0;
    return bleeding.filter((q) => !closerTender(s, p, q)).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  }
  var tendCost = (p, patient) => Math.abs(p.x - patient.x) - p.skills.medicine.level * TEND_SKILL_PX;
  function closerTender(s, p, patient) {
    const mine = tendCost(p, patient);
    return s.people.some((q) => {
      if (q === p || q.task?.type !== "tend" || q.task.patient !== patient.id) return false;
      const theirs = tendCost(q, patient);
      return theirs < mine || theirs === mine && q.id < p.id;
    });
  }
  function doTend(s, p, task, rng) {
    const q = s.people.find((x) => x.id === task.patient);
    if (!q?.downed || q.downed.bleedUntil === null) {
      p.task = null;
      return;
    }
    if (!walkTo(p, q.x)) return;
    p.dir = q.x >= p.x ? 1 : -1;
    p.activity = "forage";
    task.progress += skillSpeed(p.skills.medicine.level) * workFactor(s, p) / (TEND_SECONDS * TICK_HZ);
    gainSkill(p, "medicine", TEND_XP_PER_SEC / TICK_HZ);
    if (task.progress < 1) return;
    task.progress = 0;
    const dressing = (s.items.bandage ?? 0) > 0 ? "bandage" : (s.items.poultice ?? 0) > 0 ? "poultice" : null;
    if (dressing) s.items[dressing] -= 1;
    if (dressing || rng.chance(tendChance(p.skills.medicine.level))) {
      stabilize(q);
      notify(s, `${p.name} stopped ${q.name}'s bleeding${dressing ? ` with a ${dressing}` : ""}.`);
      p.task = null;
      return;
    }
    q.downed.bleedUntil -= TEND_SETBACK_TICKS;
    notify(s, `${p.name} couldn't stop ${q.name}'s bleeding, and the wound tore wider. They keep trying.`);
  }
  var alarmRaised = (s) => {
    const r = s.raid;
    if (!r || r.phase !== "active" && r.prompt !== null) return false;
    return r.phase !== "active" || r.raiders.some((rd) => !rd.ally && !rd.down && !rd.gone && (!rd.fleeing || !!rd.captive || poolSize(rd.carrying) > 0));
  };
  function onShift(s, p) {
    if (p.priorities.defend !== 1 || p.bornTick != null) return false;
    if (!s.buildings.some((b) => b.def === "barracks" && b.status === "done")) return false;
    const h = calendar(s.tick).hour;
    const day = h >= 6 && h < 18;
    return p.id % 2 === 0 === day;
  }
  function patrolEnd(s, p) {
    const xs = s.buildings.filter((b) => b.status === "done").map((b) => buildingCentreX(b));
    const lo = Math.min(...xs) - TILE;
    const hi = Math.max(...xs) + TILE;
    return Math.abs(p.x - lo) > Math.abs(p.x - hi) ? lo : hi;
  }
  function cavalry(s) {
    const out = /* @__PURE__ */ new Map();
    if (!s.raid) return out;
    const horses = s.horses.filter((h) => h.hp >= HORSE_HP / 2);
    const riders = s.people.filter((p) => p.away === null && !p.downed && p.task?.type === "defend" && p.priorities.defend === 1).sort((a, b) => a.id - b.id);
    riders.slice(0, horses.length).forEach((p, i) => out.set(p.id, horses[i].coat));
    return out;
  }
  function doDefend(s, p, task, rng) {
    const rd = nearestRaider(s, p.x);
    const mounted = cavalry(s).has(p.id);
    if (!rd) {
      if (walkTo(p, rallyX(s)) || mounted && walkTo(p, rallyX(s))) p.activity = "idle";
      return;
    }
    const reach = defenderReach(p);
    const gap2 = rd.x - p.x;
    if (Math.abs(gap2) > reach) {
      if (!walkTo(p, rd.x - Math.sign(gap2) * (reach - 4)) && mounted) walkTo(p, rd.x - Math.sign(gap2) * (reach - 4));
      return;
    }
    p.dir = gap2 >= 0 ? 1 : -1;
    p.activity = "fight";
    if (--task.cooldown > 0) return;
    task.cooldown = DEFEND_INTERVAL;
    defenderAttack(s, p, rd, rng, mounted ? CAVALRY_DAMAGE : 0);
  }
  function doCraft(s, p, task) {
    const o = s.crafting.find((q) => q.id === task.order);
    const def = ITEM_BY_ID[o.item];
    const station = stationFor(s, def);
    switch (task.phase) {
      case "fetch": {
        const from = task.from === null ? void 0 : byId(s, task.from);
        if (!from) {
          p.task = null;
          return;
        }
        if (!walkTo(p, buildingCentreX(from))) return;
        const need = craftNeeded(o);
        for (const m of MATERIALS) {
          const n = Math.min((need[m] ?? 0) - (p.carrying[m] ?? 0), from.store[m] ?? 0, carryCapacity(s, p) - poolSize(p.carrying));
          if (n > 0) {
            addStock(from.store, m, -n);
            addStock(p.carrying, m, n);
          }
        }
        task.phase = "deliver";
        return;
      }
      case "deliver": {
        if (!walkTo(p, buildingCentreX(station))) return;
        const need = craftNeeded(o);
        for (const m of MATERIALS) {
          const n = Math.min(p.carrying[m] ?? 0, need[m] ?? 0);
          if (n > 0) {
            addStock(o.delivered, m, n);
            addStock(p.carrying, m, -n);
          }
        }
        if (poolSize(craftNeeded(o)) > 0) p.task = null;
        else task.phase = "work";
        return;
      }
      case "work": {
        if (!walkTo(p, buildingCentreX(station))) return;
        if (!takeItemInputs(s, o)) {
          p.task = null;
          return;
        }
        p.activity = "build";
        const built2 = (id) => s.buildings.some((b) => b.def === id && b.status === "done");
        const factory = (built2("factory") ? 2 : 1) * (built2("fusion_reactor") ? 1.5 : 1);
        const speed = skillSpeed(p.skills.crafting.level) * workFactor(s, p) * factory * nearSource(s, station);
        o.progress += speed / (craftSeconds(def, s.era) * TICK_HZ);
        gainSkill(p, "crafting", CRAFT_XP_PER_SEC / TICK_HZ);
        if (o.progress >= 1) {
          finishPiece(s, o, p);
          p.task = null;
        }
        return;
      }
    }
  }
  function workResearch(s, p, ctx) {
    const station = researchStation(s);
    const at = station.buildingId !== null ? buildingCentreX(byId(s, station.buildingId)) : campX(s);
    if (!walkTo(p, at)) return;
    p.activity = "research";
    const r = s.research;
    const topic = TOPIC_BY_ID[r.queue[0]];
    const speed = skillSpeed(p.skills.research.level) * station.mult * modifiers(r).researchSpeed * workFactor(s, p) * stackFactor(ctx, "research");
    r.progress[topic.id] = (r.progress[topic.id] ?? 0) + speed / (topic.seconds * RESEARCH_MULTIPLIER[s.era] * TICK_HZ);
    gainSkill(p, "research", RESEARCH_XP_PER_SEC / TICK_HZ);
    if (r.progress[topic.id] < 1) return;
    delete r.progress[topic.id];
    r.queue.shift();
    r.done.push(topic.id);
    notify(s, `Research complete: ${topic.name}`, true);
    if (topic.id === "blood_rite") offerBloodRite(s);
    if (topic.id === "moon_rite") offerMoonRite(s);
    if (topic.effects.some((e) => e.type === "eraCapstone")) {
      s.eraReady = true;
      notify(
        s,
        s.era === "neolithic" ? "The elders have gathered. Build the Elder Lodge to begin a new era." : "The town is granted its charter. Build the Town Hall to begin a new era.",
        true
      );
    }
    p.task = null;
  }
  function nearSource(s, station) {
    const sources = NEAR_SOURCE[station.def];
    if (!sources) return 1;
    const near = s.buildings.some((b) => b.status === "done" && sources.includes(b.def) && Math.abs(b.tile - station.tile) <= ADJACENT_TILES);
    return near ? NEAR_SOURCE_BONUS : 1;
  }
  function workGather(s, p, task, rng) {
    const tile = s.tiles[task.tile];
    const def = TERRAIN[tile.terrain];
    if (p.activity !== def.anim) pickTool(s, p, def.anim);
    p.activity = def.anim;
    const speed = skillSpeed(p.skills.gathering.level) * modifiers(s.research).gather[def.anim] * toolSpeed(p, def.anim) * workFactor(s, p) * (def.anim === "forage" ? doomForage(s) * biomeOf(s).forage : 1);
    task.progress += speed / (def.secondsPerUnit * (def.anim === "forage" ? 1 : ERA_MULTIPLIER[s.era]) * TICK_HZ);
    while (task.progress >= 1 && p.task === task) {
      task.progress -= 1;
      gatherUnit(s, p, task.tile, rng);
      if (poolSize(p.carrying) >= carryCapacity(s, p)) p.task = null;
    }
  }
  function scrounge(s, p, task) {
    const tile = s.tiles[task.tile];
    p.activity = "forage";
    task.progress += skillSpeed(p.skills.gathering.level) * doomForage(s) * biomeOf(s).forage / (SCROUNGE_SECONDS * TICK_HZ);
    if (task.progress < 1) return;
    task.progress = 0;
    addStock(tile.pool, "berries", -1);
    addStock(p.carrying, "berries", 1);
    gainSkill(p, "gathering", GATHER_XP);
    if (poolSize(tile.pool) === 0) {
      tile.terrain = "clear";
      tile.designated = false;
      s.tileRev++;
    }
    if ((tile.pool.berries ?? 0) <= 0 || (p.carrying.berries ?? 0) >= 2) {
      const n = p.carrying.berries ?? 0;
      p.needs.food = Math.min(1, p.needs.food + n * FOOD_VALUE.berries);
      addStock(p.carrying, "berries", -n);
      p.task = null;
    }
  }
  function wildFood(s, p) {
    let best = null;
    s.tiles.forEach((t, i) => {
      if ((t.pool.berries ?? 0) > 0 && (best === null || Math.abs(tileCentreX(i) - p.x) < Math.abs(tileCentreX(best) - p.x))) best = i;
    });
    return best;
  }
  function gatherUnit(s, p, tileIndex, rng) {
    const tile = s.tiles[tileIndex];
    const entries = Object.entries(tile.pool).filter(([, n]) => n > 0);
    if (!entries.length) {
      tile.terrain = "clear";
      tile.designated = false;
      p.task = null;
      s.tileRev++;
      return;
    }
    let r = rng.next() * poolSize(tile.pool);
    let pick2 = entries[entries.length - 1][0];
    for (const [m, n] of entries) {
      if ((r -= n) < 0) {
        pick2 = m;
        break;
      }
    }
    addStock(tile.pool, pick2, -1);
    addStock(p.carrying, pick2, 1);
    gainSkill(p, "gathering", GATHER_XP);
    if (poolSize(tile.pool) === 0) {
      tile.terrain = "clear";
      tile.designated = false;
      p.task = null;
      p.activity = "idle";
      s.tileRev++;
    }
  }
  function doEat(s, p, task) {
    const st = byId(s, task.building);
    if (!walkTo(p, buildingCentreX(st))) return;
    if (task.until === null) {
      const food = foodIn(st);
      if (!food) {
        p.task = null;
        return;
      }
      addStock(st.store, food, -1);
      p.needs.food = Math.min(1, p.needs.food + FOOD_VALUE[food]);
      task.until = s.tick + EAT_TICKS;
    }
    p.activity = "eat";
    if (s.tick >= task.until) p.task = null;
  }
  function doSleep(s, p, task) {
    const bed = task.building === null ? void 0 : byId(s, task.building);
    if (!walkTo(p, bed ? buildingCentreX(bed) : campX(s) - TILE)) return;
    p.activity = "sleep";
    const bedroll = !bed && hasBedroll(s, p);
    p.needs.rest = Math.min(1, p.needs.rest + SLEEP_PER_HOUR * (bed ? 1 : bedroll ? BEDROLL_SLEEP : GROUND_SLEEP) / TICKS_PER_HOUR);
    if (wantsToWake(s, p)) {
      p.lastSlept = bed ? "bed" : bedroll ? "bedroll" : "ground";
      p.task = null;
      p.activity = "idle";
    }
  }
  var FOODS = Object.keys(FOOD_VALUE);
  var foodIn = (b) => FOODS.find((m) => (b.store[m] ?? 0) > 0);
  function rank(t, p) {
    switch (t.type) {
      case "defend":
      case "shelter":
        return -3;
      case "tend":
        return -2.7;
      case "extinguish":
        return -2.5;
      case "eat":
      case "sleep":
        return -2;
      case "gather":
        if (t.scrounge) return -2;
        return p ? p.priorities.gather * 10 + JOBS.indexOf("gather") : 0;
      case "store":
        return -1;
      case "wander":
      case "idle":
        return 99;
      default: {
        const job = jobOf(t);
        return p ? p.priorities[job] * 10 + JOBS.indexOf(job) : 0;
      }
    }
  }
  function jobOf(t) {
    switch (t.type) {
      case "build":
      case "repair":
      case "extinguish":
        return "construct";
      case "defend":
      case "patrol":
        return "defend";
      case "research":
        return "research";
      case "gather":
      case "mine":
        return "gather";
      case "craft":
        return "craft";
      case "farm":
        return "farm";
      default:
        return "haul";
    }
  }
  function chooseTask(s, p) {
    p.blocked = false;
    if (p.downed) return { type: "sleep", building: p.bed };
    if (alarmRaised(s)) return p.priorities.defend !== 0 ? p.task?.type === "defend" ? p.task : { type: "defend", cooldown: 0 } : { type: "shelter" };
    const patient = patientFor(s, p);
    if (patient) return p.task?.type === "tend" && p.task.patient === patient.id ? p.task : { type: "tend", patient: patient.id, progress: 0 };
    const fire = fireToFight(s, p);
    if (fire) return p.task?.type === "extinguish" && p.task.building === fire.id ? p.task : { type: "extinguish", building: fire.id };
    if (p.breakdown?.kind === "wander") return { type: "wander", targetX: leaveX(p) };
    if (p.task?.type === "sleep" || wantsSleep(s, p)) return { type: "sleep", building: p.bed };
    if (p.needs.food < HUNGRY) {
      const st = nearestStorage(s, p.x, (b) => !!foodIn(b));
      if (st) return { type: "eat", building: st.id, until: null };
      if (p.monster !== "undead") {
        if (p.task?.type === "gather" && p.task.scrounge) return p.task;
        const wild = wildFood(s, p);
        if (wild !== null) return { type: "gather", tile: wild, progress: 0, scrounge: true };
      }
    }
    const t = p.task;
    const carryingForTask = t?.type === "gather" && poolSize(p.carrying) < carryCapacity(s, p) || t?.type === "fetch" || t?.type === "deliver" || t?.type === "craft" && t.phase !== "work";
    let handsFull = false;
    if (poolSize(p.carrying) > 0 && !carryingForTask) {
      const site = s.buildings.find((b) => b.status === "blueprint" && MATERIALS.some((m) => (p.carrying[m] ?? 0) > 0 && (unreserved(s, p, b)[m] ?? 0) > 0));
      if (site) return { type: "deliver", building: site.id };
      const st = nearestStorage(s, p.x, (b) => storageFree(s, b) > 0);
      if (st) return { type: "store", building: st.id };
      const keep = PRECIOUS.filter((m) => (p.carrying[m] ?? 0) > 0);
      if (s.buildings.some((b) => b.status === "blueprint" && poolSize(unreserved(s, p, b)) > 0) && poolSize(p.carrying) > keep.reduce((n, m) => n + p.carrying[m], 0)) {
        const kept = Object.fromEntries(keep.map((m) => [m, p.carrying[m]]));
        for (const m of keep) delete p.carrying[m];
        notify(s, `${p.name} dropped ${listCarried(p)}: no room in storage.`);
        p.carrying = kept;
        if (keep.length) {
          p.blocked = true;
          handsFull = true;
        }
      } else {
        p.blocked = true;
        handsFull = true;
      }
    }
    if (p.morale < SULK_MORALE || p.breakdown) return null;
    for (const level of [1, 2, 3]) {
      for (const job of JOBS) {
        if (p.priorities[job] !== level || handsFull && (job === "haul" || job === "gather" || job === "craft")) continue;
        const t2 = findJob(s, p, job);
        if (t2) return t2;
      }
    }
    return null;
  }
  function findJob(s, p, job) {
    switch (job) {
      case "haul":
        for (const b of s.buildings) {
          if (b.status !== "blueprint") continue;
          const need = unreserved(s, p, b);
          if (!poolSize(need)) continue;
          const from = nearestStorage(s, p.x, (st) => Object.keys(need).some((m) => (st.store[m] ?? 0) > 0));
          if (!from) continue;
          const amounts = {};
          let room = carryCapacity(s, p);
          for (const m of MATERIALS) {
            const n = Math.min(need[m] ?? 0, from.store[m] ?? 0, room);
            if (n > 0) {
              amounts[m] = n;
              room -= n;
            }
          }
          return { type: "fetch", building: b.id, from: from.id, amounts };
        }
        return null;
      case "construct": {
        const b = s.buildings.find((q) => q.status === "blueprint" && poolSize(stillNeeded(q)) === 0);
        if (b) return { type: "build", building: b.id };
        const hurt = s.raid ? void 0 : s.buildings.find((q) => q.status === "done" && q.hp !== void 0 && q.hp < (defOf(q).hp ?? 0));
        return hurt ? { type: "repair", building: hurt.id } : null;
      }
      case "defend":
        return onShift(s, p) ? { type: "patrol", targetX: patrolEnd(s, p) } : null;
      case "research":
        return s.research.queue.length ? { type: "research" } : null;
      case "gather": {
        const tile = bestGatherTile(s, p);
        if (tile !== null) return { type: "gather", tile, progress: 0 };
        const mine = mineToWork(s, p);
        return mine ? { type: "mine", building: mine.id, work: 0 } : null;
      }
      case "craft":
        return findCraft(s, p);
      case "farm": {
        const field = fieldToWork(s, p);
        return field ? { type: "farm", building: field.id } : null;
      }
    }
  }
  function findCraft(s, p) {
    for (const o of s.crafting) {
      if (s.people.some((q) => q !== p && q.task?.type === "craft" && q.task.order === o.id)) continue;
      if (!stationFor(s, ITEM_BY_ID[o.item]) || missingItems(s, o).length) continue;
      const need = craftNeeded(o);
      if (!poolSize(need)) return { type: "craft", order: o.id, phase: "work", from: null };
      if (MATERIALS.some((m) => (need[m] ?? 0) > 0 && (p.carrying[m] ?? 0) > 0)) return { type: "craft", order: o.id, phase: "deliver", from: null };
      const from = nearestStorage(s, p.x, (st) => MATERIALS.some((m) => (need[m] ?? 0) > 0 && (st.store[m] ?? 0) > 0));
      if (from) return { type: "craft", order: o.id, phase: "fetch", from: from.id };
    }
    return null;
  }
  function unreserved(s, p, b) {
    const need = stillNeeded(b);
    for (const o of s.people) {
      if (o === p || !o.task || !("building" in o.task) || o.task.building !== b.id) continue;
      const coming = o.task.type === "fetch" ? o.task.amounts : o.task.type === "deliver" ? o.carrying : {};
      for (const m of MATERIALS) if (coming[m]) addStock(need, m, -Math.min(need[m] ?? 0, coming[m]));
    }
    return need;
  }
  function bestGatherTile(s, p) {
    const workers = /* @__PURE__ */ new Map();
    for (const o of s.people) if (o !== p && o.task?.type === "gather") workers.set(o.task.tile, (workers.get(o.task.tile) ?? 0) + 1);
    let best = null;
    let bestCost = Infinity;
    s.tiles.forEach((t, i) => {
      if (!t.designated) return;
      const w = workers.get(i) ?? 0;
      if (w >= MAX_PER_TILE) return;
      const cost = Math.abs(tileCentreX(i) - p.x) + w * 20 * TILE;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    });
    return best;
  }
  function stillValid(s, p, t) {
    const site = "building" in t && t.building !== null ? byId(s, t.building) : void 0;
    switch (t.type) {
      case "gather": {
        const tile = s.tiles[t.tile];
        if (t.scrounge) return (tile.pool.berries ?? 0) > 0;
        return tile.designated && tile.terrain !== "clear" && p.priorities.gather !== 0;
      }
      case "store":
        return !!site && storageFree(s, site) > 0;
      case "fetch":
        return site?.status === "blueprint" && !!byId(s, t.from) && p.priorities.haul !== 0;
      case "deliver":
        return site?.status === "blueprint";
      case "build":
        return site?.status === "blueprint" && poolSize(stillNeeded(site)) === 0 && p.priorities.construct !== 0;
      case "research":
        return s.research.queue.length > 0 && p.priorities.research !== 0;
      case "eat":
        return !!site;
      case "sleep":
        return t.building === null || !!site;
      case "defend":
        return alarmRaised(s) && p.priorities.defend !== 0 && !p.downed;
      case "shelter":
        return alarmRaised(s);
      case "patrol":
        return !alarmRaised(s) && onShift(s, p);
      case "repair":
        return !!site && !s.raid && (site.hp ?? 0) < (defOf(site).hp ?? 0) && p.priorities.construct !== 0;
      case "craft": {
        const o = s.crafting.find((q) => q.id === t.order);
        return !!o && !!stationFor(s, ITEM_BY_ID[o.item]) && p.priorities.craft !== 0;
      }
      case "farm":
        return !!site && isField(site) && cropOf(site).stage !== "growing" && p.priorities.farm !== 0;
      case "mine":
        return site?.status === "done" && p.priorities.gather !== 0;
      case "extinguish":
        return !!site && site.fire !== void 0 && !alarmRaised(s);
      case "tend": {
        const q = s.people.find((x) => x.id === t.patient);
        return !!q?.downed && q.downed.bleedUntil !== null && q.away === null && !alarmRaised(s) && !p.downed && !closerTender(s, p, q);
      }
      default:
        return true;
    }
  }
  function walkTo(p, x) {
    const d = x - p.x;
    if (Math.abs(d) <= STEP) {
      p.x = x;
      return true;
    }
    p.dir = d > 0 ? 1 : -1;
    p.x += p.dir * STEP;
    p.activity = "walk";
    return false;
  }
  var listCarried = (p) => MATERIALS.filter((m) => (p.carrying[m] ?? 0) > 0).map((m) => `${p.carrying[m]} ${MATERIAL_NAMES[m].toLowerCase()}`).join(", ");
  function byId(s, id) {
    return s.buildings.find((b) => b.id === id);
  }
  function nearestStorage(s, x, ok) {
    let best = null;
    for (const b of storages(s)) {
      if (!ok(b)) continue;
      if (!best || Math.abs(buildingCentreX(b) - x) < Math.abs(buildingCentreX(best) - x)) best = b;
    }
    return best;
  }

  // src/shared/sim/sim.ts
  var MAX_TICKS_PER_ADVANCE = 600;
  var Sim = class {
    constructor(state) {
      this.state = state;
      this.rng = new Rng(state.rngState);
      this.world = generateWorld(state.seed, state.biome);
    }
    state;
    rng;
    /** Initial terrain, regenerated from the seed (the background never changes yet). */
    world;
    pending = [];
    carryMs = 0;
    /** Queue a command for the start of the next tick. */
    command(c) {
      this.pending.push(c);
    }
    /** Advance by `ms` of real time. Runs whole ticks and carries the remainder. Returns ticks stepped. */
    advance(ms, maxTicks = MAX_TICKS_PER_ADVANCE) {
      this.carryMs += Math.max(0, ms);
      let n = 0;
      while (this.carryMs >= TICK_MS && n < maxTicks) {
        this.carryMs -= TICK_MS;
        this.step();
        n++;
      }
      if (n === maxTicks) this.carryMs = Math.min(this.carryMs, TICK_MS);
      return n;
    }
    /** One tick: apply queued commands, then (unless paused) run every system once, in a fixed order. */
    step() {
      const s = this.state;
      if (s.gameOver) {
        for (const c of this.pending) if (c.type === "dismissAway") this.apply(c);
        this.pending = [];
        return;
      }
      for (const c of this.pending) this.apply(c);
      this.pending = [];
      if (s.paused) return;
      s.tick++;
      const ctx = newTickContext();
      for (const p of s.people) {
        if (p.away !== null) continue;
        updatePerson(s, p, this.rng, ctx);
        heal(s, p);
        checkBleeding(s, p);
        if (s.gameOver) break;
      }
      updateExpeditions(s, this.rng);
      maybeStartRaid(s, this.rng);
      updateRaid(s, this.rng);
      updateFires(s, this.rng);
      expirePrompts(s, this.rng);
      if (s.gameOver) return;
      for (const p of s.people) driftMorale(s, p);
      assignBeds(s);
      hourlyItems(s, this.rng);
      growCrops(s);
      updateSocial(s, this.rng);
      checkDespair(s);
      assignOperators(s);
      updatePrisoners(s, this.rng);
      updateDoom(s, this.rng);
      updateLaunch(s);
      if (s.gameOver) return;
      updateMonsters(s, this.rng, (target) => startGuildRaid(s, target, this.rng));
      updateBreaks(s, this.rng);
      checkLeavers(s);
      updateTrade(s, this.rng);
      if (s.tick % TICKS_PER_HOUR === 0) {
        for (const p of s.people) if (p.autoPriorities) p.priorities = autoPriorities(p.skills);
      }
      drillGuards(s);
      updateAdvice(s);
      maybeArrive(s, this.rng);
      updateVisitor(s, walkTo);
      s.rngState = this.rng.state;
    }
    apply(c) {
      const s = this.state;
      switch (c.type) {
        case "placeBuilding":
          placeBlueprint(s, this.world.back, c.def, c.tile);
          break;
        case "demolish":
          demolish(s, c.building);
          break;
        case "turnPerson": {
          const r = turnPerson(s, c.person, c.kind);
          if (!r.ok) notify(s, `Can't: ${r.reason}.`);
          break;
        }
        case "turnTown":
          turnTown(s, c.kind);
          break;
        case "trainClass": {
          const r = train(s, c.person, c.cls);
          if (!r.ok) notify(s, `Can't train: ${r.reason}.`);
          break;
        }
        case "upgrade": {
          const r = upgrade(s, this.world.back, c.building);
          if (!r.ok) notify(s, `Can't upgrade: ${r.reason}.`);
          break;
        }
        case "discardStock":
          discardStock(s, c.building, c.material);
          break;
        case "queueCraft":
          queueCraft(s, c.item);
          break;
        case "reduceCraft":
          reduceCraft(s, c.order, c.all);
          break;
        case "equip": {
          const p = s.people.find((q) => q.id === c.person);
          if (p && p.away === null) equip(s, p, c.slot, c.item);
          break;
        }
        case "queueResearch":
          queueResearch(s.research, c.topic, s.cheats.unlockAll ? "space" : s.era);
          break;
        case "cancelResearch":
          cancelResearch(s.research, c.topic);
          break;
        case "researchNext":
          researchNext(s.research, c.topic);
          break;
        case "sendExpedition":
          sendExpedition(s, c.dest, c.members, c.roles, c.stance, c.horses, c.truck === true);
          break;
        case "trade":
          trade(s, c.offer, this.rng);
          break;
        case "cycleOperator":
          cycleOperator(s, c.building);
          break;
        case "releasePrisoner":
          releasePrisoner(s, c.prisoner);
          break;
        case "setOrder": {
          const p = s.people.find((q) => q.id === c.person);
          if (p?.monster) p.order = c.order;
          break;
        }
        case "answerPrompt":
          answerPrompt(s, c.prompt, c.option, this.rng);
          break;
        case "recallExpedition":
          recallExpedition(s, c.expedition);
          break;
        case "acceptVisitor":
          acceptVisitor(s);
          break;
        case "rejectVisitor":
          rejectVisitor(s);
          break;
        case "setPriority": {
          const p = s.people.find((q) => q.id === c.person);
          if (!p || p.bornTick != null) break;
          p.priorities[c.job] = c.priority;
          p.autoPriorities = false;
          break;
        }
        case "setAutoPriorities": {
          const p = s.people.find((q) => q.id === c.person);
          if (!p || p.bornTick != null) break;
          p.autoPriorities = c.on;
          if (c.on) p.priorities = autoPriorities(p.skills);
          break;
        }
        case "dismissAway":
          s.unreadAway = null;
          break;
        case "cheatUnlockAll":
          if (!s.ironman) s.cheats.unlockAll = c.on;
          break;
        case "setPaused":
          s.paused = c.paused;
          break;
        case "toggleGather": {
          const t = s.tiles[c.tile];
          if (!t || t.terrain === "clear") return;
          t.designated = !t.designated;
          s.tileRev++;
          break;
        }
      }
    }
  };

  // src/shared/sim/snapshot.ts
  function journalView(s) {
    return s.journal.map(entryView);
  }
  function entryView(e) {
    const c = calendar(e.tick);
    const season = c.season[0].toUpperCase() + c.season.slice(1);
    const when = `Day ${c.day} \xB7 ${season} \xB7 ${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
    return { id: e.id, when, day: c.day, text: e.text, key: !!e.key, lines: e.lines && [...e.lines] };
  }
  function snapshot(s) {
    const stock = totalStock(s);
    const v = s.visitor;
    return {
      seed: s.seed,
      tick: s.tick,
      paused: s.paused,
      calendar: calendar(s.tick),
      stock,
      storageUsed: poolSize(stock),
      storageCapacity: totalCapacity(s),
      tileRev: s.tileRev,
      tiles: s.tiles.map((t) => ({ terrain: t.terrain, pool: { ...t.pool }, designated: t.designated })),
      buildings: s.buildings.map((b) => ({ ...b, delivered: { ...b.delivered }, store: { ...b.store } })),
      people: ((riders) => s.people.map((p) => ({ ...personView(s, p), mounted: riders.get(p.id) ?? null })))(cavalry(s)),
      visitor: v ? {
        ...personView(s, v.person),
        doing: v.leavingTo !== null ? "Leaving" : "Waiting to be let in",
        hoursLeft: v.leavingTo !== null ? 0 : Math.max(0, (v.leavesTick - s.tick) / TICKS_PER_HOUR),
        leaving: v.leavingTo !== null
      } : null,
      housing: { beds: housingCapacity(s), people: s.people.length },
      expeditions: s.expeditions.map((e) => expeditionView(s, e)),
      destinations: DESTINATIONS.map((d) => ({
        id: d.id,
        unlocked: destinationUnlocked(s, d),
        scouted: s.scouted.includes(d.id),
        tripSeconds: (d.outSeconds * 2 + d.workSeconds) * ERA_MULTIPLIER[s.era],
        foodPerMember: foodNeeded(s, d, 1)
      })),
      prompts: s.prompts.map((p) => ({
        id: p.id,
        title: p.title,
        text: p.text,
        options: [...p.options],
        defaultOption: p.defaultOption,
        secondsLeft: Math.max(0, (p.expiresTick - s.tick) / TICK_HZ)
      })),
      raid: s.raid ? {
        name: RAID_KIND_BY_ID[s.raid.kind].name,
        phase: s.raid.phase,
        secondsToArrival: Math.max(0, (s.raid.arrivesTick - s.tick) / TICK_HZ),
        side: s.raid.side,
        alarm: alarmRaised(s),
        raiders: s.raid.raiders.map((r) => ({
          id: r.id,
          kind: r.kind,
          name: ENEMIES[r.kind].name,
          x: r.x,
          dir: r.dir,
          hp: r.hp,
          maxHp: r.maxHp,
          down: r.down,
          fleeing: r.fleeing,
          gone: r.gone,
          carrying: poolSize(r.carrying),
          captive: r.captive?.name ?? null,
          sinceAction: s.tick - r.lastAction,
          sinceHit: s.tick - r.lastHit,
          ally: !!r.ally,
          sinceArea: r.lastArea != null ? s.tick - r.lastArea : 999,
          sinceConjured: r.conjuredAt != null ? s.tick - r.conjuredAt : 999,
          hitFx: r.hitFx ?? null
        }))
      } : null,
      reputation: s.reputation,
      gameOver: s.gameOver ? { text: s.gameOver.text, won: !!s.gameOver.won } : null,
      biome: s.biome ?? "forest",
      turnable: turnable(s),
      bossBar: bossBar(s),
      bossShake: s.bossShake ?? -1,
      graves: s.graves ?? [],
      undeadHaven: undeadShare(s) >= 0.5,
      revived: s.revivedAt && s.tick - s.revivedAt.tick < 60 ? { id: s.revivedAt.id, since: s.tick - s.revivedAt.tick } : null,
      fx: (s.fx ?? []).filter((f) => s.tick - f.tick < FX_TICKS).map((f) => ({ id: f.id, kind: f.kind, since: s.tick - f.tick })),
      launchSite: launchSiteView(s),
      impacts: (s.impacts ?? []).filter((m) => s.tick - m.tick < 30).map((m) => ({ x: m.x, since: s.tick - m.tick })),
      moonNight: fullMoon(s) && (calendar(s.tick).hour >= 20 || calendar(s.tick).hour < 5),
      ironman: !!s.ironman,
      launchHours: s.launchTick != null ? Math.max(0, (s.launchTick - s.tick) / TICKS_PER_HOUR) : null,
      mainId: s.mainId,
      unlockAll: s.cheats.unlockAll,
      research: researchView(s),
      notices: [...s.notices],
      items: { ...s.items },
      crafting: s.crafting.map((o) => craftView(s, o)),
      craftSlots: craftSlots(s),
      buildSlots: buildSlots(s),
      era: s.era,
      horses: [
        ...s.horses.map((h) => ({ ...h, away: false })),
        ...s.expeditions.flatMap((e) => (e.horses ?? []).map((h) => ({ ...h, away: true })))
      ],
      stalls: stalls(s),
      caravan: s.caravan ? {
        x: s.caravan.x,
        hoursLeft: Math.max(0, (s.caravan.leavesTick - s.tick) / TICKS_PER_HOUR),
        offers: s.caravan.offers.map((o) => ({ ...o, gives: { ...o.gives }, wants: { ...o.wants }, ...canTrade(s, o.id) }))
      } : null,
      marketBuilt: s.buildings.some((b) => b.def === "market" && b.status === "done"),
      nextCaravanHours: s.nextCaravanTick > s.tick ? (s.nextCaravanTick - s.tick) / TICKS_PER_HOUR : null,
      doom: s.doom ? {
        name: DOOMS[s.doom.kind].name,
        phase: s.doom.phase,
        hoursLeft: Math.max(0, (s.doom.untilTick - s.tick) / TICKS_PER_HOUR),
        sick: s.people.filter((p) => p.sick).length,
        kind: s.doom.kind,
        cold: !!s.doom.cold
      } : null,
      prisoners: s.prisoners.map((p) => ({ id: p.id, name: p.name, was: ENEMIES[p.enemy]?.name ?? p.enemy, conviction: p.conviction, hungry: p.hungry })),
      journalHead: s.journal.at(-1)?.id ?? 0,
      away: awayView(s),
      eraReady: s.eraReady
    };
  }
  function awayView(s) {
    const e = s.unreadAway === null ? void 0 : s.journal.find((q) => q.id === s.unreadAway);
    return e ? entryView(e) : null;
  }
  function personView(s, p) {
    const m = mood(s, p);
    const bed = p.bed === null ? void 0 : s.buildings.find((b) => b.id === p.bed);
    return {
      id: p.id,
      name: p.name,
      typeName: RECRUIT_TYPES[p.type]?.name ?? p.type,
      look: p.look,
      x: p.x,
      dir: p.dir,
      activity: p.activity,
      mounted: null,
      cls: p.cls ?? null,
      doing: describe(s, p),
      carrying: { ...p.carrying },
      skills: Object.fromEntries(
        SKILLS.map((k) => [k, { level: p.skills[k].level, progress: p.skills[k].xp / xpToNext(p.skills[k].level), passion: p.passions.includes(k) }])
      ),
      traits: p.traits.map((t) => ({ name: TRAIT_BY_ID[t]?.name ?? t, description: TRAIT_BY_ID[t]?.description ?? "" })),
      needs: { ...p.needs },
      morale: p.morale,
      moodTarget: m.target,
      moodReasons: m.reasons,
      priorities: { ...p.priorities },
      autoPriorities: p.autoPriorities,
      bed: bed ? defOf(bed).name : null,
      indoors: p.activity === "sleep" && (p.task?.type === "sleep" && p.task.building !== null || p.task?.type === "shelter" && p.bed !== null),
      away: p.away === null ? null : DESTINATION_BY_ID[s.expeditions.find((e) => e.id === p.away)?.dest ?? ""]?.name ?? "expedition",
      hp: p.hp,
      maxHp: maxHp(p),
      downed: !p.downed ? null : p.downed.bleedUntil === null ? "recovering" : "bleeding",
      bleedMinutes: p.downed?.bleedUntil != null ? Math.max(0, Math.ceil((p.downed.bleedUntil - s.tick) / TICKS_PER_HOUR * 60)) : null,
      gear: { ...p.gear },
      bedroll: hasBedroll(s, p),
      carryCapacity: carryCapacity(s, p),
      partner: p.partner == null ? null : s.people.find((q) => q.id === p.partner)?.name ?? null,
      married: !!p.married,
      friends: friendsOf(s, p).filter((f) => f.id !== p.partner).map((f) => f.name),
      rivals: rivalsOf(s, p).map((f) => f.name),
      growsUpIn: p.bornTick != null ? Math.max(0, CHILD_HOURS - (s.tick - p.bornTick) / TICKS_PER_HOUR) : null,
      breakdown: p.breakdown ? BREAK_TEXT[p.breakdown.kind] : null,
      monster: p.monster ?? null,
      order: p.monster ? p.order ?? "hide" : null,
      sick: !!p.sick
    };
  }
  var BREAK_TEXT = { sulk: "Sulking in a corner", binge: "Stress-eating everything in sight", brawl: "Picking a fight", wander: "Wandering off to be alone" };
  function craftView(s, o) {
    const def = ITEM_BY_ID[o.item];
    const crafter = s.people.find((p) => p.task?.type === "craft" && p.task.order === o.id);
    const needed = craftNeeded(o);
    let waiting = null;
    if (!crafter) {
      const missing = missingItems(s, o);
      const stock = totalStock(s);
      const short = Object.entries(needed).filter(([m, n]) => (stock[m] ?? 0) < n).map(([m]) => MATERIAL_NAMES[m].toLowerCase());
      if (!stationFor(s, def)) waiting = `Needs a ${stationName(def)}`;
      else if (missing.length) waiting = `Needs ${missing.join(", ")}`;
      else if (short.length) waiting = `Short of ${short.join(", ")}`;
      else if (!s.people.some((p) => p.priorities.craft !== 0 && p.away === null)) waiting = "Nobody has the Craft job";
      else waiting = "Waiting for a crafter";
    }
    return { id: o.id, item: o.item, count: o.count, progress: o.progress, needed, waiting, crafter: crafter?.name ?? null };
  }
  function expeditionView(s, e) {
    const d = DESTINATION_BY_ID[e.dest];
    const len = e.phase === "out" ? e.outTicks : e.phase === "work" ? e.workTicks : e.backTicks;
    const left = e.phase === "out" ? e.outTicks - e.elapsed + e.workTicks + e.outTicks : e.phase === "work" ? e.workTicks - e.elapsed + e.outTicks : e.backTicks - e.elapsed;
    return {
      id: e.id,
      dest: e.dest,
      destName: d.name,
      scenery: d.scenery,
      phase: e.phase,
      phaseProgress: Math.min(1, e.elapsed / Math.max(1, len)),
      secondsLeft: Math.max(0, left) / TICK_HZ,
      members: e.members.map((id) => s.people.find((p) => p.id === id)).filter((p) => !!p).map((p) => ({ id: p.id, name: p.name, look: p.look, gear: { ...p.gear } })),
      horses: (e.horses ?? []).map((h) => h.coat),
      truck: !!e.truck,
      loot: { ...e.loot },
      lootSize: poolSize(e.loot),
      carry: partyCarry(s, e),
      supplies: { ...e.supplies },
      recalled: e.recalled,
      side: s.destSides[e.dest] ?? 1,
      stance: e.stance,
      roles: { ...e.roles },
      battle: e.battle ? e.battle.fighters.map((f) => ({
        side: f.side,
        ref: f.ref,
        kind: f.kind,
        name: f.name,
        hp: f.hp,
        maxHp: f.maxHp,
        row: f.row,
        down: f.down,
        role: f.role,
        look: f.side === "party" ? s.people.find((p) => p.id === f.ref)?.look ?? null : null,
        gear: f.side === "party" ? { ...s.people.find((p) => p.id === f.ref)?.gear ?? {} } : {},
        ranged: f.ranged,
        sinceAction: e.battle.tick - f.lastAction,
        sinceHit: e.battle.tick - f.lastHit,
        sinceArea: f.lastArea != null ? e.battle.tick - f.lastArea : 999,
        hitFx: f.hitFx ?? null
      })) : null,
      waiting: e.prompt !== null
    };
  }
  function researchView(s) {
    const r = s.research;
    const mods = modifiers(r);
    const station = researchStation(s);
    const main = s.people.find((p) => p.id === s.mainId);
    return {
      done: [...r.done],
      revealed: [...r.revealed ?? []],
      queue: [...r.queue],
      progress: { ...r.progress },
      slots: mods.researchSlots,
      station: station.label,
      stationMult: station.mult,
      speed: (main ? skillSpeed(main.skills.research.level) : 1) * station.mult * mods.researchSpeed / RESEARCH_MULTIPLIER[s.era]
    };
  }
  function describe(s, p) {
    const name = (id) => {
      const b = s.buildings.find((q) => q.id === id);
      return b ? defOf(b).name : "building";
    };
    const task = p.task;
    if (p.breakdown) return BREAK_TEXT[p.breakdown.kind];
    if (p.blocked && (!task || task.type === "wander" || task.type === "idle")) return "Storage is full \u2014 click a storage building to throw something out, or build a stockpile";
    if (!task) return "Idle";
    switch (task.type) {
      case "wander":
      case "idle":
        return p.morale < SULK_MORALE ? "Sulking (morale too low to work)" : "Idling at camp";
      case "gather": {
        if (task.scrounge) return "Hungry: picking wild berries (nothing in storage)";
        const t = s.tiles[task.tile].terrain;
        return t === "clear" ? "Idle" : `${TERRAIN[t].verb} (${TERRAIN[t].name.toLowerCase()})`;
      }
      case "store":
        return `Hauling to the ${name(task.building).toLowerCase()}`;
      case "fetch":
        return `Fetching materials for the ${name(task.building)}`;
      case "deliver":
        return `Carrying materials to the ${name(task.building)}`;
      case "build":
        return `Building the ${name(task.building)}`;
      case "research": {
        const t = TOPIC_BY_ID[s.research.queue[0]];
        return t ? `Researching ${t.name}` : "Researching";
      }
      case "eat":
        return "Eating";
      case "sleep":
        if (p.downed) return task.building === null ? "Badly hurt, resting on the ground" : `Badly hurt, resting in the ${name(task.building).toLowerCase()}`;
        return task.building === null ? "Sleeping on the ground" : `Sleeping in the ${name(task.building).toLowerCase()}`;
      case "defend":
        return p.activity === "fight" ? "Fighting off the raiders!" : "Defending the town";
      case "patrol":
        return "On patrol";
      case "shelter":
        return p.bed !== null ? "Sheltering from the raid" : "Huddled by the fire (no bed to hide in)";
      case "repair":
        return `Repairing the ${name(task.building).toLowerCase()}`;
      case "mine":
        return "Digging in the mine";
      case "extinguish":
        return `Fighting the fire at the ${name(task.building).toLowerCase()}!`;
      case "tend": {
        const q = s.people.find((x) => x.id === task.patient);
        return `Tending ${q?.name ?? "the wounded"}'s wounds!`;
      }
      case "farm": {
        const b = s.buildings.find((q) => q.id === task.building);
        const what = b?.def === "herb_garden" ? "herbs" : "grain";
        return b?.crop?.stage === "ripe" ? `Harvesting ${what}` : `Sowing ${what}`;
      }
      case "craft": {
        const o = s.crafting.find((q) => q.id === task.order);
        const item = o ? ITEM_BY_ID[o.item].name : "something";
        return task.phase === "work" ? `Crafting: ${item}` : `Fetching materials to craft: ${item}`;
      }
    }
  }
  function launchSiteView(s) {
    const soon = s.launchTick != null && s.launchTick - s.tick <= TICKS_PER_HOUR;
    if (!soon && !s.gameOver?.won) return null;
    const site = s.buildings.find((b) => b.def === "launch_site" && b.status === "done");
    return site ? buildingCentreX(site) : null;
  }
  function bossBar(s) {
    const r = s.raid;
    const raider = r?.phase === "active" ? r.raiders.find((q) => ENEMIES[q.kind]?.kit && !q.ally && !q.down && !q.gone) : void 0;
    if (raider) return { name: ENEMIES[raider.kind].name, hp: raider.hp, maxHp: raider.maxHp, enraged: !!raider.enraged, where: "in town" };
    for (const e of s.expeditions) {
      const f = e.battle?.fighters.find((q) => q.side === "enemy" && ENEMIES[q.kind]?.kit && !q.down);
      if (f) return { name: f.name, hp: f.hp, maxHp: f.maxHp, enraged: !!f.enraged, where: `at the ${DESTINATION_BY_ID[e.dest]?.name ?? "expedition"}` };
    }
    return null;
  }

  // src/shared/gameLoop.ts
  var SLEEP_GAP_MS = 6e4;
  var CATCH_UP_SLICE_MS = 80;
  var CATCH_UP_BATCH = 500;
  var GameLoop = class {
    constructor(state, onTicks) {
      this.onTicks = onTicks;
      this.sim = new Sim(state);
    }
    onTicks;
    sim;
    last = performance.now();
    lastWall = Date.now();
    timer = null;
    /** Time away being simulated, a slice per pump. */
    job = null;
    /** Debug time multiplier (1 = real time). */
    speed = 1;
    get state() {
      return this.sim.state;
    }
    /** Whether time away is still being simulated (don't save mid-way: the save would lose the rest). */
    get catchingUp() {
      return !!this.job;
    }
    start() {
      this.last = performance.now();
      this.lastWall = Date.now();
      this.timer ??= setInterval(() => this.pump(), TICK_MS);
    }
    /** Replace the running game (e.g. a new seed). */
    reset(state) {
      this.sim = new Sim(state);
      this.job = null;
      this.last = performance.now();
      this.lastWall = Date.now();
    }
    /** Start simulating time spent away (the game closed, or the PC asleep); `done` runs when it's finished. */
    catchUp(ms, done) {
      if (this.job) return;
      this.job = { job: startCatchUp(this.sim, ms), awayMs: ms, t0: performance.now(), done };
    }
    command(c) {
      this.sim.command(c);
    }
    snapshot() {
      const snap = snapshot(this.sim.state);
      if (this.job) snap.catchingUp = this.job.job.progress;
      return snap;
    }
    journal() {
      return journalView(this.sim.state);
    }
    pump() {
      if (this.job) return this.catchUpSlice();
      const wallGap = Date.now() - this.lastWall;
      if (wallGap > SLEEP_GAP_MS) {
        this.catchUp(wallGap);
        return;
      }
      this.lastWall = Date.now();
      const now = performance.now();
      const ms = (now - this.last) * this.speed;
      this.last = now;
      if (this.sim.advance(ms, MAX_TICKS_PER_ADVANCE * this.speed) > 0) this.onTicks(this.snapshot());
    }
    catchUpSlice() {
      const j = this.job;
      const until = performance.now() + CATCH_UP_SLICE_MS;
      let finished = false;
      while (!finished && performance.now() < until) finished = j.job.run(CATCH_UP_BATCH);
      if (finished) {
        const r = j.job.finish();
        this.job = null;
        if (r.ticks) console.log(`[offline] simulated ${r.ticks} ticks for ${Math.round(j.awayMs / 1e3)}s away in ${Math.round(performance.now() - j.t0)}ms`);
        this.last = performance.now();
        this.lastWall = Date.now();
        j.done?.(r);
      }
      this.onTicks(this.snapshot());
    }
  };

  // src/shared/sim/save.ts
  var SAVE_FORMAT = "little-town-save";
  var SAVE_VERSION = 15;
  function serialize(state, savedAt) {
    const file = { format: SAVE_FORMAT, savedAt, state };
    return JSON.stringify(file);
  }
  var MIGRATIONS = {
    // 9 -> 10: crafting (items, the craft queue, worn gear, the Craft job)
    9: (s) => {
      s.items = {};
      s.crafting = [];
      for (const e of s.expeditions) e.waterskins = 0;
      for (const p of [...s.people, ...s.visitor ? [s.visitor.person] : []]) {
        p.gear = {};
        p.priorities.craft = p.autoPriorities ? autoPriorities(p.skills).craft : 2;
      }
    },
    // 10 -> 11: farming (the Farm job; fields start fallow when first looked at)
    10: (s) => {
      for (const p of [...s.people, ...s.visitor ? [s.visitor.person] : []]) p.priorities.farm = p.autoPriorities ? autoPriorities(p.skills).farm : 2;
    },
    // 11 -> 12: the Medieval era (captives of bandits)
    11: (s) => {
      s.captives = [];
    },
    // 12 -> 13: relationships and families
    12: (s) => {
      s.relations = {};
      s.celebrationUntil = 0;
    },
    // 13 -> 14: horses and trade caravans
    13: (s) => {
      s.horses = [];
      s.caravan = null;
      s.nextCaravanTick = 0;
    },
    // 14 -> 15: prisoners
    14: (s) => {
      s.prisoners = [];
    }
  };
  function parseSave(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, reason: "corrupt" };
    }
    const f = raw;
    if (!f || f.format !== SAVE_FORMAT || typeof f.savedAt !== "number" || !f.state || typeof f.state !== "object") return { ok: false, reason: "corrupt" };
    const s = f.state;
    const from = s.version;
    while (typeof s.version === "number" && s.version < SAVE_VERSION && MIGRATIONS[s.version]) {
      try {
        MIGRATIONS[s.version](s);
      } catch {
        return { ok: false, reason: "corrupt" };
      }
      s.version++;
    }
    if (s.version !== SAVE_VERSION) return { ok: false, reason: "old-version", version: typeof from === "number" ? from : void 0 };
    const shaped = typeof s.seed === "string" && Number.isInteger(s.tick) && Number.isInteger(s.rngState) && Array.isArray(s.tiles) && Array.isArray(s.buildings) && Array.isArray(s.people) && Array.isArray(s.journal) && !!s.research;
    return shaped ? { ok: true, save: f } : { ok: false, reason: "corrupt" };
  }

  // src/renderer/mobile/mobileBridge.ts
  var SAVE_KEY = "littletown.save";
  var BACKUP_KEY = "littletown.backup";
  var SETTINGS_KEY = "littletown.settings";
  var AUTOSAVE_MS = 3e4;
  function read(key2) {
    try {
      return localStorage.getItem(key2);
    } catch {
      return null;
    }
  }
  function write(key2, value) {
    try {
      localStorage.setItem(key2, value);
      return true;
    } catch (err) {
      console.error(`[mobile] could not store ${key2}`, err);
      return false;
    }
  }
  var randomSeed = () => Math.floor(Math.random() * 4294967295).toString(36);
  function mobileBridge() {
    const settings = { music: false, ...JSON.parse(read(SETTINGS_KEY) ?? "{}") };
    const state = { mode: "full", hidden: document.hidden, panel: null, music: settings.music };
    const stateListeners = /* @__PURE__ */ new Set();
    const emit = () => stateListeners.forEach((f) => f({ ...state }));
    const snapListeners = /* @__PURE__ */ new Set();
    const placeListeners = /* @__PURE__ */ new Set();
    let leaving = false;
    const saveNow = () => {
      if (!game.catchingUp && !leaving) write(SAVE_KEY, serialize(game.state, Date.now()));
    };
    const loaded = (() => {
      const text = read(SAVE_KEY);
      if (!text) return null;
      const r = parseSave(text);
      if (r.ok) return r.save;
      write(`${SAVE_KEY}.unreadable`, text);
      return null;
    })();
    const game = new GameLoop(loaded?.state ?? newGame(randomSeed()), (snap) => snapListeners.forEach((f) => f(snap)));
    if (loaded) game.catchUp(Date.now() - loaded.savedAt, saveNow);
    else {
      saveNow();
      state.panel = "newgame";
    }
    game.start();
    setInterval(saveNow, AUTOSAVE_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveNow();
      state.hidden = document.hidden;
      emit();
    });
    window.addEventListener("pagehide", saveNow);
    Object.assign(window, { __game: game });
    return {
      setInteractive: () => {
      },
      setMode: () => {
      },
      // (no slim ticker on the phone)
      setMusic: (on) => {
        state.music = settings.music = on;
        write(SETTINGS_KEY, JSON.stringify(settings));
        emit();
      },
      togglePanel: (id) => {
        state.panel = state.panel === id ? null : id;
        emit();
      },
      openPanel: (id) => {
        state.panel = id;
        emit();
      },
      closePanel: () => {
        state.panel = null;
        emit();
      },
      getState: async () => ({ ...state }),
      onState: (cb) => {
        stateListeners.add(cb);
        return () => stateListeners.delete(cb);
      },
      startPlacement: (defId) => {
        state.panel = null;
        emit();
        placeListeners.forEach((f) => f(defId));
      },
      onPlacement: (cb) => {
        placeListeners.add(cb);
        return () => placeListeners.delete(cb);
      },
      newGame: (raw) => {
        const opts = cleanNewGameOptions(raw);
        if (!opts) return;
        const old = read(SAVE_KEY);
        if (old && !game.state.ironman && game.state.tick >= TICKS_PER_HOUR) write(BACKUP_KEY, old);
        write(SAVE_KEY, serialize(newGame(randomSeed(), opts), Date.now()));
        leaving = true;
        location.reload();
      },
      command: (c) => game.command(c),
      getSnapshot: async () => game.snapshot(),
      onSnapshot: (cb) => {
        snapListeners.add(cb);
        return () => snapListeners.delete(cb);
      },
      getJournal: async () => game.journal(),
      // Phone alerts are a desktop feature (they're sent when the desktop app quits).
      getAlerts: async () => ({ ...DEFAULT_ALERTS }),
      setAlerts: async (a) => a,
      testAlert: async () => "Phone alerts come from the desktop app."
    };
  }

  // src/shared/format.ts
  function researchFill(r) {
    const id = r.queue[0];
    if (!id) return null;
    const pct = Math.floor((r.progress[id] ?? 0) * 100);
    return { pct, title: `Researching ${TOPIC_BY_ID[id]?.name ?? id}: ${pct}%` };
  }

  // src/renderer/mobile/mobile.ts
  var ZOOM_KEY = "littletown.zoom";
  var ZOOMS = [1, 1.25, 1.5, 2];
  var bridge = mobileBridge();
  window.bridge = bridge;
  var $ = (id) => document.getElementById(id);
  var stripBox = $("strip-box");
  var sheet = $("sheet");
  var menu = $("menu");
  var zoom = (() => {
    try {
      const z = Number(localStorage.getItem(ZOOM_KEY));
      return ZOOMS.includes(z) ? z : 1.25;
    } catch {
      return 1.25;
    }
  })();
  var strip = document.createElement("iframe");
  strip.src = "strip.html";
  strip.title = "Town";
  stripBox.append(strip);
  var loading = setInterval(() => {
    if (!strip.contentDocument?.querySelector("canvas")) return;
    clearInterval(loading);
    $("loading").remove();
  }, 250);
  var panel = document.createElement("iframe");
  panel.src = "panel.html";
  panel.title = "Menu";
  sheet.append(panel);
  function layout() {
    const room = window.innerHeight - $("top").offsetHeight - $("tabs").offsetHeight;
    const z = Math.max(1, Math.min(zoom, room / STRIP_HEIGHT));
    strip.style.width = `${stripBox.clientWidth / z}px`;
    strip.style.height = `${STRIP_HEIGHT}px`;
    strip.style.transform = `scale(${z})`;
    document.documentElement.style.setProperty("--strip-h", `${STRIP_HEIGHT * z}px`);
  }
  new ResizeObserver(layout).observe(stripBox);
  window.addEventListener("resize", layout);
  layout();
  var tabs = $("tabs");
  var researchBar = document.createElement("span");
  researchBar.className = "tab-fill";
  researchBar.hidden = true;
  var tabButtons = PANELS.map((p) => {
    const b = document.createElement("button");
    if (p.id === "research") b.append(researchBar);
    const label2 = document.createElement("span");
    label2.className = "tab-label";
    label2.textContent = p.label;
    b.append(label2);
    b.addEventListener("click", () => bridge.togglePanel(p.id));
    tabs.append(b);
    return { id: p.id, b };
  });
  var researchPct = -1;
  bridge.onSnapshot((snap) => {
    const fill = researchFill(snap.research);
    if ((fill?.pct ?? -1) === researchPct) return;
    researchPct = fill?.pct ?? -1;
    researchBar.hidden = !fill;
    researchBar.style.width = `${researchPct}%`;
  });
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--tabs-h", `${tabs.offsetHeight}px`);
    layout();
  }).observe(tabs);
  var applyState = (s) => {
    sheet.hidden = !s.panel;
    if (s.panel) menu.hidden = true;
    for (const t of tabButtons) t.b.classList.toggle("on", t.id === s.panel);
  };
  bridge.onState(applyState);
  void bridge.getState().then(applyState);
  function drawMenu() {
    void bridge.getState().then((s) => {
      const item = (label2, onClick, on = false) => {
        const b = document.createElement("button");
        b.className = on ? "item on" : "item";
        b.textContent = label2;
        b.addEventListener("click", onClick);
        return b;
      };
      const zooms = document.createElement("div");
      zooms.className = "zooms";
      zooms.append(
        ...ZOOMS.map(
          (z) => item(`${z}\xD7`, () => {
            zoom = z;
            try {
              localStorage.setItem(ZOOM_KEY, String(z));
            } catch {
            }
            layout();
            drawMenu();
          }, z === zoom)
        )
      );
      const installed = matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
      menu.replaceChildren(
        item("New town\u2026", () => bridge.openPanel("newgame")),
        item(`Music: ${s.music ? "on" : "off"}`, () => (bridge.setMusic(!s.music), drawMenu())),
        label("Town size"),
        zooms,
        ...installed ? [] : [label("To install: Chrome menu \u22EE \u2192 Add to Home screen")]
      );
    });
  }
  function label(text) {
    const d = document.createElement("div");
    d.className = "label";
    d.textContent = text;
    return d;
  }
  $("menu-btn").addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    if (!menu.hidden) drawMenu();
  });
  window.addEventListener("blur", () => menu.hidden = true);
  document.addEventListener("pointerdown", (e) => {
    if (!menu.hidden && !(e.target instanceof Node && (menu.contains(e.target) || $("menu-btn").contains(e.target)))) menu.hidden = true;
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("[mobile] no offline support:", err));
  }
})();
