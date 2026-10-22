## Phone speed (the iso view on a big town)

Measured on `test/fixtures/late-town.json.gz` (38 people, 281 buildings) in a 393x852 Chromium preview, 15 s of
dragging the map, with the CDP CPU profiler (0.5 ms sampling). This container has no GPU: the `(program)` row is
software rasterising and is not a phone's number, so frame times were not usable (about 0.7 s a frame even
unthrottled). The numbers below are the JS and canvas time the profiler attributes to named functions (everything but
`(program)` and `(idle)`) over the same 15 s run, so lower is better.

| | before | after |
|---|---|---|
| JS + canvas time (ms) | 7180 | 5003 |
| `getImageData` | 158 (1465 once the folk sheets arrive) | 283 |
| `drawImage` | 136 (986) | 201 |
| `recolour` (folk variants) | 294 | 134 |
| ground chunk painting (`paintChunk`, `cellColour`, `chunkKey`, `fillRect`, `putImageData`) | about 900 | gone |
| `seeThrough`, `kept`, `syncProps` | 555 | gone / small |

Load time (tap Continue to `__game`) was too noisy to compare here: the same build ranged 6 s to 60 s at 4x throttle
on software GL. Heap after the run: 189 MB before, 172 MB after. The sim is unchanged: `node tools/perf-sim.mjs`
gives step 1.2 ms and snapshot 12.3 ms before and after.

### What changed
- **The hidden top-down map paints nothing (`map/mapView.ts`).** In the iso view `map.world` is hidden, yet the map
  still painted every ground chunk (canvas work, `chunkKey` on every cell), culled its sprites, faded trees and swayed
  them. `syncLand` now skips the chunks and shade when `!world.visible`, and `setCamera`, `sway` and `seeThrough`
  return early. Props are still placed (the falling leaves read them). The tactics board paints its own ground
  (`clearGroundOf`), so it is unaffected.
- **Folk sheets bake on use (`iso/folkLoader.ts`).** A look used to load and recolour every animation sheet (about a
  megapixel each) for each of its 8 colour variants at once. Now only `rotations.png` loads, and an animation's sheet
  loads (and is recoloured) the first time someone plays it. Until it arrives the sprite shows the standing figure, as
  it already did for a missing frame. The canvas is made with `willReadFrequently`, so `getImageData` stays on the CPU.
- **`recolour` works out each colour once (`iso/folkTint.ts`):** same output, far fewer HSL conversions.
- **`placeLoose` (`iso/isoView.ts`)** keeps the buildings' footprint list between frames instead of mapping all of
  them every frame.
- **`reducedMotion()` (`ui/motion.ts`)** is asked by the battle juice every frame (a localStorage read and a media
  query): its answer is now kept for half a second (`setReduceMotion` clears it).
- **Offline cache (`mobile/sw.js`).** The iso, himeko and backdrop art was already `LATER` (not part of the install),
  so the first load isn't blocked by it. The background download now runs two files at a time, the shell's own art
  first, so a slow line is left for the art the game is showing. It still downloads every people's iso folk and kits
  (about 25 MB); the page only fetches the looks and kit it uses. Fetching the player's own people first would need the
  page to tell the worker its people: not done.

### For the coordinator
Touched outside pure iso files: `map/mapView.ts` (hidden-map skips), `ui/motion.ts`, `mobile/sw.js`. Not touched: fog,
lights, the sounds, the tutorial. Not done: the sim snapshot (12 ms a tick on this town, in the worker) is the next
biggest cost; the map's per-building painted sprites (hidden under iso) could also go.
