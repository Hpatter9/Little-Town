## Hand-made raid boards, drawn in LDtk

The owner wants hand-made maps for the game's special places, drawn in the LDtk map editor's format, so they can be
edited in LDtk later. The raid battle boards come first, to show what it looks like before the rest (dungeons, story
places, scenario starts, interiors). Eight boards are drawn: when the raiders come, a board that fits the town's land
and the raid is picked most of the time, and the board is cut from the land as before (`makeBoard`) the rest of the
time, or when none fits. This changes HISTORY "Tactics battles" (the board) and "The raid board in the isometric look"
(tile looks and props).

**The format.** `maps/raid-boards.ldtk` is one LDtk 1.5.3 project (checked against LDtk's JSON schema), one level a
board, 17x14 cells of 32px: the raiders come on at the left edge, the town is on the right, and the game lays the
town's wall down the fourth column from the right, with its gate in the two middle rows (tactics.ts `TOWN_ROWS`;
the preview draws that line dashed). Its layers:
- **Terrain** (IntGrid): `grass`, `dirt`, `field`, `forest`, `sand`, `stone`, `snow`, `ice`, `mud`, `shallows`,
  `water`, `cliff`, `road`, `boardwalk`. Each is a ground the rules know (`BOARD_GROUNDS` in `sim/raidBoards.ts`):
  ice and mud are marsh (two moves a tile), a boardwalk is dry going through it, a cliff is the mountain nobody
  crosses, deep water is swum only by the raiders. The values are read by their identifiers, so they may be
  reordered in the editor.
- **Height** (IntGrid `h1`..`h9`): a tile's height in steps where it isn't its ground's own (empty: water, shallows,
  ice and mud 0, a cliff 6, the rest 1). A step of three or more is a cliff (tacticsTerrain.ts `CLIMB_MAX`).
- **Things** (Entities): `Town` (field `line`: `front` for those who strike in close, `back` for the archers and
  casters; the rampart makes a good back line), `Raiders` (field `way`, 1 to 3: where they come on, at the left
  edge), `Cover` (`kind`: tree, bush, log, fence, hay; a tree blocks shots, a log, fence or hay bales are climbed over
  at a cost and cover whoever is behind them) and `Prop` (`kind`: rock, ruin, cart, barrels, crates, woodpile, well;
  nobody crosses them, and a unit beside one is covered from that side; never on the town's side of the wall).
- **Level fields:** `name` (the battle names it: "12 raiders on the field at The Ford"), `about`, `biomes` (an enum
  of the ten lands), `raidKinds` (only these; none: any) and `notRaidKinds`. The size is the level's own.
- **Tileset:** `maps/raid-boards-tiles.png` (relative to the project), made by `tools/compose-ldtk-atlas.cjs` from
  the iso kits' own ground tiles (each diamond's middle cut square) and pieces, so the editor shows the boards in the
  game's colours. The game never loads it.

**The converter.** `node tools/ldtk-boards.mjs` (`tools/ldtk-boards.ts`, the pure part in `tools/ldtkBoards.ts`:
`boardsFromLdtk`, `boardsSource`) turns the project into `src/shared/data/raidBoards.ts` (`RAID_BOARDS`: each board's
ground as rows of characters, its heights as rows of digits, its things as `[u, v, what]`), which is all the sim
reads: nothing parses LDtk at runtime. `test/raidBoards.test.ts` checks the committed data is what the converter makes
of the committed project, so the two can't drift.

**In the sim.** `sim/raidBoards.ts`: `boardsFor(s, r, w, h)` (the town's biome among the board's, the raid's kind
allowed, the size the raid wants; never for a chase, a raid from the sea, or a town with the autopilot off) and
`pickBoard` (a side stream, `new Rng(hashSeed(`${s.seed}:raidBoard:${s.tick}`))`, so the town's stream is never drawn
on; a hand-made board `HAND_BOARD_SHARE` = 0.75 of the time). `startTactics` (tactics.ts) asks for one before
`makeBoard`; `makeHandBoard` lays it over the land round the gate (the same window: `boardWindow`), then the town's
wall, gate, towers and traps go on it as on any board (`dressBoard`). A tile whose ground isn't the land's borrows
the painted ground of the land's nearest cell of it (`nearestGround`, the old pond rule) for the flat view. The town's
fighters start on the board's spots (`Tactics.deploy`: close fighters on the front line first, shooters and casters
on the back line first; any left over on the rows as before), and the raiders come on at its ways in
(`Tactics.entries`, by turns along each way, then the edge as before). New optional fields: `Tactics.board`
(its name), `deploy`, `entries`; `TacTile.look` (snow, ice, mud, planks... for the drawing) and `TacTile.prop` (the
kit piece standing there). Old saves and a raid in progress load: without the fields it is the old board. All 8
boards are 17x14 (`BOARD_W` x `BOARD_H`): a big raid (24 units or more, or a war host) still gets the land's own
21x17 board until big boards are drawn.

**The drawing.** The iso board (`tactics/isoBoard.ts`) draws a tile's `look` with a ground tile borrowed from
whichever kit has it (`LOOKS`: the settlers' dirt and field, the dwarves' flagstones, the Moon Pack's snow, tinted
blue for ice, the orcs' mud, dirt tinted brown with planks across for a boardwalk), and a `prop` from the settlers' kit
whatever the town's people (`PROP_KIT`: every kit has walls, not every one has carts). On every raid board, the
generated ones too, water and shallows are now the merfolk kit's water tile, sand its sand tile and cliffs the dwarves'
rocky tile (`BORROWED`): the town's kit's dirt tinted blue, yellow or grey read as dark ground, not a river, a dune or
a rock face. The flat view washes the look's colour over the land's ground (`LOOK_WASH` in `tactics/tacticsView.ts`)
and draws its rocks and logs as before.

**The boards** (`docs/notes/raid-boards/`: `ldtk-*.png` LDtk's view of each, drawn by `tools/ldtk-preview.cjs`, and
`*-tall.png` / `*-wide.png` the iso board in a real raid on the phone, 393x852 and 852x393):
- **The Ford** (forest, steppe, coast, jungle, taiga, highlands): a river across the field, a wide ford to the north
  and a narrow one to the south; the town holds the high bank behind logs. Three ways: the two fords, and a swim
  through the deep middle.
- **Mill Ridge** (highlands, steppe, forest, taiga): a ridge four steps high with a fallen wall on its brow, ramps at
  either end and a sunken lane cut through the middle under the defenders' feet. Three ways.
- **Hedge End** (forest, steppe, coast, taiga, highlands): fenced paddocks with three lanes between them, each
  stopped with a cart, hedges and crates at the corners. Three ways.
- **Greenwood Clearing** (forest, jungle, taiga): deep woods (no arrow finds a raider under the trees) and a clearing
  before the wall, the town's archers on a knoll. Three ways: two trails and straight through the wood.
- **The Narrows** (highlands, tundra, ashlands, taiga, desert): a pass that pinches to three abreast, the wall short
  between cliffs, and a goat track along a ledge above it that comes down beside the gate. Two ways.
- **Frozen Mere** (tundra, taiga): a frozen lake, slow and open, holed where the ice broke; the long ways round the
  shores through the pines. Three ways.
- **Sunken Court** (desert, ashlands, steppe): a ruined court half under the sand, its broken walls making lanes and
  a dais with stairs in the middle for the town's archers. Three ways.
- **Fenwalk** (swamp, jungle, coast; never the machines): a fen of mud and black pools crossed by three boardwalks to
  the town's island; on the planks the raiders come fast and in single file, off them they wade. Three ways.

**Adding a board in LDtk.** Open `maps/raid-boards.ldtk` in LDtk 1.5, duplicate a level (or add one 17x14 cells,
544x448 px), paint the Terrain (and Height where a tile stands above or below its ground), keep the wall's column (the
fourth from the right) free of cover and props and the gate's two middle rows dry, put at least four `Town` spots of
each line on the town's half, `Raiders` spots in the two left columns on at least two ways, and fill in the level's
fields. Save, run `node tools/ldtk-boards.mjs`, then `npm test -- raidBoards` (it checks the size, the lands, that
every spot can stand and reaches the fight, the converter's round trip). `node tools/ldtk-preview.cjs` draws the
boards top-down. For previews in the browser, `__raidBoard('The_Ford')` then `__raid('bandits', 140)` in the phone
page's console fights the next raid on that board (`boardPreview`, never set in play).
