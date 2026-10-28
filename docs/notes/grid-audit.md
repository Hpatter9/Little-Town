## The grid audit, and the rules proposed for every asset

The owner's ask: "Make sure all assets fit in the tile grid better. We need to implement a full grid system that has to
be used, and all assets must follow it ... they look pretty off now and I want this game to feel more polished." This
is the audit and the proposal only: nothing the player sees has changed. The rules below are for the owner to approve
(or change) before the art and the layout are brought into line.

Made from a settlers' town laid out for it (`tools/grid-town.ts`: one of every picture on every footprint size, walls
and gates, a street, fields and pens, the God creature's pen, two buildings going up, townsfolk standing on cells),
in the isometric view, at the phone's sideways size (852x393).

### What was built (dev only; nothing changes for the player)

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
  a settlers' town can have, the scenery, the props, the landmarks and the townsfolk's frames, as the view draws them,
  into `docs/notes/grid-audit/measurements.md`, worst first. `--check` judges them by the proposed rules (`RULES`) and
  fails if any breaks them: today all 163 do.
- **`tools/grid-shots.mjs`**: builds the gallery town, opens `out/web` (run `npm run web` first) in the pre-installed
  Chromium with the town as its save and the overlay on, and shoots `docs/notes/grid-audit/*.jpg`; `--plain` without
  the overlay.
- **`test/gridAudit.test.ts`**: the measuring on made-up plinths, the fit of a picture drawn for its footprint (no lift,
  no shift), the footprint's diamond against the land's cells, and the scale rule.

### What the audit found, worst first

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

### The rules proposed

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

**The check.** Once the art is in line, `npm test` refuses a picture that breaks the rules: a test reads each kit's
`index.json`, decodes the PNG (`tools/png.ts`), measures its plinth (`measureBase`) and fails when the declared `foot`
or `anchor` disagrees with the art (by more than a tenth of a cell, or 2 px), when anything reaches below the plinth's
front edges or a quarter-cell past its sides, when a building's footprint isn't its picture's `foot`, or when a wall
piece isn't 1x1. `node tools/grid-audit.mjs --check` is that check today, run over what the view draws (all 163
settler buildings fail it now).

### What it would take (the settlers first; the other peoples' kits after, the same way)

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

Files: `src/renderer/iso/gridAudit.ts`, `src/renderer/iso/isoView.ts` (`setGridDebug`, `drawGrid`, `baseOf`,
`pictureScale` used), `tools/grid-audit.ts` + `.mjs`, `tools/png.ts`, `tools/grid-town.ts`, `tools/grid-shots.mjs`,
`test/gridAudit.test.ts`, `docs/notes/grid-audit/` (the shots and `measurements.md`).
