## The ground blended

The owner's ask: on the iso map each kind of ground was one tile per cell, so kinds met at hard diamond edges (a lone
marsh cell in a meadow read as a pasted diamond; grass against sand, snow, dirt, a field's edge or a street the same).
Now unlike grounds meet softly. Renderer only: no rule of the simulation, nothing new in `GameState`. Changes the
HISTORY.md sections "The isometric view, begun" (the ground tiles) and the grid notes (`grid-polish.md`'s "Still to
do": the land's grounds a tile to a cell).

### What the player sees now

Before and after, the same patches (`tools/grid-town.ts blend`), each on its side (852x393) and upright (`-upright`,
393x852): `docs/notes/ground-blend/before/` and `after/`: a meadow with marsh in it, a lone cell, a pair and a ragged
patch (`meadow-marsh`), grass meeting a patch of sand and one of rock (`sand-rock`), a pond with its shore (`shore`),
the town's edge with a street out through the palisade, fields, a pen and a worn footpath (`town-edge`), the whole
ground at 0.75 (`overview`); the desert and the tundra (`-desert`, `-tundra`: the open ground there is sand, or snow
on bare earth); and the town's edge and the overview at ten at night (`-night`).

- **Kinds meet on a ragged, dithered edge, never a diamond's.** A lone cell of marsh, sand or water in a meadow shows
  as a round patch; a staircase of cells (a river, a marsh's side) runs as a smooth wandering line; a street's and a
  field's edges have the grass growing a little over them. Each kind is still its own kit tile, one per cell: only the
  pixels near an edge between unlike cells change, and they are the two tiles' own pixels (no painted texture).
- **What lies over what** (`GROUND_RANK`): water, the shallows, sand, rock, a field, a street, bare earth (a yard), the
  marsh, the grass, the woods' floor on top. The higher kind reaches a little further across the edge. A worn footpath
  sinks below its own ground as it wears, so the grass creeps back over its edges.
- **Water has a shore**: a strip of the shore's sand mixed over the land's own ground along the water, and a paler
  strip of shallow water off it. (Not on a marsh.)
- No pack has edge or transition tiles for the kits' diamonds: the Craftpix tilesets in `../chronos-assets` are all
  top-down (and none is isometric), so the edges are made in code from the kit tiles. Nothing new was copied in, so
  CREDITS.md is unchanged.
- Streets, fields and yards, which were sprites laid over the ground, are now baked into it with the rest (at the
  same size as before: a kit tile to each cell); the trees, rocks, fog and night lighting draw over it as before.

### How it works

- **`iso/groundBlend.ts`** (pure, no Pixi): `cellSurface` (a cell's surface: its tile, tint, how many cells a tile
  covers, rank, wet, takes a shore, wear; `Laid`: a field, a street or a yard), `GROUND_RANK`, `FIELD_RANK`,
  `STREET_RANK`, `BARE_RANK`, `shoreSurface`, `surfaceKey`. `bakeChunk` bakes a chunk of cells into a picture
  (`chunkPx`: `size * ISO_TW` by `size * ISO_TH`, its cells' diamond in it): a cell among its own kind is a straight
  copy of its tile through a lookup table (`CELL_PX`, `lookup`: the tile's px under each of a cell's px, made once for
  each place in the tile's block and each way round); a cell beside an unlike one weighs, for each pixel, the 3x3
  cells round it by how near their middles are (`KERNEL` 1.45 cells), each kind's share plus `RANK_BIAS` (0.008) a
  step of rank plus a slow wobble (`WOBBLE`, a value-noise table `WOB` repeating every 256 px) deciding the winner, a
  4x4 ordered dither (`BAYER`, `DITHER`) between the top two; a land pixel with enough water near (`SHORE`) mixes in
  the sand (`SAND`), a water pixel with enough land near (`FOAM`) runs paler (`PALE`). The tiles keep their old turns
  (salt 21 a block, 22 a cell), and the dither and wobble are by screen px, so chunks meet without a seam.
  `chunkSig` (a chunk's cells and the ring round it), `fillOut` (a tile's see-through rim filled from inside).
- **`iso/isoView.ts`**: the ground is chunks of `CHUNK` (16) cells, each a canvas and a texture (768x384) in `ground`.
  `syncChunks` (every frame, from `setCamera`): a chunk coming on screen that has never been baked is baked at once;
  the ones just off it (`CHUNK / 2` cells) and any whose fingerprint changed (checked when the land, its fields, yards,
  wear, kit, biome or a tile changed: `chunkStamp`) are baked within `BAKE_MS` (4 ms) a frame; off-screen chunks are
  hidden, and past `CHUNKS_SPARE` (12) the longest gone are let go. `surfAt` (a cell's surface, memoised by ground,
  laid and wear), `tileOf` (a kit tile's clean face drawn at the size for 1 or 2 cells, smoothed, as pixels).
  `paintCells` now only lays the land's trees, bushes and rocks (none on a field, street, yard or worn path, as
  before); the per-block ground sprites, the per-cell overlay sprites and `OVERLAP` are gone. A worn path now shows
  as it wears (the wear is in the stamp), not only when the land next changed.
- **`tools/grid-town.ts`** `blend` (and a biome's name, `night`), **`tools/grid-shots.mjs`** `--biome`,
  **`tools/ground-perf.mjs`** (the ground's cost on `test/fixtures/late-town.json.gz`, panned at two zooms).

### Speed

Baked in node over the whole of `test/fixtures/late-town.json.gz`'s 192x192 land (144 chunks): 4.1 ms a chunk at the
median, 7.9 ms at the 90th centile, 14.6 ms at worst; 0.8 ms for a chunk all of one kind. A pixel of a cell beside an
unlike one first sums how much of its unlike neighbours reaches it (`WEIGHTS`, made once): when too little does for
anything to change (`SAFE_UNLIKE`, `SAFE_SHORE`, `SAFE_FOAM`, exact bounds) it is the cell's own pixel, unweighed
(the same picture to the bit as weighing every pixel; that took 10 ms at the median). Panning normally, the chunks
just off the screen are baked a few milliseconds a frame before they come on, so only a fling or a zoom out bakes at
once.

`node tools/ground-perf.mjs` (393x852, the camera swept round the big town for 15 s at zoom 0.5 and 0.25, the CDP
profiler on). This container has no GPU, so the frames are software rasterising (about one a second, before and after
alike: median 900 / 817 ms at 0.5, 800 / 717 ms at 0.25) and only the JS can be compared. The ground's own JS: before
108 ms (0.5) and 80 ms (0.25) of the 15 s (the block sprites and overlay cells, `paintGround`, `paintCells`); after 649
and 493 ms (`bakeChunk` 416 / 294, `putImageData` 124 / 140, the rest small). The sweep is harsh: at a frame a second
each frame jumps the camera about two chunks, so nearly every frame bakes a fresh screenful; on a phone at 60 frames a
second the same pan bakes a chunk every few frames. All JS named in the profile, against which: 6,399 / 3,089 ms
before, 4,457 / 3,593 after (it varies run to run by more than the ground's share). Memory: a chunk is a 768x384
canvas and texture; the ones on screen and `CHUNKS_SPARE` (12) more are kept.

### The check

**`test/groundBlend.test.ts`**: what lies over what; a lone marsh cell is a round patch with grass at its diamond's
corners and a dithered edge, the meadow round it untouched; water meets land with sand and paler shallows; the grass
lies over a street's edges more than the street over the grass; the chunk's corners are clear and the fingerprint
counts the ring round it; a tile's rim is filled.

### Checked

`npm run typecheck`, `npm test` (1,876 pass; after the last speed change, which leaves the picture as it was, the
ground, iso view and grid tests again), `npm run web`; the shots above at both sizes, by day and at night.
