## The loading screen and the game's logo

The owner's ask: "Let's do a loading screen! How can we make it interesting, show off the cool game we made, and have a
game logo." The reason behind it: on every load the town showed its code-drawn pictures first, and the pack sprites
popped in over them as their images finished loading (map/packBuildings.ts: "Until a picture has loaded, the
code-drawn one stands"; the same for the ground, the fields and the townsfolk). Now a loading screen covers the strip
until the first view is drawn in its own pack pictures, and fades into it.

**The preload.** `art/loadImage.ts` keeps a tally of every picture asked for and settled (`imageTally`), and
`warmImage(url)` loads one ahead of its use and keeps it: a later `loadImage` of the same picture is handed the one
already loading, so the map's own ask finds it ready. `loading/loadPlan.ts` (pure) lists what to warm from the town's
first snapshot: `loadPlan(town, tables, reach = FIRST_REACH, budget = FIRST_BUDGET)` gives the ground's pictures first,
then every building's (the ring wall's apart, as `wall`) and every townsperson's layers, nearest the camp first, each
picture once; those within `FIRST_REACH` (26 cells) up to `FIRST_BUDGET` (160) are `first`, the rest `later`. Which
picture stands for what is the renderer's to say (`LookTables`): `loading/stripLoad.ts` `STRIP_LOOKS` names the ground's
detail, fields, roads, prop sets and scenery, `packUrls(def, style)` (new in map/packBuildings.ts: a pick's every
picture, its joins and a windmill's sails) and `hkLayers(...).map(hkUrl)` (new exports in art/hkFolk.ts, with
`hkLoading()`). Small exports were added beside the loaders for this (`groundDetailUrls`, `fieldTileUrls`,
`roadTileUrls`); none of the drawing changed. `startStripLoad(first)` runs in the strip (main.ts: begun as soon as the
first snapshot is in, alongside the LPC, creature and effect loads; `drawn()` called two frames after the first
`applySnapshot`): it warms the first set, reports `{ wanted, done, look, ready }` to the page each frame, and is ready
once the map has drawn, the first set is in, nothing it asked for is still loading and no townsperson's layer is
(`STRAGGLER_MS` 2.5 s after drawing it is ready anyway, then `SETTLE_FRAMES` 2 more frames). The `later` set is warmed
after, `TAIL_BATCH` 4 at a time.

**The clock held.** `GameLoop.held` (shared/gameLoop.ts): while it's set no live time passes (the clocks are reset each
pump, so no "slept" gap is seen after). The phone's `init` (mobile/boot.ts, mobileBridge.ts) sends `held: true`; the
page sends `{ t: 'hold', on: false }` (`Bridge.release`, shared/ipc.ts) once the screen has gone. Time away is still
caught up while it is held (that is time already passed, told after by the away card as before); `MOST_HELD_MS` (60 s)
lets the clock go whatever the page says, so a page that failed to load can't stop the town. The desktop app never
holds it. Checked in the browser: the late-town fixture's tick stays at 475200 from the first snapshot to the reveal.

**The screen** (`mobile/loading.ts`, its own small bundle `loading.js`, about 40 KB, first in the page's body so it is
up before the 3 MB `mobile.js`). The logo over a living scene, a bar in the frame set's look (DawnLike's gold rod,
closed at its right end with its own left cap, as ui/frame.ts does), a line of what is loading in the game's voice
(`loadLine`: "Waking the townsfolk", "Raising the walls", "Lighting the lamps", "Counting the goats", by the look of
the nearest picture still coming), and a tip from mobile/tips.ts every `TIP_MS` (4.2 s). Everything moves a beat at a
time (`BEAT_MS` 110). Reduced motion stills the shimmer, the embers, the goat and the flicker. A ☰ menu setting,
"Loading scene: on/off" (`littletown.loadingScene`), drops the scene for a slow phone; the preload stays.

**Honest progress** (`loading/loadProgress.ts`, pure): `loadShare(parts)` is files loaded over files wanted: the
page's three (its script, the town read from the save, the strip's script) and the strip's pictures. `loadStage`
reveals once the strip is ready but not before `MIN_SHOW_MS` (600 ms), and offers "Tap to enter" when nothing has come
for `STALL_MS` (8 s). The screen fades over `FADE_MS` (450 ms). `__loading.times` and the strip's `__stripLoad.times`
record when each step came, for measuring.

**The logo** (`loading/logo.ts`, DOM canvas, no Pixi). Behind: the sun's arc from the top bar with its hours, over a
skyline of the town's own timber houses (the Village Tileset's `house1`, `house2`, `house4`) behind the ring wall's
stakes (`palisade04`), the seats' banner on the hall. In front: "Chronos Settlement" in Alegreya SC 700 in the UI's
gold (a gradient edged in ink) on the frame set's carved wood (`plaque`, the wood piece nine-sliced). The still layers
are drawn once at a size (`Logo.size`, the art's pixels on whole screen pixels where they can be) and kept; each beat
lays the life over them: the sun creeping along the arc as the bar fills, the houses' windows lit one by one
(`lightsLit`), a shimmer across the gold. `drawMark(P, size)` is the square mark (the emblem on a wood plaque, every
window lit): `tools/compose-logo.cjs` (run by hand after `npm run web`) draws it as `src/renderer/mobile/art/icon-192.png`
and `icon-512.png`, which tools/build-web.mjs now uses for the PWA icon (the painted `trayIconPng` if they're missing),
and the New Town wizard's last step shows it over the summary (panel/newGamePanel.ts). The pieces are copied beside
the page into `out/web/loading/` by tools/build-web.mjs (`PIECE_FILES`).

**The scene.** The player's own town at night (`loading/sketch.ts`, pure: `townSketch(snap, aspect)` cuts the land
about the camp, wider for a phone on its side, and lists each building's footprint and kind, `house`, `hall`, `tent`,
`field`, `wall` or `fire`, nearest the camp first). The page paints the land a cell a dab (the minimap's colours),
softened and faded at the cut's edges, the buildings in their pack pictures (the timber houses by size, the hall for a
seat or anything wide, the camp tent, the soil for fields, the stakes for the wall, the firepit), all under the night;
then the windows glow as the files arrive, from the camp outward, so the bar is the town waking up. Upright the town
sits under the logo, sideways beside it. A town with fewer than three finished buildings, and a first game with no save
at all, shows the founding scene instead: stars, the camp tent, the firepit catching (the 5000 Pixel Effects flame
growing with the bar), the log, and Duchess ambling about the fire and stopping to chew.

**Measured** (a headless Chromium in the cloud container: software drawing and a slow CPU, so every figure is several
times a phone's). The screen is up 40–80 ms after the page starts; the page's script in at 0.36 s, the town at 1.0–1.5
s, the strip's first report at 1.7–2.9 s. The fixture town reveals at about 15 s, cold or cached alike; a new town at
6.4–7.6 s cold and 4.8–5.6 s cached. The files are not what takes the time: in a CPU profile most of it is the strip
painting its ground chunks (`paintChunk`, `rect2`, `visibility`, `softAt`, `warped` in map/groundArt.ts, about 6 s
here), the same on main, where the strip's canvas showed at 17.8 s and then filled in. From the map first drawn to
every picture in is about 1.2–1.6 s.

Files: `src/renderer/mobile/loading.ts`, `src/renderer/loading/{loadPlan,loadProgress,sketch,stripLoad,logo}.ts`,
`src/renderer/art/loadImage.ts`, `src/shared/gameLoop.ts`, `src/shared/simHost.ts`, `src/shared/ipc.ts`,
`src/renderer/mobile/{boot,mobileBridge,mobile}.ts`, `src/renderer/mobile/index.html`, `src/renderer/main.ts`,
`tools/build-web.mjs`, `tools/compose-logo.cjs`, `test/loadingScreen.test.ts`. HISTORY.md sections this touches: "The
phone made smoother" (boot.js and the worker's `init`), "Offline pacing" (the catch-up runs while held), "The first
hour" (the tips shown here too), "Every building from the packs" (`packUrls`).
