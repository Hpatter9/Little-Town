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
