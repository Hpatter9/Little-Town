## Paths by hand: the town lays none of its own, and a drag shows its blueprint (branch claude/paths-by-hand)

The owner: "Remove all code about automatic paths being placed. I want to place them myself to help guide the town
shape." and "When building paths, do a better job drawing the path as it's being dragged in. Tap it in at one spot, and
drag to a new area and it shows the blueprint. Only placing it once the finger is removed." Changes HISTORY.md "Streets
are built", "Faster paths", "The town plan" (sim/layout.ts), "The road to the daughter village", "A village's road
finds its way", "Tunnels", "The build menu: the founder builds" and this branch's forerunner, "Paths drawn by hand"
(docs/notes/path-blueprints.md).

- **No street laid by the town.** Every place the sim planned or laid a street of its own is gone:
  - `connectRoad` (`sim/buildings.ts`, a street from each new building's door, on placing, upgrading, and the great
    enemy's monument) and `layStreet`, `nearestStreet`, `ROAD_REACH`, the bridge, pier and wild costs;
  - `planStreets` (worn footpaths made streets), `gatePaths` (a street to each ring gate, `GATE_PATH_OUT`,
    `GATE_RETRY_HOURS`, `GameState.gateTried`) and `layAll` (`sim/streets.ts`); `streetsHourly` now only lifts roads
    off the ring wall's line (`liftRoadsOffWall`);
  - the town plan's paved square and main streets (`ensureLayout` no longer paves; `extendMains`, `layoutHourly`,
    `MAIN_CLEAR`, `STREET_AHEAD`, `planBias`, `OFF_PLAN` gone, `sim/layout.ts`). The plan still picks each building's
    quarter and keeps its lines clear;
  - `tunnelThrough`, `TUNNEL_DETOUR`, `TUNNEL_COST` (`sim/tunnels.ts`: the main streets' tunnels);
  - the "Lay the streets" order (`orderStreets` command, `GameState.streetsOrder`, `Snapshot.streetsOrdered`, its row
    in the build menu's Town tab).
  Saves: nothing new is saved and the version is unchanged; streets and planned streets an older town has stay as they
  are, and its builders pave what was planned. Old `streetsOrder`/`gateTried` fields are ignored.
- **Footpaths** (`LandMap.wear`) are only a look on the ground and walking speed: they never became real path tiles but
  through `planStreets`, which is gone, so they are left as they were.
- **What needed a road.** Nothing in the sim stops without one: people, carts, caravans and raiders walk the land by
  `findPath` (roads only make it quicker), the ring wall puts a gate on each side as before (and where a drawn street
  crosses its line), and street lamps stand on whatever streets there are. A building's need is shown instead:
  `hasPath(s, b)` (`sim/buildings.ts`: its door cell or a cell beside it a street or planned one; `NO_ROAD` kinds and
  castle rooms always have) puts "No path to its door: draw one with ⛙" on its tap card (`renderer/main.ts`) and "A
  path to its door (⛙)" in its card's Needs (`panel/buildingCard.ts`). `findSpot`'s `byPath` still puts ordered
  buildings beside a drawn path where it can.
- **A daughter village's road** (`sim/villageRoad.ts`) is the path the player draws: once a day at `VILLAGE_ROAD_HOUR`
  `trace` looks for a way over streets and planned streets from within `ROAD_NEAR_VILLAGE` (VILLAGE_R + 3) of the
  village to within `ROAD_NEAR_TOWN` (3) of the town's front (a breadth-first search, deterministic), and takes it as
  `Village.road`; then both ends pave it as before. A village with none is told once, at its founding: "Draw a path from
  <name> to the town, and both ends will build the road." (`VillageRoad.told`). The wild-ground road, the way round a
  row of houses, the retries (`ROAD_RETRY_DAYS`, `failed`, `sig`) are gone.
- **Tunnels by hand.** A drawn path may cross a thin ridge of rock (`thinRock`): `refusalOn` lets it, and the builders
  cut it as before (`TUNNEL_SECONDS`).
- **The rule shared with the preview** (`sim/pathPlans.ts`): `PathGround` (land, explored, origin, what stands where,
  the ring wall's and the castle's cells, the thin rock) from the state (`pathGround`) or from the snapshot;
  `refusalOn(ground, x, y)`; `pathRefusal(s, x, y)` is the two together. `pathRoute(a, b, ok)`: a straight run, or two
  at one corner, the corner with more cells a path can take, on a tie along the longer way first.
- **Drag to draw** (`renderer/main.ts`, ⛙ mode): a finger down on a cell starts the path (on a cell of blueprint, a
  lift); past `DRAG_THRESHOLD` the preview follows the finger along `pathRoute`, drawn by
  `IsoView.setPathPreview(cells, lift)` (`iso/isoView.ts`, in `drawMarks`): a gold diamond on each cell it will lay, a
  red crossed one on each blocked cell (skipped), red ones for the cells a lift will take up. The banner tells the
  cells, the bridges and their wood (`BRIDGE_WOOD` a cell), the tunnel cells and how many are blocked. Lifting the
  finger sends the whole run as `drawPath` orders (`PATH_CAP` a command); a tap lays the one cell (or says why not);
  a second finger, or the page taking the touch (`pointercancel`), drops the drag with nothing laid. Done and Cancel as
  before. The old tap-to-extend from the last cell is gone. The banner (`renderer/index.html` `#banner`) now centres
  with margins rather than `left: 50%` (which held it to half the screen), its detail wraps and its buttons keep their
  width; sideways on the phone it sits at 44px, below the page's clock bar, as the minimap does.
- Tests: `test/streets.test.ts` (a worn footpath stays one; a drawn bridge; no gate path, a path drawn through a gate;
  no street to a new building, `hasPath`; a town left to run two days, with and without `townBuilds`, lays no path),
  `test/layout.test.ts` (no street at the founding or as the town grows), `test/villageRoad.test.ts` (rewritten for drawn
  roads), `test/pathPlans.test.ts` (`pathRoute`; the snapshot's `refusalOn` matches the sim's), `test/relief.test.ts`
  (a drawn tunnel), `test/ringRoads.test.ts`, `test/buildings.test.ts`, `test/villages.test.ts`, `test/buildMenu.test.ts`.
- Screenshots (`docs/notes/paths-by-hand/`, a new town each, paused, a touch drag sent by Playwright through CDP):
  `upright-dragging.png` and `sideways-dragging.png` (the preview mid-drag, the blocked cells over the house and the
  wood crossed in red, the cost on the banner), `*-laid.png` (after the finger lifts: only the open cells laid, as the
  dotted ghost), `upright-pinch-cancelled.png` (a second finger mid-drag: nothing more laid).
- **Asked of the owner:** the daughter village's road was a road the town laid of its own, so it went with the rest;
  if the owner wants the village to keep building its own road, it can come back as a recommendation instead.
