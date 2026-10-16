## New Town screen as tiles and description sheets

The owner's ask: every choice on the New Town screen is a symbol with its name beneath it, in a grid; tapping a tile opens a
description sheet with a scene that stands for the choice. The wizard's steps (`STEPS` in `newGamePanel.ts`) are unchanged,
as are the choices themselves and what they do; only how they are shown and picked has changed. Changes the HISTORY.md
section "New Town, a step at a time" (the cards are now tiles) and "Founders pictured as the map draws them" (the founder
cards are now tiles; the same Himeko doll is drawn).

- `src/renderer/panel/newTownTiles.ts` (new): `tileGrid(tiles, chosenId, onChoose)` makes the grid (`.nt-grid`, `.nt-tile`,
  the chosen one framed `.on`). A tap opens `openSheet`: a sheet up from the bottom on the phone (`.nt-sheet`), a panel down
  the right when held sideways (`@media (min-aspect-ratio: 3/2)`), with the scene, the name, the text, Close and Choose.
  Only one sheet is open at a time (`closeSheet`; also closed on every step change and on Found).
- Scenes: `scene(id)` stacks a backdrop's layers (art/backdrops/<id>.webp, the layer counts in art/backdrops.json) far to
  near, the way the fights use them; `sceneWith` stands figures along its foot. `ORIGIN_SCENE`, `BIOME_SCENE`, `DANGER_SCENE`
  and `SCENARIO_SCENE` choose the backdrop for each people, land, danger and scenario (e.g. forest for the Druid Grove,
  crystal cave for the Deep Hold, underwater for the Tide Clan, wasteland for the Orc Warband). The figures are the
  founders' Himeko paper dolls (`doll` in newGamePanel.ts, drawn by `drawFounderArt`): two of the origin's founders in an
  origin's scene, the picked founder in theirs, one doll for a land or danger, and one to three for a scenario by its companions.
- Symbols: `glyphSymbol` draws a DawnLike icon cell on a round badge (`ORIGIN_GLYPH`, `SCENARIO_GLYPH`, `DANGER_GLYPH`);
  lands use `sceneSymbol`, a round slice of their backdrop; founders use `figureSymbol`, their doll.
- The step's current pick is named under its question (`.nt-chosen`, "Chosen: Druid Grove"). The tile grids are rebuilt by the
  panel's own `drawX` functions, so a pick shows at once (the redraw key is untouched: nothing the tiles change is in the
  snapshot). The founder step keeps the rename field below its tiles; the realms, summary, founder's line and Ironman box
  are as before.
- No new sprites were copied: only art already in `src` (icons, backdrops, dolls), so `CREDITS.md` is unchanged.
- The simulation is untouched: `tools/sim-hash.mjs` is identical before and after.

## Moving scenes in the New Town description sheets

The owner's refinement: the scene in each description sheet is a short living vignette with action that tells the choice's
story, not two people standing there. Replaces the still `sceneWith` pictures above (removed from `newTownTiles.ts`; the
tiles' round land symbols still use a still backdrop slice, `sceneSymbol`).

- `src/renderer/panel/sceneScripts.ts` (data only, tuned without touching the player): a `SceneScript` is a backdrop id, a
  `scroll` speed (art px a second, the far layers slower), an optional `tint` wash, `actors` and `fx`. `ORIGIN_SCRIPTS`
  (one moment from each people's life: the druids calling a storm among trees with leaves and rain, the Deep Hold
  hammering with sparks, the Moon Pack howling under the moon in snow, the Tide Clan diving with fish and bubbles, the
  Lich's skeletons among green wisps, knights charging, nomad wagons rolling past dust, the foundry's steam and sparks,
  the Blood Court's bats and torches, the Fae Court's fireflies, the Crucible's coloured smoke, an orc assault with embers,
  settlers raising a cabin with chimney smoke), `BIOME_SCRIPTS` (a land's weather and wildlife), `DANGER_SCRIPTS`,
  `SCENARIO_SCRIPTS` (lone campfire, a band on the road, a burning village fled from, a supplied camp at work) and
  `founderScript` (a founder at their best-loved skill: work, shooting, fighting, reading, with a creature where the work has
  one). `LOOP` is 8 seconds; the picture is 320x180 art pixels (`VIEW_W`, `VIEW_H`).
- An `Actor` is a paper doll (`who` a founder's index, its layers from `hkLayers`) or a creature (`who` a pack sheet id from
  art/creatures/packs.json: skeletons, werewolves, knights, orcs, kitsune, squidman, the Himeko ghost, imp and ogre...),
  with an `anim` (idle, walk, work, attack, shoot, read), a path `x: [from, to]` over the loop, its feet row `y`, height `h`,
  `phase`, `face` and `bob` (drifting, in water). Dolls use the Himeko pose cells (walk frames, hammer 3/4, strike, ranged 5,
  book 6; row by facing); creatures use their pack rows (shoot, work and read play the attack row).
- An `Fx` is a particle kind (rain, snow, leaves, petals, embers, sparks, bubbles, wisps, fireflies, dust, smoke, steam, bats,
  birds, fish, mist, ash, flash) with a count, an optional emitter point and colour.
- `src/renderer/panel/scenePlayer.ts`: `animScene(script, dolls)` returns one 320x180 canvas (CSS-scaled, pixelated, no more than
  about 6 actors and 50 one-pixel particles), drawn at 24 frames a second from a function of the time alone, so it keeps no state.
  It runs only while the canvas is on the page (it stops itself once the sheet has closed or if it was never attached) and,
  under `prefers-reduced-motion`, draws one still frame.
- Sideways, the sheet's scene is 62% of the panel so the text and Choose button stay in view.
- Checks: typecheck, full `npm test`, `npm run web`, `tools/sim-hash.mjs` before and after identical (renderer-only change), CSS
  braces balanced in panel.html. Founding a town from the page works (Deep Hold picked, found: "Chronos Hold").
