## Paths drawn by hand, and buildings put beside them (branch claude/path-blueprints)

The owner: "Let me put blueprints for paths. The townsfolk should place buildings next to a path or path blueprint. When
possible." Changes HISTORY.md "Streets are built" (a planned street can now be drawn by the player), "The build menu: the
founder builds, the town picks the spot" (an order's spot prefers a path) and "Land clearing by hand" (a second map mode
beside it).

- **The rule** (`src/shared/sim/pathPlans.ts`, new): a drawn path is a planned street (`LandMap.plannedRoads`, as
  `sim/streets.ts` plans them), so it shows as the same ghost and the builders pave it the same way (`paveOrder`, the
  `pave` task, `PAVE_SECONDS` a cell; over a river a bridge, `BRIDGE_SECONDS` and `BRIDGE_WOOD`). Nothing new is saved,
  so old saves need nothing. `pathRefusal(s, x, y)`: only on explored land (`isExplored`), open buildable ground, or water
  where a street may bridge it (`riverCell`; any water in a shore town, `seaTown`: a pier), never under a building (a gate
  of the ring wall may be crossed), on the ring wall's line (`ringWallCells`) or in the castle (`castleCells`). Wild
  ground (wood, rock, marsh) is refused: clear it with ⛏ first. `drawPath(s, cells, on)` lays or lifts a list,
  `PATH_CAP` (150) at most; a street already down is left alone. `pathLine(a, b)`: the cells between two, edge to edge
  (the renderer joins the finger's cells with it).
- **The command:** `drawPath { cells, on }` (`sim/commands.ts`, checked and capped in `parseCommand`; applied in
  `sim/sim.ts`). Lifting works on any planned cell, the town's own planned streets too.
- **Buildings beside paths:** `findSpot(s, def, byPath)` (`sim/planner.ts`); `planPins` (the player's orders) passes
  `byPath`, every other caller is as before. With it, `flatSpot` keeps the town plan's spot (`layoutSpot`) if its door
  is on a path, else looks for one (`spiralFlat`); `spiralSpot` (`sim/land.ts`) takes `beside` and `besideReach`: in
  each ring a spot whose door is on a path (`onPath`: the door cell or a cell beside it along an edge is a street or a
  planned one) comes first, and up to `PATH_LOOK` (4) rings beyond the nearest spot are looked at for one before the
  nearest is taken anyway. Kinds with no road of their own (`NO_ROAD`, now exported from `sim/buildings.ts`: fields,
  pens, walls, towers, the campfire) are placed as before. `connectRoad` still lays the short way from the door to
  the nearest street.
- **The map** (`renderer/main.ts`): a ⛙ button `#draw-path` above ⛏ (`renderer/index.html`, hidden in battles and
  scenes), or the build menu's Town tab row "Draw a path" (its Draw button sends `startPlacement(DRAW_PATH)`; `DRAW_PATH`
  = '@path' in `shared/ipc.ts`, let through by the desktop's `startPlacement` handler). While on, the banner reads
  "Drawing a path" with Done and Cancel (`Banner.show` takes an optional `done`, `overlayUi.ts`). A drag lays cells
  under the finger, each joined to the last with `pathLine`, sent as it goes so the ghost follows; a press that starts
  on a cell of blueprint lifts instead. A tap lays a straight run from the last cell laid (or the one cell); a tap on
  blueprint lifts it. Cancel sends back what this go laid and lifted; Done keeps it. Clear mode and placing a building
  end the mode, and it ends them. A second finger (pinch) drops the stroke.
- **The banner held sideways (all its modes: placing, clearing, drawing):** on the phone held sideways the title bar lies
  over the strip's top and hid the banner's Done and Cancel. `layout()` in `mobile/mobile.ts` sets the strip's
  `--top-cover` (how far the title bar reaches over the strip, page px; 0 upright) and `body.embedded #banner` hangs
  that much lower.
- **Drawn in the iso view:** `IsoView.drawMarks` now draws every planned cell (the town's streets too, which the iso view
  never showed): a faint bed and a dotted line from its middle towards each planned or paved neighbour. Redrawn when
  the land's `plannedRoads` string changes (`plannedSeen`). The top-down map already drew planned streets.
- Tests: `test/pathPlans.test.ts` (the command's checks and cap; `pathLine`; laid on open ground and a river, refused on
  a lake, a wood, a building and unexplored land; lifted; paved by the founder; an order's door on the path, and the
  nearest spot when the path is out of reach; an order through `pinBuilding` laid beside it; saved and loaded, an old
  save with no plan takes one, the same strokes give the same plan).
