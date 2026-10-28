# Grid audit: measurements

Written by `node tools/grid-audit.mjs` (tools/grid-audit.ts), the settlers' kit as the iso view draws it today. A cell is 48x24 px; the kit is drawn at 66.3% (its `scale` 1.326 times `ISO_ART` 0.5).

## Buildings, worst first

- **foot**: the footprint (cells along x by along y). **art**: the cells the picture's own plinth covers as drawn.
- **lift**: px the picture's ground stands above the footprint's (+ floats, - sinks). **shift**: px its front corner stands right of the footprint's.
- **spread**: the picture's width over the footprint's diamond's. **rows**: how many cell heights it rises behind its back corner.

| building | piece | foot | art | lift | shift | spread | rows | scale | note |
|---|---|---|---|---|---|---|---|---|---|
| launch_site (8x4) | shared/launch_site | 8x4 | 5.4x6.6 | 10 | -63 | 1.0 | 5.7 | 90.9% |  |
| mission_control (6x4) | shared/mission_control | 6x4 | 4.3x5.6 | 7 | -40 | 1.0 | 5.8 | 98.8% |  |
| factory (6x4) | workshop | 6x4 | 3.0x3.0 | 3 | -25 | 0.6 | 1.1 | 66.3% |  |
| power_station (6x4) | workshop | 6x4 | 3.0x3.0 | 3 | -25 | 0.6 | 1.1 | 66.3% |  |
| cathedral (6x4) | chapel | 6x4 | 2.9x3.8 | 5 | -35 | 0.7 | 2.1 | 66.3% |  |
| arena (5x4) | cottage | 5x4 | 2.6x2.4 | 4 | -9 | 0.6 | 0.0 | 66.3% |  |
| quoits_pitch (3x1) | shared/quoits_pitch | 3x1 | 2.4x1.6 | 32 | -15 | 1.0 | -0.3 | 42.9% |  |
| tavern (5x3) | tavern | 5x3 | 2.6x3.1 | 9 | -30 | 0.7 | 1.9 | 66.3% |  |
| harbour (4x3) | shared/harbour | 4x3 | 3.1x3.9 | 22 | -21 | 1.0 | 0.8 | 52.5% |  |
| trading_post (3x2) | market_stall | 3x2 | 4.3x1.2 | 7 | 25 | 1.1 | 1.6 | 66.3% |  |
| market (3x2) | market_stall | 3x2 | 4.3x1.2 | 7 | 25 | 1.1 | 1.6 | 66.3% |  |
| furniture_store (3x2) | market_stall | 3x2 | 4.3x1.2 | 7 | 25 | 1.1 | 1.6 | 66.3% |  |
| weapon_store (3x2) | market_stall | 3x2 | 4.3x1.2 | 7 | 25 | 1.1 | 1.6 | 66.3% |  |
| armour_store (3x2) | market_stall | 3x2 | 4.3x1.2 | 7 | 25 | 1.1 | 1.6 | 66.3% |  |
| apothecary_shop (3x2) | market_stall | 3x2 | 4.3x1.2 | 7 | 25 | 1.1 | 1.6 | 66.3% |  |
| graveyard (3x2) | chapel | 3x2 | 2.7x3.5 | 4 | -22 | 1.3 | 4.1 | 61.7% |  |
| general_store (4x3) | market_stall | 4x3 | 4.3x1.2 | 7 | 25 | 0.8 | 0.6 | 66.3% |  |
| university (6x4) | longhouse | 6x4 | 4.1x3.0 | 5 | -10 | 0.7 | 1.3 | 66.3% |  |
| town_hall (6x4) | longhouse | 6x4 | 4.1x3.0 | 5 | -10 | 0.7 | 1.3 | 66.3% |  |
| emporium (5x3) | market_stall | 5x3 | 4.3x1.2 | 7 | 13 | 0.7 | 0.1 | 66.3% |  |
| fireside_inn (3x2) | tavern | 3x2 | 2.6x3.1 | 9 | -18 | 1.2 | 3.4 | 66.3% |  |
| brewery (3x2) | tavern | 3x2 | 2.6x3.1 | 9 | -18 | 1.2 | 3.4 | 66.3% |  |
| fusion_reactor (5x3) | workshop | 5x3 | 3.0x3.0 | 3 | -25 | 0.7 | 2.1 | 66.3% |  |
| siege_workshop (4x2) | workshop | 4x2 | 3.0x3.0 | 3 | -25 | 1.0 | 3.1 | 66.3% |  |
| boatyard (3x2) | shared/boatyard | 3x2 | 2.2x2.8 | 11 | -19 | 1.0 | 1.1 | 41.7% |  |
| temple (4x3) | chapel | 4x3 | 2.9x3.8 | 5 | -23 | 1.0 | 3.6 | 66.3% |  |
| phylactery (1x2) | cottage | 1x2 | 1.9x1.8 | 3 | 14 | 1.3 | 1.9 | 49.7% | shrunk to 75% of the kit |
| storytellers_circle (3x2) | campfire | 3x2 | 1.5x1.5 | 6 | -11 | 0.6 | 0.0 | 66.3% |  |
| arcane_academy (3x3) | longhouse | 3x3 | 4.1x3.0 | 5 | 14 | 1.2 | 3.3 | 66.3% |  |
| spike_trap (1x1) | rocks | 1x1 | 0.6x1.6 | 5 | -9 | 1.3 | 0.9 | 48.0% | shrunk to 72% of the kit |
| pit_trap (1x1) | rocks | 1x1 | 0.6x1.6 | 5 | -9 | 1.3 | 0.9 | 48.0% | shrunk to 72% of the kit |
| caltrops (1x1) | rocks | 1x1 | 0.6x1.6 | 5 | -9 | 1.3 | 0.9 | 48.0% | shrunk to 72% of the kit |
| boiling_oil (1x1) | rocks | 1x1 | 0.6x1.6 | 5 | -9 | 1.3 | 0.9 | 48.0% | shrunk to 72% of the kit |
| sparring_yard (3x2) | shared/sparring_yard | 3x2 | 2.1x2.8 | 3 | -20 | 1.0 | 0.7 | 46.9% |  |
| ai_core (3x2) | shared/ai_core | 3x2 | 2.2x2.8 | 3 | -20 | 1.0 | 2.6 | 49.4% |  |
| bandstand (3x2) | shared/bandstand | 3x2 | 2.2x2.8 | 3 | -20 | 1.0 | 2.6 | 49.4% |  |
| portal_arch (3x2) | shared/portal_arch | 3x2 | 2.2x2.8 | 3 | -20 | 1.0 | 2.6 | 49.4% |  |
| stable (4x3) | cottage | 4x3 | 2.6x2.4 | 4 | -9 | 0.7 | 1.0 | 66.3% | no pen piece: a cottage stands in |
| beast_ranch (4x3) | cottage | 4x3 | 2.6x2.4 | 4 | -9 | 0.7 | 1.0 | 66.3% | no pen piece: a cottage stands in |
| creature_pen (4x3) | cottage | 4x3 | 2.6x2.4 | 4 | -9 | 0.7 | 1.0 | 66.3% | no pen piece: a cottage stands in |
| drill_yard (3x2) | shared/drill_yard | 3x2 | 2.2x2.8 | 2 | -20 | 1.0 | 2.3 | 46.9% |  |
| granary (3x2) | granary | 3x2 | 2.4x2.8 | 5 | -16 | 1.0 | 2.6 | 66.3% |  |
| mine (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| smithy (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| sawmill (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| tannery (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| windmill (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| bakery (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| coal_mine (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| glassworks (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| gunsmith (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| cement_works (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| deep_mine (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| battery_plant (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| cannery (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| bio_lab (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| nanoforge (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| quarry (3x2) | workshop | 3x2 | 3.0x3.0 | 3 | -13 | 1.2 | 3.6 | 66.3% |  |
| drying_rack (1x2) | workshop | 1x2 | 1.8x1.9 | 2 | 12 | 1.3 | 2.3 | 41.5% | shrunk to 63% of the kit |
| radio_tower (1x2) | watchtower | 1x2 | 1.8x1.9 | 4 | 10 | 1.3 | 3.3 | 51.1% |  |
| resurrection_shrine (2x2) | chapel | 2x2 | 2.2x2.8 | 3 | -8 | 1.3 | 3.3 | 49.4% | shrunk to 74% of the kit |
| wayside_shrine (2x2) | chapel | 2x2 | 2.2x2.8 | 3 | -8 | 1.3 | 3.3 | 49.4% | shrunk to 74% of the kit |
| print_shop (3x2) | longhouse | 3x2 | 3.6x2.6 | 4 | 0 | 1.3 | 3.0 | 57.9% |  |
| bathhouse (3x2) | longhouse | 3x2 | 3.6x2.6 | 4 | 0 | 1.3 | 3.0 | 57.9% |  |
| monster_guild (3x2) | longhouse | 3x2 | 3.6x2.6 | 4 | 0 | 1.3 | 3.0 | 57.9% |  |
| arcane_library (3x2) | longhouse | 3x2 | 3.6x2.6 | 4 | 0 | 1.3 | 3.0 | 57.9% |  |
| lean_to (2x2) | cottage | 2x2 | 2.6x2.4 | 4 | 3 | 1.3 | 2.5 | 66.3% |  |
| healers_hut (2x2) | cottage | 2x2 | 2.6x2.4 | 4 | 3 | 1.3 | 2.5 | 66.3% |  |
| clockmaker (2x2) | cottage | 2x2 | 2.6x2.4 | 4 | 3 | 1.3 | 2.5 | 66.3% |  |
| deep_shaft (2x2) | cottage | 2x2 | 2.6x2.4 | 4 | 3 | 1.3 | 2.5 | 66.3% |  |
| stockade (3x2) | palisade_run | 3x2 | 3.6x1.3 | 4 | 16 | 1.0 | 1.3 | 52.2% |  |
| workbench (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| tanning_rack (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| kiln (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| bloomery (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| loom (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| oil_derrick (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| smokehouse (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| bone_carver (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| basketry (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| tailor (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| jeweller (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| cooper (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| apothecary (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| chandlery (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| dyeworks (2x2) | workshop | 2x2 | 2.5x2.5 | 3 | -1 | 1.3 | 3.1 | 55.3% |  |
| archery_range (3x1) | shared/archery_range | 3x1 | 2.4x1.5 | 7 | -13 | 1.0 | 1.0 | 37.5% |  |
| lookout (2x2) | watchtower | 2x2 | 2.3x2.5 | 5 | -2 | 1.2 | 4.2 | 66.3% |  |
| watchtower (2x2) | watchtower | 2x2 | 2.3x2.5 | 5 | -2 | 1.2 | 4.2 | 66.3% |  |
| bell_tower (2x2) | watchtower | 2x2 | 2.3x2.5 | 5 | -2 | 1.2 | 4.2 | 66.3% |  |
| mage_tower (2x2) | watchtower | 2x2 | 2.3x2.5 | 5 | -2 | 1.2 | 4.2 | 66.3% |  |
| airship_mast (3x2) | watchtower | 3x2 | 2.3x2.5 | 5 | -14 | 1.0 | 3.7 | 66.3% |  |
| stockpile (3x2) | stockpile | 3x2 | 2.2x2.3 | 4 | -14 | 0.9 | 1.5 | 66.3% |  |
| fishing_jetty (2x1) | shared/fishing_jetty | 2x1 | 1.7x1.3 | 12 | -8 | 1.0 | 0.2 | 28.1% |  |
| pleasure_garden (3x3) | shared/pleasure_garden | 3x3 | 2.6x3.4 | 9 | -10 | 1.0 | 2.2 | 59.0% |  |
| well (1x2) | well | 1x2 | 1.5x1.5 | 4 | 12 | 1.0 | 1.8 | 66.3% |  |
| stone_wall (1x1) | stone_wall_run | 1x1 | 1.6x0.4 | 1 | 14 | 1.0 | -0.1 | 14.3% | shrunk to 22% of the kit |
| stone_grate (1x1) | stone_wall_run | 1x1 | 1.6x0.4 | 1 | 14 | 1.0 | -0.1 | 14.3% | shrunk to 22% of the kit |
| steelworks (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| refinery (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| electronics_plant (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| garage (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| alloy_foundry (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| chip_fab (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| robot_workshop (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| textile_mill (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| appliance_plant (4x3) | workshop | 4x3 | 3.0x3.0 | 3 | -13 | 0.9 | 2.6 | 66.3% |  |
| cryo_pod (1x2) | shared/cryo_pod | 1x2 | 1.3x1.7 | 12 | 7 | 1.0 | 0.9 | 31.6% |  |
| village_green (3x2) | shared/village_green | 3x2 | 2.5x2.4 | 6 | -11 | 1.0 | 1.2 | 46.9% |  |
| guard_tower (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| gun_nest (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| gun_turret (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| laser_turret (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| ballista (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| catapult (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| cannon (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| flame_turret (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| mortar_pit (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| tesla_coil (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| militia_post (1x1) | watchtower | 1x1 | 1.2x1.3 | 2 | -1 | 1.2 | 2.2 | 34.1% | shrunk to 51% of the kit |
| elder_lodge (5x3) | longhouse | 5x3 | 4.1x3.0 | 5 | -10 | 0.9 | 2.3 | 66.3% |  |
| hospital (5x3) | longhouse | 5x3 | 4.1x3.0 | 5 | -10 | 0.9 | 2.3 | 66.3% |  |
| trauma_center (5x3) | longhouse | 5x3 | 4.1x3.0 | 5 | -10 | 0.9 | 2.3 | 66.3% |  |
| habitat_dome (5x3) | longhouse | 5x3 | 4.1x3.0 | 5 | -10 | 0.9 | 2.3 | 66.3% |  |
| prison (5x3) | longhouse | 5x3 | 4.1x3.0 | 5 | -10 | 0.9 | 2.3 | 66.3% |  |
| land_mine (1x1) | workshop | 1x1 | 1.2x1.3 | 1 | 0 | 1.3 | 1.5 | 27.6% | shrunk to 42% of the kit |
| campfire (2x2) | campfire | 2x2 | 1.5x1.5 | 6 | 1 | 0.8 | 0.5 | 66.3% |  |
| palisade_wall (1x1) | palisade_run | 1x1 | 1.5x0.5 | 1 | 11 | 1.0 | 0.5 | 20.9% | shrunk to 31% of the kit |
| palisade_grate (1x1) | palisade_run | 1x1 | 1.5x0.5 | 1 | 11 | 1.0 | 0.5 | 20.9% | shrunk to 31% of the kit |
| brick_wall (1x1) | palisade_run | 1x1 | 1.5x0.5 | 1 | 11 | 1.0 | 0.5 | 20.9% | shrunk to 31% of the kit |
| concrete_wall (1x1) | palisade_run | 1x1 | 1.5x0.5 | 1 | 11 | 1.0 | 0.5 | 20.9% | shrunk to 31% of the kit |
| force_wall (1x1) | palisade_run | 1x1 | 1.5x0.5 | 1 | 11 | 1.0 | 0.5 | 20.9% | shrunk to 31% of the kit |
| brick_grate (1x1) | palisade_run | 1x1 | 1.5x0.5 | 1 | 11 | 1.0 | 0.5 | 20.9% | shrunk to 31% of the kit |
| concrete_grate (1x1) | palisade_run | 1x1 | 1.5x0.5 | 1 | 11 | 1.0 | 0.5 | 20.9% | shrunk to 31% of the kit |
| force_grate (1x1) | palisade_run | 1x1 | 1.5x0.5 | 1 | 11 | 1.0 | 0.5 | 20.9% | shrunk to 31% of the kit |
| hide_tent (3x2) | cottage | 3x2 | 2.6x2.4 | 4 | -9 | 1.0 | 2.0 | 66.3% |  |
| hunters_lodge (3x2) | cottage | 3x2 | 2.6x2.4 | 4 | -9 | 1.0 | 2.0 | 66.3% |  |
| cottage (3x2) | cottage | 3x2 | 2.6x2.4 | 4 | -9 | 1.0 | 2.0 | 66.3% |  |
| pharmacy (3x2) | cottage | 3x2 | 2.6x2.4 | 4 | -9 | 1.0 | 2.0 | 66.3% |  |
| kennels (3x2) | cottage | 3x2 | 2.6x2.4 | 4 | -9 | 1.0 | 2.0 | 66.3% | no pen piece: a cottage stands in |
| stone_gate (2x1) | stone_gate | 2x1 | 2.4x0.6 | 1 | 10 | 1.0 | -0.2 | 16.8% | shrunk to 25% of the kit |
| clone_vat (2x2) | shared/clone_vat | 2x2 | 1.7x2.3 | 5 | -7 | 1.0 | 1.6 | 42.1% |  |
| ward_stone (1x2) | shared/ward_stone | 1x2 | 1.3x1.7 | 3 | 8 | 1.0 | 1.1 | 34.4% |  |
| shield_generator (2x2) | shared/shield_generator | 2x2 | 1.7x2.3 | 2 | -6 | 1.0 | 2.1 | 39.3% |  |
| longhouse (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| barracks (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| trophy_hall (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| scriptorium (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| infirmary (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| school (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| rowhouse (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| library (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| apartments (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| cinema (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| theatre (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| gaol (4x3) | longhouse | 4x3 | 4.1x3.0 | 5 | 2 | 1.0 | 2.8 | 66.3% |  |
| victory_monument (1x1) | shared/victory_monument | 1x1 | 0.9x1.1 | 1 | -3 | 1.0 | 1.0 | 19.8% |  |
| statue (1x1) | shared/statue | 1x1 | 1.0x1.0 | 4 | 0 | 1.0 | 0.8 | 21.1% |  |
| drone_hub (2x2) | shared/drone_hub | 2x2 | 2.0x2.0 | 3 | 1 | 1.0 | 1.0 | 37.5% |  |
| palisade_gate (2x1) | palisade_gate | 2x1 | 2.0x1.0 | 2 | -1 | 1.0 | 0.3 | 25.9% | shrunk to 39% of the kit |
| brick_gate (2x1) | palisade_gate | 2x1 | 2.0x1.0 | 2 | -1 | 1.0 | 0.3 | 25.9% | shrunk to 39% of the kit |
| concrete_gate (2x1) | palisade_gate | 2x1 | 2.0x1.0 | 2 | -1 | 1.0 | 0.3 | 25.9% | shrunk to 39% of the kit |
| force_gate (2x1) | palisade_gate | 2x1 | 2.0x1.0 | 2 | -1 | 1.0 | 0.3 | 25.9% | shrunk to 39% of the kit |

## Fields and pens

13 kinds (herb_garden 3x2, garden_plot 4x2, flax_field 3x2, chicken_coop 2x2, goat_pen 3x2, open_field 8x4, estate_farm 8x4, vegetable_patch 3x2, orchard 5x3, pig_sty 3x2, sheep_fold 4x2, cattle_pasture 5x3, hydroponics_bay 4x2): drawn as the kit's field tile, one to a cell, so on the grid exactly; a pen is drawn as a field too (no fence, no beasts' ground).

## Scenery, props and landmarks

| piece | lift (px) | wide (cells) | tall (cell heights) | where it stands |
|---|---|---|---|---|
| wild/reeds_1 (landmark) | 8 | 0.9 | 1.8 | the cell's middle |
| settlers/pine_tree (tree) | -8 | 1.1 | 3.7 | a random spot in the middle 40% of its cell |
| settlers/barrels (prop) | 8 | 0.8 | 1.5 | 0.45 cells past the footprint, 0.25..0.75 along a face |
| settlers/oak_tree (tree) | -7 | 1.7 | 4.2 | a random spot in the middle 40% of its cell |
| wild/reeds_2 (landmark) | 7 | 0.7 | 1.6 | the cell's middle |
| settlers/crates (prop) | 6 | 0.9 | 1.6 | 0.45 cells past the footprint, 0.25..0.75 along a face |
| wild/statue (landmark) | -5 | 0.8 | 2.1 | the cell's middle |
| wild/mill (landmark) | -5 | 1.7 | 3.1 | the cell's middle |
| wild/thorns_1 (landmark) | -4 | 1.2 | 1.8 | the cell's middle |
| settlers/bush (bush) | -3 | 0.8 | 1.7 | a random spot in the middle 40% of its cell |
| wild/dune_1 (landmark) | -3 | 2.1 | 1.9 | the cell's middle |
| wild/ruin_1 (landmark) | -3 | 0.9 | 2.1 | the cell's middle |
| wild/pebbles_2 (landmark) | 3 | 0.2 | 0.4 | the cell's middle |
| wild/bones_3 (landmark) | -3 | 0.3 | 1.4 | the cell's middle |
| wild/dune_2 (landmark) | -2 | 1.5 | 1.4 | the cell's middle |
| settlers/lamp_post (prop) | 2 | 0.6 | 2.5 | 0.45 cells past the footprint, 0.25..0.75 along a face |
| settlers/cart (prop) | 2 | 1.3 | 1.7 | 0.45 cells past the footprint, 0.25..0.75 along a face |
| wild/shrub_1 (landmark) | -2 | 0.7 | 1.3 | the cell's middle |
| settlers/woodpile (prop) | 2 | 0.8 | 1.3 | 0.45 cells past the footprint, 0.25..0.75 along a face |
| wild/bones_1 (landmark) | 2 | 0.2 | 0.3 | the cell's middle |
| wild/mushrooms_1 (landmark) | 2 | 0.3 | 0.8 | the cell's middle |
| wild/fern (landmark) | -2 | 0.4 | 1.0 | the cell's middle |
| wild/snow_rock (landmark) | -2 | 0.9 | 1.3 | the cell's middle |
| wild/branch (landmark) | -2 | 0.9 | 0.9 | the cell's middle |
| wild/shrub_2 (landmark) | -1 | 0.3 | 0.6 | the cell's middle |
| wild/pillar_3 (landmark) | 1 | 0.3 | 0.5 | the cell's middle |
| wild/mushrooms_3 (landmark) | 1 | 0.3 | 0.6 | the cell's middle |
| wild/pebbles_1 (landmark) | 1 | 0.3 | 0.6 | the cell's middle |
| settlers/hay_bales (prop) | 1 | 1.0 | 1.5 | 0.45 cells past the footprint, 0.25..0.75 along a face |
| wild/floe_2 (landmark) | 1 | 0.6 | 0.4 | the cell's middle |
| wild/stump_3 (landmark) | -1 | 0.3 | 0.5 | the cell's middle |
| wild/thorns_2 (landmark) | -1 | 0.3 | 0.5 | the cell's middle |
| wild/bones_2 (landmark) | 1 | 0.5 | 1.1 | the cell's middle |
| wild/mushrooms_2 (landmark) | 1 | 0.2 | 0.4 | the cell's middle |
| wild/grass_2 (landmark) | -1 | 0.1 | 0.2 | the cell's middle |
| wild/ruin_2 (landmark) | 0 | 0.9 | 1.4 | the cell's middle |
| wild/grass_3 (landmark) | 0 | 0.1 | 0.2 | the cell's middle |
| wild/flowers_3 (landmark) | 0 | 0.1 | 0.2 | the cell's middle |
| wild/flowers_4 (landmark) | 0 | 0.1 | 0.2 | the cell's middle |
| wild/shrub_3 (landmark) | 0 | 0.2 | 0.4 | the cell's middle |
| wild/skeleton (landmark) | 0 | 1.4 | 1.0 | the cell's middle |
| wild/pillar_1 (landmark) | 0 | 0.6 | 1.2 | the cell's middle |
| wild/pillar_2 (landmark) | 0 | 0.5 | 1.0 | the cell's middle |
| settlers/rocks (rock) | 0 | 1.5 | 2.5 | a random spot in the middle 40% of its cell |
| wild/grass_1 (landmark) | 0 | 0.1 | 0.1 | the cell's middle |
| wild/flowers_1 (landmark) | 0 | 0.1 | 0.1 | the cell's middle |
| wild/flowers_2 (landmark) | 0 | 0.1 | 0.1 | the cell's middle |
| wild/floe_1 (landmark) | 0 | 0.8 | 0.6 | the cell's middle |
| wild/dune_3 (landmark) | 0 | 0.6 | 0.4 | the cell's middle |
| wild/stump_1 (landmark) | 0 | 0.3 | 0.6 | the cell's middle |
| wild/stump_2 (landmark) | 0 | 0.5 | 0.7 | the cell's middle |
| wild/tall_grass (landmark) | 0 | 0.5 | 1.1 | the cell's middle |

## Townsfolk

| look | feet above the spot (px) | tall (cell heights) |
|---|---|---|
| man_base | 17 | 2.2 |
| woman_leather | 15 | 2.0 |
| dwarf_plate | 15 | 2.0 |
| child_boy | 21 | 1.8 |
