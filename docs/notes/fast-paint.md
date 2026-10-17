## A faster first paint (the ground)

Changes "Phase 3" (the map's ground chunks) and "The phone made smoother" (start-up). Renderer only: the sim hashes
are untouched. Measured in headless Chromium at 393x852 on the cloud container (a phone is faster), the late-town
fixture (`test/fixtures/late-town.json.gz`, 484 chunks in the open land) and a new settlers town, from a cold load.

**What the profile showed (before).** The ground was painted over and over: `syncLand` painted every near chunk as
soon as the snapshot came, and again each time one of the art sheets arrived (the tiles, the ground detail, the road
tiles, the sea): five full passes, four of them thrown away. The fixture made 2447 `paintChunk` calls for 484 chunks
(10.7 s of paint, the last one 51 s after the first); a new town 161 calls for 32 chunks (0.86 s). Inside one chunk
(new town, ms): the plain-ground pass 5.7 (per pixel: two noises, two `softAt`s with `visibility` and `groundAt`), the
per-cell patches and tufts 0.3, the fog 3.1 (4096 `fillRect`s, each with its own `rgba(...)` string).

**What it does now.**
- `map/mapView.ts`: `syncLand` only works out which chunks are due (`due`, keyed as before) and puts up the dark ones;
  `paintDue(budgetMs)` paints them. Chunks in or by the view (`CULL_MARGIN`) are painted at once, nearest the view's
  centre first; the rest for about `FILL_BUDGET_MS` (8) a snapshot, `PAN_BUDGET_MS` (6) a frame (from `setCamera`) and
  `WEAR_BUDGET_MS` (4) for a worn path, at least one a call. Nothing is painted until the ground's art sheets are all
  in (`groundArtReady() === '111'`) or `ART_WAIT_MS` (4 s) has passed, so each chunk is painted once, finished.
  (The old "one wear repaint a snapshot" cap is gone: the queue does that.)
- `map/groundArt.ts`, `paintChunk` (same name, same look): the colours of the 12x12 cells in and round the chunk are
  looked up once (`nearCell`) instead of `softAt` per pixel; the warp's two noises use a lattice hashed once per chunk
  (`latticeNoise`); a cell whose eight neighbours are its own colour (or unlaid) skips the noise (the warp reaches under
  a cell's width); a chunk wholly one kind of land is one `fill`; the shore's neighbour tests reuse the pixels already
  worked out (`memo`); pixels are written as one `Uint32` each; the fog is one pixel to a 4px block in a small kept
  canvas (`fogImage`), drawn up four times, not 4096 fills. `chunkKey` no longer holds `td` (never used by the
  painter: its arrival repainted every chunk for nothing).
- `map/groundNoise.ts` (new, pure): `smooth`, `hash` (still exported from `groundArt`) and `latticeNoise`.
  `test/groundNoise.test.ts` checks the lattice gives `smooth`'s exact values.
- `syncProps` (mapView): an object already standing with the right key is left alone before its picture and place
  are worked out (`kept`), and the key's tail is built once a call, not for every cell.

**The same look.** The old painter was run beside the new one in the page, on the same land, and every pixel compared:
0 differing pixels over 531 fixture chunks (winter, ice) and 93 new-town chunks, and over 1104 more chunk paintings
across all four seasons, six lands (forest, coast, ash, tundra, desert, marsh), blighted and not.

**Numbers (before -> after).**

| | before | after |
|---|---|---|
| fixture, `paintChunk` calls / CPU | 2447 / 10.7 s | 516 / 1.4 s |
| new town, calls / CPU | 161 / 0.86 s | 32 to 57 / 0.14 to 0.23 s |
| one chunk, median | 3.4 to 4.1 ms (the half-finished passes) | 2.2 to 2.6 ms (the finished one; was about 9 to 15 ms) |
| fixture, `syncProps` (105 calls) | 3.5 s | 1.2 s |
| pan of 20 frames x 2 (new town) | mean 73 to 74 ms a frame | 66 to 90 ms: the same within the run-to-run noise |

The chunks in view are painted in the first frame after the art is in (about a dozen, tens of ms); the rest fill in
over the following frames out of sight.
