## The living wilderness (claude/wilderness; the owner's ask)

The land beyond the town is an ecosystem. Everything runs only with the autopilot on, on its own side stream
(`${seed}:wild:...`), and lives in the optional `GameState.wild` (older saves just seed it on their first autopilot hour).
No manual controls.

**Herds and predators** (`sim/wild.ts`, `data/wild.ts`). `wildHourly(s)` (called from `sim.ts` after `nestsHourly`)
seeds `HERD_TARGET` herds (deer and boar; camels in the desert, boar in swamp and jungle: `BIOME_GAME`) between
`HERD_NEAR` and `HERD_FAR` cells of the camp, and `PACK_TARGET` predator packs (`BIOME_PREDATORS`: wolves, bears,
lions, wild dogs). A herd has a summer ground (`ax,ay`) and a winter ground (`bx,by`): it grazes, walks to the winter
ground in autumn and back in spring (`MIGRATE_STEP` cells an hour), breeds in spring and summer (`BIRTH_RATE`, thinned
towards the herd's cap) and dies back in the cold (`DEATH_RATE`). Herds keep `HERD_KEEP_OFF` cells from the town. A herd
under two head scatters. In spring, each day, a missing herd drifts in from beyond `HERD_FAR`. A pack follows the nearest
herd and kills now and then (`KILL_CHANCE`); hunger rises `HUNGER_RATE` an hour and a kill takes `KILL_RELIEF` off. A
pack past `HUNGRY_AT` with no game within 30 cells (or starving) walks to the town's edge, and there `strike`s: a
small roaming band (`spawnRoamerAt`, group from `packFoes`, no raid budget) goes out at whoever is on the land, and
it may take up to `PEN_TAKE` animals from a pen nothing shelters. Like the roamers it waits for `ROAM_FIRST_DAY` and
`ROAM_PEOPLE`, never comes in a raid, and rests `PACK_REST_DAYS` after. This is added to the bands that already roam
(`roamersHourly` is unchanged): the land is no safer than before.

**Hunting tracks real prey.** `huntFactors(s)` reads the nearest herd's distance from the camp: past `HUNT_NEAR`
cells the yield of a `type: 'hunt'` expedition falls (down to `HUNT_YIELD_MIN`), the road is longer (outTicks,
up to `HUNT_TRAVEL_MAX`) and the odds of a fight on arrival and ambush rise (`HUNT_RISK_PER_CELL`, up to
`HUNT_RISK_MAX`). Every `HUNT_UNITS_PER_HEAD` units the hunters bring in, a head falls from the nearest herd
(`huntedUnit`, from `expeditions.ts`'s work phase). Hunted out near town, the herds are further off and the hunting poorer;
left alone they breed back and drift in. `parties.ts` `pull` favours hunts while the game is near and looks elsewhere
when it is thin. A town without `s.wild` hunts as before.

**Forests that live.** Daily (06:00) `spreadWoods` turns open grass with at least three woodland neighbours into young
woods (half the usual pool): `SPREAD_PER_DAY` by season (none in winter), never over the town, a road, a worn path, a
regrowing cell or the blight, and never past `WOOD_CAP` times the woods the land began with (`Wild.woodBase`), so
woodcutters' clearings let it spread again.

**Wildfires in dry summers.** `dryYear(s)` is `DRY_YEAR` of the years (by seed and year) and every drought; in a dry
summer, with no disaster on, `wildfireStart` lights a woodland wildfire at `DRY_FIRE_HOURLY` an hour through the
existing disaster (`disasters.ts`). The day's wind (`Wild.wind`, turned a little each day by `WIND_TURN`) rides on the
fire (`Disaster.wind`): a fire spreads `1 + 0.9 cos(angle to the wind)` times as readily downwind (floor 0.1), and
likewise for buildings the fire catches (`fireSpread` in `disasters.ts`, then `fire.ts` `setFire`). A dry fire (`Disaster.dry`) also crosses grass (0.8) and
fields' soil (0.5). Burnt woods are marked `LandMap.rich` and come back after `RICH_DAYS` with `RICH_POOL` times the
pool (`regrow.ts`). The old (wind-less, forest-only) fires of `disasters.ts` behave as before.

**Rivers that move** (`sim/rivers.ts`). When a flood ends, `maybeShiftRiver` (`RIVER_SHIFT_CHANCE`, rare) may cut a new
channel `RIVER_SHIFT` cells to one side over a 15-cell stretch near the town; the old bed turns to fertile silt with an
oxbow pond left in the middle. Fields and huts in the way are lost (`demolish`), road and planned-street cells under it
go (so a bridge there is lost; the streets replan). It never crosses the camp, the seat, the ring wall's rect, a place
or a mountain, loses at most six buildings, and is tried on a copy: it is made only if everything the camp could walk to
before is still reachable (`reach`). People and herds standing in the new water are set on the bank.

**Seen.** `Snapshot.wild` (`wildView`: herds, packs, wind in px) feeds `map/mapWildlife.ts`, which draws the herd
members around each sim herd from the existing wildlife atlas (the DawnLike critters cut by
`tools/compose-wildlife.cjs`), and the packs.

Tests: `test/wild.test.ts` (seeding, migration, overhunting and recovery, a hungry pack's band, woods spreading, fire
downwind and through dry grass, richer regrowth, a river move keeping the land walkable).
