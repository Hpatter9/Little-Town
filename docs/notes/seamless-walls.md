## Walls, grates and bridges that meet round their corners (branch claude/seamless-walls; the owner's ask: "The walls, when they aren't straight, have bad connection on the many corners; make it look seamless. Same for the grates when the wall is going over water. And same with bridges, paths over water. If the path turns, one bridge dead-ends into the other visually; fix that.")

Changes HISTORY "The ring wall" (its **Continuous walls** and **Palisades that join**: the box-corner joins `nw`/`ne`/
`sw`/`se`, the side posts `v`/`ve` and `POST` are gone), "The wall's purpose" (the **Grates** bullet: they are no
longer a straight run turned down a column) and "The merfolk rework" (the **Piers** bullet: `drawPier` is gone, every
road over water is laid by `drawBridge`). Renderer only: the sim's hashes are unchanged (`tools/sim-hash.mjs`).

- **The autotile (`src/renderer/art/autotile.ts`, pure, tested):** a cell's mask has a bit for each side the line goes
  on past (`N` 1, `E` 2, `S` 4, `W` 8: `maskOf(has)`), and its piece is named by those arms (`pieceOf`: `'post'` alone,
  `'n'`..`'w'` ends, `'ew'` a run along a row, `'ns'` one down a column, `'es'`/`'sw'`/`'ne'`/`'nw'` corners, `'nes'`,
  `'esw'`, `'nsw'`, `'new'` T-joins, `'nesw'` a crossing; `armsOf` back). A wall's join is its piece, and the sides
  where it stops against a grate after a slash (`wallJoinOf(mask, capped)`, `'ew/2'`; `readWallJoin` reads it, and
  the old `h`, `v`, `ve`, `end` as their pieces). `bridgePiece(road, wet, diag)` says how a bridge cell is drawn: the
  way its boards run (`along`), its rails (every side no road goes on), its banks (a road going on over land) and its
  posts (a corner where a rail stops: the way it would run on along is taken by a deck coming in round the corner,
  which the diagonal tells, or the bridge steps off onto a bank).
- **The joins (`MapView.wallJoin`, map/mapView.ts):** the mask over the cells of walls, gates and grates
  (`wallCellsNow`, once a sync, now with the grates' cells apart); a wall's sides against a grate are capped. Worked
  out when a piece is synced (it's in the piece's `sig`), not each frame. A palisade gate keeps its own joins.
- **The pieces (`src/renderer/art/wallTiles.ts`, pure, tested):** each set draws all sixteen pieces as parts from its
  pack's own tiles; map/packBuildings.ts hangs them on the picks by `Pick.tile(join, id)`, tried before `Pick.joins`
  (the graded copies for the other peoples keep it, so every people's wall joins).
  - `palisadeTile` (the Village pack): a run along a row is the pack's run (`PAL_TOPS`/`PAL_FEET`, one of three by id);
    half of it on each side the wall goes on where it turns or a way joins; the pack's own run ends (`palisade07`/`15`
    the west end, `08`/`16` the east) where it stops; wherever it goes on north or south the pack's side-wall stakes
    (`palCol`, cut from `palisade17`) down the middle of the cell (`PAL_COL_X` 9), before the runs it meets, over the
    cell above too when it goes on north, a stake's point (`palisade42`) on top where it doesn't. Everything meets down
    the middle, so the steps of a star fort's bastions or a round ring meet the next step's and the line reads as one.
    A side capped against a grate ends in a column of stakes at the cell's edge.
  - `stoneTile` (the Dungeon pack's `dwalls`, for stone, brick, concrete and force walls, graded as before): along a row
    the face of the pack's free-standing block (`STONE_ROWS`: its cap, courses repeated to stand it 80 px tall, its
    foot), cut clear of the column the pack draws over the block (the old `STONE_WALL` crop had that column in every
    cell, the stripes), its outline where it stops (`STONE_LEFT_X`, `STONE_RIGHT_X`); down a column the pack's narrow
    wall top (`STONE_STRIP`) raised to the face's height, its rounded end where it starts, the block's end face under
    its south end; where they meet, the top passes over the face as the pack's own crossing has it. A lone piece is a
    pillar of the block.
  - `grateTile` (DawnLike's fence set, `src/renderer/art/packs/dl_grates.png`, a row per material: wooden, iron, pale):
    the set's own corners, T-joins and crossing by mask (`GRATE_COL`); ends and a lone grate take the run they lie in.
    The water is the ground under it; the walls either side end at a proper end where they meet it (capped).
- **Bridges (`drawBridge`, art/groundDetail.ts; called from map/groundArt.ts as each ground chunk is drawn):** every
  road cell over water, by `bridgePiece` from its road neighbours (over water or land) and diagonals, laid from the
  Craftpix Bridges pack's wooden bridge (`src/renderer/art/roads/bridge_parts.png`, `BRIDGE_PARTS`): a bridge with a
  way on north or south has the north-south bridge's deck (its boards across), widened to the cell's edge on any side a
  road comes in; one running only east or west the east-west bridge. A rail on each side no road goes on (a dead end
  over the water gets the other way's rail across it); the pack's end boards and posts where it steps onto a bank; a
  post where a rail stops because a deck joins round the corner. So a bridge that turns, two that meet, and a street
  joining a bridge from the side all join deck to deck; no deck runs into another's rail.
- **Footpaths and roads:** the roads were already laid by quarter-tiles from each cell's neighbours (art/roadTiles.ts,
  `roadTiles.json`); the test now checks every road style has every quarter. Worn footpaths are blobs of worn earth
  (`drawWornPatch`), not tiles, so they have no corners to join.
- **The cutter:** `tools/compose-walls.cjs` (run by hand) cuts `dl_grates.png` from DawnLike's `Objects/Fence.png` and
  `bridge_parts.png` from the Bridges pack's sheet. New palisade tiles copied in: `palisade07`, `08`, `15`, `16`, `42`;
  the corner and side tiles no longer used are removed (`palisade09`, `14`, `30`, `33`, `38`, `41`, `46`, and
  `dl_fence.png`). Credits in CREDITS.md.
- **Test:** `test/autotile.test.ts`: every mask has its own piece and names its arms; each set (palisade, stone,
  grates) has a piece for every mask, reaching the cell's edges its arms go out to and no others; a lone cell is a post
  or pillar; every bridge piece has no rail across a way a road goes on, a rail on every side none does, posts where
  a deck turns and at the banks; every road quarter-tile is there.
