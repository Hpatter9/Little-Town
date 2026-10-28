## The grid: every settler piece on whole cells

The owner's ask: "Make sure all assets fit in the tile grid better. We need to implement a full grid system that has to
be used, and all assets must follow it ... they look pretty off now and I want this game to feel more polished." First
an audit and a proposal (below, "The audit"); the owner approved the rules ("YES"), and chose, for a building bigger
than its picture, to keep its footprint with a yard round the picture until new art comes. Then the settlers (the one
people playable) were brought into line. Renderer and art only: no rule of the simulation, no footprint and no building
id changed, nothing new in `GameState`, so old saves are untouched. Changes the HISTORY.md sections "The isometric view,
begun", "The iso town, filled in", "The isometric art", "The ring wall" (its look only) and "Animal husbandry" (the pens'
look).

### What the player sees now

Before and after, the same town (`tools/grid-town.ts town`): `docs/notes/grid-audit/before/` and `after/`, the camp, a
street of houses, the palisade and its gate, the workshops, and the fields and pens, each on its side (852x393) and
upright (`-upright`, 393x852).

- **Every building stands on its cells at the kit's own size.** No picture is stretched or squeezed to its footprint any
  more; each is drawn at its kit's scale, its plinth's front corner on the footprint's front corner, the slab of soil
  under it cut off (nothing floats) and nothing drawn onto the cells in front of it.
- **A building bigger than its picture keeps its footprint, with a yard**: the picture on the middle, the rest bare
  ground (the kit's dirt tile) with the building's props on it (barrels, crates, carts, woodpiles, lamps), one to every
  other yard cell. A tavern's 3x3 picture on its 5x3 footprint, every shop's stall, the factories on their 6x4.
- **A building with no picture that fits** (a smithy, 3x2, borrows the 3x3 workshop; a turret, 1x1, the 2x2
  watchtower) is drawn with the borrowed picture made smaller by one factor until it fits, on the footprint's middle,
  still on the ground and cut at the front: 68 buildings (`AWAITING_ART`, the list for PixelLab below). So the
  workshops look smaller than before, as meant: a smithy was the 3x3 workshop at the kit's full size spilling over its
  3x2 footprint (66% scale, 1.2 times the footprint's width); it is now that picture at two thirds of it (44%), inside
  its footprint.
- **Walls are their real size and join up.** The kit's long runs are cut into one-cell pieces (stone, palisade, fence)
  and the gates into their middles two cells long (and a quarter cell of eaves each side). A wall cell is a whole piece
  along its run, or, at a corner, a tee or a cross, the half pieces reaching to each wall beside it; a gate stands in
  the line. The kits' runs are drawn at a shallower slope than the grid's 2:1 (a quarter, not a half), so each cut is
  sheared upright to 2:1 (columns moved up or down, never tilted): laid end to end they make one unbroken wall.
  The palisade (and its gate) is lowered: its stakes stood half again a person's height and hid the town behind, so
  28 px of the kit's art are taken out of the middle of each column (the tips and the foot kept): it now stands about
  shoulder to head high (the owner's call: lower stakes, never see-through buildings). A stone wall's corner, tee or
  cross has a pier over the meeting arms (`stone_wall_post`, the torch pier cut from the stone gate). A fence's cell is
  cut centred on one of its posts, so every cell has one post and the rails meet between them.
- **Pens are fenced, not ploughed.** The herds' pens (goats, pigs, chickens, sheep, cattle), the God creature's pen, the
  stable, the kennels and the beast ranch are a fence round their footprint's edges with a way in on the front-left,
  bare ground inside and a heap of hay in the middle. The stockade is the palisade round its edges with its gate on the
  front. (Crop fields are as they were: a field tile to a cell.)
- **Trees, rocks, bushes and props stand on the middles of their cells**, no jitter, turned now and then for variety:
  an oak's canopy about a cell and a half across, a rock heap or a bush within its cell. A store's heaps and a
  building's props go on its yard's cells, then on free cells along its front (not a street, a wall or another
  building).
- **The townsfolk** already stood on their feet (map-looks' `FOLK_FEET`/`feetAnchor`, merged first): the audit's point
  2 is that fix, and nothing more was done to them.

### How it works

- **`tools/grid-recut.py`** (run by hand, after `node tools/grid-audit.mjs`, which writes `out/grid-defs.json`): cuts
  the settlers' kit and the shared building pieces into copies in a `grid/` folder beside each
  (`art/iso/kits/settlers/grid/`, `art/iso/buildings/grid/`), with a record each in that folder's `grid.json`:
  `anchor` (px in the copy: the footprint's front corner, at the top of the grass), `foot` (whole cells along x and y;
  mirrored it is the other way round), `kind` (`building`, `loose` for a tree, rock or prop, `seg` for one cell of a
  wall or fence, `gate`, `post` for a wall's corner piece), `bake` (how much the copy was scaled from the original).
  `LOWER`/`lowered` (the palisade's band taken out), `ON_POST`/`post_near` (the fence cut on a post), `POSTS`/`post_cut`
  (the stone corner's pier). A plinth's cells are rounded down
  unless past the half by a little (`cells`: 2.5 is 2, 2.55 is 3); the campfire is given 2x2 (`FOOT`). The shared
  pieces are baked so their plinth is their building's footprint at the settlers' scale (the archery range, laid off
  the grid's angle by `groundFit`, is left to it). Trees are baked to 0.73, bushes 0.7, rocks 0.58, props 0.6 (`LOOSE`).
  Everything below a piece's footprint's front edges is cleared (`cut_below`). Runs: `seg_cut` (the slope fitted
  along the run's foot, the shear, the anchor 0.3 of a cell behind the ground's front edge). A piece in `grid.json`
  keeps its record when cut again; `--fresh` measures everything again. The originals stay as they were: the raid
  board and the menus still draw them.
- **`iso/gridRules.ts`** (pure): `gridRec`, `gridUrl`, `segOf`; `fitIn` (a picture's cells inside a footprint, either
  way round, on its middle; the way leaving less yard), `yardCells`; `gridPlan` (a building's piece, record, cells, mirror
  and `shrink`); `AWAITING_ART`; `isFencedPen`, `penEdges` (a seg to each edge cell, the back edges first, a way or a
  gate on the front-left edge's middle), `wallArms` (whole, or the arms to each neighbour), `snapSpots`, `gatePlan`,
  `wallSeg`, `wallPost`, `fenceSeg`, `looseRec`. Only the settlers' kit is cut (`GRID`); the other peoples, not playable, keep the
  old drawing until theirs are cut.
- **`iso/isoView.ts`**: `gridLook` (how a building is drawn: a building with its yard, a wall cell's arms, a gate, the
  stockade or a pen with its fence), `syncGrid` (the picture placed, its fence or other arms, door, lights, props),
  `placeSprite` (a piece's record anchor on its land point, keeping the bottom-middle anchor the lights, flames and
  hearth already use), `placedTex` (a wall arm's half picture), `setGridProps`; the yard and pen ground in `paintCells`
  (`yardCells`); scenery on cell middles through `looseRec`. `DrawnBuilding.pic`: the cells its picture stands on, for its
  door, windows and flames. Lights placed by hand on a shared piece are measured back through its `bake`.
- **`iso/isoTown.ts`** `propsFor`: the props a kind of building keeps, for its yard.

### The check

**`test/gridRules.test.ts`** reads every piece in the settlers' and the shared `grid.json` (decoding the PNGs with
`tools/png.ts`) and fails when one has no copy, a footprint that isn't whole cells or an anchor off its picture; when a
building, tree, rock or prop is drawn below its footprint's front edges (onto the cells in front) or past its sides
(eaves a quarter cell; a tree's canopy a cell and a half across); when a settlers' building has no piece cut to the
grid, a wall, gate or pen has no piece, or a picture's cells fall outside its footprint; when `AWAITING_ART` isn't
exactly the buildings drawn smaller; and when a tree, rock, bush, prop or heap the town can put down isn't cut. A new
settlers piece has to be cut (`tools/grid-recut.py`) and keep the rules, or `npm test` fails.

### Still to do

- **Pictures of their own, for PixelLab after 21 November** (no generations were spent). By the age they open in,
  earliest first, homes and work before the rest:
  - *Drawn smaller now* (`AWAITING_ART`, 68): lean-to, healer's hut, workbench, tanning rack, drying rack, smokehouse,
    kiln, basketry, bone carver, fireside inn, trading post, graveyard, wayside shrine, quarry, monster guild, militia
    post; smithy, sawmill, bakery, windmill, mine, tannery, brewery, bloomery, cooper, loom, tailor, dyeworks,
    chandlery, jeweller, apothecary, market, weapon store, armour store, furniture store, apothecary's shop, deep shaft,
    arcane library, arcane academy, resurrection shrine, phylactery, guard tower, ballista, catapult, siege workshop;
    coal mine, glassworks, gunsmith, cannery, print shop, bathhouse, clockmaker, cannon, gun nest, land mine; cement
    works, oil derrick, radio tower, gun turret, flame turret, mortar pit; bio lab, deep mine, nanoforge, battery plant,
    laser turret, tesla coil, launch site.
  - *A borrowed picture with a yard now* (47): hide tent, hunters' lodge, storyteller's circle, lookout, the traps
    (spike, pit, caltrops, boiling oil), arena; elder lodge, barracks, trophy hall, scriptorium, infirmary, school,
    general store, gaol, theatre, temple, cathedral, bell tower, mage tower, town hall; steelworks, factory, emporium,
    rowhouse, hospital, prison, library, power station, textile mill, airship mast; refinery, electronics plant,
    garage, appliance plant, apartments, trauma centre, cinema, university, pharmacy; alloy foundry, chip fab, robot
    workshop, habitat dome, fusion reactor.
  - *Walls*: a purpose-made stone corner tower (the pier cut from the gate stands in), and corner pieces for the
    palisade and the fence (two half runs meet there now).
- **The other peoples' kits** go through `tools/grid-recut.py` the same way when they are playable again.
- The street tiles' step at each cell's edge (below) is untouched.

### Checked

`npm run typecheck`, `npm test` (all pass), `npm run web`; the shots above at both sizes. The gallery's overlay shots
below are the audit's, from before the change.

### The audit (before the change)

Made from a settlers' town laid out for it (`tools/grid-town.ts`: one of every picture on every footprint size, walls
and gates, a street, fields and pens, the God creature's pen, two buildings going up, townsfolk standing on cells),
in the isometric view, at the phone's sideways size (852x393).

#### The audit's tools (dev only)

- **`iso/gridAudit.ts`** (pure): `measureBase` finds a picture's own ground from its pixels (every kit piece stands on a
  little grass plinth with a slab of soil under it): its front corner, its left and right corners and the slab's
  thickness. `fitOf` works out how that plinth sits on the footprint the view gives it (cells covered, px floating,
  px off-centre, how much wider, how many rows behind it covers). `footDiamond` is a footprint's diamond round its
  `footBase`. `pictureScale` is the view's own scale rule, moved here from `isoView.ts` (same behaviour) so the tool
  and the view share it.
- **The overlay** (`iso/isoView.ts` `setGridDebug`, `drawGrid`): off by default; on with `littletown.grid` set to `1` in
  localStorage, `?grid` on the strip page's address, or `__iso.setGridDebug(true)` from the console. It draws the
  cells (faint white), each building's footprint (green), its picture's box (red) and anchor (yellow), its picture's
  own plinth as measured (magenta: left corner, front corner, right corner, and a dot at the top face's front), each
  tree, rock and prop's anchor and cell (cyan), and each walker's feet and cell (orange).
- **`tools/grid-audit.mjs`** (`tools/grid-audit.ts`, with `tools/png.ts`, a small PNG reader): measures every building
  a settlers' town can have, the scenery, the props, the landmarks and the townsfolk's frames, as the view drew them
  before the change (the original pictures, fitted to their footprints), into `docs/notes/grid-audit/measurements.md`,
  worst first.
- **`tools/grid-shots.mjs`**: builds the gallery town (or `--scene town`), opens `out/web` (run `npm run web` first;
  `--web <dir>` another build) in the pre-installed Chromium with the town as its save and the overlay on, and shoots
  `docs/notes/grid-audit/*.jpg` (`--out <dir>` elsewhere); `--plain` without the overlay, `--size 393x852` upright.
- **`test/gridAudit.test.ts`**: the measuring on made-up plinths, the fit of a picture drawn for its footprint (no lift,
  no shift), the footprint's diamond against the land's cells, and the scale rule.

#### What the audit found, worst first

The shots are in `docs/notes/grid-audit/`, numbered in this order. The numbers are in `measurements.md`. A cell is
48x24 px on the screen (`ISO_TW`); the settlers' kit is drawn at 66% of its size.

1. **Walls and gates are drawn at a fifth of their size** (`01-walls-gate.jpg`, `07-stone-wall.jpg`). A wall cell is
   one cell, but the kit's wall pieces are long runs (a stone run is about 4.6 cells long), squeezed to fit one cell's
   width: a stone wall at 14% of the kit's size, a palisade at 21%, gates at 17% to 26%. A stone wall comes out lower
   than a townsperson's knee, each cell its own little run with its own plinth overlapping its neighbours'. The
   settlers' kit has no stone corner, so a stone wall turns its corners in wood (the palisade's corner).
2. **The townsfolk stand about a cell behind where they are** (`02-folk-float.jpg`). The PixelLab looks' feet are 15
   to 21 px up from the bottom of their frame (measured), and on the map the frame's bottom, not the feet, is put on
   the spot (`map/mapPeople.ts` corrects it only on the raid board, `BOARD_FEET`). On screen a person's feet stand
   about one cell height above their orange spot, so they seem to stand on the cell behind, and walk in front of or
   behind buildings a row out.
3. **Most buildings are drawn with a stand-in on a footprint it doesn't fit** (`03-big-buildings.jpg`,
   `05-mid-buildings.jpg`). 163 kinds of building are drawn with 37 pictures; 132 use another building's picture
   (a factory and a power station are the 3x3 workshop on a 6x4 footprint, a tavern's 2.6x3.1 plinth on 5x3, every
   shop the 4x1 market stall on 3x2 to 5x3). 13 cover less than 80% of their footprint's width (half the ground of
   a factory is bare), 68 spill more than 15% past it.
4. **The God creature's pen, the stable, the beast ranch and the kennels are a cottage** (`04-creature-pen.jpg`): the
   settlers' kit has no pen piece, and the stand-in is a cottage.
5. **Pictures sit off-centre on their footprints**: almost every kit plinth is near square (the cottage 2.6x2.4, the
   workshop 3.0x3.0, the chapel 2.9x3.8) where the footprints are not (3x2, 4x3), and the picture is centred across
   the footprint's middle but stood on its front corner, so its front corner lands 9 to 30 px left of the footprint's
   and its sides run past one edge and short of the other (the magenta and green lines in every shot).
6. **Small footprints spill** (`06-small-buildings.jpg`): a 2x2 workshop, cottage or shrine is the 3-cell picture at up
   to 125% of the footprint's width; one-cell defences (turrets, ballistae, cannons, militia posts) are a watchtower
   shrunk to half, still 1.2 cells wide; traps are a heap of rocks.
7. **Everything floats a little**: each plinth's slab of soil is drawn under the ground line, so the grass of a
   building stands 3 to 12 px above the ground round it (the ground tiles are drawn with their slab cut off; the
   buildings are not). The shared pieces cut theirs (`soil`), and still float 2 to 32 px where `soil` is short.
8. **The shared pieces are scaled to fit, each its own size**: drawn at 28% (the fishing jetty) to 99% (mission
   control), so their pixels are all different sizes beside the kit's 66%. Some lie the wrong way on their footprint:
   the launch site's plinth is 5.4x6.6 on an 8x4 footprint, mission control 4.3x5.6 on 6x4.
9. **Trees and rocks are on their cells but bigger than them, and jittered** (`09-trees-rocks.jpg`): a tree's foot is
   put anywhere in the middle 40% of its cell, an oak is 1.7 cells wide and a rock heap 1.5, so heaps overlap their
   neighbours and the woods have no rows. Trees sink 7 or 8 px below their spot (anchored 0.9 down their picture).
   Props by buildings stand 0.45 of a cell past the footprint at a random point along a face: half on a cell,
   sometimes on a street.
10. **Buildings going up** (`10-building-sites.jpg`) are the finished picture at 45%: they have every fault of the
    finished building.
11. **Fields and streets are on the grid** (`08-street-fields-pens.jpg`, `11-overview-walls-pens.jpg`): a tile to a
    cell. But a pen is drawn as a crop field (no fence, no beasts' ground), and the street's cobble tiles show a step
    at each cell's edge (the tile's own border or a sliver of its slab).

#### The rules proposed (approved)

1. **One tile size.** A cell is 48x24 px on the screen at zoom 1 (`ISO_TW`, as now), and every picture is drawn at
   one scale per kit (its `scale` times `ISO_ART`, as the kit pieces are now), chosen so its plinth's cells are the
   view's cells exactly. Nothing is scaled to fit its footprint at run time: no `OVERHANG` shrink, no fitting walls,
   gates or the shared pieces to the footprint's width. A picture that's the wrong size for its cells is new art or
   re-cut art, never a stretched one, so every pixel on the map is the same size.
2. **The footprint is the plinth.** Each picture declares its footprint in whole cells in its kit's `index.json`
   (`foot: [w, h]`, and `turns: true` when it may be drawn mirrored for a footprint the other way round). A building's
   footprint in `data/buildings.ts` is its picture's `foot`. Where the game wants a building bigger than its picture
   (a 6x4 factory, a 5x3 tavern), it gets a picture made for that size: until then the owner chooses per building
   either its footprint shrunk to its picture's (it then holds fewer workers or less, or its numbers stay and only
   its land shrinks), or a yard round the picture (the plinth's ground and props laid on the spare cells by the view).
3. **Anchored at the front corner of the ground.** Each picture declares its anchor (`anchor: [x, y]`, px in the
   picture): its plinth's front corner at the top of the grass, not the bottom of the slab. That point goes on the
   footprint's front corner (the cell corner at x + w, y + h). Everything under the anchor (the slab of soil) is cut
   off, as the ground tiles' and the shared pieces' are now, so nothing floats or hangs over the cell in front.
4. **Tall pieces rise over the rows behind, never past the sides or the front.** Above its plinth's back edges a piece
   may rise as high as it likes (a tower covers the rows behind it: that's the isometric look, and the see-through
   fade already handles someone behind it). Sideways it may reach past its plinth's left and right corners by eaves
   only, a quarter of a cell at most; nothing may reach below its plinth's front edges onto the cells in front. The
   draw order stays by the footprint's front corner (`footDepth`), and the townsfolk's by `standingDepth`.
5. **Props, trees and rocks take one cell and snap to its middle.** Each is a 1x1 picture whose foot (a trunk's base,
   a barrel's bottom, a rock's ground) is anchored at the cell's middle, no jitter; variety comes from the piece picked
   and mirroring. A canopy may be up to one and a half cells wide (it rises over the cells behind, rule 4); a rock heap
   or a bush stays within its cell, and a bigger heap is a 2x2 picture placed only where four rock cells meet. A prop
   beside a building stands on the middle of a free cell beside it (not a street, not a footprint), or not at all.
6. **Walls are one cell to a piece.** Each wall material has 1x1 pieces: a run along x, a run along y, a corner each way,
   a tee and an end, at the kit's scale; a gate is a 2x1 (or 3x1) picture drawn for its footprint. Joined, they make
   one unbroken wall. Fences round pens and the God creature's pen are the same kind of pieces.
7. **Townsfolk stand on their feet.** A look's anchor is its feet, measured in its frame (as `BOARD_FEET` is on the
   raid board), on the map as on the board.

**The check** proposed is now `test/gridRules.test.ts` (above).

#### What it would take (the estimate before the work)

| what | to bring it into line | work |
|---|---|---|
| The view | Anchor at the declared `anchor`, draw at the kit's scale only, cut the slab, snap props and scenery, feet at the anchor. | Small: a day. |
| Kit pieces (36 settlers', about 1,100 in all) | Re-cut: the tool measures each plinth and writes `foot` and `anchor` into `index.json`; plinths not whole cells (the cottage's 2.6x2.4) re-cut or their grass edge redrawn to the cells. | Medium: a day for the settlers, two or three for every kit, with a look at each. |
| Footprints in `data/buildings.ts` | Each building's footprint set to its picture's (the owner's call per building, rule 2); the tests that place buildings by size checked. | Medium: a day or two; it changes where buildings fit, not the sim's rules. |
| Buildings with no picture of their own (132 drawn by a stand-in) | New pictures made to their footprints (PixelLab, in the kit's style, as `art/iso/buildings/` was), or a yard round the stand-in. | Large: the most work by far; can go a few at a time, the most built first. |
| Walls, gates, fences | 1x1 pieces cut from the kits' long runs (a straight run's middle repeats), new corners, tees and ends (the settlers have no stone corner). | Medium to large: cutting by a tool, a day; the missing pieces, new art. |
| Pens and the God creature's pen | A pen built of fence pieces on its own ground tile, the beasts inside. | Medium: needs the fence pieces first. |
| Shared pieces (`art/iso/buildings/`) | Drawn at the kit's scale with `foot` and `anchor`; the ones that lie the wrong way re-made or turned. | Small to medium. |
| Trees, rocks, props | `anchor` at the foot; heaps over a cell cut down or made 2x2. | Small: half a day. |
| Townsfolk | The feet in each look's `index.json` (measured by the tool), used on the map. | Small: half a day. |
| Streets, fields | On the grid already; the street tile's step at each edge looked into. | Small. |

Files of the audit: `src/renderer/iso/gridAudit.ts`, `src/renderer/iso/isoView.ts` (`setGridDebug`, `drawGrid`,
`baseOf`, `pictureScale` used), `tools/grid-audit.ts` + `.mjs`, `tools/png.ts`, `tools/grid-town.ts`,
`tools/grid-shots.mjs`, `test/gridAudit.test.ts`, `docs/notes/grid-audit/` (the shots and `measurements.md`).
