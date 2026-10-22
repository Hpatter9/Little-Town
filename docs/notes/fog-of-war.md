## Fog of war

The land is black until someone sees it, grey once seen and left, clear while in sight. Phone first; iso is the main view.

**Sight (sim).** `data/sight.ts` holds every number: townsfolk see `SIGHT_BASE` 8 cells (+1 the founder, +1..4 for rangers, hunters, archers and the like via `SIGHT_CLASS`, -2 at night but never under `SIGHT_LEAST` 4); a finished building sees `SIGHT_BUILDING` 4, a ring-wall piece 2, and a watchtower, any gate or the seat `SIGHT_TALL` 12, so the town is never fogged. People away on an expedition see nothing here.

**Explored land (sim, saved).** `sim/fog.ts`. `GameState.explored?: string`, one character a cell ('1' seen), like `land.wear`. `fogTick` runs in `sim.ts` every `FOG_EVERY` 5 ticks (it is a rule of the world: it runs with the autopilot off too). A town with no `explored` (new, or an older save) starts with `START_EXPLORED` 16 cells round the camp plus everything its people and buildings see. The save packs it as bits in base 64 (`packedExplored`, about 6 KB, like `packedPools`); `parseSave` unpacks it. No save version bump. Byte arrays are cached per state in a `WeakMap`, and rebuilt if `explored` is replaced (a loaded save).

**What is in sight now** is worked out in the same pass and put in the snapshot as `sight` (a string like `explored`; `explored` is in the snapshot too). I chose the sim over the renderer because the sim already has every person's class and the night, and one pass over disks is cheaper than the renderer redoing it from the snapshot; both are plain strings, so the phone worker's diff compares them cheaply (primitives). `snapshot()` starts the fog if it isn't started (idempotent, deterministic).

**Drawing.** `map/fogLayer.ts` (+ pure `map/fogRules.ts`): one sprite the size of the land, painted from a pixel-a-cell canvas, stretched with linear filtering, 3x3-blurred for soft edges, eased toward its target and painted again at most every 110 ms and only while the fog moves. Black is opaque; seen-and-left is a cold grey veil (`GREY_ALPHA` 0.6, `GREY_RGB`) with a cloudy noise texture, which mutes the land and buildings as last seen. It goes in `iso.lightLayer` (already on the diamonds, over the world) with no change to `isoView.ts`, or in `map.world` for the top-down map. The minimap draws the same canvas over its ground (`Minimap.fog`). Raiders, roaming bands, strangers, travellers and couriers outside sight are filtered out in `main.ts` (`inSightOnly`); wildlife hides itself through `MapWildlife.seen`. Ambient bees, crows and birds are not hidden.

**Old dimming.** The ground art's own fog of the land beyond `land.open` (`visibility()` in `groundArt.ts`) is untouched and shows under this one.

**Later, the owner's choice.** Fog changes nothing else. It could limit building to explored land, make the planner and the order menu pick spots only in explored land, have raids and quests start beyond the sight, make scouting and watchtowers matter, or reveal land for expeditions.

Test: `test/fog.test.ts`.
