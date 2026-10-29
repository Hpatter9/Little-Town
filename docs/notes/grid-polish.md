## The grid polished: smooth ground, corner posts, yards that are worked

The owner, after the grid rules went in (0.225.0): "they look pretty off now and I want this game to feel more polished."
Four things from `docs/notes/grid-audit.md`'s "Still to do" and its polish list, for the settlers (the one people
playable), in the isometric view. Renderer and art only: no rule of the simulation, no footprint, nothing new in
`GameState`. Changes the HISTORY.md sections "The isometric view, begun" (the ground tiles), "The ring wall" and
"Animal husbandry" (the walls' and pens' look), and the grid notes (`grid-audit.md`: "Still to do", the yards).

### What the player sees now

Before and after, the same town (`tools/grid-town.ts polish`), each at 852x393 and upright (`-upright`, 393x852):
`docs/notes/grid-polish/before/` and `after/`: the street (`street`), the palisade and its gate (`walls-gate`), its
corner (`wall-corner`), the stone wall with its corners and gate (`stone-wall`), the pens (`pens`), three sets of yard
buildings (`yards-workshops`: the smithy, the sawmill and the tavern; `yards-tavern-hall`: the town hall;
`yards-store-barracks`: the general store, the elder lodge, the barracks and the steelworks), and the whole town by day
(`town`) and at ten at night with its street torches lit (`town-...-night`).

- **The ground is one surface.** Every cell of grass, a street's cobbles, a yard's bare earth and a field had a ragged
  dark edge round it and a sliver of its soil slab at its front, so the meadows were a net of dark lines and a street
  stepped at every cell. The tiles are now cut to their top face alone, an exact diamond with the dark edge left out,
  and laid a little over size as before: the cobbles run as one street, the grass as one meadow. A footpath worn part
  way (drawn see-through) is laid at its cell's size, so its overlaps don't show darker.
- **Walls and fences meet the ground without a line.** Each one-cell piece of wall, palisade, fence and gate kept the
  slab's dark edge under its strip of ground, a thin line along every wall: it is cut off.
- **The palisade and the fence turn their corners.** The palisade has a corner stake where its runs meet (at a corner,
  a tee or a cross, and the stockade's corners): the stake at the point of the kit's own corner piece, with the stones
  under it, lowered as the runs are. A pen's fence has a post at each corner, cut from one of the kit's fence posts, so
  its rails end on a post and no longer cross. (The stone wall already had its pier.) Purpose-made corner art from
  PixelLab replaces these by itself once it is in (`MADE_POSTS`).
- **Yards are the building's own worked ground.** The buildings that keep a bigger footprint than their picture, and
  the ones drawn smaller while they wait for their own picture where that leaves whole cells over (a smithy's workshop
  at two thirds is 2x2 on its 3x2: it now stands on the back two columns and the third is its yard), lay their trade's
  props on the yard: a smithy's anvil stall, quench barrels, coal and iron; a sawmill's log stack, woodpile and cart; a
  mill's or a bakery's sacks, cart and hay; a hunter's or a tanner's drying rack; a store's crates, chests and cart; a
  healer's pots; a town hall's standard and lamps; a factory's metal crates, oil drums and coils; a mine's ore cart and
  ore; a barracks' or an arena's weapon rack and standard. Three yard cells in four take one, one to a cell on its middle;
  the cells before the door are left clear; a tall prop (a standard, a rack, a lamp) never stands in front of the
  building. A building with no yard still gets the odd prop beside its front-right face, never before its door.
- **Night**: looked at in both sizes; nothing off the grid. (The polish town sets its street torches itself: a town's
  night is darkened by its light map, which runs once the town has its lights.)

### How it works

- **`tools/grid-recut.py`** (run by hand, as before): `TILES`/`tile_cut` (a ground tile's face as an exact 2:1 diamond
  as wide as the tile, its corners found from its slab's sides, each pixel sampled `TILE_INSET` in toward the middle so
  the dark edge is left out; a record of kind `tile`); `drop_slab` (each column's lowest slab px cleared on the segs,
  gates and corner posts); `POSTS` now has `palisade_post` (`corner_post_cut`: the stake at the front point of
  `palisade_corner`, `CORNER_HALF` px each side, lowered by `LOWER`) and `fence_post` (`fence_post_cut`: the post the
  fence's seg is cut on, `seg_cut` with a narrow `half_px`), each skipped once its `MADE_POSTS` picture is in; `YARD`
  (the yard props, cut from the other peoples' kits: the dwarves' anvil stall, coal heap, iron ore and ore cart, the
  Moon Pack's log stack and drying rack, the orcs' weapon rack, the nomads' standard, sacks and chests, the druids'
  baskets and pots, the machines' metal crates, oil drums and coils), baked to the settlers' scale as the kit's own
  props are (0.6 of its own people's size), smaller where wider than a cell (`YARD_WIDE`) or taller than `YARD_TALL`,
  a `loose` record each with `from`. They are the game's own PixelLab kits (CREDITS.md's kits entry), copied into the
  settlers' `grid/` only; the kits' `index.json` are untouched.
- **`iso/gridRules.ts`**: `tileFace` (a kit tile's clean face, if cut); `segOf` skips corner posts (one may be cut from
  the same piece as a run); `shrunkSub` (`gridPlan`'s `sub` for a picture made smaller: whole cells against the back-left
  and front-left edges, else the footprint as before); `doorCells` (the cells before the door's face: front-left, or
  front-right mirrored); `inFront`; `yardLayout` (the props on a yard's cells).
- **`iso/isoTown.ts`**: `YARD_PROPS` (the props each building's yard holds), `TALL_PROPS`, `yardPropsFor`.
- **`iso/isoView.ts`**: `surfaceOf` takes the clean face where there is one; `paintCells` lays a yard's earth whole and
  a see-through cell at its own size; `gridLook` puts a shrunk picture on its `sub`; `setGridProps` lays `yardLayout`.
- **`tools/grid-town.ts`** `polish` (and `night`), **`tools/grid-shots.mjs`** `--night`, `--only`.

### The check

`test/gridRules.test.ts`, added to: every kit ground tile has a clean face, an exact 2:1 diamond with nothing outside
it; the stone wall, the palisade and the fence have one-cell corner posts and `segOf` never takes a post for a run;
every yard prop any building can lay is cut, every `YARD_PROPS` key is a building, and for every settlers building with
a yard its props stand on its yard, one to a cell, never before its door, never tall in front of it (and a yard not all
before its door holds something); a picture made smaller stands on whole cells where it can, leaving its yard beside it.

### Still to do

- A barracks' training dummies: no kit or pack has one (the barracks' picture fills its 4x3, so it has no yard; the
  weapon rack stands beside it now and then). One for PixelLab after 21 November, with the corner pieces.
- The land's own grounds (marsh, a biome's tint) are a tile to a cell, so a lone marsh cell in a meadow shows as a hard
  diamond: blending tiles across their edges would be a bigger change.
- The other peoples' kits go through `tools/grid-recut.py` the same way when they are playable again.

### Checked

`npm run typecheck`, `npm test` (1,832 pass), `npm run web`; the shots above at both sizes, day and night.
