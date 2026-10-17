## Mountains in every land (claude/mountains; the owner's ask: "Mountains should be a part of every terrain to some extent. Whether it's sparse hills or full-on mountains. The town either has to use it, mine it, build into it, tunnel through it, or go around it.")

Every land founded from now on has relief: hills, rocky ground, cliffs and, in the mountain lands, true ranges. This
changes "Ten lands" (each `BiomeDef` has a relief table), "Phases 1 and 2" / "The wide land" (`makeLand` lays the
relief last; `stepCost` and `findPath` read it), "Solid mountains" (the ranges and outcrops are the same solid rock),
"Streets are built" / "The town plan" (main streets stop at a cliff and tunnel through a thin ridge), "Tactics battles"
(the board seals off pockets cut off by rock), "Phase 4, more farming" and "Animal husbandry" (hill yields) and
"Minerals" (a quarry and each land's vein).

- **Save safety.** A town's land is kept in its save (`land.cells` and everything else), so **towns founded before
  this keep their land exactly**: no relief, nothing new happens on it. Only new towns get relief:
  `newGame(seed, { relief })` lays it unless `relief: false` (state.ts `NewGameOptions.relief`), and
  `makeLand(seed, biome, shape, relief = false)` lays a level land byte for byte as before (`test/relief.test.ts`
  checks five lands' digests against the old code). Everything new keys on `land.relief` being there, and anything the
  planner does with it runs with the autopilot only. `tools/sim-hash.mjs`: the fixture and hash-a to hash-d are
  identical to main (they are founded with `relief: false`); **hash-e** (settlers, founded with relief) is new, for
  later chats to watch.
- **The layer (`sim/relief.ts`, `LandMap.relief?`).** One character a cell: `0` level, `1` the downs (rolling hills),
  `2` rocky hills (with outcrops of solid `mountain` rock among them), `3` high ground (a shelf ringed by cliffs), `4`
  a ramp up onto it, `5` a range (solid `mountain` rock). `layRelief` runs after the rest of `makeLand`, on its own
  streams (`hashSeed(`${seed}:relief`)` and its own noise salts), so every cell it leaves alone is the cell that seed
  always made; it changes the ground only where it lays rock or cuts a pass. A broad swell plus a ridged field, low by
  the camp, ranked: the top share the range, then the high ground, the rocky hills, the downs (`DOWNS_NEAR` 7,
  `OUTCROP_NEAR` 12, `HIGH_NEAR` 14, `RANGE_NEAR` 16 cells from the camp at least, so the land known at the start is
  as it was). A land with a range has it along one side, the north mostly: the town plan grows south of its square,
  so the town has its back to it. Passes wind through a range where a pass field runs near its middle.
  Every open cell can be reached from the camp and back: a pocket of open ground shut in by rock is filled
  (`POCKET_FILL` 40) or has a pass cut to it; a shelf smaller than `HIGH_LEAST` 10 is only rocky hill; every shelf has
  a ramp nearest the camp and one more each `RAMP_EVERY` 70 cells, and `rampFix` adds ramps (late on, levels a shelf)
  till the camp reaches every cell and every cell the camp, the way walkers go.
- **The tables (`data/biomes.ts` `relief`, shares of the whole land).** Forest 0.10 downs, 0.04 rocky, 0.03 high,
  0.02 range; desert 0.07/0.06/0.05/0.03; tundra 0.10/0.05/0.04/0.06; coast 0.06/0.02/0.01/0; fens 0.04/0.01/0/0;
  jungle 0.08/0.03/0.03/0.02; highlands 0.14/0.07/0.06/0.10; ashlands 0.08/0.07/0.05/0.08; steppe 0.06/0.015/0.01/0;
  taiga 0.09/0.04/0.04/0.06. `reliefShares(m)` measures a land.
- **Walking.** `stepCost` multiplies a cell's ground cost by `RELIEF_COST` (downs 1.15, rocky 1.25, high 1.05, ramp
  1.15). `findPath` refuses a step that **climbs** a cliff (`climbs`: onto a `3` cell from below it, but where either
  cell is a street: a street cut up the face makes steps); a drop off the high ground is a jump, always allowed.
  `PathOpts.climb` ignores cliffs. The ranges and outcrops are `mountain`, already impassable. Ramps are kept clear
  (`fits`, and `canPlace` but for the ring wall's pieces).
- **Mine it: the quarry (`data/hills.ts` `QUARRY_BUILDING`, 3 wide, 12 wood and 4 fiber, no study).** `againstRock`:
  it stands only with `QUARRY_ROCK` 2 cells of rock along its sides (`rockBeside`; `canPlace` refuses it otherwise),
  and only on a land with relief (`isUnlocked`, via `unlockInfo(s).relief`, so a level town's planner never sees it).
  A workplace (`WORKPLACES.quarry`: 3 stone a load, 35 s, 2 workers), worked by the usual mine task; each load holds
  the land's vein (`QUARRY_VEINS`: flint in the forest, coast and steppe, copper ore in the desert and jungle, tin ore
  in the tundra and taiga, iron ore in the highlands, sulphur in the ashlands, clay in the fens) and in the highlands,
  ashlands and desert a gem every `QUARRY_GEM_EVERY` 6 loads (counted on the quarry, `Building.dug`:
  `sim/farming.ts` `quarryLoad`). The planner wants one once a face of rock lies in reach (`rockSpot(s, def,
  'beside')`, within `QUARRY_REACH` 12 of the town's reach); with no face it never clears land for one. So a rocky
  town quarries and a plains town mostly doesn't. **The shaft to the Deep** opens against the rock where a face is in
  reach (`findSpot`'s `shaft` case), else where it always did.
- **Build into it (`BuildingDef.intoRock`: the stockpile, the cottage, the longhouse and the graveyard).** Cut into a
  cliff face: the footprint's back row in the rock with more rock behind it (`cutInto`), the door at its front on open
  ground. `canPlace` lets such a building's top row stand on rock when the footprint is cut in; `placeBlueprint` marks
  it `Building.cut`. The planner (`findSpot`) cuts up to `ROCK_FEW` 3 into a face within `INTO_REACH` 4 of the
  town's reach before looking for flat ground, and any number where it finds no flat ground.
- **Tunnel through it (`sim/tunnels.ts`).** A main street of the town plan (`layout.ts` `extendMains`) that runs into
  rock, where the ridge is at most `TUNNEL_THICK` 6 cells thick, the ground past it open, and going round more than
  `TUNNEL_DETOUR` 24 cells longer than going through (or impossible), is planned through it (`tunnelThrough`). Any
  other street the town plans (`buildings.ts` `layStreet`: a building's road to the streets, a gate's path) may go
  through thin rock too (`thinRock`: a range's or an outcrop's cell with a run of rock of `TUNNEL_THICK` or fewer one
  way or the other), each cell of it costing the search `TUNNEL_COST` 7 against a road's 1 (`PathOpts.bore`), so it
  tunnels only where going round is far longer; in the soaks it was mostly the way to a quarry. The
  pavers cut it a cell at a time like a bridge, slowly (`TUNNEL_SECONDS` 150 a cell, `streets.ts` `paveSeconds`); a
  cell cut is dug ground (`hall`) under the street, and its `TUNNEL_STONE` 3 stone go to the stores. Walkers and
  raiders both take it (a street is the cheapest ground: the raiders' trails are `findPath`s, `battle.ts` `leg`). Never
  in a castle or a hold (`tunnelsHere`), whose dug ground is its rooms. A main street also stops at a cliff's foot or
  top but at a ramp (`cliffAhead`).
- **Go around it.** `findPath` already refused rock; main streets stop at it or tunnel; the ring wall's line was
  already left open where it meets rock (the rock is the wall there: `ringWall.ts` `missingPieces`), so a range or an
  outcrop on the line closes it. The tactics board (`tactics.ts` `sealPockets`) makes ground its window cuts off from
  the town's row by rock into rock too, so every board stays whole (`test/tacticsTerrain.test.ts`).
- **Use it (`sim/hills.ts`, `data/hills.ts`).** By the share of a footprint on hill ground (`hillShare`): a field's
  harvest × `HILL_FIELD` 0.9, an orchard's or a vineyard's × `HILL_ORCHARD` 1.25 (`hillHarvest`, in `workField`); a
  pen's yield × `HILL_GRAZING` 1.2 (`hillGrazing`, in `workPen`); a windmill's grinding × `HIGH_WIND` 1.25 (`hillWind`,
  in the craft task); a tower on the high ground is placed on the raid map's trail from `HIGH_SIGHT` 1.25 times its
  range (`highSight`, `battle.ts`). The town plan (`layoutSpot`) puts orchards, vineyards, pens and the windmill up on
  the hills and the other fields below, and its defences on the high ground. **Not done:** the watchtower's raid
  warning and the towers' shots in the town fight are worked out in `sim/raids.ts` (`lookoutOf`, `fireDefenses`), kept
  out of this branch while claude/stuck-foes works there: `warningMinutes * highSight(s, lookout)` and
  `d.range * highSight(s, b)` are the one-line hooks.
- **Drawn (`map/reliefArt.ts`, called from `groundArt.ts` `paintChunk` in a block of its own after the mountain's
  edges, its key in `chunkKey` via `reliefKey`).** Hill country shaded as it rises and falls (`heightAt`: the cells' rise blended
  between their middles plus a swell of its own, lit from the north-west like the mountain, in 4 px blocks), each form
  with a cast of its own (the downs' sunlit grass, the rocky hills' grey, the high ground's light), grey stones among
  the rocky hills; the high ground's brow lit, its
  cliffs a face of the mountain's own stone columns (`mountainArt.ts` `faceColumn`, `faceHeight`, now exported) under
  the Undead tileset's jagged overhang (`art/under/cliff.png`) below a shelf's southern edge, a dark rim on its east and west, a shadow at the foot of a face to the south; a ramp's steps; a
  tunnel's cells darkened (`art/relief/cave_mouth.png` at each mouth, drawn after the roads). The
  outcrops are painted as rocky ground (`paintLand`: their cells read as `rock` to the chunk painter, so the mountain's
  mass and jagged edges are kept for the ranges) with a boulder from the Rocks pack stood on each
  (`mapView.ts` `syncOutcrops`, `art/relief/rock_*.png`: mossy, slate, desert, snowy, grey and canyon by the land's
  look, the snowy in winter and in the cold lands; big where the rock runs on, small at its edge). The quarry is the
  Rocky Area pack's plain stone cave entrance (`art/packs/rocky_adit.png`, `packBuildings.ts`), as is a tunnel's mouth,
  drawn over the street where it enters the rock. The ranges keep the mountain
  art (`mountainArt.ts`). No evening shadow off the mountains yet.
- **Tests: `test/relief.test.ts`** (level lands as before, relief only adds rock and passes, each land's shares near
  its table, every cell reachable both ways, paths never on rock nor up a cliff, a tunnel through a ridge with no way
  round and none where the way round is short, a building cut into a face with rock behind it, the quarry against
  rock only and its veins, hill harvests, a town founded in a bowl of cliffs still grows). Tools:
  `tools/relief-map.mjs [biome] [seed] [shape]` prints a land's relief; `tools/probe-hills.mjs [days] [seeds] [biome]
  [origin]` what towns made of it; `tools/soak.mjs` takes `RELIEF=0` (a level land), `BIOME=` and `HILLS=1`;
  `tools/make-save.mjs` takes `SEED=`, `ORIGIN=`, `BIOME=`, `RELIEF=0`.
