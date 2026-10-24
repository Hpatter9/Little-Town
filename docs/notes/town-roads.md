## Town roads: the town lays its own streets again, as a planned layout (branch claude/town-roads)

The owner: "Let's go back to roads being built automatically by the town. Just make sure the roads make sense for a
town layout." Changes HISTORY.md "Streets are built", "The town plan" (sim/layout.ts) and docs/notes/paths-by-hand.md
(0.209.0, which took every automatic street out). The player's drawn paths and the drag tool stay as they are.

- **What the town lays** (`sim/townRoads.ts`, all of it with the autopilot on and a town plan laid; a tribe on the move
  lays none):
  - **The square** before the seat (the plan's `sq`, 11 by 5), paved: at once at the founding (`ensureLayout` calls
    `planTownRoads(s, now)` when it lays the plan), planned for the pavers in an older town. Cells built on are left.
  - **The main streets** (`mains`): the high street west and east and the road south, straight along the plan's lines,
    `STREET_AHEAD` (4) cells past the town's furthest building, so they reach the ring wall's gates (which already stand
    where these lines meet it, ringWall.ts `gateCells`), and on through a gate `GATE_PATH_OUT` (3) cells. A river up to
    `MAIN_BRIDGE` (6) wide is bridged and a thin ridge (`TUNNEL_THICK`) tunnelled straight across; a building, a wood or
    the wall's line ends the street, and the side streets find the way round.
  - **A street from each gate** in (`gateStreets`): from the cell inside the gate to the streets that reach the square,
    then out beyond it a few cells. A gate is two cells along the wall: one whose other cell a main street already runs
    through gets no second street beside it.
  - **A side street to each door** (`roadToDoor`): planned when the building is ordered (buildings.ts `placeBlueprint`
    and `upgrade` call `streetForNew`), so the builders lay it with the building. Buildings that want none
    (`wantsStreet`): fields, pens, walls, defences, the fire, castle rooms, ring pieces, and a home in the sea of a
    town that swims (the merfolk). A door built in front of since is reached from beside it; with no way yet, the
    cell before the door is planned all the same, so nothing is built in front of it.
  - **The player's paths joined** (`joinPaths`): a drawn path (`JOIN_MIN` 2 cells or more, near the town) cut off from
    the streets gets a side street to them. The town never lifts a path of the player's.
  - Every `ROADS_EVERY` (6) hours (`townRoadsHourly`, from streets.ts `streetsHourly`) the whole plan is seen to:
    mains kept ahead of the town, gates, every door not yet reached, the player's paths. An older town (only the
    player's paths, or no streets) gets its square, mains and side streets planned from then on, round what stands;
    nothing laid or planned is taken up.
- **How a side street finds its way** (`route`): a search over (cell, heading) from the door (or every cell of a cut-off
  path) to `network(s)`, the streets joined edge to edge to the square. Only cells a path may take (pathPlans.ts
  `refusalOn`: seen, nothing built, the ring wall only at a gate, a river as a bridge, a thin ridge as a tunnel) or wild
  ground to clear. Each step costs 1, plus: `TURN_COST` 3 a turn (straight runs, clean corners; no turning inside a
  bridge or a tunnel); `PARALLEL_COST` 6 beside a street running the same way one or two cells off, and `BLOB_COST` 10
  on a cell that would make a square of four street cells (no doubled or parallel streets); `BRIDGE_COST` 10 a bridge (`PIER_COST` 2.5 a pier in a shore town); `TUNNEL_COST` 7; `WILD_COST` 3
  on bare wild ground (cleared as it's planned); `WOODS_COST` 6 through a wood or rocks (marked for the axe and the pick,
  and paved once cleared: streets.ts `uncleared`); `CLIFF_COST` 8 up a cliff (the street cuts steps, as before);
  `OFF_PLAN` 0.9 off the plan's lines in a town laid out in blocks; `ON_STREET` 0.3 along a street already there. Up to
  `ROAD_REACH` (60) cells, 60000 states. Deterministic (ties to the lower state), no randomness drawn.
- **Paving** is as before (`paveTask`, `pave`, `streetWork`; a bridge takes `BRIDGE_WOOD`), with two changes in
  streets.ts: a planned cell still wooded or rocky waits for clearing (`uncleared`, in `ready` and `paveOrder`); and
  while the ring wall is going up only hands with nothing else to do pave (`paveTask` without `spare` returns null), so
  the streets never hold up the wall (wallAsOne's test of the whole wall raised before a pausing event).
- **Spots along the streets** (layout.ts `layoutSpot`): a door on or beside a street counts 3 better (was 1), one within
  `STREET_NEAR` (3) cells of one 1 better, so buildings go up along the streets or with a short side street.
- **Upgrades** (buildings.ts `upgrade`): a bigger footprint that pulls down small things in its way (and lifts a street
  under it, as before) may no longer stand over the cell before another building's door (that door would open onto a
  wall). A side street an upgrade cuts is joined up again round it at the next sweep (`roadToDoor` routes from the
  door's street and every cell joined to it).
- **Regrowth** (regrow.ts): a planned street is kept clear of regrowing woods, as a laid one was.
- Saves: no new state field, no version bump. Older towns' streets and planned streets stay; the plan is fitted round
  them.
- Tests: `test/townRoads.test.ts` (the founding's square and mains; a door's street planned with the order; one corner
  on open ground and round a field; round a short wood; a gate joined and its street out; a drawn path kept and joined;
  a settlers' and an orcs' town left to run six days, by `test/roadAudit.ts`: every door within a cell of a street, every
  door joined to the square, no two-by-two of street outside the square, no three-long runs side by side a cell apart,
  no street on a field or pen; the late-town fixture given a plan, nothing torn up). Changed: `test/layout.test.ts`
  (the square is paved and each home's door gets a street), `test/streets.test.ts` (its "the town lays no path" tests
  now say "with no town plan"; the town-left-to-run test moved to townRoads.test.ts with the new rule).
- Tools: `tools/roads-map.mjs <origin> <seed> <days> [--biome=] [--r=] [--save] [--ascii] [--why] [--out=]` runs a
  town (`townBuilds` on, standing in for the player's orders) and writes a cell picture and the audit at each day
  (dark brown laid, tan planned, buildings by kind, light while blueprints; the light grey rings are the next ring
  wall's blueprints); `--save` writes the game at the next midday for screenshots.
- Pictures (`docs/notes/town-roads/`): `map-<people>-d10/20/40.png` (settlers in the forest, knights in the highlands,
  orcs on the steppe); `shot-<people>-d<day>-upright.png` / `-sideways.png` (the phone
  page at 393x852 and 852x393, the save loaded and continued); `before-after-d10/20/40.png` (the same seed under 0.206,
  the last version with automatic streets, beside this one).
- How it measured (`tools/roads-map.mjs`, the audit above, eleven towns of nine peoples to day 20, three to day 40):
  no street on a field or pen anywhere, every gate reached, no parallel streets a cell apart, every door on a street
  (but a tribe on the move, which lays none). Left over: in two towns a single square of four street cells by a two-cell
  gate (the orcs, the settlers' `roads-a` seed), and in one (the orcs' `roads-orcs-d`) one door shut in on all sides by
  buildings put up round it later, its cell kept as street but no way out (the town picks spots without asking whether
  another door can still be reached).
- Not done: a dead-end street left by a building pulled down stays (the town never lifts a street); a building put up
  round another's door can shut it in (above).
